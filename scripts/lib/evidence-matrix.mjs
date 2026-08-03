import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

import {
  canonicalJson,
  isFullSha256,
  sha256Bytes,
  sha256File,
  sha256Value,
  VisualContractError,
} from "./visual-contract.mjs";

const DEFAULT_MATRIX_FILE = "tests/visual/evidence-matrix.json";
const DEFAULT_SCENARIO_FILE = "tests/visual/scenarios.json";
const DEFAULT_CONTEXT_FILE = "tests/visual/contexts.json";
const DEFAULT_NETWORK_FIXTURE_FILE = "tests/visual/network-fixtures.json";

function nonEmptyStrings(value, field) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== "string" || !item.trim())
  ) {
    throw new VisualContractError(`${field} must be a non-empty string array`, {
      field,
      value,
    });
  }
  const trimmed = value.map((item) => item.trim());
  if (new Set(trimmed).size !== trimmed.length) {
    throw new VisualContractError(`${field} must not contain duplicates`, {
      field,
      value: trimmed,
    });
  }
  return trimmed;
}

export function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new VisualContractError(`Invalid JSON file: ${filePath}`, {
      filePath,
      cause: String(error),
    });
  }
}

export function fixtureRegistryBindingFingerprint({
  contexts,
  scenarios,
  networkFixtureFileFingerprint,
  contractSourceFingerprint,
}) {
  if (!isFullSha256(networkFixtureFileFingerprint)) {
    throw new VisualContractError(
      "Network fixture file fingerprint must be a full SHA-256"
    );
  }
  if (!isFullSha256(contractSourceFingerprint)) {
    throw new VisualContractError(
      "Fixture contract-source fingerprint must be a full SHA-256"
    );
  }
  return sha256Value({
    declared: isFullSha256(contexts?.fixtureRegistryFingerprint)
      ? contexts.fixtureRegistryFingerprint
      : null,
    networkFixtureFileFingerprint,
    contractSourceFingerprint,
    contexts: contexts?.contexts?.map((context) => ({
      pattern: context.pattern,
      path: context.path,
      fixtureId: context.fixtureId,
      networkFixtureId: context.networkFixtureId,
      fixtureSource: context.fixtureSource,
    })),
    scenarios: scenarios?.scenarios?.map((scenario) => ({
      scenarioId: scenario.scenarioId,
      fixtureId: scenario.fixtureId,
      networkFixtureId: scenario.networkFixtureId,
      preconditions: scenario.preconditions,
    })),
  });
}

export function fixtureContractSourceFingerprint({
  repoRoot,
  networkFixtures,
  scenarios,
}) {
  const declaredSources = [
    ...(networkFixtures?.fixtures ?? []).flatMap(
      (fixture) => fixture.contractSources ?? []
    ),
    ...(scenarios?.scenarios ?? []).flatMap((scenario) =>
      (scenario.semanticReadTransports ?? []).flatMap(
        (transport) => transport.contractSources ?? []
      )
    ),
  ];
  const uniqueSources = [...new Set(declaredSources)].sort((left, right) =>
    left.localeCompare(right)
  );
  if (uniqueSources.length === 0) {
    throw new VisualContractError(
      "Fixture and semantic-read contracts must declare source files"
    );
  }
  for (const source of uniqueSources) {
    if (
      typeof source !== "string" ||
      !source ||
      path.isAbsolute(source) ||
      source.split(/[\\/]/u).includes("..")
    ) {
      throw new VisualContractError(
        `Invalid fixture contract-source path: ${String(source)}`
      );
    }
    const absolute = path.resolve(repoRoot, source);
    if (!existsSync(absolute) || !statSync(absolute).isFile()) {
      throw new VisualContractError(
        `Fixture contract-source file is missing: ${source}`
      );
    }
  }
  return fingerprintPaths(repoRoot, uniqueSources);
}

export function matrixScenarioId({
  scenarioId,
  theme,
  project,
  locale,
  writingMode,
}) {
  const dimensions = { scenarioId, theme, project, locale, writingMode };
  for (const [field, value] of Object.entries(dimensions)) {
    if (typeof value !== "string" || !value.trim() || value !== value.trim()) {
      throw new VisualContractError(
        `Cannot build a matrix scenario ID with invalid ${field}`,
        { field, value }
      );
    }
  }
  return (
    `${scenarioId}::theme/${theme}::project/${project}` +
    `::locale/${locale}::writing-mode/${writingMode}`
  );
}

/**
 * Projeta o registro visual na forma `scenario` do contrato durável.
 *
 * O ID é o mesmo que o capturador usa; manter esta projeção aqui evita que
 * impacted-context, scenario e evidence-manifest inventem três matrizes.
 */
export function materializeContractScenarios({
  scenarios,
  matrix,
  batchContract,
  header,
}) {
  const themes = nonEmptyStrings(matrix?.themes, "matrix.themes");
  const projects = nonEmptyStrings(matrix?.projects, "matrix.projects");
  const locales = nonEmptyStrings(matrix?.locales, "matrix.locales");
  const writingModes = nonEmptyStrings(
    matrix?.writingModes,
    "matrix.writingModes"
  );
  const browsers = nonEmptyStrings(matrix?.browsers, "matrix.browsers");
  if (browsers.length !== 1) {
    throw new VisualContractError(
      "A matriz de captura atual não codifica browser no scenarioId; declarar mais de um browser seria evidência ambígua",
      { browsers }
    );
  }
  const changed = new Set(batchContract?.expectedChangedScenarioIds ?? []);
  const unchanged = new Set(batchContract?.expectedUnchangedScenarioIds ?? []);
  const effectFor = (baseId, matrixId) => {
    if (batchContract?.expectedVisualEffect === "preserve") return "preserve";
    if (batchContract?.expectedVisualEffect === "change") return "change";
    if (changed.has(baseId) || changed.has(matrixId)) return "change";
    if (unchanged.has(baseId) || unchanged.has(matrixId)) return "preserve";
    throw new VisualContractError(
      `Cenário ${matrixId} não foi particionado pelo contrato mixed`
    );
  };
  const output = [];
  for (const scenario of scenarios ?? []) {
    for (const theme of themes) {
      for (const project of projects) {
        for (const locale of locales) {
          for (const writingMode of writingModes) {
            const scenarioId = matrixScenarioId({
              scenarioId: scenario.scenarioId,
              theme,
              project,
              locale,
              writingMode,
            });
            output.push({
              ...header,
              artifactType: "scenario",
              scenarioId,
              route: scenario.route,
              routeParams: scenario.routeParams ?? {},
              fixtureId: scenario.fixtureId,
              authRole: scenario.authRole,
              theme,
              project,
              browser: browsers[0],
              locale,
              writingMode,
              interactionState: scenario.interactionState,
              preconditions: scenario.preconditions ?? [],
              actions: scenario.actions ?? [],
              assertions: scenario.assertions ?? [],
              captureRegion: scenario.captureRegion ?? null,
              expectedVisualEffect: effectFor(scenario.scenarioId, scenarioId),
            });
          }
        }
      }
    }
  }
  return output.sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));
}

export function captureStem(matrixId) {
  const readable = matrixId
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96);
  return `${readable || "capture"}-${sha256Value(matrixId).slice(0, 16)}`;
}

function selectedDimension(requested, available, field) {
  const canonicalAvailable = nonEmptyStrings(available, `matrix.${field}`);
  if (!requested?.length) return canonicalAvailable;
  const normalized = nonEmptyStrings(requested, field);
  const unknown = normalized.filter(
    (entry) => !canonicalAvailable.includes(entry)
  );
  if (unknown.length) {
    throw new VisualContractError(`Unknown ${field} requested`, {
      field,
      unknown,
      available: canonicalAvailable,
    });
  }
  return normalized;
}

export function selectEvidenceMatrix({
  registry,
  matrix,
  routePaths = [],
  scenarioIds = [],
  themes = [],
  projects = [],
  locales = [],
  writingModes = [],
}) {
  if (!registry || !Array.isArray(registry.scenarios)) {
    throw new VisualContractError(
      "The visual scenario registry must contain a scenarios array"
    );
  }
  const allScenarios = registry.scenarios;
  const duplicateScenarioIds = allScenarios
    .map((scenario) => scenario.scenarioId)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  if (
    allScenarios.length === 0 ||
    allScenarios.some(
      (scenario) =>
        !scenario ||
        typeof scenario.scenarioId !== "string" ||
        !scenario.scenarioId ||
        typeof scenario.route !== "string" ||
        !scenario.route
    ) ||
    duplicateScenarioIds.length
  ) {
    throw new VisualContractError(
      "The visual scenario registry is empty, malformed, or duplicated",
      { duplicateScenarioIds }
    );
  }

  const requestedRoutes = routePaths.filter(Boolean);
  const requestedScenarios = scenarioIds.filter(Boolean);
  const unknownRoutes = requestedRoutes.filter(
    (route) => !allScenarios.some((scenario) => scenario.route === route)
  );
  const unknownScenarios = requestedScenarios.filter(
    (id) => !allScenarios.some((scenario) => scenario.scenarioId === id)
  );
  if (unknownRoutes.length || unknownScenarios.length) {
    throw new VisualContractError(
      "Requested routes or scenarios are absent from the materialized registry",
      { unknownRoutes, unknownScenarios }
    );
  }

  const selectedScenarios = allScenarios.filter(
    (scenario) =>
      (!requestedRoutes.length || requestedRoutes.includes(scenario.route)) &&
      (!requestedScenarios.length ||
        requestedScenarios.includes(scenario.scenarioId))
  );
  if (!selectedScenarios.length) {
    throw new VisualContractError("The selected visual scenario set is empty");
  }

  const selected = {
    themes: selectedDimension(themes, matrix.themes, "themes"),
    projects: selectedDimension(projects, matrix.projects, "projects"),
    locales: selectedDimension(locales, matrix.locales, "locales"),
    writingModes: selectedDimension(
      writingModes,
      matrix.writingModes,
      "writingModes"
    ),
  };
  const expectedScenarioIds = [];
  for (const scenario of selectedScenarios) {
    for (const theme of selected.themes) {
      for (const project of selected.projects) {
        for (const locale of selected.locales) {
          for (const writingMode of selected.writingModes) {
            expectedScenarioIds.push(
              matrixScenarioId({
                scenarioId: scenario.scenarioId,
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
  expectedScenarioIds.sort((a, b) => a.localeCompare(b));
  return {
    schemaVersion: "1.0.0",
    scenarios: selectedScenarios,
    ...selected,
    expectedScenarioIds,
    matrixFingerprint: sha256Value(expectedScenarioIds),
  };
}

function walkFiles(targetPath, output) {
  if (!existsSync(targetPath)) return;
  const stats = statSync(targetPath);
  if (stats.isFile()) {
    output.push(targetPath);
    return;
  }
  for (const entry of readdirSync(targetPath).sort()) {
    if (
      [
        "node_modules",
        ".git",
        ".cache",
        "inventory",
        "dist",
        "playwright-report",
        "playwright-visual-report",
      ].includes(entry)
    ) {
      continue;
    }
    walkFiles(path.join(targetPath, entry), output);
  }
}

export function fingerprintPaths(root, targets) {
  const files = [];
  for (const target of targets) walkFiles(path.resolve(root, target), files);
  files.sort((a, b) => a.localeCompare(b));
  if (!files.length) {
    throw new VisualContractError("Cannot fingerprint an empty file set", {
      root,
      targets,
    });
  }
  const hash = createHash("sha256");
  for (const filePath of files) {
    const relative = path.relative(root, filePath).split(path.sep).join("/");
    hash.update(relative);
    hash.update("\0");
    hash.update(readFileSync(filePath));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function gitText(repoRoot, args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * @param {object} [header] cabeçalho da corrida (`envelope.measuredHeader`).
 *   Quando presente, `sourceFingerprint` e `toolchainFingerprint` vêm DELE.
 *
 *   POR QUÊ. Estes dois campos já eram calculados aqui, por um algoritmo
 *   próprio (`fingerprintPaths` sobre git), enquanto a âncora da corrida os
 *   calcula com `fingerprintSourceRoots`. Medido no alvo, mesma árvore, mesmo
 *   instante: fa63… × a691… e 884e… × 3742…. Um conceito com dois donos produz
 *   dois valores sob um nome só, e o contrato — que cruza artefatos por
 *   `runId` + `sourceFingerprint` — passa a comparar coisas que nunca vão
 *   bater.
 *
 *   A âncora vence porque é ela que define a corrida: todo outro artefato já
 *   carrega o valor dela. Se a definição da âncora for estreita demais (por
 *   exemplo, ignorar `index.html`), o conserto é `sourceRoots` no run-config —
 *   configuração — e não um segundo algoritmo aqui.
 *
 *   Os outros 5 fingerprints continuam desta camada: eles medem coisas que o
 *   run-config não conhece (tokens, CSS gerado, registries, worktree).
 */
export function buildEvidenceBindings({
  repoRoot,
  frontendRoot,
  header = null,
  contextPath = path.join(frontendRoot, DEFAULT_CONTEXT_FILE),
  scenarioPath = path.join(frontendRoot, DEFAULT_SCENARIO_FILE),
  networkFixturePath = path.join(frontendRoot, DEFAULT_NETWORK_FIXTURE_FILE),
}) {
  const contexts = readJson(contextPath);
  const scenarios = readJson(scenarioPath);
  const networkFixtures = readJson(networkFixturePath);
  const networkFixtureFileFingerprint = sha256File(networkFixturePath);
  const contractSourceFingerprint = fixtureContractSourceFingerprint({
    repoRoot,
    networkFixtures,
    scenarios,
  });
  for (const [registryName, registry] of [
    ["contexts", contexts],
    ["scenarios", scenarios],
  ]) {
    if (
      registry.networkFixtureRegistryFingerprint !==
      networkFixtureFileFingerprint
    ) {
      throw new VisualContractError(
        `${registryName}.json is stale relative to network-fixtures.json`,
        {
          registryName,
          declared: registry.networkFixtureRegistryFingerprint ?? null,
          actual: networkFixtureFileFingerprint,
        }
      );
    }
  }
  // Sem header, mede localmente — é o modo dos testes de unidade da camada
  // visual, que não têm corrida ancorada. Com header, a âncora manda.
  const sourceFingerprint =
    header?.sourceFingerprint ??
    fingerprintPaths(repoRoot, [
      path.relative(repoRoot, path.join(frontendRoot, "src")),
      path.relative(repoRoot, path.join(frontendRoot, "index.html")),
    ]);
  const tokenSourceFingerprint = fingerprintPaths(repoRoot, [
    path.relative(repoRoot, path.join(frontendRoot, "tokens")),
  ]);
  const generatedCssFingerprint = fingerprintPaths(repoRoot, [
    path.relative(repoRoot, path.join(frontendRoot, "src/index.css")),
    path.relative(repoRoot, path.join(frontendRoot, "src/styles/generated")),
  ]);
  const toolchainFingerprint =
    header?.toolchainFingerprint ??
    fingerprintPaths(repoRoot, [
    path.relative(repoRoot, path.join(frontendRoot, "package.json")),
    path.relative(repoRoot, path.join(repoRoot, "yarn.lock")),
    path.relative(
      repoRoot,
      path.join(frontendRoot, "playwright.visual.config.ts")
    ),
    path.relative(
      repoRoot,
      path.join(frontendRoot, "tests/visual/evidence.spec.ts")
    ),
    path.relative(
      repoRoot,
      path.join(frontendRoot, "tests/visual/evidence-matrix.json")
    ),
    path.relative(
      repoRoot,
      path.join(frontendRoot, "scripts/lib/visual-contract.mjs")
    ),
    path.relative(
      repoRoot,
      path.join(frontendRoot, "scripts/lib/evidence-matrix.mjs")
    ),
    path.relative(
      repoRoot,
      path.join(frontendRoot, "scripts/lib/evidence-composer.mjs")
    ),
    path.relative(
      repoRoot,
      path.join(frontendRoot, "scripts/compose-evidence-manifests.mjs")
    ),
    path.relative(
      repoRoot,
      path.join(frontendRoot, "tests/visual/network-fixtures.mjs")
    ),
  ]);
  const routeRegistryFingerprint = sha256Value({
    declared: contexts.routeRegistryFingerprint,
    contexts: sha256File(contextPath),
    scenarios: sha256File(scenarioPath),
  });
  const fixtureRegistryFingerprint = fixtureRegistryBindingFingerprint({
    contexts,
    scenarios,
    networkFixtureFileFingerprint,
    contractSourceFingerprint,
  });
  const head = gitText(repoRoot, ["rev-parse", "HEAD"]).trim();
  const status = gitText(repoRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ])
    .split("\n")
    .filter(
      (line) =>
        line &&
        !line.includes(".claude/evidence/") &&
        !line.includes("playwright-visual-report/")
    )
    .sort();
  const worktreeFingerprint = sha256Value({
    head,
    status,
    sourceFingerprint,
    tokenSourceFingerprint,
    generatedCssFingerprint,
    toolchainFingerprint,
    routeRegistryFingerprint,
    fixtureRegistryFingerprint,
  });
  const bindings = {
    sourceFingerprint,
    worktreeFingerprint,
    toolchainFingerprint,
    tokenSourceFingerprint,
    generatedCssFingerprint,
    routeRegistryFingerprint,
    fixtureRegistryFingerprint,
  };
  const invalid = Object.entries(bindings)
    .filter(([, value]) => !isFullSha256(value))
    .map(([field]) => field);
  if (invalid.length) {
    throw new VisualContractError("Evidence bindings are not full SHA-256", {
      invalid,
    });
  }
  return bindings;
}

export function loadEvidenceSelection({
  frontendRoot,
  matrixPath = path.join(frontendRoot, DEFAULT_MATRIX_FILE),
  scenarioPath = path.join(frontendRoot, DEFAULT_SCENARIO_FILE),
  ...filters
}) {
  return selectEvidenceMatrix({
    registry: readJson(scenarioPath),
    matrix: readJson(matrixPath),
    ...filters,
  });
}

export function selectionFingerprint(selection) {
  return sha256Bytes(Buffer.from(canonicalJson(selection)));
}
