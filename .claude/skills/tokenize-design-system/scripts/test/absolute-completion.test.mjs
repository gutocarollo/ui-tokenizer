import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  makeArtifactRef,
  sha256CanonicalJson,
  sha256Bytes,
  sha256File,
} from "../lib/artifact-contract.mjs";
import {
  ABSOLUTE_COMPLETION_PREDICATE_IDS,
  ABSOLUTE_REPORT_PREDICATES,
  absoluteReportId,
} from "../lib/absolute-completion-contract.mjs";
import {
  fingerprintSourceRoots,
  verifyCaptureFile,
} from "../lib/absolute-completion.mjs";
import { runAbsoluteCompletionCli } from "../evaluate-absolute-completion.mjs";
import { varrer } from "../sweep.mjs";

const SKILL_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../.."
);
const REPOSITORY_ROOT = path.resolve(SKILL_ROOT, "../../..");
/*
 * O `node_modules` do ALVO, nao o da skill. As fixtures fazem symlink dele para
 * resolver o compilador do Tailwind e o Ajv a partir do app analisado.
 *
 * Mesmo defeito de portabilidade do `artifact-contract.test.mjs`: assumir um
 * `frontend/` irmao da skill so vale na copia vendorizada. No repo canonico do
 * processo nao existe, e o teste morria. `TOKENIZE_TEST_ROOT` e a convencao
 * local para apontar um alvo real — aqui ela vira o override, com o irmao como
 * default.
 */
const TARGET_NODE_MODULES = process.env.TOKENIZE_TEST_ROOT
  ? path.join(path.resolve(process.env.TOKENIZE_TEST_ROOT), "node_modules")
  : path.join(REPOSITORY_ROOT, "frontend/node_modules");
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

function buildFixture({
  falseGreen = false,
  vacuous = false,
  axisCompletionPredicateIds = ABSOLUTE_COMPLETION_PREDICATE_IDS,
  firstAbsoluteReportId = null,
} = {}) {
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
        namingContract: "entity.variant.anatomy.property",
        emitter: "fixture-emitter",
        completionPredicateIds: [...axisCompletionPredicateIds],
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
    // Linhagem: `raw` e a base da cadeia e nao supera ninguem. Ver a nota em
    // artifact-contract.test.mjs — o refactor de linhagem tornou estes dois
    // campos obrigatorios no schema e nao atualizou fixture nenhuma.
    recordStage: "raw",
    supersedes: null,
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
  const reports = ABSOLUTE_REPORT_PREDICATES.map((contract, index) => ({
    ...header("inventory-report", context, GENERATED.reports),
    reportId:
      index === 0 && firstAbsoluteReportId
        ? firstAbsoluteReportId
        : absoluteReportId(contract.predicateId),
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
        artifactRefs: [designRef, axisRef, reportRef],
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
  // O runner durável recupera sempre do journal append-only; state.json sozinho
  // é snapshot não confiável. A fixture do avaliador não precisava disso, mas
  // o L5 deliberadamente atravessa o runner real.
  const stateBytes = Buffer.from(`${JSON.stringify(state, null, 2)}\n`, "utf8");
  writeFileSync(
    path.join(runRoot, "journal.ndjson"),
    `${JSON.stringify({
      journalVersion: "1.0.0",
      eventSequence: 1,
      operation: "transition",
      recordedAt: GENERATED.reinventory,
      recoveredFromEventSequence: null,
      stateSha256: sha256Bytes(stateBytes),
      state,
    })}\n`
  );

  const pngPath = path.join(runRoot, "final/assets/root.png");
  mkdirSync(path.dirname(pngPath), { recursive: true });
  writeFileSync(pngPath, PNG_BYTES);
  /*
   * O SIDECAR de metadados, obrigatorio desde 2026-08-01. Ele carrega
   * consoleErrors/pageErrors/networkFailures/axeViolationIds/overflow, e sem o
   * `metaSha256` no manifesto esses cinco eram alegacao NAO-FALSIFICAVEL: o
   * contrato re-verifica os bytes do PNG e nao re-verificava nada do sidecar.
   * A fixture escreve o arquivo DE VERDADE e hasheia os bytes reais, porque
   * fixture que inventa hash e a mesma classe de mentira que o campo existe para
   * impedir.
   */
  const metaPath = path.join(runRoot, "final/assets/root.json");
  writeFileSync(
    metaPath,
    JSON.stringify({ consoleErrors: [], pageErrors: [], networkFailures: [], axeViolationIds: [], overflow: false })
  );
  /*
   * CAMINHOS RELATIVOS AO MANIFESTO, não ao run root (corrigido em 2026-08-01).
   * O manifesto vive em `<run>/final/evidence-manifest.json` e o PNG em
   * `<run>/final/assets/root.png`, então o caminho gravado é `assets/root.png`.
   *
   * Esta fixture carregava `final/assets/root.png` — a convenção run-relative,
   * que NENHUM emissor produz: `buildEvidenceManifest` grava com
   * `resolveStoredPath(pngPath, manifestPath)` e `verifyEvidenceManifestFiles`
   * relê com `resolveManifestFile(manifestPath, …)`. Era o consumidor que
   * divergia do produtor, e a fixture sustentava a divergência.
   */
  const capture = {
    scenarioId: scenario.scenarioId,
    pngPath: "assets/root.png",
    bytes: PNG_BYTES.length,
    width: 1,
    height: 1,
    sha256: sha256File(pngPath),
    consoleErrors: [],
    pageErrors: [],
    networkFailures: [],
    axeViolationIds: [],
    overflow: false,
    metaPath: "assets/root.json",
    metaSha256: sha256File(metaPath),
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
    /*
     * Campos que passaram a ser obrigatorios em 2026-08-01, quando o schema do
     * journal absorveu a forma REAL que o emissor produz. `coverage` e o razao
     * do exactCoverage — este ultimo prova so que requested == produced, e
     * `invalidCaptures`/`orphanMetadata` sao fatos do diretorio no instante da
     * coleta que ninguem consegue reconstruir depois.
     */
    coverage: {
      expectedCount: 1, actualCount: 1,
      missing: [], extra: [], duplicateExpected: [], duplicateProduced: [],
      invalidExpected: [], invalidProduced: [], invalidCaptures: [], orphanMetadata: [],
      exact: true,
    },
    matrixFingerprint: sourceFingerprint,
    worktreeFingerprint: sourceFingerprint,
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

test("evaluator rejects a P1 axis completion predicate mutation", () => {
  const fixture = buildFixture({ axisCompletionPredicateIds: ["P1"] });
  const result = runFixture(fixture);
  assert.equal(result.exitCode, 1);
  assert.equal(result.completed, false);
  assert.equal(
    existsSync(path.join(fixture.runRoot, "final-proof.json")),
    false
  );
  const gaps = JSON.parse(readFileSync(result.gapReportPath, "utf8"));
  assert.match(
    gaps.contractViolations.join("\n"),
    /axisRegistry\.color\.completionPredicateIds.*P1/u
  );
});

test("evaluator rejects a P1 absolute report mutation instead of ignoring the extra ID", () => {
  const fixture = buildFixture({ firstAbsoluteReportId: "absolute/P1" });
  const result = runFixture(fixture);
  assert.equal(result.exitCode, 1);
  assert.equal(result.completed, false);
  assert.equal(
    existsSync(path.join(fixture.runRoot, "final-proof.json")),
    false
  );
  const gaps = JSON.parse(readFileSync(result.gapReportPath, "utf8"));
  assert.match(
    gaps.contractViolations.join("\n"),
    /must equal exactly the 14 canonical report-backed predicate IDs/u
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

test("a failed re-evaluation atomically archives a prior proof and leaves no stale canonical proof", () => {
  const fixture = buildFixture();
  const successful = runFixture(fixture);
  assert.equal(successful.exitCode, 0);
  const canonicalProofPath = successful.finalProofPath;
  const proofBytes = readFileSync(canonicalProofPath);
  const archiveDirectory = path.join(
    fixture.runRoot,
    ".final-proof.json.archive"
  );
  const expectedArchivePath = path.join(
    archiveDirectory,
    `${sha256Bytes(proofBytes)}.invalidated`
  );

  writeFileSync(
    fixture.sourcePath,
    'export const Button = () => <button className="text-danger">Changed</button>;\n'
  );
  const failed = runFixture(fixture);
  assert.equal(failed.exitCode, 1);
  assert.equal(failed.completed, false);
  assert.equal(existsSync(canonicalProofPath), false);
  assert.equal(failed.archivedFinalProofPath, expectedArchivePath);
  assert.equal(existsSync(expectedArchivePath), true);
  assert.deepEqual(readFileSync(expectedArchivePath), proofBytes);
  assert.deepEqual(readdirSync(archiveDirectory), [
    `${sha256Bytes(proofBytes)}.invalidated`,
  ]);
  const gaps = JSON.parse(readFileSync(failed.gapReportPath, "utf8"));
  assert.equal(
    gaps.invalidatedFinalProofArchive,
    `.final-proof.json.archive/${sha256Bytes(proofBytes)}.invalidated`
  );

  const repeatedFailure = runFixture(fixture);
  assert.equal(repeatedFailure.exitCode, 1);
  assert.equal(repeatedFailure.archivedFinalProofPath, null);
  assert.equal(existsSync(canonicalProofPath), false);
  assert.deepEqual(readdirSync(archiveDirectory), [
    `${sha256Bytes(proofBytes)}.invalidated`,
  ]);
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

test("a captura resolve pela base do MANIFESTO e continua contida no run root", () => {
  /*
   * Duas propriedades num teste só, porque uma sem a outra é meio conserto.
   *
   * (1) BASE. O manifesto grava `pngPath` relativo A SI MESMO; esta camada
   *     resolvia contra o run root. Medido em 2026-08-01: manifesto em
   *     `<run>/batches/B0001/before/manifest.json` com o PNG ao lado grava
   *     `"s1.png"`, que resolvido contra o run root vira `<run>/s1.png` e não
   *     existe. TODA captura era reportada ausente, e como o gap entra em
   *     `rendered.pairs-integrity`, o predicado nunca podia fechar.
   *
   * (2) CONTENÇÃO. Trocar a base não pode virar porta de saída: um caminho que
   *     escapa da corrida continua recusado. Afrouxar isso seria trocar uma
   *     medida por uma promessa.
   */
  const runRoot = mkdtempSync(path.join(os.tmpdir(), "capture-base-"));
  const dir = path.join(runRoot, "batches", "B0001", "before");
  mkdirSync(dir, { recursive: true });
  const png = path.join(dir, "s1.png");
  writeFileSync(png, PNG_BYTES);
  const manifestPath = path.join(dir, "manifest.json");

  const capture = {
    scenarioId: "settings/default",
    pngPath: "s1.png", // relativo ao MANIFESTO, como o emissor grava
    bytes: PNG_BYTES.length,
    width: 1,
    height: 1,
    sha256: sha256File(png),
    consoleErrors: [],
    pageErrors: [],
    networkFailures: [],
    axeViolationIds: [],
    overflow: false,
  };

  assert.deepEqual(
    verifyCaptureFile(runRoot, capture, manifestPath),
    [],
    "com a base do manifesto o PNG é encontrado e conferido"
  );

  assert.deepEqual(
    verifyCaptureFile(runRoot, capture, null),
    [`Capture PNG is missing: s1.png`],
    "sem a base do manifesto o mesmo arquivo some — é este o defeito que o conserto elimina"
  );

  const fugitiva = { ...capture, pngPath: "../../../../etc/passwd" };
  const gaps = verifyCaptureFile(runRoot, fugitiva, manifestPath);
  assert.equal(gaps.length, 1);
  assert.match(
    gaps[0],
    /escapes the run root/,
    "a contenção no run root sobrevive à troca de base"
  );
});

test("L5: sweep real executa o avaliador, grava proof e faz a transição durável COMPLETE", () => {
  const fixture = buildFixture();
  assert.equal(existsSync(path.join(fixture.runRoot, "final-proof.json")), false);

  const result = varrer(
    { root: fixture.applicationRoot, runRoot: fixture.runRoot },
    {
      // O medidor tem suíte própria; esta fixture isola a fiação que antes era
      // falsa: executor real -> avaliador real -> proof real -> runner real.
      residual: () => ({
        exitCode: 0,
        json: { medidos: 14, detalhe: [], naoMedidos: [], residuoTotal: 0 },
        stderr: "",
      }),
    }
  );

  assert.equal(result.exitCode, 0, JSON.stringify(result, null, 2));
  const proofPath = path.join(fixture.runRoot, "final-proof.json");
  assert.equal(existsSync(proofPath), true);
  assert.equal(JSON.parse(readFileSync(proofPath, "utf8")).verdict, "done");
  assert.equal(
    JSON.parse(readFileSync(path.join(fixture.runRoot, "state.json"), "utf8"))
      .currentPhase,
    "COMPLETE"
  );
});
