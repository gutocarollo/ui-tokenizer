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
      "--run-id <tokenize-id> --phase <global-before|before|after|final> " +
      "--selection-out <selection.json> --manifest-config-out <config.json> " +
      "[--batch-id B0001] [--routes /a,/b] [--scenario-ids id/a,id/b] " +
      "[--themes light,dark] [--projects mobile-sm,desktop] " +
      "[--locales en-US] [--writing-modes ltr]"
  );
}

const runId = valueAfter("--run-id");
const batchId = valueAfter("--batch-id");
const phase = valueAfter("--phase");
const selectionPath = valueAfter("--selection-out");
const manifestConfigPath = valueAfter("--manifest-config-out");

if (!runId || !phase || !selectionPath || !manifestConfigPath) {
  usage();
  process.exit(2);
}

try {
  if (!/^tokenize-[a-zA-Z0-9._-]+$/.test(runId)) {
    throw new VisualContractError("runId must match tokenize-[a-zA-Z0-9._-]+");
  }
  if (!["global-before", "before", "after", "final"].includes(phase)) {
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
  const bindings = buildEvidenceBindings({
    repoRoot: REPO_ROOT,
    frontendRoot: FRONTEND_ROOT,
  });
  const config = {
    runId,
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
