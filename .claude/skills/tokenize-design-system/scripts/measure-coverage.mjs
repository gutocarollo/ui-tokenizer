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
 *
 * A PARTICAO tem QUATRO baldes, nao tres, e a diferenca foi um numero errado de
 * nivel de plano. O balde "tokenizavel fora de entidade" era impresso inteiro
 * como TRABALHO BLOQUEANTE enquanto `emContrato` aparecia como estatistica solta,
 * nunca subtraida de nada. Medido no alvo: 2.295 de 7.978 usos (28,8%) daquele
 * balde sao `placeholder:text-content-tertiary`, `enabled:hover:bg-surface-hover`
 * e afins — classes que JA passam por token nomeado. O balde agora vem quebrado
 * em B1 (ja migrado, nada a fazer) e B2 (utility cru, o trabalho de verdade), e
 * `migravel = A + B2`. Somar A + B, como o plano fazia, cobra de novo trabalho
 * ja feito: 75,9% contra os 68,9% reais. A regra e verificada por
 * `lib/bundle-census.mjs::partition` e travada por
 * `test/bundle-partition.test.mjs`.
 */
import { resolveRoot } from "./lib/paths.mjs";
import { census, partition, EXTS } from "./lib/bundle-census.mjs";

const ROOT = resolveRoot();
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const JSON_OUT = argv.includes("--json");

const MIN_REPEAT = Number(arg("--min-repeat", 2));
const MIN_CLASSES = Number(arg("--min-classes", 4));

/**
 * A REGRA (regex de className, familia tokenizavel, contrato nomeado, criterio de
 * entidade) vive em `lib/bundle-census.mjs`, importada tambem por
 * `propose-entities.mjs`. Duas copias da regra divergem em silencio na primeira
 * correcao — que e exatamente o defeito que este oraculo existe para matar.
 */
const {
  arquivos, bundles, usos, emContrato, atributos, dinamicos,
  contratos, contratosAmbiguos, contratosUsados,
  atributosViaContrato, usosViaContrato, atributosMistos,
  identificadoresNaoResolvidos,
} = census(ROOT);

/**
 * FALHA FECHADA (comprado com prova): denominador vazio NÃO é resultado.
 *
 * Antes deste bloco, um alvo cujos call sites tivessem migrado para
 * `className={NOME}` saía daqui com `usosDeClasse: 0`, `NaN%` no stdout humano e
 * `exit 0` — um JSON bem formado com tudo zero, indistinguível de "não há nada a
 * fazer". É o mesmo modo de falha do "0 fusões" da lib de cor que não resolveu.
 * Zero de denominador agora é ERRO, com o motivo mais provável impresso junto.
 */
if (usos === 0) {
  const naoRes = [...identificadoresNaoResolvidos.entries()].sort((a, b) => b[1].n - a[1].n);
  const linhas = [
    `measure-coverage: DENOMINADOR VAZIO em ${ROOT}`,
    `  arquivos varridos      ${arquivos.length}`,
    `  atributos className    0`,
    `  className dinâmicos    ${dinamicos}`,
    `  contratos indexados    ${contratos.size}`,
    `  identificadores não resolvidos ${naoRes.length}`,
    ``,
    `Zero uso de classe não é cobertura de 100%: é sinal que não resolveu.`,
    naoRes.length
      ? `Prováveis: ${naoRes.slice(0, 8).map(([id, v]) => `${id}(${v.n}×)`).join(", ")} — declare o contrato num arquivo varrido (${[...EXTS].join(", ")}) como \`export const NOME = "classes"\`.`
      : `Verifique --root: nenhum arquivo com className foi encontrado.`,
  ];
  console.error(linhas.join("\n"));
  process.exit(2);
}

/**
 * A partição vem de `lib/bundle-census.mjs`, que verifica A+B+C = usos em vez de
 * afirmar. O balde B vem QUEBRADO em B1 (já em contrato nomeado — nada a fazer)
 * e B2 (utility cru — o trabalho bloqueante). Antes desta correção o balde vinha
 * inteiro rotulado BLOQUEANTE, e 28,8% dele já estava migrado; ver o comentário
 * de `partition()` para a prova medida.
 */
const P = partition({ bundles, usos, emContrato }, MIN_REPEAT, MIN_CLASSES);

/**
 * FALHA FECHADA no cruzamento com a lei. A quebra por família só é útil dizendo
 * quais famílias §4.3 consegue NOMEAR; sem o vocabulário isso viraria uma lista
 * de números sem veredito, e a regra desta corrida é parar quando um sinal não
 * resolve — nunca seguir com ele desligado.
 */
let VOC;
try {
  /**
   * Import DINÂMICO de propósito. `score-naming.mjs` resolve o layout do projeto
   * no corpo do módulo e LANÇA quando o root não tem `src/` — import estático
   * mataria este script com um stack de outro arquivo antes de qualquer linha
   * daqui rodar, e a mensagem abaixo nunca apareceria. Medido: rodar a suíte de
   * `scripts/` como cwd reproduz exatamente esse throw.
   */
  const { readVocabulary } = await import("./score-naming.mjs");
  VOC = readVocabulary();
} catch (e) {
  console.error(
    `measure-coverage: NAO CONSEGUI LER O VOCABULARIO DA LEI (§4.3) em ${ROOT}\n` +
    `  ${e.message}\n` +
    `Sem a lei nao da para dizer quais familias do balde bloqueante tem slot,\n` +
    `e imprimir a quebra sem esse veredito e numero que parece resultado.`
  );
  process.exit(3);
}
const temSlot = (propriedade) => VOC.properties.includes(propriedade);

/** Usos de B2 cuja propriedade §4.3 não sabe nomear — o LAW GAP, quantificado. */
const semSlot = Object.entries(P.tokForaCruPorPropriedade)
  .filter(([prop]) => !temSlot(prop))
  .reduce((s, [, n]) => s + n, 0);

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
  // O veículo desta fase, medido: `const` exportado citado no call site.
  contratosIndexados: contratos.size,
  contratosAmbiguos: contratosAmbiguos.length,
  contratosUsados: contratosUsados.size,
  atributosViaContratoNomeado: atributosViaContrato,
  atributosViaContratoMistos: atributosMistos,
  usosViaContratoNomeado: usosViaContrato,
  identificadoresNaoResolvidos: [...identificadoresNaoResolvidos.entries()]
    .map(([ident, v]) => ({ ident, atributos: v.n, arquivos: v.arquivos.size }))
    .sort((a, b) => b.atributos - a.atributos),
  entidades: P.entidades,
  usosEmEntidade: P.usosEmEntidade,
  usosEmEntidadeJaEmContrato: P.entidadeEmContrato,
  usosTokenizaveisForaDeEntidade: P.usosTokenizaveisForaDeEntidade,
  // O split que faltava. B1 nao e trabalho; so B2 e.
  tokenizavelForaJaEmContrato: P.tokForaEmContrato,
  tokenizavelForaCru: P.tokForaCru,
  tokenizavelForaCruPorFamilia: P.tokForaCruPorFamilia,
  tokenizavelForaCruPorPropriedade: P.tokForaCruPorPropriedade,
  tokenizavelForaCruSemSlotNaLei: semSlot,
  usosSemDisposicao: P.usosSemDisposicao,
  usosSemDisposicaoJaEmContrato: P.semDisposicaoEmContrato,
  // migravel = entidade + tokenizavel CRU. Somar o balde B inteiro conta como
  // trabalho a fazer o que ja esta feito.
  migravel: P.migravel,
  particaoFecha: P.usosEmEntidade + P.usosTokenizaveisForaDeEntidade + P.usosSemDisposicao === usos,
};

if (JSON_OUT) { console.log(JSON.stringify(R, null, 1)); process.exit(0); }

console.log(`measure-coverage · ${ROOT}`);
console.log(`criterio de entidade: repete >= ${MIN_REPEAT} E tem >= ${MIN_CLASSES} classes\n`);
console.log(`  arquivos varridos           ${R.arquivos}`);
console.log(`  atributos className         ${R.atributosClassName}  (+${R.atributosDinamicos} dinamicos)`);
console.log(`  USOS DE CLASSE              ${R.usosDeClasse}   <- o denominador`);
console.log(`  bundles distintos           ${R.bundlesDistintos}\n`);
console.log(`  ja em contrato nomeado      ${R.jaEmContrato}  ${pct(R.jaEmContrato)}`);
console.log(`  via const de contrato       ${R.usosViaContratoNomeado}  ${pct(R.usosViaContratoNomeado)}` +
  `  (${R.atributosViaContratoNomeado} atributos, ${R.contratosUsados}/${R.contratosIndexados} consts)`);
if (R.identificadoresNaoResolvidos.length) {
  const top = R.identificadoresNaoResolvidos.slice(0, 5).map((x) => `${x.ident}(${x.atributos}×)`).join(", ");
  console.log(`  className={IDENT} NAO resolvido ${R.identificadoresNaoResolvidos.reduce((s, x) => s + x.atributos, 0)}` +
    `  <- invisivel ao censo: ${top}`);
}
if (R.contratosAmbiguos) console.log(`  consts AMBIGUAS (mesmo nome, valores diferentes) ${R.contratosAmbiguos}  <- nao resolvidas de proposito`);
console.log(`\n  A PARTICAO (A + B + C = ${R.usosDeClasse}, verificada)\n`);
console.log(`  A. entidade (${R.entidades} bundles)      ${R.usosEmEntidade}  ${pct(R.usosEmEntidade)}   -> contrato de componente`);
console.log(`       destas, ja citam token   ${R.usosEmEntidadeJaEmContrato}  ${pct(R.usosEmEntidadeJaEmContrato)}   (a unidade e o BUNDLE; nao desconto)`);
console.log(`  B. tokenizavel fora de entidade ${R.usosTokenizaveisForaDeEntidade}  ${pct(R.usosTokenizaveisForaDeEntidade)}`);
console.log(`     B1. JA em contrato nomeado ${R.tokenizavelForaJaEmContrato}  ${pct(R.tokenizavelForaJaEmContrato)}   -> NADA A FAZER, ja migrado`);
console.log(`     B2. utility CRU            ${R.tokenizavelForaCru}  ${pct(R.tokenizavelForaCru)}   <- TRABALHO BLOQUEANTE`);
for (const [prop, n] of Object.entries(R.tokenizavelForaCruPorPropriedade).sort((a, b) => b[1] - a[1])) {
  const slot = temSlot(prop) ? "§4.3 nomeia" : "SEM SLOT em §4.3 -> LAW GAP";
  console.log(`           ${String(n).padStart(5)}  ${prop.padEnd(16)} ${slot}`);
}
console.log(`         sem slot na lei          ${semSlot}  ${pct(semSlot)} do denominador, ${((100 * semSlot) / (R.tokenizavelForaCru || 1)).toFixed(1)}% de B2`);
console.log(`  C. sem disposicao -> EXCECAO   ${R.usosSemDisposicao}  ${pct(R.usosSemDisposicao)}`);
console.log(`       destas, ja citam token   ${R.usosSemDisposicaoJaEmContrato}  ${pct(R.usosSemDisposicaoJaEmContrato)}`);
console.log(`\n  MIGRAVEL = A + B2 = ${R.migravel}  ${pct(R.migravel)}`);
console.log(`  (A + B daria ${R.usosEmEntidade + R.usosTokenizaveisForaDeEntidade} / ${pct(R.usosEmEntidade + R.usosTokenizaveisForaDeEntidade)} —`);
console.log(`   e a diferenca de ${R.tokenizavelForaJaEmContrato} usos e trabalho JA FEITO cobrado de novo.)`);
console.log(`\n  disposicao terminal exige que a ultima linha vire fila de excecao`);
console.log(`  com owner/reason/scope/evidence/review, nao "fora de escopo".`);
