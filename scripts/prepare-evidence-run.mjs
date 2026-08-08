#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { resolveAppRoot, resolveRepoRoot } from "./lib/app-roots.mjs";
import { fileURLToPath } from "node:url";
import console from "node:console";
import process from "node:process";

import {
  buildEvidenceBindings,
  loadEvidenceSelection,
} from "./lib/evidence-matrix.mjs";
import { withMaterializedEvidenceRegistry } from "./lib/evidence-registry.mjs";
import { envelopeFrom } from "./lib/artifact-envelope.mjs";
import { readImpactedScenarioIds } from "./lib/impacted-evidence-selection.mjs";
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
      "[--root <app>] [--batch-id B0001] [--batch-contract <batch.json>] " +
      "[--impacted-context <impacted-B0001.json>] " +
      "[--routes /a,/b] [--scenario-ids id/a,id/b] " +
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
const batchContractPath = valueAfter("--batch-contract");
const impactedContextPath = valueAfter("--impacted-context");
const phase = valueAfter("--phase");
const selectionPath = valueAfter("--selection-out");
const manifestConfigPath = valueAfter("--manifest-config-out");

if (!runConfigPath || !phase || !selectionPath || !manifestConfigPath) {
  usage();
  process.exit(2);
}

try {
  const runConfig = JSON.parse(
    readFileSync(path.resolve(runConfigPath), "utf8")
  );
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
  let batchContract = null;
  if (batchContractPath) {
    const absoluteBatch = path.resolve(batchContractPath);
    if (!existsSync(absoluteBatch)) {
      throw new VisualContractError(`Batch contract does not exist: ${absoluteBatch}`);
    }
    batchContract = JSON.parse(readFileSync(absoluteBatch, "utf8"));
    if (batchContract.batchId !== batchId) {
      throw new VisualContractError(
        `Batch contract ${batchContract.batchId ?? "(missing)"} does not match ${batchId}`
      );
    }
  }
  if (phase === "before" && !batchContract) {
    throw new VisualContractError("before evidence requires --batch-contract");
  }
  const explicitScenarioIds = csv("--scenario-ids");
  let effectiveScenarioIds = explicitScenarioIds;
  if (impactedContextPath) {
    if (!batchId) {
      throw new VisualContractError(
        "--impacted-context requires an explicit batchId"
      );
    }
    const impactedScenarioIds = readImpactedScenarioIds({
      impactedContextPath,
      batchId,
      matrix: runConfig.matrix,
    });
    if (
      explicitScenarioIds.length > 0 &&
      JSON.stringify([...explicitScenarioIds].sort()) !==
        JSON.stringify(impactedScenarioIds)
    ) {
      throw new VisualContractError(
        "--scenario-ids diverges from the impacted-context selection"
      );
    }
    effectiveScenarioIds = impactedScenarioIds;
  }

  await withMaterializedEvidenceRegistry({
    frontendRoot: FRONTEND_ROOT,
    stagingRoot: path.dirname(path.resolve(selectionPath)),
    consume: async ({ registryRoot, stagedNetworkFixturePath }) => {
      const envelope = envelopeFrom(path.resolve(runConfigPath), {
        applicationRoot: FRONTEND_ROOT,
      });
      const scenarioPath = path.join(registryRoot, "scenarios.json");
      const contextPath = path.join(registryRoot, "contexts.json");
      const networkFixturePath = path.join(registryRoot, "network-fixtures.json");
      const selection = loadEvidenceSelection({
        frontendRoot: FRONTEND_ROOT,
        scenarioPath,
        matrix: envelope.config.matrix,
        routePaths: csv("--routes"),
        scenarioIds: effectiveScenarioIds,
        themes: csv("--themes"),
        projects: csv("--projects"),
        locales: csv("--locales"),
        writingModes: csv("--writing-modes"),
      });
      /*
       * `assertBase` só nas fases de REFERÊNCIA. Numa captura `before` a fonte
       * tem de ser idêntica à ancorada; after/final medem a mutação.
       */
      const header = envelope.measuredHeader("evidence-manifest", {
        assertBase: phase === "global-before",
      });
      if (
        phase === "before" &&
        header.sourceFingerprint !== batchContract.rollbackSourceFingerprint
      ) {
        throw new VisualContractError(
          `before source diverges from ${batchId} rollback fingerprint`,
          {
            expected: batchContract.rollbackSourceFingerprint,
            actual: header.sourceFingerprint,
          }
        );
      }
      const bindings = buildEvidenceBindings({
        repoRoot: REPO_ROOT,
        frontendRoot: FRONTEND_ROOT,
        header,
        contextPath,
        scenarioPath,
        networkFixturePath,
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
      writeFileSync(
        path.join(path.dirname(path.resolve(selectionPath)), "network-fixture-path"),
        `${stagedNetworkFixturePath}\n`
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
    },
  });
} catch (error) {
  const payload =
    error instanceof VisualContractError
      ? { status: "fail", error: error.message, details: error.details }
      : { status: "fail", error: String(error) };
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}
