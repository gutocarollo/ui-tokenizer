/**
 * vocabulary-contract.mjs — a REGRA do estrato 6, num lugar só.
 *
 * O instrumento 6 de `measure-disposition` dispõe ~18% do universo como
 * "vocabulário de layout": `flex`, `items-center`, `w-full`. Isso NÃO é
 * violação — é o uso canônico de utility-first, e tokenizar `flex` é
 * anti-padrão. Mas "exceção item a item" também era rótulo errado: são ~136
 * classes cobrindo 95% do resíduo com distribuição Zipf, ou seja um
 * VOCABULÁRIO FECHADO PEQUENO. A disposição certa é um CONTRATO EM BLOCO:
 * um documento, allowlist versionada, cinco chaves por família, ratchet.
 *
 * Este módulo é a fonte única de três decisões, e existe separado dos dois
 * executáveis (`propose-vocabulary.mjs` gera o documento, `vocabulary-ratchet.mjs`
 * o enforça) porque duas cópias divergiriam na primeira correção — o defeito
 * que o cabeçalho de `measure-disposition.mjs` documenta e que já custou
 * "dois oráculos, dois universos" nesta mesma sessão.
 *
 * ── DECISÃO 1: o objeto do ratchet é o RESÍDUO (6 ∪ 7), não o estrato 6 ──────
 *
 * A fronteira entre 6 e 7 é um corte CUMULATIVO de 95% do resíduo, e não a
 * natureza da classe. Logo ela se move sozinha: quando uma classe do topo
 * encolhe, o denominador cai e uma classe da cauda ATRAVESSA a fronteira sem
 * que ninguém tenha escrito uma linha. Um guard ancorado só no estrato 6
 * acusaria "classe nova no vocabulário" por deslizamento estatístico —
 * falso-vermelho determinístico, e guard que dá falso alarme é guard que o
 * time desliga. Medido no alvo: 136 classes dentro do corte, 190 fora, e as
 * 190 somam 287 usos (0,9%) — a cauda é grande em CARDINALIDADE e minúscula
 * em massa, exatamente a forma que faz a fronteira ser instável.
 *
 * O contrato então documenta as duas metades (o vocabulário de fato e a fila
 * de exceção item-a-item) e o ratchet enforça a UNIÃO. Classe nova no resíduo
 * = decisão humana, venha ela de qual lado for.
 *
 * ── DECISÃO 2: "só encolhe" é sobre o CONJUNTO, não sobre os usos ───────────
 *
 * `flex` passar de 1.285 para 1.400 usos não é regressão de design: é o app
 * crescendo com o vocabulário aprovado, que é o RESULTADO DESEJADO. O que o
 * ratchet proíbe é a chegada de uma classe que ninguém aprovou. Contagem de
 * uso é reportada (para o documento não mentir) e nunca reprova.
 *
 * ── DECISÃO 3: família sai do CSS GERADO, não de uma tabela de nomes ────────
 *
 * Agrupar por prefixo do nome (`w-`, `h-`, `z-`) é agrupar pela grafia. O
 * agrupamento correto é pela PROPRIEDADE CSS que a classe produz, porque é ela
 * que diz o que a classe faz: `truncate` vira `overflow`+`text-overflow`+
 * `white-space` e não tem prefixo nenhum; `size-4` produz `width`+`height`.
 * A tabela abaixo mapeia PROPRIEDADE → família; o nome da classe nunca entra.
 */

/** propriedade CSS → família semântica. Ordem irrelevante; a busca é exata. */
export const FAMILIA_POR_PROPRIEDADE = new Map(Object.entries({
  "display": "exibicao",
  "visibility": "exibicao",
  "box-sizing": "exibicao",

  "flex": "eixo-flex",
  "flex-direction": "eixo-flex",
  "flex-wrap": "eixo-flex",
  "flex-shrink": "eixo-flex",
  "flex-grow": "eixo-flex",

  "align-items": "alinhamento",
  "justify-content": "alinhamento",
  "align-self": "alinhamento",
  "justify-self": "alinhamento",
  "justify-items": "alinhamento",
  "vertical-align": "alinhamento",

  "position": "posicionamento",
  "top": "posicionamento",
  "right": "posicionamento",
  "bottom": "posicionamento",
  "left": "posicionamento",
  "inset": "posicionamento",
  "inset-inline": "posicionamento",
  "inset-block": "posicionamento",
  "float": "posicionamento",

  "overflow": "overflow",
  "overflow-x": "overflow",
  "overflow-y": "overflow",
  "text-overflow": "overflow",
  "-ms-overflow-style": "overflow",
  "scrollbar-width": "overflow",

  "width": "dimensao",
  "height": "dimensao",
  "min-width": "dimensao",
  "min-height": "dimensao",
  "max-width": "dimensao",
  "max-height": "dimensao",

  "z-index": "camada",
  "opacity": "opacidade",

  "transition-property": "movimento",
  "transition-duration": "movimento",
  "transition-timing-function": "movimento",
  "animation": "movimento",

  "cursor": "interacao",
  "pointer-events": "interacao",
  "user-select": "interacao",
  "resize": "interacao",

  "white-space": "tipografia-estrutural",
  "text-decoration-line": "tipografia-estrutural",
  "text-transform": "tipografia-estrutural",
  "font-style": "tipografia-estrutural",
  "overflow-wrap": "tipografia-estrutural",
  "word-break": "tipografia-estrutural",
  "list-style-type": "tipografia-estrutural",
  "list-style-position": "tipografia-estrutural",
  "font-variant-numeric": "tipografia-estrutural",
  "--tw-numeric-spacing": "tipografia-estrutural",

  "grid-template-columns": "grade",
  "grid-column": "grade",
  "grid-template-rows": "grade",
  "grid-row": "grade",

  "object-fit": "midia",
  "object-position": "midia",

  "filter": "filtro",
  "--tw-invert": "filtro",
  "backdrop-filter": "filtro",
  "-webkit-backdrop-filter": "filtro",
  "--tw-backdrop-blur": "filtro",

  "rotate": "transformacao",
  "translate": "transformacao",
  "transform": "transformacao",
  "scale": "transformacao",
  "--tw-translate-y": "transformacao",

  "scroll-margin-top": "rolagem",
  "scroll-margin-bottom": "rolagem",

  "clip-path": "acessibilidade",
}));

/** rótulo humano + a razão pela qual a família NÃO é tokenizável. */
export const RAZAO_POR_FAMILIA = {
  "exibicao": "modo de caixa (`display`) — enumeração fechada do CSS, não escala de design",
  "eixo-flex": "eixo e elasticidade do flexbox — relação entre pai e filho, não valor de marca",
  "alinhamento": "alinhamento no eixo — enumeração fechada do CSS",
  "posicionamento": "esquema de posicionamento e ancoragem a 0/50%/100% do pai",
  "overflow": "política de transbordo — enumeração fechada do CSS",
  "dimensao": "dimensão RELACIONAL (100%, auto, fit-content, viewport, fração do pai)",
  "camada": "ordem de empilhamento — MAS ver o auto-ataque: no alvo medido as 10 classes desta familia SAO consumo de token do app (`--z-*`) que o detector do estrato 4 perde porque o motor inlina o valor. Familia inteira classificada como defeito, nao como vocabulario",
  "opacidade": "opacidade",
  "movimento": "quais propriedades transicionam (o QUÊ, não o QUANTO — a duração é token e vive no estrato 4)",
  "interacao": "affordance de ponteiro — enumeração fechada do CSS",
  "tipografia-estrutural": "quebra, decoração e caixa do texto — enumeração fechada do CSS, sem escala",
  "grade": "topologia da grade (quantas colunas, quantas o item ocupa)",
  "midia": "encaixe de mídia na caixa — enumeração fechada do CSS",
  "filtro": "inversão booleana por tema (light:invert), não uma escala de filtro",
  "transformacao": "transformação geométrica discreta (flip/quarto de volta), sem escala de rotação no tema",
  "rolagem": "âncora de rolagem",
  "acessibilidade": "recorte visual de conteúdo que permanece no acessibility tree (sr-only)",
  "externo": "NÃO é utility do Tailwind — não gera CSS nenhum pelo motor do app",
  "vazamento-tokenizavel": "NÃO PERTENCE A ESTE CONTRATO — é família tokenizável (estrato 3) que vazou para o resíduo por defeito do oráculo",
};

/**
 * VAZAMENTO DO ESTRATO 3 — classe tokenizável que chegou aqui por defeito.
 *
 * O `TOK` de `measure-disposition.mjs` (Linha 98) casa a família tokenizável
 * atrás de uma allowlist FIXA de variantes (`hover:|focus:|dark:|sm:`...).
 * Variante fora dessa lista faz a classe escapar do estrato 3 e cair no
 * resíduo. Encontrado por este contrato, do lado de dentro do resíduo, olhando
 * a propriedade CSS que a classe gera:
 *
 *     pwa:pb-5             -> padding-bottom   (variante `pwa:` desconhecida)
 *     pwa:rounded-3xl      -> border-radius
 *     after:rounded-full   -> border-radius    (variante `after:`)
 *     peer-focus:ring-2    -> box-shadow/ring  (variante `peer-focus:`)
 *     light:border!        -> border-width     (`light:` + sufixo `!`)
 *
 * Isso NÃO pode virar família de vocabulário. Um contrato que arquivasse
 * `pwa:rounded-3xl` sob "grade" ou "posicionamento" estaria dando anistia a
 * radius cru — exatamente o falso-verde que a partição existe para matar. Elas
 * são isoladas numa família própria, marcada como defeito, e o documento diz
 * que a correção é no `TOK`, não aqui.
 *
 * O teste é o do PRÓPRIO `TOK`, com as variantes REMOVIDAS em vez de
 * enumeradas — é por isso que ele acha o que o original perde. Não é uma
 * segunda cópia da regra de família: é a mesma alternação de base, aplicada ao
 * nome já despido.
 */
const BASE_TOKENIZAVEL =
  /^-?(?:bg|text|border|ring|shadow|fill|stroke|outline|divide|accent|caret|placeholder|p[xytrbles]?|m[xytrbles]?|gap|space|rounded|font|leading|tracking)(?:-|$)/;

/** @param {string} classe nome COM variantes, como aparece no código */
export function vazamentoTokenizavel(classe) {
  /*
   * O `!` PREFIXADO tem de sair, e não só o sufixado.
   *
   * A primeira versão removia `!` apenas no FIM (`light:border!`, a sintaxe v4)
   * e deixava passar a sintaxe legada, que é a que o alvo escreve de fato:
   * `!p-0`, `!m-0`, `!text-xs`, `!rounded-lg`, `!font-normal`,
   * `!border-t-transparent`, `light:!border`. Todas são família TOKENIZÁVEL
   * (spacing / tipografia / radius / cor / border-width) e todas escapavam
   * daqui exatamente como escapam do `TOK` de `measure-disposition` (Linha 98),
   * que tem `-?` antes da alternação e nenhum `!`.
   *
   * O efeito medido no alvo não era um rótulo errado e sim uma PARADA:
   * `propose-vocabulary.mjs` falha fechada em `familia === "nao-classificada"`,
   * e as 10 classes que a derrubavam eram estas. Padding cru com `!important`
   * arquivado como "vocabulário de layout" seria anistia a spacing cru — a
   * mesma classe de falso-verde que a família `vazamento-tokenizavel` existe
   * para expor.
   */
  const base = classe.replace(/^.*:/, "").replace(/^[!-]+/, "").replace(/!$/, "");
  return BASE_TOKENIZAVEL.test(base);
}

/**
 * O AUTO-ATAQUE, mecânico.
 *
 * A pergunta honesta contra este contrato é: quantas destas classes são
 * vocabulário de layout de verdade e quantas são DECISÃO DE DESIGN disfarçada?
 * `w-60` aparece 266×; isso não é "uma largura qualquer", é a largura da
 * sidebar — e uma decisão de design cravada num número cru é exatamente o que
 * a tokenização existe para eliminar.
 *
 * O critério não pode ser gosto. Ele é lido do CSS GERADO e separa QUANTIDADE
 * DE ESCALA de RELAÇÃO:
 *
 *   QUANTIDADE — o valor foi ESCOLHIDO de uma escala e poderia ter sido outro:
 *     `calc(var(--spacing) * N)` com N != 0   -> passo da escala de spacing
 *     `var(--container-*)`                    -> passo da escala de container
 *     `z-index: N`, N não em {0, auto}        -> passo da escala de camada
 *     `opacity: N%`, N não em {0, 100}        -> passo da escala de opacidade
 *
 *   RELAÇÃO — o valor é determinado pelo contexto e NÃO há outro a escolher:
 *     0, auto, 100%, fit-content, 100vh, 1/2, `span N`, palavras-chave.
 *     `w-full` não é "largura 100% em vez de 90%": é "a largura do pai".
 *
 * `rotate-180`/`rotate-90` ficam em RELAÇÃO de propósito: o tema do app não
 * declara escala de rotação nenhuma (medido: zero `--rotate-*` em varsDoApp),
 * então não existe token do qual `180deg` seria o passo. Se um dia existir, o
 * critério muda aqui, num lugar, e o número muda junto.
 */
export const ESCALA = [
  { id: "spacing", re: /var\(--spacing\)\s*\*\s*(-?[\d.]+)/, ok: (m) => Number(m[1]) !== 0 },
  { id: "container", re: /var\((--container-[\w-]+)\)/, ok: () => true },
  { id: "z", re: /z-index:\s*(-?\d+)/, ok: (m) => Number(m[1]) !== 0 },
  { id: "opacity", re: /opacity:\s*([\d.]+)%/, ok: (m) => ![0, 100].includes(Number(m[1])) },
];

/**
 * @param {string|null} css  CSS gerado pelo motor para o candidato (null = não gera)
 * @returns {{gera:boolean, propriedades:string[], familia:string, escalas:string[]}}
 */
export function analisarClasse(css, classe = "") {
  if (css == null) return { gera: false, propriedades: [], familia: "externo", escalas: [] };
  /**
   * O vazamento é testado ANTES da família, e de propósito: `after:rounded-full`
   * gera `content` + `border-radius`, e o `content` acharia uma família de
   * tipografia se a ordem fosse a outra. A natureza da classe é decidida pelo
   * NOME (é radius cru), não pela primeira propriedade que ela emite.
   */
  if (classe && vazamentoTokenizavel(classe)) {
    return { gera: true, propriedades: [], familia: "vazamento-tokenizavel", escalas: [] };
  }

  /**
   * O CSS gerado pode trazer at-rules (`@media`, `@property`) e seletor
   * aninhado (`&::-webkit-scrollbar`). Só interessam as DECLARAÇÕES da regra:
   * `prop: valor;`. O filtro de `@property` é necessário porque as declarações
   * de registro (`syntax`, `inherits`, `initial-value`) apareceriam como
   * propriedades da classe e mandariam `transform`/`tabular-nums` para famílias
   * inventadas.
   */
  const semProperty = css.replace(/@property\s+[^{]*\{[^}]*\}/g, "");
  const props = [...semProperty.matchAll(/(^|[{;])\s*(-{0,2}[a-zA-Z][\w-]*)\s*:/g)]
    .map((m) => m[2])
    .filter((p) => !["syntax", "inherits", "initial-value"].includes(p));

  const vistas = [...new Set(props)];
  let familia = null;
  for (const p of vistas) {
    const f = FAMILIA_POR_PROPRIEDADE.get(p);
    if (f) { familia = f; break; }
  }

  const escalas = ESCALA.filter((e) => { const m = css.match(e.re); return m && e.ok(m); }).map((e) => e.id);
  return { gera: true, propriedades: vistas, familia: familia ?? "nao-classificada", escalas };
}

/**
 * Token NOMEADO cujo valor o motor INLINOU — o ponto cego do estrato 4.
 *
 * O detector do estrato 4 credita a classe quando o CSS gerado contém
 * `var(--token-do-app)`. Mas `z-tooltip` gera literalmente `z-index: 99`: o
 * Tailwind resolve `--z-tooltip` em tempo de build e a `var()` desaparece. A
 * classe É consumo de token do app — o nome dela É o nome do token — e cai no
 * estrato 6 por um detalhe de emissão. Detectar isso é responsabilidade deste
 * contrato porque é aqui que o falso-positivo se materializa: congelar
 * `z-tooltip` como "vocabulário de layout" é declarar um token como não-token.
 *
 * @param {string} classe   nome da classe (variantes já removidas pelo chamador)
 * @param {Set<string>} varsDoApp
 */
export function tokenNomeadoInlinado(classe, varsDoApp) {
  const base = classe.replace(/^.*:/, "").replace(/^[!-]+|!$/g, "");
  const v = `--${base}`;
  return varsDoApp.has(v) ? v : null;
}
