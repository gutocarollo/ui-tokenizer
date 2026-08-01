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
export function envelopeFrom(runConfigPath) {
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
