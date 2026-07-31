#!/usr/bin/env node
/**
 * measure-disposition.mjs — a particao COMPLETA: todo uso cai num instrumento.
 *
 *     node measure-disposition.mjs --root <app> [--json]
 *
 * POR QUE EXISTE. O oraculo anterior particionava em 3 estratos e sobravam
 * 24,5% "sem disposicao -> excecao". O dono perguntou onde estava o gargalo
 * para 100%, e a resposta veio de OLHAR A ESTATISTICA do resto em vez de
 * aceitar o rotulo:
 *
 *   - Zipf brutal: 11 classes cobrem 50% do resto; ~192 cobrem 95%.
 *     Mediana de usos por classe = 1, desvio = 59,7. Isso NAO e caos —
 *     e um VOCABULARIO FECHADO pequeno com cauda longa.
 *   - `flex`/`items-center`/`w-full` nao sao violacao: sao o uso CANONICO
 *     de utility-first. Tokenizar `flex` e anti-padrao (ja estabelecido),
 *     mas rotular de "excecao" era fraco: a disposicao certa e um
 *     CONTRATO DE VOCABULARIO — allowlist versionada com owner/reason/
 *     scope/evidence/review EM BLOCO, enforceavel por lint (ratchet:
 *     o vocabulario so encolhe).
 *   - Parte do "resto" JA ERA contrato: classes custom definidas no CSS
 *     proprio (`.tooltip`, `.input-label`, `.popover-ring`). O censo as
 *     contava como sem disposicao — contava o CONTRATO EXISTENTE como
 *     violacao.
 *   - Arbitrary values (`h-[34px]`, `w-[300px]`) sao DECISAO DE DESIGN
 *     cravada — candidatos a token de dimensao, cauda curta.
 *   - E bundles unicos frequentemente CONTEM uma entidade inteira como
 *     subconjunto (drift aditivo, ja medido na familia do input: 80
 *     strings, top1 41%). Composicao nucleo+extras resgata-os.
 *
 * OS 7 INSTRUMENTOS, cada um adequado a natureza estatistica do estrato:
 *
 *   1 entidade exata          bundle >=2x e >=4 classes -> const exportado
 *   2 entidade por composicao bundle unico que CONTEM uma entidade -> cn(NUCLEO, extras)
 *   3 token por familia       cor/spacing/radius/tipografia fora de entidade
 *   4 contrato existente      classe custom definida no CSS proprio
 *   5 token de dimensao       arbitrary value [..] repetido
 *   6 vocabulario de layout   allowlist p/ 95% do residuo, 1 documento, ratchet
 *   7 excecao item-a-item     o que sobra de verdade (~1%)
 *
 * A ORDEM IMPORTA: cada uso cai no PRIMEIRO instrumento que o cobre.
 * Fail-closed: a soma dos 7 tem que bater o universo EXATO, senao exit 1 —
 * particao que nao soma 100% e oraculo mentindo.
 *
 * ── DOIS ORACULOS, UM UNIVERSO SO (corrigido 2026-07-31) ──────────────────────
 *
 * Este script tinha CENSO PROPRIO: `walk(ROOT/src)` + `classNameAttributes`, com
 * o criterio de entidade (`n >= 2 && classes.length >= 4`) escrito a mao aqui
 * dentro. `measure-coverage.mjs` importava `lib/bundle-census.mjs`. Os dois se
 * declaravam particao fail-closed de 100% do MESMO alvo e fechavam em numeros
 * DIFERENTES — 32.114 / 447 entidades contra 31.950 / 444 — porque cada um
 * fechava sobre o seu proprio universo. Fail-closed nao protege contra isso:
 * uma particao fecha perfeitamente sobre um denominador errado.
 *
 * As duas causas candidatas foram medidas SEPARADAS antes da correcao:
 *
 *   (a) `className={CONST}` resolvido para o `const` de contrato ... 164 usos
 *       (26 atributos). So `census()` fazia. Este script lia o atributo como
 *       dinamico e a string do contrato como declaracao — nao como uso.
 *   (b) escopo do walk, ROOT contra ROOT/src ......................... 0 usos
 *       (12 arquivos fora de `src`, nenhum com `className` literal).
 *
 *   32.114 − 164 − 0 = 31.950, exato. A divergencia era (a) inteira.
 *
 * O (a) e o defeito CARO, e nao por 0,5%: o veiculo desta fase e `const`
 * exportado + `className={NOME}`. Um oraculo cego a ele mede MENOS conforme o
 * codemod avanca — no limite, um alvo 100% migrado sai daqui com universo perto
 * de zero e uma particao que "fecha 100%". E o mesmo modo de falha do "0 fusoes"
 * da lib de cor: o zero passando por resultado.
 *
 * Correcao: o censo e o criterio de entidade vem de `lib/bundle-census.mjs`,
 * importados. Nao ha mais dois universos para reconciliar — ha um, e este script
 * so o PARTICIONA de outro jeito. As duas particoes sao vistas diferentes da
 * mesma medida, verificado por `test/oracle-reconciliation.test.mjs`.
 */
import { resolveRoot } from "./lib/paths.mjs";
import { census, EXTS } from "./lib/bundle-census.mjs";
import { detectarComposicoes, entidadesDoCenso } from "./lib/composition.mjs";
import { carregarCssBuildado, contratoDoCssFonte } from "./lib/tailwind-built-css.mjs";

const ROOT = resolveRoot();
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const JSON_OUT = argv.includes("--json");
const DUMP = argv.includes("--dump-descartados");
/** Transforma a degradacao DECLARADA do estrato 4 em falha dura — para CI. */
const REQUIRE_BUILT = argv.includes("--require-built-css");

/**
 * O criterio de entidade e PARAMETRO, com o mesmo default de `measure-coverage`.
 * Estava cravado em literal aqui dentro (`n >= 2 && classes.length >= 4`), o que
 * o tornava a terceira copia da mesma regra: quem rodasse `measure-coverage
 * --min-classes 7` comparava a saida com um instrumento 1 que continuava em 4.
 */
const MIN_REPEAT = Number(arg("--min-repeat", 2));
const MIN_CLASSES = Number(arg("--min-classes", 4));

const TOK = /^(?:hover:|focus:|active:|group-hover:|dark:|light:|disabled:|focus-visible:|sm:|md:|lg:|xl:|2xl:)*-?(?:bg|text|border|ring|shadow|fill|stroke|outline|divide|accent|caret|placeholder|p[xytrbles]?|m[xytrbles]?|gap|space|rounded|font|leading|tracking)(?:-|$)/;
/**
 * O RUIDO NAO E MAIS FILTRADO AQUI — ELE NAO E MAIS PRODUZIDO.
 *
 * Este script carregava a SEGUNDA copia do regex de className e um paliativo
 * (`RUIDO = /^[?:}{)(]$|^["']/`) que apagava POR LISTA os simbolos de ternario
 * que aquele regex fabricava. Consertava o sintoma aqui e deixava o defeito vivo
 * em `lib/bundle-census.mjs`, alem de nao devolver as classes REAIS das duas
 * pontas do ternario. A extracao agora e a de `lib/classname-extract.mjs`, que
 * le LITERAIS em vez de dar split no texto cru.
 *
 * O que sobra do paliativo e um ASSERT, nao um filtro: se alguma classe ainda
 * parecer fragmento de sintaxe, o extrator regrediu e o oraculo PARA. Filtrar em
 * silencio esconderia a regressao dentro de um numero que continua fechando.
 *
 * A aspa so e suspeita FORA de valor arbitrario: `after:content-['']` e classe
 * legitima do Tailwind e existe no alvo (`src/components/lib/Toggle/index.jsx`).
 * A primeira versao deste assert reprovava ela — o assert pegou a si mesmo.
 */
const pareceSintaxe = (c) =>
  /^[?:}{)([\]]+$/.test(c) || (/["'`]/.test(c) && !/[[\]]/.test(c));
const ARB = /\[.+\]/;

/* censo — O MESMO de measure-coverage, importado. Ver o cabecalho. */
const {
  arquivos, bundles, usos,
  atributos, dinamicos, contratos, contratosUsados,
  atributosViaContrato, usosViaContrato,
  identificadoresNaoResolvidos,
  literaisDescartados: descartados,
} = census(ROOT);

/**
 * FALHA FECHADA, herdada de `measure-coverage`: denominador vazio NAO e
 * resultado. Um alvo cujos call sites migraram para `className={NOME}` sem que o
 * `const` resolva sai daqui com universo 0 e uma particao de 7 zeros que "soma
 * 100%" — indistinguivel de "nao ha nada a fazer".
 */
if (usos === 0) {
  const naoRes = [...identificadoresNaoResolvidos.entries()].sort((a, b) => b[1].n - a[1].n);
  console.error(
    `measure-disposition: DENOMINADOR VAZIO em ${ROOT}\n` +
    `  arquivos varridos ${arquivos.length} · atributos className 0 · dinamicos ${dinamicos}\n` +
    `  contratos indexados ${contratos.size} · identificadores nao resolvidos ${naoRes.length}\n` +
    `Zero uso de classe nao e disposicao terminal de 100%: e sinal que nao resolveu.` +
    (naoRes.length
      ? `\nProvaveis: ${naoRes.slice(0, 8).map(([id, v]) => `${id}(${v.n}x)`).join(", ")} — declare o contrato num arquivo varrido (${[...EXTS].join(", ")}) como \`export const NOME = "classes"\`.`
      : `\nVerifique --root: nenhum arquivo com className foi encontrado.`)
  );
  process.exit(2);
}

/**
 * ASSERT, nao filtro: se alguma classe do censo ainda parecer fragmento de
 * sintaxe, o extrator regrediu e o oraculo PARA. Filtrar em silencio esconderia
 * a regressao dentro de um numero que continua fechando.
 */
for (const [, v] of bundles) {
  for (const c of v.classes) {
    if (!pareceSintaxe(c)) continue;
    console.error(`PAROU: '${c}' saiu do extrator como classe.`);
    console.error(`Fragmento de sintaxe no universo e o defeito que classname-extract.mjs existe para matar.`);
    process.exit(1);
  }
}

const total = [...bundles.values()].reduce((s, v) => s + v.classes.length * v.n, 0);
/**
 * FALHA FECHADA na reconciliacao com o censo. `usos` e contado por atributo
 * durante a varredura; `total` e recontado a partir do Map de bundles. Se os dois
 * divergirem, a chave de bundle colidiu ou perdeu classe, e TODA a particao
 * abaixo estaria fechando sobre um universo diferente do que `measure-coverage`
 * publica — exatamente a divergencia silenciosa que esta correcao mata.
 */
if (total !== usos) {
  console.error(`PAROU: universo recontado dos bundles (${total}) != census.usos (${usos}).`);
  console.error(`Os dois oraculos publicariam denominadores diferentes do MESMO censo.`);
  process.exit(1);
}

/* 1. entidade exata — criterio importado, nao reescrito */
const ents = entidadesDoCenso(bundles, MIN_REPEAT, MIN_CLASSES);
const usoEnt = [...ents.keys()].reduce((s, k) => s + bundles.get(k).classes.length * bundles.get(k).n, 0);

/**
 * 2. composicao nucleo+extras: bundle nao-entidade que CONTEM uma entidade.
 *
 * O LACO SAIU DAQUI. Ele estava escrito a mao neste arquivo e `propose-entities`
 * precisa do MESMO conjunto para propor `cn(NUCLEO, extras)` — duas copias
 * divergiriam na primeira correcao e a proposta passaria a listar bundle que o
 * oraculo nao conta. A regra vive em `lib/composition.mjs`; os dois a importam.
 * A membership deste Set e a mesma por CONSTRUCAO, nao por reconciliacao.
 */
const comp = detectarComposicoes(bundles, ents);
const usoComp = [...comp.keys()].reduce((s, k) => s + bundles.get(k).classes.length * bundles.get(k).n, 0);

/**
 * 4. CONTRATO EXISTENTE — as DUAS metades.
 *
 * (a) seletor `.classe` escrito a mao no CSS fonte (`.tooltip`, `.input-label`);
 * (b) utility que o motor GERA e cuja regra consome token DO APP.
 *
 * A metade (b) nao existia, e por isso o estrato 4 estava subestimado e o 6
 * superestimado: `duration-fast` e `transition-duration: var(--duration-fast)`,
 * consumo puro de motion token, e era contado como "vocabulario de layout" no
 * mesmo balde que `flex`. O criterio de (b) e a PROCEDENCIA da variavel, nao a
 * presenca de `var()` — ver o cabecalho de `lib/tailwind-built-css.mjs`: em v4
 * `w-60` tambem consome `var(--spacing)`, e creditar isso seria falso-verde de
 * 1.210 usos.
 */
const built = await carregarCssBuildado(ROOT);
const fonte = built.disponivel
  ? { entrada: built.entrada, arquivos: built.arquivosDoApp, seletoresCustom: built.seletoresCustom }
  : contratoDoCssFonte(ROOT);
const seletores = fonte.seletoresCustom;

if (!built.disponivel && REQUIRE_BUILT) {
  console.error(`PAROU (--require-built-css): CSS buildado indisponivel — ${built.motivo}`);
  console.error(`Sem ele o estrato 4 conta so seletor .classe do CSS fonte e SUBESTIMA o contrato;`);
  console.error(`o estrato 6 absorve a diferenca e a particao fecha 100% em cima de um rotulo errado.`);
  process.exit(4);
}

/**
 * Duas passadas porque `candidatesToCss` recebe um LOTE: a primeira junta os
 * candidatos que chegariam em ARB/residuo, a segunda os classifica. Perguntar
 * classe a classe daria o mesmo veredito por um custo bem maior.
 */
const candidatos = new Set();
for (const [k, v] of bundles) {
  if (ents.has(k) || comp.has(k)) continue;
  for (const c of v.classes) {
    if (TOK.test(c)) continue;
    if (seletores.has(c.split(":").pop())) continue;
    candidatos.add(c);
  }
}
const veredito = built.disponivel ? built.classificar([...candidatos]) : new Map();

/**
 * A PARTICAO 3-7 COMO FUNCAO DO DETECTOR, para o proprio oraculo publicar o
 * ANTES e o DEPOIS. A alternativa era eu rodar duas versoes do script e diffar a
 * mao — exatamente a classe de numero que nao sai de codigo versionado e que
 * ninguem consegue reproduzir depois. Com `usarBuildado=false` esta funcao
 * reproduz, byte a byte, a particao anterior a este refinamento.
 */
function particionar(usarBuildado) {
  const cont = { tok: 0, custom: 0, customBuildado: 0, arb: 0 };
  const residuo = new Map();
  const buildadas = new Map();
  for (const [k, v] of bundles) {
    if (ents.has(k) || comp.has(k)) continue;
    for (const c of v.classes) {
      if (TOK.test(c)) { cont.tok += v.n; continue; }
      if (seletores.has(c.split(":").pop())) { cont.custom += v.n; continue; }
      const b = usarBuildado ? veredito.get(c) : null;
      if (b?.tokensDoApp.length) {
        cont.customBuildado += v.n;
        const reg = buildadas.get(c) ?? { usos: 0, tokensDoApp: b.tokensDoApp };
        reg.usos += v.n;
        buildadas.set(c, reg);
        continue;
      }
      if (ARB.test(c)) { cont.arb += v.n; continue; }
      residuo.set(c, (residuo.get(c) ?? 0) + v.n);
    }
  }
  /* 6. vocabulario: allowlist ate 95% do residuo; 7. o resto e excecao */
  const ordenado = [...residuo.entries()].sort((a, b) => b[1] - a[1]);
  const resUsos = ordenado.reduce((s, [, n]) => s + n, 0);
  /**
   * `resto` NAO existia: o laco dava `break` e o estrato 7 saia daqui como um
   * NUMERO sem lista. "Excecao item-a-item" que nao pode ser listada item a item
   * e um rotulo, nao uma disposicao — e o ratchet do vocabulario precisa do
   * conjunto INTEIRO do residuo (6 U 7), nao so do lado de dentro do corte de
   * 95%: o corte e cumulativo, entao uma classe da cauda ATRAVESSA a fronteira
   * sozinha quando outra encolhe, e um guard ancorado so no estrato 6 acusaria
   * "classe nova" por deslizamento estatistico. `continue` no lugar de `break`
   * preserva `allow`/`cum` byte a byte (uma vez que `cum >= 95%`, nada mais e
   * somado) — travado por test/vocabulario-ratchet.test.mjs.
   */
  let cum = 0; const allow = []; const resto = [];
  for (const [c, n] of ordenado) {
    if (cum >= resUsos * 0.95) { resto.push([c, n]); continue; }
    allow.push([c, n]); cum += n;
  }
  const excecao = resUsos - cum;
  const somaResto = resto.reduce((s, [, n]) => s + n, 0);
  if (somaResto !== excecao) {
    console.error(`PAROU: estrato 7 recontado da lista (${somaResto}) != o numero publicado (${excecao}).`);
    process.exit(1);
  }

  const soma = usoEnt + usoComp + cont.tok + cont.custom + cont.customBuildado + cont.arb + cum + excecao;
  if (soma !== total) {
    console.error(`PAROU: particao nao soma o universo — ${soma} != ${total} (usarBuildado=${usarBuildado}).`);
    console.error(`Particao que nao fecha 100% e oraculo mentindo. Investigue antes de usar.`);
    process.exit(1);
  }
  return { cont, allow, resto, vocab: cum, excecao, buildadas, soma };
}

/**
 * O DEPOIS e o numero publicado; o ANTES existe para o delta ser AUDITAVEL em vez
 * de alegado. Quando o CSS buildado nao carrega, os dois sao identicos por
 * construcao e o delta imprime zero — o que e o sinal certo, nao um zero que
 * passa por "nada a migrar".
 */
const antes = particionar(false);
const P = built.disponivel ? particionar(true) : antes;
const { cont, allow, resto, vocab: cum, excecao, buildadas } = P;

/** De onde vieram os usos que o detector novo creditou ao estrato 4. */
const migrouDe = { arbitrary: 0, vocabulario: 0, excecao: 0 };
{
  const allowAntes = new Set(antes.allow.map(([c]) => c));
  for (const [c, reg] of buildadas) {
    if (ARB.test(c)) migrouDe.arbitrary += reg.usos;
    else if (allowAntes.has(c)) migrouDe.vocabulario += reg.usos;
    else migrouDe.excecao += reg.usos;
  }
}

const R = {
  root: ROOT, universo: total,
  criterio: { minRepeat: MIN_REPEAT, minClasses: MIN_CLASSES },
  /**
   * A RECONCILIACAO, publicada — nao deixada para quem le dois relatorios.
   * Estes campos vem do MESMO `census()` que `measure-coverage` consome, entao
   * `usosDeClasse` aqui e `usosDeClasse` la sao o mesmo numero por construcao, e
   * `usosViaContratoNomeado` e a parcela que o censo proprio antigo nao enxergava.
   */
  censo: {
    arquivos: arquivos.length,
    atributosClassName: atributos,
    atributosDinamicos: dinamicos,
    usosDeClasse: usos,
    bundlesDistintos: bundles.size,
    contratosIndexados: contratos.size,
    contratosUsados: contratosUsados.size,
    atributosViaContratoNomeado: atributosViaContrato,
    usosViaContratoNomeado: usosViaContrato,
  },
  /**
   * PROCEDENCIA DO ESTRATO 4. `disponivel:false` NAO e detalhe de log: e a
   * declaracao de que o numero publicado no estrato 4 e um PISO e o do 6 um teto.
   */
  cssBuildado: {
    disponivel: built.disponivel,
    motivo: built.motivo,
    entrada: fonte.entrada,
    arquivosDoApp: fonte.arquivos,
    tailwindVersao: built.tailwindVersao,
    resolvidoDe: built.resolvidoDe,
    varsDoApp: built.varsDoApp.size,
    varsPadraoTailwind: built.varsPadraoTailwind.size,
    interseccaoVars: built.interseccaoVars,
    candidatosTestados: candidatos.size,
    estrato4Subestimado: !built.disponivel,
  },
  estratos: {
    entidadeExata: { entidades: ents.size, usos: usoEnt },
    entidadeComposicao: { bundles: comp.size, usos: usoComp },
    tokenizavelFamilia: { usos: cont.tok },
    contratoExistente: {
      usos: cont.custom + cont.customBuildado,
      viaSeletorNoCssFonte: cont.custom,
      viaUtilityGeradaDeToken: cont.customBuildado,
      classesGeradasDeToken: buildadas.size,
    },
    arbitraryDimensao: { usos: cont.arb },
    vocabularioLayout: { classes: allow.length, usos: cum },
    excecaoItemAItem: { usos: excecao },
  },
  /** O delta que este refinamento produziu, medido pelo proprio script. */
  refinamentoEstrato4: {
    antes: {
      contratoExistente: antes.cont.custom,
      arbitraryDimensao: antes.cont.arb,
      vocabularioLayout: antes.vocab,
      vocabularioClasses: antes.allow.length,
      excecaoItemAItem: antes.excecao,
    },
    depois: {
      contratoExistente: cont.custom + cont.customBuildado,
      arbitraryDimensao: cont.arb,
      vocabularioLayout: cum,
      vocabularioClasses: allow.length,
      excecaoItemAItem: excecao,
    },
    migrouParaEstrato4De: migrouDe,
  },
  contratoPorUtilityGerada: [...buildadas.entries()]
    .sort((a, b) => b[1].usos - a[1].usos)
    .map(([classe, r]) => ({ classe, usos: r.usos, tokensDoApp: r.tokensDoApp })),
  topVocabulario: allow.slice(0, 15).map(([c, n]) => ({ classe: c, usos: n })),
  /**
   * O VOCABULARIO INTEIRO, nao o top 15. Sem esta lista o contrato do estrato 6
   * (docs/design-system/VOCABULARIO-LAYOUT.md no alvo) e o lint do ratchet teriam
   * de reimplementar a particao — a terceira copia da mesma regra, o defeito que
   * o cabecalho deste arquivo documenta. Aqui a lista SAI do oraculo.
   */
  vocabulario: allow.map(([c, n]) => ({ classe: c, usos: n })),
  /** O estrato 7 ITEM A ITEM. Era so um numero; "listavel um a um" nao listava. */
  excecaoClasses: resto.map(([c, n]) => ({ classe: c, usos: n })),
  /** Literais que os guardas do extrator recusaram — auditavel, nao silencioso. */
  literaisDescartados: Object.entries(
    descartados.reduce((a, d) => { a[d.motivo] = (a[d.motivo] ?? 0) + 1; return a; }, {}),
  ).map(([motivo, n]) => ({ motivo, n })),
};

if (DUMP) {
  for (const d of descartados) console.log(`${d.motivo}\t${d.valor}`);
  process.exit(0);
}
if (JSON_OUT) { console.log(JSON.stringify(R, null, 1)); process.exit(0); }
const pc = (n) => `${((100 * n) / total).toFixed(1).padStart(5)}%`;
console.log(`measure-disposition · ${ROOT}`);
console.log(`criterio de entidade: repete >= ${MIN_REPEAT} E tem >= ${MIN_CLASSES} classes`);
console.log(`universo (censo de lib/bundle-census.mjs — o MESMO de measure-coverage): ${total} usos`);
console.log(`  destes, via const de contrato: ${usosViaContrato} (${atributosViaContrato} atributos, ` +
  `${contratosUsados.size}/${contratos.size} consts) — invisiveis ao censo proprio que este script tinha\n`);
const c4 = cont.custom + cont.customBuildado;
console.log(`  1 entidade exata (${String(ents.size).padStart(3)})        ${String(usoEnt).padStart(6)}  ${pc(usoEnt)}   const exportado`);
console.log(`  2 entidade por composicao      ${String(usoComp).padStart(6)}  ${pc(usoComp)}   cn(NUCLEO, extras)`);
console.log(`  3 tokenizavel por familia      ${String(cont.tok).padStart(6)}  ${pc(cont.tok)}   token cor/spacing/radius/tipo`);
console.log(`  4 contrato EXISTENTE${built.disponivel ? "          " : " (PISO)   "}${String(c4).padStart(6)}  ${pc(c4)}   ` +
  `${cont.custom} seletor .classe + ${cont.customBuildado} utility gerada de token`);
console.log(`  5 arbitrary -> token dimensao  ${String(cont.arb).padStart(6)}  ${pc(cont.arb)}   h-[34px], w-[300px]...`);
console.log(`  6 vocabulario layout (${String(allow.length).padStart(3)})    ${String(cum).padStart(6)}  ${pc(cum)}   allowlist 1 doc, ratchet`);
console.log(`  7 EXCECAO item-a-item          ${String(excecao).padStart(6)}  ${pc(excecao)}   listavel um a um`);
console.log(`  ${"─".repeat(58)}`);
console.log(`  SOMA                           ${String(P.soma).padStart(6)}  100.0%   (fail-closed: bate o universo)`);

if (built.disponivel) {
  console.log(`\nestrato 4, refinado pelo CSS BUILDADO (${fonte.entrada} via @tailwindcss/node ${built.tailwindVersao})`);
  console.log(`  ${candidatos.size} classes testadas · ${buildadas.size} geram regra que consome token DO APP`);
  console.log(`  procedencia: ${built.varsDoApp.size} vars do app x ${built.varsPadraoTailwind.size} do tema padrao do Tailwind, interseccao ${built.interseccaoVars}`);
  console.log(`  migrou para o estrato 4: ${migrouDe.vocabulario} do 6 · ${migrouDe.excecao} do 7 · ${migrouDe.arbitrary} do 5`);
  console.log(`  antes  4=${antes.cont.custom}  5=${antes.cont.arb}  6=${antes.vocab} (${antes.allow.length} classes)  7=${antes.excecao}`);
  console.log(`  depois 4=${c4}  5=${cont.arb}  6=${cum} (${allow.length} classes)  7=${excecao}`);
  for (const [classe, r] of [...buildadas.entries()].sort((a, b) => b[1].usos - a[1].usos).slice(0, 10)) {
    console.log(`    ${String(r.usos).padStart(4)}  ${classe.padEnd(50)} ${r.tokensDoApp.join(" ")}`);
  }
} else {
  /**
   * A DEGRADACAO E DECLARADA, nunca silenciosa. Cair de volta no detector de
   * seletor `.classe` sem dizer nada era o defeito original: o estrato 6
   * absorvia utility gerada de token e a particao continuava fechando 100%.
   */
  console.log(`\n!! CSS BUILDADO INDISPONIVEL — ESTRATO 4 SUBESTIMADO, ESTRATO 6 SUPERESTIMADO`);
  console.log(`   motivo: ${built.motivo}`);
  console.log(`   o estrato 4 acima conta SO seletor .classe escrito a mao no CSS fonte. Toda utility`);
  console.log(`   que o Tailwind gera a partir de token do app (duration-fast -> var(--duration-fast))`);
  console.log(`   fica indistinguivel de flex/absolute no estrato 6. O 4 e PISO e o 6 e TETO.`);
  console.log(`   para medir: garanta @tailwindcss/node + tailwindcss/theme.css resolviveis a partir de ${ROOT}`);
  console.log(`   para falhar duro em CI: --require-built-css`);
}
