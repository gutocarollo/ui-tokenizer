#!/usr/bin/env node
/**
 * sample-weight-validation.mjs — F-D0: os pesos sao meus, e ninguem os mediu.
 *
 *     node sample-weight-validation.mjs --root <app> --converged <conv.json>
 *
 * Os pesos `cor 40 · contrato 25 · componente 15 · owner 10 · funcao 10`
 * sustentam 211 fusoes e sairam da minha cabeca. Se estiverem errados, as 211
 * decisoes estao erradas — e nada disso aparece num teste, porque o codigo faz
 * exatamente o que mandei fazer. So um rotulo humano separa "o processo acertou"
 * de "o processo foi consistente com a minha suposicao".
 *
 * Este script emite o formulario. O dono responde UMA pergunta por par —
 * "e o mesmo contrato?" — SEM ver a nota. Ver a nota contamina o rotulo.
 *
 * DUAS ARMADILHAS DE CALIBRACAO, apontadas pela rodada 2 do Planning Loop:
 *
 *   1. A regra original dizia "o par da fila humana conta como acerto se o
 *      processo NAO fundiu". Mas todo par da fila humana e, por definicao, um
 *      par que o processo nao fundiu — eram 10 acertos automaticos, e a barra
 *      efetiva caia de 34/40 para 24/30. Aqui o par da fila so conta como acerto
 *      se o dono CONFIRMAR que a duvida era real.
 *   2. Sem piso por estrato, 10+10+7+7=34 passava com 30% de erro na faixa de
 *      corte 60-70 — exatamente onde o erro mora. Aqui ha piso nessa faixa.
 *
 * DESVIO DECLARADO DO PLANO: o plano pedia 10 por estrato. A distribuicao real
 * nao comporta — o estrato de alta confianca tem 8 fusoes no total e a faixa de
 * corte tem 13. Forcar 10 exigiria inventar pares. Os estratos abaixo seguem o
 * que existe, e o total continua 40.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { resolveRoot } from "./lib/paths.mjs";

const ROOT = resolveRoot();
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const CV = JSON.parse(readFileSync(arg("--converged", path.join(ROOT, ".tokenize/converged.json")), "utf8"));
const out = path.resolve(arg("--out", path.join(ROOT, "docs/reports/validacao-pesos.md")));

/** Amostra deterministica: espacamento uniforme, sem RNG. Rodar duas vezes da o mesmo conjunto. */
function espacado(arr, n) {
  if (arr.length <= n) return [...arr];
  const passo = arr.length / n;
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * passo)]);
}

const fus = [...CV.fusoes].sort((a, b) => b.confidence - a.confidence || String(a.nome).localeCompare(String(b.nome)));
/*
 * Os rotulos sao ANONIMOS de proposito. Uma primeira versao deste script
 * intitulava os grupos "confianca alta (>=85)" e "FAIXA DE CORTE" — o que
 * contamina o rotulo tanto quanto mostrar a nota, porque prepara o dono a
 * confirmar o grupo "alto" e a duvidar do grupo "de corte". O mapeamento
 * grupo->estrato vai para um arquivo de CHAVE separado, que so eu leio na hora
 * de apurar.
 */
const ESTRATOS = [
  { id: "I",   estrato: "confianca alta (>=85)",   itens: espacado(fus.filter((f) => f.confidence >= 85), 8), piso: null },
  { id: "II",  estrato: "confianca media (70-85)", itens: espacado(fus.filter((f) => f.confidence >= 70 && f.confidence < 85), 14), piso: null },
  { id: "III", estrato: "faixa de corte (60-70)",  itens: espacado(fus.filter((f) => f.confidence >= 60 && f.confidence < 70), 10), piso: 7 },
  { id: "IV",  estrato: "fila humana (nao fundiu)", itens: espacado(CV.humano ?? [], 8), piso: null },
];

const total = ESTRATOS.reduce((s, e) => s + e.itens.length, 0);
const L = [];
L.push("# F-D0 — validacao dos pesos da convergencia");
L.push("");
L.push("Os pesos `cor 40 · contrato 25 · componente 15 · owner 10 · funcao 10`");
L.push("sustentam **211 fusoes** e nunca foram medidos. Sairam da minha cabeca.");
L.push("");
L.push("**Responda UMA coisa por par: e o mesmo contrato de token, sim ou nao?**");
L.push("A nota que o processo deu esta OMITIDA de proposito — ve-la contamina o rotulo.");
L.push("");
L.push("| | |");
L.push("|---|---|");
L.push(`| pares | **${total}** |`);
L.push("| limiar de aceite | **>=85%** de concordancia **E** um piso proprio num dos grupos |");
L.push("| se reprovar | as **211 fusoes sao invalidadas**, os pesos sao reajustados por regressao sobre estes rotulos, e a convergencia roda de novo |");
L.push("| bloqueia | `APPLY` — nada e escrito no codigo com pesos reprovados |");
L.push("");
L.push("> **Os grupos sao anonimos de proposito.** Saber que um par veio da faixa de");
L.push("> alta confianca prepara voce a confirmar, e saber que veio da faixa de corte");
L.push("> prepara voce a duvidar — os dois contaminam o rotulo do mesmo jeito que ver a");
L.push("> nota. O mapeamento fica numa chave separada, aberta so na apuracao.");
L.push("");
L.push("---");
L.push("");

let n = 0;
for (const e of ESTRATOS) {
  L.push(`## Grupo ${e.id}`);
  L.push("");
  for (const it of e.itens) {
    n++;
    const ctxA = it.a ?? null, ctxB = it.b ?? null;
    L.push(`### ${n}. \`${it.nome}\``);
    L.push("");
    if (ctxA && ctxB) {
      const pa = String(ctxA).split("|").map((x) => x.trim());
      const pb = String(ctxB).split("|").map((x) => x.trim());
      L.push(`- **A** — \`<${pa[1] ?? "?"}>\` em **${pa[3] ?? "?"}** · ${it.countA} usos`);
      L.push(`- **B** — \`<${pb[1] ?? "?"}>\` em **${pb[3] ?? "?"}** · ${it.countB} usos`);
      L.push("");
      L.push("O processo **NAO** fundiu estes dois. Ele deveria ter fundido?");
    } else {
      L.push(`- absorveu **${it.count}** uso(s)${it.reason === "absorvido-por-outlier" ? " — via regra de outlier" : ""}`);
      L.push("");
      L.push("O processo **FUNDIU** estes dois num contrato so. Estava certo?");
    }
    L.push("");
    L.push("`[ ] mesmo contrato    [ ] contratos diferentes    [ ] nao sei dizer`");
    L.push("");
  }
  L.push("---");
  L.push("");
}

L.push("## Como o resultado e lido");
L.push("");
L.push("| voce respondeu | o processo fez | conta como |");
L.push("|---|---|---|");
L.push("| mesmo contrato | fundiu | **acerto** |");
L.push("| contratos diferentes | fundiu | **erro** — fusao indevida |");
L.push("| contratos diferentes | nao fundiu | **acerto** — a duvida era real |");
L.push("| mesmo contrato | nao fundiu | **erro** — deixou de fundir |");
L.push("| nao sei dizer | qualquer | **erro**, conservador: se o dono hesita, o sinal nao era forte |");
L.push("");
L.push("`nao sei dizer` conta como erro de proposito. Um peso que produz decisao");
L.push("que nem o dono do design consegue confirmar nao esta medindo nada util.");

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, L.join("\n") + "\n");

// A CHAVE fica fora do formulario e fora do repo do alvo — em .tokenize/, que e
// area de trabalho. Sem isso a anonimizacao seria teatro.
const chave = path.join(ROOT, ".tokenize/validacao-pesos-chave.json");
writeFileSync(chave, JSON.stringify({
  grupos: ESTRATOS.map((e) => ({ id: e.id, estrato: e.estrato, piso: e.piso, n: e.itens.length })),
  itens: ESTRATOS.flatMap((e) => e.itens.map((it) => ({
    grupo: e.id, nome: it.nome, confidence: it.confidence, tipo: it.a ? "nao-fundiu" : "fundiu",
  }))),
}, null, 1));

console.log(`formulario: ${path.relative(path.resolve(ROOT, ".."), out)}`);
console.log(`chave     : ${path.relative(ROOT, chave)}  (mapeamento grupo->estrato, NAO abrir antes de responder)`);
for (const e of ESTRATOS) console.log(`  grupo ${e.id.padEnd(3)}: ${e.itens.length} pares${e.piso ? ` (piso ${e.piso})` : ""}`);
console.log(`  TOTAL: ${total}`);
