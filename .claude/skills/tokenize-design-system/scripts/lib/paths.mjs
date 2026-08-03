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

const SKILL = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

export function resolveRoot(argv = process.argv) {
  const i = argv.indexOf("--root");
  if (i >= 0 && argv[i + 1]) return path.resolve(argv[i + 1]);
  if (process.env.TOKENIZE_ROOT) return path.resolve(process.env.TOKENIZE_ROOT);
  return process.cwd();
}

/**
 * Reexportada de `project-layout`, que é o dono da topologia. Os oráculos já
 * importam `resolveRoot` daqui; obrigá-los a um segundo módulo só para saber
 * onde está o código convidaria à sétima cópia de `path.join(root, "src")`.
 */
export { resolveSourceRoots } from "./project-layout.mjs";

export function resolveLaw(root) {
  const own = path.join(SKILL, "reference/law.md");
  if (existsSync(own)) return own;
  const repo = path.join(root, "tokens/GRAMMAR.md");
  if (existsSync(repo)) return repo;
  throw new Error(
    "Token law not found: neither the skill reference/law.md nor <root>/tokens/GRAMMAR.md exists."
  );
}
