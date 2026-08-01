/**
 * Regressao da dispensa de bind do comparador de evidencia.
 *
 * O que este teste protege: `fixtureRegistryFingerprint` inclui o sha256 dos
 * `contractSources`, entao um codemod de apresentacao numa pagina que e
 * contractSource move o hash sem mudar uma requisicao. A dispensa existe para
 * esse caso e SO para ele.
 *
 * Uma dispensa que aceita mais do que deveria e pior que nenhuma dispensa: ela
 * transforma o guard mais forte da esteira em decoracao. Por isso a maior parte
 * dos casos abaixo exige FALHA, nao sucesso.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { applyBindingWaivers } from "./visual-contract.mjs";

const BEFORE = "a".repeat(64);
const AFTER = "b".repeat(64);
const MISMATCH = {
  field: "fixtureRegistryFingerprint",
  before: BEFORE,
  after: AFTER,
};

function proofFile(overrides = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "waiver-"));
  const file = path.join(dir, "proof.json");
  writeFileSync(
    file,
    JSON.stringify({
      tool: "verify-contract-source-delta",
      verdict: "PASS",
      field: "fixtureRegistryFingerprint",
      fieldBefore: BEFORE,
      fieldAfter: AFTER,
      changedContractSources: ["frontend/src/pages/X/index.jsx"],
      permittedCategories: ["jsx-classname-attribute-value"],
      ...overrides,
    })
  );
  return { dir, file };
}

function exception(file, overrides = {}) {
  return {
    field: "fixtureRegistryFingerprint",
    before: BEFORE,
    after: AFTER,
    owner: "Augusto Carollo",
    reason: "codemod de apresentacao em pagina que e contractSource",
    scope: "lote 2",
    evidence: file,
    review: "teste de mutacao 6/6",
    ...overrides,
  };
}

test("dispensa valida: prova PASS fixada ao par observado", () => {
  const { dir, file } = proofFile();
  try {
    const r = applyBindingWaivers([MISMATCH], {
      approvedBindingExceptions: [exception(file)],
    });
    assert.equal(r.unwaived.length, 0);
    assert.equal(r.waived.length, 1);
    assert.equal(r.waived[0].owner, "Augusto Carollo");
    assert.deepEqual(r.waived[0].changedContractSources, [
      "frontend/src/pages/X/index.jsx",
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("sem excecao declarada o mismatch SOBREVIVE", () => {
  const r = applyBindingWaivers([MISMATCH], {});
  assert.equal(r.unwaived.length, 1);
  assert.equal(r.waived.length, 0);
});

test("prova de OUTRO par NAO dispensa — a excecao e fixada ao par", () => {
  const { dir, file } = proofFile({ fieldAfter: "c".repeat(64) });
  try {
    assert.throws(
      () =>
        applyBindingWaivers([MISMATCH], {
          approvedBindingExceptions: [exception(file)],
        }),
      /does not prove this exact mismatch/
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("veredito FAIL na prova NAO dispensa", () => {
  const { dir, file } = proofFile({ verdict: "FAIL" });
  try {
    assert.throws(
      () =>
        applyBindingWaivers([MISMATCH], {
          approvedBindingExceptions: [exception(file)],
        }),
      /does not prove this exact mismatch/
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("prova de outra ferramenta NAO dispensa", () => {
  const { dir, file } = proofFile({ tool: "algo-que-eu-inventei" });
  try {
    assert.throws(
      () =>
        applyBindingWaivers([MISMATCH], {
          approvedBindingExceptions: [exception(file)],
        }),
      /does not prove this exact mismatch/
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("arquivo de prova ausente NAO dispensa", () => {
  assert.throws(
    () =>
      applyBindingWaivers([MISMATCH], {
        approvedBindingExceptions: [
          exception("/tmp/nao-existe-mesmo-12345.json"),
        ],
      }),
    /evidence file does not exist/
  );
});

for (const missing of ["owner", "reason", "scope", "review"]) {
  test(`excecao sem ${missing} NAO dispensa`, () => {
    const { dir, file } = proofFile();
    try {
      assert.throws(
        () =>
          applyBindingWaivers([MISMATCH], {
            approvedBindingExceptions: [exception(file, { [missing]: "  " })],
          }),
        new RegExp(`non-empty ${missing}`)
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test("campo NAO dispensavel estoura mesmo com prova perfeita", () => {
  const { dir, file } = proofFile({ field: "toolchainFingerprint" });
  try {
    assert.throws(
      () =>
        applyBindingWaivers(
          [{ field: "toolchainFingerprint", before: BEFORE, after: AFTER }],
          {
            approvedBindingExceptions: [
              exception(file, { field: "toolchainFingerprint" }),
            ],
          }
        ),
      /can never be waived/
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("approvedBindingExceptions que nao e array estoura", () => {
  assert.throws(
    () => applyBindingWaivers([MISMATCH], { approvedBindingExceptions: {} }),
    /must be an array/
  );
});
