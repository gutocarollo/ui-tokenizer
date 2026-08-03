/**
 * Medidores dos 14 predicados absolutos do laço de resíduo.
 *
 * Este módulo só mede artefatos já produzidos. Ele não escreve relatório e não
 * decide transição: `evaluate-residual.mjs` é o compositor, enquanto o contrato
 * e o runner continuam donos da suficiência e do estado.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const TERMINAIS = new Set([
  "approved-token",
  "approved-contract",
  "approved-exception",
  "approved-out-of-scope",
  "invalid-source",
]);

const EXCECOES = new Set([
  "approved-exception",
  "approved-out-of-scope",
  "invalid-source",
]);

const KINDS_DE_VALOR = new Set([
  "css-declaration",
  "css-custom-property",
  "inline-style",
  "css-in-js",
  "svg-presentation",
  "chart-config",
  "canvas-draw",
  "typography",
  "motion-keyframe",
  "motion-transition",
  "gradient",
]);

function arquivos(dir) {
  if (!existsSync(dir)) return [];
  const saida = [];
  for (const nome of readdirSync(dir).sort()) {
    const p = path.join(dir, nome);
    const st = statSync(p);
    if (st.isDirectory()) saida.push(...arquivos(p));
    else if (/\.nd?json$/u.test(nome)) saida.push(p);
  }
  return saida;
}

function objetos(texto) {
  const t = texto.trim();
  if (!t) return [];
  try {
    const unico = JSON.parse(t);
    return Array.isArray(unico) ? unico : [unico];
  } catch {
    return t
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((linha) => JSON.parse(linha));
  }
}

/** Lê JSON/NDJSON uma vez e preserva o caminho que prova cada registro. */
export function lerRegistrosDoRun(runRoot) {
  const registros = [];
  for (const sourcePath of arquivos(runRoot)) {
    let encontrados;
    try {
      encontrados = objetos(readFileSync(sourcePath, "utf8"));
    } catch {
      continue;
    }
    for (const artifact of encontrados) {
      if (artifact && typeof artifact === "object" && artifact.artifactType) {
        registros.push({ artifact, sourcePath });
      }
    }
  }
  return registros;
}

function doTipo(registros, tipo) {
  return registros.filter(({ artifact }) => artifact.artifactType === tipo);
}

/** O reinventário vence o inventário inicial; misturar os dois dobra população. */
function preferirReinventario(registros) {
  const finais = registros.filter(({ sourcePath }) =>
    sourcePath.split(path.sep).includes("reinventory")
  );
  return finais.length ? finais : registros;
}

function caminhos(registros) {
  return [...new Set(registros.map(({ sourcePath }) => sourcePath))].sort();
}

function resultado(populacao, residuo, como, registros, extras = {}) {
  if (!Number.isInteger(populacao) || populacao < 0) return null;
  if (!Number.isInteger(residuo) || residuo < 0) return null;
  return {
    populacao,
    residuo,
    como,
    inputPaths: caminhos(registros),
    ...extras,
  };
}

function unicosPor(registros, chave) {
  const mapa = new Map();
  for (const registro of registros) {
    const valor = chave(registro.artifact);
    if (valor) mapa.set(valor, registro);
  }
  return [...mapa.values()];
}

function medirFonteInvalida({ registros }) {
  const design = preferirReinventario(doTipo(registros, "design-occurrence"));
  if (!design.length) return null;
  const excecoes = design.filter(({ artifact }) =>
    ["approved-exception", "approved-out-of-scope", "invalid-source"].includes(
      artifact.reconciliation?.status
    )
  );
  const residuo = excecoes.filter(({ artifact }) => {
    const reconciliation = artifact.reconciliation ?? {};
    if (!reconciliation.reason) return true;
    if (
      reconciliation.status === "approved-exception" &&
      !reconciliation.exceptionId
    ) {
      return true;
    }
    return false;
  }).length;
  return resultado(
    design.length,
    residuo,
    "exceções/out-of-scope/invalid-source sem identidade e razão duráveis",
    design
  );
}

function medirHardcodes({ registros }) {
  const design = preferirReinventario(doTipo(registros, "design-occurrence"));
  const cobertos = design.filter(({ artifact }) =>
    KINDS_DE_VALOR.has(artifact.occurrenceKind)
  );
  if (!cobertos.length) return null;
  const residuo = cobertos.filter(
    ({ artifact }) => !TERMINAIS.has(artifact.reconciliation?.status)
  ).length;
  return resultado(
    cobertos.length,
    residuo,
    "valores físicos em propriedades cobertas sem token, contrato ou exceção aprovada",
    cobertos
  );
}

function medirNomeacao({ applicationRoot, registros }) {
  const convergedPath = path.join(applicationRoot, ".tokenize", "converged.json");
  if (!existsSync(convergedPath)) return null;
  let converged;
  try {
    converged = JSON.parse(readFileSync(convergedPath, "utf8"));
  } catch {
    return null;
  }
  const clusters = converged.clustersFinais ?? converged.clusters ?? [];
  if (!clusters.length) return null;
  const semNome = clusters.filter((cluster) => !cluster.proposedName);
  return resultado(
    clusters.reduce((soma, cluster) => soma + (cluster.count ?? 1), 0),
    semNome.reduce((soma, cluster) => soma + (cluster.count ?? 1), 0),
    "ocorrências em contratos convergidos sem nome derivável pela lei",
    doTipo(registros, "decision")
  );
}

function medirClassesEmitidas({ registros }) {
  const normalized = preferirReinventario(
    doTipo(registros, "normalized-occurrence")
  );
  if (!normalized.length) return null;
  const design = unicosPor(
    preferirReinventario(doTipo(registros, "design-occurrence")),
    (artifact) => artifact.occurrenceId
  );
  const status = new Map(
    design.map(({ artifact }) => [
      artifact.occurrenceId,
      artifact.reconciliation?.status,
    ])
  );
  const invalidas = normalized.filter(({ artifact }) => {
    if (EXCECOES.has(status.get(artifact.designOccurrenceId))) return false;
    if (artifact.reconciliationStatus !== "valid") return true;
    return !artifact.fingerprints?.compiledCssFingerprint;
  });
  return resultado(
    normalized.length,
    invalidas.length,
    "projeções de classe sem CSS emitido ou sem reconciliação explícita",
    [...normalized, ...design]
  );
}

function folhasDtcg(no, prefixo = [], saida = []) {
  if (!no || typeof no !== "object" || Array.isArray(no)) return saida;
  if (Object.hasOwn(no, "$value")) {
    saida.push({ caminho: prefixo, valor: no.$value, tipo: no.$type ?? null });
    return saida;
  }
  for (const [chave, valor] of Object.entries(no)) {
    if (chave.startsWith("$")) continue;
    folhasDtcg(valor, [...prefixo, chave], saida);
  }
  return saida;
}

function eixoDaFolha(folha) {
  const cabeca = folha.caminho[0];
  if (["color", "spacing", "radius", "typography"].includes(cabeca)) {
    return cabeca;
  }
  if (folha.tipo === "color") return "color";
  if (["fontFamily", "fontWeight", "duration", "cubicBezier"].includes(folha.tipo)) {
    return folha.tipo === "duration" || folha.tipo === "cubicBezier"
      ? "motion"
      : "typography";
  }
  return cabeca ?? "unmapped";
}

function medirCardinalidades({ applicationRoot, runConfig, registros }) {
  const tokenFile = path.join(applicationRoot, "tokens", "color.tokens.json");
  if (!existsSync(tokenFile)) return null;
  let dtcg;
  try {
    dtcg = JSON.parse(readFileSync(tokenFile, "utf8"));
  } catch {
    return null;
  }
  const contagens = new Map();
  for (const folha of folhasDtcg(dtcg)) {
    const eixo = eixoDaFolha(folha);
    contagens.set(eixo, (contagens.get(eixo) ?? 0) + 1);
  }
  const contratos = doTipo(registros, "batch-contract");
  const aceitos = new Set(
    doTipo(registros, "acceptance")
      .filter(({ artifact }) => artifact.verdict === "accepted")
      .map(({ artifact }) => artifact.batchId)
  );
  const alvos = new Map();
  for (const { artifact } of contratos) {
    if (!aceitos.has(artifact.batchId)) continue;
    for (const eixo of runConfig.axisRegistry ?? []) {
      const chave = `scaleCardinality:${eixo.axis}`;
      if (Number.isInteger(artifact.absoluteTargets?.[chave])) {
        alvos.set(eixo.axis, artifact.absoluteTargets[chave]);
      }
    }
  }
  // Eixo configurado não é cardinalidade APROVADA. Sem um alvo explícito em
  // lote aceito, declarar resíduo seria inventar uma decisão de produto — o
  // medidor deve ficar honestamente não-medido e bloquear COMPLETE.
  const eixos = [...alvos.keys()].sort();
  if (!eixos.length) return null;
  const residuo = eixos.filter(
    (eixo) => !alvos.has(eixo) || alvos.get(eixo) !== (contagens.get(eixo) ?? 0)
  ).length;
  return resultado(
    eixos.length,
    residuo,
    "eixos com alvo explícito em lote aceito cuja cardinalidade DTCG final diverge",
    [
      ...contratos,
      ...doTipo(registros, "acceptance"),
    ],
    { observedCardinalities: Object.fromEntries(contagens) }
  );
}

function medirVocabulario({ applicationRoot, sourceRoots }) {
  const proibidas = ["surface", "semantic", "content", "label", "foreground"];
  const rx = new RegExp(
    `\\b(?:(?:[a-z-]+):)*(?:bg|text|border|ring|fill|stroke|shadow|placeholder|divide|outline|from|via|to)-(?:${proibidas.join("|")})-[a-z0-9-]+`,
    "gu"
  );
  const raizes = sourceRoots
    .map((root) => path.resolve(applicationRoot, root))
    .filter(existsSync);
  if (!raizes.length) return null;
  let populacao = 0;
  let residuo = 0;
  const walk = (dir) => {
    for (const nome of readdirSync(dir)) {
      const p = path.join(dir, nome);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(?:[cm]?[jt]sx?|css|scss|sass|less)$/u.test(nome)) {
        const texto = readFileSync(p, "utf8");
        populacao += (texto.match(/class(?:Name)?=/gu) ?? []).length;
        residuo += (texto.match(rx) ?? []).length;
      }
    }
  };
  for (const raiz of raizes) walk(raiz);
  return resultado(
    populacao,
    residuo,
    `sítios class/className nas raízes ${sourceRoots.join(", ")} com vocabulário banido`,
    []
  );
}

function medirParidadeDtcg({ applicationRoot, registros }) {
  const tokenFile = path.join(applicationRoot, "tokens", "color.tokens.json");
  if (!existsSync(tokenFile)) return null;
  let dtcg;
  try {
    dtcg = JSON.parse(readFileSync(tokenFile, "utf8"));
  } catch {
    return null;
  }
  const folhas = folhasDtcg(dtcg);
  if (!folhas.length) return null;
  const caminhos = new Set(folhas.map(({ caminho }) => caminho.join(".")));
  const aliases = folhas.filter(
    ({ valor }) => typeof valor === "string" && /^\{[^{}]+\}$/u.test(valor)
  );
  const quebrados = aliases.filter(({ valor }) =>
    !caminhos.has(valor.slice(1, -1))
  );
  return resultado(
    folhas.length,
    quebrados.length,
    "folhas DTCG finais com alias quebrado; ciclos continuam recusados pelo build",
    doTipo(registros, "deterministic-checks")
  );
}

function medirRotas({ registros }) {
  const impactos = doTipo(registros, "impacted-context");
  if (!impactos.length) return null;
  let populacao = 0;
  let residuo = 0;
  for (const { artifact } of impactos) {
    populacao += artifact.routes?.length ?? 0;
    const descobertos = new Set(artifact.uncoveredConsumers ?? []);
    residuo += descobertos.size;
    if (artifact.coverageComplete !== true) residuo += 1;
  }
  return resultado(
    populacao,
    residuo,
    "rotas impactadas materializadas com consumidor e fixture declarados",
    impactos
  );
}

function manifestosFinaisOuAfter(registros) {
  const todos = doTipo(registros, "evidence-manifest");
  const finais = todos.filter(({ artifact }) => artifact.phase === "final");
  return finais.length
    ? finais
    : todos.filter(({ artifact }) => artifact.phase === "after");
}

function medirMatriz({ registros }) {
  const manifestos = manifestosFinaisOuAfter(registros);
  if (!manifestos.length) return null;
  let populacao = 0;
  let residuo = 0;
  for (const { artifact } of manifestos) {
    const pedidos = artifact.requestedScenarioIds ?? [];
    const produzidos = artifact.producedScenarioIds ?? [];
    const capturas = artifact.captures?.map(({ scenarioId }) => scenarioId) ?? [];
    populacao += pedidos.length;
    const esperado = new Set(pedidos);
    const observado = new Set([...produzidos, ...capturas]);
    residuo += [...esperado].filter((id) => !observado.has(id)).length;
    residuo += [...observado].filter((id) => !esperado.has(id)).length;
    residuo += produzidos.length - new Set(produzidos).size;
    residuo += capturas.length - new Set(capturas).size;
    if (artifact.exactCoverage !== true) residuo += 1;
  }
  return resultado(
    populacao,
    residuo,
    "IDs pedidos, produzidos e capturados na matriz visual exata",
    manifestos
  );
}

function medirPares({ registros }) {
  const comparacoes = doTipo(registros, "comparison");
  if (!comparacoes.length) return null;
  let populacao = 0;
  let residuo = 0;
  for (const { artifact } of comparacoes) {
    populacao += artifact.pairs?.length ?? 0;
    residuo += artifact.missingPairCount ?? 0;
    residuo += (artifact.pairs ?? []).filter(
      (pair) =>
        !pair.beforeCapture ||
        !pair.afterCapture ||
        !["identical", "changed"].includes(pair.status) ||
        pair.beforeDimensions?.width !== pair.afterDimensions?.width ||
        pair.beforeDimensions?.height !== pair.afterDimensions?.height
    ).length;
  }
  return resultado(
    populacao,
    residuo,
    "pares before/after com refs binárias e dimensões íntegras",
    comparacoes
  );
}

function medirRuntime({ registros }) {
  const manifestos = manifestosFinaisOuAfter(registros);
  if (!manifestos.length) return null;
  const capturas = manifestos.flatMap(({ artifact }) => artifact.captures ?? []);
  if (!capturas.length) return null;
  const residuo = capturas.reduce(
    (soma, capture) =>
      soma +
      (capture.consoleErrors?.length ?? 0) +
      (capture.pageErrors?.length ?? 0) +
      (capture.networkFailures?.length ?? 0) +
      (capture.axeViolationIds?.length ?? 0) +
      (capture.overflow ? 1 : 0),
    0
  );
  return resultado(
    capturas.length,
    residuo,
    "capturas sem novos erros de console/página/rede, Axe ou overflow",
    manifestos
  );
}

function medirEfeitos({ registros }) {
  const comparacoes = doTipo(registros, "comparison");
  if (!comparacoes.length) return null;
  let populacao = 0;
  let residuo = 0;
  for (const { artifact } of comparacoes) {
    populacao += artifact.pairs?.length ?? 0;
    residuo += artifact.missingPairCount ?? 0;
    residuo += (artifact.pairs ?? []).filter(
      ({ deterministicPolicyVerdict }) => deterministicPolicyVerdict !== "pass"
    ).length;
    if (artifact.deterministicVerdict !== "pass" || artifact.exactCoverage !== true) {
      residuo += 1;
    }
  }
  return resultado(
    populacao,
    residuo,
    "pares que não satisfazem deterministicamente preserve/change/mixed",
    comparacoes
  );
}

function medirRevisoes({ registros }) {
  const comparacoes = doTipo(registros, "comparison");
  const revisoes = doTipo(registros, "visual-review");
  if (!comparacoes.length) return null;
  const porLote = new Map(
    revisoes.map((registro) => [registro.artifact.batchId, registro])
  );
  let populacao = 0;
  let residuo = 0;
  for (const { artifact: comparison } of comparacoes) {
    const ids = comparison.pairs?.map(({ scenarioId }) => scenarioId) ?? [];
    populacao += ids.length;
    const review = porLote.get(comparison.batchId)?.artifact;
    if (!review) {
      residuo += ids.length;
      continue;
    }
    const entradas = new Map(
      (review.entries ?? []).map((entry) => [entry.scenarioId, entry])
    );
    residuo += ids.filter(
      (id) => entradas.get(id)?.verdict !== "expected"
    ).length;
    if (review.complete !== true || review.verdict !== "pass") residuo += 1;
  }
  return resultado(
    populacao,
    residuo,
    "pares de comparação sem revisão visual completa e expected",
    [...comparacoes, ...revisoes]
  );
}

function medirReversibilidade({ registros }) {
  const contratos = doTipo(registros, "batch-contract");
  const mutacoes = new Map(
    doTipo(registros, "mutation-manifest").map((registro) => [
      registro.artifact.batchId,
      registro,
    ])
  );
  const aceites = new Map(
    doTipo(registros, "acceptance").map((registro) => [
      registro.artifact.batchId,
      registro,
    ])
  );
  if (!contratos.length) return null;
  const residuo = contratos.filter(({ artifact: contrato }) => {
    const aceite = aceites.get(contrato.batchId)?.artifact;
    const mutacao = mutacoes.get(contrato.batchId)?.artifact;
    return (
      !mutacao ||
      !aceite ||
      aceite.verdict !== "accepted" ||
      !aceite.ledgerEntry ||
      aceite.preSourceFingerprint !== contrato.rollbackSourceFingerprint ||
      aceite.preSourceFingerprint === aceite.acceptedSourceFingerprint
    );
  }).length;
  return resultado(
    contratos.length,
    residuo,
    "lotes com rollback, mutação e aceite evidence-linked sobre fingerprints distintos",
    [
      ...contratos,
      ...doTipo(registros, "mutation-manifest"),
      ...doTipo(registros, "acceptance"),
    ]
  );
}

export const MEDIDORES_ABSOLUTOS = Object.freeze({
  "inventory.exceptions-complete": medirFonteInvalida,
  "tokens.hardcodes-and-arbitrary-zero": medirHardcodes,
  "tokens.naming-and-application-zero": medirNomeacao,
  "tokens.classes-emitted-live": medirClassesEmitidas,
  "tokens.scale-cardinalities-approved": medirCardinalidades,
  "tokens.legacy-vocabulary-zero": medirVocabulario,
  "tokens.dtcg-parity": medirParidadeDtcg,
  "rendered.routes-materialized": medirRotas,
  "rendered.exact-matrix": medirMatriz,
  "rendered.pairs-integrity": medirPares,
  "rendered.runtime-regressions-zero": medirRuntime,
  "rendered.batch-effects-satisfied": medirEfeitos,
  "rendered.image-reviews-complete": medirRevisoes,
  "process.accepted-batches-reversible": medirReversibilidade,
});

export function medirResiduosAbsolutos({ applicationRoot, runRoot, runConfig }) {
  const registros = lerRegistrosDoRun(runRoot);
  const contexto = {
    applicationRoot,
    runRoot,
    runConfig,
    sourceRoots: runConfig.sourceRoots ?? [],
    registros,
  };
  const resultados = new Map();
  for (const [predicateId, medidor] of Object.entries(MEDIDORES_ABSOLUTOS)) {
    resultados.set(predicateId, medidor(contexto));
  }
  return { resultados, registros };
}
