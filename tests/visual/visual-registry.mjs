import { createHash } from "node:crypto";
import path from "node:path";

import { resolveAppRoot } from "../../scripts/lib/app-roots.mjs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  hasSensitiveRouteParameter,
  routeNameFromPath,
} from "../../scripts/lib/route-impact.mjs";
import {
  getReadOnlyNetworkFixture,
  NETWORK_FIXTURE_IDS,
  NETWORK_FIXTURE_REGISTRY_FINGERPRINT,
} from "./network-fixtures.mjs";

const FRONTEND_ROOT = resolveAppRoot(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")
);
const DEFAULT_WORKSPACE_SLUG = "glm-test";
const DEFAULT_THREAD_SLUG = "5ee546b3-f567-41be-b8a9-5e3b52df6d5a";

const COMPATIBLE_ROUTE_NAMES = frozen({
  "/": "home",
  "/login": "login",
  "/settings/llm-preference": "settings_llm",
  "/settings/interface": "settings_interface",
  "/settings/agents": "settings_agents",
  "/settings/model-routers": "settings_routers",
  "/settings/branding": "settings_branding",
  "/settings/security": "settings_security",
  "/settings/api-keys": "settings_api_keys",
  "/settings/beta-features": "settings_beta_features",
  "/settings/system-prompt-variables": "settings_system_prompt_vars",
  "/settings/workspace-chats": "settings_workspace_chats",
  "/settings/transcription-preference": "settings_transcription",
  "/settings/mobile-connections": "settings_mobile_connections",
});

function frozen(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) frozen(child);
  }
  return value;
}

function versionedNetworkRouteFixture(pattern, name) {
  const networkFixtureId = NETWORK_FIXTURE_IDS[pattern];
  const networkFixture = getReadOnlyNetworkFixture(networkFixtureId);
  if (networkFixture.routePattern !== pattern) {
    throw new Error(
      `Network fixture ${networkFixtureId} belongs to ${networkFixture.routePattern}, not ${pattern}.`
    );
  }
  return {
    fixtureId: networkFixtureId,
    networkFixtureId,
    name,
    params: networkFixture.routeParams,
    source: "versioned-network-read-only",
  };
}

/**
 * Versioned, non-secret route fixtures that have already been used by the
 * visual suite in this repository. They are identifiers only: no credential,
 * cookie, API key, invite code, or database mutation is permitted here.
 *
 * Runtime capture still validates that each identifier exists. A stale
 * checked-in fixture is an E-FIXTURE failure, never a reason to create data.
 */
export const CHECKED_IN_ROUTE_FIXTURES = frozen({
  "/settings/agents/builder/:flowId": [
    versionedNetworkRouteFixture(
      "/settings/agents/builder/:flowId",
      "settings_agents_builder_fixture"
    ),
  ],
  "/settings/model-routers/:id": [
    versionedNetworkRouteFixture(
      "/settings/model-routers/:id",
      "settings_model_router_fixture"
    ),
  ],
  "/settings/scheduled-jobs/:id/runs": [
    versionedNetworkRouteFixture(
      "/settings/scheduled-jobs/:id/runs",
      "settings_scheduled_job_runs_fixture"
    ),
  ],
  "/settings/scheduled-jobs/:id/runs/:runId": [
    versionedNetworkRouteFixture(
      "/settings/scheduled-jobs/:id/runs/:runId",
      "settings_scheduled_job_run_fixture"
    ),
  ],
  "/onboarding/:step": [
    versionedNetworkRouteFixture(
      "/onboarding/:step",
      "onboarding_llm_preference"
    ),
  ],
  "/workspace/:slug": [
    {
      fixtureId: "workspace-glm-test-v1",
      name: "workspace_glm_test",
      params: { slug: DEFAULT_WORKSPACE_SLUG },
      source: "checked-in-read-only",
    },
  ],
  "/workspace/:slug/settings/:tab": [
    {
      fixtureId: "workspace-glm-test-general-appearance-v1",
      name: "ws_general_appearance",
      params: {
        slug: DEFAULT_WORKSPACE_SLUG,
        tab: "general-appearance",
      },
      source: "checked-in-read-only",
    },
    {
      fixtureId: "workspace-glm-test-vector-database-v1",
      name: "ws_vector_database",
      params: {
        slug: DEFAULT_WORKSPACE_SLUG,
        tab: "vector-database",
      },
      source: "checked-in-read-only",
    },
  ],
  "/workspace/:slug/t/:threadSlug": [
    {
      fixtureId: "workspace-glm-test-thread-v1",
      name: "ws_active_thread",
      params: {
        slug: DEFAULT_WORKSPACE_SLUG,
        threadSlug: DEFAULT_THREAD_SLUG,
      },
      source: "checked-in-read-only",
    },
  ],
});

/**
 * Optional environment-backed identifiers for data-dependent routes. Only the
 * named identifier variables are read. Authentication variables are neither
 * enumerated nor returned, and sensitive route parameters (code/token/etc.)
 * are categorically rejected.
 */
export const ENVIRONMENT_ROUTE_FIXTURES = frozen({
  "/settings/agents/builder/:flowId": {
    fixtureId: "environment-agent-flow-v1",
    name: "settings_agents_builder_fixture",
    params: { flowId: "UI_EVIDENCE_AGENT_FLOW_ID" },
  },
  "/settings/model-routers/:id": {
    fixtureId: "environment-model-router-v1",
    name: "settings_model_router_fixture",
    params: { id: "UI_EVIDENCE_MODEL_ROUTER_ID" },
  },
  "/settings/scheduled-jobs/:id/runs": {
    fixtureId: "environment-scheduled-job-v1",
    name: "settings_scheduled_job_runs_fixture",
    params: { id: "UI_EVIDENCE_SCHEDULED_JOB_ID" },
  },
  "/settings/scheduled-jobs/:id/runs/:runId": {
    fixtureId: "environment-scheduled-job-run-v1",
    name: "settings_scheduled_job_run_fixture",
    params: {
      id: "UI_EVIDENCE_SCHEDULED_JOB_ID",
      runId: "UI_EVIDENCE_SCHEDULED_JOB_RUN_ID",
    },
  },
});

export const READ_ONLY_SCENARIO_ACTIONS = frozen({
  "load-ready": {
    interactionState: "default",
    readOnly: true,
    preconditions: [],
    actions: [{ type: "goto", target: null, value: "$route" }],
    assertions: [
      {
        type: "assert",
        target: "[data-evidence-ready]",
        value: "attached",
      },
    ],
  },
});

/**
 * Route-specific readiness witnesses close gaps that generic network/DOM
 * readiness cannot observe. The login witness is anchored in a reproduced
 * failure where the button shell rendered before its icon and label.
 */
export const ROUTE_READINESS_WITNESSES = frozen({
  "/login": {
    witness: {
      type: "visible-text",
      value: "Sign in with Microsoft",
    },
    assertReady: {
      type: "assert",
      target: "text=Sign in with Microsoft",
      value: "visible",
    },
  },
  "/settings/community-hub/import-item": {
    witness: {
      type: "visible-text",
      value: "Import a Community Item",
    },
    assertReady: {
      type: "assert",
      target: "h1",
      value: "visible",
    },
  },
});

/**
 * A few legacy endpoints use POST as a transport for a read query. They are
 * not mutations: the linked server handlers perform only lookups. Keeping an
 * exact route/method allow-list preserves the global mutation gate while
 * making this transport debt explicit and reviewable.
 */
export const SEMANTIC_READ_TRANSPORTS = frozen({
  "/onboarding/:step": [
    {
      method: "POST",
      path: "/api/system/custom-models",
      contractSources: [
        "frontend/src/models/system.js",
        "server/endpoints/system.js",
      ],
    },
  ],
  "/settings/embedding-preference": [
    {
      method: "POST",
      path: "/api/system/custom-models",
      contractSources: [
        "frontend/src/models/system.js",
        "server/endpoints/system.js",
      ],
    },
  ],
  "/settings/event-logs": [
    {
      method: "POST",
      path: "/api/system/event-logs",
      contractSources: [
        "frontend/src/models/system.js",
        "server/endpoints/system.js",
      ],
    },
  ],
  "/settings/llm-preference": [
    {
      method: "POST",
      path: "/api/system/custom-models",
      contractSources: [
        "frontend/src/models/system.js",
        "server/endpoints/system.js",
      ],
    },
  ],
  "/settings/workspace-chats": [
    {
      method: "POST",
      path: "/api/system/workspace-chats",
      contractSources: [
        "frontend/src/models/system.js",
        "server/endpoints/system.js",
      ],
    },
  ],
});

export const EXPECTED_RENDERED_ERRORS = frozen({
  "*": 'h1:has-text("404 - Page Not Found")',
});

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function routeParams(pattern) {
  return [...pattern.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => match[1]);
}

function concretePath(pattern, params) {
  return pattern.replace(/:([A-Za-z0-9_]+)/g, (_, name) =>
    encodeURIComponent(String(params[name]))
  );
}

function authRoleForRoute(route) {
  if (route.guardNames.includes("AdminRoute")) return "admin";
  if (route.guardNames.includes("ManagerRoute")) return "manager";
  if (route.guardNames.includes("SingleUserRoute")) return "single-user";
  if (route.guardNames.includes("PrivateRoute")) return "authenticated";
  return "anonymous";
}

function relativeModule(file) {
  if (!file) return null;
  return path.relative(FRONTEND_ROOT, file).split(path.sep).join("/");
}

function environmentFixture(pattern, environment) {
  const definition = ENVIRONMENT_ROUTE_FIXTURES[pattern];
  if (!definition) return { fixtures: [], missingParams: routeParams(pattern) };
  const params = {};
  const missingParams = [];
  for (const [paramName, environmentName] of Object.entries(
    definition.params
  )) {
    const value = environment[environmentName];
    if (typeof value !== "string" || value.trim() === "") {
      missingParams.push(paramName);
    } else {
      params[paramName] = value.trim();
    }
  }
  if (missingParams.length) return { fixtures: [], missingParams };
  return {
    fixtures: [
      {
        fixtureId: definition.fixtureId,
        name: definition.name,
        params,
        source: "environment-read-only",
      },
    ],
    missingParams: [],
  };
}

function fixtureCandidates(pattern, environment, fixtureRegistry) {
  const checkedIn = fixtureRegistry[pattern] ?? [];
  if (checkedIn.length) return { fixtures: checkedIn, missingParams: [] };
  return environmentFixture(pattern, environment);
}

function validateFixture(route, fixture) {
  const expected = route.parameterNames;
  const actual = Object.keys(fixture.params).sort();
  const missing = expected.filter((name) => !actual.includes(name));
  const unexpected = actual.filter((name) => !expected.includes(name));
  if (missing.length || unexpected.length) {
    throw new Error(
      `Invalid fixture ${fixture.fixtureId} for ${route.pathPattern}: ` +
        `missing=[${missing.join(",")}], unexpected=[${unexpected.join(",")}]`
    );
  }
}

function scenarioForContext(context) {
  const action = READ_ONLY_SCENARIO_ACTIONS["load-ready"];
  const readiness = ROUTE_READINESS_WITNESSES[context.pattern] ?? null;
  const semanticReadTransports =
    SEMANTIC_READ_TRANSPORTS[context.pattern] ?? [];
  return {
    scenarioId: `${context.name}/default`,
    route: context.path,
    routePattern: context.pattern,
    routeParams: context.params,
    fixtureId: context.fixtureId,
    networkFixtureId: context.networkFixtureId,
    authRole: context.authRole,
    interactionState: action.interactionState,
    preconditions: action.preconditions,
    actions: action.actions.map((item) => ({
      ...item,
      value: item.value === "$route" ? context.path : item.value,
    })),
    assertions: readiness
      ? [...action.assertions, readiness.assertReady]
      : action.assertions,
    witness: readiness?.witness ?? null,
    assertReady: readiness?.assertReady ?? null,
    captureRegion: null,
    expectedVisualEffect: "preserve",
    expectedRenderedErrorSelector:
      EXPECTED_RENDERED_ERRORS[context.pattern] ?? null,
    semanticReadTransports,
    readOnly: true,
  };
}

function skipRecord(route, reasonCode, reason, missingParams = []) {
  return {
    pattern: route.pathPattern,
    routeKind: route.routeKind,
    reasonCode,
    reason,
    missingParams: [...missingParams].sort(),
    componentModule: relativeModule(route.componentModule),
  };
}

export function materializeVisualRegistry({
  routes,
  environment = process.env,
  fixtureRegistry = CHECKED_IN_ROUTE_FIXTURES,
}) {
  const contexts = [];
  const skipped = [];

  for (const route of routes) {
    if (route.wildcard) {
      const name = "not_found";
      contexts.push({
        name,
        pattern: route.pathPattern,
        path: "/__visual-404__",
        params: {},
        fixtureId: "anonymous-not-found-v1",
        networkFixtureId: null,
        fixtureSource: "wildcard-witness",
        authRole: authRoleForRoute(route),
        routeKind: route.routeKind,
        componentModule: relativeModule(route.componentModule),
        componentModules: route.componentModules.map(relativeModule),
        scenarioIds: [`${name}/default`],
        status: "materialized",
      });
      continue;
    }
    if (hasSensitiveRouteParameter(route.pathPattern)) {
      skipped.push(
        skipRecord(
          route,
          "sensitive-ephemeral-fixture",
          "Sensitive or one-time route parameters cannot be stored or read from the evidence environment.",
          route.parameterNames
        )
      );
      continue;
    }

    const authRole = authRoleForRoute(route);
    if (!route.dynamic) {
      const name =
        COMPATIBLE_ROUTE_NAMES[route.pathPattern] ??
        routeNameFromPath(route.pathPattern);
      const networkFixtureId = NETWORK_FIXTURE_IDS[route.pathPattern] ?? null;
      contexts.push({
        name,
        pattern: route.pathPattern,
        path: route.pathPattern,
        params: {},
        fixtureId:
          networkFixtureId ??
          (authRole === "anonymous"
            ? "anonymous-static-v1"
            : `${authRole}-session-v1`),
        networkFixtureId,
        fixtureSource: networkFixtureId
          ? "versioned-network-read-only"
          : "route-declaration",
        authRole,
        routeKind: route.routeKind,
        componentModule: relativeModule(route.componentModule),
        componentModules: route.componentModules.map(relativeModule),
        scenarioIds: [`${name}/default`],
        status: "materialized",
      });
      continue;
    }

    const { fixtures, missingParams } = fixtureCandidates(
      route.pathPattern,
      environment,
      fixtureRegistry
    );
    if (!fixtures.length) {
      skipped.push(
        skipRecord(
          route,
          "missing-read-only-fixture",
          "No stable read-only identifier is registered for every route parameter.",
          missingParams
        )
      );
      continue;
    }
    for (const fixture of fixtures) {
      validateFixture(route, fixture);
      const path = concretePath(route.pathPattern, fixture.params);
      const name = fixture.name || routeNameFromPath(path);
      contexts.push({
        name,
        pattern: route.pathPattern,
        path,
        params: fixture.params,
        fixtureId: fixture.fixtureId,
        networkFixtureId: fixture.networkFixtureId ?? null,
        fixtureSource: fixture.source,
        authRole,
        routeKind: route.routeKind,
        componentModule: relativeModule(route.componentModule),
        componentModules: route.componentModules.map(relativeModule),
        scenarioIds: [`${name}/default`],
        status: "materialized",
      });
    }
  }

  contexts.sort(
    (a, b) => a.path.localeCompare(b.path) || a.name.localeCompare(b.name)
  );
  skipped.sort((a, b) => a.pattern.localeCompare(b.pattern));
  const duplicateNames = contexts
    .map((context) => context.name)
    .filter((name, index, all) => all.indexOf(name) !== index);
  const duplicatePaths = contexts
    .map((context) => context.path)
    .filter((routePath, index, all) => all.indexOf(routePath) !== index);
  if (duplicateNames.length || duplicatePaths.length) {
    throw new Error(
      `Visual registry is not unique: names=[${[
        ...new Set(duplicateNames),
      ].join(",")}], paths=[${[...new Set(duplicatePaths)].join(",")}]`
    );
  }

  const scenarios = contexts.map(scenarioForContext);
  const routesJson = contexts.map(({ name, path }) => ({ name, path }));
  const declaredPatterns = [
    ...new Set(routes.map((route) => route.pathPattern)),
  ].sort();
  const coveredPatterns = [
    ...new Set([
      ...contexts.map((context) => context.pattern),
      ...skipped.map((item) => item.pattern),
    ]),
  ].sort();
  return {
    schemaVersion: "1.0.0",
    readOnly: true,
    routes: routesJson,
    contexts,
    scenarios,
    skipped,
    fixtureRegistryFingerprint: sha256({
      checkedIn: fixtureRegistry,
      networkRegistry: NETWORK_FIXTURE_REGISTRY_FINGERPRINT,
      effectiveContexts: contexts.map(
        ({ pattern, path, fixtureId, networkFixtureId, fixtureSource }) => ({
          pattern,
          path,
          fixtureId,
          networkFixtureId,
          fixtureSource,
        })
      ),
    }),
    networkFixtureRegistryFingerprint: NETWORK_FIXTURE_REGISTRY_FINGERPRINT,
    scenarioRegistryFingerprint: sha256({
      actions: READ_ONLY_SCENARIO_ACTIONS,
      readiness: ROUTE_READINESS_WITNESSES,
      semanticReadTransports: SEMANTIC_READ_TRANSPORTS,
      expectedRenderedErrors: EXPECTED_RENDERED_ERRORS,
    }),
    exactDeclarationCoverage:
      declaredPatterns.length === coveredPatterns.length &&
      declaredPatterns.every(
        (pattern, index) => pattern === coveredPatterns[index]
      ),
  };
}
