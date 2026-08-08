import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { fingerprintProcessPath } from "./process-toolchain.mjs";

test("process toolchain path fingerprint changes with bytes and names", () => {
  const root = mkdtempSync(path.join(tmpdir(), "process-toolchain-"));
  mkdirSync(path.join(root, "scripts"));
  writeFileSync(path.join(root, "scripts", "a.mjs"), "export const a = 1;\n");
  const first = fingerprintProcessPath(root, "scripts");
  writeFileSync(path.join(root, "scripts", "a.mjs"), "export const a = 2;\n");
  const second = fingerprintProcessPath(root, "scripts");
  assert.notEqual(first, second);
  writeFileSync(path.join(root, "scripts", "b.mjs"), "export const b = 1;\n");
  assert.notEqual(second, fingerprintProcessPath(root, "scripts"));
});

test("process toolchain path refuses escapes and symlinks", () => {
  const root = mkdtempSync(path.join(tmpdir(), "process-toolchain-"));
  assert.throws(() => fingerprintProcessPath(root, "../outside"), /escapes/);
});

