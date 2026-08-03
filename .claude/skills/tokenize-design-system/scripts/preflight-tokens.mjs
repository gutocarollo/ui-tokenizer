#!/usr/bin/env node
/**
 * preflight-tokens — o passo de tokens do PREFLIGHT, ciente de alvo VIRGEM.
 *
 * ANTES (medido no 1º smoke real, 2026-08-03): o registro cravava
 * `yarn tokens:build` — dois defeitos numa linha. (1) `yarn` é o gerenciador
 * de UM alvo; a cobaia usa npm (package-lock.json). (2) Alvo VIRGEM — sem
 * pipeline de tokens nenhum — falhava como se fosse quebra de ambiente, mas
 * censo/classificação/decisão NÃO precisam de infra de tokens; só a
 * MIGRAÇÃO precisa, e o scaffold dela nasce dentro do 1º lote (D5: commit
 * por lote; nada se escreve no alvo fora de lote).
 *
 * O canon (end-to-end-workflow §Phase 1) manda o preflight falhar FECHADO em
 * ambiente quebrado — isso fica. A distinção nova: "não tem pipeline" não é
 * ambiente quebrado, é um ESTADO DO ALVO, e sai como desfecho DECLARADO
 * (exit 2 — o mesmo vocabulário de "artefato com resíduo declarado" que
 * extrator/normalizador/discover-axes já usam).
 *
 * Exit:
 *   0  pipeline de tokens presente, build e validação passaram
 *   1  pipeline presente e QUEBRADO (build ou validação falhou) — fail-closed
 *   2  alvo VIRGEM (sem script tokens:build e sem tokens/*.tokens.json) —
 *      declarado; o scaffold pertence ao primeiro lote
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const arg = (flag, fallback = null) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

if (argv.includes("--help")) {
  console.log(
    "preflight-tokens.mjs --root <app>\n" +
      "exit 0 = tokens ok · 1 = pipeline quebrado · 2 = alvo virgem (declarado)"
  );
  process.exit(0);
}

const root = path.resolve(arg("--root") ?? process.cwd());
if (!existsSync(path.join(root, "package.json"))) {
  console.error(`preflight-tokens: package.json não existe em ${root}`);
  process.exit(1);
}

/** O gerenciador vem do LOCKFILE do alvo — nunca presumido. (Sem export de
 *  propósito: este arquivo executa no import; o contrato dele é o CLI.) */
function gerenciadorDoAlvo(raiz) {
  if (existsSync(path.join(raiz, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(path.join(raiz, "yarn.lock"))) return "yarn";
  if (existsSync(path.join(raiz, "package-lock.json"))) return "npm";
  return "npm";
}

const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const temScript = Boolean(pkg.scripts?.["tokens:build"]);

const dirTokens = path.join(root, "tokens");
let temDTCG = false;
if (existsSync(dirTokens)) {
  try {
    temDTCG = readdirSync(dirTokens).some((f) => f.endsWith(".tokens.json"));
  } catch {
    temDTCG = false;
  }
}

if (!temScript && !temDTCG) {
  console.log(
    JSON.stringify({
      status: "virgin",
      root,
      porQue: "sem script tokens:build e sem tokens/*.tokens.json",
      proximoPasso: "o scaffold DTCG+bridge nasce dentro do PRIMEIRO LOTE (MIGRATED)",
    })
  );
  process.exit(2);
}

// Pipeline PARCIAL (script sem arquivo, ou arquivo sem script) não é virgem
// nem saudável — é quebra, e quebra falha fechado.
if (!temScript || !temDTCG) {
  console.error(
    `preflight-tokens: pipeline de tokens PARCIAL em ${root} — ` +
      `script tokens:build ${temScript ? "existe" : "AUSENTE"}, ` +
      `tokens/*.tokens.json ${temDTCG ? "existe" : "AUSENTE"}. ` +
      "Parcial é quebra, não estado: conserte ou remova as duas pontas."
  );
  process.exit(1);
}

const pm = gerenciadorDoAlvo(root);
const build = spawnSync(pm, ["run", "tokens:build"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
if ((build.status ?? 127) !== 0) {
  console.error(`preflight-tokens: ${pm} run tokens:build falhou\n${build.stderr}`);
  process.exit(1);
}

const validar = spawnSync(
  process.execPath,
  [path.join(AQUI, "validate-token-build.mjs"), "--root", root, "--check"],
  { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
);
if ((validar.status ?? 127) !== 0) {
  console.error(`preflight-tokens: validate-token-build --check falhou\n${validar.stderr}`);
  process.exit(1);
}

console.log(JSON.stringify({ status: "ok", root, gerenciador: pm }));
process.exit(0);
