#!/usr/bin/env node
/**
 * normalize-vectors.mjs — F-B: propoe a normalizacao dos vetores nao-className.
 *
 *     node normalize-vectors.mjs --root <app> [--apply]
 *
 * SEM `--apply` ele nao toca em nada. Escreve a proposta e as evidencias. Isso
 * nao e timidez: mutacao sem prova de pixel e o defeito que este projeto inteiro
 * existe para eliminar, e a fase de prova (F-H) ainda nao esta construida.
 *
 * DUAS COISAS QUE O CENSO MUDOU:
 *
 * 1. Nao sao 224 conversoes. Os style={{}} formam 55 bundles, e os 3 maiores
 *    cobrem 86 dos 156 atributos. O maior de todos (49x) e DINAMICO, logo
 *    excecao legitima. Sobram 2 entidades reais.
 * 2. As cores do CSS se dividem por ORIGEM. So as 11 do `src/index.css` sao
 *    nossas. As 36 do realce de sintaxe do GitHub e as 43 do widget minificado
 *    sao de terceiro — viram excecao com owner, nao token.
 *
 * O casamento de cor usa deltaE2000 pelo `colorjs.io` do ALVO, mesma regra da
 * convergencia. Sem a lib, o script PARA: casar cor por igualdade de string
 * produziria "nenhum match" e isso pareceria "nada a fazer".
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { resolveRoot } from "./lib/paths.mjs";

const ROOT = resolveRoot();
const APPLY = process.argv.includes("--apply");
const DE_MAX = 2.3; // JND — abaixo disso o olho nao separa

/* ────────────────────────────────────────────────────── lib de cor do alvo ── */

let Color = null;
try {
  const req = createRequire(path.join(ROOT, "package.json"));
  const mod = await import(req.resolve("colorjs.io"));
  Color = [mod, mod.default, mod.default?.default, mod.Color, mod.default?.Color]
    .find((c) => typeof c === "function") ?? null;
} catch { /* tratado abaixo */ }
if (!Color) {
  console.error(
    `PAROU: colorjs.io nao resolve a partir de ${ROOT}.\n` +
    `  Casar cor por igualdade de string devolveria "nenhum match", e isso pareceria\n` +
    `  "nada a fazer". Falha fechada.  npm i -D colorjs.io`);
  process.exit(1);
}
/*
 * deltaE2000 IGNORA ALPHA — medido: `#cdcdcd40` (alpha 0,25) contra `#cdcdcdff`
 * (alpha 1,0) devolve 0,0000. Casar so por deltaE proporia trocar um cinza a 25%
 * por um token opaco, mudando a tela e reportando "imperceptivel".
 *
 * A convergencia NAO foi atingida por isso: ela compara aliases DTCG do tipo
 * {primitive.light.c-edece8}, e os 10 primitivos dominantes do alvo sao todos
 * opacos de 6 digitos. Aqui, que le valor CSS cru, o canal existe.
 */
function compara(a, b) {
  let ca, cb;
  try { ca = new Color(a); cb = new Color(b); } catch { return null; }
  const aa = ca.alpha ?? 1, ab = cb.alpha ?? 1;
  if (Math.abs(aa - ab) > 0.02) return { de: Infinity, motivo: `alpha ${aa.toFixed(2)} vs ${ab.toFixed(2)}` };
  try { return { de: ca.deltaE2000(cb), motivo: null }; } catch { return null; }
}

/* ─────────────────────────────────────────────── paleta de tokens do alvo ── */

const paleta = [];
for (const f of ["src/styles/generated/color-tokens.css", "src/index.css"]) {
  let t; try { t = readFileSync(path.join(ROOT, f), "utf8"); } catch { continue; }
  for (const m of t.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const nome = m[1], val = m[2].trim();
    if (/var\(/.test(val)) continue;
    if (!/^#|^rgb|^hsl|^oklch/.test(val)) continue;
    // A LINHA da declaracao, para nao casar um valor contra si mesmo. Sem isso o
    // script propunha trocar `#3182ce` por `var(--rti-main)` na propria linha
    // `--rti-main: #3182ce` — recursao infinita apresentada como melhoria.
    const linha = t.slice(0, m.index).split("\n").length;
    paleta.push({ nome, val, arquivo: f, linha });
  }
}

function casar(cor, arquivoOrigem, linhaOrigem) {
  let best = null;
  for (const p of paleta) {
    if (p.arquivo === arquivoOrigem && p.linha === linhaOrigem) continue; // nao casar consigo
    const r = compara(cor, p.val);
    if (!r) continue;
    if (!best || r.de < best.de) best = { ...p, de: r.de, motivo: r.motivo };
  }
  return best;
}

/* ──────────────────────────────────────────────────────────── a proposta ── */

const L = [];
L.push("# F-B `NORMALIZE` — proposta");
L.push("");
L.push("**Nada foi aplicado.** Este documento e a proposta e a evidencia; a mutacao");
L.push("exige a prova de pixel de F-H, que ainda nao existe.");
L.push("");

/* 1. as cores do CSS do app */
const CSS_APP = "src/index.css";
let cssTxt = "";
try { cssTxt = readFileSync(path.join(ROOT, CSS_APP), "utf8"); } catch {}
const cores = [];
for (const m of cssTxt.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
  cores.push({ line: cssTxt.slice(0, m.index).split("\n").length, val: m[0] });
}
for (const m of cssTxt.matchAll(/:\s*(white|black)\s*[;!]/g)) {
  cores.push({ line: cssTxt.slice(0, m.index).split("\n").length, val: m[1] });
}

L.push(`## 1. Cores cravadas em \`${CSS_APP}\` — ${cores.length}`);
L.push("");
L.push(`Casadas por ΔE2000 contra ${paleta.length} tokens do alvo. ΔE ≤ ${DE_MAX} = imperceptivel.`);
L.push("");
L.push("| linha | valor | token mais proximo | ΔE | proposta |");
L.push("|---:|---|---|---:|---|");
let casadas = 0;
for (const c of cores.sort((a, b) => a.line - b.line)) {
  const m = casar(c.val, CSS_APP, c.line);
  const ok = m && m.de <= DE_MAX;
  if (ok) casadas++;
  const deTxt = !m ? "—" : Number.isFinite(m.de) ? m.de.toFixed(2) : "∞";
  const prop = ok ? `→ \`var(${m.nome})\`` : m?.motivo ? `**exceção** — ${m.motivo}` : "**exceção** — sem token equivalente";
  L.push(`| ${c.line} | \`${c.val}\` | ${m ? `\`${m.nome}\`` : "—"} | ${deTxt} | ${prop} |`);
}
L.push("");
L.push(`**${casadas} de ${cores.length}** tem token equivalente dentro do limiar.`);
L.push("");

/* 2. as entidades de style inline */
const STYLE = /style=\{\{([^}]*)\}/g;
const CODE = new Set([".js", ".jsx", ".ts", ".tsx"]);
const SKIP = new Set(["node_modules", ".git", "dist", "build", ".tokenize"]);
function walk(d, out = []) {
  let e; try { e = readdirSync(d, { withFileTypes: true }); } catch { return out; }
  for (const x of e) {
    if (SKIP.has(x.name)) continue;
    const p = path.join(d, x.name);
    if (x.isDirectory()) walk(p, out); else if (CODE.has(path.extname(x.name))) out.push(p);
  }
  return out;
}
const bundles = new Map();
for (const f of walk(path.join(ROOT, "src"))) {
  let t; try { t = readFileSync(f, "utf8"); } catch { continue; }
  for (const m of t.matchAll(STYLE)) {
    const decls = [];
    for (const par of m[1].split(",")) {
      const i = par.indexOf(":");
      if (i < 0) continue;
      const k = par.slice(0, i).trim(), v = par.slice(i + 1).trim();
      if (k && v) decls.push({ k, v });
    }
    if (!decls.length) continue;
    const key = decls.map((d) => `${d.k}:${d.v}`).sort().join(" | ");
    const cur = bundles.get(key) ?? { n: 0, decls, sites: [] };
    cur.n++;
    cur.sites.push(`${path.relative(ROOT, f)}:${t.slice(0, m.index).split("\n").length}`);
    bundles.set(key, cur);
  }
}

/** Propriedade CSS -> classe Tailwind. Tabela pequena de proposito: so o que aparece. */
const MAPA = {
  maxWidth: (v) => `max-w-[${v}]`, whiteSpace: (v) => (v === "normal" ? "whitespace-normal" : null),
  wordWrap: (v) => (v === "break-word" ? "break-words" : null), minHeight: (v) => `min-h-[${v}]`,
  overflowY: (v) => (v === "scroll" ? "overflow-y-scroll" : v === "auto" ? "overflow-y-auto" : null),
  resize: (v) => (v === "vertical" ? "resize-y" : v === "none" ? "resize-none" : null),
  width: (v) => (v === "100%" ? "w-full" : `w-[${v}]`), display: (v) => (v === "contents" ? "contents" : null),
  borderRadius: (v) => `rounded-[${v}]`, position: (v) => v,
};
const DINAMICO = /calc\(|\?|`|\$\{/;
const lit = (v) => v.replace(/^["']|["']$/g, "");

const ord = [...bundles.entries()].sort((a, b) => b[1].n - a[1].n);
const entidades = ord.filter(([, v]) => v.n >= 2 && !v.decls.some((d) => DINAMICO.test(d.v)));
const dinamicos = ord.filter(([, v]) => v.decls.some((d) => DINAMICO.test(d.v)));

L.push(`## 2. \`style={{}}\` — ${bundles.size} bundles distintos`);
L.push("");
L.push(`| | bundles | atributos |`);
L.push(`|---|---:|---:|`);
L.push(`| **entidades** (repete ≥2×, estatico) | ${entidades.length} | ${entidades.reduce((s, [, v]) => s + v.n, 0)} |`);
L.push(`| **dinamico** → exceção | ${dinamicos.length} | ${dinamicos.reduce((s, [, v]) => s + v.n, 0)} |`);
L.push(`| unico estatico → exceção | ${ord.length - entidades.length - dinamicos.length} | ${ord.filter(([, v]) => v.n === 1 && !v.decls.some((d) => DINAMICO.test(d.v))).reduce((s, [, v]) => s + v.n, 0)} |`);
L.push("");
L.push("### Entidades, com a classe proposta");
L.push("");
for (const [, v] of entidades) {
  const cls = v.decls.map((d) => (MAPA[d.k] ? MAPA[d.k](lit(d.v)) : null));
  const completo = cls.every(Boolean);
  L.push(`**${v.n}×** — ${v.decls.map((d) => `\`${d.k}: ${d.v}\``).join(" · ")}`);
  L.push("");
  L.push(completo ? `→ \`className="${cls.join(" ")}"\`` : `→ **incompleto**: ${v.decls.filter((d, i) => !cls[i]).map((d) => `\`${d.k}\``).join(", ")} sem mapeamento. Fica como exceção ate a tabela cobrir.`);
  L.push("");
  L.push(`<small>${v.sites.slice(0, 3).join(" · ")}${v.sites.length > 3 ? ` · +${v.sites.length - 3}` : ""}</small>`);
  L.push("");
}
L.push("### Dinamicos — exceção legitima, com motivo");
L.push("");
L.push("| usos | bundle | motivo |");
L.push("|---:|---|---|");
for (const [, v] of dinamicos.slice(0, 10)) {
  const d = v.decls.map((x) => `${x.k}: ${x.v}`).join(" · ").slice(0, 70);
  L.push(`| ${v.n} | \`${d}\` | valor calculado em runtime — nao e decisao de design |`);
}
L.push("");

const out = path.join(ROOT, "docs/reports/normalize-proposta.md");
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, L.join("\n") + "\n");

console.log(`proposta: ${path.relative(ROOT, out)}`);
console.log(`  paleta do alvo         ${paleta.length} tokens`);
console.log(`  cores em ${CSS_APP}  ${cores.length}  (${casadas} com token dentro de ΔE ${DE_MAX})`);
console.log(`  bundles style={{}}     ${bundles.size}  (${entidades.length} entidades, ${dinamicos.length} dinamicos)`);
if (!APPLY) console.log(`\n  NADA foi aplicado. --apply exige a prova de pixel de F-H, que nao existe ainda.`);
