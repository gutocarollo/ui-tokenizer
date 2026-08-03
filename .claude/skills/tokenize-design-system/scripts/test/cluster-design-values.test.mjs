import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SHA = "a".repeat(64);
const header = {
  schemaVersion: "1.0.0",
  artifactType: "design-occurrence",
  runId: "tokenize-cluster-values",
  sourceFingerprint: SHA,
  toolchainFingerprint: "b".repeat(64),
  generatedAt: "2026-08-03T00:00:00.000Z",
};
const occurrence = (id, { property, value, line, status = "discovered" }) => ({
  ...header,
  recordStage: "classified",
  supersedes: {
    occurrenceId: id,
    artifactRef: { artifactType: "design-occurrence", path: "raw.ndjson", sha256: SHA },
    recordSha256: SHA,
  },
  occurrenceId: id,
  occurrenceKind: "inline-style",
  axis: property === "color" ? "color" : property ? "spacing" : "unmapped",
  location: { file: "src/Button.tsx", line, column: 10 },
  sourceLanguage: "tsx",
  rawValue: value,
  property,
  context: {
    component: "Button",
    nativeTag: "button",
    implicitRole: "button",
    explicitRole: null,
    nearestLandmark: null,
    routeAreas: ["/"],
    interactionState: null,
  },
  sourcePayload: { selectorOrObjectPath: "style", classExpression: null, asset: null },
  reconciliation: { status, decisionId: null, exceptionId: null, reason: status === "opaque" ? "compound" : "physical" },
});

test("clusteriza high somente quando owner+property tem contrato atomico univoco", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "cluster-design-values-"));
  const config = path.join(root, "config.json");
  const classified = path.join(root, "classified.ndjson");
  const normalized = path.join(root, "normalized.ndjson");
  writeFileSync(config, JSON.stringify({
    artifactType: "run-config",
    runId: header.runId,
    sourceFingerprint: header.sourceFingerprint,
    toolchainFingerprint: header.toolchainFingerprint,
  }));
  const records = [
    occurrence("space-1", { property: "padding", value: "'8px'", line: 1 }),
    occurrence("space-2", { property: "padding", value: "'8px'", line: 2 }),
    occurrence("color-1", { property: "color", value: "'#fff'", line: 3 }),
    occurrence("color-2", { property: "color", value: "'#000'", line: 4 }),
    occurrence("opaque-1", { property: null, value: "...style", line: 5, status: "opaque" }),
  ];
  writeFileSync(classified, `${records.map(JSON.stringify).join("\n")}\n`);
  writeFileSync(normalized, "");
  const script = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "cluster-design-values.mjs"
  );
  const result = spawnSync(process.execPath, [
    script,
    "--run-config", config,
    "--classified", classified,
    "--normalized", normalized,
    "--out", root,
    "--json",
  ], { encoding: "utf8" });
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.high, 1);
  assert.equal(summary.low, 3);
  const proposals = JSON.parse(readFileSync(path.join(root, "value-proposals.json"), "utf8")).proposals;
  const high = proposals.find((proposal) => proposal.confidence.band === "high");
  assert.equal(high.proposedName, "component.button.padding");
  assert.equal(high.physicalValue, "8px");
  assert.equal(high.occurrenceIds.length, 2);
  assert.ok(
    proposals
      .filter((proposal) => proposal.property === "color")
      .every((proposal) => proposal.confidence.blockers.some((item) => /2 valores/.test(item)))
  );
});
