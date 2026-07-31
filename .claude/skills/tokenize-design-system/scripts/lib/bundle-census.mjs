/**
 * bundle-census.mjs — a REGRA de censo de bundle, em um lugar só.
 *
 * Por que existe: `measure-coverage.mjs` é o oráculo pinado do denominador, e
 * `propose-entities.mjs` propõe contratos sobre EXATAMENTE as mesmas entidades.
 * Se cada um carregasse sua cópia do regex e do critério, os dois divergiriam em
 * silêncio na primeira correção — que é o defeito que o oráculo foi criado para
 * matar. Aqui a regra é uma só; os dois scripts a importam.
 *
 * A extração original não introduziu comportamento novo (saída byte-idêntica,
 * md5 conferido). A resolução de CONTRATO NOMEADO documentada abaixo introduziu,
 * de propósito: sem ela o censo ficava cego justamente ao veículo que esta fase
 * propõe, e o oráculo media 0 depois do codemod — falhando ABERTO.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  TOKENIZABLE_UTILITY_RX,
  PREFIX_FAMILY,
  PREFIX_PROPERTY,
  familyPrefixOf,
} from "./utility-families.mjs";
import {
  apenasCodigo,
  classNameAttributes,
  splitClasses as splitClassesImpl,
} from "./classname-extract.mjs";

/** Extensões de código que o censo varre. */
export const EXTS = new Set([".js", ".jsx", ".ts", ".tsx"]);

/** Diretórios que nunca são app. */
export const SKIP = new Set([
  "node_modules", ".git", "dist", "build", ".next", "coverage", ".tokenize",
]);

/**
 * ── A EXTRACAO SAIU DAQUI ─────────────────────────────────────────────────────
 *
 * Este modulo carregava a regra de "o que e uma classe" em tres regex:
 *
 *     CLS = /className\s*=\s*(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g
 *     DYN = /className\s*=\s*\{/g
 *     REF = /className\s*=\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g
 *
 * `CLS` capturava o TEXTO CRU e quem consumia dava `split(/\s+/)`. Contra
 * `` className={`flex ${c ? "a" : "b"} gap-2`} `` isso devolvia `?`, `:` e
 * `"b"}` como classes: **936 usos de ruido medidos no alvo**, universo inflado
 * de 31.726 para 32.662, e todo percentual do plano contaminado. A mesma regra
 * estava copiada em `measure-disposition.mjs`, que a remendou com um filtro de
 * pontuacao POR LISTA — consertando o sintoma num script e deixando o defeito
 * vivo nos outros. Era exatamente a divergencia em silencio que este arquivo foi
 * criado para impedir.
 *
 * A regra agora vive em `lib/classname-extract.mjs`, que extrai os LITERAIS DE
 * STRING da expressao em vez de dar split no texto cru — o que remove o ruido E
 * recupera as classes das duas pontas do ternario, que o regex antigo jogava
 * fora. Este modulo continua dono do CENSO (bundle, contrato nomeado, particao);
 * a extracao e importada.
 */

/**
 * ── O CONTRATO NOMEADO É PARTE DO CENSO, NÃO UM BURACO NELE ───────────────────
 *
 * Defeito comprado com prova reproduzida (review adversarial da F-D): o VEÍCULO
 * que este projeto escolheu para a entidade canônica é `const` exportado +
 * `tailwind-merge`, e o call site migrado vira `className={NOME}`. Para os regex
 * acima isso é um atributo DINÂMICO, e a string do contrato passa a viver num
 * arquivo onde não existe `className=` nenhum. Resultado medido em fixture de 2
 * arquivos: os mesmos 16 usos de classe viram 0 — o denominador COLAPSA em vez
 * de virar cobertura, e `measure-coverage` saía com `exit 0` e `NaN%`.
 *
 * Isto é pior que impreciso: é exatamente o modo de falha que este projeto foi
 * construído para matar ("uma corrida reportou 0 fusões só porque a lib de cor
 * não resolveu, e o zero passou por resultado"). O portão de E5/E6 é medido
 * DEPOIS do codemod (§ "Onde o portão é medido" do plano); sem esta resolução,
 * o portão media zero e passava.
 *
 * O que a resolução FAZ e o que ela NÃO faz:
 *   FAZ  — indexa `const NOME = "classes"` (com ou sem `export`) de qualquer
 *          arquivo varrido e resolve `className={NOME}` e `className={fn(NOME, …)}`
 *          para as classes declaradas, contando 1 atributo no call site.
 *   NÃO  — não conta a DECLARAÇÃO como uso (ela não é call site) e não passa a
 *          contar literais soltos dentro de expressão (`{a ? "x" : "y"}`), que
 *          continuam fora do censo como sempre estiveram. Mudar isso mexeria no
 *          denominador pinado por um motivo que não é este gap.
 *   NÃO  — não resolve nome AMBÍGUO: o mesmo identificador declarado com valores
 *          diferentes em arquivos diferentes fica FORA da tabela e o call site
 *          conta como não-resolvido. Resolver pelo primeiro que aparece seria
 *          inventar cobertura.
 */
export const DECL =
  /(?:^|[;{}\n])\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*(?:"([^"\n]*)"|'([^'\n]*)'|`([^`$\n]*)`)/g;

/** Identificador sozinho: `className={NOME}`. */
const IDENT_PURO = /^\s*[A-Za-z_$][\w$]*\s*$/;
/** Identificadores da expressão, ignorando acesso a membro (`styles.card`). */
const IDENT_NA_EXPR = /(?<![\w$.])([A-Za-z_$][\w$]*)/g;

/**
 * Forma de uma classe: sem espaço, sem aspas, e começando como classe começa —
 * minúscula, dígito (`2xl:`), `-` (margem negativa), `!` (important), `[` ou `@`
 * (arbitrário/container). `Bem-vindo` reprova aqui, e reprovar é o ponto: a
 * primeira versão aceitava qualquer token com hífen e teria registrado texto de
 * UI como contrato de classes.
 */
const CLASSE_TOKEN = /^[a-z0-9[!@.*-][-\w[\]&>.:/%!#()@,^~*+=]*$/;
/** Pelo menos uma tem que ser utility de verdade, senão é frase em minúsculas. */
const CLASSE_UTIL =
  /[-:[]|^(?:flex|grid|block|inline|hidden|contents|relative|absolute|fixed|sticky|static|truncate|italic|underline|uppercase|lowercase|capitalize|rounded|border|shadow|container|isolate|invisible|visible)$/;

/**
 * Um token isolado tem FORMA de utility? (`hover:bg-x` sim, `selectedOption`
 * não, `===` não, `hover:bg-x"` não.)
 *
 * Exportado porque o gate de `audit-extraction-delta.mjs` precisa responder
 * "a troca de extrator perdeu alguma classe LEGÍTIMA?" — e a resposta tem que
 * usar a definição de classe DESTE módulo, não uma terceira escrita à mão.
 */
export function pareceClasseUtil(token) {
  /**
   * O hífen sozinho reprova por GRAMÁTICA, não por conveniência: um identificador
   * CSS não pode ser um único `-` (CSS Syntax §4.1.3), então `.-` não é seletor
   * de classe possível e o Tailwind nunca emite isso.
   *
   * Sem esta linha o gate acusava regressão em cima de `-` (5 usos), que vem de
   * `${ flows.length - 1 ? … }` — o operador de subtração, medido em
   * `src/pages/Admin/Agents/AgentFlows/index.jsx:31` e mais 4 arquivos. Ou seja:
   * a régua chamava um operador de classe legítima e teria reprovado a correção
   * certa.
   */
  if (!/\w/.test(token)) return false;
  /**
   * O valor ARBITRARIO e opaco: `after:content-['']` e classe legitima do
   * Tailwind e existe no alvo (`src/components/lib/Toggle/index.jsx`), mas a
   * aspa reprova em `CLASSE_TOKEN`. Neutralizar `[...]` antes de medir a forma
   * torna a régua MAIS exigente (mais tokens contam como classe de verdade), que
   * é a direção segura para um gate de regressão. `hover:bg-x"`, sem colchete,
   * continua reprovando.
   *
   * `CLASSE_TOKEN` em si NÃO muda: ela governa a indexação de `const` de
   * contrato, e mexer nela aqui trocaria o denominador por um motivo que não é
   * este.
   */
  const semArbitrario = token.replace(/\[[^\]]*\]/g, "[x]");
  return CLASSE_TOKEN.test(semArbitrario) && CLASSE_UTIL.test(semArbitrario);
}

/** `const X = "Bem-vindo"` não é contrato de classes; `const X = "flex gap-2"` é. */
export function pareceContratoDeClasses(valor) {
  const cs = splitClasses(valor);
  /**
   * DUAS classes, no mínimo. Medido no alvo: com o piso em uma, o censo indexava
   * `const b = "["` de um bundle minificado em `public/embed/` e resolvia 8 call
   * sites para a "classe" `[`. Evento (`"refetch-logo"`), URL, regex e
   * `var(--x)` caem pelo mesmo piso. Uma constante de UMA classe também não é
   * entidade por definição (o critério exige ≥ 4), então o piso não custa nada.
   */
  if (cs.length < 2) return false;
  if (!cs.every((c) => CLASSE_TOKEN.test(c))) return false;
  return cs.some((c) => CLASSE_UTIL.test(c));
}

/**
 * Tabela `nome -> classes` das constantes de classe declaradas no projeto.
 * `ambiguos` são os nomes com mais de um valor — deliberadamente NÃO resolvidos.
 */
export function tabelaDeContratos(textos) {
  const vistos = new Map(); // nome -> Map<valorCanonico, {valor, classes, arquivos[]}>
  for (const [arquivo, t] of textos) {
    for (const m of t.matchAll(DECL)) {
      const nome = m[1];
      const valor = m[2] ?? m[3] ?? m[4] ?? "";
      if (!pareceContratoDeClasses(valor)) continue;
      const classes = splitClasses(valor);
      const k = bundleKey(classes);
      if (!vistos.has(nome)) vistos.set(nome, new Map());
      const porValor = vistos.get(nome);
      if (!porValor.has(k)) porValor.set(k, { valor, classes, arquivos: [] });
      porValor.get(k).arquivos.push(arquivo);
    }
  }
  const contratos = new Map();
  const ambiguos = [];
  for (const [nome, porValor] of vistos) {
    if (porValor.size > 1) {
      ambiguos.push({ nome, valores: [...porValor.values()].map((v) => ({ valor: v.valor, arquivos: v.arquivos })) });
      continue;
    }
    const [{ valor, classes, arquivos }] = [...porValor.values()];
    contratos.set(nome, { nome, valor, classes, arquivos });
  }
  return { contratos, ambiguos };
}

/**
 * Os nomes de contrato citados numa expressão de className, em ordem, sem repetir.
 *
 * A varredura roda sobre `apenasCodigo(expr)`, não sobre o texto cru: sem isso
 * uma palavra DENTRO de um literal (`className={cn("BASE_CARD algo")}`) seria
 * lida como referência à `const BASE_CARD` e as classes seriam contadas duas
 * vezes — uma pelo literal, outra pelo contrato.
 */
/**
 * Identificadores de contrato citados numa expressao `className={...}`.
 *
 * DOIS FILTROS, cada um comprado com um bundle FABRICADO no alvo real:
 *
 * 1. CHAMADA DE FUNCAO NAO E REFERENCIA A STRING. `ui/TagsInput/index.jsx`
 *    declara `function classNames(...values)` e usa
 *    `className={classNames("rti--tag", className)}`. Outro arquivo,
 *    `AgentSkills/SkillRow/index.jsx`, declara `let classNames = "border-none
 *    bg-transparent w-full ..."`. Sem este filtro o censo lia a CHAMADA como
 *    referencia aquela string e inventava um bundle que nao existe em runtime —
 *    e a proposta chegou a sugerir `cn(COMMON_ROW_W_FULL, "rti--tag ...")` para
 *    um componente que nunca teve aquelas classes.
 *
 * 2. ESCOPO. Um `const` declarado no arquivo A so vale no arquivo B se B o
 *    IMPORTAR. Sem isso qualquer homonimo entre arquivos vira o mesmo contrato.
 *    `arquivo` e `texto` sao opcionais: quando ausentes a funcao mantem o
 *    comportamento antigo, entao nenhum chamador quebra em silencio — mas os
 *    dois chamadores do repo passam ambos.
 */
export function contratosNaExpressao(expr, contratos, { arquivo, texto } = {}) {
  const codigo = apenasCodigo(expr);
  const out = [];
  for (const m of codigo.matchAll(IDENT_NA_EXPR)) {
    const id = m[1];
    if (!contratos.has(id) || out.includes(id)) continue;
    // (1) `id(` e chamada, nao leitura da string
    const depois = codigo.slice(m.index + id.length);
    if (/^\s*\(/.test(depois)) continue;
    // (2) declarado NESTE arquivo, ou importado por ele
    if (arquivo !== undefined && texto !== undefined) {
      const decl = contratos.get(id);
      const daqui = Array.isArray(decl?.arquivos) && decl.arquivos.includes(arquivo);
      if (!daqui && !importadoNoTexto(id, texto)) continue;
    }
    out.push(id);
  }
  return out;
}

/** `id` aparece na lista de especificadores de algum `import` do arquivo. */
function importadoNoTexto(id, texto) {
  for (const m of texto.matchAll(/import\s+([^;]*?)\s+from\s*["'][^"']+["']/g)) {
    const spec = m[1];
    if (new RegExp(`(^|[{,\\s])${id}([},\\s]|$)`).test(spec)) return true;
  }
  return false;
}

/**
 * Familias que um design system NOMEIA. `flex`/`absolute`/`w-`/`h-` nao entram:
 * sao composicao e dimensionamento, nao decisao de design.
 *
 * ATENCAO ao spacing direcional. A primeira versao trazia `p` e `m` crus, e
 * `p(?:-|$)` casa `p-2.5` mas NAO casa `px- py- pt- pb- pl- pr-` nem
 * `mt- mb- ml- mr- mx- my-`. Onze das quinze variantes ficavam de fora. Como
 * spacing e familia BLOQUEANTE, o efeito era 1.294 usos de trabalho obrigatorio
 * classificados como "excecao aprovavel" — falso-verde no proprio oraculo que o
 * plano usa como fonte da verdade. Achado pela review adversarial rodando o
 * script com o fix de uma linha.
 *
 * F-E: A REGRA SAIU DAQUI. Este regex literal era a SEGUNDA copia, escrita a
 * mao, da mesma tabela que `score-naming.mjs` expunha como `PREFIX_PROPERTY` —
 * e as duas nunca concordaram (12 prefixos la, 22 familias aqui). O oraculo de
 * naming lia uma copia; o numero bloqueante do plano saia da outra. Agora as
 * duas importam `lib/utility-families.mjs`, entao uma familia adicionada move a
 * cobertura e o alcance do score juntas, ou nao move nenhuma das duas.
 *
 * Duas mudancas de comportamento vieram junto, ambas medidas no alvo:
 *   - cadeia de variante GENERICA no lugar da allowlist fixa. A lista antiga nao
 *     cobria `placeholder:` (339 usos), `peer-checked/public:`,
 *     `group-disabled:`, `enabled:`, `after:`, `[&_p]:` — 389 usos de familia
 *     BLOQUEANTE invisiveis, mesmo defeito do `p`/`px`. Zero falso negativo
 *     introduzido: `bg-[url(https://x)]` continua casando.
 *   - alternacao ordenada por comprimento, senao `rounded` engole `rounded-t`.
 */
export { TOKENIZABLE_UTILITY_RX as TOKENIZAVEL } from "./utility-families.mjs";

/** Uso que ja passa por contrato: a classe cita um token nomeado do DS. */
export const EM_CONTRATO =
  /-(?:theme|surface|content|primary-button|secondary|menu-item|modal|sidebar|chat|checklist-item|search-input|file-row|workspace-item)(?:-|$)/;

export function walk(dir, out = []) {
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

/**
 * As classes de um atributo className bruto, já filtradas de interpolação.
 * A implementação vive em `lib/classname-extract.mjs` — reexportada aqui porque
 * `propose-entities.mjs` a consome por este caminho desde antes da extração.
 */
export const splitClasses = splitClassesImpl;

/** A chave canônica de um bundle: classes ORDENADAS. `flex gap-2` === `gap-2 flex`. */
export function bundleKey(classes) {
  return [...classes].sort().join(" ");
}

/**
 * O censo. Retorna o mesmo material que `measure-coverage` sempre computou.
 * `bundles` é Map<chaveOrdenada, { n, classes }>.
 */
export function census(root) {
  const arquivos = walk(root);
  const textos = new Map();
  for (const f of arquivos) {
    try { textos.set(f, readFileSync(f, "utf8")); } catch { /* ilegível = ausente */ }
  }
  const { contratos, ambiguos } = tabelaDeContratos(textos);

  const bundles = new Map();
  const contratosUsados = new Map();     // nome -> call sites
  const identificadoresNaoResolvidos = new Map(); // ident -> {n, arquivos:Set}
  /** Literais que os guardas do extrator recusaram, com motivo. Auditável. */
  const descartados = [];
  let usos = 0, emContrato = 0, atributos = 0, dinamicos = 0;
  let atributosViaContrato = 0, usosViaContrato = 0, atributosMistos = 0;

  const contaBundle = (cs) => {
    atributos++;
    usos += cs.length;
    for (const c of cs) if (EM_CONTRATO.test(c)) emContrato++;
    const k = bundleKey(cs);
    const cur = bundles.get(k) ?? { n: 0, classes: cs };
    cur.n++;
    bundles.set(k, cur);
  };

  /**
   * UMA passada por atributo, não duas por arquivo.
   *
   * A versão anterior varria o arquivo com um regex de literais e DEPOIS com um
   * regex de expressões, e a segunda passada precisava adivinhar (`LITERAL_PURA`)
   * o que a primeira já tinha contado. Além do risco de recontar, isso tornava
   * impossível somar as duas fontes de classe do MESMO atributo: em
   * `className={cn(BASE, "extra")}` a primeira passada não casava nada e a
   * segunda contava só `BASE` — `extra` sumia do universo.
   *
   * Agora `classNameAttributes` devolve o atributo inteiro, e cada atributo
   * produz UM bundle = classes literais + classes do contrato nomeado citado.
   */
  for (const [f, t] of textos) {
    for (const at of classNameAttributes(t, descartados)) {
      const nomes = at.kind === "expr" ? contratosNaExpressao(at.expr, contratos, { arquivo: f, texto: t }) : [];
      const doContrato = nomes.flatMap((n) => contratos.get(n).classes);
      const cs = [...at.classes, ...doContrato];

      if (!cs.length) {
        // Atributo que o censo NÃO conseguiu ler. Fica visível, nunca some.
        if (at.kind === "expr") {
          dinamicos++;
          const id = at.expr.trim();
          if (IDENT_PURO.test(id)) {
            const cur = identificadoresNaoResolvidos.get(id) ?? { n: 0, arquivos: new Set() };
            cur.n++; cur.arquivos.add(f);
            identificadoresNaoResolvidos.set(id, cur);
          }
        }
        continue;
      }

      contaBundle(cs);
      if (doContrato.length) {
        atributosViaContrato++;
        usosViaContrato += doContrato.length;
        // "misto" = o atributo não é SÓ o contrato (`twMerge(CARD, props.className)`).
        if (!IDENT_PURO.test(at.expr)) atributosMistos++;
        for (const n of nomes) contratosUsados.set(n, (contratosUsados.get(n) ?? 0) + 1);
      }
    }
  }

  return {
    arquivos, bundles, usos, emContrato, atributos, dinamicos,
    contratos, contratosAmbiguos: ambiguos, contratosUsados,
    atributosViaContrato, usosViaContrato, atributosMistos,
    identificadoresNaoResolvidos, literaisDescartados: descartados,
  };
}

/**
 * O critério de ENTIDADE — repetição E tamanho, as duas condições.
 * Repetição sozinha não separa entidade de coincidência: `flex items-start gap-3`
 * repete 2x e não é componente nenhum.
 */
export function isEntity(v, minRepeat, minClasses) {
  return v.n >= minRepeat && v.classes.length >= minClasses;
}

/**
 * ── A PARTIÇÃO, E O DEFEITO QUE A FAZIA MENTIR ────────────────────────────────
 *
 * `measure-coverage` imprimia três baldes — entidade, tokenizável fora de
 * entidade, resto — como se fossem uma partição de 100%, e o plano (§2.4) somava
 * os dois primeiros num "migrável 75,5%" lido como TRABALHO A FAZER. `emContrato`
 * era impresso como estatística à parte e NUNCA subtraído de balde nenhum.
 *
 * Consequência medida no alvo: **2.295 de 7.978 usos (28,8%) do balde BLOQUEANTE
 * já passavam por contrato nomeado** — `placeholder:text-content-tertiary`,
 * `enabled:hover:bg-surface-hover`, `text-theme-settings-input-placeholder`.
 * Pela taxonomia do próprio plano (§2.2) essas classes NÃO são utility cru: já
 * estão migradas. O oráculo cobrava de novo trabalho já feito.
 *
 * É o MESMO defeito que o `p`/`px` (1.294 usos de trabalho obrigatório filados
 * como exceção aprovável), na direção oposta: lá trabalho virava exceção, aqui
 * trabalho-já-feito vira trabalho-obrigatório. Os dois têm a mesma causa —
 * o balde era computado por um predicado só, quando são dois.
 *
 * A partição correta tem QUATRO baldes e a soma é verificada, não afirmada:
 *
 *   A  entidade            bundle repete ≥minRepeat E tem ≥minClasses classes.
 *                          Unidade é o BUNDLE: a disposição é extrair contrato de
 *                          componente, e isso vale mesmo quando parte das classes
 *                          já cita token. Por isso A NÃO é líquida de contrato —
 *                          `entidadeEmContrato` é publicado à parte para quem
 *                          quiser a conta.
 *   B1 tokenizável fora, JÁ EM CONTRATO   nada a fazer. Não é trabalho.
 *   B2 tokenizável fora, CRU              o trabalho bloqueante de verdade.
 *   C  sem disposição                     fila de exceção com as 5 chaves.
 *
 * `migravel = A + B2`. Somar A + B (o que o plano fazia) superestima.
 *
 * `porFamilia`/`porPropriedade` quebram B2 pelas famílias de
 * `utility-families.mjs`, para que o consumidor possa cruzar com §4.3 da lei sem
 * recontar nada à mão. Quem faz esse cruzamento é o apresentador (o oráculo),
 * porque a lei é lida por `score-naming.readVocabulary()` e este módulo não
 * conhece a lei.
 */
export function partition({ bundles, usos, emContrato }, minRepeat, minClasses) {
  let entidades = 0, usosEmEntidade = 0, entidadeEmContrato = 0;
  let tokForaEmContrato = 0, tokForaCru = 0;
  let usosSemDisposicao = 0, semDisposicaoEmContrato = 0;
  const porFamilia = {};
  const porPropriedade = {};

  for (const [, v] of bundles) {
    if (isEntity(v, minRepeat, minClasses)) {
      entidades++;
      usosEmEntidade += v.classes.length * v.n;
      for (const c of v.classes) if (EM_CONTRATO.test(c)) entidadeEmContrato += v.n;
      continue;
    }
    for (const c of v.classes) {
      if (!TOKENIZABLE_UTILITY_RX.test(c)) {
        usosSemDisposicao += v.n;
        if (EM_CONTRATO.test(c)) semDisposicaoEmContrato += v.n;
        continue;
      }
      if (EM_CONTRATO.test(c)) { tokForaEmContrato += v.n; continue; }
      tokForaCru += v.n;
      /**
       * FALHA FECHADA. `TOKENIZABLE_UTILITY_RX` e `familyPrefixOf` são duas
       * leituras da MESMA tabela. Se uma casa e a outra não acha prefixo, a
       * tabela divergiu de si mesma e qualquer quebra por família seria ficção.
       */
      const prefix = familyPrefixOf(c);
      if (!prefix) {
        throw new Error(
          `partition: '${c}' casa TOKENIZABLE_UTILITY_RX mas familyPrefixOf() nao acha prefixo. ` +
          `As duas leituras de utility-families.mjs divergiram — nao ha quebra por familia honesta aqui.`
        );
      }
      const fam = PREFIX_FAMILY[prefix];
      const prop = PREFIX_PROPERTY[prefix];
      porFamilia[fam] = (porFamilia[fam] ?? 0) + v.n;
      porPropriedade[prop] = (porPropriedade[prop] ?? 0) + v.n;
    }
  }

  const usosTokenizaveisForaDeEntidade = tokForaEmContrato + tokForaCru;

  /* As duas invariantes que tornam isto uma PARTIÇÃO, verificadas e não afirmadas. */
  const soma = usosEmEntidade + usosTokenizaveisForaDeEntidade + usosSemDisposicao;
  if (soma !== usos) {
    throw new Error(`partition: A+B+C = ${soma} != usos = ${usos}. Nao e particao.`);
  }
  const somaContrato = entidadeEmContrato + tokForaEmContrato + semDisposicaoEmContrato;
  if (somaContrato !== emContrato) {
    throw new Error(`partition: contrato por balde = ${somaContrato} != emContrato = ${emContrato}.`);
  }

  return {
    entidades,
    usosEmEntidade,
    entidadeEmContrato,
    usosTokenizaveisForaDeEntidade,
    tokForaEmContrato,
    tokForaCru,
    tokForaCruPorFamilia: porFamilia,
    tokForaCruPorPropriedade: porPropriedade,
    usosSemDisposicao,
    semDisposicaoEmContrato,
    migravel: usosEmEntidade + tokForaCru,
  };
}
