import test from "node:test";
import assert from "node:assert/strict";

import {
  applyExternalFixtureScenarios,
  applyRouteEvidencePolicy,
  externalFixtureRegistry,
  neutralizeExternalRegistry,
} from "./gen-visual-routes.mjs";
import { selectImpactedScenarios } from "./lib/impacted-evidence-selection.mjs";

function registry() {
  return {
    contexts: [
      {
        path: "/private",
        authRole: "anonymous",
        fixtureId: "fixture-private",
        networkFixtureId: null,
        fixtureSource: "route-declaration",
      },
      {
        path: "/auth/signin",
        authRole: "anonymous",
        fixtureId: "fixture-public",
        networkFixtureId: null,
        fixtureSource: "route-declaration",
      },
    ],
    scenarios: [
      {
        scenarioId: "private/default",
        route: "/private",
        authRole: "anonymous",
        fixtureId: "fixture-private",
        networkFixtureId: null,
        actions: [],
      },
      {
        scenarioId: "signin/default",
        route: "/auth/signin",
        authRole: "anonymous",
        fixtureId: "fixture-public",
        networkFixtureId: null,
        actions: [],
      },
    ],
  };
}

test("registro durável de cenários é projetado no impacted-context", () => {
  const selected = selectImpactedScenarios({
    scenarios: registry().scenarios,
    impactedBaseIds: ["private/default"],
  });
  assert.deepEqual(selected.map(({ scenarioId }) => scenarioId), [
    "private/default",
  ]);
});

test("projeção de cenários recusa ID impactado ausente", () => {
  assert.throws(
    () =>
      selectImpactedScenarios({
        scenarios: registry().scenarios,
        impactedBaseIds: ["missing/default"],
      }),
    /absent from the visual registry/
  );
});

test("projeção de cenários recusa IDs duplicados no registro", () => {
  const duplicate = registry().scenarios[0];
  assert.throws(
    () =>
      selectImpactedScenarios({
        scenarios: [...registry().scenarios, duplicate],
        impactedBaseIds: ["private/default"],
      }),
    /duplicate scenarioId/
  );
});

test("external target may declare a default authenticated role with explicit public routes", () => {
  const result = neutralizeExternalRegistry(registry(), {
    UI_EVIDENCE_DEFAULT_AUTH_ROLE: "authenticated",
    UI_EVIDENCE_ANONYMOUS_ROUTES: "/auth/signin",
  });

  assert.deepEqual(
    result.contexts.map(({ path, authRole }) => ({ path, authRole })),
    [
      { path: "/private", authRole: "authenticated" },
      { path: "/auth/signin", authRole: "anonymous" },
    ]
  );
  assert.deepEqual(
    result.scenarios.map(({ route, authRole }) => ({ route, authRole })),
    [
      { route: "/private", authRole: "authenticated" },
      { route: "/auth/signin", authRole: "anonymous" },
    ]
  );
});

test("external read-only network fixture survives neutralization and owns its interaction", () => {
  const document = {
    semanticReadTransports: {
      "/lead/:id": [
        {
          method: "POST",
          path: "/api/v1/private/query",
          contractSources: ["server/private-query.ts"],
        },
      ],
    },
    fixtures: [
      {
        id: "lead-v1",
        routePattern: "/lead/:id",
        routeParams: { id: "stable" },
        scenario: {
          interactionState: "details-open",
          actions: [
            { type: "goto", target: null, value: "$route" },
            { type: "click", target: "[aria-label='details']", value: null },
          ],
          assertions: [
            { type: "assert", target: "[role='dialog']", value: "visible" },
          ],
        },
      },
    ],
  };
  assert.deepEqual(externalFixtureRegistry(document), {
    "/lead/:id": [
      {
        fixtureId: "lead-v1",
        networkFixtureId: "lead-v1",
        name: "lead-v1",
        params: { id: "stable" },
        source: "target-versioned-network-read-only",
      },
    ],
  });

  const base = registry();
  base.contexts[0].fixtureId = "lead-v1";
  base.contexts[0].networkFixtureId = "lead-v1";
  base.scenarios[0].fixtureId = "lead-v1";
  base.scenarios[0].networkFixtureId = "lead-v1";
  base.scenarios[0].route = "/lead/stable";
  base.scenarios[0].routePattern = "/lead/:id";
  // Simula uma fixture estática pertencente ao processo, não ao alvo. Ela não
  // pode escapar só porque `visual-registry.mjs` a conhece.
  base.contexts[1].fixtureId = "onboarding-home-v1";
  base.contexts[1].networkFixtureId = "onboarding-home-v1";
  base.scenarios[1].fixtureId = "onboarding-home-v1";
  base.scenarios[1].networkFixtureId = "onboarding-home-v1";
  const neutral = neutralizeExternalRegistry(
    base,
    { UI_EVIDENCE_DEFAULT_AUTH_ROLE: "authenticated" },
    new Set(["lead-v1"])
  );
  assert.equal(neutral.contexts[0].networkFixtureId, "lead-v1");
  assert.equal(neutral.scenarios[0].networkFixtureId, "lead-v1");
  assert.equal(neutral.contexts[1].networkFixtureId, null);
  assert.equal(neutral.scenarios[1].networkFixtureId, null);
  assert.equal(neutral.contexts[1].fixtureId, "authenticated-session-v1");

  const result = applyExternalFixtureScenarios(neutral, document);
  assert.equal(result.scenarios[0].interactionState, "details-open");
  assert.deepEqual(result.scenarios[0].actions, [
    { type: "goto", target: null, value: "/lead/stable" },
    { type: "click", target: "[aria-label='details']", value: null },
  ]);
  assert.deepEqual(result.scenarios[0].semanticReadTransports, [
    {
      method: "POST",
      path: "/api/v1/private/query",
      contractSources: ["server/private-query.ts"],
    },
  ]);
});

test("route evidence policy masks only declared dynamic regions and is fingerprint-bound", () => {
  const base = neutralizeExternalRegistry(registry(), {});
  const result = applyRouteEvidencePolicy(base, {
    schemaVersion: "1.0.0",
    routes: {
      "/auth/signin": {
        stabilityMaskSelectors: ["canvas"],
        rationale: "two intentional requestAnimationFrame canvas loops",
        freezeClock: true,
      },
    },
  });
  assert.equal(result.contexts[0].stabilityMaskSelectors, undefined);
  assert.deepEqual(result.contexts[1].stabilityMaskSelectors, ["canvas"]);
  assert.deepEqual(result.scenarios[1].stabilityMaskSelectors, ["canvas"]);
  assert.equal(result.scenarios[1].freezeClock, true);
  assert.equal(result.scenarios[1].fixedTime, undefined);
  assert.notEqual(result.fixtureRegistryFingerprint, base.fixtureRegistryFingerprint);
  assert.notEqual(result.scenarioRegistryFingerprint, base.scenarioRegistryFingerprint);
});

test("route evidence policy composes authenticated-shell defaults with route masks", () => {
  const base = neutralizeExternalRegistry(registry(), {
    UI_EVIDENCE_DEFAULT_AUTH_ROLE: "authenticated",
    UI_EVIDENCE_ANONYMOUS_ROUTES: "/auth/signin",
  });
  const result = applyRouteEvidencePolicy(base, {
    schemaVersion: "1.0.0",
    authRoles: {
      authenticated: {
        stabilityMaskSelectors: ["[data-theme-control]"],
        rationale: "shared translucent shell control",
      },
    },
    routes: {
      "/private": {
        stabilityMaskSelectors: ["iframe"],
        rationale: "externally mutable dashboard",
        fixedTime: true,
      },
    },
  });

  assert.deepEqual(result.contexts[0].stabilityMaskSelectors, [
    "[data-theme-control]",
    "iframe",
  ]);
  assert.match(
    result.contexts[0].stabilityRationale,
    /shared translucent shell control.*externally mutable dashboard/
  );
  assert.equal(result.scenarios[0].fixedTime, true);
  assert.equal(result.contexts[1].stabilityMaskSelectors, undefined);
  assert.notEqual(result.fixtureRegistryFingerprint, base.fixtureRegistryFingerprint);
  assert.notEqual(result.scenarioRegistryFingerprint, base.scenarioRegistryFingerprint);

  const isolated = applyRouteEvidencePolicy(base, {
    schemaVersion: "1.0.0",
    authRoles: {
      authenticated: {
        stabilityMaskSelectors: ["[data-theme-control]"],
        rationale: "shared translucent shell control",
        excludedRoutes: ["/private"],
      },
    },
    routes: {
      "/private": {
        stabilityMaskSelectors: ["svg"],
        rationale: "isolated modal surface has no authenticated shell",
      },
    },
  });
  assert.deepEqual(isolated.contexts[0].stabilityMaskSelectors, ["svg"]);
  assert.equal(
    isolated.contexts[0].stabilityRationale,
    "isolated modal surface has no authenticated shell"
  );
});

test("route evidence policy fails closed for unknown routes or missing rationale", () => {
  const base = neutralizeExternalRegistry(registry(), {});
  assert.throws(
    () =>
      applyRouteEvidencePolicy(base, {
        schemaVersion: "1.0.0",
        routes: {
          "/ghost": {
            stabilityMaskSelectors: ["canvas"],
            rationale: "unknown",
          },
        },
      }),
    /unknown route/
  );
  assert.throws(
    () =>
      applyRouteEvidencePolicy(base, {
        schemaVersion: "1.0.0",
        routes: {
          "/auth/signin": {
            stabilityMaskSelectors: ["canvas"],
            rationale: "",
          },
        },
      }),
    /requires non-empty/
  );
  assert.throws(
    () =>
      applyRouteEvidencePolicy(base, {
        schemaVersion: "1.0.0",
        routes: {
          "/auth/signin": {
            stabilityMaskSelectors: ["canvas"],
            rationale: "ambiguous clock policy",
            freezeClock: true,
            fixedTime: true,
          },
        },
      }),
    /cannot freezeClock and fixedTime together/
  );
  assert.throws(
    () =>
      applyRouteEvidencePolicy(base, {
        schemaVersion: "1.0.0",
        authRoles: {
          authenticated: {
            stabilityMaskSelectors: ["[data-theme-control]"],
            rationale: "role absent from the registry",
          },
        },
        routes: {},
      }),
    /unknown auth role/
  );
  assert.throws(
    () =>
      applyRouteEvidencePolicy(base, {
        schemaVersion: "1.0.0",
        authRoles: {
          anonymous: {
            stabilityMaskSelectors: ["canvas"],
            rationale: "invalid exclusion",
            excludedRoutes: ["/ghost"],
          },
        },
        routes: {},
      }),
    /excludedRoutes must name only known routes/
  );
});
