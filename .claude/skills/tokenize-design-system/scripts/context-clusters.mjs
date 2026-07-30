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

const ROOT = resolveRoot();
const SRC = path.join(ROOT, "src");

/** Palavras proibidas no nome publico — a lei §2 e §3. */
const FORBIDDEN = ["surface", "semantic"];

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

/** Estado de interacao vem do prefixo de variante, nao de adivinhacao. */
function stateOf(variantPrefix, ctx) {
  const vs = (variantPrefix || "").split(":").filter(Boolean);
  const known = ["hover", "focus", "active", "disabled", "visited", "checked", "open"];
  const fromVariant = vs.filter((v) => known.includes(v));
  if (fromVariant.length) return fromVariant.join("-");
  if (ctx.disabled) return "disabled";
  if (ctx.selected) return "selected";
  return null;
}

/**
 * Nome DERIVADO do contexto pela lei. Nao e sugestao livre.
 * Retorna null quando falta o eixo obrigatorio (owner), porque nome sem owner e
 * pote de tinta — a lei §7.4 tira 30 pontos disso.
 */
function deriveName({ owner, property, state, anatomy }) {
  if (!owner) return null;
  const parts = [owner];
  if (anatomy) parts.push(anatomy);
  parts.push(property);
  if (state) parts.push(state);
  return parts.join("-");
}

/* -------------------------------------------------------------------- main -- */

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const voc = readVocabulary();

const PRE = Object.keys(PREFIX_PROPERTY).join("|");
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
    const property = PREFIX_PROPERTY[prefix] ?? null;
    const state = stateOf(variantPrefix, ctx);
    ocorrencias.push({
      file: path.relative(ROOT, f), line, token, prefix, variantPrefix: variantPrefix || null,
      owner: owner ?? null, ownerSignal: signal ?? null, property, state,
      tag: ctx.tag, role: ctx.role, component: ctx.component, area: ctx.area,
    });
  }
}

/** Chave de cluster = os eixos do §9 que temos estaticamente. */
const chave = (o) => [o.owner ?? "?", o.tag ?? "?", o.role ?? "-", o.component, o.property ?? "?", o.state ?? "-", o.area].join(" | ");

const clusters = new Map();
for (const o of ocorrencias) {
  const k = chave(o);
  if (!clusters.has(k)) clusters.set(k, { key: k, sample: o, occurrences: [], tokens: new Set() });
  const c = clusters.get(k);
  c.occurrences.push(o);
  c.tokens.add(o.token);
}

const lista = [...clusters.values()]
  .map((c) => {
    const s = c.sample;
    const proposed = deriveName({ owner: s.owner, property: s.property, state: s.state, anatomy: null });
    return {
      ...c,
      tokens: [...c.tokens],
      count: c.occurrences.length,
      proposedName: proposed,
      needsDecision: !proposed,
      reason: proposed ? null : "owner nao determinado pelo contexto renderizado",
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
