#!/usr/bin/env node

import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ArtifactContractError,
  artifactProjectionGroup,
  artifactProjectionResetGroups,
  createArtifactValidator,
  evidenceProjectionSlot,
  inferArtifactType,
  makeArtifactRef,
  nextForwardPhases,
  projectJournalArtifactRefs,
  readArtifactRecords,
  reentryCodeForArtifact,
  resolveArtifactRefPath,
  sha256Bytes,
  sha256CanonicalJson,
  validateArtifactSet,
  validateTransition,
} from "./lib/artifact-contract.mjs";

const JOURNAL_VERSION = "1.0.0";
const STATE_FILENAME = "state.json";
const CONFIG_FILENAME = "config.json";
const JOURNAL_FILENAME = "journal.ndjson";
const MODULE_PATH = fileURLToPath(import.meta.url);

function usage() {
  return `Usage:
  node tokenization-runner.mjs init --root <app> --run-root <run> --config <config.json>
  node tokenization-runner.mjs transition --root <app> --run-root <run> --to <PHASE>
    --reason <text> [--artifact <path> ...] [--batch <B0001>]
    [--source-fingerprint <sha256>] [--reentry-code <E-...>]
  node tokenization-runner.mjs validate --root <app> --run-root <run>
  node tokenization-runner.mjs resume --root <app> --run-root <run>
  node tokenization-runner.mjs status --root <app> --run-root <run>

The run journal is append-only. state.json is an atomic, recoverable snapshot.
Artifact paths supplied to transition must be immutable files inside --run-root.`;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { artifact: [] };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${token}`);
    }
    const key = token.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${token}`);
    }
    index += 1;
    if (key === "artifact") {
      options.artifact.push(value);
    } else {
      options[key] = value;
    }
  }
  return { command, options };
}

function requireOption(options, key) {
  const value = options[key];
  if (!value) throw new Error(`Missing required option --${key}`);
  return value;
}

function stateBytes(state) {
  return Buffer.from(`${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function fsyncDirectory(directory) {
  const descriptor = openSync(directory, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

export function atomicWriteJson(filePath, value) {
  const absolutePath = path.resolve(filePath);
  const directory = path.dirname(absolutePath);
  mkdirSync(directory, { recursive: true });
  const temporary = path.join(
    directory,
    `.${path.basename(absolutePath)}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`
  );
  const descriptor = openSync(temporary, "wx", 0o600);
  try {
    const bytes = stateBytes(value);
    writeSync(descriptor, bytes, 0, bytes.length);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  renameSync(temporary, absolutePath);
  fsyncDirectory(directory);
}

function journalPath(runRoot) {
  return path.join(runRoot, JOURNAL_FILENAME);
}

function statePath(runRoot) {
  return path.join(runRoot, STATE_FILENAME);
}

function configPath(runRoot) {
  return path.join(runRoot, CONFIG_FILENAME);
}

function parseJournal(runRoot) {
  const filePath = journalPath(runRoot);
  if (!existsSync(filePath)) return { records: [], corruptLines: [] };
  const text = readFileSync(filePath, "utf8");
  const records = [];
  const corruptLines = [];
  for (const [index, rawLine] of text.split(/\r?\n/u).entries()) {
    if (!rawLine.trim()) continue;
    try {
      records.push(JSON.parse(rawLine));
    } catch (error) {
      corruptLines.push({
        line: index + 1,
        message: error.message,
        finalLine: index === text.split(/\r?\n/u).length - 1,
      });
    }
  }
  return { records, corruptLines };
}

function appendJournalRecord(runRoot, record) {
  const filePath = journalPath(runRoot);
  mkdirSync(path.dirname(filePath), { recursive: true });
  let prefix = "";
  if (existsSync(filePath) && statSync(filePath).size > 0) {
    const bytes = readFileSync(filePath);
    if (bytes.at(-1) !== 0x0a) prefix = "\n";
  }
  const line = `${prefix}${JSON.stringify(record)}\n`;
  const descriptor = openSync(filePath, "a", 0o600);
  try {
    writeSync(descriptor, line);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  fsyncDirectory(path.dirname(filePath));
}

function journalRecord({
  eventSequence,
  operation,
  state,
  recoveredFromEventSequence = null,
}) {
  const bytes = stateBytes(state);
  return {
    journalVersion: JOURNAL_VERSION,
    eventSequence,
    operation,
    recordedAt: new Date().toISOString(),
    recoveredFromEventSequence,
    stateSha256: sha256Bytes(bytes),
    state,
  };
}

function validateJournalRecord(record) {
  if (
    record?.journalVersion !== JOURNAL_VERSION ||
    !Number.isInteger(record.eventSequence) ||
    record.eventSequence < 1 ||
    !["transition", "recovery"].includes(record.operation) ||
    typeof record.stateSha256 !== "string" ||
    !record.state
  ) {
    return false;
  }
  return sha256Bytes(stateBytes(record.state)) === record.stateSha256;
}

function nextEventSequence(journalRecords, corruptLines = []) {
  const highestDeclared = Math.max(
    0,
    ...journalRecords
      .map((record) => record.eventSequence)
      .filter(Number.isInteger)
  );
  const physicalRecordCount = journalRecords.length + corruptLines.length;
  return Math.max(highestDeclared, physicalRecordCount) + 1;
}

function recordsForRefs(runRoot, refs) {
  const records = [];
  for (const artifactRef of refs) {
    const absolutePath = resolveArtifactRefPath(runRoot, artifactRef);
    const actualRef = makeArtifactRef(absolutePath, {
      runRoot,
      artifactType: artifactRef.artifactType,
    });
    if (actualRef.sha256 !== artifactRef.sha256) {
      throw new ArtifactContractError([
        {
          invariant: "reference-integrity",
          reentryCode: reentryCodeForArtifact(artifactRef.artifactType),
          message: `Artifact ref changed before transition: ${artifactRef.path}`,
          artifactType: artifactRef.artifactType,
          details: {
            expected: artifactRef.sha256,
            actual: actualRef.sha256,
          },
        },
      ]);
    }
    try {
      records.push(...readArtifactRecords(absolutePath));
    } catch (error) {
      if (error instanceof ArtifactContractError) {
        throw new ArtifactContractError(
          error.violations.map((item) => ({
            ...item,
            reentryCode: reentryCodeForArtifact(artifactRef.artifactType),
          }))
        );
      }
      throw error;
    }
  }
  return records;
}

function artifactRefsFromPaths(runRoot, artifactPaths) {
  const refs = [];
  const records = [];
  for (const inputPath of artifactPaths) {
    const absolutePath = path.resolve(inputPath);
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      throw new Error(`Artifact file not found: ${absolutePath}`);
    }
    const fileRecords = readArtifactRecords(absolutePath);
    const artifactType = inferArtifactType(fileRecords);
    refs.push(makeArtifactRef(absolutePath, { runRoot, artifactType }));
    records.push(...fileRecords);
  }
  return { refs, records };
}

function evidenceManifestSlot(artifactRef, runRoot) {
  if (artifactRef.artifactType !== "evidence-manifest") return null;
  const records = readArtifactRecords(resolveArtifactRefPath(runRoot, artifactRef));
  if (records.length !== 1) return null;
  const artifact = records[0].artifact;
  return evidenceProjectionSlot(artifact);
}

export function mergeArtifactRefs(previous, additions) {
  const byPath = new Map();
  for (const artifactRef of previous) byPath.set(artifactRef.path, artifactRef);
  for (const artifactRef of additions) {
    const prior = byPath.get(artifactRef.path);
    if (
      prior &&
      (prior.sha256 !== artifactRef.sha256 ||
        prior.artifactType !== artifactRef.artifactType)
    ) {
      throw new ArtifactContractError([
        {
          invariant: "reference-integrity",
          reentryCode: "E-EXTRACT",
          message: `Immutable artifact path was reused with different bytes or type: ${artifactRef.path}`,
          artifactType: artifactRef.artifactType,
          details: { prior, current: artifactRef },
        },
      ]);
    }
    byPath.set(artifactRef.path, artifactRef);
  }
  return [...byPath.values()].sort((left, right) =>
    `${left.artifactType}:${left.path}`.localeCompare(
      `${right.artifactType}:${right.path}`
    )
  );
}

function inferBatch(records, explicitBatch, currentBatch) {
  if (explicitBatch) return explicitBatch;
  const batchIds = new Set(
    records
      .map((record) => record.artifact?.batchId)
      .filter((batchId) => typeof batchId === "string")
  );
  if (batchIds.size > 1) {
    throw new Error(
      `Transition artifacts span multiple batches: ${[...batchIds].join(", ")}`
    );
  }
  return [...batchIds][0] ?? currentBatch ?? null;
}

function inferSourceFingerprint(
  records,
  state,
  explicitFingerprint,
  targetPhase
) {
  let inferred;
  if (targetPhase === "MIGRATED") {
    const mutations = records.filter(
      (record) => record.artifact?.artifactType === "mutation-manifest"
    );
    if (mutations.length === 1) {
      inferred = mutations[0].artifact.afterSourceFingerprint;
    }
  } else if (targetPhase === "COMPLETE") {
    const proofs = records.filter(
      (record) => record.artifact?.artifactType === "final-proof"
    );
    if (proofs.length === 1) {
      inferred = proofs[0].artifact.finalSourceFingerprint;
    }
  }
  if (!inferred) {
    const fingerprints = new Set(
      records
        .map((record) => record.artifact?.sourceFingerprint)
        .filter(Boolean)
    );
    if (fingerprints.size > 1) {
      throw new ArtifactContractError([
        {
          invariant: "source-freshness",
          reentryCode: "E-EXTRACT",
          message:
            "Transition artifacts carry multiple source fingerprints; split the transition or correct stale artifacts",
          artifactType: null,
          details: { fingerprints: [...fingerprints] },
        },
      ]);
    }
    inferred = [...fingerprints][0] ?? state.sourceFingerprint;
  }
  if (explicitFingerprint && explicitFingerprint !== inferred) {
    throw new ArtifactContractError([
      {
        invariant: "source-freshness",
        reentryCode: "E-EXTRACT",
        message:
          "--source-fingerprint contradicts the transition artifact source",
        artifactType: null,
        details: { explicitFingerprint, inferred },
      },
    ]);
  }
  return explicitFingerprint ?? inferred;
}

function readConfig(runRoot) {
  const records = readArtifactRecords(configPath(runRoot));
  if (
    records.length !== 1 ||
    records[0].artifact.artifactType !== "run-config"
  ) {
    throw new Error(`${CONFIG_FILENAME} must contain one run-config artifact`);
  }
  return records[0];
}

function validateSnapshot({
  state,
  runRoot,
  validator,
  enforceTransitionEvidence = true,
}) {
  const configRecord = readConfig(runRoot);
  const lastTransition = state.journal.at(-1);
  const transitionRecords =
    enforceTransitionEvidence && lastTransition && !lastTransition.reentryCode
      ? recordsForRefs(runRoot, lastTransition.artifactRefs)
      : null;
  return validateArtifactSet({
    records: [configRecord, { artifact: state }],
    runRoot,
    validator,
    targetPhase: state.currentPhase,
    transitionRecords,
  });
}

export function recoverRun({ runRoot, validator, repair = true }) {
  const absoluteRunRoot = path.resolve(runRoot);
  const { records: journalRecords, corruptLines } =
    parseJournal(absoluteRunRoot);
  const validRecordShape = journalRecords.filter(validateJournalRecord);
  let recovered = null;
  let validation = null;
  for (let index = validRecordShape.length - 1; index >= 0; index -= 1) {
    const candidate = validRecordShape[index];
    const result = validateSnapshot({
      state: candidate.state,
      runRoot: absoluteRunRoot,
      validator,
    });
    if (result.valid) {
      recovered = candidate;
      validation = result;
      break;
    }
  }
  if (!recovered) {
    throw new ArtifactContractError(
      validation?.violations ?? [
        {
          invariant: "run-state-journal",
          reentryCode: "E-EXTRACT",
          message:
            "No valid recoverable state exists in the append-only journal",
          artifactType: "run-state",
          details: {
            journalRecordCount: journalRecords.length,
            corruptLines,
          },
        },
      ]
    );
  }

  const filePath = statePath(absoluteRunRoot);
  const currentHash = existsSync(filePath)
    ? sha256Bytes(readFileSync(filePath))
    : null;
  const needsRepair = currentHash !== recovered.stateSha256;
  let recoveryAppended = false;
  if (repair && needsRepair) {
    atomicWriteJson(filePath, recovered.state);
    const eventSequence = nextEventSequence(journalRecords, corruptLines);
    appendJournalRecord(
      absoluteRunRoot,
      journalRecord({
        eventSequence,
        operation: "recovery",
        state: recovered.state,
        recoveredFromEventSequence: recovered.eventSequence,
      })
    );
    recoveryAppended = true;
  }
  return {
    state: recovered.state,
    validation,
    recoveredEventSequence: recovered.eventSequence,
    repaired: repair && needsRepair,
    recoveryAppended,
    corruptLines,
    journalRecordCount: journalRecords.length + Number(recoveryAppended),
  };
}

function persistTransition(runRoot, state, operation = "transition") {
  const parsed = parseJournal(runRoot);
  const record = journalRecord({
    eventSequence: nextEventSequence(parsed.records, parsed.corruptLines),
    operation,
    state,
  });
  appendJournalRecord(runRoot, record);
  atomicWriteJson(statePath(runRoot), state);
  return record;
}

function commandInit(options) {
  const root = path.resolve(requireOption(options, "root"));
  const runRoot = path.resolve(requireOption(options, "run-root"));
  const inputConfig = path.resolve(requireOption(options, "config"));
  const validator = createArtifactValidator({ root });
  if (!existsSync(inputConfig)) {
    throw new Error(`Config not found: ${inputConfig}`);
  }
  if (existsSync(statePath(runRoot)) || existsSync(journalPath(runRoot))) {
    throw new Error(
      `Run already exists at ${runRoot}; use resume or validate instead of overwriting it`
    );
  }
  const configRecords = readArtifactRecords(inputConfig);
  if (
    configRecords.length !== 1 ||
    configRecords[0].artifact.artifactType !== "run-config"
  ) {
    throw new Error("--config must contain exactly one run-config artifact");
  }
  const config = configRecords[0].artifact;
  const configSchema = validator.validate(config);
  if (!configSchema.valid) {
    throw new ArtifactContractError([
      {
        invariant: "schema-instance",
        reentryCode: configSchema.reentryCode,
        message: "run-config failed JSON Schema validation",
        artifactType: "run-config",
        details: { errors: configSchema.errors },
      },
    ]);
  }
  if (path.basename(runRoot) !== config.runId) {
    throw new Error(
      `Run root basename must equal runId ${config.runId}: ${runRoot}`
    );
  }

  mkdirSync(runRoot, { recursive: true });
  if (existsSync(configPath(runRoot))) {
    const existing = readConfig(runRoot).artifact;
    if (sha256CanonicalJson(existing) !== sha256CanonicalJson(config)) {
      throw new Error(
        `Partial run config at ${runRoot} differs from --config; refusing overwrite`
      );
    }
  } else {
    atomicWriteJson(configPath(runRoot), config);
  }
  const configRef = makeArtifactRef(configPath(runRoot), {
    runRoot,
    artifactType: "run-config",
  });
  const now = new Date().toISOString();
  const transition = {
    sequence: 1,
    from: "START",
    to: "ANCHORED",
    at: now,
    reason: "Initialized immutable tokenization run",
    reentryCode: null,
    artifactRefs: [configRef],
  };
  const state = {
    schemaVersion: "1.0.0",
    artifactType: "run-state",
    runId: config.runId,
    sourceFingerprint: config.sourceFingerprint,
    toolchainFingerprint: config.toolchainFingerprint,
    generatedAt: now,
    currentPhase: "ANCHORED",
    activeBatchId: null,
    journal: [transition],
    artifacts: [configRef],
  };
  const validation = validateArtifactSet({
    records: [readConfig(runRoot), { artifact: state }],
    runRoot,
    validator,
    targetPhase: "ANCHORED",
  });
  if (!validation.valid) throw new ArtifactContractError(validation.violations);
  const record = persistTransition(runRoot, state);
  return {
    command: "init",
    runId: config.runId,
    phase: state.currentPhase,
    stateSha256: record.stateSha256,
    runRoot,
  };
}

function commandTransition(options) {
  const root = path.resolve(requireOption(options, "root"));
  const runRoot = path.resolve(requireOption(options, "run-root"));
  const targetPhase = requireOption(options, "to");
  const reason = requireOption(options, "reason");
  const validator = createArtifactValidator({ root });
  const recovered = recoverRun({ runRoot, validator, repair: true });
  const state = recovered.state;
  const reentryCode = options["reentry-code"] ?? null;
  const transitionViolations = validateTransition({
    from: state.currentPhase,
    to: targetPhase,
    reentryCode,
  });
  if (transitionViolations.length > 0) {
    throw new ArtifactContractError(transitionViolations);
  }

  const { refs, records } = artifactRefsFromPaths(
    runRoot,
    options.artifact ?? []
  );
  const sourceFingerprint = inferSourceFingerprint(
    records,
    state,
    options["source-fingerprint"] ?? null,
    targetPhase
  );
  for (const record of records) {
    if (record.artifact.sourceFingerprint !== sourceFingerprint) {
      throw new ArtifactContractError([
        {
          invariant: "source-freshness",
          reentryCode: "E-EXTRACT",
          message: `${record.artifact.artifactType} is stale for transition ${targetPhase}`,
          artifactType: record.artifact.artifactType,
          details: {
            expected: sourceFingerprint,
            actual: record.artifact.sourceFingerprint,
          },
        },
      ]);
    }
  }
  const activeBatchId =
    targetPhase === "COMPLETE"
      ? null
      : inferBatch(records, options.batch, state.activeBatchId);
  const now = new Date().toISOString();
  const transition = {
    sequence: state.journal.length + 1,
    from: state.currentPhase,
    to: targetPhase,
    at: now,
    reason,
    reentryCode,
    artifactRefs: refs,
  };
  // Reuse of an immutable path is checked against the complete history, not
  // merely the active projection (which legitimately omits superseded refs).
  mergeArtifactRefs(
    state.journal.flatMap((entry) => entry.artifactRefs),
    refs
  );
  const nextJournal = [...state.journal, transition];
  const nextState = {
    ...state,
    sourceFingerprint,
    generatedAt: now,
    currentPhase: targetPhase,
    activeBatchId,
    journal: nextJournal,
    artifacts: projectJournalArtifactRefs(
      nextJournal,
      (artifactRef) => evidenceManifestSlot(artifactRef, runRoot),
      {
        groupForRef: artifactProjectionGroup,
        resetGroupsForRef: artifactProjectionResetGroups,
      }
    ),
  };

  const configRecord = readConfig(runRoot);
  const result = validateArtifactSet({
    records: [configRecord, { artifact: nextState }, ...records],
    runRoot,
    validator,
    targetPhase,
    transitionRecords: reentryCode ? null : records,
  });
  if (!result.valid) throw new ArtifactContractError(result.violations);
  const journal = persistTransition(runRoot, nextState);
  return {
    command: "transition",
    runId: nextState.runId,
    from: state.currentPhase,
    to: targetPhase,
    sourceFingerprint,
    activeBatchId,
    artifactCount: nextState.artifacts.length,
    stateSha256: journal.stateSha256,
    repairedBeforeTransition: recovered.repaired,
  };
}

function commandValidate(options) {
  const root = path.resolve(requireOption(options, "root"));
  const runRoot = path.resolve(requireOption(options, "run-root"));
  const validator = createArtifactValidator({ root });
  const recovered = recoverRun({ runRoot, validator, repair: false });
  const stateFileHash = existsSync(statePath(runRoot))
    ? sha256Bytes(readFileSync(statePath(runRoot)))
    : null;
  const expectedHash = sha256Bytes(stateBytes(recovered.state));
  if (stateFileHash !== expectedHash) {
    throw new ArtifactContractError([
      {
        invariant: "run-state-journal",
        reentryCode: "E-EXTRACT",
        message:
          "state.json does not match the last valid journal snapshot; run resume",
        artifactType: "run-state",
        details: { stateFileHash, expectedHash },
      },
    ]);
  }
  return {
    command: "validate",
    runId: recovered.state.runId,
    phase: recovered.state.currentPhase,
    sourceFingerprint: recovered.state.sourceFingerprint,
    artifactCount: recovered.state.artifacts.length,
    journalTransitions: recovered.state.journal.length,
    valid: true,
  };
}

function commandResume(options) {
  const root = path.resolve(requireOption(options, "root"));
  const runRoot = path.resolve(requireOption(options, "run-root"));
  const validator = createArtifactValidator({ root });
  const result = recoverRun({ runRoot, validator, repair: true });
  return {
    command: "resume",
    runId: result.state.runId,
    phase: result.state.currentPhase,
    sourceFingerprint: result.state.sourceFingerprint,
    repaired: result.repaired,
    recoveredEventSequence: result.recoveredEventSequence,
    corruptJournalLines: result.corruptLines,
    nextForwardPhases: nextForwardPhases(result.state.currentPhase),
  };
}

function commandStatus(options) {
  const root = path.resolve(requireOption(options, "root"));
  const runRoot = path.resolve(requireOption(options, "run-root"));
  const validator = createArtifactValidator({ root });
  const result = recoverRun({ runRoot, validator, repair: false });
  const last = result.state.journal.at(-1);
  return {
    command: "status",
    runId: result.state.runId,
    phase: result.state.currentPhase,
    sourceFingerprint: result.state.sourceFingerprint,
    activeBatchId: result.state.activeBatchId,
    artifactCount: result.state.artifacts.length,
    journalTransitions: result.state.journal.length,
    lastTransition: last,
    nextForwardPhases: nextForwardPhases(result.state.currentPhase),
  };
}

export function runCli(argv) {
  const { command, options } = parseArgs(argv);
  switch (command) {
    case "init":
      return commandInit(options);
    case "transition":
      return commandTransition(options);
    case "validate":
      return commandValidate(options);
    case "resume":
      return commandResume(options);
    case "status":
      return commandStatus(options);
    case undefined:
    case "help":
    case "--help":
      return { help: usage() };
    default:
      throw new Error(`Unknown command: ${command}\n\n${usage()}`);
  }
}

function main() {
  try {
    const result = runCli(process.argv.slice(2));
    if (result.help) {
      process.stdout.write(`${result.help}\n`);
    } else {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    }
  } catch (error) {
    if (error instanceof ArtifactContractError) {
      process.stderr.write(`${JSON.stringify(error.toJSON(), null, 2)}\n`);
      process.exitCode = 2;
      return;
    }
    process.stderr.write(
      `${JSON.stringify(
        {
          error: error.name ?? "Error",
          message: error.message,
        },
        null,
        2
      )}\n`
    );
    process.exitCode = 1;
  }
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(MODULE_PATH)) {
  main();
}
