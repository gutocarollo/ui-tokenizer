import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  artifactProjectionGroup,
  artifactProjectionResetGroups,
  collectArtifactRefs,
  evidenceProjectionSlot,
  projectJournalArtifactRefs,
} from "../lib/artifact-contract.mjs";

function ref(runRoot, relativePath, artifactType = "evidence-manifest") {
  const bytes = readFileSync(path.join(runRoot, relativePath));
  return {
    artifactType,
    path: relativePath,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function manifest(runRoot, relativePath, phase) {
  const absolutePath = path.join(runRoot, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(
    absolutePath,
    `${JSON.stringify({ artifactType: "evidence-manifest", batchId: "B0004", phase })}\n`
  );
  return ref(runRoot, relativePath);
}

test("reentry supersedes only the current evidence slot and leaves the prior snapshot immutable", () => {
  const runRoot = mkdtempSync(path.join(tmpdir(), "tokenization-reentry-"));
  const before = manifest(runRoot, "artifacts/B0004/before/manifest.json", "before");
  const afterV1 = manifest(runRoot, "artifacts/B0004/after/manifest.json", "after");
  const afterV2 = manifest(runRoot, "artifacts/B0004/after-r2/manifest.json", "after");
  const unrelatedPath = "artifacts/B0004/checks.json";
  mkdirSync(path.dirname(path.join(runRoot, unrelatedPath)), { recursive: true });
  writeFileSync(path.join(runRoot, unrelatedPath), '{"artifactType":"deterministic-checks"}\n');
  const checks = ref(runRoot, unrelatedPath, "deterministic-checks");
  const priorSnapshot = [before, afterV1, checks];
  const journal = [
    { reentryCode: null, artifactRefs: priorSnapshot },
    { reentryCode: "E-COMPARE", artifactRefs: [afterV2] },
  ];
  const current = projectJournalArtifactRefs(journal, (artifactRef) => {
    const artifact = JSON.parse(
      readFileSync(path.join(runRoot, artifactRef.path), "utf8")
    );
    return evidenceProjectionSlot(artifact);
  });

  assert.deepEqual(
    current.map((item) => item.path).sort(),
    [before.path, afterV2.path, checks.path].sort()
  );
  assert.deepEqual(
    priorSnapshot.map((item) => item.path),
    [before.path, afterV1.path, checks.path],
    "the journal's prior state projection must remain unchanged"
  );
});

test("forward merge does not silently replace an evidence slot", () => {
  const runRoot = mkdtempSync(path.join(tmpdir(), "tokenization-forward-"));
  const afterV1 = manifest(runRoot, "artifacts/B0004/after/manifest.json", "after");
  const afterV2 = manifest(runRoot, "artifacts/B0004/after-r2/manifest.json", "after");
  const current = projectJournalArtifactRefs(
    [
      { reentryCode: null, artifactRefs: [afterV1] },
      { reentryCode: null, artifactRefs: [afterV2] },
    ],
    (artifactRef) =>
      evidenceProjectionSlot(
        JSON.parse(readFileSync(path.join(runRoot, artifactRef.path), "utf8"))
      )
  );
  assert.equal(current.length, 2);
});

test("a new before invalidates both current visual slots for its batch", () => {
  const runRoot = mkdtempSync(path.join(tmpdir(), "tokenization-before-reentry-"));
  const beforeV1 = manifest(runRoot, "artifacts/B0004/before/manifest.json", "before");
  const afterV1 = manifest(runRoot, "artifacts/B0004/after/manifest.json", "after");
  const beforeV2 = manifest(runRoot, "artifacts/B0004/before-r2/manifest.json", "before");

  const current = projectJournalArtifactRefs(
    [
      { reentryCode: null, artifactRefs: [beforeV1, afterV1] },
      { reentryCode: "E-MIGRATION", artifactRefs: [beforeV2] },
    ],
    (artifactRef) =>
      evidenceProjectionSlot(
        JSON.parse(readFileSync(path.join(runRoot, artifactRef.path), "utf8"))
      )
  );

  assert.deepEqual(current.map((item) => item.path), [beforeV2.path]);
});

test("run-state semantic closure follows only the active projection, never historical refs", () => {
  const historical = {
    artifactType: "evidence-manifest",
    path: "artifacts/B0004/before/manifest.json",
    sha256: "a".repeat(64),
  };
  const active = {
    artifactType: "evidence-manifest",
    path: "artifacts/B0004/before-r3/manifest.json",
    sha256: "b".repeat(64),
  };
  const state = {
    artifactType: "run-state",
    journal: [{ artifactRefs: [historical] }, { artifactRefs: [active] }],
    artifacts: [active],
  };

  assert.deepEqual(collectArtifactRefs(state), [active]);
});

test("ordinary artifacts still expose nested evidence refs to the closure", () => {
  const nested = {
    artifactType: "evidence-manifest",
    path: "artifacts/B0004/before-r3/manifest.json",
    sha256: "c".repeat(64),
  };
  assert.deepEqual(
    collectArtifactRefs({ artifactType: "comparison", beforeManifest: nested }),
    [nested]
  );
});

test("a new axis discovery resets only the active census generation", () => {
  const oldAxis = {
    artifactType: "axis-discovery",
    path: "artifacts/axis-discovery.json",
    sha256: "1".repeat(64),
  };
  const oldDesign = {
    artifactType: "design-occurrence",
    path: "artifacts/design-occurrences.ndjson",
    sha256: "2".repeat(64),
  };
  const accepted = {
    artifactType: "acceptance",
    path: "artifacts/B0001/acceptance.json",
    sha256: "3".repeat(64),
  };
  const newAxis = {
    artifactType: "axis-discovery",
    path: "artifacts/generations/new/axis-discovery.json",
    sha256: "4".repeat(64),
  };
  const newDesign = {
    artifactType: "design-occurrence",
    path: "artifacts/generations/new/design-occurrences.ndjson",
    sha256: "5".repeat(64),
  };

  const projected = projectJournalArtifactRefs(
    [
      { reentryCode: null, artifactRefs: [oldAxis, oldDesign] },
      { reentryCode: null, artifactRefs: [accepted] },
      { reentryCode: null, artifactRefs: [newAxis, newDesign] },
    ],
    () => null,
    {
      groupForRef: artifactProjectionGroup,
      resetGroupsForRef: artifactProjectionResetGroups,
    }
  );

  assert.deepEqual(
    projected.map((item) => item.path),
    [accepted.path, newAxis.path, newDesign.path].sort()
  );
});
