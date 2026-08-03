import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const SCRIPT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../context-clusters.mjs"
);

function write(root, relative, value) {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value);
}

test("context-clusters materializa o score multicritério que governa a fila", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "confidence-context-"));
  try {
    write(root, "package.json", JSON.stringify({ name: "confidence-fixture", private: true }));
    write(
      root,
      "tokenization.config.json",
      JSON.stringify({ sourceRoots: ["app"], tokenFile: "tokens/color.tokens.json" })
    );
    write(
      root,
      "tokens/color.tokens.json",
      JSON.stringify({
        primitive: { light: { green: { $type: "color", $value: "#006b3c" } } },
        semantic: {
          light: {
            surface: {
              panel: { $type: "color", $value: "{primitive.light.green}" },
            },
          },
        },
      })
    );
    write(
      root,
      "app/components/Button.tsx",
      `export function Button(){ return <button className="bg-surface-panel">OK</button> }\n`
    );
    const output = execFileSync(
      process.execPath,
      [SCRIPT, "--root", root, "--all", "--json"],
      { encoding: "utf8" }
    );
    const result = JSON.parse(output);
    assert.equal(result.clusters.length, 1);
    const [cluster] = result.clusters;
    assert.equal(cluster.confidence.threshold, 70);
    assert.ok(["high", "low"].includes(cluster.confidence.band));
    assert.ok(cluster.confidence.signals.length >= 5);
    assert.equal(
      cluster.needsDecision,
      cluster.confidence.band === "low"
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
