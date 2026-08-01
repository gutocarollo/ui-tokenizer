/**
 * GERADOR E PARSER NAO PODEM DIVERGIR NA ORDEM DOS SLOTS.
 *
 * DEFEITO REAL QUE ORIGINOU ESTE TESTE (varredura de contradicoes, 2026-08-01).
 * A ordem do nome foi corrigida em 2026-08-01 — a variante passou a vir logo
 * apos a entidade — e `score-naming.mjs::parseName` foi reordenado no mesmo
 * commit. Mas os DOIS geradores nao:
 *
 *   derive-tokens.mjs::buildName      [owner, anatomy, property, variant, state]
 *   context-clusters.mjs::deriveName  owner -> anatomy -> property -> variant
 *
 * Resultado: a skill LIA `button-secondary-border-color` e ESCREVIA
 * `button-border-color-secondary`. Nada quebrou, porque nenhum teste ligava os
 * dois lados — havia teste para o parser, nenhum para o gerador.
 *
 * O INVARIANTE: para todo conjunto de slots, `parseName(buildName(slots))` tem
 * que devolver os MESMOS slots, sem resto. Isso fecha a classe inteira: qualquer
 * reordenacao futura em um dos lados sem o outro estoura aqui.
 *
 * Nao precisa de app-alvo — a ordem e regra, nao projeto.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { parseName, readVocabulary, scoreName } from "../score-naming.mjs";

const vocabulario = readVocabulary();

/** A ordem canonica, escrita uma vez. Se a lei mudar, muda aqui e o resto segue. */
const ORDEM = ["owner", "variant", "anatomy", "property", "state"];

function montar(slots) {
  return ORDEM.map((k) => slots[k]).filter(Boolean).join("-");
}

const CASOS = [
  { owner: "page", property: "background-color" },
  { owner: "button", variant: "secondary", property: "border-color" },
  { owner: "button", variant: "primary", property: "background-color", state: "hover" },
  { owner: "button", variant: "destructive", anatomy: "label" },
  { owner: "field", anatomy: "placeholder" },
  { owner: "data-table", anatomy: "header", property: "background-color" },
  { owner: "divider", property: "border-color" },
  { owner: "focus-ring", property: "outline-color" },
  { owner: "menu", anatomy: "row", property: "background-color", state: "selected" },
  { owner: "card", property: "padding" },
  { owner: "button", variant: "ghost", anatomy: "icon", property: "foreground-color", state: "disabled" },
  { owner: "chat-message", property: "line-height" },
];

test("parseName(buildName(slots)) devolve os mesmos slots, sem resto", () => {
  for (const slots of CASOS) {
    const nome = montar(slots);
    const lido = parseName(nome, vocabulario);
    assert.equal(lido.remainder, null, `${nome}: sobrou "${lido.remainder}"`);
    for (const k of ORDEM) {
      assert.equal(
        lido[k] ?? null,
        slots[k] ?? null,
        `${nome}: slot ${k} leu "${lido[k]}" e devia ler "${slots[k] ?? null}"`
      );
    }
  }
});

test("a ordem canonica pontua 100 e a permutada NAO — o oraculo distingue", () => {
  const universo = new Set(CASOS.map(montar));
  const certo = montar({ owner: "button", variant: "secondary", property: "border-color" });
  const velho = "button-border-color-secondary";
  assert.equal(scoreName(certo, vocabulario, universo).score, 100, certo);
  assert.ok(
    scoreName(velho, vocabulario, universo).score < 100,
    "a ordem velha nao pode empatar com a canonica — foi assim que ela sobreviveu ate 2026-08-01"
  );
});

test("os geradores da skill escrevem na ordem canonica", async () => {
  /*
   * Le o CODIGO dos dois geradores e exige que a lista de slots esteja na ordem.
   * Assercao textual de proposito: `buildName` e `deriveName` dependem do layout
   * do projeto para serem invocados, e o que este teste protege e a ORDEM, que e
   * legivel na fonte sem alvo nenhum.
   */
  const { readFileSync } = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const aqui = path.dirname(fileURLToPath(import.meta.url));

  const derive = readFileSync(path.resolve(aqui, "../derive-tokens.mjs"), "utf8");
  assert.match(
    derive,
    /\[owner,\s*variant,\s*anatomy,\s*property,\s*state\]/,
    "derive-tokens.mjs::buildName fora da ordem canonica"
  );

  const clusters = readFileSync(path.resolve(aqui, "../context-clusters.mjs"), "utf8");
  const trecho = clusters.slice(clusters.indexOf("const parts = [owner]"));
  const ordemLida = [...trecho.slice(0, 400).matchAll(/parts\.push\((\w+)\)/g)].map((m) => m[1]);
  assert.deepEqual(
    ordemLida.slice(0, 4),
    ["variant", "anatomy", "property", "state"],
    "context-clusters.mjs::deriveName fora da ordem canonica"
  );
});

test("entidade GLOBAL e alcancavel pelo derivador de owner", async () => {
  /*
   * §5.5 admitiu `divider` e `focus-ring` como entidades sem pai. Nenhum sinal de
   * tag ou role as alcanca — se o derivador nao tiver caminho proprio, todo anel
   * de foco vira `button.outline-color.focus`, `field.outline-color.focus`, ...,
   * que e a duplicacao que a §5.5 existe para matar.
   */
  const { globalEntityFor } = await import("../find-owner.mjs");
  const owners = vocabulario.owners;
  assert.equal(globalEntityFor("ring-2", "focus-visible:", owners)?.owner, "focus-ring");
  assert.equal(globalEntityFor("divide-x", "", owners)?.owner, "divider");
  assert.equal(
    globalEntityFor("ring-2", "focus-visible:", ["button"]),
    null,
    "alvo cuja lei nao admite a entidade global nao pode receber o nome dela"
  );
});
