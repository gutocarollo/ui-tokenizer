#!/usr/bin/env node
/**
 * context-clusters.mjs — agrupa ocorrencias por CONTEXTO SEMANTICO, que e a
 * unidade de decisao que o grafo manda usar.
 *
 * O erro que este script corrige: perguntar "qual o novo nome do token X?".
 * Essa pergunta forca rename em massa e e invalida quando o token e consumido em
 * contextos diferentes — `surface-hover` tem 337 usos em 13 owners, e nao existe
 * UM nome certo para os 337.
 *
 * `reference/end-to-end-workflow.md` §9 ja definia o eixo certo:
 *
 *     Group first by semantic context:
 *       owner · native tag and implicit/explicit role · nearest landmark ·
 *       component · anatomy · property · interaction state · route area ·
 *       theme · viewport
 *
 * A decisao e POR CLUSTER DE CONTEXTO. E, dentro do cluster, o nome nao e
 * escolha livre: ele e DERIVADO dos proprios eixos, pela lei
 * `owner.anatomia.propriedade[.variante][.estado]`. A IA nao inventa nome — ela
 * so entra quando a derivacao fica ambigua, e o humano so quando restam dois
 * contratos materialmente defensaveis (§9, ultima linha).
 *
 * Uso:
 *   node context-clusters.mjs --root <app> --token surface-hover
 *   node context-clusters.mjs --root <app> --all        # todos os que violam
 *   node context-clusters.mjs --root <app> --json
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { resolveRoot } from "./lib/paths.mjs";
import { findUseOwner } from "./find-owner.mjs";
import { readVocabulary, PREFIX_PROPERTY } from "./score-naming.mjs";
import { prefixAlternation, lawSlotFor } from "./lib/utility-families.mjs";

const ROOT = resolveRoot();
const SRC = path.join(ROOT, "src");

/** Palavras proibidas no nome publico — a lei §2, §3 e §3.1 (content, 2026-07-31). */
const FORBIDDEN = ["surface", "semantic", "content"];

/* --------------------------------------------------------------- varredura -- */

function* files(dir) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(jsx?|tsx?)$/.test(entry)) yield p;
  }
}

/**
 * Contexto do uso, lido para tras a partir do offset.
 *
 * Sao os eixos do §9 que dao para extrair estaticamente. `nearest landmark`,
 * `route area`, `theme` e `viewport` exigem DOM renderizado — ficam declarados
 * como ausentes em vez de chutados.
 */
function contextOf(text, offset, file) {
  const before = text.slice(Math.max(0, offset - 900), offset);
  const open = before.lastIndexOf("<");
  const frag = open >= 0 ? before.slice(open) : "";
  const tag = (frag.match(/^<([A-Za-z][\w.]*)/) ?? [])[1] ?? null;
  const role = (frag.match(/role=["']([a-z-]+)["']/) ?? [])[1] ?? null;
  const type = (frag.match(/type=["']([a-z]+)["']/) ?? [])[1] ?? null;
  const disabled = /\bdisabled\b|aria-disabled/.test(frag);
  const selected = /aria-selected|aria-current|data-selected/.test(frag);

  const rel = path.relative(SRC, file);
  const parts = rel.split(path.sep);
  const base = parts.pop().replace(/\.(jsx?|tsx?)$/, "");
  const component = base === "index" ? parts[parts.length - 1] ?? base : base;
  // area de rota aproximada pelo primeiro segmento sob src/
  const area = parts[0] ?? "(raiz)";

  return { tag, role, type, component, area, disabled, selected };
}

/**
 * Estado de interacao. TRES fontes, nesta precedencia:
 *   1. prefixo de variante Tailwind (`hover:`) — o mais forte, e do consumo
 *   2. atributo no elemento (`disabled`, `aria-selected`)
 *   3. a palavra de estado dentro do NOME DO TOKEN ANTIGO
 *
 * A fonte 3 existe porque medido: 5 ocorrencias de `surface-selected` caiam num
 * nome derivado com estado `hover`, e 4 de `surface-hover` caiam em nome SEM
 * estado. O nome antigo carrega estado e ignora-lo perde o contrato.
 */
const KNOWN_STATES = ["hover", "focus", "active", "disabled", "visited", "checked", "open", "selected"];

function stateOf(variantPrefix, ctx, oldToken) {
  const vs = (variantPrefix || "").split(":").filter(Boolean);
  const fromVariant = vs.filter((v) => KNOWN_STATES.includes(v));
  if (fromVariant.length) return fromVariant.join("-");
  if (ctx.disabled) return "disabled";
  if (ctx.selected) return "selected";
  const fromOld = (oldToken || "").split("-").find((w) => KNOWN_STATES.includes(w));
  return fromOld ?? null;
}

/**
 * Variante, extraida do nome do token antigo.
 *
 * Medido: `button-background-color-hover` puxava de CINCO primitivos diferentes
 * porque `destructive-tint`, `warning-tint` e `success-tint` colapsavam no mesmo
 * nome. Sao variantes, e a lei §4.4 tem slot para elas — o derivador so nao o
 * preenchia. Sem isso o token novo teria que aliasar 5 valores, que e impossivel.
 */
function variantOf(oldToken, vocabulary) {
  const words = (oldToken || "").split("-");
  return words.find((w) => vocabulary.variants.includes(w)) ?? null;
}

/**
 * DIVERGENCIA CONTEXTUAL, no sentido do §9: expor, nunca apagar.
 *
 * Token cujo nome declara um estado, consumido SEM o prefixo daquele estado, e
 * um fundo estatico usando um token de interacao. Renomear em silencio apagaria
 * a evidencia; o processo tem que reportar.
 */
function divergenceOf(variantPrefix, oldToken) {
  const declared = (oldToken || "").split("-").find((w) => KNOWN_STATES.includes(w));
  if (!declared) return null;
  const applied = (variantPrefix || "").split(":").includes(declared);
  return applied ? null : `token declara estado \`${declared}\` e e consumido sem o prefixo \`${declared}:\``;
}

/**
 * Nome DERIVADO do contexto pela lei. Nao e sugestao livre.
 * Retorna null quando falta o eixo obrigatorio (owner), porque nome sem owner e
 * pote de tinta — a lei §7.4 tira 30 pontos disso.
 */
function deriveName({ owner, property, variant, state, anatomy }) {
  if (!owner) return null;
  const parts = [owner];
  if (anatomy) parts.push(anatomy);
  parts.push(property);
  if (variant) parts.push(variant);
  if (state) parts.push(state);
  return parts.join("-");
}

/* -------------------------------------------------------------------- main -- */

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const voc = readVocabulary();

// longest-first: unsorted, `rounded` consumes `rounded-t` and `p` consumes `px`.
const PRE = prefixAlternation();
const alvo = arg("--token");
const tokenRx = alvo
  ? new RegExp(`(?<![\\w-])((?:[a-z-]+:)*)(${PRE})-(${alvo})(?![\\w-])`, "g")
  : new RegExp(`(?<![\\w-])((?:[a-z-]+:)*)(${PRE})-((?:${FORBIDDEN.join("|")})-[a-z0-9-]+)(?![\\w-])`, "g");

const ocorrencias = [];
for (const f of files(SRC)) {
  const text = readFileSync(f, "utf8");
  for (const m of text.matchAll(tokenRx)) {
    const [, variantPrefix, prefix, token] = m;
    const line = text.slice(0, m.index).split("\n").length;
    const ctx = contextOf(text, m.index, f);
    const { owner, signal } = findUseOwner({ file: f, tag: ctx.tag, role: ctx.role, type: ctx.type }, voc.owners);
    // FALHA FECHADA. `property` alimenta `deriveName`, e o nome derivado tem que
    // ser parseavel de volta pela lei. Um prefixo de radius/spacing/tipografia
    // produziria `card-border-radius`, cujo segmento `border-radius` nao esta em
    // §4.3 — vira REMAINDER e a nota do proprio nome cai por um defeito que o
    // derivador criou. Sem slot, o cluster vai para decisao com o motivo escrito.
    const property = lawSlotFor(prefix, voc);
    const cssProperty = PREFIX_PROPERTY[prefix] ?? null;
    const lawGap = property ? null
      : `familia \`${prefix}-\` (${cssProperty}) nao tem slot em §4.3 da lei`;
    const state = stateOf(variantPrefix, ctx, token);
    const variant = variantOf(token, voc);
    const divergence = divergenceOf(variantPrefix, token);
    ocorrencias.push({
      file: path.relative(ROOT, f), line, token, prefix, variantPrefix: variantPrefix || null,
      owner: owner ?? null, ownerSignal: signal ?? null, property, cssProperty, lawGap, state, variant, divergence,
      tag: ctx.tag, role: ctx.role, component: ctx.component, area: ctx.area,
    });
  }
}

/**
 * Chave de cluster = os eixos do §9 que temos estaticamente.
 *
 * O eixo de propriedade usa `property` (slot da lei) e cai para `cssProperty`
 * quando a lei nao tem slot. Sem esse fallback, TODA familia sem slot vira
 * `?` e `rounded-`, `p-` e `gap-` no mesmo elemento colapsam num unico cluster
 * — a fila de decisao perderia justamente a informacao que a torna acionavel, e
 * o motivo reportado seria o da primeira ocorrencia sorteada como amostra.
 */
const chave = (o) => [o.owner ?? "?", o.tag ?? "?", o.role ?? "-", o.component, o.property ?? o.cssProperty ?? "?", o.variant ?? "-", o.state ?? "-", o.area].join(" | ");

const clusters = new Map();
for (const o of ocorrencias) {
  const k = chave(o);
  if (!clusters.has(k)) clusters.set(k, { key: k, sample: o, occurrences: [], tokens: new Set() });
  const c = clusters.get(k);
  c.occurrences.push(o);
  c.tokens.add(o.token);
}

/**
 * Valor fisico do token antigo, para detectar divergencia DENTRO do cluster.
 *
 * Sem isso o mapa proporia um nome que teria de aliasar dois primitivos — o que e
 * impossivel. Medido: 10 dos 29 primeiros nomes eram multi-valor.
 */
const tokensJson = path.join(ROOT, "tokens/color.tokens.json");
const VALUES = new Map();
if (existsSync(tokensJson)) {
  const J = JSON.parse(readFileSync(tokensJson, "utf8"));
  const walk = (node, p = []) => {
    for (const [k, v] of Object.entries(node)) {
      if (k === "$type" || k === "$description") continue;
      if (k === "$root") VALUES.set(p.join("."), v?.$value);
      else if (v && typeof v === "object" && "$value" in v) VALUES.set([...p, k].join("."), v.$value);
      else if (v && typeof v === "object") walk(v, [...p, k]);
    }
  };
  walk(J);
}
const primitiveOf = (token) => VALUES.get(`semantic.light.surface.${token.replace(/^surface-/, "")}`) ?? null;

const lista = [...clusters.values()]
  .map((c) => {
    const s = c.sample;
    // sem slot na lei nao ha nome derivavel, por mais claro que o contexto seja
    const proposed = s.lawGap
      ? null
      : deriveName({ owner: s.owner, property: s.property, variant: s.variant, state: s.state, anatomy: null });
    // valor dominante do cluster; o resto e DIVERGENCIA a expor, nao a apagar (§9)
    const byValue = new Map();
    for (const o of c.occurrences) {
      const v = primitiveOf(o.token) ?? `(sem valor: ${o.token})`;
      byValue.set(v, (byValue.get(v) ?? 0) + 1);
    }
    const ordered = [...byValue.entries()].sort((a, b) => b[1] - a[1]);
    const dominant = ordered[0]?.[0] ?? null;
    const divergent = c.occurrences.filter((o) => (primitiveOf(o.token) ?? `(sem valor: ${o.token})`) !== dominant);
    return {
      ...c,
      tokens: [...c.tokens],
      count: c.occurrences.length,
      proposedName: proposed,
      dominantPrimitive: dominant,
      valueSpread: ordered.length,
      divergentCount: divergent.length,
      divergentOccurrences: divergent.slice(0, 8),
      stateDivergences: c.occurrences.filter((o) => o.divergence).length,
      needsDecision: !proposed,
      reason: proposed ? null : (s.lawGap ?? "owner nao determinado pelo contexto renderizado"),
    };
  })
  .sort((a, b) => b.count - a.count);

const total = ocorrencias.length;
const derivados = lista.filter((c) => c.proposedName);
const cobertos = derivados.reduce((s, c) => s + c.count, 0);

if (argv.includes("--json")) {
  console.log(JSON.stringify({ total, clusters: lista.map((c) => ({ ...c, occurrences: c.occurrences.slice(0, 6) })) }, null, 1));
} else {
  console.log(`ocorrencias que violam a lei : ${total}`);
  console.log(`CLUSTERS DE CONTEXTO         : ${lista.length}   <- a unidade de decisao`);
  console.log(`  com nome DERIVADO da lei   : ${derivados.length} clusters, ${cobertos} ocorrencias (${(100 * cobertos / total).toFixed(1)}%)`);
  console.log(`  precisam de decisao        : ${lista.length - derivados.length} clusters, ${total - cobertos} ocorrencias\n`);
  console.log(`${"n".padStart(4)}  ${"token antigo".padEnd(28)}${"nome DERIVADO do contexto".padEnd(40)}contexto`);
  console.log("-".repeat(132));
  for (const c of lista.slice(0, Number(arg("--limit") ?? 30))) {
    const s = c.sample;
    const ctx = `${s.tag ?? "?"}${s.role ? `[${s.role}]` : ""} em ${s.component} (${s.area})`;
    console.log(
      `${String(c.count).padStart(4)}  ${c.tokens.join(",").slice(0, 27).padEnd(28)}${(c.proposedName ?? "— DECISAO NECESSARIA").padEnd(40)}${ctx}`
    );
  }
}
