<!-- CANONICAL MIRROR: this bundled law must remain byte-identical to the
     target project's tokens/GRAMMAR.md whenever the skill is installed there.
     Portable scripts read this bundled copy, so a copied skill has no external
     documentation dependency. The target contract test blocks divergence. -->

# Token name grammar — naming law

> Source of the law: owner’s adversarial review in PR #193 / FBI-2708, findings
> H-019, H-021, and H-023. Direct instruction: **`semantic` and `surface` are
> token CONTEXT, not NAME. Centralize contexts.**
>
> **EXTENDED 2026-07-31 — a third word was banned: `content`.** The quotation
> above is the historical instruction and lists two words; the enforced list has
> three. The reason is in §3.1, and the executable list is
> `FORBIDDEN = ("surface", "semantic", "content")` in
> [`tools/gates/ds-naming-law.py`](../../tools/gates/ds-naming-law.py) Linha 121.

> **EXTENDED 2026-07-31 (2) — the ban covers FRAMING, not only token names.**
> The three words are whitelabels that hide the physical entity (button, modal,
> text). They may appear ONLY as *old name being eliminated* — never as the NAME
> of a family, artifact, report section, variable, or concept. The text family
> is called by its physical entity (**text / foreground**), the background
> family by **background** — never "the content family" / "the surface family".
> Every migration doc or artifact states the one-way rule up front: banned words
> are SOURCE, never TARGET. (Origin: the owner caught reports and artifacts
> baptized `content-*`, which teaches future agents to keep thinking in the
> banned vocabulary.)

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
**`entity[.variant][.anatomy][.property][.state]`**. Nothing else belongs in
it. (`entity` is the slot §4.1 still calls `owner` in code and baselines — the
same slot, named for what it is: see the note in §4.1.)
Tier, domain, and architectural layer are **metadata**: they live in one place,
and no human types them.

```
✗  semantic.color.surface.canvas      ← `semantic` is the LAYER; `surface` is the CONCEPT
✓  page.background-color              ← the consumer; the rest is metadata

✗  surface.deep                       ← "deep relative to what, exactly?"
✓  overlay.backdrop.background-color
✓  data-table.header.background-color
✓  button.primary.background-color.hover
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

## 3.1 Why `content` is prohibited as a name

> **Added 2026-07-31**, by the owner’s express decision. Numbered `3.1` and not
> `4` on purpose: §4, §5 and §7 are cited by number across this repository, and
> renumbering them would silently break those citations.

`content-*` mixes **two different axes** in one vocabulary without saying which
one is in use:

| word | axis it answers |
|---|---|
| `primary` · `secondary` · `tertiary` | **RANK** — how important is it? |
| `danger` · `success` · `info` · `placeholder` | **ROLE** — what is it for? |

`content-secondary` and `content-danger` look like siblings and are not: one
answers *"how important"*, the other *"what kind of message"*. Reading the name
you cannot tell whether the next value in the family will be a rank or a role.

And `content` on its own says neither that it is a **color** nor that it is
**text** — it could equally be a container, a slot, or a payload. It fails the
§7.2 slot test in every slot it occupies, exactly like `surface`.

**Measured debt at the moment of the ban:** 3,086 consumed classes, 90 custom
properties, and 2 paths in the DTCG source
([`tools/gates/ds-naming-law.py`](../../tools/gates/ds-naming-law.py)
Linhas 108-121). The baseline records that number so the ratchet blocks NEW use
while the migration happens.

**Worked example, measured:** `content-primary` had **1,647 uses across 26
different owners** — changing the button text changed the modal, the card and
the field. See `examples.md` §10.

## 4. CLOSED vocabulary

An agent or person classifying a token chooses **from this list**. A new owner
requires an explicit justification in the decision’s `justification` field.

> ⚠ **§4.1 is MACHINE-READ. Do not copy this list into another document.**
> `ds-naming-law.py::vocabulario_do_doc()` (Linhas 216-232) slices this file
> between the §4.1 and §4.2 headings and takes every backticked term as an
> owner — 40 owners today, verified. `score-naming.mjs::readVocabulary()` slices
> §4.1 through §4.5 the same way. A second copy of the list diverges, and when it
> diverges the code wins in silence while the copy becomes a lie. Cite this
> section; do not restate it.
>
> Two consequences of the reading rule, both measured while writing this note:
>
> 1. **Never add a backticked lowercase word inside §4.1 through §4.5** unless it
>    is a vocabulary term. Prose that needs backticks belongs above the §4.1
>    heading, as this note does.
> 2. **Never reproduce a section heading verbatim in prose.** The slicer matches
>    the heading as a plain substring and takes the FIRST hit. An earlier draft of
>    this very note quoted both headings literally; the slice then ran from the
>    note to the note, and `vocabulario_do_doc()` returned **0 owners instead of
>    40** — the closed vocabulary silently emptied, so every first segment would
>    have been reported as an unknown owner. Refer to sections by number (§4.1),
>    never by their literal heading text.

### 4.1 Owners

Shell and navigation: `page` · `sidebar` · `nav-item` · `thread-item` · `workspace-item` · `toolbar` · `logo`

Overlays: `popover` · `menu` · `modal` · `overlay` · `tooltip` · `drawer`

Controls: `button` · `field` · `select` · `checkbox` · `radio` · `toggle` · `slider` · `search`

Content: `chat-message` · `prompt` · `code-block` · `markdown` · `attachment` · `citation`

Data: `data-table` · `list-row` · `card` · `badge` · `pill` · `progress` · `chart` · `stat`

Identity and feedback: `avatar` · `banner` · `toast` · `skeleton` · `empty-state`

Global (no parent — a cross-cutting decision is an entity of its own):
`divider` · `focus-ring`

See §5.5 — the head is an entity, and a cross-cutting decision is one.

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

> **CHANGED 2026-07-31.** The bare CSS property name for text was replaced by
> `foreground-color`. Rationale, references, and the rejected abbreviation are in
> §8.2 — deliberately **not here**, because this section is machine-read and any
> backticked lowercase word placed between the §4.3 and §4.4 headings is parsed
> as a valid property.

### 4.4 Variants (only where the owner genuinely has them)

`primary` · `secondary` · `ghost` · `destructive` · `success` · `warning` · `info`

### 4.5 States

`default` · `hover` · `active` · `focus` · `disabled` · `selected` · `checked` ·
`invalid` · `on` · `off` · `loading`

An omitted state means `default`. Do **not** write `.default`.

## 5. Decision rules

### 5.5 The head of the name is an ENTITY, and globals qualify

> **OPENED 2026-08-01 — the head of the name is an ENTITY, not a possession.**
> The owner said it plainly: *"componentes globais não necessariamente têm dono.
> A especificidade do componente é que prova o owner."* He is right, and the word
> "owner" was carrying a false implication. None of the 40 entries above belongs
> to anybody — `button` **is** the head; it has no parent. Read this section as
> **the entity that owns the visual decision**, which is usually the component
> itself and sometimes a cross-cutting decision that lives in no component.
>
> What that fixes, measured: a hairline used by menu, table and modal had to be
> written three times (`menu.divider`, `data-table.divider`, `modal.divider`) —
> three tokens for ONE decision, and the ⚠ pending question "is `divider` a legal
> owner?" was the symptom. Same for the focus ring: the law forced
> `button.outline-color.focus` + `field.outline-color.focus` + … , N copies of a
> single global decision, which is why the 91 `<select>` elements missing a focus
> ring had no token to migrate to.
>
> **What stays mandatory is the head, not the list.** Removing the head outright
> would bring back exactly what §3.1 banned: `primary`, `content-primary`,
> `surface-canvas` — names that say neither what they paint nor where. The head
> must be a REAL entity you can point at on screen. Still forbidden as a head:
> a rank (`primary`), a whitelabel (`content`/`surface`/`semantic`), an
> architectural tier, a raw pigment (`pink`).
>
> A new entity is added here when a component genuinely exists and no listed
> entity is it — with the evidence (path:line of its call sites) in the same
> change. `divider` and `focus-ring` are the first two admitted under this rule.


1. **The owner comes from RENDERED CONTEXT, not from the value.** A
   `bg-surface-canvas` inside a `role="progressbar"` is
   `progress.track.background-color`, even when the hex is identical to the
   page’s. Two contracts with the same value today remain two contracts.
2. **An incompatible property means the owner is wrong, not that it is a
   synonym.** A background alias painting text (`color: theme.surface.panel`)
   does not become `x.container.foreground-color` — it becomes the text token
   that the owner already has.
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

The public name produces all three consumption forms, with none of `semantic`,
`surface` or `content` in any of them:

```
DTCG (public ID)  page.background-color
CSS               --mh-page-background-color
Tailwind          bg-page
```

> **CORRECTED 2026-07-31.** The previous version of the Tailwind line read
> `bg-page  /  text-page  /  border-page` — three utility families emitted from
> **one** token that declares `background-color`. That is the H-021 defect
> written into the law itself: `text-page` paints the TEXT with the PAGE
> BACKGROUND value. A token declares **one** property, so it is consumed by the
> **one** utility family that sets that property. Want the page's text color?
> That is a different token: `page.foreground-color`.
>
> This is now executable —
> [`ds-naming-law.py::violations_prefix_property()`](../../tools/gates/ds-naming-law.py)
> (Linhas 312-365) reprova the prefix that contradicts the property spelled in
> the name, with **baseline 0**: there is no debt to tolerate, so the first
> contradiction anyone writes fails immediately. Measured when the check landed:
> zero occurrences in real code across all four senses (text×background,
> bg×border, border×background, text×border).
>
> ⚠ **Two spellings in this block are an OPEN architecture decision, not
> settled law — do not cite them as precedent.** (a) whether the class is
> `bg-page` or `bg-page-background-color` (shadcn omits the suffix, M3 and Primer
> write it); (b) whether the CSS variable is `--mh-*` or `--color-*` (the
> Tailwind namespace `--color-*` is what generates the utilities at all).
> Registered with the price of each side in commit `4091e37`. What the guard
> already enforces **under either spelling** is the invariant above: the prefix
> may not contradict the property.

With variant, anatomy, and state:

```
DTCG   button.primary.background-color.hover
CSS    --mh-button-primary-background-color-hover
TW     hover:bg-button-primary-background-color
```

> **ORDER CORRECTED 2026-08-01 — the variant sits next to what it qualifies.**
> This block used to read `button.background-color.primary.hover`. The owner
> caught it: *"o button é secondary, e não a borda é secondary. Existirá uma
> borda específica para o button secondary, e não diversas bordas possíveis para
> todos os botões."* He is right, and three of our own lines already said so —
> §7.3 ("variant: **the owner** has real variants"), §4.4's title ("only where
> the **owner** genuinely has them") and the slot table (`variant` = "WHICH
> VERSION **of the owner**?"). Only §1 disagreed, and it was a transcription
> error: `2026-07-31-ordem-do-nome-evidencias.md` Linha 163 translated Primer's
> `--button-primary-bgColor-rest` into `button.container.background-color.primary`
> — moving the variant out of the very evidence it cited — and Linha 169 then
> declared "note what does **not** change: the order".
>
> Industry survey, 7 systems, literal tokens from the official repositories:
> **among systems that carry BOTH an owner and a property in the name, not one
> ships `owner → property → variant`. Zero out of seven.** Primer declares
> "Pattern → Variant → Property → Scale"; Material 3 writes
> `md.comp.fab.primary.container.color`; Salesforce ships
> `--sds-c-button-brand-color-background`; Fluent's rule is "Name of control (or
> control **variant**) → Element → Part → Property → State"; Spectrum's taxonomy
> starts at `{variant}`; the DTCG's own Example 13 produces the group
> `button-primary` with leaf `background`. Carbon is mixed, and its settled
> convention glues the role to the owner: `$button-primary-hover`.
>
> Every system cited for the opposite order — Polaris, Atlassian, shadcn (which
> **we** cited in the evidence dossier, Linha 141) — has **no owner in the name**,
> so there is no owner for the variant to qualify. The citation was invalid for
> this question.
>
> Two mechanical reasons, not taste:
> 1. **No lying prefix.** In `button.secondary.border-color` every prefix is a
>    thing that exists: `button`, `button.secondary` (a renderable component,
>    the value of `variant="secondary"` in JSX, what the designer draws). In
>    `button.border-color.secondary` the middle prefix `button.border-color`
>    looks like a finished token, is a plausible stopping point for autocomplete
>    and for token-by-token generation by an LLM, and often does not exist. A
>    prefix that promises a value it does not deliver is the operational
>    definition of a hallucinated token name.
> 2. **Locality of change.** The unit of design change is the variant, never the
>    property — nobody ever asked to "change every border colour of the button";
>    they ask that "the secondary button be softer". Variant-first makes that set
>    a contiguous prefix (`button.secondary.*`): one node, one diff, one review
>    unit, and the exact place where DTCG `$extends` works.

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
| `label` · `placeholder` · `helper` · `caret` | `foreground-color` | a text node has no surface of its own |
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
| no context word | **25** | it has `surface`/`semantic`/`content`/`ui`/a color name — the defect that produced `surface.*` |
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

## 8. What the guard actually enforces — added 2026-07-31

> The score in §7 is an **advisory oracle**: it grades and ranks. The guard is
> the **blocking gate**: it fails the build. When this document and
> [`tools/gates/ds-naming-law.py`](../../tools/gates/ds-naming-law.py) disagree,
> **the guard is the truth** and this document is the bug.

`python3 tools/gates/ds-naming-law.py` — ratchet mode against a per-app baseline;
`--listar` shows each violation with its location.

| check | function | what fails |
|---|---|---|
| `consumed-class` | `violations_in_source()` | a Tailwind class in `src/**/*.{jsx,tsx}` carrying `surface`, `semantic` or `content` |
| `custom-property` | `violations_in_css()` | an emitted `--*` custom property whose name carries one of the three |
| `group-in-source` | `violations_in_token_source()` | a DTCG group that would BECOME a public name with one of the three |
| `grammar-owner` | `violations_grammar()` | the FIRST segment of a consumed name is not an owner of §4.1 |
| `prefix-property` | `violations_prefix_property()` | the utility prefix contradicts the property spelled in the name |

### 8.1 The denylist alone was not enough — this is the finding that added §8

Until 2026-07-31 the guard was **only** the three-word denylist. Measured
consequence: `text-blergh-quux` passed with **exit 0**, and so did
`text-ink-primary` and `text-copy-strong`. The guard printed
*"the consumed identifier is owner.anatomy.property"* in its own failure message
and verified **none of it**.

That is also why `content-*` survived so long: the guard passed it, and the only
bad examples in this document were the two words already banned. **A denylist
catches only what someone already thought to prohibit; the next word that commits
the same sin walks in clean.**

`violations_grammar()` inverts the logic — instead of listing the forbidden, it
**requires the permitted**. `page`, `button` and `data-table` pass because they
are in §4.1; `ink`, `copy`, `content` and `blergh` fail because they are not,
with nobody having to foresee them. Tailwind's own vocabulary and raw pigments
(`transparent`, `white`, `slate`, …) are exempted by `_IGNORAR_DONO`
(Linhas 291-296) — failing those would be noise, not signal.

Reproduced against a fixture on 2026-07-31, with §4.1 yielding 40 owners:

```
consumed-class      text-content-primary          src/A.tsx:2
grammar-owner       content-primary               src/A.tsx:2
grammar-owner       blergh-quux                   src/A.tsx:3
grammar-owner       ink-primary                   src/A.tsx:5
grammar-owner       copy-strong                   src/A.tsx:5
prefix-property     text-page-background-color    prefixo pede color, nome diz background-color
```

`bg-page-background-color` and `text-page-foreground-color` in the same fixture
produced **no** finding — the law's own spellings pass.

> ✔ **DEFECT FIXED in `b7a0405` (2026-07-31) — kept as the record of a real
> failure class.** `violations_grammar()` used to read the owner as
> `nome.split("-")[0]` (first hyphen segment only), so all 8 compound owners of
> §4.1 (20% of the closed vocabulary — `chat-message`, `code-block`,
> `data-table`, `empty-state`, `list-row`, `nav-item`, `thread-item`,
> `workspace-item`) were guaranteed false positives — and since old debt is
> baselined, what the guard blocked was precisely the NEW, correct token
> (`bg-nav-item-background-color` reported as `grammar-owner`). The fix matches
> the longest vocabulary term first (`owners_por_tamanho = sorted(owners,
> key=len, reverse=True)`), the same strategy `score-naming.mjs::parseName()`
> always used. A `grammar-owner` finding on a compound owner is a REAL finding
> again.

### 8.2 Why §4.3 says `foreground-color` and not the bare CSS property name

The CSS property for text is `color`. As a **token** name it is ambiguous:
`card.color` does not say whether it is the card's text or its fill. Every
reference system disambiguates it, each in its own way — Material Design 3 uses
the anatomy (`--md-filled-button-label-text-color`), GitHub Primer coins a
property (`--button-primary-fgColor-rest`), shadcn/ui appends a role
(`--card-foreground`). We take the same decision they took, spelled out.

Abbreviating it to a two-letter form was measured and rejected — see
[`2026-07-31-ordem-do-nome-evidencias.md`](2026-07-31-ordem-do-nome-evidencias.md)
§8. Primer is the one reference that abbreviates; it is a declared exception, not
an ignored counter-example.

**This rationale lives in §8 and not in §4.3 for a measured reason.** While it
sat inside §4.3, `readVocabulary()` parsed the backticked words of the
*explanation* as members of the vocabulary: §4.3 yielded **9 properties instead
of 7**, and the two extras were the very spellings the change had just banned.
The law was still accepting `card.color` because its own footnote said the word
out loud. Same class of defect as the heading-quoting trap in the §4 note.
