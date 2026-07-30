import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "normalize-occurrences.mjs"
);

function write(root, relative, contents) {
  const absolute = path.join(root, relative);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents);
  return absolute;
}

function classOccurrence(overrides = {}) {
  return {
    runId: "tokenize-normalize-test",
    sourceFingerprint: "a".repeat(64),
    toolchainFingerprint: "b".repeat(64),
    occurrenceKind: "utility-class",
    occurrenceId: "occ:class",
    rawValue: "",
    location: { file: "src/fixture.tsx", line: 1, column: 1 },
    context: {},
    sourcePayload: {
      classExpression: {
        expressionKind: "jsx-attr:typescript-completeness",
        resolverKind: "unknown",
        branchId: "branch:one",
        conditionExpression: null,
        rawClassName: "",
        rawTokens: [],
        unresolvedDynamicFragments: ["className"],
        branchExpansionTruncated: false,
      },
    },
    ...overrides,
  };
}

test("normalization rejects a foreign non-class occurrence identity", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "tokenize-normalize-id-"));
  write(fixture, "package.json", JSON.stringify({ private: true }));
  const input = write(
    fixture,
    "input.ndjson",
    [
      classOccurrence(),
      {
        ...classOccurrence({
          occurrenceKind: "css-declaration",
          occurrenceId: "occ:foreign",
          sourceFingerprint: "c".repeat(64),
        }),
      },
    ]
      .map(JSON.stringify)
      .join("\n")
  );
  const result = spawnSync(
    process.execPath,
    [
      script,
      "--root",
      fixture,
      "--input",
      input,
      "--out",
      path.join(fixture, "out"),
    ],
    { encoding: "utf8" }
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /All input occurrences must share/);
});

test("a pure unresolved class expression is opaque, not invalid", () => {
  const fixture = mkdtempSync(
    path.join(tmpdir(), "tokenize-normalize-dynamic-")
  );
  write(fixture, "package.json", JSON.stringify({ private: true }));
  const input = write(
    fixture,
    "input.ndjson",
    `${JSON.stringify(classOccurrence())}\n`
  );
  const output = path.join(fixture, "out");
  const result = spawnSync(
    process.execPath,
    [
      script,
      "--root",
      fixture,
      "--input",
      input,
      "--out",
      output,
      "--generated-at",
      "2026-01-01T00:00:00.000Z",
    ],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 2, `${result.stdout}\n${result.stderr}`);
  const normalized = JSON.parse(
    readFileSync(path.join(output, "normalized-occurrences.ndjson"), "utf8")
  );
  assert.equal(normalized.reconciliationStatus, "opaque");
  const summary = JSON.parse(
    readFileSync(path.join(output, "normalization-summary.json"), "utf8")
  );
  assert.equal(summary.counts.byReconciliationStatus.invalid, 0);
  assert.equal(summary.queues.unresolved.length, 1);
});
