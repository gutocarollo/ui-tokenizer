import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { readImpactedScenarioIds } from "./impacted-evidence-selection.mjs";

function writeImpact(overrides = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), "impacted-selection-"));
  const file = path.join(root, "impacted.json");
  writeFileSync(
    file,
    JSON.stringify({
      artifactType: "impacted-context",
      batchId: "B0001",
      scenarioIds: [
        "route-b/default::theme/light::project/desktop::locale/en::writing-mode/horizontal-tb",
        "route-a/default::theme/light::project/desktop::locale/en::writing-mode/horizontal-tb",
      ],
      coverageComplete: true,
      uncoveredConsumers: [],
      ...overrides,
    })
  );
  return file;
}

test("seleção impactada devolve IDs únicos e determinísticos", () => {
  assert.deepEqual(
    readImpactedScenarioIds({
      impactedContextPath: writeImpact(),
      batchId: "B0001",
      matrix: {
        themes: ["light"],
        projects: ["desktop"],
        locales: ["en"],
        writingModes: ["horizontal-tb"],
      },
    }),
    ["route-a/default", "route-b/default"]
  );
});

test("seleção impactada recusa lote divergente, cobertura parcial e vazio", () => {
  assert.throws(
    () =>
      readImpactedScenarioIds({
        impactedContextPath: writeImpact({ batchId: "B0002" }),
        batchId: "B0001",
        matrix: { themes: ["light"], projects: ["desktop"], locales: ["en"], writingModes: ["horizontal-tb"] },
      }),
    /does not match/
  );
  assert.throws(
    () =>
      readImpactedScenarioIds({
        impactedContextPath: writeImpact({
          coverageComplete: false,
          uncoveredConsumers: ["/dynamic/:id"],
        }),
        batchId: "B0001",
        matrix: { themes: ["light"], projects: ["desktop"], locales: ["en"], writingModes: ["horizontal-tb"] },
      }),
    /is incomplete/
  );
  assert.throws(
    () =>
      readImpactedScenarioIds({
        impactedContextPath: writeImpact({ scenarioIds: [] }),
        batchId: "B0001",
        matrix: { themes: ["light"], projects: ["desktop"], locales: ["en"], writingModes: ["horizontal-tb"] },
      }),
    /non-empty string array/
  );
});

test("seleção impactada recusa matriz parcial em vez de expandi-la por acidente", () => {
  assert.throws(
    () =>
      readImpactedScenarioIds({
        impactedContextPath: writeImpact({
          scenarioIds: [
            "route-a/default::theme/light::project/desktop::locale/en::writing-mode/horizontal-tb",
          ],
        }),
        batchId: "B0001",
        matrix: {
          themes: ["light", "dark"],
          projects: ["desktop"],
          locales: ["en"],
          writingModes: ["horizontal-tb"],
        },
      }),
    /does not cover the anchored matrix exactly/
  );
});
