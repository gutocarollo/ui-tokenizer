#!/usr/bin/env node
/**
 * Project adapter for a token build pipeline. It deliberately discovers the
 * package manager and package scripts instead of assuming a repository layout.
 *
 * Usage:
 *   node validate-token-build.mjs --root frontend --check
 *   node validate-token-build.mjs --root frontend --build --check
 *   node validate-token-build.mjs --root frontend --css dist/app.css --class button-label-color
 */
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { resolveRoot } from "./lib/paths.mjs";

const root = resolveRoot();
const args = process.argv.slice(2);
const packagePath = path.join(root, "package.json");
if (!existsSync(packagePath)) throw new Error(`No package.json found under ${root}.`);
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const scripts = packageJson.scripts ?? {};
const packageManager = existsSync(path.join(root, "yarn.lock")) ? "yarn" :
  existsSync(path.join(root, "pnpm-lock.yaml")) ? "pnpm" : "npm";

function runScript(name) {
  if (!scripts[name]) throw new Error(`package.json does not define ${name}. Pass a project adapter or add the script first.`);
  const command = packageManager === "npm" ? ["run", name] : [name];
  execFileSync(packageManager, command, { cwd: root, stdio: "inherit" });
}

if (args.includes("--build")) runScript("tokens:build");
if (args.includes("--check")) runScript("tokens:check");

const cssIndex = args.indexOf("--css");
const classIndex = args.indexOf("--class");
if ((cssIndex >= 0) !== (classIndex >= 0)) {
  throw new Error("--css and --class must be supplied together.");
}
if (cssIndex >= 0) {
  const cssPath = path.resolve(root, args[cssIndex + 1]);
  const className = args[classIndex + 1];
  if (!cssPath || !className || !existsSync(cssPath)) throw new Error("The CSS file and class name must exist.");
  const css = readFileSync(cssPath, "utf8");
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`\\.${escaped}(?:[\\s,{:.])`).test(css)) {
    throw new Error(`The generated CSS does not contain .${className}.`);
  }
  console.log(`Generated CSS contains .${className}.`);
}

if (!args.includes("--build") && !args.includes("--check") && cssIndex < 0) {
  console.log("No action selected. Use --build, --check, or --css with --class.");
}
