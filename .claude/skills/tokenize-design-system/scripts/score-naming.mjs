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
import {
  PREFIX_PROPERTY,
  PREFIX_FAMILY,
  lawSlotFor,
  unlawedPrefixes,
  prefixAlternation,
} from "./lib/utility-families.mjs";

/* Portable copy: ROOT comes from --root / TOKENIZE_ROOT / cwd, never this file's location. */
const ROOT = resolveRoot();

/*
 * PREGUICOSO DESDE 2026-08-01 — resolver o app-alvo era EFEITO DE MODULO, e o
 * efeito quebrava todo importador que nao precisa de app nenhum. Quem so quer
 * julgar um NOME precisa da LEI, nao de um projeto: `scoreName`, `parseName` e
 * `readVocabulary` nunca tocam `PROJECT`. Ele so e usado por `collectUses`
 * (Linha ~391) e pelo CLI (Linha ~412), que de fato varrem o codigo do alvo.
 *
 * O que o efeito eager quebrava, medido: `validate-cookbook.mjs` (valida nome
 * contra a lei, sem alvo) morria com "No source root found"; e
 * `test/lei-x-familias.test.mjs` e `test/utility-families.test.mjs` crashavam
 * no proprio import, fora de um alvo — o invariante lei x codigo nao rodava em
 * lugar nenhum. Fase A4 do plano de lacunas.
 */
let _project = null;
function project() {
  if (_project === null) _project = resolveProjectLayout(ROOT);
  return _project;
}
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
  generic: ["ui", "misc", "other", "default", "generic", "base", "main", "alt", "custom", "content"],
};

/**
 * An anatomy enters this map only when it can carry exactly one CSS property.
 * `text` is a text node, so it has `color` but no surface of its own. For anatomies
 * that can carry multiple properties (`container`, `icon`), property remains
 * informative and is intentionally absent here.
 */
/*
 * DUAS REGRAS QUE ESTAVAM COLADAS NUMA SO, E A COLAGEM ERA UM ERRO DE CATEGORIA.
 *
 * O dono perguntou, em 2026-08-01: "por que existe essa lei?", sobre o oraculo
 * reprovar `button.primary.label.font-weight` com a mensagem "label cannot carry
 * font-weight — only foreground-color". A pergunta estava certa: a regra nao
 * tinha logica.
 *
 * O mesmo mapa alimentava duas afirmacoes logicamente distintas:
 *
 *   DERIVABILIDADE (§7.2)  "a propriedade de `label` e derivavel"
 *                          -> natureza: REDUNDANCIA. Voce nao PRECISA escreve-la.
 *   COERENCIA              "`label` nao PODE carregar X"
 *                          -> natureza: IMPOSSIBILIDADE. Voce nao PODE escreve-la.
 *
 * A regra derivava a segunda da primeira, e a inferencia e INVALIDA: "a unica
 * propriedade de PINTURA e foreground-color" nao implica "a unica propriedade e
 * foreground-color". A propria mensagem de erro denunciava o contrabando do
 * quantificador ao dizer "only".
 *
 * E a premissa tambem era falsa. Medido no codigo real dos dois produtos em
 * 2026-08-01, por grep:
 *
 *   label      104 ocorrencias de <span>/<label> com `bg-*`  (highlight, chip)
 *   divider     14 com `h-px` + `bg-*`  (contra 104 com `border-t`)
 *   backdrop     4 com `text-*`
 *   placeholder  0 contraexemplos
 *   caret        0 contraexemplos — o CSS so tem `caret-color`
 *
 * Nas tres primeiras eu havia codificado HABITO DE IMPLEMENTACAO como se fosse
 * fisica. Elas saem. Ficam as duas em que a restricao e do CSS, cada uma com a
 * razao escrita — entrada sem razao nao entra.
 *
 * O que era veto tabelado vira, para os casos removidos, pergunta da §5.1: um
 * <span> amarelo e um rotulo COM fundo, ou um conteiner com rotulo dentro?
 * Decisao do dono em 2026-08-01: **rotulo com fundo** — o renderizado ali e uma
 * caixa so, e inventar anatomia para um elemento sem filho e o inverso do
 * principio de ler o contexto renderizado.
 */

/** Os tres dominios da §4.3. A derivabilidade so vale DENTRO de um. */
export const DOMINIO_DA_PROPRIEDADE = Object.freeze({
  "background-color": "paint", color: "paint", "border-color": "paint",
  "outline-color": "paint", "box-shadow": "paint", fill: "paint", stroke: "paint",
  "border-radius": "geometry", padding: "geometry", margin: "geometry",
  gap: "geometry", "row-gap": "geometry", "column-gap": "geometry",
  "font-weight": "type", "line-height": "type", "letter-spacing": "type",
});

export function dominioDaPropriedade(p) {
  return DOMINIO_DA_PROPRIEDADE[p] ?? "desconhecido";
}

/**
 * REGRA 1 — DERIVABILIDADE. A propriedade de PINTURA que a anatomia ja implica,
 * e que por isso e ruido escrever. Alimenta SO o criterio `no-redundancy`.
 * Nunca reprova por impossibilidade.
 */
export const IMPLIED_PROPERTY = {
  text: "color",
  placeholder: "color",
  helper: "color",
  caret: "color",
  backdrop: "background-color",
  divider: "border-color",
};

/**
 * REGRA 2 — COERENCIA. Pares que o CSS torna IMPOSSIVEIS. Cada entrada carrega a
 * razao; entrada sem razao verificavel nao entra, porque foi assim que `label`,
 * `divider` e `backdrop` viraram falso-vermelho contra 122 ocorrencias reais.
 */
export const PARES_IMPOSSIVEIS = Object.freeze({
  caret: {
    permitido: ["color"],
    razao: "o CSS tem exatamente uma propriedade de caret: `caret-color`. Nao ha " +
           "caret-background, caret-border nem caret-shadow.",
  },
  placeholder: {
    permitido: ["color", "font-weight", "line-height", "letter-spacing"],
    razao: "`::placeholder` aceita cor e tipografia; nao aceita geometria propria — " +
           "ele nao tem caixa. Medido: 0 ocorrencias de `placeholder:bg-*` nos dois produtos.",
  },
});

/** Verdadeiro quando o par anatomia x propriedade e fisicamente impossivel. */
export function parImpossivel(anatomy, property) {
  const regra = PARES_IMPOSSIVEIS[anatomy];
  if (!regra || !property) return null;
  return regra.permitido.includes(property) ? null : regra.razao;
}


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
  /*
   * ORDEM CORRIGIDA 2026-08-01 — a variante e consumida logo apos o dono, e
   * ANTES da anatomia e da propriedade. Antes desta linha o parser lia
   * owner -> anatomy -> property -> variant, premiando com 100 o nome
   * `button-border-color-secondary` e reprovando `button-secondary-border-color`
   * em `no-remainder`. Era a lei que estava errada, nao o nome: a variante
   * qualifica o DONO ("qual botao"), nao a propriedade — nenhum dos 7 sistemas
   * de referencia com dono E propriedade no nome escreve a variante na cauda.
   * Ver GRAMMAR.md §6, bloco "ORDER CORRECTED 2026-08-01".
   */
  const owner = take(vocabulary.owners);
  const variant = take(vocabulary.variants);
  const anatomy = take(vocabulary.anatomy);
  const property = take(vocabulary.properties);
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
    /*
     * Propriedade derivavel da anatomia.
     *
     * A COMPARACAO E PELA PROPRIEDADE INTEIRA, NAO PALAVRA A PALAVRA. A versao
     * anterior quebrava `foreground-color` em ["foreground","color"] e marcava
     * a palavra `color` como redundante em QUALQUER nome que a contivesse —
     * inclusive `markdown.label.background-color`, que e outra propriedade e
     * nao e derivavel de coisa alguma. Resultado medido: 85/100 num nome que o
     * dono acabara de declarar canonico (decisao "rotulo COM fundo",
     * 2026-08-01). `background-color` != `foreground-color`; compartilhar a
     * palavra `color` nao torna uma derivavel da outra.
     */
    if (s.anatomy && IMPLIED_PROPERTY[s.anatomy] && s.property === IMPLIED_PROPERTY[s.anatomy] &&
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
  const impossivel = s.anatomy && parImpossivel(s.anatomy, s.property);
  if (impossivel) {
    criteria.push({ c: "coherent-pair", points: 0, maxPoints: 10, ok: false,
      note: `\`${s.anatomy}.${s.property}\` nao existe — ${impossivel}` });
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
 * Tailwind utility prefix -> the property the prefix SETS.
 *
 * THE TABLE MOVED to `lib/utility-families.mjs` and is re-exported here so the
 * five importers keep working. It moved because the same knowledge was also
 * hand-written as a regex literal inside `measure-coverage.mjs`, the script that
 * produces the plan's blocking coverage number — and the two copies disagreed.
 *
 * For a PAINT prefix the value is a projection onto the §4.3 closed vocabulary,
 * NOT the literal CSS: the compiler emits `--tw-ring-color` for `ring-` and
 * `--tw-shadow-color` for `shadow-`, neither of which is a §4.3 term and neither
 * of which may appear in a token id. The projection is REQUIRED, not sloppy:
 * `scoreApplication` compares this value by strict equality against the property
 * slot parsed out of the token NAME, and `derive-tokens.mjs` puts it straight
 * into the generated DTCG id.
 *
 * F-E WIDENED THE TABLE to radius, spacing and typography, and that exposed a
 * hole the oracle had been hiding: **§4.3 holds seven properties and all seven
 * are paint.** There is no slot for `border-radius`, `padding`, `margin`, `gap`,
 * `line-height` or `letter-spacing`. So the widening cannot be a projection for
 * those rows — there is nothing to project onto. They FAIL CLOSED at every
 * boundary that requires a §4.3 term (`scoreApplication` here, `deriveProperty`
 * in derive-tokens, `deriveName` in context-clusters), and they are reported as
 * a declared LAW GAP instead of being scored against a slot that does not exist.
 * Amending §4.3 is a decision about the law, not a script edit, and it is
 * written up rather than taken here.
 */
export { PREFIX_PROPERTY, PREFIX_FAMILY, prefixAlternation, lawSlotFor };

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

  // NOT SCOREABLE — LAW GAP. The class belongs to a design family the oracle can
  // now SEE (radius, spacing, typography) but the law cannot NAME: §4.3 is seven
  // paint properties and nothing else. Scoring it anyway has only bad branches —
  // award the 60 and every spacing use passes without a property check, or fail
  // the 60 and every spacing use reports H-021 against a slot that was never
  // available. Both are numbers that look like results. It fails closed instead,
  // and the gap is counted where it can be read.
  const lawProperty = lawSlotFor(prefix, vocabulary);
  if (!lawProperty) {
    return { token, prefix, file, line, score: null, evaluable: false, lawGap: true,
      family: PREFIX_FAMILY[prefix] ?? null,
      reason: `law §4.3 has no slot for \`${PREFIX_PROPERTY[prefix]}\` (\`${prefix}-\`, family ` +
        `${PREFIX_FAMILY[prefix]}); the use cannot be scored until the property vocabulary is amended`,
      criteria: [], review: false };
  }

  // 1. Declared PROPERTY × actual prefix (60) — the mechanical H-021 test.
  const real = lawProperty;
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

/**
 * Collects every token use in JSX, across all four families.
 *
 * The alternation is longest-first (`prefixAlternation`), which is load-bearing
 * now that the table holds `rounded` next to `rounded-t` and `p` next to `px`:
 * first-match-wins would hand `t-card` to the token capture out of
 * `rounded-t-card`.
 */
export function collectUses(universe) {
  const rx = new RegExp(`(?<![\\w-])((?:[a-z-]+:)*)(${prefixAlternation()})-([a-z][a-z0-9-]*)(?![\\w-])`, "g");
  const uses = [];
  for (const sourceRoot of project().sourceRoots) {
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
  const universe = await loadColourNames(project());
  const uses = collectUses(universe);
  const consumed = [...new Set(uses.map((u) => u.token))];

  const names = consumed.map((n) => scoreName(n, vocabulary, universe)).sort((a, b) => a.score - b.score);
  const allApplications = uses.map((u) => scoreApplication(u, vocabulary, universe));
  const apps = allApplications.filter((a) => a.evaluable).sort((a, b) => a.score - b.score);
  const lawGaps = allApplications.filter((a) => a.lawGap);
  const nonEvaluable = allApplications.filter((a) => !a.evaluable && !a.lawGap);
  const gapByFamily = new Map();
  for (const a of lawGaps) gapByFamily.set(a.family, (gapByFamily.get(a.family) ?? 0) + 1);
  const unlawed = unlawedPrefixes(vocabulary);
  const average = (l) => (l.reduce((s, x) => s + x.score, 0) / (l.length || 1)).toFixed(1);
  const argv = process.argv.slice(2);

  if (argv.includes("--json")) {
    console.log(JSON.stringify({
      cutoff: CUTOFF, names, applications: apps,
      lawGap: {
        prefixes: unlawed,
        properties: [...new Set(unlawed.map((p) => PREFIX_PROPERTY[p]))],
        uses: lawGaps.length,
        byFamily: Object.fromEntries(gapByFamily),
      },
    }, null, 1));
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
    console.log(`LAW GAP      ${String(lawGaps.length).padStart(5)} uses      the class family has no §4.3 property slot`);
    console.log(`\nLAW GAP — the oracle now SEES these families and cannot SCORE them:`);
    console.log(`  §4.3 properties: ${vocabulary.properties.join(" · ")}`);
    console.log(`  ${unlawed.length} of ${Object.keys(PREFIX_PROPERTY).length} prefixes have no slot: ` +
      `${[...new Set(unlawed.map((p) => PREFIX_PROPERTY[p]))].join(" · ")}`);
    for (const [family, n] of [...gapByFamily].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(5)} uses in family ${family}`);
    }
    if (!lawGaps.length) {
      console.log(`      0 uses — no token of these families EXISTS in the target yet;`);
      console.log(`      widening the prefix table cannot create one. See F-E findings.`);
    }
    console.log(`\nNAME score distribution:`);
    for (const [lo, hi] of [[0, 39], [40, 59], [60, 69], [70, 84], [85, 100]]) {
      const n = names.filter((x) => x.score >= lo && x.score <= hi).length;
      console.log(`  ${String(lo).padStart(3)}-${String(hi).padEnd(3)} ${"█".repeat(Math.round(n / 2)).padEnd(40)} ${n}`);
    }
    console.log(`\ndetails: --names | --applications | --review | --json`);
  }
}
