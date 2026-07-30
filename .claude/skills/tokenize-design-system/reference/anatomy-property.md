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

| anatomy | bg | color | border | outline | shadow | fill | stroke |
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
✅ field.placeholder          ❌ field.placeholder.color
✅ modal.backdrop             ❌ modal.backdrop.background-color
✅ menu.divider               ❌ menu.divider.border-color
```

This list is exactly the oracle’s `IMPLIED_PROPERTY`. **The matrix is its
source** — if you add an anatomy here with only one ✓, add it to the map.

### 2.2 Multi-property anatomy → property REQUIRED

`icon` carries `color` **and** `fill` **and** `stroke` — three different things
in an SVG. `header` carries background, text, and border. Without the property,
the name is ambiguous:

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
| `button` | container, label, icon | **yes** → `button.label.color` |
| `field` | container, label, placeholder, helper, caret | **yes** |
| `modal` | container, header, backdrop | **yes** |
| `data-table` | header, row, cell, divider | **yes** |
| `badge` | 1 | **no** → `badge.background-color` |
| `progress` | track, indicator | **yes** |
| `toggle` | track, thumb | **yes** |
| `divider` (owner) | 1 | **no** → `divider.border-color` |

⚠ `divider` appears in both lists — it is **anatomy** inside `menu`/`data-table`
and an **owner** when it is a standalone page separator. This is not ambiguity in
the law: the law says the owner comes from the **rendered context**. A standalone
`<hr>` has its own owner; the line between two table rows is part of the table.
