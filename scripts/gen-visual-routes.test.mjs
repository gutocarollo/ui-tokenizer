import test from "node:test";
import assert from "node:assert/strict";

import {
  applyRouteEvidencePolicy,
  neutralizeExternalRegistry,
} from "./gen-visual-routes.mjs";

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
});
