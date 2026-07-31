#!/usr/bin/env node
/**
 * Mapeia cada ocorrencia de um padrao de className ao seu CONTEXTO DE USO.
 *
 * POR QUE EXISTE. O relatorio de decisoes contava variantes ("4 formas de
 * rotulo, 274 call sites") e perguntava ao dono qual delas vence. Era a
 * pergunta errada, e ele recusou com razao: a resposta depende de ONDE cada
 * forma aparece — container de botao, sidebar clicavel, subtitulo, rodape de
 * tabela sao situacoes diferentes e podem legitimamente merecer tratamento
 * diferente. "Padronizar sem engessar" so e decidivel com o mapa do uso.
 *
 * O criterio que este script serve, declarado pelo dono como maxima:
 * A USABILIDADE DA SITUACAO DE USO decide. Nao a contagem, nao a preferencia.
 *
 * O que ele extrai por ocorrencia:
 *   variante   qual das formas concorrentes casou
 *   tag        o elemento que carrega a classe (label, div, span...)
 *   area       regiao do app derivada do path (pages/X/Y, components/Z)
 *   paiTag     o elemento PAI imediato
 *   paiCls     as classes do pai — e o container que decide o espacamento,
 *              e portanto quem determina se a margem do filho e redundante
 *
 * Uso:
 *   node scripts/map-usage-context.mjs --preset rotulos
 *   node scripts/map-usage-context.mjs --preset gaps --json > mapa.json
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import console from "node:console";
import { parse } from "@babel/parser";

const AQUI = path.dirname(new URL(import.meta.url).pathname);
/*
 * A raiz do APP medido. No repo canonico do processo nao existe `src/` — este
 * script sempre roda contra um alvo, entao TOKENIZE_APP_ROOT e o caminho normal
 * e o fallback relativo so serve para a copia vendorizada dentro do alvo.
 */
const RAIZ = path.resolve(process.env.TOKENIZE_APP_ROOT || path.join(AQUI, ".."), "src");

const PRESETS = {
  /** As 4 formas concorrentes de rotulo de formulario (D2). */
  rotulos: {
    "semibold+mb-3": (c) => /font-semibold/.test(c) && /\bmb-3\b/.test(c),
    "medium+mb-2": (c) => /font-medium/.test(c) && /\bmb-2\b/.test(c),
    "semibold+mb-2": (c) => /font-semibold/.test(c) && /\bmb-2\b/.test(c),
    "semibold+sem-margem": (c) => /font-semibold/.test(c) && !/\bmb-\d/.test(c),
  },
  /** Os 5 valores de gap sobre o mesmo padrao estrutural (D3). */
  gaps: {
    "gap-y-1": (c) => /\bgap-y-1\b/.test(c),
    "gap-y-4": (c) => /\bgap-y-4\b/.test(c),
    "gap-y-7": (c) => /\bgap-y-7\b/.test(c),
    "gap-x-2": (c) => /\bgap-x-2\b/.test(c),
    "gap-s36": (c) => /\bgap-s36\b/.test(c),
  },
};

const argv = process.argv.slice(2);
const arg = (n, d = null) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const PRESET = arg("--preset", "rotulos");
const COMO_JSON = argv.includes("--json");
const variantes = PRESETS[PRESET];
if (!variantes) {
  console.error(`preset desconhecido: ${PRESET}. Disponiveis: ${Object.keys(PRESETS).join(", ")}`);
  process.exit(2);
}

const PULAR = new Set(["node_modules", ".git", "dist", "build"]);
function varrer(d, saida = []) {
  let itens;
  try { itens = readdirSync(d, { withFileTypes: true }); } catch { return saida; }
  for (const x of itens) {
    if (PULAR.has(x.name)) continue;
    const p = path.join(d, x.name);
    if (x.isDirectory()) varrer(p, saida);
    else if (/\.(jsx?|tsx?)$/.test(x.name)) saida.push(p);
  }
  return saida;
}

/**
 * Caminha o AST carregando a pilha de JSXElement ancestrais. Sem
 * @babel/traverse de proposito: visita todo objeto com `type`, e nao erra por
 * faltar um tipo no mapa de visitas.
 */
function caminhar(node, visitar, pais = []) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const filho of node) caminhar(filho, visitar, pais);
    return;
  }
  if (typeof node.type === "string") visitar(node, pais);
  const proximos = node.type === "JSXElement" ? [...pais, node] : pais;
  for (const chave of Object.keys(node)) {
    if (chave === "loc" || chave === "leadingComments" || chave === "trailingComments") continue;
    caminhar(node[chave], visitar, proximos);
  }
}

function classesDe(el) {
  const attr = el?.openingElement?.attributes?.find(
    (a) => a.type === "JSXAttribute" && a.name?.name === "className"
  );
  if (!attr?.value) return null;
  if (attr.value.type === "StringLiteral") return attr.value.value;
  return "<dinamico>";
}
const nomeTag = (el) => el?.openingElement?.name?.name ?? "?";

function areaDe(arquivo) {
  const rel = path.relative(RAIZ, arquivo);
  const seg = rel.split("/");
  if (seg[0] === "pages") return ["pages", seg[1], seg[2]].filter(Boolean).join("/");
  if (seg[0] === "components") return ["components", seg[1]].filter(Boolean).join("/");
  return seg[0];
}

const ocorrencias = [];
let dinamicos = 0;
for (const arquivo of varrer(RAIZ)) {
  let fonte;
  try { fonte = readFileSync(arquivo, "utf8"); } catch { continue; }
  let ast;
  try {
    ast = parse(fonte, {
      sourceType: "module",
      plugins: ["jsx", "typescript", "classProperties", "optionalChaining", "nullishCoalescingOperator", "dynamicImport", "objectRestSpread"],
    });
  } catch { continue; }

  caminhar(ast, (node, pais) => {
    if (node.type !== "JSXElement") return;
    const cls = classesDe(node);
    if (!cls) return;
    if (cls === "<dinamico>") { dinamicos += 1; return; }
    const variante = Object.entries(variantes).find(([, testar]) => testar(cls))?.[0];
    if (!variante) return;
    const pai = [...pais].reverse().find((p) => p !== node);
    ocorrencias.push({
      variante,
      tag: nomeTag(node),
      area: areaDe(arquivo),
      arquivo: path.relative(RAIZ, arquivo),
      linha: node.loc?.start?.line ?? 0,
      paiTag: pai ? nomeTag(pai) : "-",
      paiCls: (pai ? classesDe(pai) : null) ?? "-",
    });
  });
}

if (COMO_JSON) {
  console.log(JSON.stringify({ preset: PRESET, dinamicosIgnorados: dinamicos, ocorrencias }, null, 2));
} else {
  console.log(`mapa de uso · preset ${PRESET}`);
  console.log(`  ocorrencias: ${ocorrencias.length}   className dinamico ignorado: ${dinamicos}`);
  const porVariante = new Map();
  for (const o of ocorrencias) {
    if (!porVariante.has(o.variante)) porVariante.set(o.variante, []);
    porVariante.get(o.variante).push(o);
  }
  for (const [variante, lista] of [...porVariante].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n  ${variante}  (${lista.length})`);
    const areas = new Map();
    for (const o of lista) areas.set(o.area, (areas.get(o.area) ?? 0) + 1);
    for (const [a, n] of [...areas].sort((x, y) => y[1] - x[1]).slice(0, 6)) {
      console.log(`    ${String(n).padStart(4)}  ${a}`);
    }
    const tags = new Map();
    for (const o of lista) tags.set(o.tag, (tags.get(o.tag) ?? 0) + 1);
    console.log(`    tags: ${[...tags].sort((x, y) => y[1] - x[1]).map(([t, n]) => `${t}=${n}`).join(" ")}`);
    const comGapNoPai = lista.filter((o) => /\bgap-/.test(o.paiCls)).length;
    console.log(`    pai com gap-*: ${comGapNoPai} de ${lista.length}`);
  }
}
