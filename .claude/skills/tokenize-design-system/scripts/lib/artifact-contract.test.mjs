import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ARTIFACT_TYPES,
  OCCURRENCE_KINDS,
  createArtifactValidator,
  makeArtifactRef,
  sha256CanonicalJson,
  validateArtifactSet,
  validateTransition,
} from "./artifact-contract.mjs";
import { ABSOLUTE_COMPLETION_PREDICATE_IDS } from "./absolute-completion-contract.mjs";

const REPOSITORY_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../../../.."
);
const APPLICATION_ROOT = path.join(REPOSITORY_ROOT, "frontend");
const SOURCE_A = "a".repeat(64);
const SOURCE_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const GENERATED_AT = "2026-07-30T00:00:00.000Z";
const RUN_ID = "tokenize-contract-test";
const TOOLCHAIN = {
  versions: { node: "24.4.1", tailwindcss: "4.1.11" },
  configurationFingerprints: { tailwind: HASH_C },
};
const TOOLCHAIN_FINGERPRINT = sha256CanonicalJson(TOOLCHAIN);
const REF = {
  artifactType: "run-config",
  path: "config.json",
  sha256: HASH_C,
};

function header(artifactType, sourceFingerprint = SOURCE_A) {
  return {
    schemaVersion: "1.0.0",
    artifactType,
    runId: RUN_ID,
    sourceFingerprint,
    toolchainFingerprint: TOOLCHAIN_FINGERPRINT,
    generatedAt: GENERATED_AT,
  };
}

function runConfig(overrides = {}) {
  return {
    ...header("run-config"),
    objective: "Tokenize the complete design system",
    sourceRoots: ["src"],
    sourceKindRegistry: OCCURRENCE_KINDS.map((occurrenceKind) => ({
      occurrenceKind,
      disposition: "scan",
      adapter: `scanner:${occurrenceKind}`,
      rationale: "In-scope source kind",
    })),
    axisRegistry: [
      {
        axis: "spacing",
        tokenTypes: ["dimension"],
        validator: "spacing-validator",
        namingContract: "spacing-contract",
        emitter: "token-emitter",
        completionPredicateIds: ["P1"],
      },
    ],
    matrix: {
      themes: ["light"],
      projects: ["desktop"],
      browsers: ["chromium"],
      locales: ["en"],
      writingModes: ["horizontal-tb"],
    },
    toolchain: TOOLCHAIN,
    adapters: {
      extractor: "extract",
      normalizer: "normalize",
      inventory: "inventory",
      tokenBuild: "build",
      impact: "impact",
      fixture: "fixture",
      evidence: "evidence",
      comparator: "compare",
      reviewer: "review",
    },
    completionPolicy: {
      unapprovedDebtTarget: 0,
      exceptionPolicy: "Owner, reason, scope, evidence, and review required",
      predicateIds: ["P1"],
    },
    ...overrides,
  };
}

const LOCATION = { file: "src/Button.tsx", line: 1, column: 1 };
const CONTEXT = {
  component: "Button",
  nativeTag: "button",
  implicitRole: "button",
  explicitRole: null,
  nearestLandmark: "main",
  routeAreas: ["/"],
  interactionState: "default",
};

function designOccurrence(overrides = {}) {
  return {
    ...header("design-occurrence"),
    occurrenceId: "occ-1",
    occurrenceKind: "utility-class",
    axis: "spacing",
    location: LOCATION,
    sourceLanguage: "tsx",
    rawValue: "p-2",
    property: "padding",
    context: CONTEXT,
    sourcePayload: {
      selectorOrObjectPath: null,
      classExpression: {
        expressionKind: "string-literal",
        resolverKind: "direct",
        branchId: "branch-1",
        conditionExpression: null,
        rawClassName: "p-2",
        rawTokens: ["p-2"],
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
    ...overrides,
  };
}

function normalizedOccurrence(overrides = {}) {
  return {
    ...header("normalized-occurrence"),
    occurrenceId: "normalized-1",
    designOccurrenceId: "occ-1",
    location: LOCATION,
    context: CONTEXT,
    source: {
      expressionKind: "string-literal",
      resolverKind: "direct",
      branchId: "branch-1",
      conditionExpression: null,
      unresolvedDynamicFragments: [],
      branchExpansionTruncated: false,
    },
    rawClassName: "p-2",
    rawTokens: ["p-2"],
    candidates: [
      {
        raw: "p-2",
        variants: [],
        important: false,
        negative: false,
        utilityRoot: "p",
        value: "2",
        modifier: null,
        canonicalCandidate: "p-2",
        status: "valid",
      },
    ],
    fingerprints: {
      rawOrderHash: SOURCE_A,
      canonicalMultisetFingerprint: SOURCE_A,
      canonicalSetFingerprint: SOURCE_A,
      runtimeMergedFingerprint: null,
      compiledCssFingerprint: null,
      computedStyleFingerprints: [],
      semanticContextFingerprint: SOURCE_A,
    },
    normalizerProvenance: {
      normalizerVersion: "1.0.0",
      tailwindVersion: "4.1.11",
      tailwindEntryCssFingerprint: SOURCE_A,
      tailwindConfigFingerprint: SOURCE_A,
      tokenSourceFingerprint: SOURCE_A,
      twMergeVersion: null,
      twMergeConfigFingerprint: null,
    },
    reconciliationStatus: "valid",
    ...overrides,
  };
}

function axisDiscovery(overrides = {}) {
  return {
    ...header("axis-discovery"),
    discoveryId: "axis-1",
    configuredAxes: ["spacing"],
    discoveredAxes: ["spacing"],
    reconciledAxes: ["spacing"],
    uncoveredAxes: [],
    registeredOccurrenceKinds: [...OCCURRENCE_KINDS],
    discoveredOccurrenceKinds: ["utility-class"],
    coveredOccurrenceKinds: ["utility-class"],
    uncoveredOccurrenceKinds: [],
    occurrenceCounts: {
      byAxis: { spacing: 1 },
      byOccurrenceKind: { "utility-class": 1 },
    },
    exhaustive: true,
    ...overrides,
  };
}

function capture(scenarioId = "S1") {
  return {
    scenarioId,
    pngPath: `assets/${scenarioId}.png`,
    bytes: 10,
    width: 100,
    height: 100,
    sha256: SOURCE_A,
    consoleErrors: [],
    pageErrors: [],
    networkFailures: [],
    axeViolationIds: [],
    overflow: false,
  };
}

function writeArtifact(runRoot, relativePath, artifact) {
  const filePath = path.join(runRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(artifact, null, 2)}\n`);
  return {
    filePath,
    record: { artifact, sourcePath: filePath },
    ref: makeArtifactRef(filePath, {
      runRoot,
      artifactType: artifact.artifactType,
    }),
  };
}

function scenario(overrides = {}) {
  return {
    ...header("scenario"),
    scenarioId: "S1",
    route: "/",
    routeParams: {},
    fixtureId: "fixture-1",
    authRole: "anonymous",
    theme: "light",
    project: "desktop",
    browser: "chromium",
    locale: "en",
    writingMode: "horizontal-tb",
    interactionState: "default",
    preconditions: [],
    actions: [],
    assertions: [],
    captureRegion: null,
    expectedVisualEffect: "preserve",
    ...overrides,
  };
}

function schemaFixtures() {
  const fixtures = new Map();
  fixtures.set("run-config", runConfig());
  fixtures.set("run-state", {
    ...header("run-state"),
    currentPhase: "ANCHORED",
    activeBatchId: null,
    journal: [],
    artifacts: [],
  });
  fixtures.set("design-occurrence", designOccurrence());
  fixtures.set("normalized-occurrence", normalizedOccurrence());
  fixtures.set("axis-discovery", axisDiscovery());
  fixtures.set("inventory-report", {
    ...header("inventory-report"),
    reportId: "report-1",
    inventoryKind: "hardcodes",
    inputArtifactRefs: [REF],
    counts: { total: 1 },
    detailArtifactRefs: [],
    reconciled: true,
  });
  fixtures.set("cluster-packet", {
    ...header("cluster-packet"),
    clusterId: "cluster-1",
    occurrenceIds: ["occ-1"],
    contextFingerprint: SOURCE_A,
    styleVariants: [
      {
        styleFingerprint: SOURCE_A,
        rawValues: ["p-2"],
        frequency: 1,
        locations: [LOCATION],
        equivalenceLevel: "EXACT_SET",
      },
    ],
    evidenceRefs: [REF],
    classificationStatus: "classified",
  });
  fixtures.set("decision", {
    ...header("decision"),
    decisionId: "D1",
    clusterIds: ["cluster-1"],
    classification: "component-token",
    status: "approved",
    proposal: {
      name: "button.container.padding",
      axis: "spacing",
      exception: false,
    },
    rationale: "Repeated button padding",
    decidedBy: "llm",
    tradeoff: {
      qualityDelta: "One contract",
      costDelta: "One token",
      breakeven: "Two callsites",
      nonAdoptionCondition: "Unique local style",
      reversibility: "Single batch rollback",
      localPatternFit: ["DTCG"],
    },
    evidenceRefs: [REF],
  });
  fixtures.set("batch-contract", {
    ...header("batch-contract"),
    batchId: "B0001",
    targetClusterIds: ["cluster-1"],
    decisionIds: ["D1"],
    plannedFiles: ["src/Button.tsx"],
    expectedVisualEffect: "preserve",
    expectedChangedScenarioIds: [],
    expectedUnchangedScenarioIds: ["S1"],
    absoluteTargets: { hardcodes: 0 },
    rollbackSourceFingerprint: SOURCE_A,
  });
  fixtures.set("impacted-context", {
    ...header("impacted-context"),
    batchId: "B0001",
    plannedFiles: ["src/Button.tsx"],
    consumerFiles: ["src/Button.tsx"],
    routes: [
      {
        path: "/",
        componentModule: "src/Button.tsx",
        dynamic: false,
        fixtureId: null,
      },
    ],
    scenarioIds: ["S1"],
    fanOutReasons: ["planned-callsite"],
    coverageComplete: true,
    uncoveredConsumers: [],
  });
  fixtures.set("scenario", scenario());
  fixtures.set("evidence-manifest", {
    ...header("evidence-manifest"),
    phase: "before",
    batchId: "B0001",
    routeRegistryFingerprint: SOURCE_A,
    fixtureRegistryFingerprint: SOURCE_A,
    tokenSourceFingerprint: SOURCE_A,
    generatedCssFingerprint: SOURCE_A,
    requestedScenarioIds: ["S1"],
    producedScenarioIds: ["S1"],
    captures: [capture()],
    exactCoverage: true,
  });
  fixtures.set("mutation-manifest", {
    ...header("mutation-manifest", SOURCE_B),
    batchId: "B0001",
    beforeSourceFingerprint: SOURCE_A,
    afterSourceFingerprint: SOURCE_B,
    actualMutationFiles: ["src/Button.tsx"],
    changes: [
      {
        file: "src/Button.tsx",
        changeType: "callsite",
        decisionIds: ["D1"],
      },
    ],
    generatedArtifactRefs: [],
  });
  fixtures.set("deterministic-checks", {
    ...header("deterministic-checks", SOURCE_B),
    scope: "batch",
    batchId: "B0001",
    checks: [
      {
        checkId: "build",
        command: "npm run build",
        exitCode: 0,
        status: "pass",
        executedAt: GENERATED_AT,
        outputSha256: SOURCE_A,
        reentryCode: null,
      },
    ],
    allPassed: true,
  });
  fixtures.set("comparison", {
    ...header("comparison", SOURCE_B),
    batchId: "B0001",
    beforeManifest: REF,
    afterManifest: REF,
    expectedVisualEffect: "preserve",
    pairs: [
      {
        scenarioId: "S1",
        beforeCapture: REF,
        afterCapture: REF,
        status: "identical",
        changedPixels: 0,
        changedPixelRatio: 0,
        diffBounds: null,
        heatmapPath: null,
        errorDelta: {
          console: 0,
          page: 0,
          network: 0,
          axe: 0,
          overflow: 0,
        },
        policyVerdict: "pass",
      },
    ],
    missingPairCount: 0,
    exactCoverage: true,
    verdict: "pass",
  });
  fixtures.set("visual-review", {
    ...header("visual-review", SOURCE_B),
    batchId: "B0001",
    reviewerId: "reviewer",
    requiredReviewScenarioIds: ["S1"],
    entries: [
      {
        scenarioId: "S1",
        verdict: "expected",
        observation: "Pixels are preserved",
        requiredAction: "None",
        evidenceRefs: [REF],
      },
    ],
    complete: true,
    verdict: "pass",
  });
  fixtures.set("adversarial-review", {
    ...header("adversarial-review", SOURCE_B),
    scope: "batch",
    batchId: "B0001",
    round: 1,
    reviewerId: "adversarial-reviewer",
    reviewedArtifactRefs: [REF],
    findings: [],
    verdict: "satisfied",
  });
  fixtures.set("acceptance", {
    ...header("acceptance", SOURCE_B),
    batchId: "B0001",
    actualMutationFiles: ["src/Button.tsx"],
    contractRef: REF,
    mutationRef: {
      ...REF,
      artifactType: "mutation-manifest",
    },
    afterManifestRef: {
      ...REF,
      artifactType: "evidence-manifest",
    },
    checksRef: REF,
    comparisonRef: REF,
    visualReviewRef: REF,
    adversarialReviewRef: REF,
    ledgerEntry: "B0001 accepted",
    preSourceFingerprint: SOURCE_A,
    acceptedSourceFingerprint: SOURCE_B,
    verdict: "accepted",
  });
  fixtures.set("final-proof", {
    ...header("final-proof", SOURCE_B),
    predicates: [
      {
        predicateId: "P1",
        status: "pass",
        observed: 0,
        target: 0,
        evidenceRefs: [REF],
      },
    ],
    residualCounts: {
      unclassifiedOccurrences: 0,
      unreconciledDesignOccurrences: 0,
      unapprovedHardcodes: 0,
      unapprovedNamingViolations: 0,
      missingOrDeadClasses: 0,
      uncoveredAxes: 0,
      uncoveredOccurrenceKinds: 0,
      uncoveredScenarios: 0,
      unreviewedPairs: 0,
    },
    finalMatrixRef: REF,
    finalChecksRef: REF,
    finalAdversarialReviewRef: REF,
    finalSourceFingerprint: SOURCE_B,
    verdict: "done",
  });
  return fixtures;
}

test("Ajv validator compiles and enforces all 19 root artifact schemas", () => {
  const validator = createArtifactValidator({ root: APPLICATION_ROOT });
  const fixtures = schemaFixtures();
  assert.equal(validator.validators.size, 19);
  assert.deepEqual([...fixtures.keys()], [...ARTIFACT_TYPES]);
  for (const [artifactType, artifact] of fixtures) {
    const result = validator.validate(artifact);
    assert.equal(
      result.valid,
      true,
      `${artifactType}: ${JSON.stringify(result.errors)}`
    );
  }
});

test("schema failures return the producer-specific re-entry code", () => {
  const validator = createArtifactValidator({ root: APPLICATION_ROOT });
  const result = validator.validate({
    ...header("normalized-occurrence"),
    occurrenceId: "missing-required-fields",
  });
  assert.equal(result.valid, false);
  assert.equal(result.reentryCode, "E-NORMALIZE");
});

test("source-kind registry detects duplicates that JSON Schema alone cannot", () => {
  const validator = createArtifactValidator({ root: APPLICATION_ROOT });
  const registry = runConfig().sourceKindRegistry;
  const invalid = runConfig({
    sourceKindRegistry: [registry[0], ...registry.slice(0, -1)],
  });
  assert.equal(validator.validate(invalid).valid, true);
  const result = validateArtifactSet({
    records: [invalid],
    runRoot: mkdtempSync(path.join(os.tmpdir(), "artifact-contract-")),
    validator,
    targetPhase: "ANCHORED",
    resolveReferences: false,
  });
  assert.equal(result.valid, false);
  assert.ok(
    result.violations.some(
      (item) =>
        item.invariant === "source-kind-registry" &&
        item.reentryCode === "E-EXTRACT"
    )
  );
});

test("run identity and canonical toolchain freshness are fail-closed", () => {
  const validator = createArtifactValidator({ root: APPLICATION_ROOT });
  const stale = designOccurrence({
    runId: "tokenize-another-run",
    toolchainFingerprint: HASH_C,
  });
  const result = validateArtifactSet({
    records: [runConfig(), stale],
    runRoot: mkdtempSync(path.join(os.tmpdir(), "artifact-contract-")),
    validator,
    targetPhase: "ANCHORED",
    resolveReferences: false,
  });
  assert.equal(result.valid, false);
  assert.ok(
    result.violations.some(
      (item) =>
        item.invariant === "run-identity" && item.reentryCode === "E-EXTRACT"
    )
  );
  assert.ok(
    result.violations.some(
      (item) =>
        item.invariant === "toolchain-freshness" &&
        item.reentryCode === "E-EXTRACT"
    )
  );
});

test("source freshness binds normalized records to the exact design source", () => {
  const validator = createArtifactValidator({ root: APPLICATION_ROOT });
  const staleNormalized = {
    ...normalizedOccurrence(),
    ...header("normalized-occurrence", SOURCE_B),
  };
  const result = validateArtifactSet({
    records: [
      runConfig(),
      designOccurrence(),
      staleNormalized,
      axisDiscovery(),
    ],
    runRoot: mkdtempSync(path.join(os.tmpdir(), "artifact-contract-")),
    validator,
    targetPhase: "NORMALIZED",
    resolveReferences: false,
  });
  assert.equal(result.valid, false);
  assert.ok(
    result.violations.some(
      (item) =>
        item.invariant === "source-freshness" &&
        item.reentryCode === "E-NORMALIZE"
    )
  );
});

test("class projection parity rejects a missing normalized record", () => {
  const validator = createArtifactValidator({ root: APPLICATION_ROOT });
  const result = validateArtifactSet({
    records: [runConfig(), designOccurrence(), axisDiscovery()],
    runRoot: mkdtempSync(path.join(os.tmpdir(), "artifact-contract-")),
    validator,
    targetPhase: "NORMALIZED",
    resolveReferences: false,
  });
  assert.equal(result.valid, false);
  assert.ok(
    result.violations.some(
      (item) =>
        item.invariant === "class-projection-parity" &&
        item.reentryCode === "E-NORMALIZE"
    )
  );
});

test("DONE rejects non-terminal design reconciliation", () => {
  const validator = createArtifactValidator({ root: APPLICATION_ROOT });
  const result = validateArtifactSet({
    records: [
      runConfig(),
      designOccurrence({
        reconciliation: {
          status: "opaque",
          decisionId: null,
          exceptionId: null,
          reason: "Dynamic source",
        },
      }),
      normalizedOccurrence(),
      axisDiscovery(),
    ],
    runRoot: mkdtempSync(path.join(os.tmpdir(), "artifact-contract-")),
    validator,
    targetPhase: "COMPLETE",
    resolveReferences: false,
  });
  assert.equal(result.valid, false);
  assert.ok(
    result.violations.some(
      (item) =>
        item.invariant === "design-reconciliation" &&
        item.reentryCode === "E-CLASSIFY"
    )
  );
});

test("axis discovery must reconcile every discovered axis or report it uncovered", () => {
  const validator = createArtifactValidator({ root: APPLICATION_ROOT });
  const discovery = axisDiscovery({
    discoveredAxes: ["spacing", "color"],
    reconciledAxes: ["spacing"],
    uncoveredAxes: [],
    occurrenceCounts: {
      byAxis: { spacing: 1, color: 1 },
      byOccurrenceKind: { "utility-class": 1 },
    },
  });
  const result = validateArtifactSet({
    records: [runConfig(), designOccurrence(), discovery],
    runRoot: mkdtempSync(path.join(os.tmpdir(), "artifact-contract-")),
    validator,
    targetPhase: "INVENTORIED",
    resolveReferences: false,
  });
  assert.equal(result.valid, false);
  assert.ok(
    result.violations.some(
      (item) =>
        item.invariant === "axis-discovery" && item.reentryCode === "E-EXTRACT"
    )
  );
});

test("reference integrity rejects bytes changed after the ref was created", () => {
  const validator = createArtifactValidator({ root: APPLICATION_ROOT });
  const runRoot = mkdtempSync(path.join(os.tmpdir(), "artifact-contract-"));
  const targetPath = path.join(runRoot, "inventory", "design.ndjson");
  mkdirSync(path.dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, `${JSON.stringify(designOccurrence())}\n`);
  const artifactRef = makeArtifactRef(targetPath, {
    runRoot,
    artifactType: "design-occurrence",
  });
  const report = {
    ...schemaFixtures().get("inventory-report"),
    inputArtifactRefs: [artifactRef],
  };
  writeFileSync(
    targetPath,
    `${JSON.stringify(designOccurrence({ rawValue: "p-3" }))}\n`
  );
  const result = validateArtifactSet({
    records: [runConfig(), report],
    runRoot,
    validator,
    targetPhase: "ANCHORED",
  });
  assert.equal(result.valid, false);
  assert.ok(
    result.violations.some(
      (item) =>
        item.invariant === "reference-integrity" &&
        item.reentryCode === "E-EXTRACT"
    )
  );
});

test("batch scope emits E-IMPACT for an unplanned mutation", () => {
  const validator = createArtifactValidator({ root: APPLICATION_ROOT });
  const fixtures = schemaFixtures();
  const mutation = {
    ...fixtures.get("mutation-manifest"),
    actualMutationFiles: ["src/Unplanned.tsx"],
    changes: [
      {
        file: "src/Unplanned.tsx",
        changeType: "callsite",
        decisionIds: ["D1"],
      },
    ],
  };
  const result = validateArtifactSet({
    records: [
      runConfig(),
      fixtures.get("batch-contract"),
      fixtures.get("impacted-context"),
      mutation,
    ],
    runRoot: mkdtempSync(path.join(os.tmpdir(), "artifact-contract-")),
    validator,
    targetPhase: null,
    resolveReferences: false,
  });
  assert.equal(result.valid, false);
  assert.ok(
    result.violations.some(
      (item) =>
        item.invariant === "batch-scope" && item.reentryCode === "E-IMPACT"
    )
  );
});

test("scenario coverage compares requested, produced, captures, uniqueness, and exactCoverage", () => {
  const validator = createArtifactValidator({ root: APPLICATION_ROOT });
  const manifest = {
    ...schemaFixtures().get("evidence-manifest"),
    requestedScenarioIds: ["S1", "S2"],
    producedScenarioIds: ["S1", "S2"],
    captures: [capture("S1"), capture("S1")],
    exactCoverage: true,
  };
  const result = validateArtifactSet({
    records: [runConfig(), scenario(), manifest],
    runRoot: mkdtempSync(path.join(os.tmpdir(), "artifact-contract-")),
    validator,
    targetPhase: null,
    resolveReferences: false,
  });
  assert.equal(result.valid, false);
  assert.ok(
    result.violations.some(
      (item) =>
        item.invariant === "scenario-coverage" &&
        item.reentryCode === "E-COMPARE"
    )
  );
});

test("pairing and effect policy reject changed pixels in a preserve batch", () => {
  const validator = createArtifactValidator({ root: APPLICATION_ROOT });
  const fixtures = schemaFixtures();
  const before = fixtures.get("evidence-manifest");
  const after = {
    ...before,
    phase: "after",
  };
  const comparison = {
    ...fixtures.get("comparison"),
    ...header("comparison"),
    pairs: [
      {
        ...fixtures.get("comparison").pairs[0],
        status: "changed",
        changedPixels: 1,
        changedPixelRatio: 0.0001,
      },
    ],
  };
  const result = validateArtifactSet({
    records: [
      runConfig(),
      fixtures.get("batch-contract"),
      scenario(),
      before,
      after,
      comparison,
    ],
    runRoot: mkdtempSync(path.join(os.tmpdir(), "artifact-contract-")),
    validator,
    targetPhase: null,
    resolveReferences: false,
  });
  assert.equal(result.valid, false);
  assert.ok(
    result.violations.some(
      (item) =>
        item.invariant === "effect-policy" && item.reentryCode === "E-MIGRATION"
    )
  );
});

test("visual review IDs must exactly equal comparison pair IDs once each", () => {
  const validator = createArtifactValidator({ root: APPLICATION_ROOT });
  const fixtures = schemaFixtures();
  const review = {
    ...fixtures.get("visual-review"),
    entries: [
      fixtures.get("visual-review").entries[0],
      fixtures.get("visual-review").entries[0],
    ],
  };
  const result = validateArtifactSet({
    records: [runConfig(), fixtures.get("comparison"), review],
    runRoot: mkdtempSync(path.join(os.tmpdir(), "artifact-contract-")),
    validator,
    targetPhase: null,
    resolveReferences: false,
  });
  assert.equal(result.valid, false);
  assert.ok(
    result.violations.some(
      (item) =>
        item.invariant === "review-completeness" &&
        item.reentryCode === "E-DECISION"
    )
  );
});

test("acceptance refuses missing or non-passing referenced checks and reviews", () => {
  const validator = createArtifactValidator({ root: APPLICATION_ROOT });
  const result = validateArtifactSet({
    records: [runConfig(), schemaFixtures().get("acceptance")],
    runRoot: mkdtempSync(path.join(os.tmpdir(), "artifact-contract-")),
    validator,
    targetPhase: null,
    resolveReferences: false,
  });
  assert.equal(result.valid, false);
  assert.ok(
    result.violations.some(
      (item) =>
        item.invariant === "acceptance" &&
        ["E-MIGRATION", "E-COMPARE", "E-DECISION"].includes(item.reentryCode)
    )
  );
});

test("a fully referenced passing batch satisfies pairing, effect, review, and acceptance invariants", () => {
  const validator = createArtifactValidator({ root: APPLICATION_ROOT });
  const runRoot = mkdtempSync(path.join(os.tmpdir(), "artifact-contract-"));
  const fixtures = schemaFixtures();
  const configFile = writeArtifact(runRoot, "config.json", runConfig());
  const contractFile = writeArtifact(
    runRoot,
    "batches/B0001/contract.json",
    fixtures.get("batch-contract")
  );
  const beforeFile = writeArtifact(
    runRoot,
    "batches/B0001/before-manifest.json",
    fixtures.get("evidence-manifest")
  );
  const afterFile = writeArtifact(
    runRoot,
    "batches/B0001/after-manifest.json",
    {
      ...fixtures.get("evidence-manifest"),
      ...header("evidence-manifest", SOURCE_B),
      phase: "after",
    }
  );
  const mutationFile = writeArtifact(
    runRoot,
    "batches/B0001/mutation-manifest.json",
    fixtures.get("mutation-manifest")
  );
  const checksFile = writeArtifact(
    runRoot,
    "batches/B0001/deterministic-checks.json",
    fixtures.get("deterministic-checks")
  );
  const comparisonFile = writeArtifact(
    runRoot,
    "batches/B0001/comparison.json",
    {
      ...fixtures.get("comparison"),
      beforeManifest: beforeFile.ref,
      afterManifest: afterFile.ref,
      pairs: [
        {
          ...fixtures.get("comparison").pairs[0],
          beforeCapture: beforeFile.ref,
          afterCapture: afterFile.ref,
        },
      ],
    }
  );
  const visualFile = writeArtifact(
    runRoot,
    "batches/B0001/visual-review.json",
    {
      ...fixtures.get("visual-review"),
      entries: [
        {
          ...fixtures.get("visual-review").entries[0],
          evidenceRefs: [comparisonFile.ref],
        },
      ],
    }
  );
  const adversarialFile = writeArtifact(
    runRoot,
    "batches/B0001/adversarial-review.json",
    {
      ...fixtures.get("adversarial-review"),
      reviewedArtifactRefs: [comparisonFile.ref],
    }
  );
  const acceptanceFile = writeArtifact(
    runRoot,
    "batches/B0001/acceptance.json",
    {
      ...fixtures.get("acceptance"),
      contractRef: contractFile.ref,
      mutationRef: mutationFile.ref,
      afterManifestRef: afterFile.ref,
      checksRef: checksFile.ref,
      comparisonRef: comparisonFile.ref,
      visualReviewRef: visualFile.ref,
      adversarialReviewRef: adversarialFile.ref,
    }
  );
  const result = validateArtifactSet({
    records: [
      configFile.record,
      { artifact: fixtures.get("impacted-context") },
      { artifact: scenario() },
      acceptanceFile.record,
    ],
    runRoot,
    validator,
    targetPhase: null,
  });
  assert.equal(result.valid, true, JSON.stringify(result.violations, null, 2));
});

test("final proof schema forbids done with a failed predicate or residual debt", () => {
  const validator = createArtifactValidator({ root: APPLICATION_ROOT });
  const proof = schemaFixtures().get("final-proof");
  proof.predicates[0].status = "fail";
  proof.residualCounts.uncoveredAxes = 1;
  const result = validator.validate(proof);
  assert.equal(result.valid, false);
  assert.equal(result.reentryCode, "E-EXTRACT");
});

test("a generic P1 policy cannot bypass the closed Section 14 completion contract", () => {
  const validator = createArtifactValidator({ root: APPLICATION_ROOT });
  const fixtures = schemaFixtures();
  const result = validateArtifactSet({
    records: [
      runConfig(),
      designOccurrence(),
      normalizedOccurrence(),
      axisDiscovery(),
      fixtures.get("final-proof"),
    ],
    runRoot: mkdtempSync(path.join(os.tmpdir(), "artifact-contract-")),
    validator,
    targetPhase: "COMPLETE",
    resolveReferences: false,
  });
  assert.equal(result.valid, false);
  assert.ok(
    result.violations.some(
      ({ invariant, message }) =>
        invariant === "final-proof" &&
        /closed 24-predicate Section 14/u.test(message)
    )
  );
});

test("final order binds matrix and checks before review and proof on one source", () => {
  const validator = createArtifactValidator({ root: APPLICATION_ROOT });
  const runRoot = mkdtempSync(path.join(os.tmpdir(), "artifact-contract-"));
  const configFile = writeArtifact(
    runRoot,
    "config.json",
    runConfig({
      axisRegistry: [
        {
          axis: "spacing",
          tokenTypes: ["dimension"],
          validator: "spacing-validator",
          namingContract: "spacing-contract",
          emitter: "token-emitter",
          completionPredicateIds: [...ABSOLUTE_COMPLETION_PREDICATE_IDS],
        },
      ],
      completionPolicy: {
        unapprovedDebtTarget: 0,
        exceptionPolicy: "Owner, reason, scope, evidence, and review required",
        predicateIds: [...ABSOLUTE_COMPLETION_PREDICATE_IDS],
      },
    })
  );
  const finalManifest = writeArtifact(runRoot, "final/matrix.json", {
    ...header("evidence-manifest"),
    generatedAt: "2026-07-30T00:01:00.000Z",
    phase: "final",
    batchId: null,
    routeRegistryFingerprint: SOURCE_A,
    fixtureRegistryFingerprint: SOURCE_A,
    tokenSourceFingerprint: SOURCE_A,
    generatedCssFingerprint: SOURCE_A,
    requestedScenarioIds: ["S1"],
    producedScenarioIds: ["S1"],
    captures: [capture()],
    exactCoverage: true,
  });
  const finalChecks = writeArtifact(runRoot, "final/checks.json", {
    ...header("deterministic-checks"),
    generatedAt: "2026-07-30T00:02:00.000Z",
    scope: "final",
    batchId: null,
    checks: [
      {
        checkId: "absolute",
        command: "npm run absolute-check",
        exitCode: 0,
        status: "pass",
        executedAt: "2026-07-30T00:02:00.000Z",
        outputSha256: SOURCE_A,
        reentryCode: null,
      },
    ],
    allPassed: true,
  });
  const finalReview = writeArtifact(runRoot, "final/adversarial.json", {
    ...header("adversarial-review"),
    generatedAt: "2026-07-30T00:03:00.000Z",
    scope: "final",
    batchId: null,
    round: 1,
    reviewerId: "independent-reviewer",
    reviewedArtifactRefs: [finalManifest.ref, finalChecks.ref],
    findings: [],
    verdict: "satisfied",
  });
  const proof = writeArtifact(runRoot, "final-proof.json", {
    ...header("final-proof"),
    generatedAt: "2026-07-30T00:04:00.000Z",
    predicates: ABSOLUTE_COMPLETION_PREDICATE_IDS.map((predicateId) => ({
      predicateId,
      status: "pass",
      observed: 0,
      target: 0,
      evidenceRefs: [finalChecks.ref],
    })),
    residualCounts: {
      unclassifiedOccurrences: 0,
      unreconciledDesignOccurrences: 0,
      unapprovedHardcodes: 0,
      unapprovedNamingViolations: 0,
      missingOrDeadClasses: 0,
      uncoveredAxes: 0,
      uncoveredOccurrenceKinds: 0,
      uncoveredScenarios: 0,
      unreviewedPairs: 0,
    },
    finalMatrixRef: finalManifest.ref,
    finalChecksRef: finalChecks.ref,
    finalAdversarialReviewRef: finalReview.ref,
    finalSourceFingerprint: SOURCE_A,
    verdict: "done",
  });
  const result = validateArtifactSet({
    records: [
      configFile.record,
      { artifact: designOccurrence() },
      { artifact: normalizedOccurrence() },
      { artifact: axisDiscovery() },
      { artifact: scenario() },
      proof.record,
    ],
    runRoot,
    validator,
    targetPhase: "COMPLETE",
  });
  assert.equal(result.valid, true, JSON.stringify(result.violations, null, 2));
});

test("state machine allows only declared forward and code-specific re-entry transitions", () => {
  assert.deepEqual(
    validateTransition({ from: "ANCHORED", to: "PREFLIGHTED" }),
    []
  );
  assert.equal(
    validateTransition({ from: "ANCHORED", to: "NORMALIZED" })[0].reentryCode,
    "E-EXTRACT"
  );
  assert.deepEqual(
    validateTransition({
      from: "COMPARED",
      to: "BEFORE_CAPTURED",
      reentryCode: "E-MIGRATION",
    }),
    []
  );
  assert.equal(
    validateTransition({
      from: "COMPARED",
      to: "INVENTORIED",
      reentryCode: "E-MIGRATION",
    })[0].reentryCode,
    "E-MIGRATION"
  );
});
