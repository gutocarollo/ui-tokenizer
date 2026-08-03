#!/usr/bin/env node
/** Congela um cluster de valor high como lote reversivel de APPLY. */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { envelopeFrom } from "../../../../scripts/lib/artifact-envelope.mjs";
import { fingerprintSourceRoots } from "../../../../scripts/lib/source-fingerprint.mjs";

const argv = process.argv.slice(2);
const arg = (flag, fallback = null) => {
  const index = argv.indexOf(flag);
  return index >= 0 ? (argv[index + 1] ?? fallback) : fallback;
};
const fail = (message) => {
  throw new Error(`VALUE BATCH recusado: ${message}`);
};
const applicationRoot = path.resolve(arg("--root", process.cwd()));
const runConfigPath = path.resolve(arg("--run-config") ?? fail("--run-config e obrigatorio"));
const runRoot = path.resolve(arg("--run-root") ?? fail("--run-root e obrigatorio"));
const proposalPath = path.resolve(arg("--proposals", path.join(runRoot, "artifacts/value-proposals.json")));
const packetPath = path.resolve(arg("--packets", path.join(runRoot, "artifacts/value-cluster-packets.ndjson")));
const outDir = path.resolve(arg("--out", path.join(runRoot, "artifacts")));
const batchId = arg("--batch", "B0001");
if (!/^B\d{4,}$/u.test(batchId)) fail(`batchId invalido: ${batchId}`);
for (const file of [runConfigPath, proposalPath, packetPath]) {
  if (!existsSync(file)) fail(`insumo ausente: ${file}`);
}

const env = envelopeFrom(runConfigPath);
const measured = fingerprintSourceRoots({
  applicationRoot,
  sourceRoots: env.config.sourceRoots ?? ["src"],
});
if (measured.fingerprint !== env.sourceFingerprint) {
  fail(`fonte divergiu da ancora (${env.sourceFingerprint.slice(0, 12)} != ${measured.fingerprint?.slice(0, 12)})`);
}
const git = (...args) => execFileSync("git", ["-C", applicationRoot, ...args], { encoding: "utf8" }).trim();
let gitHead;
try {
  gitHead = git("rev-parse", "HEAD");
  if (git("status", "--porcelain")) fail("arvore git do alvo esta suja; rollback nao seria restauravel");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const proposals = JSON.parse(readFileSync(proposalPath, "utf8")).proposals ?? [];
const requested = arg("--cluster");
const eligible = proposals
  .filter(
    (proposal) =>
      proposal.confidence?.band === "high" &&
      proposal.proposedName &&
      (proposal.adapters ?? [proposal.adapter]).every((adapter) =>
        ["inline-style", "utility-class"].includes(adapter)
      )
  )
  .sort(
    (a, b) =>
      b.occurrenceIds.length - a.occurrenceIds.length ||
      a.clusterId.localeCompare(b.clusterId)
  );
const proposal = requested
  ? eligible.find((item) => item.clusterId === requested)
  : eligible[0];
if (!proposal) fail(requested ? `cluster ${requested} nao e high/elegivel` : "fila high vazia");

const packetRef = env.ref("cluster-packet", packetPath, { relativeTo: runRoot });
const configRef = env.ref("run-config", runConfigPath, { relativeTo: runRoot });
const decisionId = `${batchId}-D0001`;
const decision = {
  ...env.header("decision"),
  decisionId,
  clusterIds: [proposal.clusterId],
  classification: "component-token",
  status: "approved",
  proposal: { name: proposal.proposedName, axis: proposal.axis, exception: false },
  rationale:
    `confiança ${proposal.confidence.score}/${proposal.confidence.threshold}; ` +
    `${proposal.occurrenceIds.length} callsites repetem o mesmo valor fisico ` +
    `em ${proposal.proposedName}. O nome deriva de owner+property+state.`,
  decidedBy: "llm",
  tradeoff: {
    qualityDelta: `${proposal.occurrenceIds.length} callsites passam a uma fonte DTCG unica`,
    costDelta: "um token de componente, um codemod AST e um commit isolado",
    breakeven: "atingido em 2 callsites; este cluster tem " + proposal.occurrenceIds.length,
    nonAdoptionCondition: "nao adotar se build, tipos ou comparacao visual divergirem",
    reversibility: `total pelo commit base ${gitHead}`,
    localPatternFit: [proposal.proposedName, `adapter ${proposal.adapters?.join(",") ?? proposal.adapter}`],
  },
  evidenceRefs: [configRef, packetRef],
};

const tokenConfigPath = [
  path.join(applicationRoot, "tokenization.config.json"),
  path.join(applicationRoot, "tokens/tokenization.config.json"),
].find(existsSync);
const tokenConfig = tokenConfigPath && existsSync(tokenConfigPath)
  ? JSON.parse(readFileSync(tokenConfigPath, "utf8"))
  : {};
const tokenFile = tokenConfig.tokenFile ?? "tokens/color.tokens.json";
const themeFile = tokenConfig.themeFile ?? "app/styles/generated/theme.css";
const plannedFiles = [
  ...proposal.plannedFiles,
  tokenFile,
  themeFile,
].filter((value, index, all) => value && all.indexOf(value) === index).sort();

function leafCount(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return 0;
  if (Object.hasOwn(node, "$value")) return 1;
  return Object.entries(node)
    .filter(([key]) => !key.startsWith("$"))
    .reduce((sum, [, value]) => sum + leafCount(value), 0);
}
const dtcg = JSON.parse(readFileSync(path.join(applicationRoot, tokenFile), "utf8"));
const targetCardinality = leafCount(dtcg[proposal.axis]) + 1;

const scenariosPath = path.join(applicationRoot, "tests/visual/scenarios.json");
if (!existsSync(scenariosPath)) {
  fail("tests/visual/scenarios.json ausente; materialize o registro visual antes de congelar o lote");
}
const scenarios = JSON.parse(readFileSync(scenariosPath, "utf8"));
const scenarioIds = [...new Set((scenarios.scenarios ?? []).map((item) => item.scenarioId).filter(Boolean))].sort();
if (!scenarioIds.length) fail("registro visual nao contem scenarioId");

const batch = {
  ...env.header("batch-contract"),
  batchId,
  targetClusterIds: [proposal.clusterId],
  decisionIds: [decisionId],
  plannedFiles,
  expectedVisualEffect: "preserve",
  expectedChangedScenarioIds: [],
  expectedUnchangedScenarioIds: scenarioIds,
  absoluteTargets: {
    contractsInBatch: 1,
    occurrencesMigrated: proposal.occurrenceIds.length,
    filesTouched: plannedFiles.length,
    [`scaleCardinality:${proposal.axis}`]: targetCardinality,
  },
  rollbackSourceFingerprint: env.sourceFingerprint,
};

mkdirSync(outDir, { recursive: true });
const decisionsPath = path.join(outDir, `decisions-${batchId}.ndjson`);
const batchPath = path.join(outDir, `batch-${batchId}.json`);
const applyPlanPath = path.join(outDir, `apply-${batchId}.json`);
writeFileSync(decisionsPath, `${JSON.stringify(decision)}\n`);
writeFileSync(batchPath, `${JSON.stringify(batch, null, 2)}\n`);
writeFileSync(applyPlanPath, `${JSON.stringify({
  schemaVersion: "value-apply-plan.v1",
  batchId,
  baseCommit: gitHead,
  proposal,
  tokenFile,
  themeFile,
}, null, 2)}\n`);
console.log(JSON.stringify({ batchId, clusterId: proposal.clusterId, name: proposal.proposedName, occurrences: proposal.occurrenceIds.length, files: plannedFiles.length, decisionsPath, batchPath, applyPlanPath }, null, 2));
