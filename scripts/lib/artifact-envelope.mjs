/**
 * artifact-envelope — o cabeçalho de artefato, escrito UMA vez.
 *
 * POR QUE EXISTE. O contrato exige seis campos em todo artefato
 * (`reference/artifact-schemas.json`, `$defs.artifactHeader`) e cada emissor
 * vinha montando o seu à mão. O preço disso já foi cobrado duas vezes no mesmo
 * dia: `extract-design-occurrences.mjs` esqueceu `recordStage`/`supersedes` e
 * reprovou 13.869 registros um a um; `scripts/lib/visual-contract.mjs` carimba
 * `schemaVersion: "2.0.0"` enquanto o contrato exige `"1.0.0"` const, e por isso
 * os três artefatos visuais que TÊM emissor produzem coisa que o journal recusa.
 *
 * Header montado à mão em N lugares diverge em N direções. Aqui ele é um lugar
 * só, e ele deriva do `run-config` — que é a âncora da corrida e a fonte única
 * de `runId`, `sourceFingerprint` e `toolchainFingerprint`.
 *
 * Uso:
 *   const env = envelopeFrom(runConfigPath);
 *   const artefato = { ...env.header("cluster-packet"), clusterId, ... };
 *   const ref = env.ref("design-occurrence", caminhoDoArquivo);
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { fingerprintSourceRoots } from "./source-fingerprint.mjs";

/** sha256 de um arquivo — a mesma forma que o contrato usa para conferir refs. */
export function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

/**
 * Carrega o run-config e devolve as duas fábricas.
 *
 * Falha ALTO quando o run-config não existe ou não tem os campos: um artefato
 * emitido com header incompleto só quebra na transição, três camadas adiante,
 * e o erro aponta para o lugar errado.
 */
export function envelopeFrom(runConfigPath, { applicationRoot = null } = {}) {
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(runConfigPath, "utf8"));
  } catch (erro) {
    throw new Error(
      `run-config ilegível em ${runConfigPath}: ${erro.message}. ` +
        `Ancore a corrida primeiro: node anchor-run.mjs --root <app>`
    );
  }
  for (const campo of ["runId", "sourceFingerprint", "toolchainFingerprint"]) {
    if (!cfg[campo]) {
      throw new Error(
        `run-config sem ${campo} (${runConfigPath}) — não é um run-config válido`
      );
    }
  }

  // Um timestamp por PROCESSO, não por artefato: dois artefatos emitidos na
  // mesma execução pertencem ao mesmo instante lógico, e variar o carimbo entre
  // eles tornaria a saída não reprodutível sem ganho nenhum.
  const generatedAt = new Date().toISOString();

  return {
    runId: cfg.runId,
    sourceFingerprint: cfg.sourceFingerprint,
    toolchainFingerprint: cfg.toolchainFingerprint,
    config: cfg,
    header(artifactType) {
      return {
        schemaVersion: "1.0.0",
        artifactType,
        runId: cfg.runId,
        sourceFingerprint: cfg.sourceFingerprint,
        toolchainFingerprint: cfg.toolchainFingerprint,
        generatedAt,
      };
    },
    /**
     * O header de um artefato produzido DEPOIS de a fonte ter sido mutada.
     *
     * POR QUE NÃO DÁ PARA USAR `header()` NOS DOIS CASOS, e este é o furo que
     * quase passou: `header()` devolve o `sourceFingerprint` ANCORADO, medido no
     * início da corrida. O contrato (`lib/artifact-contract.mjs:934-969`) exige
     * que o `evidence-manifest` de fase `after`, o `comparison`, o
     * `visual-review`, o `deterministic-checks` de lote, o `adversarial-review` e
     * o `acceptance` carreguem o fingerprint PÓS-MUTAÇÃO — senão emite
     * *"<tipo> for <batch> is stale after mutation"*.
     *
     * Espalhar o header ancorado num manifesto `after` produz artefato **stale
     * por construção**: ele passa em todos os schemas e reprova três camadas
     * adiante, apontando para o lugar errado. É a falha que esta reconciliação
     * existe para consertar, reintroduzida por baixo.
     *
     * O algoritmo é o MESMO do `anchor-run.mjs` — `fingerprintSourceRoots`, de
     * `lib/absolute-completion.mjs:105`. Não há nada a reimplementar; há uma
     * chamada a fazer com os argumentos certos.
     *
     * NA FASE `before` os dois têm de coincidir, e a divergência é ERRO: se a
     * fonte já mudou antes da captura de referência, a comparação não tem base.
     * `assertBase` existe para provar isso alto, em vez de deixar o par
     * before/after nascer sobre chão movediço.
     */
    measuredHeader(artifactType, { assertBase = false } = {}) {
      if (!applicationRoot) {
        throw new Error(
          "measuredHeader exige applicationRoot: envelopeFrom(path, { applicationRoot })"
        );
      }
      const medido = fingerprintSourceRoots({
        applicationRoot,
        sourceRoots: cfg.sourceRoots ?? ["src"],
      });
      if (!medido.fingerprint) {
        throw new Error(
          `não foi possível medir a fonte em ${applicationRoot}` +
            (medido.problems?.length ? `: ${medido.problems.join("; ")}` : "")
        );
      }
      if (assertBase && medido.fingerprint !== cfg.sourceFingerprint) {
        throw new Error(
          `a fonte já divergiu da âncora antes da captura de referência\n` +
            `  ancorado: ${cfg.sourceFingerprint}\n` +
            `  medido:   ${medido.fingerprint}\n` +
            `  Um par before/after sobre bases diferentes não compara nada. ` +
            `Reancore (anchor-run.mjs) ou restaure a árvore.`
        );
      }
      return { ...this.header(artifactType), sourceFingerprint: medido.fingerprint };
    },
    /** Referência a outro artefato, com o sha256 lido do disco AGORA. */
    ref(artifactType, filePath, { relativeTo = null } = {}) {
      return {
        artifactType,
        path: relativeTo ? path.relative(relativeTo, filePath) : filePath,
        sha256: sha256File(filePath),
      };
    },
  };
}

/** sha256 de um valor canônico — para os `*Fingerprint` que o schema exige. */
export function fingerprint(value) {
  const canonical = (v) => {
    if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
    if (v && typeof v === "object") {
      return `{${Object.keys(v)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
        .join(",")}}`;
    }
    return JSON.stringify(v ?? null);
  };
  return createHash("sha256").update(canonical(value)).digest("hex");
}
