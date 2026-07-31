# Índice — ui-tokenizer

Catálogo por categoria, orientado a conteúdo. Para ordem cronológica, ver
[`log.md`](log.md). Regra de desempate entre dois docs sobre o mesmo tema: o
`log.md` diz qual é recente, o `status` diz qual vale.

## Estado e constituição

| doc | o que é | status |
|---|---|---|
| [`ESTADO.md`](ESTADO.md) | onde a empreitada está: objetivo, o que tem evidência, o que falta, retratações, risco declarado | living |
| [`SCHEMA.md`](SCHEMA.md) | a constituição desta wiki — naming, status, indexação temporal, lint | living |
| [`AUTOCONTENCAO.md`](AUTOCONTENCAO.md) | o repo do processo reproduz o próprio processo? inventário arquivo a arquivo contra o alvo, e o que foi sincronizado | living |

## Entendimento

| doc | o que é | status |
|---|---|---|
| [`como-funciona.md`](como-funciona.md) | o processo em português, com os termos definidos e caso real por passo — **comece por aqui** | living |

## Lei

| doc | o que é | status |
|---|---|---|
| [`law/GRAMMAR.md`](law/GRAMMAR.md) | a gramática de naming: vocabulário fechado de owners, anatomias, propriedades, variantes e estados. Três palavras banidas — `surface`, `semantic`, `content` (§3.1); §4.3 nomeia `foreground-color`, não `color` | living |
| [`law/cookbook.md`](law/cookbook.md) | a situação real → o nome que a lei dá a ela. A lei diz a REGRA, `examples.md` ensina por contra-exemplo, o cookbook responde "estou pintando o fundo do botão secundário em hover, como se chama?". Todo exemplo é submetido ao oráculo por `validate-cookbook.mjs`; exceção sem justificativa escrita é falha | living |
| [`law/2026-07-31-ordem-do-nome-evidencias.md`](law/2026-07-31-ordem-do-nome-evidencias.md) | por que `button.text.color` e não `text.button.color`: citação literal do DTCG (que **não** decide naming), Material 3, Primer e shadcn/ui. §8 mede e rejeita abreviar `foreground` para `fg` | event |
| [`law/2026-07-31-achado-4-3-sem-slot-nao-pintura.md`](law/2026-07-31-achado-4-3-sem-slot-nao-pintura.md) | §4.3 tem 7 propriedades e as 7 são pintura: radius, spacing e tipografia não têm slot. Achado de F-E, emenda proposta e NÃO aplicada | event |

## Arquitetura

| doc | o que é | status |
|---|---|---|
| [`architecture/2026-07-31-fork-da-skill-causa-raiz.md`](architecture/2026-07-31-fork-da-skill-causa-raiz.md) | por que existe uma cópia vendorizada da skill, o que a medição refutou, e o guard de dois níveis | event |

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
