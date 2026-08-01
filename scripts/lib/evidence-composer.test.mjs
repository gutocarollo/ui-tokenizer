import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PNG } from "pngjs";

import { composeEvidenceManifests } from "./evidence-composer.mjs";
import {
  buildEvidenceManifest,
  verifyEvidenceManifestFiles,
} from "./visual-contract.mjs";

/**
 * O cabeçalho da corrida, na MESMA semente dos bindings.
 *
 * `buildEvidenceManifest` deixou de receber `runId`/`generatedAt` soltos e passou
 * a exigir um `header` — e a exigir que header e bindings concordem em
 * `sourceFingerprint`/`toolchainFingerprint`. A razão está medida: os dois
 * campos tinham DOIS donos, com valores diferentes sob o mesmo nome, e a
 * divergência desligava em silêncio uma checagem do contrato.
 *
 * Este teste foi o único que pegou a troca de assinatura do compositor — o repo
 * do processo não tinha cobertura de `composeEvidenceManifests` nenhuma.
 */
function header(overrides = {}) {
  return {
    schemaVersion: "1.0.0",
    artifactType: "evidence-manifest",
    runId: "tokenize-composer-test",
    sourceFingerprint: "1".repeat(64),
    toolchainFingerprint: "3".repeat(64),
    generatedAt: "2026-07-30T00:00:00.000Z",
    ...overrides,
  };
}

const bindings = Object.freeze({
  sourceFingerprint: "1".repeat(64),
  worktreeFingerprint: "2".repeat(64),
  toolchainFingerprint: "3".repeat(64),
  tokenSourceFingerprint: "4".repeat(64),
  generatedCssFingerprint: "5".repeat(64),
  routeRegistryFingerprint: "6".repeat(64),
  fixtureRegistryFingerprint: "7".repeat(64),
});

function writeCapture(directory, scenarioId, stem) {
  const png = new PNG({ width: 2, height: 2 });
  png.data.fill(255);
  writeFileSync(path.join(directory, `${stem}.png`), PNG.sync.write(png));
  writeFileSync(
    path.join(directory, `${stem}.meta.json`),
    `${JSON.stringify({
      scenarioId,
      consoleErrors: [],
      pageErrors: [],
      networkFailures: [],
      axeViolationIds: [],
      overflow: false,
    })}\n`
  );
}

function makePart(root, name, scenarioId, overrides = {}) {
  const directory = path.join(root, name);
  mkdirSync(directory);
  writeCapture(directory, scenarioId, name);
  const manifestPath = path.join(directory, "manifest.json");
  const manifest = buildEvidenceManifest({
    captureDirectory: directory,
    manifestPath,
    expectedScenarioIds: [scenarioId],
    header: header({
      ...(overrides.runId ? { runId: overrides.runId } : {}),
      // O header acompanha os bindings: sobrescrever um sem o outro dispara,
      // corretamente, o guard de "a fonte andou entre o prepare e o manifesto".
      ...(overrides.bindings
        ? {
            sourceFingerprint: overrides.bindings.sourceFingerprint,
            toolchainFingerprint: overrides.bindings.toolchainFingerprint,
          }
        : {}),
    }),
    batchId: null,
    phase: "global-before",
    bindings: overrides.bindings ?? bindings,
  });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifestPath;
}

test("composer promotes an exact, self-contained union of verified parts", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "evidence-composer-"));
  try {
    const first = makePart(root, "first", "route/a");
    const second = makePart(root, "second", "route/b");
    const outputDirectory = path.join(root, "aggregate");
    const result = composeEvidenceManifests({
      manifestPaths: [first, second],
      outputDirectory,
      expectedScenarioIds: ["route/a", "route/b"],
      header: header(),
      phase: "global-before",
      bindings,
    });
    assert.equal(result.partCount, 2);
    assert.equal(result.manifest.captures.length, 2);
    assert.equal(result.manifest.exactCoverage, true);
    assert.equal(
      verifyEvidenceManifestFiles(result.manifest, result.manifestPath).length,
      2
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("composer rejects overlap, gaps, and identity drift before promotion", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "evidence-composer-"));
  try {
    const first = makePart(root, "first", "route/a");
    const duplicate = makePart(root, "duplicate", "route/a");
    const drifted = makePart(root, "drifted", "route/b", {
      bindings: { ...bindings, sourceFingerprint: "8".repeat(64) },
    });

    assert.throws(
      () =>
        composeEvidenceManifests({
          manifestPaths: [first, duplicate],
          outputDirectory: path.join(root, "overlap-output"),
          expectedScenarioIds: ["route/a", "route/b"],
          header: header(),
      phase: "global-before",
          bindings,
        }),
      /exact, disjoint full matrix/
    );
    assert.equal(existsSync(path.join(root, "overlap-output")), false);
    assert.throws(
      () =>
        composeEvidenceManifests({
          manifestPaths: [first, drifted],
          outputDirectory: path.join(root, "drift-output"),
          expectedScenarioIds: ["route/a", "route/b"],
          header: header(),
      phase: "global-before",
          bindings,
        }),
      /identity differs/
    );
    assert.equal(existsSync(path.join(root, "drift-output")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
