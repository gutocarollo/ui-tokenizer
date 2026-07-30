import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  makeArtifactRef,
  sha256CanonicalJson,
  sha256File,
} from "../lib/artifact-contract.mjs";
import {
  ABSOLUTE_COMPLETION_PREDICATE_IDS,
  ABSOLUTE_REPORT_PREDICATES,
  absoluteReportId,
} from "../lib/absolute-completion-contract.mjs";
import { fingerprintSourceRoots } from "../lib/absolute-completion.mjs";
import { runAbsoluteCompletionCli } from "../evaluate-absolute-completion.mjs";

const SKILL_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../.."
);
const REPOSITORY_ROOT = path.resolve(SKILL_ROOT, "../../..");
const TARGET_NODE_MODULES = path.join(REPOSITORY_ROOT, "frontend/node_modules");
const RUN_ID = "tokenize-absolute-test";
const GENERATED = {
  config: "2026-07-30T00:00:00.000Z",
  inventory: "2026-07-30T00:02:00.000Z",
  reports: "2026-07-30T00:03:00.000Z",
  reinventory: "2026-07-30T00:04:00.000Z",
  matrix: "2026-07-30T00:05:00.000Z",
  checks: "2026-07-30T00:06:00.000Z",
  review: "2026-07-30T00:07:00.000Z",
};
const OCCURRENCE_KINDS = [
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
];
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeNdjson(filePath, values) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(
    filePath,
    `${values.map((value) => JSON.stringify(value)).join("\n")}\n`
  );
}

function header(artifactType, context, generatedAt = GENERATED.inventory) {
  return {
    schemaVersion: "1.0.0",
    artifactType,
    runId: RUN_ID,
    sourceFingerprint: context.sourceFingerprint,
    toolchainFingerprint: context.toolchainFingerprint,
    generatedAt,
  };
}

function artifactRef(filePath, context, artifactType) {
  return makeArtifactRef(filePath, {
    runRoot: context.runRoot,
    artifactType,
  });
}

function buildFixture({ falseGreen = false, vacuous = false } = {}) {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "absolute-proof-"));
  const applicationRoot = path.join(temporary, "app");
  const runRoot = path.join(temporary, RUN_ID);
  mkdirSync(path.join(applicationRoot, "src"), { recursive: true });
  writeJson(path.join(applicationRoot, "package.json"), {
    name: "absolute-proof-fixture",
    private: true,
  });
  symlinkSync(TARGET_NODE_MODULES, path.join(applicationRoot, "node_modules"));
  writeFileSync(
    path.join(applicationRoot, "src/Button.jsx"),
    'export const Button = () => <button className="text-primary">OK</button>;\n'
  );
  const sourceFingerprint = fingerprintSourceRoots({
    applicationRoot,
    sourceRoots: ["src"],
  }).fingerprint;
  const toolchain = {
    versions: { node: process.versions.node },
    configurationFingerprints: {
      "file:package.json": sha256File(
        path.join(applicationRoot, "package.json")
      ),
    },
  };
  const toolchainFingerprint = sha256CanonicalJson(toolchain);
  const context = {
    temporary,
    applicationRoot,
    runRoot,
    sourceFingerprint,
    toolchainFingerprint,
  };
  mkdirSync(runRoot, { recursive: true });

  const configPath = path.join(runRoot, "config.json");
  const config = {
    ...header("run-config", context, GENERATED.config),
    objective: "Prove absolute design-system tokenization completion",
    sourceRoots: ["src"],
    sourceKindRegistry: OCCURRENCE_KINDS.map((occurrenceKind) => ({
      occurrenceKind,
      disposition: "scan",
      adapter: `scanner:${occurrenceKind}`,
      rationale: "The complete source kind is in scope",
    })),
    axisRegistry: [
      {
        axis: "color",
        tokenTypes: ["color"],
        validator: "absolute-color-validator",
        namingContract: "owner.anatomy.property",
        emitter: "fixture-emitter",
        completionPredicateIds: [...ABSOLUTE_COMPLETION_PREDICATE_IDS],
      },
    ],
    matrix: {
      themes: ["light"],
      projects: ["desktop"],
      browsers: ["chromium"],
      locales: ["en-US"],
      writingModes: ["ltr"],
    },
    toolchain,
    adapters: {
      extractor: "fixture-extractor",
      normalizer: "fixture-normalizer",
      inventory: "fixture-inventory",
      tokenBuild: "fixture-token-build",
      impact: "fixture-impact",
      fixture: "fixture-registry",
      evidence: "fixture-evidence",
      comparator: "fixture-comparator",
      reviewer: "isolated-reviewer",
    },
    completionPolicy: {
      unapprovedDebtTarget: 0,
      exceptionPolicy:
        "Owner, reason, scope, evidence, and review policy are mandatory",
      predicateIds: [...ABSOLUTE_COMPLETION_PREDICATE_IDS],
    },
  };
  writeJson(configPath, config);
  const configRef = artifactRef(configPath, context, "run-config");

  const designPath = path.join(runRoot, "inventory/design-occurrences.ndjson");
  const design = {
    ...header("design-occurrence", context),
    occurrenceId: "occ-1",
    occurrenceKind: "utility-class",
    axis: "color",
    location: { file: "src/Button.jsx", line: 1, column: 37 },
    sourceLanguage: "jsx",
    rawValue: "text-primary",
    property: "color",
    context: {
      component: "Button",
      nativeTag: "button",
      implicitRole: "button",
      explicitRole: null,
      nearestLandmark: null,
      routeAreas: ["/"],
      interactionState: "default",
    },
    sourcePayload: {
      selectorOrObjectPath: null,
      classExpression: {
        expressionKind: "string-literal",
        resolverKind: "direct",
        branchId: "branch-1",
        conditionExpression: null,
        rawClassName: "text-primary",
        rawTokens: ["text-primary"],
        unresolvedDynamicFragments: [],
        branchExpansionTruncated: false,
      },
      asset: null,
    },
    reconciliation: {
      status: "approved-token",
      decisionId: "D1",
      exceptionId: null,
      reason: null,
    },
  };
  writeNdjson(designPath, vacuous ? [] : [design]);
  const designRef = artifactRef(designPath, context, "design-occurrence");

  const normalizedPath = path.join(
    runRoot,
    "inventory/normalized-occurrences.ndjson"
  );
  const normalized = {
    ...header("normalized-occurrence", context),
    occurrenceId: "norm-1",
    designOccurrenceId: "occ-1",
    location: design.location,
    context: design.context,
    source: {
      expressionKind: "string-literal",
      resolverKind: "direct",
      branchId: "branch-1",
      conditionExpression: null,
      unresolvedDynamicFragments: [],
      branchExpansionTruncated: false,
    },
    rawClassName: "text-primary",
    rawTokens: ["text-primary"],
    candidates: [
      {
        raw: "text-primary",
        variants: [],
        important: false,
        negative: false,
        utilityRoot: "text",
        value: "primary",
        modifier: null,
        canonicalCandidate: "text-primary",
        status: "valid",
      },
    ],
    fingerprints: {
      rawOrderHash: sourceFingerprint,
      canonicalMultisetFingerprint: sourceFingerprint,
      canonicalSetFingerprint: sourceFingerprint,
      runtimeMergedFingerprint: null,
      compiledCssFingerprint: sourceFingerprint,
      computedStyleFingerprints: [sourceFingerprint],
      semanticContextFingerprint: sourceFingerprint,
    },
    normalizerProvenance: {
      normalizerVersion: "1.0.0",
      tailwindVersion: "4.3.3",
      tailwindEntryCssFingerprint: sourceFingerprint,
      tailwindConfigFingerprint: sourceFingerprint,
      tokenSourceFingerprint: sourceFingerprint,
      twMergeVersion: null,
      twMergeConfigFingerprint: null,
    },
    reconciliationStatus: "valid",
  };
  writeNdjson(normalizedPath, vacuous ? [] : [normalized]);
  const normalizedRef = artifactRef(
    normalizedPath,
    context,
    "normalized-occurrence"
  );

  const axisPath = path.join(runRoot, "inventory/axis-discovery.json");
  const byOccurrenceKind = Object.fromEntries(
    OCCURRENCE_KINDS.map((kind) => [
      kind,
      kind === "utility-class" && !vacuous ? 1 : 0,
    ])
  );
  const axis = {
    ...header("axis-discovery", context),
    discoveryId: "axis-final",
    configuredAxes: ["color"],
    discoveredAxes: ["color"],
    reconciledAxes: ["color"],
    uncoveredAxes: [],
    registeredOccurrenceKinds: [...OCCURRENCE_KINDS],
    discoveredOccurrenceKinds: ["utility-class"],
    coveredOccurrenceKinds: ["utility-class"],
    uncoveredOccurrenceKinds: [],
    occurrenceCounts: {
      byAxis: { color: vacuous ? 0 : 1 },
      byOccurrenceKind,
    },
    exhaustive: true,
  };
  writeJson(axisPath, axis);
  const axisRef = artifactRef(axisPath, context, "axis-discovery");

  const scenarioPath = path.join(runRoot, "final/scenarios.ndjson");
  const scenario = {
    ...header("scenario", context),
    scenarioId:
      "root/default::theme/light::project/desktop::locale/en-US::writing-mode/ltr",
    route: "/",
    routeParams: {},
    fixtureId: "anonymous-root",
    authRole: "anonymous",
    theme: "light",
    project: "desktop",
    browser: "chromium",
    locale: "en-US",
    writingMode: "ltr",
    interactionState: "default",
    preconditions: [],
    actions: [],
    assertions: [],
    captureRegion: null,
    expectedVisualEffect: "preserve",
  };
  writeNdjson(scenarioPath, [scenario]);
  const scenarioRef = artifactRef(scenarioPath, context, "scenario");

  const reportPath = path.join(runRoot, "final/completion-reports.ndjson");
  const reports = ABSOLUTE_REPORT_PREDICATES.map((contract) => ({
    ...header("inventory-report", context, GENERATED.reports),
    reportId: absoluteReportId(contract.predicateId),
    inventoryKind: contract.inventoryKind,
    inputArtifactRefs: [designRef],
    counts: {
      population: 1,
      ...(contract.predicateId === "inventory.exceptions-complete"
        ? { approvedExceptions: 0 }
        : {}),
      ...(!falseGreen ||
      contract.predicateId !== "tokens.hardcodes-and-arbitrary-zero"
        ? { unapprovedResidual: 0 }
        : { ratchetDelta: 0 }),
    },
    detailArtifactRefs: [],
    reconciled: true,
  }));
  writeNdjson(reportPath, reports);
  const reportRef = artifactRef(reportPath, context, "inventory-report");

  const statePath = path.join(runRoot, "state.json");
  const state = {
    ...header("run-state", context, GENERATED.reinventory),
    currentPhase: "REINVENTORIED",
    activeBatchId: null,
    journal: [
      {
        sequence: 1,
        from: "START",
        to: "ANCHORED",
        at: GENERATED.config,
        reason: "Fixture run initialized",
        reentryCode: null,
        artifactRefs: [configRef],
      },
      {
        sequence: 2,
        from: "ANCHORED",
        to: "INVENTORIED",
        at: GENERATED.inventory,
        reason: "Complete final source census",
        reentryCode: null,
        artifactRefs: [designRef, axisRef, scenarioRef],
      },
      {
        sequence: 3,
        from: "INVENTORIED",
        to: "NORMALIZED",
        at: "2026-07-30T00:02:30.000Z",
        reason: "Complete class projection",
        reentryCode: null,
        artifactRefs: [normalizedRef],
      },
      {
        sequence: 4,
        from: "NORMALIZED",
        to: "REINVENTORIED",
        at: GENERATED.reinventory,
        reason: "Absolute residual reports generated",
        reentryCode: null,
        artifactRefs: [reportRef],
      },
    ],
    artifacts: [
      configRef,
      designRef,
      axisRef,
      scenarioRef,
      normalizedRef,
      reportRef,
    ],
  };
  writeJson(statePath, state);

  const pngPath = path.join(runRoot, "final/assets/root.png");
  mkdirSync(path.dirname(pngPath), { recursive: true });
  writeFileSync(pngPath, PNG_BYTES);
  const capture = {
    scenarioId: scenario.scenarioId,
    pngPath: "final/assets/root.png",
    bytes: PNG_BYTES.length,
    width: 1,
    height: 1,
    sha256: sha256File(pngPath),
    consoleErrors: [],
    pageErrors: [],
    networkFailures: [],
    axeViolationIds: [],
    overflow: false,
  };
  const matrixPath = path.join(runRoot, "final/evidence-manifest.json");
  const matrix = {
    ...header("evidence-manifest", context, GENERATED.matrix),
    phase: "final",
    batchId: null,
    routeRegistryFingerprint: sourceFingerprint,
    fixtureRegistryFingerprint: sourceFingerprint,
    tokenSourceFingerprint: sourceFingerprint,
    generatedCssFingerprint: sourceFingerprint,
    requestedScenarioIds: [scenario.scenarioId],
    producedScenarioIds: [scenario.scenarioId],
    captures: [capture],
    exactCoverage: true,
  };
  writeJson(matrixPath, matrix);
  const matrixRef = artifactRef(matrixPath, context, "evidence-manifest");

  const checksPath = path.join(runRoot, "final/deterministic-checks.json");
  const checks = {
    ...header("deterministic-checks", context, GENERATED.checks),
    scope: "final",
    batchId: null,
    checks: ABSOLUTE_REPORT_PREDICATES.map(({ predicateId }) => ({
      checkId: predicateId,
      command: `absolute-gate --predicate ${predicateId}`,
      exitCode: 0,
      status: "pass",
      executedAt: GENERATED.checks,
      outputSha256: reportRef.sha256,
      reentryCode: null,
    })),
    allPassed: true,
  };
  writeJson(checksPath, checks);
  const checksRef = artifactRef(checksPath, context, "deterministic-checks");

  const reviewPath = path.join(runRoot, "final/adversarial-review.json");
  const review = {
    ...header("adversarial-review", context, GENERATED.review),
    scope: "final",
    batchId: null,
    round: 2,
    reviewerId: "isolated-adversarial-reviewer",
    reviewedArtifactRefs: [
      matrixRef,
      checksRef,
      designRef,
      normalizedRef,
      axisRef,
      reportRef,
    ],
    findings: [],
    verdict: "satisfied",
  };
  writeJson(reviewPath, review);

  return {
    ...context,
    matrixPath,
    checksPath,
    reviewPath,
    reportPath,
    sourcePath: path.join(applicationRoot, "src/Button.jsx"),
  };
}

function runFixture(fixture) {
  return runAbsoluteCompletionCli([
    "--root",
    fixture.applicationRoot,
    "--run-root",
    fixture.runRoot,
  ]);
}

test("absolute evaluator writes one schema-valid 24-predicate proof only for complete evidence", () => {
  const fixture = buildFixture();
  const result = runFixture(fixture);
  assert.equal(
    result.exitCode,
    0,
    existsSync(result.gapReportPath)
      ? readFileSync(result.gapReportPath, "utf8")
      : JSON.stringify(result)
  );
  assert.equal(result.completed, true);
  assert.equal(existsSync(result.finalProofPath), true);
  const proof = JSON.parse(readFileSync(result.finalProofPath, "utf8"));
  assert.equal(proof.verdict, "done");
  assert.deepEqual(
    new Set(proof.predicates.map(({ predicateId }) => predicateId)),
    new Set(ABSOLUTE_COMPLETION_PREDICATE_IDS)
  );
  assert.equal(proof.predicates.length, 24);
  assert.ok(proof.predicates.every(({ status }) => status === "pass"));
  assert.ok(Object.values(proof.residualCounts).every((value) => value === 0));
});

test("ratchet-only green output cannot substitute for absolute residual evidence", () => {
  const fixture = buildFixture({ falseGreen: true });
  const result = runFixture(fixture);
  assert.equal(result.exitCode, 1);
  assert.equal(result.completed, false);
  assert.equal(
    existsSync(path.join(fixture.runRoot, "final-proof.json")),
    false
  );
  const gaps = JSON.parse(readFileSync(result.gapReportPath, "utf8"));
  const predicate = gaps.predicates.find(
    ({ predicateId }) => predicateId === "tokens.hardcodes-and-arbitrary-zero"
  );
  assert.equal(predicate.status, "fail");
  assert.match(
    predicate.gaps.join("\n"),
    /absolute counts\.unapprovedResidual/u
  );
});

test("source changes after final evidence are rejected as stale", () => {
  const fixture = buildFixture();
  writeFileSync(
    fixture.sourcePath,
    'export const Button = () => <button className="text-danger">Changed</button>;\n'
  );
  const result = runFixture(fixture);
  assert.equal(result.exitCode, 1);
  assert.equal(
    existsSync(path.join(fixture.runRoot, "final-proof.json")),
    false
  );
  const gaps = JSON.parse(readFileSync(result.gapReportPath, "utf8"));
  const predicate = gaps.predicates.find(
    ({ predicateId }) => predicateId === "process.fingerprints-current"
  );
  assert.equal(predicate.status, "fail");
  assert.match(
    [...predicate.gaps, ...gaps.contractViolations].join("\n"),
    /fingerprint|current source/iu
  );
});

test("an empty design census fails closed instead of proving a vacuous 100 percent", () => {
  const fixture = buildFixture({ vacuous: true });
  const result = runFixture(fixture);
  assert.equal(result.exitCode, 1);
  assert.equal(
    existsSync(path.join(fixture.runRoot, "final-proof.json")),
    false
  );
  const gaps = JSON.parse(readFileSync(result.gapReportPath, "utf8"));
  assert.ok(
    gaps.predicates.some(
      ({ predicateId, gaps: predicateGaps }) =>
        predicateId === "inventory.design-occurrences-terminal" &&
        predicateGaps.some((message) => /vacuous/u.test(message))
    )
  );
});
