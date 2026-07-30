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
 *
 * Uso:
 *   node tokenize.mjs --root <app>                    # loop completo
 *   node tokenize.mjs --root <app> --until CLUSTER    # para numa fase
 *   node tokenize.mjs --root <app> --max-uncertainty 25
 *   node tokenize.mjs --root <app> --json
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const PHASES = ["PREFLIGHT", "EXTRACT", "CLUSTER", "CONVERGE", "REPORT", "DECIDE"];
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

function run(script, args, { capture = false } = {}) {
  const r = spawnSync(process.execPath, [path.join(HERE, script), "--root", ROOT, ...args], {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"],
  });
  if (r.error) return { ok: false, err: r.error.message };
  return { ok: r.status === 0, code: r.status, out: r.stdout, err: r.stderr };
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

/* ─────────────────────────────────────────────────────────────── CLUSTER ── */
// EXTRACT e CLUSTER estao no mesmo script: context-clusters varre e agrupa.

say("\nEXTRACT + CLUSTER");
const clustersFile = path.join(WORK, "clusters.json");
const c = run("context-clusters.mjs", ["--json"], { capture: true });
if (!c.ok || !c.out) fail("CLUSTER", "context-clusters falhou", c.err?.split("\n")[0] ?? "");
writeFileSync(clustersFile, c.out);
const CL = JSON.parse(c.out);
const comNome = CL.clusters.filter((x) => x.proposedName);
const ocorr = comNome.reduce((s, x) => s + x.count, 0);
say(`  ${CL.total} ocorrencias que violam a lei`);
say(`  ${CL.clusters.length} clusters de contexto`);
say(`  ${comNome.length} com nome DERIVADO (${ocorr} ocorrencias, ${((100 * ocorr) / CL.total).toFixed(1)}%)`);
say(`  ${CL.clusters.length - comNome.length} sem owner no contexto -> fila de IA`);
if (stopAt < 3) finish();

/* ────────────────────────────────────────────────────────────── CONVERGE ── */

say("\nCONVERGE");
const convFile = path.join(WORK, "converged.json");
const maxU = arg("--max-uncertainty", "30");
const v = run("converge-tokens.mjs", ["--clusters", clustersFile, "--max-uncertainty", maxU, "--json"], { capture: true });
if (!v.ok || !v.out) fail("CONVERGE", "converge-tokens falhou", v.err?.split("\n")[0] ?? "");
writeFileSync(convFile, v.out);
const CV = JSON.parse(v.out);
if (!CV.convergiu) {
  fail("CONVERGE", `nao convergiu em ${CV.iteracoes} iteracoes`,
    "aumente --max-iter ou investigue oscilacao entre duas fusoes que se desfazem");
}
const outliers = (CV.fusoes ?? []).filter((f) => f.reason === "absorvido-por-outlier").length;
say(`  convergiu em ${CV.iteracoes} iteracoes (duas consecutivas sem mudanca)`);
say(`  ${CV.fusoes.length} fusoes: ${CV.fusoes.length - outliers} por confianca, ${outliers} por outlier`);
say(`  ${(CV.clustersFinais ?? []).length} contratos finais`);
if (stopAt < 4) finish();

/* ──────────────────────────────────────────────────────────────── REPORT ── */

say("\nREPORT");
const r = run("tokenization-report.mjs", ["--clusters", clustersFile, "--converged", convFile], { capture: true });
if (!r.ok) fail("REPORT", "tokenization-report falhou", r.err?.split("\n")[0] ?? "");
for (const linha of (r.out ?? "").trim().split("\n")) say(`  ${linha}`);
if (stopAt < 5) finish();

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
