#!/usr/bin/env node
/**
 * freeze-batch.mjs — o nó BATCH do grafo. Congela UM lote reversível.
 *
 * POR QUE ESTE ARQUIVO É A FRONTEIRA DO LOOP, e não o APPLY. Medido em
 * 2026-08-01: `grep '"batch-contract"'` nos scripts devolve só CONSUMIDORES
 * (`lib/absolute-completion.mjs:1013`) e declarações mortas. Sem `batch-contract`
 * a transição para `DECIDED` é impossível, e sem `DECIDED` o subgrafo D inteiro
 * — que já está construído, ~120 KB em `scripts/` — nunca recebe entrada. O
 * `APPLY` declarado e ausente é o sintoma; a falta de lote é a causa.
 *
 * O QUE ELE CONGELA. O mermaid pede *"freeze one reversible batch and expected
 * effect: preserve/change/mixed"*. Aqui:
 *
 *   - um `decision` por contrato que entra no lote, com a proposta, o eixo, a
 *     razão e o trade-off registrado;
 *   - um `batch-contract` com os arquivos planejados, o efeito esperado e o
 *     `rollbackSourceFingerprint` — o ponto de restauração que torna o lote
 *     REVERSÍVEL, que é a palavra que o grafo usa.
 *
 * O CRITÉRIO DE ELEGIBILIDADE, e a razão de cada corte. Entra no lote o contrato
 * que satisfaz os três:
 *
 *   1. tem nome DERIVADO da lei (`proposedName`) — sem nome não há para onde
 *      migrar;
 *   2. `valueSpread === 1` — um único valor físico dominante. Contrato que
 *      aliasa dois primitivos é impossível de escrever como um token só;
 *   3. `divergentCount === 0` — nenhuma ocorrência foge do valor dominante. Com
 *      divergência, migrar APAGA a evidência que a §9 manda expor.
 *
 * Medido no alvo: 236 dos 244 contratos passam, cobrindo 1.939 ocorrências. Os
 * 8 que ficam de fora não são erro — são exatamente os casos que a lei manda
 * levar ao humano.
 *
 * `expectedVisualEffect: "preserve"` NÃO é otimismo. Todo contrato do lote
 * herda o primitivo dominante que as ocorrências já usam — o alias muda de nome,
 * não de valor. Se o pixel mudar, o lote está errado, e é para isso que existe a
 * prova de pixel. Declarar `change` aqui esconderia a regressão dentro da
 * expectativa.
 *
 * Uso:
 *   node freeze-batch.mjs --root <app> --run-config <path> --run-root <run>
 *                         --converged <converged.json> --out <dir>
 *                         [--batch B0001] [--limit N] [--json]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { envelopeFrom } from "./lib/artifact-envelope.mjs";
import { resolveRoot } from "./lib/paths.mjs";

const argv = process.argv.slice(2);
const arg = (flag, fallback = null) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

if (argv.includes("--help")) {
  console.log(`freeze-batch.mjs — congela UM lote reversível (nó BATCH)

Uso:
  node freeze-batch.mjs --root <app> --run-config <path> --run-root <run> --out <dir>

Opções:
  --converged <path>   default: <app>/.tokenize/converged.json
  --batch <B0001>      id do lote (padrão do contrato: ^B[0-9]{4,}$)
  --limit <N>          no máximo N contratos no lote (default: todos os elegíveis)
  --json               imprime o resumo em JSON
`);
  process.exit(0);
}

const ROOT = resolveRoot();
const runConfigPath = arg("--run-config", path.join(ROOT, ".tokenize/run-config.json"));
const runRoot = arg("--run-root");
const convergedPath = arg("--converged", path.join(ROOT, ".tokenize/converged.json"));
const outDir = arg("--out", path.join(ROOT, ".tokenize"));
const batchId = arg("--batch", "B0001");

const falhar = (motivo, comoResolver) => {
  console.error(`\nBATCH falhou: ${motivo}`);
  if (comoResolver) console.error(`  como resolver: ${comoResolver}`);
  process.exit(1);
};

if (!/^B[0-9]{4,}$/.test(batchId)) falhar(`batchId fora do padrão: ${batchId}`, "o contrato exige ^B[0-9]{4,}$");
if (!existsSync(convergedPath)) {
  falhar(`não há convergência em ${convergedPath}`, "rode o loop até CONVERGE: node tokenize.mjs --root <app>");
}
if (!runRoot) falhar("--run-root é obrigatório", "as referências de artefato têm de ser relativas ao run root");

const env = envelopeFrom(runConfigPath);
const CV = JSON.parse(readFileSync(convergedPath, "utf8"));
const finais = CV.clustersFinais ?? [];

/* ────────────────────────────────────────────────── eixo, pela propriedade ── */
/*
 * O `decision` exige um `axis` do enum fechado de 13. A propriedade CSS que o
 * cluster carrega o determina — este mapa é a tradução, e ele é conservador:
 * propriedade que não mapeia derruba o contrato do lote em vez de chutar um eixo.
 * Chutar produziria uma decisão que declara cobrir um eixo que ninguém validou.
 */
const EIXO_DA_PROPRIEDADE = Object.freeze({
  "background-color": "color",
  color: "color",
  "border-color": "color",
  "outline-color": "color",
  fill: "color",
  stroke: "color",
  "box-shadow": "elevation",
  "border-radius": "radius",
  padding: "spacing",
  margin: "spacing",
  gap: "spacing",
  "row-gap": "spacing",
  "column-gap": "spacing",
  "font-weight": "typography",
  "line-height": "typography",
  "letter-spacing": "typography",
});

const eixoDe = (c) => EIXO_DA_PROPRIEDADE[c.sample?.property] ?? null;

/* ──────────────────────────────────────────────────────── elegibilidade ───── */

const motivoDeExclusao = (c) => {
  if (!c.proposedName) return "sem nome derivado da lei";
  if ((c.valueSpread ?? 1) !== 1) return `aliasa ${c.valueSpread} valores físicos distintos`;
  if ((c.divergentCount ?? 0) !== 0) return `${c.divergentCount} ocorrências divergem do valor dominante (§9)`;
  if (!eixoDe(c)) return `propriedade "${c.sample?.property}" não mapeia para eixo do contrato`;
  if (!c.dominantPrimitive || String(c.dominantPrimitive).startsWith("(sem valor")) {
    return "primitivo dominante não resolve — não há valor a herdar";
  }
  return null;
};

const elegiveis = [];
const excluidos = [];
for (const c of finais) {
  const motivo = motivoDeExclusao(c);
  if (motivo) excluidos.push({ nome: c.proposedName ?? "(sem nome)", count: c.count, motivo });
  else elegiveis.push(c);
}

const limite = Number(arg("--limit", String(elegiveis.length)));
// Maior primeiro: o lote 1 deve carregar o máximo de evidência por unidade de
// risco, e um contrato com 140 usos prova mais sobre o processo que um com 1.
const noLote = [...elegiveis].sort((a, b) => b.count - a.count).slice(0, Math.max(0, limite));

if (!noLote.length) {
  falhar(
    `nenhum contrato elegível entre os ${finais.length} finais`,
    excluidos.length ? `motivo mais comum: ${excluidos[0].motivo}` : "rode CONVERGE antes"
  );
}

/* ──────────────────────────────────────────────────────────── os artefatos ── */

mkdirSync(outDir, { recursive: true });
const refRunConfig = existsSync(path.join(runRoot, "config.json"))
  ? env.ref("run-config", path.join(runRoot, "config.json"), { relativeTo: runRoot })
  : env.ref("run-config", runConfigPath, { relativeTo: runRoot });

/*
 * ID DO ALVO DO LOTE. Derivado da CHAVE do contrato, com hash, e não do
 * `proposedName + component`: a primeira versão usava esses dois e o contrato
 * reprovou com "targetClusterIds must NOT have duplicate items (205 e 206)" —
 * dois contratos finais podem legitimamente compartilhar nome e componente e se
 * distinguir por outro eixo da chave.
 *
 * LIMITE DECLARADO, mesma honestidade do `occurrenceIds` do cluster-packet:
 * estes ids vivem no espaço dos contratos FINAIS (pós-convergência, 244), e os
 * `cluster-packet` emitidos em CLASSIFIED vivem no espaço dos clusters de
 * contexto (pré-convergência, 2076). Um contrato final absorve N clusters, e
 * `converged.json` não carrega de volta os ids dos absorvidos — reconciliar os
 * dois espaços é trabalho próprio. Até lá, o id é estável e reproduzível, mas
 * não é o mesmo id do packet. Não os cite como se fossem.
 */
const { createHash } = await import("node:crypto");
const clusterIdDe = (c) =>
  `contract-${createHash("sha256").update(JSON.stringify(c.key ?? c.sample ?? c.proposedName)).digest("hex").slice(0, 12)}`;

/*
 * OS CENÁRIOS QUE O LOTE PROMETE NÃO MEXER.
 *
 * O contrato exige (`anyOf`) que ao menos uma das duas listas seja não-vazia — e
 * a razão é boa: um lote que promete `preserve` sem nomear o que preserva faz
 * uma promessa infalsificável.
 *
 * Para um lote `preserve` a afirmação honesta é a MAIS FORTE possível: nenhum
 * cenário muda. Por isso `expectedUnchanged` recebe TODOS os cenários do
 * registro do alvo e `expectedChanged` fica vazio. Se um único pixel se mexer em
 * qualquer um dos 47, o lote está errado — que é exatamente o que se quer poder
 * detectar.
 */
function cenariosDoAlvo() {
  const p = path.join(ROOT, "tests/visual/scenarios.json");
  if (!existsSync(p)) return { ids: [], origem: null };
  try {
    const j = JSON.parse(readFileSync(p, "utf8"));
    const ids = (j.scenarios ?? []).map((s) => s.scenarioId).filter(Boolean);
    return { ids: [...new Set(ids)].sort(), origem: path.relative(ROOT, p) };
  } catch {
    return { ids: [], origem: null };
  }
}
const { ids: cenarios, origem: origemCenarios } = cenariosDoAlvo();
if (!cenarios.length) {
  falhar(
    "o alvo não declara nenhum cenário em tests/visual/scenarios.json",
    "sem cenário, um lote 'preserve' promete algo que ninguém pode falsificar — gere o registro antes"
  );
}

const decisoes = noLote.map((c, i) => ({
  ...env.header("decision"),
  decisionId: `${batchId}-D${String(i + 1).padStart(4, "0")}`,
  clusterIds: [clusterIdDe(c)],
  // NÃO usar `semantic-token`, que o enum do contrato oferece: `semantic` é uma
  // das cinco palavras banidas (§3.1). `component-token` também é o que estes
  // contratos SÃO — todos têm entidade como cabeça do nome.
  classification: "component-token",
  status: "approved",
  proposal: { name: c.proposedName, axis: eixoDe(c), exception: false },
  rationale:
    `${c.count} ocorrências no mesmo contexto renderizado convergem para um valor físico único ` +
    `(${c.dominantPrimitive}); o nome é derivado da lei, não escolhido.`,
  decidedBy: "deterministic",
  tradeoff: {
    qualityDelta: `${c.count} usos passam a citar um contrato nomeado em vez do token antigo ${c.tokens?.join(",") ?? "?"}`,
    costDelta: "um token novo no DTCG e um codemod nos call sites; nenhuma mudança de valor",
    breakeven: "imediato — o token antigo já é banido pela lei e não pode sobreviver à migração",
    nonAdoptionCondition:
      "não adotar se a prova de pixel mostrar mudança: o lote promete preservar, e mudança contradiz a promessa",
    reversibility: `total — rollbackSourceFingerprint fixa a árvore anterior ao lote`,
    localPatternFit: [`entidade ${c.sample?.owner}`, `propriedade ${c.sample?.property}`],
  },
  evidenceRefs: [refRunConfig],
}));

const arquivos = [...new Set(noLote.flatMap((c) => (c.occurrences ?? []).map((o) => o.file)))].sort();
if (!arquivos.length) {
  falhar(
    "os contratos elegíveis não carregam nenhum arquivo",
    "converged.json precisa das ocorrências para planejar o lote"
  );
}

const contrato = {
  ...env.header("batch-contract"),
  batchId,
  targetClusterIds: noLote.map(clusterIdDe),
  decisionIds: decisoes.map((d) => d.decisionId),
  plannedFiles: arquivos,
  // Ver o docstring: preservar não é otimismo, é a asserção que a prova de pixel
  // vai testar. Todo contrato herda o primitivo que as ocorrências já usam.
  expectedVisualEffect: "preserve",
  expectedChangedScenarioIds: [],
  expectedUnchangedScenarioIds: cenarios,
  absoluteTargets: {
    contractsInBatch: noLote.length,
    occurrencesMigrated: noLote.reduce((s, c) => s + c.count, 0),
    filesTouched: arquivos.length,
  },
  rollbackSourceFingerprint: env.sourceFingerprint,
};

const decisoesPath = path.join(outDir, `decisions-${batchId}.ndjson`);
const contratoPath = path.join(outDir, `batch-${batchId}.json`);
writeFileSync(decisoesPath, decisoes.map((d) => JSON.stringify(d)).join("\n") + "\n");
writeFileSync(contratoPath, JSON.stringify(contrato, null, 1) + "\n");

const resumo = {
  batchId,
  contratosFinais: finais.length,
  elegiveis: elegiveis.length,
  noLote: noLote.length,
  ocorrencias: contrato.absoluteTargets.occurrencesMigrated,
  arquivos: arquivos.length,
  excluidos: excluidos.length,
  artefatos: { decisoes: decisoesPath, contrato: contratoPath },
};

if (argv.includes("--json")) {
  console.log(JSON.stringify({ ...resumo, motivosDeExclusao: excluidos.slice(0, 20) }, null, 1));
} else {
  console.log(`BATCH ${batchId} congelado`);
  console.log(`  contratos finais      ${finais.length}`);
  console.log(`  elegíveis             ${elegiveis.length}  (nome + valor único + zero divergência + eixo mapeado)`);
  console.log(`  NO LOTE               ${noLote.length}  → ${contrato.absoluteTargets.occurrencesMigrated} ocorrências em ${arquivos.length} arquivos`);
  console.log(`  efeito esperado       preserve (herda o primitivo dominante; mudança de pixel = lote errado)`);
  console.log(`  rollback              ${env.sourceFingerprint.slice(0, 16)}…`);
  if (excluidos.length) {
    console.log(`\n  ${excluidos.length} fora do lote, por motivo:`);
    const porMotivo = {};
    for (const e of excluidos) porMotivo[e.motivo] = (porMotivo[e.motivo] ?? 0) + 1;
    for (const [m, n] of Object.entries(porMotivo).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(n).padStart(4)}  ${m}`);
    }
  }
}
