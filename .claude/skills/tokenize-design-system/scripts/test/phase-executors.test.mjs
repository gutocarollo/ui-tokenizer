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

import {
  PHASES,
  REQUIRED_TRANSITION_ARTIFACTS,
} from "../lib/artifact-contract.mjs";
import {
  PHASE_EXECUTORS,
  NON_EXECUTABLE_PHASES,
  auditRegistry,
  execute,
  executorFor,
  resolveSteps,
} from "../lib/phase-executors.mjs";

const CTX = {
  applicationRoot: "/tmp/app",
  runRoot: "/tmp/run/tokenize-x",
  runConfigPath: "/tmp/run/tokenize-x/config.json",
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
