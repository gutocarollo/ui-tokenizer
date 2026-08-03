/**
 * Política única de confiança para CLASSIFIED -> DECIDED.
 *
 * Antes havia duas filas incompatíveis: context-clusters usava o booleano
 * `proposedName`, enquanto converge-tokens usava uma soma 0..100. Este módulo
 * é o único dono do corte, da banda e da forma durável que entra no schema.
 */
export const CONFIDENCE_THRESHOLD = 70;

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function confidenceEvidence({
  signals,
  blockers = [],
  threshold = CONFIDENCE_THRESHOLD,
  scoreFloor = 0,
}) {
  const normalizedSignals = signals.map(({ name, weight, score, note }) => ({
    name,
    weight,
    score: clamp(score),
    note,
  }));
  const score = Math.max(
    scoreFloor,
    Math.round(
      normalizedSignals.reduce(
        (sum, signal) => sum + signal.weight * signal.score,
        0
      )
    )
  );
  const uniqueBlockers = [...new Set(blockers.filter(Boolean))].sort();
  const band = score >= threshold && uniqueBlockers.length === 0 ? "high" : "low";
  return {
    score,
    uncertainty: 100 - score,
    threshold,
    band,
    signals: normalizedSignals,
    blockers: uniqueBlockers,
  };
}

function ownerStrength(signal) {
  const value = String(signal ?? "");
  if (value.includes("high")) return 1;
  if (value.includes("medium")) return 0.6;
  if (value.includes("low")) return 0.3;
  return 0;
}

export function contextClusterConfidence(cluster) {
  const sample = cluster.sample ?? {};
  const proposed = Boolean(cluster.proposedName);
  const singleValue = (cluster.valueSpread ?? 0) === 1;
  const resolvedPrimitive =
    Boolean(cluster.dominantPrimitive) &&
    !String(cluster.dominantPrimitive).startsWith("(sem valor");
  const noValueDivergence = (cluster.divergentCount ?? 0) === 0;
  const noStateDivergence = (cluster.stateDivergences ?? 0) === 0;
  const signals = [
    {
      name: "nome-derivavel",
      weight: 30,
      score: proposed ? 1 : 0,
      note: proposed ? "owner e slot da lei produzem nome canônico" : "nome não derivável",
    },
    {
      name: "sinal-owner",
      weight: 20,
      score: ownerStrength(sample.ownerSignal),
      note: sample.ownerSignal ?? "owner sem evidência",
    },
    {
      name: "valor-unico",
      weight: 20,
      score: singleValue ? 1 : 0,
      note: singleValue ? "um valor físico" : `${cluster.valueSpread ?? 0} valores físicos`,
    },
    {
      name: "primitivo-resolvido",
      weight: 15,
      score: resolvedPrimitive ? 1 : 0,
      note: resolvedPrimitive ? "valor DTCG resolvível" : "valor não resolvível",
    },
    {
      name: "consistencia-contextual",
      weight: 15,
      score: noValueDivergence && noStateDivergence ? 1 : 0,
      note:
        noValueDivergence && noStateDivergence
          ? "sem divergência de valor ou estado"
          : `${cluster.divergentCount ?? 0} divergências de valor; ${cluster.stateDivergences ?? 0} de estado`,
    },
  ];
  const blockers = [
    !proposed ? cluster.reason ?? sample.lawGap ?? "nome não derivável" : null,
    !singleValue ? "mais de um valor físico no mesmo contrato" : null,
    !resolvedPrimitive ? "primitivo dominante não resolvido" : null,
    !noValueDivergence ? "ocorrências divergem do valor dominante" : null,
    !noStateDivergence ? "estado declarado diverge do consumo" : null,
  ];
  return confidenceEvidence({ signals, blockers });
}

export function mergeConfidenceEvidence(
  signals,
  {
    blockers = [],
    scoreFloor = 0,
    threshold = CONFIDENCE_THRESHOLD,
  } = {}
) {
  return confidenceEvidence({ signals, blockers, scoreFloor, threshold });
}

export function confidenceBlockReason(confidence) {
  if (!confidence) return "sem evidência multicritério de confiança";
  if (confidence.band === "high" && confidence.blockers.length === 0) {
    return null;
  }
  return `confiança baixa (${confidence.score}/${confidence.threshold}): ${
    confidence.blockers.join("; ") || "score abaixo do corte"
  }`;
}
