# Good and bad examples

Every pair below is a measured reference case. None is hypothetical; adapt its
values and paths to the target repository rather than treating them as defaults.

---

## 1. Context word in the identifier

### ❌ Bad

```json
{ "semantic": { "color": { "surface": { "canvas": { "$value": "#F3F3F0" } } } } }
```
→ emits `--color-semantic-color-surface-canvas` · class `bg-semantic-color-surface-canvas`

**Why it is bad, measured:**
- `semantic` is the **tier** name. No slot in the law asks "which tier?".
- `color` is derivable from `background-color`.
- `surface` answers *"where in the z-stack?"*. No slot asks that question.
- `canvas` is a synonym for "page background" — but does not say **whose**.
- Anyone reading `bg-surface-canvas` in JSX does not know whether it may be used
  in a modal.

**Mandatory review.** It loses the owner and no-context criteria and leaves
segments outside the grammar. The exact score is calculated against the target
token universe by `score-naming.mjs`; this example does not freeze a second
numeric oracle in prose.

### ✅ Good

```json
{ "component": { "queroquero": { "page": { "background-color": { "$value": "{primitive.c-f3f3f0}" } } } } }
```
→ `--color-page-background-color` · class `bg-page-background-color`

**Score: 100/100.** `page` answers "whose," and `background-color` answers
"what it paints." Removing any word loses information.

> ⚠ §6 of the law prints the shorter `bg-page` for the same token. Whether the
> class repeats the property suffix is an **open architecture decision**, not a
> contradiction to resolve here — see the warning in §6 of the law. Both
> spellings satisfy the guard; what it does enforce is that the prefix may not
> **contradict** the property.

---

## 2. `container` where the owner has no parts

### ❌ Bad

```
button.container.background-color
```

The owner caught it immediately: *"BUTTON CONTAINER? IS IT THE CONTAINER OUTSIDE
THE BUTTON? WHY SHOULD THE EXTERNAL CONTAINER TOKEN BE UNDER BUTTON? IF IT IS THE
BUTTON ITSELF, WHY CONTAINER?"*

**The right question is: if `container` were not there, what could be there?**
Answer: `label`, `icon`, `prefix`, `suffix`. `container` means "none of those"
— **the part that is the whole**. That is exactly what the **empty** slot already
says.

**Mechanical proof:** after removing `container` from 33 tokens, **0 collide**
with an existing token. Zero information, 33 times.

### ✅ Good

```
button.background-color          ← the button’s own surface
button.label                     ← the text inside it (§2.1 of anatomy-property.md:
                                    `label` permits only one property, so writing
                                    `foreground-color` here would be redundant)
button.icon.fill                 ← the icon inside it
```

### ✅ Good, and here anatomy EARNS the right to exist

```
data-table.header.background-color
data-table.row.background-color
data-table.cell.border-color
```

`data-table` has **genuinely distinguishable** parts. Here anatomy carries
information: removing `header` collides with `row`.

---

## 3. Derivable property

### ❌ Bad

```
field.placeholder.foreground-color
```

`placeholder` **can only** have `foreground-color`. `placeholder.background-color`
does not exist — a placeholder is text. The property is derivable from the
anatomy.

### ✅ Good

```
field.placeholder
```

### ✅ Good, and here the property is mandatory

```
field.background-color
field.border-color
field.foreground-color
```

`field` itself permits background, border, **and** text. Without the property,
the name is ambiguous. Compare: `field.placeholder` is not ambiguous; `field`
alone is.

---

## 4. Impossible anatomy × property pair

### ❌ Bad

```
button.label.background-color
```

A **label has no surface**. If you want to paint the background behind a button’s
text, that is the **button’s** background: `button.background-color`. The pair is
an internal contradiction, not a token.

**Score: −10 in the "coherent pair" criterion.**

### ✅ Good

```
button.background-color      ← the background
button.label                 ← the text (the anatomy already implies the property)
```

---

## 5. State without a base

### ❌ Bad

```
button.background-color.hover     ← and NO button.background-color
```

Hover is a **delta**. Without `default`, what is the delta applied to? Measured
in the repository: `surface-hover` had 110 uses and the `#E2E2E2` value that the
owner explicitly rejected — because it existed without a pair, so nobody knew
what the hover state was derived from.

**Measured real consequence:** a hover starting from a **transparent** background
and one starting from an **already elevated** background became the same tone.
Visible result: an item kept its hover color after being selected.

### ✅ Good

```
nav-item.background-color            ← default (transparent)
nav-item.background-color.hover      ← delta from transparent
nav-item.background-color.selected   ← persistent state
nav-item.background-color.selected.hover  ← delta from selected
```

**Two hovers with different values are CORRECT** and do not indicate token
inconsistency. Unifying them recreates the bug.

---

## 6. A color name inside the name

### ❌ Bad

```
pink-medium        ← not even under the pretext that "it is the primitive’s name"
static-white
grey-800
```

**This was a real pitfall.** The automated migration was going to replace
`primary-button` → `pink-medium` in **682 uses**, because `pink-medium` was the
value resolved by `primary-button`. It would replace a **role** name with a
**pigment** name — a regression, not a migration.

After prohibiting pigment names at the target, the "safe" migration shrank from
30 tokens/1,892 uses to **24/1,203**. Shrinking was the correct outcome.

### ✅ Good

**At the primitive tier**, pigment is legitimate — it is what the primitive is:
```
primitive.c-e91e63
```
**In the identifier consumed by the component**, never:
```
button.primary.background-color → points to primitive.c-e91e63
```

---

## 7. Owner inferred from VALUE instead of context

### ❌ Bad

The extractor saw `#FFFFFF` and guessed `raised` or `inset-inverse` — both equal
`#FFFFFF` in one theme. Result: **of 531 marked occurrences, two were real
consumption.** 99.6% noise. The owner said: *"I did not understand what this
actually is because there is no color there at all."* They were right.

### ✅ Good

Read the token from **`className`**, never from the pixel:

```js
// correct: the token name comes from the declared class
const m = className.match(/(?:^|:)(bg|text|border|fill|stroke)-([a-z0-9-]+)/);
```

**Value matching is always a false positive when two tokens share the value** —
and sharing a value is the common case, not the exception.

---

## 8. Substring in the component name

### ❌ Bad

```js
if (componentName.toLowerCase().includes(owner)) return owner;
```

`EmbeddingSelection`.includes(`select`) → **true**. **262 of 418** uses were
attributed to `select` because of it. A custom `div`+`button` picker is not a
`<select>`.

### ✅ Good

```js
const words = ident.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .replace(/[^A-Za-z0-9]+/g, " ").toLowerCase().trim().split(/\s+/);
// compound owner: words must appear in SEQUENCE
```

`EmbeddingSelection` → `["embedding","selection"]`, and `selection ≠ select`.

---

## 9. Structural directory as owner

### ❌ Bad

`src/pages/Foo/index.jsx` → owner `page`. **34 of 38** uses came from a routing
convention, not semantics.

### ✅ Good

Exclude structural names before inspecting the directory:

```js
const STRUCTURE = new Set(["src","pages","components","ui","lib","hooks",
  "utils","models","styles","assets","shared","common","index","app","views"]);
```

`components/Modals/NewUser/index.jsx` → ascend to `Modals` → owner `modal`. ✅

---

## 10. One token for many owners — and why `content` was BANNED

### ❌ Bad

```
content-primary     ← 1,647 uses, 26 different owners
```

Changing the button text changes the modal, card, and field text. **That is not
DRY; it is coupling** — the value is shared *and so is the contract*.

> **BANNED 2026-07-31.** `content` joined `surface` and `semantic` in the
> guard's denylist — `FORBIDDEN = ("surface", "semantic", "content")` in
> `tools/gates/ds-naming-law.py` Linha 121. Everything in this section that reads
> `content-*` is therefore a **historical measurement of the defect**, never a
> spelling to copy.
>
> The coupling above is the *consequence*. The defect in the NAME is that
> `content-*` mixes **two axes** in one vocabulary without saying which is in
> use: `primary`/`secondary`/`tertiary` answer **RANK** (how important), while
> `danger`/`success`/`info`/`placeholder` answer **ROLE** (what for).
> `content-secondary` and `content-danger` look like siblings and are not. And
> `content` alone says neither that it is a color nor that it is text — it could
> be a container, a slot, or a payload. Full reasoning in §3.1 of the law.
>
> Two independent checks now reject it: `violations_in_source()` (the denylist)
> and `violations_grammar()` (`content` is not an owner of §4.1). Verified
> 2026-07-31 on a fixture — `text-content-primary` produces one finding of each
> kind.

### ✅ Good

```json
"button": { "label": { "color": { "$value": "{primitive.c-000000}" } } },
"modal":  { "label": { "color": { "$value": "{primitive.c-000000}" } } },
"field":  { "label": { "color": { "$value": "{primitive.c-000000}" } } }
```

The pixels are **identical** today (the same primitive). Each contract can diverge
**tomorrow** without touching the others. Centralization belongs in the
**primitive**, not in the name.

---

## 11. Clustering: when it helps and when it destroys

### ✅ Good — a cluster that adds value

> The ✅ marks the **clustering decision**, not the class in the evidence. The
> two lines below are the measured BEFORE state, quoted verbatim from the source;
> `text-content-primary` is a banned name that **fails the guard today** (§10).
> The ✅ is the token on the right-hand side of the arrow.

**50 components** — `CohereOptions`, `GeminiOptions`, `OpenAiOptions`,
`VoyageAiOptions`, `LocalAiOptions`… — with an **identical** consumption
signature:

```
BEFORE (measured, now a guard violation):
src/components/LLMSelection/OpenAiOptions/index.jsx:11
  <label className="text-content-primary text-sm font-semibold block mb-3">
src/components/EmbeddingSelection/VoyageAiOptions/index.jsx:9
  <label className="text-content-primary text-sm font-semibold block mb-3">
```

They all render the label of a credentials form field. **One contract with 50
instances** → `field.label`. The cluster is legitimate: all 50 change together
because **they are the same thing**.

(`field.label` and not `field.label.foreground-color`: `label` permits only one
property, so the property would be redundant — §2.1 of `anatomy-property.md`.)

### ❌ Bad — a cluster that destroys information

Putting `<p>` + `content-primary` (198 uses) into one `text.foreground-color`
because "it is all text." Note that the *proposed* name is doubly illegal:
`text` is not an owner of §4.1, so `violations_grammar()` rejects it on the
first segment — replacing a banned name with an ownerless one is not a
migration. A `<p>` inside a `modal`, a `card`, and an `empty-state` represents
**three** contracts: empty-state text is intentionally weaker than modal text.
Flattening the three removes the ability to express that.

**Criterion:** the cluster is right when its members **must change together**. If
a member can legitimately diverge, it does not belong.

---

## 12. Declaring completion without proof

### ❌ Bad

- `grep` the **source** instead of the built CSS → the class may not exist.
- Treat `ds-gate` at 0 as proof of canonicalization → it measures **hardcoded hex
  values**, not `bg-theme-*` pointing to a divergent value.
- Let `--compare` pass with an **empty set** → exit 0 and nothing is proven. (I
  had written the warning about vacuity in this file’s own header and had not
  guarded against it.)
- Revert only JSON **without rebuilding** → the pixel does not change, so
  "nothing changed" proves nothing.
- Compare against the build from **BEFORE** → the new class does not yet exist.
  Tailwind emits only classes **in use**.

### ✅ Good

```bash
# 1. BEFORE and AFTER visual evidence: delegate to the configured UI-evidence adapter.
#    It owns affected-route discovery, Playwright capture, and adversarial review.

# 2. change the source and validate the target project's declared build and check
SKILL=.claude/skills/tokenize-design-system
ROOT=frontend
node "$SKILL/scripts/validate-token-build.mjs" --root "$ROOT" --build --check

# 3. assert that the new class exists in the generated CSS
node "$SKILL/scripts/validate-token-build.mjs" --root "$ROOT" \
  --css "$ROOT/<generated.css>" --class '<new-utility-class>'
```

The comparison reference must be the immediately preceding batch baseline, never
`HEAD` by default. The visual-evidence workflow must guard against empty snapshots
and divergent counts; otherwise, "0 divergences" is vacuity.

Actual result of the 3 cleanup batches: **686 → 678 variables, 0 values
changed.** That is proof.
