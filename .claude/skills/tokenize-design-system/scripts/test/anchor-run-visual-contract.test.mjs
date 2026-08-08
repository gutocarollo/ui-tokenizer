import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const SCRIPT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../anchor-run.mjs"
);

function anchor(root) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [SCRIPT, "--root", root, "--source-roots", "src", "--json"],
      { encoding: "utf8" }
    )
  );
}

test("a âncora muda quando o contrato visual versionado do alvo muda", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "anchor-visual-contract-"));
  mkdirSync(path.join(root, "src"), { recursive: true });
  mkdirSync(path.join(root, "tests", "visual"), { recursive: true });
  writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "anchor-fixture", version: "1.0.0" })}\n`
  );
  writeFileSync(path.join(root, "src", "index.ts"), "export const value = 1;\n");
  const fixturePath = path.join(root, "tests", "visual", "evidence-fixtures.json");
  writeFileSync(
    fixturePath,
    `${JSON.stringify({ schemaVersion: "1.0.0", readOnly: true, fixtures: [] })}\n`
  );

  const before = anchor(root);
  writeFileSync(
    fixturePath,
    `${JSON.stringify({
      schemaVersion: "1.0.0",
      readOnly: true,
      semanticReadTransports: {
        "/org": [
          {
            method: "POST",
            path: "/api/v1/org-chart/data",
            contractSources: ["server/org.ts"],
          },
        ],
      },
      fixtures: [],
    })}\n`
  );
  const after = anchor(root);

  const key = "file:tests/visual/evidence-fixtures.json";
  assert.notEqual(
    before.toolchain.configurationFingerprints[key],
    after.toolchain.configurationFingerprints[key]
  );
  assert.notEqual(before.toolchainFingerprint, after.toolchainFingerprint);
  assert.equal(before.sourceFingerprint, after.sourceFingerprint);
});

test("a âncora recusa sobrescrever um run-config durável", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "anchor-no-overwrite-"));
  mkdirSync(path.join(root, "src"), { recursive: true });
  writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "anchor-fixture", version: "1.0.0" })}\n`
  );
  writeFileSync(path.join(root, "src", "index.ts"), "export const value = 1;\n");
  const out = path.join(root, "run", "config.json");
  execFileSync(
    process.execPath,
    [SCRIPT, "--root", root, "--source-roots", "src", "--out", out],
    { encoding: "utf8" }
  );
  const bytes = readFileSync(out);
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [SCRIPT, "--root", root, "--source-roots", "src", "--out", out],
        { encoding: "utf8", stdio: "pipe" }
      ),
    (error) => {
      assert.equal(error.status, 1);
      assert.match(String(error.stderr), /saída imutável já existe/);
      return true;
    }
  );
  assert.deepEqual(readFileSync(out), bytes);
});
