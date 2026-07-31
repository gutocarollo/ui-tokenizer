<!-- CANONICAL MIRROR: this bundled law must remain byte-identical to the
     target project's tokens/GRAMMAR.md whenever the skill is installed there.
     Portable scripts read this bundled copy, so a copied skill has no external
     documentation dependency. The target contract test blocks divergence. -->

# Token name grammar — naming law

> Source of the law: owner’s adversarial review in PR #193 / FBI-2708, findings
> H-019, H-021, and H-023. Direct instruction: **`semantic` and `surface` are
> token CONTEXT, not NAME. Centralize contexts.**

> **De onde vem esta ordem — e de onde NÃO vem.** O DTCG é agnóstico quanto a
> naming: *"Groups are arbitrary and tools SHOULD NOT use them to infer the type
> or purpose of design tokens."* Citá-lo para justificar ordem de segmentos é
> citação indevida. A ordem `owner → anatomy → property` vem de três sistemas
> que a declaram e a praticam — Material Design 3
> (`--md-filled-button-label-text-color`), GitHub Primer
> (`--button-primary-fgColor-rest`) e shadcn/ui (`--primary-foreground`).
> Evidência com citação literal e link em
> [`2026-07-31-ordem-do-nome-evidencias.md`](2026-07-31-ordem-do-nome-evidencias.md).

## 1. The law in one sentence

The identifier consumed by code is
**`owner.anatomy.property[.variant][.state]`**. Nothing else belongs in it.
Tier, domain, and architectural layer are **metadata**: they live in one place,
and no human types them.

```
✗  semantic.color.surface.canvas      ← `semantic` is the LAYER; `surface` is the CONCEPT
✓  page.background-color              ← the consumer; the rest is metadata

✗  surface.deep                       ← "deep relative to what, exactly?"
✓  overlay.backdrop.background-color
✓  data-table.header.background-color
✓  button.background-color.primary.hover
```

## 2. Why `surface` is prohibited as a name

Measured in this repository, `surface.*` was used by incompatible owners and
properties — exactly review finding H-021:

| measured real use | what the name promised |
|---|---|
| `surface.panel` painting **text** | a panel |
| `surface.panel` painting a **border** | a panel |
| `surface.canvas` as a **progress track** | the page background |
| `surface.canvas` as an **off toggle** | the page background |
| `surface.deep` in a backdrop, table, **and** button | a deep surface |

These owners share no role. By accident and for now, they share a hex value. On
the day a modal backdrop needs a darker value than a table background, the two
will be tied to the same token.

`surface.deep` carries exactly the information carried by `layer5` — none — while
wearing a semantic costume.

## 3. Why `semantic` is prohibited as a name

In the template, `semantic` named an **architectural layer** (a tier). It
described the design; it was not meant to be typed. Stamping it into an
identifier is like reading a diagram that says "layer: database" and naming every
table `database_customers`.

The tier remains alive as metadata:

```json
{ "tier": "role", "domain": "color", "owner": "page", "property": "background-color" }
```

## 4. CLOSED vocabulary

An agent or person classifying a token chooses **from this list**. A new owner
requires an explicit justification in the decision’s `justification` field.

### 4.1 Owners

Shell and navigation: `page` · `sidebar` · `nav-item` · `thread-item` · `workspace-item` · `toolbar` · `logo`

Overlays: `popover` · `menu` · `modal` · `overlay` · `tooltip` · `drawer`

Controls: `button` · `field` · `select` · `checkbox` · `radio` · `toggle` · `slider` · `search`

Content: `chat-message` · `prompt` · `code-block` · `markdown` · `attachment` · `citation`

Data: `data-table` · `list-row` · `card` · `badge` · `pill` · `progress` · `chart` · `stat`

Identity and feedback: `avatar` · `banner` · `toast` · `skeleton` · `empty-state`

### 4.2 Anatomy

`container` · `label` · `icon` · `track` · `thumb` · `indicator` · `header` ·
`row` · `cell` · `backdrop` · `divider` · `caret` · `placeholder` · `helper` ·
`prefix` · `suffix` · `handle`

**Write anatomy only when the owner has MORE THAN ONE addressable part.** An
owner with no parts writes `owner.property` — the empty slot already means
"the owner itself."

> ⚠ **CORRECTED on 2026-07-29.** The previous version of this line said the
> opposite: *"An owner with no distinguishable parts uses `container`."* That
> contradicts §1, which writes `page.background-color` **without** anatomy, and
> produced 33 tokens with redundant `container`. Measurement: after removing
> `container` from all 33, **0 collide** with an existing name — so the word
> disambiguates nothing (`node "$SKILL/scripts/score-naming.mjs" --root "$ROOT" --names`).

### 4.3 Properties

`background-color` · `foreground-color` · `border-color` · `outline-color` ·
`box-shadow` · `fill` · `stroke`

> **CHANGED 2026-07-31: `color` → `foreground-color`.** The CSS property is
> `color`, but as a *token* name it is ambiguous: `card.color` does not say
> whether it is the card's text or its fill. Every reference system disambiguates
> this, each in its own way — Material Design 3 uses the anatomy
> (`--md-filled-button-label-text-color`), GitHub Primer coins a property
> (`--button-primary-fgColor-rest`), shadcn/ui appends a role
> (`--card-foreground`). We take the same decision they took, spelled out:
> `foreground-color`.
>
> Abbreviating it to `fg` was measured and rejected — see
> [`2026-07-31-ordem-do-nome-evidencias.md`](2026-07-31-ordem-do-nome-evidencias.md)
> §8. Primer is the one reference that abbreviates; it is a declared exception,
> not an ignored counter-example.

### 4.4 Variants (only where the owner genuinely has them)

`primary` · `secondary` · `ghost` · `destructive` · `success` · `warning` · `info`

### 4.5 States

`default` · `hover` · `active` · `focus` · `disabled` · `selected` · `checked` ·
`invalid` · `on` · `off` · `loading`

An omitted state means `default`. Do **not** write `.default`.

## 5. Decision rules

1. **The owner comes from RENDERED CONTEXT, not from the value.** A
   `bg-surface-canvas` inside a `role="progressbar"` is
   `progress.track.background-color`, even when the hex is identical to the
   page’s. Two contracts with the same value today remain two contracts.
2. **An incompatible property means the owner is wrong, not that it is a
   synonym.** A background alias painting text (`color: theme.surface.panel`)
   does not become `x.container.color` — it becomes the text token that the
   owner already has.
3. **Repetition is evidence, not a verdict.** Thirty uses of the same pair do
   not prove that all thirty have the same role; they prove that all thirty are
   worth inspecting.
4. **A state exists only if the pair exists.** A
   `button.background-color.hover` without the corresponding base token is
   hover without a base — the zero-delta defect already seen here.
5. **Ambiguity does not become a guess.** Mark `decision: "PENDING"` with the
   reason. An empty `{}` called a completed classification was review finding
H-020; an honest PENDING classification is not.

## 6. Emission

The public name produces all three consumption forms, with neither `semantic`
nor `surface` in any of them:

```
DTCG (public ID)  page.background-color
CSS               --mh-page-background-color
Tailwind          bg-page          /  text-page  /  border-page
```

With anatomy, variant, and state:

```
DTCG   button.background-color.primary.hover
CSS    --mh-button-background-color-primary-hover
TW     hover:bg-button-primary
```

## 7. Deterministic semantic-quality score

> Origin: owner instruction on 2026-07-29. The law was sound, but nobody could
> apply it repeatably — the result was `surface.deep`,
> `button.container.background-color`, and 82 of 139 tokens failing by judgment.
> **What was missing was not a rule; it was an oracle.**

**Executable oracle:** `node "$SKILL/scripts/score-naming.mjs" --root "$ROOT"`

### 7.1 The principle is mechanical

> A word has semantic value **if and only if removing it loses information.**

This can be tested without opinion through three paths:

| test | question | mechanical? |
|---|---|---|
| **collision** | once the word is removed, does the name match another existing token? | yes — `Set.has` |
| **derivability** | is the word derivable from another word in the same name? | yes — table §7.2 |
| **slot question** | does the word answer the question asked by its slot? | yes — §7.3 |

### 7.2 The question for each slot

| slot | question it answers |
|---|---|
| `owner` | **WHOSE** color is this? |
| `anatomy` | **WHICH PART** of the owner? |
| `property` | **WHAT** does it paint? |
| `variant` | **WHICH VERSION** of the owner? |
| `state` | **WHEN?** |

`surface` answers *"where in the stack?"* — a question that **no slot asks**.
That is why it fails in every slot it occupies. `container` answers *"which
part?"* with "the part that is the whole," which is the **absence** of a part —
and the empty slot already conveys that.

**Derivability — anatomy that permits only one property:**

| anatomy | only possible property | therefore, writing the property is noise |
|---|---|---|
| `label` · `placeholder` · `helper` · `caret` | `color` | a text node has no surface of its own |
| `backdrop` | `background-color` | |
| `divider` | `border-color` | |

Therefore, `button.label.background-color` **is not a valid pair** — it is an
owner error. If something paints behind text, that something is the owner’s
container.

### 7.3 CARE / DON'T CARE by column

| column | CARE when | DON'T CARE when |
|---|---|---|
| **owner** | **always** | never — it is the only column that says whose color this is |
| **anatomy** | the owner has >1 addressable part | the owner has no parts |
| **property** | the anatomy permits >1 property | the anatomy determines the property (§7.2) |
| **variant** | the owner has real variants | most owners do not |
| **state** | the `default` pair exists (§5.4) | it is the default — so **do not write it** |

### 7.4 NAME SCORE — 100 points

| criterion | points | fails when |
|---|---:|---|
| owner present and in the vocabulary | **30** | without an owner, a token is a paint pot: no new use can be judged |
| no context word | **25** | it has `surface`/`semantic`/`ui`/a color name — the defect that produced `surface.*` |
| no redundant word | **15** | a word passes the removal test without losing information |
| coherent anatomy × property pair | **10** | internal contradiction (`label` + `background-color`) |
| state with a `default` pair | **10** | hover without a base — the zero-delta defect |
| no segment outside the law | **10** | an abbreviation or unlisted word remains after the grammar slots are parsed |

### 7.5 APPLICATION SCORE — 100 points, per USE

Different question: **"DOES THIS use fit what the name promises?"** A
100-point name applied in the wrong place remains a defect — that is H-021.

| criterion | points | fails when |
|---|---:|---|
| declared property × actual prefix | **60** | the name promises `background-color` and the class is `text-` |
| declared state × state prefix | **25** | `hover:` without `.hover` in the name, or vice versa |
| declared owner × rendering component | **15** | declared heuristic: legitimate reuse exists, so it earns half score and requires reading |

**NOT EVALUABLE** — a name that declares neither owner **nor** property has no
fit to measure; the defect is in the NAME score. Penalizing it here would count
the same defect twice, which was the v1 error in this oracle: it failed 97% of
applications because 3,686 of 3,837 uses fell into that case.

### 7.6 Cutoff and review

**Cutoff: 70/100.** Below it, the token enters **mandatory review**.

The number is arbitrary by definition — the score is **not**. Changing the
cutoff is an auditable line in `score-naming.mjs` (`export const CUTOFF`) instead
of a discussion per token.

```bash
SKILL=.claude/skills/tokenize-design-system
ROOT=frontend
node "$SKILL/scripts/score-naming.mjs" --root "$ROOT"             # both scores, summary
node "$SKILL/scripts/score-naming.mjs" --root "$ROOT" --names     # every name, criterion by criterion
node "$SKILL/scripts/score-naming.mjs" --root "$ROOT" --applications # every use below the cutoff
node "$SKILL/scripts/score-naming.mjs" --root "$ROOT" --review    # only items that require review
```
