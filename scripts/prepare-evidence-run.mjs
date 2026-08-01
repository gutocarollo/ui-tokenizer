#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { resolveAppRoot, resolveRepoRoot } from "./lib/app-roots.mjs";
import { fileURLToPath } from "node:url";
import console from "node:console";
import process from "node:process";

import {
  buildEvidenceBindings,
  loadEvidenceSelection,
} from "./lib/evidence-matrix.mjs";
import { envelopeFrom } from "./lib/artifact-envelope.mjs";
import { VisualContractError } from "./lib/visual-contract.mjs";

const FRONTEND_ROOT = resolveAppRoot(
  path.join(path.dirname(new URL(import.meta.url).pathname), "..")
);
const REPO_ROOT = resolveRepoRoot(FRONTEND_ROOT);

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

function csv(flag) {
  const value = valueAfter(flag);
  return value
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

function usage() {
  console.error(
    "Usage: node scripts/prepare-evidence-run.mjs " +
      "--run-config <run-config.json> --phase <global-before|before|after|final> " +
      "--selection-out <selection.json> --manifest-config-out <config.json> " +
      "[--root <app>] [--batch-id B0001] [--routes /a,/b] [--scenario-ids id/a,id/b] " +
      "[--themes light,dark] [--projects mobile-sm,desktop] " +
      "[--locales en-US] [--writing-modes ltr]"
  );
}

/*
 * `--run-id` SAIU, e a razão é a classe de defeito que este conserto elimina:
 * um identificador de corrida DIGITADO na linha de comando é um segundo lugar
 * onde a verdade mora. Digitado errado, o artefato nasce com um `runId` que não
 * pertence a corrida nenhuma e só é recusado camadas adiante, apontando para o
 * lugar errado. O run-config é a âncora — dele saem `runId`, `sourceFingerprint`
 * e `toolchainFingerprint` de uma vez, sem ninguém redigitar nada.
 */
const runConfigPath = valueAfter("--run-config");
const batchId = valueAfter("--batch-id");
const phase = valueAfter("--phase");
const selectionPath = valueAfter("--selection-out");
const manifestConfigPath = valueAfter("--manifest-config-out");

if (!runConfigPath || !phase || !selectionPath || !manifestConfigPath) {
  usage();
  process.exit(2);
}

try {
  if (!["global-before", "after", "before", "final"].includes(phase)) {
    throw new VisualContractError(`Unsupported evidence phase: ${phase}`);
  }
  if (batchId && !/^B[0-9]{4,}$/.test(batchId)) {
    throw new VisualContractError("batchId must match B[0-9]{4,}");
  }
  if (["before", "after"].includes(phase) && !batchId) {
    throw new VisualContractError(
      `${phase} evidence requires an explicit batchId`
    );
  }

  const selection = loadEvidenceSelection({
    frontendRoot: FRONTEND_ROOT,
    routePaths: csv("--routes"),
    scenarioIds: csv("--scenario-ids"),
    themes: csv("--themes"),
    projects: csv("--projects"),
    locales: csv("--locales"),
    writingModes: csv("--writing-modes"),
  });
  /*
   * `assertBase` só nas fases de REFERÊNCIA. Numa captura `before` a fonte tem
   * de ser idêntica à ancorada — se ela já andou, o par before/after nasce sobre
   * bases diferentes e não compara nada. Nas fases `after`/`final` a divergência
   * é o esperado: é justamente a mutação que se quer medir.
   */
  const envelope = envelopeFrom(path.resolve(runConfigPath), {
    applicationRoot: FRONTEND_ROOT,
  });
  const header = envelope.measuredHeader("evidence-manifest", {
    assertBase: ["global-before", "before"].includes(phase),
  });
  const bindings = buildEvidenceBindings({
    repoRoot: REPO_ROOT,
    frontendRoot: FRONTEND_ROOT,
    header,
  });
  const config = {
    header,
    batchId: batchId ?? null,
    phase,
    expectedScenarioIds: selection.expectedScenarioIds,
    bindings,
  };
  for (const outputPath of [selectionPath, manifestConfigPath]) {
    mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  }
  writeFileSync(
    path.resolve(selectionPath),
    `${JSON.stringify(selection, null, 2)}\n`
  );
  writeFileSync(
    path.resolve(manifestConfigPath),
    `${JSON.stringify(config, null, 2)}\n`
  );
  console.log(
    JSON.stringify({
      status: "pass",
      runId: header.runId,
      sourceFingerprint: header.sourceFingerprint,
      selection: path.resolve(selectionPath),
      manifestConfig: path.resolve(manifestConfigPath),
      scenarios: selection.scenarios.length,
      captures: selection.expectedScenarioIds.length,
      projects: selection.projects,
      themes: selection.themes,
      locales: selection.locales,
      writingModes: selection.writingModes,
    })
  );
} catch (error) {
  const payload =
    error instanceof VisualContractError
      ? { status: "fail", error: error.message, details: error.details }
      : { status: "fail", error: String(error) };
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}
