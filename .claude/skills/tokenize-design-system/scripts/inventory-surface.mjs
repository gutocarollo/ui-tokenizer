#!/usr/bin/env node
/**
 * INVENTORY OF `semantic.*.surface.*` TOKENS — consumption through three paths.
 *
 * WHY THIS FILE LIVES IN THE REPOSITORY
 * -------------------------------------
 * An earlier inventory lived in `/tmp`, making its public evidence neither
 * reproducible nor durable. This portable copy counts every known consumption
 * path together: Tailwind utilities, CSS/JS `var(--color-...)`, and DTCG JSON
 * aliases. `$root` remains a token node, not metadata.
 *
 * Usage: node "$SKILL/scripts/inventory-surface.mjs" --root "$ROOT" [--json]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { resolveRoot, resolveLaw } from "./lib/paths.mjs";
import { readTokenDocument, resolveProjectLayout } from "./lib/project-layout.mjs";

/* Portable copy: ROOT comes from --root / TOKENIZE_ROOT / cwd, never this file's location. */
const ROOT = resolveRoot();
const PROJECT = resolveProjectLayout(ROOT);
const J = readTokenDocument(PROJECT);

/**
 * `$` keys that are metadata. `$root` is deliberately absent: it is the base
 * token of a group that may also have variants.
 */
const META = new Set(["$description", "$type", "$value", "$extensions", "$deprecated"]);

/** Resolves `{primitive.x.y}` to hex. A DTCG leaf may be an object with `hex`. */
function resolve(v, depth = 0) {
  if (depth > 8) return "?";
  if (v && typeof v === "object") return v.hex ?? JSON.stringify(v);
  if (typeof v !== "string") return String(v);
  const m = v.match(/^\{([^}]+)\}$/);
  if (!m) return v;
  const node = m[1].split(".").reduce((o, k) => (o ?? {})[k], J);
  return resolve(node?.$value ?? "?", depth + 1);
}

/* ------------------------------------------------------------- definitions --- */

const surfaces = {};
for (const theme of ["light", "dark"]) {
  for (const [k, v] of Object.entries(J.semantic?.[theme]?.surface ?? {})) {
    if (META.has(k)) continue;
    surfaces[k] ??= { name: k, desc: v.$description ?? "", val: {}, components: [] };
    surfaces[k].val[theme] = resolve(v.$value);
  }
}

/* ------------------------------------------------------ path 3: JSON alias --- */

const walkComponents = (node, trail = []) => {
  for (const [k, v] of Object.entries(node)) {
    if (META.has(k)) continue;
    if (!v || typeof v !== "object") continue;
    if (v.$value !== undefined) {
      const m = String(v.$value).match(/\{semantic\.[a-z]+\.surface\.([a-z-]+)\}/);
      if (m && surfaces[m[1]]) surfaces[m[1]].components.push([...trail, k].join("."));
      continue;
    }
    walkComponents(v, [...trail, k]);
  }
};
for (const theme of Object.keys(J.component ?? {})) {
  if (META.has(theme)) continue;
  walkComponents(J.component[theme], []);
}

/* ------------------------------------------ paths 1 and 2: class and var() --- */

function* files(dir) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === "generated") continue; // emitter output, not source consumption
      yield* files(p);
    } else if (/\.(jsx|tsx|js|css)$/.test(e)) yield p;
  }
}
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const sources = [
  ...PROJECT.sourceRoots.flatMap((sourceRoot) => [...files(sourceRoot)]),
  ...(PROJECT.tailwindConfig ? [PROJECT.tailwindConfig] : []),
];

for (const s of Object.values(surfaces)) {
  s.classUses = 0;
  s.varUses = 0;
  s.props = {};
  s.owners = new Set();
  s.varWhere = [];
}

const RX_CLASS =
  /(?<![\w-])(bg|text|border|ring|divide|fill|stroke|shadow|placeholder|from|via|to)-surface-([a-z-]+)(?![\w-])/g;

for (const f of sources) {
  const text = stripComments(readFileSync(f, "utf8"));
  for (const m of text.matchAll(RX_CLASS)) {
    const s = surfaces[m[2]];
    if (!s) continue;
    s.classUses++;
    s.props[m[1]] = (s.props[m[1]] ?? 0) + 1;
    s.owners.add(path.basename(path.dirname(f)));
  }
  for (const name of Object.keys(surfaces)) {
    const rx = new RegExp(`var\\(\\s*--color-surface-${name}(?:-rgb)?\\s*[,)]`, "g");
    for (const m of text.matchAll(rx)) {
      surfaces[name].varUses++;
      if (surfaces[name].varWhere.length < 4) {
        surfaces[name].varWhere.push(
          `${path.relative(ROOT, f)}:${text.slice(0, m.index).split("\n").length}`
        );
      }
    }
  }
}

/* ------------------------------------------------------------------ output --- */

const rows = Object.values(surfaces)
  .map((s) => ({
    name: s.name,
    light: s.val.light,
    dark: s.val.dark,
    classUses: s.classUses,
    varUses: s.varUses,
    componentRefs: s.components.length,
    owners: s.owners.size,
    props: s.props,
    varWhere: s.varWhere,
    total: s.classUses + s.varUses + s.components.length,
  }))
  .sort((a, b) => b.total - a.total);

const dupes = {};
for (const r of rows) (dupes[`${r.light}|${r.dark}`] ??= []).push(r.name);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ rows, duplicates: Object.entries(dupes).filter(([, v]) => v.length > 1) }, null, 1));
} else {
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad("token", 22) + pad("light", 10) + pad("dark", 10) + "class   var()   comp   owners  properties");
  console.log("-".repeat(92));
  for (const r of rows) {
    console.log(
      pad(r.name, 22) + pad(r.light, 10) + pad(r.dark, 10) +
      String(r.classUses).padStart(6) + String(r.varUses).padStart(7) +
      String(r.componentRefs).padStart(7) + String(r.owners).padStart(8) + "  " +
      (r.classUses ? JSON.stringify(r.props) : "") + (r.total === 0 ? "   DEAD" : "")
    );
  }
  console.log("\nEXACT VALUE DUPLICATES:");
  for (const [v, names] of Object.entries(dupes)) {
    if (names.length > 1) console.log(`  ${names.join("  ==  ")}   ${v.replace("|", " / ")}`);
  }
  const dead = rows.filter((r) => r.total === 0).map((r) => r.name);
  console.log(`\nDEAD ON ALL THREE PATHS: ${dead.length ? dead.join(", ") : "none"}`);
}
