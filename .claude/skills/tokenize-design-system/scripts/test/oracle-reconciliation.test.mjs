/**
 * Regressão dos DOIS ORÁCULOS — eles não podem publicar denominadores diferentes
 * do mesmo alvo.
 *
 * O bug que este teste trava: `measure-coverage.mjs` e `measure-disposition.mjs`
 * se declaravam, cada um, partição fail-closed de 100% do universo, e no alvo
 * real fechavam em **32.114 / 447 entidades** contra **31.950 / 444**. Fail-closed
 * não protege contra isso — uma partição fecha perfeitamente sobre um denominador
 * errado. A causa era estrutural: `measure-disposition` tinha censo PRÓPRIO
 * (`walk(ROOT/src)` + extração) e o critério de entidade escrito à mão, enquanto
 * `measure-coverage` importava `lib/bundle-census.mjs`.
 *
 * A diferença inteira (164 usos, medida) era `className={CONST}` resolvido para o
 * `const` de contrato: só o `census()` fazia isso. E esse é o defeito CARO, não
 * um arredondamento — o veículo desta fase É o `const` exportado, então um oráculo
 * cego a ele mede MENOS conforme o codemod avança. No limite, um alvo 100%
 * migrado sai com universo perto de zero e uma partição que "soma 100%".
 *
 * Por isso o teste não compara só os totais: ele exige que a fixture EXERÇA o
 * contrato nomeado (`usosViaContratoNomeado > 0`), senão passaria vazio contra um
 * alvo sem `const` nenhum — que é exatamente onde os dois censos concordavam.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ------------------------------------------------------------- fixture --- */

/**
 * A fixture reproduz as DUAS causas candidatas da divergência, para que o teste
 * fique sensível às duas:
 *
 *   (a) contrato nomeado — `const CARD_BASE` declarado em `src/ui/contracts.js`
 *       e consumido em outro arquivo por `className={CARD_BASE}` e por
 *       `className={cn(CARD_BASE, "shadow-sm")}`. O censo próprio antigo lia
 *       esses call sites como dinâmicos: 0 uso.
 *   (b) escopo do walk — `scripts/gerador.js` FORA de `src/`, com className
 *       literal. Medido no alvo real esse caso valia 0 usos, mas 0 medido não é
 *       0 garantido: a fixture o torna não-zero de propósito, para que uma
 *       divergência de escopo entre os dois oráculos reprove aqui.
 */
function escreveFixture() {
  const dir = mkdtempSync(path.join(tmpdir(), "reconciliacao-"));
  mkdirSync(path.join(dir, "src", "ui"), { recursive: true });
  mkdirSync(path.join(dir, "scripts"), { recursive: true });
  mkdirSync(path.join(dir, "tokens"), { recursive: true });

  /**
   * `measure-coverage` FALHA FECHADA (exit 3) sem o vocabulário da lei, e
   * `score-naming` resolve o layout DTCG no corpo do módulo. Sem este arquivo o
   * teste reprovaria por falta de fixture, não por divergência de oráculo — e um
   * teste que morre antes de medir não trava regressão nenhuma.
   */
  writeFileSync(
    path.join(dir, "tokens", "color.tokens.json"),
    JSON.stringify({ semantic: { surface: { raised: { $type: "color", $value: "#ffffff" } } } }),
    "utf8"
  );

  writeFileSync(
    path.join(dir, "src", "ui", "contracts.js"),
    'export const CARD_BASE = "flex items-center gap-2 rounded-lg bg-surface-raised";\n',
    "utf8"
  );
  writeFileSync(
    path.join(dir, "src", "App.jsx"),
    [
      'import { CARD_BASE } from "./ui/contracts";',
      "export const A = () => <div className={CARD_BASE} />;",
      'export const B = () => <div className={cn(CARD_BASE, "shadow-sm")} />;',
      'export const C = () => <span className="px-4 bg-red-500 text-sm font-bold" />;',
      'export const D = () => <span className="px-4 bg-red-500 text-sm font-bold" />;',
      'export const E = () => <span className="flex" />;',
    ].join("\n"),
    "utf8"
  );
  writeFileSync(
    path.join(dir, "scripts", "gerador.js"),
    'export const html = () => `<div className="rounded-md border-default" />`;\n',
    "utf8"
  );
  return dir;
}

const roda = (script, dir, extra = []) =>
  JSON.parse(
    execFileSync(process.execPath, [path.join(SCRIPTS, script), "--root", dir, "--json", ...extra], {
      encoding: "utf8",
      env: { ...process.env, TOKENIZE_ROOT: dir },
    })
  );

let DIR, COV, DIS;

test("fixture: os dois oráculos rodam e a fixture EXERCE o contrato nomeado", () => {
  DIR = escreveFixture();
  COV = roda("measure-coverage.mjs", DIR);
  DIS = roda("measure-disposition.mjs", DIR);
  assert.ok(
    COV.usosViaContratoNomeado > 0,
    "sem `className={CONST}` na fixture o teste passaria vazio — era onde os dois censos concordavam"
  );
});

/* ----------------------------------------------- o mesmo denominador ------- */

test("universo idêntico: measure-disposition.universo === measure-coverage.usosDeClasse", () => {
  assert.equal(DIS.universo, COV.usosDeClasse);
  assert.equal(DIS.censo.usosDeClasse, COV.usosDeClasse);
});

test("a parcela que divergia — usos via const de contrato — é a mesma nos dois", () => {
  assert.equal(DIS.censo.usosViaContratoNomeado, COV.usosViaContratoNomeado);
  assert.equal(DIS.censo.atributosViaContratoNomeado, COV.atributosViaContratoNomeado);
});

test("mesma superfície varrida: arquivos, atributos e bundles batem", () => {
  assert.equal(DIS.censo.arquivos, COV.arquivos);
  assert.equal(DIS.censo.atributosClassName, COV.atributosClassName);
  assert.equal(DIS.censo.bundlesDistintos, COV.bundlesDistintos);
});

/* ------------------------------------------------- o mesmo balde 1 --------- */

test("balde de entidade idêntico — era 447 contra 444 no alvo real", () => {
  assert.equal(DIS.estratos.entidadeExata.entidades, COV.entidades);
  assert.equal(DIS.estratos.entidadeExata.usos, COV.usosEmEntidade);
});

test("o critério de entidade é PARÂMETRO nos dois, não literal num deles", () => {
  const cov = roda("measure-coverage.mjs", DIR, ["--min-classes", "7"]);
  const dis = roda("measure-disposition.mjs", DIR, ["--min-classes", "7"]);
  assert.equal(dis.criterio.minClasses, 7);
  assert.equal(cov.criterio.minClasses, 7);
  assert.equal(dis.estratos.entidadeExata.entidades, cov.entidades);
  assert.equal(dis.estratos.entidadeExata.usos, cov.usosEmEntidade);
  assert.notEqual(
    dis.estratos.entidadeExata.usos,
    DIS.estratos.entidadeExata.usos,
    "se mudar o critério não mudasse o balde, a flag não estaria chegando ao instrumento 1"
  );
});

/* --------------------------------------------- a partição continua fechando */

test("os 7 instrumentos continuam somando o universo EXATO", () => {
  const soma = Object.values(DIS.estratos).reduce((s, e) => s + e.usos, 0);
  assert.equal(soma, DIS.universo);
});

/* ------------------------------------------ a testemunha da regressão ------ */

test("o censo próprio antigo (só src, sem contrato) mediria MENOS — a fixture prova o bug", async () => {
  const { classNameAttributes } = await import("../lib/classname-extract.mjs");
  const { readdirSync, readFileSync } = await import("node:fs");
  const EXT = new Set([".js", ".jsx", ".ts", ".tsx"]);
  const walk = (d, out = []) => {
    for (const x of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, x.name);
      if (x.isDirectory()) walk(p, out);
      else if (EXT.has(path.extname(x.name))) out.push(p);
    }
    return out;
  };
  let antigo = 0;
  for (const f of walk(path.join(DIR, "src"))) {
    for (const at of classNameAttributes(readFileSync(f, "utf8"), [])) antigo += at.classes.length;
  }
  assert.ok(
    antigo < DIS.universo,
    `o censo antigo mediu ${antigo} e o atual ${DIS.universo}; se fossem iguais a fixture não exercitaria a divergência`
  );
  assert.equal(
    DIS.universo - antigo,
    COV.usosViaContratoNomeado + 2,
    "a diferença tem que ser explicável item a item: contrato nomeado + os 2 usos de fora de src"
  );
});

test.after(() => { if (DIR) rmSync(DIR, { recursive: true, force: true }); });
