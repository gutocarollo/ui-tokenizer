#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import console from "node:console";
import process from "node:process";
import {
  bindVisualReview,
  buildVisualReviewInput,
  compareEvidenceManifests,
  expandVisualPolicyToScenarioMatrix,
  VisualContractError,
} from "./lib/visual-contract.mjs";

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(path.resolve(filePath), "utf8"));
}

function usage() {
  console.error(
    "Usage: node scripts/compare-evidence.mjs " +
      "--before <manifest.json> --after <manifest.json> --policy <policy.json> " +
      "--out <comparison.json> --review-input <visual-review-input.json> " +
      "[--review-output <completed-visual-review.json>]"
  );
}

const beforePath = valueAfter("--before");
const afterPath = valueAfter("--after");
const policyPath = valueAfter("--policy");
const outputPath = valueAfter("--out");
const reviewInputPath = valueAfter("--review-input");
const reviewOutputPath = valueAfter("--review-output");
const scenariosPath = valueAfter("--scenarios");

if (
  !beforePath ||
  !afterPath ||
  !policyPath ||
  !outputPath ||
  !reviewInputPath
) {
  usage();
  process.exit(2);
}

try {
  const absoluteOutputPath = path.resolve(outputPath);
  const outputDirectory = path.dirname(absoluteOutputPath);
  mkdirSync(outputDirectory, { recursive: true });
  const rawPolicy = readJson(policyPath);
  const scenarios = scenariosPath
    ? readFileSync(path.resolve(scenariosPath), "utf8")
        .split(/\r?\n/u)
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : null;
  const policy = scenarios
    ? expandVisualPolicyToScenarioMatrix(rawPolicy, scenarios)
    : rawPolicy;
  let comparison = compareEvidenceManifests({
    beforeManifest: readJson(beforePath),
    beforeManifestPath: path.resolve(beforePath),
    afterManifest: readJson(afterPath),
    afterManifestPath: path.resolve(afterPath),
    policy,
    outputDirectory,
  });
  const reviewInput = buildVisualReviewInput(
    comparison,
    path.basename(absoluteOutputPath)
  );
  mkdirSync(path.dirname(path.resolve(reviewInputPath)), { recursive: true });
  writeFileSync(
    path.resolve(reviewInputPath),
    `${JSON.stringify(reviewInput, null, 2)}\n`
  );

  if (reviewOutputPath) {
    comparison = bindVisualReview(comparison, readJson(reviewOutputPath));
  }
  writeFileSync(absoluteOutputPath, `${JSON.stringify(comparison, null, 2)}\n`);
  console.log(
    JSON.stringify({
      status: comparison.verdict,
      comparison: absoluteOutputPath,
      reviewInput: path.resolve(reviewInputPath),
      pairs: comparison.pairs.length,
      deterministicVerdict: comparison.deterministicVerdict,
      visualReviewVerdict: comparison.visualReviewVerdict,
    })
  );
  if (comparison.verdict === "review") process.exit(3);
  if (comparison.verdict !== "pass") process.exit(1);
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
