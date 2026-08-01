import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ABSOLUTE_COMPLETION_PREDICATE_IDS,
  ABSOLUTE_REPORT_IDS,
  ABSOLUTE_REPORT_PREFIX,
} from "./absolute-completion-contract.mjs";
import { resolveDesignOccurrenceLineage } from "./design-occurrence-lineage.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SCHEMA_PATH = path.resolve(
  HERE,
  "../../reference/artifact-schemas.json"
);

export const ARTIFACT_TYPES = Object.freeze([
  "run-config",
  "run-state",
  "design-occurrence",
  "normalized-occurrence",
  "axis-discovery",
  "inventory-report",
  "cluster-packet",
  "decision",
  "batch-contract",
  "impacted-context",
  "scenario",
  "evidence-manifest",
  "mutation-manifest",
  "deterministic-checks",
  "comparison",
  "visual-review",
  "adversarial-review",
  "acceptance",
  "final-proof",
]);

export const OCCURRENCE_KINDS = Object.freeze([
  "utility-class",
  "css-declaration",
  "css-custom-property",
  "inline-style",
  "css-in-js",
  "svg-presentation",
  "chart-config",
  "canvas-draw",
  "typography",
  "font-asset",
  "motion-keyframe",
  "motion-transition",
  "image-asset",
  "icon-asset",
  "gradient",
  "illustration",
  "token-definition",
  "token-alias",
  "generated-class",
]);

export const PHASES = Object.freeze([
  "ANCHORED",
  "PREFLIGHTED",
  "INVENTORIED",
  "NORMALIZED",
  "CLASSIFIED",
  "DECIDED",
  "BEFORE_CAPTURED",
  "MIGRATED",
  "BUILT",
  "AFTER_CAPTURED",
  "COMPARED",
  "REVIEWED",
  "ACCEPTED",
  "REINVENTORIED",
  "COMPLETE",
  "PENDING",
  "BLOCKED",
]);

export const FORWARD_TRANSITIONS = Object.freeze({
  ANCHORED: ["PREFLIGHTED"],
  PREFLIGHTED: ["INVENTORIED"],
  INVENTORIED: ["NORMALIZED"],
  NORMALIZED: ["CLASSIFIED"],
  CLASSIFIED: ["DECIDED"],
  DECIDED: ["BEFORE_CAPTURED"],
  BEFORE_CAPTURED: ["MIGRATED"],
  MIGRATED: ["BUILT"],
  BUILT: ["AFTER_CAPTURED"],
  AFTER_CAPTURED: ["COMPARED"],
  COMPARED: ["REVIEWED"],
  REVIEWED: ["ACCEPTED"],
  ACCEPTED: ["REINVENTORIED"],
  REINVENTORIED: ["NORMALIZED", "COMPLETE"],
  COMPLETE: [],
  PENDING: [],
  BLOCKED: [],
});

export const REENTRY_PHASE = Object.freeze({
  "E-EXTRACT": "PREFLIGHTED",
  "E-NORMALIZE": "INVENTORIED",
  "E-CLASSIFY": "NORMALIZED",
  "E-FIXTURE": "DECIDED",
  "E-IMPACT": "DECIDED",
  "E-MIGRATION": "BEFORE_CAPTURED",
  "E-COMPARE": "AFTER_CAPTURED",
  "E-DECISION": "CLASSIFIED",
});

const ROOT_DEF_BY_TYPE = Object.freeze({
  "run-config": "runConfig",
  "run-state": "runState",
  "design-occurrence": "designOccurrence",
  "normalized-occurrence": "normalizedOccurrence",
  "axis-discovery": "axisDiscovery",
  "inventory-report": "inventoryReport",
  "cluster-packet": "clusterPacket",
  decision: "decision",
  "batch-contract": "batchContract",
  "impacted-context": "impactedContext",
  scenario: "scenario",
  "evidence-manifest": "evidenceManifest",
  "mutation-manifest": "mutationManifest",
  "deterministic-checks": "deterministicChecks",
  comparison: "comparison",
  "visual-review": "visualReview",
  "adversarial-review": "adversarialReview",
  acceptance: "acceptance",
  "final-proof": "finalProof",
});

const REENTRY_BY_ARTIFACT = Object.freeze({
  "run-config": "E-EXTRACT",
  "run-state": "E-EXTRACT",
  "design-occurrence": "E-EXTRACT",
  "normalized-occurrence": "E-NORMALIZE",
  "axis-discovery": "E-EXTRACT",
  "inventory-report": "E-EXTRACT",
  "cluster-packet": "E-CLASSIFY",
  decision: "E-CLASSIFY",
  "batch-contract": "E-DECISION",
  "impacted-context": "E-IMPACT",
  scenario: "E-FIXTURE",
  "evidence-manifest": "E-COMPARE",
  "mutation-manifest": "E-MIGRATION",
  "deterministic-checks": "E-MIGRATION",
  comparison: "E-COMPARE",
  "visual-review": "E-DECISION",
  "adversarial-review": "E-DECISION",
  acceptance: "E-MIGRATION",
  "final-proof": "E-EXTRACT",
});

export function reentryCodeForArtifact(artifactType) {
  return REENTRY_BY_ARTIFACT[artifactType] ?? "E-EXTRACT";
}

const TERMINAL_RECONCILIATION = new Set([
  "approved-token",
  "approved-contract",
  "approved-exception",
  "approved-out-of-scope",
  "invalid-source",
]);

const CLASS_OCCURRENCE_KINDS = new Set(["utility-class", "generated-class"]);

const PHASE_INDEX = new Map(PHASES.map((phase, index) => [phase, index]));

const REQUIRED_TRANSITION_ARTIFACTS = Object.freeze({
  INVENTORIED: ["design-occurrence", "axis-discovery"],
  NORMALIZED: ["normalized-occurrence"],
  CLASSIFIED: ["inventory-report", "cluster-packet"],
  DECIDED: ["decision", "batch-contract"],
  BEFORE_CAPTURED: ["impacted-context", "scenario", "evidence-manifest"],
  MIGRATED: ["mutation-manifest"],
  BUILT: ["deterministic-checks"],
  AFTER_CAPTURED: ["evidence-manifest"],
  COMPARED: ["comparison"],
  REVIEWED: ["visual-review", "adversarial-review"],
  ACCEPTED: ["acceptance"],
  REINVENTORIED: ["design-occurrence", "axis-discovery"],
  COMPLETE: [
    "evidence-manifest",
    "deterministic-checks",
    "adversarial-review",
    "final-proof",
  ],
});

function ordered(value) {
  if (Array.isArray(value)) {
    return value.map(ordered);
  }
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

export function canonicalJson(value) {
  return JSON.stringify(ordered(value));
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256File(filePath) {
  return sha256Bytes(readFileSync(filePath));
}

export function sha256CanonicalJson(value) {
  return sha256Bytes(Buffer.from(canonicalJson(value), "utf8"));
}

function isoDateTime(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value
    )
  ) {
    return false;
  }
  return Number.isFinite(Date.parse(value));
}

function extractArtifactTypeFromDefinition(definition) {
  for (const branch of definition?.allOf ?? []) {
    const value = branch?.properties?.artifactType?.const;
    if (value) return value;
  }
  return definition?.properties?.artifactType?.const ?? null;
}

export function loadSchemaBundle(schemaPath = DEFAULT_SCHEMA_PATH) {
  return JSON.parse(readFileSync(path.resolve(schemaPath), "utf8"));
}

export function createArtifactValidator({
  root,
  schemaPath = DEFAULT_SCHEMA_PATH,
} = {}) {
  if (!root) {
    throw new Error(
      "createArtifactValidator requires --root so Ajv is resolved from the target project"
    );
  }

  const applicationRoot = path.resolve(root);
  const packageJson = path.join(applicationRoot, "package.json");
  if (!existsSync(packageJson)) {
    throw new Error(`Target package.json not found: ${packageJson}`);
  }

  const targetRequire = createRequire(packageJson);
  let Ajv2020;
  try {
    const loaded = targetRequire("ajv/dist/2020");
    Ajv2020 = loaded.default ?? loaded;
  } catch (error) {
    throw new Error(
      `Ajv 2020 could not be resolved from ${applicationRoot}. Add Ajv 8 as a target-project development dependency.`,
      { cause: error }
    );
  }

  const schema = loadSchemaBundle(schemaPath);
  const rootTypes = (schema.oneOf ?? []).map((entry) => {
    const ref = entry.$ref;
    const definitionName = ref?.split("/").at(-1);
    return extractArtifactTypeFromDefinition(schema.$defs?.[definitionName]);
  });
  const expected = new Set(ARTIFACT_TYPES);
  if (
    rootTypes.length !== ARTIFACT_TYPES.length ||
    new Set(rootTypes).size !== ARTIFACT_TYPES.length ||
    rootTypes.some((type) => !expected.has(type))
  ) {
    throw new Error(
      `Schema bundle must expose exactly the ${ARTIFACT_TYPES.length} closed artifact types`
    );
  }

  const ajv = new Ajv2020({
    allErrors: true,
    allowUnionTypes: true,
    strictSchema: true,
    strictTypes: false,
    strictTuples: true,
    strictRequired: true,
  });
  ajv.addFormat("date-time", {
    type: "string",
    validate: isoDateTime,
  });
  ajv.addSchema(schema);

  const validators = new Map();
  for (const artifactType of ARTIFACT_TYPES) {
    const definitionName = ROOT_DEF_BY_TYPE[artifactType];
    const validator = ajv.getSchema(`${schema.$id}#/$defs/${definitionName}`);
    if (!validator) {
      throw new Error(`Missing compiled schema for ${artifactType}`);
    }
    validators.set(artifactType, validator);
  }

  return {
    applicationRoot,
    schema,
    validators,
    validate(artifact) {
      const artifactType = artifact?.artifactType;
      const validator = validators.get(artifactType);
      if (!validator) {
        return {
          valid: false,
          reentryCode: "E-EXTRACT",
          errors: [
            {
              instancePath: "/artifactType",
              keyword: "enum",
              message: `must be one of the ${ARTIFACT_TYPES.length} closed artifact types`,
              params: { artifactType },
            },
          ],
        };
      }

      const valid = validator(artifact);
      return {
        valid: Boolean(valid),
        reentryCode: REENTRY_BY_ARTIFACT[artifactType],
        errors: valid
          ? []
          : (validator.errors ?? []).map((error) => ({ ...error })),
      };
    },
  };
}

export class ArtifactContractError extends Error {
  constructor(violations, message = "Artifact contract validation failed") {
    super(message);
    this.name = "ArtifactContractError";
    this.violations = violations;
    this.reentryCodes = [
      ...new Set(violations.map((item) => item.reentryCode).filter(Boolean)),
    ];
    this.reentryCode = this.reentryCodes[0] ?? "E-EXTRACT";
  }

  toJSON() {
    return {
      error: this.name,
      message: this.message,
      reentryCode: this.reentryCode,
      reentryCodes: this.reentryCodes,
      violations: this.violations,
    };
  }
}

function violation(
  invariant,
  reentryCode,
  message,
  artifact = null,
  details = undefined
) {
  return {
    invariant,
    reentryCode,
    message,
    artifactType: artifact?.artifactType ?? null,
    ...(details === undefined ? {} : { details }),
  };
}

function toRecord(value, index = 0) {
  if (value && typeof value === "object" && "artifact" in value) {
    return {
      artifact: value.artifact,
      sourcePath: value.sourcePath ? path.resolve(value.sourcePath) : null,
      line: value.line ?? null,
      key: value.key ?? null,
    };
  }
  return {
    artifact: value,
    sourcePath: null,
    line: null,
    key: `memory:${index}`,
  };
}

export function readArtifactRecords(filePath) {
  const absolutePath = path.resolve(filePath);
  const text = readFileSync(absolutePath, "utf8");
  if (absolutePath.endsWith(".ndjson")) {
    const records = [];
    for (const [index, rawLine] of text.split(/\r?\n/u).entries()) {
      const line = rawLine.trim();
      if (!line) continue;
      let artifact;
      try {
        artifact = JSON.parse(line);
      } catch (error) {
        throw new ArtifactContractError([
          violation(
            "schema-instance",
            "E-EXTRACT",
            `Invalid NDJSON at ${absolutePath}:${index + 1}: ${error.message}`
          ),
        ]);
      }
      records.push({
        artifact,
        sourcePath: absolutePath,
        line: index + 1,
        key: `${absolutePath}:${index + 1}`,
      });
    }
    if (records.length === 0) {
      throw new ArtifactContractError([
        violation(
          "schema-instance",
          "E-EXTRACT",
          `NDJSON artifact is empty: ${absolutePath}`
        ),
      ]);
    }
    return records;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new ArtifactContractError([
      violation(
        "schema-instance",
        "E-EXTRACT",
        `Invalid JSON at ${absolutePath}: ${error.message}`
      ),
    ]);
  }
  const artifacts = Array.isArray(parsed) ? parsed : [parsed];
  if (artifacts.length === 0) {
    throw new ArtifactContractError([
      violation(
        "schema-instance",
        "E-EXTRACT",
        `JSON artifact array is empty: ${absolutePath}`
      ),
    ]);
  }
  return artifacts.map((artifact, index) => ({
    artifact,
    sourcePath: absolutePath,
    line: Array.isArray(parsed) ? index + 1 : null,
    key: Array.isArray(parsed) ? `${absolutePath}#${index}` : absolutePath,
  }));
}

function isWithin(parentPath, candidatePath) {
  const relative = path.relative(parentPath, candidatePath);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

export function resolveArtifactRefPath(runRoot, artifactRef) {
  if (path.isAbsolute(artifactRef.path)) {
    throw new ArtifactContractError([
      violation(
        "reference-integrity",
        reentryCodeForArtifact(artifactRef.artifactType),
        `Artifact references must be run-relative: ${artifactRef.path}`,
        null,
        { artifactRef }
      ),
    ]);
  }
  const absolute = path.resolve(runRoot, artifactRef.path);
  if (!isWithin(path.resolve(runRoot), absolute)) {
    throw new ArtifactContractError([
      violation(
        "reference-integrity",
        reentryCodeForArtifact(artifactRef.artifactType),
        `Artifact reference escapes the run root: ${artifactRef.path}`,
        null,
        { artifactRef }
      ),
    ]);
  }
  return absolute;
}

export function makeArtifactRef(filePath, { runRoot, artifactType } = {}) {
  const absolutePath = path.resolve(filePath);
  const absoluteRunRoot = path.resolve(runRoot);
  if (!isWithin(absoluteRunRoot, absolutePath)) {
    throw new Error(`Artifact is outside run root: ${absolutePath}`);
  }
  return {
    artifactType,
    path: path
      .relative(absoluteRunRoot, absolutePath)
      .split(path.sep)
      .join("/"),
    sha256: sha256File(absolutePath),
  };
}

function collectArtifactRefs(value, refs = [], seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return refs;
  seen.add(value);
  if (
    typeof value.artifactType === "string" &&
    typeof value.path === "string" &&
    typeof value.sha256 === "string" &&
    Object.keys(value).every((key) =>
      ["artifactType", "path", "sha256"].includes(key)
    )
  ) {
    refs.push(value);
    return refs;
  }
  for (const nested of Object.values(value)) {
    collectArtifactRefs(nested, refs, seen);
  }
  return refs;
}

function recordKey(record, index) {
  return (
    record.key ??
    (record.sourcePath
      ? `${record.sourcePath}:${record.line ?? "json"}`
      : `memory:${index}:${record.artifact?.artifactType ?? "unknown"}:${record.artifact?.occurrenceId ?? record.artifact?.scenarioId ?? ""}`)
  );
}

function addRecord(records, record, seenKeys) {
  const key = recordKey(record, records.length);
  if (seenKeys.has(key)) return false;
  seenKeys.add(key);
  records.push({ ...record, key });
  return true;
}

function resolveReferenceClosure(initialRecords, runRoot, violations) {
  const records = [];
  const seenKeys = new Set();
  initialRecords.forEach((record, index) =>
    addRecord(records, toRecord(record, index), seenKeys)
  );
  const checkedRefs = new Set();

  for (let cursor = 0; cursor < records.length; cursor += 1) {
    const source = records[cursor];
    for (const artifactRef of collectArtifactRefs(source.artifact)) {
      const refKey = `${artifactRef.artifactType}:${artifactRef.path}:${artifactRef.sha256}`;
      if (checkedRefs.has(refKey)) continue;
      checkedRefs.add(refKey);

      let absolutePath;
      try {
        absolutePath = resolveArtifactRefPath(runRoot, artifactRef);
      } catch (error) {
        if (error instanceof ArtifactContractError) {
          violations.push(...error.violations);
          continue;
        }
        throw error;
      }
      const code =
        REENTRY_BY_ARTIFACT[artifactRef.artifactType] ??
        reentryCodeForArtifact(source.artifact?.artifactType);
      if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
        violations.push(
          violation(
            "reference-integrity",
            code,
            `Referenced artifact does not exist: ${artifactRef.path}`,
            source.artifact,
            { artifactRef }
          )
        );
        continue;
      }
      const actualSha256 = sha256File(absolutePath);
      if (actualSha256 !== artifactRef.sha256) {
        violations.push(
          violation(
            "reference-integrity",
            code,
            `Referenced artifact hash mismatch: ${artifactRef.path}`,
            source.artifact,
            {
              artifactRef,
              actualSha256,
            }
          )
        );
        continue;
      }

      let targetRecords;
      try {
        targetRecords = readArtifactRecords(absolutePath);
      } catch (error) {
        if (error instanceof ArtifactContractError) {
          violations.push(
            ...error.violations.map((item) => ({
              ...item,
              reentryCode: code,
            }))
          );
          continue;
        }
        throw error;
      }
      const targetTypes = new Set(
        targetRecords.map((record) => record.artifact?.artifactType)
      );
      const matching = targetRecords.filter(
        (record) => record.artifact?.artifactType === artifactRef.artifactType
      );
      if (
        matching.length === 0 ||
        targetTypes.size !== 1 ||
        !targetTypes.has(artifactRef.artifactType)
      ) {
        violations.push(
          violation(
            "reference-integrity",
            code,
            `Referenced file ${artifactRef.path} must contain only ${artifactRef.artifactType} artifacts`,
            source.artifact,
            { artifactRef, targetTypes: [...targetTypes] }
          )
        );
        continue;
      }
      for (const target of targetRecords) addRecord(records, target, seenKeys);
    }
  }
  return records;
}

function recordsByType(records) {
  const index = new Map(ARTIFACT_TYPES.map((type) => [type, []]));
  for (const record of records) {
    const bucket = index.get(record.artifact?.artifactType);
    if (bucket) bucket.push(record);
  }
  return index;
}

function sameSet(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

function getSingleByBatch(index, artifactType, batchId, violations, code) {
  const matching = (index.get(artifactType) ?? []).filter(
    ({ artifact }) => artifact.batchId === batchId
  );
  if (matching.length > 1) {
    violations.push(
      violation(
        "batch-identity",
        code,
        `Expected at most one ${artifactType} for ${batchId}; found ${matching.length}`,
        matching[0]?.artifact
      )
    );
  }
  return matching[0]?.artifact ?? null;
}

function referencedTargets(records, artifactRef) {
  if (
    !artifactRef ||
    typeof artifactRef.path !== "string" ||
    typeof artifactRef.artifactType !== "string"
  ) {
    return [];
  }
  const targetPath = artifactRef.path.split("/").join(path.sep);
  return records
    .filter(
      (record) =>
        record.artifact?.artifactType === artifactRef.artifactType &&
        record.sourcePath &&
        path
          .normalize(record.sourcePath)
          .endsWith(`${path.sep}${path.normalize(targetPath)}`)
    )
    .map((record) => record.artifact);
}

function sourceMismatch(
  violations,
  invariant,
  code,
  message,
  artifact,
  expected,
  actual = artifact?.sourceFingerprint
) {
  if (actual !== expected) {
    violations.push(
      violation(invariant, code, message, artifact, { expected, actual })
    );
  }
}

function checkSourceFreshness(index, records, runConfig, violations) {
  const toolchainFingerprint = sha256CanonicalJson(runConfig.toolchain);
  if (runConfig.toolchainFingerprint !== toolchainFingerprint) {
    violations.push(
      violation(
        "toolchain-freshness",
        "E-EXTRACT",
        "run-config.toolchainFingerprint is not the canonical SHA-256 of run-config.toolchain",
        runConfig,
        {
          expected: toolchainFingerprint,
          actual: runConfig.toolchainFingerprint,
        }
      )
    );
  }
  for (const { artifact } of records) {
    if (artifact.toolchainFingerprint !== toolchainFingerprint) {
      violations.push(
        violation(
          "toolchain-freshness",
          REENTRY_BY_ARTIFACT[artifact.artifactType] ?? "E-EXTRACT",
          `${artifact.artifactType} was not produced by the configured toolchain`,
          artifact,
          {
            expected: toolchainFingerprint,
            actual: artifact.toolchainFingerprint,
          }
        )
      );
    }
  }

  for (const { artifact } of index.get("normalized-occurrence") ?? []) {
    const designs = (index.get("design-occurrence") ?? [])
      .map((record) => record.artifact)
      .filter((item) => item.occurrenceId === artifact.designOccurrenceId);
    const design = designs.find(
      (item) => item.sourceFingerprint === artifact.sourceFingerprint
    );
    if (design) {
      sourceMismatch(
        violations,
        "source-freshness",
        "E-NORMALIZE",
        `normalized occurrence ${artifact.occurrenceId} does not match its design source`,
        artifact,
        design.sourceFingerprint
      );
    } else if (designs.length > 0) {
      violations.push(
        violation(
          "source-freshness",
          "E-NORMALIZE",
          `normalized occurrence ${artifact.occurrenceId} was produced from a stale design source`,
          artifact,
          {
            normalizedSource: artifact.sourceFingerprint,
            designSources: [
              ...new Set(designs.map((item) => item.sourceFingerprint)),
            ],
          }
        )
      );
    }
  }

  for (const type of ["inventory-report", "cluster-packet", "decision"]) {
    for (const { artifact } of index.get(type) ?? []) {
      for (const artifactRef of collectArtifactRefs(artifact)) {
        for (const target of referencedTargets(records, artifactRef)) {
          sourceMismatch(
            violations,
            "source-freshness",
            REENTRY_BY_ARTIFACT[type],
            `${type} references evidence from another source fingerprint`,
            artifact,
            artifact.sourceFingerprint,
            target.sourceFingerprint
          );
        }
      }
    }
  }

  const batchIds = new Set(
    (index.get("batch-contract") ?? []).map(({ artifact }) => artifact.batchId)
  );
  for (const batchId of batchIds) {
    const contract = getSingleByBatch(
      index,
      "batch-contract",
      batchId,
      violations,
      "E-DECISION"
    );
    if (!contract) continue;
    sourceMismatch(
      violations,
      "source-freshness",
      "E-DECISION",
      `${batchId} contract does not match its rollback source`,
      contract,
      contract.rollbackSourceFingerprint
    );

    for (const { artifact } of index.get("impacted-context") ?? []) {
      if (artifact.batchId === batchId) {
        sourceMismatch(
          violations,
          "source-freshness",
          "E-IMPACT",
          `${batchId} impacted context is stale`,
          artifact,
          contract.rollbackSourceFingerprint
        );
      }
    }
    const impact = getSingleByBatch(
      index,
      "impacted-context",
      batchId,
      violations,
      "E-IMPACT"
    );
    if (impact) {
      const scenarioIds = new Set(impact.scenarioIds);
      const scenarios = (index.get("scenario") ?? []).map(
        (record) => record.artifact
      );
      for (const scenarioId of scenarioIds) {
        const exact = scenarios.filter(
          (artifact) =>
            artifact.scenarioId === scenarioId &&
            artifact.sourceFingerprint === contract.rollbackSourceFingerprint
        );
        if (exact.length !== 1) {
          violations.push(
            violation(
              "source-freshness",
              "E-FIXTURE",
              `${scenarioId} must have exactly one fixture definition for ${batchId}'s pre-mutation source; found ${exact.length}`,
              impact
            )
          );
        }
      }
    }

    const manifests = (index.get("evidence-manifest") ?? [])
      .map((record) => record.artifact)
      .filter((artifact) => artifact.batchId === batchId);
    for (const manifest of manifests.filter(
      (item) => item.phase === "before"
    )) {
      sourceMismatch(
        violations,
        "source-freshness",
        "E-COMPARE",
        `${batchId} before manifest is stale`,
        manifest,
        contract.rollbackSourceFingerprint
      );
    }

    const mutation = getSingleByBatch(
      index,
      "mutation-manifest",
      batchId,
      violations,
      "E-MIGRATION"
    );
    if (!mutation) continue;
    sourceMismatch(
      violations,
      "source-freshness",
      "E-MIGRATION",
      `${batchId} mutation started from a different baseline`,
      mutation,
      contract.rollbackSourceFingerprint,
      mutation.beforeSourceFingerprint
    );
    sourceMismatch(
      violations,
      "source-freshness",
      "E-MIGRATION",
      `${batchId} mutation artifact is not bound to its resulting source`,
      mutation,
      mutation.afterSourceFingerprint
    );

    const afterSource = mutation.afterSourceFingerprint;
    const afterArtifacts = [
      ...(index.get("deterministic-checks") ?? [])
        .map((record) => record.artifact)
        .filter(
          (artifact) =>
            artifact.scope === "batch" && artifact.batchId === batchId
        ),
      ...manifests.filter((item) => item.phase === "after"),
      ...(index.get("comparison") ?? [])
        .map((record) => record.artifact)
        .filter((artifact) => artifact.batchId === batchId),
      ...(index.get("visual-review") ?? [])
        .map((record) => record.artifact)
        .filter((artifact) => artifact.batchId === batchId),
      ...(index.get("adversarial-review") ?? [])
        .map((record) => record.artifact)
        .filter(
          (artifact) =>
            artifact.scope === "batch" && artifact.batchId === batchId
        ),
      ...(index.get("acceptance") ?? [])
        .map((record) => record.artifact)
        .filter((artifact) => artifact.batchId === batchId),
    ];
    for (const artifact of afterArtifacts) {
      sourceMismatch(
        violations,
        "source-freshness",
        REENTRY_BY_ARTIFACT[artifact.artifactType],
        `${artifact.artifactType} for ${batchId} is stale after mutation`,
        artifact,
        afterSource
      );
    }
  }
}

function checkRunIdentity(records, runConfig, violations) {
  for (const { artifact } of records) {
    if (artifact.runId !== runConfig.runId) {
      violations.push(
        violation(
          "run-identity",
          REENTRY_BY_ARTIFACT[artifact.artifactType] ?? "E-EXTRACT",
          `${artifact.artifactType ?? "unknown"} belongs to ${artifact.runId ?? "no run"}, expected ${runConfig.runId}`,
          artifact
        )
      );
    }
  }
}

function checkSourceKindRegistry(runConfig, violations) {
  const entries = runConfig.sourceKindRegistry ?? [];
  const kinds = entries.map((entry) => entry.occurrenceKind);
  const actual = new Set(kinds);
  const expected = new Set(OCCURRENCE_KINDS);
  const duplicates = duplicateValues(kinds);
  const missing = OCCURRENCE_KINDS.filter((kind) => !actual.has(kind));
  const unknown = [...actual].filter((kind) => !expected.has(kind));
  if (
    entries.length !== OCCURRENCE_KINDS.length ||
    duplicates.length > 0 ||
    missing.length > 0 ||
    unknown.length > 0
  ) {
    violations.push(
      violation(
        "source-kind-registry",
        "E-EXTRACT",
        "sourceKindRegistry must bind each closed occurrence kind exactly once",
        runConfig,
        { duplicates, missing, unknown }
      )
    );
  }
  for (const entry of entries) {
    if (
      entry.disposition === "scan" &&
      (typeof entry.adapter !== "string" || entry.adapter.length === 0)
    ) {
      violations.push(
        violation(
          "source-kind-registry",
          "E-EXTRACT",
          `${entry.occurrenceKind} is configured for scanning without an adapter`,
          runConfig
        )
      );
    }
    if (
      entry.disposition === "approved-out-of-scope" &&
      (typeof entry.rationale !== "string" || entry.rationale.length === 0)
    ) {
      violations.push(
        violation(
          "source-kind-registry",
          "E-EXTRACT",
          `${entry.occurrenceKind} is out of scope without a rationale`,
          runConfig
        )
      );
    }
  }
}

function checkDesignReconciliation(
  index,
  currentDesignRecords,
  targetPhase,
  activeSourceFingerprint,
  violations
) {
  const design = currentDesignRecords.map((record) => record.artifact);
  if (
    (phaseAtLeast(targetPhase, "INVENTORIED") || targetPhase === "COMPLETE") &&
    design.length === 0
  ) {
    violations.push(
      violation(
        "design-reconciliation",
        "E-EXTRACT",
        "Active source design inventory is empty"
      )
    );
  }

  const done = targetPhase === "COMPLETE";
  if (done) {
    const invalidEvidence = (index.get("inventory-report") ?? [])
      .map((record) => record.artifact)
      .some(
        (artifact) =>
          artifact.sourceFingerprint === activeSourceFingerprint &&
          artifact.inventoryKind === "invalid-source" &&
          artifact.reconciled === true
      );
    for (const artifact of design) {
      if (!TERMINAL_RECONCILIATION.has(artifact.reconciliation?.status)) {
        violations.push(
          violation(
            "design-reconciliation",
            "E-CLASSIFY",
            `${artifact.occurrenceId} has non-terminal reconciliation ${artifact.reconciliation?.status}`,
            artifact
          )
        );
      }
      if (
        artifact.reconciliation?.status === "invalid-source" &&
        !invalidEvidence
      ) {
        violations.push(
          violation(
            "design-reconciliation",
            "E-EXTRACT",
            `${artifact.occurrenceId} is invalid-source without a reconciled invalid-source evidence report`,
            artifact
          )
        );
      }
    }
  }
}

function phaseAtLeast(targetPhase, phase) {
  const target = PHASE_INDEX.get(targetPhase);
  const threshold = PHASE_INDEX.get(phase);
  return (
    Number.isInteger(target) &&
    Number.isInteger(threshold) &&
    target >= threshold &&
    target < PHASE_INDEX.get("PENDING")
  );
}

function checkClassProjection(
  index,
  currentDesignRecords,
  targetPhase,
  activeSourceFingerprint,
  violations
) {
  if (!phaseAtLeast(targetPhase, "NORMALIZED") && targetPhase !== "COMPLETE") {
    return;
  }
  const design = currentDesignRecords.map((record) => record.artifact);
  const normalized = (index.get("normalized-occurrence") ?? [])
    .map((record) => record.artifact)
    .filter(
      (artifact) => artifact.sourceFingerprint === activeSourceFingerprint
    );
  const projectionCounts = new Map();
  for (const artifact of normalized) {
    projectionCounts.set(
      artifact.designOccurrenceId,
      (projectionCounts.get(artifact.designOccurrenceId) ?? 0) + 1
    );
  }
  for (const artifact of design) {
    const count = projectionCounts.get(artifact.occurrenceId) ?? 0;
    if (CLASS_OCCURRENCE_KINDS.has(artifact.occurrenceKind) && count !== 1) {
      violations.push(
        violation(
          "class-projection-parity",
          "E-NORMALIZE",
          `${artifact.occurrenceId} must have exactly one normalized projection; found ${count}`,
          artifact
        )
      );
    }
    if (!CLASS_OCCURRENCE_KINDS.has(artifact.occurrenceKind) && count !== 0) {
      violations.push(
        violation(
          "class-projection-parity",
          "E-NORMALIZE",
          `Non-class occurrence ${artifact.occurrenceId} must not be forced into normalized-occurrence`,
          artifact
        )
      );
    }
  }
  const designById = new Map(
    design.map((artifact) => [artifact.occurrenceId, artifact])
  );
  for (const artifact of normalized) {
    const source = designById.get(artifact.designOccurrenceId);
    if (!source || !CLASS_OCCURRENCE_KINDS.has(source.occurrenceKind)) {
      violations.push(
        violation(
          "class-projection-parity",
          "E-NORMALIZE",
          `${artifact.occurrenceId} points to a missing or non-class design occurrence`,
          artifact
        )
      );
    }
  }
  for (const duplicate of duplicateValues(
    normalized.map((artifact) => artifact.occurrenceId)
  )) {
    violations.push(
      violation(
        "class-projection-parity",
        "E-NORMALIZE",
        `Normalized occurrence ID is not unique: ${duplicate}`
      )
    );
  }
}

/**
 * INTEGRIDADE REFERENCIAL DOS IDS DE CLUSTER — o check que faltava.
 *
 * DEFEITO REAL que motivou este bloco (review adversarial, 2026-08-01). Uma
 * corrida chegou a `DECIDED` com **0 de 236** `targetClusterIds` do
 * `batch-contract` existindo entre os `cluster-packet` da fase anterior, e
 * **0 de 3.119** `occurrenceIds` existindo no censo — e
 * `tokenization-runner validate` devolveu `valid:true`.
 *
 * A razão: `grep occurrenceIds|targetClusterIds|clusterId` neste arquivo não
 * devolvia NADA. O schema exige `nonEmptyStringSet` e nada mais; qualquer string
 * passa. O contrato reconta eixos contra o censo (checkAxisDiscovery) mas nunca
 * recontava id de cluster — então a cadeia CLASSIFIED→DECIDED podia estar
 * inteiramente desconectada e ainda assim ser carimbada como válida.
 *
 * Referência pendurada dentro de artefato que o verificador aprova é a classe de
 * defeito que este contrato existe para impedir. Ele agora recusa.
 *
 * ESCOPO DELIBERADO: só verifica quando HÁ `cluster-packet` no conjunto ativo.
 * Uma re-entrada que revalide só o lote não tem os packets em mãos, e exigir a
 * presença deles ali transformaria um check de integridade em exigência de
 * completude — que é outra coisa, e faria a re-entrada falhar por um motivo que
 * não é o dela.
 */
function checkClusterReferentialIntegrity(index, violations) {
  const packets = index.get("cluster-packet") ?? [];
  if (packets.length === 0) return;

  const conhecidos = new Set(
    packets.map((record) => record.artifact?.clusterId).filter(Boolean)
  );
  if (conhecidos.size === 0) return;

  const conferir = (tipo, artifact, campo, ids) => {
    const penduradas = (ids ?? []).filter((id) => !conhecidos.has(id));
    if (penduradas.length === 0) return;
    violations.push(
      violation(
        tipo,
        "E-CLASSIFY",
        `${campo} cita ${penduradas.length} cluster(s) que nenhum cluster-packet declara`,
        artifact,
        {
          campo,
          penduradas: penduradas.slice(0, 10),
          totalCitados: (ids ?? []).length,
          clustersConhecidos: conhecidos.size,
        }
      )
    );
  };

  for (const record of index.get("decision") ?? []) {
    conferir("decision", record.artifact, "decision.clusterIds", record.artifact?.clusterIds);
  }
  for (const record of index.get("batch-contract") ?? []) {
    conferir(
      "batch-contract",
      record.artifact,
      "batch-contract.targetClusterIds",
      record.artifact?.targetClusterIds
    );
  }
}

function checkAxisDiscovery(
  index,
  currentDesignRecords,
  runConfig,
  targetPhase,
  activeSourceFingerprint,
  violations
) {
  const configuredAxes = runConfig.axisRegistry.map((entry) => entry.axis);
  const duplicateAxes = duplicateValues(configuredAxes);
  if (duplicateAxes.length > 0) {
    violations.push(
      violation(
        "axis-discovery",
        "E-EXTRACT",
        "axisRegistry configures an axis more than once",
        runConfig,
        { duplicateAxes }
      )
    );
  }
  const configured = new Set(configuredAxes);
  const registeredKinds = new Set(
    runConfig.sourceKindRegistry.map((entry) => entry.occurrenceKind)
  );
  const activeDesign = currentDesignRecords.map((record) => record.artifact);
  const actualAxisCounts = new Map();
  const actualKindCounts = new Map();
  for (const artifact of activeDesign) {
    actualAxisCounts.set(
      artifact.axis,
      (actualAxisCounts.get(artifact.axis) ?? 0) + 1
    );
    actualKindCounts.set(
      artifact.occurrenceKind,
      (actualKindCounts.get(artifact.occurrenceKind) ?? 0) + 1
    );
  }
  const discoveries = (index.get("axis-discovery") ?? [])
    .map((record) => record.artifact)
    .filter(
      (artifact) => artifact.sourceFingerprint === activeSourceFingerprint
    );
  if (
    (phaseAtLeast(targetPhase, "INVENTORIED") || targetPhase === "COMPLETE") &&
    discoveries.length !== 1
  ) {
    violations.push(
      violation(
        "axis-discovery",
        "E-EXTRACT",
        `Active source requires exactly one axis-discovery artifact; found ${discoveries.length}`
      )
    );
  }
  for (const artifact of discoveries) {
    if (!sameSet(new Set(artifact.configuredAxes), configured)) {
      violations.push(
        violation(
          "axis-discovery",
          "E-EXTRACT",
          "axis-discovery.configuredAxes does not match run-config.axisRegistry",
          artifact
        )
      );
    }
    const discovered = new Set(artifact.discoveredAxes);
    const reconciled = new Set(artifact.reconciledAxes);
    const uncovered = new Set(artifact.uncoveredAxes);
    for (const axis of discovered) {
      if (!configured.has(axis) && !uncovered.has(axis)) {
        violations.push(
          violation(
            "axis-discovery",
            "E-EXTRACT",
            `Discovered axis ${axis} has neither a configured contract nor an uncovered-axis record`,
            artifact
          )
        );
      }
      if (configured.has(axis) && !reconciled.has(axis)) {
        violations.push(
          violation(
            "axis-discovery",
            "E-EXTRACT",
            `Configured discovered axis ${axis} is not reconciled`,
            artifact
          )
        );
      }
    }
    for (const axis of reconciled) {
      if (!discovered.has(axis) || !configured.has(axis)) {
        violations.push(
          violation(
            "axis-discovery",
            "E-EXTRACT",
            `reconciledAxes contains inconsistent axis ${axis}`,
            artifact
          )
        );
      }
    }
    for (const axis of uncovered) {
      if (!discovered.has(axis) || configured.has(axis)) {
        violations.push(
          violation(
            "axis-discovery",
            "E-EXTRACT",
            `uncoveredAxes contains inconsistent axis ${axis}`,
            artifact
          )
        );
      }
    }
    if (
      !sameSet(new Set(artifact.registeredOccurrenceKinds), registeredKinds)
    ) {
      violations.push(
        violation(
          "axis-discovery",
          "E-EXTRACT",
          "axis-discovery registry does not match run-config.sourceKindRegistry",
          artifact
        )
      );
    }
    const discoveredKinds = new Set(artifact.discoveredOccurrenceKinds);
    const coveredKinds = new Set(artifact.coveredOccurrenceKinds);
    const uncoveredKinds = new Set(artifact.uncoveredOccurrenceKinds);
    for (const kind of discoveredKinds) {
      const coverageCount =
        Number(coveredKinds.has(kind)) + Number(uncoveredKinds.has(kind));
      if (coverageCount !== 1) {
        violations.push(
          violation(
            "axis-discovery",
            "E-EXTRACT",
            `Discovered occurrence kind ${kind} must be covered or uncovered exactly once`,
            artifact
          )
        );
      }
    }
    for (const kind of [...coveredKinds, ...uncoveredKinds]) {
      if (!discoveredKinds.has(kind)) {
        violations.push(
          violation(
            "axis-discovery",
            "E-EXTRACT",
            `Coverage mentions undiscovered occurrence kind ${kind}`,
            artifact
          )
        );
      }
    }
    const actualAxes = new Set(actualAxisCounts.keys());
    const actualKinds = new Set(actualKindCounts.keys());
    if (
      !sameSet(discovered, actualAxes) ||
      !sameSet(discoveredKinds, actualKinds)
    ) {
      violations.push(
        violation(
          "axis-discovery",
          "E-EXTRACT",
          "axis-discovery sets do not reconcile to the active design-occurrence census",
          artifact,
          {
            declaredAxes: [...discovered].sort(),
            actualAxes: [...actualAxes].sort(),
            declaredKinds: [...discoveredKinds].sort(),
            actualKinds: [...actualKinds].sort(),
          }
        )
      );
    }
    for (const [axis, count] of actualAxisCounts) {
      if (artifact.occurrenceCounts.byAxis[axis] !== count) {
        violations.push(
          violation(
            "axis-discovery",
            "E-EXTRACT",
            `Axis count mismatch for ${axis}`,
            artifact,
            {
              declared: artifact.occurrenceCounts.byAxis[axis],
              actual: count,
            }
          )
        );
      }
    }
    for (const [kind, count] of actualKindCounts) {
      if (artifact.occurrenceCounts.byOccurrenceKind[kind] !== count) {
        violations.push(
          violation(
            "axis-discovery",
            "E-EXTRACT",
            `Occurrence-kind count mismatch for ${kind}`,
            artifact,
            {
              declared: artifact.occurrenceCounts.byOccurrenceKind[kind],
              actual: count,
            }
          )
        );
      }
    }
    if (
      targetPhase === "COMPLETE" &&
      (uncovered.size > 0 ||
        uncoveredKinds.size > 0 ||
        artifact.exhaustive !== true)
    ) {
      violations.push(
        violation(
          "axis-discovery",
          "E-EXTRACT",
          "DONE requires exhaustive discovery with zero uncovered axes and occurrence kinds",
          artifact
        )
      );
    }
  }
}

function checkAbsoluteCompletionRegistry(
  index,
  runConfig,
  targetPhase,
  activeSourceFingerprint,
  violations
) {
  const canonicalPredicateIds = new Set(ABSOLUTE_COMPLETION_PREDICATE_IDS);
  for (const axisContract of runConfig.axisRegistry) {
    const invalidPredicateIds = axisContract.completionPredicateIds.filter(
      (predicateId) => !canonicalPredicateIds.has(predicateId)
    );
    if (invalidPredicateIds.length > 0) {
      violations.push(
        violation(
          "absolute-completion-registry",
          "E-EXTRACT",
          `axisRegistry.${axisContract.axis}.completionPredicateIds contains non-canonical IDs`,
          runConfig,
          { invalidPredicateIds }
        )
      );
    }
  }

  const absoluteReportIds = (index.get("inventory-report") ?? [])
    .map((record) => record.artifact)
    .filter(
      (artifact) =>
        artifact.sourceFingerprint === activeSourceFingerprint &&
        artifact.reportId.startsWith(ABSOLUTE_REPORT_PREFIX)
    )
    .map((artifact) => artifact.reportId);
  const canonicalReportIds = new Set(ABSOLUTE_REPORT_IDS);
  const invalidReportIds = absoluteReportIds.filter(
    (reportId) => !canonicalReportIds.has(reportId)
  );
  if (invalidReportIds.length > 0) {
    violations.push(
      violation(
        "absolute-completion-registry",
        "E-EXTRACT",
        "absolute/* inventory-report IDs contain non-canonical report-backed predicates",
        runConfig,
        { invalidReportIds: [...new Set(invalidReportIds)] }
      )
    );
  }
  if (
    targetPhase === "COMPLETE" &&
    (absoluteReportIds.length !== ABSOLUTE_REPORT_IDS.length ||
      duplicateValues(absoluteReportIds).length > 0 ||
      !sameSet(new Set(absoluteReportIds), canonicalReportIds))
  ) {
    violations.push(
      violation(
        "absolute-completion-registry",
        "E-EXTRACT",
        `COMPLETE requires exactly the ${ABSOLUTE_REPORT_IDS.length} canonical absolute/* inventory-report IDs with no missing, duplicate, or extra IDs`,
        runConfig,
        {
          expectedReportIds: ABSOLUTE_REPORT_IDS,
          actualReportIds: absoluteReportIds.sort(),
        }
      )
    );
  }
}

function checkBatchScope(index, violations) {
  for (const { artifact: mutation } of index.get("mutation-manifest") ?? []) {
    const contract = getSingleByBatch(
      index,
      "batch-contract",
      mutation.batchId,
      violations,
      "E-IMPACT"
    );
    const impact = getSingleByBatch(
      index,
      "impacted-context",
      mutation.batchId,
      violations,
      "E-IMPACT"
    );
    if (!contract || !impact) {
      violations.push(
        violation(
          "batch-scope",
          "E-IMPACT",
          `${mutation.batchId} mutation requires one batch contract and one impacted context`,
          mutation
        )
      );
      continue;
    }
    const planned = new Set(contract.plannedFiles);
    const consumers = new Set(impact.consumerFiles);
    const outsidePlanned = mutation.actualMutationFiles.filter(
      (file) => !planned.has(file)
    );
    const outsideConsumers = mutation.actualMutationFiles.filter(
      (file) => !consumers.has(file)
    );
    if (outsidePlanned.length > 0 || outsideConsumers.length > 0) {
      violations.push(
        violation(
          "batch-scope",
          "E-IMPACT",
          `${mutation.batchId} mutated files outside baseline-covered scope`,
          mutation,
          { outsidePlanned, outsideConsumers }
        )
      );
    }
  }
}

function captureMap(manifest) {
  return new Map(
    manifest.captures.map((capture) => [capture.scenarioId, capture])
  );
}

function checkScenarioCoverage(index, violations) {
  const scenarios = (index.get("scenario") ?? []).map(
    ({ artifact }) => artifact
  );
  const scenarioIdsBySource = new Map();
  for (const scenario of scenarios) {
    const ids = scenarioIdsBySource.get(scenario.sourceFingerprint) ?? [];
    ids.push(scenario.scenarioId);
    scenarioIdsBySource.set(scenario.sourceFingerprint, ids);
  }
  for (const [sourceFingerprint, scenarioIds] of scenarioIdsBySource) {
    for (const duplicate of duplicateValues(scenarioIds)) {
      violations.push(
        violation(
          "scenario-coverage",
          "E-FIXTURE",
          `Scenario ID is not unique for source ${sourceFingerprint}: ${duplicate}`
        )
      );
    }
  }
  for (const { artifact } of index.get("evidence-manifest") ?? []) {
    const knownScenarios = new Set(
      scenarios
        .filter(
          (scenario) =>
            scenario.sourceFingerprint === artifact.sourceFingerprint
        )
        .map((scenario) => scenario.scenarioId)
    );
    const requested = new Set(artifact.requestedScenarioIds);
    const produced = new Set(artifact.producedScenarioIds);
    const captureIds = artifact.captures.map((capture) => capture.scenarioId);
    const captures = new Set(captureIds);
    const exact =
      requested.size > 0 &&
      sameSet(requested, produced) &&
      sameSet(requested, captures) &&
      captureIds.length === captures.size &&
      captureIds.length === requested.size &&
      artifact.exactCoverage === true;
    if (!exact) {
      violations.push(
        violation(
          "scenario-coverage",
          "E-COMPARE",
          `${artifact.phase} evidence does not have exact, non-vacuous scenario coverage`,
          artifact,
          {
            requested: [...requested].sort(),
            produced: [...produced].sort(),
            captures: captureIds,
            exactCoverage: artifact.exactCoverage,
          }
        )
      );
    }
    const unknown = [...requested].filter((id) => !knownScenarios.has(id));
    if (knownScenarios.size > 0 && unknown.length > 0) {
      violations.push(
        violation(
          "scenario-coverage",
          "E-FIXTURE",
          `${artifact.phase} evidence requests unknown scenarios`,
          artifact,
          { unknown }
        )
      );
    }
  }
}

function checkPairingAndEffect(index, records, violations) {
  const batchIds = new Set(
    (index.get("comparison") ?? []).map(({ artifact }) => artifact.batchId)
  );
  for (const batchId of batchIds) {
    const contract = getSingleByBatch(
      index,
      "batch-contract",
      batchId,
      violations,
      "E-DECISION"
    );
    const comparison = getSingleByBatch(
      index,
      "comparison",
      batchId,
      violations,
      "E-COMPARE"
    );
    const manifests = (index.get("evidence-manifest") ?? [])
      .map((record) => record.artifact)
      .filter((artifact) => artifact.batchId === batchId);
    const before = manifests.filter((artifact) => artifact.phase === "before");
    const after = manifests.filter((artifact) => artifact.phase === "after");
    if (!contract || !comparison || before.length !== 1 || after.length !== 1) {
      violations.push(
        violation(
          "pairing",
          "E-COMPARE",
          `${batchId} requires exactly one before manifest, one after manifest, one comparison, and one contract`,
          comparison,
          {
            beforeCount: before.length,
            afterCount: after.length,
            contractCount: contract ? 1 : 0,
          }
        )
      );
      continue;
    }
    const beforeManifest = before[0];
    const afterManifest = after[0];
    const requested = new Set(beforeManifest.requestedScenarioIds);
    const afterRequested = new Set(afterManifest.requestedScenarioIds);
    const pairIds = comparison.pairs.map((pair) => pair.scenarioId);
    const pairSet = new Set(pairIds);
    if (
      requested.size === 0 ||
      !sameSet(requested, afterRequested) ||
      !sameSet(requested, pairSet) ||
      pairIds.length !== pairSet.size ||
      pairIds.length !== requested.size
    ) {
      violations.push(
        violation(
          "pairing",
          "E-COMPARE",
          `${batchId} before, after, and comparison scenario sets differ`,
          comparison
        )
      );
    }
    if (
      beforeManifest.routeRegistryFingerprint !==
        afterManifest.routeRegistryFingerprint ||
      beforeManifest.fixtureRegistryFingerprint !==
        afterManifest.fixtureRegistryFingerprint ||
      beforeManifest.toolchainFingerprint !== afterManifest.toolchainFingerprint
    ) {
      violations.push(
        violation(
          "pairing",
          "E-COMPARE",
          `${batchId} route, fixture, or toolchain dimensions changed between captures`,
          comparison
        )
      );
    }
    const beforeCaptures = captureMap(beforeManifest);
    const afterCaptures = captureMap(afterManifest);
    for (const scenarioId of requested) {
      const beforeCapture = beforeCaptures.get(scenarioId);
      const afterCapture = afterCaptures.get(scenarioId);
      if (
        beforeCapture &&
        afterCapture &&
        (beforeCapture.width !== afterCapture.width ||
          beforeCapture.height !== afterCapture.height)
      ) {
        violations.push(
          violation(
            "pairing",
            "E-COMPARE",
            `${scenarioId} viewport dimensions changed between captures`,
            comparison
          )
        );
      }
    }
    for (const pair of comparison.pairs) {
      const beforeCapture = beforeCaptures.get(pair.scenarioId);
      const afterCapture = afterCaptures.get(pair.scenarioId);
      /*
       * O QUE MUDOU E POR QUÊ (2026-08-01). Este bloco chamava
       * `referencedTargets(records, pair.beforeCapture)` e exigia que o
       * resultado contivesse o manifesto declarado. Duas coisas estavam erradas:
       *
       * 1. `referencedTargets` devolve VAZIO para ref sem `artifactType`, e a
       *    captura aponta para um PNG — que não é nenhum dos tipos fechados.
       *    A invariante reprovava toda comparação, inclusive a correta.
       * 2. Mesmo funcionando, a pergunta era fraca: "esta captura pertence ao
       *    manifesto declarado?" dá a MESMA resposta para todos os pares, já que
       *    o manifesto é declarado uma vez no topo. Não distinguia nada.
       *
       * A pergunta forte é sobre BYTES: o hash que o par diz ter comparado é o
       * hash que o manifesto registrou para AQUELE cenário? Isso pega o caso que
       * importa — o par comparou uma imagem que não é a capturada — e usa dado
       * que já existe nos dois lados. O caminho não serve de comparador: ele é
       * relativo a bases diferentes (o par ao diretório da comparação, a captura
       * ao do manifesto), então bater caminho aqui compararia convenção, não
       * conteúdo.
       */
      const capturaConfere = (ref, capture) =>
        Boolean(capture) && ref?.sha256 === capture.sha256;
      if (
        !capturaConfere(pair.beforeCapture, beforeCapture) ||
        !capturaConfere(pair.afterCapture, afterCapture)
      ) {
        violations.push(
          violation(
            "pairing",
            "E-COMPARE",
            `${pair.scenarioId} capture bytes do not match what the before/after manifests recorded`,
            comparison,
            {
              declaredBefore: pair.beforeCapture?.sha256 ?? null,
              manifestBefore: beforeCapture?.sha256 ?? null,
              declaredAfter: pair.afterCapture?.sha256 ?? null,
              manifestAfter: afterCapture?.sha256 ?? null,
            }
          )
        );
      }
      if (!beforeCapture || !afterCapture) continue;
      const hashesEqual = beforeCapture.sha256 === afterCapture.sha256;
      const statusConsistent =
        (pair.status === "identical" && hashesEqual) ||
        (pair.status === "changed" && !hashesEqual);
      /*
       * NOMES ALINHADOS AO EMISSOR (2026-08-01). Este bloco lia
       * `pair.changedPixels`, `pair.changedPixelRatio` e `pair.errorDelta[key]`
       * — campos que `compareEvidenceManifests` NUNCA emitiu com esses nomes.
       * O emissor produz `exactChangedPixels`, `exactChangedPixelRatio` e um
       * `errorDelta` com as contagens sob `counts`.
       *
       * A consequência não era um erro: era pior. `undefined / pixelCount` dá
       * NaN, toda comparação com NaN é falsa, e a invariante de razão passava a
       * reprovar SEMPRE — o guard virava ruído constante em vez de sinal. E a
       * checagem de errorDelta comparava `undefined === valor` para as cinco
       * chaves, portanto nunca podia concordar.
       *
       * A razão é medida sobre a métrica EXATA (pixel que mudou de valor), não
       * sobre a perceptual: é a exata que tem relação aritmética com a contagem
       * de pixels da imagem. A perceptual responde outra pergunta — o que se VÊ
       * mudar — e não é derivável de `width × height`.
       */
      const pixelCount = beforeCapture.width * beforeCapture.height;
      const expectedRatio = pair.exactChangedPixels / pixelCount;
      const ratioTolerance = 1 / pixelCount;
      const ratioConsistent =
        pair.exactChangedPixels <= pixelCount &&
        Math.abs(pair.exactChangedPixelRatio - expectedRatio) <= ratioTolerance;
      const expectedErrorDelta = {
        console:
          afterCapture.consoleErrors.length -
          beforeCapture.consoleErrors.length,
        page: afterCapture.pageErrors.length - beforeCapture.pageErrors.length,
        network:
          afterCapture.networkFailures.length -
          beforeCapture.networkFailures.length,
        axe:
          afterCapture.axeViolationIds.length -
          beforeCapture.axeViolationIds.length,
        overflow:
          Number(afterCapture.overflow) - Number(beforeCapture.overflow),
      };
      const errorDeltaConsistent = Object.entries(expectedErrorDelta).every(
        ([key, value]) => pair.errorDelta?.counts?.[key] === value
      );
      if (!statusConsistent || !ratioConsistent || !errorDeltaConsistent) {
        violations.push(
          violation(
            "pairing",
            "E-COMPARE",
            `${pair.scenarioId} hashes, pixel metrics, or error deltas are internally inconsistent`,
            comparison,
            {
              hashesEqual,
              expectedRatio,
              actualRatio: pair.exactChangedPixelRatio,
              expectedErrorDelta,
              actualErrorDelta: pair.errorDelta,
            }
          )
        );
      }
    }

    const beforeTargets = referencedTargets(records, comparison.beforeManifest);
    const afterTargets = referencedTargets(records, comparison.afterManifest);
    if (
      !beforeTargets.includes(beforeManifest) ||
      !afterTargets.includes(afterManifest)
    ) {
      violations.push(
        violation(
          "pairing",
          "E-COMPARE",
          `${batchId} comparison refs do not resolve to its before/after manifests`,
          comparison
        )
      );
    }

    const changed = new Set(contract.expectedChangedScenarioIds);
    const unchanged = new Set(contract.expectedUnchangedScenarioIds);
    const overlap = [...changed].filter((id) => unchanged.has(id));
    const declared = new Set([...changed, ...unchanged]);
    let declarationValid =
      overlap.length === 0 &&
      sameSet(declared, requested) &&
      contract.expectedVisualEffect === comparison.expectedVisualEffect;
    if (contract.expectedVisualEffect === "preserve") {
      declarationValid &&= changed.size === 0 && sameSet(unchanged, requested);
    } else if (contract.expectedVisualEffect === "change") {
      declarationValid &&= unchanged.size === 0 && sameSet(changed, requested);
    } else {
      declarationValid &&= changed.size > 0 && unchanged.size > 0;
    }
    if (!declarationValid) {
      violations.push(
        violation(
          "effect-policy",
          "E-DECISION",
          `${batchId} effect declaration does not partition the requested scenarios`,
          contract,
          { overlap }
        )
      );
    }

    const scenarioById = new Map(
      (index.get("scenario") ?? [])
        .map(({ artifact }) => artifact)
        .filter(
          (artifact) =>
            artifact.sourceFingerprint === contract.rollbackSourceFingerprint
        )
        .map((artifact) => [artifact.scenarioId, artifact])
    );
    let effectPass = true;
    for (const pair of comparison.pairs) {
      const expected = changed.has(pair.scenarioId) ? "change" : "preserve";
      const scenario = scenarioById.get(pair.scenarioId);
      if (scenario && scenario.expectedVisualEffect !== expected) {
        effectPass = false;
        violations.push(
          violation(
            "effect-policy",
            "E-DECISION",
            `${pair.scenarioId} scenario effect disagrees with the batch contract`,
            scenario,
            { expected, actual: scenario.expectedVisualEffect }
          )
        );
      }
      // Mesmos nomes do emissor: `deterministicPolicyVerdict` e a métrica
      // EXATA. Antes lia `policyVerdict`/`changedPixels`, que nunca existiram
      // no artefato — `undefined === "pass"` é falso, então `observedPass` era
      // falso para TODO par e esta invariante reprovava até o lote perfeito.
      const observedPass =
        pair.deterministicPolicyVerdict === "pass" &&
        ((expected === "preserve" &&
          pair.status === "identical" &&
          pair.exactChangedPixels === 0 &&
          pair.exactChangedPixelRatio === 0) ||
          (expected === "change" &&
            pair.status === "changed" &&
            pair.exactChangedPixels > 0 &&
            pair.exactChangedPixelRatio > 0));
      if (!observedPass) {
        effectPass = false;
        violations.push(
          violation(
            "effect-policy",
            "E-MIGRATION",
            `${pair.scenarioId} does not satisfy the ${expected} policy`,
            comparison,
            {
              status: pair.status,
              exactChangedPixels: pair.exactChangedPixels,
              exactChangedPixelRatio: pair.exactChangedPixelRatio,
              deterministicPolicyVerdict: pair.deterministicPolicyVerdict,
            }
          )
        );
      }
    }
    if (
      effectPass &&
      (comparison.missingPairCount !== 0 ||
        comparison.exactCoverage !== true ||
        comparison.verdict !== "pass")
    ) {
      violations.push(
        violation(
          "effect-policy",
          "E-COMPARE",
          `${batchId} comparison summary contradicts passing pairs`,
          comparison
        )
      );
    }
  }
}

function checkReviewCompleteness(index, violations) {
  for (const { artifact: review } of index.get("visual-review") ?? []) {
    const comparison = getSingleByBatch(
      index,
      "comparison",
      review.batchId,
      violations,
      "E-COMPARE"
    );
    if (!comparison) {
      violations.push(
        violation(
          "review-completeness",
          "E-DECISION",
          `${review.batchId} visual review has no comparison`,
          review
        )
      );
      continue;
    }
    const required = new Set(review.requiredReviewScenarioIds);
    const pairIds = comparison.pairs.map((pair) => pair.scenarioId);
    const pairs = new Set(pairIds);
    const entryIds = review.entries.map((entry) => entry.scenarioId);
    const entries = new Set(entryIds);
    if (
      required.size === 0 ||
      !sameSet(required, pairs) ||
      !sameSet(required, entries) ||
      entryIds.length !== entries.size ||
      entryIds.length !== required.size ||
      review.complete !== true
    ) {
      violations.push(
        violation(
          "review-completeness",
          "E-DECISION",
          `${review.batchId} does not have one completed image review per comparison pair`,
          review
        )
      );
    }
  }
}

function firstTarget(records, artifactRef) {
  return referencedTargets(records, artifactRef)[0] ?? null;
}

function checkAcceptance(index, records, violations) {
  for (const { artifact: acceptance } of index.get("acceptance") ?? []) {
    const expectedRefs = [
      ["contractRef", "batch-contract", "E-DECISION", "pre"],
      ["mutationRef", "mutation-manifest", "E-MIGRATION", "post"],
      ["afterManifestRef", "evidence-manifest", "E-COMPARE", "post"],
      ["checksRef", "deterministic-checks", "E-MIGRATION", "post"],
      ["comparisonRef", "comparison", "E-COMPARE", "post"],
      ["visualReviewRef", "visual-review", "E-DECISION", "post"],
      ["adversarialReviewRef", "adversarial-review", "E-DECISION", "post"],
    ];
    const targets = {};
    for (const [field, artifactType, code, sourcePhase] of expectedRefs) {
      const artifactRef = acceptance[field];
      const target = firstTarget(records, artifactRef);
      targets[field] = target;
      if (
        artifactRef?.artifactType !== artifactType ||
        !target ||
        target.artifactType !== artifactType
      ) {
        violations.push(
          violation(
            "acceptance",
            code,
            `${acceptance.batchId}.${field} does not resolve to ${artifactType}`,
            acceptance
          )
        );
      }
      if (
        target &&
        target.sourceFingerprint !==
          (sourcePhase === "pre"
            ? acceptance.preSourceFingerprint
            : acceptance.acceptedSourceFingerprint)
      ) {
        violations.push(
          violation(
            "acceptance",
            code,
            `${acceptance.batchId}.${field} is not bound to the ${sourcePhase}-mutation source fingerprint`,
            acceptance,
            {
              expected:
                sourcePhase === "pre"
                  ? acceptance.preSourceFingerprint
                  : acceptance.acceptedSourceFingerprint,
              actual: target.sourceFingerprint,
            }
          )
        );
      }
    }
    if (acceptance.sourceFingerprint !== acceptance.acceptedSourceFingerprint) {
      violations.push(
        violation(
          "acceptance",
          "E-MIGRATION",
          `${acceptance.batchId} acceptance header and accepted source differ`,
          acceptance
        )
      );
    }
    const contract = targets.contractRef;
    const mutation = targets.mutationRef;
    const afterManifest = targets.afterManifestRef;
    const checks = targets.checksRef;
    const comparison = targets.comparisonRef;
    const visual = targets.visualReviewRef;
    const adversarial = targets.adversarialReviewRef;
    for (const target of [
      contract,
      mutation,
      afterManifest,
      checks,
      comparison,
      visual,
      adversarial,
    ]) {
      if (
        target &&
        "batchId" in target &&
        target.batchId !== acceptance.batchId
      ) {
        violations.push(
          violation(
            "acceptance",
            REENTRY_BY_ARTIFACT[target.artifactType],
            `${target.artifactType} belongs to another batch`,
            acceptance
          )
        );
      }
    }
    if (
      acceptance.preSourceFingerprint === acceptance.acceptedSourceFingerprint
    ) {
      violations.push(
        violation(
          "acceptance",
          "E-MIGRATION",
          `${acceptance.batchId} pre- and post-mutation source fingerprints must differ`,
          acceptance
        )
      );
    }
    if (
      !contract ||
      contract.rollbackSourceFingerprint !== acceptance.preSourceFingerprint
    ) {
      violations.push(
        violation(
          "acceptance",
          "E-DECISION",
          `${acceptance.batchId} contract does not preserve the declared pre-mutation source`,
          acceptance
        )
      );
    }
    if (
      !mutation ||
      mutation.beforeSourceFingerprint !== acceptance.preSourceFingerprint ||
      mutation.afterSourceFingerprint !== acceptance.acceptedSourceFingerprint
    ) {
      violations.push(
        violation(
          "acceptance",
          "E-MIGRATION",
          `${acceptance.batchId} mutation does not connect the declared pre- and accepted-source fingerprints`,
          acceptance
        )
      );
    }
    if (!afterManifest || afterManifest.phase !== "after") {
      violations.push(
        violation(
          "acceptance",
          "E-COMPARE",
          `${acceptance.batchId}.afterManifestRef is not a phase=after manifest`,
          acceptance
        )
      );
    }
    if (
      !checks ||
      checks.scope !== "batch" ||
      checks.allPassed !== true ||
      checks.checks.some(
        (check) => check.status !== "pass" || check.exitCode !== 0
      )
    ) {
      violations.push(
        violation(
          "acceptance",
          "E-MIGRATION",
          `${acceptance.batchId} deterministic checks are not passing`,
          acceptance
        )
      );
    }
    if (
      !comparison ||
      comparison.verdict !== "pass" ||
      comparison.exactCoverage !== true ||
      comparison.missingPairCount !== 0 ||
      // `policyVerdict` não existe no artefato: o emissor grava
      // `deterministicPolicyVerdict`. Lendo o nome errado, `undefined !== "pass"`
      // era sempre verdadeiro e a aceitação de QUALQUER lote — inclusive um
      // impecável — era recusada aqui.
      comparison.pairs.some(
        (pair) => pair.deterministicPolicyVerdict !== "pass"
      )
    ) {
      violations.push(
        violation(
          "acceptance",
          "E-COMPARE",
          `${acceptance.batchId} comparison is not passing exactly`,
          acceptance
        )
      );
    }
    if (
      !visual ||
      visual.complete !== true ||
      visual.verdict !== "pass" ||
      visual.entries.some((entry) => entry.verdict !== "expected")
    ) {
      violations.push(
        violation(
          "acceptance",
          "E-DECISION",
          `${acceptance.batchId} visual review is not satisfied`,
          acceptance
        )
      );
    }
    if (
      !adversarial ||
      adversarial.scope !== "batch" ||
      adversarial.verdict !== "satisfied" ||
      adversarial.findings.some((finding) =>
        ["blocker", "high"].includes(finding.severity)
      )
    ) {
      violations.push(
        violation(
          "acceptance",
          "E-DECISION",
          `${acceptance.batchId} adversarial review is not satisfied`,
          acceptance
        )
      );
    }
    if (acceptance.verdict !== "accepted") {
      violations.push(
        violation(
          "acceptance",
          "E-MIGRATION",
          `${acceptance.batchId} acceptance verdict is not accepted`,
          acceptance
        )
      );
    }
    const indexedMutation = getSingleByBatch(
      index,
      "mutation-manifest",
      acceptance.batchId,
      violations,
      "E-MIGRATION"
    );
    if (
      indexedMutation &&
      !sameSet(
        new Set(indexedMutation.actualMutationFiles),
        new Set(acceptance.actualMutationFiles)
      )
    ) {
      violations.push(
        violation(
          "acceptance",
          "E-MIGRATION",
          `${acceptance.batchId} acceptance mutation files differ from the mutation manifest`,
          acceptance
        )
      );
    }
  }
}

function checkFinalProof(index, records, runConfig, targetPhase, violations) {
  for (const { artifact: proof } of index.get("final-proof") ?? []) {
    const predicateIds = proof.predicates.map(
      (predicate) => predicate.predicateId
    );
    const expectedPredicateIds = new Set(
      runConfig.completionPolicy.predicateIds
    );
    if (
      duplicateValues(predicateIds).length > 0 ||
      !sameSet(new Set(predicateIds), expectedPredicateIds)
    ) {
      violations.push(
        violation(
          "final-proof",
          "E-EXTRACT",
          "final-proof predicates do not exactly match run-config completion predicates",
          proof
        )
      );
    }
    const canonicalPredicateIds = new Set(ABSOLUTE_COMPLETION_PREDICATE_IDS);
    if (
      proof.verdict === "done" &&
      (duplicateValues(predicateIds).length > 0 ||
        !sameSet(new Set(predicateIds), canonicalPredicateIds) ||
        !sameSet(expectedPredicateIds, canonicalPredicateIds))
    ) {
      violations.push(
        violation(
          "final-proof",
          "E-EXTRACT",
          `done requires the closed ${ABSOLUTE_COMPLETION_PREDICATE_IDS.length}-predicate Section 14 completion contract`,
          proof
        )
      );
    }
    const matrix = firstTarget(records, proof.finalMatrixRef);
    const checks = firstTarget(records, proof.finalChecksRef);
    const adversarial = firstTarget(records, proof.finalAdversarialReviewRef);
    const typed =
      matrix?.artifactType === "evidence-manifest" &&
      checks?.artifactType === "deterministic-checks" &&
      adversarial?.artifactType === "adversarial-review";
    if (!typed) {
      violations.push(
        violation(
          "final-order",
          "E-COMPARE",
          "final-proof refs must resolve to final evidence, checks, and adversarial artifacts",
          proof
        )
      );
      continue;
    }
    const sameFinalSource = [proof, matrix, checks, adversarial].every(
      (artifact) => artifact.sourceFingerprint === proof.finalSourceFingerprint
    );
    if (
      !sameFinalSource ||
      matrix.phase !== "final" ||
      checks.scope !== "final" ||
      checks.batchId !== null ||
      adversarial.scope !== "final" ||
      adversarial.batchId !== null
    ) {
      violations.push(
        violation(
          "final-order",
          "E-COMPARE",
          "Final matrix, checks, review, and proof do not share the exact final source and final scopes",
          proof
        )
      );
    }
    const matrixAt = Date.parse(matrix.generatedAt);
    const checksAt = Date.parse(checks.generatedAt);
    const reviewAt = Date.parse(adversarial.generatedAt);
    const proofAt = Date.parse(proof.generatedAt);
    if (matrixAt > reviewAt || checksAt > reviewAt || reviewAt > proofAt) {
      violations.push(
        violation(
          "final-order",
          "E-COMPARE",
          "Final matrix and checks must precede final adversarial review, which must precede final proof",
          proof
        )
      );
    }
    const finalMutations = (index.get("mutation-manifest") ?? [])
      .map((record) => record.artifact)
      .filter(
        (artifact) =>
          artifact.afterSourceFingerprint === proof.finalSourceFingerprint
      );
    if (
      finalMutations.some(
        (artifact) =>
          Date.parse(artifact.generatedAt) > matrixAt ||
          Date.parse(artifact.generatedAt) > checksAt
      )
    ) {
      violations.push(
        violation(
          "final-order",
          "E-COMPARE",
          "Final matrix and checks must run after the last mutation that produced the final source",
          proof
        )
      );
    }
    for (const predicate of proof.predicates) {
      if (predicate.status !== "pass" || predicate.evidenceRefs.length === 0) {
        violations.push(
          violation(
            "final-proof",
            "E-EXTRACT",
            `${predicate.predicateId} is not passing with durable evidence`,
            proof
          )
        );
      }
      for (const evidenceRef of predicate.evidenceRefs) {
        const targets = referencedTargets(records, evidenceRef);
        if (
          targets.length === 0 ||
          targets.some(
            (target) =>
              target.sourceFingerprint !== proof.finalSourceFingerprint
          )
        ) {
          violations.push(
            violation(
              "final-proof",
              "E-EXTRACT",
              `${predicate.predicateId} references stale or missing evidence`,
              proof,
              { evidenceRef }
            )
          );
        }
      }
    }
    const nonzeroResiduals = Object.entries(proof.residualCounts).filter(
      ([, value]) => value !== 0
    );
    if (
      proof.verdict === "done" &&
      (nonzeroResiduals.length > 0 ||
        proof.predicates.some((predicate) => predicate.status !== "pass") ||
        matrix.exactCoverage !== true ||
        checks.allPassed !== true ||
        adversarial.verdict !== "satisfied")
    ) {
      const code =
        proof.residualCounts.uncoveredScenarios > 0 ||
        proof.residualCounts.unreviewedPairs > 0
          ? "E-COMPARE"
          : proof.residualCounts.unclassifiedOccurrences > 0 ||
              proof.residualCounts.unreconciledDesignOccurrences > 0 ||
              proof.residualCounts.unapprovedNamingViolations > 0
            ? "E-CLASSIFY"
            : proof.residualCounts.missingOrDeadClasses > 0
              ? "E-MIGRATION"
              : "E-EXTRACT";
      violations.push(
        violation(
          "final-proof",
          code,
          "done is illegal unless every predicate and final artifact passes and every residual is zero",
          proof,
          { nonzeroResiduals }
        )
      );
    }
    if (targetPhase === "COMPLETE" && proof.verdict !== "done") {
      violations.push(
        violation(
          "final-proof",
          "E-EXTRACT",
          "COMPLETE requires final-proof.verdict=done",
          proof
        )
      );
    }
  }
  if (
    targetPhase === "COMPLETE" &&
    (index.get("final-proof") ?? []).length !== 1
  ) {
    violations.push(
      violation(
        "final-proof",
        "E-EXTRACT",
        "COMPLETE requires exactly one final-proof artifact"
      )
    );
  }
}

function artifactRefKey(artifactRef) {
  return `${artifactRef.artifactType}:${artifactRef.path}:${artifactRef.sha256}`;
}

function checkRunState(index, records, violations) {
  for (const { artifact } of index.get("run-state") ?? []) {
    let expectedSequence = 1;
    let previousTo = null;
    for (const entry of artifact.journal) {
      if (entry.sequence !== expectedSequence) {
        violations.push(
          violation(
            "run-state-journal",
            "E-EXTRACT",
            `run-state journal sequence must be contiguous; expected ${expectedSequence}, found ${entry.sequence}`,
            artifact
          )
        );
        expectedSequence = entry.sequence;
      }
      if (
        (entry.sequence === 1 &&
          (entry.from !== "START" || entry.to !== "ANCHORED")) ||
        (entry.sequence > 1 && entry.from !== previousTo)
      ) {
        violations.push(
          violation(
            "run-state-journal",
            "E-EXTRACT",
            `run-state journal transition ${entry.sequence} does not continue from the preceding state`,
            artifact
          )
        );
      }
      previousTo = entry.to;
      expectedSequence += 1;
    }
    const artifactRefKeys = artifact.artifacts.map(artifactRefKey);
    if (duplicateValues(artifactRefKeys).length > 0) {
      violations.push(
        violation(
          "run-state-journal",
          "E-EXTRACT",
          "run-state artifacts contain duplicate refs",
          artifact
        )
      );
    }
    const journalRefKeys = new Set(
      artifact.journal.flatMap((entry) =>
        entry.artifactRefs.map(artifactRefKey)
      )
    );
    if (!sameSet(new Set(artifactRefKeys), journalRefKeys)) {
      violations.push(
        violation(
          "run-state-journal",
          "E-EXTRACT",
          "run-state.artifacts must equal the immutable union of journal artifact refs",
          artifact
        )
      );
    }
    const last = artifact.journal.at(-1);
    if (
      !last ||
      last.to !== artifact.currentPhase ||
      Date.parse(last.at) !== Date.parse(artifact.generatedAt)
    ) {
      violations.push(
        violation(
          "run-state-journal",
          "E-EXTRACT",
          "run-state snapshot phase/time does not match its last transition",
          artifact
        )
      );
    }
    if (last && !last.reentryCode) {
      for (const artifactRef of last.artifactRefs) {
        for (const target of referencedTargets(records, artifactRef)) {
          if (target.sourceFingerprint !== artifact.sourceFingerprint) {
            violations.push(
              violation(
                "source-freshness",
                reentryCodeForArtifact(target.artifactType),
                `Latest ${target.artifactType} transition output is stale for run-state`,
                artifact,
                {
                  expected: artifact.sourceFingerprint,
                  actual: target.sourceFingerprint,
                }
              )
            );
          }
        }
      }
    }
  }
}

export function validateTransitionEvidence({ targetPhase, transitionRecords }) {
  const violations = [];
  const required = REQUIRED_TRANSITION_ARTIFACTS[targetPhase] ?? [];
  const types = new Set(
    transitionRecords.map((record) => toRecord(record).artifact?.artifactType)
  );
  for (const artifactType of required) {
    if (!types.has(artifactType)) {
      violations.push(
        violation(
          "transition-evidence",
          REENTRY_BY_ARTIFACT[artifactType],
          `${targetPhase} requires a fresh ${artifactType} artifact in this transition`
        )
      );
    }
  }

  const artifacts = transitionRecords.map(
    (record) => toRecord(record).artifact
  );
  if (targetPhase === "BEFORE_CAPTURED") {
    const manifests = artifacts.filter(
      (artifact) => artifact.artifactType === "evidence-manifest"
    );
    if (!manifests.some((artifact) => artifact.phase === "before")) {
      violations.push(
        violation(
          "transition-evidence",
          "E-COMPARE",
          "BEFORE_CAPTURED requires a phase=before evidence manifest"
        )
      );
    }
  }
  if (targetPhase === "AFTER_CAPTURED") {
    const manifests = artifacts.filter(
      (artifact) => artifact.artifactType === "evidence-manifest"
    );
    if (!manifests.some((artifact) => artifact.phase === "after")) {
      violations.push(
        violation(
          "transition-evidence",
          "E-COMPARE",
          "AFTER_CAPTURED requires a phase=after evidence manifest"
        )
      );
    }
  }
  if (targetPhase === "BUILT") {
    const checks = artifacts.filter(
      (artifact) =>
        artifact.artifactType === "deterministic-checks" &&
        artifact.scope === "batch"
    );
    if (
      checks.length !== 1 ||
      checks[0].allPassed !== true ||
      checks[0].checks.some(
        (check) => check.status !== "pass" || check.exitCode !== 0
      )
    ) {
      violations.push(
        violation(
          "transition-evidence",
          "E-MIGRATION",
          "BUILT requires one passing batch deterministic-checks artifact"
        )
      );
    }
  }
  if (targetPhase === "ACCEPTED") {
    const acceptances = artifacts.filter(
      (artifact) => artifact.artifactType === "acceptance"
    );
    if (acceptances.length !== 1 || acceptances[0].verdict !== "accepted") {
      violations.push(
        violation(
          "transition-evidence",
          "E-MIGRATION",
          "ACCEPTED requires one acceptance artifact with verdict=accepted"
        )
      );
    }
  }
  if (targetPhase === "COMPLETE") {
    const manifests = artifacts.filter(
      (artifact) =>
        artifact.artifactType === "evidence-manifest" &&
        artifact.phase === "final"
    );
    const checks = artifacts.filter(
      (artifact) =>
        artifact.artifactType === "deterministic-checks" &&
        artifact.scope === "final"
    );
    const reviews = artifacts.filter(
      (artifact) =>
        artifact.artifactType === "adversarial-review" &&
        artifact.scope === "final" &&
        artifact.verdict === "satisfied"
    );
    const proofs = artifacts.filter(
      (artifact) =>
        artifact.artifactType === "final-proof" && artifact.verdict === "done"
    );
    if (
      manifests.length !== 1 ||
      checks.length !== 1 ||
      reviews.length !== 1 ||
      proofs.length !== 1
    ) {
      violations.push(
        violation(
          "transition-evidence",
          "E-EXTRACT",
          "COMPLETE requires one fresh final matrix, final checks, satisfied final adversarial review, and done proof"
        )
      );
    }
  }
  return violations;
}

export function validateTransition({ from, to, reentryCode = null }) {
  if (!PHASES.includes(from) || !PHASES.includes(to)) {
    return [
      violation(
        "state-transition",
        "E-EXTRACT",
        `Unknown state transition ${from} -> ${to}`
      ),
    ];
  }
  if (to === "PENDING" || to === "BLOCKED") return [];
  if (reentryCode) {
    const expected = REENTRY_PHASE[reentryCode];
    if (expected !== to) {
      return [
        violation(
          "state-transition",
          reentryCode,
          `${reentryCode} must re-enter at ${expected}, not ${to}`
        ),
      ];
    }
    return [];
  }
  if (!(FORWARD_TRANSITIONS[from] ?? []).includes(to)) {
    return [
      violation(
        "state-transition",
        "E-EXTRACT",
        `Illegal forward transition ${from} -> ${to}`
      ),
    ];
  }
  return [];
}

export function validateArtifactSet({
  records: inputRecords,
  runRoot,
  validator,
  targetPhase = null,
  transitionRecords = null,
  resolveReferences = true,
} = {}) {
  if (!validator) {
    throw new Error("validateArtifactSet requires a compiled validator");
  }
  if (!runRoot) {
    throw new Error("validateArtifactSet requires runRoot");
  }
  const violations = [];
  const initialRecords = (inputRecords ?? []).map(toRecord);
  const records = resolveReferences
    ? resolveReferenceClosure(initialRecords, path.resolve(runRoot), violations)
    : initialRecords;

  const schemaValidRecords = [];
  for (const record of records) {
    const { artifact, sourcePath, line } = record;
    const result = validator.validate(artifact);
    if (!result.valid) {
      violations.push(
        violation(
          "schema-instance",
          result.reentryCode,
          `${artifact?.artifactType ?? "unknown"} failed JSON Schema validation`,
          artifact,
          {
            sourcePath,
            line,
            errors: result.errors,
          }
        )
      );
    } else {
      schemaValidRecords.push(record);
    }
  }

  const index = recordsByType(schemaValidRecords);
  const configs = index.get("run-config") ?? [];
  if (configs.length !== 1) {
    violations.push(
      violation(
        "run-identity",
        "E-EXTRACT",
        `Expected exactly one run-config; found ${configs.length}`
      )
    );
    return { valid: false, violations, records: schemaValidRecords };
  }
  const runConfig = configs[0].artifact;
  const states = index.get("run-state") ?? [];
  const activeSourceFingerprint =
    states.length === 1
      ? states[0].artifact.sourceFingerprint
      : targetPhase === "COMPLETE"
        ? ((index.get("final-proof") ?? [])[0]?.artifact
            ?.finalSourceFingerprint ?? runConfig.sourceFingerprint)
        : runConfig.sourceFingerprint;
  checkRunIdentity(schemaValidRecords, runConfig, violations);
  checkSourceKindRegistry(runConfig, violations);
  checkSourceFreshness(index, schemaValidRecords, runConfig, violations);
  /*
   * A PROJECAO ATIVA da historia imutavel de design-occurrence.
   *
   * O extrator emite um registro `raw` por ocorrencia; a classificacao emite no
   * maximo um `classified` com o mesmo ID e um ponteiro criptografico para
   * aquele raw exato. O raw permanece no fechamento de referencia para
   * auditabilidade — por isso `index.get("design-occurrence")` devolve AMBOS, e
   * consumir isso direto conta cada ocorrencia duas vezes.
   *
   * Esta chamada faltava. O refactor que introduziu o parametro
   * `currentDesignRecords` nas tres funcoes abaixo atualizou as ASSINATURAS e
   * nao os CALL SITES: as tres eram invocadas com 4 argumentos para 5
   * parametros, entao `currentDesignRecords` recebia a string `targetPhase` e
   * `"COMPLETE".map` estourava com `TypeError: currentDesignRecords.map is not
   * a function`. O modulo `design-occurrence-lineage.mjs` estava escrito e
   * importado, e `resolveDesignOccurrenceLineage` nunca era chamada.
   *
   * As violacoes da linhagem entram no mesmo balde: raw duplicado, `supersedes`
   * nao-nulo num raw e mais de um `classified` por identidade sao defeitos de
   * contrato, nao ruido de resolucao.
   */
  const designLineage = resolveDesignOccurrenceLineage({
    records: index.get("design-occurrence") ?? [],
    runRoot,
    runId: runConfig.runId,
    sourceFingerprint: activeSourceFingerprint,
  });
  violations.push(...designLineage.violations);
  const currentDesignRecords = designLineage.currentRecords;

  checkDesignReconciliation(
    index,
    currentDesignRecords,
    targetPhase,
    activeSourceFingerprint,
    violations
  );
  checkClassProjection(
    index,
    currentDesignRecords,
    targetPhase,
    activeSourceFingerprint,
    violations
  );
  checkClusterReferentialIntegrity(index, violations);
  checkAxisDiscovery(
    index,
    currentDesignRecords,
    runConfig,
    targetPhase,
    activeSourceFingerprint,
    violations
  );
  checkAbsoluteCompletionRegistry(
    index,
    runConfig,
    targetPhase,
    activeSourceFingerprint,
    violations
  );
  checkBatchScope(index, violations);
  checkScenarioCoverage(index, violations);
  checkPairingAndEffect(index, schemaValidRecords, violations);
  checkReviewCompleteness(index, violations);
  checkAcceptance(index, schemaValidRecords, violations);
  checkFinalProof(
    index,
    schemaValidRecords,
    runConfig,
    targetPhase,
    violations
  );
  checkRunState(index, schemaValidRecords, violations);
  if (transitionRecords) {
    violations.push(
      ...validateTransitionEvidence({ targetPhase, transitionRecords })
    );
  }

  return {
    valid: violations.length === 0,
    violations,
    records: schemaValidRecords,
    runConfig,
  };
}

export function assertArtifactSet(options) {
  const result = validateArtifactSet(options);
  if (!result.valid) {
    throw new ArtifactContractError(result.violations);
  }
  return result;
}

export function discoverArtifactFiles(runRoot) {
  const absoluteRoot = path.resolve(runRoot);
  const output = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".json") || entry.name.endsWith(".ndjson")) &&
        entry.name !== "journal.ndjson"
      ) {
        output.push(absolute);
      }
    }
  }
  if (existsSync(absoluteRoot)) walk(absoluteRoot);
  return output.sort();
}

export function inferArtifactType(records) {
  const types = new Set(
    records.map((record) => toRecord(record).artifact?.artifactType)
  );
  if (types.size !== 1 || types.has(undefined)) {
    throw new ArtifactContractError([
      violation(
        "schema-instance",
        "E-EXTRACT",
        `An artifact file must contain exactly one root artifact type; found ${[
          ...types,
        ].join(", ")}`
      ),
    ]);
  }
  return [...types][0];
}

export function nextForwardPhases(phase) {
  return [...(FORWARD_TRANSITIONS[phase] ?? [])];
}
