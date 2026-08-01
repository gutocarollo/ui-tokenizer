#!/usr/bin/env node
/**
 * evaluate-residual.mjs — o nó RESIDUAL, e com ele o ponto fixo GLOBAL.
 *
 * É O LAÇO QUE O DONO PEDIU: `ACCEPT → REINVENTORY → RESIDUAL → NORMALIZE`, a
 * iteração sucessiva até convergir. Antes disto ele existia como **uma linha
 * declarativa** — `FORWARD_TRANSITIONS.REINVENTORIED = ["NORMALIZED","COMPLETE"]`
 * (`lib/artifact-contract.mjs`) — e quem escolhia o ramo era um humano digitando
 * `transition --to NORMALIZED`. Zero linha de código avaliava o predicado
 * "resíduo satisfeito?".
 *
 * SOBRE A ANALOGIA DE NEWTON, com honestidade. O `converge-tokens.mjs` faz
 * iteração de ponto fixo de Banach (`x_{n+1} = F(x_n)`, para quando `F(x)=x`
 * duas vezes) — não Newton, porque não há derivada nem passo proporcional ao
 * resíduo. Este laço externo é o mesmo tipo: **re-mede do zero** a cada volta e
 * pergunta se o resíduo zerou.
 *
 * O que de Newton existe de verdade, e é a parte boa, é a JACOBIANA: a tabela
 * `REENTRY_PHASE` mapeia *qual predicado falhou* → *em que fase reentrar*.
 * Falhou `tokens.legacy-vocabulary-zero`? `E-MIGRATION` → volta para MIGRATED,
 * não para o começo. Isso é escolher a direção do passo pelo resíduo, que é o
 * que Newton faz. Este script devolve o código de reentrada de cada predicado
 * que falhou, para que a volta seja dirigida em vez de cega.
 *
 * A REGRA QUE GOVERNA TUDO AQUI: **nunca emitir um relatório que não foi
 * medido.** Sete dos catorze predicados dependem de evidência renderizada, que
 * hoje não existe. Carimbar `unapprovedResidual: 0` neles faria a corrida se
 * declarar completa sobre evidência ausente — o pior defeito possível num
 * processo cujo produto é a confiança na conclusão. Eles saem como NÃO MEDIDOS,
 * com a razão, e o script recusa `COMPLETE`.
 *
 * Uso:
 *   node evaluate-residual.mjs --root <app> --run-config <path> --run-root <run> --out <dir>
 *   node evaluate-residual.mjs --root <app> --json
 *
 * Saída (exit code):
 *   0  todos os 14 medidos e resíduo zero  → transição para COMPLETE é legítima
 *   3  resíduo > 0                          → mais uma volta, pela fase que o
 *                                             código de reentrada indicar
 *   4  há predicado NÃO MEDIDO              → nem COMPLETE nem volta cega: falta
 *                                             capacidade, e isso é outro problema
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { envelopeFrom } from "../../../../scripts/lib/artifact-envelope.mjs";
import { resolveRoot } from "./lib/paths.mjs";
import { ABSOLUTE_REPORT_PREDICATES, absoluteReportId } from "./lib/absolute-completion-contract.mjs";

const argv = process.argv.slice(2);
const arg = (flag, fallback = null) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

if (argv.includes("--help")) {
  console.log(`evaluate-residual.mjs — mede o resíduo absoluto e decide se o laço continua

Uso:
  node evaluate-residual.mjs --root <app> --run-config <path> --run-root <run> --out <dir>

Exit: 0 completo · 3 mais uma volta · 4 há predicado não medido
`);
  process.exit(0);
}

const ROOT = resolveRoot();
const runConfigPath = arg("--run-config", path.join(ROOT, ".tokenize/run-config.json"));
const runRoot = arg("--run-root");
const outDir = arg("--out", path.join(ROOT, ".tokenize/residual"));

if (!existsSync(runConfigPath)) {
  console.error(`\nRESIDUAL falhou: sem run-config em ${runConfigPath}`);
  console.error(`  como resolver: node anchor-run.mjs --root ${ROOT}`);
  process.exit(1);
}
const env = envelopeFrom(runConfigPath);

/* ───────────────────────────────────────────────────── os medidores reais ── */

/** Varre o alvo contando classes que ainda carregam palavra banida pela lei. */
function medirVocabularioLegado() {
  const proibidas = ["surface", "semantic", "content", "label", "foreground"];
  const rx = new RegExp(`(?<![\\w-])[a-z-]+-(?:${proibidas.join("|")})-[a-z0-9-]+`, "g");
  const src = path.join(ROOT, "src");
  if (!existsSync(src)) return null;
  let populacao = 0;
  let residuo = 0;
  const walk = (dir) => {
    for (const nome of readdirSync(dir)) {
      const p = path.join(dir, nome);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(jsx?|tsx?|css)$/.test(nome)) {
        const t = readFileSync(p, "utf8");
        populacao += (t.match(/class(?:Name)?=/g) ?? []).length;
        residuo += (t.match(rx) ?? []).length;
      }
    }
  };
  walk(src);
  return { populacao, residuo, como: "varredura de src/ por classe com palavra banida (§3.1)" };
}

/** Compara os contratos convergidos com o que o DTCG do alvo já define. */
function medirParidadeDTCG() {
  const convergedPath = path.join(ROOT, ".tokenize/converged.json");
  const tokensPath = path.join(ROOT, "tokens/color.tokens.json");
  if (!existsSync(convergedPath) || !existsSync(tokensPath)) return null;
  const CV = JSON.parse(readFileSync(convergedPath, "utf8"));
  const alvo = JSON.parse(readFileSync(tokensPath, "utf8"));
  const finais = (CV.clustersFinais ?? []).filter((c) => c.proposedName);
  const existe = (caminho) =>
    caminho.split(".").reduce((n, k) => (n && typeof n === "object" ? n[k] : undefined), alvo.component ?? {});
  let presentes = 0;
  for (const c of finais) {
    // O caminho é `<tema>.<entidade>...`; basta a entidade existir sob algum tema
    // para o contrato ter contrapartida no DTCG.
    const entidade = c.sample?.owner;
    if (!entidade) continue;
    if (existe(`light.${entidade}`) || existe(`dark.${entidade}`)) presentes += 1;
  }
  return {
    populacao: finais.length,
    residuo: finais.length - presentes,
    como: "contratos convergidos sem contrapartida no component.<tema> do DTCG do alvo",
  };
}

/** Ocorrências que a extração não conseguiu resolver — o "invalid-source". */
function medirFonteInvalida() {
  const resumo = runRoot ? path.join(runRoot, "artifacts/extraction-summary.json") : null;
  if (!resumo || !existsSync(resumo)) return null;
  const J = JSON.parse(readFileSync(resumo, "utf8"));
  /*
   * Os nomes reais do `extraction-summary.json`, lidos do artefato e não
   * adivinhados: a lista `opaqueOccurrenceIds` e `counts.occurrences`. A
   * primeira versão chutou `opaqueOccurrences`/`counts.opaque` e o medidor caiu
   * no ramo "insumo não presente" — que é o comportamento certo para um campo
   * ausente, e foi o que expôs o chute.
   */
  const opacas = Array.isArray(J.opaqueOccurrenceIds) ? J.opaqueOccurrenceIds.length : null;
  const total = J.counts?.occurrences ?? null;
  if (opacas === null || total === null) return null;
  return {
    populacao: total,
    residuo: opacas,
    como: "ocorrências opacas do extraction-summary — fonte que o censo não resolveu",
  };
}

/** Clusters que o processo não conseguiu nomear pela lei. */
function medirNomeacao() {
  const clustersPath = path.join(ROOT, ".tokenize/clusters.json");
  if (!existsSync(clustersPath)) return null;
  const J = JSON.parse(readFileSync(clustersPath, "utf8"));
  const cl = J.clusters ?? [];
  const semNome = cl.filter((c) => !c.proposedName);
  return {
    populacao: J.total ?? cl.length,
    residuo: semNome.reduce((s, c) => s + (c.count ?? 0), 0),
    como: "ocorrências em cluster sem nome derivável pela lei",
  };
}

/*
 * O MAPA PREDICADO → MEDIDOR. Quem não tem medidor NÃO É ZERO: é não medido, e
 * a razão fica escrita. Esta distinção é o coração deste arquivo.
 */
const MEDIDORES = {
  "inventory.exceptions-complete": medirFonteInvalida,
  "tokens.naming-and-application-zero": medirNomeacao,
  "tokens.legacy-vocabulary-zero": medirVocabularioLegado,
  "tokens.dtcg-parity": medirParidadeDTCG,
};

const SEM_MEDIDOR = {
  "tokens.hardcodes-and-arbitrary-zero":
    "exige o censo de hardcodes contra o baseline do ds-gate, que roda no alvo e não é lido aqui",
  "tokens.classes-emitted-live":
    "exige o CSS BUILDADO do alvo — classe desconhecida pelo Tailwind emite zero CSS sem erro, então só o artefato construído prova",
  "tokens.scale-cardinalities-approved":
    "exige APROVAÇÃO do dono sobre a cardinalidade das escalas; não é medição, é decisão",
  "rendered.routes-materialized": "exige captura visual: nenhuma rota foi materializada nesta corrida",
  "rendered.exact-matrix": "exige evidence-manifest, cujo emissor produz schemaVersion incompatível com o journal",
  "rendered.pairs-integrity": "exige par before/after, que exige o subgrafo D ligado",
  "rendered.runtime-regressions-zero": "exige Axe/console sobre a página renderizada",
  "rendered.batch-effects-satisfied": "exige comparação de pixel entre before e after",
  "rendered.image-reviews-complete": "exige revisão de imagem por modelo, que é fase [LLM] não implementada",
  "process.accepted-batches-reversible": "exige lote ACEITO; nenhum foi, a corrida está em DECIDED",
};

/* ────────────────────────────────────────────────────────── a avaliação ───── */

const medidos = [];
const naoMedidos = [];
for (const pred of ABSOLUTE_REPORT_PREDICATES) {
  const medidor = MEDIDORES[pred.predicateId];
  if (!medidor) {
    naoMedidos.push({
      predicateId: pred.predicateId,
      reportId: absoluteReportId(pred.predicateId),
      razao: SEM_MEDIDOR[pred.predicateId] ?? "sem medidor declarado",
      reentryCode: pred.reentryCode,
    });
    continue;
  }
  const r = medidor();
  if (!r) {
    naoMedidos.push({
      predicateId: pred.predicateId,
      reportId: absoluteReportId(pred.predicateId),
      razao: "o medidor existe mas o insumo dele não está presente nesta corrida",
      reentryCode: pred.reentryCode,
    });
    continue;
  }
  medidos.push({ ...pred, ...r, reportId: absoluteReportId(pred.predicateId) });
}

/* ────────────────────────────────────────────── os artefatos de inventário ── */

mkdirSync(outDir, { recursive: true });
const refRunConfig =
  runRoot && existsSync(path.join(runRoot, "config.json"))
    ? env.ref("run-config", path.join(runRoot, "config.json"), { relativeTo: runRoot })
    : env.ref("run-config", runConfigPath, { relativeTo: runRoot ?? ROOT });

const relatorios = medidos.map((m) => ({
  ...env.header("inventory-report"),
  reportId: m.reportId,
  inventoryKind: m.inventoryKind,
  inputArtifactRefs: [refRunConfig],
  counts: {
    // `population` não-vácuo é exigência do avaliador
    // (`lib/absolute-completion.mjs:366-374`): resíduo zero sobre população zero
    // é verdade vacuosa, e é assim que um processo se declara pronto sem ter
    // olhado nada.
    population: m.populacao,
    unapprovedResidual: m.residuo,
  },
  detailArtifactRefs: [],
  reconciled: m.residuo === 0,
}));

const relatoriosPath = path.join(outDir, "absolute-reports.ndjson");
writeFileSync(relatoriosPath, relatorios.map((r) => JSON.stringify(r)).join("\n") + "\n");

/* ─────────────────────────────────────────────────────────── o veredito ───── */

const comResiduo = medidos.filter((m) => m.residuo > 0);
const vacuos = medidos.filter((m) => m.populacao === 0);

const resultado = {
  medidos: medidos.length,
  naoMedidos: naoMedidos.length,
  totalExigido: ABSOLUTE_REPORT_PREDICATES.length,
  comResiduo: comResiduo.length,
  residuoTotal: medidos.reduce((s, m) => s + m.residuo, 0),
  // A JACOBIANA: para onde voltar, por predicado que falhou. É isto que torna a
  // volta DIRIGIDA em vez de reiniciar do começo.
  reentradas: [...new Set(comResiduo.map((m) => m.reentryCode))],
  artefato: relatoriosPath,
};

if (argv.includes("--json")) {
  console.log(JSON.stringify({ ...resultado, detalhe: medidos, naoMedidos }, null, 1));
} else {
  console.log(`RESIDUAL — ${medidos.length} de ${ABSOLUTE_REPORT_PREDICATES.length} predicados medidos\n`);
  for (const m of medidos) {
    const marca = m.residuo === 0 ? "ok  " : "RESÍDUO";
    console.log(`  ${marca}  ${m.predicateId.padEnd(38)} ${String(m.residuo).padStart(6)} de ${m.populacao}`);
    console.log(`         ${m.como}`);
  }
  if (vacuos.length) {
    console.log(`\n  ATENÇÃO: ${vacuos.length} predicado(s) com população ZERO — resíduo zero sobre nada é verdade vácua`);
  }
  console.log(`\n  NÃO MEDIDOS (${naoMedidos.length}) — não são zero, são desconhecidos:`);
  for (const n of naoMedidos) console.log(`    ${n.predicateId.padEnd(38)} ${n.razao}`);
  if (comResiduo.length) {
    console.log(`\n  o laço CONTINUA. Reentrada dirigida por: ${resultado.reentradas.join(", ")}`);
    console.log(`  (a tabela REENTRY_PHASE diz em que fase reentrar para cada código — é a`);
    console.log(`   direção do passo, escolhida pelo resíduo, e é o que há de Newton aqui)`);
  }
}

/*
 * A ORDEM DOS EXIT CODES É DELIBERADA. "não medido" (4) vem ANTES de "resíduo"
 * (3) porque são problemas de natureza diferente: resíduo pede mais uma volta do
 * mesmo laço; falta de medidor pede CAPACIDADE NOVA, e mandar o laço girar sobre
 * um predicado que ninguém sabe medir produz volta infinita com cara de trabalho.
 */
if (naoMedidos.length) process.exit(4);
if (comResiduo.length || vacuos.length) process.exit(3);
process.exit(0);
