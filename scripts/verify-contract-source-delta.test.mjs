import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPT = path.resolve("scripts/verify-contract-source-delta.mjs");

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

test("prova delta de className em TSX com import type", () => {
  const repo = mkdtempSync(path.join(os.tmpdir(), "contract-source-tsx-"));
  const app = path.join(repo, "frontend");
  const source = path.join(app, "src", "Lead.tsx");
  const fixtures = path.join(app, "tests", "visual", "network-fixtures.json");
  mkdirSync(path.dirname(source), { recursive: true });
  mkdirSync(path.dirname(fixtures), { recursive: true });
  writeFileSync(
    fixtures,
    `${JSON.stringify({
      schemaVersion: "1.0.0",
      readOnly: true,
      fixtures: [
        {
          id: "lead-v1",
          contractSources: ["frontend/src/Lead.tsx"],
        },
      ],
    })}\n`
  );
  writeFileSync(
    source,
    'import { type JSX } from "react";\nexport const Lead = (): JSX.Element => <div className="px-[63px]" />;\n'
  );
  git(repo, "init");
  git(repo, "config", "user.email", "test@example.invalid");
  git(repo, "config", "user.name", "Test");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "base");
  const base = git(repo, "rev-parse", "HEAD");
  writeFileSync(
    source,
    'import { type JSX } from "react";\nexport const Lead = (): JSX.Element => <div className="px-[var(--spacing-lead-px)]" />;\n'
  );
  const out = path.join(repo, "proof.json");
  execFileSync(
    process.execPath,
    [
      SCRIPT,
      "--base",
      base,
      "--field-before",
      "a".repeat(64),
      "--field-after",
      "b".repeat(64),
      "--out",
      out,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, TOKENIZE_APP_ROOT: app },
    }
  );
  const proof = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(proof.verdict, "PASS");
  assert.deepEqual(proof.changedContractSources, ["frontend/src/Lead.tsx"]);
  assert.deepEqual(proof.failures, []);
});
