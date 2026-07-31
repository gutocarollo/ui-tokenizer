import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import path from "node:path";
import {
  createArtifactValidator,
  makeArtifactRef,
  readArtifactRecords,
  sha256CanonicalJson,
  sha256File,
  validateArtifactSet,
} from "./artifact-contract.mjs";
import {
  ABSOLUTE_COMPLETION_PREDICATES,
  ABSOLUTE_COMPLETION_PREDICATE_IDS,
  ABSOLUTE_REPORT_IDS,
  ABSOLUTE_REPORT_PREFIX,
  ABSOLUTE_REPORT_PREDICATES,
  absoluteReportId,
} from "./absolute-completion-contract.mjs";

const TERMINAL_RECONCILIATIONS = new Set([
  "approved-token",
  "approved-contract",
  "approved-exception",
  "approved-out-of-scope",
  "invalid-source",
]);
const CLASS_OCCURRENCE_KINDS = new Set(["utility-class", "generated-class"]);
const SHA256 = /^[a-f0-9]{64}$/u;
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function unique(values) {
  return [...new Set(values)];
}

function sameSet(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function isWithin(parentPath, candidatePath) {
  const relative = path.relative(parentPath, candidatePath);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function normalizedRelative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function collectSourceFiles(applicationRoot, sourceRoot, problems) {
  if (path.isAbsolute(sourceRoot)) {
    problems.push(`Source root must be application-relative: ${sourceRoot}`);
    return [];
  }
  const absolute = path.resolve(applicationRoot, sourceRoot);
  if (!isWithin(applicationRoot, absolute)) {
    problems.push(`Source root escapes the application root: ${sourceRoot}`);
    return [];
  }
  if (!existsSync(absolute)) {
    problems.push(`Source root does not exist: ${sourceRoot}`);
    return [];
  }

  const files = [];
  function walk(candidate) {
    const entry = lstatSync(candidate);
    if (entry.isSymbolicLink()) {
      problems.push(
        `Source fingerprint refuses symbolic links: ${normalizedRelative(
          applicationRoot,
          candidate
        )}`
      );
      return;
    }
    if (entry.isDirectory()) {
      for (const child of readdirSync(candidate).sort()) {
        walk(path.join(candidate, child));
      }
      return;
    }
    if (entry.isFile()) files.push(candidate);
  }
  walk(absolute);
  if (files.length === 0) {
    problems.push(`Source root is vacuous: ${sourceRoot}`);
  }
  return files;
}

export function fingerprintSourceRoots({ applicationRoot, sourceRoots }) {
  const root = path.resolve(applicationRoot);
  const problems = [];
  const roots = unique(sourceRoots ?? []);
  if (roots.length === 0) {
    return {
      fingerprint: null,
      files: [],
      problems: ["No source roots are configured"],
    };
  }
  const files = unique(
    roots.flatMap((sourceRoot) =>
      collectSourceFiles(root, sourceRoot, problems)
    )
  ).sort((left, right) =>
    normalizedRelative(root, left).localeCompare(
      normalizedRelative(root, right)
    )
  );
  if (files.length === 0) {
    problems.push("The complete source file set is empty");
    return { fingerprint: null, files, problems: unique(problems) };
  }
  const hash = createHash("sha256");
  for (const filePath of files) {
    hash.update(normalizedRelative(root, filePath));
    hash.update("\0");
    hash.update(readFileSync(filePath));
    hash.update("\0");
  }
  return {
    fingerprint: hash.digest("hex"),
    files: files.map((filePath) => normalizedRelative(root, filePath)),
    problems: unique(problems),
  };
}

function evaluateLiveToolchain(applicationRoot, config) {
  const problems = [];
  const observed = {};
  const configured =
    config?.toolchain?.configurationFingerprints &&
    Object.entries(config.toolchain.configurationFingerprints);
  if (!configured || configured.length === 0) {
    problems.push("No toolchain configuration fingerprints are configured");
  } else {
    for (const [key, expected] of configured) {
      if (!key.startsWith("file:")) {
        problems.push(
          `Toolchain fingerprint key is not live-verifiable; use file:<application-relative-path>: ${key}`
        );
        continue;
      }
      const relative = key.slice("file:".length);
      if (!relative || path.isAbsolute(relative)) {
        problems.push(`Invalid toolchain file key: ${key}`);
        continue;
      }
      const absolute = path.resolve(applicationRoot, relative);
      if (!isWithin(applicationRoot, absolute)) {
        problems.push(
          `Toolchain file escapes the application root: ${relative}`
        );
        continue;
      }
      if (!existsSync(absolute) || !statSync(absolute).isFile()) {
        problems.push(`Toolchain file is missing: ${relative}`);
        continue;
      }
      const actual = sha256File(absolute);
      observed[key] = actual;
      if (actual !== expected) {
        problems.push(
          `Toolchain file fingerprint is stale for ${relative}: expected ${expected}, observed ${actual}`
        );
      }
    }
  }

  const expectedNode = config?.toolchain?.versions?.node;
  if (!expectedNode) {
    problems.push("toolchain.versions.node is required for a live final proof");
  } else if (expectedNode.replace(/^v/u, "") !== process.versions.node) {
    problems.push(
      `Node version is stale: expected ${expectedNode}, observed ${process.versions.node}`
    );
  }
  const canonical = sha256CanonicalJson(config?.toolchain ?? {});
  if (config?.toolchainFingerprint !== canonical) {
    problems.push(
      `Run toolchain fingerprint is not canonical: expected ${canonical}, observed ${config?.toolchainFingerprint ?? "missing"}`
    );
  }
  return { problems, observed, canonical };
}

function safeReadArtifactRecords(filePath, problems, label) {
  const absolute = path.resolve(filePath);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) {
    problems.push(`${label} artifact is missing: ${absolute}`);
    return [];
  }
  try {
    return readArtifactRecords(absolute);
  } catch (error) {
    problems.push(`${label} artifact cannot be read: ${error.message}`);
    return [];
  }
}

function recordsOfType(records, artifactType, sourceFingerprint = null) {
  return records.filter(
    ({ artifact }) =>
      artifact?.artifactType === artifactType &&
      (!sourceFingerprint || artifact.sourceFingerprint === sourceFingerprint)
  );
}

function refsForRecords(records, runRoot, problems) {
  const byFile = new Map();
  for (const record of records) {
    if (!record.sourcePath) {
      problems.push(
        `Durable evidence has no source path: ${record.artifact?.artifactType ?? "unknown"}`
      );
      continue;
    }
    const key = `${record.artifact.artifactType}:${path.resolve(
      record.sourcePath
    )}`;
    if (!byFile.has(key)) {
      try {
        byFile.set(
          key,
          makeArtifactRef(record.sourcePath, {
            runRoot,
            artifactType: record.artifact.artifactType,
          })
        );
      } catch (error) {
        problems.push(error.message);
      }
    }
  }
  return [...byFile.values()].sort((left, right) =>
    `${left.artifactType}:${left.path}`.localeCompare(
      `${right.artifactType}:${right.path}`
    )
  );
}

function refKey(artifactRef) {
  return `${artifactRef.artifactType}:${artifactRef.path}:${artifactRef.sha256}`;
}

function parseTime(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function latestGeneratedAt(records) {
  const values = records
    .map(({ artifact }) => parseTime(artifact.generatedAt))
    .filter(Number.isFinite);
  return values.length > 0 ? Math.max(...values) : Number.NEGATIVE_INFINITY;
}

function verifyCaptureFile(runRoot, capture) {
  const problems = [];
  if (path.isAbsolute(capture.pngPath)) {
    return [`Capture path must be run-relative: ${capture.pngPath}`];
  }
  const absolute = path.resolve(runRoot, capture.pngPath);
  if (!isWithin(runRoot, absolute)) {
    return [`Capture path escapes the run root: ${capture.pngPath}`];
  }
  if (!existsSync(absolute) || !statSync(absolute).isFile()) {
    return [`Capture PNG is missing: ${capture.pngPath}`];
  }
  const bytes = readFileSync(absolute);
  if (bytes.length !== capture.bytes) {
    problems.push(
      `Capture byte count differs for ${capture.scenarioId}: declared ${capture.bytes}, actual ${bytes.length}`
    );
  }
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (actualHash !== capture.sha256) {
    problems.push(
      `Capture SHA-256 differs for ${capture.scenarioId}: declared ${capture.sha256}, actual ${actualHash}`
    );
  }
  const png = bytes.length >= 24 && bytes.subarray(0, 8).equals(PNG_SIGNATURE);
  if (!png) {
    problems.push(`Capture is not a valid PNG header: ${capture.pngPath}`);
  } else {
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    if (width !== capture.width || height !== capture.height) {
      problems.push(
        `Capture dimensions differ for ${capture.scenarioId}: declared ${capture.width}x${capture.height}, actual ${width}x${height}`
      );
    }
  }
  return problems;
}

function result({
  predicateId,
  passed,
  observed,
  target,
  evidenceRefs,
  gaps = [],
  reentryCode,
}) {
  const uniqueEvidence = [
    ...new Map(evidenceRefs.map((item) => [refKey(item), item])).values(),
  ];
  return {
    predicateId,
    status: passed ? "pass" : "fail",
    observed,
    target,
    evidenceRefs: uniqueEvidence,
    gaps: unique(gaps),
    reentryCode,
  };
}

function reportEvaluation({
  contract,
  reportRecords,
  finalChecks,
  finalChecksRef,
  runRoot,
  currentFingerprint,
}) {
  const expectedReportId = absoluteReportId(contract.predicateId);
  const matches = reportRecords.filter(
    ({ artifact }) =>
      artifact.sourceFingerprint === currentFingerprint &&
      artifact.reportId === expectedReportId
  );
  const gaps = [];
  if (matches.length !== 1) {
    gaps.push(
      `Expected exactly one current absolute report ${expectedReportId}; found ${matches.length}`
    );
  }
  const report = matches[0]?.artifact;
  const reportRefs = refsForRecords(matches, runRoot, gaps);
  if (report && report.inventoryKind !== contract.inventoryKind) {
    gaps.push(
      `${expectedReportId} must use inventoryKind=${contract.inventoryKind}, found ${report.inventoryKind}`
    );
  }
  if (report && report.reconciled !== true) {
    gaps.push(`${expectedReportId} is not reconciled`);
  }
  const population = report?.counts?.population;
  const residual = report?.counts?.unapprovedResidual;
  if (!Number.isInteger(population) || population <= 0) {
    gaps.push(
      `${expectedReportId} must declare a non-vacuous counts.population`
    );
  }
  if (!Number.isInteger(residual) || residual < 0) {
    gaps.push(
      `${expectedReportId} must declare an absolute counts.unapprovedResidual`
    );
  }

  const checks = (finalChecks?.checks ?? []).filter(
    (check) => check.checkId === contract.predicateId
  );
  if (checks.length !== 1) {
    gaps.push(
      `Final deterministic checks must contain ${contract.predicateId} exactly once; found ${checks.length}`
    );
  }
  const check = checks[0];
  if (
    check &&
    (check.status !== "pass" ||
      check.exitCode !== 0 ||
      check.reentryCode !== null)
  ) {
    gaps.push(`${contract.predicateId} deterministic check did not pass`);
  }
  if (
    check &&
    reportRefs.length === 1 &&
    check.outputSha256 !== reportRefs[0].sha256
  ) {
    gaps.push(
      `${contract.predicateId} output hash is not the absolute report bytes`
    );
  }
  if (report && report.inputArtifactRefs.length === 0) {
    gaps.push(`${expectedReportId} has no durable input evidence`);
  }
  return {
    report,
    population,
    residual,
    reportRefs,
    result: result({
      predicateId: contract.predicateId,
      passed: gaps.length === 0 && residual === 0,
      observed: Number.isInteger(residual) ? residual : -1,
      target: 0,
      evidenceRefs: [
        ...reportRefs,
        ...(finalChecksRef ? [finalChecksRef] : []),
      ],
      gaps:
        Number.isInteger(residual) && residual > 0
          ? [...gaps, `${residual} unapproved residual item(s) remain`]
          : gaps,
      reentryCode: contract.reentryCode,
    }),
  };
}

function selectSingle(records, artifactType, predicate, gaps, description) {
  const matches = recordsOfType(records, artifactType).filter(predicate);
  if (matches.length !== 1) {
    gaps.push(`Expected exactly one ${description}; found ${matches.length}`);
  }
  return matches[0] ?? null;
}

function mergeGap(target, predicateId, message) {
  const entry = target.find((item) => item.predicateId === predicateId);
  if (entry) {
    entry.status = "fail";
    entry.gaps = unique([...entry.gaps, message]);
  }
}

export function evaluateAbsoluteCompletion({
  applicationRoot,
  runRoot,
  finalMatrixPath = path.join(runRoot, "final", "evidence-manifest.json"),
  finalChecksPath = path.join(runRoot, "final", "deterministic-checks.json"),
  finalReviewPath = path.join(runRoot, "final", "adversarial-review.json"),
  completionReportPaths = [
    path.join(runRoot, "final", "completion-reports.ndjson"),
  ],
  generatedAt = new Date().toISOString(),
} = {}) {
  const appRoot = path.resolve(applicationRoot);
  const absoluteRunRoot = path.resolve(runRoot);
  const globalGaps = [];
  const configPath = path.join(absoluteRunRoot, "config.json");
  const statePath = path.join(absoluteRunRoot, "state.json");
  const configRecords = safeReadArtifactRecords(
    configPath,
    globalGaps,
    "Run config"
  );
  const stateRecords = safeReadArtifactRecords(
    statePath,
    globalGaps,
    "Run state"
  );
  const finalMatrixRecords = safeReadArtifactRecords(
    finalMatrixPath,
    globalGaps,
    "Final matrix"
  );
  const finalChecksRecords = safeReadArtifactRecords(
    finalChecksPath,
    globalGaps,
    "Final checks"
  );
  const finalReviewRecords = safeReadArtifactRecords(
    finalReviewPath,
    globalGaps,
    "Final adversarial review"
  );
  const reportRecords = completionReportPaths.flatMap((reportPath) =>
    safeReadArtifactRecords(reportPath, globalGaps, "Completion report")
  );

  const config = configRecords.find(
    ({ artifact }) => artifact?.artifactType === "run-config"
  )?.artifact;
  const state = stateRecords.find(
    ({ artifact }) => artifact?.artifactType === "run-state"
  )?.artifact;
  if (!config) globalGaps.push("No schema-valid run-config was loaded");
  if (!state) globalGaps.push("No schema-valid run-state was loaded");
  if (state && state.currentPhase !== "REINVENTORIED") {
    globalGaps.push(
      `Absolute evaluation requires REINVENTORIED; current phase is ${state.currentPhase}`
    );
  }
  const canonicalPredicateIds = new Set(ABSOLUTE_COMPLETION_PREDICATE_IDS);
  for (const axisContract of config?.axisRegistry ?? []) {
    const invalidPredicateIds = axisContract.completionPredicateIds.filter(
      (predicateId) => !canonicalPredicateIds.has(predicateId)
    );
    if (invalidPredicateIds.length > 0) {
      globalGaps.push(
        `run-config axisRegistry.${axisContract.axis}.completionPredicateIds contains non-canonical IDs: ${invalidPredicateIds.join(
          ", "
        )}`
      );
    }
  }

  const sourceEvaluation = config
    ? fingerprintSourceRoots({
        applicationRoot: appRoot,
        sourceRoots: config.sourceRoots,
      })
    : { fingerprint: null, files: [], problems: ["Run config is unavailable"] };
  globalGaps.push(...sourceEvaluation.problems);
  const currentFingerprint = sourceEvaluation.fingerprint;
  const toolchainEvaluation = config
    ? evaluateLiveToolchain(appRoot, config)
    : {
        problems: ["Run config is unavailable"],
        observed: {},
        canonical: null,
      };
  globalGaps.push(...toolchainEvaluation.problems);
  const currentAbsoluteReportIds = reportRecords
    .map(({ artifact }) => artifact)
    .filter(
      (artifact) =>
        artifact?.artifactType === "inventory-report" &&
        artifact.sourceFingerprint === currentFingerprint &&
        typeof artifact.reportId === "string" &&
        artifact.reportId.startsWith(ABSOLUTE_REPORT_PREFIX)
    )
    .map((artifact) => artifact.reportId);
  if (
    currentAbsoluteReportIds.length !== ABSOLUTE_REPORT_IDS.length ||
    new Set(currentAbsoluteReportIds).size !== currentAbsoluteReportIds.length ||
    !sameSet(
      new Set(currentAbsoluteReportIds),
      new Set(ABSOLUTE_REPORT_IDS)
    )
  ) {
    globalGaps.push(
      `Current absolute/* inventory-report IDs must equal exactly the ${ABSOLUTE_REPORT_IDS.length} canonical report-backed predicate IDs with no missing, duplicate, or extra IDs`
    );
  }

  const validator = (() => {
    try {
      return createArtifactValidator({ root: appRoot });
    } catch (error) {
      globalGaps.push(`Artifact validator is unavailable: ${error.message}`);
      return null;
    }
  })();

  let records = [
    ...configRecords,
    ...stateRecords,
    ...finalMatrixRecords,
    ...finalChecksRecords,
    ...finalReviewRecords,
    ...reportRecords,
  ];
  let contractValidation = null;
  if (validator && config) {
    contractValidation = validateArtifactSet({
      records,
      runRoot: absoluteRunRoot,
      validator,
      targetPhase: "REINVENTORIED",
    });
    records = contractValidation.records;
    if (!contractValidation.valid) {
      globalGaps.push(
        ...contractValidation.violations.map(
          (violation) =>
            `${violation.reentryCode} ${violation.invariant}: ${violation.message}`
        )
      );
    }
  }

  const finalMatrixRecord = selectSingle(
    records,
    "evidence-manifest",
    ({ artifact }) =>
      artifact.phase === "final" &&
      artifact.sourceFingerprint === currentFingerprint,
    globalGaps,
    "current phase=final evidence-manifest"
  );
  const finalChecksRecord = selectSingle(
    records,
    "deterministic-checks",
    ({ artifact }) =>
      artifact.scope === "final" &&
      artifact.batchId === null &&
      artifact.sourceFingerprint === currentFingerprint,
    globalGaps,
    "current scope=final deterministic-checks"
  );
  const finalReviewRecord = selectSingle(
    records,
    "adversarial-review",
    ({ artifact }) =>
      artifact.scope === "final" &&
      artifact.batchId === null &&
      artifact.sourceFingerprint === currentFingerprint,
    globalGaps,
    "current scope=final adversarial-review"
  );
  const finalMatrix = finalMatrixRecord?.artifact;
  const finalChecks = finalChecksRecord?.artifact;
  const finalReview = finalReviewRecord?.artifact;
  const finalMatrixRefs = refsForRecords(
    finalMatrixRecord ? [finalMatrixRecord] : [],
    absoluteRunRoot,
    globalGaps
  );
  const finalChecksRefs = refsForRecords(
    finalChecksRecord ? [finalChecksRecord] : [],
    absoluteRunRoot,
    globalGaps
  );
  const finalReviewRefs = refsForRecords(
    finalReviewRecord ? [finalReviewRecord] : [],
    absoluteRunRoot,
    globalGaps
  );
  const finalMatrixRef = finalMatrixRefs[0] ?? null;
  const finalChecksRef = finalChecksRefs[0] ?? null;
  const finalReviewRef = finalReviewRefs[0] ?? null;

  const currentDesignRecords = recordsOfType(
    records,
    "design-occurrence",
    currentFingerprint
  );
  const currentNormalizedRecords = recordsOfType(
    records,
    "normalized-occurrence",
    currentFingerprint
  );
  const currentAxisRecords = recordsOfType(
    records,
    "axis-discovery",
    currentFingerprint
  );
  const currentScenarioRecords = recordsOfType(
    records,
    "scenario",
    currentFingerprint
  );
  const designRefs = refsForRecords(
    currentDesignRecords,
    absoluteRunRoot,
    globalGaps
  );
  const normalizedRefs = refsForRecords(
    currentNormalizedRecords,
    absoluteRunRoot,
    globalGaps
  );
  const axisRefs = refsForRecords(
    currentAxisRecords,
    absoluteRunRoot,
    globalGaps
  );
  const scenarioRefs = refsForRecords(
    currentScenarioRecords,
    absoluteRunRoot,
    globalGaps
  );
  const predicates = [];

  const design = currentDesignRecords.map(({ artifact }) => artifact);
  const normalized = currentNormalizedRecords.map(({ artifact }) => artifact);
  const classDesign = design.filter((artifact) =>
    CLASS_OCCURRENCE_KINDS.has(artifact.occurrenceKind)
  );
  const normalizedCounts = new Map();
  for (const artifact of normalized) {
    normalizedCounts.set(
      artifact.designOccurrenceId,
      (normalizedCounts.get(artifact.designOccurrenceId) ?? 0) + 1
    );
  }
  const projectionResidual =
    classDesign.filter(
      (artifact) => normalizedCounts.get(artifact.occurrenceId) !== 1
    ).length +
    normalized.filter(
      (artifact) =>
        !classDesign.some(
          (source) => source.occurrenceId === artifact.designOccurrenceId
        )
    ).length;
  predicates.push(
    result({
      predicateId: "inventory.class-projection-reconciled",
      passed:
        design.length > 0 &&
        projectionResidual === 0 &&
        normalized.length === classDesign.length,
      observed: `${normalized.length}/${classDesign.length}`,
      target: `${classDesign.length}/${classDesign.length}`,
      evidenceRefs: [...designRefs, ...normalizedRefs, ...axisRefs],
      gaps: [
        ...(design.length === 0 ? ["Design inventory is vacuous"] : []),
        ...(projectionResidual > 0
          ? [`${projectionResidual} class projection mismatch(es) remain`]
          : []),
      ],
      reentryCode: "E-NORMALIZE",
    })
  );

  const normalizedByDesignId = new Map(
    normalized.map((artifact) => [artifact.designOccurrenceId, artifact])
  );
  const dynamicResiduals = classDesign.filter((artifact) => {
    const source = artifact.sourcePayload.classExpression;
    const projection = normalizedByDesignId.get(artifact.occurrenceId)?.source;
    const rawFragments = source?.unresolvedDynamicFragments ?? [];
    const normalizedFragments = projection?.unresolvedDynamicFragments ?? [];
    const exactFragments =
      rawFragments.length === normalizedFragments.length &&
      rawFragments.every(
        (fragment, index) => fragment === normalizedFragments[index]
      );
    const exactTruncation =
      source?.branchExpansionTruncated === projection?.branchExpansionTruncated;
    const hasDynamicDebt =
      rawFragments.length > 0 || source?.branchExpansionTruncated === true;
    return (
      !projection ||
      !exactFragments ||
      !exactTruncation ||
      (hasDynamicDebt &&
        !TERMINAL_RECONCILIATIONS.has(artifact.reconciliation.status))
    );
  });
  predicates.push(
    result({
      predicateId: "inventory.dynamic-fragments-accounted",
      passed: design.length > 0 && dynamicResiduals.length === 0,
      observed: dynamicResiduals.length,
      target: 0,
      evidenceRefs: [...designRefs, ...normalizedRefs],
      gaps:
        dynamicResiduals.length > 0
          ? [
              `${dynamicResiduals.length} dynamic or truncated class expression(s) are not durably accounted`,
            ]
          : [],
      reentryCode: "E-EXTRACT",
    })
  );

  const nonTerminal = design.filter(
    (artifact) => !TERMINAL_RECONCILIATIONS.has(artifact.reconciliation.status)
  );
  predicates.push(
    result({
      predicateId: "inventory.design-occurrences-terminal",
      passed: design.length > 0 && nonTerminal.length === 0,
      observed: nonTerminal.length,
      target: 0,
      evidenceRefs: designRefs,
      gaps: [
        ...(design.length === 0 ? ["Design inventory is vacuous"] : []),
        ...(nonTerminal.length > 0
          ? [
              `${nonTerminal.length} design occurrence(s) remain discovered or opaque`,
            ]
          : []),
      ],
      reentryCode: "E-CLASSIFY",
    })
  );

  const axis = currentAxisRecords[0]?.artifact;
  const configuredKinds = new Set(
    config?.sourceKindRegistry?.map(({ occurrenceKind }) => occurrenceKind) ??
      []
  );
  const registeredKinds = new Set(axis?.registeredOccurrenceKinds ?? []);
  const discoveredKinds = new Set(axis?.discoveredOccurrenceKinds ?? []);
  const coveredKinds = new Set(axis?.coveredOccurrenceKinds ?? []);
  const uncoveredKinds = new Set(axis?.uncoveredOccurrenceKinds ?? []);
  const countedKinds = new Set(
    Object.keys(axis?.occurrenceCounts?.byOccurrenceKind ?? {})
  );
  const occurrenceKindPass =
    currentAxisRecords.length === 1 &&
    configuredKinds.size === 19 &&
    registeredKinds.size === 19 &&
    sameSet(configuredKinds, registeredKinds) &&
    [...discoveredKinds].every((kind) => coveredKinds.has(kind)) &&
    uncoveredKinds.size === 0 &&
    [...configuredKinds].every((kind) => countedKinds.has(kind)) &&
    axis?.exhaustive === true;
  predicates.push(
    result({
      predicateId: "inventory.occurrence-kinds-covered",
      passed: occurrenceKindPass,
      observed: `${coveredKinds.size}/${configuredKinds.size}`,
      target: "19/19",
      evidenceRefs: axisRefs,
      gaps: [
        ...(currentAxisRecords.length !== 1
          ? [
              `Expected one current axis discovery; found ${currentAxisRecords.length}`,
            ]
          : []),
        ...(configuredKinds.size !== 19
          ? [`Configured source-kind count is ${configuredKinds.size}, not 19`]
          : []),
        ...(uncoveredKinds.size > 0
          ? [
              `Uncovered occurrence kinds: ${[...uncoveredKinds]
                .sort()
                .join(", ")}`,
            ]
          : []),
        ...([...configuredKinds].every((kind) => countedKinds.has(kind))
          ? []
          : ["Occurrence counts do not contain all 19 registered kinds"]),
        ...(axis?.exhaustive === true
          ? []
          : ["Axis discovery is not exhaustive"]),
      ],
      reentryCode: "E-EXTRACT",
    })
  );

  const configuredAxes = new Set(
    config?.axisRegistry?.map(({ axis: name }) => name) ?? []
  );
  const discoveredAxes = new Set(axis?.discoveredAxes ?? []);
  const reconciledAxes = new Set(axis?.reconciledAxes ?? []);
  const uncoveredAxes = new Set(axis?.uncoveredAxes ?? []);
  const unmapped = design.filter((artifact) => artifact.axis === "unmapped");
  const axisPass =
    currentAxisRecords.length === 1 &&
    configuredAxes.size > 0 &&
    [...discoveredAxes].every((name) => reconciledAxes.has(name)) &&
    [...reconciledAxes].every((name) => configuredAxes.has(name)) &&
    uncoveredAxes.size === 0 &&
    unmapped.length === 0;
  predicates.push(
    result({
      predicateId: "inventory.axes-covered",
      passed: axisPass,
      observed: uncoveredAxes.size + unmapped.length,
      target: 0,
      evidenceRefs: axisRefs,
      gaps: [
        ...(uncoveredAxes.size > 0
          ? [`Uncovered axes: ${[...uncoveredAxes].sort().join(", ")}`]
          : []),
        ...(unmapped.length > 0
          ? [`${unmapped.length} occurrence(s) retain axis=unmapped`]
          : []),
        ...([...discoveredAxes].every((name) => reconciledAxes.has(name))
          ? []
          : ["Not every discovered axis is reconciled"]),
      ],
      reentryCode: "E-EXTRACT",
    })
  );

  const reportResults = new Map();
  for (const contract of ABSOLUTE_REPORT_PREDICATES) {
    const evaluation = reportEvaluation({
      contract,
      reportRecords: recordsOfType(records, "inventory-report"),
      finalChecks,
      finalChecksRef,
      runRoot: absoluteRunRoot,
      currentFingerprint,
    });
    reportResults.set(contract.predicateId, evaluation);
    predicates.push(evaluation.result);
  }

  const exceptions = design.filter(
    (artifact) => artifact.reconciliation.status === "approved-exception"
  );
  const incompleteExceptionBasics = exceptions.filter((artifact) => {
    const owner =
      artifact.context.component ??
      artifact.context.nativeTag ??
      artifact.context.implicitRole ??
      artifact.context.explicitRole;
    return (
      !owner ||
      !artifact.reconciliation.exceptionId ||
      !artifact.reconciliation.reason
    );
  });
  const exceptionReport = reportResults.get(
    "inventory.exceptions-complete"
  )?.report;
  if (
    exceptionReport &&
    exceptionReport.counts.approvedExceptions !== exceptions.length
  ) {
    mergeGap(
      predicates,
      "inventory.exceptions-complete",
      `Absolute exception report declares ${exceptionReport.counts.approvedExceptions ?? "no"} approved exception(s), but the census contains ${exceptions.length}`
    );
  }
  if (incompleteExceptionBasics.length > 0) {
    mergeGap(
      predicates,
      "inventory.exceptions-complete",
      `${incompleteExceptionBasics.length} approved exception(s) lack a source-level owner, reason, or exception ID`
    );
  }

  const finalScenarioIds = new Set(
    currentScenarioRecords.map(({ artifact }) => artifact.scenarioId)
  );
  const requestedScenarioIds = new Set(finalMatrix?.requestedScenarioIds ?? []);
  const producedScenarioIds = new Set(finalMatrix?.producedScenarioIds ?? []);
  const captureIds =
    finalMatrix?.captures?.map(({ scenarioId }) => scenarioId) ?? [];
  const uniqueCaptureIds = new Set(captureIds);
  const scenarioCoveragePass =
    finalScenarioIds.size > 0 &&
    requestedScenarioIds.size > 0 &&
    sameSet(finalScenarioIds, requestedScenarioIds) &&
    sameSet(requestedScenarioIds, producedScenarioIds) &&
    sameSet(requestedScenarioIds, uniqueCaptureIds) &&
    captureIds.length === uniqueCaptureIds.size &&
    finalMatrix?.exactCoverage === true;
  predicates.push(
    result({
      predicateId: "rendered.scenarios-captured",
      passed: scenarioCoveragePass,
      observed: `${uniqueCaptureIds.size}/${finalScenarioIds.size}`,
      target: `${finalScenarioIds.size}/${finalScenarioIds.size}`,
      evidenceRefs: [...scenarioRefs, ...finalMatrixRefs],
      gaps: [
        ...(finalScenarioIds.size === 0
          ? ["Declared final scenario set is vacuous"]
          : []),
        ...(!sameSet(finalScenarioIds, requestedScenarioIds)
          ? ["Final manifest does not request exactly every declared scenario"]
          : []),
        ...(!sameSet(requestedScenarioIds, producedScenarioIds) ||
        !sameSet(requestedScenarioIds, uniqueCaptureIds) ||
        captureIds.length !== uniqueCaptureIds.size
          ? ["Requested, produced, and unique capture scenario sets differ"]
          : []),
        ...(finalMatrix?.exactCoverage === true
          ? []
          : ["Final evidence exactCoverage is not true"]),
      ],
      reentryCode: "E-COMPARE",
    })
  );

  const dimensions = [
    ["themes", "theme"],
    ["projects", "project"],
    ["browsers", "browser"],
    ["locales", "locale"],
    ["writingModes", "writingMode"],
  ];
  const matrixDimensionGaps = [];
  for (const [configField, scenarioField] of dimensions) {
    const configured = new Set(config?.matrix?.[configField] ?? []);
    const observed = new Set(
      currentScenarioRecords.map(({ artifact }) => artifact[scenarioField])
    );
    if (
      configured.size === 0 ||
      ![...observed].every((value) => configured.has(value)) ||
      ![...configured].every((value) => observed.has(value))
    ) {
      matrixDimensionGaps.push(
        `${configField} configured/observed values differ`
      );
    }
  }
  for (const message of matrixDimensionGaps) {
    mergeGap(predicates, "rendered.exact-matrix", message);
  }

  const manifestRecords = recordsOfType(records, "evidence-manifest");
  const captureFileGaps = manifestRecords.flatMap(({ artifact }) =>
    artifact.captures.flatMap((capture) =>
      verifyCaptureFile(absoluteRunRoot, capture)
    )
  );
  for (const message of captureFileGaps) {
    mergeGap(predicates, "rendered.pairs-integrity", message);
  }

  const contracts = recordsOfType(records, "batch-contract").map(
    ({ artifact }) => artifact
  );
  const mutations = recordsOfType(records, "mutation-manifest").map(
    ({ artifact }) => artifact
  );
  const comparisons = recordsOfType(records, "comparison").map(
    ({ artifact }) => artifact
  );
  const visualReviews = recordsOfType(records, "visual-review").map(
    ({ artifact }) => artifact
  );
  const acceptances = recordsOfType(records, "acceptance").map(
    ({ artifact }) => artifact
  );
  const batchIds = new Set(contracts.map(({ batchId }) => batchId));
  const batchGaps = [];
  for (const batchId of batchIds) {
    for (const [label, artifacts] of [
      ["mutation", mutations],
      ["comparison", comparisons],
      ["visual review", visualReviews],
      ["acceptance", acceptances],
    ]) {
      const count = artifacts.filter(
        (artifact) => artifact.batchId === batchId
      ).length;
      if (count !== 1) {
        batchGaps.push(`${batchId} has ${count} ${label} artifact(s)`);
      }
    }
  }
  const rejectedAcceptance = acceptances.filter(
    ({ verdict }) => verdict !== "accepted"
  );
  const failedComparisons = comparisons.filter(
    (comparison) =>
      comparison.verdict !== "pass" ||
      comparison.exactCoverage !== true ||
      comparison.missingPairCount !== 0 ||
      comparison.pairs.some(({ policyVerdict }) => policyVerdict !== "pass")
  );
  const incompleteReviews = visualReviews.filter(
    (review) =>
      review.complete !== true ||
      review.verdict !== "pass" ||
      review.entries.some(({ verdict }) => verdict !== "expected")
  );
  for (const message of [
    ...batchGaps,
    ...(failedComparisons.length > 0
      ? [`${failedComparisons.length} batch comparison(s) do not pass`]
      : []),
  ]) {
    mergeGap(predicates, "rendered.batch-effects-satisfied", message);
  }
  for (const message of [
    ...batchGaps,
    ...(incompleteReviews.length > 0
      ? [`${incompleteReviews.length} visual review(s) are incomplete`]
      : []),
  ]) {
    mergeGap(predicates, "rendered.image-reviews-complete", message);
  }
  for (const message of [
    ...batchGaps,
    ...(rejectedAcceptance.length > 0
      ? [`${rejectedAcceptance.length} batch acceptance(s) are not accepted`]
      : []),
    ...acceptances
      .filter(
        (acceptance) =>
          !acceptance.ledgerEntry ||
          acceptance.preSourceFingerprint ===
            acceptance.acceptedSourceFingerprint
      )
      .map(
        ({ batchId }) =>
          `${batchId} lacks a reversible, evidence-linked acceptance`
      ),
  ]) {
    mergeGap(predicates, "process.accepted-batches-reversible", message);
  }

  const mutationAt = latestGeneratedAt(
    recordsOfType(records, "mutation-manifest")
  );
  const censusAt = Math.min(
    latestGeneratedAt(currentDesignRecords),
    latestGeneratedAt(currentAxisRecords)
  );
  const censusFresh =
    design.length > 0 &&
    currentAxisRecords.length === 1 &&
    censusAt >= mutationAt &&
    state?.sourceFingerprint === currentFingerprint;
  predicates.push(
    result({
      predicateId: "process.final-census-fresh",
      passed: censusFresh,
      observed: censusFresh,
      target: true,
      evidenceRefs: [...designRefs, ...axisRefs],
      gaps: [
        ...(censusAt < mutationAt
          ? ["Final census predates the last mutation"]
          : []),
        ...(state?.sourceFingerprint !== currentFingerprint
          ? ["Run state is not bound to the current source fingerprint"]
          : []),
      ],
      reentryCode: "E-EXTRACT",
    })
  );

  const reinventoryAt = Math.max(
    Number.NEGATIVE_INFINITY,
    ...(state?.journal ?? [])
      .filter(({ to }) => to === "REINVENTORIED")
      .map(({ at }) => parseTime(at))
      .filter(Number.isFinite)
  );
  const matrixAt = parseTime(finalMatrix?.generatedAt);
  const checksAt = parseTime(finalChecks?.generatedAt);
  const checkExecutionProblems = [];
  const checkIds = finalChecks?.checks?.map(({ checkId }) => checkId) ?? [];
  for (const duplicate of checkIds.filter(
    (checkId, index) => checkIds.indexOf(checkId) !== index
  )) {
    checkExecutionProblems.push(`Duplicate final check ID: ${duplicate}`);
  }
  for (const check of finalChecks?.checks ?? []) {
    const executedAt = parseTime(check.executedAt);
    if (
      check.status !== "pass" ||
      check.exitCode !== 0 ||
      check.reentryCode !== null
    ) {
      checkExecutionProblems.push(`Final check did not pass: ${check.checkId}`);
    }
    if (executedAt < mutationAt || executedAt > checksAt) {
      checkExecutionProblems.push(
        `Final check timestamp is stale or impossible: ${check.checkId}`
      );
    }
  }
  const finalOrderPass =
    finalMatrix &&
    finalChecks &&
    finalChecks.allPassed === true &&
    finalChecks.checks.length > 0 &&
    matrixAt >= mutationAt &&
    checksAt >= mutationAt &&
    matrixAt >= reinventoryAt &&
    checksAt >= reinventoryAt &&
    checkExecutionProblems.length === 0;
  predicates.push(
    result({
      predicateId: "process.final-matrix-and-gates-fresh",
      passed: Boolean(finalOrderPass),
      observed: Boolean(finalOrderPass),
      target: true,
      evidenceRefs: [...finalMatrixRefs, ...finalChecksRefs],
      gaps: [
        ...checkExecutionProblems,
        ...(!Number.isFinite(reinventoryAt)
          ? ["No REINVENTORIED transition exists"]
          : []),
        ...(matrixAt < reinventoryAt || checksAt < reinventoryAt
          ? ["Final matrix or checks predate the final re-inventory transition"]
          : []),
        ...(finalChecks?.allPassed === true
          ? []
          : ["Final deterministic-checks.allPassed is not true"]),
      ],
      reentryCode: "E-COMPARE",
    })
  );

  const fingerprintArtifacts = [
    state,
    finalMatrix,
    finalChecks,
    finalReview,
    ...design,
    ...normalized,
    ...(axis ? [axis] : []),
    ...recordsOfType(records, "inventory-report").map(
      ({ artifact }) => artifact
    ),
  ].filter(Boolean);
  const staleArtifacts = fingerprintArtifacts.filter(
    (artifact) =>
      artifact.sourceFingerprint !== currentFingerprint ||
      artifact.toolchainFingerprint !== toolchainEvaluation.canonical
  );
  const fingerprintsPass =
    SHA256.test(currentFingerprint ?? "") &&
    sourceEvaluation.problems.length === 0 &&
    toolchainEvaluation.problems.length === 0 &&
    staleArtifacts.length === 0;
  predicates.push(
    result({
      predicateId: "process.fingerprints-current",
      passed: fingerprintsPass,
      observed: fingerprintsPass,
      target: true,
      evidenceRefs: [...axisRefs, ...finalMatrixRefs, ...finalChecksRefs],
      gaps: [
        ...sourceEvaluation.problems,
        ...toolchainEvaluation.problems,
        ...(staleArtifacts.length > 0
          ? [
              `${staleArtifacts.length} final artifact(s) do not match the live source/toolchain fingerprints`,
            ]
          : []),
      ],
      reentryCode: "E-EXTRACT",
    })
  );

  const acceptanceRefs = refsForRecords(
    recordsOfType(records, "acceptance"),
    absoluteRunRoot,
    globalGaps
  );
  const completionReportRefs = refsForRecords(
    recordsOfType(records, "inventory-report").filter(({ artifact }) =>
      artifact.reportId.startsWith("absolute/")
    ),
    absoluteRunRoot,
    globalGaps
  );
  const requiredReviewRefs = [
    ...finalMatrixRefs,
    ...finalChecksRefs,
    ...designRefs,
    ...normalizedRefs,
    ...axisRefs,
    ...completionReportRefs,
    ...acceptanceRefs,
  ];
  const actualReviewRefs = new Set(
    (finalReview?.reviewedArtifactRefs ?? []).map(refKey)
  );
  const missingReviewRefs = requiredReviewRefs.filter(
    (artifactRef) => !actualReviewRefs.has(refKey(artifactRef))
  );
  const reviewAt = parseTime(finalReview?.generatedAt);
  const forbiddenReviewer =
    /(?:^|[-_.])(self|inline|main|primary)(?:[-_.]|$)/iu;
  const reviewPass =
    finalReview?.verdict === "satisfied" &&
    !forbiddenReviewer.test(finalReview?.reviewerId ?? "") &&
    finalReview?.findings?.every(
      ({ severity }) => !["blocker", "high"].includes(severity)
    ) &&
    missingReviewRefs.length === 0 &&
    reviewAt >= matrixAt &&
    reviewAt >= checksAt;
  predicates.push(
    result({
      predicateId: "process.final-adversarial-satisfied",
      passed: Boolean(reviewPass),
      observed: finalReview?.verdict ?? "missing",
      target: "satisfied",
      evidenceRefs: finalReviewRefs,
      gaps: [
        ...(finalReview?.verdict === "satisfied"
          ? []
          : ["Final adversarial verdict is not satisfied"]),
        ...(forbiddenReviewer.test(finalReview?.reviewerId ?? "")
          ? ["Final reviewer ID identifies inline/self review, not isolation"]
          : []),
        ...(finalReview?.findings?.some(({ severity }) =>
          ["blocker", "high"].includes(severity)
        )
          ? ["Final adversarial review retains blocker/high findings"]
          : []),
        ...(missingReviewRefs.length > 0
          ? [
              `Final adversarial review omitted ${missingReviewRefs.length} required artifact reference(s)`,
            ]
          : []),
        ...(reviewAt < matrixAt || reviewAt < checksAt
          ? ["Final adversarial review predates the final matrix or checks"]
          : []),
      ],
      reentryCode: "E-DECISION",
    })
  );

  const actualPredicateIds = predicates.map(({ predicateId }) => predicateId);
  if (
    !sameSet(
      new Set(actualPredicateIds),
      new Set(ABSOLUTE_COMPLETION_PREDICATE_IDS)
    ) ||
    actualPredicateIds.length !== ABSOLUTE_COMPLETION_PREDICATE_IDS.length
  ) {
    globalGaps.push(
      "Evaluator did not produce the closed Section 14 predicate set"
    );
  }
  const configuredPredicateIds = new Set(
    config?.completionPolicy?.predicateIds ?? []
  );
  if (
    !sameSet(configuredPredicateIds, new Set(ABSOLUTE_COMPLETION_PREDICATE_IDS))
  ) {
    globalGaps.push(
      `run-config completionPolicy must contain exactly the ${ABSOLUTE_COMPLETION_PREDICATE_IDS.length} canonical Section 14 predicates`
    );
  }

  for (const predicate of predicates) {
    if (predicate.evidenceRefs.length === 0) {
      predicate.status = "fail";
      predicate.gaps = unique([
        ...predicate.gaps,
        "Predicate has no durable artifact evidence",
      ]);
    }
  }

  const reportResidual = (predicateId) => {
    const value = reportResults.get(predicateId)?.residual;
    return Number.isInteger(value) ? value : 1;
  };
  const residualCounts = {
    unclassifiedOccurrences: design.filter(({ reconciliation }) =>
      ["discovered", "opaque"].includes(reconciliation.status)
    ).length,
    unreconciledDesignOccurrences: nonTerminal.length,
    unapprovedHardcodes: reportResidual("tokens.hardcodes-and-arbitrary-zero"),
    unapprovedNamingViolations: reportResidual(
      "tokens.naming-and-application-zero"
    ),
    missingOrDeadClasses: reportResidual("tokens.classes-emitted-live"),
    uncoveredAxes: uncoveredAxes.size + unmapped.length,
    uncoveredOccurrenceKinds: uncoveredKinds.size,
    uncoveredScenarios:
      reportResidual("rendered.routes-materialized") +
      reportResidual("rendered.exact-matrix") +
      (scenarioCoveragePass ? 0 : 1),
    unreviewedPairs:
      reportResidual("rendered.image-reviews-complete") +
      incompleteReviews.length,
  };

  const failedPredicates = predicates.filter(({ status }) => status !== "pass");
  const allResidualsZero = Object.values(residualCounts).every(
    (value) => value === 0
  );
  const completed =
    globalGaps.length === 0 &&
    failedPredicates.length === 0 &&
    allResidualsZero &&
    currentFingerprint &&
    finalMatrixRef &&
    finalChecksRef &&
    finalReviewRef;

  const proof = completed
    ? {
        schemaVersion: "1.0.0",
        artifactType: "final-proof",
        runId: config.runId,
        sourceFingerprint: currentFingerprint,
        toolchainFingerprint: toolchainEvaluation.canonical,
        generatedAt,
        predicates: predicates.map(
          ({ predicateId, status, observed, target, evidenceRefs }) => ({
            predicateId,
            status,
            observed,
            target,
            evidenceRefs,
          })
        ),
        residualCounts,
        finalMatrixRef,
        finalChecksRef,
        finalAdversarialReviewRef: finalReviewRef,
        finalSourceFingerprint: currentFingerprint,
        verdict: "done",
      }
    : null;

  if (proof && validator) {
    const schema = validator.validate(proof);
    if (!schema.valid) {
      globalGaps.push(
        `Generated final proof failed schema validation: ${JSON.stringify(
          schema.errors
        )}`
      );
    } else {
      const completeValidation = validateArtifactSet({
        records: [...records, { artifact: proof }],
        runRoot: absoluteRunRoot,
        validator,
        targetPhase: "COMPLETE",
      });
      if (!completeValidation.valid) {
        globalGaps.push(
          ...completeValidation.violations.map(
            (violation) =>
              `${violation.reentryCode} ${violation.invariant}: ${violation.message}`
          )
        );
      }
    }
  }

  const finalProof = proof && globalGaps.length === 0 ? proof : null;
  const gapReport = {
    reportVersion: "1.0.0",
    runId: config?.runId ?? null,
    generatedAt,
    verdict: finalProof ? "done" : "pending",
    currentSourceFingerprint: currentFingerprint,
    configuredSourceFingerprint: state?.sourceFingerprint ?? null,
    currentToolchainFingerprint: toolchainEvaluation.canonical,
    sourceFileCount: sourceEvaluation.files.length,
    summary: {
      totalPredicates: ABSOLUTE_COMPLETION_PREDICATE_IDS.length,
      passedPredicates: predicates.filter(({ status }) => status === "pass")
        .length,
      failedPredicates: predicates.filter(({ status }) => status !== "pass")
        .length,
      residualsZero: allResidualsZero,
    },
    residualCounts,
    predicates,
    contractViolations: unique(globalGaps),
  };
  return {
    completed: Boolean(finalProof),
    proof: finalProof,
    gapReport,
    records,
  };
}
