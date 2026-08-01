/**
 * app-roots — de onde vêm a raiz do APP e a raiz do REPO, escrito uma vez.
 *
 * POR QUE EXISTE. Cinco scripts da camada visual cravavam
 * `FRONTEND_ROOT = <diretório deste arquivo>/..`, e quatro cravavam também
 * `REPO_ROOT = FRONTEND_ROOT/..`. Isso só vale no layout do alvo
 * (`makers-ai-hub/frontend` dentro de `makers-ai-hub`). Rodados a partir do repo
 * do PROCESSO, `FRONTEND_ROOT` resolve para a raiz deste repositório e
 * `REPO_ROOT` para `/home/augusto/code`, que **não é repositório git nenhum** —
 * e todo `git show` roda fora de qualquer repo, falhando de um jeito que parece
 * "arquivo ausente".
 *
 * Medido em 2026-08-01: `node scripts/prepare-evidence-run.mjs …` estoura em
 * `fingerprintPaths` com *"Cannot fingerprint an empty file set"* antes de
 * qualquer manifesto nascer. O subgrafo D inteiro é inalcançável por causa
 * disto, não por falta de código.
 *
 * `verify-contract-source-delta.mjs` já tinha resolvido o problema sozinho, com
 * `TOKENIZE_APP_ROOT` mais `git rev-parse --show-toplevel`, e o comentário dele
 * explica o porquê. Este módulo é aquela solução EXTRAÍDA — não uma segunda —
 * para que os outros quatro parem de reimplementar a mesma decisão de formas
 * levemente diferentes.
 *
 * A PRECEDÊNCIA, e a razão de cada degrau:
 *   1. `--root <app>` na linha de comando — explícito vence tudo, e é o mesmo
 *      nome de flag que `anchor-run.mjs` e os scripts da skill já usam;
 *   2. `TOKENIZE_APP_ROOT` — o que `verify-contract-source-delta` já lia;
 *   3. `TOKENIZE_ROOT` — o que `lib/paths.mjs` da skill já lê, para que uma
 *      corrida inteira possa ser configurada com uma variável só;
 *   4. o layout do próprio arquivo, que é o comportamento antigo e continua
 *      valendo quando os scripts rodam dentro do app.
 *
 * O REPO GIT é sempre DESCOBERTO, nunca calculado por profundidade: a relação
 * entre app e repositório não é fixa. Um app na raiz do próprio repo e um app
 * dentro de um monorepo têm profundidades diferentes, e adivinhar erra nos dois.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * Resolve a raiz do app medido.
 *
 * @param {string} fallbackDir diretório a usar quando nada mais resolver — em
 *   geral `<dirname deste script>/..`, que é o comportamento histórico.
 */
export function resolveAppRoot(fallbackDir, argv = process.argv) {
  const i = argv.indexOf("--root");
  if (i >= 0 && argv[i + 1]) return path.resolve(argv[i + 1]);
  const env = process.env.TOKENIZE_APP_ROOT || process.env.TOKENIZE_ROOT;
  if (env) return path.resolve(env);
  return path.resolve(fallbackDir);
}

/**
 * Descobre a raiz do repositório git que contém `desde`.
 *
 * Falha ALTO quando não há repo. Devolver o pai silenciosamente foi exatamente o
 * defeito original: os comandos git passavam a rodar fora de qualquer
 * repositório e o erro aparecia três camadas adiante, disfarçado.
 */
export function resolveRepoRoot(desde, { obrigatorio = true } = {}) {
  const explicito = process.argv.indexOf("--repo-root");
  if (explicito >= 0 && process.argv[explicito + 1]) {
    return path.resolve(process.argv[explicito + 1]);
  }
  try {
    return execFileSync("git", ["-C", desde, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
    }).trim();
  } catch {
    if (!obrigatorio) return null;
    throw new Error(
      `não há repositório git em ${desde} nem acima dele. ` +
        `A camada de evidência compara a worktree contra um ref, então precisa de um repo; ` +
        `passe --repo-root <path> se o app viver fora de um.`
    );
  }
}
