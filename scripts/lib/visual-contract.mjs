import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

/*
 * A VERSÃO DO MOTOR, e ela deixou de aparecer em artefato (2026-08-01).
 *
 * Ela carimbava `schemaVersion: "2.0.0"` nos três artefatos que este módulo
 * emite, contra o `const "1.0.0"` que o contrato do journal exige — e por isso o
 * journal recusava tudo que a camada visual produzia. Dois contratos de artefato
 * incompatíveis convivendo, sem nada documentando a divergência.
 *
 * A reconciliação NÃO afrouxou o const, e a razão é medida: com o
 * `schemaVersion` já forçado a "1.0.0", o Ajv ainda reprova o mesmo manifesto em
 * outros CINCO pontos (`captures[].metaPath`, `captures[].metaSha256`,
 * `worktreeFingerprint`, `matrixFingerprint`, `coverage`). O const era 1 de 6, e
 * trocá-lo por `enum` compraria zero transições enquanto apagaria o único
 * discriminador entre um corpo de semântica A e um de semântica B — em 19 tipos,
 * para consertar 3.
 *
 * O que este número identifica agora é o MOTOR de contrato visual: a forma
 * interna que `evidenceManifestSchema` e os irmãos validam antes de emitir. Ele
 * não entra em artefato nenhum.
 */
export const VISUAL_CONTRACT_VERSION = "2.0.0";

/** A versão que TODO artefato carrega — a do contrato do journal, não a do motor. */
export const ARTIFACT_SCHEMA_VERSION = "1.0.0";
export const REQUIRED_CAPTURE_METADATA = Object.freeze([
  "consoleErrors",
  "pageErrors",
  "networkFailures",
  "axeViolationIds",
  "overflow",
]);

const SHA256_PATTERN = "^[a-f0-9]{64}$";
const NON_EMPTY_STRING = { type: "string", minLength: 1 };
const STRING_ARRAY = {
  type: "array",
  items: { type: "string" },
};
const SHA256 = { type: "string", pattern: SHA256_PATTERN };
const FINGERPRINT_FIELDS = Object.freeze([
  "sourceFingerprint",
  "worktreeFingerprint",
  "toolchainFingerprint",
  "tokenSourceFingerprint",
  "generatedCssFingerprint",
  "routeRegistryFingerprint",
  "fixtureRegistryFingerprint",
]);

const captureSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "scenarioId",
    "pngPath",
    "bytes",
    "width",
    "height",
    "sha256",
    "metaPath",
    "metaSha256",
    "consoleErrors",
    "pageErrors",
    "networkFailures",
    "axeViolationIds",
    "overflow",
  ],
  properties: {
    scenarioId: NON_EMPTY_STRING,
    pngPath: NON_EMPTY_STRING,
    bytes: { type: "integer", minimum: 1 },
    width: { type: "integer", minimum: 1 },
    height: { type: "integer", minimum: 1 },
    sha256: SHA256,
    metaPath: NON_EMPTY_STRING,
    metaSha256: SHA256,
    consoleErrors: STRING_ARRAY,
    pageErrors: STRING_ARRAY,
    networkFailures: STRING_ARRAY,
    axeViolationIds: {
      type: "array",
      uniqueItems: true,
      items: { type: "string" },
    },
    overflow: { type: "boolean" },
  },
};

export const evidenceManifestSchema = {
  $id: "https://makers-ai-hub.local/schemas/evidence-manifest-v2.json",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "artifactType",
    "runId",
    "batchId",
    "phase",
    "generatedAt",
    ...FINGERPRINT_FIELDS,
    "matrixFingerprint",
    "requestedScenarioIds",
    "producedScenarioIds",
    "coverage",
    "captures",
    "exactCoverage",
  ],
  properties: {
    schemaVersion: { const: ARTIFACT_SCHEMA_VERSION },
    artifactType: { const: "evidence-manifest" },
    runId: {
      type: "string",
      pattern: "^tokenize-[a-zA-Z0-9._-]+$",
    },
    batchId: {
      anyOf: [{ type: "string", pattern: "^B[0-9]{4,}$" }, { type: "null" }],
    },
    phase: {
      enum: ["global-before", "before", "after", "final"],
    },
    generatedAt: NON_EMPTY_STRING,
    sourceFingerprint: SHA256,
    worktreeFingerprint: SHA256,
    toolchainFingerprint: SHA256,
    tokenSourceFingerprint: SHA256,
    generatedCssFingerprint: SHA256,
    routeRegistryFingerprint: SHA256,
    fixtureRegistryFingerprint: SHA256,
    matrixFingerprint: SHA256,
    requestedScenarioIds: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: NON_EMPTY_STRING,
    },
    producedScenarioIds: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: NON_EMPTY_STRING,
    },
    coverage: {
      type: "object",
      additionalProperties: false,
      required: [
        "expectedCount",
        "actualCount",
        "missing",
        "extra",
        "duplicateExpected",
        "duplicateProduced",
        "invalidExpected",
        "invalidProduced",
        "invalidCaptures",
        "orphanMetadata",
        "exact",
      ],
      properties: {
        expectedCount: { type: "integer", minimum: 1 },
        actualCount: { type: "integer", minimum: 1 },
        missing: STRING_ARRAY,
        extra: STRING_ARRAY,
        duplicateExpected: STRING_ARRAY,
        duplicateProduced: STRING_ARRAY,
        invalidExpected: STRING_ARRAY,
        invalidProduced: STRING_ARRAY,
        invalidCaptures: STRING_ARRAY,
        orphanMetadata: STRING_ARRAY,
        exact: { const: true },
      },
    },
    captures: {
      type: "array",
      minItems: 1,
      items: captureSchema,
    },
    exactCoverage: { const: true },
  },
};

const visualReviewOutputSchema = {
  $id: "https://makers-ai-hub.local/schemas/visual-review-v2.json",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "artifactType",
    "runId",
    "batchId",
    "comparisonFingerprint",
    "reviewerId",
    "requiredReviewScenarioIds",
    "entries",
    "complete",
    "verdict",
  ],
  properties: {
    schemaVersion: { const: ARTIFACT_SCHEMA_VERSION },
    artifactType: { const: "visual-review" },
    runId: {
      type: "string",
      pattern: "^tokenize-[a-zA-Z0-9._-]+$",
    },
    batchId: { type: "string", pattern: "^B[0-9]{4,}$" },
    comparisonFingerprint: SHA256,
    reviewerId: NON_EMPTY_STRING,
    requiredReviewScenarioIds: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: NON_EMPTY_STRING,
    },
    entries: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "scenarioId",
          "verdict",
          "observation",
          "requiredAction",
          "evidenceRefs",
        ],
        properties: {
          scenarioId: NON_EMPTY_STRING,
          verdict: { enum: ["expected", "unexpected", "ambiguous"] },
          observation: NON_EMPTY_STRING,
          requiredAction: NON_EMPTY_STRING,
          evidenceRefs: {
            type: "array",
            minItems: 2,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["path", "sha256"],
              properties: {
                path: NON_EMPTY_STRING,
                sha256: SHA256,
              },
            },
          },
        },
      },
    },
    complete: { const: true },
    verdict: { enum: ["pass", "fail", "requires-human"] },
  },
};

const ajv = new Ajv({
  allErrors: true,
  strict: true,
  allowUnionTypes: true,
});
const validateEvidenceManifestSchema = ajv.compile(evidenceManifestSchema);
const validateVisualReviewSchema = ajv.compile(visualReviewOutputSchema);

export class VisualContractError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "VisualContractError";
    this.details = details;
  }
}

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256Value(value) {
  return sha256Bytes(Buffer.from(canonicalJson(value)));
}

export function sha256File(filePath) {
  return sha256Bytes(readFileSync(filePath));
}

export function isFullSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export function isValidScenarioId(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    value === value.trim() &&
    [...value].every((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
  );
}

function sortedUnique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function duplicates(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort((a, b) => String(a).localeCompare(String(b)));
}

export function analyzeExactCoverage({
  expectedIds,
  producedIds,
  invalidCaptures = [],
  orphanMetadata = [],
}) {
  const expected = Array.isArray(expectedIds) ? expectedIds : [];
  const produced = Array.isArray(producedIds) ? producedIds : [];
  const invalidExpected = expected
    .filter((id) => !isValidScenarioId(id))
    .map(String);
  const invalidProduced = produced
    .filter((id) => !isValidScenarioId(id))
    .map(String);
  const validExpected = expected.filter(isValidScenarioId);
  const validProduced = produced.filter(isValidScenarioId);
  const expectedSet = new Set(validExpected);
  const producedSet = new Set(validProduced);
  const missing = sortedUnique(
    [...expectedSet].filter((id) => !producedSet.has(id))
  );
  const extra = sortedUnique(
    [...producedSet].filter((id) => !expectedSet.has(id))
  );
  const duplicateExpected = duplicates(validExpected);
  const duplicateProduced = duplicates(validProduced);
  const diagnostics = {
    expectedCount: expected.length,
    actualCount: produced.length,
    missing,
    extra,
    duplicateExpected,
    duplicateProduced,
    invalidExpected: sortedUnique(invalidExpected),
    invalidProduced: sortedUnique(invalidProduced),
    invalidCaptures: sortedUnique(invalidCaptures.map(String)),
    orphanMetadata: sortedUnique(orphanMetadata.map(String)),
  };
  diagnostics.exact =
    expected.length > 0 &&
    produced.length > 0 &&
    Object.entries(diagnostics)
      .filter(([key]) => !["expectedCount", "actualCount"].includes(key))
      .every(([, values]) => Array.isArray(values) && values.length === 0);
  return diagnostics;
}

function assertStringArray(value, field, metaPath) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new VisualContractError(
      `${field} must be an array of strings in ${metaPath}`,
      { field, metaPath }
    );
  }
  return [...value];
}

function parseCaptureMetadata(metaPath, requiredFields) {
  let metadata;
  try {
    metadata = JSON.parse(readFileSync(metaPath, "utf8"));
  } catch (error) {
    throw new VisualContractError(`Invalid capture metadata: ${metaPath}`, {
      metaPath,
      cause: String(error),
    });
  }
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new VisualContractError(
      `Capture metadata must be a JSON object: ${metaPath}`,
      { metaPath }
    );
  }
  const missing = requiredFields.filter(
    (field) => !Object.prototype.hasOwnProperty.call(metadata, field)
  );
  if (missing.length) {
    throw new VisualContractError(
      `Capture metadata is incomplete: ${metaPath}`,
      { metaPath, missing }
    );
  }
  const scenarioId =
    metadata.scenarioId === undefined ? null : metadata.scenarioId;
  if (scenarioId !== null && !isValidScenarioId(scenarioId)) {
    throw new VisualContractError(`Invalid scenarioId in ${metaPath}`, {
      metaPath,
      scenarioId,
    });
  }
  if (typeof metadata.overflow !== "boolean") {
    throw new VisualContractError(`overflow must be boolean in ${metaPath}`, {
      metaPath,
    });
  }
  return {
    scenarioId,
    consoleErrors: assertStringArray(
      metadata.consoleErrors,
      "consoleErrors",
      metaPath
    ),
    pageErrors: assertStringArray(metadata.pageErrors, "pageErrors", metaPath),
    networkFailures: assertStringArray(
      metadata.networkFailures,
      "networkFailures",
      metaPath
    ),
    axeViolationIds: sortedUnique(
      assertStringArray(metadata.axeViolationIds, "axeViolationIds", metaPath)
    ),
    overflow: metadata.overflow,
  };
}

export function inspectPng(pngPath) {
  let decoded;
  try {
    decoded = PNG.sync.read(readFileSync(pngPath));
  } catch (error) {
    throw new VisualContractError(`Invalid PNG: ${pngPath}`, {
      pngPath,
      cause: String(error),
    });
  }
  const stats = statSync(pngPath);
  if (
    !stats.isFile() ||
    stats.size < 1 ||
    decoded.width < 1 ||
    decoded.height < 1
  ) {
    throw new VisualContractError(
      `PNG is empty or has invalid dimensions: ${pngPath}`,
      {
        pngPath,
        bytes: stats.size,
        width: decoded.width,
        height: decoded.height,
      }
    );
  }
  return {
    bytes: stats.size,
    width: decoded.width,
    height: decoded.height,
    sha256: sha256File(pngPath),
    png: decoded,
  };
}

function resolveStoredPath(filePath, manifestPath) {
  return path
    .relative(path.dirname(path.resolve(manifestPath)), path.resolve(filePath))
    .split(path.sep)
    .join("/");
}

export function collectCaptureCandidates({
  captureDirectory,
  requiredMetadataFields = REQUIRED_CAPTURE_METADATA,
}) {
  if (
    !existsSync(captureDirectory) ||
    !statSync(captureDirectory).isDirectory()
  ) {
    throw new VisualContractError(
      `Capture directory does not exist: ${captureDirectory}`,
      { captureDirectory }
    );
  }
  const names = readdirSync(captureDirectory).sort();
  const pngNames = names.filter((name) => name.toLowerCase().endsWith(".png"));
  const metaNames = new Set(
    names.filter((name) => name.toLowerCase().endsWith(".meta.json"))
  );
  const candidates = [];
  const invalidCaptures = [];
  const consumedMetadata = new Set();

  for (const pngName of pngNames) {
    const pngPath = path.join(captureDirectory, pngName);
    const base = pngName.slice(0, -4);
    const metaName = `${base}.meta.json`;
    const metaPath = path.join(captureDirectory, metaName);
    if (!metaNames.has(metaName)) {
      invalidCaptures.push(`${pngName}:missing-metadata`);
      continue;
    }
    consumedMetadata.add(metaName);
    try {
      const metadata = parseCaptureMetadata(metaPath, requiredMetadataFields);
      const scenarioId = metadata.scenarioId ?? base;
      const image = inspectPng(pngPath);
      candidates.push({
        pngPath,
        metaPath,
        ...image,
        ...metadata,
        scenarioId,
      });
    } catch (error) {
      invalidCaptures.push(
        `${pngName}:${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const orphanMetadata = [...metaNames]
    .filter((name) => !consumedMetadata.has(name))
    .sort();
  return { candidates, invalidCaptures, orphanMetadata };
}

function validateFingerprints(bindings) {
  const invalid = FINGERPRINT_FIELDS.filter(
    (field) => !isFullSha256(bindings?.[field])
  );
  if (invalid.length) {
    throw new VisualContractError(
      "Every evidence binding must be a full lowercase SHA-256",
      { invalidFingerprintFields: invalid }
    );
  }
}

/**
 * Valida o cabeçalho de artefato recebido de fora.
 *
 * POR QUE ELE VEM DE FORA. `runId` e os dois fingerprints da corrida eram
 * DIGITADOS na CLI (`--run-id`) e recalculados aqui por um segundo algoritmo.
 * Medido em 2026-08-01 no alvo, com a MESMA árvore:
 *
 *   sourceFingerprint    ancorado fa63…  ×  camada de evidência a691…
 *   toolchainFingerprint ancorado 884e…  ×  camada de evidência 3742…
 *
 * Dois nomes iguais com valores diferentes não são um detalhe cosmético: o
 * contrato cruza artefatos por `runId` + `sourceFingerprint`, e a divergência
 * DESLIGA EM SILÊNCIO a checagem de cenário desconhecido
 * (`artifact-contract.mjs`, guardada por `knownScenarios.size > 0`) — o guard
 * some sem emitir violação nenhuma.
 *
 * O header entra como DADO (objeto simples de 6 campos) e não como dependência
 * do módulo do envelope: produção o obtém de `envelope.measuredHeader()`, teste
 * o escreve literal. Validá-lo aqui é o que impede o dado de entrar torto.
 */
function assertArtifactHeader(header, expectedArtifactType) {
  if (!header || typeof header !== "object") {
    throw new VisualContractError(
      "Evidence manifest requires an artifact header — build it with envelope.measuredHeader()",
      { header }
    );
  }
  const problems = [];
  if (header.schemaVersion !== ARTIFACT_SCHEMA_VERSION) {
    problems.push(`schemaVersion must be ${ARTIFACT_SCHEMA_VERSION}`);
  }
  if (header.artifactType !== expectedArtifactType) {
    problems.push(`artifactType must be ${expectedArtifactType}`);
  }
  if (!/^tokenize-[a-zA-Z0-9._-]+$/.test(header.runId ?? "")) {
    problems.push("runId must match tokenize-[a-zA-Z0-9._-]+");
  }
  for (const field of ["sourceFingerprint", "toolchainFingerprint"]) {
    if (!isFullSha256(header[field])) {
      problems.push(`${field} must be a full lowercase SHA-256`);
    }
  }
  if (typeof header.generatedAt !== "string" || !header.generatedAt) {
    problems.push("generatedAt must be a non-empty string");
  }
  if (problems.length) {
    throw new VisualContractError("Invalid artifact header", {
      problems,
      header,
    });
  }
}

export function buildEvidenceManifest({
  captureDirectory,
  manifestPath,
  expectedScenarioIds,
  header,
  batchId,
  phase,
  bindings,
  requiredMetadataFields = REQUIRED_CAPTURE_METADATA,
}) {
  assertArtifactHeader(header, "evidence-manifest");
  validateFingerprints(bindings);
  /*
   * Os bindings nascem em `prepare-evidence-run` (ANTES da captura) e o
   * manifesto nasce depois dela. Se a árvore andou nesse intervalo, a evidência
   * foi capturada sobre uma base que já não é a declarada — e o par
   * before/after passa a comparar coisas diferentes sem sintoma. Esta igualdade
   * é a única prova de que a janela ficou estável, então ela falha ALTO em vez
   * de deixar o manifesto nascer mentindo.
   */
  for (const field of ["sourceFingerprint", "toolchainFingerprint"]) {
    if (bindings?.[field] !== header[field]) {
      throw new VisualContractError(
        `Evidence bindings disagree with the run header on ${field} — the source moved between prepare and manifest`,
        { field, binding: bindings?.[field] ?? null, header: header[field] }
      );
    }
  }
  if (!Array.isArray(expectedScenarioIds) || expectedScenarioIds.length === 0) {
    throw new VisualContractError(
      "Expected scenario IDs must be a non-empty array",
      { expectedScenarioIds }
    );
  }
  const { candidates, invalidCaptures, orphanMetadata } =
    collectCaptureCandidates({
      captureDirectory,
      requiredMetadataFields,
    });
  const producedIds = candidates.map((capture) => capture.scenarioId);
  const coverage = analyzeExactCoverage({
    expectedIds: expectedScenarioIds,
    producedIds,
    invalidCaptures,
    orphanMetadata,
  });
  if (!coverage.exact) {
    throw new VisualContractError(
      "Evidence coverage is not an exact non-empty equality",
      { coverage }
    );
  }

  const requestedScenarioIds = sortedUnique(expectedScenarioIds);
  const producedScenarioIds = sortedUnique(producedIds);
  const captures = candidates
    .map((capture) => ({
      scenarioId: capture.scenarioId,
      pngPath: resolveStoredPath(capture.pngPath, manifestPath),
      bytes: capture.bytes,
      width: capture.width,
      height: capture.height,
      sha256: capture.sha256,
      metaPath: resolveStoredPath(capture.metaPath, manifestPath),
      metaSha256: sha256File(capture.metaPath),
      consoleErrors: capture.consoleErrors,
      pageErrors: capture.pageErrors,
      networkFailures: capture.networkFailures,
      axeViolationIds: capture.axeViolationIds,
      overflow: capture.overflow,
    }))
    .sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));

  const manifest = {
    ...header,
    batchId,
    phase,
    // Os bindings vêm DEPOIS do header de propósito: a igualdade acima já
    // provou que os dois campos compartilhados concordam, então esta ordem não
    // pode mais sobrescrever o header com um valor divergente — antes podia, e
    // era assim que o valor do segundo algoritmo vencia em silêncio.
    ...Object.fromEntries(
      FINGERPRINT_FIELDS.map((field) => [field, bindings[field]])
    ),
    matrixFingerprint: sha256Value(requestedScenarioIds),
    requestedScenarioIds,
    producedScenarioIds,
    coverage,
    captures,
    exactCoverage: true,
  };
  assertEvidenceManifest(manifest);
  return manifest;
}

function formatAjvErrors(errors) {
  return (errors ?? []).map((error) => ({
    instancePath: error.instancePath,
    keyword: error.keyword,
    message: error.message,
    params: error.params,
  }));
}

export function assertEvidenceManifest(manifest) {
  if (!validateEvidenceManifestSchema(manifest)) {
    throw new VisualContractError("Evidence manifest v2 schema violation", {
      errors: formatAjvErrors(validateEvidenceManifestSchema.errors),
    });
  }
  if (Number.isNaN(Date.parse(manifest.generatedAt))) {
    throw new VisualContractError("generatedAt must be an ISO date-time", {
      generatedAt: manifest.generatedAt,
    });
  }
  const coverage = analyzeExactCoverage({
    expectedIds: manifest.requestedScenarioIds,
    producedIds: manifest.producedScenarioIds,
  });
  const captureCoverage = analyzeExactCoverage({
    expectedIds: manifest.requestedScenarioIds,
    producedIds: manifest.captures.map((capture) => capture.scenarioId),
  });
  const expectedStoredCoverage = {
    ...coverage,
    invalidCaptures: [],
    orphanMetadata: [],
  };
  const canonicalRequestedIds = sortedUnique(manifest.requestedScenarioIds);
  const canonicalProducedIds = sortedUnique(manifest.producedScenarioIds);
  if (
    !coverage.exact ||
    !captureCoverage.exact ||
    canonicalJson(manifest.coverage) !==
      canonicalJson(expectedStoredCoverage) ||
    canonicalJson(manifest.requestedScenarioIds) !==
      canonicalJson(canonicalRequestedIds) ||
    canonicalJson(manifest.producedScenarioIds) !==
      canonicalJson(canonicalProducedIds) ||
    manifest.matrixFingerprint !== sha256Value(canonicalRequestedIds)
  ) {
    throw new VisualContractError(
      "Manifest-internal matrix coverage or fingerprint is invalid",
      {
        coverage,
        captureCoverage,
        expectedStoredCoverage,
        storedCoverage: manifest.coverage,
      }
    );
  }
  return manifest;
}

function resolveManifestFile(manifestPath, storedPath) {
  return path.resolve(path.dirname(path.resolve(manifestPath)), storedPath);
}

export function verifyEvidenceManifestFiles(manifest, manifestPath) {
  assertEvidenceManifest(manifest);
  let diskManifest;
  try {
    diskManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new VisualContractError(
      `Evidence manifest file is missing or invalid: ${manifestPath}`,
      { manifestPath, cause: String(error) }
    );
  }
  if (canonicalJson(diskManifest) !== canonicalJson(manifest)) {
    throw new VisualContractError(
      "In-memory evidence manifest does not match the manifest file",
      { manifestPath }
    );
  }
  const verified = [];
  for (const capture of manifest.captures) {
    const pngPath = resolveManifestFile(manifestPath, capture.pngPath);
    const metaPath = resolveManifestFile(manifestPath, capture.metaPath);
    if (!existsSync(pngPath) || !existsSync(metaPath)) {
      throw new VisualContractError(
        `Evidence file is missing for ${capture.scenarioId}`,
        { scenarioId: capture.scenarioId, pngPath, metaPath }
      );
    }
    const actual = inspectPng(pngPath);
    const mismatches = {};
    for (const field of ["bytes", "width", "height", "sha256"]) {
      if (actual[field] !== capture[field]) {
        mismatches[field] = {
          manifest: capture[field],
          actual: actual[field],
        };
      }
    }
    const actualMetaSha256 = sha256File(metaPath);
    if (actualMetaSha256 !== capture.metaSha256) {
      mismatches.metaSha256 = {
        manifest: capture.metaSha256,
        actual: actualMetaSha256,
      };
    }
    if (Object.keys(mismatches).length) {
      throw new VisualContractError(
        `Evidence bytes do not match manifest for ${capture.scenarioId}`,
        { scenarioId: capture.scenarioId, mismatches }
      );
    }
    const metadata = parseCaptureMetadata(metaPath, REQUIRED_CAPTURE_METADATA);
    const actualScenarioId =
      metadata.scenarioId ?? path.basename(pngPath, path.extname(pngPath));
    const metadataProjection = {
      scenarioId: actualScenarioId,
      consoleErrors: metadata.consoleErrors,
      pageErrors: metadata.pageErrors,
      networkFailures: metadata.networkFailures,
      axeViolationIds: metadata.axeViolationIds,
      overflow: metadata.overflow,
    };
    const manifestProjection = {
      scenarioId: capture.scenarioId,
      consoleErrors: capture.consoleErrors,
      pageErrors: capture.pageErrors,
      networkFailures: capture.networkFailures,
      axeViolationIds: capture.axeViolationIds,
      overflow: capture.overflow,
    };
    if (
      canonicalJson(metadataProjection) !== canonicalJson(manifestProjection)
    ) {
      throw new VisualContractError(
        `Capture metadata does not match manifest for ${capture.scenarioId}`,
        {
          scenarioId: capture.scenarioId,
          manifest: manifestProjection,
          actual: metadataProjection,
        }
      );
    }
    verified.push({
      ...capture,
      pngPath,
      metaPath,
      png: actual.png,
    });
  }
  return verified;
}

function rgbaAt(png, x, y) {
  if (x >= png.width || y >= png.height) return null;
  const offset = (y * png.width + x) * 4;
  return [
    png.data[offset],
    png.data[offset + 1],
    png.data[offset + 2],
    png.data[offset + 3],
  ];
}

function makeExactHeatmap(before, after, width, height) {
  const heatmap = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const a = rgbaAt(before, x, y);
      const b = rgbaAt(after, x, y);
      const changed =
        a === null ||
        b === null ||
        a.some((channel, index) => channel !== b[index]);
      const offset = (y * width + x) * 4;
      if (changed) {
        heatmap.data[offset] = 255;
        heatmap.data[offset + 1] = 0;
        heatmap.data[offset + 2] = 128;
        heatmap.data[offset + 3] = 255;
      } else {
        const luminance = Math.round(
          (a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722) * 0.25
        );
        heatmap.data[offset] = luminance;
        heatmap.data[offset + 1] = luminance;
        heatmap.data[offset + 2] = luminance;
        heatmap.data[offset + 3] = 255;
      }
    }
  }
  return heatmap;
}

function intersectionBuffer(png, width, height) {
  const result = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceStart = y * png.width * 4;
    png.data.copy(result, y * width * 4, sourceStart, sourceStart + width * 4);
  }
  return result;
}

export function comparePngFiles(
  beforePath,
  afterPath,
  {
    heatmapPath = null,
    pixelmatchThreshold = 0.1,
    includeAntialiasing = true,
  } = {}
) {
  const before = inspectPng(beforePath).png;
  const after = inspectPng(afterPath).png;
  const width = Math.max(before.width, after.width);
  const height = Math.max(before.height, after.height);
  const totalPixels = width * height;
  let exactChangedPixels = 0;
  let maxChannelDelta = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const a = rgbaAt(before, x, y);
      const b = rgbaAt(after, x, y);
      let changed = a === null || b === null;
      if (a !== null && b !== null) {
        for (let channel = 0; channel < 4; channel += 1) {
          const delta = Math.abs(a[channel] - b[channel]);
          maxChannelDelta = Math.max(maxChannelDelta, delta);
          if (delta !== 0) changed = true;
        }
      } else {
        const existing = a ?? b;
        maxChannelDelta = Math.max(
          maxChannelDelta,
          ...existing.map((channel) => Math.abs(channel))
        );
      }
      if (changed) {
        exactChangedPixels += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const intersectionWidth = Math.min(before.width, after.width);
  const intersectionHeight = Math.min(before.height, after.height);
  const intersectionPixels = intersectionWidth * intersectionHeight;
  const perceptualIntersection =
    intersectionPixels === 0
      ? 0
      : pixelmatch(
          intersectionBuffer(before, intersectionWidth, intersectionHeight),
          intersectionBuffer(after, intersectionWidth, intersectionHeight),
          null,
          intersectionWidth,
          intersectionHeight,
          {
            threshold: pixelmatchThreshold,
            includeAA: includeAntialiasing,
          }
        );
  const dimensionOnlyPixels = totalPixels - intersectionPixels;
  const perceptualChangedPixels = perceptualIntersection + dimensionOnlyPixels;

  let storedHeatmapPath = null;
  if (exactChangedPixels > 0 && heatmapPath) {
    mkdirSync(path.dirname(heatmapPath), { recursive: true });
    writeFileSync(
      heatmapPath,
      PNG.sync.write(makeExactHeatmap(before, after, width, height))
    );
    storedHeatmapPath = heatmapPath;
  }

  return {
    status: exactChangedPixels === 0 ? "identical" : "changed",
    beforeDimensions: { width: before.width, height: before.height },
    afterDimensions: { width: after.width, height: after.height },
    exactChangedPixels,
    exactChangedPixelRatio: exactChangedPixels / totalPixels,
    perceptualChangedPixels,
    perceptualChangedPixelRatio: perceptualChangedPixels / totalPixels,
    maxChannelDelta,
    diffBounds:
      exactChangedPixels === 0
        ? null
        : {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1,
          },
    heatmapPath: storedHeatmapPath,
  };
}

function multisetAdded(before, after) {
  const remaining = new Map();
  for (const value of before) {
    remaining.set(value, (remaining.get(value) ?? 0) + 1);
  }
  const added = [];
  for (const value of after) {
    const count = remaining.get(value) ?? 0;
    if (count > 0) remaining.set(value, count - 1);
    else added.push(value);
  }
  return added;
}

export function calculateErrorDelta(before, after) {
  const added = {
    console: multisetAdded(before.consoleErrors, after.consoleErrors),
    page: multisetAdded(before.pageErrors, after.pageErrors),
    network: multisetAdded(before.networkFailures, after.networkFailures),
    axe: multisetAdded(before.axeViolationIds, after.axeViolationIds),
  };
  const overflowIntroduced = !before.overflow && after.overflow;
  return {
    counts: {
      console: after.consoleErrors.length - before.consoleErrors.length,
      page: after.pageErrors.length - before.pageErrors.length,
      network: after.networkFailures.length - before.networkFailures.length,
      axe: after.axeViolationIds.length - before.axeViolationIds.length,
      overflow: Number(after.overflow) - Number(before.overflow),
    },
    added,
    overflowIntroduced,
    hasRegression:
      Object.values(added).some((values) => values.length > 0) ||
      overflowIntroduced,
  };
}

/**
 * Campos de bind que PODEM ser dispensados, e apenas com prova mecanica.
 *
 * `runId`, `batchId`, `matrixFingerprint`, `toolchainFingerprint` e
 * `routeRegistryFingerprint` NAO entram aqui de proposito: divergencia neles
 * significa que as duas capturas sao de execucoes, matrizes ou toolchains
 * diferentes, e nenhuma prova de codigo conserta isso.
 *
 * `fixtureRegistryFingerprint` e o unico caso em que a divergencia pode ser
 * legitima: ele inclui o sha256 dos `contractSources`, entao um codemod de
 * apresentacao numa pagina que e contractSource move o hash sem mudar uma
 * requisicao sequer.
 */
const WAIVABLE_BINDINGS = new Set(["fixtureRegistryFingerprint"]);

/**
 * Dispensa um mismatch de bind SOMENTE com prova mecanica fixada ao par
 * observado.
 *
 * A dispensa nao e uma promessa de quem executou: ela aponta para o veredito
 * de `verify-contract-source-delta`, que so devolve PASS quando o delta dos
 * contractSources esta confinado a valor de `className` e import de entidade
 * de design — verificado por AST, exigindo identidade byte a byte no que
 * sobra.
 *
 * Fixada ao PAR: a excecao declara `before` e `after` e eles tem que bater
 * exatamente com o que os manifests trazem. Sem isso uma dispensa aprovada uma
 * vez viraria passe permanente para qualquer drift futuro.
 *
 * Falha fechada: campo nao dispensavel, prova ausente, prova de outro par ou
 * veredito != PASS mantem o mismatch e o comparador continua estourando.
 */
export function applyBindingWaivers(mismatches, policy) {
  const declared = policy?.approvedBindingExceptions ?? [];
  if (!Array.isArray(declared)) {
    throw new VisualContractError(
      "approvedBindingExceptions must be an array",
      { approvedBindingExceptions: declared }
    );
  }
  const waived = [];
  const unwaived = [];

  for (const mismatch of mismatches) {
    const exception = declared.find(
      (candidate) =>
        candidate?.field === mismatch.field &&
        candidate?.before === mismatch.before &&
        candidate?.after === mismatch.after
    );
    if (!exception) {
      unwaived.push(mismatch);
      continue;
    }
    if (!WAIVABLE_BINDINGS.has(mismatch.field)) {
      throw new VisualContractError(
        `Binding field ${mismatch.field} can never be waived`,
        { field: mismatch.field }
      );
    }
    for (const required of ["owner", "reason", "scope", "evidence", "review"]) {
      if (typeof exception[required] !== "string" || !exception[required].trim()) {
        throw new VisualContractError(
          `Binding exception requires a non-empty ${required}`,
          { field: mismatch.field, missing: required }
        );
      }
    }
    const evidencePath = path.resolve(exception.evidence);
    if (!existsSync(evidencePath)) {
      throw new VisualContractError(
        "Binding exception evidence file does not exist",
        { field: mismatch.field, evidence: evidencePath }
      );
    }
    let proof;
    try {
      proof = JSON.parse(readFileSync(evidencePath, "utf8"));
    } catch (error) {
      throw new VisualContractError(
        "Binding exception evidence is not readable JSON",
        { field: mismatch.field, evidence: evidencePath, error: error.message }
      );
    }
    if (
      proof?.tool !== "verify-contract-source-delta" ||
      proof?.verdict !== "PASS" ||
      proof?.field !== mismatch.field ||
      proof?.fieldBefore !== mismatch.before ||
      proof?.fieldAfter !== mismatch.after
    ) {
      throw new VisualContractError(
        "Binding exception evidence does not prove this exact mismatch",
        {
          field: mismatch.field,
          expected: { before: mismatch.before, after: mismatch.after },
          proof: {
            tool: proof?.tool,
            verdict: proof?.verdict,
            field: proof?.field,
            fieldBefore: proof?.fieldBefore,
            fieldAfter: proof?.fieldAfter,
          },
        }
      );
    }
    waived.push({
      field: mismatch.field,
      before: mismatch.before,
      after: mismatch.after,
      owner: exception.owner,
      reason: exception.reason,
      scope: exception.scope,
      review: exception.review,
      evidence: evidencePath,
      changedContractSources: proof.changedContractSources ?? [],
      permittedCategories: proof.permittedCategories ?? [],
    });
  }
  return { waived, unwaived };
}

function normalizePolicy(policy, scenarioIds) {
  const expectedVisualEffect = policy?.expectedVisualEffect;
  if (!["preserve", "change", "mixed"].includes(expectedVisualEffect)) {
    throw new VisualContractError(
      "expectedVisualEffect must be preserve, change, or mixed",
      { expectedVisualEffect }
    );
  }
  const allIds = sortedUnique(scenarioIds);
  let changed = [
    ...(policy.expectedChangedScenarioIds ??
      policy.expectedChangedScenarios ??
      []),
  ];
  let unchanged = [
    ...(policy.expectedUnchangedScenarioIds ??
      policy.expectedUnchangedScenarios ??
      []),
  ];
  if (expectedVisualEffect === "preserve") {
    if (changed.length) {
      throw new VisualContractError(
        "A preserve policy cannot declare changed scenarios",
        { changed }
      );
    }
    unchanged = unchanged.length ? unchanged : allIds;
  } else if (expectedVisualEffect === "change") {
    changed = changed.length ? changed : allIds;
    unchanged = unchanged.length
      ? unchanged
      : allIds.filter((id) => !new Set(changed).has(id));
  } else if (!changed.length || !unchanged.length) {
    throw new VisualContractError(
      "A mixed policy requires non-empty changed and unchanged scenario IDs",
      { changed, unchanged }
    );
  }
  const declarationCoverage = analyzeExactCoverage({
    expectedIds: allIds,
    producedIds: [...changed, ...unchanged],
  });
  const overlap = changed.filter((id) => new Set(unchanged).has(id));
  if (!declarationCoverage.exact || overlap.length) {
    throw new VisualContractError(
      "Visual policy declarations must partition the exact scenario matrix",
      { declarationCoverage, overlap: sortedUnique(overlap) }
    );
  }
  const thresholds = {
    preserveMaxExactChangedPixels:
      policy.thresholds?.preserveMaxExactChangedPixels ?? 0,
    preserveMaxExactChangedPixelRatio:
      policy.thresholds?.preserveMaxExactChangedPixelRatio ?? 0,
    changeMinExactChangedPixels:
      policy.thresholds?.changeMinExactChangedPixels ?? 0,
    changeMinExactChangedPixelRatio:
      policy.thresholds?.changeMinExactChangedPixelRatio ?? 0,
    pixelmatchThreshold: policy.thresholds?.pixelmatchThreshold ?? 0.1,
  };
  for (const [name, value] of Object.entries(thresholds)) {
    if (typeof value !== "number" || value < 0 || !Number.isFinite(value)) {
      throw new VisualContractError(`Invalid visual threshold: ${name}`, {
        name,
        value,
      });
    }
  }
  return {
    expectedVisualEffect,
    changedScenarioIds: sortedUnique(changed),
    unchangedScenarioIds: sortedUnique(unchanged),
    thresholds,
  };
}

function expectedEffectFor(policy, scenarioId) {
  return policy.changedScenarioIds.includes(scenarioId) ? "change" : "preserve";
}

function evaluatePairPolicy(pair, expectedEffect, thresholds) {
  if (pair.errorDelta.hasRegression) {
    return {
      verdict: "fail",
      reasons: ["new-runtime-or-accessibility-error"],
    };
  }
  if (expectedEffect === "preserve") {
    const failures = [];
    if (pair.exactChangedPixels > thresholds.preserveMaxExactChangedPixels) {
      failures.push("exact-changed-pixels-exceeded");
    }
    if (
      pair.exactChangedPixelRatio > thresholds.preserveMaxExactChangedPixelRatio
    ) {
      failures.push("exact-changed-pixel-ratio-exceeded");
    }
    return {
      verdict: failures.length ? "fail" : "pass",
      reasons: failures,
    };
  }
  const failures = [];
  if (pair.exactChangedPixels <= thresholds.changeMinExactChangedPixels) {
    failures.push("expected-change-not-observed-by-pixel-count");
  }
  if (
    pair.exactChangedPixelRatio <= thresholds.changeMinExactChangedPixelRatio
  ) {
    failures.push("expected-change-not-observed-by-pixel-ratio");
  }
  return {
    verdict: failures.length ? "fail" : "pass",
    reasons: failures,
  };
}

/**
 * Referência a BYTES: caminho relativo + hash. Sem `artifactType`, porque um PNG
 * e um mapa de calor não são nenhum dos tipos fechados do contrato — declarar um
 * tipo falso ali faria o coletor de referências tentar resolvê-los como artefato
 * e não achar registro nenhum.
 */
function artifactRef(filePath, relativeTo) {
  return {
    path: path
      .relative(relativeTo, path.resolve(filePath))
      .split(path.sep)
      .join("/"),
    sha256: sha256File(filePath),
  };
}

/**
 * Referência a um ARTEFATO do contrato: os mesmos dois campos MAIS o tipo.
 *
 * A distinção não é estilística. `referencedTargets` (artifact-contract.mjs)
 * devolve lista VAZIA para qualquer ref sem `artifactType`, e a invariante que
 * exige "os refs da comparação resolvem para os manifestos declarados" comparava
 * essa lista vazia — reprovando toda comparação, inclusive a correta. Manifesto
 * é artefato e leva tipo; captura é byte e leva hash.
 */
function contractArtifactRef(artifactType, filePath, relativeTo) {
  return { artifactType, ...artifactRef(filePath, relativeTo) };
}

function safeArtifactStem(scenarioId) {
  const readable = scenarioId
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return `${readable || "capture"}-${sha256Value(scenarioId).slice(0, 12)}`;
}

export function compareEvidenceManifests({
  beforeManifest,
  beforeManifestPath,
  afterManifest,
  afterManifestPath,
  policy,
  outputDirectory,
}) {
  const beforeCaptures = verifyEvidenceManifestFiles(
    beforeManifest,
    beforeManifestPath
  );
  const afterCaptures = verifyEvidenceManifestFiles(
    afterManifest,
    afterManifestPath
  );
  if (
    !["global-before", "before"].includes(beforeManifest.phase) ||
    !["after", "final"].includes(afterManifest.phase) ||
    beforeManifest.batchId === null ||
    afterManifest.batchId === null
  ) {
    throw new VisualContractError(
      "Comparison requires bound before/after phases and a non-null batch",
      {
        beforePhase: beforeManifest.phase,
        afterPhase: afterManifest.phase,
        beforeBatchId: beforeManifest.batchId,
        afterBatchId: afterManifest.batchId,
      }
    );
  }
  const immutableBindings = [
    "runId",
    "batchId",
    "matrixFingerprint",
    "toolchainFingerprint",
    "routeRegistryFingerprint",
    "fixtureRegistryFingerprint",
  ];
  const bindingMismatches = immutableBindings
    .filter((field) => beforeManifest[field] !== afterManifest[field])
    .map((field) => ({
      field,
      before: beforeManifest[field],
      after: afterManifest[field],
    }));
  const matrixCoverage = analyzeExactCoverage({
    expectedIds: beforeManifest.requestedScenarioIds,
    producedIds: afterManifest.requestedScenarioIds,
  });
  const { unwaived: unwaivedMismatches, waived: waivedBindings } =
    applyBindingWaivers(bindingMismatches, policy);
  if (unwaivedMismatches.length || !matrixCoverage.exact) {
    throw new VisualContractError(
      "Before and after evidence do not bind the exact same matrix",
      { bindingMismatches: unwaivedMismatches, waivedBindings, matrixCoverage }
    );
  }
  const normalizedPolicy = normalizePolicy(
    policy,
    beforeManifest.requestedScenarioIds
  );
  const beforeById = new Map(
    beforeCaptures.map((capture) => [capture.scenarioId, capture])
  );
  const afterById = new Map(
    afterCaptures.map((capture) => [capture.scenarioId, capture])
  );
  const heatmapDirectory = path.join(outputDirectory, "heatmaps");
  const pairs = beforeManifest.requestedScenarioIds.map((scenarioId) => {
    const before = beforeById.get(scenarioId);
    const after = afterById.get(scenarioId);
    const heatmapPath = path.join(
      heatmapDirectory,
      `${safeArtifactStem(scenarioId)}.png`
    );
    const pixel = comparePngFiles(before.pngPath, after.pngPath, {
      heatmapPath,
      pixelmatchThreshold: normalizedPolicy.thresholds.pixelmatchThreshold,
    });
    const errorDelta = calculateErrorDelta(before, after);
    const expectedVisualEffect = expectedEffectFor(
      normalizedPolicy,
      scenarioId
    );
    const policyResult = evaluatePairPolicy(
      { ...pixel, errorDelta },
      expectedVisualEffect,
      normalizedPolicy.thresholds
    );
    return {
      scenarioId,
      expectedVisualEffect,
      beforeCapture: artifactRef(before.pngPath, outputDirectory),
      afterCapture: artifactRef(after.pngPath, outputDirectory),
      status: pixel.status,
      beforeDimensions: pixel.beforeDimensions,
      afterDimensions: pixel.afterDimensions,
      exactChangedPixels: pixel.exactChangedPixels,
      exactChangedPixelRatio: pixel.exactChangedPixelRatio,
      perceptualChangedPixels: pixel.perceptualChangedPixels,
      perceptualChangedPixelRatio: pixel.perceptualChangedPixelRatio,
      maxChannelDelta: pixel.maxChannelDelta,
      diffBounds: pixel.diffBounds,
      heatmap:
        pixel.heatmapPath === null
          ? null
          : artifactRef(pixel.heatmapPath, outputDirectory),
      errorDelta,
      deterministicPolicyVerdict: policyResult.verdict,
      policyReasons: policyResult.reasons,
    };
  });

  const deterministicVerdict = pairs.some(
    (pair) => pair.deterministicPolicyVerdict === "fail"
  )
    ? "fail"
    : "pass";
  const comparison = {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    artifactType: "comparison",
    runId: beforeManifest.runId,
    batchId: beforeManifest.batchId,
    generatedAt: afterManifest.generatedAt,
    sourceFingerprint: afterManifest.sourceFingerprint,
    worktreeFingerprint: afterManifest.worktreeFingerprint,
    toolchainFingerprint: afterManifest.toolchainFingerprint,
    beforeManifest: contractArtifactRef(
      "evidence-manifest",
      beforeManifestPath,
      outputDirectory
    ),
    afterManifest: contractArtifactRef(
      "evidence-manifest",
      afterManifestPath,
      outputDirectory
    ),
    beforeBindings: Object.fromEntries(
      FINGERPRINT_FIELDS.map((field) => [field, beforeManifest[field]])
    ),
    afterBindings: Object.fromEntries(
      FINGERPRINT_FIELDS.map((field) => [field, afterManifest[field]])
    ),
    matrixFingerprint: beforeManifest.matrixFingerprint,
    expectedVisualEffect: normalizedPolicy.expectedVisualEffect,
    expectedChangedScenarioIds: normalizedPolicy.changedScenarioIds,
    expectedUnchangedScenarioIds: normalizedPolicy.unchangedScenarioIds,
    thresholds: normalizedPolicy.thresholds,
    pairs,
    missingPairCount: 0,
    exactCoverage: true,
    deterministicVerdict,
    requiredReviewScenarioIds: [...beforeManifest.requestedScenarioIds],
    visualReviewVerdict: "pending",
    waivedBindings,
    verdict: deterministicVerdict === "fail" ? "fail" : "review",
  };
  return comparison;
}

export function buildVisualReviewInput(comparison, comparisonPath) {
  if (!Array.isArray(comparison.pairs) || comparison.pairs.length === 0) {
    throw new VisualContractError(
      "Cannot build visual review input from an empty comparison"
    );
  }
  const comparisonFingerprint = sha256Value(comparison);
  return {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    artifactType: "visual-review-input",
    runId: comparison.runId,
    batchId: comparison.batchId,
    comparison: {
      path: comparisonPath,
      sha256: comparisonFingerprint,
    },
    comparisonFingerprint,
    expectedVisualEffect: comparison.expectedVisualEffect,
    requiredReviewScenarioIds: [...comparison.requiredReviewScenarioIds],
    instructions: [
      "Inspect every before and after PNG; code diffs are not visual evidence.",
      "Inspect the heatmap when present and reconcile it with the declared expected effect.",
      "Use a non-empty concrete observation and required action for every scenario.",
      "Use requiredAction='none' only when the rendered result is demonstrably expected.",
    ],
    entries: comparison.pairs.map((pair) => ({
      scenarioId: pair.scenarioId,
      expectedVisualEffect: pair.expectedVisualEffect,
      deterministicPolicyVerdict: pair.deterministicPolicyVerdict,
      policyReasons:
        pair.policyReasons.length > 0 ? pair.policyReasons : ["none"],
      beforeCapture: pair.beforeCapture,
      afterCapture: pair.afterCapture,
      heatmap: pair.heatmap,
      metrics: {
        exactChangedPixels: pair.exactChangedPixels,
        exactChangedPixelRatio: pair.exactChangedPixelRatio,
        perceptualChangedPixels: pair.perceptualChangedPixels,
        perceptualChangedPixelRatio: pair.perceptualChangedPixelRatio,
        maxChannelDelta: pair.maxChannelDelta,
        diffBounds: pair.diffBounds,
      },
      requiredQuestions: [
        "Does the rendered result match the declared preserve/change policy?",
        "Is there clipping, overflow, hierarchy loss, contrast loss, or an uncovered state?",
      ],
    })),
  };
}

function assertNonBlank(value, field, scenarioId) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new VisualContractError(
      `${field} must be non-empty for ${scenarioId}`,
      { field, scenarioId }
    );
  }
}

export function validateVisualReviewOutput(
  review,
  { comparison, comparisonFingerprint = sha256Value(comparison) }
) {
  if (!validateVisualReviewSchema(review)) {
    throw new VisualContractError("Visual review output schema violation", {
      errors: formatAjvErrors(validateVisualReviewSchema.errors),
    });
  }
  assertNonBlank(review.reviewerId, "reviewerId", "visual-review");
  const requiredIds = [...comparison.requiredReviewScenarioIds].sort();
  const declaredCoverage = analyzeExactCoverage({
    expectedIds: requiredIds,
    producedIds: review.requiredReviewScenarioIds,
  });
  const entryCoverage = analyzeExactCoverage({
    expectedIds: requiredIds,
    producedIds: review.entries.map((entry) => entry.scenarioId),
  });
  if (!declaredCoverage.exact || !entryCoverage.exact) {
    throw new VisualContractError(
      "Visual review must cover the exact non-empty comparison matrix",
      { declaredCoverage, entryCoverage }
    );
  }
  if (
    review.runId !== comparison.runId ||
    review.batchId !== comparison.batchId ||
    review.comparisonFingerprint !== comparisonFingerprint
  ) {
    throw new VisualContractError(
      "Visual review is not bound to this comparison",
      {
        expected: {
          runId: comparison.runId,
          batchId: comparison.batchId,
          comparisonFingerprint,
        },
        actual: {
          runId: review.runId,
          batchId: review.batchId,
          comparisonFingerprint: review.comparisonFingerprint,
        },
      }
    );
  }
  for (const entry of review.entries) {
    assertNonBlank(entry.observation, "observation", entry.scenarioId);
    assertNonBlank(entry.requiredAction, "requiredAction", entry.scenarioId);
    const pair = comparison.pairs.find(
      (candidate) => candidate.scenarioId === entry.scenarioId
    );
    const requiredRefs = [
      pair.beforeCapture,
      pair.afterCapture,
      ...(pair.heatmap ? [pair.heatmap] : []),
    ];
    const actualRefs = new Set(
      entry.evidenceRefs.map((ref) => `${ref.path}:${ref.sha256}`)
    );
    const missingRefs = requiredRefs.filter(
      (ref) => !actualRefs.has(`${ref.path}:${ref.sha256}`)
    );
    if (missingRefs.length) {
      throw new VisualContractError(
        `Visual review evidence refs are incomplete for ${entry.scenarioId}`,
        { scenarioId: entry.scenarioId, missingRefs }
      );
    }
  }
  const computedVerdict = review.entries.some(
    (entry) => entry.verdict === "unexpected"
  )
    ? "fail"
    : review.entries.some((entry) => entry.verdict === "ambiguous")
      ? "requires-human"
      : "pass";
  if (review.verdict !== computedVerdict) {
    throw new VisualContractError(
      "Visual review verdict contradicts its entries",
      { declared: review.verdict, computed: computedVerdict }
    );
  }
  return { review, verdict: computedVerdict };
}

export function bindVisualReview(comparison, review) {
  const validation = validateVisualReviewOutput(review, { comparison });
  return {
    ...comparison,
    visualReviewVerdict: validation.verdict,
    verdict:
      comparison.deterministicVerdict === "fail" ||
      validation.verdict === "fail"
        ? "fail"
        : validation.verdict === "requires-human"
          ? "review"
          : "pass",
  };
}
