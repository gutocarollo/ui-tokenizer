---
title: F-D0 — os pesos da convergência nunca foram validados, e o questionário está no repo errado
status: aberto
quem_resolve: dono
severidade: bloqueante
bloqueia: APPLY — nada é escrito no código com pesos reprovados
fonte: docs/plans/2026-07-30-plano-reconciliado.md:439
citacao: 'bloqueia F-F** · instrumento: `<alvo>/docs/reports/validacao-pesos.md`'
updated: 2026-08-01
---

Os pesos que decidem toda fusão de contrato —
**`cor 40 · contrato 25 · componente 15 · owner 10 · funcao 10`** — estão
cravados em `.claude/skills/tokenize-design-system/scripts/converge-tokens.mjs`,
Linhas 199-210. O documento que os valida abre com a frase que define o item:

> Os pesos sustentam **211 fusoes** e nunca foram medidos. **Sairam da minha
> cabeca.**

## O que é pedido de você

**40 pares, uma pergunta binária cada:** *é o mesmo contrato de token, sim ou
não?* A nota que o processo deu está omitida de propósito, e os grupos são
anônimos — saber que um par veio da faixa de alta confiança prepara para
confirmar, e da faixa de corte prepara para duvidar. Os dois contaminam.

| | |
|---|---|
| limiar de aceite | ≥85% de concordância **E** um piso próprio num dos grupos |
| se reprovar | as fusões são invalidadas, os pesos reajustados por regressão sobre os seus rótulos, e a convergência roda de novo |

## Por que isto estava invisível

O questionário mora em
`/home/augusto/code/makers-ai-hub/frontend/docs/reports/validacao-pesos.md` —
**no repo do alvo, e fora da wiki dele**. Medido em 2026-08-01: a wiki do
makers-ai-hub cobre `docs/`, e `frontend/docs/` está fora; o `_stray_covered()`
do lint ainda o dá por coberto porque `reports` e `docs` são genéricos e ele
sobe até `frontend/`, que alguma página cita. **Uma menção a `frontend/`
silencia os 13 documentos daquela pasta.**

Resultado: uma decisão sua, bloqueante do `APPLY`, parada num diretório que
nenhum índice lista, em um repositório que não é o desta empreitada. Foi você
quem notou — *"MAS PQ UM PLANO EM RELAÇÃO AO PROJETO ui-tokenizer-v2 está
aqui????"*.

## O que muda antes de você responder

**A pergunta pode estar mal calibrada hoje.** O sinal `cor` — o de peso 40 — está
zerado em 1.449 dos 1.457 pares por causa de
[[resolucao-de-primitivo-hardcoda-familia-banida]]. Validar pesos com o maior
deles cego mede o motor errado: você estaria rotulando fusões decididas
praticamente sem o sinal que deveria dominar.

Recomendo **consertar o resolvedor primeiro e reemitir o questionário**. Se ele
for reemitido, os 40 pares mudam, e responder agora seria trabalho jogado fora.

## O lugar certo do documento

Ele carrega uma decisão sobre o **motor**, não sobre o app — logo é deste repo.
Destino natural: `docs/pending/` (como anexo deste item) ou `docs/plans/`. Mover
não quebra nada: o arquivo não é citado literalmente por índice nenhum do alvo.
