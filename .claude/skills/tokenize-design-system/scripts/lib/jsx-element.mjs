/**
 * jsx-element.mjs — leitura do ELEMENTO JSX que carrega um offset.
 *
 * Extraido de `propose-semantic-html.mjs` para poder ser testado sem disparar o
 * pipeline inteiro, e porque `find-owner.mjs` tem a mesma necessidade com uma
 * implementacao mais fraca (ver `carryingTagStart` abaixo).
 */

/**
 * Fim da tag de abertura iniciada em `tagStart`, respeitando `{}` de JSX e
 * strings.
 *
 * `find-owner.mjs` usa `text.indexOf(">", offset)`, que corta no meio de
 * `onClick={() => f()}` — a seta contribui um `>`. Consequencia medida: o texto
 * da tag de abertura chega truncado e `onClick` nunca e visto.
 */
export function openingTagAt(text, tagStart) {
  let i = tagStart + 1, brace = 0, quote = null;
  while (i < text.length) {
    const ch = text[i];
    if (quote) { if (ch === quote && text[i - 1] !== "\\") quote = null; }
    else if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{") brace++;
    else if (ch === "}") brace--;
    else if (ch === ">" && brace === 0) return text.slice(tagStart, i + 1);
    i++;
  }
  return text.slice(tagStart, Math.min(text.length, tagStart + 2000));
}

/**
 * Inicio da tag portadora do offset, por VARREDURA PARA FRENTE.
 *
 * A alternativa obvia — andar para TRAS balanceando `>`/`<`, que e o que
 * `find-owner.mjs` faz — esta errada em JSX moderno: a seta de
 * `onClick={() => f()}` contribui um `>` que o balanceador conta como
 * fechamento de tag, entao ele passa direto pelo `<div` e devolve "sem tag".
 *
 * Medido no alvo: 6 dos 59 clusters sem owner — incluindo os `<div onClick>` de
 * `LLMItem`, `EmbedderItem`, `VectorDBItem`, `BlockList` e o `role="button"` de
 * `JobRow` — eram classificados como "fora de JSX". Um falso negativo em cima
 * justamente dos casos que a fase existe para achar.
 */
export function carryingTagStart(text, offset) {
  const rx = /<([A-Za-z][\w.]*)(?=[\s/>])/g;
  let best = -1;
  for (const m of text.matchAll(rx)) {
    if (m.index > offset) break;
    const span = openingTagAt(text, m.index).length;
    if (m.index + span > offset && m.index > best) best = m.index;
  }
  return best;
}

/**
 * Spread de PROPS JSX (`<div {...props}>`), distinguido de spread de OBJETO
 * dentro de uma expressao (`onClick={() => f({ ...config })}`).
 *
 * A diferenca importa: o primeiro injeta atributos no elemento renderizado e
 * cega o scanner; o segundo nao toca no elemento. Um regex ingenuo por `{...`
 * confunde os dois — medido em `SkillList/index.jsx:44`, onde
 * `handleClick?.({ ...config, imported: true })` foi lido como se a `<div>`
 * recebesse props de runtime, e o item saiu do ganho por um motivo falso.
 *
 * O teste correto e posicional: o `{` tem que abrir em posicao de ATRIBUTO, ou
 * seja com profundidade de chaves 0 dentro da tag de abertura.
 */
export function jsxSpread(open) {
  let i = 0, brace = 0, quote = null;
  // pula `<Tag`
  const head = open.match(/^<\s*[A-Za-z][\w.]*/);
  if (head) i = head[0].length;
  for (; i < open.length; i++) {
    const ch = open[i];
    if (quote) { if (ch === quote && open[i - 1] !== "\\") quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "}") { brace--; continue; }
    if (ch !== "{") continue;
    if (brace === 0) {
      const m = open.slice(i + 1).match(/^\s*\.\.\.\s*([A-Za-z_$][\w$.]*(?:\([^)]*\))?)/);
      if (m) return { hasSpread: true, spreadName: m[1] };
    }
    brace++;
  }
  return { hasSpread: false, spreadName: null };
}

/** Escapa o nome da tag para uso em regex (`Foo.Bar` tem `.`). */
const rxTag = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * SUBARVORE do elemento que comeca em `tagStart`: o texto entre a tag de
 * abertura e a tag de fechamento correspondente, com contagem de profundidade
 * para a MESMA tag aninhada (`<div>` dentro de `<div>`).
 *
 * `complete: false` significa que o fechamento nao foi achado dentro do limite.
 * Quem consome TEM que tratar isso como DESCONHECIDO — afirmar "nao ha
 * descendente interativo" a partir de uma subarvore truncada e afirmar ausencia
 * sem ter olhado.
 */
export function subtreeOf(text, tagStart, limit = 60000) {
  const open = openingTagAt(text, tagStart);
  const tag = (open.match(/^<\s*([A-Za-z][\w.]*)/) || [])[1] ?? null;
  if (!tag) return { text: "", start: tagStart, complete: true, selfClosing: true };
  if (/\/>\s*$/.test(open)) {
    return { text: "", start: tagStart + open.length, complete: true, selfClosing: true };
  }
  const from = tagStart + open.length;
  const end = Math.min(text.length, from + limit);
  const openRx = new RegExp(`<${rxTag(tag)}(?=[\\s/>])`, "g");
  const closeRx = new RegExp(`</\\s*${rxTag(tag)}\\s*>`, "g");
  let depth = 1, i = from;
  while (i < end) {
    openRx.lastIndex = i; closeRx.lastIndex = i;
    const o = openRx.exec(text);
    const c = closeRx.exec(text);
    if (!c || c.index >= end) break;
    if (o && o.index < c.index) {
      const inner = openingTagAt(text, o.index);
      if (!/\/>\s*$/.test(inner)) depth++;
      i = o.index + inner.length;
      continue;
    }
    depth--;
    if (depth === 0) return { text: text.slice(from, c.index), start: from, complete: true, selfClosing: false };
    i = c.index + c[0].length;
  }
  return { text: text.slice(from, end), start: from, complete: false, selfClosing: false };
}

/**
 * Roles ARIA que fazem do elemento um WIDGET focavel — a lista que o axe usa em
 * `nested-interactive`. Nao inclui `presentation`/`none`, que fazem o oposto.
 */
export const INTERACTIVE_ROLES = new Set([
  "button", "checkbox", "radio", "link", "menuitem", "menuitemcheckbox",
  "menuitemradio", "option", "switch", "tab", "textbox", "searchbox",
  "slider", "spinbutton", "combobox", "treeitem",
]);

/** Tags nativas cujo content model NAO admite descendente interativo em volta. */
const NATIVE_INTERACTIVE = new Set(["button", "select", "textarea", "details", "summary"]);

/**
 * DESCENDENTES INTERATIVOS da subarvore.
 *
 * Por que existe: as duas vias de conserto propostas pela F-B2 — trocar a tag
 * por `<button>` OU declarar `role="button" tabIndex={0}` — assumem que o
 * elemento e uma FOLHA interativa. Quando ha um controle interativo DENTRO,
 * as duas produzem violacao:
 *   - `<button>` dentro de `<button>` e content model invalido do HTML;
 *   - `role="button" tabIndex={0}` em volta de um `role="checkbox"` produz
 *     `nested-interactive` do axe (WCAG 4.1.2) e insere uma parada de Tab a
 *     mais antes de cada controle interno.
 * Ou seja: a via rotulada "risco nenhum (so atributos)" NAO tem risco zero de
 * COMPORTAMENTO nesses sites. Medir e a unica forma de nao afirmar o contrario.
 *
 * DOIS EIXOS, porque as duas vias quebram por motivos diferentes:
 *
 *   `blocking`  — CONTENT MODEL. `<button>` so admite phrasing content sem
 *                 conteudo interativo; `<input>`/`<button>`/`<a href>` dentro
 *                 dele e invalido INDEPENDENTE de CSS, porque content model e
 *                 markup, nao renderizacao. Este e o eixo da via NATIVA.
 *   `focusable` — o que o axe `nested-interactive` de fato acusa: descendente
 *                 FOCAVEL. Um `<input class="peer hidden">` (o padrao dos cards
 *                 de selecao deste alvo) e `display:none`, logo nao e focavel e
 *                 nao produz `nested-interactive`. Este e o eixo da via de
 *                 ATRIBUTOS, que mantem a tag.
 *
 * Separar os dois evita os dois erros opostos: dizer "risco zero" onde ha
 * controle focavel dentro, e inflar o risco da via de atributos com um input
 * escondido que nenhum usuario alcanca.
 *
 * `reasons` sem `blocking` e sinal fraco (`onClick` em componente React, cuja
 * tag renderizada o scanner estatico nao ve).
 */
export function interactiveDescendants(text, tagStart) {
  const sub = subtreeOf(text, tagStart);
  const items = [];
  const rx = /<([A-Za-z][\w.]*)(?=[\s/>])/g;
  for (const m of sub.text.matchAll(rx)) {
    const name = m[1];
    const low = name.toLowerCase();
    const open = openingTagAt(sub.text, m.index);
    const role = (open.match(/\brole=["']([a-z]+)["']/) || [])[1] ?? null;
    const reasons = [];
    let blocking = false;

    if (NATIVE_INTERACTIVE.has(low)) { reasons.push(`<${low}>`); blocking = true; }
    if (low === "input" && !/type=["']hidden["']/.test(open)) { reasons.push("<input>"); blocking = true; }
    if (low === "a" && /\b(href|to)=/.test(open)) { reasons.push("<a href>"); blocking = true; }
    if (role && INTERACTIVE_ROLES.has(role)) { reasons.push(`role="${role}"`); blocking = true; }
    if (/\btabIndex=\{?\s*-?\s*0/.test(open)) { reasons.push("tabIndex={0}"); blocking = true; }
    if (/\bonClick=/.test(open)) reasons.push("onClick");

    if (!reasons.length) continue;

    // `hidden` do Tailwind e `display:none`: sai da ordem de foco e do
    // `nested-interactive`. `sr-only` NAO entra aqui — continua focavel.
    const cls = (open.match(/className=(?:"([^"]*)"|\{`([\s\S]*?)`\}|\{([\s\S]*?)\}\s*[a-zA-Z-]*=?)/) || [])
      .slice(1).filter(Boolean).join(" ");
    const displayNone = /(?:^|\s)hidden(?:\s|$)/.test(cls) || /\bhidden\b/.test(cls);
    items.push({
      tag: name,
      offset: sub.start + m.index,
      line: text.slice(0, sub.start + m.index).split("\n").length,
      reasons,
      blocking,
      displayNone,
      focusable: blocking && !displayNone,
    });
  }
  return {
    items,
    blocking: items.filter((i) => i.blocking),
    focusable: items.filter((i) => i.focusable),
    complete: sub.complete,
  };
}

/** Fatos do elemento portador que decidem a classificacao semantica. */
export function elementFacts(text, offset) {
  const start = carryingTagStart(text, offset);
  if (start < 0) return null;
  const open = openingTagAt(text, start);
  const tag = (open.match(/^<\s*([A-Za-z][\w.]*)/) || [])[1] ?? null;
  if (!tag) return null;

  const attr = (n) => (open.match(new RegExp(`\\b${n}=["']([^"']+)["']`)) || [])[1] ?? null;

  // Filhos: janela limitada apos a tag de abertura, so para achar controle nativo.
  const afterOpen = start + open.length;
  const window = text.slice(afterOpen, afterOpen + 1500);
  const nested = window.match(/<input\b[^>]*?\btype=["']([a-z]+)["']/);

  // Subarvore inteira, nao a janela de 1500 chars: a pergunta "ha controle
  // interativo dentro?" so tem resposta honesta se o escopo for o elemento todo.
  const descendants = interactiveDescendants(text, start);

  return {
    tag,
    /** `{ items, blocking, focusable, complete }` — ver `interactiveDescendants`. */
    descendants,
    /** true = ha descendente interativo no MARKUP (quebra a via `<button>`). */
    hasNestedInteractive: descendants.blocking.length > 0,
    /** true = ha descendente FOCAVEL (quebra tambem a via de atributos). */
    hasNestedFocusable: descendants.focusable.length > 0,
    /** true = fechamento da tag nao foi achado; ausencia NAO pode ser afirmada. */
    subtreeUnknown: !descendants.complete,
    open: open.replace(/\s+/g, " ").trim(),
    role: attr("role"),
    type: attr("type"),
    ariaLabel: attr("aria-label") ?? (/\baria-label=\{/.test(open) ? "(dinamico)" : null),
    hasOnClick: /\bonClick=/.test(open),
    hasOnKeyDown: /\bonKeyDown=|\bonKeyPress=|\bonKeyUp=/.test(open),
    hasTabIndex: /\btabIndex=/.test(open),
    hasHref: /\b(href|to)=/.test(open),
    hasDropzone: /getRootProps\(\)/.test(open),
    // Spread de PROPS esconde atributos: `{...getRootProps()}` do react-dropzone
    // injeta `role`, `tabIndex` e `onKeyDown` que nenhum scanner estatico ve.
    ...jsxSpread(open),
    hasTooltip: /\bdata-tooltip-id=/.test(open),
    title: attr("title") ?? (/\btitle=\{/.test(open) ? "(dinamico)" : null),
    inlineWidthPct: /style=\{\{\s*width:\s*`\$\{[^`]*\}%`/.test(open),
    nestedControl: nested ? nested[1] : null,
    parentIsList: /<(ul|ol)\b[^>]*>[\s\S]{0,400}$/.test(text.slice(Math.max(0, start - 600), start)),
    classText: (open.match(/className=(?:"([^"]*)"|\{`([\s\S]*?)`\}|\{([\s\S]*?)\}\s*[a-zA-Z-]*=?)/) || [])
      .slice(1).filter(Boolean).join(" "),
  };
}
