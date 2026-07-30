# Portable reference inventory

This directory is the complete normative reference set for this skill. A copied
skill requires no repository-specific document, cache, command, or source pin.

| File | Authority | Purpose |
| --- | --- | --- |
| `law.md` | normative | Closed vocabulary, grammar, scoring rules, and semantic naming constraints. Scripts read this file directly. |
| `anatomy-property.md` | normative | The limited anatomy × property matrix used by the score and derivation rules. |
| `oracle.md` | explanatory | Rationale and deterministic criteria for name and application scores. |
| `examples.md` | explanatory | Good and bad naming examples, including context and redundancy failures. |
| `pitfalls.md` | operational | Failure modes, mandatory non-vacuity checks, and the visual-evidence handoff. |
| `migration-ledger-template.md` | operational | Per-batch evidence and rollback record. |

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

## Provenance rule

If this law is tailored for a particular product, keep that product’s historical
links outside this skill. Update this bundled reference only through an explicit,
reviewed law change, then validate every bundled script against a real target.
