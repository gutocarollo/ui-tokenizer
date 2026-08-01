<!-- GERADO por tools/gates/pending_index.py — NAO EDITE A MAO.
     A fonte de cada item e o arquivo docs/pending/<id>.md correspondente.
     Regenere com: python3 tools/gates/pending_index.py -->

# Pendencias abertas

**5 itens abertos** — 0 esperam decisao do dono, 5 sao trabalho de agente. Resolver um item e **apagar o arquivo** `docs/pending/<id>.md` e regenerar este indice; o git guarda o historico.

Cada item declara a `fonte` que o originou e a `citacao` textual dela. `pending_index.py --check` confere que a citacao ainda existe — item cujo ponteiro apodreceu vira **re-auditoria**, nunca afirmacao.

## Espera o dono

Nada aberto.

## Trabalho de agente

_resolvivel com codigo, medicao ou leitura — nao pergunte, faca._

| | item | severidade | bloqueia | fonte |
|---|---|---|---|---|
| [ ] | [tokenize.mjs estoura o buffer e culpa o filho — o loop para na 3ª de 7 fases](loop-enobufs-no-orquestrador.md) | bloqueante | o loop inteiro — CLUSTER, CONVERGE, REPORT e DECIDE nunca rodam por `tokenize.mjs` | [`.claude/skills/tokenize-design-system/scripts/tokenize.mjs:79`](../../.claude/skills/tokenize-design-system/scripts/tokenize.mjs) |
| [ ] | [o resolvedor de primitivo só enxerga a família `surface` — o sinal mais forte morre em 86% do corpus](resolucao-de-primitivo-hardcoda-familia-banida.md) | bloqueante | a fase DECIDE — 1.449 dos 1.457 pares na fila humana existem por causa disto | [`.claude/skills/tokenize-design-system/scripts/context-clusters.mjs:225`](../../.claude/skills/tokenize-design-system/scripts/context-clusters.mjs) |
| [ ] | [APPLY é fase declarada e ausente — o loop entrega proposta, nunca mutação](fase-apply-nao-implementada.md) | alta | qualquer migração real do alvo; hoje o processo termina em relatório | [`.claude/skills/tokenize-design-system/scripts/tokenize.mjs:253`](../../.claude/skills/tokenize-design-system/scripts/tokenize.mjs) |
| [ ] | [nenhum teste exercita tokenize.mjs — foi por isso que os dois defeitos do loop sobreviveram](loop-sem-teste-de-ponta-a-ponta.md) | alta | nada diretamente; é a razão pela qual os bloqueantes do loop não foram vistos | [`package.json:8`](../../package.json) |
| [ ] | [a suíte canônica é vermelha por default no próprio repo — 29 falhas que não são regressão](suite-vermelha-por-default.md) | media | nada tecnicamente; envenena todo juízo de "a suíte está verde? | [`.claude/skills/tokenize-design-system/scripts/lib/artifact-contract.test.mjs:44`](../../.claude/skills/tokenize-design-system/scripts/lib/artifact-contract.test.mjs) |
