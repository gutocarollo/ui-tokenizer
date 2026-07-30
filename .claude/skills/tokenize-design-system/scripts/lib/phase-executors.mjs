/**
 * phase-executors.mjs — liga cada fase do contrato ao que a EXECUTA.
 *
 * O runner durável (`tokenization-runner.mjs`) sabia transicionar e validar
 * artefato, mas nao sabia PRODUZIR nenhum: `transition` exige o artefato ja
 * escrito. Faltava a ponte fase -> comando. Sem ela o control plane rastreava um
 * pipeline que ninguem rodava.
 *
 * A distincao que este registro carrega, e que e o ponto todo:
 *
 *   deterministic — script roda, artefato sai, sem julgamento. Pode ser
 *                   automatizado em loop.
 *   model         — exige a LLM OLHAR (pixel, prosa, contexto). Nao ha script.
 *   human         — exige decisao do dono: padrao concorrente defensavel,
 *                   owner novo, aceite de residuo.
 *
 * `execute` roda `deterministic` e PARA nas outras duas com o motivo explicito.
 * Fingir que uma fase `model` rodou porque um script terminou com exit 0 e
 * exatamente o modo de falha que este projeto ja cometeu: relatorio "limpo"
 * gerado sem ninguem olhar a tela.
 */

/**
 * Cada entrada declara:
 *   kind      — deterministic | model | human
 *   artifacts — os tipos que a fase precisa registrar (espelha
 *               REQUIRED_TRANSITION_ARTIFACTS do artifact-contract)
 *   steps     — comandos, em ordem, para kind=deterministic
 *   blocker   — por que nao e automatizavel, para kind=model|human
 *
 * `steps[].script` e relativo a este diretorio de scripts; `steps[].shell` roda
 * no root do app alvo. Um passo declara `emits` para amarrar comando -> artefato,
 * de modo que um passo que nao emite nada seja um erro de registro, nao um
 * silencio.
 */
export const PHASE_EXECUTORS = Object.freeze({
  ANCHORED: {
    kind: "human",
    artifacts: [],
    blocker:
      "ancorar o pedido verbatim e escopo e ato do dono; o harness grava em .harness/requests/CURRENT-TASK.md",
  },

  PREFLIGHTED: {
    kind: "deterministic",
    artifacts: [],
    steps: [
      { shell: "yarn tokens:build", emits: "token-build" },
      { script: "validate-token-build.mjs", emits: "token-build" },
    ],
  },

  INVENTORIED: {
    kind: "deterministic",
    artifacts: ["design-occurrence", "axis-discovery"],
    steps: [
      { script: "extract-design-occurrences.mjs", emits: "design-occurrence" },
      { script: "discover-axes.mjs", emits: "axis-discovery" },
    ],
  },

  NORMALIZED: {
    kind: "deterministic",
    artifacts: ["normalized-occurrence"],
    steps: [
      // passo 1 (ordem) e passo 2 (equivalencia) do pedido original vivem os
      // dois aqui: normalize-occurrences consome lib/tailwind-normalizer, que
      // emite rawOrderHash + canonicalMultisetFingerprint + canonicalSetFingerprint.
      { script: "normalize-occurrences.mjs", emits: "normalized-occurrence" },
    ],
  },

  CLASSIFIED: {
    kind: "deterministic",
    artifacts: ["inventory-report", "cluster-packet"],
    steps: [
      { script: "inventory-surface.mjs", emits: "inventory-report" },
      { script: "inventory-usage.mjs", emits: "inventory-report" },
      { script: "score-naming.mjs", emits: "inventory-report" },
      { script: "find-owner.mjs", emits: "cluster-packet" },
      { script: "cluster-leftovers.mjs", emits: "cluster-packet" },
    ],
  },

  DECIDED: {
    kind: "human",
    artifacts: ["decision", "batch-contract"],
    blocker:
      "nome de token e escopo do lote sao decisao do dono quando o score fica abaixo do corte ou quando ha padrao concorrente defensavel; derive-tokens.mjs --dtcg prepara a proposta, nao a decide",
  },

  BEFORE_CAPTURED: {
    kind: "deterministic",
    artifacts: ["impacted-context", "scenario", "evidence-manifest"],
    steps: [
      { shell: "node scripts/affected-routes.mjs --json", emits: "impacted-context" },
      { shell: "node scripts/gen-visual-routes.mjs", emits: "scenario" },
      { shell: "bash scripts/ui-evidence.sh", emits: "evidence-manifest" },
      { shell: "node scripts/evidence-manifest.mjs", emits: "evidence-manifest" },
    ],
  },

  MIGRATED: {
    kind: "model",
    artifacts: ["mutation-manifest"],
    blocker:
      "a migracao edita JSX/CSS a partir da decisao do lote; e sequencial e reversivel por construcao, e o manifesto de mutacao precisa registrar exatamente o que mudou",
  },

  BUILT: {
    kind: "deterministic",
    artifacts: ["deterministic-checks"],
    steps: [
      { shell: "yarn tokens:build", emits: "deterministic-checks" },
      { script: "validate-token-build.mjs", emits: "deterministic-checks" },
      { shell: "python3 scripts/ds-naming-law.py", emits: "deterministic-checks" },
      { shell: "python3 scripts/ds-cohesion.py", emits: "deterministic-checks" },
      { shell: "python3 ../.harness/lib/ds-variety.py", emits: "deterministic-checks" },
      { shell: "python3 ../.harness/lib/ds-dead-classes.py", emits: "deterministic-checks" },
      { shell: "bash ../.harness/lib/ds-gate.sh", emits: "deterministic-checks" },
    ],
  },

  AFTER_CAPTURED: {
    kind: "deterministic",
    artifacts: ["evidence-manifest"],
    steps: [
      { shell: "bash scripts/ui-evidence.sh", emits: "evidence-manifest" },
      { shell: "node scripts/evidence-manifest.mjs", emits: "evidence-manifest" },
    ],
  },

  COMPARED: {
    kind: "deterministic",
    artifacts: ["comparison"],
    steps: [
      { shell: "node scripts/compare-evidence.mjs", emits: "comparison" },
      { shell: "node scripts/evidence-report.mjs", emits: "comparison" },
    ],
  },

  REVIEWED: {
    kind: "model",
    artifacts: ["visual-review", "adversarial-review"],
    blocker:
      "visual-review exige Read de cada PNG de antes E de depois; adversarial-review exige subagent isolado. Script nenhum substitui os dois, e um exit 0 aqui seria o relatorio 'limpo' sem ninguem olhar",
  },

  ACCEPTED: {
    kind: "human",
    artifacts: ["acceptance"],
    blocker:
      "aceitar o lote, ou aceitar residuo como pendencia declarada, e do dono",
  },

  REINVENTORIED: {
    kind: "deterministic",
    artifacts: ["design-occurrence", "axis-discovery"],
    steps: [
      { script: "extract-design-occurrences.mjs", emits: "design-occurrence" },
      { script: "discover-axes.mjs", emits: "axis-discovery" },
    ],
  },

  COMPLETE: {
    kind: "deterministic",
    artifacts: [
      "evidence-manifest",
      "deterministic-checks",
      "adversarial-review",
      "final-proof",
    ],
    steps: [
      { script: "evaluate-absolute-completion.mjs", emits: "final-proof" },
    ],
  },
});

/** Fases terminais de excecao: nao se "executam", se declaram. */
export const NON_EXECUTABLE_PHASES = Object.freeze(["PENDING", "BLOCKED"]);

export function executorFor(phase) {
  if (NON_EXECUTABLE_PHASES.includes(phase)) {
    return {
      kind: "terminal",
      artifacts: [],
      blocker: `${phase} e estado declarado, nao executavel`,
    };
  }
  const entry = PHASE_EXECUTORS[phase];
  if (!entry) throw new Error(`Fase sem executor registrado: ${phase}`);
  return entry;
}

/**
 * Consistencia do registro contra o contrato — chamada pelo teste.
 *
 * Guarda contra o furo mais provavel deste arquivo: alguem adiciona uma fase no
 * artifact-contract e esquece aqui, e o `execute` passa a estourar em runtime
 * numa fase que o loop ja alcancou.
 */
export function auditRegistry({ phases, requiredArtifacts }) {
  const problemas = [];
  for (const phase of phases) {
    if (NON_EXECUTABLE_PHASES.includes(phase)) continue;
    const entry = PHASE_EXECUTORS[phase];
    if (!entry) {
      problemas.push(`fase sem executor: ${phase}`);
      continue;
    }
    const exigidos = requiredArtifacts[phase] ?? [];
    const declarados = entry.artifacts ?? [];
    for (const a of exigidos) {
      if (!declarados.includes(a)) {
        problemas.push(`${phase}: artefato exigido pelo contrato e nao declarado: ${a}`);
      }
    }
    for (const a of declarados) {
      if (exigidos.length && !exigidos.includes(a)) {
        problemas.push(`${phase}: artefato declarado que o contrato nao exige: ${a}`);
      }
    }
    if (entry.kind === "deterministic") {
      if (!entry.steps?.length) problemas.push(`${phase}: deterministic sem steps`);
      for (const s of entry.steps ?? []) {
        if (!s.emits) problemas.push(`${phase}: step sem 'emits' (comando que nao amarra artefato)`);
        if (!s.script && !s.shell) problemas.push(`${phase}: step sem script nem shell`);
      }
    } else if (!entry.blocker) {
      problemas.push(`${phase}: kind=${entry.kind} sem blocker declarado`);
    }
  }
  return problemas;
}
