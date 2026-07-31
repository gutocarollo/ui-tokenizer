#!/usr/bin/env node
/**
 * vocabulary-ratchet.mjs — ENFORÇA o contrato de vocabulário de layout.
 *
 *   node vocabulary-ratchet.mjs --root <app>              # check  (exit 1 se ENTROU classe)
 *   node vocabulary-ratchet.mjs --root <app> --report     # só imprime, nunca reprova
 *   node vocabulary-ratchet.mjs --root <app> --list       # enumera as divergências
 *
 * PADRÃO LOCAL. Segue a forma dos guards que o alvo já tem em `.harness/lib/`
 * (`ds-gate.sh`, `ds-variety.py`): mesma tabela `ATUAL / BASELINE / STATUS`,
 * mesmo `--report` que nunca reprova, mesmo "sem baseline = report-only, nunca
 * reprova". Duas divergências deliberadas, ambas com motivo:
 *
 *   1. NÃO EXISTE `--update-baseline` AQUI. Nos outros guards a baseline é um
 *      número e atualizá-la é aritmética. Aqui a baseline é um CONJUNTO DE
 *      CLASSES com dono e razão declarados: "atualizar" significa aprovar
 *      vocabulário novo, que é decisão humana. Quem regenera é
 *      `propose-vocabulary.mjs --write`, e o diff do documento é o registro da
 *      aprovação. Um `--update-baseline` aqui transformaria o ratchet em
 *      carimbo: o CI que falha, roda o update, e passa.
 *
 *   2. FAIL-CLOSED em vez de FAIL-OPEN. `ds-gate.sh` sai 0 quando não acha o
 *      diretório ("fail-open") porque ele conta hardcode: não achar nada é
 *      inofensivo. Aqui não achar é PERIGOSO — sem o oráculo, ou sem o CSS
 *      buildado, o estrato 6 muda de tamanho e o guard aprovaria classe nova
 *      em silêncio. Sinal que não resolve => para.
 *
 * ── O QUE REPROVA, EXATAMENTE ───────────────────────────────────────────────
 *
 *   classe no resíduo do alvo E ausente do documento  -> exit 1  (vocabulário CRESCEU)
 *   classe no documento E ausente do resíduo          -> exit 0  (encolheu, é o objetivo)
 *   mesma classe, mais usos                           -> exit 0  (o app cresceu, não o vocabulário)
 *
 * O objeto enforçado é o RESÍDUO INTEIRO (estratos 6 ∪ 7), não o estrato 6
 * sozinho — ver DECISÃO 1 em `lib/vocabulary-contract.mjs`: a fronteira entre 6
 * e 7 é um corte cumulativo de 95% e desliza sem ninguém mexer no código.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ROOT = path.resolve(arg("--root", "."));
const DOC_PADRAO = "docs/design-system/VOCABULARIO-LAYOUT.md";
const DOC_PEDIDO = arg("--doc", null);
const DOC = path.resolve(ROOT, DOC_PEDIDO ?? DOC_PADRAO);
const FROM = arg("--from", null);
const REPORT = argv.includes("--report");
const LIST = argv.includes("--list");
const ORACULO = path.join(AQUI, "measure-disposition.mjs");

const INICIO = "<!-- VOCABULARIO:INICIO -->";
const FIM = "<!-- VOCABULARIO:FIM -->";
const INICIO_TOTAL = "<!-- VOCABULARIO-TOTAL:INICIO -->";
const FIM_TOTAL = "<!-- VOCABULARIO-TOTAL:FIM -->";
const UPDATE_TOTAL = argv.includes("--update-total-baseline");
/*
 * Segundo bloco, para a JURISDICAO QUE FALTAVA. O bloco de cima cobre o
 * RESIDUO — 326 das 1495 classes distintas do alvo. As outras 1169 (78%) vivem
 * dentro de bundle-entidade, e o ratchet nunca as olhou porque a particao pula
 * entidade (`if (ents.has(k) || comp.has(k)) continue`).
 *
 * Isso invertia a prioridade: classe nova DENTRO de entidade e a mudanca de
 * maior alcance que existe aqui — somar `bg-red-500` a SETTINGS_INPUT chega em
 * 190 call sites de uma vez — e era exatamente a invisivel.
 *
 * Dois blocos e nao um: as perguntas sao diferentes ("o residuo cresceu?" x
 * "entrou vocabulario novo no app?") e fundir jogaria fora o historico da
 * baseline atual.
 */

const morre = (code, ...msg) => { for (const m of msg) console.error(m); process.exit(code); };

/* ── 1. a baseline: o próprio documento ─────────────────────────────────────── */
if (!existsSync(DOC)) {
  /**
   * FAIL-OPEN CORRIGIDO. "Sem baseline = report-only" continua certo para o
   * PRIMEIRO ratchet — ele nasce de um `--update-baseline` explícito, não de um
   * valor chutado. Mas o comentário anterior já nomeava o buraco sem fechá-lo:
   * "um repo que perdeu o documento é indistinguível de um repo que nunca o
   * teve".
   *
   * Ele era pior que isso. Medido: o MESMO comando com `--doc` ABSOLUTO saía 1
   * ("X CRESCEU +32") e com `--doc` RELATIVO saía 0 dizendo "report-only". Um
   * caractere no caminho transformava reprovação em luz verde, e o CI acreditava
   * na verde.
   *
   * A distinção que faltava não é "existe ou não", é QUEM PEDIU:
   *   - ninguém passou `--doc` e o padrão não existe  -> primeira rodada
   *     legítima, report-only com aviso;
   *   - alguém passou `--doc` e ele NÃO existe        -> pediram uma baseline
   *     específica que não está lá. Isso é erro de invocação, não ausência de
   *     baseline, e sair 0 aqui é mentir sobre o que foi medido.
   */
  if (DOC_PEDIDO !== null) {
    morre(
      2,
      `vocabulary-ratchet: PAROU — --doc ${DOC_PEDIDO} nao existe (resolvido para ${DOC}).`,
      `Uma baseline foi pedida explicitamente e nao esta la. Sair 0 aqui reportaria`,
      `"sem regressao" sem ter comparado com nada.`
    );
  }
  console.log(`vocabulary-ratchet: sem documento em ${path.relative(ROOT, DOC)} — report-only, não reprova.`);
  console.log(`Gere com: node propose-vocabulary.mjs --root ${ROOT} --write`);
  if (!REPORT) process.exit(0);
}
const docTexto = existsSync(DOC) ? readFileSync(DOC, "utf8") : "";
const baseline = new Map();
if (docTexto) {
  const i = docTexto.indexOf(INICIO), j = docTexto.indexOf(FIM);
  if (i < 0 || j < 0 || j < i) {
    morre(2,
      `vocabulary-ratchet: PAROU — ${path.relative(ROOT, DOC)} existe mas não tem o bloco ${INICIO}...${FIM}.`,
      `Documento sem bloco de máquina não é baseline: o lint passaria a aprovar tudo em silêncio.`,
      `Regenere com: node propose-vocabulary.mjs --root ${ROOT} --write`);
  }
  for (const linha of docTexto.slice(i + INICIO.length, j).split("\n")) {
    const t = linha.trim();
    if (!t || t.startsWith("#") || t.startsWith("```")) continue;
    const [classe, usos, familia, estrato] = t.split("\t");
    if (!classe || usos === undefined) continue;
    baseline.set(classe, { usos: Number(usos), familia, estrato: Number(estrato) });
  }
  if (!baseline.size) {
    morre(2,
      `vocabulary-ratchet: PAROU — o bloco de máquina de ${path.relative(ROOT, DOC)} está VAZIO.`,
      `Baseline vazia faria TODA classe do alvo parecer nova (ou, pior num check invertido, nenhuma).`);
  }
}

/* ── 2. o estado atual, pelo oráculo ────────────────────────────────────────── */
let R;
if (FROM) {
  R = JSON.parse(readFileSync(path.resolve(FROM), "utf8"));
} else {
  try {
    R = JSON.parse(execFileSync(process.execPath, [ORACULO, "--root", ROOT, "--json"],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
  } catch (e) {
    morre(2, `vocabulary-ratchet: PAROU — o oráculo falhou em ${ROOT}.`, String(e.stderr || e.message).trim());
  }
}
if (!Array.isArray(R.vocabulario) || !Array.isArray(R.excecaoClasses)) {
  morre(2, `vocabulary-ratchet: PAROU — saída do oráculo sem \`vocabulario\`/\`excecaoClasses\` (versão antiga).`);
}
if (!R.vocabularioTotal || !Array.isArray(R.vocabularioTotal.classes)) {
  morre(2, "vocabulary-ratchet: PAROU — saida do oraculo sem `vocabularioTotal` (versao antiga).");
}

/**
 * FAIL-CLOSED no CSS buildado. Sem ele o estrato 4 vira PISO e o resíduo INCHA
 * com consumo de token do app. Medido no alvo sobre a MESMA fonte, com o CSS
 * buildado como única variável (campo `refinamentoEstrato4` de uma execução só
 * do oráculo): estrato 6 sai de 136 classes / 5.469 usos para 151 / 5.658, e o
 * resíduo 6 U 7 de 5.756 para 5.955 usos. Um lint que "passasse" nesse estado
 * estaria comparando um conjunto contra outro de natureza diferente — e, pior,
 * as 15 classes de ruído entrariam como "classe nova" e o time aprenderia a
 * ignorar o guard.
 */
const buildOk = R.cssBuildado?.disponivel === true;
if (!buildOk && !REPORT) {
  morre(3,
    `vocabulary-ratchet: PAROU — CSS buildado indisponível em ${ROOT}.`,
    `  motivo: ${R.cssBuildado?.motivo ?? "(não declarado pelo oráculo)"}`,
    `Nesse estado o estrato 4 é PISO e o resíduo incha com classes que são consumo`,
    `de token do app; a comparação contra a baseline compararia conjuntos de`,
    `naturezas diferentes. Conserte o CSS de entrada do app e rode de novo.`);
}

const atual = new Map();
for (const x of R.vocabulario) atual.set(x.classe, { usos: x.usos, estrato: 6 });
for (const x of R.excecaoClasses) atual.set(x.classe, { usos: x.usos, estrato: 7 });

/* ── 3. o veredito ──────────────────────────────────────────────────────────── */
const entraram = [...atual.entries()].filter(([c]) => !baseline.has(c))
  .map(([classe, v]) => ({ classe, ...v })).sort((a, b) => b.usos - a.usos);
const sairam = [...baseline.entries()].filter(([c]) => !atual.has(c))
  .map(([classe, v]) => ({ classe, ...v })).sort((a, b) => b.usos - a.usos);

if (LIST) {
  for (const e of entraram) console.log(`ENTROU\t${e.classe}\t${e.usos}\testrato ${e.estrato}`);
  for (const s of sairam) console.log(`SAIU\t${s.classe}\t${s.usos}\t${s.familia ?? ""}`);
  process.exit(0);
}

/* ── dimensao 2: vocabulario do UNIVERSO INTEIRO ─────────────────────────── */
const totalAtual = new Set(R.vocabularioTotal.classes.map(([c]) => c));
const blocoTotal = (() => {
  const i = docTexto.indexOf(INICIO_TOTAL), j = docTexto.indexOf(FIM_TOTAL);
  if (i < 0 || j < 0 || j < i) return null;
  return new Set(
    docTexto.slice(i + INICIO_TOTAL.length, j)
      .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("<!--"))
  );
})();

if (UPDATE_TOTAL) {
  const corpo = `${INICIO_TOTAL}\n${[...totalAtual].sort().join("\n")}\n${FIM_TOTAL}`;
  const novo = blocoTotal === null
    ? `${docTexto.trimEnd()}\n\n## Vocabulario do universo inteiro (maquina)\n\n${corpo}\n`
    : docTexto.slice(0, docTexto.indexOf(INICIO_TOTAL)) + corpo + docTexto.slice(docTexto.indexOf(FIM_TOTAL) + FIM_TOTAL.length);
  writeFileSync(DOC, novo);
  console.log(`vocabulary-ratchet: baseline TOTAL gravada em ${path.relative(ROOT, DOC)} — ${totalAtual.size} classes.`);
  process.exit(0);
}

const usosAtuais = [...atual.values()].reduce((s, v) => s + v.usos, 0);
const usosBase = [...baseline.values()].reduce((s, v) => s + v.usos, 0);

console.log(`vocabulary-ratchet · ${ROOT}`);
/** caminho relativo que ESCAPA do root vira ruido (`../../../..`) — mostre o absoluto. */
const curto = (p0) => { const r = path.relative(ROOT, p0); return r.startsWith("..") ? p0 : r; };
console.log(`baseline: ${curto(DOC)}${baseline.size ? "" : " (ausente)"}`);
console.log(`CSS buildado: ${buildOk ? "OK" : `INDISPONÍVEL — ${R.cssBuildado?.motivo ?? "?"}`}`);
console.log("");
console.log(`${"DIMENSAO".padEnd(28)}${"ATUAL".padStart(8)}${"BASELINE".padStart(10)}   STATUS`);
console.log("-".repeat(70));
const linha = (nome, a, b, st) => console.log(`${nome.padEnd(28)}${String(a).padStart(8)}${String(b).padStart(10)}   ${st}`);
linha("classes no residuo (6 U 7)", atual.size, baseline.size || "—",
  !baseline.size ? "report" : entraram.length ? `X CRESCEU (+${entraram.length})`
    : sairam.length ? `ok encolheu (-${sairam.length})` : "ok");
linha("usos no residuo", usosAtuais, usosBase || "—", "informativo (nunca reprova)");

/**
 * A dimensao NUNCA fica silenciosamente ausente. Sem baseline ela imprime
 * SEM GUARDA em letras claras — o pior desfecho possivel aqui seria uma linha
 * verde para uma jurisdicao que ninguem esta medindo.
 */
const entraramTotal = blocoTotal === null ? [] : [...totalAtual].filter((c) => !blocoTotal.has(c)).sort();
linha("classes no universo inteiro", totalAtual.size, blocoTotal ? blocoTotal.size : "—",
  blocoTotal === null
    ? "SEM GUARDA — rode --update-total-baseline"
    : (entraramTotal.length ? `X CRESCEU (+${entraramTotal.length})` : "ok"));
console.log("-".repeat(70));

if (entraram.length) {
  console.log(`\nCLASSES QUE ENTRARAM NO RESIDUO E NAO ESTAO NO CONTRATO (${entraram.length}):`);
  for (const e of entraram.slice(0, 40)) console.log(`  + ${e.classe.padEnd(40)} ${String(e.usos).padStart(5)} usos   estrato ${e.estrato}`);
  if (entraram.length > 40) console.log(`  ... e mais ${entraram.length - 40}`);
  console.log(`\nO vocabulario so ENCOLHE. Cada uma destas exige decisao:`);
  console.log(`  (a) e vocabulario de layout de fato -> aprove e regenere o documento;`);
  console.log(`  (b) e decisao de design -> tokenize, e ela sai do residuo sozinha.`);
}
if (entraramTotal.length) {
  console.log("");
  console.log(`classes NOVAS no universo inteiro (${entraramTotal.length}):`);
  for (const c of entraramTotal.slice(0, 20)) console.log(`  + ${c}`);
  if (entraramTotal.length > 20) console.log(`  ... e mais ${entraramTotal.length - 20}`);
  console.log(`Estas incluem o que entra DENTRO de bundle-entidade — invisivel para a`);
  console.log(`dimensao do residuo, e de maior alcance, porque propaga para todos os`);
  console.log(`call sites da entidade de uma vez.`);
  console.log(`  regenerar: node vocabulary-ratchet.mjs --root ${ROOT} --update-total-baseline`);
}
if (sairam.length) {
  console.log(`\nCLASSES QUE SAIRAM (${sairam.length}) — encolher e o objetivo, nao reprova:`);
  for (const s of sairam.slice(0, 20)) console.log(`  - ${s.classe.padEnd(40)} era ${String(s.usos).padStart(5)} usos`);
  if (sairam.length > 20) console.log(`  ... e mais ${sairam.length - 20}`);
  console.log(`  regenere o documento para o contrato refletir o encolhimento.`);
}
if (!entraram.length && !sairam.length && baseline.size) console.log(`\nvocabulario intacto: ${atual.size} classes, identicas ao contrato.`);

if (REPORT) process.exit(0);
/*
 * As DUAS dimensoes reprovam. Sair 0 com a segunda vermelha reproduziria o
 * defeito que ela existe para fechar: verde para uma jurisdicao onde entrou
 * vocabulario novo.
 */
process.exit(entraram.length || entraramTotal.length ? 1 : 0);
