#!/usr/bin/env node
/**
 * Produz a projecao `classified` imutavel do censo inteiro.
 *
 * A linhagem fica auditavel: cada registro aponta para o raw exato por
 * artifactRef + SHA-256 canonico do registro. Registros acionaveis continuam
 * nao-terminais; este comando nunca chama hardcode de excecao para zerar gate.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { envelopeFrom } from "../../../../scripts/lib/artifact-envelope.mjs";
import {
  designRecordSha256,
} from "./lib/design-occurrence-lineage.mjs";
import {
  arbitraryPhysicalCandidates,
  classifyDesignOccurrence,
} from "./lib/design-value-classifier.mjs";

const argv = process.argv.slice(2);
const arg = (flag, fallback = null) => {
  const index = argv.indexOf(flag);
  return index >= 0 ? (argv[index + 1] ?? fallback) : fallback;
};

if (argv.includes("--help")) {
  console.log(`classify-design-occurrences.mjs

Uso:
  node classify-design-occurrences.mjs --run-config <config.json> \\
    --input <design-occurrences.ndjson> --normalized <normalized.ndjson> \\
    --out <classified-design-occurrences.ndjson> [--json]
`);
  process.exit(0);
}

const runConfigPath = arg("--run-config");
const applicationRoot = path.resolve(arg("--root", process.cwd()));
const inputPath = arg("--input");
const normalizedPath = arg("--normalized");
const outPath = arg("--out");
const sourceFingerprint = arg("--source-fingerprint");
for (const [flag, value] of [
  ["--run-config", runConfigPath],
  ["--input", inputPath],
  ["--normalized", normalizedPath],
  ["--out", outPath],
]) {
  if (!value) throw new Error(`${flag} e obrigatorio`);
  if (flag !== "--out" && !existsSync(value)) throw new Error(`${flag} nao existe: ${value}`);
}

const parseNdjson = (file) =>
  readFileSync(file, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

const raw = parseNdjson(inputPath).filter(
  (record) => record.artifactType === "design-occurrence" && record.recordStage === "raw"
);
const normalizedByDesignId = new Map(
  parseNdjson(normalizedPath)
    .filter((record) => record.artifactType === "normalized-occurrence")
    .map((record) => [record.designOccurrenceId, record])
);
if (!raw.length) throw new Error("censo raw vazio; classificacao vacua e recusada");

const env = envelopeFrom(runConfigPath);
const classifiedHeader = () => ({
  ...env.header("design-occurrence"),
  ...(sourceFingerprint ? { sourceFingerprint } : {}),
});
const rawRef = env.ref("design-occurrence", inputPath, {
  relativeTo: path.dirname(runConfigPath),
});
const counts = { terminal: 0, actionable: 0, unresolved: 0, byStatus: {} };

function authoredClassIndex() {
  const classes = new Set();
  const walk = (directory) => {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile() && /\.(?:css|scss|sass|less)$/u.test(entry.name)) {
        const source = readFileSync(absolute, "utf8");
        for (const match of source.matchAll(/\.((?:\\.|[-_a-zA-Z0-9])+)/g)) {
          classes.add(match[1].replace(/\\(.)/g, "$1"));
        }
      }
    }
  };
  for (const sourceRoot of env.config.sourceRoots ?? ["src"]) {
    walk(path.resolve(applicationRoot, sourceRoot));
  }
  return classes;
}

const authoredClasses = authoredClassIndex();
const atomicBySite = new Map();
for (const record of raw) {
  if (record.occurrenceKind !== "inline-style" || !record.property) continue;
  const key = [
    record.location.file,
    record.location.line,
    record.property,
    record.rawValue,
  ].join("\0");
  atomicBySite.set(key, record.occurrenceId);
}
const preliminary = new Map();
const recurrence = new Map();
const arbitraryRecurrence = new Map();
const reuseKey = (record) => [
  record.context?.component ||
    path.basename(record.location.file, path.extname(record.location.file)),
  record.axis,
  record.property,
  String(record.rawValue).trim(),
].join("\0");
for (const record of raw) {
  const duplicateKey = [
    record.location.file,
    record.location.line,
    record.property,
    record.rawValue,
  ].join("\0");
  const verdict = classifyDesignOccurrence(record, {
    normalized: normalizedByDesignId.get(record.occurrenceId) ?? null,
    authoredClasses,
    duplicateOf:
      record.occurrenceKind === "typography"
        ? (atomicBySite.get(duplicateKey) ?? null)
        : null,
  });
  preliminary.set(record.occurrenceId, verdict);
  if (verdict.disposition === "actionable" && record.occurrenceKind !== "utility-class") {
    const key = reuseKey(record);
    recurrence.set(key, (recurrence.get(key) ?? 0) + 1);
  }
  if (verdict.disposition === "actionable" && record.occurrenceKind === "utility-class") {
    const owner =
      record.context?.component ||
      path.basename(record.location.file, path.extname(record.location.file));
    for (const candidate of arbitraryPhysicalCandidates(
      normalizedByDesignId.get(record.occurrenceId)
    )) {
      const key = [owner, candidate.utilityRoot, candidate.value].join("\0");
      arbitraryRecurrence.set(key, (arbitraryRecurrence.get(key) ?? 0) + 1);
    }
  }
}
const classified = raw.map((record) => {
  let verdict = preliminary.get(record.occurrenceId);
  if (
    verdict.disposition === "actionable" &&
    record.occurrenceKind !== "utility-class" &&
    recurrence.get(reuseKey(record)) === 1
  ) {
    verdict = {
      disposition: "terminal",
      status: "approved-out-of-scope",
      reason:
        "valor aparece uma vez neste owner+property; centraliza-lo custa um token e um callsite sem reutilizacao (breakeven minimo: 2)",
    };
  }
  if (verdict.disposition === "actionable" && record.occurrenceKind === "utility-class") {
    const owner =
      record.context?.component ||
      path.basename(record.location.file, path.extname(record.location.file));
    const arbitrary = arbitraryPhysicalCandidates(
      normalizedByDesignId.get(record.occurrenceId)
    );
    if (
      arbitrary.length > 0 &&
      arbitrary.every(
        (candidate) =>
          arbitraryRecurrence.get([owner, candidate.utilityRoot, candidate.value].join("\0")) === 1
      )
    ) {
      verdict = {
        disposition: "terminal",
        status: "approved-out-of-scope",
        reason:
          "utility arbitraria aparece uma vez neste owner+property; nao atinge breakeven de reutilizacao 2",
      };
    }
  }
  counts[verdict.disposition] += 1;
  counts.byStatus[verdict.status] = (counts.byStatus[verdict.status] ?? 0) + 1;
  return {
    ...record,
    ...classifiedHeader(),
    recordStage: "classified",
    supersedes: {
      occurrenceId: record.occurrenceId,
      artifactRef: rawRef,
      recordSha256: designRecordSha256(record),
    },
    reconciliation: {
      status: verdict.status,
      decisionId: verdict.decisionId ?? null,
      exceptionId: null,
      reason: verdict.reason,
    },
  };
});

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, `${classified.map((record) => JSON.stringify(record)).join("\n")}\n`);
const summary = { population: raw.length, ...counts, output: outPath };
if (argv.includes("--json")) console.log(JSON.stringify(summary, null, 2));
else console.log(`CLASSIFY: ${raw.length} sitios — ${counts.terminal} terminais, ${counts.actionable} acionaveis, ${counts.unresolved} nao resolvidos`);
process.exit(counts.actionable || counts.unresolved ? 2 : 0);
