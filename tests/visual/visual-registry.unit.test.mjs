import assert from "node:assert/strict";
import test from "node:test";

import { materializeVisualRegistry } from "./visual-registry.mjs";

function staticRoute(pathPattern) {
  return {
    pathPattern,
    routeKind: "static",
    wildcard: false,
    dynamic: false,
    parameterNames: [],
    componentModule: `/tmp/app${pathPattern === "/" ? "/page" : pathPattern}/page.tsx`,
    componentModules: [],
    guardNames: [],
  };
}

test("rotas com o mesmo nome amigável ganham scenarioIds determinísticos e únicos", () => {
  const registry = materializeVisualRegistry({
    routes: [staticRoute("/"), staticRoute("/home")],
    environment: {},
  });
  assert.deepEqual(
    registry.contexts.map(({ name }) => name),
    ["home", "home__route_home"]
  );
  assert.deepEqual(
    registry.scenarios.map(({ scenarioId }) => scenarioId),
    ["home/default", "home__route_home/default"]
  );
});
