import test from "node:test";
import assert from "node:assert/strict";

import { structuralSignalsFor } from "../lib/structural-signals.mjs";

test("numeric grid column utilities are classified as grid structure", () => {
  assert.deepEqual(structuralSignalsFor("grid-cols-2 gap-4"), ["grid"]);
  assert.deepEqual(structuralSignalsFor("md:grid grid-cols-12"), ["grid"]);
});

test("words that merely resemble the old corrupt pattern are not grids", () => {
  assert.deepEqual(structuralSignalsFor("grid-cols-entry"), []);
});
