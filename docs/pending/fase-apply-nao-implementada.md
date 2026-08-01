---
title: APPLY é fase declarada e ausente — o loop entrega proposta, nunca mutação
status: aberto
quem_resolve: agente
severidade: alta
bloqueia: qualquer migração real do alvo; hoje o processo termina em relatório
fonte: .claude/skills/tokenize-design-system/scripts/tokenize.mjs:297
citacao: 'APPLY — fase declarada, NAO implementada.'
updated: 2026-08-01
---

O próprio orquestrador nomeia as três peças que faltam:

> Nada foi aplicado no codigo. Faltam: criar os tokens no color.tokens.json
> herdando o primitivo dominante, codemod AST nos call sites, e prova de
> pixel. Ate la, este loop entrega proposta e prova, nunca mutacao.

`grep -rn "codemod\|APPLY" scripts/*.mjs` devolve só **menções** — nenhuma
implementação. `normalize-vectors.mjs:221` é explícito sobre a dependência:

> NADA foi aplicado. `--apply` exige a prova de pixel de F-H, que nao existe ainda.

## As três peças, e a ordem entre elas

1. **Criar os tokens** no `color.tokens.json` do alvo, herdando o primitivo
   dominante de cada contrato. Depende de [[resolucao-de-primitivo-hardcoda-familia-banida]]:
   enquanto o primitivo não resolve em 86% do corpus, "herdar o dominante" herda
   a string `(sem valor: …)`.
2. **Codemod AST** nos call sites. `propose-entities.mjs:1542` já mede a
   distinção que decide a estratégia — call site literal × dentro de template
   com `${}`.
3. **Prova de pixel** (F-H). É o portão: sem ela, aplicar é mutação sem
   verificação, e o contrato do repo é o oposto disso.

## O que NÃO bloqueia

Vale registrar para não travar por engano: as três peças são trabalho de agente.
O que exige o dono é o **corte de incerteza** e o que sobra na fila do DECIDE —
e essa fila hoje está inflada artificialmente pelo defeito do resolvedor de
primitivo, não por ambiguidade real. Consertar o resolvedor antes muda o
tamanho do problema humano de 1.457 pares para um número ainda não medido.
