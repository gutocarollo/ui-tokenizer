# Migration ledger template — one batch at a time

Use one record per batch. Do not start the next batch until the current record is
complete and its checks pass. A batch is one explicit, reviewable migration unit;
it must be reversible without affecting another batch.

```md
## Batch <number>: <short target name>

- Target: `<token, component, file set, or migration scope>`
- Intended change: `<old contract> → <new contract>`
- Owner and date: `<name> — YYYY-MM-DD>`

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
