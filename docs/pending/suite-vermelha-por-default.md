---
title: a suíte canônica é vermelha por default no próprio repo — 29 falhas que não são regressão
status: aberto
quem_resolve: agente
severidade: media
bloqueia: nada tecnicamente; envenena todo juízo de "a suíte está verde?"
fonte: .claude/skills/tokenize-design-system/scripts/lib/artifact-contract.test.mjs:44
citacao: ': path.join(REPOSITORY_ROOT, "frontend");'
updated: 2026-08-01
---

`npm test` na raiz — o comando que o `AGENTS.md` chama de canônico — devolve
**294 testes, 262 passam, 29 falham**. Com a variável apontada:

```
TOKENIZE_TEST_ROOT=/home/augusto/code/makers-ai-hub/frontend npm test
  → 294 tests, 293 pass, 0 fail
```

As 29 falhas são todas a mesma causa, e a mensagem é clara quando alguém abre:

```
Error: Target package.json not found: /home/augusto/code/ui-tokenizer-v2/frontend/package.json
```

O default é `path.join(REPOSITORY_ROOT, "frontend")` e **este repo não tem
`frontend/`** — ele é o repo do PROCESSO, o alvo mora em outro lugar. Os testes
que precisam de um app real (contrato Ajv, runner de estado) falham a resolver
antes de testar coisa alguma.

## Por que isto importa mais do que 29 números

Quem roda o comando documentado vê vermelho e não tem pista da causa. As saídas
possíveis são todas ruins: concluir que há regressão e caçar fantasma; ou
aprender a ignorar 29 vermelhos, que é como um fail real passa despercebido. A
suíte deixa de ser oráculo.

Há indício de que já custou: a baseline registrada em
`docs/plans/2026-07-31-plano-fechar-lacunas-implementacao.md` — *"166 tests /
132 pass / 31 fail"* — tem a mesma assinatura de "um bloco de testes não
resolve o alvo".

## As saídas, e a que eu escolheria

1. **Documentar** (feito em `AGENTS.md` no mesmo dia) — necessário e
   insuficiente: o comando errado continua rodável.
2. **`npm test` passa a exigir a variável e falha com mensagem própria** se ela
   não vier. Honesto, mas ainda exige que cada um saiba o path.
3. **Ler o alvo de configuração versionada** (`skill-sync.json` já aponta para o
   repo alvo) e usar a variável só como override. Faz o comando documentado
   funcionar sem argumento e mantém a fixture móvel.

A (3) é a que remove a armadilha em vez de sinalizá-la. Custo: uma resolução de
config no bootstrap do teste; risco: acoplar a suíte a um alvo que pode não
estar clonado — daí a mensagem da (2) continuar sendo necessária como fallback.
