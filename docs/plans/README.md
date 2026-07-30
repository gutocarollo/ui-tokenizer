# Planos

Coleção de planos do `ui-tokenizer`. O vigente é sempre o de maior revisão; os
anteriores ficam para rastrear **o que mudou e por quê**, que é o que impede
repetir uma decisão já derrubada.

| plano | assunto | status |
|---|---|---|
| [`2026-07-30-v2-upstream-como-oraculo-rev2.md`](2026-07-30-v2-upstream-como-oraculo-rev2.md) | usar o compilador do Tailwind como oráculo de equivalência — revisão pós-auditoria | **vigente** |
| [`2026-07-30-v2-upstream-como-oraculo.md`](2026-07-30-v2-upstream-como-oraculo.md) | a primeira versão do mesmo plano | superado pela rev2 |

## O que a rev2 mudou

A rev1 propunha um motor de normalização novo. A auditoria mostrou que o
recurso já existia na dependência que o projeto tinha — a conclusão de "lacuna
do ecossistema" foi retratada, e o custo do patch equivalente ficou em ~50
linhas.

Fica registrado porque é o padrão de erro que mais custa aqui: concluir que algo
não existe sem ler a versão instalada da própria dependência.
