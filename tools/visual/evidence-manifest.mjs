#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import console from "node:console";
import process from "node:process";
import {
  buildEvidenceManifest,
  VisualContractError,
} from "./lib/visual-contract.mjs";

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

function usage() {
  console.error(
    "Usage: node scripts/evidence-manifest.mjs " +
      "--config <manifest-config.json> --capture-dir <dir> --out <manifest.json>"
  );
}

const configPath = valueAfter("--config");
const captureDirectory = valueAfter("--capture-dir");
const outputPath = valueAfter("--out");

if (!configPath || !captureDirectory || !outputPath) {
  usage();
  process.exit(2);
}

try {
  const config = JSON.parse(readFileSync(path.resolve(configPath), "utf8"));
  const manifest = buildEvidenceManifest({
    captureDirectory: path.resolve(captureDirectory),
    manifestPath: path.resolve(outputPath),
    expectedScenarioIds:
      config.expectedScenarioIds ?? config.requestedScenarioIds,
    runId: config.runId,
    batchId: config.batchId ?? null,
    phase: config.phase,
    bindings: config.bindings,
    generatedAt: config.generatedAt,
    requiredMetadataFields: config.requiredMetadataFields,
  });
  mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  writeFileSync(
    path.resolve(outputPath),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  console.log(
    JSON.stringify({
      status: "pass",
      manifest: path.resolve(outputPath),
      captures: manifest.captures.length,
      matrixFingerprint: manifest.matrixFingerprint,
      exactCoverage: manifest.exactCoverage,
    })
  );
} catch (error) {
  const payload =
    error instanceof VisualContractError
      ? {
          status: "fail",
          error: error.message,
          details: error.details,
        }
      : { status: "fail", error: String(error) };
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}
