/**
 * A LEI e o CODIGO nao podem divergir em silencio.
 *
 * DEFEITO REAL QUE ORIGINOU ESTE TESTE, cometido em 2026-07-31: a §4.3 da lei
 * foi renomeada de `color` para `color` e o `UTILITY_FAMILIES` de
 * `lib/utility-families.mjs` continuou dizendo `color`. Nada estourou.
 *
 * O efeito nao foi erro — foi RECLASSIFICACAO SILENCIOSA. Como
 * `lawSlotFor()` devolve `null` quando a lei nao tem slot para a propriedade,
 * os quatro prefixos de pintura mais usados (`text`, `placeholder`, `accent`,
 * `caret`) sairam da familia governada e cairam em LAW GAP:
 *
 *   prefixos sem slot        41 -> 45
 *   usos avaliaveis         151 -> 145
 *   ocorrencias em LAW GAP    0 -> 6
 *
 * `text-*` — a utility de pintura que a lei existe para governar — virou
 * "familia que a lei nao sabe expressar". E `validate-contract.mjs` continuou
 * PASS, porque ele nunca compara §4.3 com `PREFIX_PROPERTY`.
 *
 * O INVARIANTE: toda propriedade que a familia `paint` projeta TEM que existir
 * no vocabulario §4.3. Pintura e exatamente o dominio que a lei governa; um
 * prefixo de pintura sem slot significa que os dois lados se separaram, nao que
 * a lei tem uma lacuna legitima.
 *
 * Radius, spacing e tipografia continuam FORA de proposito — a lei nao tem slot
 * para eles e isso esta documentado como lacuna conhecida (LAW GAP), nao como
 * divergencia.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  UTILITY_FAMILIES,
  PREFIX_PROPERTY,
  lawSlotFor,
} from "../lib/utility-families.mjs";
import { readVocabulary } from "../score-naming.mjs";

const vocabulario = readVocabulary();

test("§4.3 expressa TODA propriedade que a familia paint projeta", () => {
  const orfaos = Object.entries(UTILITY_FAMILIES)
    .filter(([, row]) => row.family === "paint")
    .filter(([prefix]) => lawSlotFor(prefix, vocabulario) === null)
    .map(([prefix]) => `${prefix} -> ${PREFIX_PROPERTY[prefix]}`);

  assert.deepEqual(
    orfaos,
    [],
    "prefixo de PINTURA sem slot na lei significa que §4.3 e utility-families " +
      "divergiram. Alinhe os dois — nao adicione excecao. Orfaos: " +
      orfaos.join(", ")
  );
});

test("o vocabulario da lei nao esta vazio (parser da §4.3 vivo)", () => {
  /*
   * Guarda contra o modo de falha mais traicoeiro: se o slicer que le a §4.3
   * deixar de casar a secao, `properties` volta VAZIO e o teste acima passa
   * por vacuidade — nenhum prefixo teria slot, mas a lista de orfaos seria
   * comparada contra uma lei que nao existe.
   */
  assert.ok(
    vocabulario.properties.length >= 5,
    `§4.3 devolveu ${vocabulario.properties.length} propriedades; o parser da lei quebrou`
  );
  assert.ok(
    vocabulario.properties.includes("background-color"),
    "§4.3 sem `background-color` — o parser leu a secao errada"
  );
});

test("toda propriedade da lei e alcancavel por ALGUM prefixo, ou e lacuna declarada", () => {
  /*
   * A direcao inversa. Propriedade que a lei declara e nenhum prefixo projeta e
   * letra morta: ninguem consegue escrever um token que a use.
   *
   * `box-shadow`, `fill` e `stroke` sao os casos conhecidos e legitimos — eles
   * existem na lei para tokens que nao nascem de utility de cor. Declarados
   * aqui para que uma QUARTA propriedade orfa apareca como falha.
   */
  const ALCANCE_NAO_UTILITY = new Set(["box-shadow", "fill", "stroke"]);
  const projetadas = new Set(Object.values(PREFIX_PROPERTY));
  const inalcancaveis = vocabulario.properties.filter(
    (p) => !projetadas.has(p) && !ALCANCE_NAO_UTILITY.has(p)
  );
  assert.deepEqual(
    inalcancaveis,
    [],
    "propriedade declarada na lei que nenhum prefixo projeta: " +
      inalcancaveis.join(", ")
  );
});
