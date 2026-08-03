import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  captureStem,
  fixtureRegistryBindingFingerprint,
  fingerprintDeclaredPathState,
  materializeContractScenarios,
  matrixScenarioId,
  selectEvidenceMatrix,
} from "./evidence-matrix.mjs";

test("path de CSS declarado e ausente tem fingerprint não-vácuo e muda quando nasce", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "declared-css-state-"));
  const absent = fingerprintDeclaredPathState(root, ["app/styles/generated/theme.css"]);
  assert.match(absent, /^[a-f0-9]{64}$/);
  mkdirSync(path.join(root, "app/styles/generated"), { recursive: true });
  writeFileSync(path.join(root, "app/styles/generated/theme.css"), "@theme {}\n");
  const present = fingerprintDeclaredPathState(root, ["app/styles/generated/theme.css"]);
  assert.notEqual(absent, present);
});

const registry = {
  scenarios: [
    { scenarioId: "login/default", route: "/login" },
    { scenarioId: "settings/default", route: "/settings" },
  ],
};
const matrix = {
  themes: ["light", "dark"],
  projects: ["mobile-sm", "desktop"],
  locales: ["en-US"],
  writingModes: ["ltr"],
  browsers: ["chromium"],
};

test("matrix selection expands every requested dimension exactly", () => {
  const selected = selectEvidenceMatrix({
    registry,
    matrix,
    routePaths: ["/login"],
  });
  assert.equal(selected.scenarios.length, 1);
  assert.equal(selected.expectedScenarioIds.length, 4);
  assert.deepEqual(selected.expectedScenarioIds, [
    "login/default::theme/dark::project/desktop::locale/en-US::writing-mode/ltr",
    "login/default::theme/dark::project/mobile-sm::locale/en-US::writing-mode/ltr",
    "login/default::theme/light::project/desktop::locale/en-US::writing-mode/ltr",
    "login/default::theme/light::project/mobile-sm::locale/en-US::writing-mode/ltr",
  ]);
});

test("matrix selection rejects unknown routes and dimensions", () => {
  assert.throws(
    () =>
      selectEvidenceMatrix({
        registry,
        matrix,
        routePaths: ["/missing"],
      }),
    /absent from the materialized registry/
  );
  assert.throws(
    () =>
      selectEvidenceMatrix({
        registry,
        matrix,
        themes: ["sepia"],
      }),
    /Unknown themes requested/
  );
});

test("scenario durável usa o MESMO ID da matriz de captura", () => {
  const base = {
    scenarioId: "login/default",
    route: "/login",
    routeParams: {},
    fixtureId: "anonymous-static-v1",
    authRole: "anonymous",
    interactionState: "default",
    preconditions: [],
    actions: [{ type: "goto", target: null, value: "/login" }],
    assertions: [{ type: "assert", target: "body", value: "attached" }],
    captureRegion: null,
  };
  const artifacts = materializeContractScenarios({
    scenarios: [base],
    matrix: {
      themes: ["light"],
      projects: ["desktop"],
      browsers: ["chromium"],
      locales: ["en-US"],
      writingModes: ["ltr"],
    },
    batchContract: { expectedVisualEffect: "preserve" },
    header: {
      schemaVersion: "1.0.0",
      runId: "tokenize-test",
      sourceFingerprint: "a".repeat(64),
      toolchainFingerprint: "b".repeat(64),
      generatedAt: "2026-08-03T00:00:00.000Z",
    },
  });
  assert.equal(artifacts.length, 1);
  assert.equal(
    artifacts[0].scenarioId,
    matrixScenarioId({
      scenarioId: base.scenarioId,
      theme: "light",
      project: "desktop",
      locale: "en-US",
      writingMode: "ltr",
    })
  );
  assert.equal(artifacts[0].browser, "chromium");
  assert.equal(artifacts[0].expectedVisualEffect, "preserve");
});

test("matrix IDs and capture stems are stable and collision-resistant", () => {
  const id = matrixScenarioId({
    scenarioId: "workspace/thread/open-menu",
    theme: "dark",
    project: "desktop",
    locale: "en-US",
    writingMode: "ltr",
  });
  assert.match(id, /^workspace\/thread\/open-menu::theme\/dark/);
  assert.equal(captureStem(id), captureStem(id));
  assert.notEqual(captureStem(id), captureStem(`${id}-other`));
  assert.ok(captureStem(id).length < 120);
});

test("fixture binding changes with the network fixture file or selected fixture", () => {
  const contexts = {
    fixtureRegistryFingerprint: "c".repeat(64),
    contexts: [
      {
        pattern: "/settings/model-routers/:id",
        path: "/settings/model-routers/910001",
        fixtureId: "model-router-rules-v1",
        networkFixtureId: "model-router-rules-v1",
        fixtureSource: "versioned-network-read-only",
      },
    ],
  };
  const scenarios = {
    scenarios: [
      {
        scenarioId: "settings_model_router_fixture/default",
        fixtureId: "model-router-rules-v1",
        networkFixtureId: "model-router-rules-v1",
        preconditions: [],
      },
    ],
  };
  const first = fixtureRegistryBindingFingerprint({
    contexts,
    scenarios,
    networkFixtureFileFingerprint: "a".repeat(64),
    contractSourceFingerprint: "c".repeat(64),
  });
  const changedFile = fixtureRegistryBindingFingerprint({
    contexts,
    scenarios,
    networkFixtureFileFingerprint: "b".repeat(64),
    contractSourceFingerprint: "c".repeat(64),
  });
  const changedContractSource = fixtureRegistryBindingFingerprint({
    contexts,
    scenarios,
    networkFixtureFileFingerprint: "a".repeat(64),
    contractSourceFingerprint: "d".repeat(64),
  });
  const changedSelection = fixtureRegistryBindingFingerprint({
    contexts,
    scenarios: {
      scenarios: [
        {
          ...scenarios.scenarios[0],
          networkFixtureId: "different-v1",
        },
      ],
    },
    networkFixtureFileFingerprint: "a".repeat(64),
    contractSourceFingerprint: "c".repeat(64),
  });
  assert.notEqual(first, changedFile);
  assert.notEqual(first, changedContractSource);
  assert.notEqual(first, changedSelection);
});
