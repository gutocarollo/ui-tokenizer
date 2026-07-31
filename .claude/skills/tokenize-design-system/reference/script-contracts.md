# Executable tokenization oracles

`classname-miner-v2.mjs` is the canonical AST/JSX extractor. It is bundled in
this skill so the workflow does not depend on a repository harness copy. The
target project must expose its own `typescript` package because the miner uses
the target compiler configuration and path aliases.

All scripts in this directory are portable static-analysis or build-adapter
tools. None of them rewrites target **source files** unless a flag says so:
`normalize-vectors.mjs --apply` is the only one that can. Several do write
reports or proposals into the target (`tokenization-report.mjs`,
`propose-entities.mjs`, `propose-vocabulary.mjs --write`), which is not the
same thing. They load the self-contained law from `../reference/law.md`.

## How the application root is resolved — three different contracts

There is no single root convention, and pretending otherwise breaks runs. The
resolution actually implemented is:

| Group | Contract | Scripts |
|---|---|---|
| A — `lib/paths.mjs` | `--root <path>` → `TOKENIZE_ROOT` → `process.cwd()` | `tokenize`, `context-clusters`, `converge-tokens`, `tokenization-report`, `find-owner`, `score-naming`, `cluster-leftovers`, `inventory-surface`, `inventory-usage`, `derive-tokens`, `validate-token-build`, `measure-coverage`, `measure-disposition`, `measure-vectors`, `normalize-vectors`, `audit-extraction-delta`, `sample-weight-validation`, `propose-entities`, `propose-semantic-html` |
| B — own `--root` parse, **no `TOKENIZE_ROOT`** | `--root` with a local default (`.`, `cwd`, or an env of its own) | `audit-exceptions` (`.`), `propose-vocabulary` (`.`), `vocabulary-ratchet` (`.`), `extract-design-occurrences` (cwd), `normalize-occurrences` (cwd), `classname-miner-v2` (`--root` → `HARNESS_MINER_ROOT` → cwd), `evaluate-absolute-completion` (required), `tokenization-runner` (required) |
| C — no root at all | driven purely by explicit input/output paths | `discover-axes`, `validate-contract` |

`lib/paths.mjs` `Linha 17` is the group-A implementation. A command written as
`TOKENIZE_ROOT=frontend node discover-axes.mjs` silently analyses nothing,
because `discover-axes.mjs` never reads either signal.

```bash
node <script>.mjs --root <application-root> [options]   # groups A and B only
```

## Inventory — every executable in `scripts/`, and who calls it

29 executables (`*.mjs` excluding `*.test.mjs`), plus 17 modules in `lib/`.
"Invoked by" is the measured caller, with file and line.

| Script | Role | Invoked by (measured) |
|---|---|---|
| `tokenize.mjs` | entrypoint of the loop | humans; `README.md`, `SKILL.md` |
| `classname-miner-v2.mjs` | loop process — `MINE` | `tokenize.mjs` `Linha 167` |
| `context-clusters.mjs` | loop process — `EXTRACT`+`CLUSTER` | `tokenize.mjs` `Linha 194`; `propose-semantic-html.mjs` `Linha 238` |
| `converge-tokens.mjs` | loop process — `CONVERGE` | `tokenize.mjs` `Linha 219` |
| `tokenization-report.mjs` | loop process — `REPORT` | `tokenize.mjs` `Linha 236` |
| `find-owner.mjs` | imported module | `context-clusters.mjs` `Linha 32`; `propose-semantic-html.mjs` `Linha 86` |
| `score-naming.mjs` | imported module + CLI | `context-clusters.mjs` `Linha 33`; `find-owner.mjs` `Linha 27`; `measure-coverage.mjs` `Linha 121` |
| `measure-coverage.mjs` | census oracle (denominator) | `test/oracle-reconciliation.test.mjs` `Linha 103` |
| `measure-disposition.mjs` | census oracle (7-instrument partition) | `propose-vocabulary.mjs` `Linha 75`; `vocabulary-ratchet.mjs` `Linha 140`; `test/oracle-reconciliation.test.mjs` `Linha 104` |
| `propose-vocabulary.mjs` | generates the layout-vocabulary contract | `test/vocabulario-ratchet.test.mjs` `Linha 33` |
| `vocabulary-ratchet.mjs` | enforces that contract | `test/vocabulario-ratchet.test.mjs` `Linha 34` |
| `propose-entities.mjs` | proposes canonical entity contracts | `test/nome-discriminante.test.mjs` `Linha 71` |
| `extract-design-occurrences.mjs` | state-machine adapter — `INVENTORIED` | `lib/phase-executors.mjs` `Linha 57`, `Linha 160` |
| `discover-axes.mjs` | state-machine adapter — `INVENTORIED` | `lib/phase-executors.mjs` `Linha 58`, `Linha 161` |
| `normalize-occurrences.mjs` | state-machine adapter — `NORMALIZED` | `lib/phase-executors.mjs` `Linha 69` |
| `inventory-surface.mjs` | state-machine adapter — `CLASSIFIED` | `lib/phase-executors.mjs` `Linha 77` |
| `inventory-usage.mjs` | state-machine adapter — `CLASSIFIED` | `lib/phase-executors.mjs` `Linha 78` |
| `cluster-leftovers.mjs` | state-machine adapter — `CLASSIFIED` | `lib/phase-executors.mjs` `Linha 81` |
| `validate-token-build.mjs` | state-machine adapter — `PREFLIGHTED`/`BUILT` | `lib/phase-executors.mjs` `Linha 49`, `Linha 115` |
| `evaluate-absolute-completion.mjs` | state-machine adapter — `COMPLETE` | `lib/phase-executors.mjs` `Linha 174`; `test/absolute-completion.test.mjs` |
| `tokenization-runner.mjs` | durable control plane (CLI + library) | `tokenization-runner.test.mjs` `Linha 17` |
| `validate-contract.mjs` | self-contained parity gate | run by hand |
| `derive-tokens.mjs` | proposal generator for `DECIDED` | run by hand (`lib/phase-executors.mjs` `Linha 89` names it in the human blocker) |
| `propose-semantic-html.mjs` | proposes semantic-HTML enrichment | run by hand |
| `audit-exceptions.mjs` | itemised stratum-7 audit against built CSS | **no caller** |
| `audit-extraction-delta.mjs` | multiset diff of two class extractors | **no caller** (named only in comments: `lib/bundle-census.mjs` `Linha 116`, `propose-entities.mjs` `Linha 124`) |
| `measure-vectors.mjs` | census of non-`className` style vectors | **no caller** |
| `normalize-vectors.mjs` | proposes normalization of those vectors | **no caller** |
| `sample-weight-validation.mjs` | emits the human labelling form for merge weights | **no caller** |

Two structural facts this table encodes, because both have already produced
wrong reports:

1. **`lib/phase-executors.mjs` is imported by nobody.** The phase→command
   registry exists and is internally audited (`auditRegistry`), but no
   executable loads it: `tokenization-runner.mjs` validates and records
   transitions, it does not run steps. Everything listed as "state-machine
   adapter" above is therefore invoked **by hand today**, not by the runner.
2. **The last five rows are orphans, not diagnostics.** They are complete,
   documented programs with zero callers and zero test coverage. Treat their
   output as unverified until something exercises them.

## `tokenize.mjs`

The single entrypoint. It drives `PREFLIGHT → MINE → EXTRACT+CLUSTER →
CONVERGE → REPORT → DECIDE` and fails closed at every phase. It writes only
into `<root>/.tokenize/`, never into target source.

```bash
node tokenize.mjs --root frontend
node tokenize.mjs --root frontend --until CLUSTER
node tokenize.mjs --root frontend --max-uncertainty 25
node tokenize.mjs --root frontend --json
```

`--until` accepts `PREFLIGHT`, `MINE`, `EXTRACT`, `CLUSTER`, `CONVERGE`,
`REPORT`, `DECIDE` (default `DECIDE`); an unknown value silently runs the whole
loop. `--max-uncertainty` defaults to `30`. `TOKENIZE_MIN_COVERAGE` overrides
the 80% miner-coverage guard and exists **only** to test the guard itself.

`PREFLIGHT` stops the run when `<root>/tokens/color.tokens.json` is absent or
`colorjs.io` does not resolve from the target. `MINE` derives the file
extensions from the target and stops below 80% coverage — the miner default of
`--ext ts,tsx` once scanned 12 of 606 files and printed success.

## `classname-miner-v2.mjs`

```bash
node classname-miner-v2.mjs --root frontend --ext js,jsx,ts,tsx \
  --emit-json --out .tokenize/mine
node classname-miner-v2.mjs --help
node classname-miner-v2.mjs --self-test
```

| Flag | Default | Effect |
|---|---|---|
| `--root` | `HARNESS_MINER_ROOT` → cwd | application root |
| `--ext` | `HARNESS_MINER_EXT` → `ts,tsx` | scanned extensions — **the trap `tokenize.mjs` guards** |
| `--out` | `HARNESS_MINER_OUT_DIR` → `<repo>/docs/design-system/sources` | output directory |
| `--emit-json` | off | also writes `classname-token-mining-v2.json` |
| `--emit-full <dir>` | off | full NDJSON dump |
| `--interactive-tags` | `HARNESS_MINER_INTERACTIVE_TAGS` | extra interactive tags |
| `--self-test` | off | internal fixtures |

## `context-clusters.mjs`

Scans the tree itself and groups law-violating occurrences by semantic context,
deriving a name per cluster. A cluster without a derived name carries a
`reason`; `§4.3` in that reason means the law has no slot for the family, which
is a law gap, not an unresolved owner.

```bash
node context-clusters.mjs --root frontend --json
node context-clusters.mjs --root frontend --token content-primary
node context-clusters.mjs --root frontend --limit 20
```

## `converge-tokens.mjs`

Newton–Raphson merge over weighted measured signals until two consecutive
iterations change nothing.

```bash
node converge-tokens.mjs --root frontend --clusters .tokenize/clusters.json \
  --max-uncertainty 30 --json
```

Additional flags: `--limit`, `--de-same`, `--outlier-max`, `--outlier-ratio`.

## `tokenization-report.mjs`

Writes the three-chapter report (decided alone / exposed / needs the owner)
into the **target** repository.

```bash
node tokenization-report.mjs --root frontend \
  --clusters .tokenize/clusters.json --converged .tokenize/converged.json \
  [--out <path>] [--date <ISO>]
```

## `inventory-surface.mjs`

Inventories legacy `surface` token consumption through Tailwind classes,
`var(--color-*)`, and DTCG aliases. It reports exact duplicate values and tokens
dead on all three paths.

```bash
node inventory-surface.mjs --root frontend [--json]
```

## `inventory-usage.mjs`

Creates contextual decision groups for all colour utility classes. Each group
contains the component, carrying JSX tag and attributes, property, state,
nearby className, and source locations. It only emits JSON and never edits code.

```bash
node inventory-usage.mjs --root frontend > inventory.json
```

It has no `--json` flag: JSON is the only output mode (`Linha 123`). The usage
line in the script header that shows `[--json]` is stale.

## `score-naming.mjs`

Scores token identifiers and usages separately. `--review` limits the output to
items below the 70/100 threshold.

```bash
node score-naming.mjs --root frontend
node score-naming.mjs --root frontend --names
node score-naming.mjs --root frontend --applications
node score-naming.mjs --root frontend --review
node score-naming.mjs --root frontend --json
```

Only the documented English flags are part of this skill’s public interface.

## `find-owner.mjs`

Uses native tags and semantic attributes first, then whole-word component names
and non-structural directories. A distribution below 80% is evidence for a
split, a foundational role, or a cluster—not an automatic answer.

```bash
node find-owner.mjs --root frontend
node find-owner.mjs --root frontend content-primary
node find-owner.mjs --root frontend --json
```

The positional token argument is parsed at `Linha 253`; `--json` wins over it.

## `cluster-leftovers.mjs`

Clusters only uses that lack an owner both in their identifier and rendered
context. Its signature is the top four utilities plus structural signals.

```bash
node cluster-leftovers.mjs --root frontend
node cluster-leftovers.mjs --root frontend --all --by-token
node cluster-leftovers.mjs --root frontend --json
```

## `derive-tokens.mjs`

Produces owner-specific proposals and, with `--dtcg`, a DTCG fragment whose
values alias the existing primitive. It does not write the fragment or modify
call sites.

```bash
node derive-tokens.mjs --root frontend
node derive-tokens.mjs --root frontend --table
node derive-tokens.mjs --root frontend --json
node derive-tokens.mjs --root frontend --dtcg
```

Only the documented English flags are part of this skill’s public interface.

## `extract-design-occurrences.mjs`

Emits `design-occurrences.ndjson` + `extraction-summary.json` for the
`INVENTORIED` transition.

```bash
node extract-design-occurrences.mjs --root frontend \
  --out .tokenize-design-system/extract --run-id tokenize-2026-07-30
```

| Flag | Default |
|---|---|
| `--root` | `process.cwd()` (**not** `TOKENIZE_ROOT`) |
| `--out` | `<root>/.tokenize-design-system/extract` |
| `--run-id` | `tokenize-local`; must match `^tokenize-[A-Za-z0-9._-]+$` |
| `--generated-at` | now, ISO |
| `--source-roots`, `--ext`, `--miner-occurrences`, `--emit-full` | see `--help` |

## `discover-axes.mjs`

Reconciles data-driven axes against the closed 19-kind source registry. It has
**no `--root`**: inputs are explicit paths and default to the current directory.

```bash
node discover-axes.mjs \
  --occurrences design-occurrences.ndjson \
  --extraction-summary extraction-summary.json \
  --out axis-discovery.json
```

Options: `--configured-axes <csv>` overrides the 13-axis default registry,
`--discovery-id <id>` (default `axis-discovery-1`), `--generated-at <ISO>`,
`--help`.

## `normalize-occurrences.mjs`

Consumes `lib/tailwind-normalizer.mjs` and emits `rawOrderHash`,
`canonicalMultisetFingerprint` and `canonicalSetFingerprint` per occurrence.

```bash
node normalize-occurrences.mjs --root frontend \
  --input .tokenize-design-system/extract/design-occurrences.ndjson \
  --out .tokenize-design-system/normalize
```

Extra flags: `--entry-css`, `--tailwind-config`, `--token-source`,
`--generated-at`, `--help`. `--root` defaults to `process.cwd()`, not
`TOKENIZE_ROOT`.

## Census oracles — one denominator, two views

`measure-coverage.mjs` and `measure-disposition.mjs` must agree on the universe;
`test/oracle-reconciliation.test.mjs` is the guard that keeps them from drifting
into "two oracles, two universes" again. Both fail closed (exit 3) on an empty
denominator.

```bash
node measure-coverage.mjs    --root frontend [--json] [--min-repeat N] [--min-classes N]
node measure-disposition.mjs --root frontend [--json] [--min-repeat N] [--min-classes N] \
  [--require-built-css] [--dump-descartados]
node measure-vectors.mjs     --root frontend [--json]
```

- `measure-coverage.mjs` — the pinned denominator for `className` usage.
- `measure-disposition.mjs` — the complete 7-instrument partition; every use
  lands in exactly one instrument. It is the oracle that `propose-vocabulary`
  and `vocabulary-ratchet` spawn.
- `measure-vectors.mjs` — census of the vectors `className` does not see
  (`style={{}}`, hand-written CSS). **Orphan: no caller, no test.**

## Vocabulary contract — generate, then ratchet

```bash
node propose-vocabulary.mjs --root frontend [--json] [--write] \
  [--out docs/design-system/VOCABULARIO-LAYOUT.md] [--from <disposition.json>] \
  [--allow-degraded] [--snapshot <path>] [--procedencia <text>] \
  [--owner <text>] [--review <text>]

node vocabulary-ratchet.mjs --root frontend            # exit 1 if a class entered
node vocabulary-ratchet.mjs --root frontend --report   # print only, never fails
node vocabulary-ratchet.mjs --root frontend --list     # enumerate divergences
node vocabulary-ratchet.mjs --root frontend --doc <path> --from <disposition.json>
node vocabulary-ratchet.mjs --root frontend --update-total-baseline
```

The document is a pure function of a `measure-disposition` run and carries its
own provenance (universe, oracle SHA, built-CSS state). `--allow-degraded` is
the only way to emit it without built CSS, and it marks the output as
unverified. Both scripts default `--root` to `.` and ignore `TOKENIZE_ROOT`.

## `propose-entities.mjs`

Proposes canonical entity contracts — a repeated class bundle becomes one named
contract, which is the largest single lever in the process. It writes only
proposals (`docs/reports/entidades-propostas.md`, `.tokenize/entidades-propostas.json`)
and never mutates call sites.

```bash
node propose-entities.mjs --root frontend \
  [--min-repeat N] [--min-classes N] [--min-ast-coverage F] \
  [--samples N] [--dest <dir>] [--out <md>] [--out-json <json>] [--twmerge]
```

## `propose-semantic-html.mjs`

Proposes (never applies) the semantic-HTML enrichment that unblocks owner
attribution: `<div onClick>` where the browser should receive `<button>` is the
mechanical root cause of the human queue, not an accessibility aside. It spawns
`context-clusters.mjs --root <root> --json` (`Linha 238`) and can measure
against a git baseline.

```bash
node propose-semantic-html.mjs --root frontend --json
node propose-semantic-html.mjs --root frontend --baseline <git-ref> --out <path>
```

## `audit-exceptions.mjs` (orphan)

Itemises stratum 7 against the **built** CSS so every exception carries owner,
reason, scope, evidence (file + line) and review policy. Fails closed with exit
3 when built CSS is missing.

```bash
node audit-exceptions.mjs --root frontend [--json] [--md <file>] [--allow-no-css]
```

`--allow-no-css` marks the entire report as unverified and exists for local
inspection only.

## `audit-extraction-delta.mjs` (orphan)

Runs both class extractors over the same universe and prints the complete
multiset difference, so a change of extractor can be proven not to lose
legitimate classes.

```bash
node audit-extraction-delta.mjs --root frontend [--json] [--top N] [--all]
```

## `normalize-vectors.mjs` (orphan)

The **only** script here that can write to target source, and only with
`--apply`. Without it, it writes the proposal and the evidence.

```bash
node normalize-vectors.mjs --root frontend           # proposal only
node normalize-vectors.mjs --root frontend --apply   # mutates the target
```

## `sample-weight-validation.mjs` (orphan)

Emits the human labelling form for the merge weights
(`colour 40 · contract 25 · component 15 · owner 10 · function 10`). The owner
answers one question per pair — "is this the same contract?" — without seeing
the score, because seeing the score contaminates the label.

```bash
node sample-weight-validation.mjs --root frontend \
  --converged .tokenize/converged.json [--out <path>]
```

## `validate-token-build.mjs`

Discovers `yarn`, `pnpm`, or `npm` from the application directory and invokes
its declared `tokens:build` and `tokens:check` scripts. It can additionally
assert that a generated CSS artifact contains a new utility class.

```bash
node validate-token-build.mjs --root frontend --build --check
node validate-token-build.mjs --root frontend \
  --css dist/assets/app.css --class button-label-color
```

Use the visual-evidence skill for browser, session, routes, and screenshot
requirements. Those inputs are intentionally not hidden inside this skill.

## `validate-contract.mjs`

Checks that the bundled naming law, prose oracle, examples, anatomy rules,
executable score, artifact schemas, design-occurrence universe, and
matrix/evidence/review non-vacuity rules describe one contract. It has no
project dependency and takes no arguments.

```bash
node validate-contract.mjs
```

## `tokenization-runner.mjs`

Owns durable orchestration state; project adapters remain subprocesses that
produce artifacts. Ajv is resolved from the analysed project given by `--root`,
so the portable skill does not carry a private dependency tree. `help`,
`--help` and `-h` print the usage block.

```bash
node tokenization-runner.mjs help

node tokenization-runner.mjs init \
  --root frontend \
  --run-root .harness/runs/tokenize-2026-07-30 \
  --config /tmp/run-config.json

node tokenization-runner.mjs transition \
  --root frontend \
  --run-root .harness/runs/tokenize-2026-07-30 \
  --to INVENTORIED \
  --reason "Complete source-kind and axis census" \
  --artifact .harness/runs/tokenize-2026-07-30/inventory/design-occurrences.ndjson \
  --artifact .harness/runs/tokenize-2026-07-30/inventory/axis-discovery.json

node tokenization-runner.mjs validate --root frontend --run-root <run-root>
node tokenization-runner.mjs resume   --root frontend --run-root <run-root>
node tokenization-runner.mjs status   --root frontend --run-root <run-root>
```

`transition` also accepts `--batch <B0001>`, `--source-fingerprint <sha256>`
and `--reentry-code <E-...>`. A `--source-fingerprint` that contradicts the
transition artifacts is rejected.

**The runner does not execute phases.** It records and validates them. The
phase→command mapping lives in `scripts/lib/phase-executors.mjs`, which no
executable imports; running an adapter is a manual step today.

`run-config` uses the normative schema without a parallel configuration format:
the common artifact header plus `objective`, `sourceRoots`, the exactly-19-entry
`sourceKindRegistry`, `axisRegistry`, the five non-empty matrix dimensions,
`toolchain`, nine adapter identifiers, and zero-debt `completionPolicy`.
`toolchainFingerprint` is the lowercase SHA-256 of canonical UTF-8 JSON for the
`toolchain` object: object keys sorted recursively, array order preserved, and
no insignificant whitespace. `sha256CanonicalJson` in
`scripts/lib/artifact-contract.mjs` is the canonical implementation.

Every `--artifact` must already be an immutable JSON or NDJSON file inside the
run root and must contain exactly one of the 19 root artifact types. The runner
does not copy, rewrite, or infer adapter output. Capture and comparison tools
plug in by writing `evidence-manifest` and `comparison` artifacts at the
documented batch paths; those paths are then supplied to `transition`.
Malformed schema instances, stale fingerprints, incomplete matrix coverage, or
cross-artifact contradictions stop the transition and emit one or more closed
`E-*` re-entry codes.

Acceptance deliberately binds both sides of a real mutation. `contractRef` and
the comparison's before manifest remain on `preSourceFingerprint`;
`mutationRef.beforeSourceFingerprint` must equal that value.
`mutationRef.afterSourceFingerprint`, `afterManifestRef`, checks, comparison,
visual review, adversarial review, the acceptance header, and
`acceptedSourceFingerprint` must all bind to the distinct post-mutation source.
Re-emitting the immutable contract with a post-mutation header is invalid.

The accepted transition is appended first to `journal.ndjson` as a full,
checksummed state snapshot, then `state.json` is written with file `fsync`,
atomic rename, and directory `fsync`. `resume` selects the newest journal
snapshot whose schema, artifact hashes, and cross-invariants still pass. It
repairs a missing or stale `state.json` without deleting prior journal bytes;
even a torn final NDJSON line remains preserved and is followed by a recovery
record.

Forward transitions follow the normative state progression. A backward
transition requires `--reentry-code`, and the code must target its declared
phase:

| Code | Runner re-entry phase |
|---|---|
| `E-EXTRACT` | `PREFLIGHTED` |
| `E-NORMALIZE` | `INVENTORIED` |
| `E-CLASSIFY` | `NORMALIZED` |
| `E-FIXTURE` | `DECIDED` |
| `E-IMPACT` | `DECIDED` |
| `E-MIGRATION` | `BEFORE_CAPTURED` |
| `E-COMPARE` | `AFTER_CAPTURED` |
| `E-DECISION` | `CLASSIFIED` |

The runner requires fresh phase outputs on the transition that claims them;
the mere existence of an older file never advances state. `PENDING` and
`BLOCKED` remain explicit terminal-for-now states and never coerce a passing
verdict.

## `evaluate-absolute-completion.mjs`

Run this evaluator only from `REINVENTORIED`, after the complete final matrix,
final checks, and isolated final adversarial review exist:

```bash
node evaluate-absolute-completion.mjs \
  --root frontend \
  --run-root .harness/runs/tokenize-2026-07-30
```

Default final inputs are:

```text
<run-root>/final/evidence-manifest.json
<run-root>/final/deterministic-checks.json
<run-root>/final/adversarial-review.json
<run-root>/final/completion-reports.ndjson
```

Override them with `--matrix`, `--checks`, `--review`, and repeated `--report`
arguments. `--out` moves `final-proof.json` and `--gap-report` moves
`final-proof.gaps.json`; `--help`/`-h` prints the usage block. Every path must
stay inside `--run-root`.

The command writes `<run-root>/final-proof.json` only when all 24
predicates in Section 14 of `end-to-end-workflow.md` pass. On any failure it
writes `<run-root>/final-proof.gaps.json`, leaves `final-proof.json` absent, and
exits nonzero. If a canonical proof from a prior successful evaluation exists,
the failing rerun first atomically renames it to
`<out-dir>/.<out-basename>.archive/<proof-bytes-sha256>.invalidated`. The
content-addressed destination is deterministic and its extension is deliberately
outside artifact discovery. Repeating the same invalidation reuses the same
archive bytes; the canonical path remains absent. An existing proof is
immutable: a byte-different replacement is refused and invalidated instead of
being overwritten.

The evaluator derives source-kind coverage, axis coverage, class projection,
dynamic-fragment accounting, terminal reconciliation, scenario coverage,
freshness, source/toolchain fingerprints, final ordering, and adversarial
coverage directly from durable artifacts. Predicates whose project-specific
residuals require a target adapter use one current `inventory-report` with:

```json
{
  "reportId": "absolute/<predicate-id>",
  "counts": {
    "population": 1,
    "unapprovedResidual": 0
  },
  "reconciled": true
}
```

`population` must be positive, so an empty scan cannot prove 100% coverage.
`unapprovedResidual` is the absolute current count, not a baseline delta. The
final `deterministic-checks` artifact must contain exactly one passing check
whose `checkId` is the predicate ID and whose `outputSha256` equals the report
file bytes. A green ratchet without this absolute report is rejected.

Every `run-config.axisRegistry[*].completionPredicateIds[]` value must belong to
the canonical closed 24-predicate registry. The final
`completion-reports.ndjson` must contain exactly one current `absolute/*`
`inventory-report` for each of the 14 predicates whose evidence mode is
`absolute-report`: no missing, duplicate, or extra absolute ID is accepted.

For live freshness, every `run-config.toolchain.configurationFingerprints` key
must use `file:<application-relative-path>`, and its value must be the current
file SHA-256. `toolchain.versions.node` must match the executing Node version.
The current source fingerprint is recomputed over every regular file under
`run-config.sourceRoots`, ordered by application-relative path and hashed as
`path + NUL + bytes + NUL`. Source roots must be non-empty, remain inside the
application root, and contain no symbolic links. Include every authored source,
token, public design asset, and generated design artifact that can affect the
rendered product; an incomplete source-root declaration is an invalid run
contract.

Every capture path must be run-relative. The evaluator reopens each PNG and
verifies actual bytes, SHA-256, PNG header, width, and height. The isolated
final adversarial review must reference the final matrix, final checks, current
design and normalized census, axis discovery, every absolute report, and every
acceptance artifact. Inline/self reviewer identifiers and unresolved
blocker/high findings fail the proof.

## `lib/artifact-contract.mjs`

Reusable by project adapters and tests without invoking the CLI:

```js
const validator = createArtifactValidator({ root: "frontend" });
const result = validateArtifactSet({
  records,
  runRoot: ".harness/runs/tokenize-2026-07-30",
  validator,
  targetPhase: "COMPARED",
});

if (!result.valid) {
  throw new ArtifactContractError(result.violations);
}
```

The public contract includes:

- `createArtifactValidator`: resolves Ajv 2020 from the target project and
  compiles exactly the 19 root schemas;
- `readArtifactRecords`: reads one JSON artifact, a JSON artifact array, or
  non-empty NDJSON with line provenance;
- `makeArtifactRef`, `sha256File`, and `resolveArtifactRefPath`: produce and
  verify run-relative content-addressed references without path escape;
- `validateArtifactSet` and `assertArtifactSet`: validate schema instances,
  reference closure, and every normative cross-artifact invariant;
- `validateTransition` and `validateTransitionEvidence`: enforce forward state,
  code-specific re-entry, and fresh phase outputs; and
- `canonicalJson` and `sha256CanonicalJson`: implement the documented stable
  toolchain fingerprint.

## Project adapters in this repository — `scripts/`

These 11 executables are **not** part of the portable skill. They are this
repository's implementation of the adapters that `end-to-end-workflow.md`
requires, and they run from the repository root, not from the skill directory.
They are listed here because the skill's `BEFORE_CAPTURED`, `BUILT`,
`AFTER_CAPTURED` and `COMPARED` phases are unusable without knowing their real
signatures.

| Adapter | Phase | Invoked by (measured) |
|---|---|---|
| `scripts/affected-routes.mjs` | `BEFORE_CAPTURED` | `lib/phase-executors.mjs` `Linha 96` |
| `scripts/gen-visual-routes.mjs` | `BEFORE_CAPTURED` | `lib/phase-executors.mjs` `Linha 97` |
| `scripts/ui-evidence.sh` | `BEFORE_CAPTURED` / `AFTER_CAPTURED` | `package.json` `"evidence"`; `tools/hooks/ui-evidence-gate.sh` |
| `scripts/prepare-evidence-run.mjs` | capture setup | `scripts/ui-evidence.sh` `Linha 167` |
| `scripts/evidence-manifest.mjs` | `BEFORE_CAPTURED` / `AFTER_CAPTURED` | `scripts/ui-evidence.sh` `Linha 198` |
| `scripts/compare-evidence.mjs` | `COMPARED` | `lib/phase-executors.mjs` `Linha 137` |
| `scripts/evidence-report.mjs` | `COMPARED` | `lib/phase-executors.mjs` `Linha 138` |
| `scripts/verify-contract-source-delta.mjs` | `COMPARED` (fixture bind) | run by hand |
| `scripts/codemod-entities.mjs` | `MIGRATED` (after side) | run by hand |
| `scripts/reverse-entities.mjs` | `MIGRATED` (before side) | run by hand |
| `scripts/ds-contrast-pairs.py` | `BUILT` | `package.json` `"guard:contrast"` |

```bash
# capture — one positional label, then the matrix selectors
bash scripts/ui-evidence.sh <label> \
  [--run-id tokenize-<id>] [--batch-id B0001] \
  [--phase global-before|before|after|final] \
  [--routes /a,/b] [--scenario-ids route/default,...] \
  [--themes light,dark] [--projects mobile-sm,mobile-md,tablet,desktop] \
  [--project desktop] [--locales en-US] [--writing-modes ltr]

node scripts/prepare-evidence-run.mjs --run-id tokenize-<id> \
  --phase <global-before|before|after|final> \
  --selection-out <selection.json> --manifest-config-out <config.json> \
  [--batch-id B0001] [--routes /a,/b] [--scenario-ids id/a,id/b] \
  [--themes light,dark] [--projects mobile-sm,desktop] \
  [--locales en-US] [--writing-modes ltr]

node scripts/evidence-manifest.mjs --config <manifest-config.json> \
  --capture-dir <dir> --out <manifest.json>

node scripts/compare-evidence.mjs --before <manifest.json> --after <manifest.json> \
  --policy <policy.json> --out <comparison.json> \
  --review-input <visual-review-input.json> [--review-output <completed-review.json>]
```

`prepare-evidence-run`, `evidence-manifest` and `compare-evidence` all exit `2`
with a usage block when a required flag is missing. `phase-executors.mjs`
declares them without arguments (`Linha 99`, `Linha 129`, `Linha 137`), which
cannot run as written — see the gap list below.

### Mutation and delta proof

```bash
node scripts/codemod-entities.mjs NOME_DO_CONTRATO [...] \
  [--esperado NOME=N,NOME=N] [--apply]      # dry-run by default
node scripts/reverse-entities.mjs [--esperado N] [--apply]
node scripts/verify-contract-source-delta.mjs --base HEAD \
  --field-before <sha256> --field-after <sha256> \
  [--out verdict.json] [--entities design-entities] \
  [--field fixtureRegistryFingerprint]
python3 scripts/ds-contrast-pairs.py [--verbose]
```

`codemod-entities.mjs` and `reverse-entities.mjs` resolve the target through
`TOKENIZE_APP_ROOT` (defaulting to the repository root) and read the entity
module at `src/utils/design-entities.js`. Both are dry-run unless `--apply`;
`codemod-entities.mjs` stops when the matched count diverges from `--esperado`.

`verify-contract-source-delta.mjs` is the mechanical proof that a batch changed
only presentation inside files that are `contractSources` of a network fixture:
the AST removes the permitted regions (`className` attribute values, design-entity
imports) from both sides and what remains must be byte-identical. There is no
similarity threshold — identity or failure — and every error path fails closed.
`--field-before` and `--field-after` are mandatory: the verdict is pinned to the
observed fingerprint pair, and a `--base` that does not resolve to a commit
fails instead of defaulting.

## Known gaps — implementation, not documentation

These are recorded here so the next reader does not mistake them for missing
prose:

1. **`lib/phase-executors.mjs` is imported by nobody.** The whole phase→command
   bridge is inert; the runner never executes a step.
2. **Three step declarations in that registry cannot run as written.**
   `node scripts/evidence-manifest.mjs` (`Linha 99`, `Linha 129`) and
   `node scripts/compare-evidence.mjs` (`Linha 137`) carry no flags, but both
   scripts exit `2` without their required arguments.
3. **Four gate paths in that registry are stale.** `python3 scripts/ds-naming-law.py`
   and `python3 scripts/ds-cohesion.py` (`Linha 116`, `Linha 117`) live at
   `tools/gates/` in this repository, and `../.harness/lib/ds-variety.py`,
   `../.harness/lib/ds-dead-classes.py`, `../.harness/lib/ds-gate.sh`
   (`Linha 118`–`Linha 120`) point outside the repository entirely.
4. **Five executables have no caller and no test**: `audit-exceptions.mjs`,
   `audit-extraction-delta.mjs`, `measure-vectors.mjs`, `normalize-vectors.mjs`,
   `sample-weight-validation.mjs`.
5. **`APPLY` remains unimplemented inside the skill.** Token creation, AST
   codemod and pixel proof exist only as this repository's adapters
   (`scripts/codemod-entities.mjs`, `scripts/ui-evidence.sh`), which are not
   portable and are not wired to the runner.
