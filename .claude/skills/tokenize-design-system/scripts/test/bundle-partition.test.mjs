/**
 * Regressão da PARTIÇÃO — o balde bloqueante não pode cobrar trabalho já feito.
 *
 * O bug que este teste trava: `measure-coverage` computava o balde B
 * ("tokenizável fora de entidade") com UM predicado só — `TOKENIZAVEL.test(c)` —
 * e imprimia o balde inteiro como trabalho BLOQUEANTE. Medido no alvo real,
 * 2.295 de 7.978 usos (28,8%) desse balde eram classes como
 * `placeholder:text-content-tertiary` e `enabled:hover:bg-surface-hover`: elas
 * casam a família tokenizável E casam `EM_CONTRATO`, ou seja, já estão migradas.
 * O plano somava A+B e chamava de "migrável 75,5%", inflando o trabalho restante.
 *
 * Espelha o defeito irmão já travado em `utility-families.test.mjs`: lá, trabalho
 * obrigatório virava exceção aprovável (`p`/`px`); aqui, trabalho já feito virava
 * trabalho obrigatório. Os dois testes rodam nas DUAS direções por isso.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { census, partition, EM_CONTRATO } from "../lib/bundle-census.mjs";
import { isTokenizableUtility } from "../lib/utility-families.mjs";

/* ------------------------------------------------------------- fixture --- */

/**
 * Fixture escrito em disco e lido pelo `census()` de verdade: um objeto
 * `bundles` montado à mão passaria mesmo que o censo parasse de casar classes.
 *
 *   entidade   `flex items-center gap-2 rounded-lg` — 4 classes, 2 usos.
 *   B1         `placeholder:text-content-tertiary` — tokenizável E em contrato.
 *   B2         `px-4` (spacing, sem slot na lei) e `bg-red-500` (paint, com slot).
 *   C          `flex` sozinho — composição, sem disposição.
 */
function escreveFixture() {
  const dir = mkdtempSync(path.join(tmpdir(), "particao-"));
  mkdirSync(path.join(dir, "src"), { recursive: true });
  writeFileSync(
    path.join(dir, "src", "App.jsx"),
    [
      'export const A = () => <div className="flex items-center gap-2 rounded-lg" />;',
      'export const B = () => <div className="flex items-center gap-2 rounded-lg" />;',
      'export const C = () => <input className="placeholder:text-content-tertiary" />;',
      'export const D = () => <span className="px-4 bg-red-500" />;',
      'export const E = () => <span className="flex" />;',
    ].join("\n"),
    "utf8"
  );
  return dir;
}

let DIR;
let CENSO;
let P;

test("fixture: o censo lê o que o teste escreveu", () => {
  DIR = escreveFixture();
  CENSO = census(DIR);
  P = partition(CENSO, 2, 4);
  assert.equal(CENSO.atributos, 5);
  // 4+4 (entidade) + 1 (B1) + 2 (B2) + 1 (C)
  assert.equal(CENSO.usos, 12);
});

/* ---------------------------------------------- a premissa do bug ---------- */

test("a classe de B1 casa os DOIS predicados — é essa sobreposição que o bug ignorava", () => {
  const cls = "placeholder:text-content-tertiary";
  assert.equal(isTokenizableUtility(cls), true);
  assert.equal(EM_CONTRATO.test(cls), true);
});

/* ------------------------------------------------------ o balde B ---------- */

test("B1 (já em contrato) sai do trabalho bloqueante e vira balde próprio", () => {
  assert.equal(P.tokForaEmContrato, 1, "placeholder:text-content-tertiary é B1");
  assert.equal(P.tokForaCru, 2, "px-4 e bg-red-500 são B2");
  assert.equal(P.usosTokenizaveisForaDeEntidade, 3, "B = B1 + B2");
});

test("migrável = A + B2. Somar A + B recontaria trabalho já feito", () => {
  assert.equal(P.usosEmEntidade, 8);
  assert.equal(P.migravel, 8 + 2);
  assert.notEqual(
    P.migravel,
    P.usosEmEntidade + P.usosTokenizaveisForaDeEntidade,
    "se estes fossem iguais o bug teria voltado"
  );
});

test("a quebra por família/propriedade cobre B2 inteiro, e só B2", () => {
  assert.deepEqual(P.tokForaCruPorFamilia, { spacing: 1, paint: 1 });
  assert.deepEqual(P.tokForaCruPorPropriedade, { padding: 1, "background-color": 1 });
  const soma = Object.values(P.tokForaCruPorPropriedade).reduce((s, n) => s + n, 0);
  assert.equal(soma, P.tokForaCru, "família que não soma B2 é quebra fictícia");
});

/* ------------------------------------------------- as invariantes ---------- */

test("A + B + C fecha o denominador — verificado, não afirmado", () => {
  assert.equal(
    P.usosEmEntidade + P.usosTokenizaveisForaDeEntidade + P.usosSemDisposicao,
    CENSO.usos
  );
  assert.equal(P.usosSemDisposicao, 1, "só o `flex` solto");
});

test("o contrato nomeado também é partição: A + B1 + C fecham `emContrato`", () => {
  assert.equal(
    P.entidadeEmContrato + P.tokForaEmContrato + P.semDisposicaoEmContrato,
    CENSO.emContrato
  );
});

test("partition FALHA FECHADA quando a soma não fecha", () => {
  assert.throws(
    () => partition({ ...CENSO, usos: CENSO.usos + 1 }, 2, 4),
    /nao e particao/i
  );
  assert.throws(
    () => partition({ ...CENSO, emContrato: CENSO.emContrato + 1 }, 2, 4),
    /contrato por balde/i
  );
});

test.after(() => { if (DIR) rmSync(DIR, { recursive: true, force: true }); });
