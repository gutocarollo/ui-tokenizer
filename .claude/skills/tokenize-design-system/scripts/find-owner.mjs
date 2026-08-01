#!/usr/bin/env node
/**
 * FINDS THE OWNER OF EVERY USE FROM RENDERED CONTEXT.
 *
 * `score-naming.mjs` can diagnose a missing owner; this script turns that
 * diagnosis into evidence. Per GRAMMAR §5.1, an owner comes from rendered
 * context, not value: `bg-surface-canvas` inside a progressbar is
 * `progress.track.background-color` even if it shares a hex with the page.
 *
 * SIGNAL CHAIN, STRONGEST FIRST
 * -----------------------------
 * 1. JSX tag plus attributes: what the browser renders.
 * 2. Component name matched against the closed §4.1 vocabulary.
 * 3. Ancestral directory when the component name cannot resolve it.
 *
 * Conflicting signals are reported rather than silently chosen. A button inside
 * a modal is a button by tag, with the modal context retained for the reviewer.
 * This script never renames source: it reports each token’s owner distribution.
 *
 * Usage:
 *   node "$SKILL/scripts/find-owner.mjs" --root "$ROOT"
 *   node "$SKILL/scripts/find-owner.mjs" --root "$ROOT" <token>
 *   node "$SKILL/scripts/find-owner.mjs" --root "$ROOT" --json
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { readVocabulary, parseName, PREFIX_PROPERTY } from "./score-naming.mjs";
import { prefixAlternation } from "./lib/utility-families.mjs";

import { resolveRoot, resolveLaw } from "./lib/paths.mjs";
import { loadColourNames, resolveProjectLayout } from "./lib/project-layout.mjs";

/* Portable copy: ROOT comes from --root / TOKENIZE_ROOT / cwd, never this file's location. */
const ROOT = resolveRoot();
/*
 * PREGUICOSO 2026-08-01 — mesmo recorte ja aplicado em `score-naming.mjs`.
 * Resolver o app-alvo no IMPORT quebra todo importador que so quer a LOGICA:
 * `globalEntityFor` e `findUseOwner` decidem por regra, nao por projeto.
 */
let _project = null;
function project() {
  if (_project === null) _project = resolveProjectLayout(ROOT);
  return _project;
}

/* ------------------------------------------------------------ signal 1: JSX tag --- */

/**
 * Tag/attribute -> vocabulary owner. This is the strongest signal because it
 * describes what the browser renders, rather than what the author named a file.
 */
const TAG_OWNER = {
  button: "button",
  input: "field",
  textarea: "field",
  select: "select",
  option: "select",
  label: null, // `label` is anatomy, not owner; the owner is the labelled control
  table: "data-table",
  thead: "data-table",
  tbody: "data-table",
  tr: "data-table",
  th: "data-table",
  td: "data-table",
  code: "code-block",
  pre: "code-block",
  kbd: "code-block",
  img: "avatar",
  svg: null, // likewise: `icon` is anatomy
  a: "nav-item",
  nav: "sidebar",
  main: "page",
  aside: "sidebar",
  dialog: "modal",
};

/** `role=` and `type=` disambiguate more precisely than the tag. */
const ROLE_OWNER = {
  progressbar: "progress",
  menu: "menu",
  menuitem: "menu",
  dialog: "modal",
  alertdialog: "modal",
  tooltip: "tooltip",
  tab: "toolbar",
  tablist: "toolbar",
  switch: "toggle",
  checkbox: "checkbox",
  radio: "radio",
  slider: "slider",
  searchbox: "search",
  listbox: "select",
  row: "data-table",
  cell: "data-table",
  gridcell: "data-table",
  status: "banner",
  alert: "banner",
};
const TYPE_OWNER = {
  checkbox: "checkbox",
  radio: "radio",
  range: "slider",
  search: "search",
  submit: "button",
  button: "button",
};

/* --------------------------------------- signals 2 and 3: name and path --- */

/**
 * Matches a component/directory identifier against the vocabulary in normalized
 * form, allowing `NewUserModal` -> `modal` and `ThreadItem` -> `thread-item`.
 */
function ownerByName(ident, owners) {
  // Split camelCase/kebab/snake identifiers into whole words rather than using
  // substring matching. `EmbeddingSelection` and `LLMSelector` falsely matched
  // `select` 262 times in the earlier version; neither is a native <select>.
  // Whole words keep `NewUserModal` -> modal and `ThreadItem` -> thread-item.
  const words = ident
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .toLowerCase().trim().split(/\s+/).filter(Boolean);

  // Longest first: `thread-item` before `item`; `code-block` before `code`.
  for (const o of [...owners].sort((a, b) => b.length - a.length)) {
    const target = o.split("-");
    if (target.length === 1) {
      if (words.includes(target[0])) return o;
    } else {
      // Compound owner: words must occur in sequence.
      for (let i = 0; i <= words.length - target.length; i++) {
        if (target.every((w, j) => words[i + j] === w)) return o;
      }
    }
  }
  return null;
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

/**
 * Walks backward from a className offset to its carrying tag and reads the tag
 * attributes. It balances `>` and `<` so it does not stop at a prior closed
 * sibling tag.
 */
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

/**
 * Entidades GLOBAIS (§4.1 "Global", §5.5): componente global nao tem pai, e por
 * isso nenhum sinal de tag/role as alcanca. So respondem quando a lei do alvo de
 * fato as admite — `owners` vem da §4.1 lida do GRAMMAR, entao um alvo com lei
 * antiga simplesmente nao ativa este caminho.
 */
export function globalEntityFor(cls, statePrefix, owners = []) {
  const tem = (e) => owners.includes(e);
  const c = String(cls ?? "");
  const st = String(statePrefix ?? "");
  if (tem("focus-ring") && /(?:^|:)focus(?:-visible)?:/.test(st + c) && /^(?:ring|outline)-/.test(c)) {
    return { owner: "focus-ring", signal: "anel de foco — decisao global", strength: "high" };
  }
  if (tem("divider") && /^divide-/.test(c)) {
    return { owner: "divider", signal: "separador — decisao global", strength: "high" };
  }
  return null;
}

/**
 * Owner for one use and the signal that determined it.
 *
 * `cls` e `statePrefix` sao OPCIONAIS e servem ao passo 0: as entidades GLOBAIS
 * do §4.1/§5.5 nao pertencem a componente nenhum, entao nenhum sinal de tag ou
 * role pode acha-las. Sem este passo, `focus-visible:ring-2` dentro de um
 * <button> derivava `button.outline-color.focus` — exatamente as N copias de UMA
 * decisao global que a §5.5 foi criada para matar, e que o cookbook nomeia
 * `focus-ring.outline-color` em 21 linhas. Achado pela varredura de 2026-08-01.
 */
export function findUseOwner({ file, tag, role, type, cls, statePrefix }, owners) {
  // 0. ENTIDADE GLOBAL — a decisao nao e de componente nenhum (§5.5).
  const global = globalEntityFor(cls, statePrefix, owners);
  if (global) return global;

  // 1. role/type — more specific than the tag.
  if (role && ROLE_OWNER[role]) return { owner: ROLE_OWNER[role], signal: `role="${role}"`, strength: "high" };
  if (type && TYPE_OWNER[type]) return { owner: TYPE_OWNER[type], signal: `type="${type}"`, strength: "high" };

  // 2. Native HTML tag.
  // `tag` may be absent (a use outside a recognizable element): fall through to
  // signals 4/5 instead of throwing. Without this, any caller that omits the tag
  // dies at runtime.
  tag = tag ?? "";
  const t = tag.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(TAG_OWNER, t) && TAG_OWNER[t]) {
    return { owner: TAG_OWNER[t], signal: `<${t}>`, strength: "high" };
  }

  // 3. Uppercase React component tag — its name is a signal.
  if (/^[A-Z]/.test(tag)) {
    const o = ownerByName(tag, owners);
    if (o) return { owner: o, signal: `<${tag}>`, strength: "medium" };
  }

  // 4. File component name.
  const base = path.basename(file);
  const comp = base.startsWith("index.") ? path.basename(path.dirname(file)) : path.basename(base, path.extname(base));
  const byComponent = ownerByName(comp, owners);
  if (byComponent) return { owner: byComponent, signal: `component ${comp}`, strength: "medium" };

  // 5. Ancestral directory, excluding structural directories. `src/pages/` is a
  // routing convention, not a design-system owner: without this exclusion,
  // `content-warning` was incorrectly attributed to page from its route path.
  // The same applies to `components`, `ui`, and `lib`: they say where a file
  // lives, not what it renders.
  const STRUCTURAL_DIRECTORIES = new Set([
    "src", "pages", "components", "component", "ui", "lib", "hooks", "utils",
    "models", "styles", "assets", "shared", "common", "index", "app", "views",
  ]);
  for (const seg of file.split(path.sep).reverse()) {
    if (STRUCTURAL_DIRECTORIES.has(seg.toLowerCase())) continue;
    const o = ownerByName(seg, owners);
    if (o) return { owner: o, signal: `directory ${seg}`, strength: "low" };
  }
  return { owner: null, signal: `<${tag}> in ${comp}`, strength: "none" };
}

/* ------------------------------------------------------------------- cli --- */

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isMain) {
  const vocabulary = readVocabulary();
  const universe = await loadColourNames(project());

  // longest-first: unsorted, `rounded` consumes `rounded-t` and `p` consumes `px`.
  const PRE = prefixAlternation();
  const rx = new RegExp(`(?<![\\w-])((?:[a-z-]+:)*)(${PRE})-([a-z][a-z0-9-]*)(?![\\w-])`, "g");
  const byToken = new Map();

  for (const sourceRoot of project().sourceRoots) {
  for (const f of files(sourceRoot)) {
    const text = stripComments(readFileSync(f, "utf8"));
    for (const m of text.matchAll(rx)) {
      const token = m[3];
      if (!universe.has(token)) continue;
      if (parseName(token, vocabulary).owner) continue; // already has an owner in its name
      const ctx = carryingTag(text, m.index);
      const { owner, signal, strength } = findUseOwner({ file: f, ...ctx }, vocabulary.owners);
      if (!byToken.has(token)) byToken.set(token, { token, total: 0, owners: new Map(), noSignal: [] });
      const entry = byToken.get(token);
      entry.total++;
      const key = owner ?? "(not determined)";
      if (!entry.owners.has(key)) entry.owners.set(key, { n: 0, signals: new Map(), examples: [] });
      const ownerEntry = entry.owners.get(key);
      ownerEntry.n++;
      ownerEntry.signals.set(strength, (ownerEntry.signals.get(strength) ?? 0) + 1);
      if (ownerEntry.examples.length < 3) {
        ownerEntry.examples.push(`${path.relative(ROOT, f)}:${text.slice(0, m.index).split("\n").length} (${signal})`);
      }
      if (!owner) entry.noSignal.push(`${path.relative(ROOT, f)}:${text.slice(0, m.index).split("\n").length} — ${signal}`);
    }
  }
  }

  const list = [...byToken.values()].sort((a, b) => b.total - a.total);
  const positional = process.argv.slice(2).filter((argument, index, argv) =>
    !argument.startsWith("--") && !(index > 0 && argv[index - 1] === "--root")
  );
  const target = positional[0] ?? null;

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(list.map((entry) => ({
      token: entry.token, total: entry.total,
      owners: [...entry.owners].map(([o, ownerEntry]) => ({ owner: o, count: ownerEntry.n, signals: [...ownerEntry.signals], examples: ownerEntry.examples })),
    })), null, 1));
  } else if (target) {
    const entry = byToken.get(target);
    if (!entry) { console.error(`Token "${target}" was not found among tokens without an owner.`); process.exit(1); }
    console.log(`${entry.token} — ${entry.total} uses, ${entry.owners.size} owners found from rendered context\n`);
    for (const [o, ownerEntry] of [...entry.owners].sort((a, b) => b[1].n - a[1].n)) {
      console.log(`  ${String(ownerEntry.n).padStart(5)}  ${o.padEnd(16)} signals: ${[...ownerEntry.signals].map(([k, v]) => `${k}:${v}`).join(" ")}`);
      for (const x of ownerEntry.examples) console.log(`         ${x}`);
    }
  } else {
    console.log("OWNER FOUND FROM RENDERED CONTEXT (GRAMMAR.md §5.1)\n");
    console.log(`${"token".padEnd(30)}${"uses".padStart(5)}${"owners".padStart(8)}   dominant (share)           other owners`);
    console.log("-".repeat(112));
    let determined = 0, splitCandidates = 0;
    for (const entry of list) {
      const ord = [...entry.owners].sort((a, b) => b[1].n - a[1].n);
      const [o1, e1] = ord[0];
      const share = Math.round((e1.n / entry.total) * 100);
      if (share >= 80 && o1 !== "(not determined)") determined++; else splitCandidates++;
      const remaining = ord.slice(1, 5).map(([o, ownerEntry]) => `${o}:${ownerEntry.n}`).join(" ");
      console.log(`${entry.token.padEnd(30)}${String(entry.total).padStart(5)}${String(entry.owners.size).padStart(8)}   ${(o1 + " " + share + "%").padEnd(26)} ${remaining}`);
    }
    console.log("-".repeat(112));
    console.log(`${determined} tokens have a DOMINANT owner (>=80%) — the data determines the name`);
    console.log(`${splitCandidates} tokens are distributed — either foundational roles or candidates for a split`);
    console.log(`\nSingle-token detail: node find-owner.mjs --root <root> <token>`);
  }
}
