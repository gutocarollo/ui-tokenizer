#!/usr/bin/env node
/**
 * sweep — o EXECUTOR do laço, a peça que faltava entre três órgãos prontos.
 *
 * Antes dele: `execute()` rodava fase e ninguém transicionava;
 * `tokenization-runner` transicionava e ninguém o chamava; `evaluate-residual`
 * decidia "continua ou para" com ZERO chamadores (medido 2026-08-03). Este
 * arquivo liga os três — e NADA além disso: ele não reimplementa passo, estado
 * nem medição. Um dono por órgão.
 *
 * O laço (decisões do dono, 2026-08-03):
 *   fase determinística → execute() → transition (runner, in-process)
 *   fase model/human    → PARA com handoff declarado (D5: humano só em baixa
 *                         confiança, depois que a alta esgotar — quem decide o
 *                         corte é a fase, não o driver)
 *   REINVENTORIED       → evaluate-residual:
 *                           exit 0 → COMPLETE
 *                           exit 3 → Δ vs rodada anterior; Δ=0 → TRAVOU (D8,
 *                                    critério de método numérico: entre duas
 *                                    iterações nada mudou → para e pede ajuda);
 *                                    Δ≠0 → reentrada DIRIGIDA pelo código do
 *                                    predicado (a jacobiana), rodada++
 *                           exit 4 → falta MEDIDOR (capacidade, não resíduo)
 *   todo evento         → progress log (D9): de→para, rodada, contadores
 *
 * Uso:
 *   node sweep.mjs --root <app-alvo> --run-root <run> [--max-rodadas N] [--json]
 *
 * Exit codes (vocabulário do laço, não do Unix):
 *   0  COMPLETE alcançado
 *   1  falha real (passo, artefato ausente, transição recusada)
 *   3  TRAVOU (D8): Δ=0 entre duas rodadas consecutivas — pare e pergunte
 *   4  residual com predicado SEM MEDIDOR — pede capacidade nova (L4), não volta
 *   5  handoff MODEL (a LLM precisa olhar/editar antes da próxima transição)
 *   6  handoff HUMAN (decisão do dono) ou corrida PENDING/BLOCKED
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FORWARD_TRANSITIONS,
  PHASES,
  REENTRY_PHASE,
  REQUIRED_TRANSITION_ARTIFACTS,
} from "./lib/artifact-contract.mjs";
import { artefatosPorTipo, execute, executorFor } from "./lib/phase-executors.mjs";
import {
  deParaDasDecisoes,
  fingerprintDoArtefato,
  lerProgresso,
  objetosDoArquivo,
  registrarProgresso,
  tipoDoArtefato,
} from "./lib/progress-log.mjs";
import { runCli } from "./tokenization-runner.mjs";
import { readFileSync, readdirSync } from "node:fs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = fileURLToPath(import.meta.url);

/* ─────────────────────────────────────────────── peças puras (testáveis) ── */

/**
 * Assinatura canônica do vetor de resíduo: pares (predicado, resíduo) medidos
 * + conjunto dos não-medidos, ambos ordenados. `residuoTotal` NÃO serve de
 * assinatura: 2↔0 e 0↔2 somam igual e são estados diferentes.
 */
export function vetorResidual(json) {
  const medidos = (json?.detalhe ?? [])
    .map((m) => [m.predicateId, m.residuo])
    .sort((a, b) => a[0].localeCompare(b[0]));
  const nao = (json?.naoMedidos ?? []).map((n) => n.predicateId).sort();
  return JSON.stringify({ medidos, nao });
}

/**
 * Entre os códigos de reentrada devolvidos pela jacobiana, escolhe o que
 * reentra MAIS A MONTANTE no pipeline — refazer o trecho maior cobre os
 * códigos a jusante; o inverso deixaria resíduo upstream intocado.
 */
export function reentradaMaisAMontante(codigos) {
  return (
    [...(codigos ?? [])]
      .filter((c) => REENTRY_PHASE[c])
      .sort((a, b) => PHASES.indexOf(REENTRY_PHASE[a]) - PHASES.indexOf(REENTRY_PHASE[b]))[0] ?? null
  );
}

/**
 * Todos os artefatos do run root que pertencem à fonte ATIVA.
 *
 * POR QUE NÃO BASTA passar os tipos exigidos pela transição (defeito meu, pego
 * no 1º alvo real): as invariantes do contrato são de CONJUNTO —
 * `design-reconciliation` reconcilia cluster contra ocorrência, `axis-discovery`
 * exige exatamente um artefato de eixo *da fonte ativa*. Passando só
 * `inventory-report` + `cluster-packet`, elas viam ZERO ocorrência e ZERO eixo e
 * recusavam com "Active source design inventory is empty" — o conjunto estava
 * incompleto, não a corrida.
 *
 * Filtrar por fingerprint é OBRIGATÓRIO, não otimização: `commandTransition`
 * lança em qualquer registro cuja fonte divirja (`source-freshness`), então
 * passar artefato de uma rodada anterior derrubaria a transição inteira.
 */
export function artefatosDaFonteAtiva(runRoot, sourceFingerprint) {
  const dir = path.join(runRoot, "artifacts");
  let nomes = [];
  try {
    nomes = readdirSync(dir);
  } catch {
    return [];
  }
  return (
    nomes
      .filter((n) => /\.(json|ndjson)$/.test(n))
      .map((n) => path.join(dir, n))
      // Arquivo SEM `artifactType` não é artefato de contrato (é sumário de
      // apoio, como extraction-summary/normalization-summary). Passá-lo faz
      // `inferArtifactType` lançar "exactly one root artifact type" e derruba a
      // transição por um arquivo que nem participa do contrato.
      .filter((p) => tipoDoArtefato(p) !== null)
      .filter((p) => fingerprintDoArtefato(p) === sourceFingerprint)
  );
}

/** Próximo id de lote: maior B\d{4,} visto nos batch-contract do run root + 1. */
export function proximoLote(runRoot, ler = (p) => readFileSync(p, "utf8")) {
  const achados = artefatosPorTipo(["batch-contract"], runRoot).get("batch-contract") ?? [];
  let maior = 0;
  for (const p of achados) {
    let texto = "";
    try {
      texto = ler(p);
    } catch {
      continue;
    }
    for (const obj of objetosDoArquivo(texto)) {
      const m = /^B(\d{4,})$/.exec(obj?.batchId ?? "");
      if (m) maior = Math.max(maior, Number(m[1]));
    }
  }
  return `B${String(maior + 1).padStart(4, "0")}`;
}

/** Contadores do D9 a partir do que EXISTE — ausência sai null, nunca zero. */
export function contadoresDe(residualJson, runRoot) {
  const legado = (residualJson?.detalhe ?? []).find(
    (m) => m.predicateId === "tokens.legacy-vocabulary-zero"
  );
  const decisoes = artefatosPorTipo(["decision"], runRoot).get("decision") ?? [];
  let vistos = 0;
  let travados = 0;
  for (const p of decisoes) {
    let texto = "";
    try {
      texto = readFileSync(p, "utf8");
    } catch {
      continue;
    }
    for (const o of objetosDoArquivo(texto)) {
      if (o?.artifactType !== "decision") continue;
      vistos += 1;
      if (o.classification === "requires-human" || o.status === "pending") travados += 1;
    }
  }
  return {
    tokenizados: legado ? legado.populacao - legado.residuo : null,
    restantes: legado ? legado.residuo : null,
    travados: vistos ? travados : null,
  };
}

/* ─────────────────────────────────────────────────────── deps reais ──────── */

export function depsReais({ root, runRoot }) {
  return {
    // O contrato de contexto do registro (medido nos exigir() dele):
    // applicationRoot, runRoot, runId, runConfigPath, batchId. Divergir de
    // NOME aqui foi o 1º achado do smoke real; faltar CHAVE foi o 3º — por
    // isso o contexto vem montado pelo laço, por iteração, do status vivo.
    executar: (fase, contexto) => execute(fase, contexto),
    estado: () => runCli(["status", "--root", root, "--run-root", runRoot]),
    transicionar: ({ para, motivo, artefatos = [], reentrada = null, lote = null }) =>
      runCli([
        "transition",
        "--root",
        root,
        "--run-root",
        runRoot,
        "--to",
        para,
        "--reason",
        motivo,
        ...artefatos.flatMap((a) => ["--artifact", a]),
        ...(reentrada ? ["--reentry-code", reentrada] : []),
        ...(lote ? ["--batch", lote] : []),
      ]),
    residual: () => {
      const r = spawnSync(
        process.execPath,
        [
          path.join(AQUI, "evaluate-residual.mjs"),
          "--root",
          root,
          "--run-config",
          path.join(runRoot, "config.json"),
          "--run-root",
          runRoot,
          "--out",
          path.join(runRoot, "artifacts"),
          "--json",
        ],
        { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
      );
      let json = null;
      try {
        json = JSON.parse(r.stdout);
      } catch {
        /* stdout ilegível fica null; o exit code decide */
      }
      return { exitCode: r.status === null ? 127 : r.status, json, stderr: r.stderr ?? "" };
    },
    agora: () => new Date().toISOString(),
  };
}

/* ─────────────────────────────────────────────────────────── o laço ──────── */

const LIMITE_DE_PASSOS = 200;

export function varrer({ root, runRoot, maxRodadas = 50 }, depsInjetadas = {}) {
  const d = { ...depsReais({ root, runRoot }), ...depsInjetadas };

  // Rodada e vetor anterior vêm do LEDGER durável, não da memória do processo:
  // o sweep pode morrer e voltar; progress.ndjson é quem lembra (D9).
  const anteriores = lerProgresso(runRoot);
  let rodada = anteriores.reduce((m, r) => Math.max(m, r.rodada ?? 0), 0) || 1;
  let vetorAnterior =
    [...anteriores].reverse().find((r) => r.vetorResidual)?.vetorResidual ?? null;

  const eventos = [];
  const anotar = (registro) => {
    const completo = { rodada, at: d.agora(), ...registro };
    eventos.push(completo);
    registrarProgresso(runRoot, completo);
    return completo;
  };
  // O de→para do D9 sai dos artefatos `decision` PRESENTES no run root. Ele é
  // anexado nos eventos de FRONTEIRA (handoff, nova rodada, travou) — não em
  // toda transição, senão o ndjson repete a lista inteira a cada passo.
  const dePara = () =>
    deParaDasDecisoes(artefatosPorTipo(["decision"], runRoot).get("decision") ?? []);
  const sair = (exitCode, motivo, extra = {}) => ({
    exitCode,
    motivo,
    rodada,
    eventos,
    ...extra,
  });

  for (let passo = 0; passo < LIMITE_DE_PASSOS; passo++) {
    if (rodada > maxRodadas) {
      anotar({ evento: "limite-de-rodadas", fase: null });
      return sair(1, `limite de ${maxRodadas} rodadas atingido`);
    }

    let st;
    try {
      st = d.estado();
    } catch (e) {
      return sair(1, `estado da corrida ilegível: ${e.message}`);
    }
    const atual = st.phase;

    if (atual === "COMPLETE") return sair(0, "COMPLETE");
    if (atual === "PENDING" || atual === "BLOCKED") {
      anotar({ evento: "corrida-suspensa", fase: atual });
      return sair(6, `corrida em ${atual} — destravar é ato do dono`);
    }

    if (atual === "REINVENTORIED") {
      const r = d.residual();
      if (r.exitCode === 4) {
        anotar({ evento: "residual-sem-medidor", fase: atual, naoMedidos: r.json?.naoMedidos?.length ?? null });
        return sair(4, "residual tem predicado SEM MEDIDOR — falta capacidade (L4), não volta");
      }
      if (r.exitCode === 0) {
        const tipos = REQUIRED_TRANSITION_ARTIFACTS.COMPLETE ?? [];
        const mapa = artefatosPorTipo(tipos, runRoot);
        const faltando = tipos.filter((t) => !(mapa.get(t) ?? []).length);
        if (faltando.length) {
          return sair(1, `resíduo zero, mas COMPLETE exige ${faltando.join(", ")} e o run root não tem`);
        }
        try {
          d.transicionar({
            para: "COMPLETE",
            motivo: `sweep rodada ${rodada}: resíduo zero em ${r.json?.medidos ?? "?"} predicados`,
            artefatos: tipos.map((t) => mapa.get(t)[0]),
          });
        } catch (e) {
          return sair(1, `transição para COMPLETE recusada: ${e.message}`);
        }
        anotar({ evento: "transicao", fase: "COMPLETE", contadores: contadoresDe(r.json, runRoot) });
        continue;
      }
      if (r.exitCode === 3) {
        const vetor = vetorResidual(r.json);
        const contadores = contadoresDe(r.json, runRoot);
        if (vetor === vetorAnterior) {
          anotar({ evento: "travou", fase: atual, vetorResidual: vetor, contadores, dePara: dePara() });
          return sair(3, "TRAVOU (D8): Δ=0 entre duas rodadas consecutivas — parar e pedir ajuda", {
            reentradas: r.json?.reentradas ?? [],
          });
        }
        const codigo = reentradaMaisAMontante(r.json?.reentradas);
        if (!codigo) return sair(1, "resíduo > 0 sem código de reentrada — jacobiana vazia");
        vetorAnterior = vetor;
        rodada += 1;
        try {
          d.transicionar({
            para: REENTRY_PHASE[codigo],
            motivo: `sweep rodada ${rodada}: reentrada dirigida ${codigo} (resíduo ${r.json?.residuoTotal})`,
            reentrada: codigo,
          });
        } catch (e) {
          return sair(1, `reentrada ${codigo} recusada: ${e.message}`);
        }
        anotar({
          evento: "nova-rodada",
          fase: REENTRY_PHASE[codigo],
          vetorResidual: vetor,
          contadores,
          reentrada: codigo,
          dePara: dePara(),
        });
        continue;
      }
      return sair(1, `evaluate-residual saiu com código inesperado ${r.exitCode}: ${r.stderr}`);
    }

    const proxima = (FORWARD_TRANSITIONS[atual] ?? [])[0];
    if (!proxima) return sair(1, `fase ${atual} sem saída no contrato`);

    const entry = executorFor(proxima);
    if (entry.kind !== "deterministic") {
      anotar({ evento: `handoff-${entry.kind}`, fase: proxima, blocker: entry.blocker ?? null, dePara: dePara() });
      return sair(
        entry.kind === "model" ? 5 : 6,
        `fase ${proxima} é ${entry.kind}: ${entry.blocker ?? "exige julgamento fora do driver"}`
      );
    }

    let ex;
    try {
      ex = d.executar(proxima, {
        applicationRoot: root,
        runRoot,
        runId: st.runId,
        runConfigPath: path.join(runRoot, "config.json"),
        ...(st.activeBatchId ? { batchId: st.activeBatchId } : {}),
      });
    } catch (e) {
      // resolveSteps recusa contexto insuficiente LANÇANDO — recusa é saída
      // limpa do driver, nunca stack trace no colo do operador.
      anotar({ evento: "falha-de-fase", fase: proxima, blocker: e.message });
      return sair(1, `contexto/passos de ${proxima} recusados: ${e.message}`);
    }
    if (!ex.ok) {
      const falha = ex.steps?.find((s) => s.exitCode !== 0 && !s.outcome);
      anotar({ evento: "falha-de-fase", fase: proxima, blocker: ex.blocker ?? null });
      return sair(1, ex.blocker ?? `passo falhou em ${proxima}: ${falha?.stderr?.slice(0, 400) ?? "sem stderr"}`);
    }

    const tipos = REQUIRED_TRANSITION_ARTIFACTS[proxima] ?? [];
    const mapa = artefatosPorTipo(tipos, runRoot);
    const faltando = tipos.filter((t) => !(mapa.get(t) ?? []).length);
    if (faltando.length) {
      return sair(1, `transição para ${proxima} exige ${faltando.join(", ")} e o run root não tem`);
    }
    // O conjunto é TODO artefato da fonte ativa (as invariantes são de
    // conjunto), com os tipos exigidos garantidos dentro dele.
    const doConjunto = artefatosDaFonteAtiva(runRoot, st.sourceFingerprint);
    const exigidos = tipos.map((t) => mapa.get(t)[0]);
    const artefatos = [...new Set([...doConjunto, ...exigidos])];
    try {
      d.transicionar({
        para: proxima,
        motivo: `sweep rodada ${rodada}: ${atual}→${proxima}`,
        artefatos,
      });
    } catch (e) {
      // ArtifactContractError carrega a LISTA de violações — engolir e só
      // repassar e.message foi como o 5º achado do smoke ficou opaco.
      const violacoes = e.violations?.slice(0, 5) ?? null;
      anotar({ evento: "transicao-recusada", fase: proxima, violacoes });
      return sair(1, `transição ${atual}→${proxima} recusada pelo contrato: ${e.message}`, {
        violacoes: e.violations ?? null,
      });
    }
    anotar({ evento: "transicao", fase: proxima });
  }
  return sair(1, `limite interno de ${LIMITE_DE_PASSOS} passos — laço girando sem terminar?`);
}

/* ────────────────────────────────────────────────────────────── CLI ──────── */

function argumento(argv, flag, fallback = null) {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || !argumento(argv, "--root") || !argumento(argv, "--run-root")) {
    console.log(
      "sweep.mjs — executa o laço fase a fase até COMPLETE, handoff ou TRAVOU\n\n" +
        "Uso: node sweep.mjs --root <app-alvo> --run-root <run> [--max-rodadas N] [--json]\n" +
        "Exit: 0 COMPLETE · 1 falha · 3 TRAVOU (Δ=0) · 4 sem medidor · 5 handoff model · 6 handoff human"
    );
    process.exit(argv.includes("--help") ? 0 : 1);
  }
  const resultado = varrer({
    root: path.resolve(argumento(argv, "--root")),
    runRoot: path.resolve(argumento(argv, "--run-root")),
    maxRodadas: Number(argumento(argv, "--max-rodadas", "50")),
  });
  if (argv.includes("--json")) {
    console.log(JSON.stringify(resultado, null, 1));
  } else {
    console.log(`sweep: ${resultado.motivo} (rodada ${resultado.rodada}, exit ${resultado.exitCode})`);
    for (const e of resultado.eventos) {
      console.log(`  [r${e.rodada}] ${e.evento}${e.fase ? ` → ${e.fase}` : ""}`);
    }
  }
  process.exit(resultado.exitCode);
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(MODULE_PATH)) {
  main();
}
