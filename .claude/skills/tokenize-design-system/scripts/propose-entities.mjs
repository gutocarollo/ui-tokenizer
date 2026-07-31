#!/usr/bin/env node
/**
 * propose-entities.mjs — F-D: PROPOR os contratos de entidade canônica.
 *
 *     cd <alvo> && node <skill>/scripts/propose-entities.mjs --root .
 *
 * O que é uma entidade, e por que ela é a maior alavanca do projeto: um bundle de
 * classes que se repete vira um contrato NOMEADO, e aí *todas* as classes dele —
 * inclusive `flex` e `w-full`, que sozinhas não são tokenizáveis — passam a viver
 * dentro de um contrato. Medido pelo oráculo: 430 entidades cobrem 51,4% dos
 * 32.662 usos de classe do alvo.
 *
 * ESTE SCRIPT NÃO APLICA NADA. Ele lê o alvo e escreve dois artefatos de
 * PROPOSTA: `docs/reports/entidades-propostas.md` e `.tokenize/entidades-propostas.json`.
 * Nenhum arquivo de `src/` é tocado. Mutação exige prova de pixel por lote, que é
 * outra fase (F-G/F-H).
 *
 * ── A regra do censo é importada, não copiada ──────────────────────────────────
 * `lib/bundle-census.mjs` é a MESMA regra que `measure-coverage.mjs` usa. Se a
 * definição de entidade vivesse em duas cópias, os dois números divergiriam em
 * silêncio na primeira correção.
 *
 * ── Os quatro sinais, todos FAIL-CLOSED ────────────────────────────────────────
 * Uma corrida anterior deste projeto reportou "0 fusões" só porque a lib de cor
 * não resolveu, e o zero passou por resultado. Aqui, sinal que não resolve PARA a
 * execução com exit 1 e diz o que faltou:
 *
 *   1. `typescript` resolvível a partir do alvo   → sem AST não há contexto, e sem
 *      contexto o nome da entidade seria inventado.
 *   2. `tailwind.config.js` importável             → `content.files` é a prova de
 *      que o módulo de destino não terá as classes purgadas.
 *   3. cobertura AST ≥ `--min-ast-coverage` (0.8)  → o AST tem que enxergar
 *      essencialmente o mesmo que o regex do censo. Ver `--ext default` no §4.2 do
 *      plano: o miner varreu 2% do app e reportou sucesso.
 *   4. nenhuma extensão fora do censo carregando `className` DENTRO do escopo do
 *      `content.files` → é a armadilha do `--ext` de novo, medida no alvo certo.
 *
 * ── A lei de derivação de nome ─────────────────────────────────────────────────
 * Nome nunca é `entity1`. É derivado do CONTEXTO onde a entidade aparece:
 *
 *     NOME = <QUALIFICADOR>_<PAPEL>[_<DISCRIMINADOR>]
 *
 *   PAPEL          atributo `role` dominante > tag nativa mapeada > nome do
 *                  componente JSX > forma inferida das classes (só para
 *                  `div`/`span`, que não têm semântica própria).
 *   QUALIFICADOR   componente único onde ocorre > último segmento do diretório
 *                  comum > componente dominante (≥60%) > **owner do token do DS
 *                  presente no bundle** > `COMMON` quando nada disso resolve.
 *   DISCRIMINADOR  só em colisão, e derivado do NÚCLEO COMUM do grupo: os
 *                  homônimos são `base + extras aditivos`, não bundles paralelos.
 *                  Quem tem extras vazios É o núcleo e leva o nome base; os demais
 *                  acumulam sufixo pelos seus extras até desempatar.
 *
 * Três coisas que a lei se recusa a fazer, cada uma comprada com um erro medido
 * nesta fase:
 *
 *   - **não inventa `entity1`.** Não derivando o PAPEL, a entidade sai com
 *     `derivado: false` numa seção própria. "Não consegui derivar" é resultado;
 *     `entity1` é ruído com cara de resultado.
 *   - **não usa sufixo mudo (`_V2`).** Persistindo a colisão, ou os conjuntos de
 *     classe são idênticos — e aí a diferença é classe DUPLICADA no atributo, com
 *     as duas sendo a MESMA entidade contada duas vezes — ou o nome é declarado
 *     fraco. Sufixo mudo esconderia as duas coisas.
 *   - **não dá o nome curto a quem tem menos extras.** A primeira versão fazia
 *     isso e uma entidade de 2 call sites levou `SETTINGS_INPUT` enquanto a de 190
 *     virou `SETTINGS_INPUT_TEXT_CONTENT_PRIMARY`. Num design system o nome curto
 *     é do núcleo, ou do membro dominante.
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveRoot } from "./lib/paths.mjs";
import {
  EXTS, SKIP, TOKENIZAVEL, bundleKey, census, isEntity, splitClasses, walk,
} from "./lib/bundle-census.mjs";
import { contratosNaExpressao } from "./lib/bundle-census.mjs";
import { classNameAttributes } from "./lib/classname-extract.mjs";
import { detectarComposicoes, entidadesDoCenso } from "./lib/composition.mjs";
import { PREFIX_PROPERTY, familyPrefixOf, stripVariants } from "./lib/utility-families.mjs";

const ROOT = resolveRoot();
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const MIN_REPEAT = Number(arg("--min-repeat", 2));
const MIN_CLASSES = Number(arg("--min-classes", 4));
const MIN_AST_COVERAGE = Number(arg("--min-ast-coverage", 0.8));
const AMOSTRAS = Number(arg("--samples", 3));
const DESTINO = arg("--dest", "src/utils/design-entities.js");
const OUT_MD = arg("--out", "docs/reports/entidades-propostas.md");
const OUT_JSON = arg("--out-json", ".tokenize/entidades-propostas.json");
/**
 * De onde resolver `tailwind-merge` (SINAL 6). Sem flag, a escada tenta o ALVO
 * primeiro — que é onde ele DEVERIA estar, já que é o alvo que vai importar `cn`.
 */
const TWMERGE_PATH = arg("--twmerge", null);

/** As bandas de estágio. Migrar 430 de uma vez é irreversível na prática. */
const BANDAS = [
  { id: "L1", min: 20, rot: "≥20×" },
  { id: "L2", min: 5, rot: "5–19×" },
  { id: "L3", min: MIN_REPEAT, rot: `${MIN_REPEAT}–4×` },
];

/**
 * TOKEN CONTAMINADO — achado desta fase, contra o próprio oráculo pinado.
 *
 * O regex do censo aceita `className={`...`}` inclusive quando o template tem
 * `${...}`. `splitClasses` só descarta o pedaço que CONTÉM `${`, então o resto do
 * ternário sobrevive como se fosse classe. Medido no alvo:
 *
 *     className={`flex items-center ${isActive ? "bg-x" : "bg-y"} gap-2`}
 *       -> ["flex","items-center","?",'"bg-x"',":",'"bg-y"}',"gap-2"]
 *
 * `?`, `:`, `"bg-x"` e `"bg-y"}` entram no denominador como uso de classe. Uma
 * entidade que contenha um desses tokens emitiria
 * `export const X = "flex ? \"bg-x\" ..."`, que é um contrato quebrado. Essas
 * entidades vão para QUARENTENA, contadas e nomeadas, nunca migradas em silêncio.
 *
 * CORRIGIDO NA RAIZ (fase seguinte): o extrator passou a ler os LITERAIS da
 * expressão em vez de dar split no texto cru — `lib/classname-extract.mjs`, com
 * `test/classname-extract.test.mjs` travando as duas direções e
 * `audit-extraction-delta.mjs` provando que a troca não perdeu classe legítima
 * (0 tokens com forma de utility desapareceram; 936 usos de ruído saíram, 609
 * usos de classe real entraram). Esta quarentena vira REDE DE SEGURANÇA, não
 * remendo.
 *
 * MEDIDO DEPOIS DA CORREÇÃO, e a quarentena NÃO zerou — 2 entidades, 54 usos.
 * Nenhuma delas é ruído de ternário; as duas são o defeito IRMÃO, que continua
 * de pé e é declarado aqui em vez de confundido com o que foi consertado:
 *   - `font-['Plus Jakarta Sans']` — valor arbitrário com ESPAÇO dentro. O split
 *     por espaço parte a classe em `font-['Plus`, `Jakarta`, `Sans']`. São 8
 *     atributos no alvo, e a classe assim já é inválida para o próprio Tailwind
 *     (a grafia suportada usa `_`).
 *   - `/50` — cauda de modificador de opacidade sobrevivendo ao corte.
 * Os dois existiam antes e depois da troca de extrator, na mesma quantidade:
 * por isso não aparecem no delta de `audit-extraction-delta.mjs` e por isso NÃO
 * foram corrigidos junto — mover o denominador por dois motivos na mesma
 * mudança torna os dois inauditáveis.
 *
 * A regra é conservadora: aspa simples só é suspeita FORA de valor arbitrário,
 * porque `after:content-['']` é classe legítima.
 */
const TOKEN_CONTAMINADO = (c) =>
  /["`{}]/.test(c) ||
  /^(?:\?|:|&&|\|\||\.\.\.)$/.test(c) ||
  /^\//.test(c) ||                       // cauda de `bg-${x}/50`: sobrou o modificador de opacidade
  (/'/.test(c) && !/[[\]]/.test(c));

/**
 * VALOR ARBITRÁRIO PARTIDO — segundo defeito, menor. `font-['Plus Jakarta Sans']`
 * é UMA classe, mas o espaço literal dentro do colchete faz o split por whitespace
 * quebrá-la em três (`font-['Plus`, `Jakarta`, `Sans']`). Também infla o
 * denominador e também produziria const quebrada.
 */
const COLCHETE_PARTIDO = (c) =>
  (c.includes("[") && !c.includes("]")) || (c.includes("]") && !c.includes("["));

function fail(msg) {
  console.error(`\nFALHA FECHADA — propose-entities\n\n${msg}\n`);
  console.error("Nenhum artefato foi escrito. Sinal desligado não vira número.\n");
  process.exit(1);
}

// ─── sinal 1: TypeScript resolvível a partir do ALVO ────────────────────────────
async function carregarTypeScript(root) {
  const req = createRequire(path.join(root, "package.json"));
  let resolved;
  try { resolved = req.resolve("typescript"); }
  catch {
    fail(
      `SINAL 1 (AST) não resolveu: o pacote 'typescript' não é resolvível a partir de ${root}.\n` +
      `Sem AST não há tag nativa, nem role, nem componente envolvente — e sem contexto\n` +
      `o nome da entidade seria invenção. Instale typescript no alvo e rode de novo.`
    );
  }
  const ts = (await import(pathToFileURL(resolved).href)).default;
  const versao = JSON.parse(readFileSync(path.join(path.dirname(resolved), "../package.json"), "utf8")).version;
  return { ts, versao, caminho: path.relative(root, resolved) };
}

/**
 * ─── sinal 6: `tailwind-merge` RESOLVÍVEL ──────────────────────────────────────
 *
 * A composição propõe `className={cn(NUCLEO, "mt-2 pr-10")}`, e `cn` é
 * `tailwind-merge`. Um relatório que propõe essa chamada sem NUNCA ter rodado o
 * merge é o artefato perigoso desta fase: ele afirma equivalência
 * (`núcleo + extras === bundle original`) que só a biblioteca pode confirmar.
 * Se a lib não resolve, este script NÃO imprime "0 conflitos" — ele para. É
 * literalmente o modo de falha que este projeto comprou com dinheiro ("uma
 * corrida reportou 0 fusões só porque a lib de cor não resolveu").
 *
 * A escada tenta, em ordem: `--twmerge <path>`, o ALVO, o diretório deste script.
 * O alvo vem antes de propósito — a versão que importa é a que o alvo vai usar em
 * runtime, e uma tabela de conflito de outra major responderia por um Tailwind
 * que não é o do alvo.
 *
 * MEDIDO NESTE ALVO: `tailwind-merge` NÃO está instalado (`node_modules` não tem,
 * `package.json` não lista, e não existe util `cn`/`clsx` em `src/`). Isso não é
 * detalhe de ambiente — é o custo do veículo, e ele estava implícito no plano.
 * Por isso a mensagem de falha diz as duas saídas possíveis, e nenhuma delas é
 * "assume que dá certo".
 */
async function carregarTailwindMerge(root) {
  const tentativas = [];
  const tentar = (base, rotulo) => {
    try {
      const req = createRequire(base);
      return { resolved: req.resolve("tailwind-merge"), origem: rotulo };
    } catch (e) {
      tentativas.push(`${rotulo}: ${e.code ?? "erro"}`);
      return null;
    }
  };
  const achado =
    (TWMERGE_PATH ? tentar(path.resolve(TWMERGE_PATH) + path.sep, `--twmerge ${TWMERGE_PATH}`) : null) ??
    tentar(path.join(root, "package.json"), `alvo ${root}`) ??
    tentar(import.meta.url, "diretório do script");

  if (!achado) {
    fail(
      `SINAL 6 (tailwind-merge) não resolveu:\n  ${tentativas.join("\n  ")}\n\n` +
      `A composição PROPÕE \`className={cn(NUCLEO, "mt-2 pr-10")}\`. Sem rodar o merge de\n` +
      `verdade não dá para saber se algum extra CONFLITA com uma classe do núcleo — e\n` +
      `imprimir "0 conflitos" sem medir é exatamente o zero-que-passa-por-resultado que\n` +
      `este projeto existe para matar.\n\n` +
      `Duas saídas, as duas legítimas, nenhuma silenciosa:\n` +
      `  1. o alvo adota o veículo: \`npm i tailwind-merge\` no alvo (é dependência de\n` +
      `     RUNTIME da proposta, não de análise — decisão do dono);\n` +
      `  2. medir agora com um install existente: --twmerge <dir com node_modules/tailwind-merge>.`
    );
  }
  const mod = await import(pathToFileURL(achado.resolved).href);
  const twMerge = mod.twMerge ?? mod.default?.twMerge;
  if (typeof twMerge !== "function") {
    fail(`SINAL 6: '${achado.resolved}' resolveu mas não exporta twMerge(). Versão incompatível.`);
  }
  const pkg = path.join(achado.resolved.split("tailwind-merge")[0], "tailwind-merge", "package.json");
  let versao = "?";
  try { versao = JSON.parse(readFileSync(pkg, "utf8")).version; } catch { /* declarado como ? */ }

  /**
   * PROVA DE VIDA da lib, não confiança nela. Se `twMerge("p-2 p-4")` não
   * devolver `p-4`, a resolução trouxe algo que não é tailwind-merge (ou uma
   * versão que mudou de contrato) e todo conflito medido abaixo seria ficção.
   */
  const prova = twMerge("p-2 p-4");
  if (prova !== "p-4") {
    fail(`SINAL 6: prova de vida falhou — twMerge("p-2 p-4") devolveu '${prova}', esperado 'p-4'.`);
  }
  return { twMerge, versao, caminho: achado.resolved, origem: achado.origem, prova };
}

/**
 * O conflito entre núcleo e extras, medido pela biblioteca real.
 *
 * DUAS classes de conflito, e elas têm consequências OPOSTAS:
 *
 *   A. RESOLVIDO — `twMerge` derruba uma classe do NÚCLEO porque o extra vence.
 *      `cn(NUCLEO, extras)` emite um conjunto DIFERENTE do bundle original, onde
 *      as duas conviviam e quem decidia era a ordem do CSS gerado. Este é o caso
 *      perigoso: a composição muda o que renderiza, e a mudança pode ser a
 *      correta (o dev QUIS sobrescrever) ou uma regressão. Exige pixel.
 *   B. NÃO RESOLVIDO — núcleo e extra tocam a MESMA propriedade sob a MESMA
 *      cadeia de variante, e `twMerge` mantém os dois. É o blind spot medido:
 *      utility custom fora dos grupos que a lib conhece
 *      (`focus:outline-primary-button` × `focus:outline-none`). A composição
 *      renderiza igual ao original — logo não é regressão — mas a intenção
 *      "o extra sobrescreve o núcleo" falha em silêncio, hoje e depois.
 *
 * Confundir os dois seria o erro caro: A é risco de pixel, B é defeito latente
 * que já existe no call site atual.
 */
const varianteDe = (c) => {
  const base = stripVariants(c);
  return c.slice(0, c.length - base.length);
};
const propriedadeDe = (c) => {
  const p = familyPrefixOf(c);
  return p ? PREFIX_PROPERTY[p] : null;
};

/**
 * ── A LINHA DE BASE, E O FALSO POSITIVO QUE ELA MATOU ──────────────────────────
 *
 * A primeira versão desta função comparava só `twMerge(núcleo, extras)` contra as
 * classes do núcleo, e reportou **6 bundles em conflito A**. Cinco eram FALSO
 * POSITIVO, e a causa é que o NÚCLEO CONFLITA CONSIGO MESMO:
 *
 *   TEXT_PREVIEW_BUTTON = "… bg-transparent bg-sidebar-button …"
 *   twMerge derruba `bg-transparent` — e derrubaria com `extras` vazio.
 *   Os extras daquele call site eram `popover-ring z-item-control-low
 *   text-content-primary`, nenhum deles `bg-`.
 *
 * Atribuir isso à composição seria cobrar da proposta um defeito que já está
 * dentro da entidade — e, pior, inflar o número perigoso (o único que decide se
 * o lote precisa de pixel) por um fator de 6. É a mesma família de erro que o
 * `p`/`px` e o `emContrato`: um balde computado por um predicado só quando são
 * dois.
 *
 * Agora há LINHA DE BASE: `twMerge(núcleo)` sozinho. O que já morre aí é
 * `nucleoAutoConflito` — achado sobre a ENTIDADE (o `const` proposto carrega
 * classe morta), não sobre a composição. Conflito A passa a ser só o que morre
 * A MAIS quando os extras entram.
 */
function analisarConflito(twMerge, classesNucleo, extras) {
  const nucleoStr = classesNucleo.join(" ");
  const extrasStr = extras.join(" ");

  const base = new Set(twMerge(nucleoStr).split(/\s+/).filter(Boolean));
  const nucleoAutoConflito = [...new Set(classesNucleo)].filter((c) => !base.has(c));

  const saida = twMerge(nucleoStr, extrasStr);
  const vivos = new Set(saida.split(/\s+/).filter(Boolean));

  /** Só o que os EXTRAS derrubaram — o que o núcleo já perdia sozinho não conta. */
  const nucleoPerdidas = [...new Set(classesNucleo)].filter((c) => !vivos.has(c) && base.has(c));
  const extrasPerdidas = [...new Set(extras)].filter((c) => !vivos.has(c));

  /** Pares que o merge NÃO resolveu apesar de tocarem a mesma propriedade. */
  const naoResolvidos = [];
  for (const a of new Set(classesNucleo)) {
    const pa = propriedadeDe(a);
    if (!pa) continue;
    const va = varianteDe(a);
    for (const b of new Set(extras)) {
      if (a === b) continue;
      if (varianteDe(b) !== va) continue;
      if (propriedadeDe(b) !== pa) continue;
      if (!vivos.has(a) || !vivos.has(b)) continue; // resolvido: cai no balde A
      naoResolvidos.push({ nucleo: a, extra: b, propriedade: pa, variante: va || "(sem variante)" });
    }
  }
  return {
    saida,
    /**
     * O núcleo derruba classe DELE MESMO, com extras vazio. Achado sobre a
     * ENTIDADE — o `const` proposto carrega classe morta — e explicitamente NÃO
     * é conflito de composição.
     */
    nucleoAutoConflito,
    /** Balde A: a composição muda o conjunto emitido. Risco de pixel. */
    conflitoResolvido: nucleoPerdidas.length > 0,
    nucleoPerdidas,
    /** Extra derrubado — conflito DENTRO dos extras, não com o núcleo. */
    extrasPerdidas,
    /** Balde B: mesma propriedade, os dois sobrevivem. Defeito latente. */
    conflitoNaoResolvido: naoResolvidos.length > 0,
    paresNaoResolvidos: naoResolvidos,
    /** Sem conflito de nenhum tipo: `cn()` emite exatamente o bundle original. */
    equivalente: nucleoPerdidas.length === 0 && extrasPerdidas.length === 0 && naoResolvidos.length === 0,
  };
}

// ─── sinal 2: content.files do Tailwind ────────────────────────────────────────
function globParaRegExp(glob) {
  const s = glob.replace(/^\.\//, "");
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "*") {
      if (s[i + 1] === "*") {
        if (s[i + 2] === "/") { out += "(?:[^/]+/)*"; i += 2; }
        else { out += ".*"; i += 1; }
      } else out += "[^/]*";
    } else if (c === "{") {
      const j = s.indexOf("}", i);
      if (j < 0) { out += "\\{"; continue; }
      const alts = s.slice(i + 1, j).split(",").map((a) => a.replace(/[.+^${}()|[\]\\]/g, "\\$&"));
      out += `(?:${alts.join("|")})`;
      i = j;
    } else if (c === "?") out += "[^/]";
    else out += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}

async function carregarContentFiles(root) {
  const candidatos = ["tailwind.config.js", "tailwind.config.mjs", "tailwind.config.cjs", "tailwind.config.ts"];
  const achado = candidatos.map((c) => path.join(root, c)).find(existsSync);
  if (!achado) {
    fail(
      `SINAL 2 (purga) não resolveu: nenhum ${candidatos.join(" / ")} em ${root}.\n` +
      `Sem 'content.files' não há como provar que o módulo de contrato será varrido —\n` +
      `e classe declarada fora do content é PURGADA do CSS em silêncio.`
    );
  }
  let cfg;
  try { cfg = (await import(pathToFileURL(achado).href)).default; }
  catch (e) {
    fail(`SINAL 2 (purga) não resolveu: ${path.basename(achado)} não importa.\n${e.message}`);
  }
  const content = cfg?.content;
  const globs = Array.isArray(content) ? content : Array.isArray(content?.files) ? content.files : null;
  if (!globs?.length) fail(`SINAL 2 (purga): 'content'/'content.files' ausente ou vazio em ${path.basename(achado)}.`);
  return { arquivo: path.basename(achado), globs, regexes: globs.map(globParaRegExp) };
}

const cobertoPorContent = (rel, tw) => tw.regexes.some((r) => r.test(rel.replace(/\\/g, "/")));

// ─── sinal 4: extensão fora do censo carregando className DENTRO do content ────
function walkTudo(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkTudo(p, out);
    else out.push(p);
  }
  return out;
}

function auditarExtensoes(root, tw) {
  const dentro = {}, fora = {};
  for (const f of walkTudo(root)) {
    const rel = path.relative(root, f).replace(/\\/g, "/");
    const ext = path.extname(f);
    if (!ext || ext === ".html" || ext === ".css" || ext === ".json" || ext === ".md") continue;
    let t;
    try { t = readFileSync(f, "utf8"); } catch { continue; }
    if (!t.includes("className")) continue;
    const alvo = EXTS.has(ext) ? dentro : fora;
    alvo[ext] = (alvo[ext] ?? 0) + 1;
    if (!EXTS.has(ext) && cobertoPorContent(rel, tw)) {
      fail(
        `SINAL 4 (--ext): o arquivo ${rel} tem 'className', está DENTRO do content.files\n` +
        `do Tailwind e a extensão ${ext} NÃO é varrida pelo censo. É a armadilha do\n` +
        `'--ext default ts,tsx' outra vez: varrer 2% do app e reportar sucesso.`
      );
    }
  }
  return { dentro, fora };
}

// ─── AST: contexto por ocorrência ──────────────────────────────────────────────
function scriptKind(ts, f) {
  if (f.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (f.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (f.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/**
 * O MESMO recorte do regex do censo: literal estático, nada de interpolação —
 * MAIS o contrato nomeado, pela mesma razão que o censo passou a resolvê-lo.
 * Se o AST não seguisse o `className={NOME}`, a cobertura AST (SINAL 3) cairia à
 * medida que o codemod avançasse e este script pararia de propor sobre o alvo
 * migrado. A tabela é a MESMA que o censo montou — não uma segunda cópia.
 */
function valorEstatico(ts, attr, sf, contratos) {
  const init = attr.initializer;
  if (!init) return null;
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression) {
    const e = init.expression;
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
    if (ts.isIdentifier(e) && contratos?.has(e.text)) return contratos.get(e.text).valor;
  }
  return null;
}

function componenteEnvolvente(ts, node, sf) {
  let n = node.parent, fallback = null;
  while (n) {
    let nome = null;
    if (ts.isFunctionDeclaration(n) && n.name) nome = n.name.getText(sf);
    else if (ts.isClassDeclaration(n) && n.name) nome = n.name.getText(sf);
    else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) nome = n.name.getText(sf);
    if (nome) {
      if (/^[A-Z]/.test(nome)) return nome;
      fallback ??= nome;
    }
    n = n.parent;
  }
  return fallback;
}

function componenteDoArquivo(rel) {
  const base = path.basename(rel, path.extname(rel));
  if (/^index$/i.test(base)) return path.basename(path.dirname(rel));
  return base;
}

function coletarOcorrencias(ts, root, arquivos, contratos) {
  const ocorrencias = [];
  let atributosAst = 0;
  for (const f of arquivos) {
    const rel = path.relative(root, f).replace(/\\/g, "/");
    let texto;
    try { texto = readFileSync(f, "utf8"); } catch { continue; }
    const sf = ts.createSourceFile(f, texto, ts.ScriptTarget.Latest, true, scriptKind(ts, f));
    const visit = (node) => {
      if (ts.isJsxAttribute(node) && node.name.getText(sf) === "className") {
        const v = valorEstatico(ts, node, sf, contratos);
        if (v !== null) {
          const cs = splitClasses(v);
          if (cs.length) {
            atributosAst++;
            const opening = node.parent?.parent;
            const tag = opening?.tagName ? opening.tagName.getText(sf) : null;
            const attrs = new Map();
            for (const p of opening?.attributes?.properties ?? []) {
              if (!ts.isJsxAttribute(p)) continue;
              const nome = p.name.getText(sf);
              const init = p.initializer;
              attrs.set(nome, init && ts.isStringLiteral(init) ? init.text : true);
            }
            const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
            ocorrencias.push({
              chave: bundleKey(cs),
              arquivo: rel,
              linha: line + 1,
              tag,
              role: typeof attrs.get("role") === "string" ? attrs.get("role") : null,
              tipo: typeof attrs.get("type") === "string" ? attrs.get("type") : null,
              interativo: [...attrs.keys()].some((k) => /^on[A-Z]/.test(k)),
              componente: componenteEnvolvente(ts, node, sf) ?? componenteDoArquivo(rel),
              bruto: v,
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return { ocorrencias, atributosAst };
}

// ─── a lei de derivação de nome ────────────────────────────────────────────────
const TAG_PAPEL = {
  // input/select/textarea NÃO colapsam em FIELD: colapsá-los criava uma colisão de
  // nome onde a tag já separava, e a colisão era resolvida por sufixo de classe —
  // pior nome, derivado de menos evidência.
  button: "BUTTON", a: "LINK", input: "INPUT", textarea: "TEXTAREA", select: "SELECT",
  option: "OPTION", label: "LABEL", form: "FORM", fieldset: "FIELDSET", legend: "LEGEND",
  li: "ITEM", ul: "LIST", ol: "LIST", dl: "LIST", dt: "TERM", dd: "DEFINITION",
  table: "TABLE", thead: "TABLE_HEAD", tbody: "TABLE_BODY", tfoot: "TABLE_FOOT",
  tr: "ROW", td: "CELL", th: "HEADER_CELL",
  nav: "NAV", header: "HEADER", footer: "FOOTER", aside: "ASIDE", main: "MAIN",
  section: "SECTION", article: "ARTICLE", dialog: "DIALOG", details: "DISCLOSURE",
  summary: "SUMMARY", figure: "FIGURE", figcaption: "CAPTION",
  h1: "HEADING", h2: "HEADING", h3: "HEADING", h4: "HEADING", h5: "HEADING", h6: "HEADING",
  p: "PARAGRAPH", span: null, div: null, small: "TEXT", strong: "TEXT", b: "TEXT",
  em: "TEXT", i: "TEXT", u: "TEXT", s: "TEXT", blockquote: "QUOTE",
  img: "IMAGE", svg: "ICON", path: "ICON", video: "VIDEO", audio: "AUDIO",
  canvas: "CANVAS", iframe: "FRAME", pre: "CODE_BLOCK", code: "CODE", hr: "DIVIDER",
  br: null, textPath: "ICON",
};

const upperSnake = (s) => String(s)
  .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
  .replace(/[^A-Za-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .toUpperCase();

/** Só para `div`/`span`, que não carregam semântica: inferir a FORMA das classes. */
function papelPorForma(classes) {
  const has = (re) => classes.some((c) => re.test(c));
  if (has(/^grid$/)) return "GRID";
  if (has(/^flex$/) && has(/^flex-col$/)) return "STACK";
  if (has(/^flex$/)) return "ROW";
  // `space-y`/`flex-col` sozinhos ainda dizem o eixo: empilhamento vertical.
  if (has(/^space-y-/) || has(/^flex-col$/) || has(/^divide-y/)) return "STACK";
  if (has(/^space-x-/) || has(/^divide-x/)) return "ROW";
  if (has(/^(rounded|border)(-|$)/) && has(/^(bg|shadow)(-|$)/)) return "CARD";
  if (has(/^(bg|border|shadow|ring)(-|$)/)) return "SURFACE";
  if (has(/^(text|font|leading|tracking|truncate|line-clamp)(-|$)/)) return "TEXT";
  if (has(/^(absolute|fixed|sticky)$/)) return "OVERLAY";
  return null;
}

const dominante = (vals) => {
  const c = new Map();
  for (const v of vals) if (v != null) c.set(v, (c.get(v) ?? 0) + 1);
  if (!c.size) return { valor: null, n: 0, share: 0, distintos: 0 };
  const [valor, n] = [...c.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0];
  return { valor, n, share: n / vals.length, distintos: c.size };
};

/**
 * OWNER DE TOKEN — o qualificador quando a entidade é do app inteiro.
 *
 * Sem isso, todo bundle espalhado virava `COMMON_*`, e `COMMON` não é nome: é a
 * confissão de que a localização não distinguiu nada. Mas o alvo já carrega a
 * resposta no próprio bundle — `bg-theme-settings-input-bg` diz que a superfície
 * pertence ao owner `settings-input`. Isso é o eixo A do plano (`find-owner`)
 * aplicado ao bundle em vez da ocorrência.
 *
 * Owner de UM segmento é rejeitado de propósito: `text-content-primary` →
 * `content`, `hover:bg-surface-hover` → `surface`, `bg-app-bg` → `app`. São papéis
 * genéricos do DS, não donos de componente, e usá-los daria nome pior que COMMON.
 */
const UTIL_OWNER = /^(?:[\w[\]&>._-]+:)*(bg|text|border|ring|outline|shadow|divide|placeholder|fill|stroke|accent|caret|from|to|via)-(.+)$/;
const CAUDA_PROP = /-(?:bg|background|border|text|fg|foreground|color|primary|secondary|tertiary|hover|active|focus|placeholder|selected|disabled|default|main|light|dark)$/;
const PESO_UTIL = { bg: 3, text: 2, border: 2, divide: 2, placeholder: 2 };

function ownerDeToken(classes) {
  const peso = new Map();
  for (const c of classes) {
    const m = UTIL_OWNER.exec(c);
    if (!m) continue;
    let nome = m[2].replace(/^theme-/, "").replace(/\/.*$/, "");
    let ant;
    do { ant = nome; nome = nome.replace(CAUDA_PROP, ""); } while (nome !== ant);
    const segs = nome.split("-").filter(Boolean);
    if (segs.length < 2) continue;              // papel genérico do DS, não dono
    const k = segs.join("-");
    peso.set(k, (peso.get(k) ?? 0) + (PESO_UTIL[m[1]] ?? 1));
  }
  if (!peso.size) return null;
  return [...peso.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]))[0][0];
}

function diretorioComum(arquivos) {
  const partes = arquivos.map((f) => f.split("/").slice(0, -1));
  let comum = partes[0] ?? [];
  for (const p of partes.slice(1)) {
    let i = 0;
    while (i < comum.length && i < p.length && comum[i] === p[i]) i++;
    comum = comum.slice(0, i);
  }
  return comum;
}

function derivarNome(ocs, classes) {
  const tag = dominante(ocs.map((o) => o.tag));
  const role = dominante(ocs.map((o) => o.role));

  let papel = null, fontePapel = null;
  if (role.valor && role.share >= 0.5) { papel = upperSnake(role.valor); fontePapel = `role="${role.valor}"`; }
  else if (tag.valor && /^[A-Z]/.test(tag.valor)) {
    papel = upperSnake(tag.valor.split(".").pop()); fontePapel = `componente JSX <${tag.valor}>`;
  } else if (tag.valor && TAG_PAPEL[tag.valor]) {
    papel = TAG_PAPEL[tag.valor]; fontePapel = `tag nativa <${tag.valor}>`;
    if (tag.valor === "div" || tag.valor === "span") papel = null;
  } else if (tag.valor === "div" || tag.valor === "span") {
    papel = papelPorForma(classes);
    fontePapel = papel ? `forma das classes (<${tag.valor}> não tem semântica)` : null;
  }
  // <div onClick> é ação sem elemento de ação — insumo direto da F-B2 do plano.
  const divAcao = (tag.valor === "div" || tag.valor === "span") && ocs.every((o) => o.interativo) && ocs.length > 0;
  if (divAcao) { papel = "ACTION"; fontePapel = `<${tag.valor}> com handler — F-B2 (HTML semântico)`; }

  const comp = dominante(ocs.map((o) => o.componente));
  const arquivos = [...new Set(ocs.map((o) => o.arquivo))];
  let qualificador = null, fonteQual = null;
  if (comp.distintos === 1) { qualificador = upperSnake(comp.valor); fonteQual = `componente único ${comp.valor}`; }
  else {
    const dir = diretorioComum(arquivos).filter((s) => s !== "src" && s !== "components" && s !== "pages");
    const owner = ownerDeToken(classes);
    if (dir.length) { qualificador = upperSnake(dir[dir.length - 1]); fonteQual = `diretório comum src/.../${dir.join("/")}`; }
    else if (comp.share >= 0.6) { qualificador = upperSnake(comp.valor); fonteQual = `componente dominante ${comp.valor} (${Math.round(comp.share * 100)}%)`; }
    else if (owner) { qualificador = upperSnake(owner); fonteQual = `owner do token do DS presente no bundle (\`${owner}\`)`; }
    else { qualificador = "COMMON"; fonteQual = `espalhada por ${comp.distintos} componentes em ${arquivos.length} arquivos, e nenhum token do bundle nomeia um dono`; }
  }

  // `SETTINGS_INPUT` + papel `INPUT` = `SETTINGS_INPUT_INPUT`. O qualificador já diz.
  const nomeBase = papel
    ? (qualificador === papel || qualificador.endsWith(`_${papel}`) ? qualificador : `${qualificador}_${papel}`)
    : null;

  return {
    papel, fontePapel, qualificador, fonteQual,
    tagDominante: tag.valor, tagShare: tag.share, tagDistintos: tag.distintos,
    derivado: Boolean(papel),
    nomeBase,
    divAcao,
  };
}

/**
 * Colisão de nome, resolvida pelo NÚCLEO COMUM do grupo — não por "classe única".
 *
 * A primeira versão procurava classe presente nesta entidade e ausente em TODAS as
 * outras. Medido no alvo, isso falhou em 14 das 18 entidades do lote 1, e a causa
 * é estrutural: os homônimos não são bundles paralelos, são **base + extras
 * aditivos** (o que o §5.3 do plano já previa e eu não tinha usado). O bundle de
 * `<select>` (91×) é EXATAMENTE o núcleo dos dois de `<input>`; ele não tem classe
 * única nenhuma, e ficava sem nome.
 *
 * A regra certa: núcleo = interseção do grupo. Quem não tem extra É o núcleo e
 * leva o nome base; os demais recebem sufixo pelos seus extras, em ordem de
 * relevância (tipografia > raio > cor/borda > espaçamento; classe plana antes de
 * variante), acumulando até desempatar.
 *
 * Persistindo o empate, ou os dois têm o MESMO conjunto de classes — e aí a
 * diferença é classe DUPLICADA no atributo, não bundle distinto — ou o nome é
 * declarado fraco. Sufixo mudo (`_V2`) é proibido: esconderia as duas coisas.
 */
const VARIANTE = (c) => /^[\w[\]&>._-]+:/.test(c);
const RANK_EXTRA = (c) => {
  const b = c.replace(/^(?:[\w[\]&>._-]+:)+/, "");
  const r =
    /^(?:font|leading|tracking|italic|uppercase|lowercase|capitalize|truncate|line-clamp)/.test(b) ? 0
    : /^rounded/.test(b) ? 1
    : /^(?:bg|border|ring|outline|shadow|divide|placeholder|fill|stroke)/.test(b) ? 2
    : /^text/.test(b) ? 3
    : /^(?:gap|space)/.test(b) ? 4
    : /^p[xytrbles]?-/.test(b) ? 5
    : /^m[xytrbles]?-/.test(b) ? 6
    : 7;
  return r + (VARIANTE(c) ? 10 : 0);
};
const cmpExtra = (a, b) => RANK_EXTRA(a) - RANK_EXTRA(b) || a.length - b.length || a.localeCompare(b);

const conjuntoCanonico = (e) => [...new Set(e.classes)].sort().join(" ");

function desempatar(grupo) {
  // Passo 0, ANTES de qualquer sufixo: conjunto de classes IDÊNTICO = mesma
  // entidade. A diferença é classe repetida no atributo, e `[a,b,c]` vs `[a,b,c,c]`
  // produzem chaves de bundle diferentes. Sem este passo o laço de sufixo abaixo
  // acha um nome livre para a gêmea e o defeito some — que é pior do que o defeito.
  const porConjunto = new Map();
  for (const e of grupo) {
    const k = conjuntoCanonico(e);
    if (!porConjunto.has(k)) porConjunto.set(k, []);
    porConjunto.get(k).push(e);
  }
  const representantes = [];
  for (const [, membros] of porConjunto) {
    membros.sort((a, b) => b.n - a.n);
    representantes.push(membros[0]);
    for (const g of membros.slice(1)) {
      g.nome = null;
      g.nomeFraco = true;
      g.duplicataDeClasse = true;
      g.gemeo = membros[0].chave;
      g.motivoFraco = "conjunto de classes IDÊNTICO ao da gêmea — a diferença é classe DUPLICADA no atributo, não bundle distinto. Mesma entidade, contada duas vezes.";
    }
  }

  const sets = representantes.map((e) => new Set(e.classes));
  const nucleo = [...sets[0]].filter((c) => sets.every((s) => s.has(c)));
  for (const e of representantes) {
    e.nucleoComum = nucleo;
    e.extras = [...new Set(e.classes)].filter((c) => !nucleo.includes(c)).sort(cmpExtra);
  }
  /**
   * Quem leva o nome BASE, sem sufixo:
   *   1. o NÚCLEO, se existir — a entidade cujo conjunto é exatamente a interseção
   *      do grupo. É o caso do `<select>` de 91×, que é o núcleo dos `<input>`.
   *   2. senão, o membro mais frequente.
   *
   * A primeira versão ordenava só por "menos extras", e o resultado foi absurdo:
   * uma entidade de 2 call sites levava `SETTINGS_INPUT` porque tinha 4 extras,
   * enquanto a de 190 call sites virava `SETTINGS_INPUT_TEXT_CONTENT_PRIMARY` por
   * ter 6. Num design system o nome curto pertence ao membro dominante; a variante
   * é que carrega sufixo.
   */
  const usados = new Map();
  const ordem = [...representantes].sort(
    (a, b) => (a.extras.length ? 1 : 0) - (b.extras.length ? 1 : 0) || b.n - a.n
  );
  for (const e of ordem) {
    e.fonteNome = e.extras.length === 0
      ? "núcleo do grupo homônimo (conjunto = interseção)"
      : (e === ordem[0] ? "membro mais frequente do grupo homônimo" : "variante — base + extras");

    /**
     * O SUFIXO É RELATIVO A QUEM JÁ LEVOU O NOME, não aos `extras` do grupo.
     *
     * Defeito medido (review adversarial, 26 de 411 entidades, 981 usos): a versão
     * anterior anexava `e.extras[k]`, e `extras` é "classe fora do núcleo do GRUPO
     * INTEIRO". Num grupo heterogêneo isso inclui classes que a entidade
     * COMPARTILHA com a homônima que já levou o nome base — e como anexar um token
     * compartilhado ainda produz string única, o laço nunca declarava nome fraco.
     * Saída real:
     *   COMMON_LABEL                = "block font-semibold mb-3 text-content-primary text-sm"
     *   COMMON_LABEL_FONT_SEMIBOLD  = "block font-semibold mb-2 text-content-primary text-sm"
     * As duas têm `font-semibold`; o que muda é `mb-3` vs `mb-2`. O sufixo nomeava
     * o que elas têm em COMUM. Quem aplicasse o codemod escolheria entre os dois
     * nomes sem nenhum sinal do que de fato muda.
     *
     * Regra correta, e ela é uma só: a cada colisão, olhar o OCUPANTE do nome e
     * tirar o sufixo da DIFERENÇA para ele.
     *   - diferença positiva (classe que eu tenho e ele não) → sufixo direto;
     *   - sem diferença positiva (sou subconjunto estrito dele) → a única coisa
     *     que me distingue é a AUSÊNCIA, e o sufixo é `_SEM_<classe dele>`.
     *     Feio de propósito e verdadeiro: `COMMON_LABEL_SEM_MB_3` é a label sem a
     *     margem. `_V2` continua proibido — sufixo mudo esconderia isto.
     */
    const minhas = new Set(e.classes);
    let nome = e.nomeBase;
    const positivas = [], negativas = [], passos = [];
    while (usados.has(nome) && passos.length < 3) {
      const ocupante = usados.get(nome);
      const dele = new Set(ocupante.classes);
      const cand = [...minhas].filter((c) => !dele.has(c) && !positivas.includes(c)).sort(cmpExtra);
      const registrar = (classe, sinal) => passos.push({
        ocupante: nome, chaveOcupante: ocupante.chave, classe, sinal,
      });
      if (cand.length) {
        registrar(cand[0], "+");
        positivas.push(cand[0]);
        nome = `${nome}_${upperSnake(cand[0])}`;
      } else {
        const ausentes = [...dele].filter((c) => !minhas.has(c) && !negativas.includes(c)).sort(cmpExtra);
        if (!ausentes.length) break; // conjuntos idênticos — já tratado no passo 0
        registrar(ausentes[0], "-");
        negativas.push(ausentes[0]);
        nome = `${nome}_SEM_${upperSnake(ausentes[0])}`;
      }
    }
    if (usados.has(nome)) {
      e.nome = nome;
      e.nomeFraco = true;
      e.gemeo = usados.get(nome).chave;
      e.motivoFraco = "3 passos de desempate não separaram esta entidade da homônima";
    } else {
      e.nome = nome;
      if (passos.length) {
        e.discriminador = [...positivas, ...negativas.map((c) => `sem ${c}`)].join(" ");
        e.discriminadorPositivo = positivas;
        e.discriminadorNegativo = negativas;
        e.passosDiscriminacao = passos;
        e.donoDoNomeBase = usados.get(e.nomeBase)?.chave ?? null;
      }
      usados.set(nome, e);
    }
  }
}

/**
 * AUDITORIA DE PODER DISCRIMINANTE — o contador que certificava o contrário.
 *
 * O relatório anterior dizia "nome fraco 0 | 0" enquanto 26 nomes traziam sufixo
 * não-discriminante, porque `nomeFraco` media UNICIDADE DE STRING. Unicidade não é
 * poder discriminante: `A` e `A_FONT_SEMIBOLD` são strings distintas mesmo quando
 * `font-semibold` está nas duas.
 *
 * Esta função mede a propriedade CERTA e é independente da construção: parte só do
 * nome final e das classes. Se ela discordar da construção, quem manda é ela — o
 * artefato não pode certificar uma propriedade que a medição contradiz.
 *
 * COMO ELA LÊ O SUFIXO, e por que não por substring. A sonda da review usava
 * `sufixo.includes(upperSnake(classe))`, e isso confunde PREFIXO DE SEGMENTO com
 * discriminador: em `COMMON_ROW_GAP_S36_FLEX_WRAP` o discriminador é `flex-wrap`
 * (exclusivo), mas `FLEX_WRAP` contém `FLEX`, e `flex` está nas duas — a sonda
 * acusa um nome que está certo. Aqui o sufixo é SEGMENTADO: casamento guloso pelo
 * mais longo sobre o vocabulário real das duas entidades, com `SEM` marcando
 * discriminador negativo. Só depois se pergunta se a classe é compartilhada.
 *
 * Os dois números continuam publicados:
 *   `falhas`         — segmentação diz que o sufixo cita classe compartilhada. É a
 *                      acusação, e ela marca a entidade como nome fraco.
 *   `falsosPositivos`— a sonda por substring acusa, a segmentação inocenta. Ficam
 *                      no relatório com o parse, para quem repetir a sonda achar a
 *                      explicação em vez de uma contradição.
 *   `inconclusivos`  — o sufixo não segmenta pelo vocabulário das duas. Não acuso
 *                      nem inocento: vai para a fila do dono.
 */
function segmentarSufixo(sufixo, candidatos) {
  const segs = sufixo.split("_");
  const tab = candidatos
    .map((c) => ({ classe: c, segs: upperSnake(c).split("_") }))
    .sort((a, b) => b.segs.length - a.segs.length);
  const out = [];
  let i = 0, sinal = "+";
  while (i < segs.length) {
    if (segs[i] === "SEM") { sinal = "-"; i++; continue; }
    const hit = tab.find((t) => t.segs.every((s, j) => segs[i + j] === s));
    if (!hit) return null;                       // não segmenta: inconclusivo
    out.push({ classe: hit.classe, sinal });
    i += hit.segs.length;
    sinal = "+";
  }
  return out;
}

function auditarPoderDiscriminante(entidades) {
  const nomeados = entidades.filter((e) => e.derivado && e.nome);
  const porNome = new Map(nomeados.map((e) => [e.nome, e]));
  const norm = (c) => upperSnake(c);
  const falhas = [], falsosPositivos = [], inconclusivos = [];
  for (const e of nomeados) {
    let base = null;
    for (const n of porNome.keys()) {
      if (n !== e.nome && e.nome.startsWith(`${n}_`) && (!base || n.length > base.length)) base = n;
    }
    if (!base) continue;
    const dono = porNome.get(base);
    const sufixo = e.nome.slice(base.length + 1);
    const doDono = new Set(dono.classes.map(norm));
    const amplo = e.classes.filter((c) => sufixo.includes(norm(c)) && doDono.has(norm(c)));
    const diferencaReal = [
      ...e.classes.filter((c) => !dono.classes.includes(c)).map((c) => `+${c}`),
      ...dono.classes.filter((c) => !e.classes.includes(c)).map((c) => `-${c}`),
    ];
    const parse = segmentarSufixo(sufixo, [...new Set([...e.classes, ...dono.classes])]);
    const registro = { nome: e.nome, base, sufixo, entidade: e, parse, compartilhadasAmplo: amplo, diferencaReal };
    if (!parse) {
      if (amplo.length) inconclusivos.push(registro);
      continue;
    }
    // Positivo tem que ser MEU e ausente nele; negativo, DELE e ausente em mim.
    const compartilhadas = parse
      .filter((p) => (p.sinal === "+" ? dono.classes.includes(p.classe) : e.classes.includes(p.classe)))
      .map((p) => p.classe);
    if (compartilhadas.length) falhas.push({ ...registro, compartilhadas });
    else if (amplo.length) falsosPositivos.push(registro);
  }
  return { falhas, falsosPositivos, inconclusivos };
}

/**
 * O invariante da CONSTRUÇÃO, checado pelos metadados do próprio laço: nenhuma
 * classe usada como discriminador positivo pode pertencer ao ocupante do nome
 * base. Violar isto é bug no laço acima, não caso legítimo — por isso é fatal.
 */
function invarianteDoDiscriminador(entidades) {
  const porChave = new Map(entidades.map((e) => [e.chave, e]));
  const violacoes = [];
  for (const e of entidades) {
    for (const p of e.passosDiscriminacao ?? []) {
      const ocup = porChave.get(p.chaveOcupante);
      if (!ocup) continue;
      const temNoOcupante = ocup.classes.includes(p.classe);
      const temEmMim = e.classes.includes(p.classe);
      if (p.sinal === "+" && (temNoOcupante || !temEmMim)) {
        violacoes.push({ nome: e.nome, ocupante: p.ocupante, classe: p.classe, sinal: p.sinal });
      }
      if (p.sinal === "-" && (!temNoOcupante || temEmMim)) {
        violacoes.push({ nome: e.nome, ocupante: p.ocupante, classe: p.classe, sinal: p.sinal });
      }
    }
  }
  return violacoes;
}

// ─── execução ──────────────────────────────────────────────────────────────────
const { ts, versao: tsVersao, caminho: tsCaminho } = await carregarTypeScript(ROOT);
const tw = await carregarContentFiles(ROOT);
const extAudit = auditarExtensoes(ROOT, tw);

const {
  arquivos, bundles, usos, atributos, dinamicos,
  contratos, contratosAmbiguos, atributosViaContrato, usosViaContrato,
  identificadoresNaoResolvidos,
} = census(ROOT);
const { ocorrencias, atributosAst } = coletarOcorrencias(ts, ROOT, arquivos, contratos);

// sinal 3: o AST tem que ver essencialmente o que o regex vê
const coberturaAst = atributos ? atributosAst / atributos : 0;
if (coberturaAst < MIN_AST_COVERAGE) {
  fail(
    `SINAL 3 (cobertura AST): o AST viu ${atributosAst} atributos className estáticos\n` +
    `contra ${atributos} do censo por regex — ${(coberturaAst * 100).toFixed(1)}%, abaixo do piso de ${(MIN_AST_COVERAGE * 100).toFixed(0)}%.\n` +
    `Contexto faltando é nome inventado. Ajuste o coletor antes de propor qualquer contrato.`
  );
}

const porChave = new Map();
for (const o of ocorrencias) {
  if (!porChave.has(o.chave)) porChave.set(o.chave, []);
  porChave.get(o.chave).push(o);
}

// saúde do denominador pinado: quanto dele não é classe nenhuma
let usosContaminados = 0, usosColchetePartido = 0, bundlesContaminados = 0;
let usosDuplicados = 0, bundlesComDuplicata = 0;
for (const [, v] of bundles) {
  const cont = v.classes.filter(TOKEN_CONTAMINADO).length;
  const part = v.classes.filter(COLCHETE_PARTIDO).length;
  if (cont || part) bundlesContaminados++;
  usosContaminados += cont * v.n;
  usosColchetePartido += part * v.n;
  const dup = v.classes.length - new Set(v.classes).size;
  if (dup) { bundlesComDuplicata++; usosDuplicados += dup * v.n; }
}

const entidades = [];
for (const [chave, v] of bundles) {
  if (!isEntity(v, MIN_REPEAT, MIN_CLASSES)) continue;
  const ocs = porChave.get(chave) ?? [];
  const classes = v.classes;
  const tokenizaveis = classes.filter((c) => TOKENIZAVEL.test(c));
  const sujas = classes.filter((c) => TOKEN_CONTAMINADO(c) || COLCHETE_PARTIDO(c));
  const banda = BANDAS.find((b) => v.n >= b.min) ?? BANDAS[BANDAS.length - 1];
  const nome = derivarNome(ocs, classes);
  const arqs = [...new Set(ocs.map((o) => o.arquivo))];
  entidades.push({
    chave, classes, n: v.n, usos: classes.length * v.n,
    banda: banda.id, bandaRot: banda.rot,
    tokenizaveis, nTokenizaveis: tokenizaveis.length,
    fracaoTokenizavel: tokenizaveis.length / classes.length,
    composicaoPura: tokenizaveis.length === 0,
    contaminada: sujas.length > 0,
    tokensSujos: sujas,
    classesRepetidas: classes.length - new Set(classes).size,
    // call site estático = o AST confirmou literal puro -> troca direta por className={NOME}.
    // call site dinâmico = só o regex viu, o literal está dentro de um template com ${} ->
    // a troca exige forma composta, e é AQUI que o tailwind-merge ganha o lugar dele.
    callSitesEstaticos: Math.min(ocs.length, v.n),
    callSitesDinamicos: Math.max(0, v.n - ocs.length),
    ocorrenciasAst: ocs.length,
    arquivos: arqs,
    foraDoContent: arqs.filter((f) => !cobertoPorContent(f, tw)),
    amostras: ocs.slice(0, AMOSTRAS).map((o) => ({ arquivo: o.arquivo, linha: o.linha, tag: o.tag, bruto: o.bruto })),
    ...nome,
  });
}

// colisões de nome, resolvidas pela classe separadora
const grupos = new Map();
for (const e of entidades) {
  if (!e.nomeBase) { e.nome = null; continue; }
  if (!grupos.has(e.nomeBase)) grupos.set(e.nomeBase, []);
  grupos.get(e.nomeBase).push(e);
}
for (const [, g] of grupos) {
  if (g.length === 1) { g[0].nome = g[0].nomeBase; continue; }
  desempatar(g);
}

/**
 * SINAL 5 (poder discriminante do nome). O nome é o produto inteiro desta fase;
 * um nome cujo sufixo cita classe COMPARTILHADA com a homônima mente para quem vai
 * aplicar o codemod. A construção acima garante que isso não acontece; estas duas
 * checagens verificam a garantia em vez de confiar nela.
 *
 * Invariante quebrado = bug no laço de desempate, e aí falha fechada: artefato que
 * certifica propriedade que a medição contradiz é pior que artefato ausente.
 */
const violacoesInvariante = invarianteDoDiscriminador(entidades);
if (violacoesInvariante.length) {
  fail(
    `SINAL 5 (discriminador): ${violacoesInvariante.length} passo(s) de desempate violam o\n` +
    `invariante — discriminador positivo tem que ser classe MINHA e AUSENTE no ocupante do nome;\n` +
    `negativo, classe DELE e ausente em mim.\n` +
    violacoesInvariante.slice(0, 10).map((v) => `  ${v.nome}: '${v.classe}' (${v.sinal}) contra '${v.ocupante}'`).join("\n")
  );
}
const {
  falhas: nomesNaoDiscriminantes,
  falsosPositivos: sondaAmplaFalsoPositivo,
  inconclusivos: sufixosInconclusivos,
} = auditarPoderDiscriminante(entidades);
for (const f of nomesNaoDiscriminantes) {
  f.entidade.nomeFraco = true;
  f.entidade.nomeNaoDiscriminante = true;
  f.entidade.motivoFraco =
    `o sufixo '${f.sufixo}' cita classe que esta entidade COMPARTILHA com \`${f.base}\` ` +
    `(${f.compartilhadas.join(" ")}) — o que de fato difere é: ${f.diferencaReal.join(" ")}`;
}
for (const f of sufixosInconclusivos) {
  f.entidade.nomeFraco = true;
  f.entidade.nomeNaoDiscriminante = true;
  f.entidade.sufixoInconclusivo = true;
  f.entidade.motivoFraco =
    `o sufixo '${f.sufixo}' não segmenta pelo vocabulário desta entidade nem de \`${f.base}\`, ` +
    `então NÃO dá para provar que ele discrimina. Diferença real: ${f.diferencaReal.join(" ")}`;
}

entidades.sort((a, b) => b.usos - a.usos || b.n - a.n || a.chave.localeCompare(b.chave));

/* ─── COMPOSIÇÃO — o instrumento 2 do oráculo, agora com proposta ───────────────
 *
 * Bundle que NÃO é entidade mas CONTÉM uma entidade inteira. Não precisa de
 * contrato novo: precisa de `cn(NUCLEO, extras)`. A detecção é a de
 * `lib/composition.mjs` — a MESMA que `measure-disposition` conta no instrumento 2,
 * importada e não recopiada.
 */
const tm = await carregarTailwindMerge(ROOT);
const entsCenso = entidadesDoCenso(bundles, MIN_REPEAT, MIN_CLASSES);
const composicoesRaw = detectarComposicoes(bundles, entsCenso);

const porChaveEntidade = new Map(entidades.map((e) => [e.chave, e]));
const composicoes = [];
for (const [chave, c] of composicoesRaw) {
  const ent = porChaveEntidade.get(c.nucleo);
  const ocs = porChave.get(chave) ?? [];
  const conflito = analisarConflito(tm.twMerge, c.classesNucleo, c.extras);
  const alt = porChaveEntidade.get(c.nucleoPorFrequencia);
  composicoes.push({
    chave,
    classes: c.classes,
    n: c.n,
    usos: c.usos,
    nucleoChave: c.nucleo,
    nucleoNome: ent?.nome ?? null,
    /** Núcleo sem nome derivado não pode virar `cn(NOME, …)`. Fica declarado. */
    nucleoSemNome: !ent?.nome,
    nucleoClasses: c.classesNucleo,
    nucleoCallSites: bundles.get(c.nucleo).n,
    extras: c.extras,
    extrasDuplicados: c.extrasDuplicados,
    candidatos: c.candidatos.length,
    maximais: c.maximais.length,
    ambiguo: c.ambiguo,
    candidatosMultiplos: c.candidatosMultiplos,
    divergePorFrequencia: c.divergePorFrequencia,
    nucleoAlternativoNome: alt?.nome ?? null,
    nucleoAlternativoClasses: c.divergePorFrequencia ? bundles.get(c.nucleoPorFrequencia).classes.length : null,
    gemeasNoNucleo: c.gemeasNoNucleo.length,
    conflito,
    /**
     * Os call sites REAIS. `callSitesSemAst` são os que só o regex do censo viu —
     * o literal está dentro de template com `${}` e o AST não o reporta como
     * atributo estático. Ficam contados, nunca omitidos.
     */
    callSites: ocs.map((o) => ({
      arquivo: o.arquivo, linha: o.linha, tag: o.tag,
      componente: o.componente, bruto: o.bruto,
    })),
    callSitesSemAst: Math.max(0, c.n - ocs.length),
  });
}
composicoes.sort((a, b) => b.usos - a.usos || b.n - a.n || a.chave.localeCompare(b.chave));

/**
 * FALHA FECHADA na reconciliação com o oráculo. Estes números são publicados ao
 * lado do instrumento 2 de `measure-disposition`; se a soma dos usos aqui não for
 * a mesma que aquele script imprime, os dois estariam propondo sobre universos
 * diferentes — o defeito dos dois censos, de novo, numa camada acima.
 */
const usosComposicao = soma_(composicoes, (c) => c.usos);
function soma_(arr, f) { return arr.reduce((s, x) => s + f(x), 0); }
const usosComposicaoRecontado = [...composicoesRaw.keys()]
  .reduce((s, k) => s + bundles.get(k).classes.length * bundles.get(k).n, 0);
if (usosComposicao !== usosComposicaoRecontado) {
  fail(
    `COMPOSIÇÃO: usos recontados divergem — ${usosComposicao} != ${usosComposicaoRecontado}.\n` +
    `A proposta e o instrumento 2 do oráculo estariam falando de conjuntos diferentes.`
  );
}

const compAmbiguos = composicoes.filter((c) => c.ambiguo);
const compMultiCandidato = composicoes.filter((c) => c.candidatosMultiplos);
const compDivergeFreq = composicoes.filter((c) => c.divergePorFrequencia);
const compConflitoA = composicoes.filter((c) => c.conflito.conflitoResolvido);
const compConflitoB = composicoes.filter((c) => c.conflito.conflitoNaoResolvido && !c.conflito.conflitoResolvido);
const compEquivalentes = composicoes.filter((c) => c.conflito.equivalente);
const compSemNome = composicoes.filter((c) => c.nucleoSemNome);
const compComDuplicata = composicoes.filter((c) => c.extrasDuplicados.length);
const compSemCallSite = composicoes.filter((c) => c.callSites.length === 0);
/** Não é conflito de composição: é a ENTIDADE derrubando classe dela mesma. */
const compAutoConflito = composicoes.filter((c) => c.conflito.nucleoAutoConflito.length);
const entidadesAutoConflito = [...new Map(
  compAutoConflito.map((c) => [c.nucleoChave, { nome: c.nucleoNome, chave: c.nucleoChave, mortas: c.conflito.nucleoAutoConflito }])
).values()];

// ─── agregados ─────────────────────────────────────────────────────────────────
const pct = (n) => `${((100 * n) / usos).toFixed(1)}%`;
const soma = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

const porBanda = BANDAS.map((b) => {
  const es = entidades.filter((e) => e.banda === b.id);
  return { ...b, entidades: es.length, usos: soma(es, (e) => e.usos), callSites: soma(es, (e) => e.n) };
});
let acc = 0;
for (const b of porBanda) { acc += b.usos; b.usosAcumulados = acc; }

const puras = entidades.filter((e) => e.composicaoPura);
const semNome = entidades.filter((e) => !e.derivado);
const nomesFracos = entidades.filter((e) => e.nomeFraco);
const naoDiscriminantes = entidades.filter((e) => e.nomeNaoDiscriminante);
const comNegativo = entidades.filter((e) => e.discriminadorNegativo?.length);
const foraContent = entidades.filter((e) => e.foraDoContent.length);
const semAst = entidades.filter((e) => e.ocorrenciasAst === 0);
const quarentena = entidades.filter((e) => e.contaminada);
const gemeas = entidades.filter((e) => e.duplicataDeClasse);
const migraveis = entidades.filter((e) => !e.contaminada);
const dinamicos_sites = soma(entidades, (e) => e.callSitesDinamicos);

/** O ataque fino: fração tokenizável, não só zero-ou-não-zero. */
const FAIXAS = [
  { rot: "0% — composição pura", tst: (f) => f === 0 },
  { rot: "1–25%", tst: (f) => f > 0 && f <= 0.25 },
  { rot: "26–50%", tst: (f) => f > 0.25 && f <= 0.5 },
  { rot: "51–75%", tst: (f) => f > 0.5 && f <= 0.75 },
  { rot: "76–100%", tst: (f) => f > 0.75 },
].map((x) => {
  const es = entidades.filter((e) => x.tst(e.fracaoTokenizavel));
  return { ...x, entidades: es.length, usos: soma(es, (e) => e.usos) };
});

const destinoCoberto = cobertoPorContent(DESTINO, tw);
if (!destinoCoberto) {
  fail(
    `SINAL 2 (purga): o destino proposto '${DESTINO}' NÃO casa com nenhum glob de\n` +
    `content.files (${tw.arquivo}):\n  ${tw.globs.join("\n  ")}\n` +
    `Contrato posto fora do content tem as classes PURGADAS do CSS — quebra visual\n` +
    `silenciosa em produção. Escolha um destino coberto com --dest.`
  );
}

// ─── relatório ─────────────────────────────────────────────────────────────────
const tabelaEntidade = (es) => {
  const linhas = [
    "| nome proposto | n× | estát./dinâm. | classes | usos | tag dom. | tokenizáveis | arquivos |",
    "|---|---:|---:|---:|---:|---|---:|---:|",
  ];
  for (const e of es) {
    const nome = e.nome ?? (e.duplicataDeClasse ? "↳ GÊMEA — classe duplicada" : "**NÃO-DERIVADO**");
    linhas.push(
      `| \`${nome}\`${e.nomeFraco ? " ⚠" : ""}${e.contaminada ? " ☣" : ""} | ${e.n} | ${e.callSitesEstaticos}/${e.callSitesDinamicos} | ${e.classes.length} | ${e.usos} | ` +
      `${e.tagDominante ? `\`<${e.tagDominante}>\`` : "—"}${e.tagDistintos > 1 ? ` (${e.tagDistintos})` : ""} | ` +
      `${e.nTokenizaveis}/${e.classes.length}${e.composicaoPura ? " 🔸" : ""} | ${e.arquivos.length} |`
    );
  }
  return linhas.join("\n");
};

const detalheEntidade = (e, i) => {
  const nome = e.nome ?? (e.duplicataDeClasse ? "GEMEA_SEM_NOME_PROPRIO" : "NÃO-DERIVADO");
  const L = [];
  L.push(`#### ${i}. \`${nome}\`${e.nomeFraco ? "  ⚠ nome fraco" : ""}`);
  L.push("");
  L.push(`- **bundle** (${e.classes.length} classes, ${e.n} call sites, ${e.usos} usos):`);
  L.push(`  \`\`\`\n  ${e.chave}\n  \`\`\``);
  L.push(`- **papel** \`${e.papel ?? "—"}\` ← ${e.fontePapel ?? "**não derivado**"}`);
  L.push(`- **qualificador** \`${e.qualificador}\` ← ${e.fonteQual}`);
  if (e.nucleoComum?.length) L.push(`- **núcleo comum do grupo homônimo** (${e.nucleoComum.length} classes): \`${e.nucleoComum.join(" ")}\``);
  if (e.extras?.length) L.push(`- **extras sobre o núcleo:** \`${e.extras.join(" ")}\``);
  if (e.discriminador) L.push(`- **discriminador** \`${e.discriminador}\` (colisão resolvida pelos extras sobre o núcleo comum)`);
  if (e.classesRepetidas) L.push(`- ⚠ **${e.classesRepetidas} classe(s) DUPLICADA(s)** dentro do mesmo atributo — defeito do call site, exposto de graça pela tokenização`);
  if (e.motivoFraco) L.push(`- ⚠ **nome fraco:** ${e.motivoFraco}${e.gemeo ? ` (gêmea: \`${e.gemeo}\`)` : ""} — vai para a fila do dono`);
  L.push(`- **tokenizáveis** ${e.nTokenizaveis}/${e.classes.length}${e.composicaoPura ? "  🔸 **composição pura**" : ` (${e.tokenizaveis.join(" ")})`}`);
  if (e.divAcao) L.push(`- 🔸 **F-B2:** \`<${e.tagDominante}>\` com handler — elemento de ação sem elemento de ação`);
  L.push(`- **call sites** ${e.callSitesEstaticos} estáticos (troca direta) · ${e.callSitesDinamicos} dentro de template com \`\${}\` (exige forma composta)`);
  if (e.contaminada) L.push(`- ☣ **QUARENTENA:** o bundle contém token que não é classe — ${e.tokensSujos.map((t) => `\`${t}\``).join(" ")}. Não migra até o censo separar interpolação.`);
  if (e.foraDoContent.length) L.push(`- 🔴 **${e.foraDoContent.length} arquivo(s) FORA do content.files** — classes já purgadas hoje: ${e.foraDoContent.map((f) => `\`${f}\``).join(", ")}`);
  L.push(`- **declaração proposta** em \`${DESTINO}\`:`);
  L.push("  ```js");
  L.push(`  export const ${nome} =`);
  L.push(`    "${e.amostras[0]?.bruto ?? e.chave}";`);
  L.push("  ```");
  L.push(`- **call sites de amostra** (${Math.min(AMOSTRAS, e.n)} de ${e.n}):`);
  for (const a of e.amostras) L.push(`  - \`${a.arquivo}\` Linha ${a.linha} — \`<${a.tag}>\``);
  L.push("");
  return L.join("\n");
};

const md = [];
md.push("# Entidades canônicas — PROPOSTA (F-D)");
md.push("");
md.push("> **Este documento é proposta. Nada foi aplicado.** Nenhum arquivo de `src/` foi");
md.push("> tocado por este script. A migração exige prova de pixel por lote (F-G/F-H).");
md.push("");
md.push("Reproduzir:");
md.push("");
md.push("```bash");
md.push(`cd ${ROOT}`);
md.push("node <skill>/scripts/propose-entities.mjs --root .");
md.push("```");
md.push("");
md.push("## 1. O critério, e por que ele tem duas condições");
md.push("");
md.push(`**Entidade = bundle que repete ≥ ${MIN_REPEAT}× E tem ≥ ${MIN_CLASSES} classes.**`);
md.push("");
md.push("Repetição sozinha não separa entidade de coincidência: `flex items-start gap-3` e");
md.push("`cursor-pointer h-fit` repetem 2× e não são componente nenhum — são coocorrência");
md.push("incidental. A regra vive em `lib/bundle-census.mjs`, importada tanto por este");
md.push("script quanto por `measure-coverage.mjs`; uma cópia por script divergiria em");
md.push("silêncio na primeira correção.");
md.push("");
md.push("Bundle é comparado com as classes **ORDENADAS** — `flex gap-2` e `gap-2 flex` são o");
md.push("mesmo bundle. Sem isso a contagem de entidade fica subestimada.");
md.push("");
md.push("## 2. Sinais checados — todos fail-closed");
md.push("");
md.push("| sinal | resolveu | evidência |");
md.push("|---|---|---|");
md.push(`| 1 · AST (\`typescript\` do alvo) | ✅ | \`${tsCaminho}\` v${tsVersao} |`);
md.push(`| 2 · purga (\`content.files\`) | ✅ | \`${tw.arquivo}\`, ${tw.globs.length} globs |`);
md.push(`| 3 · cobertura AST × censo | ✅ | ${atributosAst}/${atributos} = ${(coberturaAst * 100).toFixed(1)}% (piso ${(MIN_AST_COVERAGE * 100).toFixed(0)}%) |`);
md.push(`| 4 · extensão fora do censo com \`className\` dentro do content | ✅ | nenhuma |`);
md.push("");
md.push("Extensões que carregam `className` no repo:");
md.push("");
md.push(`- **varridas pelo censo:** ${Object.entries(extAudit.dentro).map(([k, v]) => `\`${k}\` ${v}`).join(" · ") || "—"}`);
md.push(`- **fora do censo, mas também fora do \`content.files\`** (tooling, não app): ${Object.entries(extAudit.fora).map(([k, v]) => `\`${k}\` ${v}`).join(" · ") || "—"}`);
md.push("");
md.push("## 3. O universo");
md.push("");
md.push("| | |");
md.push("|---|---:|");
md.push(`| arquivos varridos | ${arquivos.length} |`);
md.push(`| atributos \`className\` estáticos | ${atributos} |`);
md.push(`| atributos \`className={...}\` dinâmicos | ${dinamicos} |`);
md.push(`| **usos de classe (denominador)** | **${usos}** |`);
md.push(`| bundles distintos | ${bundles.size} |`);
md.push(`| **entidades sob o critério** | **${entidades.length}** |`);
md.push(`| **usos cobertos por entidade** | **${soma(entidades, (e) => e.usos)} · ${pct(soma(entidades, (e) => e.usos))}** |`);
md.push("");
md.push("## 4. O estágio — por banda de repetição");
md.push("");
md.push("Migrar 430 entidades de uma vez é irreversível na prática: um lote que quebra");
md.push("pixel não tem como ser bissectado. As bandas existem para que cada lote seja");
md.push("revertível e medido sozinho.");
md.push("");
md.push("| lote | banda | entidades | call sites | usos | % do denominador | % acumulado |");
md.push("|---|---|---:|---:|---:|---:|---:|");
for (const b of porBanda) {
  md.push(`| **${b.id}** | ${b.rot} | ${b.entidades} | ${b.callSites} | ${b.usos} | ${pct(b.usos)} | ${pct(b.usosAcumulados)} |`);
}
md.push("");
md.push("> **Correção ao §5 do plano.** O plano estagia como `≥20× (41 ent.) → ≥5× (249) →");
md.push("> ≥2×∧≥4cls (430)`. Os dois primeiros números são do critério REVOGADO (§2.3, só");
md.push(`> repetição). Sob o critério vigente, ≥20× dá **${porBanda[0].entidades}** entidades e o acumulado até ≥5× dá`);
md.push(`> **${porBanda[0].entidades + porBanda[1].entidades}**, não 249. Só o 430 do fim sobreviveu à revogação.`);
md.push("");
md.push("## 5. Destino do módulo, e por que não `src/styles/`");
md.push("");
md.push(`**Destino proposto: \`${DESTINO}\`.**`);
md.push("");
md.push(`O \`content.files\` de \`${tw.arquivo}\` é:`);
md.push("");
md.push("```js");
for (const g of tw.globs) md.push(`  "${g}",`);
md.push("```");
md.push("");
md.push("O Tailwind só emite CSS para classe que ele **encontra em texto** dentro desses");
md.push("globs. Um contrato posto em `src/styles/**` não casa com glob nenhum: as classes");
md.push("são **purgadas do CSS**, e a quebra é visual, silenciosa e só aparece em produção");
md.push("— o build passa verde. `src/utils/**/*.js` casa, e é o destino usado aqui.");
md.push("");
md.push("Detalhe que morde: o glob de `utils` é `*.js`, **não** `*.{js,jsx}`. O módulo");
md.push("precisa ser `.js`. Um `design-entities.jsx` seria purgado exatamente como");
md.push("`src/styles/`.");
md.push("");
if (foraContent.length) {
  const nArq = new Set(foraContent.flatMap((e) => e.foraDoContent)).size;
  md.push(`### 5.1 🔴 Achado adjacente: ${nArq} arquivo(s) do alvo já estão fora do \`content.files\` hoje`);
  md.push("");
  md.push(`${foraContent.length} entidades têm call site em arquivo que **não casa** com nenhum glob`);
  md.push("do `content.files`. As classes desses call sites já são purgadas hoje — só");
  md.push("renderizam se a mesma classe aparecer em algum arquivo varrido. Arquivos:");
  md.push("");
  for (const f of [...new Set(foraContent.flatMap((e) => e.foraDoContent))].sort()) md.push(`- \`${f}\``);
  md.push("");
  md.push("Migrar essas entidades para o módulo **conserta** o vazamento de graça, porque a");
  md.push("string passa a viver num arquivo varrido.");
  md.push("");
}
md.push("## 6. Ataque ao próprio critério — composição pura");
md.push("");
md.push("A pergunta que reprova este trabalho se a resposta for alta: **quantas entidades");
md.push("propostas não têm nenhuma classe de família tokenizável** (cor, spacing, radius,");
md.push("tipografia, borda, sombra)? Uma entidade assim é puro arranjo — `flex`, `w-full`,");
md.push("`absolute`, `overflow-hidden` — e nomear arranjo é o defeito oposto ao que este");
md.push("projeto corrige.");
md.push("");
md.push("| | entidades | % das entidades | usos | % do denominador |");
md.push("|---|---:|---:|---:|---:|");
md.push(`| **composição pura** (0 classe tokenizável) | ${puras.length} | ${((100 * puras.length) / entidades.length).toFixed(1)}% | ${soma(puras, (e) => e.usos)} | ${pct(soma(puras, (e) => e.usos))} |`);
const mistas = entidades.filter((e) => !e.composicaoPura);
md.push(`| com ao menos 1 classe tokenizável | ${mistas.length} | ${((100 * mistas.length) / entidades.length).toFixed(1)}% | ${soma(mistas, (e) => e.usos)} | ${pct(soma(mistas, (e) => e.usos))} |`);
md.push("");
md.push("**O zero-ou-não-zero é uma barra baixa, e responder só ele seria autoindulgente.**");
md.push("Basta um `text-sm` num bundle de 8 classes para a entidade sair da coluna \"pura\".");
md.push("A distribuição da fração tokenizável é a resposta honesta:");
md.push("");
md.push("| fração tokenizável do bundle | entidades | usos | % do denominador |");
md.push("|---|---:|---:|---:|");
for (const f of FAIXAS) md.push(`| ${f.rot} | ${f.entidades} | ${f.usos} | ${pct(f.usos)} |`);
md.push("");
md.push("Leitura: a massa está na metade superior, e é isso que sustenta o critério — o");
md.push("limiar de ≥4 classes está de fato filtrando coocorrência incidental. O que ele");
md.push("**não** filtra, e o relatório não esconde, são as entidades de fração baixa, onde a");
md.push("decisão de design é minoria dentro do arranjo.");
md.push("");
if (puras.length) {
  md.push("As de composição pura, por banda:");
  md.push("");
  md.push("| lote | entidades puras | usos |");
  md.push("|---|---:|---:|");
  for (const b of BANDAS) {
    const ps = puras.filter((e) => e.banda === b.id);
    md.push(`| ${b.id} (${b.rot}) | ${ps.length} | ${soma(ps, (e) => e.usos)} |`);
  }
  md.push("");
  md.push("Amostra das maiores:");
  md.push("");
  md.push(tabelaEntidade(puras.slice(0, 10)));
  md.push("");
}
md.push("## 6.1 ☣ Ataque ao ORÁCULO — o denominador tem lixo de interpolação dentro");
md.push("");
md.push("Achado desta fase, contra o script pinado. O regex do censo aceita");
md.push("`` className={`...`} `` inclusive quando o template tem `${...}`, e `splitClasses`");
md.push("só descarta o pedaço que **contém** `${`. O resto do ternário sobrevive como se");
md.push("fosse classe:");
md.push("");
md.push("```js");
md.push("className={`flex items-center ${isActive ? \"bg-x\" : \"bg-y\"} gap-2`}");
md.push("//  -> [\"flex\",\"items-center\",\"?\",'\"bg-x\"',\":\",'\"bg-y\"}',\"gap-2\"]");
md.push("```");
md.push("");
md.push("| | usos | % do denominador |");
md.push("|---|---:|---:|");
md.push(`| token que não é classe (\`?\`, \`:\`, \`"bg-x"\`, \`}\`) | ${usosContaminados} | ${pct(usosContaminados)} |`);
md.push(`| valor arbitrário partido por espaço (\`font-['Plus\` + \`Jakarta\` + \`Sans']\`) | ${usosColchetePartido} | ${pct(usosColchetePartido)} |`);
md.push(`| classe **repetida** dentro do mesmo atributo (\`w-full … w-full\`) | ${usosDuplicados} | ${pct(usosDuplicados)} |`);
md.push(`| bundles afetados pelos dois primeiros | ${bundlesContaminados} de ${bundles.size} | |`);
md.push(`| bundles com classe repetida | ${bundlesComDuplicata} de ${bundles.size} | |`);
md.push("");
md.push("A classe repetida tem um efeito próprio e pior: ela não suja o bundle, ela o");
md.push("**duplica**. `[a,b,c]` e `[a,b,c,c]` são chaves diferentes, então o mesmo componente");
md.push("aparece como duas entidades distintas e a maior delas fica subcontada. Está medido");
md.push("no lote 1 abaixo, no par de `<input>` de 190× e 30×.");
md.push("");
md.push("**Não mudei o oráculo.** Trocar o denominador pinado no meio da fase move o chão");
md.push("de todos os números já reportados. Mas o efeito sobre ESTA fase é direto e");
md.push("bloqueante para os itens afetados:");
md.push("");
md.push(`| | entidades | usos |`);
md.push("|---|---:|---:|");
md.push(`| ☣ **quarentena** — bundle com token que não é classe | ${quarentena.length} | ${soma(quarentena, (e) => e.usos)} |`);
md.push(`| **migráveis** | ${migraveis.length} | ${soma(migraveis, (e) => e.usos)} |`);
md.push("");
md.push("Uma entidade em quarentena emitiria `export const X = \"flex ? \\\"bg-x\\\" ...\"` — um");
md.push("contrato quebrado que o build aceita e o pixel reprova. Elas ficam listadas e não");
md.push("migram até o censo separar interpolação de literal.");
md.push("");
if (quarentena.length) {
  md.push(tabelaEntidade(quarentena));
  md.push("");
}
md.push("## 6.2 Call site dinâmico — onde o `tailwind-merge` ganha o lugar dele");
md.push("");
md.push(`Dos ${soma(entidades, (e) => e.n)} call sites das entidades, **${soma(entidades, (e) => e.callSitesEstaticos)} são literal estático** — o AST confirmou — e`);
md.push(`**${dinamicos_sites} estão dentro de um template com \`\${}\`**. A diferença muda o codemod:`);
md.push("");
md.push("| call site | codemod |");
md.push("|---|---|");
md.push("| estático | `className=\"a b c d\"` → `className={NOME}` — troca direta |");
md.push("| dinâmico | `` className={`a b c d ${cond ? \"x\" : \"y\"}`} `` → `` className={twMerge(NOME, cond ? \"x\" : \"y\")} `` |");
md.push("");
md.push("Isso responde uma pergunta que o plano deixou em aberto: para bundle EXATO o");
md.push("`tailwind-merge` não é necessário — as classes são as mesmas, não há o que fundir.");
md.push(`Ele passa a ser necessário nos ${dinamicos_sites} call sites dinâmicos e na camada de`);
md.push("família (drift aditivo `mt-2`/`pr-10`), não na troca do lote 1.");
md.push("");
/* ─── 6.3 COMPOSIÇÃO ──────────────────────────────────────────────────────────── */
const pctComp = (n) => `${((100 * n) / usos).toFixed(1)}%`;
md.push("## 6.3 Composição — o bundle que **já contém** uma entidade");
md.push("");
md.push("Este é o instrumento 2 do oráculo (`measure-disposition`), agora com proposta. Um");
md.push("bundle que **não** é entidade — aparece 1×, ou tem poucas classes — mas que contém");
md.push("uma entidade inteira como subconjunto não é componente novo: é o bundle canônico");
md.push("com `mt-2`/`pr-10` grudado em cima. É o drift **aditivo** já medido na família do");
md.push("`<input>` (80 strings distintas, a top1 com 41% dos call sites).");
md.push("");
md.push(`**${composicoes.length} bundles · ${usosComposicao} usos · ${pctComp(usosComposicao)} do denominador.**`);
md.push("Nenhum deles precisa de contrato novo. Todos precisam de:");
md.push("");
md.push("```jsx");
md.push('className={cn(NUCLEO_EXISTENTE, "mt-2 pr-10")}');
md.push("```");
md.push("");
md.push("| | bundles | usos | % do denominador |");
md.push("|---|---:|---:|---:|");
md.push(`| composição detectada | ${composicoes.length} | ${usosComposicao} | ${pctComp(usosComposicao)} |`);
md.push(`| ↳ **equivalente** — \`cn()\` emite exatamente o bundle original | ${compEquivalentes.length} | ${soma(compEquivalentes, (c) => c.usos)} | ${pctComp(soma(compEquivalentes, (c) => c.usos))} |`);
md.push(`| ↳ ⚠ **conflito A** — \`twMerge\` derruba classe do NÚCLEO (muda o que renderiza) | ${compConflitoA.length} | ${soma(compConflitoA, (c) => c.usos)} | ${pctComp(soma(compConflitoA, (c) => c.usos))} |`);
md.push(`| ↳ ⚠ **conflito B** — mesma propriedade, \`twMerge\` mantém os DOIS (blind spot) | ${compConflitoB.length} | ${soma(compConflitoB, (c) => c.usos)} | ${pctComp(soma(compConflitoB, (c) => c.usos))} |`);
md.push(`| ↳ 🔴 núcleo **sem nome derivado** — não dá para escrever \`cn(NOME, …)\` | ${compSemNome.length} | ${soma(compSemNome, (c) => c.usos)} | ${pctComp(soma(compSemNome, (c) => c.usos))} |`);
md.push(`| ↳ sem call site no AST (literal dentro de template com \`\${}\`) | ${compSemCallSite.length} | ${soma(compSemCallSite, (c) => c.usos)} | ${pctComp(soma(compSemCallSite, (c) => c.usos))} |`);
md.push(`| ↳ extra que é classe **duplicada** do núcleo (defeito do call site) | ${compComDuplicata.length} | ${soma(compComDuplicata, (c) => c.usos)} | ${pctComp(soma(compComDuplicata, (c) => c.usos))} |`);
md.push("");
md.push("### 6.3.1 A ambiguidade: um bundle pode conter MAIS DE UMA entidade");
md.push("");
md.push("Três critérios foram considerados para decidir qual entidade vira o núcleo:");
md.push("");
md.push("| critério | o que faz |");
md.push("|---|---|");
md.push("| (a) a **maior** (mais classes) | minimiza `extras` |");
md.push("| (b) a **mais frequente** (maior `n`) | privilegia o núcleo mais canônico |");
md.push("| (c) o **maior overlap relativo** | \\|núcleo ∩ bundle\\| / \\|bundle\\| |");
md.push("");
md.push("**(c) é idêntico a (a), não uma terceira opção.** Todo candidato é subconjunto do");
md.push("bundle, então |núcleo ∩ bundle| = |núcleo|, e o denominador |bundle| é o **mesmo**");
md.push("para todos os candidatos daquele bundle. Ordenar por overlap relativo é ordenar por");
md.push("|núcleo|. Está travado por teste; apresentá-los como escolhas diferentes seria");
md.push("inventar uma decisão que não existe.");
md.push("");
md.push("**Critério adotado, e a primeira parte dele não é desempate — é correção:**");
md.push("");
md.push("1. **Maximalidade.** Se A ⊂ B e os dois são candidatos, escolher A joga `B \\ A`");
md.push("   dentro de `extras` — classes que fazem parte de um contrato canônico B seriam");
md.push("   emitidas como \"extra ad-hoc\". Isso reintroduz exatamente o drift que a fase");
md.push("   existe para matar. Só candidatos **maximais** disputam.");
md.push("2. Entre os maximais (incomparáveis por definição): `|classes| desc → n desc →");
md.push("   usos desc → chave`. A chave no fim é determinismo, nunca ordem de iteração.");
md.push("");
md.push("`n` não vem antes de `|classes|` porque o custo é assimétrico: núcleo pequeno e");
md.push("frequente deixa `extras` GRANDES no call site — texto que o revisor lê classe a");
md.push("classe — enquanto núcleo grande e raro deixa extras curtos e o nome ainda vem de");
md.push("uma entidade real (≥2 call sites, por construção).");
md.push("");
md.push("**Quanto isso importa, medido — não afirmado:**");
md.push("");
md.push("| | bundles | % dos compostos | leitura |");
md.push("|---|---:|---:|---|");
md.push(`| candidato único — o critério é irrelevante | ${composicoes.length - compMultiCandidato.length} | ${((100 * (composicoes.length - compMultiCandidato.length)) / composicoes.length).toFixed(1)}% | nada a decidir |`);
md.push(`| >1 candidato, mas a cadeia de contenção resolve | ${compMultiCandidato.length - compAmbiguos.length} | ${((100 * (compMultiCandidato.length - compAmbiguos.length)) / composicoes.length).toFixed(1)}% | maximalidade decide sozinha |`);
md.push(`| **AMBÍGUO REAL** — ≥2 maximais incomparáveis | ${compAmbiguos.length} | ${((100 * compAmbiguos.length) / composicoes.length).toFixed(1)}% | o desempate decide |`);
md.push(`| o critério (b) escolheria **outro** núcleo | ${compDivergeFreq.length} | ${((100 * compDivergeFreq.length) / composicoes.length).toFixed(1)}% | mede se (a) vs (b) é material |`);
md.push("");
if (!compAmbiguos.length) {
  md.push("**Ambiguidade real medida: zero.** Todo bundle composto tem um único candidato");
  md.push("maximal, então (a), (b) e (c) produzem o MESMO núcleo em 100% dos casos. O critério");
  md.push("está declarado e travado por teste porque ele passa a importar no instante em que o");
  md.push("conjunto de entidades mudar — não porque ele decida alguma coisa hoje.");
  md.push("");
} else {
  md.push("Os ambíguos, um a um:");
  md.push("");
  md.push("| bundle (usos) | maximais | núcleo escolhido (a) | por frequência (b) |");
  md.push("|---|---:|---|---|");
  for (const c of compAmbiguos) {
    md.push(`| \`${c.chave.slice(0, 60)}…\` (${c.usos}) | ${c.maximais} | \`${c.nucleoNome ?? "—"}\` (${c.nucleoClasses.length} cl) | \`${c.nucleoAlternativoNome ?? "—"}\`${c.divergePorFrequencia ? " ⚠ diverge" : ""} |`);
  }
  md.push("");
}
md.push("### 6.3.2 O risco: `tailwind-merge` entre núcleo e extras");
md.push("");
md.push(`Medido com \`tailwind-merge@${tm.versao}\` (${tm.origem}), prova de vida`);
md.push(`\`twMerge("p-2 p-4") === "${tm.prova}"\`. **Não** é inferência: cada um dos`);
md.push(`${composicoes.length} bundles teve \`cn(NUCLEO, extras)\` executado de verdade e o`);
md.push("resultado comparado com o bundle original.");
md.push("");
md.push("Dois conflitos diferentes, com consequências **opostas** — confundi-los seria o erro caro:");
md.push("");
md.push("| | o que acontece | consequência |");
md.push("|---|---|---|");
md.push("| **A — resolvido** | `twMerge` derruba classe do NÚCLEO; o extra vence | `cn()` emite conjunto **diferente** do original. Pode ser a intenção do dev ou regressão. **Exige pixel.** |");
md.push("| **B — não resolvido** | núcleo e extra tocam a mesma propriedade sob a mesma variante, e os dois sobrevivem | Renderiza **igual** ao original — não é regressão. Mas \"o extra sobrescreve\" falha em silêncio, hoje e depois. |");
md.push("");
md.push(`**A: ${compConflitoA.length} bundles (${soma(compConflitoA, (c) => c.usos)} usos). B: ${compConflitoB.length} bundles (${soma(compConflitoB, (c) => c.usos)} usos).**`);
md.push("");
md.push("#### A linha de base, e o falso positivo que ela matou");
md.push("");
md.push("A primeira versão desta medição comparou `twMerge(núcleo, extras)` direto contra as");
md.push("classes do núcleo e reportou **6 bundles em conflito A**. Cinco eram falso positivo:");
md.push("o **núcleo conflita consigo mesmo**.");
md.push("");
md.push("```js");
md.push('TEXT_PREVIEW_BUTTON = "… bg-transparent bg-sidebar-button …"');
md.push('// twMerge derruba `bg-transparent` — e derrubaria com extras VAZIO.');
md.push('// os extras daquele call site eram `popover-ring z-item-control-low text-content-primary`,');
md.push("// nenhum deles `bg-`.");
md.push("```");
md.push("");
md.push("Atribuir isso à composição cobraria da proposta um defeito que já mora dentro da");
md.push("entidade e **inflaria por 6× o único número que decide se o lote precisa de pixel**.");
md.push("Mesma família do `p`/`px` e do `emContrato`: um balde computado por um predicado só");
md.push("quando são dois. A medição agora tem linha de base `twMerge(núcleo)` sozinho, e");
md.push("conflito A é só o que morre **a mais** quando os extras entram.");
md.push("");
md.push(`**Achado colateral, sobre as ENTIDADES e não sobre a composição: ${entidadesAutoConflito.length} entidades-núcleo`);
md.push(`carregam classe MORTA** — o \`export const\` proposto emite classe que o próprio`);
md.push("`twMerge` descarta em qualquer call site que use `cn()`:");
md.push("");
if (entidadesAutoConflito.length) {
  md.push("| entidade | classe(s) que morrem no próprio bundle |");
  md.push("|---|---|");
  for (const e of entidadesAutoConflito) {
    md.push(`| \`${e.nome ?? "**NÃO-DERIVADO** " + e.chave.slice(0, 40)}\` | \`${e.mortas.join(" ")}\` |`);
  }
  md.push("");
  md.push("Isso **não** bloqueia a composição — o call site de hoje já renderiza assim, porque");
  md.push("quem decide entre duas classes da mesma propriedade é a ordem do CSS gerado, e o");
  md.push("`cn()` só torna a decisão explícita. Vai para a fila do dono junto com a entidade.");
  md.push("");
}
if (compConflitoA.length) {
  md.push("#### A — os perigosos (a composição muda o que renderiza)");
  md.push("");
  md.push("| núcleo | classe do núcleo DERRUBADA **pelos extras** | extra que venceu | usos | call site |");
  md.push("|---|---|---|---:|---|");
  for (const c of compConflitoA) {
    const cs = c.callSites[0];
    const venceu = c.extras.filter((e) => propriedadeDe(e) && c.conflito.nucleoPerdidas.some((p) => propriedadeDe(p) === propriedadeDe(e) && varianteDe(p) === varianteDe(e)));
    md.push(
      `| \`${c.nucleoNome ?? c.nucleoChave.slice(0, 30)}\` | \`${c.conflito.nucleoPerdidas.join(" ")}\` | ` +
      `\`${venceu.join(" ") || "—"}\` | ${c.usos} | ${cs ? `\`${cs.arquivo}\` Linha ${cs.linha}` : "só template `${}`"} |`
    );
  }
  md.push("");
} else {
  md.push("**Conflito A: zero.** Em nenhum dos bundles compostos o `twMerge` derruba classe do");
  md.push("núcleo — `cn(NUCLEO, extras)` emite o mesmo conjunto do bundle original. Isso não é");
  md.push("garantia de pixel (o CSS gerado ainda decide a ordem), mas remove a classe de risco");
  md.push("mais cara: a composição não muda **quais** classes chegam ao elemento.");
  md.push("");
}
if (compConflitoB.length) {
  md.push("#### B — o blind spot medido (utility custom fora do grupo conhecido)");
  md.push("");
  md.push("`tailwind-merge` só funde o que está nos grupos de conflito que ele conhece. Uma");
  md.push("utility custom do alvo (`outline-primary-button`) não está, então ela **não funde**");
  md.push("com `outline-none` e as duas sobrevivem. Aqui isso não é regressão — é o estado que");
  md.push("já existe hoje no call site — mas quem ler `cn(NUCLEO, \"outline-none\")` vai supor");
  md.push("override, e o override não acontece.");
  md.push("");
  md.push("| núcleo | par que NÃO fundiu | propriedade | variante | usos | call site |");
  md.push("|---|---|---|---|---:|---|");
  for (const c of compConflitoB) {
    const cs = c.callSites[0];
    for (const p of c.conflito.paresNaoResolvidos.slice(0, 3)) {
      md.push(
        `| \`${c.nucleoNome ?? c.nucleoChave.slice(0, 30)}\` | \`${p.nucleo}\` × \`${p.extra}\` | ${p.propriedade} | \`${p.variante}\` | ${c.usos} | ${cs ? `\`${cs.arquivo}\` Linha ${cs.linha}` : "só template `${}`"} |`
      );
    }
  }
  md.push("");
}
md.push("### 6.3.3 A proposta, bundle a bundle");
md.push("");
md.push("Cada linha é um call site real. `extras` é o que sobra do bundle depois de descontar");
md.push("o núcleo **por multiconjunto** — se o call site escreveu a mesma classe duas vezes, a");
md.push("segunda sobrevive aqui e está marcada ⧉, porque descontar por conjunto apagaria o");
md.push("defeito em silêncio.");
md.push("");
md.push("| # | núcleo | extras | n× | usos | conflito | call sites |");
md.push("|---:|---|---|---:|---:|---|---|");
composicoes.forEach((c, i) => {
  const conf = c.conflito.conflitoResolvido ? "⚠ A" : c.conflito.conflitoNaoResolvido ? "⚠ B" : "—";
  const sites = c.callSites.length
    ? c.callSites.slice(0, 2).map((s) => `\`${s.arquivo}\`:${s.linha}`).join(" · ") +
      (c.callSites.length > 2 ? ` +${c.callSites.length - 2}` : "")
    : `**sem AST** (${c.callSitesSemAst} em template)`;
  md.push(
    `| ${i + 1} | \`${c.nucleoNome ?? "🔴 " + c.nucleoChave.slice(0, 40)}\` | ` +
    `\`${c.extras.join(" ")}\`${c.extrasDuplicados.length ? " ⧉" : ""} | ${c.n} | ${c.usos} | ${conf} | ${sites} |`
  );
});
md.push("");
md.push("O que o codemod escreveria nos 5 maiores:");
md.push("");
for (const c of composicoes.slice(0, 5)) {
  const cs = c.callSites[0];
  md.push(`- **\`${c.nucleoNome ?? c.nucleoChave}\`** + \`${c.extras.join(" ")}\``);
  if (cs) {
    md.push(`  - \`${cs.arquivo}\` Linha ${cs.linha} — \`<${cs.tag}>\` em \`${cs.componente}\``);
    md.push("  - ```jsx");
    md.push(`    // antes: className="${cs.bruto}"`);
    md.push(`    className={cn(${c.nucleoNome ?? "/* núcleo SEM NOME DERIVADO */"}, "${c.extras.join(" ")}")}`);
    md.push("    ```");
  } else {
    md.push(`  - sem ocorrência no AST — os ${c.n} call sites estão em template com \`\${}\`.`);
  }
}
md.push("");
md.push("### 6.3.4 O que a composição NÃO resolve");
md.push("");
md.push("- **`cn` não existe no alvo.** Medido: `tailwind-merge` não está em `package.json`,");
md.push("  não está em `node_modules`, e não há util `cn`/`clsx` em `src/`. A composição é a");
md.push("  única parte desta fase que introduz **dependência de runtime** — decisão do dono, e");
md.push(`  ela estava implícita no plano. Esta corrida mediu com \`${tm.origem}\`.`);
if (compSemNome.length) {
  md.push(`- **${compSemNome.length} bundles têm núcleo SEM nome derivado.** \`cn(NOME, …)\` não pode`);
  md.push("  ser escrito enquanto a entidade-núcleo não tiver nome — a fila dela é a §7.");
}
if (compSemCallSite.length) {
  md.push(`- **${compSemCallSite.length} bundles não têm ocorrência no AST**: o literal vive dentro de template`);
  md.push("  com `${}`, então não há `arquivo:linha` de atributo estático para citar. Contados, nunca omitidos.");
}
md.push("- **não prova pixel.** Mesmo com conflito A zerado, equivalência visual é F-H.");
md.push("");

md.push("## 7. Derivação de nome — o que não deu");
md.push("");
md.push("| | entidades | usos |");
md.push("|---|---:|---:|");
md.push(`| nome derivado | ${entidades.length - semNome.length} | ${soma(entidades.filter((e) => e.derivado), (e) => e.usos)} |`);
md.push(`| **NÃO-DERIVADO** — papel não sai do contexto | ${semNome.length} | ${soma(semNome, (e) => e.usos)} |`);
md.push(`| ↳ **gêmea** — conjunto idêntico, diferença é classe duplicada | ${gemeas.length} | ${soma(gemeas, (e) => e.usos)} |`);
md.push(`| nome fraco ⚠ — 3 passos de desempate não separaram da homônima | ${nomesFracos.length - gemeas.length - naoDiscriminantes.length} | ${soma(nomesFracos.filter((e) => !e.duplicataDeClasse && !e.nomeNaoDiscriminante), (e) => e.usos)} |`);
md.push(`| ⚠ **sufixo NÃO-DISCRIMINANTE** — cita classe compartilhada com a homônima | ${naoDiscriminantes.length} | ${soma(naoDiscriminantes, (e) => e.usos)} |`);
md.push(`| ↳ discriminador NEGATIVO (\`_SEM_x\`) — sou subconjunto da homônima | ${comNegativo.length} | ${soma(comNegativo, (e) => e.usos)} |`);
md.push(`| sem ocorrência no AST (só o regex viu) | ${semAst.length} | ${soma(semAst, (e) => e.usos)} |`);
md.push("");
md.push("A linha do sufixo não-discriminante é MEDIDA, não declarada: `auditarPoderDiscriminante()`");
md.push("parte só do nome final e das classes. A versão anterior desta tabela dizia `0 | 0` enquanto");
md.push("a sonda da review adversarial achava **26 entidades / 981 usos** com sufixo que cita classe");
md.push("compartilhada — porque `nomeFraco` media UNICIDADE DE STRING, e unicidade não é poder");
md.push("discriminante. A causa estava no laço de desempate, que tirava o sufixo dos `extras` do");
md.push("GRUPO em vez da diferença para a homônima que já levara o nome; está corrigida.");
md.push("");
if (nomesNaoDiscriminantes.length) {
  md.push("| nome | homônima | o sufixo cita (compartilhado) | o que DE FATO difere |");
  md.push("|---|---|---|---|");
  for (const f of nomesNaoDiscriminantes) {
    md.push(`| \`${f.nome}\` | \`${f.base}\` | \`${f.compartilhadas.join(" ")}\` | \`${f.diferencaReal.join(" ")}\` |`);
  }
  md.push("");
}
if (sufixosInconclusivos.length) {
  md.push("**Inconclusivos** — o sufixo não segmenta pelo vocabulário das duas entidades, então a");
  md.push("auditoria não acusa nem inocenta. Vão para a fila do dono:");
  md.push("");
  for (const f of sufixosInconclusivos) md.push(`- \`${f.nome}\` vs \`${f.base}\` — sufixo \`${f.sufixo}\`, diferença real \`${f.diferencaReal.join(" ")}\``);
  md.push("");
}
if (sondaAmplaFalsoPositivo.length) {
  md.push(`**Sonda por substring: ${sondaAmplaFalsoPositivo.length} falso(s) positivo(s), explicado(s) aqui.** Quem`);
  md.push("repetir o predicado `sufixo.includes(upperSnake(classe))` vai acusar estes nomes. Eles estão");
  md.push("certos: o predicado confunde PREFIXO DE SEGMENTO com discriminador. A segmentação gulosa");
  md.push("mostra qual classe o sufixo realmente nomeia.");
  md.push("");
  md.push("| nome | homônima | a sonda acusa | o sufixo segmenta em | o que DE FATO difere |");
  md.push("|---|---|---|---|---|");
  for (const f of sondaAmplaFalsoPositivo) {
    const parse = f.parse.map((p) => `${p.sinal}${p.classe}`).join(" ");
    md.push(`| \`${f.nome}\` | \`${f.base}\` | \`${f.compartilhadasAmplo.join(" ")}\` | \`${parse}\` | \`${f.diferencaReal.join(" ")}\` |`);
  }
  md.push("");
}
if (semNome.length) {
  md.push("As não-derivadas não recebem nome inventado. Elas ficam assim, para o dono:");
  md.push("");
  md.push(tabelaEntidade(semNome.slice(0, 15)));
  md.push("");
}
for (const b of porBanda) {
  const es = entidades.filter((e) => e.banda === b.id);
  md.push(`## Lote ${b.id} — banda ${b.rot} · ${es.length} entidades · ${es.length ? pct(b.usos) : "0%"} do denominador`);
  md.push("");
  if (!es.length) { md.push("_vazio sob o critério vigente._"); md.push(""); continue; }
  md.push(tabelaEntidade(es));
  md.push("");
  if (b.id === "L1") {
    md.push("### Detalhe do lote 1 — o que o codemod escreveria");
    md.push("");
    es.forEach((e, i) => md.push(detalheEntidade(e, i + 1)));
  }
}
md.push("## O que este relatório NÃO faz");
md.push("");
md.push("- **não aplica.** Nenhum arquivo de `src/` foi tocado.");
md.push("- **não prova pixel.** Equivalência visual é F-H, com PNG antes/depois.");
md.push("- **não normaliza equivalência de utility.** `pl-2 pr-2` e `px-2` ainda contam como");
md.push("  bundles diferentes (eixo B, ainda não construído). Todo número aqui é **piso**.");
md.push("- **não enxerga `cva`/`tailwind-variants`/`@apply`** — medido: o censo colapsa");
md.push("  453 → 1. O veículo decidido é `const` exportado, justamente por isso.");
md.push("- **enxerga o `const` exportado** — e isto foi um CONSERTO, não uma capacidade");
md.push("  original. Até a review adversarial da F-D, `className={NOME}` era atributo dinâmico");
md.push("  para o censo: migrar um call site ENCOLHIA o denominador em vez de virar cobertura,");
md.push("  e o oráculo saía com `exit 0` e `NaN%`. Hoje o censo indexa a declaração e resolve o");
md.push(`  call site — medido neste alvo: **${contratos.size} constantes de classe indexadas, ${atributosViaContrato} atributos**`);
md.push(`  **/ ${usosViaContrato} usos** já passam por contrato nomeado, e o denominador cresce em vez de sumir.`);
if (identificadoresNaoResolvidos.size) {
  const lista = [...identificadoresNaoResolvidos.entries()].sort((a, b) => b[1].n - a[1].n)
    .map(([id, v]) => `\`${id}\`(${v.n}×)`).join(", ");
  md.push(`- **${identificadoresNaoResolvidos.size} \`className={IDENT}\` NÃO resolvem** (${lista}): o identificador não é`);
  md.push("  constante de classe declarada no projeto. Ficam declarados aqui, e não somem do relatório.");
}
if (contratosAmbiguos.length) {
  md.push(`- **${contratosAmbiguos.length} constante(s) AMBÍGUA(s)** — mesmo nome, valores diferentes em arquivos`);
  md.push("  diferentes. NÃO são resolvidas: escolher uma inventaria cobertura.");
}
md.push("- **não cobre `className={...}` dinâmico** além do literal interno e do contrato nomeado:");
md.push(`  ${dinamicos} atributos dinâmicos ficam parcialmente fora e são declarados aqui, não omitidos.`);
md.push("");

const outMd = path.join(ROOT, OUT_MD);
mkdirSync(path.dirname(outMd), { recursive: true });
writeFileSync(outMd, md.join("\n"));

const outJson = path.join(ROOT, OUT_JSON);
mkdirSync(path.dirname(outJson), { recursive: true });
writeFileSync(outJson, JSON.stringify({
  root: ROOT,
  criterio: { minRepeat: MIN_REPEAT, minClasses: MIN_CLASSES },
  sinais: {
    typescript: `${tsCaminho}@${tsVersao}`, tailwind: tw.arquivo, coberturaAst, extAudit,
    tailwindMerge: { versao: tm.versao, caminho: tm.caminho, origem: tm.origem, provaDeVida: tm.prova },
  },
  destino: DESTINO,
  universo: {
    arquivos: arquivos.length, atributos, dinamicos, usos, bundles: bundles.size,
    contratosIndexados: contratos.size,
    contratosAmbiguos: contratosAmbiguos.length,
    atributosViaContratoNomeado: atributosViaContrato,
    usosViaContratoNomeado: usosViaContrato,
    identificadoresNaoResolvidos: [...identificadoresNaoResolvidos.entries()]
      .map(([ident, v]) => ({ ident, atributos: v.n, arquivos: v.arquivos.size }))
      .sort((a, b) => b.atributos - a.atributos),
  },
  bandas: porBanda,
  ataque: {
    composicaoPura: puras.length,
    usosComposicaoPura: soma(puras, (e) => e.usos),
    naoDerivadas: semNome.length,
    nomesFracos: nomesFracos.length,
    gemeas: gemeas.length,
    // MEDIDO, não declarado: sufixo que cita classe compartilhada com a homônima.
    sufixoNaoDiscriminante: nomesNaoDiscriminantes.length,
    usosComSufixoNaoDiscriminante: soma(nomesNaoDiscriminantes.map((f) => f.entidade), (e) => e.usos),
    sufixoInconclusivo: sufixosInconclusivos.length,
    sondaSubstringFalsoPositivo: sondaAmplaFalsoPositivo.length,
    discriminadorNegativo: comNegativo.length,
  },
  naoDiscriminantes: nomesNaoDiscriminantes.map((f) => ({
    nome: f.nome, base: f.base, sufixo: f.sufixo, parse: f.parse,
    compartilhadas: f.compartilhadas, compartilhadasAmplo: f.compartilhadasAmplo,
    diferencaReal: f.diferencaReal, usos: f.entidade.usos,
  })),
  sufixosInconclusivos: sufixosInconclusivos.map((f) => ({
    nome: f.nome, base: f.base, sufixo: f.sufixo, diferencaReal: f.diferencaReal, usos: f.entidade.usos,
  })),
  sondaSubstringFalsoPositivo: sondaAmplaFalsoPositivo.map((f) => ({
    nome: f.nome, base: f.base, sufixo: f.sufixo, parse: f.parse,
    acusadasPelaSonda: f.compartilhadasAmplo, diferencaReal: f.diferencaReal, usos: f.entidade.usos,
  })),
  entidades,
  /**
   * COMPOSIÇÃO — o instrumento 2 do oráculo, com proposta por bundle.
   * `usos` aqui é, por construção, `estratos.entidadeComposicao.usos` de
   * `measure-disposition` (mesma detecção, importada de `lib/composition.mjs`).
   */
  composicao: {
    criterio: {
      ordem: ["maximalidade", "|classes| desc", "n desc", "usos desc", "chave asc"],
      nota: "overlap relativo === |classes| porque o denominador |bundle| e o mesmo para todo candidato",
    },
    bundles: composicoes.length,
    usos: usosComposicao,
    ambiguidade: {
      candidatoUnico: composicoes.length - compMultiCandidato.length,
      multiplosCandidatosResolvidosPorContencao: compMultiCandidato.length - compAmbiguos.length,
      ambiguoReal: compAmbiguos.length,
      divergeCriterioFrequencia: compDivergeFreq.length,
    },
    conflito: {
      equivalentes: compEquivalentes.length,
      A_resolvidoDerrubaNucleo: compConflitoA.length,
      A_usos: soma(compConflitoA, (c) => c.usos),
      B_naoResolvidoMesmaPropriedade: compConflitoB.length,
      B_usos: soma(compConflitoB, (c) => c.usos),
      /** NAO e conflito de composicao: a entidade derruba classe dela mesma. */
      nucleoAutoConflitoBundles: compAutoConflito.length,
      nucleoAutoConflitoEntidades: entidadesAutoConflito,
    },
    nucleoSemNome: compSemNome.length,
    semCallSiteAst: compSemCallSite.length,
    extrasDuplicados: compComDuplicata.length,
    itens: composicoes,
  },
}, null, 1));

console.log(`propose-entities · ${ROOT}`);
console.log(`criterio: repete >= ${MIN_REPEAT} E tem >= ${MIN_CLASSES} classes\n`);
console.log(`  sinal 1 AST          typescript@${tsVersao} (${tsCaminho})`);
console.log(`  sinal 2 purga        ${tw.arquivo}, ${tw.globs.length} globs; destino '${DESTINO}' COBERTO`);
console.log(`  sinal 3 cobertura    ${atributosAst}/${atributos} atributos = ${(coberturaAst * 100).toFixed(1)}%`);
console.log(`  sinal 4 --ext        nenhuma extensao fora do censo com className dentro do content`);
console.log(`  sinal 6 twMerge      tailwind-merge@${tm.versao} via ${tm.origem}; prova twMerge("p-2 p-4")="${tm.prova}"\n`);
console.log(`  usos de classe       ${usos}`);
console.log(`  ENTIDADES            ${entidades.length}   ${soma(entidades, (e) => e.usos)} usos  ${pct(soma(entidades, (e) => e.usos))}\n`);
for (const b of porBanda) {
  console.log(`  ${b.id} ${b.rot.padEnd(6)} ${String(b.entidades).padStart(3)} ent  ${String(b.callSites).padStart(5)} sites  ${String(b.usos).padStart(6)} usos  ${pct(b.usos).padStart(6)}  acum ${pct(b.usosAcumulados)}`);
}
console.log(`\n  ATAQUE composicao pura  ${puras.length}/${entidades.length} entidades (${((100 * puras.length) / entidades.length).toFixed(1)}%)  ${soma(puras, (e) => e.usos)} usos  ${pct(soma(puras, (e) => e.usos))}`);
for (const f of FAIXAS) console.log(`     fracao ${f.rot.padEnd(22)} ${String(f.entidades).padStart(3)} ent  ${String(f.usos).padStart(6)} usos  ${pct(f.usos)}`);
console.log(`\n  ATAQUE ao oraculo    ${usosContaminados} usos sao token de interpolacao (${pct(usosContaminados)}), +${usosColchetePartido} de valor arbitrario partido`);
console.log(`  QUARENTENA           ${quarentena.length} entidades contaminadas (${soma(quarentena, (e) => e.usos)} usos) -> MIGRAVEIS ${migraveis.length}`);
console.log(`  call sites            ${soma(entidades, (e) => e.callSitesEstaticos)} estaticos / ${dinamicos_sites} dinamicos (template com \${})`);
console.log(`  GEMEA (classe duplicada) ${gemeas.length} entidades fantasma (${soma(gemeas, (e) => e.usos)} usos) que sao a MESMA entidade da irma`);
console.log(`  nome NAO-DERIVADO       ${semNome.length}`);
console.log(`  nome fraco (total)      ${nomesFracos.length}  = ${gemeas.length} gemea + ${naoDiscriminantes.length} sufixo NAO-DISCRIMINANTE + ${nomesFracos.length - gemeas.length - naoDiscriminantes.length} colisao`);
console.log(`  sufixo nao-discriminante ${nomesNaoDiscriminantes.length} entidades / ${soma(nomesNaoDiscriminantes.map((f) => f.entidade), (e) => e.usos)} usos  <- MEDIDO por auditarPoderDiscriminante()`);
console.log(`  sufixo inconclusivo      ${sufixosInconclusivos.length} (nao segmenta pelo vocabulario -> fila do dono)`);
console.log(`  sonda por substring      ${sondaAmplaFalsoPositivo.length} falso(s) positivo(s) explicado(s) no relatorio`);
console.log(`  discriminador negativo   ${comNegativo.length} entidades (\`_SEM_x\`: sou subconjunto da homonima)`);
console.log(`  via const de contrato    ${atributosViaContrato} atributos / ${usosViaContrato} usos; ${contratos.size} consts indexadas, ${contratosAmbiguos.length} ambiguas`);
if (identificadoresNaoResolvidos.size) {
  const top = [...identificadoresNaoResolvidos.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 5)
    .map(([id, v]) => `${id}(${v.n}x)`).join(", ");
  console.log(`  className={IDENT} NAO resolvido  ${identificadoresNaoResolvidos.size} nomes: ${top}`);
}
console.log(`  call site fora do content.files  ${foraContent.length} entidades`);
console.log(`\n  COMPOSICAO           ${composicoes.length} bundles  ${usosComposicao} usos  ${pct(usosComposicao)}   (== instrumento 2 de measure-disposition)`);
console.log(`    ambiguidade        candidato unico ${composicoes.length - compMultiCandidato.length} / >1 candidato resolvido por contencao ${compMultiCandidato.length - compAmbiguos.length} / AMBIGUO REAL ${compAmbiguos.length}`);
console.log(`    criterio (b) freq  ${compDivergeFreq.length} bundles escolheriam OUTRO nucleo`);
console.log(`    conflito A  ${compConflitoA.length} bundles (${soma(compConflitoA, (c) => c.usos)} usos)  twMerge DERRUBA classe do nucleo -> muda o que renderiza`);
console.log(`    conflito B  ${compConflitoB.length} bundles (${soma(compConflitoB, (c) => c.usos)} usos)  mesma propriedade e twMerge mantem os DOIS (blind spot)`);
console.log(`    equivalentes ${compEquivalentes.length}  ·  nucleo SEM nome ${compSemNome.length}  ·  sem call site no AST ${compSemCallSite.length}  ·  extra duplicado ${compComDuplicata.length}`);
console.log(`    NAO e conflito de composicao: ${entidadesAutoConflito.length} entidades-nucleo derrubam classe DELAS MESMAS (${compAutoConflito.length} bundles) -> achado sobre a entidade`);
console.log(`\n  relatorio: ${path.relative(ROOT, outMd)}`);
console.log(`  dados:     ${path.relative(ROOT, outJson)}`);
console.log(`\n  NADA FOI APLICADO. src/ intocado.`);
