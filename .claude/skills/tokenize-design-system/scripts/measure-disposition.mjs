#!/usr/bin/env node
/**
 * measure-disposition.mjs — a particao COMPLETA: todo uso cai num instrumento.
 *
 *     node measure-disposition.mjs --root <app> [--json]
 *
 * POR QUE EXISTE. O oraculo anterior particionava em 3 estratos e sobravam
 * 24,5% "sem disposicao -> excecao". O dono perguntou onde estava o gargalo
 * para 100%, e a resposta veio de OLHAR A ESTATISTICA do resto em vez de
 * aceitar o rotulo:
 *
 *   - Zipf brutal: 11 classes cobrem 50% do resto; ~192 cobrem 95%.
 *     Mediana de usos por classe = 1, desvio = 59,7. Isso NAO e caos —
 *     e um VOCABULARIO FECHADO pequeno com cauda longa.
 *   - `flex`/`items-center`/`w-full` nao sao violacao: sao o uso CANONICO
 *     de utility-first. Tokenizar `flex` e anti-padrao (ja estabelecido),
 *     mas rotular de "excecao" era fraco: a disposicao certa e um
 *     CONTRATO DE VOCABULARIO — allowlist versionada com owner/reason/
 *     scope/evidence/review EM BLOCO, enforceavel por lint (ratchet:
 *     o vocabulario so encolhe).
 *   - Parte do "resto" JA ERA contrato: classes custom definidas no CSS
 *     proprio (`.tooltip`, `.input-label`, `.popover-ring`). O censo as
 *     contava como sem disposicao — contava o CONTRATO EXISTENTE como
 *     violacao.
 *   - Arbitrary values (`h-[34px]`, `w-[300px]`) sao DECISAO DE DESIGN
 *     cravada — candidatos a token de dimensao, cauda curta.
 *   - E bundles unicos frequentemente CONTEM uma entidade inteira como
 *     subconjunto (drift aditivo, ja medido na familia do input: 80
 *     strings, top1 41%). Composicao nucleo+extras resgata-os.
 *
 * OS 7 INSTRUMENTOS, cada um adequado a natureza estatistica do estrato:
 *
 *   1 entidade exata          bundle >=2x e >=4 classes -> const exportado
 *   2 entidade por composicao bundle unico que CONTEM uma entidade -> cn(NUCLEO, extras)
 *   3 token por familia       cor/spacing/radius/tipografia fora de entidade
 *   4 contrato existente      classe custom definida no CSS proprio
 *   5 token de dimensao       arbitrary value [..] repetido
 *   6 vocabulario de layout   allowlist p/ 95% do residuo, 1 documento, ratchet
 *   7 excecao item-a-item     o que sobra de verdade (~1%)
 *
 * A ORDEM IMPORTA: cada uso cai no PRIMEIRO instrumento que o cobre.
 * Fail-closed: a soma dos 7 tem que bater o universo EXATO, senao exit 1 —
 * particao que nao soma 100% e oraculo mentindo.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { resolveRoot } from "./lib/paths.mjs";

const ROOT = resolveRoot();
const JSON_OUT = process.argv.includes("--json");

const CLS = /className\s*=\s*(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g;
const TOK = /^(?:hover:|focus:|active:|group-hover:|dark:|light:|disabled:|focus-visible:|sm:|md:|lg:|xl:|2xl:)*-?(?:bg|text|border|ring|shadow|fill|stroke|outline|divide|accent|caret|placeholder|p[xytrbles]?|m[xytrbles]?|gap|space|rounded|font|leading|tracking)(?:-|$)/;
// fragmentos de ternario que o regex de className captura como "classe".
// Medido: 936 usos de ruido (`?`, `:`, `}`) inflavam o universo e o resto.
const RUIDO = /^[?:}{)(]$|^["']/;
const ARB = /\[.+\]/;
const SKIP = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", ".tokenize"]);
const EXT = new Set([".js", ".jsx", ".ts", ".tsx"]);

function walk(d, out = []) {
  let e; try { e = readdirSync(d, { withFileTypes: true }); } catch { return out; }
  for (const x of e) {
    if (SKIP.has(x.name)) continue;
    const p = path.join(d, x.name);
    if (x.isDirectory()) walk(p, out); else if (EXT.has(path.extname(x.name))) out.push(p);
  }
  return out;
}

/* censo */
const bundles = new Map();
for (const f of walk(path.join(ROOT, "src"))) {
  let t; try { t = readFileSync(f, "utf8"); } catch { continue; }
  for (const m of t.matchAll(CLS)) {
    const cs = [m[1], m[2], m[3]].filter(Boolean).join(" ").split(/\s+/)
      .filter((c) => c && !c.startsWith("$") && !c.includes("${") && !RUIDO.test(c));
    if (!cs.length) continue;
    const k = [...cs].sort().join(" ");
    const cur = bundles.get(k) ?? { n: 0, classes: cs };
    cur.n++; bundles.set(k, cur);
  }
}
const total = [...bundles.values()].reduce((s, v) => s + v.classes.length * v.n, 0);

/* 1. entidade exata */
const ents = new Map();
for (const [k, v] of bundles) if (v.n >= 2 && v.classes.length >= 4) ents.set(k, new Set(v.classes));
const usoEnt = [...ents.keys()].reduce((s, k) => s + bundles.get(k).classes.length * bundles.get(k).n, 0);

/* 2. composicao nucleo+extras: bundle nao-entidade que CONTEM uma entidade */
const inv = new Map();
for (const [ek, es] of ents) for (const c of es) { if (!inv.has(c)) inv.set(c, new Set()); inv.get(c).add(ek); }
const comp = new Set();
for (const [k, v] of bundles) {
  if (ents.has(k)) continue;
  const bs = new Set(v.classes);
  const cand = new Set();
  for (const c of bs) for (const ek of inv.get(c) ?? []) cand.add(ek);
  for (const ek of cand) {
    let sub = true;
    for (const c of ents.get(ek)) if (!bs.has(c)) { sub = false; break; }
    if (sub) { comp.add(k); break; }
  }
}
const usoComp = [...comp].reduce((s, k) => s + bundles.get(k).classes.length * bundles.get(k).n, 0);

/* seletores custom do CSS proprio (contratos existentes) */
const seletores = new Set();
for (const css of ["src/index.css", "src/styles/generated/motion-tokens.css", "src/styles/generated/system-tokens.css"]) {
  let t; try { t = readFileSync(path.join(ROOT, css), "utf8"); } catch { continue; }
  for (const m of t.matchAll(/\.([a-zA-Z][\w-]+)/g)) seletores.add(m[1]);
}

/* 3-7. classifica cada uso restante */
const cont = { tok: 0, custom: 0, arb: 0 };
const residuo = new Map(); // classe -> usos
for (const [k, v] of bundles) {
  if (ents.has(k) || comp.has(k)) continue;
  for (const c of v.classes) {
    if (TOK.test(c)) { cont.tok += v.n; continue; }
    const base = c.split(":").pop();
    if (seletores.has(base)) { cont.custom += v.n; continue; }
    if (ARB.test(c)) { cont.arb += v.n; continue; }
    residuo.set(c, (residuo.get(c) ?? 0) + v.n);
  }
}

/* 6. vocabulario: allowlist ate 95% do residuo; 7. o resto e excecao */
const ordenado = [...residuo.entries()].sort((a, b) => b[1] - a[1]);
const resUsos = ordenado.reduce((s, [, n]) => s + n, 0);
let cum = 0; const allow = [];
for (const [c, n] of ordenado) { if (cum >= resUsos * 0.95) break; allow.push([c, n]); cum += n; }
const excecao = resUsos - cum;

const soma = usoEnt + usoComp + cont.tok + cont.custom + cont.arb + cum + excecao;
if (soma !== total) {
  console.error(`PAROU: particao nao soma o universo — ${soma} != ${total}.`);
  console.error(`Particao que nao fecha 100% e oraculo mentindo. Investigue antes de usar.`);
  process.exit(1);
}

const R = {
  root: ROOT, universo: total,
  estratos: {
    entidadeExata: { entidades: ents.size, usos: usoEnt },
    entidadeComposicao: { bundles: comp.size, usos: usoComp },
    tokenizavelFamilia: { usos: cont.tok },
    contratoExistente: { usos: cont.custom },
    arbitraryDimensao: { usos: cont.arb },
    vocabularioLayout: { classes: allow.length, usos: cum },
    excecaoItemAItem: { usos: excecao },
  },
  topVocabulario: allow.slice(0, 15).map(([c, n]) => ({ classe: c, usos: n })),
};

if (JSON_OUT) { console.log(JSON.stringify(R, null, 1)); process.exit(0); }
const pc = (n) => `${((100 * n) / total).toFixed(1).padStart(5)}%`;
console.log(`measure-disposition · ${ROOT}`);
console.log(`universo (ruido de ternario removido): ${total} usos\n`);
console.log(`  1 entidade exata (${String(ents.size).padStart(3)})        ${String(usoEnt).padStart(6)}  ${pc(usoEnt)}   const exportado`);
console.log(`  2 entidade por composicao      ${String(usoComp).padStart(6)}  ${pc(usoComp)}   cn(NUCLEO, extras)`);
console.log(`  3 tokenizavel por familia      ${String(cont.tok).padStart(6)}  ${pc(cont.tok)}   token cor/spacing/radius/tipo`);
console.log(`  4 contrato custom EXISTENTE    ${String(cont.custom).padStart(6)}  ${pc(cont.custom)}   .tooltip, .input-label...`);
console.log(`  5 arbitrary -> token dimensao  ${String(cont.arb).padStart(6)}  ${pc(cont.arb)}   h-[34px], w-[300px]...`);
console.log(`  6 vocabulario layout (${String(allow.length).padStart(3)})    ${String(cum).padStart(6)}  ${pc(cum)}   allowlist 1 doc, ratchet`);
console.log(`  7 EXCECAO item-a-item          ${String(excecao).padStart(6)}  ${pc(excecao)}   listavel um a um`);
console.log(`  ${"─".repeat(58)}`);
console.log(`  SOMA                           ${String(soma).padStart(6)}  100.0%   (fail-closed: bate o universo)`);
