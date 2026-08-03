/**
 * O REGISTRO DE EXECUTORES NÃO TINHA TESTE — e `auditRegistry` diz, na própria
 * docstring, que é "chamada pelo teste". Não era chamada por ninguém.
 *
 * É a mesma doença que este arquivo passou o dia inteiro consertando em outros
 * lugares: guard escrito, guard exportado, guard sem caller. Um registro que
 * ninguém audita diverge do contrato em silêncio, e o `execute` estoura em
 * runtime numa fase que o laço já alcançou — três camadas depois da causa.
 *
 * O que cada caso protege:
 *   1. o registro bate com o contrato (fase por fase, artefato por artefato);
 *   2. `model`/`human` NÃO executam e devolvem o motivo — o coração do arquivo;
 *   3. a execução para no primeiro passo que falha;
 *   4. comando inexistente conta como FALHA, não como sucesso;
 *   5. contexto incompleto estoura na montagem, antes de qualquer efeito;
 *   6. nenhum passo tem argv implícito.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  PHASES,
  REQUIRED_TRANSITION_ARTIFACTS,
} from "../lib/artifact-contract.mjs";
import {
  PHASE_EXECUTORS,
  NON_EXECUTABLE_PHASES,
  artefatosPorTipo,
  auditRegistry,
  execute,
  executorFor,
  resolveSteps,
} from "../lib/phase-executors.mjs";

/*
 * O contexto precisa de um RUN ROOT DE VERDADE, porque o passo de impacto lê o
 * batch-contract do disco para saber quais arquivos o lote vai tocar.
 *
 * Isso é deliberado: antes da mutação o diff da worktree está vazio POR
 * DEFINIÇÃO, e um impacted-context derivado dele afirmaria que o lote não afeta
 * nada. Os arquivos afetados são os PLANEJADOS, e quem os declara é o lote.
 * Logo o teste declara um lote, em vez de o código aceitar a ausência dele.
 */
const RUN_ROOT = mkdtempSync(path.join(os.tmpdir(), "phase-exec-"));
mkdirSync(path.join(RUN_ROOT, "artifacts"), { recursive: true });
writeFileSync(
  path.join(RUN_ROOT, "artifacts", "batch-B0001.json"),
  JSON.stringify({
    artifactType: "batch-contract",
    batchId: "B0001",
    plannedFiles: ["src/components/Button/index.jsx", "src/pages/Home/index.jsx"],
  })
);

/*
 * O run-config precisa EXISTIR no fixture, porque três argumentos vêm dele e de
 * mais ninguém: `--source-roots`, `--toolchain-fingerprint` e
 * `--configured-axes`. Medido em 2026-08-03 (1º smoke real): quando o passo
 * usava o default do próprio script em vez da âncora, o censo varria pasta
 * inexistente e `toolchain-freshness` recusava TODA transição. A âncora é o
 * dono desses três; o fixture declara um, em vez de o código aceitar a ausência.
 */
writeFileSync(
  path.join(RUN_ROOT, "config.json"),
  JSON.stringify({
    artifactType: "run-config",
    runId: "tokenize-x",
    sourceRoots: ["src"],
    toolchainFingerprint: "f".repeat(64),
    axisRegistry: [{ axis: "color" }, { axis: "spacing" }],
  })
);

const CTX = {
  applicationRoot: "/tmp/app",
  runRoot: RUN_ROOT,
  runConfigPath: path.join(RUN_ROOT, "config.json"),
  runId: "tokenize-x",
  batchId: "B0001",
};

test("o registro de executores concorda com o contrato, fase por fase", () => {
  const problemas = auditRegistry({
    phases: PHASES,
    requiredArtifacts: REQUIRED_TRANSITION_ARTIFACTS,
  });
  assert.deepEqual(
    problemas,
    [],
    "fase nova no contrato sem executor aqui vira erro de runtime lá na frente"
  );
});

test("toda fase do contrato tem executor, e só PENDING/BLOCKED são não-executáveis", () => {
  for (const phase of PHASES) {
    if (NON_EXECUTABLE_PHASES.includes(phase)) {
      assert.equal(executorFor(phase).kind, "terminal", phase);
      continue;
    }
    assert.ok(PHASE_EXECUTORS[phase], `fase sem executor: ${phase}`);
  }
});

test("model e human NÃO executam — devolvem executed:false com o motivo", () => {
  /*
   * O ponto todo do arquivo. Fingir que uma fase `model` rodou porque um script
   * terminou com exit 0 é o modo de falha que este projeto já cometeu:
   * relatório "limpo" gerado sem ninguém olhar a tela.
   */
  const naoDeterministicas = Object.entries(PHASE_EXECUTORS).filter(
    ([, e]) => e.kind !== "deterministic"
  );
  assert.ok(naoDeterministicas.length >= 4, "MIGRATED, REVIEWED, DECIDED, ACCEPTED no mínimo");
  for (const [phase] of naoDeterministicas) {
    const r = execute(phase, CTX, {
      run: () => assert.fail(`${phase} não pode chegar a rodar comando`),
    });
    assert.equal(r.executed, false, phase);
    assert.equal(r.ok, false, `${phase}: ausência de execução não pode virar ok`);
    assert.ok(r.blocker && r.blocker.length > 20, `${phase} sem motivo escrito`);
    assert.deepEqual(r.steps, [], phase);
  }
});

test("a execução para no primeiro passo que falha", () => {
  const rodados = [];
  const r = execute("CLASSIFIED", CTX, {
    run: (passo) => {
      rodados.push(passo.index);
      return { exitCode: passo.index === 1 ? 3 : 0, stdout: "", stderr: "" };
    },
  });
  assert.equal(r.ok, false);
  assert.deepEqual(rodados, [0, 1], "o passo 2 em diante não pode rodar");
  assert.equal(r.steps.at(-1).exitCode, 3);
});

test("comando inexistente conta como falha, nunca como sucesso", () => {
  /*
   * `spawnSync` devolve status null quando o binário não existe ou o processo
   * morre por sinal. Tratar null como 0 faria um comando AUSENTE passar — o
   * silêncio exato que este registro existe para impedir.
   */
  const r = execute("PREFLIGHTED", {
    ...CTX,
    scriptsDir: "/tmp",
    processRoot: "/tmp",
    // primeiro passo é `yarn tokens:build`; forçamos um binário impossível
  }, {
    run: (passo) => ({ exitCode: passo.index === 0 ? 127 : 0, stdout: "", stderr: "ENOENT" }),
  });
  assert.equal(r.ok, false);
  assert.equal(r.steps[0].exitCode, 127);
});

test("contexto incompleto estoura na MONTAGEM, antes de qualquer efeito", () => {
  /*
   * Montar tudo antes de rodar qualquer coisa é o que impede o pipeline de
   * morrer no meio com metade dos artefatos escritos.
   */
  assert.throws(
    () => resolveSteps("BEFORE_CAPTURED", { applicationRoot: "/tmp/app" }),
    /contexto insuficiente/
  );
  // Lote sem `plannedFiles` é lote que não declara o que vai tocar: o impacto
  // dele não é verificável, e isso tem de estourar aqui, não virar captura vazia.
  const semLote = mkdtempSync(path.join(os.tmpdir(), "phase-exec-vazio-"));
  mkdirSync(path.join(semLote, "artifacts"), { recursive: true });
  writeFileSync(
    path.join(semLote, "artifacts", "batch-B0001.json"),
    JSON.stringify({ artifactType: "batch-contract", batchId: "B0001", plannedFiles: [] })
  );
  assert.throws(
    () => resolveSteps("BEFORE_CAPTURED", { ...CTX, runRoot: semLote }),
    /sem plannedFiles/
  );
  assert.throws(
    () => resolveSteps("INVENTORIED", { runRoot: "/tmp/run" }),
    /falta applicationRoot/
  );
});

test("nenhum passo tem argv implícito, e todo caminho resolvido é absoluto", () => {
  for (const [phase, entry] of Object.entries(PHASE_EXECUTORS)) {
    if (entry.kind !== "deterministic") continue;
    const passos = resolveSteps(phase, CTX);
    assert.equal(passos.length, entry.steps.length, phase);
    for (const passo of passos) {
      assert.ok(Array.isArray(passo.argv), `${phase}/${passo.index}`);
      assert.ok(passo.emits, `${phase}/${passo.index} sem emits`);
      assert.ok(passo.cwd.startsWith("/"), `${phase}/${passo.index} cwd relativo`);
      // Nenhum argumento pode carregar um placeholder não substituído: é assim
      // que um caminho vira literal e a raiz volta a ficar cravada.
      for (const a of passo.argv) {
        assert.doesNotMatch(String(a), /\$\{|undefined|\[object/, `${phase}: argv suspeito ${a}`);
      }
    }
  }
});

test("a fase de referência e a de mutação pedem fases DIFERENTES ao preparador", () => {
  /*
   * `before` compara contra a âncora e exige que a fonte não tenha andado;
   * `after` mede depois da mutação, onde divergir é o esperado. Trocar as duas
   * faria a captura de referência aceitar chão movediço — ou a de depois
   * reprovar toda migração bem-sucedida.
   */
  const fase = (nome) =>
    resolveSteps(nome, CTX)
      .map((p) => p.argv)
      .find((argv) => argv.includes("--phase"));
  assert.equal(fase("BEFORE_CAPTURED")[fase("BEFORE_CAPTURED").indexOf("--phase") + 1], "before");
  assert.equal(fase("AFTER_CAPTURED")[fase("AFTER_CAPTURED").indexOf("--phase") + 1], "after");
});

test("COMPARED usa o comparador do processo e o batch-contract como policy única", () => {
  const [passo] = resolveSteps("COMPARED", CTX);
  assert.equal(passo.command, process.execPath);
  assert.equal(
    passo.argv[0],
    path.resolve("scripts/compare-evidence.mjs")
  );
  assert.equal(
    passo.argv[passo.argv.indexOf("--policy") + 1],
    path.join(RUN_ROOT, "artifacts", "batch-B0001.json")
  );
  assert.equal(
    passo.argv[passo.argv.indexOf("--out") + 1],
    path.join(RUN_ROOT, "artifacts", "B0001", "comparison.json")
  );
  assert.equal(
    passo.argv[passo.argv.indexOf("--scenarios") + 1],
    path.join(RUN_ROOT, "artifacts", "scenarios-B0001.ndjson")
  );
  assert.equal(passo.outcomes[3], "comparacao deterministica concluida; revisao visual ainda obrigatoria");
});

test("o reinventário NÃO escreve por cima do inventário inicial", () => {
  /*
   * O laço de resíduo COMPARA os dois. Sobrescrever a origem apagaria o termo de
   * comparação e a iteração passaria a convergir contra si mesma — sempre
   * "estável", sempre errada.
   */
  const saida = (nome) => {
    const argv = resolveSteps(nome, CTX)[0].argv;
    return argv[argv.indexOf("--out") + 1];
  };
  assert.notEqual(saida("REINVENTORIED"), saida("INVENTORIED"));
  assert.match(saida("REINVENTORIED"), /reinventory/);
});

test("COMPLETE passa as duas raízes obrigatórias ao avaliador absoluto", () => {
  const [passo] = resolveSteps("COMPLETE", CTX);
  assert.equal(
    passo.argv[passo.argv.indexOf("--root") + 1],
    CTX.applicationRoot
  );
  assert.equal(
    passo.argv[passo.argv.indexOf("--run-root") + 1],
    CTX.runRoot
  );
  assert.equal(
    passo.argv[passo.argv.indexOf("--out") + 1],
    path.join(CTX.runRoot, "final-proof.json")
  );
});

test("scanner de artefatos alcança lotes aninhados, final/ e final-proof canônico", () => {
  const runRoot = mkdtempSync(path.join(os.tmpdir(), "phase-exec-topology-"));
  mkdirSync(path.join(runRoot, "artifacts", "B0001"), { recursive: true });
  mkdirSync(path.join(runRoot, "final"), { recursive: true });
  writeFileSync(
    path.join(runRoot, "artifacts", "B0001", "comparison.json"),
    JSON.stringify({ artifactType: "comparison" })
  );
  writeFileSync(
    path.join(runRoot, "final", "evidence-manifest.json"),
    JSON.stringify({ artifactType: "evidence-manifest" })
  );
  writeFileSync(
    path.join(runRoot, "final", "review.json"),
    JSON.stringify({
      artifactType: "adversarial-review",
      reviewedArtifactRefs: [
        { artifactType: "evidence-manifest", path: "final/evidence-manifest.json" },
      ],
    }, null, 2)
  );
  writeFileSync(
    path.join(runRoot, "final-proof.json"),
    JSON.stringify({ artifactType: "final-proof" })
  );
  const found = artefatosPorTipo(
    ["comparison", "evidence-manifest", "final-proof"],
    runRoot
  );
  assert.equal(found.get("comparison").length, 1);
  assert.equal(found.get("evidence-manifest").length, 1);
  assert.equal(found.get("final-proof").length, 1);
});

test("fase que declara emitir artefato e não emite NÃO pode devolver ok", () => {
  /*
   * `emits` era comentário. Medido em 2026-08-02: CLASSIFIED devolveu `ok=true`
   * com o run root sem `cluster-packet` e sem `inventory-report`, porque os
   * cinco passos daquela fase só imprimiam JSON no stdout — o produtor de
   * verdade (`context-clusters --emit-artifacts`) nem estava no registro.
   *
   * Sucesso silencioso sobre nada é a classe de defeito que este arquivo existe
   * para impedir, então a promessa passa a ser conferida no run root.
   */
  const vazio = mkdtempSync(path.join(os.tmpdir(), "phase-exec-semart-"));
  mkdirSync(path.join(vazio, "artifacts"), { recursive: true });
  writeFileSync(
    path.join(vazio, "artifacts", "batch-B0001.json"),
    JSON.stringify({ artifactType: "batch-contract", batchId: "B0001", plannedFiles: ["a.jsx"] })
  );
  const r = execute("CLASSIFIED", { ...CTX, runRoot: vazio }, {
    run: () => ({ exitCode: 0, stdout: "{}", stderr: "" }),
  });
  assert.equal(r.ok, false, "todos os passos saíram 0, mas nada foi emitido");
  assert.deepEqual(r.missingArtifacts.sort(), ["cluster-packet", "inventory-report"]);
  assert.match(r.blocker, /run root não tem nenhum registro/);
});

test("a verificação é por CONTEÚDO do artefato, não por nome de arquivo", () => {
  // Arquivo com o nome certo e o tipo errado tem de continuar faltando: conferir
  // nome aceitaria um arquivo vazio batizado corretamente.
  const dir = mkdtempSync(path.join(os.tmpdir(), "phase-exec-conteudo-"));
  mkdirSync(path.join(dir, "artifacts"), { recursive: true });
  writeFileSync(
    path.join(dir, "artifacts", "batch-B0001.json"),
    JSON.stringify({ artifactType: "batch-contract", batchId: "B0001", plannedFiles: ["a.jsx"] })
  );
  writeFileSync(path.join(dir, "artifacts", "cluster-packets.ndjson"), "");
  writeFileSync(path.join(dir, "artifacts", "inventory-ownerless.json"), "{}");
  const semConteudo = execute("CLASSIFIED", { ...CTX, runRoot: dir }, {
    run: () => ({ exitCode: 0, stdout: "", stderr: "" }),
  });
  assert.equal(semConteudo.ok, false, "nome certo, conteúdo vazio: continua faltando");

  writeFileSync(
    path.join(dir, "artifacts", "cluster-packets.ndjson"),
    JSON.stringify({ artifactType: "cluster-packet", clusterId: "c-1" }) + "\n"
  );
  writeFileSync(
    path.join(dir, "artifacts", "inventory-ownerless.json"),
    JSON.stringify({ artifactType: "inventory-report", kind: "ownerless" })
  );
  const comConteudo = execute("CLASSIFIED", { ...CTX, runRoot: dir }, {
    run: () => ({ exitCode: 0, stdout: "", stderr: "" }),
  });
  assert.equal(comConteudo.ok, true, "com os dois tipos presentes, a fase fecha");
});
