---
title: nenhum teste exercita tokenize.mjs — foi por isso que os dois defeitos do loop sobreviveram
status: aberto
quem_resolve: agente
severidade: alta
bloqueia: nada diretamente; é a razão pela qual os bloqueantes do loop não foram vistos
fonte: package.json:8
citacao: '"test": "node --test scripts/lib/*.test.mjs .claude/skills/tokenize-design-system/scripts/test/*.test.mjs'
updated: 2026-08-01
---

Os quatro globs da suíte canônica alcançam `scripts/lib/`, `scripts/test/` e os
`*.test.mjs` soltos da skill. **Nenhum invoca `tokenize.mjs`**, que é o
entrypoint único e a única coisa que amarra as sete fases.

```
grep -rln "tokenize.mjs" .claude/skills/tokenize-design-system/scripts/test/ \
  .claude/skills/tokenize-design-system/scripts/*.test.mjs
  → nenhum resultado
```

`tokenization-runner.test.mjs` testa o *runner* (o rastreador de estado), não o
orquestrador.

Consequência concreta e datada: o `ENOBUFS` de
[[loop-enobufs-no-orquestrador]] e o resolvedor cego de
[[resolucao-de-primitivo-hardcoda-familia-banida]] só apareceram porque alguém
rodou o comando à mão em 2026-08-01. A suíte estava verde — 294 testes, 293
passando — com o loop principal quebrado na terceira fase.

## O teste que fecha isto

Um teste de ponta a ponta contra uma **fixture pequena** (não o alvo real, que é
móvel e lento): um app de mentira com `tokens/color.tokens.json`, `package.json`
com `colorjs.io` resolvível e meia dúzia de arquivos com className. O teste roda
`tokenize.mjs --root <fixture> --json` e afirma:

1. exit 0 e `ok: true`;
2. as sete fases aparecem no `log`, incluindo a linha do APPLY;
3. `clusters.json` e `converged.json` existem e são JSON parseável.

O item (3) é o que pega o `ENOBUFS` — ele não é uma exceção, é um artefato
ausente. E a fixture precisa ser grande o bastante para o JSON passar de 1 MB,
senão o teste passa verde sobre o defeito. Alternativa mais barata e mais
honesta: injetar `maxBuffer` pequeno por env no teste, para provar o caminho de
erro sem gerar megabytes.

O guard de cobertura do MINE já tem esse cuidado — `TOKENIZE_MIN_COVERAGE` é
sobreponível **só para testar o próprio guard**, com o comentário
*"um guard que nunca foi visto falhando nao e um guard, e uma intencao"*
(`tokenize.mjs` Linha 133). O mesmo raciocínio se aplica aqui.
