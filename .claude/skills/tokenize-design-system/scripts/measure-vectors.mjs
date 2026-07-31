#!/usr/bin/env node
/**
 * measure-vectors.mjs — o censo dos vetores de estilo que NAO sao className.
 *
 *     node measure-vectors.mjs --root <app> [--json]
 *
 * Por que existe: `measure-coverage.mjs` so enxerga `className`. A prova da fase
 * NORMALIZE citava aquele script, mas o entregavel dela sao `style={{}}` e o CSS
 * escrito a mao — que ele nao toca. A prova nao cobria o entregavel, e a review
 * adversarial pegou.
 *
 * O ponto que justifica a fase, e que nao e de volume: `className` e ~99% da
 * superficie. Um `style={{ color:'#fff' }}` nao e um 32.662-avos do problema —
 * ele CONTORNA o sistema inteiro e nao aparece em gate nenhum. Vetor nao medido
 * e vazamento por definicao.
 *
 * CLASSIFICACAO, e a distincao que mais me custou:
 *
 *   cravado      valor literal sem token por tras. E o alvo.
 *   token        `var(--x)` ou `rgb(var(--x-rgb) / a)`. E o padrao CANONICO de
 *                composicao de alpha do alvo, nao violacao. Eu contei essas 19
 *                ocorrencias como "cor cravada" em duas versoes seguidas do
 *                plano — contei o uso CORRETO do design system como defeito.
 *   dinamico     `calc()`, ternario, referencia a variavel JS. Fica: e layout
 *                dinamico, nao decisao de design. Vira excecao declarada.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { resolveRoot } from "./lib/paths.mjs";

const ROOT = resolveRoot();
const JSON_OUT = process.argv.includes("--json");

const SKIP = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", ".tokenize"]);
const CODE = new Set([".js", ".jsx", ".ts", ".tsx"]);

function walk(dir, out = []) {
  let e;
  try { e = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const x of e) {
    if (SKIP.has(x.name)) continue;
    const p = path.join(dir, x.name);
    if (x.isDirectory()) walk(p, out);
    else if (CODE.has(path.extname(x.name)) || x.name.endsWith(".css")) out.push(p);
  }
  return out;
}

const arquivos = walk(ROOT);
/*
 * Nem todo .css e alvo, e somar os quatro produz numero sem sentido. Classes:
 *
 *   gerado    saida do tokens:build. Nao e entrada — ignorado.
 *   vendor    artefato de build de terceiro (minificado, 1 linha). No alvo e o
 *             widget de embed: 46 cores cravadas que nao sao decisao NOSSA de
 *             design. Tokenizar isso seria editar build de outra pessoa.
 *   tema      esquema de cor de terceiro — aqui o realce de sintaxe do GitHub,
 *             36 cores. E paleta COPIADA de outro produto: candidata natural a
 *             EXCECAO com owner e reason, nao a token.
 *   app       CSS escrito a mao pelo time. E o alvo de verdade.
 */
function classificarCss(rel) {
  if (rel.includes("generated")) return "gerado";
  if (/\.min\.css$/.test(rel) || rel.startsWith("public/")) return "vendor";
  if (/\/themes?\//.test(rel)) return "tema";
  return "app";
}
const csss = arquivos.filter((f) => f.endsWith(".css") && classificarCss(path.relative(ROOT, f)) !== "gerado");
const codes = arquivos.filter((f) => CODE.has(path.extname(f)));

/* ─────────────────────────────────────────────────── style={{ }} inline ── */

const STYLE = /style=\{\{([^}]*)\}/g;
const inline = { total: 0, cravado: [], dinamico: [], token: [] };
for (const f of codes) {
  let t; try { t = readFileSync(f, "utf8"); } catch { continue; }
  for (const m of t.matchAll(STYLE)) {
    const corpo = m[1];
    const linha = t.slice(0, m.index).split("\n").length;
    for (const par of corpo.split(",")) {
      const [k, ...rest] = par.split(":");
      const prop = (k ?? "").trim();
      const val = rest.join(":").trim();
      if (!prop || !val) continue;
      inline.total++;
      const reg = { file: path.relative(ROOT, f), line: linha, prop, val: val.slice(0, 60) };
      if (/var\(--/.test(val)) inline.token.push(reg);
      else if (/calc\(|\?|`|\$\{|[A-Za-z_$][\w$]*\s*(\.|$)/.test(val) && !/^["'#]/.test(val)) inline.dinamico.push(reg);
      else inline.cravado.push(reg);
    }
  }
}

/* ───────────────────────────────────────────────────── CSS escrito a mao ── */

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const FUNCOR = /rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)/g;
const NOMECOR = /:\s*(white|black|red|blue|green|transparent|currentColor)\s*[;!]/g;
const PX = /(?<![\w-])(\d+(?:\.\d+)?)px/g;

const css = { arquivos: [], corCravada: [], corPorToken: 0, px: [], pxDistintos: new Set(), varConsumido: 0 };
for (const f of csss) {
  let t; try { t = readFileSync(f, "utf8"); } catch { continue; }
  const rel = path.relative(ROOT, f);
  const classe = classificarCss(rel);
  css.arquivos.push({ file: rel, linhas: t.split("\n").length, classe });
  css.varConsumido += (t.match(/var\(--/g) ?? []).length;
  const linhaDe = (i) => t.slice(0, i).split("\n").length;
  for (const m of t.matchAll(HEX)) css.corCravada.push({ file: rel, line: linhaDe(m.index), val: m[0], tipo: "hex", classe });
  for (const m of t.matchAll(FUNCOR)) {
    // rgb(var(--x-rgb) / a) e CONSUMO de token, nao cor cravada.
    if (/var\(--/.test(m[0])) css.corPorToken++;
    else css.corCravada.push({ file: rel, line: linhaDe(m.index), val: m[0].slice(0, 40), tipo: "funcao", classe });
  }
  for (const m of t.matchAll(NOMECOR)) {
    if (m[1] === "transparent" || m[1] === "currentColor") continue;
    css.corCravada.push({ file: rel, line: linhaDe(m.index), val: m[1], tipo: "nome", classe });
  }
  for (const m of t.matchAll(PX)) { css.px.push({ file: rel, line: linhaDe(m.index), val: m[0], classe }); if (classe === "app") css.pxDistintos.add(m[0]); }
}

const R = {
  root: ROOT,
  inline: { total: inline.total, cravado: inline.cravado.length, dinamico: inline.dinamico.length, token: inline.token.length },
  css: {
    arquivos: css.arquivos,
    varConsumido: css.varConsumido,
    corPorToken: css.corPorToken,
    corCravada: css.corCravada.length,
    corCravadaDetalhe: css.corCravada,
    px: css.px.length,
    pxDistintos: css.pxDistintos.size,
  },
  amostraInlineCravado: inline.cravado.slice(0, 8),
};

if (JSON_OUT) { console.log(JSON.stringify(R, null, 1)); process.exit(0); }

console.log(`measure-vectors · ${ROOT}\n`);
console.log(`style={{ }} inline — ${inline.total} declaracoes`);
console.log(`  cravado (ALVO)          ${inline.cravado.length}`);
console.log(`  dinamico (fica, excecao) ${inline.dinamico.length}`);
console.log(`  ja usa var(--token)      ${inline.token.length}`);
console.log(`\nCSS escrito a mao — ${css.arquivos.length} arquivo(s)`);
for (const a of css.arquivos) console.log(`  ${a.file}  ${a.linhas} linhas`);
console.log(`  var(--token) consumidos  ${css.varConsumido}`);
console.log(`  cor por token (rgb(var)) ${css.corPorToken}   <- padrao canonico, NAO e violacao`);
const porClasse = (k) => css.corCravada.filter((c) => c.classe === k);
console.log(`  COR CRAVADA por classe de arquivo:`);
for (const k of ["app", "tema", "vendor"]) {
  const n = porClasse(k).length;
  const rot = k === "app" ? "ALVO" : k === "tema" ? "excecao provavel (paleta de terceiro)" : "fora de escopo (build de terceiro)";
  console.log(`    ${k.padEnd(7)} ${String(n).padStart(3)}   ${rot}`);
}
console.log(`  detalhe do ALVO:`);
for (const c of porClasse("app")) console.log(`      ${c.file}:${c.line}  ${c.val}  [${c.tipo}]`);
const pxApp = css.px.filter((x) => x.classe === "app");
console.log(`  px no ALVO               ${pxApp.length}  (${css.pxDistintos.size} distintos)`);
console.log(`  px em tema/vendor        ${css.px.length - pxApp.length}  (nao contam)`);
if (inline.cravado.length) {
  console.log(`\namostra de style inline cravado:`);
  for (const c of R.amostraInlineCravado) console.log(`  ${c.file}:${c.line}  ${c.prop}: ${c.val}`);
}
