# Fila de revisão de naming — o que está abaixo do corte

> Classe `event` (`docs/SCHEMA.md` §2). Gerado por
> `node tokens/score-naming.mjs`. A lei e o método de nota estão em
> `frontend/tokens/GRAMMAR.md` §7. **Corte: 70/100.**

Regenerar: `cd frontend && node tokens/score-naming.mjs --revisao`

## 1. Resumo

| | | |
|---|---:|---|
| nomes em revisão | **78** de 97 | média 52.6 |
| nomes aprovados | 19 | média 81.8 |
| aplicações em revisão | **30** de 151 avaliáveis | |

**Critério que mais reprova:**

| critério | nomes reprovados |
|---|---:|
| `sem-contexto` | 61 |
| `owner` | 41 |
| `sem-sobra` | 41 |
| `sem-redundancia` | 32 |
| `estado-com-base` | 5 |

## 2. Nomes em revisão, do pior para o melhor

### `surface-hover` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `surface-hover`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: surface (localizacao) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `surface-hover` — abreviacao ou palavra nao prevista no §4 |

### `static-white` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `static-white`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: static (pigmento), white (pigmento) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `static-white` — abreviacao ou palavra nao prevista no §4 |

### `static-black` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `static-black`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: static (pigmento), black (pigmento) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `static-black` — abreviacao ou palavra nao prevista no §4 |

### `border-default` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `border-default`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: default (generico) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `border-default` — abreviacao ou palavra nao prevista no §4 |

### `surface-selected` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `surface-selected`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: surface (localizacao) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `surface-selected` — abreviacao ou palavra nao prevista no §4 |

### `surface-selected-foreground` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `surface-selected-foreground`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: surface (localizacao), foreground (localizacao) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `surface-selected-foreground` — abreviacao ou palavra nao prevista no §4 |

### `surface-destructive-tint` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `surface-destructive-tint`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: surface (localizacao) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `surface-destructive-tint` — abreviacao ou palavra nao prevista no §4 |

### `surface-info-tint` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `surface-info-tint`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: surface (localizacao) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `surface-info-tint` — abreviacao ou palavra nao prevista no §4 |

### `surface-elevated` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `surface-elevated`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: surface (localizacao), elevated (localizacao) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `surface-elevated` — abreviacao ou palavra nao prevista no §4 |

### `primary-foreground` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `primary` · estado `—` · **SOBRA `foreground`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: foreground (localizacao) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `foreground` — abreviacao ou palavra nao prevista no §4 |

### `surface-inset-inverse` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `surface-inset-inverse`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: surface (localizacao) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `surface-inset-inverse` — abreviacao ou palavra nao prevista no §4 |

### `ui-dnd-overlay` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `ui-dnd-overlay`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: ui (generico) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `ui-dnd-overlay` — abreviacao ou palavra nao prevista no §4 |

### `ui-accent-lime` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `ui-accent-lime`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: ui (generico) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `ui-accent-lime` — abreviacao ou palavra nao prevista no §4 |

### `surface-panel` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `surface-panel`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: surface (localizacao), panel (localizacao) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `surface-panel` — abreviacao ou palavra nao prevista no §4 |

### `grey-dark` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `grey-dark`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: grey (pigmento) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `grey-dark` — abreviacao ou palavra nao prevista no §4 |

### `surface-warning-tint` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `surface-warning-tint`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: surface (localizacao) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `surface-warning-tint` — abreviacao ou palavra nao prevista no §4 |

### `surface-canvas` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `surface-canvas`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: surface (localizacao), canvas (localizacao) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `surface-canvas` — abreviacao ou palavra nao prevista no §4 |

### `ui-link-on-tint` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `ui-link-on-tint`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: ui (generico) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `ui-link-on-tint` — abreviacao ou palavra nao prevista no §4 |

### `ui-status-online-ring` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `ui-status-online-ring`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: ui (generico) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `ui-status-online-ring` — abreviacao ou palavra nao prevista no §4 |

### `ui-status-online-dot` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `ui-status-online-dot`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: ui (generico) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `ui-status-online-dot` — abreviacao ou palavra nao prevista no §4 |

### `ui-brand-telegram` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `ui-brand-telegram`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: ui (generico) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `ui-brand-telegram` — abreviacao ou palavra nao prevista no §4 |

### `surface-success-tint` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `surface-success-tint`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: surface (localizacao) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `surface-success-tint` — abreviacao ou palavra nao prevista no §4 |

### `grey-darker` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `grey-darker`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: grey (pigmento) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `grey-darker` — abreviacao ou palavra nao prevista no §4 |

### `destructive-foreground` — 35/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `destructive` · estado `—` · **SOBRA `foreground`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: foreground (localizacao) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `foreground` — abreviacao ou palavra nao prevista no §4 |

### `content-danger` — 60/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `content-danger`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ✅ `sem-contexto` | 25/25 | nenhuma palavra de tier/localizacao/pigmento |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `content-danger` — abreviacao ou palavra nao prevista no §4 |

### `content-primary` — 60/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `content-primary`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ✅ `sem-contexto` | 25/25 | nenhuma palavra de tier/localizacao/pigmento |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `content-primary` — abreviacao ou palavra nao prevista no §4 |

### `content-inverse` — 60/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `content-inverse`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ✅ `sem-contexto` | 25/25 | nenhuma palavra de tier/localizacao/pigmento |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `content-inverse` — abreviacao ou palavra nao prevista no §4 |

### `content-warning` — 60/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `content-warning`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ✅ `sem-contexto` | 25/25 | nenhuma palavra de tier/localizacao/pigmento |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `content-warning` — abreviacao ou palavra nao prevista no §4 |

### `content-secondary` — 60/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `content-secondary`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ✅ `sem-contexto` | 25/25 | nenhuma palavra de tier/localizacao/pigmento |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `content-secondary` — abreviacao ou palavra nao prevista no §4 |

### `list-row-container-background-color` — 60/100

slots lidos: owner `list-row` · anatomia `container` · propriedade `background-color` · variante `—` · estado `—`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `list-row` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `content-info` — 60/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `content-info`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ✅ `sem-contexto` | 25/25 | nenhuma palavra de tier/localizacao/pigmento |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `content-info` — abreviacao ou palavra nao prevista no §4 |

### `content-disabled` — 60/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `content-disabled`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ✅ `sem-contexto` | 25/25 | nenhuma palavra de tier/localizacao/pigmento |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `content-disabled` — abreviacao ou palavra nao prevista no §4 |

### `border-inverse` — 60/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `border-inverse`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ✅ `sem-contexto` | 25/25 | nenhuma palavra de tier/localizacao/pigmento |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `border-inverse` — abreviacao ou palavra nao prevista no §4 |

### `border-subtle` — 60/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `border-subtle`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ✅ `sem-contexto` | 25/25 | nenhuma palavra de tier/localizacao/pigmento |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `border-subtle` — abreviacao ou palavra nao prevista no §4 |

### `content-success` — 60/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `content-success`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ✅ `sem-contexto` | 25/25 | nenhuma palavra de tier/localizacao/pigmento |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `content-success` — abreviacao ou palavra nao prevista no §4 |

### `toolbar-container-background-color` — 60/100

slots lidos: owner `toolbar` · anatomia `container` · propriedade `background-color` · variante `—` · estado `—`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `toolbar` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `content-tertiary` — 60/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `content-tertiary`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ✅ `sem-contexto` | 25/25 | nenhuma palavra de tier/localizacao/pigmento |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `content-tertiary` — abreviacao ou palavra nao prevista no §4 |

### `field-container-background-color` — 60/100

slots lidos: owner `field` · anatomia `container` · propriedade `background-color` · variante `—` · estado `—`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `field` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `app-bg` — 60/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `app-bg`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ✅ `sem-contexto` | 25/25 | nenhuma palavra de tier/localizacao/pigmento |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `app-bg` — abreviacao ou palavra nao prevista no §4 |

### `list-row-container-background-color-selected` — 60/100

slots lidos: owner `list-row` · anatomia `container` · propriedade `background-color` · variante `—` · estado `selected`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `list-row` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | par default existe (`list-row-container-background-color`) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `card-container-background-color` — 60/100

slots lidos: owner `card` · anatomia `container` · propriedade `background-color` · variante `—` · estado `—`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `card` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `badge-container-background-color` — 60/100

slots lidos: owner `badge` · anatomia `container` · propriedade `background-color` · variante `—` · estado `—`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `badge` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `toolbar-container-background-color-secondary` — 60/100

slots lidos: owner `toolbar` · anatomia `container` · propriedade `background-color` · variante `secondary` · estado `—`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `toolbar` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `button-container-background-color` — 60/100

slots lidos: owner `button` · anatomia `container` · propriedade `background-color` · variante `—` · estado `—`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `button` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `chat-message-container-background-color` — 60/100

slots lidos: owner `chat-message` · anatomia `container` · propriedade `background-color` · variante `—` · estado `—`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `chat-message` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `code-block-container-background-color` — 60/100

slots lidos: owner `code-block` · anatomia `container` · propriedade `background-color` · variante `—` · estado `—`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `code-block` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `menu-container-background-color` — 60/100

slots lidos: owner `menu` · anatomia `container` · propriedade `background-color` · variante `—` · estado `—`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `menu` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `button-container-background-color-active` — 60/100

slots lidos: owner `button` · anatomia `container` · propriedade `background-color` · variante `—` · estado `active`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `button` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | par default existe (`button-container-background-color`) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `nav-item-container-background-color-selected` — 60/100

slots lidos: owner `nav-item` · anatomia `container` · propriedade `background-color` · variante `—` · estado `selected`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `nav-item` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | par default existe (`nav-item-container-background-color`) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `nav-item-container-background-color` — 60/100

slots lidos: owner `nav-item` · anatomia `container` · propriedade `background-color` · variante `—` · estado `—`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `nav-item` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `meter-fill` — 60/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `meter-fill`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ✅ `sem-contexto` | 25/25 | nenhuma palavra de tier/localizacao/pigmento |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `meter-fill` — abreviacao ou palavra nao prevista no §4 |

### `meter-track` — 60/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `meter-track`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ✅ `sem-contexto` | 25/25 | nenhuma palavra de tier/localizacao/pigmento |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `meter-track` — abreviacao ou palavra nao prevista no §4 |

### `button-container-background-color-loading` — 60/100

slots lidos: owner `button` · anatomia `container` · propriedade `background-color` · variante `—` · estado `loading`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `button` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | par default existe (`button-container-background-color`) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `button-container-background-color-on` — 60/100

slots lidos: owner `button` · anatomia `container` · propriedade `background-color` · variante `—` · estado `on`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `button` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | par default existe (`button-container-background-color`) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `list-row-container-background-color-active` — 60/100

slots lidos: owner `list-row` · anatomia `container` · propriedade `background-color` · variante `—` · estado `active`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `list-row` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | par default existe (`list-row-container-background-color`) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `search-container-background-color` — 60/100

slots lidos: owner `search` · anatomia `container` · propriedade `background-color` · variante `—` · estado `—`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `search` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `button-container-background-color-disabled` — 60/100

slots lidos: owner `button` · anatomia `container` · propriedade `background-color` · variante `—` · estado `disabled`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `button` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | par default existe (`button-container-background-color`) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `chatarea-bg` — 60/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `chatarea-bg`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ✅ `sem-contexto` | 25/25 | nenhuma palavra de tier/localizacao/pigmento |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `chatarea-bg` — abreviacao ou palavra nao prevista no §4 |

### `badge-container-background-color-secondary` — 60/100

slots lidos: owner `badge` · anatomia `container` · propriedade `background-color` · variante `secondary` · estado `—`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `badge` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `banner-container-background-color` — 60/100

slots lidos: owner `banner` · anatomia `container` · propriedade `background-color` · variante `—` · estado `—`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `banner` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `banner-container-background-color-destructive` — 60/100

slots lidos: owner `banner` · anatomia `container` · propriedade `background-color` · variante `destructive` · estado `—`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `banner` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `content-on-active` — 60/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `content-on-active`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ✅ `sem-contexto` | 25/25 | nenhuma palavra de tier/localizacao/pigmento |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `content-on-active` — abreviacao ou palavra nao prevista no §4 |

### `premium` — 60/100

slots lidos: owner `—` · anatomia `—` · propriedade `—` · variante `—` · estado `—` · **SOBRA `premium`**

| critério | pts | o quê |
|---|---:|---|
| ❌ `owner` | 0/30 | SEM OWNER — o token nao tem dono; nao ha como julgar um uso novo |
| ✅ `sem-contexto` | 25/25 | nenhuma palavra de tier/localizacao/pigmento |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ❌ `sem-sobra` | 0/10 | segmento fora de qualquer slot da lei: `premium` — abreviacao ou palavra nao prevista no §4 |

### `avatar-container-background-color` — 60/100

slots lidos: owner `avatar` · anatomia `container` · propriedade `background-color` · variante `—` · estado `—`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `avatar` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `code-block-container-background-color-secondary` — 60/100

slots lidos: owner `code-block` · anatomia `container` · propriedade `background-color` · variante `secondary` · estado `—`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `code-block` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `button-container-background-color-secondary-selected` — 60/100

slots lidos: owner `button` · anatomia `container` · propriedade `background-color` · variante `secondary` · estado `selected`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `button` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | par default existe (`button-container-background-color-secondary`) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `button-container-background-color-secondary` — 60/100

slots lidos: owner `button` · anatomia `container` · propriedade `background-color` · variante `secondary` · estado `—`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `button` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `button-container-background-color-ghost-selected` — 60/100

slots lidos: owner `button` · anatomia `container` · propriedade `background-color` · variante `ghost` · estado `selected`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `button` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | par default existe (`button-container-background-color-ghost`) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `button-container-background-color-ghost` — 60/100

slots lidos: owner `button` · anatomia `container` · propriedade `background-color` · variante `ghost` · estado `—`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `button` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `checkbox-container-background-color-disabled` — 60/100

slots lidos: owner `checkbox` · anatomia `container` · propriedade `background-color` · variante `—` · estado `disabled`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `checkbox` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | par default existe (`checkbox-container-background-color`) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `checkbox-container-background-color-checked` — 60/100

slots lidos: owner `checkbox` · anatomia `container` · propriedade `background-color` · variante `—` · estado `checked`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `checkbox` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | par default existe (`checkbox-container-background-color`) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `checkbox-container-background-color` — 60/100

slots lidos: owner `checkbox` · anatomia `container` · propriedade `background-color` · variante `—` · estado `—`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `checkbox` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `pill-container-background-color` — 60/100

slots lidos: owner `pill` · anatomia `container` · propriedade `background-color` · variante `—` · estado `—`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `pill` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ❌ `sem-redundancia` | 0/15 | palavra que nao perde informacao: container (slot vazio ja significa "o proprio owner") |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ✅ `estado-com-base` | 10/10 | sem estado declarado (default implicito, correto) |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `menu-row-background-color-active` — 65/100

slots lidos: owner `menu` · anatomia `row` · propriedade `background-color` · variante `—` · estado `active`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `menu` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ❌ `estado-com-base` | 0/10 | estado `active` sem o par default `menu-row-background-color` |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `menu-row-background-color-selected` — 65/100

slots lidos: owner `menu` · anatomia `row` · propriedade `background-color` · variante `—` · estado `selected`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `menu` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ❌ `estado-com-base` | 0/10 | estado `selected` sem o par default `menu-row-background-color` |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `toggle-track-background-color-off` — 65/100

slots lidos: owner `toggle` · anatomia `track` · propriedade `background-color` · variante `—` · estado `off`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `toggle` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ❌ `estado-com-base` | 0/10 | estado `off` sem o par default `toggle-track-background-color` |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `toggle-track-background-color-focus` — 65/100

slots lidos: owner `toggle` · anatomia `track` · propriedade `background-color` · variante `—` · estado `focus`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `toggle` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ❌ `estado-com-base` | 0/10 | estado `focus` sem o par default `toggle-track-background-color` |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

### `toggle-track-background-color-on` — 65/100

slots lidos: owner `toggle` · anatomia `track` · propriedade `background-color` · variante `—` · estado `on`

| critério | pts | o quê |
|---|---:|---|
| ✅ `owner` | 30/30 | owner `toggle` do vocabulario |
| ❌ `sem-contexto` | 0/25 | palavra que nenhum slot pede: background (localizacao) |
| ✅ `sem-redundancia` | 15/15 | toda palavra perde informacao se removida |
| ✅ `par-coerente` | 10/10 | anatomia e propriedade compativeis |
| ❌ `estado-com-base` | 0/10 | estado `on` sem o par default `toggle-track-background-color` |
| ✅ `sem-sobra` | 10/10 | todo segmento caiu num slot da lei |

## 3. Aplicações em revisão

Uso cuja nota de encaixe ficou abaixo do corte — o nome promete uma coisa e o
uso faz outra.

| nota | onde | classe | problema |
|---:|---|---|---|
| 18 | `src/pages/GeneralSettings/Settings/components/CustomLogo/index.jsx:130` | `hover:text-checkbox-checkmark` | usado em `hover:` mas o nome nao declara estado |
| 18 | `src/pages/GeneralSettings/Settings/components/CustomLogo/index.jsx:145` | `hover:text-checkbox-checkmark` | usado em `hover:` mas o nome nao declara estado |
| 38 | `src/components/Sidebar/ActiveWorkspaces/ThreadContainer/index.jsx:193` | `hover:bg-sidebar-item-active-hover` | usado em `hover:` mas o nome nao declara estado |
| 40 | `src/components/SettingsSidebar/index.jsx:113` | `bg-sidebar-divider` | H-021: nome promete border-color, mas `bg-` pinta background-color |
| 40 | `src/components/SettingsSidebar/index.jsx:169` | `bg-sidebar-divider` | H-021: nome promete border-color, mas `bg-` pinta background-color |
| 67 | `src/components/WorkspaceChat/ChatContainer/ChatHistory/ClarifyingQuestion/ChoiceForm.jsx:12` | `bg-list-row-container-background-color-selected` | nome declara `.selected` mas foi usado sem prefixo de estado |
| 67 | `src/components/WorkspaceChat/ChatContainer/ChatHistory/ClarifyingQuestion/ChoiceForm.jsx:41` | `bg-list-row-container-background-color-selected` | nome declara `.selected` mas foi usado sem prefixo de estado |
| 67 | `src/components/WorkspaceChat/ChatContainer/ChatSettingsMenu/index.jsx:36` | `bg-button-container-background-color-active` | nome declara `.active` mas foi usado sem prefixo de estado |
| 67 | `src/components/WorkspaceChat/ChatContainer/MemoriesSidebar/MemoryTabs/index.jsx:29` | `bg-nav-item-container-background-color-selected` | nome declara `.selected` mas foi usado sem prefixo de estado |
| 67 | `src/components/WorkspaceChat/ChatContainer/MemoriesSidebar/MemoryTabs/index.jsx:45` | `bg-nav-item-container-background-color-selected` | nome declara `.selected` mas foi usado sem prefixo de estado |
| 67 | `src/components/WorkspaceChat/ChatContainer/PromptInput/LLMSelector/LLMSelector/index.jsx:35` | `bg-menu-row-background-color-selected` | nome declara `.selected` mas foi usado sem prefixo de estado |
| 67 | `src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/AgentSkills/SkillRow/index.jsx:20` | `bg-list-row-container-background-color-active` | nome declara `.active` mas foi usado sem prefixo de estado |
| 67 | `src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/AgentSkills/SkillRow/index.jsx:20` | `light:bg-list-row-container-background-color-active` | nome declara `.active` mas foi usado sem prefixo de estado |
| 67 | `src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/AgentSkills/SkillSection/index.jsx:24` | `bg-list-row-container-background-color-active` | nome declara `.active` mas foi usado sem prefixo de estado |
| 67 | `src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/AgentSkills/SkillSection/index.jsx:24` | `light:bg-list-row-container-background-color-active` | nome declara `.active` mas foi usado sem prefixo de estado |
| 67 | `src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/SlashCommands/SlashCommandRow/index.jsx:41` | `bg-list-row-container-background-color-active` | nome declara `.active` mas foi usado sem prefixo de estado |
| 67 | `src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/SlashCommands/SlashCommandRow/index.jsx:41` | `light:bg-list-row-container-background-color-active` | nome declara `.active` mas foi usado sem prefixo de estado |
| 67 | `src/components/WorkspaceChat/ChatContainer/PromptInput/index.jsx:444` | `bg-button-container-background-color-active` | nome declara `.active` mas foi usado sem prefixo de estado |
| 67 | `src/components/WorkspaceChat/ChatContainer/PromptInput/index.jsx:473` | `bg-button-container-background-color-disabled` | nome declara `.disabled` mas foi usado sem prefixo de estado |
| 67 | `src/components/WorkspaceChat/ChatContainer/TextSizeMenu/index.jsx:50` | `bg-button-container-background-color-active` | nome declara `.active` mas foi usado sem prefixo de estado |
| 67 | `src/components/WorkspaceChat/ChatContainer/WorkspaceModelPicker/index.jsx:114` | `bg-button-container-background-color-active` | nome declara `.active` mas foi usado sem prefixo de estado |
| 67 | `src/components/lib/ModelTable/index.jsx:191` | `bg-list-row-container-background-color-active` | nome declara `.active` mas foi usado sem prefixo de estado |
| 67 | `src/components/lib/ModelTable/index.jsx:196` | `bg-list-row-container-background-color-active` | nome declara `.active` mas foi usado sem prefixo de estado |
| 67 | `src/pages/GeneralSettings/ScheduledJobs/JobFormModal/CronBuilder.jsx:160` | `bg-button-container-background-color-secondary-selected` | nome declara `.selected` mas foi usado sem prefixo de estado |
| 67 | `src/pages/GeneralSettings/ScheduledJobs/JobFormModal/JobSchedule.jsx:46` | `bg-button-container-background-color-ghost-selected` | nome declara `.selected` mas foi usado sem prefixo de estado |
| 67 | `src/pages/GeneralSettings/ScheduledJobs/JobFormModal/ToolsSelector.jsx:33` | `bg-checkbox-container-background-color-disabled` | nome declara `.disabled` mas foi usado sem prefixo de estado |
| 67 | `src/pages/GeneralSettings/ScheduledJobs/JobFormModal/ToolsSelector.jsx:35` | `bg-checkbox-container-background-color-checked` | nome declara `.checked` mas foi usado sem prefixo de estado |
| 67 | `src/pages/GeneralSettings/ScheduledJobs/JobFormModal/ToolsSelector.jsx:35` | `light:bg-checkbox-container-background-color-checked` | nome declara `.checked` mas foi usado sem prefixo de estado |
| 67 | `src/pages/GeneralSettings/ScheduledJobs/components/JobRow.jsx:95` | `bg-toggle-track-background-color-on` | nome declara `.on` mas foi usado sem prefixo de estado |
| 67 | `src/pages/GeneralSettings/ScheduledJobs/components/JobRow.jsx:96` | `bg-toggle-track-background-color-off` | nome declara `.off` mas foi usado sem prefixo de estado |

## 4. Nomes aprovados

| token | nota |
|---|---:|
| `sidebar-divider` | 100 |
| `checkbox-checkmark` | 90 |
| `sidebar-bg` | 90 |
| `sidebar-item-hover` | 90 |
| `sidebar-item-active-hover` | 90 |
| `sidebar-field-bg` | 90 |
| `popover-bg` | 90 |
| `sidebar-item-active` | 90 |
| `prompt-bg` | 90 |
| `menu-container` | 85 |
| `button-icon-background-color` | 75 |
| `list-row-icon-background-color` | 75 |
| `progress-track-background-color` | 75 |
| `progress-indicator-background-color` | 75 |
| `primary` | 70 |
| `info` | 70 |
| `destructive` | 70 |
| `success` | 70 |
| `warning` | 70 |