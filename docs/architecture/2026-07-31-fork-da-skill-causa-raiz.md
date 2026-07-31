# O fork da skill — causa raiz, medida

> Achado de 2026-07-31, durante a maratona `tokenizer-cobertura`. O relatório de
> um grafo adversarial apontou que o repo-alvo executa uma cópia divergente da
> skill. A investigação confirmou o fato e **refutou duas explicações minhas**.

## O fato

`makers-ai-hub` carrega **47 arquivos rastreados** da skill, e seus `npm scripts`
executam essa cópia — inclusive `tokens:workflow:prove`, que é o **gate de
conclusão**. Provar conclusão com código divergente prova outra coisa.

## Causa raiz, em três camadas

**1. Por que a cópia existe.** O commit `6468cd8e` a adicionou. O motivo foi
satisfazer o `ref-integrity`, que reclamava de **link markdown quebrado** para
arquivos da skill. O conserto certo era arrumar o link; eu **versionei código
executável para calar um guard de documentação**.

**2. Por que ninguém percebeu.** Naquele commit eu **declarei o risco em prosa**:

> *"passam a existir duas cópias rastreadas da mesma skill. Sem um passo de sync
> no loop, elas divergem de novo."*

Prosa não é enforcement — a mesma lição do `clarification-gate`. **Nenhum guard
comparava as cópias.** Em 3 dias, 21 arquivos divergiram.

**3. O acoplamento nunca foi commitado.** Os 5 `npm scripts` que apontam para
`../.claude/skills/...` **não estão no HEAD** do alvo; vivem só no working tree.
O alvo depende do fork por uma mudança que ninguém versionou.

## Duas explicações minhas que a medição REFUTOU

**"O alvo roda a versão velha."** Parcialmente. `score-naming` do alvo está
atrás (401 × 455 linhas) — isso é real. Mas `tailwind-normalizer` do alvo **não**
está atrás: `HEAD-alvo == v2` (md5 `6b3a8e26` nos dois). O rsync foi fiel.

**"Divergência bidirecional entre duas linhagens."** Não é. Medido:

| lado | natureza |
|---|---|
| 7 arquivos onde a **v2 está à frente** | commitado e pushado — trabalho desta sessão |
| 9 arquivos onde o **alvo está à frente** | **trabalho NÃO COMMITADO** no working tree |

Os dois lados evoluíram sobre a mesma base `6468cd8e`. Não são linhagens rivais:
é v2 commitada contra **trabalho órfão**.

## O achado que virou prioridade

**173 linhas de proveniência do eixo B** (`NORMALIZER_PROVENANCE_FIELDS`,
`assertNormalizerProvenance`, `resolveTailwindConfigBinding`) mais um arquivo
inteiro untracked (`design-occurrence-lineage.mjs`, 295 linhas) estão **a um
`git checkout` de sumir**. Isso é mais urgente que o fork em si.

## O conserto

`tools/gates/skill-drift.py` — guard de **dois níveis**, porque um nível só falha
aberto:

| nível | compara | quando |
|---|---|---|
| **1** | vendorizado × `skill-sync.json` | **sempre** — não precisa da canônica. Pega edição local |
| **2** | manifesto × canônica | quando a canônica está presente. Pega a canônica ter andado |

Um guard de nível único ("compare com a canônica") **falha aberto** em qualquer
clone sem o repo irmão — e guard de drift que falha aberto não é guard. O
manifesto viaja com o alvo e mantém o nível 1 sempre armado.

Nunca corrige sozinho: sincronizar automaticamente num pre-commit esconderia a
divergência **dentro de um commit que passa**.

`--selftest` **5/5**, incluindo o caso que importa: **sem manifesto FALHA** — não
passa por omissão.

## Ordem do conserto, e por que não é sync

1. **Commitar o trabalho órfão do alvo** — antes de tudo, senão o merge o destrói.
2. **Portar para a v2** o que é canônico (proveniência do eixo B, lineage).
3. **Sincronizar** v2 → alvo e gravar o manifesto.
4. **Armar o guard** no pre-commit dos dois repos.

`rsync --delete` antes do passo 1 apagaria `design-occurrence-lineage.mjs`, que é
untracked. Foi por isso que a checagem de "o que existe só no alvo" veio antes.
