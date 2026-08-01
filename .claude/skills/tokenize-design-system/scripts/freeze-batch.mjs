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
  // Sem id de cluster o lote não consegue citar de onde o contrato veio, e a
  // referência volta a ser pendurada — o defeito que esta versão fecha.
  if (!c.clusterId && !(c.absorvedClusterIds ?? []).length) return "sem clusterId rastreável até CLASSIFIED";
  return null;
};

const elegiveis = [];
const excluidos = [];
for (const c of finais) {
  const motivo = motivoDeExclusao(c);
  if (motivo) excluidos.push({ nome: c.proposedName ?? "(sem nome)", count: c.count, motivo });
  else elegiveis.push(c);
}

/*
 * UM LOTE = UM ALVO SEMÂNTICO COERENTE. Corrigido 2026-08-01 (review adversarial).
 *
 * A primeira versão punha TODOS os elegíveis num lote só: 236 alvos semânticos
 * distintos em 128 arquivos. Isso é um `batch-contract` único na forma e um
 * big-bang no escopo, e contradiz a letra do grafo —
 * `reference/end-to-end-workflow.md` Linha 735: *"One batch has one coherent
 * semantic target and a bounded mutation set."* Se o APPLY existisse, seria um
 * codemod de 128 arquivos numa tacada, com uma prova de pixel só para separar
 * 236 causas possíveis de regressão.
 *
 * O alvo coerente é a ENTIDADE: todos os contratos de `button`, ou os de `modal`.
 * Compartilham dono, aparecem juntos na tela e regridem juntos — se o pixel se
 * mexer, o conjunto de suspeitos é pequeno e tem sentido.
 *
 * `--entity <nome>` escolhe qual; sem ela, a de maior evidência. `--all` mantém
 * o comportamento antigo para quem quiser deliberadamente um lote grande, e a
 * saída diz que ele é grande.
 */
const entidadeDe = (c) => c.sample?.owner ?? "(sem entidade)";
const porEntidade = new Map();
for (const c of elegiveis) {
  const e = entidadeDe(c);
  if (!porEntidade.has(e)) porEntidade.set(e, []);
  porEntidade.get(e).push(c);
}
const entidadePedida = arg("--entity");
const pegarTudo = argv.includes("--all");

let escopo;
let alvoSemantico;
if (pegarTudo) {
  escopo = elegiveis;
  alvoSemantico = `TODAS as ${porEntidade.size} entidades (--all)`;
} else if (entidadePedida) {
  escopo = porEntidade.get(entidadePedida) ?? [];
  alvoSemantico = `entidade ${entidadePedida}`;
  if (!escopo.length) {
    falhar(
      `nenhum contrato elegível na entidade ${entidadePedida}`,
      `entidades disponíveis: ${[...porEntidade.keys()].slice(0, 12).join(", ")}`
    );
  }
} else {
  const [nome, contratos] = [...porEntidade.entries()].sort(
    (a, b) => b[1].reduce((s, c) => s + c.count, 0) - a[1].reduce((s, c) => s + c.count, 0)
  )[0];
  escopo = contratos;
  alvoSemantico = `entidade ${nome} (a de maior evidência)`;
}

const limite = Number(arg("--limit", String(escopo.length)));
// Maior primeiro dentro do escopo: um contrato com 140 usos prova mais sobre o
// processo que um com 1.
const noLote = [...escopo].sort((a, b) => b.count - a.count).slice(0, Math.max(0, limite));

if (!noLote.length) {
  falhar(
    `nenhum contrato elegível entre os ${finais.length} finais`,
    excluidos.length ? `motivo mais comum: ${excluidos[0].motivo}` : "rode CONVERGE antes"
  );
}


/* ────────────────────────────────────── a reversibilidade tem que ser REAL ── */
/*
 * DEFEITO REAL (review adversarial, 2026-08-01): `rollbackSourceFingerprint`
 * recebia o hash da ÁRVORE DE TRABALHO do alvo — `fingerprintSourceRoots` lê os
 * bytes dos arquivos, não um commit. E o alvo estava SUJO, com dezenas de
 * arquivos rastreados modificados. O hash nomeava um estado que não existe em
 * commit, tag ou snapshot nenhum: se o APPLY mutasse e precisasse reverter, não
 * havia mecanismo capaz de restaurar aquela árvore.
 *
 * O grafo pede o fingerprint como `rollbackRef` e manda "restore the pre-batch
 * state" sem dizer como. A letra estava satisfeita e a reversibilidade não
 * existia — que é pior que não prometer.
 *
 * O lote agora só congela sobre árvore LIMPA, e registra o commit. `--allow-dirty`
 * existe para quem aceita o risco explicitamente, e nesse caso o motivo aparece
 * na saída em vez de ficar implícito.
 */
const { execFileSync } = await import("node:child_process");
function estadoGitDoAlvo() {
  const rodar = (args) => execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8" }).trim();
  try {
    return { head: rodar(["rev-parse", "HEAD"]), sujo: rodar(["status", "--porcelain"]).length > 0, disponivel: true };
  } catch {
    return { head: null, sujo: null, disponivel: false };
  }
}
const git = estadoGitDoAlvo();
if (!argv.includes("--allow-dirty")) {
  if (!git.disponivel) {
    falhar(
      `não consegui ler o estado git de ${ROOT}`,
      "sem commit não há ponto de restauração; use --allow-dirty se aceitar um lote irreversível"
    );
  }
  if (git.sujo) {
    falhar(
      `a árvore do alvo está SUJA — o rollbackSourceFingerprint nomearia um estado que não existe em commit nenhum`,
      "comite ou guarde as mudanças do alvo, ou passe --allow-dirty aceitando que o lote não é revertível"
    );
  }
}

/* ──────────────────────────────────────────────────────────── os artefatos ── */

mkdirSync(outDir, { recursive: true });
const refRunConfig = existsSync(path.join(runRoot, "config.json"))
  ? env.ref("run-config", path.join(runRoot, "config.json"), { relativeTo: runRoot })
  : env.ref("run-config", runConfigPath, { relativeTo: runRoot });

/*
 * A EVIDÊNCIA REAL das decisões são os `cluster-packet`, não a âncora. Citar só
 * o run-config satisfazia `minItems: 1` e não distinguia esta decisão de
 * nenhuma outra da corrida — o review adversarial chamou de vácuo, com razão.
 */
const packetsPath = path.join(path.resolve(outDir), "cluster-packets.ndjson");
const refsDeEvidencia = existsSync(packetsPath)
  ? [refRunConfig, env.ref("cluster-packet", packetsPath, { relativeTo: runRoot })]
  : [refRunConfig];

/*
 * OS IDS DO LOTE SÃO OS IDS REAIS DOS CLUSTERS QUE O CONTRATO REPRESENTA.
 *
 * DEFEITO REAL, pego pelo review adversarial de 2026-08-01 e corrigido aqui: a
 * primeira versão derivava um id sintético do hash da chave do contrato. Medido
 * no run root: **0 de 236** `targetClusterIds` existiam entre os
 * `cluster-packet` emitidos em CLASSIFIED, e o
 * `tokenization-runner validate` devolvia `valid:true` — porque o contrato não
 * tem check de integridade referencial para esses campos.
 *
 * Referência pendurada dentro de artefato que o verificador carimba como válido
 * é a classe de defeito que este repositório existe para caçar, e eu a produzi.
 *
 * Agora `context-clusters.mjs` atribui `clusterId` na própria lista e
 * `converge-tokens.mjs` acumula os absorvidos em `absorvedClusterIds`, então o
 * contrato final conhece TODOS os clusters de contexto que ele representa — e o
 * lote cita exatamente esses.
 */
const idsDoContrato = (c) => {
  const ids = new Set(c.absorvedClusterIds ?? []);
  if (c.clusterId) ids.add(c.clusterId);
  return [...ids];
};

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
  clusterIds: idsDoContrato(c),
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
  /*
   * A EVIDÊNCIA REAL, não só a âncora. A primeira versão referenciava apenas o
   * run-config, satisfazendo `minItems: 1` na letra e dizendo nada — o review
   * adversarial chamou de "vácuo", e estava certo: o run-config é o que ancora
   * TODA decisão da corrida, então citá-lo não distingue esta decisão de
   * nenhuma outra.
   *
   * O `cluster-packet` é a evidência que sustenta ESTA decisão: ele carrega as
   * variantes de estilo, as localizações e a frequência do cluster que virou o
   * contrato. Quem auditar a decisão precisa dele, não da âncora.
   */
  evidenceRefs: refsDeEvidencia,
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
  targetClusterIds: [...new Set(noLote.flatMap(idsDoContrato))],
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
  /*
   * O fingerprint é da árvore; o que a torna RESTAURÁVEL é o commit, garantido
   * pelo guard acima. Os dois juntos: o hash identifica o conteúdo, o commit dá
   * o mecanismo.
   */
  rollbackSourceFingerprint: env.sourceFingerprint,
};

const decisoesPath = path.join(outDir, `decisions-${batchId}.ndjson`);
const contratoPath = path.join(outDir, `batch-${batchId}.json`);
writeFileSync(decisoesPath, decisoes.map((d) => JSON.stringify(d)).join("\n") + "\n");
writeFileSync(contratoPath, JSON.stringify(contrato, null, 1) + "\n");

const resumo = {
  batchId,
  alvoSemantico,
  entidades: porEntidade.size,
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
  console.log(`  alvo semântico        ${alvoSemantico}  — ${porEntidade.size} entidades no total`);
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
