# The pitfalls — 18 measured errors, with symptoms and fixes

Each item is a measured failure mode from reference work. The order reflects
how often each one recurred; verify its relevance in the target repository.

Items 1–13 are token and build failures. Items 14–18 belong to the rendered
evidence pipeline; the protocol they defend is in
[`visual-evidence.md`](visual-evidence.md) and its file inventory in
[`visual-evidence-engine.md`](visual-evidence-engine.md).

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

> ⛔ **VOCABULARIO SUPERADO.** `content`/`surface`/`semantic` sao palavras BANIDAS desde 2026-07-31. Os nomes abaixo sao MEDICAO da epoca, nunca alvo.

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

---

## 14. Two different values are called `fixtureRegistryFingerprint`

**Symptom:** `verify-contract-source-delta.mjs` returns `PASS`, the waiver is
declared, and the comparator still throws
`Binding exception evidence does not prove this exact mismatch`. The sha256 you
pasted was real — it was just the other one.

There are **two** distinct hashes under that name, and neither is derived from
the other by copying:

| where it lives | how it is computed |
|---|---|
| **registry** — `contexts.json`, `scenarios.json` | `tests/visual/visual-registry.mjs` `Linha 559`: sha256 of the checked-in fixture registry + `NETWORK_FIXTURE_REGISTRY_FINGERPRINT` + the effective contexts. Written out by `scripts/gen-visual-routes.mjs` `Linha 75` and `Linha 97`. |
| **manifest** — the evidence binding | `scripts/lib/evidence-matrix.mjs` `Linha 424` calls `fixtureRegistryBindingFingerprint` (`Linha 53`), which hashes the registry value **as one input** (`declared`) together with `networkFixtureFileFingerprint`, `contractSourceFingerprint`, and projections of contexts and scenarios. |

The manifest value is the one the comparator compares (`visual-contract.mjs`
`Linha 1257`, `Linha 1259`–`Linha 1265`) and therefore the only one that may be
passed to `--field-before` / `--field-after`.

The consequence of the nesting is the part that surprises people:
`contractSourceFingerprint` is the sha256 of the **files** listed in
`contractSources` (`evidence-matrix.mjs` `Linha 91`–`Linha 113`). So a codemod
that only rewrites `className` inside one of those files moves the manifest hash
while the registry hash — and every recorded network response — stays put.

**Fix:** read both sha256 values out of `.claude/evidence/<label>/manifest.json`,
never out of `contexts.json` or `scenarios.json`.
```bash
node -e 'const m=n=>JSON.parse(require("fs").readFileSync(n,"utf8")).fixtureRegistryFingerprint;
console.log(m(process.argv[1]), m(process.argv[2]))' \
  .claude/evidence/<before>/manifest.json .claude/evidence/<after>/manifest.json
```

---

## 15. `| tail -40` deletes the reason the run failed

**Symptom:** `ui-evidence: Playwright exited with code 1`, and nothing above it
says why. With a 40-test matrix the tail is entirely the test list, so the actual
error — a failed witness assertion, an HTTP 500, a missing fixture — has already
scrolled out.

`scripts/ui-evidence.sh` `Linha 190`–`Linha 191` pipes the whole Playwright run
through `tail -40`. `PIPESTATUS[0]` preserves the exit code (`Linha 192`), so the
run correctly fails closed — only the diagnosis is gone.

**Fix:** do not re-run blind. The failed staging directory is retained
(`Linha 120`–`Linha 129`), and the HTML reporter wrote a full report
(`playwright.visual.config.ts` `Linha 18`–`Linha 20`):

```bash
ls -d .claude/evidence/FAILED-*        # retained staging, newest last
npx playwright show-report playwright-visual-report
```

To capture the untruncated output for one diagnostic run, invoke the test
directly with the same environment the runner exports (`Linha 184`–`Linha 191`)
and tee it instead of tailing. Never "fix" this by widening the tail — a bigger
window still truncates a bigger matrix.

---

## 16. Declaring a zero noise floor without the determinism flags

**Symptom:** a `preserve` batch fails with 1 to 5 changed pixels and no source
change can explain it. Re-running sometimes passes. It looks like a flaky test;
it is the renderer.

Measured with three NULL runs — two captures, zero code change between them —
all three diverged: 1 to 5 pixels, always in column `x=293`, delta confined to
the BLUE channel (43 → 49 → 55), neighbour at `x=294` being `rgb(79,148,208)`.
Raster antialiasing on the left edge of a blue element bleeding into the previous
column, by a varying amount. Recorded in version control at
`playwright.visual.config.ts` `Linha 27`–`Linha 38`, and in the (gitignored) run
log `.claude/runs/tokenizer-cobertura/RUN.md` `Linha 279`.

This is fatal rather than annoying because `preserve` defaults to
`preserveMaxExactChangedPixels: 0` and
`preserveMaxExactChangedPixelRatio: 0` (`scripts/lib/visual-contract.mjs`
`Linha 1134`–`Linha 1137`). A noise floor above zero makes `preserve`
unsatisfiable **by a no-op**, and batch acceptance becomes luck.

**Fix at the source, not with a threshold** — six flags pinning software raster
and deterministic font/colour, in `playwright.visual.config.ts`
`Linha 39`–`Linha 51`:
```
--disable-gpu  --disable-partial-raster  --disable-skia-runtime-opts
--disable-lcd-text  --disable-font-subpixel-positioning
--force-color-profile=srgb
```
After them: two null runs, **40/40 byte-identical**, verdict `pass` (same
`Linha 279`). Any claim that this pipeline has a zero noise floor is conditional
on those flags being present in the repository actually running the capture.

Raising `preserveMaxExactChangedPixels` to swallow the floor is the forbidden
shortcut: it turns a render defect into a permanent budget and hides every real
one-pixel regression underneath it.

---

## 17. A toolchain file that does not exist is silently not fingerprinted

**Symptom:** none. `toolchainFingerprint` matches across a pair that should have
diverged.

`fingerprintPaths` throws only when the **entire** resolved file set is empty
(`scripts/lib/evidence-matrix.mjs` `Linha 313`–`Linha 318`). An individual target
that does not exist is dropped without a word by `walkFiles`
(`Linha 284`–`Linha 285`). The toolchain list at `Linha 383`–`Linha 418` includes
`scripts/compose-evidence-manifests.mjs`, which is absent from this repository —
so it contributes nothing, and a future change to it would not move the hash.

**Fix:** assert the members exist before trusting the binding.
```bash
for f in playwright.visual.config.ts tests/visual/evidence.spec.ts \
         tests/visual/evidence-matrix.json tests/visual/network-fixtures.mjs \
         scripts/lib/{visual-contract,evidence-matrix,evidence-composer}.mjs \
         scripts/compose-evidence-manifests.mjs package.json; do
  [ -e "$f" ] || echo "NOT FINGERPRINTED: $f"
done
```

---

## 18. The Stop hook is keyed to a script NAME, not to the engine on disk

**Symptom:** none, which is the problem. UI changes end the turn with no rendered
evidence and no complaint.

`tools/hooks/ui-evidence-gate.sh` `Linha 144`–`Linha 163` deliberately refuses to
treat `scripts/ui-evidence.sh` existing on disk as proof of wiring — it requires a
`package.json` script literally named **`ui:evidence`**. This repository's
`package.json` `Linha 9` declares `evidence`. Different name ⇒ `ENGINE_WIRED=0` ⇒
`exit 0` with a warning on stderr: the gate is **fail-open**, by design, so that a
fresh install does not block every commit.

Compounding it here: `.claude/settings.json` registers `marathon-stop-gate.sh` and
`tools/hooks/clarification-gate.py` only — `ui-evidence-gate.sh` is not registered
as a Stop hook at all.

**Fix:** verify both facts before relying on the gate; a silent hook is
indistinguishable from a satisfied one.
```bash
node -e 'console.log(Object.keys(JSON.parse(require("fs").readFileSync("package.json","utf8")).scripts))'
grep -o 'hooks/[a-z-]*\.\(sh\|py\)' .claude/settings.json
```
Either add a `ui:evidence` alias and register the hook, or state plainly in the
turn verdict that the gate is inactive and the evidence discipline is manual.
