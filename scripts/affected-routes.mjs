#!/usr/bin/env node

import path from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { resolveAppRoot, resolveRepoRoot } from "./lib/app-roots.mjs";
import { fileURLToPath } from "node:url";
import {
  analyzeRouteImpact,
  changedFilesFromArgs,
  isRouteImpactCandidate,
} from "./lib/route-impact.mjs";
import { discoverReadOnlyFixtures } from "./lib/read-only-fixtures.mjs";
import { materializeTargetVisualRegistry } from "./gen-visual-routes.mjs";
import { envelopeFrom } from "./lib/artifact-envelope.mjs";
import { materializeContractScenarios } from "./lib/evidence-matrix.mjs";

const FRONTEND_ROOT = resolveAppRoot(
  path.join(path.dirname(new URL(import.meta.url).pathname), "..")
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
  sourceRoots = [],
} = {}) {
  const changedFiles = changedFilesFromArgs({
    frontendRoot: FRONTEND_ROOT,
    files,
    since,
    includeWorkingTree,
  }).filter((file) =>
    isRouteImpactCandidate(file, FRONTEND_ROOT, sourceRoots)
  );
  const impact = analyzeRouteImpact({
    frontendRoot: FRONTEND_ROOT,
    changedFiles,
    sourceRoots,
  });
  const fixtureDiscovery = await discoverReadOnlyFixtures({
    repoRoot: resolveRepoRoot(FRONTEND_ROOT),
    environment,
    inspectLocalData,
  });
  const { registry: visual } = materializeTargetVisualRegistry({
    routes: impact.affectedRoutes,
    frontendRoot: FRONTEND_ROOT,
    environment,
    fixtureEnvironment: fixtureDiscovery.environment,
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
    contexts: visual.contexts,
    scenarioIds: visual.scenarios.map((scenario) => scenario.scenarioId),
    scenarios: visual.scenarios,
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

export function impactedContextArtifact({
  result,
  runConfigPath,
  batchContractPath,
  batchId,
  sourceFingerprint = null,
}) {
  if (!runConfigPath || !batchContractPath || !batchId) {
    throw new Error(
      "emitir impacted-context exige --run-config, --batch-contract e --batch-id"
    );
  }
  const env = envelopeFrom(path.resolve(runConfigPath), {
    applicationRoot: FRONTEND_ROOT,
  });
  const runConfig = JSON.parse(readFileSync(path.resolve(runConfigPath), "utf8"));
  const batchContract = JSON.parse(
    readFileSync(path.resolve(batchContractPath), "utf8")
  );
  const header = (artifactType) => ({
    ...env.header(artifactType),
    ...(sourceFingerprint ? { sourceFingerprint } : {}),
  });
  const scenarioArtifacts = materializeContractScenarios({
    scenarios: result.scenarios,
    matrix: runConfig.matrix,
    batchContract,
    header: header("scenario"),
  });
  const contextByPath = new Map(
    (result.contexts ?? []).map((context) => [context.path, context])
  );
  const routes = (result.concreteRoutes ?? []).map(({ path: routePath }) => {
    const context = contextByPath.get(routePath);
    if (!context?.componentModule) {
      throw new Error(`rota materializada sem componentModule: ${routePath}`);
    }
    return {
      path: routePath,
      componentModule: context.componentModule,
      dynamic: context.routeKind === "dynamic",
      fixtureId: context.fixtureId ?? null,
    };
  });
  const plannedFiles = [...new Set(batchContract.plannedFiles ?? [])].sort();
  if (plannedFiles.length === 0) {
    throw new Error(
      `batch ${batchId} sem plannedFiles — impacted-context não pode provar escopo de mutação`
    );
  }
  const consumerFiles = [
    ...new Set([
      ...plannedFiles,
      ...result.changedFiles.map(({ file }) => file),
      ...(result.contexts ?? []).flatMap((context) =>
        (context.componentModules ?? []).filter(Boolean)
      ),
    ]),
  ].sort();
  const uncoveredConsumers = [
    ...(result.gaps?.deletedChangedFiles ?? []),
    ...(result.gaps?.unresolvedChangedFiles ?? []),
    ...(result.gaps?.uncoveredChangedFiles ?? []),
    ...(result.fixtureGaps ?? []).map(({ pattern }) => pattern),
  ].sort();
  return {
    ...header("impacted-context"),
    batchId,
    plannedFiles,
    consumerFiles,
    routes,
    scenarioIds: scenarioArtifacts.map(({ scenarioId }) => scenarioId),
    fanOutReasons: result.fanOutReasons,
    coverageComplete: result.coverageComplete,
    uncoveredConsumers,
  };
}

async function runCli() {
  const argv = process.argv.slice(2);
  const files = argumentValue(argv, "--files");
  const since = argumentValue(argv, "--since");
  const runConfigPath = argumentValue(argv, "--run-config");
  const runConfig = runConfigPath
    ? JSON.parse(readFileSync(path.resolve(runConfigPath), "utf8"))
    : null;
  const result = await affectedRoutes({
    files: files ? [files] : [],
    since,
    includeWorkingTree: !argv.includes("--committed-only"),
    inspectLocalData: !argv.includes("--environment-only"),
    sourceRoots: runConfig?.sourceRoots ?? [],
  });
  const emitPath = argumentValue(argv, "--emit-artifact");
  if (emitPath) {
    const artifact = impactedContextArtifact({
      result,
      runConfigPath,
      batchContractPath: argumentValue(argv, "--batch-contract"),
      batchId: argumentValue(argv, "--batch-id"),
      sourceFingerprint: argumentValue(argv, "--source-fingerprint"),
    });
    const absolute = path.resolve(emitPath);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, `${JSON.stringify(artifact, null, 2)}\n`);
  }
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
