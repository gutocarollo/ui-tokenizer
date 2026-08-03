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

/*
 * `tokens:check` é ADAPTADOR OPCIONAL do alvo, não requisito nosso. A versão
 * anterior chamava `validate-token-build --check` sempre, e ele exige que o
 * alvo defina esse script — o processo reprovava um alvo saudável por não ter
 * um nome de script que só nós conhecemos (medido 2026-08-03, mesmo erro do
 * Ajv). Se o alvo define, respeitamos e rodamos; se não, seguimos.
 */
if (pkg.scripts?.["tokens:check"]) {
  const validar = spawnSync(
    process.execPath,
    [path.join(AQUI, "validate-token-build.mjs"), "--root", root, "--check"],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  if ((validar.status ?? 127) !== 0) {
    console.error(`preflight-tokens: o tokens:check do alvo falhou\n${validar.stderr}`);
    process.exit(1);
  }
}

/*
 * A PROVA É NO ARTEFATO, não na configuração (CLAUDE.md §8). Build que termina
 * com exit 0 e não escreve CSS é o modo de falha silenciosa que este projeto
 * inteiro existe para impedir — foi assim que 1999 classes ficaram mudas.
 *
 * Dois desfechos distintos quando o CSS não existe, e confundi-los seria mentir
 * nas duas direções:
 *   - DTCG sem token nenhum  → esperado. O esqueleto está pronto e os tokens
 *     entram pela fase DECIDED. Resíduo declarado (exit 2).
 *   - DTCG COM token         → o compilador recebeu entrada real e não produziu
 *     saída. Isso é quebra (exit 1).
 */
const cfgTopologia = ["tokenization.config.json", "tokens/tokenization.config.json"]
  .map((rel) => path.join(root, rel))
  .find(existsSync);
const themeFile = cfgTopologia
  ? JSON.parse(readFileSync(cfgTopologia, "utf8")).themeFile ?? null
  : null;

/** Folhas DTCG (nós com `$value`) — a ENTRADA que o compilador recebeu. */
function contarFolhas(no) {
  if (!no || typeof no !== "object") return 0;
  if ("$value" in no) return 1;
  return Object.entries(no)
    .filter(([chave]) => !chave.startsWith("$"))
    .reduce((soma, [, filho]) => soma + contarFolhas(filho), 0);
}

if (themeFile) {
  const alvoCss = path.join(root, themeFile);
  const temCss = existsSync(alvoCss) && readFileSync(alvoCss, "utf8").trim().length > 0;
  const tokenFile = JSON.parse(readFileSync(cfgTopologia, "utf8")).tokenFile ?? "tokens/color.tokens.json";
  const caminhoDTCG = path.join(root, tokenFile);
  const folhas = existsSync(caminhoDTCG)
    ? contarFolhas(JSON.parse(readFileSync(caminhoDTCG, "utf8")))
    : 0;

  if (!temCss && folhas > 0) {
    console.error(
      `preflight-tokens: o DTCG tem ${folhas} token(s) e o build NÃO escreveu ${themeFile}. ` +
        `Build com exit 0 e sem saída é a falha silenciosa que deixa classe muda.`
    );
    process.exit(1);
  }
  if (!temCss) {
    console.log(
      JSON.stringify({
        status: "scaffold-sem-tokens",
        root,
        gerenciador: pm,
        porQue: `DTCG sem token; ${themeFile} não é escrito até DECIDED produzir os primeiros`,
      })
    );
    process.exit(2);
  }
  console.log(JSON.stringify({ status: "ok", root, gerenciador: pm, themeFile, tokensNoDTCG: folhas }));
  process.exit(0);
}

console.log(JSON.stringify({ status: "ok", root, gerenciador: pm }));
process.exit(0);
