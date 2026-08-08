const SUPPORTED_ADAPTERS = new Set(["inline-style", "utility-class"]);

function supportedPhysicalValue(proposal) {
  if (proposal.axis !== "color") return true;
  const value = String(proposal.physicalValue ?? "").trim();
  return (
    /^#[\da-f]{3,8}$/iu.test(value) ||
    /^[a-z][a-z-]*$/iu.test(value) ||
    /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\(/iu.test(value) ||
    /^color\((?:srgb|srgb-linear|display-p3|a98-rgb|prophoto-rgb|rec2020|xyz-d50|xyz-d65)\s/iu.test(value)
  );
}

export function eligibleValueProposals(proposals) {
  return proposals
    .filter((proposal) => {
      const adapters = proposal.adapters ?? [proposal.adapter];
      return (
        proposal.confidence?.band === "high" &&
        !(proposal.confidence?.blockers ?? []).length &&
        Boolean(proposal.proposedName) &&
        Boolean(proposal.axis) &&
        Array.isArray(proposal.occurrenceIds) &&
        proposal.occurrenceIds.length > 0 &&
        Array.isArray(proposal.plannedFiles) &&
        proposal.plannedFiles.length > 0 &&
        supportedPhysicalValue(proposal) &&
        adapters.every((adapter) => SUPPORTED_ADAPTERS.has(adapter))
      );
    })
    .sort(
      (a, b) =>
        b.occurrenceIds.length - a.occurrenceIds.length ||
        a.clusterId.localeCompare(b.clusterId)
    );
}

export function proposalTokenKey(proposal) {
  return `${proposal.axis}.${proposal.proposedName}`;
}

export function partitionRouteReachableProposals(proposals, changedFiles) {
  const reachableFiles = new Set(
    changedFiles
      .filter(
        (entry) =>
          entry.status === "present" &&
          Array.isArray(entry.affectedRoutes) &&
          entry.affectedRoutes.length > 0
      )
      .map((entry) => entry.file)
  );
  const reachable = [];
  const unreachable = [];
  for (const proposal of proposals) {
    const uncoveredFiles = [...new Set(proposal.plannedFiles)].filter(
      (file) => !reachableFiles.has(file)
    );
    if (uncoveredFiles.length) {
      unreachable.push({ proposal, uncoveredFiles });
    } else {
      reachable.push(proposal);
    }
  }
  return { reachable, unreachable };
}

/**
 * A politica visual do lote cobre somente as rotas que o mesmo calculo de
 * blast-radius marcou como afetadas. Usar o registro visual inteiro inclui
 * cenarios alheios ao lote (por exemplo, auth pages sem consumidor do shard)
 * e contradiz a selecao exata usada por BEFORE/AFTER.
 */
export function scenarioIdsForAffectedRoutes(scenarios, affectedRoutes) {
  if (!Array.isArray(scenarios) || !Array.isArray(affectedRoutes)) {
    throw new Error("scenarios and affectedRoutes must be arrays");
  }
  const affectedPatterns = new Set(
    affectedRoutes
      .map((route) => route?.pathPattern)
      .filter((value) => typeof value === "string" && value.length > 0)
  );
  if (!affectedPatterns.size) {
    throw new Error("affectedRoutes must declare at least one pathPattern");
  }
  const scenarioIds = [];
  for (const scenario of scenarios) {
    if (!affectedPatterns.has(scenario?.routePattern)) continue;
    if (typeof scenario.scenarioId !== "string" || !scenario.scenarioId) {
      throw new Error(
        `affected route ${scenario?.routePattern ?? "unknown"} has a scenario without scenarioId`
      );
    }
    scenarioIds.push(scenario.scenarioId);
  }
  if (!scenarioIds.length) {
    throw new Error("affected routes matched no visual scenarios");
  }
  return [...new Set(scenarioIds)].sort();
}

/**
 * Porta o princípio de shard por diretório do Codemod.com para a unidade que
 * este processo consegue reverter: arquivos de callsite. Dois clusters que
 * compartilham arquivo não entram juntos, porque posições AST do segundo
 * deixariam de ser as posições classificadas depois da primeira edição.
 */
export function selectReversibleShard(proposals, { maxFiles = 20 } = {}) {
  if (!Number.isInteger(maxFiles) || maxFiles <= 0) {
    throw new Error("maxFiles must be a positive integer");
  }
  const ordered = eligibleValueProposals(proposals);
  if (!ordered.length) return { selected: [], deferred: [] };

  const firstFiles = new Set(ordered[0].plannedFiles);
  if (firstFiles.size > maxFiles) {
    throw new Error(
      `cluster ${ordered[0].clusterId} sozinho toca ${firstFiles.size} arquivos; aumente --max-files explicitamente`
    );
  }

  const selected = [];
  const deferred = [];
  const files = new Set();
  const tokenKeys = new Set();
  for (const proposal of ordered) {
    const proposalFiles = [...new Set(proposal.plannedFiles)];
    const overlaps = proposalFiles.some((file) => files.has(file));
    const projectedFiles = new Set([...files, ...proposalFiles]);
    const tokenKey = proposalTokenKey(proposal);
    if (
      overlaps ||
      tokenKeys.has(tokenKey) ||
      projectedFiles.size > maxFiles
    ) {
      deferred.push(proposal);
      continue;
    }
    selected.push(proposal);
    proposalFiles.forEach((file) => files.add(file));
    tokenKeys.add(tokenKey);
  }
  return {
    selected,
    deferred,
    files: [...files].sort(),
  };
}

export function assertReversibleShard(proposals) {
  const files = new Map();
  const tokens = new Map();
  for (const proposal of proposals) {
    const tokenKey = proposalTokenKey(proposal);
    if (tokens.has(tokenKey)) {
      throw new Error(
        `token ${tokenKey} pertence a ${tokens.get(tokenKey)} e ${proposal.clusterId}`
      );
    }
    tokens.set(tokenKey, proposal.clusterId);
    for (const file of new Set(proposal.plannedFiles ?? [])) {
      if (files.has(file)) {
        throw new Error(
          `arquivo ${file} pertence a ${files.get(file)} e ${proposal.clusterId}`
        );
      }
      files.set(file, proposal.clusterId);
    }
  }
  return true;
}
