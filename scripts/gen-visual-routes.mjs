#!/usr/bin/env node

import console from "node:console";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { resolveAppRoot, resolveRepoRoot } from "./lib/app-roots.mjs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { discoverRoutes } from "./lib/route-impact.mjs";
import { discoverReadOnlyFixtures } from "./lib/read-only-fixtures.mjs";
import { materializeVisualRegistry } from "../tests/visual/visual-registry.mjs";
import { validateFixtureDocument } from "../tests/visual/network-fixtures.mjs";
import { envelopeFrom } from "./lib/artifact-envelope.mjs";
import { materializeContractScenarios } from "./lib/evidence-matrix.mjs";
import {
  readImpactedScenarioIds,
  selectImpactedScenarios,
} from "./lib/impacted-evidence-selection.mjs";

const FRONTEND_ROOT = resolveAppRoot(
  path.join(path.dirname(new URL(import.meta.url).pathname), "..")
);
const PROCESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EMPTY_NETWORK_FIXTURES = jsonFile({
  schemaVersion: "1.0.0",
  readOnly: true,
  fixtures: [],
});
const EXTERNAL_FIXTURE_SOURCE = "evidence-fixtures.json";

export const VISUAL_REGISTRY_OUTPUT_FILES = Object.freeze([
  "routes.json",
  "routes.skipped.json",
  "contexts.json",
  "scenarios.json",
  "network-fixtures.json",
]);

function argumentValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? (argv[index + 1] ?? null) : null;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function jsonFile(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function loadExternalEvidenceFixtures(frontendRoot) {
  const file = path.join(frontendRoot, "tests", "visual", EXTERNAL_FIXTURE_SOURCE);
  if (!existsSync(file)) return null;
  const document = JSON.parse(readFileSync(file, "utf8"));
  validateFixtureDocument(document, file);
  if (
    document.semanticReadTransports !== undefined &&
    (!document.semanticReadTransports ||
      typeof document.semanticReadTransports !== "object" ||
      Array.isArray(document.semanticReadTransports))
  ) {
    throw new Error("semanticReadTransports must be an object keyed by route pattern.");
  }
  for (const [routePattern, transports] of Object.entries(
    document.semanticReadTransports ?? {}
  )) {
    if (!routePattern.startsWith("/") || !Array.isArray(transports) || !transports.length) {
      throw new Error(`semanticReadTransports.${routePattern} must not be empty.`);
    }
    for (const transport of transports) {
      if (
        transport?.method !== "POST" ||
        typeof transport.path !== "string" ||
        !transport.path.startsWith("/api/") ||
        transport.path.includes("?") ||
        !Array.isArray(transport.contractSources) ||
        !transport.contractSources.length ||
        transport.contractSources.some(
          (source) =>
            typeof source !== "string" ||
            !source ||
            path.isAbsolute(source) ||
            source.split(/[\\/]/u).includes("..")
        )
      ) {
        throw new Error(
          `semanticReadTransports.${routePattern} must declare POST, a concrete /api path, and repository-relative contractSources.`
        );
      }
    }
  }
  for (const fixture of document.fixtures) {
    const scenario = fixture.scenario;
    if (!scenario || !Array.isArray(scenario.actions) || !scenario.actions.length) {
      throw new Error(`${fixture.id}.scenario.actions must not be empty.`);
    }
    if (
      scenario.actions.some(
        (step) =>
          !step ||
          !["goto", "click", "wait-for", "hover"].includes(step.type) ||
          (step.type !== "goto" && typeof step.target !== "string")
      )
    ) {
      throw new Error(
        `${fixture.id}.scenario actions must use only read-only goto/click/wait-for/hover steps.`
      );
    }
    if (scenario.actions[0].type !== "goto" || scenario.actions[0].value !== "$route") {
      throw new Error(`${fixture.id}.scenario must begin with goto $route.`);
    }
    if (
      !Array.isArray(scenario.assertions) ||
      !scenario.assertions.length ||
      scenario.assertions.some(
        (step) =>
          step?.type !== "assert" ||
          typeof step.target !== "string" ||
          !["attached", "visible", "hidden", "enabled", "disabled"].includes(step.value)
      )
    ) {
      throw new Error(`${fixture.id}.scenario.assertions must contain typed DOM assertions.`);
    }
  }
  return { file, document };
}

export function externalFixtureRegistry(document) {
  if (!document) return {};
  return Object.fromEntries(
    document.fixtures.map((fixture) => [
      fixture.routePattern,
      [
        {
          fixtureId: fixture.id,
          networkFixtureId: fixture.id,
          name: fixture.name ?? fixture.id,
          params: fixture.routeParams,
          source: "target-versioned-network-read-only",
        },
      ],
    ])
  );
}

export function applyExternalFixtureScenarios(registry, document) {
  if (!document) return registry;
  const networkFixtureRegistryFingerprint = sha256(jsonFile(document));
  const fixtureById = new Map(document.fixtures.map((fixture) => [fixture.id, fixture]));
  const scenarios = registry.scenarios.map((scenario) => {
    const fixture = fixtureById.get(scenario.networkFixtureId);
    const semanticReadTransports =
      document.semanticReadTransports?.[scenario.routePattern] ??
      scenario.semanticReadTransports;
    if (!fixture) return { ...scenario, semanticReadTransports };
    const definition = fixture.scenario;
    return {
      ...scenario,
      interactionState: definition.interactionState ?? "fixture",
      actions: definition.actions.map((step) => ({
        ...step,
        value: step.value === "$route" ? scenario.route : step.value,
      })),
      assertions: definition.assertions,
      witness: definition.witness ?? null,
      assertReady: definition.assertReady ?? null,
      captureRegion: definition.captureRegion ?? null,
      semanticReadTransports,
    };
  });
  return {
    ...registry,
    contexts: registry.contexts.map((context) => ({
      ...context,
    })),
    scenarios,
    networkFixtureRegistryFingerprint,
    fixtureRegistryFingerprint: sha256(
      JSON.stringify({
        base: registry.fixtureRegistryFingerprint,
        networkFixtureRegistryFingerprint,
        externalFixtures: document.fixtures.map(
          ({ id, routePattern, routeParams, contractSources }) => ({
            id,
            routePattern,
            routeParams,
            contractSources,
          })
        ),
      })
    ),
    scenarioRegistryFingerprint: sha256(
      JSON.stringify({
        base: registry.scenarioRegistryFingerprint,
        externalFixtureScenarios: document.fixtures.map(({ id, scenario }) => ({ id, scenario })),
        semanticReadTransports: document.semanticReadTransports ?? {},
      })
    ),
  };
}

/**
 * Materializa o registro visual com uma única autoridade para fixtures.
 *
 * `visual-registry.mjs` pertence ao processo e contém fixtures do próprio
 * processo. Num alvo externo essas fixtures não são evidência do alvo: somente
 * `tests/visual/evidence-fixtures.json` do alvo pode preservar uma resposta de
 * rede. Tanto o gerador da matriz completa quanto `affected-routes` precisam
 * atravessar exatamente esta fronteira; duplicá-la foi o que deixou
 * `onboarding-home-v1` escapar para um batch do MakersHub.
 */
export function materializeTargetVisualRegistry({
  routes,
  frontendRoot = FRONTEND_ROOT,
  environment = process.env,
  fixtureEnvironment = environment,
}) {
  const externalTarget = path.resolve(frontendRoot) !== PROCESS_ROOT;
  const externalFixtures = externalTarget
    ? loadExternalEvidenceFixtures(frontendRoot)
    : null;
  const materialized = materializeVisualRegistry({
    routes,
    environment: fixtureEnvironment,
    ...(externalTarget
      ? { fixtureRegistry: externalFixtureRegistry(externalFixtures?.document) }
      : {}),
  });
  if (!externalTarget) {
    return { registry: materialized, externalFixtures: null };
  }
  const neutral = neutralizeExternalRegistry(
    materialized,
    environment,
    new Set((externalFixtures?.document?.fixtures ?? []).map(({ id }) => id))
  );
  return {
    registry: applyExternalFixtureScenarios(neutral, externalFixtures?.document),
    externalFixtures,
  };
}

function portableModule(file, frontendRoot) {
  if (!file) return null;
  return path.relative(frontendRoot, file).split(path.sep).join("/");
}

function routeFingerprint(routes, frontendRoot) {
  const projection = routes.map((route) => {
    const {
      pathPattern,
      routeKind,
      parameterNames,
      componentModule,
      componentModules,
      guardNames,
    } = route;
    return {
      pathPattern,
      routeKind,
      parameterNames,
      componentModule: portableModule(componentModule, frontendRoot),
      componentModules: componentModules.map((file) =>
        portableModule(file, frontendRoot)
      ),
      guardNames,
    };
  });
  return sha256(JSON.stringify(projection));
}

function outputFiles({ discovery, registry, fixtureDiscovery, frontendRoot, networkFixtureContent = null }) {
  const routerSources = (discovery.routerFiles ?? [discovery.routerFile]).map(
    (file) => [portableModule(file, frontendRoot), readFileSync(file, "utf8")]
  );
  const registryFingerprint = routeFingerprint(discovery.routes, frontendRoot);
  const fixtureGapCount = registry.skipped.filter(
    (item) => item.reasonCode === "missing-read-only-fixture"
  ).length;
  const contexts = {
    schemaVersion: registry.schemaVersion,
    readOnly: true,
    routerFile: portableModule(discovery.routerFile, frontendRoot),
    routerKind: discovery.routerKind,
    routerSourceFingerprint: sha256(JSON.stringify(routerSources)),
    routeRegistryFingerprint: registryFingerprint,
    fixtureRegistryFingerprint: registry.fixtureRegistryFingerprint,
    networkFixtureRegistryFingerprint:
      registry.networkFixtureRegistryFingerprint,
    scenarioRegistryFingerprint: registry.scenarioRegistryFingerprint,
    declaredRouteCount: discovery.routes.length,
    materializedContextCount: registry.contexts.length,
    skippedRouteCount: registry.skipped.length,
    fixtureGapCount,
    fixtureCoverageComplete: fixtureGapCount === 0,
    explicitOutOfScopeCount: registry.skipped.length - fixtureGapCount,
    exactDeclarationCoverage: registry.exactDeclarationCoverage,
    fixtureProvider: {
      readOnly: fixtureDiscovery.readOnly,
      sources: fixtureDiscovery.sources,
      diagnostics: fixtureDiscovery.diagnostics,
    },
    contexts: registry.contexts,
  };
  const scenarios = {
    schemaVersion: registry.schemaVersion,
    readOnly: true,
    routeRegistryFingerprint: registryFingerprint,
    fixtureRegistryFingerprint: registry.fixtureRegistryFingerprint,
    networkFixtureRegistryFingerprint:
      registry.networkFixtureRegistryFingerprint,
    scenarioRegistryFingerprint: registry.scenarioRegistryFingerprint,
    scenarioCount: registry.scenarios.length,
    scenarios: registry.scenarios,
  };
  return new Map([
    ["routes.json", jsonFile(registry.routes)],
    ["routes.skipped.json", jsonFile(registry.skipped)],
    ["contexts.json", jsonFile(contexts)],
    ["scenarios.json", jsonFile(scenarios)],
    ...(networkFixtureContent === null
      ? []
      : [["network-fixtures.json", networkFixtureContent]]),
  ]);
}

function csvEnvironment(value) {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

export function neutralizeExternalRegistry(
  registry,
  environment = {},
  preservedNetworkFixtureIds = new Set()
) {
  const defaultAuthRole =
    String(environment.UI_EVIDENCE_DEFAULT_AUTH_ROLE ?? "").trim() || null;
  const anonymousRoutes = csvEnvironment(
    environment.UI_EVIDENCE_ANONYMOUS_ROUTES
  );
  const authRoleFor = (route, currentRole) =>
    defaultAuthRole && !anonymousRoutes.has(route)
      ? defaultAuthRole
      : currentRole;
  const networkFixtureRegistryFingerprint = sha256(EMPTY_NETWORK_FIXTURES);
  const contexts = registry.contexts.map((context) => {
    const preservesNetwork = preservedNetworkFixtureIds.has(context.networkFixtureId);
    return {
    ...context,
    authRole: authRoleFor(context.path, context.authRole),
    fixtureId: preservesNetwork
      ? context.fixtureId
      : (authRoleFor(context.path, context.authRole) === "anonymous"
          ? "anonymous-static-v1"
          : `${authRoleFor(context.path, context.authRole)}-session-v1`),
    networkFixtureId: preservesNetwork ? context.networkFixtureId : null,
    fixtureSource: preservesNetwork ? context.fixtureSource : "route-declaration",
  };
  });
  const scenarios = registry.scenarios.map((scenario) => {
    const preservesNetwork = preservedNetworkFixtureIds.has(scenario.networkFixtureId);
    return {
    ...scenario,
    authRole: authRoleFor(scenario.route, scenario.authRole),
    fixtureId: preservesNetwork
      ? scenario.fixtureId
      : (authRoleFor(scenario.route, scenario.authRole) === "anonymous"
          ? "anonymous-static-v1"
          : `${authRoleFor(scenario.route, scenario.authRole)}-session-v1`),
    networkFixtureId: preservesNetwork ? scenario.networkFixtureId : null,
    preconditions: preservesNetwork ? scenario.preconditions : [],
    assertions: preservesNetwork ? scenario.assertions : [],
    witness: preservesNetwork ? scenario.witness : null,
    assertReady: preservesNetwork ? scenario.assertReady : null,
    expectedRenderedErrorSelector: null,
    semanticReadTransports: [],
  };
  });
  return {
    ...registry,
    contexts,
    scenarios,
    networkFixtureRegistryFingerprint,
    fixtureRegistryFingerprint: sha256(JSON.stringify({
      policy: "external-target-neutral.v1",
      contexts: contexts.map(({ pattern, path, fixtureId, fixtureSource }) => ({
        pattern,
        path,
        fixtureId,
        fixtureSource,
      })),
    })),
    scenarioRegistryFingerprint: sha256(JSON.stringify({
      policy: "external-target-neutral.v1",
      scenarios: scenarios.map(({ scenarioId, route, actions, authRole }) => ({
        scenarioId,
        route,
        actions,
        authRole,
      })),
    })),
  };
}

export function applyRouteEvidencePolicy(registry, policy = null) {
  if (policy === null) return registry;
  if (policy?.schemaVersion !== "1.0.0" || !policy.routes || typeof policy.routes !== "object") {
    throw new Error("evidence-route-policy.json must declare schemaVersion=1.0.0 and routes");
  }
  const knownRoutes = new Set(registry.contexts.map((context) => context.path));
  const knownAuthRoles = new Set(
    [...registry.contexts, ...registry.scenarios]
      .map((entry) => entry.authRole)
      .filter(Boolean)
  );
  const validateDeclaration = (label, declaration) => {
    const selectors = declaration?.stabilityMaskSelectors;
    if (
      !Array.isArray(selectors) ||
      !selectors.length ||
      selectors.some((selector) => typeof selector !== "string" || !selector.trim()) ||
      typeof declaration?.rationale !== "string" ||
      !declaration.rationale.trim()
    ) {
      throw new Error(
        `Evidence route policy for ${label} requires non-empty stabilityMaskSelectors and rationale`
      );
    }
    if (declaration.freezeClock === true && declaration.fixedTime === true) {
      throw new Error(
        `Evidence route policy for ${label} cannot freezeClock and fixedTime together`
      );
    }
  };
  for (const [route, declaration] of Object.entries(policy.routes)) {
    if (!knownRoutes.has(route)) {
      throw new Error(`Evidence route policy names an unknown route: ${route}`);
    }
    validateDeclaration(route, declaration);
  }
  if (policy.authRoles !== undefined && (policy.authRoles === null || typeof policy.authRoles !== "object")) {
    throw new Error("evidence-route-policy.json authRoles must be an object when declared");
  }
  for (const [authRole, declaration] of Object.entries(policy.authRoles ?? {})) {
    if (!knownAuthRoles.has(authRole)) {
      throw new Error(`Evidence route policy names an unknown auth role: ${authRole}`);
    }
    validateDeclaration(`auth role ${authRole}`, declaration);
    if (
      declaration.excludedRoutes !== undefined &&
      (!Array.isArray(declaration.excludedRoutes) ||
        declaration.excludedRoutes.some(
          (route) => typeof route !== "string" || !knownRoutes.has(route)
        ))
    ) {
      throw new Error(
        `Evidence route policy for auth role ${authRole} excludedRoutes must name only known routes`
      );
    }
  }
  const policyFor = (route, authRole) => {
    const routeDeclaration = policy.routes[route] ?? null;
    const roleCandidate = policy.authRoles?.[authRole] ?? null;
    const roleDeclaration = roleCandidate?.excludedRoutes?.includes(route)
      ? null
      : roleCandidate;
    if (!roleDeclaration && !routeDeclaration) return null;
    const merged = {
      stabilityMaskSelectors: [
        ...new Set([
          ...(roleDeclaration?.stabilityMaskSelectors ?? []),
          ...(routeDeclaration?.stabilityMaskSelectors ?? []),
        ]),
      ],
      rationale: [roleDeclaration?.rationale, routeDeclaration?.rationale]
        .filter(Boolean)
        .join("; "),
      freezeClock:
        roleDeclaration?.freezeClock === true || routeDeclaration?.freezeClock === true,
      fixedTime:
        roleDeclaration?.fixedTime === true || routeDeclaration?.fixedTime === true,
    };
    if (merged.freezeClock && merged.fixedTime) {
      throw new Error(
        `Evidence route policy for ${route} cannot freezeClock and fixedTime together after auth-role composition`
      );
    }
    return merged;
  };
  const contexts = registry.contexts.map((context) => {
    const declaration = policyFor(context.path, context.authRole);
    return declaration
      ? {
          ...context,
          stabilityMaskSelectors: [...declaration.stabilityMaskSelectors],
          stabilityRationale: declaration.rationale,
          ...(declaration.freezeClock === true ? { freezeClock: true } : {}),
          ...(declaration.fixedTime === true ? { fixedTime: true } : {}),
        }
      : context;
  });
  const scenarios = registry.scenarios.map((scenario) => {
    const declaration = policyFor(scenario.route, scenario.authRole);
    return declaration
      ? {
          ...scenario,
          stabilityMaskSelectors: [...declaration.stabilityMaskSelectors],
          stabilityRationale: declaration.rationale,
          ...(declaration.freezeClock === true ? { freezeClock: true } : {}),
          ...(declaration.fixedTime === true ? { fixedTime: true } : {}),
        }
      : scenario;
  });
  return {
    ...registry,
    contexts,
    scenarios,
    fixtureRegistryFingerprint: sha256(
      JSON.stringify({
        base: registry.fixtureRegistryFingerprint,
        routeEvidencePolicy: policy,
      })
    ),
    scenarioRegistryFingerprint: sha256(
      JSON.stringify({
        base: registry.scenarioRegistryFingerprint,
        routeEvidencePolicy: policy,
      })
    ),
  };
}

export async function generateVisualRoutes({
  frontendRoot = FRONTEND_ROOT,
  repoRoot = resolveRepoRoot(frontendRoot),
  outDir = path.join(frontendRoot, "tests", "visual"),
  environment = process.env,
  inspectLocalData = true,
  check = false,
}) {
  const externalTarget = path.resolve(frontendRoot) !== PROCESS_ROOT;
  const discovery = discoverRoutes({ frontendRoot });
  if (discovery.declarationErrors.length) {
    throw new Error(
      `Route discovery is incomplete: ${JSON.stringify(
        discovery.declarationErrors
      )}`
    );
  }
  const fixtureDiscovery = await discoverReadOnlyFixtures({
    repoRoot,
    environment,
    // O registro externo é neutralizado abaixo e não pode depender de Prisma,
    // DB ou fixtures do processo. Sondar essas fontes mesmo assim só injeta
    // diagnósticos voláteis em arquivo versionado e suja o alvo após a captura.
    inspectLocalData: externalTarget ? false : inspectLocalData,
  });
  const { registry: neutralRegistry, externalFixtures } =
    materializeTargetVisualRegistry({
      routes: discovery.routes,
      frontendRoot,
      environment,
      fixtureEnvironment: fixtureDiscovery.environment,
    });
  const routePolicyPath = path.join(
    frontendRoot,
    "tests",
    "visual",
    "evidence-route-policy.json"
  );
  const registry = applyRouteEvidencePolicy(
    neutralRegistry,
    existsSync(routePolicyPath)
      ? JSON.parse(readFileSync(routePolicyPath, "utf8"))
      : null
  );
  if (!registry.exactDeclarationCoverage) {
    throw new Error(
      "Visual registry lost route declarations instead of materializing or skipping them."
    );
  }

  const files = outputFiles({
    discovery,
    registry,
    fixtureDiscovery,
    frontendRoot,
    networkFixtureContent: externalTarget
      ? externalFixtures
        ? jsonFile(externalFixtures.document)
        : EMPTY_NETWORK_FIXTURES
      : null,
  });
  const staleFiles = [];
  if (check) {
    for (const [name, content] of files) {
      const target = path.join(outDir, name);
      if (!existsSync(target) || readFileSync(target, "utf8") !== content) {
        staleFiles.push(name);
      }
    }
  } else {
    mkdirSync(outDir, { recursive: true });
    for (const [name, content] of files) {
      writeFileSync(path.join(outDir, name), content);
    }
  }

  return {
    frontendRoot,
    outDir,
    declaredRoutes: discovery.routes.length,
    materializedContexts: registry.contexts.length,
    skippedRoutes: registry.skipped.length,
    fixtureGaps: registry.skipped.filter(
      (item) => item.reasonCode === "missing-read-only-fixture"
    ),
    staleFiles,
    coverageComplete:
      registry.exactDeclarationCoverage &&
      registry.skipped.every(
        (item) => item.reasonCode !== "missing-read-only-fixture"
      ) &&
      staleFiles.length === 0,
    fixtureDiscovery,
    registry,
  };
}

export function emitScenarioArtifacts({
  registry,
  runConfigPath,
  batchContractPath,
  impactedContextPath,
  outPath,
  sourceFingerprint = null,
}) {
  if (!runConfigPath || !batchContractPath || !impactedContextPath || !outPath) {
    throw new Error(
      "emitir scenario exige --run-config, --batch-contract, --impacted-context e --emit-scenarios"
    );
  }
  const absoluteConfig = path.resolve(runConfigPath);
  const runConfig = JSON.parse(readFileSync(absoluteConfig, "utf8"));
  const batchContract = JSON.parse(
    readFileSync(path.resolve(batchContractPath), "utf8")
  );
  const impactedBaseIds = readImpactedScenarioIds({
    impactedContextPath,
    batchId: batchContract.batchId,
    matrix: runConfig.matrix,
  });
  const impactedScenarios = selectImpactedScenarios({
    scenarios: registry.scenarios,
    impactedBaseIds,
  });
  const env = envelopeFrom(absoluteConfig, { applicationRoot: FRONTEND_ROOT });
  const artifacts = materializeContractScenarios({
    scenarios: impactedScenarios,
    matrix: runConfig.matrix,
    batchContract,
    header: {
      ...env.header("scenario"),
      ...(sourceFingerprint ? { sourceFingerprint } : {}),
    },
  });
  if (!artifacts.length) {
    throw new Error("registro visual não materializou nenhum scenario durável");
  }
  const absoluteOut = path.resolve(outPath);
  mkdirSync(path.dirname(absoluteOut), { recursive: true });
  writeFileSync(
    absoluteOut,
    `${artifacts.map((artifact) => JSON.stringify(artifact)).join("\n")}\n`
  );
  return artifacts;
}

async function runCli() {
  const argv = process.argv.slice(2);
  const outDirArgument = argumentValue(argv, "--out-dir");
  const result = await generateVisualRoutes({
    outDir: outDirArgument
      ? path.resolve(FRONTEND_ROOT, outDirArgument)
      : path.join(FRONTEND_ROOT, "tests", "visual"),
    check: argv.includes("--check"),
    inspectLocalData: !argv.includes("--environment-only"),
  });
  const emitPath = argumentValue(argv, "--emit-scenarios");
  const emittedScenarios = emitPath
    ? emitScenarioArtifacts({
        registry: result.registry,
        runConfigPath: argumentValue(argv, "--run-config"),
        batchContractPath: argumentValue(argv, "--batch-contract"),
        impactedContextPath: argumentValue(argv, "--impacted-context"),
        outPath: emitPath,
        sourceFingerprint: argumentValue(argv, "--source-fingerprint"),
      })
    : [];

  if (argv.includes("--json")) {
    console.log(
      JSON.stringify(
        {
          declaredRoutes: result.declaredRoutes,
          materializedContexts: result.materializedContexts,
          skippedRoutes: result.skippedRoutes,
          fixtureGaps: result.fixtureGaps,
          staleFiles: result.staleFiles,
          coverageComplete: result.coverageComplete,
          emittedScenarios: emittedScenarios.length,
        },
        null,
        2
      )
    );
  } else {
    console.log(
      `Declared routes: ${result.declaredRoutes}; materialized contexts: ` +
        `${result.materializedContexts}; explicit skips: ${result.skippedRoutes}.`
    );
    if (result.fixtureGaps.length) {
      console.log(
        `Read-only fixture gaps: ${result.fixtureGaps
          .map((item) => item.pattern)
          .join(", ")}`
      );
    }
    if (result.staleFiles.length) {
      console.error(`Stale generated files: ${result.staleFiles.join(", ")}`);
    }
  }

  if (result.staleFiles.length) process.exitCode = 1;
  if (
    argv.includes("--require-all-fixtures") &&
    result.fixtureGaps.length > 0
  ) {
    process.exitCode = 2;
  }
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
