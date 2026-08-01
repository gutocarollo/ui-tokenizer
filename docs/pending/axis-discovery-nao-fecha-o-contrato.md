---
title: discover-axes viola o próprio contrato em 15 pontos — é o que trava a transição para INVENTORIED
status: aberto
quem_resolve: agente
severidade: bloqueante
bloqueia: a máquina de estados durável em PREFLIGHTED; sem INVENTORIED não há NORMALIZED, e o laço global nunca começa
fonte: .claude/skills/tokenize-design-system/scripts/lib/artifact-contract.mjs:1331
citacao: 'for (const kind of [...coveredKinds, ...uncoveredKinds]) {'
updated: 2026-08-01
---

Medido em 2026-08-01, com a corrida real `tokenize-20260801-a691c1e8` contra
`makers-ai-hub/frontend`. Depois de o `run-config` existir (P1) e de o extrator
passar a emitir a linhagem, a transição `PREFLIGHTED → INVENTORIED` caiu de
**13.892 violações para 15** — todas em `axis-discovery`, em **duas** causas.

## Causa 1 — cobertura sobre o registro, não sobre o descoberto (13 violações)

`discover-axes.mjs` imprime `coveredKinds=19/19`: classifica os **19 kinds do
registro**. Mas neste alvo só **17** foram descobertos — `css-in-js` e
`generated-class` têm zero ocorrências.

O contrato (`lib/artifact-contract.mjs:1331-1337`) exige que
`coveredOccurrenceKinds ∪ uncoveredOccurrenceKinds ⊆ discoveredOccurrenceKinds`,
e rejeita com *"Coverage mentions undiscovered occurrence kind css-in-js"*.

**E o contrato está certo.** Um kind com zero ocorrências não é "coberto" — é
ausente. Chamá-lo de coberto é verdade vacuosa que infla o número: `19/19` soa
como cobertura total quando dois dos kinds sequer apareceram. É a mesma família
do `exactCoverage` que prova `requested==produced` e nunca
`requested==matriz completa`.

Conserto: classificar apenas os kinds efetivamente descobertos, e relatar os
ausentes num campo próprio — a informação "o alvo não tem CSS-in-JS" é útil e
não deve sumir, só não pode entrar como cobertura.

## Causa 2 — a aritmética de `occurrenceCounts.byAxis` não fecha (2 violações)

`lib/artifact-contract.mjs:1364-1370` recalcula a contagem por eixo a partir dos
registros e compara com a declarada. Diverge em `sizing` e em `color`.

Diferente da causa 1, aqui não há dúvida de semântica: um dos dois lados conta
errado. Antes de corrigir, medir de qual — recontar por eixo direto do
`design-occurrences.ndjson` e comparar com o `byAxis` do artefato. Ajustar o
lado errado, nunca o comparador (afrouxar o verificador para o dado passar é o
anti-padrão que este contrato existe para impedir).

## Por que isto é o próximo passo, e não outro

É literalmente a última coisa entre a corrida ancorada e o `INVENTORIED`.
`design-occurrence` já passa: **13.869 registros, 0 violações de schema**. A
cadeia `ANCHORED → PREFLIGHTED` já roda com artefato real. Com estas 15
resolvidas, a máquina de estados durável avança para o terceiro estado — e ela
nunca passou do primeiro, em lugar nenhum, até hoje.

Depois disto o caminho é o P2 do mapa: `execute()` em `phase-executors.mjs`
(a função que o próprio docstring do arquivo promete na Linha 17 e que **não
existe**) mais o argv de cada step — `discover-axes` está declarado sem
argumento nenhum no registro (Linha 58), e exige `--occurrences`,
`--extraction-summary` e `--configured-axes` vindos do `run-config`.
