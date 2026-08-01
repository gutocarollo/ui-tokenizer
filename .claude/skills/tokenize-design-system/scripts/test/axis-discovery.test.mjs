import assert from "node:assert/strict";
import test from "node:test";
import {
  DESIGN_AXES,
  OCCURRENCE_KINDS,
  SOURCE_KIND_REGISTRY,
  axesForCandidate,
  axesForOccurrence,
  axisForProperty,
  makeAxisDiscovery,
  primaryAxisFor,
} from "../lib/axis-discovery.mjs";

test("source-kind registry is closed, unique, and executable by contract", () => {
  assert.equal(OCCURRENCE_KINDS.length, 19);
  assert.equal(SOURCE_KIND_REGISTRY.length, 19);
  assert.deepEqual(
    new Set(SOURCE_KIND_REGISTRY.map((entry) => entry.occurrenceKind)),
    new Set(OCCURRENCE_KINDS)
  );
  for (const entry of SOURCE_KIND_REGISTRY) {
    assert.equal(entry.disposition, "scan");
    assert.ok(entry.adapter);
    assert.ok(entry.rationale);
  }
});

test("property and utility evidence discover independent axes", () => {
  assert.equal(axisForProperty("backgroundColor"), "color");
  assert.equal(axisForProperty("--card-radius"), "radius");
  assert.equal(axisForProperty("border-radius"), "radius");
  assert.equal(axisForProperty("border-top-left-radius"), "radius");
  assert.equal(axisForProperty("fontSize"), "typography");
  assert.deepEqual(axesForCandidate("md:hover:bg-red-500"), [
    "breakpoint",
    "color",
  ]);
  assert.deepEqual(axesForCandidate("px-2"), ["spacing"]);
  assert.deepEqual(axesForCandidate("text-center"), ["typography"]);
  assert.deepEqual(axesForCandidate("text-ellipsis"), ["typography"]);
  assert.deepEqual(axesForCandidate("rotate-45"), ["motion"]);
  assert.deepEqual(axesForCandidate("drop-shadow-lg"), ["elevation"]);
  assert.deepEqual(axesForCandidate("line-clamp-3"), ["typography"]);
  assert.equal(
    primaryAxisFor({
      occurrenceKind: "utility-class",
      rawValue: "p-2 opacity-50",
    }),
    "spacing"
  );
  assert.equal(
    primaryAxisFor({
      occurrenceKind: "svg-presentation",
      property: "width",
    }),
    "sizing"
  );
  assert.equal(
    primaryAxisFor({
      occurrenceKind: "svg-presentation",
      property: "height",
    }),
    "sizing"
  );
  assert.equal(
    primaryAxisFor({
      occurrenceKind: "svg-presentation",
      property: "opacity",
    }),
    "opacity"
  );
  assert.equal(
    primaryAxisFor({
      occurrenceKind: "svg-presentation",
      property: "viewBox",
    }),
    "layout"
  );
  assert.deepEqual(
    axesForOccurrence({
      occurrenceKind: "utility-class",
      rawValue: "md:px-2 bg-red-500",
      axis: "spacing",
    }),
    ["breakpoint", "color", "spacing"]
  );
});

test("failed scanners and unmapped occurrences prevent exhaustive discovery", () => {
  const scannerResults = SOURCE_KIND_REGISTRY.map((entry) => ({
    occurrenceKind: entry.occurrenceKind,
    status: entry.occurrenceKind === "canvas-draw" ? "failed" : "executed",
  }));
  const discovery = makeAxisDiscovery({
    header: {
      schemaVersion: "1.0.0",
      runId: "tokenize-test",
      sourceFingerprint: "a".repeat(64),
      toolchainFingerprint: "b".repeat(64),
      generatedAt: "2026-01-01T00:00:00.000Z",
    },
    discoveryId: "fixture",
    occurrences: [
      {
        occurrenceKind: "utility-class",
        rawValue: "md:px-2 bg-red-500",
        axis: "spacing",
      },
      {
        occurrenceKind: "inline-style",
        rawValue: "unknownValue",
        axis: "unmapped",
      },
    ],
    configuredAxes: DESIGN_AXES,
    scannerResults,
  });
  /*
   * ATUALIZADO 2026-08-01 — a PROPRIEDADE que este teste protege continua
   * inteira; o lugar onde ela vive mudou, porque as duas asserções originais
   * codificavam um modelo que o contrato de artefato torna impossível.
   *
   * 1. `canvas-draw` NÃO aparece mais em `uncoveredOccurrenceKinds`. O contrato
   *    (`lib/artifact-contract.mjs:1331-1337`) exige
   *    `covered ∪ uncovered ⊆ discovered`, e `canvas-draw` não foi descoberto
   *    nesta fixture. O sinal do scanner quebrado passou a ser lido da FONTE —
   *    `scannerResults[].status` — dentro de `exhaustive`, o que é mais forte:
   *    antes ele só contava se o kind estivesse na varredura dos 19; agora vale
   *    mesmo quando o kind não aparece em lugar nenhum.
   *
   * 2. `byAxis` conta REGISTROS por eixo primário, não pertinências. A
   *    expectativa antiga era `{breakpoint:1, color:1, spacing:1, unmapped:1}` —
   *    soma 4 para 2 ocorrências, porque `md:px-2 bg-red-500` é um bundle que
   *    toca três eixos. Um campo chamado `occurrenceCounts` cuja soma excede o
   *    número de ocorrências não conta ocorrências. E o contrato
   *    (`artifact-contract.mjs:1213-1218` e o `sameSet` da Linha 1345) recontava
   *    por `artifact.axis` e exigia igualdade — as duas leituras não podem
   *    coexistir, e a que o enforcement aplica é a do registro.
   *
   * A leitura multi-eixo não se perdeu do sistema: `axesForOccurrence` continua
   * exportada, e cada `design-occurrence` carrega o bundle dividido em
   * `classExpression.rawTokens`.
   */
  assert.ok(
    !discovery.uncoveredOccurrenceKinds.includes("canvas-draw"),
    "kind não descoberto não pode entrar na cobertura — o contrato reprova"
  );
  assert.ok(discovery.uncoveredAxes.includes("unmapped"));
  assert.ok(discovery.discoveredAxes.includes("unmapped"));
  assert.deepEqual(
    Object.fromEntries(
      ["breakpoint", "color", "spacing", "unmapped"].map((axis) => [
        axis,
        discovery.occurrenceCounts.byAxis[axis],
      ])
    ),
    { breakpoint: 0, color: 0, spacing: 1, unmapped: 1 },
    "byAxis é a partição por eixo primário: 2 ocorrências, soma 2"
  );
  assert.equal(
    Object.values(discovery.occurrenceCounts.byAxis).reduce((s, n) => s + n, 0),
    2,
    "a soma de byAxis tem que ser o número de ocorrências, senão não é contagem de ocorrências"
  );
  assert.equal(
    discovery.exhaustive,
    false,
    "scanner com status failed derruba a exaustividade mesmo sem ocorrência do kind"
  );
});
