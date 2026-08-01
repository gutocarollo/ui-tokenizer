import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { discoverReadOnlyFixtures } from "./read-only-fixtures.mjs";

test("copies only allow-listed identifiers and never returns credentials", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "read-only-fixtures-"));
  try {
    const result = await discoverReadOnlyFixtures({
      repoRoot: root,
      inspectLocalData: false,
      environment: {
        UI_EVIDENCE_MODEL_ROUTER_ID: "42",
        UI_EVIDENCE_USER: "private-user",
        UI_EVIDENCE_PASS: "private-password",
        UI_EVIDENCE_SESSION: "private-session",
      },
    });
    assert.deepEqual(result.environment, {
      UI_EVIDENCE_MODEL_ROUTER_ID: "42",
    });
    assert.equal(JSON.stringify(result).includes("private-"), false);
    assert.equal(result.readOnly, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("discovers an agent-flow identifier by directory enumeration only", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "read-only-fixtures-"));
  try {
    const directory = path.join(
      root,
      "server",
      "storage",
      "plugins",
      "agent-flows"
    );
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      path.join(directory, "flow-safe.json"),
      JSON.stringify({ name: "Safe flow", steps: [] })
    );
    writeFileSync(path.join(directory, "ignored.txt"), "secret");
    const result = await discoverReadOnlyFixtures({
      repoRoot: root,
      environment: {},
    });
    assert.equal(result.environment.UI_EVIDENCE_AGENT_FLOW_ID, "flow-safe");
    assert.equal(
      result.sources.UI_EVIDENCE_AGENT_FLOW_ID,
      "filesystem-read-only"
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("does not replace an invalid requested flow with a different flow", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "read-only-fixtures-"));
  try {
    const directory = path.join(
      root,
      "server",
      "storage",
      "plugins",
      "agent-flows"
    );
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      path.join(directory, "different-flow.json"),
      JSON.stringify({ name: "Different flow", steps: [] })
    );
    const result = await discoverReadOnlyFixtures({
      repoRoot: root,
      environment: { UI_EVIDENCE_AGENT_FLOW_ID: "missing-flow" },
    });
    assert.equal(result.environment.UI_EVIDENCE_AGENT_FLOW_ID, undefined);
    assert.ok(result.diagnostics.includes("agent-flow-requested-missing"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the provider source contains no Prisma or filesystem mutation call", () => {
  const source = readFileSync(
    fileURLToPath(new URL("./read-only-fixtures.mjs", import.meta.url)),
    "utf8"
  );
  assert.doesNotMatch(
    source,
    /prisma\.[A-Za-z0-9_]+\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/
  );
  assert.doesNotMatch(
    source,
    /\$(?:executeRaw|executeRawUnsafe|transaction)\s*\(/
  );
  assert.doesNotMatch(
    source,
    /(?:writeFile|appendFile|truncate|unlink|rm|mkdir|rename)Sync\s*\(/
  );
});
