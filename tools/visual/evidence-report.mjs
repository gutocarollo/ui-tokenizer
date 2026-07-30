#!/usr/bin/env node
/**
 * evidence-report.mjs — pareia dois labels de evidencia num relatorio markdown
 * com os PNGs de ANTES e DEPOIS lado a lado, e uma linha de veredito por par
 * que a LLM tem que preencher OLHANDO a imagem.
 *
 * Por que o relatorio existe separado da captura: a captura prova que a tela
 * renderizou. Ela NAO prova que a tela ficou certa. Nesta sessao eu declarei
 * "limpo" tres vezes lendo diff e manifest — e o dono achou o defeito na tela.
 * O relatorio e o artefato que obriga a passar pelo pixel.
 *
 * Tres sinais que o script extrai sozinho (deterministicos):
 *
 *   1. sha identico  -> a tela NAO mudou. Se a refatoracao devia mudar, e BUG.
 *                       Se nao devia, e a prova de que nao houve regressao.
 *   2. sha diferente -> mudou. O script NAO sabe se para melhor: linha de
 *                       veredito obrigatoria, preenchida por quem OLHA.
 *   3. par ausente   -> capturou no antes e nao no depois (ou o contrario).
 *                       Rota que parou de renderizar aparece aqui, nao no PNG.
 *
 * E um sinal que ele compara: erro de console NOVO no depois = regressao, e
 * bloqueia (exit 1) sem precisar de olho humano.
 *
 * Uso:
 *   node scripts/evidence-report.mjs --before <label> --after <label> \
 *        [--out docs/reports/<data>-<slug>.md] [--title "..."]
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const REPO = path.resolve(ROOT, "..");
const EVID = path.join(REPO, ".claude/evidence");

function arg(nome, padrao = null) {
  const i = process.argv.indexOf(nome);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
}

const labelAntes = arg("--before");
const labelDepois = arg("--after");
if (!labelAntes || !labelDepois) {
  console.error("uso: --before <label> --after <label> [--out <path.md>] [--title <t>]");
  process.exit(2);
}

/* ------------------------------------------------------------------ leitura */

function carregar(label) {
  const dir = path.join(EVID, label);
  if (!existsSync(dir)) { console.error(`label inexistente: ${dir}`); process.exit(2); }
  const mf = path.join(dir, "manifest.json");
  const manifest = existsSync(mf) ? JSON.parse(readFileSync(mf, "utf8")) : null;
  if (!manifest) { console.error(`sem manifest.json em ${dir}`); process.exit(2); }
  const pngs = readdirSync(dir).filter((f) => f.endsWith(".png"));
  return { label, dir, manifest, pngs };
}

const A = carregar(labelAntes);
const B = carregar(labelDepois);

/**
 * GUARDA DE VACUIDADE. Um comparador que passa com conjunto vazio nao prova
 * nada — foi um furo real deste projeto: `--compare` deu exit 0 comparando zero
 * arquivos. Nunca mais sem esta checagem.
 */
if (!A.pngs.length || !B.pngs.length) {
  console.error(`VAZIO: antes=${A.pngs.length} png, depois=${B.pngs.length} png. Nada a comparar.`);
  process.exit(1);
}

/* ------------------------------------------------------------- pareamento */

// `<rota>__<tema>__<viewport>.png`
const chave = (f) => f.replace(/\.png$/, "");
const mapaA = new Map(A.pngs.map((f) => [chave(f), f]));
const mapaB = new Map(B.pngs.map((f) => [chave(f), f]));
const todas = [...new Set([...mapaA.keys(), ...mapaB.keys()])].sort();

const sha = (m, f) => m.manifest.files?.[f] ?? null;

const pares = todas.map((k) => {
  const fa = mapaA.get(k), fb = mapaB.get(k);
  const [rota, tema, viewport] = k.split("__");
  const shaA = fa ? sha(A, fa) : null;
  const shaB = fb ? sha(B, fb) : null;
  let estado;
  if (!fa) estado = "SO-NO-DEPOIS";
  else if (!fb) estado = "SO-NO-ANTES";
  else if (shaA && shaB && shaA === shaB) estado = "IDENTICO";
  else estado = "MUDOU";
  return { k, rota, tema, viewport, fa, fb, shaA, shaB, estado };
});

/* -------------------------------------------------- erros de console (delta) */

function errosPorCaptura(E) {
  const m = new Map();
  for (const r of E.manifest.console_error_reports ?? []) {
    const k = (r.capture ?? "").replace(/\.meta\.json$/, "");
    m.set(k, r.consoleErrors ?? []);
  }
  return m;
}
const errA = errosPorCaptura(A), errB = errosPorCaptura(B);

/** Assinatura curta do erro: 1a linha, sem url/porta, para comparar entre runs. */
const assinatura = (e) => String(e).split("\n")[0].replace(/https?:\/\/\S+/g, "").trim().slice(0, 160);

const novosErros = [];
for (const p of pares) {
  const antes = new Set((errA.get(p.k) ?? []).map(assinatura));
  const depois = (errB.get(p.k) ?? []).map(assinatura);
  const novos = depois.filter((e) => !antes.has(e));
  if (novos.length) novosErros.push({ captura: p.k, novos: [...new Set(novos)] });
}

/* ------------------------------------------------------------------ markdown */

const cont = {
  IDENTICO: pares.filter((p) => p.estado === "IDENTICO").length,
  MUDOU: pares.filter((p) => p.estado === "MUDOU").length,
  "SO-NO-ANTES": pares.filter((p) => p.estado === "SO-NO-ANTES").length,
  "SO-NO-DEPOIS": pares.filter((p) => p.estado === "SO-NO-DEPOIS").length,
};

const titulo = arg("--title", `Refatoracao visual — ${labelAntes} → ${labelDepois}`);
const data = new Date(B.manifest.generated_at).toISOString().slice(0, 10);
const saida = path.resolve(REPO, arg("--out", `docs/reports/${data}-refator-visual-${labelDepois}.md`));

/**
 * ASSETS VERSIONADOS. `.claude/evidence/` e gitignored (`.gitignore:26`), logo
 * um relatorio que LINKA de lá mostra imagem quebrada para todo mundo que nao
 * rodou a captura. Erro real: o dono abriu o relatorio e perguntou "cade as
 * imagens". Por isso o default e COPIAR os PNGs pareados para
 * `docs/reports/assets/<slug>/{antes,depois}/`, que e versionado.
 *
 * `--no-copy-assets` volta a linkar o gitignored — só para inspecao local.
 */
const copiar = !process.argv.includes("--no-copy-assets");
const slug = path.basename(saida, ".md");
const assetsDir = path.join(REPO, "docs/reports/assets", slug);

function destino(qual, f) {
  const d = path.join(assetsDir, qual);
  mkdirSync(d, { recursive: true });
  const alvo = path.join(d, f);
  if (!existsSync(alvo)) copyFileSync(path.join(qual === "antes" ? A.dir : B.dir, f), alvo);
  return alvo;
}

let copiados = 0;
const rel = (qual, f) => {
  const abs = copiar
    ? (copiados++, destino(qual, f))
    : path.join(qual === "antes" ? A.dir : B.dir, f);
  return path.relative(path.dirname(saida), abs);
};

const L = [];
L.push(`# ${titulo}`);
L.push("");
L.push(`| | antes | depois |`);
L.push(`|---|---|---|`);
L.push(`| label | \`${labelAntes}\` | \`${labelDepois}\` |`);
L.push(`| git HEAD | \`${A.manifest.git_head}\` | \`${B.manifest.git_head}\` |`);
L.push(`| capturado em | ${A.manifest.generated_at} | ${B.manifest.generated_at} |`);
L.push(`| PNGs | ${A.pngs.length} | ${B.pngs.length} |`);
L.push("");
L.push(`## Sinais deterministicos`);
L.push("");
L.push(`| sinal | pares | o que significa |`);
L.push(`|---|---:|---|`);
L.push(`| **MUDOU** | ${cont.MUDOU} | pixel diferente — exige veredito por olho (secao 2) |`);
L.push(`| **IDENTICO** | ${cont.IDENTICO} | pixel igual — prova de nao-regressao, ou bug se devia mudar |`);
L.push(`| **SO-NO-ANTES** | ${cont["SO-NO-ANTES"]} | parou de capturar: rota quebrou ou saiu da lista |`);
L.push(`| **SO-NO-DEPOIS** | ${cont["SO-NO-DEPOIS"]} | entrou na captura agora |`);
L.push(`| **erro de console novo** | ${novosErros.length} | regressao; bloqueia sem precisar de olho |`);
L.push("");

if (novosErros.length) {
  L.push(`### ⛔ Erros de console NOVOS no depois`);
  L.push("");
  for (const e of novosErros) {
    L.push(`- \`${e.captura}\``);
    for (const n of e.novos.slice(0, 3)) L.push(`  - ${n}`);
  }
  L.push("");
}

L.push(`## 1. Pares antes/depois`);
L.push("");
for (const p of pares) {
  L.push(`### ${p.rota} · ${p.tema} · ${p.viewport} — **${p.estado}**`);
  L.push("");
  if (p.fa && p.fb) {
    L.push(`| antes | depois |`);
    L.push(`|---|---|`);
    L.push(`| ![antes](${rel("antes", p.fa)}) | ![depois](${rel("depois", p.fb)}) |`);
  } else if (p.fb) {
    L.push(`![depois](${rel("depois", p.fb)})`);
    L.push("");
    L.push(`> nao existe no label \`${labelAntes}\``);
  } else {
    L.push(`![antes](${rel("antes", p.fa)})`);
    L.push("");
    L.push(`> **nao existe no label \`${labelDepois}\`** — investigar se a rota parou de renderizar`);
  }
  L.push("");
  L.push(`sha antes \`${p.shaA ?? "-"}\` · sha depois \`${p.shaB ?? "-"}\``);
  L.push("");
}

L.push(`## 2. Veredito por par — PREENCHER OLHANDO O PNG`);
L.push("");
L.push(`> Regra: uma linha por par \`MUDOU\`. \`Read\` o PNG de antes e o de depois`);
L.push(`> antes de escrever o veredito. Veredito a partir do diff de codigo e`);
L.push(`> proibido — foi assim que "limpo" saiu com 42 pontos fora da tela.`);
L.push("");
L.push(`| # | rota · tema | mudanca esperada | o que a imagem mostra | OK / REGRESSAO |`);
L.push(`|---:|---|---|---|---|`);
let i = 0;
for (const p of pares.filter((x) => x.estado === "MUDOU")) {
  L.push(`| ${++i} | ${p.rota} · ${p.tema} | _(descrever)_ | _(preencher apos Read)_ | _(OK/REGRESSAO)_ |`);
}
if (!i) L.push(`| — | nenhum par MUDOU | — | — | — |`);
L.push("");
L.push(`### Pares IDENTICOS que DEVIAM ter mudado`);
L.push("");
L.push(`> Se a refatoracao tocou a rota e o pixel nao mudou, ou a classe nova nao`);
L.push(`> emite CSS (classe desconhecida no Tailwind emite ZERO CSS sem erro), ou`);
L.push(`> o alvo estava errado. Listar aqui ou declarar que nenhum se aplica.`);
L.push("");
for (const p of pares.filter((x) => x.estado === "IDENTICO")) {
  L.push(`- [ ] \`${p.rota} · ${p.tema}\` — devia mudar? _(sim/nao + por que)_`);
}
L.push("");
L.push(`## 3. Estados que print de rota NAO cobre`);
L.push("");
L.push(`> Rota fechada nao mostra modal, popover, hover, foco nem drawer. Cada`);
L.push(`> item abaixo precisa de captura de ESTADO propria ou declaracao de que`);
L.push(`> a refatoracao nao o toca.`);
L.push("");
for (const e of ["modal aberto", "popover/dropdown aberto", "hover real com mouse",
                 "foco de teclado", "drawer mobile", "estado selecionado", "vazio/erro/loading"]) {
  L.push(`- [ ] ${e} — _(coberto por / nao se aplica porque)_`);
}
L.push("");
L.push(`---`);
L.push(`Gerado por \`frontend/scripts/evidence-report.mjs\`. Os sinais da secao "Sinais`);
L.push(`deterministicos" saem de sha e manifest; as secoes 2 e 3 sao veredito humano/LLM`);
L.push(`e nascem VAZIAS de proposito — relatorio com elas em branco nao e evidencia.`);

mkdirSync(path.dirname(saida), { recursive: true });
writeFileSync(saida, L.join("\n") + "\n");

console.log(`relatorio: ${path.relative(REPO, saida)}`);
if (copiar) console.log(`assets   : ${path.relative(REPO, assetsDir)} (${copiados} PNG copiados, versionaveis)`);
console.log(`pares: ${pares.length}  MUDOU=${cont.MUDOU}  IDENTICO=${cont.IDENTICO}  SO-ANTES=${cont["SO-NO-ANTES"]}  SO-DEPOIS=${cont["SO-NO-DEPOIS"]}`);
if (novosErros.length) {
  console.error(`\n⛔ ${novosErros.length} captura(s) com erro de console NOVO — regressao`);
  process.exit(1);
}
if (cont["SO-NO-ANTES"]) {
  console.error(`\n⛔ ${cont["SO-NO-ANTES"]} captura(s) presente(s) no antes e AUSENTE(s) no depois`);
  process.exit(1);
}
console.log(`\nfalta: preencher as secoes 2 e 3 OLHANDO os PNGs (Read), nao o diff.`);
