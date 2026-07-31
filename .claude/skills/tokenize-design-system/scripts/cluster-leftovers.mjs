#!/usr/bin/env node
/**
 * Groups uses whose token name has no owner and whose rendered context cannot
 * determine one. A cluster is a decision candidate, never an automatic rename.
 *
 * Usage:
 *   node cluster-leftovers.mjs --root frontend
 *   node cluster-leftovers.mjs --root frontend --all --by-token
 *   node cluster-leftovers.mjs --root frontend --by-token --json
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readVocabulary, parseName, PREFIX_PROPERTY } from "./score-naming.mjs";
import { prefixAlternation } from "./lib/utility-families.mjs";
import { findUseOwner } from "./find-owner.mjs";
import { resolveRoot } from "./lib/paths.mjs";
import { loadColourNames, resolveProjectLayout } from "./lib/project-layout.mjs";
import { structuralSignalsFor } from "./lib/structural-signals.mjs";

const root = resolveRoot();
const project = resolveProjectLayout(root);
const vocabulary = readVocabulary();
const structuralDirectories = new Set([
  "src", "pages", "components", "ui", "lib", "hooks", "utils", "models",
  "styles", "assets", "shared", "common", "index", "app", "views",
]);
// longest-first: unsorted, `rounded` consumes `rounded-t` and `p` consumes `px`.
const utilityPrefix = prefixAlternation();
const utilityPattern = new RegExp(
  `(?<![\\w-])((?:[a-z-]+:)*)(${utilityPrefix})-([a-z][a-z0-9-]*)(?![\\w-])`,
  "g"
);

function* files(directory) {
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) yield* files(absolute);
    else if (/\.(jsx?|tsx?)$/.test(entry)) yield absolute;
  }
}

function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function renderedContext(source, offset) {
  const before = source.slice(Math.max(0, offset - 700), offset);
  const openingOffset = before.lastIndexOf("<");
  if (openingOffset < 0) return { tag: "?", role: "", type: "" };
  const opening = before.slice(openingOffset);
  return {
    tag: (opening.match(/^<([A-Za-z][\w.]*)/) ?? [])[1] ?? "?",
    role: (opening.match(/role=["']([a-z]+)["']/) ?? [])[1] ?? "",
    type: (opening.match(/type=["']([a-z]+)["']/) ?? [])[1] ?? "",
  };
}

function componentName(file) {
  const sourceRoot = project.sourceRoots.find((candidate) => file.startsWith(candidate + path.sep)) ?? root;
  const parts = path.relative(sourceRoot, file).split(path.sep);
  const basename = parts.pop().replace(/\.(jsx?|tsx?)$/, "");
  if (!structuralDirectories.has(basename.toLowerCase())) return basename;
  for (let index = parts.length - 1; index >= 0; index--) {
    if (!structuralDirectories.has(parts[index].toLowerCase())) return parts[index];
  }
  return basename;
}

async function loadKnownTokens() {
  return loadColourNames(project);
}

const knownTokens = await loadKnownTokens();
const byFile = new Map();
let scannedWithoutOwner = 0;
let resolvedByContext = 0;

for (const sourceRoot of project.sourceRoots) for (const file of files(sourceRoot)) {
  const source = withoutComments(readFileSync(file, "utf8"));
  for (const match of source.matchAll(utilityPattern)) {
    const [, statePrefix, prefix, token] = match;
    if (knownTokens.size && !knownTokens.has(token)) continue;
    if (parseName(token, vocabulary).owner) continue;
    scannedWithoutOwner++;
    const context = renderedContext(source, match.index);
    if (findUseOwner({ file: file, ...context }, vocabulary.owners).owner) {
      resolvedByContext++;
      continue;
    }
    if (!byFile.has(file)) {
      byFile.set(file, {
        component: componentName(file),
        relativePath: path.relative(root, file),
        utilities: new Map(),
        tagTokenPairs: new Map(),
        signals: structuralSignalsFor(source),
        usages: 0,
      });
    }
    const record = byFile.get(file);
    record.usages++;
    const utility = `${statePrefix}${prefix}-${token}`;
    record.utilities.set(utility, (record.utilities.get(utility) ?? 0) + 1);
    const tagToken = `<${context.tag ?? "?"}> ${prefix}-${token}`;
    record.tagTokenPairs.set(tagToken, (record.tagTokenPairs.get(tagToken) ?? 0) + 1);
  }
}

const byTokenOnly = process.argv.includes("--by-token");
for (const record of byFile.values()) {
  const topUtilities = [...record.utilities.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([utility]) => utility.replace(/^[a-z-]+:/, ""));
  record.topUtilities = [...new Set(topUtilities)].sort();
  record.signature = byTokenOnly
    ? record.topUtilities.join("+")
    : `${record.topUtilities.join("+")} :: ${record.signals.join(",") || "none"}`;
}

const clusters = new Map();
for (const record of byFile.values()) {
  if (!clusters.has(record.signature)) clusters.set(record.signature, []);
  clusters.get(record.signature).push(record);
}
const ordered = [...clusters.entries()]
  .map(([signature, members]) => ({
    signature,
    members,
    files: members.length,
    usages: members.reduce((total, member) => total + member.usages, 0),
  }))
  .sort((a, b) => b.files - a.files || b.usages - a.usages);

const args = process.argv.slice(2);
const selected = args.includes("--all") ? ordered : ordered.filter((cluster) => cluster.files >= 3);
if (args.includes("--json")) {
  console.log(JSON.stringify(ordered.map((cluster) => ({
    signature: cluster.signature,
    files: cluster.files,
    usages: cluster.usages,
    members: cluster.members.map((member) => ({
      component: member.component,
      path: member.relativePath,
      usages: member.usages,
      topUtilities: member.topUtilities,
    })),
  })), null, 2));
} else {
  console.log(`Uses without an owner in the name: ${scannedWithoutOwner}`);
  console.log(`Resolved by rendered context:      ${resolvedByContext}`);
  console.log(`Remaining files to cluster:        ${byFile.size}`);
  console.log(`Clusters:                          ${ordered.length} (${selected.length} shown)\n`);
  for (const cluster of selected) {
    console.log("=".repeat(96));
    console.log(`${cluster.files} files · ${cluster.usages} uses`);
    console.log(`signature: ${cluster.signature}`);
    for (const member of cluster.members.slice(0, 8)) {
      console.log(`  ${member.component.padEnd(30)} ${String(member.usages).padStart(4)} uses  ${member.relativePath}`);
    }
    if (cluster.members.length > 8) console.log(`  … ${cluster.members.length - 8} more members`);
  }
  console.log("\nOptions: --all | --by-token | --json");
}
