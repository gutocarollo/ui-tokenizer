# The oracle — the three measurements, criterion by criterion

Two scores judge a token: **NAME** (§1) and **APPLICATION** (§2). A third
measurement, the **DISPOSITION partition** (§4), answers a different question —
not "is this token good?" but "what instrument disposes of this class use?".
All three are executable; none of them stores a number in this document.

Why the oracle exists: the law alone **was not enough**. It was sound, but nobody
could apply it repeatably — the result was `surface.deep`,
`button.container.background-color`, and 82 of 139 tokens failing by judgment
(the numbered verdict is `docs/case-study/2026-07-29-veredito-naming-tokens.md`:
40 adequate / 82 inadequate / 17 pending). Judgment does not converge; a score
does.

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
  generic:      ["ui","misc","other","default","generic","base","main","alt","custom","content"],
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
  label: "foreground-color", placeholder: "foreground-color", helper: "foreground-color",
  caret: "foreground-color", backdrop: "background-color", divider: "border-color",
};
```

### 1.4 Coherent anatomy × property pair — 10 points

See `anatomy-property.md` for the complete matrix. It fails on internal
contradictions: `label` + `background-color`, `track` + `foreground-color`, or `divider` +
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

The table lives in `scripts/lib/utility-families.mjs` and is re-exported by
`score-naming.mjs` as `PREFIX_PROPERTY`. It holds **53 prefixes in four
families** since F-E — `paint` 12, `radius` 15, `spacing` 23, `typography` 3.
Reproduce the partition instead of trusting this paragraph:

```bash
node -e 'import("./scripts/lib/utility-families.mjs").then(m=>{
  const byFamily={}; for (const p of Object.keys(m.PREFIX_PROPERTY))
    (byFamily[m.PREFIX_FAMILY[p]] ??= []).push(p);
  console.log(Object.keys(m.PREFIX_PROPERTY).length,
    Object.entries(byFamily).map(([f,k])=>`${f}=${k.length}`).join(" "));
})'
```

```js
// paint — the family §4.3 was written for (but see the warning below)
bg background-color · text color · border border-color · outline outline-color
ring outline-color · divide border-color · shadow box-shadow · fill fill
stroke stroke · caret color · placeholder color · accent color

// radius · spacing · typography — §4.3 has NO slot (see 2.2)
rounded[-t|-r|-b|-l|-s|-e|-tl|-tr|-br|-bl|-ss|-se|-ee|-es]  border-radius
p[x|y|t|r|b|l|s|e]  padding      m[x|y|t|r|b|l|s|e]  margin
gap · gap-x · gap-y · space-x · space-y                     gap/margin
font  font-weight   leading  line-height   tracking  letter-spacing
```

The alternation built from these keys must be **longest-first**
(`prefixAlternation()`): first-match-wins would hand `t-card` to the token
capture out of `rounded-t-card`, the same shape as `p` swallowing `px`.

### 2.2 LAW GAP — the oracle sees more than the law can name

§4.3 is a closed vocabulary of **seven properties, all paint**. There is no slot
for `border-radius`, `padding`, `margin`, `gap`, `line-height` or
`letter-spacing`. The count of prefixes left without a slot is **not stored
here** — it is a function of §4.3 and of `PREFIX_PROPERTY`, and both move:

```bash
node "$SKILL/scripts/score-naming.mjs" --root "$ROOT"   # "N of 53 prefixes have no slot"
```

⚠ **Live divergence, measured 2026-07-31.** §4.3 renamed the text property from
the bare CSS name to `foreground-color`, and `scripts/lib/utility-families.mjs`
still maps `text`, `caret`, `placeholder` and `accent` to the old name. The
consequence is visible in the line above: the unlawed count went from 41 to 45,
and `text-*` — the paint utility the law exists to govern — became LAW GAP. Until
the two agree, do not read a paint-family LAW GAP as a statement about the target;
it is a statement about this disagreement. The §2.1 table still shows the
executable's mapping, on purpose: it documents what the script does, not what the
law now says it should do.

A use in one of those families is therefore **NOT SCOREABLE**, and it fails
closed — it is neither awarded the 60 (which would let every spacing use pass
without a property check) nor failed on it (which would report H-021 against a
slot that was never available). It is counted in a declared `LAW GAP` bucket,
and `deriveProperty`/`deriveName` refuse to emit a name whose property segment
`parseName` could never parse back. Amending §4.3 is a decision about the law;
the script states the gap instead of taking it.

### 2.3 Declared state × state prefix — 25 points

`hover:bg-x` requires `.hover` in the name; `bg-x.hover` without `hover:` in the
class also fails. The rule is symmetrical in both directions.

⚠ A `hover:bg-x` class appears in capture **without any active hover**, because
`className` is always in the DOM. This is correct: the score measures the
**declared contract**, not the pixel at that moment.

### 2.4 Declared owner × component — 15 points

This is a heuristic, so it has the lowest weight: legitimate reuse exists.
`modal.*` inside a `Drawer` can be correct. A partial score signals "worth
reading," not "wrong."

### 2.5 NOT EVALUABLE

A name that declares **neither** owner **nor** property has no fit to measure.

```js
if (!hasOwner && !hasProperty) return { score: null, evaluable: false };
```

⚠ **V1 failed 97% of applications** because it penalized an absent owner **two
times**: −30 in the NAME score and −15 in the APPLICATION score, per use. An
average calculated over a broken name does not measure an application; it
measures the name again. The defect has only one owner.

That 97% is a **historical** measurement of v1, recorded in `docs/law/GRAMMAR.md`
§7.5 as *3,686 of 3,837 uses*. It cannot be reproduced from this tree — v1 no
longer runs here. What reproduces is the population it describes, which v2 now
reports as a separate bucket instead of as failures:

```bash
node "$SKILL/scripts/score-naming.mjs" --root "$ROOT"   # NOT EVALUABLE / APPLICATIONS lines
```

If that ratio is still near 1, naming is the bottleneck, not application fit.

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

## 4. The DISPOSITION partition — 7 instruments, `measure-disposition.mjs`

The two scores above judge a token that already exists. Most class uses in a
handmade frontend have **no** token, and asking "what score does it get?" is the
wrong question — the right one is **"which instrument disposes of it?"**. That is
a third executable oracle, and it is a *partition*: every use falls into exactly
one instrument, and the sum must equal the universe or the script exits nonzero.

**The order is load-bearing.** Each use falls into the **first** instrument that
covers it, so reading them out of order changes the answer:

| # | instrument | criterion | vehicle |
|---:|---|---|---|
| 1 | `entidadeExata` | bundle repeated ≥ `--min-repeat` (2) with ≥ `--min-classes` (4) classes | exported `const` |
| 2 | `entidadeComposicao` | non-entity bundle that *contains* an entity | `cn(NUCLEO, extras)` |
| 3 | `tokenizavelFamilia` | class in a tokenizable family (colour, spacing, radius, typography) outside an entity | token |
| 4 | `contratoExistente` | `.class` selector authored in the target's own CSS, **plus** a utility the compiler generates from an app token | already under contract |
| 5 | `arbitraryDimensao` | repeated arbitrary value `[...]` | dimension token |
| 6 | `vocabularioLayout` | cumulative allowlist up to 95% of the residue | one versioned document + ratchet |
| 7 | `excecaoItemAItem` | what is left after the 95% cut | listed item by item |

Three fail-closed guards, all measured, none of them advisory:

- **the sum must equal the universe.** `soma !== total` → exit 1. A partition
  that does not close is an oracle lying.
- **an empty denominator is not a result.** Zero class uses → exit 2, with the
  unresolved identifiers named. A target whose call sites migrated to
  `className={NAME}` without the `const` resolving would otherwise report a
  partition of seven zeros that "sums to 100%".
- **instrument 7 is recounted from its own list.** A number that cannot be
  listed item by item is a label, not a disposition.

Instrument 4 has a **declared degradation**: without the target's built CSS, only
hand-authored `.class` selectors count, so 4 is a **floor** and 6 is a **ceiling**.
The script says so on stdout and in `cssBuildado.estrato4Subestimado`; `--require-built-css`
turns that degradation into exit 4 for CI.

```bash
node "$SKILL/scripts/measure-disposition.mjs" --root "$ROOT"
node "$SKILL/scripts/measure-disposition.mjs" --root "$ROOT" --json
node "$SKILL/scripts/measure-disposition.mjs" --root "$ROOT" --require-built-css
```

`measure-disposition` and `measure-coverage` share one census
(`scripts/lib/bundle-census.mjs`) and one entity criterion. They are two views of
the same measurement, not two measurements to reconcile — enforced by
`scripts/test/oracle-reconciliation.test.mjs`.

---

## 5. Run

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

## 6. Measured state — where each number comes from

This document stores **no** measured value on purpose: every one of them is a
function of the target and of the current worktree, and a number frozen in prose
is a number that goes stale without anybody noticing. Each row below names the
command that prints it.

| metric | printed by |
|---|---|
| names evaluated · NAME average · names ≥ cutoff · names under review | `score-naming.mjs --root "$ROOT"`, line `NAMES` |
| evaluable applications · APPLICATION average | same run, line `APPLICATIONS` |
| **NOT EVALUABLE** uses | same run, line `NOT EVALUABLE` |
| **LAW GAP** uses (§2.2) | same run, line `LAW GAP` |
| the 7 dispositions and their sum (§4) | `measure-disposition.mjs --root "$ROOT"` |
| occurrences → clusters → contracts (§5) | `tokenize.mjs --root "$ROOT"` |

Two conditions must be declared with any number taken from these commands, or it
is not reproducible by whoever reads it later:

1. the `--root` used — for a repository whose app lives in a subdirectory, the
   root is that subdirectory, and pointing at the repository root makes
   `tokenize.mjs` stop in PREFLIGHT for a missing `tokens/color.tokens.json`;
2. whether the target worktree was clean. These scans read the working tree, not
   `HEAD`, so a dirty target yields numbers that no commit can reproduce.

**The important reading:** a high NOT EVALUABLE count does not prove that token
uses are wrong. It shows that names fail to promise enough for an application
fit to be measured. Fixing naming is upstream of application scoring.
