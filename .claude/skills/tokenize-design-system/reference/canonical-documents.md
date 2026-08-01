# Portable reference inventory

This directory is the complete normative reference set for this skill. A copied
skill requires no repository-specific document, cache, command, or source pin.

Every file in `reference/` is listed below — **13 Markdown documents plus one
JSON schema bundle**. Verify with `ls reference/`; an unlisted file here is an
orphan and a defect, the same rule `docs/SCHEMA.md` applies to the wiki.

| File | Authority | Purpose |
| --- | --- | --- |
| `law.md` | normative | Closed vocabulary, grammar, scoring rules, and semantic naming constraints. Scripts read this file directly. Three words are banned from a public token name — `surface`, `semantic` and `content`; the text property is `foreground-color`, never `color`. |
| `cookbook.md` | normative | A situação real → o nome que a lei dá a ela. Espelho de `docs/law/cookbook.md`; validado por `validate-cookbook.mjs`. Exceção sem justificativa escrita é falha. |
| `anatomy-property.md` | normative | The limited anatomy × property matrix used by the score and derivation rules. |
| `end-to-end-workflow.md` | normative | The orchestration contract: 22 sections and a 49-node graph (30 marked `[D]`, 3 `[H]`), invariants, completion predicates and re-entry routing. |
| `artifact-schemas.json` | normative | Closed JSON Schema (draft 2020-12) for every durable artifact the state machine exchanges. The only non-Markdown file in this directory. |
| `clarification.md` | normative | How to ask the owner, and when not to. A bare question is forbidden: every decision block carries behaviour, a good applied example, a bad one, and when to choose it. |
| `script-contracts.md` | operational | Input, output and exit-code contract of each bundled oracle, starting from the canonical AST/JSX extractor. |
| `oracle.md` | explanatory | Rationale and deterministic criteria for name and application scores. |
| `examples.md` | explanatory | Good and bad naming examples, including context and redundancy failures. |
| `pitfalls.md` | operational | Failure modes, mandatory non-vacuity checks, and the visual-evidence handoff. |
| `migration-ledger-template.md` | operational | Per-batch evidence and rollback record. |
| `visual-evidence.md` | operational | The rendered-evidence loop, absorbed from the former `refactor-ui-with-evidence` skill. The **protocol** travels; the engine does not. |
| `visual-evidence-engine.md` | operational | Manifest of every file the visual engine needs and why it lives in the target repository rather than in this skill. |
| `canonical-documents.md` | operational | This inventory. |

## Optional target-project evidence

When a target repository already has token documents, inventories, generated
artifacts, or a class-name miner, inspect them as **evidence only**. They are
not authority for this portable skill and must not be required for its scripts
to run. A target may supply any of the following when available:

- its token source and generated CSS/JS artifacts;
- its package-manager build/check scripts;
- a project-local AST miner or static inventory;
- route discovery and screenshot evidence from a separate UI-evidence workflow.

The build adapter discovers declared package scripts. The seven analysis scripts
require only the target root, its `src/` directory, generated token bridge, and
the token files described in [SKILL.md](../SKILL.md). Visual capture deliberately
belongs to the configured UI-evidence adapter.

Scope note, measured 2026-07-31: those seven are the documented *analysis* entry
points. `scripts/` actually holds **29** executable `.mjs` files, **17** modules
under `scripts/lib/` and **16** test files under `scripts/test/`
(`ls scripts/*.mjs | grep -vc '\.test\.mjs'`). The single supported command is
`scripts/tokenize.mjs`; the rest are the oracles it composes, callable on their
own for a narrower question.

## Provenance rule

If this law is tailored for a particular product, keep that product’s historical
links outside this skill. Update this bundled reference only through an explicit,
reviewed law change, then validate every bundled script against a real target.
