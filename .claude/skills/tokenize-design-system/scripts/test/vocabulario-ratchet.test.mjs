/**
 * vocabulario-ratchet.test.mjs — trava o contrato de vocabulário e o ratchet.
 *
 * Guard que nunca foi visto FALHANDO não é guard, é intenção. Este arquivo
 * exercita o ratchet num app de verdade (fixture com Tailwind real, oráculo
 * real, motor de CSS real) nos quatro estados que importam:
 *
 *   1. vocabulário intacto        -> exit 0
 *   2. classe nova introduzida    -> exit 1   <- o caso que justifica o guard
 *   3. classe removida            -> exit 0   (encolher é o objetivo)
 *   4. CSS buildado quebrado      -> exit 3   (fail-closed, NÃO exit 0)
 *
 * O caso 4 existe porque foi ele que quase passou despercebido: sem CSS
 * buildado o estrato 4 vira PISO, o resíduo incha com consumo de token do app,
 * e um guard fail-open aprovaria classe nova em silêncio enquanto imprime
 * "ok". Um ratchet que passa quando o instrumento está cego é pior que nenhum.
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  FAMILIA_POR_PROPRIEDADE, analisarClasse, tokenNomeadoInlinado, vazamentoTokenizavel,
} from "../lib/vocabulary-contract.mjs";

const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORACULO = path.join(SCRIPTS, "measure-disposition.mjs");
const PROPOR = path.join(SCRIPTS, "propose-vocabulary.mjs");
const RATCHET = path.join(SCRIPTS, "vocabulary-ratchet.mjs");

/* ─────────────────────── parte 1: a regra, sem fixture ─────────────────────── */

test("analisarClasse: RELAÇÃO não é quantidade de escala", () => {
  /* `w-full` = largura do pai. Não há outro valor a escolher: não é escala. */
  assert.deepEqual(analisarClasse(".w-full { width: 100%; }", "w-full").escalas, []);
  assert.deepEqual(analisarClasse(".top-0 { top: 0px; }", "top-0").escalas, []);
  assert.deepEqual(analisarClasse(".h-screen { height: 100vh; }", "h-screen").escalas, []);
  assert.deepEqual(analisarClasse(".w-auto { width: auto; }", "w-auto").escalas, []);
  assert.deepEqual(analisarClasse(".opacity-0 { opacity: 0%; }", "opacity-0").escalas, []);
  assert.deepEqual(analisarClasse(".opacity-100 { opacity: 100%; }", "opacity-100").escalas, []);
  assert.deepEqual(analisarClasse(".col-span-6 { grid-column: span 6 / span 6; }", "col-span-6").escalas, []);
});

test("analisarClasse: QUANTIDADE de escala é detectada", () => {
  /* o número 60 foi ESCOLHIDO de uma escala — poderia ter sido 56 ou 64. */
  assert.deepEqual(analisarClasse(".w-60 { width: calc(var(--spacing) * 60); }", "w-60").escalas, ["spacing"]);
  assert.deepEqual(analisarClasse(".max-w-2xl { max-width: var(--container-2xl); }", "max-w-2xl").escalas, ["container"]);
  assert.deepEqual(analisarClasse(".z-tooltip { z-index: 99; }", "z-tooltip").escalas, ["z"]);
  assert.deepEqual(analisarClasse(".opacity-50 { opacity: 50%; }", "opacity-50").escalas, ["opacity"]);
});

test("analisarClasse: família vem da PROPRIEDADE, não do prefixo do nome", () => {
  /* `truncate` não tem prefixo nenhum e mesmo assim tem família. */
  assert.equal(
    analisarClasse(".truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }", "truncate").familia,
    "overflow",
  );
  /* `size-4` gera width+height, exatamente como w-4/h-4 — mesma família. */
  assert.equal(
    analisarClasse(".size-4 { width: calc(var(--spacing) * 4); height: calc(var(--spacing) * 4); }", "size-4").familia,
    "dimensao",
  );
});

test("analisarClasse: @property não vaza `syntax`/`inherits` como propriedade da classe", () => {
  const css = ".transform { transform: var(--tw-rotate-x,); } "
    + '@property --tw-rotate-x { syntax: "*"; inherits: false; initial-value: 0; }';
  const a = analisarClasse(css, "transform");
  assert.equal(a.familia, "transformacao");
  assert.ok(!a.propriedades.includes("syntax"), "`syntax` do @property não pode virar propriedade da classe");
  assert.ok(!a.propriedades.includes("inherits"));
});

test("vazamentoTokenizavel: pega o que o TOK do oráculo perde por variante desconhecida", () => {
  /* estas são família TOKENIZÁVEL (estrato 3) que caem no resíduo porque o
     TOK enumera variantes numa allowlist fixa. NÃO podem virar vocabulário. */
  for (const c of ["pwa:pb-5", "pwa:rounded-3xl", "after:rounded-full", "peer-focus:ring-2", "light:border!"]) {
    assert.equal(vazamentoTokenizavel(c), true, `${c} deveria ser marcada como vazamento tokenizável`);
  }
  /* e não pode incendiar vocabulário legítimo */
  for (const c of ["flex", "w-full", "sr-only", "md:visible", "hover:underline", "-translate-y-1/2", "scroll-mt-24", "!allm-text-xs"]) {
    assert.equal(vazamentoTokenizavel(c), false, `${c} NÃO é vazamento tokenizável`);
  }
});

test("vazamentoTokenizavel: o `!` PREFIXADO não esconde a família tokenizável", () => {
  /* Medido no alvo: estas 10 derrubavam `propose-vocabulary` em
     `familia === "nao-classificada"` — a versão anterior só removia `!` no FIM.
     São spacing / tipografia / radius / cor / border-width com `!important`. */
  for (const c of [
    "!p-0", "!m-0", "!text-xs", "!rounded-lg", "!font-thin", "!font-normal",
    "!border-t-transparent", "!border-l-transparent", "!border-b-transparent", "light:!border",
    "-mt-2", "!-mx-1",
  ]) {
    assert.equal(vazamentoTokenizavel(c), true, `${c} deveria ser marcada como vazamento tokenizável`);
  }
  /* e o `!` não pode promover a vazamento o que não é família tokenizável */
  for (const c of ["!flex", "!hidden", "!items-center", "light:!visible", "-translate-x-1/2"]) {
    assert.equal(vazamentoTokenizavel(c), false, `${c} NÃO é vazamento tokenizável`);
  }
});

test("tokenNomeadoInlinado: variante e sufixo `!` não escondem o token", () => {
  const vars = new Set(["--z-internal", "--z-tooltip"]);
  assert.equal(tokenNomeadoInlinado("z-tooltip", vars), "--z-tooltip");
  assert.equal(tokenNomeadoInlinado("md:z-internal", vars), "--z-internal");
  assert.equal(tokenNomeadoInlinado("flex", vars), null);
});

test("FAMILIA_POR_PROPRIEDADE não tem família órfã na tabela de razões", async () => {
  const { RAZAO_POR_FAMILIA } = await import("../lib/vocabulary-contract.mjs");
  for (const f of new Set(FAMILIA_POR_PROPRIEDADE.values())) {
    assert.ok(RAZAO_POR_FAMILIA[f], `família \`${f}\` sem razão declarada — o bloco de 5 chaves sairia vazio`);
  }
});

/* ─────────────────── parte 2: o ratchet, contra um app real ─────────────────── */

/**
 * A fixture precisa de `@tailwindcss/node` REAL — o ponto do teste é o motor
 * de verdade, não um mock. Resolvemos a partir do cwd (que, rodando pelo
 * `tokens:workflow:test` do alvo, é o app). Se não resolver, o teste SKIPA com
 * a razão impressa, em vez de passar em silêncio fingindo cobertura.
 */
function acharNodeModules() {
  for (const base of [process.cwd(), SCRIPTS]) {
    try {
      const req = createRequire(path.join(base, "package.json"));
      const p = req.resolve("@tailwindcss/node");
      return p.slice(0, p.indexOf(`${path.sep}node_modules${path.sep}`) + `${path.sep}node_modules`.length);
    } catch { /* tenta o próximo */ }
  }
  return null;
}

const APP_JSX = `export const CARD = "flex flex-col items-center gap-2 rounded-lg";
export default function App() {
  return (
    <div className={CARD}>
      <span className="flex items-center w-full relative overflow-hidden">a</span>
      <span className="flex items-center w-full relative overflow-hidden">b</span>
      <button className="cursor-pointer shrink-0 justify-between truncate">c</button>
      <button className="cursor-pointer shrink-0 justify-between truncate">d</button>
      <i className="z-tooltip block hidden absolute" />
      <i className="tooltip grid uppercase italic" />
    </div>
  );
}
`;
const CSS_OK = `@import "tailwindcss";
@theme { --z-tooltip: 99; --duration-fast: 120ms; }
.tooltip { position: absolute; }
`;

function montarFixture(nodeModules) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "vocab-fixture-"));
  mkdirSync(path.join(dir, "src"), { recursive: true });
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "fixture-vocab", private: true, type: "module" }));
  writeFileSync(path.join(dir, "src", "index.css"), CSS_OK);
  writeFileSync(path.join(dir, "src", "App.jsx"), APP_JSX);
  symlinkSync(nodeModules, path.join(dir, "node_modules"), "dir");
  return dir;
}
const rodar = (script, dir, extra = []) =>
  spawnSync(process.execPath, [script, "--root", dir, ...extra], { encoding: "utf8" });

const NM = acharNodeModules();

test("ratchet end-to-end nos 4 estados", { skip: NM ? false : "@tailwindcss/node não resolve do cwd nem dos scripts — sem motor real, o teste seria teatro" }, async (t) => {
  const dir = montarFixture(NM);
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  /* o oráculo tem de ver o app antes de qualquer coisa */
  const R = JSON.parse(execFileSync(process.execPath, [ORACULO, "--root", dir, "--json"], { encoding: "utf8" }));
  assert.ok(R.universo > 0, "denominador vazio — a fixture não foi lida");
  assert.equal(R.cssBuildado.disponivel, true, "a fixture precisa do CSS buildado carregando");

  await t.test("`resto` reconcilia com o número publicado do estrato 7", () => {
    /* trava o `break` -> `continue` que introduzi em measure-disposition:
       se ele tivesse mudado `allow`/`cum`, estes dois totais divergiriam. */
    const soma = (xs) => xs.reduce((s, x) => s + x.usos, 0);
    assert.equal(soma(R.vocabulario), R.estratos.vocabularioLayout.usos);
    assert.equal(R.vocabulario.length, R.estratos.vocabularioLayout.classes);
    assert.equal(soma(R.excecaoClasses), R.estratos.excecaoItemAItem.usos);
  });

  await t.test("sem documento: report-only, nunca reprova (padrão local ds-gate)", () => {
    assert.equal(rodar(RATCHET, dir).status, 0);
  });

  const gerado = rodar(PROPOR, dir, ["--write"]);
  assert.equal(gerado.status, 0, `propose-vocabulary falhou: ${gerado.stderr}`);

  await t.test("CASO 1 — vocabulário intacto: PASSA", () => {
    const r = rodar(RATCHET, dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /vocabulario intacto/);
  });

  const jsx = path.join(dir, "src", "App.jsx");
  await t.test("CASO 2 — classe nova introduzida: FALHA com exit 1 e nomeia a classe", () => {
    writeFileSync(jsx, APP_JSX.replace('"tooltip grid uppercase italic"', '"tooltip grid uppercase italic sticky isolate"'));
    const r = rodar(RATCHET, dir);
    assert.equal(r.status, 1, `deveria reprovar; saiu ${r.status}\n${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /CRESCEU \(\+2\)/);
    assert.match(r.stdout, /\+ sticky/);
    assert.match(r.stdout, /\+ isolate/);
  });

  await t.test("CASO 2b — --report vê o mesmo crescimento mas NUNCA reprova", () => {
    const r = rodar(RATCHET, dir, ["--report"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /CRESCEU \(\+2\)/);
  });

  await t.test("CASO 3 — classe removida: PASSA e reporta o encolhimento", () => {
    writeFileSync(jsx, APP_JSX.replace('"tooltip grid uppercase italic"', '"tooltip grid"'));
    const r = rodar(RATCHET, dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /encolheu \(-2\)/);
    assert.match(r.stdout, /- uppercase/);
  });

  await t.test("CASO 4 — CSS buildado quebrado: PARA com exit 3, não passa nem reprova como se fosse classe nova", () => {
    writeFileSync(jsx, APP_JSX);
    writeFileSync(path.join(dir, "src", "index.css"), `${CSS_OK}\n.quebra { @apply border-nao-existe; }\n`);
    const r = rodar(RATCHET, dir);
    assert.equal(r.status, 3, `fail-closed exigido; saiu ${r.status}\n${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /CSS buildado indispon/);
    /* e o gerador se recusa a escrever contrato em cima do estado cego */
    assert.equal(rodar(PROPOR, dir, ["--write"]).status, 3);
    writeFileSync(path.join(dir, "src", "index.css"), CSS_OK);
  });

  await t.test("documento sem o bloco de máquina PARA (exit 2) em vez de aprovar tudo", () => {
    const doc = path.join(dir, "docs", "design-system", "VOCABULARIO-LAYOUT.md");
    cpSync(doc, `${doc}.bak`);
    writeFileSync(doc, "# contrato sem bloco de maquina\n");
    const r = rodar(RATCHET, dir);
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.match(r.stderr, /bloco/);
    cpSync(`${doc}.bak`, doc);
  });
});
