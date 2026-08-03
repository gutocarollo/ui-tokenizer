/**
 * progress-log — o artefato de progresso que o dono pediu (D9, 2026-08-03):
 * *"um log preenchido para eu conferir o de→para, em qual rodada está, quantos
 * itens tokenizados, quantos restantes, quantos travados"*.
 *
 * Duas superfícies, UM dono: `progress.ndjson` (máquina, append-only) e
 * `progress.md` (humano, REGERADO do ndjson inteiro a cada registro — nunca
 * editado à mão, senão viram duas fontes que divergem).
 *
 * Contadores nulos imprimem `—`, não `0`: zero é MEDIÇÃO, travessão é
 * ausência de medida — a mesma distinção que o `evaluate-residual` pratica
 * ("não medido" nunca vira "zero").
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Parseia um arquivo de artefato: JSON único, array, ou NDJSON linha a linha. */
export function objetosDoArquivo(texto) {
  try {
    const um = JSON.parse(texto);
    return Array.isArray(um) ? um : [um];
  } catch {
    return texto
      .split("\n")
      .filter(Boolean)
      .map((linha) => {
        try {
          return JSON.parse(linha);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }
}

export function lerProgresso(runRoot) {
  const p = path.join(runRoot, "progress.ndjson");
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((linha) => JSON.parse(linha));
}

export function registrarProgresso(runRoot, registro) {
  appendFileSync(path.join(runRoot, "progress.ndjson"), `${JSON.stringify(registro)}\n`);
  writeFileSync(path.join(runRoot, "progress.md"), renderProgresso(lerProgresso(runRoot)));
  return registro;
}

const celula = (v) => (v === null || v === undefined ? "—" : String(v));

export function renderProgresso(registros) {
  const linhas = [
    "# Progresso da varredura",
    "",
    "Gerado pelo sweep a cada evento — NÃO editar (a fonte é `progress.ndjson`).",
    "",
    "| rodada | quando | evento | fase | tokenizados | restantes | travados |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const r of registros) {
    linhas.push(
      `| ${celula(r.rodada)} | ${celula(r.at)} | ${celula(r.evento)} | ${celula(r.fase)} ` +
        `| ${celula(r.contadores?.tokenizados)} | ${celula(r.contadores?.restantes)} ` +
        `| ${celula(r.contadores?.travados)} |`
    );
  }
  const dePara = registros.flatMap((r) => r.dePara ?? []);
  linhas.push("", "## De → Para (decisões desta corrida)", "");
  if (!dePara.length) {
    linhas.push("_ainda sem decisão registrada — esta seção enche a partir de DECIDED._");
  } else {
    linhas.push("| de (clusters de origem) | para (nome pela lei) | decidido por |", "|---|---|---|");
    for (const d of dePara) {
      linhas.push(`| ${d.de} | \`${d.para}\` | ${d.decididoPor} |`);
    }
  }
  return `${linhas.join("\n")}\n`;
}

/**
 * De→para extraído dos artefatos `decision` — SÓ campos que o schema EXIGE
 * (`proposal.name`, `clusterIds`, `decidedBy`). Ler campo que o emissor não
 * grava foi a causa de 7 defeitos em 2026-08-01/02; aqui não se adivinha.
 */
export function deParaDasDecisoes(paths, ler = (p) => readFileSync(p, "utf8")) {
  const pares = [];
  for (const p of paths) {
    let texto = "";
    try {
      texto = ler(p);
    } catch {
      continue;
    }
    for (const obj of objetosDoArquivo(texto)) {
      if (obj?.artifactType !== "decision" || !obj?.proposal) continue;
      if (obj.proposal.name === null || obj.proposal.name === undefined) continue;
      pares.push({
        de: (obj.clusterIds ?? []).join(" + "),
        para: obj.proposal.name,
        decididoPor: obj.decidedBy ?? "—",
      });
    }
  }
  return pares;
}
