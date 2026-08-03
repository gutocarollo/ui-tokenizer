#!/usr/bin/env node
/**
 * Mede os 14 relatórios absolutos e devolve a direção da próxima iteração.
 *
 * Exit 0: todos medidos, população não-vácua e resíduo zero.
 * Exit 3: há resíduo (inclui população vácua, que não prova nada).
 * Exit 4: algum medidor não encontrou o insumo durável que deveria medir.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { envelopeFrom } from "../../../../scripts/lib/artifact-envelope.mjs";
import { resolveRoot } from "./lib/paths.mjs";
import {
  ABSOLUTE_REPORT_PREDICATES,
  absoluteReportId,
} from "./lib/absolute-completion-contract.mjs";
import { medirResiduosAbsolutos } from "./lib/residual-measurers.mjs";

function argumento(argv, flag, fallback = null) {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

function usage() {
  return `evaluate-residual.mjs — mede o resíduo absoluto e decide se o laço continua

Uso:
  node evaluate-residual.mjs --root <app> --run-config <path> --run-root <run> --out <dir>

Exit: 0 completo · 3 mais uma volta · 4 há predicado não medido`;
}

function refsDeEntrada({ measurement, env, runConfigPath, runRoot, artifactTypes }) {
  const paths = measurement.inputPaths?.length
    ? measurement.inputPaths
    : [runConfigPath];
  const vistos = new Set();
  return paths.flatMap((sourcePath) => {
    const absolute = path.resolve(sourcePath);
    if (vistos.has(absolute) || !existsSync(absolute)) return [];
    vistos.add(absolute);
    const tipo = artifactTypes.get(absolute) ?? "run-config";
    return [env.ref(tipo, absolute, { relativeTo: runRoot })];
  });
}

export function avaliarResidual({ applicationRoot, runConfigPath, runRoot, outDir }) {
  if (!existsSync(runConfigPath)) {
    throw new Error(`sem run-config em ${runConfigPath}`);
  }
  const runConfig = JSON.parse(readFileSync(runConfigPath, "utf8"));
  const env = envelopeFrom(runConfigPath);
  const { resultados, registros } = medirResiduosAbsolutos({
    applicationRoot,
    runRoot,
    runConfig,
  });
  const artifactTypes = new Map(
    registros.map(({ artifact, sourcePath }) => [
      path.resolve(sourcePath),
      artifact.artifactType,
    ])
  );

  const medidos = [];
  const naoMedidos = [];
  for (const pred of ABSOLUTE_REPORT_PREDICATES) {
    const measurement = resultados.get(pred.predicateId);
    if (!measurement) {
      naoMedidos.push({
        predicateId: pred.predicateId,
        reportId: absoluteReportId(pred.predicateId),
        razao: "o medidor existe mas o insumo durável não está presente nesta corrida",
        reentryCode: pred.reentryCode,
      });
      continue;
    }
    medidos.push({
      ...pred,
      ...measurement,
      reportId: absoluteReportId(pred.predicateId),
    });
  }

  mkdirSync(outDir, { recursive: true });
  const relatorios = medidos.map((m) => ({
    ...env.header("inventory-report"),
    reportId: m.reportId,
    inventoryKind: m.inventoryKind,
    inputArtifactRefs: refsDeEntrada({
      measurement: m,
      env,
      runConfigPath,
      runRoot,
      artifactTypes,
    }),
    counts: {
      population: m.populacao,
      unapprovedResidual: m.residuo,
    },
    detailArtifactRefs: [],
    reconciled: m.residuo === 0 && m.populacao > 0,
  }));
  const relatoriosPath = path.join(outDir, "completion-reports.ndjson");
  writeFileSync(
    relatoriosPath,
    relatorios.map((report) => JSON.stringify(report)).join("\n") + "\n"
  );

  const comResiduo = medidos.filter((m) => m.residuo > 0);
  const vacuos = medidos.filter((m) => m.populacao === 0);
  const resultado = {
    medidos: medidos.length,
    naoMedidos: naoMedidos.length,
    totalExigido: ABSOLUTE_REPORT_PREDICATES.length,
    comResiduo: comResiduo.length,
    residuoTotal: medidos.reduce((soma, m) => soma + m.residuo, 0),
    reentradas: [
      ...new Set([...comResiduo, ...vacuos].map((m) => m.reentryCode)),
    ],
    artefato: relatoriosPath,
    detalhe: medidos,
    naoMedidos,
  };
  return {
    resultado,
    exitCode: naoMedidos.length ? 4 : comResiduo.length || vacuos.length ? 3 : 0,
  };
}

function main(argv) {
  if (argv.includes("--help")) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const applicationRoot = resolveRoot();
  const runConfigPath = path.resolve(
    argumento(argv, "--run-config", path.join(applicationRoot, ".tokenize/run-config.json"))
  );
  const runRootArg = argumento(argv, "--run-root");
  if (!runRootArg) throw new Error("--run-root é obrigatório");
  const runRoot = path.resolve(runRootArg);
  const outDir = path.resolve(
    argumento(argv, "--out", path.join(runRoot, "artifacts"))
  );
  const { resultado, exitCode } = avaliarResidual({
    applicationRoot,
    runConfigPath,
    runRoot,
    outDir,
  });
  if (argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(resultado, null, 1)}\n`);
  } else {
    process.stdout.write(
      `RESIDUAL — ${resultado.medidos} de ${resultado.totalExigido} predicados medidos\n`
    );
    for (const m of resultado.detalhe) {
      const marca = m.residuo === 0 && m.populacao > 0 ? "ok" : "RESÍDUO";
      process.stdout.write(
        `  ${marca.padEnd(7)} ${m.predicateId.padEnd(42)} ${m.residuo} de ${m.populacao}\n`
      );
      process.stdout.write(`           ${m.como}\n`);
    }
    if (resultado.naoMedidos.length) {
      process.stdout.write(
        `\nNÃO MEDIDOS (${resultado.naoMedidos.length}) — desconhecido nunca vira zero:\n`
      );
      for (const item of resultado.naoMedidos) {
        process.stdout.write(`  ${item.predicateId}: ${item.razao}\n`);
      }
    }
  }
  return exitCode;
}

const invokedAsScript =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`RESIDUAL falhou: ${error.message}\n`);
    process.exitCode = 1;
  }
}
