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
import {
  ABSOLUTE_COMPLETION_PREDICATE_IDS,
  ABSOLUTE_REPORT_PREDICATES,
  absoluteReportId,
} from "./absolute-completion-contract.mjs";

const REPOSITORY_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../../../.."
);
/*
 * A raiz da APLICACAO analisada, nao a da skill.
 *
 * A versao anterior era `path.join(REPOSITORY_ROOT, "frontend")` cravado, o que
 * assume que a skill vive DENTRO de um repo que tem um app em `frontend/`. Isso
 * e verdade na copia vendorizada e falso no repo canonico do processo — e o
 * efeito era o canonico nao conseguir rodar 22 dos proprios testes, todos
 * morrendo em `Target package.json not found`.
 *
 * O repo que define o processo nao poder validar o processo e o pior lugar para
 * um teste nao rodar: e exatamente onde a regressao entra sem ser vista.
 *
 * `TOKENIZE_TEST_ROOT` ja e a convencao local — `extract-design-occurrences` e
 * `tailwind-normalizer` a usam para apontar um alvo real. Aqui ela vira o
 * override, com o `frontend/` irmao como default para nao quebrar a copia
 * vendorizada.
 */
const APPLICATION_ROOT = process.env.TOKENIZE_TEST_ROOT
  ? path.resolve(process.env.TOKENIZE_TEST_ROOT)
  : path.join(REPOSITORY_ROOT, "frontend");
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

/**
 * Referência a bytes que NÃO são artefato do contrato — PNG de captura, mapa de
 * calor, manifesto apontado de fora da corrida. Sem `artifactType` de propósito:
 * exigi-lo reprovava todo par de comparação, e um PNG não pertence aos 19 tipos.
 */
const BINARY_REF = {
  path: "captures/s1.png",
  sha256: HASH_C,
};

/** Ref a um ARTEFATO do contrato: leva `artifactType`, senão `referencedTargets`
 *  devolve vazio e a invariante de resolução reprova o artefato correto. */
const MANIFEST_REF = {
  artifactType: "evidence-manifest",
  path: "batches/B0001/before/manifest.json",
  sha256: HASH_C,
};

/** Os 7 fingerprints que a camada de evidência liga a um manifesto. */
const BINDINGS = {
  sourceFingerprint: SOURCE_B,
  worktreeFingerprint: HASH_C,
  toolchainFingerprint: HASH_C,
  tokenSourceFingerprint: HASH_C,
  generatedCssFingerprint: HASH_C,
  routeRegistryFingerprint: HASH_C,
  fixtureRegistryFingerprint: HASH_C,
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
        completionPredicateIds: [ABSOLUTE_COMPLETION_PREDICATE_IDS[0]],
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
    /*
     * A LINHAGEM. O extrator emite um `raw` por ocorrencia; a classificacao
     * emite no maximo um `classified` com o mesmo ID apontando para aquele raw
     * exato. `supersedes: null` e obrigatorio no raw — ele nao supera ninguem,
     * e a base da cadeia.
     *
     * Estes dois campos entraram no schema como REQUIRED, mas a fixture nao foi
     * atualizada junto: o refactor que introduziu a linhagem mexeu no schema, no
     * modulo e nas assinaturas, e deixou call sites e fixtures para tras. Sem
     * eles, 17 testes falhavam contra a propria validacao Ajv.
     */
    recordStage: "raw",
    supersedes: null,
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
    /*
     * O SIDECAR passou a ser obrigatorio em 2026-08-01. `metaSha256` e o campo
     * cuja ausencia transformava consoleErrors/pageErrors/networkFailures/
     * axeViolationIds/overflow em alegacao NAO-FALSIFICAVEL: o contrato
     * re-verifica os bytes do PNG e nao re-verificava nada do arquivo de
     * metadados que carrega esses cinco.
     */
    metaPath: `assets/${scenarioId}.json`,
    metaSha256: SOURCE_A,
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
  /*
     * `coverage` e o razao do exactCoverage. `exactCoverage: true` prova apenas
     * que requested == produced; `coverage` diz QUAIS faltaram, quais sobraram e
     * — o que ninguem consegue reconstruir depois — quais capturas estavam
     * invalidas e quais metadados ficaram orfaos no diretorio no instante da
     * coleta.
     */
    coverage: {
      expectedCount: 1, actualCount: 1,
      missing: [], extra: [], duplicateExpected: [], duplicateProduced: [],
      invalidExpected: [], invalidProduced: [], invalidCaptures: [], orphanMetadata: [],
      exact: true,
    },
    matrixFingerprint: SOURCE_A,
    worktreeFingerprint: SOURCE_A,
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
  /*
   * ESTA FIXTURE ESTAVA DESCOLADA DO EMISSOR, e por isso certificava nada.
   * Medido em 2026-08-01 rodando `compareEvidenceManifests` de verdade e
   * validando a saída: 39 reprovações. O par emitia 17 campos e o schema
   * declarava 10, com 4 nomes trocados (`changedPixels`→`exactChangedPixels`,
   * `changedPixelRatio`→`exactChangedPixelRatio`, `heatmapPath`→`heatmap`,
   * `policyVerdict`→`deterministicPolicyVerdict`) e o `errorDelta` inteiro numa
   * outra forma. A fixture usava os nomes ANTIGOS, então o teste ficava verde
   * enquanto nenhum artefato real passava.
   *
   * Os refs de imagem usam {path, sha256} sem `artifactType`: um PNG não é
   * artefato do contrato, e exigir o campo reprovava todo par.
   */
  fixtures.set("comparison", {
    ...header("comparison", SOURCE_B),
    batchId: "B0001",
    worktreeFingerprint: HASH_C,
    beforeManifest: MANIFEST_REF,
    afterManifest: MANIFEST_REF,
    beforeBindings: BINDINGS,
    afterBindings: BINDINGS,
    matrixFingerprint: HASH_C,
    expectedVisualEffect: "preserve",
    expectedChangedScenarioIds: [],
    expectedUnchangedScenarioIds: ["S1"],
    thresholds: {
      preserveMaxExactChangedPixels: 0,
      preserveMaxExactChangedPixelRatio: 0,
      changeMinExactChangedPixels: 0,
      changeMinExactChangedPixelRatio: 0,
      pixelmatchThreshold: 0.1,
    },
    pairs: [
      {
        scenarioId: "S1",
        expectedVisualEffect: "preserve",
        beforeCapture: BINARY_REF,
        afterCapture: BINARY_REF,
        status: "identical",
        beforeDimensions: { width: 2, height: 2 },
        afterDimensions: { width: 2, height: 2 },
        exactChangedPixels: 0,
        exactChangedPixelRatio: 0,
        perceptualChangedPixels: 0,
        perceptualChangedPixelRatio: 0,
        maxChannelDelta: 0,
        diffBounds: null,
        heatmap: null,
        errorDelta: {
          counts: { console: 0, page: 0, network: 0, axe: 0, overflow: 0 },
          added: { console: [], page: [], network: [], axe: [] },
          overflowIntroduced: false,
          hasRegression: false,
        },
        deterministicPolicyVerdict: "pass",
        policyReasons: [],
      },
    ],
    missingPairCount: 0,
    exactCoverage: true,
    deterministicVerdict: "pass",
    requiredReviewScenarioIds: ["S1"],
    visualReviewVerdict: "pending",
    waivedBindings: [],
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

test("schema rejects P1 mutations in axis bindings and absolute report IDs", () => {
  const validator = createArtifactValidator({ root: APPLICATION_ROOT });
  const config = runConfig();
  config.axisRegistry[0].completionPredicateIds = ["P1"];
  const invalidAxis = validator.validate(config);
  assert.equal(invalidAxis.valid, false);
  assert.equal(invalidAxis.reentryCode, "E-EXTRACT");

  const report = schemaFixtures().get("inventory-report");
  report.reportId = "absolute/P1";
  const invalidReport = validator.validate(report);
  assert.equal(invalidReport.valid, false);
  assert.equal(invalidReport.reentryCode, "E-EXTRACT");
});

test("COMPLETE requires the exact 14 report-backed absolute IDs without duplicates", () => {
  const validator = createArtifactValidator({ root: APPLICATION_ROOT });
  const reports = ABSOLUTE_REPORT_PREDICATES.map((contract) => ({
    ...header("inventory-report"),
    reportId: absoluteReportId(contract.predicateId),
    inventoryKind: contract.inventoryKind,
    inputArtifactRefs: [REF],
    counts: { population: 1, unapprovedResidual: 0 },
    detailArtifactRefs: [],
    reconciled: true,
  }));
  const baseRecords = [
    runConfig(),
    designOccurrence(),
    normalizedOccurrence(),
    axisDiscovery(),
  ];
  const exact = validateArtifactSet({
    records: [...baseRecords, ...reports],
    runRoot: mkdtempSync(path.join(os.tmpdir(), "artifact-contract-")),
    validator,
    targetPhase: "COMPLETE",
    resolveReferences: false,
  });
  assert.equal(
    exact.violations.some(
      ({ invariant }) => invariant === "absolute-completion-registry"
    ),
    false,
    JSON.stringify(exact.violations, null, 2)
  );

  const duplicate = {
    ...reports.at(-1),
    reportId: reports[0].reportId,
    inventoryKind: reports[0].inventoryKind,
  };
  const mutated = validateArtifactSet({
    records: [...baseRecords, ...reports.slice(0, -1), duplicate],
    runRoot: mkdtempSync(path.join(os.tmpdir(), "artifact-contract-")),
    validator,
    targetPhase: "COMPLETE",
    resolveReferences: false,
  });
  assert.ok(
    mutated.violations.some(
      ({ invariant, message }) =>
        invariant === "absolute-completion-registry" &&
        /exactly the 14 canonical/u.test(message)
    ),
    JSON.stringify(mutated.violations, null, 2)
  );
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
        exactChangedPixels: 1,
        exactChangedPixelRatio: 0.0001,
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
          /*
           * A captura do par referencia os BYTES da imagem, e a invariante nova
           * confere o hash contra o que o manifesto registrou para este cenário.
           * A fixture antiga apontava o par para o próprio MANIFESTO — o que
           * passava só porque a checagem de então resolvia `artifactType` e
           * nunca olhava byte nenhum.
           */
          beforeCapture: {
            path: "batches/B0001/before/s1.png",
            sha256: fixtures.get("evidence-manifest").captures[0].sha256,
          },
          afterCapture: {
            path: "batches/B0001/after/s1.png",
            sha256: fixtures.get("evidence-manifest").captures[0].sha256,
          },
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
    /* mesma exigencia da fixture de schema: o razao de cobertura e os dois
       fingerprints entraram como obrigatorios em 2026-08-01 */
    coverage: {
      expectedCount: 1, actualCount: 1,
      missing: [], extra: [], duplicateExpected: [], duplicateProduced: [],
      invalidExpected: [], invalidProduced: [], invalidCaptures: [], orphanMetadata: [],
      exact: true,
    },
    matrixFingerprint: SOURCE_A,
    worktreeFingerprint: SOURCE_A,
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
  const absoluteReports = ABSOLUTE_REPORT_PREDICATES.map((contract, index) =>
    writeArtifact(runRoot, `final/absolute-report-${index}.json`, {
      ...header("inventory-report"),
      reportId: absoluteReportId(contract.predicateId),
      inventoryKind: contract.inventoryKind,
      inputArtifactRefs: [finalChecks.ref],
      counts: { population: 1, unapprovedResidual: 0 },
      detailArtifactRefs: [],
      reconciled: true,
    })
  );
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
      ...absoluteReports.map(({ record }) => record),
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
