import assert from "node:assert/strict";
import test from "node:test";
import {
  DESIGN_AXES,
  OCCURRENCE_KINDS,
  SOURCE_KIND_REGISTRY,
  axesForCandidate,
  axisForProperty,
  makeAxisDiscovery,
  primaryAxisFor,
} from "../lib/axis-discovery.mjs";

test("source-kind registry is closed, unique, and executable by contract", () => {
  assert.equal(OCCURRENCE_KINDS.length, 19);
  assert.equal(SOURCE_KIND_REGISTRY.length, 19);
  assert.deepEqual(
    new Set(SOURCE_KIND_REGISTRY.map((entry) => entry.occurrenceKind)),
    new Set(OCCURRENCE_KINDS)
  );
  for (const entry of SOURCE_KIND_REGISTRY) {
    assert.equal(entry.disposition, "scan");
    assert.ok(entry.adapter);
    assert.ok(entry.rationale);
  }
});

test("property and utility evidence discover independent axes", () => {
  assert.equal(axisForProperty("backgroundColor"), "color");
  assert.equal(axisForProperty("--card-radius"), "radius");
  assert.equal(axisForProperty("border-radius"), "radius");
  assert.equal(axisForProperty("border-top-left-radius"), "radius");
  assert.equal(axisForProperty("fontSize"), "typography");
  assert.deepEqual(axesForCandidate("md:hover:bg-red-500"), [
    "breakpoint",
    "color",
  ]);
  assert.deepEqual(axesForCandidate("px-2"), ["spacing"]);
  assert.deepEqual(axesForCandidate("text-center"), ["typography"]);
  assert.deepEqual(axesForCandidate("text-ellipsis"), ["typography"]);
  assert.deepEqual(axesForCandidate("rotate-45"), ["motion"]);
  assert.deepEqual(axesForCandidate("drop-shadow-lg"), ["elevation"]);
  assert.deepEqual(axesForCandidate("line-clamp-3"), ["typography"]);
  assert.equal(
    primaryAxisFor({
      occurrenceKind: "utility-class",
      rawValue: "p-2 opacity-50",
    }),
    "spacing"
  );
});

test("failed scanners and unmapped occurrences prevent exhaustive discovery", () => {
  const scannerResults = SOURCE_KIND_REGISTRY.map((entry) => ({
    occurrenceKind: entry.occurrenceKind,
    status: entry.occurrenceKind === "canvas-draw" ? "failed" : "executed",
  }));
  const discovery = makeAxisDiscovery({
    header: {
      schemaVersion: "1.0.0",
      runId: "tokenize-test",
      sourceFingerprint: "a".repeat(64),
      toolchainFingerprint: "b".repeat(64),
      generatedAt: "2026-01-01T00:00:00.000Z",
    },
    discoveryId: "fixture",
    occurrences: [
      {
        occurrenceKind: "utility-class",
        rawValue: "md:px-2 bg-red-500",
        axis: "spacing",
      },
      {
        occurrenceKind: "inline-style",
        rawValue: "unknownValue",
        axis: "unmapped",
      },
    ],
    configuredAxes: DESIGN_AXES,
    scannerResults,
  });
  assert.ok(discovery.uncoveredOccurrenceKinds.includes("canvas-draw"));
  assert.ok(discovery.uncoveredAxes.includes("unmapped"));
  assert.equal(discovery.exhaustive, false);
});
