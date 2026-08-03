import test from "node:test";
import assert from "node:assert/strict";

import { neutralizeExternalRegistry } from "./gen-visual-routes.mjs";

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
