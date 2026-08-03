/**
 * scaffold-tokens — o bootstrap tem de ser idempotente, não-destrutivo e
 * incapaz de esconder config inconsistente. As RECUSAS são o produto: um
 * scaffold que sobrescreve token de alvo real destrói design system.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { esqueletoDTCG, planejarScaffold } from "../scaffold-tokens.mjs";

function alvo({ comFonte = "src", pkg = true, comBuild = true } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "scaffold-"));
  if (pkg) {
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "a",
        private: true,
        ...(comBuild ? { scripts: { "tokens:build": "node build-tokens.mjs" } } : {}),
      })
    );
  }
  if (comFonte) mkdirSync(path.join(root, comFonte), { recursive: true });
  return root;
}

test("alvo virgem: planeja config + DTCG vazio, com a raiz de fonte que EXISTE", () => {
  const root = alvo({ comFonte: "app" });
  const p = planejarScaffold(root);
  assert.equal(p.erro, undefined);
  assert.deepEqual(p.criar.map((c) => c.rel), ["tokenization.config.json", "tokens/color.tokens.json"]);
  assert.deepEqual(p.sourceRoots, ["app"], "só a raiz existente entra — 'src' e 'components' não existem");
  assert.deepEqual(p.criar[0].conteudo, { sourceRoots: ["app"], tokenFile: "tokens/color.tokens.json" });
});

test("o DTCG do esqueleto declara o formato e NENHUM token — naming se decide em DECIDED", () => {
  const dtcg = esqueletoDTCG();
  assert.match(dtcg.$schema, /designtokens\.org/);
  const chavesDeToken = Object.keys(dtcg).filter((k) => !k.startsWith("$"));
  assert.deepEqual(chavesDeToken, [], "scaffold com token decidiria nome fora do lugar");
});

test("alvo JÁ configurado e coerente: nada a criar (idempotente)", () => {
  const root = alvo();
  writeFileSync(
    path.join(root, "tokenization.config.json"),
    JSON.stringify({ sourceRoots: ["src"], tokenFile: "tokens/meu.json" })
  );
  mkdirSync(path.join(root, "tokens"));
  writeFileSync(path.join(root, "tokens/meu.json"), "{}");
  const p = planejarScaffold(root);
  assert.deepEqual(p.criar, []);
  assert.equal(p.tokenFile, "tokens/meu.json");
});

test("token existente NUNCA é sobrescrito, mesmo sem config", () => {
  const root = alvo();
  mkdirSync(path.join(root, "tokens"));
  writeFileSync(path.join(root, "tokens/color.tokens.json"), '{"button":{"$value":"#fff"}}');
  const p = planejarScaffold(root);
  assert.deepEqual(p.criar.map((c) => c.rel), ["tokenization.config.json"], "só a config; o DTCG fica intacto");
  assert.match(readFileSync(path.join(root, "tokens/color.tokens.json"), "utf8"), /#fff/);
});

test("config que aponta tokenFile AUSENTE é inconsistência, não alvo virgem → recusa", () => {
  const root = alvo();
  writeFileSync(
    path.join(root, "tokenization.config.json"),
    JSON.stringify({ sourceRoots: ["src"], tokenFile: "tokens/nao-existe.json" })
  );
  const p = planejarScaffold(root);
  assert.match(p.erro, /inconsistente não é alvo virgem/);
});

test("sem package.json → recusa (não é raiz de app)", () => {
  assert.match(planejarScaffold(alvo({ pkg: false })).erro, /package\.json/);
});

test("nenhuma raiz de fonte existente → recusa pedindo --source-roots", () => {
  assert.match(planejarScaffold(alvo({ comFonte: false })).erro, /--source-roots/);
});

test("sem tokens:build → RECUSA em vez de criar meio pipeline (o guard vizinho chamaria de quebra)", () => {
  const p = planejarScaffold(alvo({ comBuild: false }));
  assert.match(p.erro, /tokens:build/);
  assert.match(p.erro, /PARCIAL/);
  assert.equal(p.criar, undefined, "nada é planejado quando o compilador não existe");
});
