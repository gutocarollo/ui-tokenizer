<!-- GERADO por tools/gates/pending_index.py — NAO EDITE A MAO.
     A fonte de cada item e o arquivo docs/pending/<id>.md correspondente.
     Regenere com: python3 tools/gates/pending_index.py -->

# Pendencias abertas

**6 itens abertos** — 1 esperam decisao do dono, 5 sao trabalho de agente. Resolver um item e **apagar o arquivo** `docs/pending/<id>.md` e regenerar este indice; o git guarda o historico.

Cada item declara a `fonte` que o originou e a `citacao` textual dela. `pending_index.py --check` confere que a citacao ainda existe — item cujo ponteiro apodreceu vira **re-auditoria**, nunca afirmacao.

## Espera o dono

_decisao humana: preferencia, escopo, emenda de lei, custo._

| | item | severidade | bloqueia | fonte |
|---|---|---|---|---|
| [ ] | [F-D0 — os pesos da convergência nunca foram validados, e o questionário está no repo errado](f-d0-pesos-da-convergencia-esperam-o-dono.md) | bloqueante | APPLY — nada é escrito no código com pesos reprovados | [`docs/plans/2026-07-30-plano-reconciliado.md:439`](../../docs/plans/2026-07-30-plano-reconciliado.md) |

## Trabalho de agente

_resolvivel com codigo, medicao ou leitura — nao pergunte, faca._

| | item | severidade | bloqueia | fonte |
|---|---|---|---|---|
| [ ] | [discover-axes viola o próprio contrato em 15 pontos — é o que trava a transição para INVENTORIED](axis-discovery-nao-fecha-o-contrato.md) | bloqueante | a máquina de estados durável em PREFLIGHTED; sem INVENTORIED não há NORMALIZED, e o laço global nunca começa | [`.claude/skills/tokenize-design-system/scripts/lib/artifact-contract.mjs:1331`](../../.claude/skills/tokenize-design-system/scripts/lib/artifact-contract.mjs) |
| [ ] | [APPLY é fase declarada e ausente — o loop entrega proposta, nunca mutação](fase-apply-nao-implementada.md) | alta | qualquer migração real do alvo; hoje o processo termina em relatório | [`.claude/skills/tokenize-design-system/scripts/tokenize.mjs:297`](../../.claude/skills/tokenize-design-system/scripts/tokenize.mjs) |
| [ ] | [nenhum teste exercita tokenize.mjs — foi por isso que os dois defeitos do loop sobreviveram](loop-sem-teste-de-ponta-a-ponta.md) | alta | nada diretamente; é a razão pela qual os bloqueantes do loop não foram vistos | [`package.json:8`](../../package.json) |
| [ ] | [o relatório de rodada escreve na wiki do ALVO e a deixa vermelha — todo run cria um órfão](relatorio-de-rodada-nasce-orfao-no-alvo.md) | media | nada; mas quebra o lint do alvo a cada execução do loop | [`.claude/skills/tokenize-design-system/scripts/tokenization-report.mjs:38`](../../.claude/skills/tokenize-design-system/scripts/tokenization-report.mjs) |
| [ ] | [a suíte canônica é vermelha por default no próprio repo — 29 falhas que não são regressão](suite-vermelha-por-default.md) | media | nada tecnicamente; envenena todo juízo de "a suíte está verde? | [`.claude/skills/tokenize-design-system/scripts/lib/artifact-contract.test.mjs:44`](../../.claude/skills/tokenize-design-system/scripts/lib/artifact-contract.test.mjs) |
