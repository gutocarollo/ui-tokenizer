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

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { dispensaDeClusterPacket } from "./artifact-contract.mjs";

/** Diretório dos scripts da skill, derivado deste arquivo (lib/ -> scripts/). */
const DEFAULT_SCRIPTS_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);

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
/*
 * O ARGV DE CADA PASSO, e por que ele é uma FUNÇÃO do contexto.
 *
 * Um comando gravado como string pronta (`"node extract.mjs --root frontend"`)
 * congela dois valores que mudam por corrida: a raiz do app medido e o
 * diretório da corrida. Foi assim que a camada visual inteira ficou inalcançável
 * até 2026-08-01 — raiz cravada no arquivo. Aqui o passo declara COMO montar o
 * argv, e quem executa fornece o contexto; nenhum caminho é literal.
 *
 * O contexto mínimo é `{ applicationRoot, runRoot, runConfigPath, batchId }`.
 * Um passo que precise de algo ausente falha ALTO na montagem, antes de rodar
 * qualquer coisa — erro de fiação não deve virar erro de execução três camadas
 * adiante.
 */
const artefatos = (ctx) => `${ctx.runRoot}/artifacts`;

/** `--root <app>` mais o resto. Cinco scripts da fase CLASSIFIED leem a raiz por
 *  `resolveRoot()`, que sem a flag cai no `cwd` — e o `cwd` do executor nao e o
 *  app medido. */
function comRaiz(ctx, rotulo, extras = []) {
  exigir(ctx, ["applicationRoot"], rotulo);
  return ["--root", ctx.applicationRoot, ...extras];
}

function exigir(ctx, campos, rotulo) {
  const faltando = campos.filter((c) => !ctx?.[c]);
  if (faltando.length) {
    throw new Error(
      `contexto insuficiente para ${rotulo}: falta ${faltando.join(", ")}`
    );
  }
}

/**
 * Argumentos que pertencem ao RUN-CONFIG, o dono ancorado (4º e 5º achados do
 * 1º smoke real, 2026-08-03, os dois da mesma família "dois donos"):
 *
 * - `--source-roots`: o extrator tem default próprio ("src") — a âncora dizia
 *   `app` e o censo varria pasta inexistente.
 * - `--toolchain-fingerprint`: o extrator DETECTA um por algoritmo próprio,
 *   diferente do da âncora — `toolchain-freshness` recusava TODA transição.
 *   O override é a interface que o próprio extrator declara para orquestrador
 *   (extract-design-occurrences.mjs, "Header override supplied by an
 *   orchestrator"); o valor único vem do config.
 * - `--source-fingerprint`: idem, e é a 8ª ocorrência da família dominante
 *   deste projeto (dois donos de um nome). Medido 2026-08-03: a âncora
 *   recalcula `b755f954…` de forma ESTÁVEL sobre as mesmas raízes, e o
 *   `fingerprintFiles` interno do extrator devolve `8fa03f67…` — composições
 *   de hash diferentes, não duas medições legítimas. Isso quebrava a fase
 *   seguinte, cujos produtores usam o valor do run-config: metade da cadeia
 *   assinava com um valor e metade com outro. A âncora é a dona por definição
 *   ("corrida ancorada"); mudança real de fonte se trata RE-ANCORANDO, que
 *   troca o runId, não deixando cada passo medir por conta.
 *
 * Config ilegível LANÇA — recusa visível, nunca censo com identidade errada.
 */
function sourceRootsDoConfig(ctx) {
  const cfg = JSON.parse(readFileSync(ctx.runConfigPath, "utf8"));
  const roots = cfg?.sourceRoots;
  return [
    ...(Array.isArray(roots) && roots.length ? ["--source-roots", roots.join(",")] : []),
    ...(cfg?.toolchainFingerprint ? ["--toolchain-fingerprint", cfg.toolchainFingerprint] : []),
    ...(cfg?.sourceFingerprint ? ["--source-fingerprint", cfg.sourceFingerprint] : []),
  ];
}

/**
 * `--configured-axes` idem (6º achado, mesma família): o discover-axes tem um
 * registro DEFAULT de 13 eixos; o contrato compara `configuredAxes` com o
 * `axisRegistry` ANCORADO — divergiu, recusa. Eixo descoberto fora do registro
 * ancorado cai em `uncoveredAxes` (declarado satisfaz o contrato).
 */
function eixosDoConfig(ctx) {
  const cfg = JSON.parse(readFileSync(ctx.runConfigPath, "utf8"));
  // axisRegistry é LISTA de entradas { axis, tokenTypes, validator, ... } —
  // Object.keys numa lista devolve índices ("0,1,2,3"), o 7º achado do smoke.
  const eixos = (Array.isArray(cfg?.axisRegistry) ? cfg.axisRegistry : [])
    .map((e) => e?.axis)
    .filter(Boolean);
  return eixos.length ? ["--configured-axes", eixos.join(",")] : [];
}

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
      /*
       * Um passo só, ciente de alvo VIRGEM (1º smoke real, 2026-08-03). O
       * anterior cravava `yarn tokens:build`: gerenciador de UM alvo (a
       * cobaia usa npm) e alvo sem pipeline falhava como quebra de ambiente.
       * `preflight-tokens.mjs` detecta o gerenciador pelo lockfile, roda
       * build+validação quando o pipeline existe, e declara VIRGEM (exit 2)
       * quando não existe — censo/classificação não precisam de tokens; o
       * scaffold nasce no 1º lote. Pipeline PARCIAL continua exit 1.
       */
      {
        script: "preflight-tokens.mjs",
        args: (ctx) => comRaiz(ctx, "preflight-tokens"),
        emits: "token-build",
        outcomes: {
          2: "alvo VIRGEM — sem pipeline de tokens; censo segue, scaffold nasce no 1º lote (MIGRATED)",
        },
      },
    ],
  },

  INVENTORIED: {
    kind: "deterministic",
    artifacts: ["design-occurrence", "axis-discovery"],
    steps: [
      {
        script: "extract-design-occurrences.mjs",
        args: (ctx) => {
          exigir(ctx, ["applicationRoot", "runRoot", "runId", "runConfigPath"], "extract-design-occurrences");
          return ["--root", ctx.applicationRoot, "--out", artefatos(ctx), "--run-id", ctx.runId, ...sourceRootsDoConfig(ctx)];
        },
        /*
         * EXIT 2 NAO E FALHA, e a distincao esta no proprio extrator:
         *   1 = falha real (inventario vazio, scanner quebrado);
         *   2 = artefatos ESCRITOS, com ocorrencia opaca a reconciliar adiante;
         *   0 = limpo.
         * Medido no alvo: 762 opacas de 13.869 — resíduo conhecido, que o laco
         * global (`evaluate-residual`) ja mede como predicado. Tratar 2 como
         * falha para o pipeline num ponto em que ele NAO falhou; tratar como 0
         * apagaria o residuo. Por isso o desfecho e declarado com significado e
         * fica GRAVADO no resultado do passo.
         */
        outcomes: { 2: "ocorrencias opacas a reconciliar; artefatos escritos" },
        emits: "design-occurrence",
      },
      {
        script: "discover-axes.mjs",
        args: (ctx) => {
          exigir(ctx, ["runRoot", "runConfigPath"], "discover-axes");
          return [
            "--occurrences", `${artefatos(ctx)}/design-occurrences.ndjson`,
            "--extraction-summary", `${artefatos(ctx)}/extraction-summary.json`,
            "--out", `${artefatos(ctx)}/axis-discovery.json`,
            ...eixosDoConfig(ctx),
          ];
        },
        // Mesmo vocabulário do extrator: 2 = artefato escrito, eixo sem cobertura
        // DECLARADO em `uncoveredAxes` (o contrato aceita declarar; exige só que
        // nenhum eixo descoberto fique sem contrato nem sem registro).
        outcomes: { 2: "eixo descoberto sem cobertura, declarado em uncoveredAxes" },
        emits: "axis-discovery",
      },
    ],
  },

  NORMALIZED: {
    kind: "deterministic",
    artifacts: ["normalized-occurrence"],
    steps: [
      // passo 1 (ordem) e passo 2 (equivalencia) do pedido original vivem os
      // dois aqui: normalize-occurrences consome lib/tailwind-normalizer, que
      // emite rawOrderHash + canonicalMultisetFingerprint + canonicalSetFingerprint.
      {
        script: "normalize-occurrences.mjs",
        args: (ctx) => {
          exigir(ctx, ["applicationRoot", "runRoot"], "normalize-occurrences");
          return [
            "--root", ctx.applicationRoot,
            "--input", `${artefatos(ctx)}/design-occurrences.ndjson`,
            "--out", artefatos(ctx),
          ];
        },
        /*
         * Mesmo vocabulário: 2 = normalizou tudo e sobrou opaco a reconciliar.
         * Medido nesta corrida: 7356/7356 classes, valid=6355, opaque=1001,
         * invalid=0, truncated=0, compilador do ALVO. Nada falhou — `invalid` e
         * `truncated` zerados são a prova; `opaque` é classe que o compilador
         * não resolve a um valor físico, e o laço de resíduo já a mede.
         */
        outcomes: { 2: "classes opacas a reconciliar; normalização completa" },
        emits: "normalized-occurrence",
      },
    ],
  },

  CLASSIFIED: {
    kind: "deterministic",
    artifacts: ["inventory-report", "cluster-packet"],
    steps: [
      /*
       * OS CINCO PRECISAM DE `--root`, e isso foi medido, nao presumido: rodar
       * `inventory-surface.mjs --json` sem raiz falhou com *"No source root
       * found under .../scripts"* — sem `--root`, `resolveRoot()`
       * (lib/paths.mjs) cai no `cwd`, que aqui e o diretorio dos scripts da
       * skill, nao o app medido. A primeira versao deste registro passava so
       * `--json` e todos os cinco morreriam no mesmo ponto.
       */
      { script: "inventory-surface.mjs", args: (ctx) => comRaiz(ctx, "inventory-surface", ["--json"]), emits: "inventory-report" },
      { script: "inventory-usage.mjs", args: (ctx) => comRaiz(ctx, "inventory-usage"), emits: "inventory-report" },
      { script: "score-naming.mjs", args: (ctx) => comRaiz(ctx, "score-naming", ["--json"]), emits: "inventory-report" },
      { script: "find-owner.mjs", args: (ctx) => comRaiz(ctx, "find-owner", ["--json"]), emits: "cluster-packet" },
      { script: "cluster-leftovers.mjs", args: (ctx) => comRaiz(ctx, "cluster-leftovers", ["--json"]), emits: "cluster-packet" },
      {
        /*
         * O PRODUTOR DE VERDADE, e ele faltava.
         *
         * Os cinco passos acima ANALISAM e imprimem JSON no stdout; nenhum
         * escreve artefato no run root. Medido em 2026-08-02: a fase reportou
         * `ok=true` e o run root ficou sem `cluster-packets.ndjson` e sem
         * `inventory-ownerless.json` — sucesso silencioso sobre nada, que é
         * exatamente o que este arquivo existe para impedir.
         *
         * `--emit-artifacts` mora dentro de `context-clusters` de propósito: o
         * `cluster-packet` exige `occurrenceIds` COMPLETO, e a saída `--json`
         * trunca em 6 por cluster. Um emissor externo teria de reprocessar tudo
         * ou emitir lista mutilada com cara de completa.
         */
        script: "context-clusters.mjs",
        args: (ctx) => {
          exigir(ctx, ["applicationRoot", "runConfigPath", "runRoot"], "context-clusters");
          return ["--root", ctx.applicationRoot, "--all",
                  "--emit-artifacts", artefatos(ctx),
                  "--run-config", ctx.runConfigPath];
        },
        emits: "cluster-packet",
      },
    ],
  },

  DECIDED: {
    kind: "model",
    artifacts: ["decision", "batch-contract"],
    blocker:
      "processar primeiro todos os clusters confidence.band=high e congelar um lote reversível; só confidence.band=low, após a fila alta zerar, pode escalar ao dono",
  },

  BEFORE_CAPTURED: {
    kind: "deterministic",
    artifacts: ["impacted-context", "scenario", "evidence-manifest"],
    steps: [
      {
        /*
         * OS ARQUIVOS VÊM DO LOTE, NÃO DO GIT — e isso é da natureza da fase.
         *
         * `affected-routes` sem argumento lê o diff da worktree e, na captura de
         * REFERÊNCIA, o diff está vazio por definição: a mutação ainda não
         * aconteceu. Medido: `exit=3, emptyChangeSet: true`. Aceitar isso com
         * `--allow-empty` gravaria um impacted-context afirmando que o lote não
         * afeta nada — a alegação exatamente oposta à verdade.
         *
         * Antes da mutação, os arquivos afetados são os PLANEJADOS, e quem os
         * declara é o batch-contract. Ler o lote aqui evita que cada chamador
         * precise saber disso; é estado durável da própria corrida.
         *
         * `--allow-gaps` é deliberado e tem causa única medida no alvo:
         * `/accept-invite/:code` não tem fixture porque o parâmetro é um código
         * de convite de uso único (`reasonCode: sensitive-ephemeral-fixture`).
         * Não é descuido, é exclusão estrutural — e ela fica GRAVADA em
         * `fixtureGaps` dentro do artefato, então a cobertura incompleta é
         * declarada, não escondida.
         */
        script: "../../../../scripts/affected-routes.mjs",
        args: (ctx) => {
          exigir(
            ctx,
            ["applicationRoot", "runRoot", "runConfigPath", "batchId"],
            "affected-routes"
          );
          const lote = JSON.parse(
            readFileSync(`${artefatos(ctx)}/batch-${ctx.batchId}.json`, "utf8")
          );
          const planejados = lote.plannedFiles ?? [];
          if (!planejados.length) {
            throw new Error(
              `batch ${ctx.batchId} sem plannedFiles — um lote que não declara o que vai tocar não tem impacto verificável`
            );
          }
          return [
            "--root", ctx.applicationRoot,
            "--files", planejados.join(","),
            "--json",
            "--allow-gaps",
            "--run-config", ctx.runConfigPath,
            "--batch-contract", `${artefatos(ctx)}/batch-${ctx.batchId}.json`,
            "--batch-id", ctx.batchId,
            "--emit-artifact", `${artefatos(ctx)}/impacted-${ctx.batchId}.json`,
          ];
        },
        emits: "impacted-context",
      },
      {
        script: "../../../../scripts/gen-visual-routes.mjs",
        args: (ctx) => {
          exigir(
            ctx,
            ["applicationRoot", "runRoot", "runConfigPath", "batchId"],
            "gen-visual-routes"
          );
          return [
            "--root", ctx.applicationRoot,
            "--json",
            "--run-config", ctx.runConfigPath,
            "--batch-contract", `${artefatos(ctx)}/batch-${ctx.batchId}.json`,
            "--emit-scenarios", `${artefatos(ctx)}/scenarios-${ctx.batchId}.ndjson`,
          ];
        },
        emits: "scenario",
      },
      {
        /*
         * UM PASSO, nao cinco. A primeira versao deste registro decompunha a
         * captura em prepare + playwright + manifesto, e estava errada em duas
         * frentes MEDIDAS ao ler `ui-evidence.sh`:
         *
         *   1. ele JA orquestra os tres — prepara a selecao, roda a matriz,
         *      monta o evidence-manifest fail-closed e promove o diretorio
         *      ATOMICAMENTE. Decompor aqui duplicaria o prepare e deixaria dois
         *      donos da mesma selecao;
         *   2. ele RECUSA `--out` ("unknown option", exit 2). O destino nao e
         *      escolhido: e `.claude/evidence/<label>/`, e o label e POSICIONAL.
         *
         * O label carrega fase e lote porque o diretorio e IMUTAVEL — rodar de
         * novo com o mesmo label falha de proposito, entao o nome precisa ser
         * unico por lote e fase.
         */
        shell: "bash scripts/ui-evidence.sh",
        args: (ctx) => {
          exigir(ctx, ["runConfigPath", "batchId"], "ui-evidence/before");
          // `--run-config`, nunca `--run-id`: o identificador vem da ancora.
          return [`before-${ctx.batchId}`, "--run-config", ctx.runConfigPath,
                  "--batch-id", ctx.batchId, "--phase", "before"];
        },
        emits: "evidence-manifest",
      },
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
      { shell: "yarn tokens:build", args: () => [], emits: "deterministic-checks" },
      {
        script: "validate-token-build.mjs",
        args: (ctx) => {
          exigir(ctx, ["applicationRoot"], "validate-token-build/built");
          // `--build` aqui, so `--check` no preflight: depois da migracao o CSS
          // precisa ser REGERADO antes de conferido, senao a checagem le o
          // artefato anterior a mutacao e aprova o que ja nao existe.
          return ["--root", ctx.applicationRoot, "--build", "--check"];
        },
        emits: "deterministic-checks",
      },
      { shell: "python3 scripts/ds-naming-law.py", args: () => [], emits: "deterministic-checks" },
      { shell: "python3 scripts/ds-cohesion.py", args: () => [], emits: "deterministic-checks" },
      { shell: "python3 ../.harness/lib/ds-variety.py", args: () => [], emits: "deterministic-checks" },
      { shell: "python3 ../.harness/lib/ds-dead-classes.py", args: () => [], emits: "deterministic-checks" },
      { shell: "bash ../.harness/lib/ds-gate.sh", args: () => [], emits: "deterministic-checks" },
    ],
  },

  AFTER_CAPTURED: {
    kind: "deterministic",
    artifacts: ["evidence-manifest"],
    steps: [
      {
        // Mesma orquestracao unica da fase de referencia; muda so a fase, e com
        // ela o contrato de fingerprint: `before` exige a fonte IGUAL a ancora,
        // `after` exige que ela tenha andado — e a mutacao que se quer medir.
        shell: "bash scripts/ui-evidence.sh",
        args: (ctx) => {
          exigir(ctx, ["runConfigPath", "batchId"], "ui-evidence/after");
          // `--run-config`, nunca `--run-id`: o identificador vem da ancora.
          return [`after-${ctx.batchId}`, "--run-config", ctx.runConfigPath,
                  "--batch-id", ctx.batchId, "--phase", "after"];
        },
        emits: "evidence-manifest",
      },
    ],
  },

  COMPARED: {
    kind: "deterministic",
    artifacts: ["comparison"],
    steps: [
      {
        shell: "node scripts/compare-evidence.mjs",
        args: (ctx) => {
          exigir(ctx, ["runRoot", "batchId"], "compare-evidence");
          const base = `${artefatos(ctx)}/${ctx.batchId}`;
          return ["--before", `${base}/before/manifest.json`,
                  "--after", `${base}/after/manifest.json`,
                  "--out", `${base}/comparison`,
                  // O pacote de revisao sai AQUI, mas quem o preenche e a fase
                  // REVIEWED, que e `model`: script nenhum fecha veredito visual.
                  "--review-input", `${base}/visual-review-input.json`];
        },
        emits: "comparison",
      },
      {
        shell: "node scripts/evidence-report.mjs",
        args: (ctx) => {
          exigir(ctx, ["runRoot", "batchId"], "evidence-report");
          const base = `${artefatos(ctx)}/${ctx.batchId}`;
          return ["--before", `${base}/before/manifest.json`,
                  "--after", `${base}/after/manifest.json`,
                  "--out", `${base}/report`];
        },
        emits: "comparison",
      },
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
      {
        script: "extract-design-occurrences.mjs",
        args: (ctx) => {
          exigir(ctx, ["applicationRoot", "runRoot", "runId", "runConfigPath"], "extract-design-occurrences/re");
          // Sai em `reinventory/`, nao por cima do inventario inicial: o laco de
          // residuo COMPARA os dois, e sobrescrever a origem apagaria o termo de
          // comparacao — a iteracao passaria a convergir contra si mesma.
          return ["--root", ctx.applicationRoot, "--out", `${artefatos(ctx)}/reinventory`, "--run-id", ctx.runId, ...sourceRootsDoConfig(ctx)];
        },
        outcomes: { 2: "ocorrencias opacas a reconciliar; artefatos escritos" },
        emits: "design-occurrence",
      },
      {
        script: "discover-axes.mjs",
        args: (ctx) => {
          exigir(ctx, ["runRoot", "runConfigPath"], "discover-axes/re");
          const base = `${artefatos(ctx)}/reinventory`;
          return ["--occurrences", `${base}/design-occurrences.ndjson`,
                  "--extraction-summary", `${base}/extraction-summary.json`,
                  "--out", `${base}/axis-discovery.json`,
                  ...eixosDoConfig(ctx)];
        },
        // Mesmo vocabulário do extrator: 2 = artefato escrito, eixo sem cobertura
        // DECLARADO em `uncoveredAxes` (o contrato aceita declarar; exige só que
        // nenhum eixo descoberto fique sem contrato nem sem registro).
        outcomes: { 2: "eixo descoberto sem cobertura, declarado em uncoveredAxes" },
        emits: "axis-discovery",
      },
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
      {
        script: "evaluate-absolute-completion.mjs",
        args: (ctx) => {
          exigir(ctx, ["applicationRoot", "runRoot"], "evaluate-absolute-completion");
          return ["--root", ctx.applicationRoot,
                  "--run-root", ctx.runRoot,
                  "--out", `${ctx.runRoot}/final-proof.json`,
                  "--gap-report", `${ctx.runRoot}/final-proof.gaps.json`];
        },
        emits: "final-proof",
      },
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
        /*
         * `args` OBRIGATORIO, inclusive quando e `() => []`. Sem esta regra um
         * passo novo nasce com argv vazio EM SILENCIO, e o script cai no
         * default errado: medido em 2026-08-01, `inventory-surface.mjs` sem
         * `--root` resolve a raiz como o `cwd` do executor — o diretorio dos
         * scripts da skill — e morre com "No source root found". Exigir a
         * declaracao explicita transforma esquecimento em erro de registro.
         */
        if (typeof s.args !== "function") {
          problemas.push(
            `${phase}: step sem args() — declare '() => []' quando o comando nao leva argumento`
          );
        }
      }
    } else if (!entry.blocker) {
      problemas.push(`${phase}: kind=${entry.kind} sem blocker declarado`);
    }
  }
  return problemas;
}

/**
 * Resolve os passos de uma fase em comandos COMPLETOS, sem executar nada.
 *
 * Existe separado do `execute` por dois motivos concretos. Primeiro, é assim que
 * a fiação vira inspecionável: `--dry-run` imprime o argv exato que rodaria, e
 * uma fase visual pode ser conferida sem disparar 376 capturas de navegador.
 * Segundo, um erro de CONTEXTO (falta `batchId`, falta `runConfigPath`) estoura
 * aqui, na montagem, antes de o primeiro comando tocar o disco — em vez de o
 * pipeline morrer no meio com metade dos artefatos escritos.
 *
 * O `cwd` não é detalhe: `script` roda a partir do repositório do PROCESSO
 * (é onde os scripts da skill e suas dependências vivem) e `shell` a partir da
 * raiz do APP medido, que é o contrato já declarado no topo deste arquivo.
 */
export function resolveSteps(phase, context = {}) {
  const entry = executorFor(phase);
  if (entry.kind !== "deterministic") return [];
  const scriptsDir = context.scriptsDir ?? DEFAULT_SCRIPTS_DIR;
  const processRoot = context.processRoot ?? path.resolve(scriptsDir, "../../../..");
  return (entry.steps ?? []).map((step, index) => {
    const argv = typeof step.args === "function" ? step.args(context) : [];
    if (!Array.isArray(argv)) {
      throw new Error(`${phase} passo ${index}: args() nao devolveu array`);
    }
    if (step.script) {
      return {
        index,
        emits: step.emits,
        outcomes: step.outcomes ?? null,
        cwd: processRoot,
        command: process.execPath,
        argv: [path.join(scriptsDir, step.script), ...argv],
        label: `node ${step.script} ${argv.join(" ")}`.trim(),
      };
    }
    // `shell` chega como linha ("node scripts/x.mjs", "bash a.sh", "yarn t")
    // porque alguns passos são comandos do app, não scripts nossos. Partir na
    // primeira palavra mantém a execução SEM shell — nada de interpolação, nada
    // de `sh -c`, portanto nada que um caminho com espaço possa reescrever.
    const [command, ...fixos] = step.shell.split(" ");
    return {
      index,
      emits: step.emits,
      outcomes: step.outcomes ?? null,
      cwd: context.applicationRoot ?? processRoot,
      command,
      argv: [...fixos, ...argv],
      label: `${step.shell} ${argv.join(" ")}`.trim(),
    };
  });
}

/**
 * Executa uma fase.
 *
 * A REGRA QUE ESTE ARQUIVO EXISTE PARA DEFENDER: só `deterministic` roda. Para
 * `model` e `human`, `execute` devolve `executed:false` com o motivo — nunca um
 * "ok" implícito. Fingir que uma fase `model` rodou porque um script terminou
 * com exit 0 é o modo de falha que este projeto já cometeu: relatório "limpo"
 * gerado sem ninguém olhar a tela.
 *
 * Passos rodam em ORDEM e param no primeiro que falha. Seguir depois de uma
 * falha produziria artefato derivado de entrada que não existe — e o erro
 * apareceria três camadas adiante, apontando para o lugar errado.
 *
 * @returns {{phase, kind, executed, ok, steps, blocker?}}
 */
export function execute(phase, context = {}, options = {}) {
  const entry = executorFor(phase);
  if (entry.kind !== "deterministic") {
    return {
      phase,
      kind: entry.kind,
      executed: false,
      ok: false,
      steps: [],
      blocker: entry.blocker,
    };
  }

  const passos = resolveSteps(phase, context);
  if (options.dryRun) {
    return {
      phase,
      kind: entry.kind,
      executed: false,
      ok: true,
      dryRun: true,
      steps: passos.map((p) => ({ ...p, status: "resolved" })),
    };
  }

  const rodar = options.run ?? rodarPasso;
  const resultados = [];
  for (const passo of passos) {
    const r = rodar(passo);
    /*
     * Um passo pode declarar desfechos NAO-ZERO conhecidos. So os codigos
     * DECLARADOS sao nao-fatais, e cada um carrega o seu significado no
     * resultado — o resto continua falha. A alternativa que se ve por ai
     * ("|| true", ou aceitar qualquer nao-zero) transformaria comando quebrado
     * em sucesso silencioso, que e a classe de defeito que este arquivo inteiro
     * existe para impedir.
     */
    const desfecho = r.exitCode !== 0 ? passo.outcomes?.[r.exitCode] : null;
    resultados.push({ ...passo, ...r, outcome: desfecho ?? null });
    if (r.exitCode !== 0 && !desfecho) {
      return { phase, kind: entry.kind, executed: true, ok: false, steps: resultados };
    }
  }
  /*
   * `emits` DEIXA DE SER COMENTÁRIO. Uma fase que declara produzir
   * `cluster-packet` e termina sem nenhum registro desse tipo no run root não
   * teve sucesso — teve silêncio. Medido em 2026-08-02: CLASSIFIED devolveu
   * `ok=true` com o run root vazio dos dois artefatos que ela promete, porque
   * os cinco passos só imprimiam JSON no stdout.
   *
   * A checagem é por CONTEÚDO, não por nome de arquivo: varre os artefatos do
   * run root e procura o `artifactType` declarado. Conferir nome de arquivo
   * aceitaria um arquivo vazio com o nome certo.
   */
  const faltando = artefatosAusentes(entry.artifacts ?? [], context);
  if (faltando.length) {
    return {
      phase, kind: entry.kind, executed: true, ok: false, steps: resultados,
      missingArtifacts: faltando,
      blocker: `a fase declarou emitir ${faltando.join(", ")} e o run root não tem nenhum registro desses tipos`,
    };
  }
  return { phase, kind: entry.kind, executed: true, ok: true, steps: resultados };
}

/**
 * Varre o run root e devolve `Map<artifactType, paths[]>` para os tipos
 * pedidos — a MESMA varredura por CONTEÚDO que o check de `emits` usa, agora
 * exportada porque o sweep precisa localizar os artefatos que cada transição
 * exige. Dois scanners divergindo sobre "o que existe no run root" seria a
 * família de defeito nº 1 desta empreitada; por isso um só, aqui.
 */
export function artefatosPorTipo(tipos, runRoot) {
  const achados = new Map(tipos.map((tipo) => [tipo, []]));
  if (!tipos.length || !runRoot) return achados;
  const pendentes = [`${runRoot}/artifacts`, `${runRoot}/final`];
  const arquivos = [];
  while (pendentes.length) {
    const dir = pendentes.pop();
    let entradas = [];
    try { entradas = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entrada of entradas) {
      const alvo = `${dir}/${entrada.name}`;
      if (entrada.isDirectory()) pendentes.push(alvo);
      else if (entrada.isFile() && /\.(json|ndjson)$/.test(entrada.name)) {
        arquivos.push(alvo);
      }
    }
  }
  arquivos.push(`${runRoot}/final-proof.json`);
  for (const caminho of arquivos) {
    let texto = "";
    try { texto = readFileSync(caminho, "utf8"); } catch { continue; }
    let objetos = [];
    try {
      const raiz = JSON.parse(texto);
      objetos = Array.isArray(raiz) ? raiz : [raiz];
    } catch {
      for (const linha of texto.split(/\r?\n/)) {
        if (!linha.trim()) continue;
        try { objetos.push(JSON.parse(linha)); } catch { /* arquivo não-artefato */ }
      }
    }
    for (const objeto of objetos) {
      const tipo = objeto?.artifactType;
      if (!achados.has(tipo)) continue;
      const lista = achados.get(tipo);
      if (!lista.includes(caminho)) lista.push(caminho);
    }
  }
  return achados;
}

/**
 * Quais dos tipos declarados NÃO aparecem em artefato nenhum do run root.
 *
 * A ÚNICA exceção é a mesma do contrato, e o predicado é IMPORTADO dele — não
 * reescrito aqui. Duas cópias da regra de dispensa divergiriam na fronteira,
 * que é a causa-raiz de nove defeitos medidos em 2026-08-01/03: `cluster-packet`
 * pode faltar quando o `inventory-report` declara zero cluster sobre população
 * não-vácua com escopo nomeado.
 */
function artefatosAusentes(tipos, context) {
  if (!tipos.length || !context?.runRoot) return [];
  const achados = artefatosPorTipo(tipos, context.runRoot);
  const faltando = tipos.filter((tipo) => achados.get(tipo).length === 0);
  if (!faltando.includes("cluster-packet")) return faltando;

  const relatorios = (artefatosPorTipo(["inventory-report"], context.runRoot).get("inventory-report") ?? [])
    .flatMap((caminho) => {
      let texto = "";
      try { texto = readFileSync(caminho, "utf8"); } catch { return []; }
      try {
        const um = JSON.parse(texto);
        return Array.isArray(um) ? um : [um];
      } catch {
        return texto.split("\n").filter(Boolean).flatMap((linha) => {
          try { return [JSON.parse(linha)]; } catch { return []; }
        });
      }
    });
  return dispensaDeClusterPacket(relatorios)
    ? faltando.filter((tipo) => tipo !== "cluster-packet")
    : faltando;
}

function rodarPasso(passo) {
  const r = spawnSync(passo.command, passo.argv, {
    cwd: passo.cwd,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  return {
    // `spawnSync` devolve status null quando o processo nem nasceu (binário
    // ausente) ou morreu por sinal. Tratar null como 0 faria um comando que
    // NÃO EXISTE contar como sucesso — exatamente o silêncio que o registro
    // inteiro existe para impedir.
    exitCode: r.status === null ? 127 : r.status,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? (r.error ? String(r.error.message) : ""),
  };
}
