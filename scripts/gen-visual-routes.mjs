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
import { envelopeFrom } from "./lib/artifact-envelope.mjs";
import { materializeContractScenarios } from "./lib/evidence-matrix.mjs";

const FRONTEND_ROOT = resolveAppRoot(
  path.join(path.dirname(new URL(import.meta.url).pathname), "..")
);
const PROCESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EMPTY_NETWORK_FIXTURES = jsonFile({
  schemaVersion: "1.0.0",
  readOnly: true,
  fixtures: [],
});

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

export function neutralizeExternalRegistry(registry, environment = {}) {
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
  const contexts = registry.contexts.map((context) => ({
    ...context,
    authRole: authRoleFor(context.path, context.authRole),
    fixtureId: context.networkFixtureId
      ? (authRoleFor(context.path, context.authRole) === "anonymous"
          ? "anonymous-static-v1"
          : `${authRoleFor(context.path, context.authRole)}-session-v1`)
      : context.fixtureId,
    networkFixtureId: null,
    fixtureSource: context.networkFixtureId ? "route-declaration" : context.fixtureSource,
  }));
  const scenarios = registry.scenarios.map((scenario) => ({
    ...scenario,
    authRole: authRoleFor(scenario.route, scenario.authRole),
    fixtureId: scenario.networkFixtureId
      ? (authRoleFor(scenario.route, scenario.authRole) === "anonymous"
          ? "anonymous-static-v1"
          : `${authRoleFor(scenario.route, scenario.authRole)}-session-v1`)
      : scenario.fixtureId,
    networkFixtureId: null,
    preconditions: [],
    assertions: [],
    witness: null,
    assertReady: null,
    expectedRenderedErrorSelector: null,
    semanticReadTransports: [],
  }));
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
  const materializedRegistry = materializeVisualRegistry({
    routes: discovery.routes,
    environment: fixtureDiscovery.environment,
  });
  const registry = externalTarget
    ? neutralizeExternalRegistry(materializedRegistry, environment)
    : materializedRegistry;
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
    networkFixtureContent: externalTarget ? EMPTY_NETWORK_FIXTURES : null,
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
  outPath,
}) {
  if (!runConfigPath || !batchContractPath || !outPath) {
    throw new Error(
      "emitir scenario exige --run-config, --batch-contract e --emit-scenarios"
    );
  }
  const absoluteConfig = path.resolve(runConfigPath);
  const runConfig = JSON.parse(readFileSync(absoluteConfig, "utf8"));
  const batchContract = JSON.parse(
    readFileSync(path.resolve(batchContractPath), "utf8")
  );
  const env = envelopeFrom(absoluteConfig, { applicationRoot: FRONTEND_ROOT });
  const artifacts = materializeContractScenarios({
    scenarios: registry.scenarios,
    matrix: runConfig.matrix,
    batchContract,
    header: env.header("scenario"),
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
        outPath: emitPath,
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
