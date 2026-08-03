import test from "node:test";
import assert from "node:assert/strict";

import { selectBuildCheckScripts } from "./build-check-policy.mjs";

test("BUILT uses the target token compiler and its own strongest build gate", () => {
  assert.deepEqual(
    selectBuildCheckScripts({ scripts: { "tokens:build": "sd build", build: "next build", lint: "eslint" } }),
    ["tokens:build", "build"]
  );
  assert.deepEqual(
    selectBuildCheckScripts({ scripts: { "tokens:build": "sd build", typecheck: "tsc" } }),
    ["tokens:build", "typecheck"]
  );
});

test("BUILT refuses a target without the token compiler proved in preflight", () => {
  assert.throws(() => selectBuildCheckScripts({ scripts: { build: "vite build" } }), /tokens:build/);
});
