/**
 * REFERÊNCIA PENDURADA NÃO PODE SER CARIMBADA COMO VÁLIDA.
 *
 * DEFEITO REAL QUE ORIGINOU ESTE TESTE (review adversarial, 2026-08-01). Uma
 * corrida chegou a `DECIDED` com **0 de 236** `targetClusterIds` do
 * `batch-contract` existindo entre os `cluster-packet` da fase anterior, e
 * `tokenization-runner validate` devolveu `valid: true`.
 *
 * A causa era estrutural, não um descuido de um emissor:
 * `grep 'targetClusterIds|clusterIds|clusterId'` em `lib/artifact-contract.mjs`
 * não devolvia NADA. O schema exige `nonEmptyStringSet` e nada mais — qualquer
 * string passa. O contrato reconta EIXOS contra o censo (`checkAxisDiscovery`) e
 * nunca recontava ID DE CLUSTER, então a cadeia CLASSIFIED→DECIDED podia estar
 * inteiramente desconectada e ainda assim ser aprovada.
 *
 * Os emissores foram consertados para propagar o id real
 * (`context-clusters.mjs` atribui na lista, `converge-tokens.mjs` acumula os
 * absorvidos, `freeze-batch.mjs` cita os do contrato), e o join passou de 0/236
 * para 1234/1234. Mas conserto de emissor sem check no verificador é conserto
 * que a próxima sessão desfaz sem ninguém notar — por isso o check existe, e por
 * isso ele precisa ser VISTO FALHANDO.
 *
 * Não precisa de app-alvo: integridade referencial é uma propriedade do conjunto
 * de artefatos, não do projeto.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { createArtifactValidator, validateArtifactSet } from "../lib/artifact-contract.mjs";

const APP =
  process.env.TOKENIZE_TEST_ROOT ??
  path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../../../../frontend");

/*
 * O CONJUNTO PRECISA DE UM run-config, e descobrir isso foi o primeiro achado
 * deste teste: `validateArtifactSet` faz `if (configs.length !== 1) return`
 * (`lib/artifact-contract.mjs`, no bloco de checks cruzados) e **pula todos os
 * checks cruzados** quando o conjunto não tem exatamente uma âncora. A primeira
 * versão deste teste não trazia run-config, o check nunca rodava, e o teste
 * negativo falhava dizendo que o contrato não recusava — quando na verdade o
 * contrato nem tinha sido consultado.
 *
 * O run-config real do alvo é usado como fixture porque ele é schema-válido por
 * construção (`anchor-run.mjs` valida antes de escrever). Inventar um aqui seria
 * manter uma segunda cópia do schema, que é como a fixture de `recordStage`
 * ficou para trás do produtor.
 */
const CONFIG_REAL = path.join(APP, ".tokenize/run-config.json");
const temConfig = existsSync(CONFIG_REAL);
const RUN_CONFIG = temConfig ? JSON.parse(readFileSync(CONFIG_REAL, "utf8")) : null;

const SHA = RUN_CONFIG?.sourceFingerprint ?? "a".repeat(64);
const HEADER = (artifactType) => ({
  schemaVersion: "1.0.0",
  artifactType,
  runId: RUN_CONFIG?.runId ?? "tokenize-integridade",
  sourceFingerprint: SHA,
  toolchainFingerprint: RUN_CONFIG?.toolchainFingerprint ?? "b".repeat(64),
  generatedAt: "2026-08-01T00:00:00.000Z",
});

function pacote(clusterId) {
  return {
    ...HEADER("cluster-packet"),
    clusterId,
    occurrenceIds: [`${clusterId}:occ-1`],
    contextFingerprint: "c".repeat(64),
    styleVariants: [
      {
        styleFingerprint: "d".repeat(64),
        rawValues: ["text-content-primary"],
        frequency: 1,
        locations: [{ file: "src/A.jsx", line: 1, column: 1 }],
        equivalenceLevel: "OBSERVED_EQUIVALENT",
      },
    ],
    evidenceRefs: [{ artifactType: "run-config", path: "config.json", sha256: SHA }],
    classificationStatus: "classified",
  };
}

function loteCitando(ids) {
  return {
    ...HEADER("batch-contract"),
    batchId: "B0001",
    targetClusterIds: ids,
    decisionIds: ["B0001-D0001"],
    plannedFiles: ["src/A.jsx"],
    expectedVisualEffect: "preserve",
    expectedChangedScenarioIds: [],
    expectedUnchangedScenarioIds: ["home/default"],
    absoluteTargets: { contractsInBatch: 1 },
    rollbackSourceFingerprint: SHA,
  };
}

function validarConjunto(artefatos) {
  if (!temConfig) {
    // Sem âncora não há como exercitar checks cruzados; declarar em vez de
    // passar verde por vacuidade.
    throw new Error(
      `este teste exige o run-config do alvo em ${CONFIG_REAL} — rode: node anchor-run.mjs --root <app>`
    );
  }
  const runRoot = mkdtempSync(path.join(os.tmpdir(), "integridade-"));
  // `resolveReferences: false` porque o que se testa aqui é o JOIN entre
  // artefatos, não a resolução de arquivo em disco — misturar os dois faria o
  // teste passar por um motivo que não é o dele.
  const validator = createArtifactValidator({ root: APP });
  writeFileSync(path.join(runRoot, "config.json"), "{}");
  return validateArtifactSet({
    records: [RUN_CONFIG, ...artefatos].map((artifact) => ({ artifact, sourcePath: "memoria", line: 1 })),
    runRoot,
    validator,
    resolveReferences: false,
  });
}

test("lote que cita cluster inexistente é REPROVADO", () => {
  const r = validarConjunto([
    pacote("cluster-00001"),
    pacote("cluster-00002"),
    loteCitando(["cluster-00001", "cluster-NAO-EXISTE"]),
  ]);
  const pendurada = (r.violations ?? []).filter((v) =>
    String(v.message).includes("que nenhum cluster-packet declara")
  );
  assert.equal(
    pendurada.length,
    1,
    "o contrato tem que recusar id que nenhum packet declara — foi assim que 0/236 passou por válido"
  );
  assert.equal(pendurada[0].reentryCode, "E-CLASSIFY", "o defeito é de classificação, e a re-entrada tem que apontar para lá");
  assert.deepEqual(pendurada[0].details?.penduradas, ["cluster-NAO-EXISTE"]);
});

test("lote que cita apenas clusters existentes PASSA no check", () => {
  const r = validarConjunto([
    pacote("cluster-00001"),
    pacote("cluster-00002"),
    loteCitando(["cluster-00001", "cluster-00002"]),
  ]);
  const pendurada = (r.violations ?? []).filter((v) =>
    String(v.message).includes("que nenhum cluster-packet declara")
  );
  assert.deepEqual(pendurada, [], "referência íntegra não pode gerar violação — guard que reprova tudo não é guard");
});

test("sem cluster-packet no conjunto o check NÃO opina", () => {
  /*
   * Escopo deliberado. Uma re-entrada que revalide só o lote não tem os packets
   * em mãos; exigir a presença deles transformaria integridade referencial em
   * exigência de COMPLETUDE, e a re-entrada falharia por um motivo que não é o
   * dela. O check só fala quando tem com o que comparar.
   */
  const r = validarConjunto([loteCitando(["cluster-QUALQUER"])]);
  const pendurada = (r.violations ?? []).filter((v) =>
    String(v.message).includes("que nenhum cluster-packet declara")
  );
  assert.deepEqual(pendurada, [], "sem packet no conjunto não há universo contra o qual julgar");
});
