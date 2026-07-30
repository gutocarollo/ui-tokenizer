#!/usr/bin/env node
/**
 * converge-tokens.mjs — normalizacao ITERATIVA ate convergir.
 *
 * O problema que resolve: uma passada so nao tokeniza um design bagunçado. Na
 * primeira iteracao TUDO parece diferente — cores proximas mas nao iguais,
 * componentes quase iguais com pequenas diferencas, o mesmo papel escrito de
 * cinco jeitos. Criar um token por contexto e o passo 1 correto, mas deixa
 * dezenas de contratos que DEVERIAM ser um so.
 *
 * O metodo, por analogia a Newton-Raphson: cada iteracao aproxima os contratos
 * que a evidencia diz serem o mesmo. Quando DUAS iteracoes consecutivas nao
 * mudam nada, o processo convergiu e chegou ao seu limite — e ai, e so ai, o que
 * sobrou de incerto sobe para decisao humana.
 *
 *     iteracao 1: N contratos distintos (tudo parece diferente)
 *     iteracao 2: funde o que a heuristica diz ser o mesmo com alta confianca
 *     ...
 *     iteracao k: nada mudou
 *     iteracao k+1: nada mudou  -> CONVERGIU
 *
 * A HEURISTICA de fusao combina os sinais que o dono nomeou, cada um com peso e
 * cada um MEDIDO, nunca opinado:
 *
 *   proximidade de cor   deltaE2000 entre os primitivos dominantes (colorjs.io)
 *   similaridade de nome os dois contratos derivam do mesmo owner+propriedade?
 *   similaridade de componente  nomes/paths dos componentes se parecem?
 *   forca do sinal de owner  high/medium/low do find-owner
 *   funcao no backend   o elemento faz a mesma coisa? (type=submit, onClick etc)
 *
 * INCERTEZA = 100 - confianca. Acima do corte (default 30%) nao funde: vai para
 * o capitulo humano do relatorio, com todo o contexto.
 *
 * Uso:
 *   node converge-tokens.mjs --root <app> --clusters <clusters.json>
 *   node converge-tokens.mjs --root <app> --clusters <f> --max-uncertainty 30
 *   node converge-tokens.mjs --root <app> --clusters <f> --json
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { resolveRoot } from "./lib/paths.mjs";

const ROOT = resolveRoot();
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

/** Corte de incerteza. Acima disso o processo NAO decide sozinho. */
const MAX_UNCERTAINTY = Number(arg("--max-uncertainty", "30"));

/** ΔE abaixo do qual duas cores sao perceptualmente a mesma. JND ~ 2.3. */
const DE_SAME = Number(arg("--de-same", "2.3"));

/* --------------------------------------------------------------- cor real -- */

/**
 * Resolve a lib de cor do ROOT ALVO, nao do local deste script — mesmo padrao do
 * tailwind-normalizer, que resolve o Tailwind do alvo. Fail-closed: sem a lib, o
 * sinal de cor vale 0 e a incerteza sobe, entao nada e fundido por engano.
 */
const { createRequire } = await import("node:module");
let Color = null;
try {
  const requireFromTarget = createRequire(path.join(ROOT, "package.json"));
  const mod = await import(new URL(`file://${requireFromTarget.resolve("colorjs.io")}`).href);
  // `require.resolve` devolve o build CJS; o interop aninha o construtor em
  // `default.default`. Descer ate achar a funcao, em vez de assumir a forma.
  const candidatos = [mod, mod.default, mod.default?.default, mod.Color, mod.default?.Color];
  Color = candidatos.find((c) => typeof c === "function") ?? null;
  if (!Color) throw new Error("colorjs.io resolvido mas o construtor nao foi encontrado");
} catch {
  console.error("aviso: colorjs.io nao resolvivel a partir de " + ROOT + " — sinal de cor desativado (incerteza sobe)");
}

const tokensPath = path.join(ROOT, "tokens/color.tokens.json");
const HEX = new Map();
if (existsSync(tokensPath)) {
  const J = JSON.parse(readFileSync(tokensPath, "utf8"));
  const walk = (node, p = []) => {
    for (const [k, v] of Object.entries(node)) {
      if (k === "$type" || k === "$description") continue;
      const here = k === "$root" ? p : [...p, k];
      if (v && typeof v === "object" && "$value" in v) {
        const val = v.$value;
        if (val && typeof val === "object" && val.hex) HEX.set(here.join("."), val.hex);
        else if (typeof val === "string") HEX.set(here.join("."), val);
      } else if (v && typeof v === "object") walk(v, here);
    }
  };
  walk(J);
}

/** Resolve `{primitive.light.c-xxxxxx}` ate o hex, seguindo alias. */
function hexOf(ref, depth = 0) {
  if (!ref || depth > 8) return null;
  if (typeof ref === "string" && ref.startsWith("#")) return ref;
  const key = String(ref).replace(/^\{|\}$/g, "");
  const v = HEX.get(key);
  if (!v) return null;
  return v.startsWith("#") ? v : hexOf(v, depth + 1);
}

function deltaE(a, b) {
  if (!Color) return null;
  const ha = hexOf(a), hb = hexOf(b);
  if (!ha || !hb) return null;
  try { return new Color(ha).deltaE(new Color(hb), "2000"); } catch { return null; }
}

/* ------------------------------------------------------------- heuristica -- */

/** Similaridade de string por bigramas — 0..1. Sem dependencia nova. */
function diceSimilarity(a, b) {
  const bigrams = (s) => { const g = new Set(); const t = s.toLowerCase(); for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2)); return g; };
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return a === b ? 1 : 0;
  let inter = 0; for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size);
}

const STRENGTH = { high: 1, medium: 0.6, low: 0.3 };

/**
 * Confianca de que DOIS clusters sao o MESMO contrato. 0..100.
 *
 * Cada sinal e medido, e o peso reflete quanto ele prova. Cor domina porque e o
 * unico sinal que o usuario final percebe: dois contratos com deltaE < JND sao
 * indistinguiveis na tela, e mante-los separados e distincao sem diferenca.
 */
function mergeConfidence(a, b) {
  const signals = [];

  // 1. cor (peso 40) — o unico sinal perceptivel
  const de = deltaE(a.dominantPrimitive, b.dominantPrimitive);
  if (de === null) signals.push({ name: "cor", weight: 40, score: 0, note: "primitivo nao resolvivel" });
  else if (de <= DE_SAME) signals.push({ name: "cor", weight: 40, score: 1, note: `deltaE ${de.toFixed(2)} <= ${DE_SAME} (imperceptivel)` });
  else if (de <= 5) signals.push({ name: "cor", weight: 40, score: 0.5, note: `deltaE ${de.toFixed(2)} (proximo)` });
  else signals.push({ name: "cor", weight: 40, score: 0, note: `deltaE ${de.toFixed(2)} (distinto)` });

  // 2. contrato derivado identico (peso 25)
  const mesmoNome = a.proposedName === b.proposedName;
  signals.push({ name: "contrato", weight: 25, score: mesmoNome ? 1 : 0, note: mesmoNome ? "mesmo owner+propriedade+variante+estado" : "contratos derivados diferentes" });

  // 3. similaridade de componente (peso 15)
  const sc = diceSimilarity(a.sample.component ?? "", b.sample.component ?? "");
  signals.push({ name: "componente", weight: 15, score: sc, note: `similaridade de nome ${(sc * 100).toFixed(0)}%` });

  // 4. forca do sinal de owner (peso 10) — owner fraco dos dois lados = menos confianca
  const fa = STRENGTH[(a.sample.ownerSignal ?? "").includes("high") ? "high" : (a.sample.ownerSignal ?? "").includes("medium") ? "medium" : "low"] ?? 0.3;
  const fb = STRENGTH[(b.sample.ownerSignal ?? "").includes("high") ? "high" : (b.sample.ownerSignal ?? "").includes("medium") ? "medium" : "low"] ?? 0.3;
  signals.push({ name: "sinal-owner", weight: 10, score: Math.min(fa, fb), note: `forca minima ${Math.min(fa, fb)}` });

  // 5. funcao: mesma tag nativa e mesmo role => mesmo papel funcional (peso 10)
  const mesmaFuncao = a.sample.tag === b.sample.tag && (a.sample.role ?? null) === (b.sample.role ?? null);
  signals.push({ name: "funcao", weight: 10, score: mesmaFuncao ? 1 : 0, note: mesmaFuncao ? `mesma tag <${a.sample.tag}> e mesmo role` : "tag ou role diferentes" });

  const total = signals.reduce((s, x) => s + x.weight * x.score, 0);
  return { confidence: Math.round(total), uncertainty: 100 - Math.round(total), signals };
}

/* -------------------------------------------------------------- iteracoes -- */

const clustersPath = arg("--clusters");
if (!clustersPath || !existsSync(clustersPath)) {
  console.error("uso: --clusters <arquivo json de context-clusters.mjs --json>");
  process.exit(2);
}
const entrada = JSON.parse(readFileSync(clustersPath, "utf8"));
let atual = entrada.clusters.filter((c) => c.proposedName);

const historico = [];
const fusoes = [];
const humano = [];
let iteracao = 0;
let semMudanca = 0;

while (semMudanca < 2 && iteracao < 20) {
  iteracao++;
  let fundiuNestaIteracao = 0;

  // agrupa por contrato derivado; dentro do grupo, tenta fundir por confianca
  const porContrato = new Map();
  for (const c of atual) {
    if (!porContrato.has(c.proposedName)) porContrato.set(c.proposedName, []);
    porContrato.get(c.proposedName).push(c);
  }

  const proximo = [];
  for (const [nome, grupo] of porContrato) {
    if (grupo.length === 1) { proximo.push(grupo[0]); continue; }
    // ancora = o de maior contagem; tenta absorver os demais
    const ordenado = [...grupo].sort((x, y) => y.count - x.count);
    const ancora = { ...ordenado[0], mergedFrom: [...(ordenado[0].mergedFrom ?? [])] };
    for (const outro of ordenado.slice(1)) {
      const m = mergeConfidence(ancora, outro);
      if (m.uncertainty <= MAX_UNCERTAINTY) {
        ancora.count += outro.count;
        ancora.mergedFrom.push({ key: outro.key, count: outro.count, confidence: m.confidence });
        fusoes.push({ iteracao, nome, absorveu: outro.key, count: outro.count, ...m });
        fundiuNestaIteracao++;
      } else {
        proximo.push(outro);
        humano.push({ iteracao, nome, a: ancora.key, b: outro.key, countA: ancora.count, countB: outro.count, ...m });
      }
    }
    proximo.push(ancora);
  }

  historico.push({ iteracao, clusters: atual.length, aposFusao: proximo.length, fundiu: fundiuNestaIteracao });
  semMudanca = fundiuNestaIteracao === 0 ? semMudanca + 1 : 0;
  atual = proximo;
}

const convergiu = semMudanca >= 2;

/* ------------------------------------------------------------------- saida -- */

// dedupe da fila humana: mesma dupla pode reaparecer entre iteracoes
const humanoUnico = [...new Map(humano.map((h) => [`${h.a}::${h.b}`, h])).values()]
  .sort((x, y) => x.confidence - y.confidence);

if (argv.includes("--json")) {
  console.log(JSON.stringify({ convergiu, iteracoes: iteracao, historico, fusoes, humano: humanoUnico, clustersFinais: atual }, null, 1));
} else {
  console.log(`corte de incerteza: ${MAX_UNCERTAINTY}%   ·   deltaE de equivalencia: ${DE_SAME}\n`);
  console.log("iteracao   clusters   apos fusao   fundiu");
  console.log("-".repeat(46));
  for (const h of historico) console.log(`${String(h.iteracao).padStart(8)}   ${String(h.clusters).padStart(8)}   ${String(h.aposFusao).padStart(10)}   ${String(h.fundiu).padStart(6)}`);
  console.log("-".repeat(46));
  console.log(convergiu
    ? `CONVERGIU em ${iteracao} iteracoes — duas consecutivas sem mudanca`
    : `NAO convergiu em ${iteracao} iteracoes (limite)`);
  console.log(`\nfusoes automaticas : ${fusoes.length}`);
  console.log(`fila humana        : ${humanoUnico.length} pares acima de ${MAX_UNCERTAINTY}% de incerteza\n`);
  if (humanoUnico.length) {
    console.log("OS QUE PRECISAM DE VOCE, do mais incerto para o menos:");
    for (const h of humanoUnico.slice(0, Number(arg("--limit", "8")))) {
      console.log(`\n  ${h.nome}   incerteza ${h.uncertainty}%`);
      console.log(`     A: ${h.a}  (${h.countA} usos)`);
      console.log(`     B: ${h.b}  (${h.countB} usos)`);
      for (const s of h.signals) console.log(`        ${s.name.padEnd(12)} ${String(Math.round(s.weight * s.score)).padStart(3)}/${s.weight}   ${s.note}`);
    }
  }
}
