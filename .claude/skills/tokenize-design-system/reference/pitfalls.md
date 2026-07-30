# The pitfalls — 12 measured errors, with symptoms and fixes

Each item is a measured failure mode from reference work. The order reflects
how often each one recurred; verify its relevance in the target repository.

---

## 1. Measuring consumption through ONE path (4 occurrences — the most recurrent)

**Symptom:** a token appears orphaned and you almost delete it.

There are **three** consumption paths, and counting only two produces zero for a
live token:

| path | how it appears |
|---|---|
| Tailwind class | `bg-x` in JSX |
| custom property | `var(--color-x)` in CSS **and in a JS prop** |
| JSON alias | another token with `$value: "{...x}"` |

**What happened:** I nearly deleted `raised`, `deep`, and `emphasis` by counting
only class + alias. All three were consumed through `var()`. It recurred **four
times**.

**Fix:**
```bash
rg "bg-$T|text-$T|border-$T" src/             # class
rg -- "--color-$T" src/ --type css --type js  # var(), including JS
rg "\{[^}]*\.$T\}" tokens/*.json            # alias
```

---

## 2. `$root` treated as metadata (the sibling of no. 1)

**Symptom:** token scanning skips 15 of them; the total is wrong (70 instead of
**85**).

```js
for (const k of Object.keys(node)) {
if (k.startsWith("$")) continue;   // ❌ skips $root, which IS A TOKEN
}
```

`$root` is a **token** in DTCG 2025.10, not metadata. `$value`, `$type`, and
`$description` are metadata. The `$` prefix is not the criterion.

**Fix:** `if (k.startsWith("$") && k !== "$root") continue;`

**Actual consequence:** I had declared *"coupling removed"* — and that was
**FALSE** until this was fixed.

---

## 3. Matching by substring instead of whole word

**Symptom:** an implausibly popular owner: `select` with 418 uses in an app with
almost no `<select>` elements.

`"EmbeddingSelection".includes("select")` → **true**. **262 of 418** matches came from that false positive.

**Fix:** split camelCase into words and require a **sequence**:
```js
const words = ident.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .replace(/[^A-Za-z0-9]+/g, " ").toLowerCase().trim().split(/\s+/);
```

---

## 4. Structural directory becoming an owner

**Symptom:** owner `page` with 38 uses, **34** of which come from files that
simply live in a route directory.

**Fix:** exclude `src` `pages` `components` `ui` `lib` `hooks` `utils` `models`
`styles` `assets` `shared` `common` `index` `app` `views` before inspecting the
directory.

---

## 5. Matching a token by pixel VALUE

**Symptom:** a report with 531 occurrences, of which **two** are real
consumption — 99.6% noise. White text was marked as both `raised` **and**
`inset-inverse`, because both equal `#FFFFFF` in one theme.

The owner said: *"I did not understand what this actually is because there is no
color there at all."* They were right.

**Fix:** read the token from `className`, never from the pixel. Value matching is
a guaranteed false positive when two tokens share a value — and sharing values is
the **common** case.

---

## 6. Unknown class emits zero CSS, without an error

**Symptom:** none. Total silence. The screen is unstyled and the build passes.

Real cases that caused rework: `border-hairline`, `duration-control`,
`bg-pink-lighter/16`, `shadow-[...]` with a comma and `/alpha`, `hover:light:`
with reversed order, and literal quotes inside a template literal.

**Fix:** use `validate-token-build.mjs` to build and check the target project,
then assert the new utility in the **BUILT CSS**, never in the source.
```bash
SKILL=.claude/skills/tokenize-design-system
ROOT=frontend
node "$SKILL/scripts/validate-token-build.mjs" --root "$ROOT" --build --check
node "$SKILL/scripts/validate-token-build.mjs" --root "$ROOT" \
  --css "$ROOT/<generated.css>" --class '<new-utility-class>'
```
Grep 0 **before** a consumer exists is normal. Grep 0 **with** a consumer is a
bug.

---

## 7. Writing the token in the wrong tier

**Symptom:** a **silent no-op.** The emitter does not complain and the class does
not exist.

Color for a specific place belongs in `component.<theme>.<owner>`. Nothing is
emitted from `semantic`. I lost three attempts before understanding that silence
**was** the symptom.

---

## 8. Running only the first emitter

**Symptom:** the variable exists, but the class does not. The Tailwind bridge did
not update.

**Fix:** use `validate-token-build.mjs` with `--build --check`, not a standalone
emitter. The adapter discovers the target project’s declared build and check
scripts.

---

## 9. Proving against the build from BEFORE

**Symptom:** "the class does not appear" — and of course it does not: **Tailwind
emits only classes in use.** The new class did not yet have a consumer.

Variant of the same error: revert only the JSON **without rebuilding** and
conclude that "nothing changed." The pixel does not change because the CSS was
not regenerated. And `HEAD` is before the **session**, not before the **batch**
— comparing against it measures the wrong thing.

**Fix:** run the generated-artifact and class-emission checks **after the build**,
and use the snapshot immediately before the change as the reference, not `HEAD`.
Delegate rendered before/after visual evidence to the configured UI-evidence adapter;
this skill does not own Playwright capture scripts.

---

## 10. Comparing empty sets (vacuity)

**Symptom:** `--compare` exits with **code 0**, reports "0 divergences", and
nothing was proven.

I had written the warning about vacuity **in this file’s own header** and had not
guarded against it.

**Fix — two mandatory guards:**
```js
if (!Object.keys(after).length) { console.error("EMPTY snapshot"); process.exit(1); }
if (namesBefore.size !== namesAfter.size) { console.error("count diverged"); process.exit(1); }
```

---

## 11. Confusing a green gate with canonicalization

**Symptom:** `ds-gate` at 0 interpreted as "it is tokenized."

`ds-gate` measures **hardcoded hex values**. It **does not see** `bg-theme-*`
pointing to a divergent value. It counts hex values **even inside comments**, and
only detects `gray-*` — not `slate`/`zinc`/`neutral`/`stone`.

In the same category: zeroing only the ratchet’s `consumed-class` layer
**conceals** the issue — the wrong token continues to be **created** in the
source. That is why there are 3 separate layers (`consumed-class`,
`custom-property`, `group-in-source`), and the important one is the **source**.

**Fix:** state what the gate measures alongside the result. "ds-gate 0" means
"no hardcoded hex values," nothing more.

---

## 12. Renaming with regex without running it

**Symptom:** the script breaks at runtime; sometimes it stays silent and does the
wrong thing.

Twice in the same session: `voc`→`vocabulary` **collided with an existing
`vocabulary()` function**; `grupos`→`groups` renamed **only the declaration**.
Both were caught by **RUNNING** the script, not by reading the diff.

**Fix:** every mechanical rename ends by executing the artifact. A clean diff is
not proof that it runs.

---

## 13. Mixing languages anywhere in the workflow

The owner said: *"It is completely wrong to mix Portuguese terms with English.
It is English, period."*

**Everything owned by this workflow is English**: filenames, identifiers,
functions, object keys, JSON keys, enum values, CLI output, documentation,
comments, reports, schemas, and generated artifacts. Target-product strings in
another language may be observed as source data, but the workflow must label
and report them in English.

The invariant applies even to examples inside comments. A quoted historical
bad example may retain its original spelling only when the surrounding text
explicitly identifies it as input evidence rather than workflow vocabulary.
