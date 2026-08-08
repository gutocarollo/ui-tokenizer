import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { VisualContractError } from "./visual-contract.mjs";

function git(applicationRoot, args) {
  return execFileSync("git", ["-C", applicationRoot, ...args], {
    encoding: "utf8",
  }).trim();
}

/**
 * Produz a exceção estreita que o núcleo do comparador ainda validará.
 *
 * Não há fallback heurístico: o verificador AST precisa emitir PASS para o par
 * exato, e cada contractSource alterado precisa pertencer aos plannedFiles do
 * lote. Assim uma edição de API/model/fixture continua recusada.
 */
export function proveFixtureBindingDelta({
  applicationRoot,
  applyPlan,
  batchPolicy,
  before,
  after,
  proofPath,
  verifierPath,
}) {
  if (!applicationRoot || !applyPlan?.baseCommit || !batchPolicy?.batchId) {
    throw new VisualContractError(
      "Fixture binding proof requires applicationRoot, apply-plan baseCommit and batchId"
    );
  }
  const result = spawnSync(
    process.execPath,
    [
      verifierPath,
      "--base",
      applyPlan.baseCommit,
      "--field",
      "fixtureRegistryFingerprint",
      "--field-before",
      before,
      "--field-after",
      after,
      "--out",
      proofPath,
    ],
    {
      cwd: path.dirname(verifierPath),
      encoding: "utf8",
      env: { ...process.env, TOKENIZE_APP_ROOT: applicationRoot },
      maxBuffer: 64 * 1024 * 1024,
    }
  );
  if (result.status !== 0) {
    throw new VisualContractError("Contract-source delta proof failed", {
      exitCode: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }
  const proof = JSON.parse(readFileSync(proofPath, "utf8"));
  const repoPrefix = git(applicationRoot, ["rev-parse", "--show-prefix"]);
  const allowed = new Set(
    (batchPolicy.plannedFiles ?? []).map((file) =>
      `${repoPrefix}${file}`.split(path.sep).join("/")
    )
  );
  const outsideBatch = (proof.changedContractSources ?? []).filter(
    (file) => !allowed.has(file)
  );
  if (outsideBatch.length) {
    throw new VisualContractError(
      "Contract-source delta escaped batch plannedFiles",
      { outsideBatch, plannedFiles: [...allowed] }
    );
  }
  return {
    field: "fixtureRegistryFingerprint",
    before,
    after,
    owner: "tokenization-runner",
    reason:
      "fixture contract-source bytes moved only inside AST-proven className/design-entity regions",
    scope: `batch ${batchPolicy.batchId}`,
    evidence: path.resolve(proofPath),
    review:
      "verify-contract-source-delta PASS; visual pair review remains mandatory in REVIEWED",
  };
}
