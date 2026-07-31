#!/usr/bin/env node

import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256Bytes } from "./lib/artifact-contract.mjs";
import { evaluateAbsoluteCompletion } from "./lib/absolute-completion.mjs";

function usage() {
  return `Usage:
  node evaluate-absolute-completion.mjs \\
    --root <application-root> \\
    --run-root <run-root> \\
    [--matrix <final/evidence-manifest.json>] \\
    [--checks <final/deterministic-checks.json>] \\
    [--review <final/adversarial-review.json>] \\
    [--report <final/completion-report.json|ndjson> ...] \\
    [--out <final-proof.json>] \\
    [--gap-report <final-proof.gaps.json>]

The evaluator writes final-proof.json only when all 24 Section 14 predicates
have fresh, non-vacuous, absolute evidence and the complete artifact set passes.
Otherwise it writes an honest gap report and exits nonzero.`;
}

function parseArgs(argv) {
  const options = { report: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") {
      options.help = true;
      continue;
    }
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${token}`);
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${token}`);
    }
    index += 1;
    if (key === "report") options.report.push(value);
    else options[key] = value;
  }
  return options;
}

function requireOption(options, key) {
  if (!options[key]) throw new Error(`Missing required option --${key}`);
  return options[key];
}

function requireWithinRunRoot(runRoot, filePath, label) {
  const relative = path.relative(runRoot, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must remain inside --run-root: ${filePath}`);
  }
}

function fsyncDirectory(directory) {
  const descriptor = openSync(directory, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function atomicWriteJson(filePath, value) {
  const absolute = path.resolve(filePath);
  const directory = path.dirname(absolute);
  mkdirSync(directory, { recursive: true });
  const temporary = path.join(
    directory,
    `.${path.basename(absolute)}.${process.pid}.${randomBytes(8).toString(
      "hex"
    )}.tmp`
  );
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  const descriptor = openSync(temporary, "wx", 0o600);
  try {
    writeSync(descriptor, bytes);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  renameSync(temporary, absolute);
  fsyncDirectory(directory);
}

function archiveCanonicalProof(outPath) {
  const absolute = path.resolve(outPath);
  if (!existsSync(absolute)) return null;
  const bytes = readFileSync(absolute);
  const directory = path.dirname(absolute);
  const archiveDirectory = path.join(
    directory,
    `.${path.basename(absolute)}.archive`
  );
  const archivePath = path.join(
    archiveDirectory,
    `${sha256Bytes(bytes)}.invalidated`
  );
  mkdirSync(archiveDirectory, { recursive: true });

  if (existsSync(archivePath)) {
    const archivedBytes = readFileSync(archivePath);
    if (!archivedBytes.equals(bytes)) {
      throw new Error(
        `Refusing to invalidate ${absolute}: deterministic archive collision at ${archivePath}`
      );
    }
    unlinkSync(absolute);
  } else {
    renameSync(absolute, archivePath);
  }
  fsyncDirectory(archiveDirectory);
  fsyncDirectory(directory);
  return archivePath;
}

function existingProofGeneratedAt(outPath) {
  if (!existsSync(outPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(outPath, "utf8"));
    return parsed?.artifactType === "final-proof" ? parsed.generatedAt : null;
  } catch {
    return null;
  }
}

function equivalentProof(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

export function runAbsoluteCompletionCli(argv) {
  const options = parseArgs(argv);
  if (options.help) return { help: usage(), exitCode: 0 };
  const applicationRoot = path.resolve(requireOption(options, "root"));
  const runRoot = path.resolve(requireOption(options, "run-root"));
  const outPath = path.resolve(
    options.out ?? path.join(runRoot, "final-proof.json")
  );
  const gapReportPath = path.resolve(
    options["gap-report"] ?? path.join(runRoot, "final-proof.gaps.json")
  );
  requireWithinRunRoot(runRoot, outPath, "--out");
  requireWithinRunRoot(runRoot, gapReportPath, "--gap-report");
  const generatedAt =
    existingProofGeneratedAt(outPath) ?? new Date().toISOString();
  let evaluation;
  try {
    evaluation = evaluateAbsoluteCompletion({
      applicationRoot,
      runRoot,
      finalMatrixPath: path.resolve(
        options.matrix ?? path.join(runRoot, "final", "evidence-manifest.json")
      ),
      finalChecksPath: path.resolve(
        options.checks ??
          path.join(runRoot, "final", "deterministic-checks.json")
      ),
      finalReviewPath: path.resolve(
        options.review ?? path.join(runRoot, "final", "adversarial-review.json")
      ),
      completionReportPaths:
        options.report.length > 0
          ? options.report.map((filePath) => path.resolve(filePath))
          : [path.join(runRoot, "final", "completion-reports.ndjson")],
      generatedAt,
    });
  } catch (error) {
    const archivedFinalProofPath = archiveCanonicalProof(outPath);
    if (archivedFinalProofPath) {
      error.archivedFinalProofPath = archivedFinalProofPath;
    }
    throw error;
  }

  const failedResult = () => {
    const archivedFinalProofPath = archiveCanonicalProof(outPath);
    evaluation.gapReport.invalidatedFinalProofArchive =
      archivedFinalProofPath === null
        ? null
        : path.relative(runRoot, archivedFinalProofPath).split(path.sep).join("/");
    atomicWriteJson(gapReportPath, evaluation.gapReport);
    return {
      completed: false,
      exitCode: 1,
      gapReportPath,
      finalProofPath: null,
      archivedFinalProofPath,
      summary: evaluation.gapReport.summary,
    };
  };

  if (!evaluation.completed) {
    return failedResult();
  }

  if (existsSync(outPath)) {
    let existing;
    try {
      existing = JSON.parse(readFileSync(outPath, "utf8"));
    } catch (error) {
      evaluation.gapReport.verdict = "pending";
      evaluation.gapReport.contractViolations.push(
        `Immutable final proof exists but cannot be parsed: ${error.message}`
      );
      return failedResult();
    }
    if (!equivalentProof(existing, evaluation.proof)) {
      evaluation.gapReport.verdict = "pending";
      evaluation.gapReport.contractViolations.push(
        "Immutable final-proof.json already exists with different bytes; refusing overwrite"
      );
      return failedResult();
    }
  } else {
    atomicWriteJson(outPath, evaluation.proof);
  }
  atomicWriteJson(gapReportPath, evaluation.gapReport);
  return {
    completed: true,
    exitCode: 0,
    gapReportPath,
    finalProofPath: outPath,
    summary: evaluation.gapReport.summary,
  };
}

const invokedAsScript =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedAsScript) {
  try {
    const result = runAbsoluteCompletionCli(process.argv.slice(2));
    if (result.help) {
      process.stdout.write(`${result.help}\n`);
    } else {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    }
    process.exitCode = result.exitCode;
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify(
        {
          error: error.name,
          message: error.message,
        },
        null,
        2
      )}\n`
    );
    process.exitCode = 1;
  }
}
