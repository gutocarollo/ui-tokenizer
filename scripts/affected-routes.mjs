#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeRouteImpact,
  changedFilesFromArgs,
  isRouteImpactCandidate,
} from "./lib/route-impact.mjs";
import { discoverReadOnlyFixtures } from "./lib/read-only-fixtures.mjs";
import { materializeVisualRegistry } from "../tests/visual/visual-registry.mjs";

const FRONTEND_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function argumentValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? (argv[index + 1] ?? null) : null;
}

function relativeModule(file) {
  if (!file) return null;
  return path.relative(FRONTEND_ROOT, file).split(path.sep).join("/");
}

function serializableRoute(route) {
  return {
    pathPattern: route.pathPattern,
    routeKind: route.routeKind,
    wildcard: route.wildcard,
    dynamic: route.dynamic,
    parameterNames: route.parameterNames,
    componentModule: relativeModule(route.componentModule),
    componentModules: route.componentModules.map(relativeModule),
    guardNames: route.guardNames,
  };
}

export async function affectedRoutes({
  files = [],
  since = null,
  includeWorkingTree = true,
  environment = process.env,
  inspectLocalData = true,
} = {}) {
  const changedFiles = changedFilesFromArgs({
    frontendRoot: FRONTEND_ROOT,
    files,
    since,
    includeWorkingTree,
  }).filter((file) => isRouteImpactCandidate(file, FRONTEND_ROOT));
  const impact = analyzeRouteImpact({
    frontendRoot: FRONTEND_ROOT,
    changedFiles,
  });
  const fixtureDiscovery = await discoverReadOnlyFixtures({
    repoRoot: path.resolve(FRONTEND_ROOT, ".."),
    environment,
    inspectLocalData,
  });
  const visual = materializeVisualRegistry({
    routes: impact.affectedRoutes,
    environment: fixtureDiscovery.environment,
  });
  const fixtureGaps = visual.skipped;
  const coverageComplete =
    impact.coverageComplete &&
    visual.exactDeclarationCoverage &&
    fixtureGaps.length === 0;

  return {
    schemaVersion: "1.0.0",
    changedFiles: impact.changedFiles,
    routeCount: impact.routeCount,
    affectedRouteCount: impact.affectedRoutes.length,
    affectedRoutes: impact.affectedRoutes.map(serializableRoute),
    concreteRoutes: visual.routes,
    scenarioIds: visual.scenarios.map((scenario) => scenario.scenarioId),
    fixtureGaps,
    fanOutReasons: impact.fanOutReasons,
    gaps: impact.gaps,
    fixtureProvider: {
      readOnly: fixtureDiscovery.readOnly,
      sources: fixtureDiscovery.sources,
      diagnostics: fixtureDiscovery.diagnostics,
    },
    coverageComplete,
  };
}

async function runCli() {
  const argv = process.argv.slice(2);
  const files = argumentValue(argv, "--files");
  const since = argumentValue(argv, "--since");
  const result = await affectedRoutes({
    files: files ? [files] : [],
    since,
    includeWorkingTree: !argv.includes("--committed-only"),
    inspectLocalData: !argv.includes("--environment-only"),
  });
  const routesArgument = result.concreteRoutes
    .map((route) => route.path)
    .join(",");

  if (argv.includes("--routes-arg") || argv.includes("--routes")) {
    process.stdout.write(routesArgument);
  } else if (argv.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Changed design files: ${result.changedFiles.length}`);
    console.log(`Declared routes: ${result.routeCount}`);
    console.log(`Affected route patterns: ${result.affectedRouteCount}`);
    console.log(`Concrete capture routes: ${result.concreteRoutes.length}`);
    console.log(`Coverage complete: ${result.coverageComplete ? "yes" : "no"}`);
    for (const changed of result.changedFiles) {
      const routes = changed.affectedRoutes.length
        ? changed.affectedRoutes.join(", ")
        : "(no resolved route)";
      console.log(`  ${changed.file} [${changed.status}] -> ${routes}`);
    }
    if (result.fixtureGaps.length) {
      console.log("Fixture gaps:");
      for (const gap of result.fixtureGaps) {
        console.log(
          `  ${gap.pattern}: ${gap.reasonCode} (${gap.missingParams.join(", ") || "no parameters"})`
        );
      }
    }
    if (result.concreteRoutes.length) {
      console.log(
        `Evidence command:\n  npm run ui:evidence -- before --routes "${routesArgument}"`
      );
    }
  }

  if (!result.changedFiles.length && !argv.includes("--allow-empty")) {
    process.exitCode = 3;
  } else if (!result.coverageComplete && !argv.includes("--allow-gaps")) {
    process.exitCode = 4;
  }
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
