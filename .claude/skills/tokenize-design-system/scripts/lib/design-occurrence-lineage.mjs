import { createHash } from "node:crypto";
import path from "node:path";

const IMMUTABLE_SOURCE_FIELDS = Object.freeze([
  "schemaVersion",
  "artifactType",
  "runId",
  "sourceFingerprint",
  "toolchainFingerprint",
  "occurrenceId",
  "occurrenceKind",
  "axis",
  "location",
  "sourceLanguage",
  "rawValue",
  "property",
  "context",
  "sourcePayload",
]);

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, ordered(value[key])])
    );
  }
  return value;
}

export function canonicalDesignRecordJson(value) {
  return JSON.stringify(ordered(value));
}

export function designRecordSha256(value) {
  return createHash("sha256")
    .update(canonicalDesignRecordJson(value))
    .digest("hex");
}

function immutableProjection(artifact) {
  return Object.fromEntries(
    IMMUTABLE_SOURCE_FIELDS.map((field) => [field, artifact?.[field]])
  );
}

function sameImmutableSource(left, right) {
  return (
    canonicalDesignRecordJson(immutableProjection(left)) ===
    canonicalDesignRecordJson(immutableProjection(right))
  );
}

function identityKey(artifact) {
  return [
    artifact?.runId ?? "",
    artifact?.sourceFingerprint ?? "",
    artifact?.toolchainFingerprint ?? "",
    artifact?.occurrenceId ?? "",
  ].join("\0");
}

function normalizedRecord(value) {
  return value && typeof value === "object" && "artifact" in value
    ? value
    : { artifact: value, sourcePath: null, line: null, key: null };
}

function isSamePath(left, right) {
  return path.resolve(left) === path.resolve(right);
}

function violation(message, artifact = null, details = undefined) {
  return {
    message,
    artifact,
    ...(details === undefined ? {} : { details }),
  };
}

/**
 * Resolve the active projection of immutable design-occurrence history.
 *
 * The extractor emits one `raw` record per occurrence ID. Classification emits
 * at most one `classified` record with the same ID and a cryptographic pointer
 * to that exact raw record. The raw record stays in the reference closure for
 * auditability; consumers use this function instead of relying on file merge
 * order.
 */
export function resolveDesignOccurrenceLineage({
  records: inputRecords,
  runRoot,
  runId = null,
  sourceFingerprint = null,
  toolchainFingerprint = null,
  requireClassified = false,
} = {}) {
  if (!runRoot) {
    throw new Error("resolveDesignOccurrenceLineage requires runRoot");
  }

  const allRecords = (inputRecords ?? [])
    .map(normalizedRecord)
    .filter(
      ({ artifact }) => artifact?.artifactType === "design-occurrence"
    );
  const inScope = allRecords.filter(({ artifact }) => {
    if (runId !== null && artifact.runId !== runId) return false;
    if (
      sourceFingerprint !== null &&
      artifact.sourceFingerprint !== sourceFingerprint
    ) {
      return false;
    }
    if (
      toolchainFingerprint !== null &&
      artifact.toolchainFingerprint !== toolchainFingerprint
    ) {
      return false;
    }
    return true;
  });
  const violations = [];
  const byIdentity = new Map();

  for (const record of inScope) {
    const stage = record.artifact.recordStage;
    if (stage !== "raw" && stage !== "classified") {
      violations.push(
        violation(
          `${record.artifact.occurrenceId ?? "<unknown>"} has invalid recordStage ${String(stage)}`,
          record.artifact
        )
      );
      continue;
    }
    const key = identityKey(record.artifact);
    if (!byIdentity.has(key)) byIdentity.set(key, []);
    byIdentity.get(key).push(record);
  }

  const currentRecords = [];
  const historicalRecords = [];
  for (const group of byIdentity.values()) {
    const raw = group.filter(
      ({ artifact }) => artifact.recordStage === "raw"
    );
    const classified = group.filter(
      ({ artifact }) => artifact.recordStage === "classified"
    );
    const exemplar = group[0]?.artifact;

    for (const record of raw) {
      if (record.artifact.supersedes !== null) {
        violations.push(
          violation(
            `Raw design occurrence ${record.artifact.occurrenceId} must set supersedes to null`,
            record.artifact
          )
        );
      }
    }
    if (raw.length !== 1) {
      violations.push(
        violation(
          `${exemplar?.occurrenceId ?? "<unknown>"} must have exactly one raw record; found ${raw.length}`,
          exemplar
        )
      );
    }
    if (classified.length > 1) {
      violations.push(
        violation(
          `${exemplar?.occurrenceId ?? "<unknown>"} has ${classified.length} classified leaves; exactly one current record is allowed`,
          exemplar
        )
      );
    }
    if (requireClassified && classified.length !== 1) {
      violations.push(
        violation(
          `${exemplar?.occurrenceId ?? "<unknown>"} has no unique classified projection`,
          exemplar
        )
      );
    }

    for (const classifiedRecord of classified) {
      const artifact = classifiedRecord.artifact;
      const supersedes = artifact.supersedes;
      if (
        !supersedes ||
        supersedes.occurrenceId !== artifact.occurrenceId ||
        supersedes.artifactRef?.artifactType !== "design-occurrence"
      ) {
        violations.push(
          violation(
            `Classified design occurrence ${artifact.occurrenceId} must supersede one same-ID raw design occurrence`,
            artifact
          )
        );
        continue;
      }

      const expectedPath = path.resolve(runRoot, supersedes.artifactRef.path);
      const pathCandidates = allRecords.filter(
        (candidate) =>
          candidate.sourcePath &&
          isSamePath(candidate.sourcePath, expectedPath) &&
          candidate.artifact?.occurrenceId === supersedes.occurrenceId &&
          designRecordSha256(candidate.artifact) === supersedes.recordSha256
      );
      if (pathCandidates.length !== 1) {
        violations.push(
          violation(
            `Supersession for ${artifact.occurrenceId} resolves to ${pathCandidates.length} raw records; expected exactly one`,
            artifact,
            {
              artifactRef: supersedes.artifactRef,
              recordSha256: supersedes.recordSha256,
            }
          )
        );
        continue;
      }

      const predecessor = pathCandidates[0].artifact;
      if (predecessor.recordStage !== "raw") {
        violations.push(
          violation(
            `Classified design occurrence ${artifact.occurrenceId} supersedes a non-raw record`,
            artifact
          )
        );
      }
      if (
        predecessor.runId !== artifact.runId ||
        predecessor.sourceFingerprint !== artifact.sourceFingerprint ||
        predecessor.toolchainFingerprint !== artifact.toolchainFingerprint
      ) {
        violations.push(
          violation(
            `Classified design occurrence ${artifact.occurrenceId} supersedes a stale or cross-run raw record`,
            artifact,
            {
              current: {
                runId: artifact.runId,
                sourceFingerprint: artifact.sourceFingerprint,
                toolchainFingerprint: artifact.toolchainFingerprint,
              },
              predecessor: {
                runId: predecessor.runId,
                sourceFingerprint: predecessor.sourceFingerprint,
                toolchainFingerprint: predecessor.toolchainFingerprint,
              },
            }
          )
        );
      }
      if (!sameImmutableSource(predecessor, artifact)) {
        violations.push(
          violation(
            `Classified design occurrence ${artifact.occurrenceId} changed immutable extraction fields`,
            artifact
          )
        );
      }
    }

    const current = classified.length === 1 ? classified[0] : raw[0];
    if (current) currentRecords.push(current);
    historicalRecords.push(...group.filter((record) => record !== current));
  }

  const sorter = (left, right) =>
    String(left.artifact.occurrenceId).localeCompare(
      String(right.artifact.occurrenceId)
    ) ||
    String(left.sourcePath ?? "").localeCompare(
      String(right.sourcePath ?? "")
    ) ||
    Number(left.line ?? 0) - Number(right.line ?? 0);
  currentRecords.sort(sorter);
  historicalRecords.sort(sorter);

  return {
    valid: violations.length === 0,
    violations,
    currentRecords,
    historicalRecords,
  };
}
