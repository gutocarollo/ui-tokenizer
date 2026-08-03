#!/usr/bin/env node
/**
 * APPLY AST de um lote de valor. Suporta inicialmente os dois adapters cuja
 * equivalencia pode ser provada sem reimprimir o arquivo: initializer atomico
 * de React style e utility arbitraria dentro de className.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { envelopeFrom } from "../../../../scripts/lib/artifact-envelope.mjs";
import { applicationRelativePathspecs } from "../../../../scripts/lib/git-pathspecs.mjs";
import { fingerprintSourceRoots } from "../../../../scripts/lib/source-fingerprint.mjs";

const argv = process.argv.slice(2);
const arg = (flag, fallback = null) => {
  const index = argv.indexOf(flag);
  return index >= 0 ? (argv[index + 1] ?? fallback) : fallback;
};
const fail = (message) => {
  throw new Error(`APPLY recusado: ${message}`);
};
const applicationRoot = path.resolve(arg("--root", process.cwd()));
const runConfigPath = path.resolve(arg("--run-config") ?? fail("--run-config e obrigatorio"));
const runRoot = path.resolve(arg("--run-root") ?? fail("--run-root e obrigatorio"));
const batchId = arg("--batch") ?? fail("--batch e obrigatorio");
const artifacts = path.join(runRoot, "artifacts");
const batchPath = path.join(artifacts, `batch-${batchId}.json`);
const planPath = path.join(artifacts, `apply-${batchId}.json`);
const classifiedPath = path.join(artifacts, "classified-design-occurrences.ndjson");
const normalizedPath = path.join(artifacts, "normalized-occurrences.ndjson");
for (const file of [runConfigPath, batchPath, planPath, classifiedPath, normalizedPath]) {
  if (!existsSync(file)) fail(`insumo ausente: ${file}`);
}

const env = envelopeFrom(runConfigPath, { applicationRoot });
const batch = JSON.parse(readFileSync(batchPath, "utf8"));
const applyPlan = JSON.parse(readFileSync(planPath, "utf8"));
const proposal = applyPlan.proposal;
if (batch.batchId !== batchId || applyPlan.batchId !== batchId) fail("batchId diverge entre contrato e plano");
if (batch.rollbackSourceFingerprint !== env.sourceFingerprint) fail("rollback do lote nao aponta para a ancora");
if (proposal.confidence?.band !== "high" || proposal.confidence?.blockers?.length) {
  fail("somente cluster high sem blocker pode entrar no APPLY");
}
const adapters = proposal.adapters ?? [proposal.adapter];
const unsupported = adapters.filter((adapter) => !["inline-style", "utility-class"].includes(adapter));
if (unsupported.length) fail(`adapter sem codemod comprovado: ${unsupported.join(", ")}`);

const measuredBefore = fingerprintSourceRoots({
  applicationRoot,
  sourceRoots: env.config.sourceRoots ?? ["src"],
});
if (measuredBefore.fingerprint !== batch.rollbackSourceFingerprint) {
  fail("fonte atual nao coincide com rollbackSourceFingerprint");
}

const git = (...args) => execFileSync("git", ["-C", applicationRoot, ...args], { encoding: "utf8" }).trim();
if (git("status", "--porcelain")) fail("arvore do alvo precisa estar limpa antes de criar branch do lote");
if (git("rev-parse", "HEAD") !== applyPlan.baseCommit) fail("HEAD nao e o baseCommit congelado no lote");
const branch = `tokenize/${env.runId}/${batchId.toLowerCase()}`;
const existingBranches = git("branch", "--list", branch);
if (existingBranches) fail(`branch ja existe: ${branch}`);
git("switch", "-c", branch);

const parseNdjson = (file) =>
  readFileSync(file, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
const wanted = new Set(proposal.occurrenceIds);
const occurrences = parseNdjson(classifiedPath).filter(
  (item) => wanted.has(item.occurrenceId) && item.recordStage === "classified"
);
if (occurrences.length !== wanted.size) {
  fail(`plano cita ${wanted.size} ocorrencias, mas ${occurrences.length} folhas foram encontradas`);
}
const normalized = new Map(
  parseNdjson(normalizedPath).map((item) => [item.designOccurrenceId, item])
);

const requireFromTarget = createRequire(path.join(applicationRoot, "package.json"));
let ts;
try {
  ts = requireFromTarget("typescript");
} catch (error) {
  fail(`TypeScript do alvo indisponivel: ${error instanceof Error ? error.message : String(error)}`);
}
const scriptKind = (file) =>
  file.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : file.endsWith(".jsx")
      ? ts.ScriptKind.JSX
      : file.endsWith(".ts")
        ? ts.ScriptKind.TS
        : ts.ScriptKind.JS;
const lineColumn = (sourceFile, position) => {
  const value = sourceFile.getLineAndCharacterOfPosition(position);
  return { line: value.line + 1, column: value.character + 1 };
};
const sourceText = (node, sourceFile) => node.getText(sourceFile);
const sameLocation = (node, sourceFile, occurrence) => {
  const location = lineColumn(sourceFile, node.getStart(sourceFile));
  return location.line === occurrence.location.line && location.column === occurrence.location.column;
};

const UNITLESS = new Set([
  "fontWeight",
  "font-weight",
  "lineHeight",
  "line-height",
  "opacity",
  "zIndex",
  "z-index",
  "scale",
]);
function cssValue() {
  const raw = String(proposal.physicalValue).trim();
  if (/^-?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(raw) && !UNITLESS.has(proposal.property)) {
    return `${raw}px`;
  }
  return raw;
}
const value = cssValue();
const nameParts = proposal.proposedName.split(".").map((part) => part.replace(/[^a-z0-9-]/gi, "-").toLowerCase());
const cssVariable = `--${[proposal.axis, ...nameParts].join("-")}`;
const cssReference = `var(${cssVariable})`;

const changesByFile = new Map();
for (const occurrence of occurrences) {
  const absolute = path.join(applicationRoot, occurrence.location.file);
  if (!existsSync(absolute)) fail(`callsite ausente: ${occurrence.location.file}`);
  if (!changesByFile.has(absolute)) changesByFile.set(absolute, []);
  changesByFile.get(absolute).push(occurrence);
}

const changedSourceFiles = [];
for (const [absolute, fileOccurrences] of changesByFile) {
  const original = readFileSync(absolute, "utf8");
  const sourceFile = ts.createSourceFile(
    path.relative(applicationRoot, absolute),
    original,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(absolute)
  );
  const edits = [];
  for (const occurrence of fileOccurrences) {
    if (occurrence.occurrenceKind === "inline-style") {
      let found = null;
      const visit = (node) => {
        if (found) return;
        if (
          sameLocation(node, sourceFile, occurrence) &&
          sourceText(node, sourceFile) === occurrence.rawValue
        ) {
          found = node;
          return;
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
      if (!found) {
        fail(`initializer AST nao encontrado em ${occurrence.location.file}:${occurrence.location.line}:${occurrence.location.column}`);
      }
      const raw = occurrence.rawValue;
      const quote = raw.startsWith('"') ? '"' : "'";
      edits.push({ start: found.getStart(sourceFile), end: found.getEnd(), replacement: `${quote}${cssReference}${quote}`, occurrenceId: occurrence.occurrenceId });
      continue;
    }
    if (occurrence.occurrenceKind === "utility-class") {
      const projection = normalized.get(occurrence.occurrenceId);
      const candidate = (projection?.candidates ?? []).find((item) => {
        const inner = String(item.value ?? "");
        return /^\[.*\]$/s.test(inner) && inner.slice(1, -1).trim() === proposal.physicalValue;
      });
      if (!candidate) fail(`candidate arbitrario do cluster nao encontrado em ${occurrence.occurrenceId}`);
      let found = null;
      const visit = (node) => {
        if (found) return;
        if (
          (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
          lineColumn(sourceFile, node.getStart(sourceFile)).line === occurrence.location.line &&
          sourceText(node, sourceFile).includes(candidate.raw)
        ) {
          found = node;
          return;
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
      if (!found) fail(`literal de classe nao encontrado em ${occurrence.location.file}:${occurrence.location.line}`);
      const text = sourceText(found, sourceFile);
      const replacementCandidate = candidate.raw.replace(/\[[\s\S]*\]/u, `[${cssReference}]`);
      edits.push({
        start: found.getStart(sourceFile),
        end: found.getEnd(),
        replacement: text.replace(candidate.raw, replacementCandidate),
        occurrenceId: occurrence.occurrenceId,
      });
    }
  }
  edits.sort((a, b) => b.start - a.start);
  for (let index = 1; index < edits.length; index += 1) {
    if (edits[index - 1].start < edits[index].end) fail(`edits sobrepostos em ${absolute}`);
  }
  let updated = original;
  for (const edit of edits) updated = updated.slice(0, edit.start) + edit.replacement + updated.slice(edit.end);
  if (updated === original) fail(`codemod nao alterou ${absolute}`);
  writeFileSync(absolute, updated);
  changedSourceFiles.push(path.relative(applicationRoot, absolute).split(path.sep).join("/"));
}

const tokenFile = path.join(applicationRoot, applyPlan.tokenFile);
const dtcg = JSON.parse(readFileSync(tokenFile, "utf8"));
let cursor = dtcg;
const tokenPath = [proposal.axis, ...nameParts];
for (const segment of tokenPath) {
  cursor[segment] = cursor[segment] ?? {};
  cursor = cursor[segment];
}
const type = proposal.axis === "color"
  ? "color"
  : ["opacity", "z-index"].includes(proposal.axis) || UNITLESS.has(proposal.property)
    ? "number"
    : /^(?:-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem))$/u.test(value)
      ? "dimension"
      : "string";
const dtcgValue = type === "dimension"
  ? (() => {
      const match = value.match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))(px|rem|em|%|vh|vw|vmin|vmax|ch|ex)$/u);
      if (!match) fail(`dimensao DTCG sem unidade reconhecida: ${value}`);
      return { value: Number(match[1]), unit: match[2] };
    })()
  : value;
if (
  Object.hasOwn(cursor, "$value") &&
  JSON.stringify(cursor.$value) !== JSON.stringify(dtcgValue)
) {
  fail(`token ${tokenPath.join(".")} ja existe com outro valor`);
}
cursor.$type = cursor.$type ?? type;
cursor.$value = cursor.$value ?? dtcgValue;
cursor.$description = cursor.$description ?? `${proposal.occurrenceIds.length} callsites; lote ${batchId}; preserva ${value}`;
writeFileSync(tokenFile, `${JSON.stringify(dtcg, null, 2)}\n`);

const packageManager = existsSync(path.join(applicationRoot, "pnpm-lock.yaml"))
  ? ["pnpm", ["run", "tokens:build"]]
  : existsSync(path.join(applicationRoot, "yarn.lock"))
    ? ["yarn", ["tokens:build"]]
    : ["npm", ["run", "tokens:build"]];
const built = spawnSync(packageManager[0], packageManager[1], {
  cwd: applicationRoot,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
if (built.status !== 0) fail(`tokens:build falhou: ${built.stderr || built.stdout}`);
const themeFile = path.join(applicationRoot, applyPlan.themeFile);
if (!existsSync(themeFile) || !readFileSync(themeFile, "utf8").includes(`${cssVariable}:`)) {
  fail(`CSS gerado nao contem ${cssVariable}`);
}

const measuredAfter = fingerprintSourceRoots({
  applicationRoot,
  sourceRoots: env.config.sourceRoots ?? ["src"],
});
if (!measuredAfter.fingerprint || measuredAfter.fingerprint === measuredBefore.fingerprint) {
  fail("fingerprint da fonte nao mudou depois do codemod");
}
const actualMutationFiles = [
  ...changedSourceFiles,
  applyPlan.tokenFile,
  applyPlan.themeFile,
].filter((value, index, all) => all.indexOf(value) === index).sort();
for (const file of actualMutationFiles) {
  if (!batch.plannedFiles.includes(file)) fail(`mutacao fora do lote: ${file}`);
}
const manifest = {
  ...env.measuredHeader("mutation-manifest"),
  batchId,
  beforeSourceFingerprint: measuredBefore.fingerprint,
  afterSourceFingerprint: measuredAfter.fingerprint,
  actualMutationFiles,
  changes: actualMutationFiles.map((file) => ({
    file,
    changeType: file === applyPlan.tokenFile
      ? "token-definition"
      : file === applyPlan.themeFile
        ? "generated-artifact"
        : "callsite",
    decisionIds: batch.decisionIds,
  })),
  generatedArtifactRefs: [],
};
mkdirSync(path.join(artifacts, batchId), { recursive: true });
const manifestPath = path.join(artifacts, batchId, "mutation-manifest.json");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

// `git` executa com `-C applicationRoot`; portanto os pathspecs também são
// relativos ao app. Converter para a raiz Git duplicava o prefixo em monorepos
// (`frontend/frontend/...`) e deixava a mutação pronta, mas sem commit.
const gitPathspecs = applicationRelativePathspecs(
  applicationRoot,
  actualMutationFiles.map((file) => path.join(applicationRoot, file))
);
git("add", "--", ...gitPathspecs);
git("commit", "-m", `tokenize(${batchId}): ${proposal.proposedName}`);
const commit = git("rev-parse", "HEAD");
console.log(JSON.stringify({ batchId, branch, commit, cssVariable, value, occurrences: occurrences.length, files: actualMutationFiles, manifest: manifestPath }, null, 2));
