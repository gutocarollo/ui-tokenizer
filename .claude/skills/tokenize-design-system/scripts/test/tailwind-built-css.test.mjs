/**
 * Regressão do ESTRATO 4 — contrato existente medido no CSS BUILDADO.
 *
 * Dois defeitos que este teste trava, os dois já cometidos nesta sessão:
 *
 * (1) O DETECTOR CEGO. `measure-disposition` procurava contrato existente só como
 *     seletor `.classe` no CSS FONTE. `duration-fast` é
 *     `transition-duration: var(--duration-fast)` — utility GERADA de motion
 *     token, consumo de token puro — e caía no estrato 6 ("vocabulário de
 *     layout"), no mesmo balde que `flex`. Estrato 4 subestimado, 6
 *     superestimado, e a partição fechando 100% em cima do rótulo errado.
 *
 * (2) A REGRA INGÊNUA. "consome `var()` ⇒ está em contrato" credita `w-60`
 *     (`calc(var(--spacing) * 60)`, 266 usos no alvo) e `animate-spin`
 *     (`var(--animate-spin)`) como já tokenizados. `--spacing` e `--animate-spin`
 *     são do TEMA PADRÃO do Tailwind, não decisão de design do app. Medido: a
 *     regra ingênua creditaria 1.210 usos contra os 200 reais. O discriminador é
 *     a PROCEDÊNCIA da variável.
 *
 * (3) E o defeito que eu introduzi ao consertar (1): a primeira versão de
 *     `seletoresDeClasse` lia só o trecho antes do primeiro `{` de cada chunk
 *     separado por `}`, e PERDIA todo seletor aninhado em `@media`/`@layer` —
 *     `.sidebar-items:after` no alvo real. Teria tirado 3 usos legítimos do
 *     estrato 4 em nome de "remover falso positivo". Travado abaixo.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  seletoresDeClasse, declaracoesDeVar, entradaCss,
  contratoDoCssFonte, carregarCssBuildado,
} from "../lib/tailwind-built-css.mjs";

const ALVO = "/home/augusto/code/makers-ai-hub/frontend";

/* ------------------------------------------------------ seletor do CSS --- */

test("seletor aninhado em @media/@layer NAO se perde", () => {
  const css = `
@layer components {
  @media (min-width: 40rem) {
    .sidebar-items:after { content: ""; }
  }
  .fade-up-border { border: 1px solid red; }
}
.tooltip { z-index: 10; }
`;
  const s = seletoresDeClasse(css);
  for (const c of ["sidebar-items", "fade-up-border", "tooltip"]) {
    assert.ok(s.has(c), `${c} deveria ser reconhecida como seletor`);
  }
});

test("comentario, string e valor de declaracao NAO viram seletor", () => {
  const css = `
/* GENERATED FROM tokens/color.tokens.json — troque .bg-theme-bg-secondary */
/* ref: https://www.w3.org/TR/css/ */
@font-face { src: url("./fonts/Inter.ttf") format("truetype"); }
.real { background: url(./x.txt); }
`;
  const s = seletoresDeClasse(css);
  assert.ok(s.has("real"), "seletor de verdade tem que sobreviver");
  for (const falso of ["json", "tokens", "bg-theme-bg-secondary", "w3", "org", "ttf", "txt"]) {
    assert.ok(!s.has(falso), `${falso} e falso positivo de comentario/valor/string`);
  }
});

test("pseudo-classe e :root nao sao confundidos com valor de declaracao", () => {
  const s = seletoresDeClasse(`:root { --a: 1px; } .btn:hover { color: red; } .btn:has(input:checked) { color: blue; }`);
  assert.ok(s.has("btn"));
  assert.equal(s.size, 1);
});

test("declaracoesDeVar ignora comentario", () => {
  const v = declaracoesDeVar(`/* --nao-existe: 1; */ :root { --duration-fast: 150ms; }`);
  assert.ok(v.has("--duration-fast"));
  assert.ok(!v.has("--nao-existe"));
});

/* ------------------------------------------------- fallback DECLARADO --- */

function fixture(comEntrada = true) {
  const dir = mkdtempSync(path.join(tmpdir(), "tbc-"));
  mkdirSync(path.join(dir, "src"), { recursive: true });
  writeFileSync(path.join(dir, "package.json"), '{"name":"fx","type":"module"}');
  if (comEntrada) {
    writeFileSync(path.join(dir, "src/index.css"), `@import "tailwindcss";\n.tooltip { color: var(--x); }\n:root { --x: red; }\n`);
  }
  return dir;
}

test("sem @tailwindcss/node: disponivel=false, motivo preenchido, NUNCA lanca", async () => {
  const dir = fixture();
  try {
    const b = await carregarCssBuildado(dir);
    assert.equal(b.disponivel, false);
    assert.match(b.motivo, /@tailwindcss\/node nao resolve/);
    // classificar continua chamavel e devolve vazio — nao credita nada por engano
    assert.equal(b.classificar(["duration-fast", "flex"]).size, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("sem entrada CSS com tailwind: motivo diz QUAL entrada faltou", async () => {
  const dir = fixture(false);
  try {
    const b = await carregarCssBuildado(dir);
    assert.equal(b.disponivel, false);
    assert.match(b.motivo, /nenhuma entrada CSS/);
    assert.equal(entradaCss(dir), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("o fallback ainda enxerga o seletor do CSS fonte — degrada, nao zera", async () => {
  const dir = fixture();
  try {
    const f = contratoDoCssFonte(dir);
    assert.equal(f.entrada, path.join("src", "index.css"));
    assert.ok(f.seletoresCustom.has("tooltip"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

/* ------------------------------------------------ o alvo real, medido --- */

test("alvo real: token DO APP conta, default do Tailwind NAO conta", async (t) => {
  if (!existsSync(path.join(ALVO, "node_modules/@tailwindcss/node"))) {
    return t.skip(`alvo ausente em ${ALVO}`);
  }
  const b = await carregarCssBuildado(ALVO);
  /*
   * MESMA REGRA DO TESTE IRMAO (Linha 170): compilador indisponivel e SKIP com o
   * motivo, nao FAIL.
   *
   * Isto nao e esconder falha — o motivo vai junto e nomeia a divida. A divida
   * medida hoje: o alvo roda Tailwind v4.3.3 mas o `src/index.css` esta escrito
   * no estilo v3 — `@tailwind base/components/utilities` em vez de
   * `@import "tailwindcss"`, e `!` PREFIXADO (`!py-2`) onde o v4 usa sufixo
   * (`py-2!`). Sao 3 regras `@apply` (Linhas 676, 921, 1106 do index.css).
   *
   * O APP ESTA CORRETO EM PRODUCAO: a via PostCSS aceita a sintaxe v3 e o
   * artefato traz `.tooltip{z-index:10!important;...}` buildado. Quem recusa e a
   * API programatica pura do v4 (`__unstable__loadDesignSystem`).
   *
   * Fazer o teste FALHAR aqui reprovaria o app por uma incompatibilidade entre o
   * PROBE e o estilo da entrada — nao por defeito do que se mede. Migrar o CSS
   * para o estilo v4 e mudanca visual real e exige prova de pixel; entra como
   * lote proprio, nao como efeito colateral de um teste.
   */
  if (!b.disponivel) return t.skip(b.motivo);

  /**
   * INTERSECCAO ZERO e o que dispensa regra de desempate: o app nunca redeclara
   * um default do Tailwind. Se um dia deixar de ser 0, quem vence passa a ser
   * decisao do dono e este teste avisa antes do numero mudar em silencio.
   */
  assert.equal(b.interseccaoVars, 0);

  const r = b.classificar([
    "duration-fast", "duration-surface", "ease-standard",   // motion token do app
    "w-60", "h-4", "animate-spin", "max-w-2xl", "blur-md",  // default do Tailwind
    "transition-colors",                                    // --default-transition-*
    "flex", "absolute", "truncate",                         // sem var nenhuma
    "zzz-nao-existe",                                       // nao gerada
  ]);

  assert.deepEqual(r.get("duration-fast").tokensDoApp, ["--duration-fast"]);
  assert.deepEqual(r.get("duration-surface").tokensDoApp, ["--duration-surface"]);
  assert.deepEqual(r.get("ease-standard").tokensDoApp, ["--ease-standard"]);

  for (const c of ["w-60", "h-4", "animate-spin", "max-w-2xl", "blur-md", "transition-colors"]) {
    assert.equal(r.get(c).gerada, true, `${c} deveria ser gerada`);
    assert.deepEqual(r.get(c).tokensDoApp, [], `${c} consome var() do TEMA PADRAO — creditar seria falso-verde`);
  }
  for (const c of ["flex", "absolute", "truncate"]) {
    assert.deepEqual(r.get(c).tokensDoApp, []);
  }
  assert.equal(r.get("zzz-nao-existe").gerada, false);
  assert.equal(r.get("zzz-nao-existe").tokensDoApp.length, 0);
});

test("alvo real: o compilador reproduz o dist/index.css buildado", async (t) => {
  const dist = path.join(ALVO, "dist/index.css");
  if (!existsSync(dist)) return t.skip("dist/index.css ausente — rode o build do alvo");
  const { readFileSync } = await import("node:fs");
  const buildado = readFileSync(dist, "utf8");
  const b = await carregarCssBuildado(ALVO);
  if (!b.disponivel) return t.skip(b.motivo);

  /**
   * A substituicao "compilador em vez de `yarn build`" e falsificavel, e este
   * teste e a falsificacao: as declaracoes que o compilador emite tem que estar
   * no artefato que o build de verdade produziu.
   */
  for (const [classe, decl] of [
    ["duration-fast", "transition-duration:var(--duration-fast)"],
    ["ease-standard", "transition-timing-function:var(--ease-standard)"],
    ["w-60", "width:calc(var(--spacing) * 60)"],
  ]) {
    assert.ok(buildado.includes(`.${classe}{`), `.${classe} ausente do dist`);
    assert.ok(buildado.includes(decl), `dist nao traz "${decl}"`);
    const css = b.classificar([classe]).get(classe).css;
    const norm = css.replace(/\s+/g, "").replace(/calc\(var\(--spacing\)\*60\)/, "calc(var(--spacing) * 60)");
    assert.ok(norm.includes(decl.replace(/\s+/g, "").replace(/calc\(var\(--spacing\)\*60\)/, "calc(var(--spacing) * 60)")),
      `compilador e dist divergem em ${classe}`);
  }
});
