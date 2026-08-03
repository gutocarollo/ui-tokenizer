#!/usr/bin/env node
/**
 * Creates decision-ready groups for colour utility uses. It intentionally
 * reports context; it never decides a token name or applies a rename.
 *
 * Usage: node inventory-usage.mjs --root frontend [--json]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { resolveRoot, resolveSourceRoots } from "./lib/paths.mjs";

const root = resolveRoot();
// As raízes vêm da TOPOLOGIA do alvo, nunca de `src` cravado: o primeiro alvo
// de fora tinha `app` e este passo morria com ENOENT no meio da fase.
const sourceRoots = resolveSourceRoots(root);
const propertyByPrefix = [
  [/^bg-/, "background-color"],
  [/^(text|placeholder)-/, "foreground-color"],
  [/^(border|divide)-/, "border-color"],
  [/^outline-/, "outline-color"],
  [/^ring-/, "outline-color"],
  [/^fill-/, "fill"],
  [/^stroke-/, "stroke"],
  [/^shadow-/, "box-shadow"],
  [/^(from|via|to)-/, "gradient-stop"],
];
const colorUtility = /\b((?:[a-z-]+:)*)((?:bg|text|border|ring|fill|stroke|shadow|placeholder|divide|outline|from|via|to)-([a-z][a-z0-9-]*))/g;
const excludedTokens = new Set(["none", "transparent", "current", "inherit", "white", "black"]);

function* files(directory) {
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) yield* files(absolute);
    else if (/\.(jsx?|tsx?)$/.test(entry)) yield absolute;
  }
}

function componentName(source, file) {
  const match = source.match(/export\s+default\s+function\s+([A-Z][\w]*)/) ||
    source.match(/function\s+([A-Z][\w]*)[\s\S]{0,200}export\s+default\s+\1/);
  if (match) return match[1];
  const parts = file.split(path.sep);
  const index = parts.lastIndexOf("index.jsx");
  return index > 0 ? parts[index - 1] : path.basename(file, path.extname(file));
}

function tagContext(source, offset) {
  let cursor = offset;
  let depth = 0;
  while (cursor > 0) {
    const character = source[cursor];
    if (character === ">") depth++;
    else if (character === "<") {
      if (depth === 0) {
        const end = source.indexOf(">", offset) + 1;
        const opening = source.slice(cursor, end > cursor ? end : cursor + 400);
        const tag = (opening.match(/^<\s*([A-Za-z][\w.]*)/) || [])[1] || "?";
        const roles = {};
        for (const attribute of ["role", "type", "aria-label", "aria-current", "disabled", "href", "to"]) {
          const match = opening.match(new RegExp(`\\b${attribute}=(?:\"([^\"]*)\"|\\{([^}]*)\\})`));
          if (!match) continue;
          roles[attribute] = attribute === "role" || attribute === "type"
            ? (match[1] ?? match[2] ?? "").slice(0, 40)
            : true;
        }
        return { tag, roles };
      }
      depth--;
    }
    cursor--;
  }
  return { tag: "?", roles: {} };
}

function classTokens(source, offset) {
  const start = source.lastIndexOf("className", offset);
  if (start < 0 || offset - start > 1200) return [];
  const end = source.indexOf("\n", offset);
  const excerpt = source.slice(start, end < 0 ? offset + 120 : Math.min(end, start + 700));
  return [...new Set(excerpt.match(/(?:[a-z0-9-]+:)*(?:bg|text|border|ring|fill|stroke|shadow|placeholder|divide|outline)-[a-z0-9-]+/g) ?? [])].sort();
}

const usages = [];
for (const file of sourceRoots.flatMap((raiz) => [...files(raiz)])) {
  const source = readFileSync(file, "utf8");
  const owner = componentName(source, file);
  const relativePath = path.relative(root, file);
  for (const match of source.matchAll(colorUtility)) {
    const [, statePrefix, className, token] = match;
    if (excludedTokens.has(token)) continue;
    const variants = statePrefix ? statePrefix.split(":").filter(Boolean) : [];
    const property = propertyByPrefix.find(([pattern]) => pattern.test(className))?.[1] ?? "unknown";
    const line = source.slice(0, match.index).split("\n").length;
    const { tag, roles } = tagContext(source, match.index);
    usages.push({
      file: relativePath,
      line,
      component: owner,
      className,
      token,
      property,
      variants,
      jsxTag: tag,
      jsxRoles: roles,
      classTokens: classTokens(source, match.index),
    });
  }
}

const groups = new Map();
for (const usage of usages) {
  const key = [usage.component, usage.className, usage.property, usage.variants.join(","), usage.jsxTag].join("|");
  if (!groups.has(key)) groups.set(key, { ...usage, occurrences: 0, locations: [] });
  const group = groups.get(key);
  group.occurrences++;
  if (group.locations.length < 4) group.locations.push(`${usage.file}:${usage.line}`);
}
const output = {
  generatedFrom: "src/**/*.{js,jsx,ts,tsx}",
  totalUsages: usages.length,
  totalDecisionGroups: groups.size,
  sourceFiles: new Set(usages.map((usage) => usage.file)).size,
  groups: [...groups.values()].sort((a, b) => b.occurrences - a.occurrences),
};
console.log(JSON.stringify(output, null, 2));
