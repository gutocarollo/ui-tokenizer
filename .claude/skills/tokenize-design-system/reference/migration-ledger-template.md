# Migration ledger template — one batch at a time

Use one record per batch. Do not start the next batch until the current record is
complete and its checks pass. A batch is one explicit, reviewable migration unit;
it must be reversible without affecting another batch.

```md
## Batch <number>: <short target name>

- Target: `<token, component, file set, or migration scope>`
- Intended change: `<old contract> → <new contract>`
- Owner and date: `<name> — YYYY-MM-DD`

### Before evidence

- Baseline command: `<exact command>`
- Baseline artifact: `<path or immutable reference>`
- Observed result: `<counts, screenshots, or exact output>`

### Generated-artifact check

- Generation command: `<exact command>`
- Generated artifact inspected: `<path>`
- Expected token/alias/variable result: `<exact expected result>`
- Actual result: `<exact observed result>`

### Class-emission check

- Consumer present: `<path and class>`
- Build command: `<exact command>`
- Built CSS search: `<exact grep/rg command>`
- Actual emitted class result: `<exact observed result>`

### After evidence

- Comparison command: `<exact command>`
- Comparison reference: `<immediately preceding baseline, never HEAD by default>`
- Visual or semantic result: `<exact observed result>`

### Result and rollback

- Result: `PASS | FAIL | ROLLED_BACK`
- Decision: `<why this batch may proceed or must stop>`
- Rollback procedure: `<exact reversible steps>`
- Rollback verification: `<command and observed result, if rolled back>`
```

Completion rule: mark a batch `PASS` only after before evidence, generated-artifact
verification, class-emission verification, and after evidence all succeed. Mark it
`FAIL` or `ROLLED_BACK` otherwise, record the evidence, and do not merge its
changes into a later batch.

## Where this record is enforced

This template is the human-readable half. Its machine-readable half is the
`acceptance` artifact of `reference/artifact-schemas.json`, whose `ledgerEntry`
field is a required non-empty string. `scripts/lib/absolute-completion.mjs`
(Linhas 1082-1092) fails the `process.accepted-batches-reversible` predicate for
any accepted batch that has no `ledgerEntry`, or whose `preSourceFingerprint`
equals its `acceptedSourceFingerprint` — an acceptance that changed nothing is
not a reversible, evidence-linked batch.

Map the sections above onto the artifacts so the two halves cannot drift:

| section here | artifact that must exist |
|---|---|
| Target · Intended change | `batch-contract` (`targetClusterIds`, `plannedFiles`, `expectedVisualEffect`) |
| Before evidence | `evidence-manifest` for the batch `before` |
| Generated-artifact check · Class-emission check | `deterministic-checks` |
| After evidence | `evidence-manifest` for `after` + `comparison` |
| Result and rollback | `acceptance` (`verdict`, `ledgerEntry`, the two fingerprints) |

⚠ **Lacuna de implementação declarada.** No script in this skill writes or reads
this Markdown record. Nothing generates it, nothing parses it, and nothing checks
that a Markdown ledger and the `acceptance` artifact agree. The template is a
discipline, not a gate; the gate is the artifact.
