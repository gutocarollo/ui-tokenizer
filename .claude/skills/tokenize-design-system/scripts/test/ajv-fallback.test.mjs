/**
 * Ajv do validador: alvo primeiro, árvore do processo como fallback.
 *
 * Medido em 2026-08-03 na primeira cobaia real: o ajv dela era 6.14.0
 * transitivo (sem `dist/2020`) e o `init` recusava um alvo válido exigindo
 * que o APP adotasse Ajv 8 como devDependency — o processo impondo dependência
 * ao alvo, contra D4. Este teste vê o fallback funcionar num alvo SEM ajv
 * nenhum; não precisa de TOKENIZE_TEST_ROOT de propósito.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createArtifactValidator } from "../lib/artifact-contract.mjs";

test("alvo sem ajv/dist/2020 valida mesmo assim — o dialeto vem da árvore do processo", () => {
  const alvo = mkdtempSync(path.join(tmpdir(), "alvo-sem-ajv-"));
  writeFileSync(path.join(alvo, "package.json"), JSON.stringify({ name: "alvo-nu", private: true }));
  const validator = createArtifactValidator({ root: alvo });
  assert.ok(validator, "validador nasce sem o alvo carregar Ajv");
});
