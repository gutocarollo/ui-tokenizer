import assert from "node:assert/strict";
import test from "node:test";

import {
  CONFIDENCE_THRESHOLD,
  confidenceBlockReason,
  contextClusterConfidence,
  mergeConfidenceEvidence,
} from "../lib/confidence-policy.mjs";

test("cluster só entra na banda alta com múltiplos sinais e zero blocker", () => {
  const high = contextClusterConfidence({
    proposedName: "button-background-color",
    dominantPrimitive: "{primitive.color.green}",
    valueSpread: 1,
    divergentCount: 0,
    stateDivergences: 0,
    sample: { ownerSignal: "high:component", lawGap: null },
  });
  assert.equal(high.band, "high");
  assert.ok(high.score >= CONFIDENCE_THRESHOLD);
  assert.deepEqual(high.blockers, []);

  const low = contextClusterConfidence({
    proposedName: "button-background-color",
    dominantPrimitive: "{primitive.color.green}",
    valueSpread: 2,
    divergentCount: 1,
    stateDivergences: 0,
    sample: { ownerSignal: "high:component", lawGap: null },
  });
  assert.equal(low.band, "low");
  assert.ok(low.blockers.length >= 2);
});

test("fusão usa a mesma forma, o mesmo corte e a mesma banda", () => {
  const result = mergeConfidenceEvidence([
    { name: "cor", weight: 40, score: 1, note: "idêntica" },
    { name: "contrato", weight: 30, score: 1, note: "idêntico" },
    { name: "contexto", weight: 30, score: 0, note: "diverso" },
  ]);
  assert.deepEqual(
    Object.keys(result).sort(),
    ["band", "blockers", "score", "signals", "threshold", "uncertainty"]
  );
  assert.equal(result.score, CONFIDENCE_THRESHOLD);
  assert.equal(result.band, "high");
});

test("freeze só recebe banda alta sem blocker", () => {
  assert.equal(
    confidenceBlockReason({
      score: 70,
      threshold: 70,
      band: "high",
      blockers: [],
    }),
    null
  );
  assert.match(
    confidenceBlockReason({
      score: 95,
      threshold: 70,
      band: "low",
      blockers: ["dois valores defensáveis"],
    }),
    /dois valores defensáveis/
  );
});
