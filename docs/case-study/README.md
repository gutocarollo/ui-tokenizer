# Case study — makers-ai-hub

Medições **reais** feitas com este processo contra um fork do AnythingLLM em
processo de rebrand. São fotografias datadas do estado daquele app, não norma:
quando um doc daqui divergir de `docs/law/GRAMMAR.md`, **a lei ganha** e a
medição é refeita.

| doc | o que mediu |
|---|---|
| `2026-07-29-veredito-naming-tokens.md` | os 139 tokens de cor numerados, onde cada um é aplicado, veredito pela lei e nome sugerido (40 OK / 82 inadequado / 17 pendente) |
| `2026-07-29-fila-revisao-naming.md` | 78 nomes + 30 aplicações abaixo do corte 70, com a nota critério a critério |
| `2026-07-29-clusters-owner-sobras.md` | os 1.431 usos sem owner: 3 eixos de clusterização medidos, a ponte tag×token, e 5 padrões de tom em CIEDE2000 |
| `2026-07-28-inventario-surface-tokens.md` | os 17 `semantic.*.surface.*` caso a caso, consumo nas 3 vias, mortos, duplicatas de valor |
| `2026-07-28-relatorio-superficies-componente-a-componente.md` | 90 histórias de componente, 531 ocorrências renderizadas; **contém retratação** do método antigo (casamento por valor, 99,6% ruído) |
| `2026-07-26-relatorio-antes-depois-tokenizacao.md` | antes/depois da tokenização (ratchet 943 → 0) |
| `2026-07-27-relatorio-auditoria-i18n-motion-cor.md` | auditoria de 16 agentes, 397 achados |
| `2026-07-26-tokenization.md` | arquitetura dos 3 tiers, contrato dos pares coloridos, guards |
| `assets/` | 66 PNGs de evidência: ocorrências contornadas por rota × tema, e o nome do token escrito em cima de cada elemento |
| `sources/` | triagem dos 128 clusters de `className` e o relatório de n-grams do miner |

## Fontes da mineração

Os documentos que originaram o processo — mineração de `className` repetido e a
triagem dos clusters. Ficam citados um a um porque `sources/` é nome genérico e
o lint recusa, de propósito, que um diretório genérico cubra arquivos:

- [`sources/classname-token-mining-v2.md`](sources/classname-token-mining-v2.md) — o minerador AST/JSX e o que ele extrai
- [`sources/2026-07-26-classname-cluster-triagem.md`](sources/2026-07-26-classname-cluster-triagem.md) — triagem dos clusters minerados
