/**
 * sweep.test — o driver do laço TEM de nascer com teste que o vê parar,
 * reentrar e travar (lição 2026-08-02: gate/driver sem teste que o vê
 * BLOQUEAR fica verde durante o apagão inteiro).
 *
 * As dependências (estado/transição/execução/residual) são INJETADAS — o
 * driver real usa runner+executores+evaluate-residual de verdade; aqui cada
 * teste programa a máquina. O progress log NÃO é injetado: escreve em run
 * root temporário de verdade, porque o ledger durável é parte do contrato
 * (D9) e um fake esconderia serialização quebrada.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  contadoresDe,
  proximoLote,
  reentradaMaisAMontante,
  varrer,
  vetorResidual,
} from "../sweep.mjs";
import { lerProgresso, renderProgresso } from "../lib/progress-log.mjs";

function novoRunRoot() {
  const runRoot = mkdtempSync(path.join(tmpdir(), "sweep-"));
  mkdirSync(path.join(runRoot, "artifacts"), { recursive: true });
  return runRoot;
}

function escreverArtefato(runRoot, nome, obj) {
  writeFileSync(path.join(runRoot, "artifacts", nome), `${JSON.stringify(obj)}\n`);
}

/** Máquina de estados fake: transição muda a fase; tudo registrado. */
function maquina(faseInicial) {
  let fase = faseInicial;
  const transicoes = [];
  return {
    transicoes,
    setFase: (f) => {
      fase = f;
    },
    deps: {
      estado: () => ({ phase: fase }),
      transicionar: (t) => {
        transicoes.push(t);
        fase = t.para;
        return { to: t.para };
      },
      executar: (f) => ({ phase: f, kind: "deterministic", executed: true, ok: true, steps: [] }),
      residual: () => {
        throw new Error("residual não era esperado neste teste");
      },
      agora: () => "2026-08-03T00:00:00.000Z",
    },
  };
}

/* ─────────────────────────────────────────────── unidades puras ──────────── */

test("vetorResidual é canônico: ordem de chegada não muda a assinatura", () => {
  const a = vetorResidual({
    detalhe: [
      { predicateId: "b", residuo: 2 },
      { predicateId: "a", residuo: 0 },
    ],
    naoMedidos: [{ predicateId: "z" }, { predicateId: "y" }],
  });
  const b = vetorResidual({
    detalhe: [
      { predicateId: "a", residuo: 0 },
      { predicateId: "b", residuo: 2 },
    ],
    naoMedidos: [{ predicateId: "y" }, { predicateId: "z" }],
  });
  assert.equal(a, b);
  // residuoTotal igual com distribuição diferente NÃO pode colidir
  const c = vetorResidual({ detalhe: [{ predicateId: "a", residuo: 2 }, { predicateId: "b", residuo: 0 }], naoMedidos: [] });
  const d = vetorResidual({ detalhe: [{ predicateId: "a", residuo: 0 }, { predicateId: "b", residuo: 2 }], naoMedidos: [] });
  assert.notEqual(c, d);
});

test("reentradaMaisAMontante escolhe a fase mais upstream do pipeline", () => {
  // E-CLASSIFY reentra em NORMALIZED (upstream); E-MIGRATION em BEFORE_CAPTURED
  assert.equal(reentradaMaisAMontante(["E-MIGRATION", "E-CLASSIFY"]), "E-CLASSIFY");
  assert.equal(reentradaMaisAMontante(["E-COMPARE"]), "E-COMPARE");
  assert.equal(reentradaMaisAMontante([]), null);
  assert.equal(reentradaMaisAMontante(["NAO-EXISTE"]), null);
});

test("proximoLote incrementa o maior batch-contract visto; run root vazio começa em B0001", () => {
  const runRoot = novoRunRoot();
  assert.equal(proximoLote(runRoot), "B0001");
  escreverArtefato(runRoot, "batch-b1.json", { artifactType: "batch-contract", batchId: "B0001" });
  escreverArtefato(runRoot, "batch-b7.json", { artifactType: "batch-contract", batchId: "B0007" });
  assert.equal(proximoLote(runRoot), "B0008");
});

test("contadoresDe: sem medição sai null (nunca zero); com legado mede tokenizados/restantes", () => {
  const runRoot = novoRunRoot();
  const vazio = contadoresDe(null, runRoot);
  assert.deepEqual(vazio, { tokenizados: null, restantes: null, travados: null });
  escreverArtefato(runRoot, "d1.json", {
    artifactType: "decision", classification: "component-contract", status: "approved",
    proposal: { name: "button.primary.color" }, clusterIds: ["c1"], decidedBy: "deterministic",
  });
  escreverArtefato(runRoot, "d2.json", {
    artifactType: "decision", classification: "requires-human", status: "pending",
    proposal: { name: null }, clusterIds: ["c2"], decidedBy: "deterministic",
  });
  const json = { detalhe: [{ predicateId: "tokens.legacy-vocabulary-zero", residuo: 480, populacao: 3400 }] };
  assert.deepEqual(contadoresDe(json, runRoot), { tokenizados: 2920, restantes: 480, travados: 1 });
});

/* ─────────────────────────────────────────────── o laço com deps fake ────── */

test("cadeia determinística avança transicionando com artefatos achados por TIPO, e para no handoff human de DECIDED", () => {
  const runRoot = novoRunRoot();
  escreverArtefato(runRoot, "occ.ndjson", { artifactType: "design-occurrence" });
  escreverArtefato(runRoot, "axis.json", { artifactType: "axis-discovery" });
  escreverArtefato(runRoot, "norm.ndjson", { artifactType: "normalized-occurrence" });
  escreverArtefato(runRoot, "inv.json", { artifactType: "inventory-report" });
  escreverArtefato(runRoot, "cluster.ndjson", { artifactType: "cluster-packet" });

  const m = maquina("ANCHORED");
  const r = varrer({ root: "/nao-usado", runRoot }, m.deps);

  assert.equal(r.exitCode, 6, "DECIDED é human → handoff");
  assert.deepEqual(
    m.transicoes.map((t) => t.para),
    ["PREFLIGHTED", "INVENTORIED", "NORMALIZED", "CLASSIFIED"]
  );
  const paraInventoried = m.transicoes[1];
  assert.equal(paraInventoried.artefatos.length, 2, "INVENTORIED exige 2 tipos");
  assert.ok(paraInventoried.artefatos.some((p) => p.endsWith("occ.ndjson")));
  assert.ok(paraInventoried.artefatos.some((p) => p.endsWith("axis.json")));
});

test("fase model (MIGRATED) → exit 5, handoff declarado, NENHUMA transição", () => {
  const runRoot = novoRunRoot();
  const m = maquina("BEFORE_CAPTURED");
  const r = varrer({ root: "/x", runRoot }, m.deps);
  assert.equal(r.exitCode, 5);
  assert.equal(m.transicoes.length, 0);
  assert.match(r.motivo, /MIGRATED/);
});

test("execute() reprovado → exit 1 e NENHUMA transição (falha não avança estado)", () => {
  const runRoot = novoRunRoot();
  const m = maquina("ANCHORED");
  m.deps.executar = (f) => ({ phase: f, kind: "deterministic", executed: true, ok: false, steps: [], blocker: "passo quebrou de propósito" });
  const r = varrer({ root: "/x", runRoot }, m.deps);
  assert.equal(r.exitCode, 1);
  assert.equal(m.transicoes.length, 0);
  assert.match(r.motivo, /passo quebrou/);
});

test("artefato exigido pela transição AUSENTE do run root → exit 1, sem transicionar", () => {
  const runRoot = novoRunRoot(); // vazio: INVENTORIED exige design-occurrence
  const m = maquina("PREFLIGHTED");
  const r = varrer({ root: "/x", runRoot }, m.deps);
  assert.equal(r.exitCode, 1);
  assert.equal(m.transicoes.length, 0);
  assert.match(r.motivo, /design-occurrence/);
});

test("REINVENTORIED + residual exit 0 → transiciona COMPLETE com os 4 artefatos exigidos", () => {
  const runRoot = novoRunRoot();
  for (const [nome, tipo] of [
    ["ev.json", "evidence-manifest"],
    ["checks.json", "deterministic-checks"],
    ["adv.json", "adversarial-review"],
    ["proof.json", "final-proof"],
  ]) {
    escreverArtefato(runRoot, nome, { artifactType: tipo });
  }
  const m = maquina("REINVENTORIED");
  m.deps.residual = () => ({ exitCode: 0, json: { medidos: 14, detalhe: [], naoMedidos: [] } });
  const r = varrer({ root: "/x", runRoot }, m.deps);
  assert.equal(r.exitCode, 0);
  assert.equal(m.transicoes[0].para, "COMPLETE");
  assert.equal(m.transicoes[0].artefatos.length, 4);
});

test("TRAVOU (D8): residual exit 3 com vetor IGUAL ao da rodada anterior → exit 3, sem transicionar", () => {
  const runRoot = novoRunRoot();
  const json = {
    detalhe: [{ predicateId: "tokens.legacy-vocabulary-zero", residuo: 480, populacao: 3400 }],
    naoMedidos: [],
    reentradas: ["E-MIGRATION"],
    residuoTotal: 480,
  };
  // rodada anterior registrada no ledger durável com o MESMO vetor
  appendFileSync(
    path.join(runRoot, "progress.ndjson"),
    `${JSON.stringify({ rodada: 2, evento: "nova-rodada", vetorResidual: vetorResidual(json) })}\n`
  );
  const m = maquina("REINVENTORIED");
  m.deps.residual = () => ({ exitCode: 3, json });
  const r = varrer({ root: "/x", runRoot }, m.deps);
  assert.equal(r.exitCode, 3);
  assert.equal(m.transicoes.length, 0, "travou NÃO transiciona");
  assert.equal(r.rodada, 2, "rodada veio do ledger, não da memória");
  assert.match(r.motivo, /Δ=0/);
  assert.deepEqual(r.reentradas, ["E-MIGRATION"], "o handoff diz por onde continuar quando o dono destravar");
});

test("residual exit 3 com vetor DIFERENTE → reentrada dirigida mais a montante e rodada incrementa", () => {
  const runRoot = novoRunRoot();
  escreverArtefato(runRoot, "inv.json", { artifactType: "inventory-report" });
  escreverArtefato(runRoot, "cluster.ndjson", { artifactType: "cluster-packet" });
  const json = {
    detalhe: [{ predicateId: "tokens.legacy-vocabulary-zero", residuo: 100, populacao: 3400 }],
    naoMedidos: [],
    reentradas: ["E-MIGRATION", "E-CLASSIFY"],
    residuoTotal: 100,
  };
  appendFileSync(
    path.join(runRoot, "progress.ndjson"),
    `${JSON.stringify({ rodada: 1, evento: "nova-rodada", vetorResidual: "OUTRO-VETOR" })}\n`
  );
  const m = maquina("REINVENTORIED");
  m.deps.residual = () => ({ exitCode: 3, json });
  const r = varrer({ root: "/x", runRoot }, m.deps);

  // reentra em NORMALIZED (E-CLASSIFY é o mais a montante), segue CLASSIFIED e
  // para no handoff human de DECIDED — uma volta REAL do laço
  assert.equal(m.transicoes[0].para, "NORMALIZED");
  assert.equal(m.transicoes[0].reentrada, "E-CLASSIFY");
  assert.equal(m.transicoes[1].para, "CLASSIFIED");
  assert.equal(r.exitCode, 6);
  assert.equal(r.rodada, 2, "nova rodada contada");
});

test("residual exit 4 (sem medidor) → exit 4: falta capacidade, não volta cega", () => {
  const runRoot = novoRunRoot();
  const m = maquina("REINVENTORIED");
  m.deps.residual = () => ({ exitCode: 4, json: { naoMedidos: [{ predicateId: "x" }] } });
  const r = varrer({ root: "/x", runRoot }, m.deps);
  assert.equal(r.exitCode, 4);
  assert.equal(m.transicoes.length, 0);
});

test("D9: progress.ndjson + progress.md nascem com contadores, rodada e de→para dos decision", () => {
  const runRoot = novoRunRoot();
  escreverArtefato(runRoot, "dec.ndjson", {
    artifactType: "decision", classification: "component-contract", status: "approved",
    proposal: { name: "button.background-color.hover", axis: "color", exception: false },
    clusterIds: ["cluster-hover-1", "cluster-hover-2"], decidedBy: "deterministic",
  });
  const m = maquina("BEFORE_CAPTURED"); // próximo = MIGRATED (model) → handoff com dePara
  const r = varrer({ root: "/x", runRoot }, m.deps);
  assert.equal(r.exitCode, 5);

  const registros = lerProgresso(runRoot);
  assert.equal(registros.length, 1);
  assert.equal(registros[0].evento, "handoff-model");
  assert.equal(registros[0].dePara[0].para, "button.background-color.hover");
  assert.equal(registros[0].dePara[0].de, "cluster-hover-1 + cluster-hover-2");

  assert.ok(existsSync(path.join(runRoot, "progress.md")));
  const md = readFileSync(path.join(runRoot, "progress.md"), "utf8");
  assert.match(md, /\| rodada \|/);
  assert.match(md, /button\.background-color\.hover/);
  assert.match(md, /De → Para/);

  // ausência imprime travessão, nunca zero
  assert.match(renderProgresso([{ rodada: 1, at: "t", evento: "x", fase: null, contadores: {} }]), /— \| — \| — \|/);
});
