#!/usr/bin/env node
/**
 * Agrupa o residuo fisico do censo atomico em contratos aplicaveis.
 *
 * Uma unidade de alta confianca tem owner, propriedade, valor atomico e um so
 * valor para o mesmo owner+property+state. Expressao composta, classe opaca ou
 * mais de um valor sem estado continua na banda baixa; nunca recebe nome por
 * proximidade de bytes.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  envelopeFrom,
  fingerprint,
} from "../../../../scripts/lib/artifact-envelope.mjs";
import { axesForClassName } from "./lib/axis-discovery.mjs";
import { confidenceEvidence } from "./lib/confidence-policy.mjs";
import {
  isArbitraryPhysicalUtility,
  isSimplePhysicalLiteral,
} from "./lib/design-value-classifier.mjs";

const argv = process.argv.slice(2);
const arg = (flag, fallback = null) => {
  const index = argv.indexOf(flag);
  return index >= 0 ? (argv[index + 1] ?? fallback) : fallback;
};
const required = (flag) => {
  const value = arg(flag);
  if (!value) throw new Error(`${flag} e obrigatorio`);
  const absolute = path.resolve(value);
  if (!existsSync(absolute) && flag !== "--out") {
    throw new Error(`${flag} nao existe: ${absolute}`);
  }
  return absolute;
};

const runConfigPath = required("--run-config");
const classifiedPath = required("--classified");
const normalizedPath = required("--normalized");
const outDir = path.resolve(arg("--out", path.dirname(classifiedPath)));
const env = envelopeFrom(runConfigPath);

const ndjson = (file) =>
  readFileSync(file, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
const design = ndjson(classifiedPath).filter(
  (item) => item.artifactType === "design-occurrence" && item.recordStage === "classified"
);
const normalized = new Map(
  ndjson(normalizedPath)
    .filter((item) => item.artifactType === "normalized-occurrence")
    .map((item) => [item.designOccurrenceId, item])
);
if (!design.length) throw new Error("classificacao vazia; clustering vacuo e recusado");

const slug = (value) =>
  String(value ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || null;
const unquote = (value) => {
  const text = String(value ?? "").trim();
  return /^(["']).*\1$/s.test(text) ? text.slice(1, -1) : text;
};
const componentFrom = (occurrence) =>
  occurrence.context?.component ||
  path.basename(occurrence.location.file, path.extname(occurrence.location.file));

const candidates = [];
for (const occurrence of design) {
  if (!["discovered", "opaque"].includes(occurrence.reconciliation.status)) continue;
  const owner = componentFrom(occurrence);
  const state = occurrence.context?.interactionState ?? null;
  const normalizedOccurrence = normalized.get(occurrence.occurrenceId);

  if (
    occurrence.occurrenceKind === "utility-class" &&
    isArbitraryPhysicalUtility(normalizedOccurrence)
  ) {
    for (const candidate of normalizedOccurrence.candidates ?? []) {
      const wrapped = String(candidate.value ?? "");
      if (!/^\[.*\]$/s.test(wrapped)) continue;
      const axis = axesForClassName(candidate.raw)[0] ?? occurrence.axis;
      candidates.push({
        occurrence,
        owner,
        state,
        axis,
        property: candidate.utilityRoot,
        physicalValue: unquote(wrapped.slice(1, -1)),
        replacementRaw: candidate.raw,
        adapter: "utility-class",
        atomic: true,
      });
    }
    continue;
  }
  if (isSimplePhysicalLiteral(occurrence)) {
    candidates.push({
      occurrence,
      owner,
      state,
      axis: occurrence.axis,
      property: occurrence.property,
      physicalValue: unquote(occurrence.rawValue),
      replacementRaw: occurrence.rawValue,
      adapter: occurrence.occurrenceKind,
      atomic: true,
    });
    continue;
  }
  candidates.push({
    occurrence,
    owner,
    state,
    axis: occurrence.axis,
    property: occurrence.property,
    physicalValue: occurrence.rawValue,
    replacementRaw: occurrence.rawValue,
    adapter: occurrence.occurrenceKind,
    atomic: false,
  });
}

const contractValues = new Map();
for (const item of candidates.filter((item) => item.atomic)) {
  const key = [item.owner, item.property, item.state ?? "default"].join("\0");
  if (!contractValues.has(key)) contractValues.set(key, new Set());
  contractValues.get(key).add(item.physicalValue);
}
const groups = new Map();
for (const item of candidates) {
  const key = item.atomic
    ? [item.owner, item.property, item.state ?? "default", item.physicalValue].join("\0")
    : [item.occurrence.occurrenceId, item.adapter].join("\0");
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(item);
}

const refConfig = env.ref("run-config", runConfigPath, {
  relativeTo: path.dirname(runConfigPath),
});
const refDesign = env.ref("design-occurrence", classifiedPath, {
  relativeTo: path.dirname(runConfigPath),
});
const packets = [];
const proposals = [];
for (const [key, items] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const sample = items[0];
  const owner = slug(sample.owner);
  const property = slug(sample.property);
  const state = slug(sample.state);
  const contractKey = [sample.owner, sample.property, sample.state ?? "default"].join("\0");
  const variants = contractValues.get(contractKey)?.size ?? 0;
  const proposedName = owner && property && sample.atomic
    ? ["component", owner, property, ...(state ? [state] : [])].join(".")
    : null;
  const blockers = [
    !sample.atomic ? "expressao nao atomica" : null,
    !owner ? "owner ausente" : null,
    !property ? "propriedade ausente" : null,
    variants > 1 && !state
      ? `${variants} valores para o mesmo owner+property sem estado/variante que os nomeie`
      : null,
    items.length < 2 ? "sem reutilizacao: um token para um unico callsite nao atinge breakeven" : null,
  ].filter(Boolean);
  const confidence = confidenceEvidence({
    signals: [
      { name: "owner", weight: 25, score: owner ? 1 : 0, note: owner ? `owner ${owner}` : "owner ausente" },
      { name: "property", weight: 25, score: property ? 1 : 0, note: property ? `propriedade ${property}` : "propriedade ausente" },
      { name: "atomicidade", weight: 20, score: sample.atomic ? 1 : 0, note: sample.atomic ? "um valor AST atomico" : "expressao composta/opaca" },
      { name: "contrato-univoco", weight: 20, score: variants === 1 ? 1 : 0, note: `${variants} valor(es) no contrato owner+property+state` },
      { name: "recorrencia", weight: 10, score: Math.min(1, items.length / 2), note: `${items.length} ocorrencia(s)` },
    ],
    blockers,
  });
  const clusterId = `value-${fingerprint(key).slice(0, 20)}`;
  const occurrenceIds = [...new Set(items.map((item) => item.occurrence.occurrenceId))].sort();
  const byAdapter = new Map();
  for (const item of items) {
    if (!byAdapter.has(item.adapter)) byAdapter.set(item.adapter, []);
    byAdapter.get(item.adapter).push(item);
  }
  packets.push({
    ...env.header("cluster-packet"),
    clusterId,
    occurrenceIds,
    contextFingerprint: fingerprint({ owner, property, state, axis: sample.axis }),
    styleVariants: [...byAdapter.entries()].map(([adapter, adapterItems]) => ({
      styleFingerprint: fingerprint({ value: sample.physicalValue, adapter }),
      rawValues: [...new Set(adapterItems.map((item) => String(item.replacementRaw)))].sort(),
      frequency: adapterItems.length,
      locations: adapterItems.slice(0, 64).map(({ occurrence }) => occurrence.location),
      equivalenceLevel: sample.atomic ? "EXACT_SET" : "UNKNOWN",
    })),
    evidenceRefs: [refConfig, refDesign],
    classificationStatus: confidence.band === "high" ? "classified" : "requires-human",
    confidence,
  });
  proposals.push({
    clusterId,
    proposedName,
    axis: sample.axis,
    property: sample.property,
    physicalValue: sample.physicalValue,
    adapter: sample.adapter,
    adapters: [...byAdapter.keys()].sort(),
    occurrenceIds,
    plannedFiles: [...new Set(items.map((item) => item.occurrence.location.file))].sort(),
    confidence,
  });
}

mkdirSync(outDir, { recursive: true });
const packetPath = path.join(outDir, "value-cluster-packets.ndjson");
const proposalPath = path.join(outDir, "value-proposals.json");
writeFileSync(packetPath, `${packets.map((packet) => JSON.stringify(packet)).join("\n")}\n`);
writeFileSync(proposalPath, `${JSON.stringify({ schemaVersion: "value-proposals.v1", proposals }, null, 2)}\n`);
const high = packets.filter((packet) => packet.confidence.band === "high");
const low = packets.filter((packet) => packet.confidence.band === "low");
const report = {
  ...env.header("inventory-report"),
  reportId: "classified/design-values",
  inventoryKind: "hardcodes",
  inputArtifactRefs: [refConfig, refDesign],
  counts: {
    population: design.length,
    violations: candidates.length,
    clusters: packets.length,
    classified: high.length,
    requiresHuman: low.length,
    unapprovedResidual: candidates.length,
  },
  scope: {
    occurrenceKinds: [...new Set(candidates.map((item) => item.occurrence.occurrenceKind))].sort(),
    criterion: "folha classificada nao-terminal; alta confianca exige owner+property+valor AST atomico+contrato univoco",
    note: low.length ? "banda baixa preservada para decisao depois de esgotar a fila alta" : null,
  },
  detailArtifactRefs: [env.ref("cluster-packet", packetPath, { relativeTo: path.dirname(runConfigPath) })],
  reconciled: low.length === 0,
};
writeFileSync(path.join(outDir, "inventory-design-values.json"), `${JSON.stringify(report, null, 2)}\n`);

const summary = {
  population: design.length,
  candidates: candidates.length,
  clusters: packets.length,
  high: high.length,
  low: low.length,
  packets: packetPath,
  proposals: proposalPath,
};
if (argv.includes("--json")) console.log(JSON.stringify(summary, null, 2));
else console.log(`VALUE CLUSTERS: ${packets.length} — ${high.length} high, ${low.length} low`);
process.exit(low.length ? 2 : 0);
