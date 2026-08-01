# Anatomy × property matrix

> **Document nature: NORMATIVE, not measured.** The matrix is a design decision
> — authored, not extracted from counts. This matters: in an earlier iteration,
> I presented consequences of this matrix ("83 impossible pairs", "24,464 valid
> combinations") as if they were measurements, but they were not — they came
> from a map I had written myself. USAGE counts in the repository are measured;
> the matrix is law.

Reading rule: the matrix exists to answer **"can this anatomy carry this
property?"** — the question behind criterion §1.4 of the NAME score.

---

## 1. The matrix

Column headings are shorthand for the §4.3 property they stand for: `bg` =
`background-color`, `fg` = `color`, `border` = `border-color`,
`outline` = `outline-color`, `shadow` = `box-shadow`. The shorthand is for
column width only — **the §4.3 spelling is what goes in a token name.**

| anatomy | bg | fg | border | outline | shadow | fill | stroke |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| *(empty — the owner itself)* | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| `container` ⚠ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| `text` | ✗ | **✓** | ✗ | ✗ | ✗ | — | — |
| `placeholder` | ✗ | **✓** | ✗ | ✗ | ✗ | — | — |
| `helper` | ✗ | **✓** | ✗ | ✗ | ✗ | — | — |
| `caret` | ✗ | **✓** | ✗ | ✗ | ✗ | — | — |
| `icon` | ✗ | ✓ | ✗ | ✗ | ✗ | **✓** | **✓** |
| `divider` | ✗ | ✗ | **✓** | ✗ | ✗ | — | — |
| `backdrop` | **✓** | ✗ | ✗ | ✗ | ✗ | — | — |
| `track` | **✓** | ✗ | ✓ | ✗ | ✗ | — | — |
| `thumb` | **✓** | ✗ | ✓ | ✗ | ✓ | — | — |
| `indicator` | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | — |
| `header` | ✓ | ✓ | ✓ | ✗ | ✓ | — | — |
| `row` | ✓ | ✓ | ✓ | ✗ | ✗ | — | — |
| `cell` | ✓ | ✓ | ✓ | ✗ | ✗ | — | — |
| `prefix` | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `suffix` | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ |
| `handle` | ✓ | ✗ | ✓ | ✗ | ✓ | — | — |

**✓** = valid pair · **✗** = forbidden pair (internal contradiction) · **—** =
not applicable (`fill`/`stroke` exist only in SVG)

⚠ `container` is in the matrix for compatibility with what already exists in the
repository. **Do not create a new token with `container`** — if the owner has a
single part, leave the slot empty. See `examples.md` §2.

---

## 2. The matrix’s three readings

### 2.1 Single-property anatomy → do NOT write the property

`text` · `placeholder` · `helper` · `caret` · `backdrop` · `divider` have only
**one ✓**. The anatomy already determines the property:

```
✅ field.placeholder          ❌ field.placeholder.color
✅ modal.backdrop             ❌ modal.backdrop.background-color
✅ menu.divider               ❌ menu.divider.border-color
```

This list is exactly the oracle's `IMPLIED_PROPERTY`. **The matrix is its
source** — if you add an anatomy here with only one ✓, add it to the map.

> **SCOPED 2026-08-01 — "only one ✓" vale DENTRO do domínio de pintura.** A
> matriz acima tem sete colunas e as sete são paint. Desde que espaçamento e
> tipografia entraram na §4.3 por decisão do dono, um `text` continua tendo
> UMA cor — mas tem também `font-weight`, `line-height` e `letter-spacing`. Logo
> `button.text` é a cor (propriedade omitida) e `button.text.font-weight` é
> obrigatório escrever. O oráculo faz o mesmo corte em `dominioDaPropriedade()`.
>
> E a implicação é regra de RUÍDO, não de impossibilidade: dizer que a única
> propriedade de pintura de `text` é `color` **não** implica que
> `text` não possa carregar outra coisa. As duas afirmações estavam coladas no
> mesmo mapa e a inferência era inválida — separadas em `IMPLIED_PROPERTY`
> (ruído) e `PARES_IMPOSSIVEIS` (impossibilidade real, com a razão escrita).

> ✔ **DRIFT FIXED in `b7a0405` (2026-07-31).** §4.3 renamed the text property to
> `color` and `scripts/score-naming.mjs` (`IMPLIED_PROPERTY`,
> Linhas 105-112) was realigned in the same commit — `text`/`placeholder`/
> `helper`/`caret` now map to `color`, `backdrop` to
> `background-color`, `divider` to `border-color`. The false failure this note
> used to describe (`button-label-color` rejected by `coherent-pair`)
> no longer reproduces. The matrix above remains the SOURCE of the map: adding a
> single-✓ anatomy here requires adding it to `IMPLIED_PROPERTY` in the same
> change.

### 2.2 Multi-property anatomy → property REQUIRED

`icon` carries `color` **and** `fill` **and** `stroke` — three
different things in an SVG. `header` carries background, text, and border.
Without the property, the name is ambiguous:

```
✅ button.icon.fill    ✅ button.icon.stroke
❌ button.icon         ← which of the three?
```

### 2.3 ✗ cell → the name is wrong, not a synonym

`button.text.background-color` is not "another way to say
`button.background-color`". It is an **impossible pair**, and the fix is to
replace the token, never to invent an alias. Decision rule §2: *an incompatible
property means the owner is wrong, not that it is a synonym*.

---

## 3. How many parts the owner has

Write anatomy only when the owner has **more than one addressable part**. In this
system:

| owner | addressable parts | write anatomy? |
|---|---|---|
| `page` | 1 (the surface) | **no** → `page.background-color` |
| `button` | container, label, icon | **yes** → `button.text` (§2.1: `text` implies the property) |
| `field` | container, label, placeholder, helper, caret | **yes** |
| `modal` | container, header, backdrop | **yes** |
| `data-table` | header, row, cell, divider | **yes** |
| `badge` | 1 | **no** → `badge.background-color` |
| `progress` | track, indicator | **yes** |
| `toggle` | track, thumb | **yes** |
| `divider` (owner) | 1 | **no** → `divider.border-color` — legal since §5.5 |

⚠ `divider` appears in both lists — it is **anatomy** inside `menu`/`data-table`
and an **owner** when it is a standalone page separator. This is not ambiguity in
the law: the law says the owner comes from the **rendered context**. A standalone
`<hr>` has its own owner; the line between two table rows is part of the table.

> ✅ **RESOLVED 2026-08-01 — `divider` e `focus-ring` são ENTIDADES GLOBAIS.**
> O bloco anterior dizia *"BLOCKED — needs an owner decision, do not use yet"* e
> era verdade quando foi escrito: §4.1 tinha 40 owners e `divider` não estava lá.
> A decisão foi tomada: componente global **não tem pai**, e §4.1/§5.5 abriram a
> categoria Global. Hoje são **42 owners**, e `divider.border-color` e
> `focus-ring.outline-color` são canônicos — o cookbook os usa em 21 linhas.
>
> Por que isso era perigoso: enquanto o bloco existia, um agente que o lesse
> **recusaria o token que o cookbook prescreve**. O parágrafo acima já estava
> certo; faltava a decisão, não o raciocínio.
>
> `divider` segue nas duas listas de propósito — ANATOMIA dentro de
> `menu`/`data-table`, ENTIDADE quando é separador autônomo. A regra 1 do §5
> (contexto renderizado) desempata.
