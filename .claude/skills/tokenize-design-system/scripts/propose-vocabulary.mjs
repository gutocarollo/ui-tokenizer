#!/usr/bin/env node
/**
 * propose-vocabulary.mjs — GERA o contrato de vocabulário de layout (estrato 6).
 *
 *   node propose-vocabulary.mjs --root <app> [--out <md>] [--write] [--allow-degraded]
 *   node propose-vocabulary.mjs --root <app> --json
 *
 * O documento é GERADO, nunca escrito à mão. Um contrato de 136 classes com
 * contagem de uso, mantido a mão, está errado no dia seguinte — e um contrato
 * errado é pior que nenhum, porque o lint passa a enforçar ficção. Aqui o
 * documento é função pura de uma saída de `measure-disposition`, e carrega a
 * própria procedência (universo, sha do oráculo, estado do CSS buildado).
 *
 * ── FALHA FECHADA (a regra que mais importa neste script) ───────────────────
 *
 * Quando o CSS buildado NÃO carrega, o estrato 4 vira PISO e o 6 absorve a
 * diferença: classes que são consumo de token do app (`duration-fast`,
 * `placeholder:text-content-tertiary`) reaparecem como "vocabulário de layout".
 * MEDIDO SOBRE A MESMA FONTE, com a única variável sendo o CSS buildado — os
 * dois lados saem do campo `refinamentoEstrato4` de UMA execução do oráculo,
 * justamente para o delta não misturar "mudou o CSS" com "mudou o código":
 *
 *     CSS buildado OK  ->  estrato 6 = 136 classes / 5.469 usos
 *     CSS buildado NÃO ->  estrato 6 = 151 classes / 5.658 usos
 *
 * São 15 classes e 189 usos de diferença. Congelá-las no contrato seria declarar token
 * como não-token e travar isso num ratchet — o falso-verde exato que o
 * refinamento do estrato 4 existe para matar. Então: sem CSS buildado, este
 * script RECUSA a escrever (exit 3). `--allow-degraded` existe para inspeção e
 * carimba o documento como NÃO-CANÔNICO.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { carregarCssBuildado } from "./lib/tailwind-built-css.mjs";
import {
  RAZAO_POR_FAMILIA, analisarClasse, tokenNomeadoInlinado,
} from "./lib/vocabulary-contract.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ROOT = path.resolve(arg("--root", "."));
const FROM = arg("--from", null);
const WRITE = argv.includes("--write");
const JSON_OUT = argv.includes("--json");
const DEGRADADO_OK = argv.includes("--allow-degraded");
const OUT = path.resolve(ROOT, arg("--out", "docs/design-system/VOCABULARIO-LAYOUT.md"));
/**
 * `--snapshot` e `--procedencia` existem porque a MEDIDA e a ENTREGA podem morar
 * em lugares diferentes. Nesta sessao o worktree do alvo foi levado por um
 * `git stash push` de uma sessao concorrente no meio da medicao, e a unica forma
 * honesta de medir um estado ESTAVEL foi materializar o commit do stash num
 * diretorio somente-leitura e rodar o oraculo la. O documento tem entao de dizer
 * CONTRA O QUE foi medido, em vez de fingir que saiu do worktree de quem le.
 */
const SNAP_OUT = path.resolve(ROOT, arg("--snapshot", ".tokenize/vocabulario-snapshot.json"));
const PROCEDENCIA = arg("--procedencia", null);

/** owner/scope/review vêm de fora — o script não inventa dono. */
const OWNER = arg("--owner", "design-system (dono do repo-alvo)");
const REVIEW = arg("--review", "a cada PR que introduza classe nova no resíduo — o lint bloqueia; aprovar exige registrar aqui");

const ORACULO = path.join(AQUI, "measure-disposition.mjs");

/* ── 1. a medida ────────────────────────────────────────────────────────────── */
let R;
if (FROM) {
  R = JSON.parse(readFileSync(path.resolve(FROM), "utf8"));
} else {
  let saida;
  try {
    saida = execFileSync(process.execPath, [ORACULO, "--root", ROOT, "--json"], {
      encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    console.error(`propose-vocabulary: o oráculo falhou em ${ROOT} — nada foi escrito.`);
    console.error(String(e.stderr || e.message).trim());
    process.exit(2);
  }
  R = JSON.parse(saida);
}
if (!Array.isArray(R.vocabulario) || !Array.isArray(R.excecaoClasses)) {
  console.error(`propose-vocabulary: a saída do oráculo não tem \`vocabulario\`/\`excecaoClasses\`.`);
  console.error(`Versão antiga de measure-disposition.mjs — o contrato não pode ser derivado de um top-15.`);
  process.exit(2);
}

const shaOraculo = createHash("sha256").update(readFileSync(ORACULO)).digest("hex").slice(0, 12);

/* ── 2. o CSS gerado, de onde saem família e auto-ataque ────────────────────── */
const built = await carregarCssBuildado(ROOT);
if (!built.disponivel && !DEGRADADO_OK) {
  console.error(`propose-vocabulary: PAROU — CSS buildado indisponível em ${ROOT}.`);
  console.error(`  motivo: ${built.motivo}`);
  console.error(`Sem ele o estrato 4 é PISO e o estrato 6 INCHA com classes que são consumo`);
  console.error(`de token do app. Congelar isso no contrato declara token como não-token e o`);
  console.error(`ratchet passa a defender o erro. Conserte o CSS de entrada, ou use`);
  console.error(`--allow-degraded para inspecionar (o documento sai marcado NÃO-CANÔNICO).`);
  process.exit(3);
}

const todas = [
  ...R.vocabulario.map((x) => ({ ...x, estrato: 6 })),
  ...R.excecaoClasses.map((x) => ({ ...x, estrato: 7 })),
];
const veredito = built.disponivel ? built.classificar(todas.map((x) => x.classe)) : new Map();

const linhas = todas.map((x) => {
  const css = built.disponivel ? (veredito.get(x.classe)?.css ?? null) : null;
  const a = analisarClasse(css, x.classe);
  const tokenInline = built.disponivel ? tokenNomeadoInlinado(x.classe, built.varsDoApp) : null;
  return { ...x, ...a, css, tokenInline };
});

/* ── 3. auto-ataque: quantas destas DEVERIAM ser token ──────────────────────── */
/**
 * BALDE ÚNICO POR CLASSE, por PRECEDÊNCIA — não três filtros independentes.
 *
 * A primeira versão eram três `filter` separados mais um "o que sobra", e o
 * fail-closed logo abaixo a reprovou na primeira execução contra a fixture:
 * 11 != 10. A causa é real e não é detalhe de contagem — `z-tooltip` casa DOIS
 * predicados ao mesmo tempo: o motor não emite regra para ela (`gera:false`) E
 * o nome dela é o de um token do app (`--z-tooltip`). Somar os baldes contava
 * a classe duas vezes; um relatório de auto-ataque que não fecha é exatamente o
 * tipo de número que este trabalho existe para não produzir.
 *
 * A precedência começa por `naoGeraCss` porque esse é o fato mais forte que se
 * pode ter sobre uma classe: o motor do próprio app não emite NADA para ela.
 * O caso combinado (não gera E tem nome de token) é ele mesmo um achado — o
 * token existe no tema mas a utility não é gerada — e sai declarado, em vez de
 * escondido dentro de um total que não bate.
 */
function balde(l) {
  if (!l.gera) return "naoGeraCss";
  if (l.tokenInline) return "tokenNomeadoInlinado";
  if (l.escalas.length) return "quantidadeDeEscala";
  return "estrutural";
}
const ataque = { tokenNomeadoInlinado: [], quantidadeDeEscala: [], naoGeraCss: [] };
const estrutural = [];
const baldes = { ...ataque, estrutural };
for (const l of linhas) baldes[balde(l)].push(l);
/** o combinado (não gera E nomeia token) — declarado, não escondido. */
const mortasComNomeDeToken = ataque.naoGeraCss.filter((l) => l.tokenInline);
const soma = (xs) => xs.reduce((s, x) => s + x.usos, 0);

/** fail-closed do próprio auto-ataque: os 4 baldes têm de fechar o resíduo. */
const totalResiduo = soma(linhas);
const totalBaldes = soma(ataque.tokenNomeadoInlinado) + soma(ataque.quantidadeDeEscala)
  + soma(ataque.naoGeraCss) + soma(estrutural);
if (totalBaldes !== totalResiduo) {
  console.error(`propose-vocabulary: PAROU — auto-ataque não fecha (${totalBaldes} != ${totalResiduo}).`);
  process.exit(1);
}

/* ── 4. famílias ────────────────────────────────────────────────────────────── */
const familias = new Map();
for (const l of linhas) {
  const f = familias.get(l.familia) ?? { nome: l.familia, classes: [], usos: 0 };
  f.classes.push(l); f.usos += l.usos; familias.set(l.familia, f);
}
const ordemFamilias = [...familias.values()].sort((a, b) => b.usos - a.usos);
for (const f of ordemFamilias) f.classes.sort((a, b) => b.usos - a.usos || a.classe.localeCompare(b.classe));

const naoClassificadas = familias.get("nao-classificada");
if (naoClassificadas) {
  console.error(`propose-vocabulary: PAROU — ${naoClassificadas.classes.length} classes sem família:`);
  console.error(`  ${naoClassificadas.classes.slice(0, 12).map((c) => `${c.classe} [${c.propriedades.join(",")}]`).join(" · ")}`);
  console.error(`Família "outros" seria o balde onde a próxima propriedade nova se esconde.`);
  console.error(`Declare a propriedade em lib/vocabulary-contract.mjs (FAMILIA_POR_PROPRIEDADE).`);
  process.exit(1);
}

if (JSON_OUT) {
  console.log(JSON.stringify({
    root: ROOT, universo: R.universo, shaOraculo,
    cssBuildado: { disponivel: built.disponivel, motivo: built.motivo, versao: built.tailwindVersao },
    residuo: { classes: linhas.length, usos: totalResiduo },
    estrato6: R.estratos.vocabularioLayout, estrato7: { classes: R.excecaoClasses.length, usos: R.estratos.excecaoItemAItem.usos },
    familias: ordemFamilias.map((f) => ({ familia: f.nome, classes: f.classes.length, usos: f.usos })),
    autoAtaque: {
      tokenNomeadoInlinado: { classes: ataque.tokenNomeadoInlinado.length, usos: soma(ataque.tokenNomeadoInlinado), itens: ataque.tokenNomeadoInlinado.map((l) => ({ classe: l.classe, usos: l.usos, token: l.tokenInline })) },
      quantidadeDeEscala: { classes: ataque.quantidadeDeEscala.length, usos: soma(ataque.quantidadeDeEscala), itens: ataque.quantidadeDeEscala.map((l) => ({ classe: l.classe, usos: l.usos, escalas: l.escalas })) },
      naoGeraCss: { classes: ataque.naoGeraCss.length, usos: soma(ataque.naoGeraCss), itens: ataque.naoGeraCss.map((l) => ({ classe: l.classe, usos: l.usos })) },
      estrutural: { classes: estrutural.length, usos: soma(estrutural) },
    },
    vocabulario: linhas.map((l) => ({ classe: l.classe, usos: l.usos, familia: l.familia, estrato: l.estrato })),
  }, null, 1));
  process.exit(0);
}

/* ── 5. o documento ─────────────────────────────────────────────────────────── */
const pc = (n) => `${((100 * n) / R.universo).toFixed(1)}%`;
const tab = (l) => `${l.classe}\t${l.usos}\t${l.familia}\t${l.estrato}`;
const md = [];
const p = (s = "") => md.push(s);

p(`# Contrato de vocabulário de layout`);
p();
p(`> **GERADO — não editar à mão.** Este documento é a saída de`);
p(`> \`propose-vocabulary.mjs\`, que é função pura de \`measure-disposition.mjs\`.`);
p(`> Editar uma contagem aqui não muda o código; muda só a ficção que o lint`);
p(`> enforça. Para regenerar, veja *Como regenerar* no fim.`);
p();
if (!built.disponivel) {
  p(`> ## ⛔ NÃO-CANÔNICO — gerado com \`--allow-degraded\``);
  p(`> O CSS buildado não carregou (\`${built.motivo}\`). Nesse estado o estrato 4`);
  p(`> vira PISO e este vocabulário INCHA com classes que são consumo de token do`);
  p(`> app. **Não use este documento como baseline de ratchet.**`);
  p();
}
if (PROCEDENCIA) {
  p(`> **Procedência da medida:** ${PROCEDENCIA}`);
  p();
}
p(`## O que este documento dispõe, e por que ele não é burocracia`);
p();
p(`\`flex\`, \`items-center\` e \`w-full\` **não são violação de design system** — são`);
p(`o uso canônico de utility-first, e tokenizá-las é anti-padrão. Mas chamá-las de`);
p(`"exceção item a item" também estava errado: são **${R.estratos.vocabularioLayout.classes} classes** cobrindo 95% do`);
p(`resíduo, com distribuição Zipf. Isso não é caos — é um **vocabulário fechado**`);
p(`pequeno, e a disposição correta de um vocabulário fechado é um **contrato em`);
p(`bloco**: um documento, cinco chaves por família, e um ratchet que só deixa o`);
p(`conjunto encolher.`);
p();
p(`| | classes | usos | % do universo |`);
p(`|---|---:|---:|---:|`);
p(`| estrato 6 — vocabulário (95% do resíduo) | ${R.estratos.vocabularioLayout.classes} | ${R.estratos.vocabularioLayout.usos} | ${pc(R.estratos.vocabularioLayout.usos)} |`);
p(`| estrato 7 — fila de exceção item-a-item | ${R.excecaoClasses.length} | ${R.estratos.excecaoItemAItem.usos} | ${pc(R.estratos.excecaoItemAItem.usos)} |`);
p(`| **resíduo total — o objeto do ratchet** | **${linhas.length}** | **${totalResiduo}** | **${pc(totalResiduo)}** |`);
p();
p(`### Por que o ratchet enforça 6 ∪ 7, e não só o 6`);
p();
p(`A fronteira entre 6 e 7 é um corte **cumulativo de 95% do resíduo** — não a`);
p(`natureza da classe. Ela se move sozinha: quando uma classe do topo encolhe, o`);
p(`denominador cai e uma classe da cauda atravessa a fronteira sem que ninguém`);
p(`tenha escrito uma linha. Um guard ancorado só no estrato 6 acusaria "classe`);
p(`nova" por deslizamento estatístico, e guard que dá falso alarme é guard que o`);
p(`time desliga. O ratchet enforça a **união**; o documento mostra as duas metades`);
p(`porque elas têm política de revisão diferente.`);
p();

p(`## O ratchet`);
p();
p(`1. **O conjunto só encolhe.** Classe presente no resíduo e ausente deste`);
p(`   documento **reprova o lint** (exit 1). Aprovar exige decisão humana e uma`);
p(`   regeneração explícita deste arquivo.`);
p(`2. **Uso não é vocabulário.** \`flex\` passar de ${linhas[0]?.usos ?? "N"} para o dobro de usos`);
p(`   não reprova nada: é o app crescendo dentro do vocabulário aprovado, que é o`);
p(`   resultado desejado. O ratchet é sobre **cardinalidade do conjunto**.`);
p(`3. **Remoção passa e é reportada.** Encolher é o objetivo.`);
p(`4. **Sem CSS buildado o lint PARA (exit 3), não passa.** Medido sobre a MESMA`);
p(`   fonte, com o CSS buildado como única variável (campo \`refinamentoEstrato4\``);
p(`   de uma execução só do oráculo): com CSS buildado o estrato 6 tem`);
p(`   ${R.refinamentoEstrato4?.depois?.vocabularioClasses ?? "?"} classes e ${R.refinamentoEstrato4?.depois?.vocabularioLayout ?? "?"} usos; sem ele,`);
p(`   ${R.refinamentoEstrato4?.antes?.vocabularioClasses ?? "?"} classes e ${R.refinamentoEstrato4?.antes?.vocabularioLayout ?? "?"} usos. As ${(R.refinamentoEstrato4?.antes?.vocabularioClasses ?? 0) - (R.refinamentoEstrato4?.depois?.vocabularioClasses ?? 0)} de diferença são`);
p(`   consumo de token do app (\`duration-fast\`, \`placeholder:text-content-tertiary\`)`);
p(`   que reaparece como "layout". Um lint que passasse nesse estado congelaria`);
p(`   token como não-token.`);
p();

p(`## O vocabulário, por família semântica`);
p();
p(`A família **não vem do prefixo do nome** — vem da **propriedade CSS que a**`);
p(`**classe gera**, lida do motor do Tailwind (\`@tailwindcss/node\`${built.tailwindVersao ? ` ${built.tailwindVersao}` : ""}). Agrupar`);
p(`por grafia colocaria \`truncate\` (que gera \`overflow\`+\`text-overflow\`+`);
p(`\`white-space\`) em lugar nenhum e separaria \`size-4\` de \`w-4\`/\`h-4\`.`);
p();
p(`As **cinco chaves** (\`owner\`, \`reason\`, \`scope\`, \`evidence\`, \`review policy\`)`);
p(`são declaradas **em bloco por família** — não por classe. Uma exceção por`);
p(`classe para \`justify-end\` seria papelada sem informação: a razão de`);
p(`\`justify-end\` não ser token é *idêntica* à de \`justify-center\`. A unidade de`);
p(`decisão é a família; a unidade de enforcement é a classe.`);
p();

for (const f of ordemFamilias) {
  const est6 = f.classes.filter((c) => c.estrato === 6);
  const est7 = f.classes.filter((c) => c.estrato === 7);
  p(`### \`${f.nome}\` — ${f.classes.length} classes · ${f.usos} usos · ${pc(f.usos)} do universo`);
  p();
  p(`- **owner:** ${OWNER}`);
  p(`- **reason:** ${RAZAO_POR_FAMILIA[f.nome] ?? "(sem razão declarada — declare em lib/vocabulary-contract.mjs)"}`);
  p(`- **scope:** as ${f.classes.length} classes listadas abaixo, e só elas; ${est6.length} no estrato 6, ${est7.length} na fila de exceção.`);
  p(`- **evidence:** \`measure-disposition.mjs --root . --json\` (universo ${R.universo}, sha \`${shaOraculo}\`);`);
  p(`  a propriedade CSS de cada classe vem de \`candidatesToCss\` do motor real do alvo.`);
  p(`- **review policy:** ${REVIEW}`);
  p();
  p(`| classe | usos | estrato | CSS gerado |`);
  p(`|---|---:|:---:|---|`);
  for (const c of f.classes) {
    const css = c.css ? c.css.replace(/\s+/g, " ").replace(/^\.[^{]*\{/, "").replace(/\}\s*$/, "").trim() : "—";
    p(`| \`${c.classe}\` | ${c.usos} | ${c.estrato} | \`${css.length > 90 ? `${css.slice(0, 87)}...` : css}\` |`);
  }
  p();
}

/* ── 6. auto-ataque, no documento ───────────────────────────────────────────── */
p(`## Ataque a este próprio contrato: quantas destas deveriam ser TOKEN?`);
p();
p(`A pergunta honesta contra um contrato de vocabulário é se ele está sendo usado`);
p(`para dar anistia a decisão de design cravada em número cru. \`w-60\` aparece`);
p(`${linhas.find((l) => l.classe === "w-60")?.usos ?? "?"}×; isso não é "uma largura qualquer" — é a largura da sidebar.`);
p();
p(`O critério é mecânico, lido do CSS gerado, e separa **quantidade de escala**`);
p(`(o valor foi escolhido de uma escala e poderia ter sido outro) de **relação**`);
p(`(o valor é determinado pelo contexto — \`100%\`, \`auto\`, \`0\`, \`100vh\`, \`1/2\`,`);
p(`palavra-chave). \`w-full\` não é "largura 100% em vez de 90%": é "a largura do`);
p(`pai". \`w-60\` é \`calc(var(--spacing) * 60)\` — passo 60 de uma escala.`);
p();
p(`| balde | classes | usos | % do resíduo | veredito |`);
p(`|---|---:|---:|---:|---|`);
const pr = (n) => `${((100 * n) / totalResiduo).toFixed(1)}%`;
p(`| token NOMEADO já, com valor inlinado | ${ataque.tokenNomeadoInlinado.length} | ${soma(ataque.tokenNomeadoInlinado)} | ${pr(soma(ataque.tokenNomeadoInlinado))} | **não é vocabulário — é defeito do estrato 4** |`);
p(`| quantidade de escala (candidato a token) | ${ataque.quantidadeDeEscala.length} | ${soma(ataque.quantidadeDeEscala)} | ${pr(soma(ataque.quantidadeDeEscala))} | **sai do vocabulário quando tokenizado** |`);
p(`| não gera CSS nenhum | ${ataque.naoGeraCss.length} | ${soma(ataque.naoGeraCss)} | ${pr(soma(ataque.naoGeraCss))} | âncora de variante / classe externa / no-op |`);
p(`| estrutural — vocabulário de layout de fato | ${estrutural.length} | ${soma(estrutural)} | ${pr(soma(estrutural))} | **fica** |`);
p(`| **total (fecha o resíduo)** | **${linhas.length}** | **${totalResiduo}** | **100,0%** | |`);
p();

if (ataque.tokenNomeadoInlinado.length) {
  p(`### Balde 1 — token nomeado cujo valor o motor INLINOU`);
  p();
  p(`Estas classes **já são consumo de token do app**: o nome da classe É o nome`);
  p(`do token. O detector do estrato 4 as perde porque exige \`var(--token)\` no CSS`);
  p(`gerado, e o Tailwind resolve o valor em tempo de build — \`z-tooltip\` sai como`);
  p(`\`z-index: 99\`, sem \`var()\` nenhuma. Elas **não pertencem a este contrato**;`);
  p(`pertencem ao estrato 4. Enquanto o detector não for corrigido, ficam listadas`);
  p(`aqui para o ratchet não as tratar como classe nova.`);
  p();
  p(`| classe | usos | token do app que ela consome |`);
  p(`|---|---:|---|`);
  for (const l of ataque.tokenNomeadoInlinado.sort((a, b) => b.usos - a.usos)) p(`| \`${l.classe}\` | ${l.usos} | \`${l.tokenInline}\` |`);
  p();
}

if (ataque.quantidadeDeEscala.length) {
  p(`### Balde 2 — quantidade de escala: candidatos reais a token de dimensão`);
  p();
  p(`Cada uma destas carrega um número escolhido de uma escala. São o alvo do`);
  p(`instrumento 5 (token de dimensão), não deste contrato — mas estão aqui porque`);
  p(`hoje o instrumento 5 só olha \`arbitrary value\` (\`h-[34px]\`), e um passo de`);
  p(`escala escrito na grafia canônica (\`w-60\`) escapa dele.`);
  p();
  p(`| classe | usos | escala | CSS gerado |`);
  p(`|---|---:|---|---|`);
  for (const l of ataque.quantidadeDeEscala.sort((a, b) => b.usos - a.usos)) {
    const css = (l.css ?? "").replace(/\s+/g, " ").replace(/^\.[^{]*\{/, "").replace(/\}\s*$/, "").trim();
    p(`| \`${l.classe}\` | ${l.usos} | ${l.escalas.join("+")} | \`${css.length > 70 ? `${css.slice(0, 67)}...` : css}\` |`);
  }
  p();
}

if (ataque.naoGeraCss.length) {
  p(`### Balde 3 — não gera CSS nenhum`);
  p();
  p(`O motor do alvo não emite regra para estas. São âncora de variante`);
  p(`(\`group\`, \`peer\` — legítimas, existem para \`group-hover:\`), classe de`);
  p(`biblioteca externa, ou erro de digitação que virou no-op silencioso. Um`);
  p(`no-op silencioso não é vocabulário: é código morto que ninguém vê.`);
  p();
  p(`| classe | usos | nomeia token do app? |`);
  p(`|---|---:|---|`);
  for (const l of ataque.naoGeraCss.sort((a, b) => b.usos - a.usos)) {
    p(`| \`${l.classe}\` | ${l.usos} | ${l.tokenInline ? `SIM — \`${l.tokenInline}\` existe no tema, mas a utility nao e gerada` : "nao"} |`);
  }
  p();
  if (mortasComNomeDeToken.length) {
    p(`> **Achado secundario:** ${mortasComNomeDeToken.length} destas nomeiam um token que EXISTE no tema`);
    p(`> e mesmo assim nao geram regra — o token esta declarado e a utility correspondente`);
    p(`> nao e emitida. Isso e defeito de configuracao do tema, nao vocabulario.`);
    p();
  }
}

/* ── 7. bloco de máquina: o documento É a baseline ──────────────────────────── */
p(`## Baseline de máquina`);
p();
p(`O bloco abaixo **é a baseline do ratchet**. Não há arquivo \`.baseline\``);
p(`separado de propósito: baseline em arquivo à parte diverge do documento na`);
p(`primeira pressa, e aí o time lê 136 num lugar e o lint enforça 140 no outro.`);
p(`Uma fonte só. Formato: \`classe\\tusos\\tfamília\\testrato\`.`);
p();
p(`<!-- VOCABULARIO:INICIO -->`);
p("```tsv");
p(`# gerado por propose-vocabulary.mjs · oráculo sha ${shaOraculo} · universo ${R.universo}`);
if (PROCEDENCIA) p(`# procedência: ${PROCEDENCIA}`);
p(`# CSS buildado: ${built.disponivel ? `OK (tailwindcss ${built.tailwindVersao}, entrada ${R.cssBuildado?.entrada ?? "?"})` : `INDISPONÍVEL — ${built.motivo}`}`);
for (const l of linhas) p(tab(l));
p("```");
p(`<!-- VOCABULARIO:FIM -->`);
p();
p(`## Como regenerar`);
p();
p("```bash");
p(`cd <alvo>`);
p(`node <scripts>/propose-vocabulary.mjs --root . --write`);
p("```");
p();
p(`E para enforçar:`);
p();
p("```bash");
p(`node <scripts>/vocabulary-ratchet.mjs --root .            # check  (exit 1 se entrou classe nova)`);
p(`node <scripts>/vocabulary-ratchet.mjs --root . --report   # só imprime, nunca reprova`);
p("```");

const texto = `${md.join("\n")}\n`;
if (WRITE) {
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, texto);
  const snap = SNAP_OUT;
  mkdirSync(path.dirname(snap), { recursive: true });
  writeFileSync(snap, JSON.stringify({
    geradoEm: new Date().toISOString(), root: ROOT, universo: R.universo, shaOraculo,
    cssBuildado: { disponivel: built.disponivel, motivo: built.motivo, versao: built.tailwindVersao },
    residuo: linhas.map((l) => ({ classe: l.classe, usos: l.usos, familia: l.familia, estrato: l.estrato })),
  }, null, 1));
  console.log(`>> ${OUT} — ${linhas.length} classes, ${totalResiduo} usos, ${ordemFamilias.length} famílias`);
  console.log(`>> ${snap}`);
  if (!built.disponivel) console.log(`>> ATENÇÃO: marcado NÃO-CANÔNICO (CSS buildado indisponível)`);
} else {
  process.stdout.write(texto);
}
if (!existsSync(ORACULO)) process.exit(2);
