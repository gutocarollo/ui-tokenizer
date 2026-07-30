# The oracle — the two scores, criterion by criterion

Why it exists: the law alone **was not enough**. It was sound, but nobody could
apply it repeatably — the result was `surface.deep`,
`button.container.background-color`, and 82 of 139 tokens failing by judgment.
Judgment does not converge; a score does.

Owner requirement: *"There must be a score for the token’s semantic quality. It
must be done for every token. Every token application must receive a score to
verify whether it fits perfectly. There must be a minimum cutoff score. When a
token is below it, it must undergo review."*

---

## 1. NAME SCORE — 100 points

Question: **"does this name carry information in every word?"**

### 1.1 Owner present and in the vocabulary — 30 points

This has the greatest weight, and it is not arbitrary: **without an owner, a
token is a paint pot.** There is no way to judge whether a NEW use is correct,
because the name promises nothing.

| name | points | why |
|---|---:|---|
| `button.background-color` | 30 | `button` is in the vocabulary |
| `content-primary` | 0 | `content` is not an owner — it is the absence of an owner |
| `surface-canvas` | 0 | same reason |
| `sidebar.item.background-color` | 30 | ✓ |

### 1.2 No context word — 25 points

Fails when any word is in `NO_SLOT`:

```js
export const NO_SLOT = {
  tier:         ["semantic","primitive","component","role","foundation","token","theme"],
  location:     ["surface","layer","level","deep","raised","elevated","sunken",
                 "canvas","panel","background","foreground","front","back"],
  pigment:      ["pink","grey","gray","green","red","blue","yellow","purple",
                 "cyan","orange","white","black","static"],
  generic:      ["ui","misc","other","default","generic","base","main","alt","custom"],
};
```

⚠ `background` appears in `location` because `surface-background` is a
location. **`background-color` as a whole property is legitimate** — validation
is by segment, and `background-color` is a single segment.

### 1.3 No redundant word — 15 points

Word-by-word removal test:

```js
for (const w of words) {
  const withoutWord = words.filter(x => x !== w).join("-");
  if (allNames.has(withoutWord)) continue; // would collide → the word INFORMS
  if (IMPLIED_PROPERTY[base] === w) return "redundant";  // derivable
}
```

```js
export const IMPLIED_PROPERTY = {
  label: "color", placeholder: "color", helper: "color",
  caret: "color", backdrop: "background-color", divider: "border-color",
};
```

### 1.4 Coherent anatomy × property pair — 10 points

See `anatomy-property.md` for the complete matrix. It fails on internal
contradictions: `label` + `background-color`, `track` + `color`, or `divider` +
`background-color`.

### 1.5 State with a default pair — 10 points

`x.y.hover` requires that `x.y` exist. Hover without a base is zero delta.

### 1.6 No segment outside the law — 10 points

An abbreviation or an unlisted word. **This criterion was born from a hole in
the oracle itself:** v1 gave `prompt-bg` **100/100**, with `REMAINDER=bg` in the
diagnostic — it diagnosed the leftover and did not deduct points for it.

---

## 2. APPLICATION SCORE — 100 points, per USE

Different question: *"DOES THIS use fit what the name promises?"* A 100/100
name applied in the wrong place remains a defect.

### 2.1 Declared property × actual prefix — 60 points

| name declares | actual class | points |
|---|---|---:|
| `background-color` | `bg-` | 60 |
| `color` | `text-` | 60 |
| `border-color` | `border-` | 60 |
| `background-color` | `text-` | **0** — the name lies |

```js
export const PREFIX_PROPERTY = {
  "bg": "background-color", "text": "color", "border": "border-color",
  "outline": "outline-color", "fill": "fill", "stroke": "stroke",
  "shadow": "box-shadow", "divide": "border-color",
  "ring": "outline-color", "caret": "color", "placeholder": "color",
  "accent": "color",
};
```

### 2.2 Declared state × state prefix — 25 points

`hover:bg-x` requires `.hover` in the name; `bg-x.hover` without `hover:` in the
class also fails. The rule is symmetrical in both directions.

⚠ A `hover:bg-x` class appears in capture **without any active hover**, because
`className` is always in the DOM. This is correct: the score measures the
**declared contract**, not the pixel at that moment.

### 2.3 Declared owner × component — 15 points

This is a heuristic, so it has the lowest weight: legitimate reuse exists.
`modal.*` inside a `Drawer` can be correct. A partial score signals "worth
reading," not "wrong."

### 2.4 NOT EVALUABLE

A name that declares **neither** owner **nor** property has no fit to measure.

```js
if (!hasOwner && !hasProperty) return { score: null, evaluable: false };
```

⚠ **V1 failed 97% of applications** because it penalized an absent owner **two
times**: −30 in the NAME score and −15 in the APPLICATION score, per use. An
average calculated over a broken name does not measure an application; it
measures the name again. The defect has only one owner.

---

## 3. Cutoff

```js
export const CUTOFF = 70;
```

Below it → **mandatory review**; do not apply the token.

The number is **arbitrary by definition**; the score is not. The gain is that
changing system rigor is **one auditable line** instead of reconsideration per
token.

---

## 4. Run

```bash
SKILL=.claude/skills/tokenize-design-system
ROOT=frontend

node "$SKILL/scripts/score-naming.mjs" --root "$ROOT"                 # both scores + review queue
node "$SKILL/scripts/score-naming.mjs" --root "$ROOT" --names         # Markdown-readable name scores
node "$SKILL/scripts/score-naming.mjs" --root "$ROOT" --applications  # application scores
node "$SKILL/scripts/score-naming.mjs" --root "$ROOT" --review        # items below the cutoff only
node "$SKILL/scripts/find-owner.mjs" --root "$ROOT" --json            # evidence chain per use
node "$SKILL/scripts/derive-tokens.mjs" --root "$ROOT" --dtcg         # DTCG-ready JSON fragment
```

---

## 5. Example measured state

| metric | value |
|---|---:|
| names evaluated | target-specific |
| NAME average | target-specific |
| names ≥ cutoff | target-specific |
| names under review | target-specific |
| evaluable applications | target-specific |
| APPLICATION average | target-specific |
| **NOT EVALUABLE** uses | target-specific |

**The important reading:** a high non-evaluable count does not prove that token
uses are wrong. It shows that names fail to promise enough for an application
fit to be measured. Fixing naming is upstream of application scoring.
