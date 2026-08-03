#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { envelopeFrom } from "../../../../scripts/lib/artifact-envelope.mjs";
import { selectBuildCheckScripts } from "../../../../scripts/lib/build-check-policy.mjs";

const argv = process.argv.slice(2);
const arg = (flag) => {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : null;
};
const root = path.resolve(arg("--root") ?? process.cwd());
const runConfigArg = arg("--run-config");
const runRootArg = arg("--run-root");
const outArg = arg("--out");
const runConfigPath = runConfigArg ? path.resolve(runConfigArg) : null;
const runRoot = runRootArg ? path.resolve(runRootArg) : null;
const batchId = arg("--batch");
const out = outArg ? path.resolve(outArg) : null;
if (!runConfigPath || !runRoot || !batchId || !out || !/^B\d{4,}$/u.test(batchId)) {
  throw new Error("Usage: run-build-checks.mjs --root <app> --run-config <config> --run-root <run> --batch B0001 --out <json>");
}
const packagePath = path.join(root, "package.json");
if (!existsSync(packagePath)) throw new Error(`package.json absent under ${root}`);
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const scripts = selectBuildCheckScripts(packageJson);
const packageManager = existsSync(path.join(root, "pnpm-lock.yaml"))
  ? "pnpm"
  : existsSync(path.join(root, "yarn.lock"))
    ? "yarn"
    : "npm";
const checks = [];
for (const script of scripts) {
  const commandArgs = packageManager === "npm" ? ["run", script] : ["run", script];
  const command = `${packageManager} ${commandArgs.join(" ")}`;
  const executedAt = new Date().toISOString();
  const result = spawnSync(packageManager, commandArgs, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    env: process.env,
  });
  const exitCode = result.status === null ? 127 : result.status;
  const output = `${result.stdout ?? ""}\n${result.stderr ?? result.error?.message ?? ""}`;
  checks.push({
    checkId: script.replace(/:/gu, "-"),
    command,
    exitCode,
    status: exitCode === 0 ? "pass" : "fail",
    executedAt,
    outputSha256: createHash("sha256").update(output).digest("hex"),
    reentryCode: exitCode === 0 ? null : "E-MIGRATION",
  });
  if (exitCode !== 0) break;
}
const env = envelopeFrom(runConfigPath, { applicationRoot: root });
const artifact = {
  ...env.measuredHeader("deterministic-checks"),
  scope: "batch",
  batchId,
  checks,
  allPassed: checks.length === scripts.length && checks.every((check) => check.status === "pass"),
};
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({ out, allPassed: artifact.allPassed, checks }, null, 2));
process.exit(artifact.allPassed ? 0 : 1);
