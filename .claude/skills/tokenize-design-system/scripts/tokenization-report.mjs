#!/usr/bin/env node
/**
 * tokenization-report.mjs — o relatorio da rodada, com o capitulo de decisao
 * humana separado do que o processo decidiu sozinho.
 *
 * Contrato do §9 do grafo: design artesanal e EVIDENCIA. O relatorio expoe a
 * inconsistencia, nunca a apaga. Por isso ele tem tres capitulos e nao um:
 *
 *   1. o que o processo decidiu SOZINHO, com o sinal que sustentou cada decisao
 *   2. o que ele EXPOS mas nao decidiu — divergencia a olhar, nao a renomear
 *   3. o que precisa de VOCE, com o contexto completo de cada par
 *
 * Um relatorio que so mostra o capitulo 1 vende progresso; um que so mostra o 3
 * transfere ambiguidade crua. Os tres juntos e o que permite decidir.
 *
 * Uso:
 *   node tokenization-report.mjs --root <app> --clusters <c.json> --converged <conv.json> \
 *        [--out docs/reports/<data>-tokenizacao.md]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { resolveRoot } from "./lib/paths.mjs";

const ROOT = resolveRoot();
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const clustersPath = arg("--clusters");
const convergedPath = arg("--converged");
if (!clustersPath || !convergedPath) {
  console.error("uso: --clusters <c.json> --converged <conv.json> [--out <path.md>]");
  process.exit(2);
}
const CL = JSON.parse(readFileSync(clustersPath, "utf8"));
const CV = JSON.parse(readFileSync(convergedPath, "utf8"));

const stamp = arg("--date", new Date().toISOString().slice(0, 10));
const out = path.resolve(ROOT, "..", arg("--out", `docs/reports/${stamp}-tokenizacao-rodada.md`));

/* ------------------------------------------------------------ agregacoes --- */

const comNome = CL.clusters.filter((c) => c.proposedName);
const semNome = CL.clusters.filter((c) => !c.proposedName);
const ocorrComNome = comNome.reduce((s, c) => s + c.count, 0);
const ocorrSemNome = CL.total - ocorrComNome;

const fusoes = CV.fusoes ?? [];
const porConfianca = fusoes.filter((f) => f.reason !== "absorvido-por-outlier");
const porOutlier = fusoes.filter((f) => f.reason === "absorvido-por-outlier");
const humano = CV.humano ?? [];

// divergencia de estado, contada dos clusters (campo cheio, nao da amostra)
const stateDiv = comNome.reduce((s, c) => s + (c.stateDivergences ?? 0), 0);
const clustersComStateDiv = comNome.filter((c) => (c.stateDivergences ?? 0) > 0);

// mapa final token antigo -> nome novo
const mapa = new Map();
for (const c of comNome) {
  for (const t of c.tokens) {
    const k = `${t}`;
    if (!mapa.has(k)) mapa.set(k, new Map());
    mapa.get(k).set(c.proposedName, (mapa.get(k).get(c.proposedName) ?? 0) + c.count);
  }
}

const nomesFinais = new Map();
for (const c of (CV.clustersFinais ?? comNome)) {
  nomesFinais.set(c.proposedName, (nomesFinais.get(c.proposedName) ?? 0) + c.count);
}

/* ---------------------------------------------------------------- saida ---- */

const L = [];
const pct = (n, d) => `${((100 * n) / d).toFixed(1)}%`;

L.push(`# Tokenização — relatório da rodada · ${stamp}`);
L.push("");
L.push(`Alvo: \`${path.relative(path.resolve(ROOT, ".."), ROOT)}\``);
L.push("");
L.push("| | |");
L.push("|---|---:|");
L.push(`| ocorrências que violam a lei | **${CL.total}** |`);
L.push(`| clusters de contexto | ${CL.clusters.length} |`);
L.push(`| com nome derivado da lei | ${comNome.length} clusters · **${ocorrComNome}** ocorrências (${pct(ocorrComNome, CL.total)}) |`);
L.push(`| sem owner no contexto | ${semNome.length} clusters · ${ocorrSemNome} ocorrências (${pct(ocorrSemNome, CL.total)}) |`);
L.push(`| **contratos após convergência** | **${nomesFinais.size}** |`);
L.push(`| iterações até convergir | ${CV.iteracoes}${CV.convergiu ? " (duas consecutivas sem mudança)" : " — NÃO convergiu"} |`);
L.push("");

L.push("## 1. O que o processo decidiu sozinho");
L.push("");
L.push(`**${fusoes.length} fusões** — ${porConfianca.length} por confiança, ${porOutlier.length} absorvidas por outlier.`);
L.push("");
if (CV.historico?.length) {
  L.push("| iteração | clusters | após fusão | fundiu |");
  L.push("|---:|---:|---:|---:|");
  for (const h of CV.historico) L.push(`| ${h.iteracao} | ${h.clusters} | ${h.aposFusao} | ${h.fundiu} |`);
  L.push("");
}
L.push("### Mapa de rename, por token antigo");
L.push("");
L.push("| token antigo | → nome derivado | usos |");
L.push("|---|---|---:|");
for (const [old, destinos] of [...mapa.entries()].sort((a, b) => {
  const sa = [...a[1].values()].reduce((x, y) => x + y, 0);
  const sb = [...b[1].values()].reduce((x, y) => x + y, 0);
  return sb - sa;
})) {
  const ord = [...destinos.entries()].sort((a, b) => b[1] - a[1]);
  for (const [novo, q] of ord.slice(0, 6)) L.push(`| \`${old}\` | \`${novo}\` | ${q} |`);
  if (ord.length > 6) L.push(`| \`${old}\` | _(mais ${ord.length - 6} destinos)_ | |`);
}
L.push("");
if (porOutlier.length) {
  L.push("### Absorvidas por outlier");
  L.push("");
  L.push("Fusões acima do corte de incerteza, aceitas porque o lado absorvido é");
  L.push("ocorrência isolada com cor imperceptivelmente diferente. Cada uma é reversível:");
  L.push("");
  L.push("| contrato | usos absorvidos | confiança | proporção |");
  L.push("|---|---:|---:|---:|");
  for (const f of porOutlier) L.push(`| \`${f.nome}\` | ${f.count} | ${f.confidence}% | ${f.outlierRatio != null ? (100 * f.outlierRatio).toFixed(0) + "%" : "—"} |`);
  L.push("");
}

L.push("## 2. O que o processo EXPÔS e não decidiu");
L.push("");
L.push(`### Divergência de estado — ${stateDiv} usos`);
L.push("");
L.push("Token que **declara** um estado no nome, consumido **sem** o prefixo daquele");
L.push("estado. É fundo estático usando token de interação. Renomear em silêncio");
L.push("apagaria a evidência, então o processo apenas reporta.");
L.push("");
if (clustersComStateDiv.length) {
  L.push("| token | contexto | usos com divergência |");
  L.push("|---|---|---:|");
  for (const c of clustersComStateDiv.sort((a, b) => b.stateDivergences - a.stateDivergences).slice(0, 15)) {
    const s = c.sample;
    L.push(`| \`${c.tokens.join(", ")}\` | \`<${s.tag ?? "?"}>\` em ${s.component} | ${c.stateDivergences} |`);
  }
  L.push("");
  const ex = clustersComStateDiv.flatMap((c) => c.occurrences.filter((o) => o.divergence)).slice(0, 6);
  if (ex.length) {
    L.push("Exemplos com `path:linha`:");
    L.push("");
    for (const o of ex) L.push(`- \`${o.file}:${o.line}\` — \`${o.prefix}-${o.token}\``);
    L.push("");
  }
}
const comSpread = comNome.filter((c) => (c.valueSpread ?? 1) > 1);
if (comSpread.length) {
  L.push(`### Divergência de valor dentro do cluster — ${comSpread.length} clusters`);
  L.push("");
  L.push("Ocorrências do mesmo contexto que hoje usam valores físicos diferentes. O");
  L.push("dominante foi adotado; o resto está registrado, não renomeado.");
  L.push("");
  L.push("| contexto | valores distintos | ocorrências divergentes |");
  L.push("|---|---:|---:|");
  for (const c of comSpread.sort((a, b) => b.divergentCount - a.divergentCount).slice(0, 10)) {
    L.push(`| \`${c.proposedName}\` em ${c.sample.component} | ${c.valueSpread} | ${c.divergentCount} |`);
  }
  L.push("");
}

L.push("## 3. O que precisa de você");
L.push("");
if (!humano.length) {
  L.push("Nada nesta rodada — a convergência resolveu tudo acima do corte.");
} else {
  const presas = humano.reduce((s, h) => s + h.countB, 0);
  L.push(`**${humano.length} pares**, prendendo **${presas}** de ${ocorrComNome} ocorrências (${pct(presas, ocorrComNome)}).`);
  L.push("");
  L.push("Em todos, a **cor diz que é a mesma coisa** e a **função diz que não é**.");
  L.push("O processo não decide isso porque a evidência aponta para os dois lados.");
  L.push("");
  for (const [i, h] of humano.entries()) {
    L.push(`### D${i + 1} — \`${h.nome}\`: um contrato ou dois?`);
    L.push("");
    L.push(`Incerteza **${h.uncertainty}%** (corte 30%).`);
    L.push("");
    L.push(`- **A** — ${h.a.split("|")[3].trim()} · \`<${h.a.split("|")[1].trim()}>\` · **${h.countA} usos**`);
    L.push(`- **B** — ${h.b.split("|")[3].trim()} · \`<${h.b.split("|")[1].trim()}>\` · **${h.countB} usos**`);
    L.push("");
    L.push("| sinal | pontos | leitura |");
    L.push("|---|---:|---|");
    for (const s of h.signals) L.push(`| ${s.name} | ${Math.round(s.weight * s.score)}/${s.weight} | ${s.note} |`);
    L.push("");
  }
}

L.push("---");
L.push("");
L.push("## Como ler os números");
L.push("");
L.push("- **Nada foi aplicado no código.** Este relatório é a proposta; os tokens");
L.push("  novos ainda não existem no `color.tokens.json` e nenhum call site mudou.");
L.push("- Cada fusão carrega o sinal que a sustentou: cor (ΔE2000), contrato, ");
L.push("  similaridade de componente, força do sinal de owner e função.");
L.push("- Convergência = duas iterações consecutivas sem nenhuma fusão. É o limite");
L.push("  do que a evidência decide sozinha.");

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, L.join("\n") + "\n");
console.log(`relatorio: ${path.relative(path.resolve(ROOT, ".."), out)}`);
console.log(`  cap.1 decidido sozinho : ${fusoes.length} fusoes (${porOutlier.length} por outlier)`);
console.log(`  cap.2 exposto          : ${stateDiv} divergencias de estado, ${comSpread.length} clusters com valor divergente`);
console.log(`  cap.3 para o dono      : ${humano.length} pares, ${humano.reduce((s, h) => s + h.countB, 0)} ocorrencias`);
