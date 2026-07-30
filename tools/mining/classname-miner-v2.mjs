#!/usr/bin/env node
/**
 * Compatibility entry point.
 *
 * The canonical, portable implementation lives inside the self-contained
 * `tokenize-design-system` skill. Keep this wrapper so existing package
 * scripts and harness integrations continue to work without maintaining a
 * second miner.
 */
import "../../.claude/skills/tokenize-design-system/scripts/classname-miner-v2.mjs";
