/**
 * preflight-tokens — os TRÊS desfechos vistos de fora (o contrato é o CLI;
 * o arquivo executa no import, importar seria armadilha):
 *   virgem (exit 2, declarado) · parcial (exit 1, quebra) · e a detecção de
 *   gerenciador por lockfile embutida no caminho feliz.
 * O caminho feliz completo (build+validação reais) exige um alvo com pipeline
 * vivo — coberto pelo smoke real; aqui cobrimos as RECUSAS, que são o produto.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SCRIPT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../preflight-tokens.mjs"
);

function alvo(extra = {}) {
  const raiz = mkdtempSync(path.join(tmpdir(), "preflight-"));
  writeFileSync(
    path.join(raiz, "package.json"),
    JSON.stringify({ name: "alvo-teste", private: true, ...extra })
  );
  return raiz;
}

function rodar(raiz) {
  return spawnSync(process.execPath, [SCRIPT, "--root", raiz], { encoding: "utf8" });
}

function alvoComPipeline({ importaTema }) {
  const raiz = alvo({ scripts: { "tokens:build": "node build-tokens.mjs" } });
  mkdirSync(path.join(raiz, "app", "styles"), { recursive: true });
  mkdirSync(path.join(raiz, "tokens"), { recursive: true });
  writeFileSync(
    path.join(raiz, "tokenization.config.json"),
    JSON.stringify({
      sourceRoots: ["app"],
      tokenFile: "tokens/color.tokens.json",
      themeFile: "app/styles/generated/theme.css",
    })
  );
  writeFileSync(
    path.join(raiz, "tokens/color.tokens.json"),
    JSON.stringify({ spacing: { card: { $type: "dimension", $value: { value: 63, unit: "px" } } } })
  );
  writeFileSync(
    path.join(raiz, "build-tokens.mjs"),
    'import { mkdirSync, writeFileSync } from "node:fs";\n' +
      'mkdirSync("app/styles/generated", { recursive: true });\n' +
      'writeFileSync("app/styles/generated/theme.css", "@theme { --spacing-card: 63px; }\\n");\n'
  );
  writeFileSync(
    path.join(raiz, "app/styles/globals.css"),
    `@import "tailwindcss";\n${importaTema ? '@import "./generated/theme.css";\n' : ""}`
  );
  return raiz;
}

test("alvo VIRGEM (sem script e sem tokens/) → exit 2 DECLARADO com status virgin", () => {
  const r = rodar(alvo());
  assert.equal(r.status, 2);
  const json = JSON.parse(r.stdout);
  assert.equal(json.status, "virgin");
  assert.match(json.proximoPasso, /PRIMEIRO LOTE/);
});

test("pipeline PARCIAL: script sem arquivo DTCG → exit 1 (quebra, não estado)", () => {
  const raiz = alvo({ scripts: { "tokens:build": "true" } });
  const r = rodar(raiz);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /PARCIAL/);
});

test("pipeline PARCIAL: arquivo DTCG sem script → exit 1", () => {
  const raiz = alvo();
  mkdirSync(path.join(raiz, "tokens"));
  writeFileSync(path.join(raiz, "tokens/color.tokens.json"), "{}");
  const r = rodar(raiz);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /PARCIAL/);
});

test("sem package.json no --root → exit 1 com mensagem clara", () => {
  const vazio = mkdtempSync(path.join(tmpdir(), "preflight-vazio-"));
  const r = rodar(vazio);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /package\.json/);
});

test("--help sai 0 e documenta o vocabulário de exit", () => {
  const out = execFileSync(process.execPath, [SCRIPT, "--help"], { encoding: "utf8" });
  assert.match(out, /exit 0 .* 1 .* 2/s);
});

test("CSS @theme gerado mas FORA do grafo do entry → exit 1 (build verde não basta)", () => {
  const r = rodar(alvoComPipeline({ importaTema: false }));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /NÃO está alcançável por @import/);
  assert.match(r.stderr, /app\/styles\/globals\.css/);
});

test("CSS @theme importado pelo entry Tailwind → exit 0 com alcance declarado", () => {
  const r = rodar(alvoComPipeline({ importaTema: true }));
  assert.equal(r.status, 0, r.stderr);
  const payload = JSON.parse(r.stdout);
  assert.deepEqual(payload.themeReachableFrom, ["app/styles/globals.css"]);
});
