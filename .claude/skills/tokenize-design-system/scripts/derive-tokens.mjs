#!/usr/bin/env node
/**
 * DERIVES A SPECIFIC TOKEN FOR EVERY SEMANTIC USE.
 *
 * OWNER DECISION (2026-07-29)
 * ---------------------------
 * Every semantic case receives its own token even when cases happen to share a
 * color today. DRY is retained by pointing those contracts to one primitive,
 * not by coupling them to one semantic name. This resolves H-021 at its root:
 * changing button text must not silently change modal text.
 *
 * HOW EACH SLOT IS DERIVED — mechanical, never guessed
 * -----------------------------------------------------
 *   owner    <- `find-owner.mjs`: JSX tag > role/type > component name
 *   anatomy  <- CSS property plus what the element renders
 *   property <- the Tailwind utility prefix's actual CSS property
 *   variant  <- legacy color role (for example, danger -> destructive)
 *   state    <- a Tailwind state prefix (for example, hover: -> hover)
 *   value    <- the current value, retained for pixel parity
 *
 * Usage:
 *   node "$SKILL/scripts/derive-tokens.mjs" --root "$ROOT"
 *   node "$SKILL/scripts/derive-tokens.mjs" --root "$ROOT" --table
 *   node "$SKILL/scripts/derive-tokens.mjs" --root "$ROOT" --json
 *   node "$SKILL/scripts/derive-tokens.mjs" --root "$ROOT" --dtcg
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { readVocabulary, parseName, PREFIX_PROPERTY, IMPLIED_PROPERTY } from "./score-naming.mjs";
import { prefixAlternation, lawSlotFor } from "./lib/utility-families.mjs";
import { findUseOwner } from "./find-owner.mjs";

import { resolveRoot, resolveLaw } from "./lib/paths.mjs";
import { loadColourNames, readTokenDocument, resolveProjectLayout } from "./lib/project-layout.mjs";

/* Portable copy: ROOT comes from --root / TOKENIZE_ROOT / cwd, never this file's location. */
const ROOT = resolveRoot();
const PROJECT = resolveProjectLayout(ROOT);

/**
 * A color role embedded in the legacy name becomes a §4.4 vocabulary variant.
 * `content-danger` therefore retains its destructive role while moving it from
 * a concept suffix into the owner variant slot.
 */
const VARIANT_BY_ROLE = {
  danger: "destructive", destructive: "destructive",
  success: "success", warning: "warning", info: "info",
  primary: "primary", secondary: "secondary", ghost: "ghost",
};

/**
 * Derives anatomy from property and element. Per corrected §4.2, anatomy is
 * written only when an owner has more than one addressable part. The owner’s
 * own background and border leave it empty; text and icon are parts.
 */
function deriveAnatomy({ prefix, statePrefix, tag }) {
  if (/placeholder/.test(statePrefix || "") || prefix === "placeholder") return "placeholder";
  if (prefix === "fill" || prefix === "stroke") return "icon";
  if (prefix === "caret") return "caret";
  if (prefix === "divide") return "divider";
  if (prefix === "text") {
    // `text-` on an SVG paints its glyph through currentColor: icon, not label.
    return tag.toLowerCase() === "svg" ? "icon" : "label";
  }
  // bg / border / ring / outline / shadow paint the owner itself: no anatomy.
  return null;
}

/**
 * §4.3 property a utility prefix PAINTS — a projection onto the closed
 * vocabulary, not the literal CSS property name. This value lands directly in
 * the generated DTCG id via `buildName`, so it must be a §4.3 term; raw CSS
 * would emit ids like `button.--tw-ring-color`. See score-naming.mjs.
 */
function deriveProperty(prefix, anatomy, vocabulary) {
  // FAIL CLOSED. F-E widened the prefix table to radius, spacing and typography,
  // and §4.3 has no slot for any of them. Emitting `card.border-radius` here
  // would produce a DTCG id whose property segment `parseName` cannot parse back
  // — a token the oracle itself would score below the cutoff for a defect the
  // generator introduced. `undefined` means "not derivable"; the caller records
  // it as unresolved rather than inventing a slot.
  const p = lawSlotFor(prefix, vocabulary);
  if (!p) return undefined;
  // §7.2: an anatomy with one possible property need not spell it out.
  if (anatomy && IMPLIED_PROPERTY[anatomy] === p) return null;
  return p;
}

/** Variant and state from the legacy name and Tailwind prefix. */
function deriveVariantState(legacyToken, statePrefix, vocabulary) {
  const parts = legacyToken.split("-");
  let variant = null;
  for (const p of parts) if (VARIANT_BY_ROLE[p]) variant = VARIANT_BY_ROLE[p];

  const prefixes = (statePrefix || "").split(":").filter(Boolean);
  let state = null;
  for (const p of prefixes) if (vocabulary.states.includes(p) && p !== "default") state = p;
  // `selected`/`active` may also be present in the legacy name.
  for (const p of parts) if (vocabulary.states.includes(p) && p !== "default") state = state ?? p;
  return { variant, state };
}

/** Builds the DTCG ID and emitted class from the full path. */
export function buildName({ owner, anatomy, property, variant, state }) {
  /*
   * ORDEM CORRIGIDA 2026-08-01. Este gerador produzia
   * `button.background-color.primary.hover` — a grafia que a §6 do GRAMMAR cita
   * como ERRO corrigido — enquanto o parser irmao (`score-naming.mjs::parseName`)
   * ja lia na ordem nova. Gerador e parser desalinhados, sem teste cobrindo o
   * round-trip. Achado pela varredura de contradicoes de 2026-08-01.
   */
  const parts = [owner, variant, anatomy, property, state].filter(Boolean);
  return { dtcg: parts.join("."), className: parts.join("-") };
}

/* ---------------------------------------------------------------- scanning --- */

function* files(dir) {
  for (const ownerEntry of readdirSync(dir)) {
    const p = path.join(dir, ownerEntry);
    if (statSync(p).isDirectory()) { if (ownerEntry !== "generated") yield* files(p); }
    else if (/\.(jsx|tsx)$/.test(ownerEntry)) yield p;
  }
}
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function carryingTag(text, offset) {
  let i = offset, depth = 0;
  while (i > 0) {
    const ch = text[i];
    if (ch === ">") depth++;
    else if (ch === "<") {
      if (depth === 0) {
        const end = text.indexOf(">", offset);
        const opening = text.slice(i, end > 0 ? end + 1 : i + 400);
        return {
          tag: (opening.match(/^<\s*([A-Za-z][\w.]*)/) || [])[1] || "?",
          role: (opening.match(/\brole=["']([^"']+)/) || [])[1] || null,
          type: (opening.match(/\btype=["']([^"']+)/) || [])[1] || null,
        };
      }
      depth--;
    }
    i--;
  }
  return { tag: "?", role: null, type: null };
}

/** Current token value, inherited by the new token to preserve pixel parity. */
function currentValues() {
  const J = readTokenDocument(PROJECT);
  const resolve = (v, entry = 0) => {
    if (entry > 8) return "?";
    if (v && typeof v === "object") return v.hex ?? "?";
    if (typeof v !== "string") return String(v);
    const m = v.match(/^\{([^}]+)\}$/);
    if (!m) return v;
    let n = J;
    for (const k of m[1].split(".")) n = (n && typeof n === "object") ? n[k] : undefined;
    return resolve(n?.$value ?? "?", entry + 1);
  };
  const out = {};
  for (const tier of ["semantic", "component", "primitive"]) {
    for (const theme of ["light", "dark"]) {
      const walk = (o, p = []) => {
        if (!o || typeof o !== "object") return;
        for (const [k, v] of Object.entries(o)) {
          if (k.startsWith("$") && k !== "$root") continue;
          const key = k === "$root" ? p : [...p, k];
          if (v && typeof v === "object" && v.$value !== undefined) {
            (out[key.join("-")] ??= {})[theme] = resolve(v.$value);
          } else walk(v, key);
        }
      };
      walk((J[tier] ?? {})[theme] ?? {});
    }
  }
  return out;
}

/* ------------------------------------------------------------------- cli --- */

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isMain) {
  const vocabulary = readVocabulary();
  const universe = await loadColourNames(PROJECT);
  const values = currentValues();

  // longest-first: unsorted, `rounded` consumes `rounded-t` and `p` consumes `px`.
  const PRE = prefixAlternation();
  const rx = new RegExp(`(?<![\\w-])((?:[a-z-]+:)*)(${PRE})-([a-z][a-z0-9-]*)(?![\\w-])`, "g");

  const newTokens = new Map();   // new class -> data
  const unresolved = [];
  let uses = 0;

  for (const sourceRoot of PROJECT.sourceRoots) {
  for (const f of files(sourceRoot)) {
    const text = stripComments(readFileSync(f, "utf8"));
    for (const m of text.matchAll(rx)) {
      const [, statePrefix, prefix, legacyToken] = m;
      if (!universe.has(legacyToken)) continue;
      if (parseName(legacyToken, vocabulary).owner) continue; // already has an owner
      uses++;
      const ctx = carryingTag(text, m.index);
      const { owner, signal } = findUseOwner({ file: f, ...ctx }, vocabulary.owners);
      const line = text.slice(0, m.index).split("\n").length;
      const local = `${path.relative(ROOT, f)}:${line}`;

      if (!owner) { unresolved.push({ local, className: `${statePrefix}${prefix}-${legacyToken}`, signal }); continue; }

      const anatomy = deriveAnatomy({ prefix, statePrefix, tag: ctx.tag });
      const property = deriveProperty(prefix, anatomy, vocabulary);
      if (property === undefined) {
        unresolved.push({ local, className: `${statePrefix}${prefix}-${legacyToken}`,
          signal: `law §4.3 has no slot for \`${PREFIX_PROPERTY[prefix]}\`` });
        continue;
      }
      const { variant, state } = deriveVariantState(legacyToken, statePrefix, vocabulary);
      const { dtcg, className } = buildName({ owner, anatomy, property, variant, state });

      if (!newTokens.has(className)) {
        newTokens.set(className, {
          className, dtcg, owner, anatomy, property, variant, state,
          value: values[legacyToken] ?? {}, sourceClasses: new Set(), uses: 0, locations: [],
        });
      }
      const entry = newTokens.get(className);
      entry.uses++;
      entry.sourceClasses.add(`${statePrefix}${prefix}-${legacyToken}`);
      if (entry.locations.length < 4) entry.locations.push(local);
    }
  }
  }

  const list = [...newTokens.values()].sort((a, b) => b.uses - a.uses);
  const argv = process.argv.slice(2);

  if (argv.includes("--json")) {
    console.log(JSON.stringify(list.map((entry) => ({ ...entry, sourceClasses: [...entry.sourceClasses] })), null, 1));
  } else if (argv.includes("--dtcg")) {
    // Theme fragment ready to paste into color.tokens.json.
    for (const theme of ["light", "dark"]) {
      const tree = {};
      for (const entry of list) {
        if (!entry.value[theme]) continue;
        let n = tree;
        const p = entry.dtcg.split(".");
        p.forEach((seg, i) => {
          if (i === p.length - 1) n[seg] = { $value: entry.value[theme], $description: `${entry.uses} uses; formerly ${[...entry.sourceClasses].join(", ")}` };
          else n = (n[seg] ??= {});
        });
      }
      console.log(`\n/* ---- component.${theme} ---- */`);
      console.log(JSON.stringify(tree, null, 2));
    }
  } else if (argv.includes("--table") ) {
    console.log(`${"NEW CLASS".padEnd(56)}${"uses".padStart(5)}   derived from`);
    console.log("-".repeat(120));
    for (const entry of list) console.log(`${entry.className.padEnd(56)}${String(entry.uses).padStart(5)}   ${[...entry.sourceClasses].join(", ").slice(0, 55)}`);
  } else {
    const byOwner = {};
    for (const entry of list) byOwner[entry.owner] = (byOwner[entry.owner] ?? 0) + 1;
    console.log(`Uses without an owner scanned: ${uses}`);
    console.log(`New tokens derived:            ${list.length}`);
    console.log(`Uses covered:                  ${list.reduce((s, entry) => s + entry.uses, 0)}`);
    console.log(`Uses with no determinable owner: ${unresolved.length}`);
    console.log(`\nNew tokens by owner:`);
    for (const [o, n] of Object.entries(byOwner).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${o.padEnd(16)}${String(n).padStart(3)}`);
    }
    console.log(`\nTwelve highest-volume proposals:`);
    for (const entry of list.slice(0, 12)) console.log(`  ${String(entry.uses).padStart(5)}  ${entry.className}`);
    if (unresolved.length) {
      console.log(`\nNo determinable owner (${unresolved.length}) — first six:`);
      for (const x of unresolved.slice(0, 6)) console.log(`  ${x.local}  ${x.className}  [${x.signal}]`);
    }
    console.log(`\n--table | --json | --dtcg`);
  }
}
