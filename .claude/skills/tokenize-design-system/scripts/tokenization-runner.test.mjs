import assert from "node:assert/strict";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ArtifactContractError,
  OCCURRENCE_KINDS,
  sha256CanonicalJson,
} from "./lib/artifact-contract.mjs";
import { runCli } from "./tokenization-runner.mjs";

const REPOSITORY_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../../.."
);
/*
 * O alvo NAO fica sempre em `<repo>/frontend`. Cravar isso fazia 27 destes
 * testes falharem no repo canonico com "Target package.json not found:
 * <repo>/frontend/package.json" — o repo do processo nao tem `frontend/`.
 *
 * `TOKENIZE_TEST_ROOT` ja e a convencao local: `artifact-contract.test.mjs`
 * Linha 42 e `tailwind-normalizer.test.mjs` Linha 133 ja a usavam. Este arquivo
 * era o unico fora dela.
 */
const APPLICATION_ROOT = process.env.TOKENIZE_TEST_ROOT
  ? path.resolve(process.env.TOKENIZE_TEST_ROOT)
  : path.join(REPOSITORY_ROOT, "frontend");
const SOURCE = "a".repeat(64);
const CONFIGURATION = "b".repeat(64);
const TOOLCHAIN = {
  versions: { node: "24.4.1", ajv: "8.20.0" },
  configurationFingerprints: { tokenization: CONFIGURATION },
};

function config(runId) {
  return {
    schemaVersion: "1.0.0",
    artifactType: "run-config",
    runId,
    sourceFingerprint: SOURCE,
    toolchainFingerprint: sha256CanonicalJson(TOOLCHAIN),
    generatedAt: "2026-07-30T00:00:00.000Z",
    objective: "Exercise durable state recovery",
    sourceRoots: ["src"],
    sourceKindRegistry: OCCURRENCE_KINDS.map((occurrenceKind) => ({
      occurrenceKind,
      disposition: "scan",
      adapter: `scanner:${occurrenceKind}`,
      rationale: "In scope",
    })),
    axisRegistry: [
      {
        axis: "color",
        tokenTypes: ["color"],
        validator: "color-validator",
        namingContract: "color-contract",
        emitter: "token-emitter",
        /*
         * ID REAL do vocabulario fechado do §14, nao um placeholder.
         *
         * Este fixture usava "P1" desde o commit inicial. Quando o schema fechou
         * `absoluteCompletionPredicateId` num enum de 24 IDs, o fixture nao foi
         * junto — e as 7 falhas resultantes ficaram invisiveis porque a suite
         * que eu rodava para reportar "0 fail" (so `test/*.test.mjs` da skill)
         * NAO inclui este arquivo, enquanto o gate commitado
         * `tokens:workflow:test` inclui.
         *
         * A suite que eu escolhia media coisa diferente do gate do repo. Foi a
         * review adversarial que apontou, rodando o gate em vez do meu comando.
         */
        completionPredicateIds: ["inventory.class-projection-reconciled"],
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
      exceptionPolicy: "Explicit evidence required",
      predicateIds: ["P1"],
    },
  };
}

function createRun() {
  const parent = mkdtempSync(path.join(os.tmpdir(), "tokenization-runner-"));
  const runId = "tokenize-runner-test";
  const runRoot = path.join(parent, runId);
  const inputConfig = path.join(parent, "input-config.json");
  writeFileSync(inputConfig, `${JSON.stringify(config(runId), null, 2)}\n`);
  return { parent, runId, runRoot, inputConfig };
}

function initArgs(run) {
  return [
    "init",
    "--root",
    APPLICATION_ROOT,
    "--run-root",
    run.runRoot,
    "--config",
    run.inputConfig,
  ];
}

function inventoryArtifacts(run) {
  const common = {
    schemaVersion: "1.0.0",
    runId: run.runId,
    sourceFingerprint: SOURCE,
    toolchainFingerprint: sha256CanonicalJson(TOOLCHAIN),
    generatedAt: "2026-07-30T00:01:00.000Z",
  };
  const designPath = path.join(
    run.runRoot,
    "inventory",
    "design-occurrences.ndjson"
  );
  const axisPath = path.join(run.runRoot, "inventory", "axis-discovery.json");
  const context = {
    component: "Button",
    nativeTag: "button",
    implicitRole: "button",
    explicitRole: null,
    nearestLandmark: "main",
    routeAreas: ["/"],
    interactionState: "default",
  };
  const design = {
    ...common,
    artifactType: "design-occurrence",
    // Terceira fixture com o mesmo buraco: o refactor de linhagem tornou
    // `recordStage` e `supersedes` obrigatorios no schema e nao atualizou
    // fixture nenhuma. `raw` e a base da cadeia e nao supera ninguem.
    recordStage: "raw",
    supersedes: null,
    occurrenceId: "occ-1",
    occurrenceKind: "utility-class",
    axis: "color",
    location: { file: "src/Button.tsx", line: 1, column: 1 },
    sourceLanguage: "tsx",
    rawValue: "text-primary",
    property: "color",
    context,
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
      status: "discovered",
      decisionId: null,
      exceptionId: null,
      reason: null,
    },
  };
  const axis = {
    ...common,
    artifactType: "axis-discovery",
    discoveryId: "axis-1",
    configuredAxes: ["color"],
    discoveredAxes: ["color"],
    reconciledAxes: ["color"],
    uncoveredAxes: [],
    registeredOccurrenceKinds: [...OCCURRENCE_KINDS],
    discoveredOccurrenceKinds: ["utility-class"],
    coveredOccurrenceKinds: ["utility-class"],
    uncoveredOccurrenceKinds: [],
    occurrenceCounts: {
      byAxis: { color: 1 },
      byOccurrenceKind: { "utility-class": 1 },
    },
    exhaustive: true,
  };
  mkdirSync(path.dirname(designPath), { recursive: true });
  writeFileSync(designPath, `${JSON.stringify(design)}\n`);
  writeFileSync(axisPath, `${JSON.stringify(axis, null, 2)}\n`);
  return { designPath, axisPath };
}

test("init writes a valid atomic snapshot and append-only journal", () => {
  const run = createRun();
  const initialized = runCli(initArgs(run));
  assert.equal(initialized.phase, "ANCHORED");
  const state = JSON.parse(
    readFileSync(path.join(run.runRoot, "state.json"), "utf8")
  );
  const journalLines = readFileSync(
    path.join(run.runRoot, "journal.ndjson"),
    "utf8"
  )
    .trim()
    .split("\n");
  assert.equal(state.currentPhase, "ANCHORED");
  assert.equal(state.journal.length, 1);
  assert.equal(journalLines.length, 1);
  assert.equal(JSON.parse(journalLines[0]).state.currentPhase, "ANCHORED");
  assert.equal(
    runCli(["validate", "--root", APPLICATION_ROOT, "--run-root", run.runRoot])
      .valid,
    true
  );
});

test("init recovers idempotently when only the atomic config survived a crash", () => {
  const run = createRun();
  mkdirSync(run.runRoot, { recursive: true });
  writeFileSync(
    path.join(run.runRoot, "config.json"),
    `${JSON.stringify(config(run.runId), null, 2)}\n`
  );
  const initialized = runCli(initArgs(run));
  assert.equal(initialized.phase, "ANCHORED");
  assert.equal(
    runCli(["validate", "--root", APPLICATION_ROOT, "--run-root", run.runRoot])
      .valid,
    true
  );
});

test("transition refuses phase skipping and leaves the snapshot unchanged", () => {
  const run = createRun();
  runCli(initArgs(run));
  const before = readFileSync(path.join(run.runRoot, "state.json"), "utf8");
  assert.throws(
    () =>
      runCli([
        "transition",
        "--root",
        APPLICATION_ROOT,
        "--run-root",
        run.runRoot,
        "--to",
        "NORMALIZED",
        "--reason",
        "Illegal skip",
      ]),
    (error) =>
      error instanceof ArtifactContractError &&
      error.reentryCode === "E-EXTRACT"
  );
  assert.equal(
    readFileSync(path.join(run.runRoot, "state.json"), "utf8"),
    before
  );
});

test("inventory transition requires and durably registers fresh phase artifacts", () => {
  const run = createRun();
  runCli(initArgs(run));
  runCli([
    "transition",
    "--root",
    APPLICATION_ROOT,
    "--run-root",
    run.runRoot,
    "--to",
    "PREFLIGHTED",
    "--reason",
    "Preflight adapters passed",
  ]);
  const artifacts = inventoryArtifacts(run);
  const result = runCli([
    "transition",
    "--root",
    APPLICATION_ROOT,
    "--run-root",
    run.runRoot,
    "--to",
    "INVENTORIED",
    "--reason",
    "Source-kind and axis census completed",
    "--artifact",
    artifacts.designPath,
    "--artifact",
    artifacts.axisPath,
  ]);
  assert.equal(result.to, "INVENTORIED");
  assert.equal(result.artifactCount, 3);
  assert.equal(
    runCli(["validate", "--root", APPLICATION_ROOT, "--run-root", run.runRoot])
      .phase,
    "INVENTORIED"
  );

  const reentered = runCli([
    "transition",
    "--root",
    APPLICATION_ROOT,
    "--run-root",
    run.runRoot,
    "--to",
    "PREFLIGHTED",
    "--reason",
    "Extractor parity failed",
    "--reentry-code",
    "E-EXTRACT",
  ]);
  assert.equal(reentered.to, "PREFLIGHTED");
  assert.equal(
    runCli(["resume", "--root", APPLICATION_ROOT, "--run-root", run.runRoot])
      .phase,
    "PREFLIGHTED"
  );
});

test("resume repairs an interrupted snapshot from the newest valid journal state", () => {
  const run = createRun();
  runCli(initArgs(run));
  const anchoredBytes = readFileSync(
    path.join(run.runRoot, "state.json"),
    "utf8"
  );
  runCli([
    "transition",
    "--root",
    APPLICATION_ROOT,
    "--run-root",
    run.runRoot,
    "--to",
    "PREFLIGHTED",
    "--reason",
    "Preflight adapters passed",
  ]);
  writeFileSync(path.join(run.runRoot, "state.json"), anchoredBytes);
  const resumed = runCli([
    "resume",
    "--root",
    APPLICATION_ROOT,
    "--run-root",
    run.runRoot,
  ]);
  assert.equal(resumed.repaired, true);
  assert.equal(resumed.phase, "PREFLIGHTED");
  const repaired = JSON.parse(
    readFileSync(path.join(run.runRoot, "state.json"), "utf8")
  );
  assert.equal(repaired.currentPhase, "PREFLIGHTED");
  assert.equal(repaired.journal.length, 2);
  assert.equal(
    readFileSync(path.join(run.runRoot, "journal.ndjson"), "utf8")
      .trim()
      .split("\n").length,
    3,
    "recovery appends a third record without rewriting prior journal bytes"
  );
});

test("resume preserves a torn final journal line and recovers from the last valid record", () => {
  const run = createRun();
  runCli(initArgs(run));
  appendFileSync(
    path.join(run.runRoot, "journal.ndjson"),
    '{"journalVersion":"1.0.0","eventSequence":2'
  );
  writeFileSync(path.join(run.runRoot, "state.json"), "{}\n");
  const resumed = runCli([
    "resume",
    "--root",
    APPLICATION_ROOT,
    "--run-root",
    run.runRoot,
  ]);
  assert.equal(resumed.repaired, true);
  assert.equal(resumed.phase, "ANCHORED");
  assert.equal(resumed.corruptJournalLines.length, 1);
  const journal = readFileSync(
    path.join(run.runRoot, "journal.ndjson"),
    "utf8"
  );
  assert.match(journal, /"operation":"recovery"/);
  assert.match(journal, /"eventSequence":3/);
});

test("status reports the deterministic next phase without mutating the run", () => {
  const run = createRun();
  runCli(initArgs(run));
  const journalBefore = readFileSync(
    path.join(run.runRoot, "journal.ndjson"),
    "utf8"
  );
  const status = runCli([
    "status",
    "--root",
    APPLICATION_ROOT,
    "--run-root",
    run.runRoot,
  ]);
  assert.deepEqual(status.nextForwardPhases, ["PREFLIGHTED"]);
  assert.equal(
    readFileSync(path.join(run.runRoot, "journal.ndjson"), "utf8"),
    journalBefore
  );
});
