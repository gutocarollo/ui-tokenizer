#!/usr/bin/env node
/**
 * DETERMINISTIC TOKEN SEMANTIC-QUALITY SCORE.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Token names were decided by opinion. That yielded `surface.deep` (z-stack
 * position masquerading as role), redundant `button.container.background-color`,
 * and names no one could classify consistently.
 *
 * THE LAW IS SOUND; THE MISSING PART WAS AN ORACLE.
 *
 * A word is meaningful only when removing it loses information. The test is
 * mechanical: removal collision, derivability from another segment, and whether
 * it answers one of the grammar slots (owner, anatomy, property, variant, state).
 * `surface` answers z-stack position, which no slot asks for. `container` means
 * "the whole owner" and therefore adds nothing when the anatomy slot is empty.
 *
 * TWO SCORES, NOT ONE
 * -------------------
 * Name score checks the token in isolation. Application score checks each use
 * against the promise made by that name; a sound name used for the wrong CSS
 * property remains a defect (H-021).
 *
 * CUTOFF: 70. Anything below it requires review. The cutoff is intentionally
 * explicit and auditable.
 *
 *   node "$SKILL/scripts/score-naming.mjs" --root "$ROOT"
 *   node "$SKILL/scripts/score-naming.mjs" --root "$ROOT" --names
 *   node "$SKILL/scripts/score-naming.mjs" --root "$ROOT" --applications
 *   node "$SKILL/scripts/score-naming.mjs" --root "$ROOT" --review
 *   node tokens/score-naming.mjs --json
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { resolveRoot, resolveLaw } from "./lib/paths.mjs";
import { loadColourNames, resolveProjectLayout } from "./lib/project-layout.mjs";

/* Portable copy: ROOT comes from --root / TOKENIZE_ROOT / cwd, never this file's location. */
const ROOT = resolveRoot();
const PROJECT = resolveProjectLayout(ROOT);
export const CUTOFF = 70;

/* --------------------------------------------------------- law vocabulary --- */

/** Read from GRAMMAR.md rather than duplicated here; the law is authoritative. */
export function readVocabulary() {
  const g = readFileSync(resolveLaw(ROOT), "utf8");
  const section = (starts, ends) => {
    const i = starts.map((heading) => g.indexOf(heading)).find((index) => index >= 0) ?? -1;
    const f = ends
      .map((heading) => g.indexOf(heading, i + 1))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0] ?? g.length;
    if (i < 0) return [];
    return [...new Set([...g.slice(i, f).matchAll(/`([a-z][a-z0-9-]*)`/g)].map((m) => m[1]))];
  };
  return {
    owners: section(["### 4.1 Owners"], ["### 4.2 Anatomy"]),
    anatomy: section(["### 4.2 Anatomy"], ["### 4.3 Properties"]),
    properties: section(["### 4.3 Properties"], ["### 4.4 Variants"]),
    variants: section(["### 4.4 Variants"], ["### 4.5 States"]),
    states: section(["### 4.5 States"], ["## 5. Decision rules"]),
  };
}

/**
 * Words that answer no grammar-slot question. This is not a taste list:
 * tier answers architectural level, location answers z-stack position, and
 * pigment answers a raw color value rather than a role.
 */
export const NO_SLOT = {
  tier: ["semantic", "primitive", "component", "role", "foundation", "token", "theme"],
  location: ["surface", "layer", "level", "deep", "raised", "elevated", "sunken", "canvas", "panel", "background", "foreground", "front", "back"],
  pigment: ["pink", "grey", "gray", "green", "red", "blue", "yellow", "purple", "cyan", "orange", "white", "black", "static"],
  generic: ["ui", "misc", "other", "default", "generic", "base", "main", "alt", "custom"],
};

/**
 * An anatomy enters this map only when it can carry exactly one CSS property.
 * `label` is text, so it has `color` but no surface of its own. For anatomies
 * that can carry multiple properties (`container`, `icon`), property remains
 * informative and is intentionally absent here.
 */
export const IMPLIED_PROPERTY = {
  label: "color",
  placeholder: "color",
  helper: "color",
  caret: "color",
  backdrop: "background-color",
  divider: "border-color",
};

/* --------------------------------------------------------------- name score --- */

/**
 * Greedily splits a token name into law slots from left to right. Owners and
 * anatomy may contain hyphens, so the longest match is evaluated first.
 */
export function parseName(name, vocabulary) {
  const longestFirst = (l) => [...l].sort((a, b) => b.length - a.length);
  let remaining = name;
  const take = (list) => {
    for (const c of longestFirst(list)) {
      if (remaining === c) { remaining = ""; return c; }
      if (remaining.startsWith(c + "-")) { remaining = remaining.slice(c.length + 1); return c; }
    }
    return null;
  };
  const owner = take(vocabulary.owners);
  const anatomy = take(vocabulary.anatomy);
  const property = take(vocabulary.properties);
  const variant = take(vocabulary.variants);
  const state = take(vocabulary.states);
  return { owner, anatomy, property, variant, state, remainder: remaining || null };
}

/**
 * NAME SCORE — 100 points, six criteria. The weights model the cost of a
 * defect: no owner prevents classifying a new use; a context word recreates the
 * `surface` defect; redundant words add noise; incompatible anatomy/property is
 * an internal contradiction; and a state without its default pair is zero delta.
 */
export function scoreName(name, vocabulary, universe) {
  const s = parseName(name, vocabulary);
  const parts = name.split("-");
  const criteria = [];
  let score = 0;

  // 1. OWNER (30) — the sole absolute CARE column.
  if (s.owner) {
    score += 30;
    criteria.push({ c: "owner", points: 30, maxPoints: 30, ok: true, note: `owner \`${s.owner}\` is in the vocabulary` });
  } else {
    criteria.push({ c: "owner", points: 0, maxPoints: 30, ok: false, note: "NO OWNER — the token has no owner, so a new use cannot be judged" });
  }

  // 2. CONTEXT WORD (25) — answers a question that no grammar slot asks.
  //
  // Only words the parse did NOT consume are examined. A vocabulary term that
  // filled a slot is, by definition, answering that slot's question — checking
  // its constituent words again is a category error.
  //
  // Concretely: `background-color` is a §4.3 property, one closed-vocabulary
  // term. Splitting it on the hyphen and testing `background` against the
  // location list flagged EVERY token whose property is background-color —
  // measured, 84 of 84 declared tokens, plus 26 of 29 proposed. The most common
  // correct property in the system was losing 25 points for being correct.
  //
  // The residue still catches what matters, verified against a must-catch table:
  // `surface-panel`, `semantic-color-surface-canvas`, `page-canvas-background-color`,
  // `button-elevated-background-color` and `pink-medium` are all still flagged,
  // because those words fill no slot.
  const consumed = new Set();
  for (const filled of [s.owner, s.anatomy, s.property, s.variant, s.state]) {
    if (filled) for (const w of String(filled).split("-")) consumed.add(w);
  }
  const residue = parts.filter((p) => !consumed.has(p));
  const found = [];
  for (const [category, list] of Object.entries(NO_SLOT)) {
    for (const p of residue) if (list.includes(p)) found.push(`${p} (${category})`);
  }
  if (!found.length) {
    score += 25;
    criteria.push({ c: "no-context", points: 25, maxPoints: 25, ok: true, note: "no tier, location, or pigment word" });
  } else {
    criteria.push({ c: "no-context", points: 0, maxPoints: 25, ok: false, note: `word requested by no slot: ${found.join(", ")}` });
  }

  // 3. REDUNDANCY (15) — removal test, word by word.
  const redundant = [];
  for (const p of parts) {
    const withoutWord = parts.filter((x) => x !== p).join("-");
    const collides = universe.has(withoutWord);
    if (collides) continue; // necessary for uniqueness
    // `container` says "the part that is the whole". An empty slot already says that.
    if (p === "container" && s.anatomy === "container") { redundant.push(`${p} (an empty slot already means the owner itself)`); continue; }
    // Property derivable from anatomy.
    if (s.anatomy && IMPLIED_PROPERTY[s.anatomy] && s.property &&
        IMPLIED_PROPERTY[s.anatomy].split("-").includes(p)) {
      redundant.push(`${p} (derivable from \`${s.anatomy}\`)`);
    }
  }
  if (!redundant.length) {
    score += 15;
    criteria.push({ c: "no-redundancy", points: 15, maxPoints: 15, ok: true, note: "every word loses information when removed" });
  } else {
    criteria.push({ c: "no-redundancy", points: 0, maxPoints: 15, ok: false, note: `word that loses no information: ${redundant.join(", ")}` });
  }

  // 4. ANATOMY × PROPERTY PAIR (10) — internal contradiction.
  const imp = s.anatomy && IMPLIED_PROPERTY[s.anatomy];
  if (imp && s.property && s.property !== imp) {
    criteria.push({ c: "coherent-pair", points: 0, maxPoints: 10, ok: false,
      note: `\`${s.anatomy}\` cannot carry \`${s.property}\` — only \`${imp}\`` });
  } else {
    score += 10;
    criteria.push({ c: "coherent-pair", points: 10, maxPoints: 10, ok: true, note: "anatomy and property are compatible" });
  }

  // 5. STATE WITH BASE (10) — §5.4.
  if (s.state) {
    const base = name.replace(new RegExp(`-${s.state}$`), "");
    if (universe.has(base)) {
      score += 10;
      criteria.push({ c: "state-with-base", points: 10, maxPoints: 10, ok: true, note: `default pair exists (\`${base}\`)` });
    } else {
      criteria.push({ c: "state-with-base", points: 0, maxPoints: 10, ok: false, note: `state \`${s.state}\` has no default pair \`${base}\`` });
    }
  } else {
    score += 10;
    criteria.push({ c: "state-with-base", points: 10, maxPoints: 10, ok: true, note: "no declared state (implicit default is correct)" });
  }

  // 6. NO REMAINDER (10) — every segment must map to a law slot.
  // `prompt-bg` previously scored 100/100 with `remainder=bg`; `bg` abbreviates
  // `background-color`, so it is outside the vocabulary and must fail.
  if (!s.remainder) {
    score += 10;
    criteria.push({ c: "no-remainder", points: 10, maxPoints: 10, ok: true, note: "every segment maps to a law slot" });
  } else {
    criteria.push({ c: "no-remainder", points: 0, maxPoints: 10, ok: false,
      note: `segment outside every law slot: \`${s.remainder}\` — abbreviation or a word absent from §4` });
  }

  return { name, score, slots: s, criteria, review: score < CUTOFF };
}

/* ------------------------------------------------------ application score --- */

/**
 * Tailwind utility prefix -> the §4.3 property the prefix PAINTS.
 *
 * This is a projection onto the closed vocabulary, NOT the literal CSS property
 * name. The compiler emits `caret-color` for `caret-`, `accent-color` for
 * `accent-`, `--tw-ring-color` for `ring-` and `--tw-shadow-color` for
 * `shadow-` — none of which exist in §4.3, and none of which may appear in a
 * token id.
 *
 * The projection is REQUIRED, not sloppy: `scoreApplication` compares this value
 * by strict equality against the property slot parsed out of the token NAME,
 * and that slot can only ever hold a §4.3 term. `derive-tokens.mjs` puts this
 * value straight into the generated DTCG id. Returning raw CSS here would make
 * the match impossible forever and would emit ids like
 * `button.--tw-ring-color`.
 *
 * The previous wording of this comment claimed literal CSS, which the code never
 * did and does not need to — and that claim caused a review to conclude the
 * table was broken and propose replacing it with compiler derivation. Keep the
 * wording honest.
 */
export const PREFIX_PROPERTY = {
  bg: "background-color", text: "color", border: "border-color",
  ring: "outline-color", divide: "border-color", outline: "outline-color",
  shadow: "box-shadow", fill: "fill", stroke: "stroke", placeholder: "color",
  accent: "color", caret: "color",
};

function* files(dir) {
  for (const ownerEntry of readdirSync(dir)) {
    const p = path.join(dir, ownerEntry);
    if (statSync(p).isDirectory()) { if (ownerEntry !== "generated") yield* files(p); }
    else if (/\.(jsx|tsx)$/.test(ownerEntry)) yield p;
  }
}
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * APPLICATION SCORE — 100 points per use. The question changes from "is the
 * name sound?" to "does this use fit the name's promise?" A perfect name used
 * in the wrong place is still the H-021 defect (`surface.panel` painting text).
 */
export function scoreApplication({ token, prefix, statePrefix, file, line }, vocabulary, universe) {
  const s = parseName(token, vocabulary);
  const criteria = [];
  let score = 0;

  // NOT EVALUABLE: a name that makes no claim cannot be checked for fit. v1
  // gave those uses 0, double-penalizing an absent owner already penalized in
  // the name score. An average of broken names does not measure applications.
  const declared = s.property || (s.anatomy && IMPLIED_PROPERTY[s.anatomy]) || null;
  if (!s.owner && !declared) {
    return { token, prefix, file, line, score: null, evaluable: false,
      reason: "the name declares neither owner nor property; the defect belongs to the NAME score",
      criteria: [], review: false };
  }

  // 1. Declared PROPERTY × actual prefix (60) — the mechanical H-021 test.
  const real = PREFIX_PROPERTY[prefix];
  if (!declared) {
    criteria.push({ c: "property", points: 0, maxPoints: 0, ok: null,
      note: `name declares no property (NAME defect); consumed as \`${prefix}-\` (${real})` });
  } else if (declared === real) {
    score += 60;
    criteria.push({ c: "property", points: 60, maxPoints: 60, ok: true,
      note: `\`${prefix}-\` paints ${real}, matching the promised ${declared}` });
  } else {
    criteria.push({ c: "property", points: 0, maxPoints: 60, ok: false,
      note: `H-021: name promises ${declared}, but \`${prefix}-\` paints ${real}` });
  }

  // 2. Declared STATE × variant prefix (25) — mechanical.
  const est = (statePrefix || "").replace(/:$/, "").split(":").filter(Boolean).pop() || null;
  const knownState = est && vocabulary.states.includes(est);
  if (!s.state && !knownState) { score += 25; criteria.push({ c: "state", points: 25, maxPoints: 25, ok: true, note: "no state on either side" }); }
  else if (s.state && est === s.state) { score += 25; criteria.push({ c: "state", points: 25, maxPoints: 25, ok: true, note: `\`${est}:\` matches \`.${s.state}\`` }); }
  else if (!s.state && knownState) { criteria.push({ c: "state", points: 0, maxPoints: 25, ok: false, note: `used under \`${est}:\`, but the name declares no state` }); }
  else { criteria.push({ c: "state", points: 0, maxPoints: 25, ok: false, note: `name declares \`.${s.state}\`, but it was used ${knownState ? `under \`${est}:\`` : "without a state prefix"}` }); }

  // 3. Declared OWNER × rendered component (15). This is explicitly heuristic:
  // legitimate reuse exists, so a missing owner in the path earns half score
  // and requires human reading.
  const comp = path.basename(file).startsWith("index.")
    ? path.basename(path.dirname(file)) : path.basename(file, path.extname(file));
  const norm = (x) => x.toLowerCase().replace(/[^a-z]/g, "");
  if (!s.owner) {
    criteria.push({ c: "owner", points: 0, maxPoints: 0, ok: null, note: "name without owner (NAME defect)" });
  } else if (norm(comp).includes(norm(s.owner)) || norm(file).includes(norm(s.owner))) {
    score += 15;
    criteria.push({ c: "owner", points: 15, maxPoints: 15, ok: true, note: `owner \`${s.owner}\` appears in the path (${comp})` });
  } else {
    score += 7;
    criteria.push({ c: "owner", points: 7, maxPoints: 15, ok: null,
      note: `owner \`${s.owner}\` is absent from \`${comp}\` — legitimate reuse or wrong owner; requires reading` });
  }

  // Normalize to 100 using only criteria evaluable for this use.
  const available = criteria.reduce((t, c) => t + c.maxPoints, 0) || 1;
  const score100 = Math.round((score / available) * 100);
  return { token, prefix, state: est, file, line, score: score100, evaluable: true, criteria, review: score100 < CUTOFF };
}

/** Collects every color-token use in JSX. */
export function collectUses(universe) {
  const PRE = Object.keys(PREFIX_PROPERTY).join("|");
  const rx = new RegExp(`(?<![\\w-])((?:[a-z-]+:)*)(${PRE})-([a-z][a-z0-9-]*)(?![\\w-])`, "g");
  const uses = [];
  for (const sourceRoot of PROJECT.sourceRoots) {
    for (const f of files(sourceRoot)) {
      const t = stripComments(readFileSync(f, "utf8"));
      t.split("\n").forEach((l, i) => {
        for (const m of l.matchAll(rx)) {
          if (!universe.has(m[3])) continue;
          uses.push({ token: m[3], prefix: m[2], statePrefix: m[1], file: path.relative(ROOT, f), line: i + 1 });
        }
      });
    }
  }
  return uses;
}

/* ------------------------------------------------------------------- cli --- */

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isMain) {
  const vocabulary = readVocabulary();
  const universe = await loadColourNames(PROJECT);
  const uses = collectUses(universe);
  const consumed = [...new Set(uses.map((u) => u.token))];

  const names = consumed.map((n) => scoreName(n, vocabulary, universe)).sort((a, b) => a.score - b.score);
  const allApplications = uses.map((u) => scoreApplication(u, vocabulary, universe));
  const apps = allApplications.filter((a) => a.evaluable).sort((a, b) => a.score - b.score);
  const nonEvaluable = allApplications.filter((a) => !a.evaluable);
  const average = (l) => (l.reduce((s, x) => s + x.score, 0) / (l.length || 1)).toFixed(1);
  const argv = process.argv.slice(2);

  if (argv.includes("--json")) {
    console.log(JSON.stringify({ cutoff: CUTOFF, names, applications: apps }, null, 1));
  } else if (argv.includes("--names") || argv.includes("--review")) {
    const list = argv.includes("--review") ? names.filter((n) => n.review) : names;
    for (const n of list) {
      console.log(`\n${String(n.score).padStart(3)}/100  ${n.review ? "REVIEW" : "  ok  "}  ${n.name}`);
      const s = n.slots;
      console.log(`         slots: owner=${s.owner ?? "—"} anatomy=${s.anatomy ?? "—"} property=${s.property ?? "—"} variant=${s.variant ?? "—"} state=${s.state ?? "—"}${s.remainder ? ` REMAINDER=${s.remainder}` : ""}`);
      for (const c of n.criteria) console.log(`         ${c.ok === true ? "+" : c.ok === false ? "-" : "~"} ${String(c.points).padStart(2)}/${c.maxPoints}  ${c.c.padEnd(16)} ${c.note}`);
    }
    console.log(`\n${list.length} tokens · average ${average(list)}`);
  } else if (argv.includes("--applications")) {
    for (const a of apps.filter((x) => x.review).slice(0, 60)) {
      console.log(`\n${String(a.score).padStart(3)}/100  ${a.file}:${a.line}  ${a.state ? a.state + ":" : ""}${a.prefix}-${a.token}`);
      for (const c of a.criteria) if (c.ok !== true) console.log(`         - ${String(c.points).padStart(2)}/${c.maxPoints}  ${c.c.padEnd(12)} ${c.note}`);
    }
    console.log(`\n${apps.filter((x) => x.review).length} of ${apps.length} applications are below the threshold · average ${average(apps)}`);
  } else {
    const fx = (list) => `${list.filter((item) => !item.review).length} ok · ${list.filter((item) => item.review).length} in review`;
    console.log(`threshold: ${CUTOFF}/100\n`);
    console.log(`NAMES        ${String(names.length).padStart(5)} tokens    average ${average(names)}   ${fx(names)}`);
    console.log(`APPLICATIONS ${String(apps.length).padStart(5)} uses      average ${average(apps)}   ${fx(apps)}`);
    console.log(`NOT EVALUABLE ${String(nonEvaluable.length).padStart(4)} uses      the name declares neither owner nor property`);
    console.log(`\nNAME score distribution:`);
    for (const [lo, hi] of [[0, 39], [40, 59], [60, 69], [70, 84], [85, 100]]) {
      const n = names.filter((x) => x.score >= lo && x.score <= hi).length;
      console.log(`  ${String(lo).padStart(3)}-${String(hi).padEnd(3)} ${"█".repeat(Math.round(n / 2)).padEnd(40)} ${n}`);
    }
    console.log(`\ndetails: --names | --applications | --review | --json`);
  }
}
