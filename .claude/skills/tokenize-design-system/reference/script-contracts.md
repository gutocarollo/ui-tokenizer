# Executable tokenization oracles

`classname-miner-v2.mjs` is the canonical AST/JSX extractor. It is bundled in
this skill so the workflow does not depend on a repository harness copy. The
target project must expose its own `typescript` package because the miner uses
the target compiler configuration and path aliases.

All scripts in this directory are portable static-analysis or build-adapter
tools. Pass the analysed application directory with `--root <path>`, set
`TOKENIZE_ROOT`, or run from that directory. They load the self-contained law
from `../reference/law.md`.

```bash
node <script>.mjs --root <application-root> [options]
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
project dependency.

```bash
node validate-contract.mjs
```

## `tokenization-runner.mjs`

Owns durable orchestration state; project adapters remain subprocesses that
produce artifacts. Ajv is resolved from the analysed project given by `--root`,
so the portable skill does not carry a private dependency tree.

```bash
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
arguments. The command writes `<run-root>/final-proof.json` only when all 24
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
