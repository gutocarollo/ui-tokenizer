/**
 * O COOKBOOK NAO PODE ENSINAR UM NOME QUE A LEI REPROVA — e a bateria que prova
 * isso precisa ter um PATH.
 *
 * ORIGEM (2026-08-01). O dono perguntou "qual e o path disso aqui?" sobre uma
 * bateria de 12 nomes que eu havia rodado contra o oraculo para provar que meu
 * entendimento da lei estava certo. Resposta honesta: NAO TINHA PATH — era um
 * heredoc inline, descartado ao terminar. A verificacao mais deterministica do
 * dia nao era reexecutavel por ninguem, nem por mim na sessao seguinte.
 *
 * Este arquivo e aquela bateria, versionada, mais o contrato do cookbook.
 * Tres camadas, cada uma pegando uma classe de defeito diferente:
 *
 *   1. GRAMATICA — um caso por regra da lei, com a nota esperada. Se alguem
 *      mexer no parser ou na lei e a semantica mudar, aqui estoura.
 *   2. AUTO-TESTE DO VALIDADOR — um cookbook FALSO, com nome que a lei reprova,
 *      tem que ser reprovado. Validador que aprova tudo nao e validador.
 *   3. COOKBOOK REAL — todo exemplo do documento canonico, submetido ao oraculo.
 *
 * NAO precisa de app-alvo: julgar um NOME exige a LEI, nao um projeto. Foi por
 * isso que `score-naming.mjs` teve o `resolveProjectLayout` movido para
 * preguicoso na mesma data — o efeito de modulo quebrava todo importador que
 * so queria a lei.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { scoreName, parseName, readVocabulary } from "../score-naming.mjs";
import {
  validarCookbook,
  extrairExemplos,
  paraFormaConsumida,
} from "../validate-cookbook.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const COOKBOOK = path.resolve(AQUI, "../../../../../docs/law/cookbook.md");
const vocabulario = readVocabulary();

/* ------------------------------------------------- 1. a gramatica, caso a caso --- */

test("cada regra da lei tem um caso, e o oraculo concorda com ela", () => {
  const universo = new Set([
    "button-primary-background-color",
    "button-secondary-border-color",
    "page-background-color",
  ]);
  const casos = [
    ["page-background-color", 100, "entidade + propriedade, o caso minimo"],
    ["page-foreground-color", 100, "propriedade por extenso, nunca `color`"],
    ["button-primary-background-color", 100, "variante colada a entidade"],
    ["button-primary-background-color-hover", 100, "estado no fim, com par base"],
    ["button-secondary-border-color", 100, "a variante qualifica o BOTAO"],
    ["button-destructive-label", 100, "anatomia de propriedade unica"],
    ["field-placeholder", 100, "idem — placeholder e texto por definicao"],
    ["data-table-header-background-color", 100, "entidade composta + anatomia"],
    ["divider-border-color", 100, "entidade GLOBAL, sem pai (§5.5)"],
    ["focus-ring-outline-color", 100, "idem — uma decisao, N consumidores"],
  ];
  for (const [nome, esperado, porque] of casos) {
    const r = scoreName(nome, vocabulario, universo);
    assert.equal(
      r.score,
      esperado,
      `${nome} (${porque}) tirou ${r.score}: ${r.criteria
        .filter((c) => !c.ok)
        .map((c) => `${c.c} — ${c.note}`)
        .join(" | ")}`
    );
  }
});

test("a ordem do nome e enforced: variante DEPOIS da propriedade reprova", () => {
  /*
   * A correcao de 2026-08-01. Antes dela o oraculo dava 100 para a ordem velha
   * e 90 para a certa — premiava exatamente o que a lei passou a proibir.
   */
  const certo = scoreName("button-secondary-border-color", vocabulario, new Set());
  const velho = scoreName("button-border-color-secondary", vocabulario, new Set());
  assert.equal(certo.score, 100, "a ordem canonica tem que pontuar cheio");
  assert.ok(
    velho.score < certo.score,
    `a ordem velha (${velho.score}) nao pode empatar nem ganhar da canonica (${certo.score})`
  );
  const slots = parseName("button-secondary-border-color", vocabulario);
  assert.equal(slots.variant, "secondary");
  assert.equal(slots.property, "border-color");
  assert.equal(slots.remainder, null, "nada pode sobrar do nome canonico");
});

test("redundancia e por PROPRIEDADE inteira, nao por palavra compartilhada", () => {
  /*
   * Decisao do dono, 2026-08-01: um <span> com fundo e um ROTULO COM FUNDO, nao
   * um conteiner com rotulo dentro — o renderizado ali e uma caixa so. Logo
   * `markdown.label.background-color` e canonico.
   *
   * O criterio `no-redundancy` reprovava esse nome com 85/100 porque quebrava a
   * propriedade implicada (`foreground-color`) em palavras e achava `color`
   * dentro de `background-color`. Sao propriedades DIFERENTES: compartilhar uma
   * palavra nao torna uma derivavel da outra. O que continua — e tem que
   * continuar — sendo redundante e escrever a propriedade que a anatomia de fato
   * implica.
   */
  const universo = new Set([
    "markdown-label", "markdown-label-background-color",
    "button-label", "button-label-foreground-color",
  ]);
  assert.equal(
    scoreName("markdown-label-background-color", vocabulario, universo).score,
    100,
    "rotulo COM fundo e canonico desde a decisao de 2026-08-01"
  );
  const redundante = scoreName("button-label-foreground-color", vocabulario, universo);
  assert.ok(
    redundante.score < 100 &&
      redundante.criteria.some((c) => c.c === "no-redundancy" && !c.ok),
    "escrever a propriedade que a anatomia IMPLICA continua sendo ruido"
  );
});

test("as tres palavras banidas nao passam como cabeca de nome", () => {
  for (const banida of ["content-primary", "surface-canvas", "semantic-color-primary"]) {
    const r = scoreName(banida, vocabulario, new Set());
    assert.ok(
      r.score < 70,
      `${banida} tirou ${r.score} — palavra banida tem que ficar abaixo do corte`
    );
  }
});

/* --------------------------------------- 2. o validador reprova o que deve --- */

test("o validador reprova um cookbook que ensina nome ilegal", () => {
  const falso = [
    "# Cookbook falso",
    "",
    "| situação | nome antigo | token pela lei |",
    "|---|---|---|",
    "| fundo da página | — | `page.background-color` |",
    "| borda do botão secundário | — | `button.border-color.secondary` |",
    "",
    "## Exceções",
    "",
    "Nenhuma.",
  ].join("\n");
  const { falhas } = validarCookbook(falso, vocabulario);
  assert.equal(falhas.length, 1, "a linha na ordem velha tinha que reprovar");
  assert.equal(falhas[0].token, "button.border-color.secondary");
});

test("excecao sem justificativa escrita e falha, nao licenca", () => {
  const semJustificativa = [
    "| situação | token pela lei |",
    "|---|---|",
    "| variante que a lei nao tem | ⚠ `button.outline.border-color` |",
    "",
    "## Exceções",
    "",
    "Nenhuma declarada.",
  ].join("\n");
  const r = validarCookbook(semJustificativa, vocabulario);
  assert.equal(
    r.excecoesSemJustificativa.length,
    1,
    "excecao marcada com ⚠ e sem texto na secao Excecoes tem que ser apontada"
  );
});

test("o parser de tabela ignora tabela que nao e de exemplo", () => {
  const doc = [
    "| slot | pergunta |",
    "|---|---|",
    "| `entity` | de quem é? |",
    "",
    "| situação | token pela lei |",
    "|---|---|",
    "| fundo | `page.background-color` |",
  ].join("\n");
  const exemplos = extrairExemplos(doc);
  assert.equal(exemplos.length, 1, "so a tabela com a coluna 'token pela lei' conta");
  assert.equal(exemplos[0].token, "page.background-color");
});

test("a traducao ponto->hifen e a unica ponte entre lei e codigo", () => {
  assert.equal(paraFormaConsumida("button.secondary.label"), "button-secondary-label");
  assert.equal(paraFormaConsumida("page.background-color"), "page-background-color");
});

/* ------------------------------------------------- 3. o cookbook de verdade --- */

test("todo exemplo do cookbook canonico sobrevive ao oraculo", () => {
  assert.ok(
    existsSync(COOKBOOK),
    `cookbook nao encontrado em ${COOKBOOK} — ele e parte do contrato, nao opcional`
  );
  const markdown = readFileSync(COOKBOOK, "utf8");
  const { resultados, falhas, excecoesSemJustificativa } = validarCookbook(
    markdown,
    vocabulario
  );
  assert.ok(resultados.length > 0, "cookbook sem nenhum exemplo nao e cookbook");
  assert.equal(
    falhas.length,
    0,
    "exemplos reprovados: " +
      falhas
        .map((f) => `${f.token} (${f.score}) — ${f.reprovados.map((c) => c.criterio).join(",")}`)
        .join(" | ")
  );
  assert.equal(
    excecoesSemJustificativa.length,
    0,
    "excecoes sem justificativa: " + excecoesSemJustificativa.map((e) => e.token).join(", ")
  );
});

test("nenhum destino do cookbook carrega palavra banida", () => {
  const markdown = readFileSync(COOKBOOK, "utf8");
  const destinos = extrairExemplos(markdown).map((e) => e.token);
  const sujos = destinos.filter((t) => /\b(content|surface|semantic)\b/.test(t));
  assert.deepEqual(
    sujos,
    [],
    "palavra banida so pode aparecer na coluna do nome ANTIGO, nunca no destino"
  );
});
