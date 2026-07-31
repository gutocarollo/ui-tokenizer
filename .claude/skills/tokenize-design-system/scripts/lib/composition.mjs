/**
 * composition.mjs — A REGRA DE COMPOSIÇÃO, em um lugar só.
 *
 * O QUE É COMPOSIÇÃO, e por que ela não precisa de contrato novo.
 * --------------------------------------------------------------
 * Um bundle que NÃO é entidade (aparece 1×, ou tem poucas classes) mas que
 * CONTÉM uma entidade inteira como subconjunto não é um componente novo: é o
 * bundle canônico com `mt-2` ou `pr-10` grudado em cima. É o drift ADITIVO já
 * medido na família do `<input>` do alvo — 80 strings distintas, a top1 com 41%
 * dos call sites. A disposição correta não é `export const OUTRA_COISA`, é:
 *
 *     className={cn(NUCLEO_EXISTENTE, "mt-2 pr-10")}
 *
 * POR QUE ESTE ARQUIVO EXISTE (e não a terceira cópia do laço).
 * ------------------------------------------------------------
 * O laço de detecção já vivia dentro de `measure-disposition.mjs` (instrumento
 * 2), e `propose-entities.mjs` precisa EXATAMENTE do mesmo conjunto para propor
 * a chamada. Duas cópias divergiriam na primeira correção, e o relatório de
 * proposta passaria a listar bundles que o oráculo não conta (ou o contrário) —
 * o modo de falha que este projeto comprou três vezes (`p`/`px`, PREFIX_PROPERTY
 * duplicado, dois censos com dois universos). A regra é esta; os dois importam.
 *
 * A AMBIGUIDADE, E O CRITÉRIO — declarados aqui, medidos no relatório.
 * -------------------------------------------------------------------
 * Um bundle pode conter MAIS DE UMA entidade como subconjunto. Três critérios
 * foram considerados:
 *
 *   (a) a MAIOR (mais classes)      — minimiza `extras`.
 *   (b) a MAIS FREQUENTE (maior n)  — privilegia o núcleo mais canônico.
 *   (c) o MAIOR OVERLAP RELATIVO    — |núcleo ∩ bundle| / |bundle|.
 *
 * (c) É IDÊNTICO A (a), NÃO UMA TERCEIRA OPÇÃO. Como todo candidato é subconjunto
 * do bundle, |núcleo ∩ bundle| = |núcleo|, e o denominador |bundle| é o MESMO
 * para todos os candidatos daquele bundle. Logo ordenar por overlap relativo é
 * ordenar por |núcleo|. Isto está travado por teste (`composition.test.mjs`);
 * apresentá-los como escolhas diferentes seria inventar uma decisão.
 *
 * Sobra (a) contra (b), e a decisão NÃO é preferência:
 *
 *   1. MAXIMALIDADE PRIMEIRO, e ela não é critério de desempate — é correção.
 *      Se A ⊂ B e os dois são candidatos, escolher A deixa `B \ A` dentro de
 *      `extras`. Mas `B \ A` são classes que fazem parte de um contrato canônico
 *      B: o call site emitiria como "extra ad-hoc" um pedaço de design que já
 *      tem nome. Isso é reintroduzir o drift que a fase existe para matar, e
 *      infla `extras` sem ganho nenhum. Só candidatos MAXIMAIS (nenhum outro
 *      candidato os contém) podem vencer.
 *   2. Entre os maximais — que por definição são INCOMPARÁVEIS, nenhum contém o
 *      outro — desempata por |classes| desc, depois `n` desc, depois usos desc,
 *      depois a chave (determinismo, nunca ordem de iteração de Map).
 *
 * `n` não vem antes de |classes| porque o custo de escolher errado é assimétrico:
 * um núcleo pequeno e frequente deixa extras GRANDES no call site — texto que o
 * revisor tem que ler classe a classe — enquanto um núcleo grande e raro deixa
 * extras curtos e o nome continua vindo de uma entidade real (≥2 call sites, por
 * construção). O relatório mede as duas ordens e publica quantos bundles mudam
 * de núcleo entre elas; se esse número for alto, o critério é material e a
 * escolha vira decisão do dono em vez de default do script.
 *
 * O QUE ESTE MÓDULO NÃO FAZ: não olha conflito de utility (`p-2.5` × `p-4`).
 * Conflito é pergunta sobre `tailwind-merge`, e a resposta tem que sair da
 * biblioteca real, não de uma tabela reescrita à mão aqui. Vive em
 * `propose-entities.mjs`, que resolve a lib e falha fechada se não achar.
 */
import { isEntity } from "./bundle-census.mjs";

/** Map<chaveDeBundle, Set<classe>> das entidades sob o critério vigente. */
export function entidadesDoCenso(bundles, minRepeat, minClasses) {
  const ents = new Map();
  for (const [k, v] of bundles) {
    if (isEntity(v, minRepeat, minClasses)) ents.set(k, new Set(v.classes));
  }
  return ents;
}

/** classe -> Set(chaves de entidade que a contêm). Evita O(bundles × entidades). */
export function indiceInvertido(ents) {
  const inv = new Map();
  for (const [ek, es] of ents) {
    for (const c of es) {
      if (!inv.has(c)) inv.set(c, new Set());
      inv.get(c).add(ek);
    }
  }
  return inv;
}

/** `sub` ⊆ `sup`? (contenção de conjunto, não de multiconjunto — ver `extrasDe`). */
export function contem(sup, sub) {
  for (const c of sub) if (!sup.has(c)) return false;
  return true;
}

/** As entidades inteiramente contidas neste bundle. */
export function candidatosDe(classesDoBundle, ents, inv) {
  const bs = new Set(classesDoBundle);
  const vistos = new Set();
  const out = [];
  for (const c of bs) {
    for (const ek of inv.get(c) ?? []) {
      if (vistos.has(ek)) continue;
      vistos.add(ek);
      if (contem(bs, ents.get(ek))) out.push(ek);
    }
  }
  return out;
}

/**
 * Os candidatos MAXIMAIS: nenhum outro candidato os contém estritamente.
 *
 * "Estritamente" tem que ser por CONTEÚDO, não por tamanho de chave. Duas chaves
 * de bundle diferentes podem ter o MESMO conjunto de classes quando uma delas
 * repete uma classe dentro do próprio atributo (`w-full … w-full`) — as "gêmeas"
 * que o relatório de entidades já lista. Se a maximalidade fosse decidida por
 * tamanho, as duas sobreviveriam como incomparáveis e o bundle apareceria como
 * AMBÍGUO quando na verdade há uma entidade só, contada duas vezes. Aqui elas
 * colapsam por assinatura de conjunto e a colisão é REPORTADA (`gemeas`), não
 * escondida.
 */
export function maximaisDe(cands, ents) {
  const porAssinatura = new Map();
  for (const k of cands) {
    const sig = [...ents.get(k)].sort().join(" ");
    if (!porAssinatura.has(sig)) porAssinatura.set(sig, []);
    porAssinatura.get(sig).push(k);
  }
  const unicos = [...porAssinatura.values()].map((g) => [...g].sort()[0]);
  const gemeas = [...porAssinatura.values()].filter((g) => g.length > 1);
  const maximais = unicos.filter((k) => {
    const meu = ents.get(k);
    return !unicos.some((o) => o !== k && ents.get(o).size > meu.size && contem(ents.get(o), meu));
  });
  return { maximais, gemeas };
}

/** O comparador do critério adotado: |classes| desc → n desc → usos desc → chave. */
export function cmpPorTamanho(bundles, ents) {
  return (a, b) =>
    ents.get(b).size - ents.get(a).size ||
    bundles.get(b).n - bundles.get(a).n ||
    bundles.get(b).classes.length * bundles.get(b).n - bundles.get(a).classes.length * bundles.get(a).n ||
    a.localeCompare(b);
}

/** O comparador do critério ALTERNATIVO (b), usado só para medir a divergência. */
export function cmpPorFrequencia(bundles, ents) {
  return (a, b) =>
    bundles.get(b).n - bundles.get(a).n ||
    ents.get(b).size - ents.get(a).size ||
    a.localeCompare(b);
}

/**
 * `extras` = bundle − núcleo, por MULTICONJUNTO.
 *
 * Multiconjunto e não conjunto de propósito: se o call site escreveu
 * `w-full … w-full`, a segunda cópia sobrevive em `extras` e o relatório a expõe
 * como defeito do call site (`extrasDuplicados`). Descontar por conjunto a
 * apagaria em silêncio — a tokenização perderia o achado que ela dá de graça.
 */
export function extrasDe(classesDoBundle, classesDoNucleo) {
  const restante = new Map();
  for (const c of classesDoNucleo) restante.set(c, (restante.get(c) ?? 0) + 1);
  const extras = [];
  for (const c of classesDoBundle) {
    const q = restante.get(c) ?? 0;
    if (q > 0) restante.set(c, q - 1);
    else extras.push(c);
  }
  return extras;
}

/**
 * A DETECÇÃO. Retorna Map<chaveDoBundle, registro> para todo bundle não-entidade
 * que contém ao menos uma entidade.
 *
 * O `Set` das chaves deste Map é, por construção, o instrumento 2 de
 * `measure-disposition`. Não há segundo laço para reconciliar.
 */
export function detectarComposicoes(bundles, ents) {
  const inv = indiceInvertido(ents);
  const cmpT = cmpPorTamanho(bundles, ents);
  const cmpF = cmpPorFrequencia(bundles, ents);
  const out = new Map();

  for (const [k, v] of bundles) {
    if (ents.has(k)) continue;
    const cands = candidatosDe(v.classes, ents, inv);
    if (!cands.length) continue;

    const { maximais, gemeas } = maximaisDe(cands, ents);
    const ordenados = [...maximais].sort(cmpT);
    const nucleo = ordenados[0];
    const porFrequencia = [...maximais].sort(cmpF)[0];

    const classesNucleo = bundles.get(nucleo).classes;
    const extras = extrasDe(v.classes, classesNucleo);
    const setNucleo = ents.get(nucleo);

    out.set(k, {
      chave: k,
      classes: v.classes,
      n: v.n,
      usos: v.classes.length * v.n,
      nucleo,
      classesNucleo,
      extras,
      /** Classe que o call site repetiu — já estava no núcleo. Defeito, não extra. */
      extrasDuplicados: extras.filter((c) => setNucleo.has(c)),
      candidatos: cands,
      maximais,
      /** Ambiguidade REAL: dois maximais incomparáveis, o critério decide. */
      ambiguo: maximais.length > 1,
      /** Ambiguidade APARENTE: >1 candidato, mas a cadeia de contenção resolve. */
      candidatosMultiplos: cands.length > 1,
      /** O critério (b) escolheria outro núcleo? Mede se a decisão é material. */
      divergePorFrequencia: porFrequencia !== nucleo,
      nucleoPorFrequencia: porFrequencia,
      gemeasNoNucleo: gemeas,
    });
  }
  return out;
}
