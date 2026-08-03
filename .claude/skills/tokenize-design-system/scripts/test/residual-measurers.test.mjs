import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  MEDIDORES_ABSOLUTOS,
  medirResiduosAbsolutos,
} from "../lib/residual-measurers.mjs";

const sha = (letra) => letra.repeat(64);

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "residual-measurers-"));
  const runRoot = path.join(root, "run");
  const artifacts = path.join(runRoot, "artifacts");
  mkdirSync(path.join(root, "src"), { recursive: true });
  mkdirSync(path.join(root, "tokens"), { recursive: true });
  mkdirSync(path.join(root, ".tokenize"), { recursive: true });
  mkdirSync(artifacts, { recursive: true });
  writeFileSync(
    path.join(root, "src", "Button.tsx"),
    'export const Button = () => <button className="bg-button-primary" />;\n'
  );
  writeFileSync(
    path.join(root, "tokens", "color.tokens.json"),
    JSON.stringify({
      color: {
        $type: "color",
        button: { primary: { $value: "#000000" } },
      },
    })
  );
  writeFileSync(
    path.join(root, ".tokenize", "converged.json"),
    JSON.stringify({ clustersFinais: [{ proposedName: "button.background-color", count: 1 }] })
  );

  const records = [
    {
      artifactType: "design-occurrence",
      occurrenceId: "value-1",
      occurrenceKind: "inline-style",
      reconciliation: { status: "approved-token" },
    },
    {
      artifactType: "design-occurrence",
      occurrenceId: "class-1",
      occurrenceKind: "utility-class",
      reconciliation: { status: "approved-contract" },
    },
    {
      artifactType: "normalized-occurrence",
      occurrenceId: "normalized-1",
      designOccurrenceId: "class-1",
      reconciliationStatus: "valid",
      fingerprints: { compiledCssFingerprint: sha("a") },
    },
    {
      artifactType: "batch-contract",
      batchId: "B0001",
      rollbackSourceFingerprint: sha("b"),
      absoluteTargets: { "scaleCardinality:color": 1 },
    },
    {
      artifactType: "mutation-manifest",
      batchId: "B0001",
    },
    {
      artifactType: "acceptance",
      batchId: "B0001",
      verdict: "accepted",
      ledgerEntry: "commit:abc",
      preSourceFingerprint: sha("b"),
      acceptedSourceFingerprint: sha("c"),
    },
    {
      artifactType: "impacted-context",
      batchId: "B0001",
      routes: [{ path: "/", componentModule: "src/Button.tsx", dynamic: false, fixtureId: "home" }],
      uncoveredConsumers: [],
      coverageComplete: true,
    },
    {
      artifactType: "evidence-manifest",
      phase: "after",
      batchId: "B0001",
      requestedScenarioIds: ["home/default"],
      producedScenarioIds: ["home/default"],
      exactCoverage: true,
      captures: [
        {
          scenarioId: "home/default",
          consoleErrors: [],
          pageErrors: [],
          networkFailures: [],
          axeViolationIds: [],
          overflow: false,
        },
      ],
    },
    {
      artifactType: "comparison",
      batchId: "B0001",
      missingPairCount: 0,
      exactCoverage: true,
      deterministicVerdict: "pass",
      pairs: [
        {
          scenarioId: "home/default",
          status: "identical",
          beforeCapture: { path: "before.png" },
          afterCapture: { path: "after.png" },
          beforeDimensions: { width: 10, height: 10 },
          afterDimensions: { width: 10, height: 10 },
          deterministicPolicyVerdict: "pass",
        },
      ],
    },
    {
      artifactType: "visual-review",
      batchId: "B0001",
      complete: true,
      verdict: "pass",
      entries: [{ scenarioId: "home/default", verdict: "expected" }],
    },
  ];
  writeFileSync(
    path.join(artifacts, "all.ndjson"),
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`
  );
  return {
    root,
    runRoot,
    runConfig: { sourceRoots: ["src"], axisRegistry: [{ axis: "color" }] },
  };
}

test("os 14 predicados absolutos têm medidor e uma fixture completa mede todos", () => {
  assert.equal(Object.keys(MEDIDORES_ABSOLUTOS).length, 14);
  const { root, runRoot, runConfig } = fixture();
  const { resultados } = medirResiduosAbsolutos({
    applicationRoot: root,
    runRoot,
    runConfig,
  });
  assert.equal(resultados.size, 14);
  for (const [predicateId, measurement] of resultados) {
    assert.ok(measurement, `${predicateId} ficou não medido`);
    assert.ok(measurement.populacao > 0, `${predicateId} ficou vácuo`);
    assert.equal(measurement.residuo, 0, `${predicateId} reteve resíduo`);
  }
});

test("batch-effects lê deterministicPolicyVerdict — o campo que o emissor grava", () => {
  const { root, runRoot, runConfig } = fixture();
  const file = path.join(runRoot, "artifacts", "all.ndjson");
  const records = readNdjson(file);
  records.find((record) => record.artifactType === "comparison").pairs[0].deterministicPolicyVerdict = "fail";
  writeFileSync(file, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
  const { resultados } = medirResiduosAbsolutos({
    applicationRoot: root,
    runRoot,
    runConfig,
  });
  assert.equal(resultados.get("rendered.batch-effects-satisfied").residuo, 1);
});

test("cardinalidade sem alvo explícito fica não medida, não vira decisão inventada", () => {
  const { root, runRoot, runConfig } = fixture();
  const file = path.join(runRoot, "artifacts", "all.ndjson");
  const records = readNdjson(file);
  delete records.find(
    (record) => record.artifactType === "batch-contract"
  ).absoluteTargets["scaleCardinality:color"];
  writeFileSync(file, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
  const { resultados } = medirResiduosAbsolutos({
    applicationRoot: root,
    runRoot,
    runConfig,
  });
  assert.equal(resultados.get("tokens.scale-cardinalities-approved"), null);
});

function readNdjson(file) {
  return readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}
