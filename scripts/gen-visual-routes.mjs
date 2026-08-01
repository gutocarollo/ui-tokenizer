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

const FRONTEND_ROOT = resolveAppRoot(
  path.join(path.dirname(new URL(import.meta.url).pathname), "..")
);

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

function outputFiles({ discovery, registry, fixtureDiscovery, frontendRoot }) {
  const routerSource = readFileSync(discovery.routerFile, "utf8");
  const registryFingerprint = routeFingerprint(discovery.routes, frontendRoot);
  const fixtureGapCount = registry.skipped.filter(
    (item) => item.reasonCode === "missing-read-only-fixture"
  ).length;
  const contexts = {
    schemaVersion: registry.schemaVersion,
    readOnly: true,
    routerFile: path
      .relative(frontendRoot, discovery.routerFile)
      .split(path.sep)
      .join("/"),
    routerSourceFingerprint: sha256(routerSource),
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
  ]);
}

export async function generateVisualRoutes({
  frontendRoot = FRONTEND_ROOT,
  repoRoot = path.resolve(frontendRoot, ".."),
  outDir = path.join(frontendRoot, "tests", "visual"),
  environment = process.env,
  inspectLocalData = true,
  check = false,
}) {
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
    inspectLocalData,
  });
  const registry = materializeVisualRegistry({
    routes: discovery.routes,
    environment: fixtureDiscovery.environment,
  });
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
