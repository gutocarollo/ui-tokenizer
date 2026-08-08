import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { impactedContextArtifact } from "./affected-routes.mjs";
import { createArtifactValidator } from "../.claude/skills/tokenize-design-system/scripts/lib/artifact-contract.mjs";

test("affected-routes emite impacted-context schema-válido com fan-out causal", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "impacted-context-"));
  const configPath = path.join(dir, "config.json");
  const batchPath = path.join(dir, "batch.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      schemaVersion: "1.0.0",
      artifactType: "run-config",
      runId: "tokenize-test",
      sourceFingerprint: "a".repeat(64),
      toolchainFingerprint: "b".repeat(64),
      generatedAt: "2026-08-03T00:00:00.000Z",
      matrix: {
        themes: ["light"],
        projects: ["desktop"],
        browsers: ["chromium"],
        locales: ["en-US"],
        writingModes: ["ltr"],
      },
    })
  );
  writeFileSync(
    batchPath,
    JSON.stringify({
      artifactType: "batch-contract",
      batchId: "B0001",
      plannedFiles: [
        "src/Button.tsx",
        "tokens/color.tokens.json",
        "app/styles/generated/theme.css",
      ],
      expectedVisualEffect: "preserve",
      expectedChangedScenarioIds: [],
      expectedUnchangedScenarioIds: [],
    })
  );
  const result = {
    changedFiles: [{ file: "src/Button.tsx" }],
    concreteRoutes: [{ name: "home", path: "/" }],
    contexts: [
      {
        path: "/",
        routeKind: "static",
        componentModule: "src/Home.tsx",
        componentModules: ["src/Home.tsx", "src/Button.tsx"],
        fixtureId: "home-v1",
      },
    ],
    scenarios: [
      {
        scenarioId: "home/default",
        route: "/",
        routeParams: {},
        fixtureId: "home-v1",
        authRole: "anonymous",
        interactionState: "default",
        preconditions: [],
        actions: [{ type: "goto", target: null, value: "/" }],
        assertions: [{ type: "assert", target: "body", value: "attached" }],
        captureRegion: null,
      },
    ],
    fanOutReasons: ["planned-callsite", "reverse-import"],
    fixtureGaps: [],
    gaps: {},
    coverageComplete: true,
  };
  const artifact = impactedContextArtifact({
    result,
    runConfigPath: configPath,
    batchContractPath: batchPath,
    batchId: "B0001",
    sourceFingerprint: "c".repeat(64),
  });
  assert.deepEqual(artifact.fanOutReasons, ["planned-callsite", "reverse-import"]);
  assert.match(artifact.scenarioIds[0], /::theme\/light::project\/desktop/);
  assert.equal(artifact.sourceFingerprint, "c".repeat(64));
  assert.deepEqual(artifact.plannedFiles, [
    "app/styles/generated/theme.css",
    "src/Button.tsx",
    "tokens/color.tokens.json",
  ]);
  assert.deepEqual(artifact.consumerFiles, [
    "app/styles/generated/theme.css",
    "src/Button.tsx",
    "src/Home.tsx",
    "tokens/color.tokens.json",
  ]);
  const validation = createArtifactValidator({ root: process.cwd() }).validate(artifact);
  assert.deepEqual(validation.errors, []);
  assert.equal(validation.valid, true);
});
