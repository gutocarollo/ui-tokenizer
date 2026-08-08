import test from "node:test";
import assert from "node:assert/strict";

import {
  assertReversibleShard,
  partitionRouteReachableProposals,
  scenarioIdsForAffectedRoutes,
  selectReversibleShard,
} from "../lib/value-batch-sharding.mjs";

function proposal(clusterId, occurrences, plannedFiles, overrides = {}) {
  return {
    clusterId,
    proposedName: `component.${clusterId}.width`,
    axis: "spacing",
    adapter: "inline-style",
    adapters: ["inline-style"],
    occurrenceIds: Array.from({ length: occurrences }, (_, index) =>
      `${clusterId}-o${index}`
    ),
    plannedFiles,
    confidence: { band: "high", blockers: [] },
    ...overrides,
  };
}

test("shard é determinístico, maximiza ocorrências e limita união de arquivos", () => {
  const result = selectReversibleShard(
    [
      proposal("c", 2, ["c.tsx"]),
      proposal("a", 9, ["a.tsx", "b.tsx"]),
      proposal("b", 4, ["d.tsx"]),
      proposal("d", 3, ["e.tsx"]),
    ],
    { maxFiles: 3 }
  );
  assert.deepEqual(result.selected.map(({ clusterId }) => clusterId), ["a", "b"]);
  assert.deepEqual(result.files, ["a.tsx", "b.tsx", "d.tsx"]);
  assert.deepEqual(result.deferred.map(({ clusterId }) => clusterId), ["d", "c"]);
});

test("clusters que compartilham arquivo ou token são deferidos", () => {
  const first = proposal("a", 9, ["same.tsx"]);
  const sharedFile = proposal("b", 8, ["same.tsx"]);
  const sharedToken = proposal("c", 7, ["other.tsx"], {
    proposedName: first.proposedName,
  });
  const result = selectReversibleShard([sharedToken, sharedFile, first]);
  assert.deepEqual(result.selected.map(({ clusterId }) => clusterId), ["a"]);
  assert.deepEqual(result.deferred.map(({ clusterId }) => clusterId), ["b", "c"]);
  assert.throws(
    () => assertReversibleShard([first, sharedFile]),
    /same\.tsx pertence/
  );
  assert.throws(
    () => assertReversibleShard([first, sharedToken]),
    /token spacing\./
  );
});

test("cluster atômico maior que o teto recusa em vez de sofrer starvation", () => {
  assert.throws(
    () =>
      selectReversibleShard([proposal("a", 10, ["a", "b", "c"])], {
        maxFiles: 2,
      }),
    /sozinho toca 3 arquivos/
  );
});

test("proposta low, bloqueada ou sem adapter comprovado não entra", () => {
  const result = selectReversibleShard([
    proposal("low", 10, ["low.tsx"], { confidence: { band: "low" } }),
    proposal("blocked", 9, ["blocked.tsx"], {
      confidence: { band: "high", blockers: ["ambiguous"] },
    }),
    proposal("css", 8, ["css.tsx"], { adapters: ["css-declaration"] }),
    proposal("dynamic-color", 7, ["color.tsx"], {
      axis: "color",
      physicalValue: "color(theme)",
    }),
    proposal("ok", 1, ["ok.tsx"]),
  ]);
  assert.deepEqual(result.selected.map(({ clusterId }) => clusterId), ["ok"]);
});

test("cluster com callsite sem consumidor visual é deferido antes do freeze", () => {
  const live = proposal("live", 3, ["live.tsx"]);
  const dead = proposal("dead", 4, ["dead.tsx"]);
  const mixed = proposal("mixed", 5, ["live.tsx", "dead.tsx"]);
  const result = partitionRouteReachableProposals(
    [live, dead, mixed],
    [
      { file: "live.tsx", status: "present", affectedRoutes: ["/home"] },
      { file: "dead.tsx", status: "uncovered", affectedRoutes: [] },
    ]
  );
  assert.deepEqual(result.reachable.map(({ clusterId }) => clusterId), ["live"]);
  assert.deepEqual(
    result.unreachable.map(({ proposal: item, uncoveredFiles }) => ({
      clusterId: item.clusterId,
      uncoveredFiles,
    })),
    [
      { clusterId: "dead", uncoveredFiles: ["dead.tsx"] },
      { clusterId: "mixed", uncoveredFiles: ["dead.tsx"] },
    ]
  );
});

test("politica visual cobre exatamente as rotas impactadas e exclui extras", () => {
  const result = scenarioIdsForAffectedRoutes(
    [
      { scenarioId: "auth/default", routePattern: "/auth" },
      { scenarioId: "home/default", routePattern: "/home" },
      { scenarioId: "lead/default", routePattern: "/lead/:id" },
      { scenarioId: "lead/modal", routePattern: "/lead/:id" },
    ],
    [
      { pathPattern: "/home" },
      { pathPattern: "/lead/:id" },
    ]
  );
  assert.deepEqual(result, ["home/default", "lead/default", "lead/modal"]);
});

test("politica visual tolera redirect sem scenario, mas recusa intersecao vazia", () => {
  assert.deepEqual(
    scenarioIdsForAffectedRoutes(
      [{ scenarioId: "home/default", routePattern: "/home" }],
      [{ pathPattern: "/home" }, { pathPattern: "/redirect-only" }]
    ),
    ["home/default"]
  );
  assert.throws(
    () =>
      scenarioIdsForAffectedRoutes(
        [{ scenarioId: "home/default", routePattern: "/home" }],
        [{ pathPattern: "/redirect-only" }]
      ),
    /affected routes matched no visual scenarios/
  );
});
