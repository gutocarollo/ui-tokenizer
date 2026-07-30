import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import {
  analyzeExactCoverage,
  bindVisualReview,
  buildEvidenceManifest,
  buildVisualReviewInput,
  compareEvidenceManifests,
  comparePngFiles,
  sha256File,
  sha256Value,
  validateVisualReviewOutput,
  verifyEvidenceManifestFiles,
  VISUAL_CONTRACT_VERSION,
  VisualContractError,
} from "./visual-contract.mjs";

function temporaryDirectory(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "visual-contract-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function writePng(filePath, width, height, pixel) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const rgba = pixel(x, y);
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        png.data[offset + channel] = rgba[channel];
      }
    }
  }
  writeFileSync(filePath, PNG.sync.write(png));
}

function writeMeta(filePath, scenarioId) {
  writeFileSync(
    filePath,
    `${JSON.stringify(
      {
        scenarioId,
        consoleErrors: [],
        pageErrors: [],
        networkFailures: [],
        axeViolationIds: [],
        overflow: false,
      },
      null,
      2
    )}\n`
  );
}

function bindings(seed) {
  return {
    sourceFingerprint: sha256Value(`${seed}:source`),
    worktreeFingerprint: sha256Value(`${seed}:worktree`),
    toolchainFingerprint: sha256Value("shared:toolchain"),
    tokenSourceFingerprint: sha256Value(`${seed}:tokens`),
    generatedCssFingerprint: sha256Value(`${seed}:css`),
    routeRegistryFingerprint: sha256Value("shared:routes"),
    fixtureRegistryFingerprint: sha256Value("shared:fixtures"),
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeEvidence({
  root,
  phase,
  pixels,
  scenarioIds = ["route/settings::theme/dark::project/desktop"],
  bindingSeed = phase,
  metadataMutator = null,
}) {
  const captureDirectory = path.join(root, phase);
  const manifestPath = path.join(captureDirectory, "manifest.json");
  writeFileSync(path.join(root, ".keep"), "", { flag: "a" });
  for (const [index, scenarioId] of scenarioIds.entries()) {
    const stem = `capture-${index}`;
    const pngPath = path.join(captureDirectory, `${stem}.png`);
    const metaPath = path.join(captureDirectory, `${stem}.meta.json`);
    if (!existsSync(captureDirectory)) {
      mkdirSync(captureDirectory, { recursive: true });
    }
    writePng(pngPath, 3, 2, (x, y) => pixels(index, x, y));
    writeMeta(metaPath, scenarioId);
    if (metadataMutator) {
      const metadata = JSON.parse(readFileSync(metaPath, "utf8"));
      metadataMutator(metadata, index);
      writeFileSync(metaPath, `${JSON.stringify(metadata, null, 2)}\n`);
    }
  }
  const manifest = buildEvidenceManifest({
    captureDirectory,
    manifestPath,
    expectedScenarioIds: scenarioIds,
    runId: "tokenize-test-run",
    batchId: "B0001",
    phase,
    bindings: bindings(bindingSeed),
    generatedAt: "2026-07-30T00:00:00.000Z",
  });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { captureDirectory, manifestPath, manifest };
}

test("exact coverage reports missing, extra, duplicates, and invalid IDs", () => {
  const result = analyzeExactCoverage({
    expectedIds: ["a", "a", " bad", "missing"],
    producedIds: ["a", "extra", "extra", ""],
    invalidCaptures: ["broken.png"],
    orphanMetadata: ["orphan.meta.json"],
  });
  assert.equal(result.exact, false);
  assert.deepEqual(result.missing, ["missing"]);
  assert.deepEqual(result.extra, ["extra"]);
  assert.deepEqual(result.duplicateExpected, ["a"]);
  assert.deepEqual(result.duplicateProduced, ["extra"]);
  assert.deepEqual(result.invalidExpected, [" bad"]);
  assert.deepEqual(result.invalidProduced, [""]);
  assert.deepEqual(result.invalidCaptures, ["broken.png"]);
  assert.deepEqual(result.orphanMetadata, ["orphan.meta.json"]);
});

test("manifest v2 recomputes full PNG hashes, bytes, dimensions, and all bindings", (t) => {
  const root = temporaryDirectory(t);
  const evidence = makeEvidence({
    root,
    phase: "before",
    pixels: () => [12, 34, 56, 255],
  });
  const capture = evidence.manifest.captures[0];
  assert.equal(evidence.manifest.schemaVersion, VISUAL_CONTRACT_VERSION);
  assert.match(capture.sha256, /^[a-f0-9]{64}$/);
  assert.equal(
    capture.sha256,
    sha256File(path.join(evidence.captureDirectory, "capture-0.png"))
  );
  assert.equal(capture.width, 3);
  assert.equal(capture.height, 2);
  assert.ok(capture.bytes > 0);
  assert.equal(evidence.manifest.exactCoverage, true);
  assert.deepEqual(
    evidence.manifest.requestedScenarioIds,
    evidence.manifest.producedScenarioIds
  );
  for (const value of Object.values(bindings("before"))) {
    assert.match(value, /^[a-f0-9]{64}$/);
  }
});

test("manifest creation is fail-closed for non-exact and duplicate produced IDs", (t) => {
  const root = temporaryDirectory(t);
  const captureDirectory = path.join(root, "captures");
  mkdirSync(captureDirectory, { recursive: true });
  for (const stem of ["one", "two"]) {
    writePng(path.join(captureDirectory, `${stem}.png`), 1, 1, () => [
      0, 0, 0, 255,
    ]);
    writeMeta(path.join(captureDirectory, `${stem}.meta.json`), "same-id");
  }
  assert.throws(
    () =>
      buildEvidenceManifest({
        captureDirectory,
        manifestPath: path.join(captureDirectory, "manifest.json"),
        expectedScenarioIds: ["same-id", "missing-id"],
        runId: "tokenize-test-run",
        batchId: "B0001",
        phase: "before",
        bindings: bindings("before"),
      }),
    (error) => {
      assert.ok(error instanceof VisualContractError);
      assert.deepEqual(error.details.coverage.missing, ["missing-id"]);
      assert.deepEqual(error.details.coverage.duplicateProduced, ["same-id"]);
      return true;
    }
  );
});

test("manifest verification rejects bytes changed after manifest creation", (t) => {
  const root = temporaryDirectory(t);
  const evidence = makeEvidence({
    root,
    phase: "before",
    pixels: () => [10, 20, 30, 255],
  });
  writePng(path.join(evidence.captureDirectory, "capture-0.png"), 3, 2, () => [
    99, 20, 30, 255,
  ]);
  assert.throws(
    () => verifyEvidenceManifestFiles(evidence.manifest, evidence.manifestPath),
    /do not match manifest/
  );
});

test("manifest verification recomputes metadata instead of trusting manifest fields", (t) => {
  const root = temporaryDirectory(t);
  const evidence = makeEvidence({
    root,
    phase: "before",
    pixels: () => [10, 20, 30, 255],
  });
  evidence.manifest.captures[0].consoleErrors = ["forged clean-room value"];
  writeFileSync(
    evidence.manifestPath,
    `${JSON.stringify(evidence.manifest, null, 2)}\n`
  );
  assert.throws(
    () => verifyEvidenceManifestFiles(evidence.manifest, evidence.manifestPath),
    /metadata does not match manifest/
  );
});

test("arbitrary PNG comparison reports exact and perceptual deltas, bounds, max channel, and heatmap", (t) => {
  const root = temporaryDirectory(t);
  const beforePath = path.join(root, "arbitrary-before-name.png");
  const afterPath = path.join(root, "another-name-entirely.png");
  const heatmapPath = path.join(root, "diffs", "heatmap.png");
  writePng(beforePath, 3, 2, () => [10, 20, 30, 255]);
  writePng(afterPath, 3, 2, (x, y) =>
    x === 1 && y === 0 ? [210, 20, 30, 255] : [10, 20, 30, 255]
  );
  const result = comparePngFiles(beforePath, afterPath, { heatmapPath });
  assert.equal(result.status, "changed");
  assert.equal(result.exactChangedPixels, 1);
  assert.equal(result.exactChangedPixelRatio, 1 / 6);
  assert.equal(result.perceptualChangedPixels, 1);
  assert.equal(result.perceptualChangedPixelRatio, 1 / 6);
  assert.equal(result.maxChannelDelta, 200);
  assert.deepEqual(result.diffBounds, { x: 1, y: 0, width: 1, height: 1 });
  assert.equal(result.heatmapPath, heatmapPath);
  assert.equal(existsSync(heatmapPath), true);
  assert.doesNotThrow(() => PNG.sync.read(readFileSync(heatmapPath)));
});

test("dimension changes count out-of-bounds pixels deterministically", (t) => {
  const root = temporaryDirectory(t);
  const beforePath = path.join(root, "before.png");
  const afterPath = path.join(root, "after.png");
  writePng(beforePath, 2, 2, () => [0, 0, 0, 0]);
  writePng(afterPath, 3, 2, () => [0, 0, 0, 0]);
  const result = comparePngFiles(beforePath, afterPath);
  assert.equal(result.exactChangedPixels, 2);
  assert.equal(result.perceptualChangedPixels, 2);
  assert.deepEqual(result.diffBounds, { x: 2, y: 0, width: 1, height: 2 });
});

test("comparison enforces preserve, change, and mixed policies over the exact matrix", (t) => {
  const root = temporaryDirectory(t);
  const ids = ["settings/default", "settings/hover"];
  const before = makeEvidence({
    root,
    phase: "before",
    scenarioIds: ids,
    bindingSeed: "before",
    pixels: () => [10, 20, 30, 255],
  });
  const after = makeEvidence({
    root,
    phase: "after",
    scenarioIds: ids,
    bindingSeed: "after",
    pixels: (index, x, y) =>
      index === 1 && x === 0 && y === 0
        ? [200, 20, 30, 255]
        : [10, 20, 30, 255],
  });
  const common = {
    beforeManifest: before.manifest,
    beforeManifestPath: before.manifestPath,
    afterManifest: after.manifest,
    afterManifestPath: after.manifestPath,
    outputDirectory: path.join(root, "comparison"),
  };
  const preserve = compareEvidenceManifests({
    ...common,
    policy: { expectedVisualEffect: "preserve" },
  });
  assert.equal(preserve.deterministicVerdict, "fail");
  assert.equal(preserve.pairs[1].deterministicPolicyVerdict, "fail");

  const change = compareEvidenceManifests({
    ...common,
    policy: { expectedVisualEffect: "change" },
  });
  assert.equal(change.deterministicVerdict, "fail");
  assert.equal(
    change.pairs[0].policyReasons[0],
    "expected-change-not-observed-by-pixel-count"
  );

  const mixed = compareEvidenceManifests({
    ...common,
    policy: {
      expectedVisualEffect: "mixed",
      expectedChangedScenarioIds: ["settings/hover"],
      expectedUnchangedScenarioIds: ["settings/default"],
    },
  });
  assert.equal(mixed.deterministicVerdict, "pass");
  assert.equal(mixed.verdict, "review");
  assert.equal(
    mixed.pairs.every((pair) => pair.deterministicPolicyVerdict === "pass"),
    true
  );
});

test("comparison rejects route/fixture/toolchain or requested-matrix drift", (t) => {
  const root = temporaryDirectory(t);
  const before = makeEvidence({
    root,
    phase: "before",
    pixels: () => [1, 2, 3, 255],
  });
  const after = makeEvidence({
    root,
    phase: "after",
    pixels: () => [1, 2, 3, 255],
  });
  after.manifest.fixtureRegistryFingerprint = sha256Value("different-fixture");
  writeFileSync(
    after.manifestPath,
    `${JSON.stringify(after.manifest, null, 2)}\n`
  );
  assert.throws(
    () =>
      compareEvidenceManifests({
        beforeManifest: before.manifest,
        beforeManifestPath: before.manifestPath,
        afterManifest: after.manifest,
        afterManifestPath: after.manifestPath,
        policy: { expectedVisualEffect: "preserve" },
        outputDirectory: path.join(root, "comparison"),
      }),
    /exact same matrix/
  );
});

test("new console, page, network, axe, or overflow signals fail an otherwise preserved pair", (t) => {
  const root = temporaryDirectory(t);
  const before = makeEvidence({
    root,
    phase: "before",
    pixels: () => [1, 2, 3, 255],
  });
  const after = makeEvidence({
    root,
    phase: "after",
    pixels: () => [1, 2, 3, 255],
    metadataMutator(metadata) {
      metadata.consoleErrors = ["new console error"];
      metadata.pageErrors = ["new page error"];
      metadata.networkFailures = ["GET /api failed"];
      metadata.axeViolationIds = ["color-contrast"];
      metadata.overflow = true;
    },
  });
  const comparison = compareEvidenceManifests({
    beforeManifest: before.manifest,
    beforeManifestPath: before.manifestPath,
    afterManifest: after.manifest,
    afterManifestPath: after.manifestPath,
    policy: { expectedVisualEffect: "preserve" },
    outputDirectory: path.join(root, "comparison"),
  });
  assert.equal(comparison.deterministicVerdict, "fail");
  assert.equal(comparison.pairs[0].errorDelta.hasRegression, true);
  assert.deepEqual(comparison.pairs[0].errorDelta.added.axe, [
    "color-contrast",
  ]);
});

test("visual review input is non-empty and output is exact, bound, and non-blank", (t) => {
  const root = temporaryDirectory(t);
  const before = makeEvidence({
    root,
    phase: "before",
    pixels: () => [1, 2, 3, 255],
  });
  const after = makeEvidence({
    root,
    phase: "after",
    pixels: () => [1, 2, 3, 255],
  });
  const comparison = compareEvidenceManifests({
    beforeManifest: before.manifest,
    beforeManifestPath: before.manifestPath,
    afterManifest: after.manifest,
    afterManifestPath: after.manifestPath,
    policy: { expectedVisualEffect: "preserve" },
    outputDirectory: path.join(root, "comparison"),
  });
  const repeatedComparison = compareEvidenceManifests({
    beforeManifest: before.manifest,
    beforeManifestPath: before.manifestPath,
    afterManifest: after.manifest,
    afterManifestPath: after.manifestPath,
    policy: { expectedVisualEffect: "preserve" },
    outputDirectory: path.join(root, "comparison"),
  });
  assert.equal(sha256Value(comparison), sha256Value(repeatedComparison));
  const reviewInput = buildVisualReviewInput(comparison, "comparison.json");
  assert.ok(
    reviewInput.instructions.every((instruction) => instruction.length > 0)
  );
  assert.equal(reviewInput.entries.length, 1);
  assert.equal(reviewInput.entries[0].requiredQuestions.length, 2);

  const pair = comparison.pairs[0];
  const review = {
    schemaVersion: VISUAL_CONTRACT_VERSION,
    artifactType: "visual-review",
    runId: comparison.runId,
    batchId: comparison.batchId,
    comparisonFingerprint: sha256Value(comparison),
    reviewerId: "visual-reviewer-test",
    requiredReviewScenarioIds: [...comparison.requiredReviewScenarioIds],
    entries: [
      {
        scenarioId: pair.scenarioId,
        verdict: "expected",
        observation: "The before and after images are pixel-identical.",
        requiredAction: "none",
        evidenceRefs: [pair.beforeCapture, pair.afterCapture],
      },
    ],
    complete: true,
    verdict: "pass",
  };
  assert.equal(
    validateVisualReviewOutput(review, { comparison }).verdict,
    "pass"
  );
  assert.equal(bindVisualReview(comparison, review).verdict, "pass");

  const blank = clone(review);
  blank.entries[0].observation = " ";
  assert.throws(
    () => validateVisualReviewOutput(blank, { comparison }),
    /non-empty/
  );

  const duplicate = clone(review);
  duplicate.entries.push(clone(duplicate.entries[0]));
  assert.throws(
    () => validateVisualReviewOutput(duplicate, { comparison }),
    /exact non-empty comparison matrix/
  );
});

test("compare CLI emits a pending review packet, then deterministically accepts its completed review", (t) => {
  const root = temporaryDirectory(t);
  const before = makeEvidence({
    root,
    phase: "before",
    pixels: () => [1, 2, 3, 255],
  });
  const after = makeEvidence({
    root,
    phase: "after",
    pixels: () => [1, 2, 3, 255],
  });
  const policyPath = path.join(root, "policy.json");
  const comparisonPath = path.join(root, "output", "comparison.json");
  const reviewInputPath = path.join(root, "output", "review-input.json");
  const reviewOutputPath = path.join(root, "output", "review-output.json");
  writeFileSync(
    policyPath,
    `${JSON.stringify({ expectedVisualEffect: "preserve" })}\n`
  );
  const cliPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../compare-evidence.mjs"
  );
  const baseArguments = [
    cliPath,
    "--before",
    before.manifestPath,
    "--after",
    after.manifestPath,
    "--policy",
    policyPath,
    "--out",
    comparisonPath,
    "--review-input",
    reviewInputPath,
  ];
  const pending = spawnSync(process.execPath, baseArguments, {
    encoding: "utf8",
  });
  assert.equal(pending.status, 3, pending.stderr);
  const comparison = JSON.parse(readFileSync(comparisonPath, "utf8"));
  const reviewInput = JSON.parse(readFileSync(reviewInputPath, "utf8"));
  const pair = comparison.pairs[0];
  const review = {
    schemaVersion: VISUAL_CONTRACT_VERSION,
    artifactType: "visual-review",
    runId: comparison.runId,
    batchId: comparison.batchId,
    comparisonFingerprint: reviewInput.comparisonFingerprint,
    reviewerId: "cli-reviewer",
    requiredReviewScenarioIds: comparison.requiredReviewScenarioIds,
    entries: [
      {
        scenarioId: pair.scenarioId,
        verdict: "expected",
        observation: "Both rendered captures are exactly identical.",
        requiredAction: "none",
        evidenceRefs: [pair.beforeCapture, pair.afterCapture],
      },
    ],
    complete: true,
    verdict: "pass",
  };
  writeFileSync(reviewOutputPath, `${JSON.stringify(review, null, 2)}\n`);
  const accepted = spawnSync(
    process.execPath,
    [...baseArguments, "--review-output", reviewOutputPath],
    { encoding: "utf8" }
  );
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(
    JSON.parse(readFileSync(comparisonPath, "utf8")).verdict,
    "pass"
  );
});

test("evidence manifest CLI writes only a full-hash exact-coverage v2 artifact", (t) => {
  const root = temporaryDirectory(t);
  const captureDirectory = path.join(root, "captures");
  mkdirSync(captureDirectory, { recursive: true });
  writePng(path.join(captureDirectory, "arbitrary-name.png"), 2, 3, () => [
    4, 5, 6, 255,
  ]);
  writeMeta(
    path.join(captureDirectory, "arbitrary-name.meta.json"),
    "settings/default"
  );
  const configPath = path.join(root, "manifest-config.json");
  const manifestPath = path.join(root, "manifest.json");
  writeFileSync(
    configPath,
    `${JSON.stringify(
      {
        runId: "tokenize-test-run",
        batchId: "B0001",
        phase: "before",
        expectedScenarioIds: ["settings/default"],
        bindings: bindings("before"),
        generatedAt: "2026-07-30T00:00:00.000Z",
      },
      null,
      2
    )}\n`
  );
  const cliPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../evidence-manifest.mjs"
  );
  const result = spawnSync(
    process.execPath,
    [
      cliPath,
      "--config",
      configPath,
      "--capture-dir",
      captureDirectory,
      "--out",
      manifestPath,
    ],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.schemaVersion, VISUAL_CONTRACT_VERSION);
  assert.equal(manifest.exactCoverage, true);
  assert.equal(manifest.captures[0].width, 2);
  assert.equal(manifest.captures[0].height, 3);
  assert.match(manifest.captures[0].sha256, /^[a-f0-9]{64}$/);
});
