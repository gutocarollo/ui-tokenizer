#!/usr/bin/env node
/**
 * audit-extraction-delta.mjs — o que a correcao do parser TIROU e o que ela PÔS.
 *
 *     node audit-extraction-delta.mjs --root <app> [--json] [--top N]
 *
 * POR QUE EXISTE. Trocar o extrator de classes muda o DENOMINADOR de todas as
 * fases. Um numero novo que so aparece como "31.726 -> 31.950" nao prova nada:
 * pode ser ruido saindo, pode ser classe legitima sumindo, pode ser as duas
 * coisas se cancelando. A pergunta que decide se a correcao esta certa e:
 *
 *     a correcao PERDE classe legitima?  Se perde, esta errada.
 *
 * Este script responde com o multiset completo, item a item. Ele carrega os
 * regex ANTIGOS VERBATIM (copiados de `lib/bundle-census.mjs` e
 * `measure-disposition.mjs` antes da correcao) e roda os dois extratores sobre
 * exatamente o mesmo conjunto de arquivos.
 *
 * As tres colunas que importam:
 *   RECUPERADO  classe que so o extrator NOVO enxerga  -> ganho
 *   PERDIDO     classe que so o extrator ANTIGO enxergava -> risco, tem que ser
 *               explicavel item a item (ruido) ou a correcao esta errada
 *   IGUAL       mesma classe, mesma contagem
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { resolveRoot } from "./lib/paths.mjs";
import { classNameAttributes } from "./lib/classname-extract.mjs";
import { pareceClasseUtil } from "./lib/bundle-census.mjs";

const ROOT = resolveRoot();
const argv = process.argv.slice(2);
const JSON_OUT = argv.includes("--json");
const TOP = Number(argv[argv.indexOf("--top") + 1]) || 30;

/* ── os regex ANTIGOS, verbatim ─────────────────────────────────────────────
 * `CLS` era a fonte unica de "classe" antes da correcao; `RUIDO` era o
 * paliativo que `measure-disposition.mjs` aplicava DEPOIS do split — o unico
 * dos quatro consumidores que tinha o paliativo.
 */
const CLS_ANTIGO = /className\s*=\s*(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g;
const RUIDO_ANTIGO = /^[?:}{)(]$|^["']/;

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

const inc = (m, k, n = 1) => m.set(k, (m.get(k) ?? 0) + n);

const antigoBruto = new Map();  // sem o paliativo — o que os 3 outros scripts viam
const antigoFiltrado = new Map(); // com o paliativo de measure-disposition
const novo = new Map();

/**
 * `--all` varre o ROOT inteiro (o escopo de `measure-coverage.mjs`); o default
 * e `src/` (o escopo de `measure-disposition.mjs`). Os dois oraculos tem escopos
 * diferentes de nascenca; comparar o delta de um com o universo do outro seria
 * atribuir a correcao do parser uma diferenca que e de ESCOPO.
 */
const ESCOPO = argv.includes("--all") ? ROOT : path.join(ROOT, "src");
const arquivos = walk(ESCOPO);
for (const f of arquivos) {
  let t; try { t = readFileSync(f, "utf8"); } catch { continue; }

  for (const m of t.matchAll(CLS_ANTIGO)) {
    const cs = [m[1], m[2], m[3]].filter(Boolean).join(" ").split(/\s+/)
      .filter((c) => c && !c.startsWith("$") && !c.includes("${"));
    for (const c of cs) {
      inc(antigoBruto, c);
      if (!RUIDO_ANTIGO.test(c)) inc(antigoFiltrado, c);
    }
  }

  for (const at of classNameAttributes(t)) for (const c of at.classes) inc(novo, c);
}

const soma = (m) => [...m.values()].reduce((s, n) => s + n, 0);

/** Delta por classe contra a base escolhida. */
function delta(base) {
  const ganho = [], perda = [];
  for (const [c, n] of novo) {
    const b = base.get(c) ?? 0;
    if (n > b) ganho.push([c, n - b]);
  }
  for (const [c, n] of base) {
    const d = novo.get(c) ?? 0;
    if (n > d) perda.push([c, n - d]);
  }
  ganho.sort((a, b) => b[1] - a[1]);
  perda.sort((a, b) => b[1] - a[1]);
  return { ganho, perda, ganhoUsos: soma(new Map(ganho)), perdaUsos: soma(new Map(perda)) };
}

const vsBruto = delta(antigoBruto);
const vsFiltrado = delta(antigoFiltrado);

/** O ruido que o extrator antigo fabricava, pela definicao do paliativo. */
const ruido = [...antigoBruto.entries()].filter(([c]) => RUIDO_ANTIGO.test(c));

const R = {
  root: ROOT,
  arquivos: arquivos.length,
  universo: {
    antigoBruto: soma(antigoBruto),
    antigoFiltrado: soma(antigoFiltrado),
    novo: soma(novo),
  },
  ruidoFabricadoPeloAntigo: { classes: ruido.length, usos: soma(new Map(ruido)), top: ruido.sort((a, b) => b[1] - a[1]).slice(0, TOP) },
  vsAntigoBruto: { ganhoUsos: vsBruto.ganhoUsos, perdaUsos: vsBruto.perdaUsos },
  vsAntigoFiltrado: {
    ganhoUsos: vsFiltrado.ganhoUsos,
    perdaUsos: vsFiltrado.perdaUsos,
    recuperadas: vsFiltrado.ganho.slice(0, TOP),
    perdidas: vsFiltrado.perda.slice(0, TOP),
    perdidasTodas: vsFiltrado.perda,
  },
};

/**
 * ── O GATE ────────────────────────────────────────────────────────────────────
 *
 * "O universo mudou" não é resultado. A pergunta que decide é se alguma classe
 * LEGÍTIMA sumiu, e ela é respondida com a definição de classe do próprio
 * `lib/bundle-census.mjs` (`pareceClasseUtil`), não com um critério novo escrito
 * aqui — senão o gate julgaria a correção com a régua da correção.
 *
 * Perda EXPLICADA = o token perdido não tem forma de utility (`===`, `index`,
 * `block.isExpanded`, `hover:bg-x"` com a aspa colada). Perda INEXPLICADA =
 * token com forma de utility que sumiu: isso é regressão, e o script sai 1.
 *
 * A perda PARCIAL (o token existe nos dois, com contagem menor no novo) tem
 * linha própria porque é o caso ambíguo: no alvo há exatamente um,
 * `selected` 13 -> 4, e ele é o par `variável JS` x `classe custom .selected`
 * de `file-row` — as 9 perdidas vêm de `${ selected ? … }` e as 4 que ficam vêm
 * do literal `"selected light:text-content-…"`. Fica listado, nunca silencioso.
 */
const parciais = [];
for (const [c, n] of antigoFiltrado) {
  const d = novo.get(c) ?? 0;
  if (n > d && d > 0) parciais.push({ classe: c, antigo: n, novo: d });
}
const inexplicadas = vsFiltrado.perda.filter(([c]) => pareceClasseUtil(c));
R.gate = {
  perdaTotalUsos: vsFiltrado.perdaUsos,
  perdaExplicadaClasses: vsFiltrado.perda.length - inexplicadas.length,
  perdaInexplicada: inexplicadas,
  perdaParcial: parciais,
  ganhoSemFormaDeUtility: vsFiltrado.ganho.filter(([c]) => !pareceClasseUtil(c)),
};

if (JSON_OUT) { console.log(JSON.stringify(R, null, 1)); process.exit(0); }

console.log(`audit-extraction-delta · ${ESCOPO}  (${arquivos.length} arquivos)\n`);
console.log(`universo de usos de classe`);
console.log(`  extrator ANTIGO, cru            ${R.universo.antigoBruto}`);
console.log(`  extrator ANTIGO + paliativo     ${R.universo.antigoFiltrado}   <- o que measure-disposition imprimia`);
console.log(`  extrator NOVO                   ${R.universo.novo}\n`);
console.log(`ruido FABRICADO pelo extrator antigo: ${R.ruidoFabricadoPeloAntigo.usos} usos em ${R.ruidoFabricadoPeloAntigo.classes} tokens`);
for (const [c, n] of R.ruidoFabricadoPeloAntigo.top.slice(0, 10)) console.log(`   ${String(n).padStart(5)}  ${JSON.stringify(c)}`);
console.log(`\ncontra o ANTIGO+paliativo (base honesta):`);
console.log(`  RECUPERADO  ${vsFiltrado.ganhoUsos} usos em ${vsFiltrado.ganho.length} classes`);
for (const [c, n] of vsFiltrado.ganho.slice(0, TOP)) console.log(`   +${String(n).padStart(4)}  ${c}`);
console.log(`\n  PERDIDO     ${vsFiltrado.perdaUsos} usos em ${vsFiltrado.perda.length} tokens`);
if (!vsFiltrado.perda.length) console.log(`   (nenhum)`);
for (const [c, n] of vsFiltrado.perda.slice(0, TOP)) console.log(`   -${String(n).padStart(4)}  ${JSON.stringify(c)}`);

console.log(`\nGATE (regua = pareceClasseUtil de lib/bundle-census.mjs)`);
console.log(`  tokens perdidos SEM forma de utility (explicado)  ${R.gate.perdaExplicadaClasses}`);
console.log(`  tokens perdidos COM forma de utility (REGRESSAO)  ${R.gate.perdaInexplicada.length}`);
for (const [c, n] of R.gate.perdaInexplicada) console.log(`     -${String(n).padStart(4)}  ${c}`);
console.log(`  perda PARCIAL (existe nos dois, contagem menor)   ${R.gate.perdaParcial.length}`);
for (const p of R.gate.perdaParcial) console.log(`     ${p.classe}  ${p.antigo} -> ${p.novo}`);
console.log(`  ganho SEM forma de utility (suspeito)             ${R.gate.ganhoSemFormaDeUtility.length}`);
for (const [c, n] of R.gate.ganhoSemFormaDeUtility.slice(0, TOP)) console.log(`     +${String(n).padStart(4)}  ${c}`);

if (R.gate.perdaInexplicada.length) {
  console.error(`\nPAROU: ${R.gate.perdaInexplicada.length} token(s) com forma de utility desapareceram do universo.`);
  console.error(`Correcao de parser que custa ocorrencia legitima esta errada, mesmo que o numero fique mais bonito.`);
  process.exit(1);
}
