#!/usr/bin/env node
/** Congela um shard de clusters high, sem arquivo compartilhado, como APPLY reversível. */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { envelopeFrom } from "../../../../scripts/lib/artifact-envelope.mjs";
import { fingerprintSourceRoots } from "../../../../scripts/lib/source-fingerprint.mjs";
import {
  analyzeRouteImpact,
  changedFilesFromArgs,
} from "../../../../scripts/lib/route-impact.mjs";
import { generationArtifactsDir } from "./lib/active-generation.mjs";
import {
  eligibleValueProposals,
  partitionRouteReachableProposals,
  scenarioIdsForAffectedRoutes,
  selectReversibleShard,
} from "./lib/value-batch-sharding.mjs";

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
const proposalArgument = arg("--proposals");
const packetArgument = arg("--packets");
const outDir = path.resolve(arg("--out", path.join(runRoot, "artifacts")));
const batchId = arg("--batch", "B0001");
const maxFiles = Number(arg("--max-files", "20"));
if (!/^B\d{4,}$/u.test(batchId)) fail(`batchId invalido: ${batchId}`);
if (!Number.isInteger(maxFiles) || maxFiles <= 0) {
  fail(`--max-files precisa ser inteiro positivo: ${arg("--max-files")}`);
}
if (!existsSync(runConfigPath)) fail(`insumo ausente: ${runConfigPath}`);

const env = envelopeFrom(runConfigPath);
const statePath = path.join(runRoot, "state.json");
if (!existsSync(statePath)) fail(`state duravel ausente: ${statePath}`);
const state = JSON.parse(readFileSync(statePath, "utf8"));
const activeSourceFingerprint = state.sourceFingerprint;
if (!/^[a-f0-9]{64}$/u.test(activeSourceFingerprint ?? "")) {
  fail("state.json sem sourceFingerprint ativo valido");
}
const generationArtifacts = generationArtifactsDir({
  runRoot,
  configuredSourceFingerprint: env.sourceFingerprint,
  activeSourceFingerprint,
});
const proposalPath = path.resolve(
  proposalArgument ?? path.join(generationArtifacts, "value-proposals.json")
);
const packetPath = path.resolve(
  packetArgument ?? path.join(generationArtifacts, "value-cluster-packets.ndjson")
);
for (const file of [proposalPath, packetPath]) {
  if (!existsSync(file)) fail(`insumo da geracao ativa ausente: ${file}`);
}
const measured = fingerprintSourceRoots({
  applicationRoot,
  sourceRoots: env.config.sourceRoots ?? ["src"],
});
if (measured.fingerprint !== activeSourceFingerprint) {
  fail(`fonte divergiu do state ativo (${activeSourceFingerprint.slice(0, 12)} != ${measured.fingerprint?.slice(0, 12)})`);
}
const activeHeader = (artifactType) => ({
  ...env.header(artifactType),
  sourceFingerprint: activeSourceFingerprint,
});
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
const eligible = eligibleValueProposals(proposals);
const candidateFiles = [
  ...new Set(eligible.flatMap((proposal) => proposal.plannedFiles)),
].sort();
const routeImpact = analyzeRouteImpact({
  frontendRoot: applicationRoot,
  changedFiles: changedFilesFromArgs({
    frontendRoot: applicationRoot,
    files: [candidateFiles.join(",")],
    includeWorkingTree: false,
  }),
  sourceRoots: env.config.sourceRoots ?? ["src"],
});
const routePartition = partitionRouteReachableProposals(
  eligible,
  routeImpact.changedFiles
);
const routeEligible = routePartition.reachable;
const requestedProposal = requested
  ? routeEligible.find((item) => item.clusterId === requested)
  : null;
if (requested && !requestedProposal) {
  const routeGap = routePartition.unreachable.find(
    ({ proposal }) => proposal.clusterId === requested
  );
  fail(
    routeGap
      ? `cluster ${requested} sem consumidor visual comprovado em ${routeGap.uncoveredFiles.join(",")}`
      : `cluster ${requested} nao e high/elegivel`
  );
}
const shard = selectReversibleShard(
  requestedProposal ? [requestedProposal] : routeEligible,
  { maxFiles }
);
const selected = shard.selected;
if (!selected.length) fail("fila high vazia");
// O impacto usado para descobrir quais propostas possuem consumidor pode ser
// calculado sobre toda a fila elegivel. A politica do batch, contudo, pertence
// somente ao shard selecionado. Reusar `routeImpact` aqui fazia a politica
// declarar rotas de clusters deferidos (55 cenarios) enquanto BEFORE/AFTER
// materializavam os 53 cenarios dos 20 callsites realmente congelados.
const selectedFiles = [
  ...new Set(selected.flatMap((proposal) => proposal.plannedFiles)),
].sort();
const selectedRouteImpact = analyzeRouteImpact({
  frontendRoot: applicationRoot,
  changedFiles: changedFilesFromArgs({
    frontendRoot: applicationRoot,
    files: [selectedFiles.join(",")],
    includeWorkingTree: false,
  }),
  sourceRoots: env.config.sourceRoots ?? ["src"],
});

const packetRef = env.ref("cluster-packet", packetPath, { relativeTo: runRoot });
const configRef = env.ref("run-config", runConfigPath, { relativeTo: runRoot });
const decisions = selected.map((proposal, index) => ({
  ...activeHeader("decision"),
  decisionId: `${batchId}-D${String(index + 1).padStart(4, "0")}`,
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
    costDelta: "um token de componente e um codemod AST dentro de shard isolado por arquivo",
    breakeven: "atingido em 2 callsites; este cluster tem " + proposal.occurrenceIds.length,
    nonAdoptionCondition: "nao adotar se build, tipos ou comparacao visual divergirem",
    reversibility: `total pelo commit base ${gitHead}`,
    localPatternFit: [proposal.proposedName, `adapter ${proposal.adapters?.join(",") ?? proposal.adapter}`],
  },
  evidenceRefs: [configRef, packetRef],
}));

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
  ...selected.flatMap((proposal) => proposal.plannedFiles),
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
const axes = [...new Set(selected.map((proposal) => proposal.axis))].sort();
const targetCardinalities = Object.fromEntries(
  axes.map((axis) => [
    `scaleCardinality:${axis}`,
    leafCount(dtcg[axis]) + selected.filter((proposal) => proposal.axis === axis).length,
  ])
);

const scenariosPath = path.join(applicationRoot, "tests/visual/scenarios.json");
if (!existsSync(scenariosPath)) {
  fail("tests/visual/scenarios.json ausente; materialize o registro visual antes de congelar o lote");
}
const scenarios = JSON.parse(readFileSync(scenariosPath, "utf8"));
const scenarioIds = scenarioIdsForAffectedRoutes(
  scenarios.scenarios ?? [],
  selectedRouteImpact.affectedRoutes
);
if (!scenarioIds.length) fail("registro visual nao contem scenarioId");

const batch = {
  ...activeHeader("batch-contract"),
  batchId,
  targetClusterIds: selected.map((proposal) => proposal.clusterId),
  decisionIds: decisions.map((decision) => decision.decisionId),
  plannedFiles,
  expectedVisualEffect: "preserve",
  expectedChangedScenarioIds: [],
  expectedUnchangedScenarioIds: scenarioIds,
  absoluteTargets: {
    contractsInBatch: selected.length,
    occurrencesMigrated: selected.reduce(
      (sum, proposal) => sum + proposal.occurrenceIds.length,
      0
    ),
    filesTouched: plannedFiles.length,
    ...targetCardinalities,
  },
  rollbackSourceFingerprint: activeSourceFingerprint,
};

mkdirSync(outDir, { recursive: true });
const decisionsPath = path.join(outDir, `decisions-${batchId}.ndjson`);
const batchPath = path.join(outDir, `batch-${batchId}.json`);
const applyPlanPath = path.join(outDir, `apply-${batchId}.json`);
writeFileSync(
  decisionsPath,
  `${decisions.map((decision) => JSON.stringify(decision)).join("\n")}\n`
);
writeFileSync(batchPath, `${JSON.stringify(batch, null, 2)}\n`);
writeFileSync(applyPlanPath, `${JSON.stringify({
  schemaVersion: "value-apply-plan.v2",
  batchId,
  baseCommit: gitHead,
  proposals: selected,
  ...(selected.length === 1 ? { proposal: selected[0] } : {}),
  tokenFile,
  themeFile,
}, null, 2)}\n`);
console.log(JSON.stringify({
  batchId,
  clusters: selected.map((proposal) => proposal.clusterId),
  names: selected.map((proposal) => proposal.proposedName),
  occurrences: batch.absoluteTargets.occurrencesMigrated,
  sourceFiles: shard.files?.length ?? new Set(selected.flatMap((proposal) => proposal.plannedFiles)).size,
  files: plannedFiles.length,
  deferredEligible: shard.deferred.length,
  deferredWithoutVisualConsumer: routePartition.unreachable.length,
  deferredWithoutVisualConsumerFiles: [
    ...new Set(routePartition.unreachable.flatMap(({ uncoveredFiles }) => uncoveredFiles)),
  ].sort(),
  decisionsPath,
  batchPath,
  applyPlanPath,
}, null, 2));
