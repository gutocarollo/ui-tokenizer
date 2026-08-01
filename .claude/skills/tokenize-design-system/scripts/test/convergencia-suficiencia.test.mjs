/**
 * A §5.7 DA LEI TEM QUE TER TESTE — e não tinha.
 *
 * ORIGEM (review adversarial, 2026-08-01): *"§5.7 sem teste — `converge-tokens.mjs`
 * ganhou regra de fusão nova (+49 linhas em `ad30fec`) e não existe NENHUM
 * arquivo de teste de converge em `test/`."* Correto, e pior do que parecia: o
 * motor de convergência inteiro — o ponto fixo, a regra do outlier, os cinco
 * sinais ponderados — nunca teve teste algum. A regra nova só herdou a ausência.
 *
 * A REGRA, decidida pelo dono: quando `cor` marca 1 (ΔE imperceptível) E
 * `contrato` marca 1 (mesma entidade, propriedade, variante e estado), o par
 * funde e os demais sinais não vetam. A razão está na lei: `componente` (Dice do
 * nome do arquivo) e `funcao` (tag+role) medem ONDE O CÓDIGO MORA, não o que o
 * token é.
 *
 * O QUE ESTE ARQUIVO PROTEGE, e por que cada caso existe:
 *
 *   1. a regra ELEVA um par que a soma reprovaria (o caso real: 68 → passa);
 *   2. ela NÃO vale com cor apenas PRÓXIMA (score 0,5) — senão fundiria coisas
 *      que se veem diferentes;
 *   3. ela NÃO vale sem contrato idêntico — senão fundiria dois contratos
 *      distintos que por acaso têm a mesma cor;
 *   4. ela não mexe em par que já passava — guard que muda o que já estava certo
 *      não é guard, é regressão;
 *   5. o par elevado carrega o sinal `suficiencia`, para o relatório distinguir
 *      fusão por esta regra de fusão pela soma.
 *
 * MÉTODO. `converge-tokens.mjs` é um script, não um módulo — ele roda no
 * import. Testá-lo por import executaria a convergência inteira. Então o teste
 * invoca o CLI com um `clusters.json` de fixture e lê o `--json`, que é o mesmo
 * contrato que o `tokenize.mjs` consome. Testar pelo contrato público é mais
 * forte que testar a função interna: pega também quebra de fiação.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const CLI = path.resolve(AQUI, "../converge-tokens.mjs");
const APP = process.env.TOKENIZE_TEST_ROOT ?? path.resolve(AQUI, "../../../../../frontend");

/**
 * Dois clusters com o MESMO nome derivado. O que muda entre os casos é só o
 * primitivo (para mexer no sinal de cor) e o componente/tag (que a regra tem de
 * ignorar quando cor e contrato concordam).
 */
function fixture({ primitivoA, primitivoB, nomeA = "button-primary-color", nomeB = nomeA, ownerSignal = "high" }) {
  const cluster = (nome, primitivo, componente, tag, count) => ({
    key: `${nome}::${componente}`,
    sample: {
      owner: "button", property: "color", variant: "primary", state: null,
      component: componente, tag, role: null, area: "components",
      ownerSignal, file: `src/${componente}.jsx`, line: 1, token: "content-primary",
    },
    occurrences: Array.from({ length: count }, (_, i) => ({
      file: `src/${componente}.jsx`, line: i + 1, token: "content-primary",
    })),
    tokens: ["content-primary"],
    count,
    proposedName: nome,
    dominantPrimitive: primitivo,
    valueSpread: 1,
    divergentCount: 0,
    clusterId: `cluster-${componente}`,
  });
  return {
    total: 30,
    clusters: [
      cluster(nomeA, primitivoA, "Button", "button", 20),
      cluster(nomeB, primitivoB, "ApiCallNode", "div", 10),
    ],
  };
}

function convergir(dados) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "converge-"));
  const arquivo = path.join(dir, "clusters.json");
  writeFileSync(arquivo, JSON.stringify(dados));
  const saida = execFileSync(
    process.execPath,
    [CLI, "--root", APP, "--clusters", arquivo, "--json"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  return JSON.parse(saida);
}

const PRETO = "{primitive.light.c-000000}";
/*
 * NÃO EXISTE "c-000001". Um primitivo ausente do DTCG do alvo faz `hexOf`
 * devolver null, `deltaE` devolver null e o sinal de cor pontuar ZERO com a nota
 * "primitivo nao resolvivel" — o mesmo fail-closed que foi consertado em
 * 2026-08-01, funcionando. A primeira versão desta fixture inventou um hex e o
 * teste falhou por um motivo que não era o dele. Todo primitivo citado aqui tem
 * de existir em `tokens/color.tokens.json` do alvo.
 */
const CINZA = "{primitive.light.c-5c5c5c}"; // distinto
const CINZA_ESCURO = "{primitive.light.c-4a4a4a}"; // existe no alvo e é distinto de c-5c5c5c

test("cor idêntica + contrato idêntico FUNDE, mesmo com arquivo e tag diferentes", () => {
  const r = convergir(fixture({ primitivoA: PRETO, primitivoB: PRETO }));
  assert.equal(r.convergiu, true);
  assert.equal(r.humano.length, 0, "com os dois sinais no máximo nada pode sobrar para o humano");
  assert.equal(r.clustersFinais.length, 1, "os dois clusters têm que virar um contrato só");
  assert.equal(r.clustersFinais[0].count, 30, "a contagem do absorvido tem que somar");
});

test("o par elevado carrega o sinal `suficiencia`, para o relatório distinguir a causa", () => {
  /*
   * `ownerSignal: "low"` NÃO é detalhe de fixture — é o que reproduz o caso
   * real. Com sinal de owner alto a soma já passa de 70 sozinha (40+25+10) e a
   * regra não tem o que elevar; o teste passaria verde sem exercitar nada. Os 37
   * pares medidos no alvo paravam em 68-69 exatamente porque `componente` e
   * `funcao` zeravam E o sinal de owner era fraco.
   */
  const r = convergir(fixture({ primitivoA: PRETO, primitivoB: PRETO, ownerSignal: "low" }));
  const fusao = r.fusoes.find((f) => f.nome === "button-primary-color");
  assert.ok(fusao, "a fusão tem que existir");
  const suf = (fusao.signals ?? []).find((s) => s.name === "suficiencia");
  assert.ok(
    suf,
    "sem o sinal, o relatório não distingue fusão por §5.7 de fusão pela soma — e a regra vira invisível"
  );
  assert.match(String(suf.note), /§5\.7/);
});

test("cor não-idêntica não aciona a regra", () => {
  /*
   * O corte é `score === 1`, não `score > 0`. Duas cores que se veem diferentes
   * não podem ser elevadas: a regra existe para o caso em que a evidência de cor
   * é MÁXIMA, não para o caso em que ela é parcial.
   */
  const r = convergir(fixture({ primitivoA: CINZA, primitivoB: CINZA_ESCURO }));
  const elevados = r.fusoes.filter((f) => (f.signals ?? []).some((s) => s.name === "suficiencia"));
  assert.deepEqual(elevados, [], "cor 0,5 não pode acionar a suficiência");
});

test("cor idêntica sem contrato idêntico não aciona a regra", () => {
  /*
   * Nomes derivados diferentes = contratos diferentes. Duas coisas pretas que a
   * lei nomeia de formas distintas continuam distintas — a cor sozinha nunca
   * bastou, e não passa a bastar.
   */
  const r = convergir(
    fixture({ primitivoA: PRETO, primitivoB: PRETO, nomeA: "button-primary-color", nomeB: "modal-primary-color" })
  );
  const elevados = r.fusoes.filter((f) => (f.signals ?? []).some((s) => s.name === "suficiencia"));
  assert.deepEqual(elevados, [], "contrato diferente não pode acionar a suficiência");
  assert.equal(r.clustersFinais.length, 2, "contratos diferentes permanecem dois");
});

test("cor distinta continua indo para o humano — a regra não afrouxa o corte", () => {
  const r = convergir(fixture({ primitivoA: PRETO, primitivoB: CINZA }));
  assert.equal(r.clustersFinais.length, 2, "cores distintas não fundem");
  assert.ok(r.humano.length >= 1, "o par tem que aparecer para decisão humana");
  const par = r.humano[0];
  const cor = (par.signals ?? []).find((s) => s.name === "cor");
  assert.equal(cor.score, 0, "cor distinta pontua zero, e é isso que manda o par para o humano");
});

test("o ponto fixo para quando duas iterações consecutivas não mudam nada", () => {
  const r = convergir(fixture({ primitivoA: PRETO, primitivoB: PRETO }));
  assert.equal(r.convergiu, true);
  const ultimas = r.historico.slice(-2);
  assert.deepEqual(
    ultimas.map((h) => h.fundiu),
    [0, 0],
    "o critério de parada é DUAS iterações sem mudança — uma só poderia ser coincidência"
  );
});
