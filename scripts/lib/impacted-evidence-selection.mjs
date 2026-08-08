import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  baseScenarioIdFromMatrixId,
  matrixScenarioId,
} from "./evidence-matrix.mjs";
import { VisualContractError } from "./visual-contract.mjs";

function nonEmptyUniqueStrings(values, field) {
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.some(
      (value) =>
        typeof value !== "string" || !value.trim() || value !== value.trim()
    )
  ) {
    throw new VisualContractError(`${field} must be a non-empty string array`);
  }
  const unique = [...new Set(values)];
  if (unique.length !== values.length) {
    throw new VisualContractError(`${field} must not contain duplicates`);
  }
  return unique.sort((a, b) => a.localeCompare(b));
}

/**
 * Resolve a captura visual ao conjunto que o analisador de impacto provou.
 * Desconhecido nunca vira "todas as rotas" nem conjunto vazio: ambos apagariam
 * a relação entre callsite migrado e pixels revisados.
 */
export function readImpactedScenarioIds({
  impactedContextPath,
  batchId,
  matrix,
}) {
  const absolute = path.resolve(impactedContextPath);
  if (!existsSync(absolute)) {
    throw new VisualContractError(
      `Impacted context does not exist: ${absolute}`
    );
  }
  const artifact = JSON.parse(readFileSync(absolute, "utf8"));
  if (artifact.artifactType !== "impacted-context") {
    throw new VisualContractError(
      `Expected impacted-context at ${absolute}`
    );
  }
  if (artifact.batchId !== batchId) {
    throw new VisualContractError(
      `Impacted context ${artifact.batchId ?? "(missing)"} does not match ${batchId}`
    );
  }
  if (
    artifact.coverageComplete !== true ||
    (artifact.uncoveredConsumers ?? []).length > 0
  ) {
    throw new VisualContractError(
      `Impacted context for ${batchId} is incomplete`,
      {
        coverageComplete: artifact.coverageComplete,
        uncoveredConsumers: artifact.uncoveredConsumers ?? [],
      }
    );
  }
  const expanded = nonEmptyUniqueStrings(
    artifact.scenarioIds,
    "impacted-context.scenarioIds"
  );
  const baseIds = [
    ...new Set(expanded.map((matrixId) => baseScenarioIdFromMatrixId(matrixId))),
  ].sort((a, b) => a.localeCompare(b));
  const dimensions = {
    themes: matrix?.themes,
    projects: matrix?.projects,
    locales: matrix?.locales,
    writingModes: matrix?.writingModes,
  };
  if (
    Object.values(dimensions).some(
      (values) => !Array.isArray(values) || values.length === 0
    )
  ) {
    throw new VisualContractError(
      "run-config matrix must declare all visual dimensions"
    );
  }
  const reconstructed = [];
  for (const scenarioId of baseIds) {
    for (const theme of dimensions.themes) {
      for (const project of dimensions.projects) {
        for (const locale of dimensions.locales) {
          for (const writingMode of dimensions.writingModes) {
            reconstructed.push(
              matrixScenarioId({
                scenarioId,
                theme,
                project,
                locale,
                writingMode,
              })
            );
          }
        }
      }
    }
  }
  reconstructed.sort((a, b) => a.localeCompare(b));
  if (JSON.stringify(reconstructed) !== JSON.stringify(expanded)) {
    throw new VisualContractError(
      `Impacted context for ${batchId} does not cover the anchored matrix exactly`,
      { expected: reconstructed, actual: expanded }
    );
  }
  return baseIds;
}

/**
 * Projeta o registro global exatamente no escopo que o impacted-context
 * provou. O registro pode conhecer rotas fora do lote; serializá-las no
 * artefato durável faria o comparador exigir pixels que o próprio lote não
 * selecionou.
 */
export function selectImpactedScenarios({ scenarios, impactedBaseIds }) {
  const expected = nonEmptyUniqueStrings(
    impactedBaseIds,
    "impacted scenario base IDs"
  );
  const byId = new Map();
  for (const scenario of scenarios ?? []) {
    const scenarioId = scenario?.scenarioId;
    if (typeof scenarioId !== "string" || !scenarioId.trim()) {
      throw new VisualContractError(
        "visual registry scenarioId must be a non-empty string"
      );
    }
    if (byId.has(scenarioId)) {
      throw new VisualContractError(
        `Visual registry contains duplicate scenarioId: ${scenarioId}`
      );
    }
    byId.set(scenarioId, scenario);
  }
  const missing = expected.filter((scenarioId) => !byId.has(scenarioId));
  if (missing.length > 0) {
    throw new VisualContractError(
      "Impacted context references scenarios absent from the visual registry",
      { missing }
    );
  }
  return expected.map((scenarioId) => byId.get(scenarioId));
}
