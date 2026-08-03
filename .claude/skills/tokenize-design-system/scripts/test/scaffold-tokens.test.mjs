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

import { configDoCompilador, esqueletoDTCG, planejarScaffold } from "../scaffold-tokens.mjs";

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

test("sem tokens:build o scaffold ENTREGA o compilador — pipeline completo, nunca metade", () => {
  const p = planejarScaffold(alvo({ comBuild: false, comFonte: "app" }));
  assert.equal(p.erro, undefined);
  const rels = p.criar.map((c) => c.rel);
  assert.deepEqual(rels, [
    "tokenization.config.json",
    "tokens/color.tokens.json",
    "style-dictionary.config.json",
    "package.json",
  ]);
  const pkg = p.criar.find((c) => c.rel === "package.json").conteudo;
  assert.match(pkg.scripts["tokens:build"], /^style-dictionary build --config/);
  assert.ok(pkg.devDependencies["style-dictionary"], "a dependência é DECLARADA (instalar é do operador)");
});

test("o compilador é Style Dictionary configurado, não código nosso: @theme + outputReferences", () => {
  // A forma REAL que `planejarScaffold` produz é RELATIVA ("app"), não absoluta.
  // Alimentar o teste com a forma imaginada foi o que deixou o CSS ser escrito
  // três níveis acima, dentro do repo do processo (2026-08-03).
  const cfg = configDoCompilador(["app"], "/alvo");
  const arquivo = cfg.platforms.css.files[0];
  assert.equal(arquivo.format, "css/variables", "format EXISTENTE, sem format custom");
  // `:root` não gera utility no Tailwind v4; `@theme` gera (doc oficial).
  assert.equal(arquivo.options.selector, "@theme");
  // Alias preservado: o componente SEGUE o primitivo. Achatar quebra o tier.
  assert.equal(arquivo.options.outputReferences, true);
  assert.equal(cfg.platforms.css.buildPath, "app/styles/generated/");
  assert.deepEqual(cfg.source, ["tokens/**/*.tokens.json"]);
});

test("o passo MANUAL é declarado em voz alta — sem o import, build passa verde e zero utility existe", () => {
  const p = planejarScaffold(alvo({ comBuild: false, comFonte: "app" }));
  assert.match(p.importarNoEntryCss, /^@import "\.\/styles\/generated\/theme\.css";$/);
  assert.ok(p.instalar, "dependência nova exige instalação declarada");
});

test("alvo que JÁ tem tokens:build não recebe nossa config — o pipeline dele vence", () => {
  const p = planejarScaffold(alvo({ comBuild: true, comFonte: "app" }));
  const rels = p.criar.map((c) => c.rel);
  assert.ok(!rels.includes("style-dictionary.config.json"), "não impor compilador a quem já tem");
  assert.ok(!rels.includes("package.json"), "package.json do alvo fica intocado");
  assert.equal(p.importarNoEntryCss, null, "nada a importar: o build é dele");
});

test("buildPath NUNCA escapa do alvo — nem com raiz absoluta de outro lugar", () => {
  // A forma relativa é a do produtor; a absoluta coerente também vale.
  assert.equal(configDoCompilador(["app"], "/alvo").platforms.css.buildPath, "app/styles/generated/");
  assert.equal(configDoCompilador(["/alvo/app"], "/alvo").platforms.css.buildPath, "app/styles/generated/");
  // Raiz fora do alvo é RECUSA, não caminho com "..": foi assim que o CSS foi
  // escrito dentro do repositório do processo.
  assert.throws(() => configDoCompilador(["/outro/app"], "/alvo"), /fora do alvo/);
  assert.throws(() => configDoCompilador([".."], "/alvo"), /fora do alvo/);
});

test("o plano REAL do produtor gera buildPath dentro do alvo (contrato x produtor, confrontados)", () => {
  const root = alvo({ comBuild: false, comFonte: "app" });
  const p = planejarScaffold(root);
  const sd = p.criar.find((c) => c.rel === "style-dictionary.config.json").conteudo;
  assert.equal(sd.platforms.css.buildPath, "app/styles/generated/");
  assert.ok(!sd.platforms.css.buildPath.includes(".."), "nenhum salto para fora");
});
