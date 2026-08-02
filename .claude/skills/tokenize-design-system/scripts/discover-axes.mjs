#!/usr/bin/env node
/**
 * Reconcile data-driven axes and the closed 19-kind source registry.
 *
 * Usage:
 *   node discover-axes.mjs --occurrences <design-occurrences.ndjson>
 *     --extraction-summary <extraction-summary.json> --out <axis-discovery.json>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DESIGN_AXES, makeAxisDiscovery } from "./lib/axis-discovery.mjs";

const HELP = `discover-axes.mjs

Usage:
  node discover-axes.mjs --occurrences <ndjson>
    --extraction-summary <json> --out <json>

Options:
  --configured-axes <csv>  Override the 13-axis default registry
  --discovery-id <id>      Stable discovery ID (default: axis-discovery-1)
  --generated-at <ISO>     Reproducible artifact timestamp
  --help                   Show this text
`;

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(HELP);
  process.exit(0);
}

const occurrencesPath = path.resolve(
  argValue("--occurrences") ?? "design-occurrences.ndjson"
);
const summaryPath = path.resolve(
  argValue("--extraction-summary") ?? "extraction-summary.json"
);
const outputPath = path.resolve(argValue("--out") ?? "axis-discovery.json");
for (const file of [occurrencesPath, summaryPath]) {
  if (!existsSync(file)) throw new Error(`Input does not exist: ${file}`);
}
const occurrences = readFileSync(occurrencesPath, "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));
if (occurrences.length === 0) {
  throw new Error("Refusing vacuous axis discovery: no occurrences");
}
const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
const configuredAxes = (
  argValue("--configured-axes")?.split(",") ?? DESIGN_AXES
)
  .map((axis) => axis.trim())
  .filter(Boolean);
const invalidAxes = configuredAxes.filter(
  (axis) => !DESIGN_AXES.includes(axis)
);
if (
  configuredAxes.length === 0 ||
  new Set(configuredAxes).size !== configuredAxes.length
) {
  throw new Error("Configured axes must be a non-empty unique set");
}
if (invalidAxes.length > 0) {
  throw new Error(`Unknown configured axes: ${invalidAxes.join(", ")}`);
}

const first = occurrences[0];
const mismatched = occurrences.filter(
  (occurrence) =>
    occurrence.runId !== first.runId ||
    occurrence.sourceFingerprint !== first.sourceFingerprint ||
    occurrence.toolchainFingerprint !== first.toolchainFingerprint
);
if (mismatched.length > 0) {
  throw new Error("Occurrences do not share run/source/toolchain identity");
}
if (
  summary.runId !== first.runId ||
  summary.sourceFingerprint !== first.sourceFingerprint ||
  summary.toolchainFingerprint !== first.toolchainFingerprint
) {
  throw new Error("Extraction summary identity does not match occurrences");
}

const discovery = makeAxisDiscovery({
  header: {
    schemaVersion: "1.0.0",
    runId: first.runId,
    sourceFingerprint: first.sourceFingerprint,
    toolchainFingerprint: first.toolchainFingerprint,
    generatedAt: argValue("--generated-at") ?? new Date().toISOString(),
  },
  discoveryId: argValue("--discovery-id") ?? "axis-discovery-1",
  occurrences,
  configuredAxes,
  scannerResults: summary.scannerResults,
  upstreamExhaustive: summary.exhaustive === true,
});
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(discovery, null, 2)}\n`);
console.log(
  `Axis discovery: axes=${discovery.discoveredAxes.length}, ` +
    `uncoveredAxes=${discovery.uncoveredAxes.length}, ` +
    `coveredKinds=${discovery.coveredOccurrenceKinds.length}/19, ` +
    `exhaustive=${discovery.exhaustive}`
);
/*
 * EXIT 2, NÃO 1 — e a diferença não é cosmética.
 *
 * Não-exaustivo significa "o artefato FOI escrito e declara o que ficou de
 * fora", que é resíduo, não falha. O contrato concorda: ele exige que todo eixo
 * descoberto tenha contrato configurado OU registro em `uncoveredAxes`
 * (`artifact-contract.mjs`, invariante axis-discovery), e declarar satisfaz.
 * Medido em 2026-08-02 sobre esta corrida: `uncoveredAxes: ["unmapped"]` produz
 * ZERO violação de axis-discovery na validação do conjunto.
 *
 * Sinalizar isso com 1 era ambíguo de um jeito perigoso: exceção não capturada
 * no Node também sai 1. Quem consome o exit code não conseguia distinguir
 * "rodou e sobrou resíduo" de "quebrou no meio", e a única saída seria o
 * chamador declarar 1 como não-fatal — mascarando crash de verdade.
 *
 * 2 é a mesma convenção que `extract-design-occurrences.mjs` já usa para
 * "artefatos escritos, com resíduo a reconciliar". Um vocabulário, dois
 * emissores.
 */
if (!discovery.exhaustive) process.exitCode = 2;
