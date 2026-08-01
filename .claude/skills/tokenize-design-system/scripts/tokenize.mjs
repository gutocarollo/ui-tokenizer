#!/usr/bin/env node
/**
 * tokenize.mjs — O ENTRYPOINT UNICO. Um comando, o loop inteiro.
 *
 *     node tokenize.mjs --root <app>
 *
 * Por que existe: o processo tinha 17 entrypoints, um runner com 5 comandos que
 * NAO executavam nada (so rastreavam estado), um registro fase->executor que
 * ninguem invocava, 4 scripts orfaos e 2 skills separadas. Quem chegasse nao
 * tinha por onde comecar. Isso nao e um processo, e um conjunto de pecas.
 *
 * Aqui o loop e um so, e ele e o do grafo:
 *
 *   PREFLIGHT   compilador vivo? politica de eixo medida?      [determinstico]
 *   MINE        bundles repetidos -> entidade canonica          [determinstico]
 *   EXTRACT     censo de ocorrencias que violam a lei          [determinstico]
 *   CLUSTER     agrupa por CONTEXTO (§9), deriva o nome        [determinstico]
 *   CONVERGE    itera ate 2 rodadas sem mudanca (Newton)       [determinstico]
 *   REPORT      3 capitulos: decidido / exposto / para o dono  [determinstico]
 *   DECIDE      o que sobrou acima do corte de incerteza       [HUMANO]
 *   APPLY       cria tokens, codemod, prova de pixel           [nao implementado]
 *
 * REGRAS DURAS, herdadas do grafo e das armadilhas medidas:
 *
 *   - falha fechada em toda fase: sem compilador, sem lib de cor, sem arquivo de
 *     token, o loop PARA. Nunca continua com sinal desligado, porque continuar
 *     com sinal desligado produz "0 fusoes, 400 na fila" e parece resultado.
 *   - nada e aplicado no codigo por este comando. APPLY e fase declarada e ainda
 *     nao implementada; o loop entrega proposta e prova, nao mutacao.
 *   - o humano so aparece na fase DECIDE, e so com o que passou do corte.
 *   - varredura PARCIAL e erro, nao aviso: a fase MINE deriva as extensoes do
 *     alvo e para se cobrir menos de 80% dos arquivos elegiveis.
 *
 * Uso:
 *   node tokenize.mjs --root <app>                    # loop completo
 *   node tokenize.mjs --root <app> --until CLUSTER    # para numa fase
 *   node tokenize.mjs --root <app> --max-uncertainty 25
 *   node tokenize.mjs --root <app> --json
 */
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRoot } from "./lib/paths.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = resolveRoot();
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const JSON_OUT = argv.includes("--json");

const WORK = path.join(ROOT, ".tokenize");
mkdirSync(WORK, { recursive: true });

const PHASES = ["PREFLIGHT", "MINE", "EXTRACT", "CLUSTER", "CONVERGE", "REPORT", "DECIDE"];
const until = (arg("--until", "DECIDE") || "DECIDE").toUpperCase();
const stopAt = PHASES.indexOf(until) >= 0 ? PHASES.indexOf(until) : PHASES.length - 1;

const log = [];
const say = (s) => { log.push(s); if (!JSON_OUT) console.log(s); };
const fail = (fase, motivo, comoResolver) => {
  const msg = [
    ``,
    `PAROU em ${fase}: ${motivo}`,
    comoResolver ? `  como resolver: ${comoResolver}` : null,
    ``,
    `O loop falha FECHADO. Continuar com um sinal desligado produz numero que`,
    `parece resultado e nao e — foi assim que uma corrida deu "0 fusoes, 400 na`,
    `fila" so porque a lib de cor nao resolveu.`,
  ].filter(Boolean).join("\n");
  if (JSON_OUT) console.log(JSON.stringify({ ok: false, phase: fase, reason: motivo, hint: comoResolver, log }, null, 1));
  else console.error(msg);
  process.exit(1);
};

/**
 * Roda um script da skill contra o alvo.
 *
 * `outFile` existe por um defeito medido em 2026-08-01: com `stdio: "pipe"`, o
 * `spawnSync` aplica o `maxBuffer` default de 1 MB. A fase CLUSTER emite 3,64 MB
 * e a CONVERGE 3,37 MB, entao AS DUAS morriam com ENOBUFS — e o loop parava na
 * terceira de sete fases dizendo "context-clusters falhou", quando o filho havia
 * saido com 0 e JSON valido. Mesma classe do truncamento de `--json` corrigido no
 * mesmo dia: o erro e de quem LE e a mensagem acusa o DADO.
 *
 * Elevar o `maxBuffer` seria remendo — 3,6 MB e o alvo de hoje e o numero cresce
 * com o app. As duas fases ja gravavam o stdout capturado em arquivo logo depois;
 * o pipe era um intermediario que so existia para estourar. Passar o descritor
 * como `stdio[1]` remove o teto e a copia dupla em memoria.
 */
function run(script, args, { capture = false, outFile = null } = {}) {
  let fd = null;
  if (outFile) fd = openSync(outFile, "w");
  try {
    const r = spawnSync(process.execPath, [path.join(HERE, script), "--root", ROOT, ...args], {
      encoding: "utf8",
      // com outFile o stdout vai DIRETO para o descritor: sem maxBuffer, sem copia
      stdio: fd !== null
        ? ["ignore", fd, "pipe"]
        : capture
          ? ["ignore", "pipe", "pipe"]
          : ["ignore", "inherit", "inherit"],
      maxBuffer: 256 * 1024 * 1024, // teto de seguranca para quem ainda captura por pipe
    });
    if (r.error) {
      // Distinguir FILHO QUE FALHOU de PAI QUE NAO CONSEGUIU LER. Chamar os dois
      // de "o script falhou" manda o operador depurar o arquivo errado.
      const doLeitor = r.error.code === "ENOBUFS";
      return {
        ok: false,
        leitor: doLeitor,
        err: doLeitor
          ? `a saida de ${script} passou do buffer do orquestrador (o script NAO falhou) — use outFile`
          : r.error.message,
      };
    }
    return { ok: r.status === 0, code: r.status, out: r.stdout, err: r.stderr };
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

/* ───────────────────────────────────────────────────────────── PREFLIGHT ── */

say(`tokenize · alvo ${ROOT}`);
say(`trabalho em ${path.relative(ROOT, WORK)}/\n`);

say("PREFLIGHT");
const tokensFile = path.join(ROOT, "tokens/color.tokens.json");
if (!existsSync(tokensFile)) {
  fail("PREFLIGHT", `nao ha arquivo DTCG em ${path.relative(ROOT, tokensFile)}`,
    "crie tokens/tokenization.config.json + tokens/color.tokens.json no alvo");
}
say(`  ok  arquivo DTCG presente`);

// compilador do alvo vivo?
const probe = spawnSync(process.execPath, ["--input-type=module", "--eval", `
  const { createRequire } = await import("node:module");
  const r = createRequire(${JSON.stringify(path.join(ROOT, "package.json"))});
  const out = { tailwind: false, color: false };
  try { r.resolve("@tailwindcss/node"); out.tailwind = true; } catch {}
  try { r.resolve("colorjs.io"); out.color = true; } catch {}
  process.stdout.write(JSON.stringify(out));
`], { encoding: "utf8" });
let deps = { tailwind: false, color: false };
try { deps = JSON.parse(probe.stdout || "{}"); } catch {}
if (!deps.color) {
  fail("PREFLIGHT", "colorjs.io nao resolve a partir do alvo",
    `cd ${ROOT} && npm install --save-dev colorjs.io`);
}
say(`  ok  colorjs.io resolve (sinal de cor ativo)`);
say(`  ${deps.tailwind ? "ok " : "-- "} @tailwindcss/node ${deps.tailwind ? "resolve" : "AUSENTE (canonicalizacao de utility indisponivel)"}`);
if (stopAt < 1) finish();

/* ────────────────────────────────────────────────────────────────── MINE ── */
/*
 * Minera bundles de className repetidos — os candidatos a ENTIDADE CANONICA.
 *
 * Esta fase existe por causa de um bug que custou caro: o miner tem `--ext`
 * default `ts,tsx`. Rodado assim contra um app que e 456 .jsx + 132 .js e apenas
 * 3 .tsx, ele varreu 12 de 606 arquivos — 2% — e imprimiu "sucesso". O numero
 * saiu plausivel e estava errado por duas ordens de grandeza.
 *
 * Duas travas, nesta ordem:
 *   1. a extensao e DERIVADA do alvo, contando o que existe em disco. Nunca
 *      default, nunca herdada de env.
 *   2. guard de cobertura: se o miner varrer menos que MIN_COVERAGE dos arquivos
 *      elegiveis, isso e ERRO e o loop para. Varredura parcial silenciosa e
 *      pior que varredura nenhuma, porque produz numero que parece resultado.
 */
// Limiar sobreponivel APENAS para teste do proprio guard — um guard que nunca
// foi visto falhando nao e um guard, e uma intencao. Producao usa 0.8.
const MIN_COVERAGE = Number(process.env.TOKENIZE_MIN_COVERAGE ?? 0.8);
say("\nMINE");

const EXT_CANDIDATAS = ["js", "jsx", "ts", "tsx", "mjs", "cjs", "vue", "svelte"];
const IGNORAR = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", ".tokenize"]);
function contarPorExtensao(dir, acc = new Map()) {
  let entradas;
  try { entradas = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entradas) {
    if (e.name.startsWith(".") && e.name !== ".") { if (IGNORAR.has(e.name)) continue; }
    if (IGNORAR.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) contarPorExtensao(p, acc);
    else {
      const ext = path.extname(e.name).slice(1);
      if (EXT_CANDIDATAS.includes(ext)) acc.set(ext, (acc.get(ext) ?? 0) + 1);
    }
  }
  return acc;
}
const porExt = contarPorExtensao(ROOT);
const elegiveis = [...porExt.values()].reduce((s, n) => s + n, 0);
if (!elegiveis) {
  fail("MINE", `nenhum arquivo de codigo sob ${ROOT}`,
    "confira --root; ele deve apontar para a raiz do app, nao para o diretorio de scripts");
}
const extDerivada = [...porExt.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e);
say(`  extensoes derivadas do alvo: ${extDerivada.map((e) => `${e}(${porExt.get(e)})`).join(" ")}`);
say(`  arquivos elegiveis: ${elegiveis}`);

const mineDir = path.join(WORK, "mine");
mkdirSync(mineDir, { recursive: true });
const m = spawnSync(process.execPath, [
  path.join(HERE, "classname-miner-v2.mjs"),
  "--root", ROOT, "--ext", extDerivada.join(","), "--emit-json", "--out", mineDir,
], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
if (m.status !== 0) fail("MINE", "o miner falhou", (m.stderr ?? "").split("\n").slice(0, 3).join(" | "));

const mineJson = path.join(mineDir, "classname-token-mining-v2.json");
if (!existsSync(mineJson)) fail("MINE", "o miner nao emitiu JSON", "verifique --emit-json");
const MJ = JSON.parse(readFileSync(mineJson, "utf8"));
const varridos = MJ.scanned ?? 0;
const cobertura = varridos / elegiveis;
say(`  varridos: ${varridos} (${(100 * cobertura).toFixed(1)}% dos elegiveis)`);
if (cobertura < MIN_COVERAGE) {
  fail("MINE",
    `cobertura de ${(100 * cobertura).toFixed(1)}% — o miner viu ${varridos} de ${elegiveis} arquivos`,
    `abaixo do minimo de ${100 * MIN_COVERAGE}%. Varredura parcial produz numero que PARECE resultado. ` +
    `Extensoes tentadas: ${extDerivada.join(",")}`);
}
say(`  ${MJ.counts.occurrences} ocorrencias de className · ${MJ.counts.gramRows} n-gramas candidatos`);
say(`  ${MJ.counts.semanticClusters} clusters semanticos -> candidatos a entidade canonica`);
if (stopAt < 2) finish();

/* ─────────────────────────────────────────────────────────────── CLUSTER ── */
// EXTRACT e CLUSTER estao no mesmo script: context-clusters varre e agrupa.

say("\nEXTRACT + CLUSTER");
const clustersFile = path.join(WORK, "clusters.json");
const c = run("context-clusters.mjs", ["--json"], { outFile: clustersFile });
if (!c.ok) {
  fail("CLUSTER",
    c.leitor ? c.err : "context-clusters falhou",
    c.leitor ? "defeito do orquestrador, nao do script" : (c.err?.split("\n")[0] ?? ""));
}
const CL = JSON.parse(readFileSync(clustersFile, "utf8"));
const comNome = CL.clusters.filter((x) => x.proposedName);
const ocorr = comNome.reduce((s, x) => s + x.count, 0);
// Um cluster sem nome derivado tem DUAS causas possiveis, e chamar as duas de
// "sem owner" mente sobre onde esta o bloqueio: o owner pode estar perfeitamente
// resolvido e ainda assim nao haver nome, porque §4.3 da lei nao tem slot para a
// propriedade daquela familia (radius/spacing/tipografia). Uma some com trabalho
// de atribuicao; a outra so some com emenda na lei.
const semSlot = CL.clusters.filter((x) => !x.proposedName && /§4\.3/.test(x.reason ?? ""));
const semOwner = CL.clusters.filter((x) => !x.proposedName && !/§4\.3/.test(x.reason ?? ""));
say(`  ${CL.total} ocorrencias que violam a lei`);
say(`  ${CL.clusters.length} clusters de contexto`);
say(`  ${comNome.length} com nome DERIVADO (${ocorr} ocorrencias, ${((100 * ocorr) / CL.total).toFixed(1)}%)`);
say(`  ${semOwner.length} sem owner no contexto -> fila de IA`);
say(`  ${semSlot.length} sem slot em §4.3 da lei -> LAW GAP, ${semSlot.reduce((s, x) => s + x.count, 0)} ocorrencias`);
if (stopAt < 4) finish();

/* ────────────────────────────────────────────────────────────── CONVERGE ── */

say("\nCONVERGE");
const convFile = path.join(WORK, "converged.json");
const maxU = arg("--max-uncertainty", "30");
const v = run("converge-tokens.mjs", ["--clusters", clustersFile, "--max-uncertainty", maxU, "--json"], { outFile: convFile });
if (!v.ok) {
  fail("CONVERGE",
    v.leitor ? v.err : "converge-tokens falhou",
    v.leitor ? "defeito do orquestrador, nao do script" : (v.err?.split("\n")[0] ?? ""));
}
const CV = JSON.parse(readFileSync(convFile, "utf8"));
if (!CV.convergiu) {
  fail("CONVERGE", `nao convergiu em ${CV.iteracoes} iteracoes`,
    "aumente --max-iter ou investigue oscilacao entre duas fusoes que se desfazem");
}
const outliers = (CV.fusoes ?? []).filter((f) => f.reason === "absorvido-por-outlier").length;
say(`  convergiu em ${CV.iteracoes} iteracoes (duas consecutivas sem mudanca)`);
say(`  ${CV.fusoes.length} fusoes: ${CV.fusoes.length - outliers} por confianca, ${outliers} por outlier`);
say(`  ${(CV.clustersFinais ?? []).length} contratos finais`);
if (stopAt < 5) finish();

/* ──────────────────────────────────────────────────────────────── REPORT ── */

say("\nREPORT");
const r = run("tokenization-report.mjs", ["--clusters", clustersFile, "--converged", convFile], { capture: true });
if (!r.ok) fail("REPORT", "tokenization-report falhou", r.err?.split("\n")[0] ?? "");
for (const linha of (r.out ?? "").trim().split("\n")) say(`  ${linha}`);
if (stopAt < 6) finish();

/* ──────────────────────────────────────────────────────────────── DECIDE ── */

say("\nDECIDE");
const humano = CV.humano ?? [];
if (!humano.length) {
  say("  nada acima do corte — a convergencia resolveu tudo");
} else {
  const presas = humano.reduce((s, h) => s + h.countB, 0);
  say(`  ${humano.length} pares acima de ${maxU}% de incerteza, prendendo ${presas} ocorrencias`);
  say(`  cada um esta no capitulo 3 do relatorio, com a tabela de sinais aberta`);
}

say("\nAPPLY — fase declarada, NAO implementada.");
say("  Nada foi aplicado no codigo. Faltam: criar os tokens no color.tokens.json");
say("  herdando o primitivo dominante, codemod AST nos call sites, e prova de");
say("  pixel. Ate la, este loop entrega proposta e prova, nunca mutacao.");

finish();

function finish() {
  if (JSON_OUT) {
    console.log(JSON.stringify({
      ok: true,
      root: ROOT,
      work: path.relative(ROOT, WORK),
      artifacts: { clusters: "clusters.json", converged: "converged.json" },
      log,
    }, null, 1));
  }
  process.exit(0);
}
