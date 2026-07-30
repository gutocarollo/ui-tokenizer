# Índice — ui-tokenizer

Catálogo por categoria, orientado a conteúdo. Para ordem cronológica, ver
[`log.md`](log.md). Regra de desempate entre dois docs sobre o mesmo tema: o
`log.md` diz qual é recente, o `status` diz qual vale.

## Estado e constituição

| doc | o que é | status |
|---|---|---|
| [`ESTADO.md`](ESTADO.md) | onde a empreitada está: objetivo, o que tem evidência, o que falta, retratações, risco declarado | living |
| [`SCHEMA.md`](SCHEMA.md) | a constituição desta wiki — naming, status, indexação temporal, lint | living |

## Entendimento

| doc | o que é | status |
|---|---|---|
| [`como-funciona.md`](como-funciona.md) | o processo em português, com os termos definidos e caso real por passo — **comece por aqui** | living |

## Lei

| doc | o que é | status |
|---|---|---|
| [`law/GRAMMAR.md`](law/GRAMMAR.md) | a gramática de naming: vocabulário fechado de owners, anatomias, propriedades, variantes e estados | living |

## Planos

Coleção: `plans/` — ver [`plans/README.md`](plans/README.md).

O plano vigente é sempre o de maior revisão; os anteriores ficam para
rastrear o que mudou e por quê.

## Estudo de caso

Coleção: `case-study/` — ver [`case-study/README.md`](case-study/README.md).

Execuções reais contra `learnhouse` e `makers-ai-hub`. Inclui as fontes de
mineração em `case-study/sources/` e a evidência renderizada em
`case-study/assets/`.

## Relatórios de rodada

Relatório de execução do loop é gerado **no repositório-alvo**, não aqui —
`tokenize.mjs` escreve em `docs/reports/<data>-tokenizacao-rodada.md` do alvo.
Este repo guarda o processo; o alvo guarda o resultado da sua própria rodada.
