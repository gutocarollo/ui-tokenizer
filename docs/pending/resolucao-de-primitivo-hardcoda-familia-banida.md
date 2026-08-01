---
title: o resolvedor de primitivo só enxerga a família `surface` — o sinal mais forte morre em 86% do corpus
status: aberto
quem_resolve: agente
severidade: bloqueante
bloqueia: a fase DECIDE — 1.449 dos 1.457 pares na fila humana existem por causa disto
fonte: .claude/skills/tokenize-design-system/scripts/context-clusters.mjs:225
citacao: 'const primitiveOf = (token) => VALUES.get(`semantic.light.surface.'
updated: 2026-08-01
---

O achado mais caro medido em 2026-08-01, e cabe numa linha:

```js
const primitiveOf = (token) => VALUES.get(`semantic.light.surface.${token.replace(/^surface-/, "")}`) ?? null;
```

A família `surface` está **cravada no caminho**. Todo token que não seja
`surface-*` erra o lookup e vira `(sem valor: …)`.

## O que isso custa, medido

| | |
|---|---|
| ocorrências com primitivo resolvido pela regra atual | **478 de 3.321 — 14,4%** |
| ocorrências resolvidas trocando `surface` pela família do próprio token | **3.321 de 3.321 — 100,0%** |
| clusters sem valor resolvível | 1.783 (2.915 ocorrências) |

O valor **está no arquivo do alvo o tempo todo**. `text-content-primary` procura
`semantic.light.surface.content-primary`, que não existe; o caminho real é
`semantic.light.content.primary`, e ele vale
`{primitive.light.c-000000}` → `#000000`.

## A consequência em cadeia

`converge-tokens.mjs:198` chama `deltaE(a.dominantPrimitive, b.dominantPrimitive)`;
sem hex dos dois lados a função devolve `null` e a Linha 199 registra
`{ name: "cor", weight: 40, score: 0, note: "primitivo nao resolvivel" }`.

**O sinal de cor é o maior do orçamento de confiança — peso 40** — e ele está
zerado em **1.449 dos 1.457 pares** que a convergência empurrou para o humano
(99,5%), prendendo 2.028 das 2.037 ocorrências.

Ou seja: a fila de 1.457 decisões humanas **não é ambiguidade real**. É um
sinal desligado, exatamente o modo de falha que o docstring do `tokenize.mjs`
diz existir para prevenir — *"foi assim que uma corrida deu '0 fusoes, 400 na
fila' so porque a lib de cor nao resolveu"*. O `PREFLIGHT` confere que
`colorjs.io` **resolve como dependência**, e nunca que o primitivo resolve
contra os tokens do alvo. O loop falha **aberto** no sinal que mais pesa.

## A ironia que também é diagnóstico

`surface` é uma das cinco palavras BANIDAS. A única família que o resolvedor
enxerga é a que a lei proíbe — resíduo da época em que só `surface-*` estava
sendo migrado, do mesmo feitio do `--ext ts,tsx` que fez o miner varrer 2% do
app e imprimir sucesso.

## O conserto

Derivar a família do próprio token (`content-primary` → `content` + `primary`),
com fallback para a chave inteira. Medido acima: leva a resolução de 14,4% a
100%.

Não confundir com **corrigir o `PREFLIGHT`**: ele precisa passar a medir a taxa
de resolução de primitivo do alvo e **falhar fechado** abaixo de um piso, senão
a próxima família nova repete o silêncio. São dois consertos, o segundo é o que
impede a recorrência.
