import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { withMaterializedEvidenceRegistry } from "./evidence-registry.mjs";

test("materializa registry no preparador, copia fixture e restaura a worktree", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "evidence-registry-"));
  const visual = path.join(root, "tests", "visual");
  const staging = path.join(root, ".staging");
  mkdirSync(visual, { recursive: true });
  writeFileSync(path.join(visual, "scenarios.json"), "old-scenarios\n");
  writeFileSync(path.join(visual, "network-fixtures.json"), "old-network\n");

  const observed = await withMaterializedEvidenceRegistry({
    frontendRoot: root,
    stagingRoot: staging,
    generate: async ({ outDir }) => {
      writeFileSync(path.join(outDir, "scenarios.json"), "new-scenarios\n");
      writeFileSync(path.join(outDir, "contexts.json"), "new-contexts\n");
      writeFileSync(path.join(outDir, "network-fixtures.json"), "new-network\n");
      return { coverageComplete: true };
    },
    consume: async ({ registryRoot, stagedNetworkFixturePath }) => ({
      scenarios: readFileSync(path.join(registryRoot, "scenarios.json"), "utf8"),
      staged: readFileSync(stagedNetworkFixturePath, "utf8"),
    }),
  });

  assert.deepEqual(observed, {
    scenarios: "new-scenarios\n",
    staged: "new-network\n",
  });
  assert.equal(readFileSync(path.join(visual, "scenarios.json"), "utf8"), "old-scenarios\n");
  assert.equal(readFileSync(path.join(visual, "network-fixtures.json"), "utf8"), "old-network\n");
  assert.equal(existsSync(path.join(visual, "contexts.json")), false);
});

test("restaura o registry mesmo quando o consumidor recusa", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "evidence-registry-fail-"));
  const visual = path.join(root, "tests", "visual");
  mkdirSync(visual, { recursive: true });
  writeFileSync(path.join(visual, "network-fixtures.json"), "old\n");

  await assert.rejects(
    withMaterializedEvidenceRegistry({
      frontendRoot: root,
      stagingRoot: path.join(root, ".staging"),
      generate: async ({ outDir }) => {
        writeFileSync(path.join(outDir, "network-fixtures.json"), "new\n");
        return {};
      },
      consume: async () => {
        throw new Error("contract refused");
      },
    }),
    /contract refused/
  );
  assert.equal(readFileSync(path.join(visual, "network-fixtures.json"), "utf8"), "old\n");
});
