#!/usr/bin/env node
/**
 * measure-coverage.mjs — o denominador, pinado.
 *
 *     node measure-coverage.mjs --root <app> [--json]
 *
 * Por que existe: o plano afirmava "32.662 usos de classe", "17,9% já em
 * contrato", "68,9% de cobertura por entidade". Uma review adversarial reproduziu
 * e chegou a 29.897 / 14,8% / 68,9% — mesma ordem, critérios diferentes. Nenhum
 * dos dois estava mentindo; nenhum dos dois era auditável, porque o critério vivia
 * num script de uma linha que morreu no terminal.
 *
 * Aqui o critério é CÓDIGO VERSIONADO. Quem discordar do número discorda de uma
 * linha que pode apontar, e o número muda junto com a regra — nunca em silêncio.
 *
 * O que ele mede, e o que cada coisa NÃO é:
 *
 *   uso de classe   uma classe num atributo className. NAO e um token.
 *   bundle          o conjunto de classes de um atributo, ORDENADO. Ordenar e a
 *                   normalizacao minima: `flex gap-2` e `gap-2 flex` sao o mesmo
 *                   bundle. Sem isso a contagem de entidade fica subestimada.
 *   entidade        bundle que repete >= MIN_REPEAT E tem >= MIN_CLASSES classes.
 *                   As DUAS condicoes: repeticao sozinha nao separa entidade de
 *                   coincidencia — `flex items-start gap-3` repete 2x e nao e
 *                   componente nenhum.
 *   em contrato     uso cuja classe referencia um token nomeado do design system.
 *
 * O criterio de "entidade" e o achado que corrigiu a meta do plano: dentro da
 * banda de 2 repeticoes, bundles de ate 3 classes sao coocorrencia incidental
 * (99 deles, 1,4% do universo), enquanto os de 7+ classes sao componentes reais
 * (77 deles, 4,9%). Contar os dois juntos inflava a meta.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { resolveRoot } from "./lib/paths.mjs";

const ROOT = resolveRoot();
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const JSON_OUT = argv.includes("--json");

const MIN_REPEAT = Number(arg("--min-repeat", 2));
const MIN_CLASSES = Number(arg("--min-classes", 4));

const EXTS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const SKIP = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", ".tokenize"]);

/**
 * Captura className em tres formas. A quarta forma — `className={cond ? a : b}` —
 * cai parcialmente aqui pelos literais internos; o que escapar e contado em
 * `dinamicos` e NAO some do relatorio. Ocorrencia invisivel que nao aparece em
 * lugar nenhum e como o censo mente.
 */
const CLS = /className\s*=\s*(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g;
const DYN = /className\s*=\s*\{/g;

/** Familias que um design system NOMEIA. `flex`/`absolute` nao entram: sao composicao. */
const TOKENIZAVEL = /^(?:hover:|focus:|active:|group-hover:|dark:|light:|disabled:|focus-visible:|sm:|md:|lg:|xl:|2xl:)*-?(?:bg|text|border|ring|shadow|fill|stroke|outline|divide|accent|caret|placeholder|p|m|gap|space|rounded|font|leading|tracking)(?:-|$)/;

/** Uso que ja passa por contrato: a classe cita um token nomeado do DS. */
const EM_CONTRATO = /-(?:theme|surface|content|primary-button|secondary|menu-item|modal|sidebar|chat|checklist-item|search-input|file-row|workspace-item)(?:-|$)/;

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXTS.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

const arquivos = walk(ROOT);
const bundles = new Map();   // chave ordenada -> { n, classes }
let usos = 0, emContrato = 0, atributos = 0, dinamicos = 0;

for (const f of arquivos) {
  let t;
  try { t = readFileSync(f, "utf8"); } catch { continue; }
  dinamicos += (t.match(DYN) ?? []).length;
  for (const m of t.matchAll(CLS)) {
    const bruto = [m[1], m[2], m[3]].filter(Boolean).join(" ");
    const cs = bruto.split(/\s+/).filter((c) => c && !c.startsWith("$") && !c.includes("${"));
    if (!cs.length) continue;
    atributos++;
    usos += cs.length;
    for (const c of cs) if (EM_CONTRATO.test(c)) emContrato++;
    const k = [...cs].sort().join(" ");
    const cur = bundles.get(k) ?? { n: 0, classes: cs };
    cur.n++;
    bundles.set(k, cur);
  }
}

const ent = [...bundles.entries()].filter(([, v]) => v.n >= MIN_REPEAT && v.classes.length >= MIN_CLASSES);
const usosEnt = ent.reduce((s, [, v]) => s + v.classes.length * v.n, 0);

// tokenizavel FORA de entidade — o eixo B, que e bloqueante
let usosTokFora = 0;
for (const [k, v] of bundles) {
  if (v.n >= MIN_REPEAT && v.classes.length >= MIN_CLASSES) continue;
  for (const c of v.classes) if (TOKENIZAVEL.test(c)) usosTokFora += v.n;
}
const resto = usos - usosEnt - usosTokFora;

const pct = (n) => `${((100 * n) / usos).toFixed(1)}%`;
const R = {
  root: ROOT,
  criterio: { minRepeat: MIN_REPEAT, minClasses: MIN_CLASSES },
  arquivos: arquivos.length,
  atributosClassName: atributos,
  atributosDinamicos: dinamicos,
  usosDeClasse: usos,
  bundlesDistintos: bundles.size,
  jaEmContrato: emContrato,
  entidades: ent.length,
  usosEmEntidade: usosEnt,
  usosTokenizaveisForaDeEntidade: usosTokFora,
  usosSemDisposicao: resto,
};

if (JSON_OUT) { console.log(JSON.stringify(R, null, 1)); process.exit(0); }

console.log(`measure-coverage · ${ROOT}`);
console.log(`criterio de entidade: repete >= ${MIN_REPEAT} E tem >= ${MIN_CLASSES} classes\n`);
console.log(`  arquivos varridos           ${R.arquivos}`);
console.log(`  atributos className         ${R.atributosClassName}  (+${R.atributosDinamicos} dinamicos)`);
console.log(`  USOS DE CLASSE              ${R.usosDeClasse}   <- o denominador`);
console.log(`  bundles distintos           ${R.bundlesDistintos}\n`);
console.log(`  ja em contrato nomeado      ${R.jaEmContrato}  ${pct(R.jaEmContrato)}`);
console.log(`  entidades (${R.entidades})            ${R.usosEmEntidade}  ${pct(R.usosEmEntidade)}`);
console.log(`  tokenizavel fora de entidade ${R.usosTokenizaveisForaDeEntidade}  ${pct(R.usosTokenizaveisForaDeEntidade)}`);
console.log(`  sem disposicao -> EXCECAO   ${R.usosSemDisposicao}  ${pct(R.usosSemDisposicao)}`);
console.log(`\n  disposicao terminal exige que a ultima linha vire fila de excecao`);
console.log(`  com owner/reason/scope/evidence/review, nao "fora de escopo".`);
