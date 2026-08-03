/**
 * Path resolution shared by the portable tokenization oracles.
 *
 * Resolution order for the analysed application root:
 *   1. `--root <path>`
 *   2. `TOKENIZE_ROOT`
 *   3. `process.cwd()`
 *
 * The law is the self-contained `reference/law.md`; the analysed project's
 * `tokens/GRAMMAR.md` is only a compatibility fallback.
 */
import { existsSync } from "node:fs";
import path from "node:path";

import { resolveProjectLayout } from "./project-layout.mjs";

const SKILL = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

export function resolveRoot(argv = process.argv) {
  const i = argv.indexOf("--root");
  if (i >= 0 && argv[i + 1]) return path.resolve(argv[i + 1]);
  if (process.env.TOKENIZE_ROOT) return path.resolve(process.env.TOKENIZE_ROOT);
  return process.cwd();
}

/**
 * As raízes de fonte do alvo, EM ABSOLUTO — fonte única.
 *
 * POR QUE EXISTE. Sete scripts cravavam `path.join(root, "src")` (medido
 * 2026-08-03: inventory-usage, context-clusters, audit-extraction-delta,
 * evaluate-residual, normalize-vectors e propose-semantic-html em dois
 * pontos). `src` é o layout de UM app; o primeiro alvo de fora tinha `app`, e
 * o passo morria com ENOENT no meio da fase — não com uma recusa legível.
 *
 * `resolveProjectLayout` já é o dono da topologia e já lê
 * `tokenization.config.json`. Isto é só o atalho para o caso comum, para que
 * ninguém precise reescrever a resolução (foi reescrevê-la sete vezes que
 * produziu sete divergências).
 */
export function resolveSourceRoots(root) {
  return resolveProjectLayout(root).sourceRoots;
}

export function resolveLaw(root) {
  const own = path.join(SKILL, "reference/law.md");
  if (existsSync(own)) return own;
  const repo = path.join(root, "tokens/GRAMMAR.md");
  if (existsSync(repo)) return repo;
  throw new Error(
    "Token law not found: neither the skill reference/law.md nor <root>/tokens/GRAMMAR.md exists."
  );
}
