# Telas com o nome do token rotulado em cada elemento

Coleção de assets do
[2026-07-29-veredito-naming-tokens.md](../../2026-07-29-veredito-naming-tokens.md).

**32 PNGs** — 16 rotas × 2 temas, 1.106 elementos rotulados. `/login` não está
aqui porque consome **zero** token: a `AuthScene` usa estilo inline com hex
cravado.

A fonte do rótulo é o **`className`** do elemento, não a cor do pixel. Se a
classe não nomeia o token, o elemento não aparece.

- 🟥 rótulo vermelho — token que viola `tokens/GRAMMAR.md`: `surface-`,

> ⚠ **Retrofit 2026-08-01: `content-` também viola a lei** (banida em 2026-07-31,
> depois destes PNGs). Os **832** rótulos `content-*` do `labels.json` desta coleção
> aparecem em azul e deveriam ser vermelhos.
  `semantic-`, `ui-`, ou nome de cor (`pink-`, `grey-`, `static-`)
- 🟦 rótulo azul — os demais

O rótulo traz a classe completa, inclusive prefixo de estado (`hover:bg-x`
aparece mesmo sem o cursor em cima, porque a classe está no DOM).

`labels.json` traz os 1.106 registros com rota, tema, tag, texto, retângulo e os
tokens de cada elemento.

Regerar: `cd frontend && node tests/visual/capture-token-labels.mjs`
