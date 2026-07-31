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
`background-color`, `fg` = `foreground-color`, `border` = `border-color`,
`outline` = `outline-color`, `shadow` = `box-shadow`. The shorthand is for
column width only — **the §4.3 spelling is what goes in a token name.**

| anatomy | bg | fg | border | outline | shadow | fill | stroke |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| *(empty — the owner itself)* | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| `container` ⚠ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| `label` | ✗ | **✓** | ✗ | ✗ | ✗ | — | — |
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

`label` · `placeholder` · `helper` · `caret` · `backdrop` · `divider` have only
**one ✓**. The anatomy already determines the property:

```
✅ field.placeholder          ❌ field.placeholder.foreground-color
✅ modal.backdrop             ❌ modal.backdrop.background-color
✅ menu.divider               ❌ menu.divider.border-color
```

This list is exactly the oracle’s `IMPLIED_PROPERTY`. **The matrix is its
source** — if you add an anatomy here with only one ✓, add it to the map.

> ⚠ **KNOWN DRIFT as of 2026-07-31 — the map has not been updated.** §4.3 of the
> law renamed the text property to `foreground-color`, but
> `scripts/score-naming.mjs` Linhas 93-100 still maps
> `label`/`placeholder`/`helper`/`caret` to the old bare spelling. Measured
> consequence: `button-label-foreground-color` scores **75/100** and fails the
> `coherent-pair` criterion with *"`label` cannot carry `foreground-color` — only
> `color`"* — a false failure produced by the map, not by the name. The law is
> correct; the map is the bug. Fixing it is a code change outside this document.

### 2.2 Multi-property anatomy → property REQUIRED

`icon` carries `foreground-color` **and** `fill` **and** `stroke` — three
different things in an SVG. `header` carries background, text, and border.
Without the property, the name is ambiguous:

```
✅ button.icon.fill    ✅ button.icon.stroke
❌ button.icon         ← which of the three?
```

### 2.3 ✗ cell → the name is wrong, not a synonym

`button.label.background-color` is not "another way to say
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
| `button` | container, label, icon | **yes** → `button.label` (§2.1: `label` implies the property) |
| `field` | container, label, placeholder, helper, caret | **yes** |
| `modal` | container, header, backdrop | **yes** |
| `data-table` | header, row, cell, divider | **yes** |
| `badge` | 1 | **no** → `badge.background-color` |
| `progress` | track, indicator | **yes** |
| `toggle` | track, thumb | **yes** |
| `divider` (owner) ⚠ | 1 | **no** → `divider.border-color` — **not yet legal, see below** |

⚠ `divider` appears in both lists — it is **anatomy** inside `menu`/`data-table`
and an **owner** when it is a standalone page separator. This is not ambiguity in
the law: the law says the owner comes from the **rendered context**. A standalone
`<hr>` has its own owner; the line between two table rows is part of the table.

> ⚠ **BLOCKED as of 2026-07-31 — needs an owner decision, do not use yet.**
> `divider` is in §4.2 (anatomy) but is **not** in §4.1 (owners) — verified by
> reading the vocabulary the guard itself parses: 40 owners, `divider` absent.
> Since `violations_grammar()` landed, `border-divider-border-color` is rejected
> outright (`grammar-owner`), reproduced on a fixture. The reasoning in the
> paragraph above may well be right, but §4 requires a new owner to carry an
> **explicit justification**, and the guard — which is the enforcement — has the
> final word. Either `divider` is added to §4.1 with that justification, or a
> standalone separator takes the owner of the region it separates. **Owner
> decision; not resolvable from within this document.**
