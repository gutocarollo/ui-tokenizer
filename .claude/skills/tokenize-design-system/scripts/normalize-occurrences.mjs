#!/usr/bin/env node
/**
 * Create the class-only normalized-occurrence projection without mutating
 * source. Raw order and source IDs remain available alongside canonical
 * multiset/set and target-compiler fingerprints.
 *
 * Usage:
 *   node normalize-occurrences.mjs --root <app>
 *     --input <design-occurrences.ndjson> --out <directory>
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  createTargetNormalizer,
  fingerprintsForCandidates,
  schemaCandidate,
  splitClassCandidates,
} from "./lib/tailwind-normalizer.mjs";

const HELP = `normalize-occurrences.mjs

Usage:
  node normalize-occurrences.mjs --root <app> --input <ndjson> --out <directory>

Options:
  --entry-css <file>       Override discovered Tailwind entry CSS
  --tailwind-config <file> Override tokenization.config.json Tailwind config
  --token-source <file>    Override discovered *.tokens.json inputs
  --generated-at <ISO>     Reproducible artifact timestamp
  --help                   Show this text

Outputs:
  normalized-occurrences.ndjson
  normalization-summary.json
`;

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(HELP);
  process.exit(0);
}

const root = path.resolve(argValue("--root") ?? process.cwd());
const input = path.resolve(
  argValue("--input") ??
    path.join(root, ".tokenize-design-system", "extract", "design-occurrences.ndjson"),
);
const outDirectory = path.resolve(
  argValue("--out") ?? path.join(root, ".tokenize-design-system", "normalize"),
);
const generatedAtOverride = argValue("--generated-at");
if (!existsSync(input)) throw new Error(`Input does not exist: ${input}`);

const occurrences = readFileSync(input, "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(
        `Invalid NDJSON at ${input}:${index + 1}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  });
if (occurrences.length === 0) {
  throw new Error("Refusing vacuous normalization: no design occurrences");
}

const classOccurrences = occurrences.filter((occurrence) =>
  new Set(["utility-class", "generated-class"]).has(
    occurrence.occurrenceKind,
  ),
);
if (classOccurrences.length === 0) {
  throw new Error(
    "Refusing vacuous normalization: no utility-class/generated-class occurrences",
  );
}
const invalidIdentity = occurrences.find(
  (occurrence) =>
    !/^tokenize-[a-zA-Z0-9._-]+$/.test(occurrence.runId ?? "") ||
    !/^[a-f0-9]{64}$/.test(occurrence.sourceFingerprint ?? "") ||
    !/^[a-f0-9]{64}$/.test(occurrence.toolchainFingerprint ?? ""),
);
if (invalidIdentity) {
  throw new Error(
    `Occurrence ${invalidIdentity.occurrenceId ?? "<unknown>"} has an invalid run/source/toolchain identity`,
  );
}
const runIds = new Set(occurrences.map((occurrence) => occurrence.runId));
const sourceFingerprints = new Set(
  occurrences.map((occurrence) => occurrence.sourceFingerprint),
);
const toolchainFingerprints = new Set(
  occurrences.map((occurrence) => occurrence.toolchainFingerprint),
);
if (
  runIds.size !== 1 ||
  sourceFingerprints.size !== 1 ||
    toolchainFingerprints.size !== 1
) {
  throw new Error(
    "All input occurrences must share run/source/toolchain identity",
  );
}

const normalizer = await createTargetNormalizer({
  root,
  entryCss: argValue("--entry-css"),
  tailwindConfig: argValue("--tailwind-config"),
  tokenSource: argValue("--token-source"),
});
const generatedAt = generatedAtOverride ?? new Date().toISOString();
const evidenceCache = new Map();
function evidenceFor(rawCandidate) {
  if (!evidenceCache.has(rawCandidate)) {
    evidenceCache.set(
      rawCandidate,
      normalizer.compilerEvidence(rawCandidate),
    );
  }
  return evidenceCache.get(rawCandidate);
}

const normalized = [];
const queue = {
  plainCss: [],
  opaque: [],
  unresolved: [],
  invalid: [],
  truncated: [],
};
const evidenceStatusCounts = {};

for (const occurrence of classOccurrences) {
  const source = occurrence.sourcePayload?.classExpression;
  if (!source) {
    throw new Error(
      `Class occurrence ${occurrence.occurrenceId} has no classExpression`,
    );
  }
  const rawClassName = source.rawClassName ?? occurrence.rawValue ?? "";
  const split = splitClassCandidates(rawClassName);
  const rawTokens = split.tokens;
  const evidence = rawTokens.map(evidenceFor);
  for (const item of evidence) {
    evidenceStatusCounts[item.evidenceStatus] =
      (evidenceStatusCounts[item.evidenceStatus] ?? 0) + 1;
  }

  const hasUnresolvedFragments =
    (source.unresolvedDynamicFragments ?? []).length > 0 ||
    evidence.some((item) => item.evidenceStatus === "unresolved-dynamic");
  const hasInvalid =
    Boolean(split.invalidReason) ||
    evidence.some((item) => item.evidenceStatus === "invalid-syntax") ||
    (rawTokens.length === 0 && !hasUnresolvedFragments);
  const hasOpaque = evidence.some((item) =>
    new Set([
      "compiler-unavailable",
      "plain-css",
      "unresolved",
      "unresolved-dynamic",
    ]).has(item.evidenceStatus),
  );
  const reconciliationStatus = source.branchExpansionTruncated
    ? "truncated"
    : hasInvalid
      ? "invalid"
      : hasUnresolvedFragments || hasOpaque
        ? "opaque"
        : "valid";

  const runtimeMergedClassName = normalizer.runtimeMerge(
    rawClassName,
    source.resolverKind,
  );
  const fingerprints = fingerprintsForCandidates({
    rawClassName,
    rawTokens,
    evidence,
    context: occurrence.context,
    runtimeMergedClassName,
    compiledRecipeProjection: normalizer.compilerProjection(evidence),
    provenance: normalizer.provenance,
  });
  const normalizedOccurrence = {
    schemaVersion: "1.0.0",
    artifactType: "normalized-occurrence",
    runId: occurrence.runId,
    sourceFingerprint: occurrence.sourceFingerprint,
    toolchainFingerprint: occurrence.toolchainFingerprint,
    generatedAt,
    occurrenceId: `normalized:${occurrence.occurrenceId}`,
    designOccurrenceId: occurrence.occurrenceId,
    location: occurrence.location,
    context: occurrence.context,
    source: {
      expressionKind: source.expressionKind,
      resolverKind: source.resolverKind,
      branchId: source.branchId,
      conditionExpression: source.conditionExpression,
      unresolvedDynamicFragments: source.unresolvedDynamicFragments,
      branchExpansionTruncated: source.branchExpansionTruncated,
    },
    rawClassName,
    rawTokens,
    candidates: evidence.map(({ candidate }) => schemaCandidate(candidate)),
    fingerprints,
    normalizerProvenance: normalizer.provenance,
    reconciliationStatus,
  };
  normalized.push(normalizedOccurrence);

  const detail = {
    designOccurrenceId: occurrence.occurrenceId,
    file: occurrence.location.file,
    line: occurrence.location.line,
    candidates: evidence
      .filter((item) => item.evidenceStatus !== "tailwind-compiled")
      .map((item) => ({
        raw: item.candidate.raw,
        evidenceStatus: item.evidenceStatus,
        reason: item.reason,
      })),
  };
  if (source.branchExpansionTruncated) queue.truncated.push(detail);
  if (hasInvalid) queue.invalid.push(detail);
  if (
    evidence.some((item) => item.evidenceStatus === "plain-css")
  ) {
    queue.plainCss.push(detail);
  }
  if (
    hasUnresolvedFragments ||
    evidence.some((item) => item.evidenceStatus === "unresolved")
  ) {
    queue.unresolved.push(detail);
  }
  if (reconciliationStatus === "opaque") queue.opaque.push(detail);
}

normalized.sort(
  (a, b) =>
    a.location.file.localeCompare(b.location.file) ||
    a.location.line - b.location.line ||
    a.location.column - b.location.column ||
    a.designOccurrenceId.localeCompare(b.designOccurrenceId),
);
const normalizedIds = new Set(
  normalized.map((occurrence) => occurrence.designOccurrenceId),
);
if (
  normalized.length !== classOccurrences.length ||
  normalizedIds.size !== classOccurrences.length
) {
  throw new Error(
    `Class projection parity failed: class=${classOccurrences.length}, ` +
      `normalized=${normalized.length}, unique=${normalizedIds.size}`,
  );
}

const statusCounts = Object.fromEntries(
  ["valid", "opaque", "invalid", "truncated"].map((status) => [
    status,
    normalized.filter(
      (occurrence) => occurrence.reconciliationStatus === status,
    ).length,
  ]),
);
const summary = {
  schemaVersion: "normalization-summary.v1",
  runId: [...runIds][0],
  sourceFingerprint: [...sourceFingerprints][0],
  toolchainFingerprint: [...toolchainFingerprints][0],
  generatedAt,
  input,
  compiler: {
    available: normalizer.available,
    unavailableReason: normalizer.unavailableReason,
    entryCssPath: normalizer.entryCssPath,
    tailwindConfigPath: normalizer.tailwindConfigPath,
    tokenSourcePaths: normalizer.tokenSourcePaths,
    provenance: normalizer.provenance,
  },
  counts: {
    designOccurrences: occurrences.length,
    classOccurrences: classOccurrences.length,
    normalizedOccurrences: normalized.length,
    uniqueCandidates: evidenceCache.size,
    byReconciliationStatus: statusCounts,
    byCompilerEvidenceStatus: evidenceStatusCounts,
  },
  classProjectionParity:
    normalized.length === classOccurrences.length &&
    normalizedIds.size === classOccurrences.length,
  queues: queue,
  exhaustive:
    statusCounts.opaque === 0 &&
    statusCounts.invalid === 0 &&
    statusCounts.truncated === 0,
};

mkdirSync(outDirectory, { recursive: true });
writeFileSync(
  path.join(outDirectory, "normalized-occurrences.ndjson"),
  `${normalized.map((occurrence) => JSON.stringify(occurrence)).join("\n")}\n`,
);
writeFileSync(
  path.join(outDirectory, "normalization-summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
);
console.log(
  `Normalized ${normalized.length}/${classOccurrences.length} class occurrences; ` +
    `valid=${statusCounts.valid}, opaque=${statusCounts.opaque}, ` +
    `invalid=${statusCounts.invalid}, truncated=${statusCounts.truncated}; ` +
    `compiler=${normalizer.available ? "target" : "unavailable"}`,
);
if (!summary.exhaustive) process.exitCode = 2;
