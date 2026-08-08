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
import { proveFixtureBindingDelta } from "./lib/contract-source-waiver.mjs";
import { fileURLToPath } from "node:url";

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
const runRoot = valueAfter("--run-root");
const applicationRoot = valueAfter("--application-root");
const applyPlanPath = valueAfter("--apply-plan");

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
  let rawPolicy = readJson(policyPath);
  const beforeManifest = readJson(beforePath);
  const afterManifest = readJson(afterPath);
  if (
    beforeManifest.fixtureRegistryFingerprint !==
      afterManifest.fixtureRegistryFingerprint &&
    !(rawPolicy.approvedBindingExceptions ?? []).some(
      (entry) =>
        entry?.field === "fixtureRegistryFingerprint" &&
        entry?.before === beforeManifest.fixtureRegistryFingerprint &&
        entry?.after === afterManifest.fixtureRegistryFingerprint
    )
  ) {
    if (!applicationRoot || !applyPlanPath) {
      throw new VisualContractError(
        "Fixture binding mismatch requires --application-root and --apply-plan"
      );
    }
    const proofPath = path.join(outputDirectory, "contract-source-delta.json");
    const exception = proveFixtureBindingDelta({
      applicationRoot: path.resolve(applicationRoot),
      applyPlan: readJson(applyPlanPath),
      batchPolicy: rawPolicy,
      before: beforeManifest.fixtureRegistryFingerprint,
      after: afterManifest.fixtureRegistryFingerprint,
      proofPath,
      verifierPath: fileURLToPath(
        new URL("./verify-contract-source-delta.mjs", import.meta.url)
      ),
    });
    rawPolicy = {
      ...rawPolicy,
      approvedBindingExceptions: [
        ...(rawPolicy.approvedBindingExceptions ?? []),
        exception,
      ],
    };
  }
  const scenarios = scenariosPath
    ? readFileSync(path.resolve(scenariosPath), "utf8")
        .split(/\r?\n/u)
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : null;
  const policy = scenarios
    ? expandVisualPolicyToScenarioMatrix(rawPolicy, scenarios)
    : rawPolicy;
  const comparison = compareEvidenceManifests({
    beforeManifest,
    beforeManifestPath: path.resolve(beforePath),
    afterManifest,
    afterManifestPath: path.resolve(afterPath),
    policy,
    outputDirectory,
    ...(runRoot ? { artifactReferenceRoot: path.resolve(runRoot) } : {}),
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

  /* COMPARED is immutable and precedes REVIEWED. Validate the separate review
   * against these exact pending-comparison bytes, but never overwrite the
   * comparison with the derived bound verdict: doing so invalidates the
   * fingerprint already emitted in visual-review-input. */
  const bound = reviewOutputPath
    ? bindVisualReview(comparison, readJson(reviewOutputPath))
    : null;
  writeFileSync(absoluteOutputPath, `${JSON.stringify(comparison, null, 2)}\n`);
  const effective = bound ?? comparison;
  console.log(
    JSON.stringify({
      status: effective.verdict,
      comparison: absoluteOutputPath,
      reviewInput: path.resolve(reviewInputPath),
      pairs: comparison.pairs.length,
      deterministicVerdict: comparison.deterministicVerdict,
      visualReviewVerdict: effective.visualReviewVerdict,
    })
  );
  if (effective.verdict === "review") process.exit(3);
  if (effective.verdict !== "pass") process.exit(1);
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
