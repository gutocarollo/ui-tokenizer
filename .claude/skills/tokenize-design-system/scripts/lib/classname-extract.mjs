/**
 * classname-extract.mjs — a UNICA regra de "o que e uma classe num className".
 *
 * ── O DEFEITO QUE ISTO MATA ───────────────────────────────────────────────────
 *
 * A regra antiga era um regex que capturava o TEXTO CRU do atributo e dava
 * `split(/\s+/)`:
 *
 *     const CLS = /className\s*=\s*(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g;
 *
 * Contra `` className={`flex ${cond ? "a" : "b"} gap-2`} `` a segunda alternativa
 * casa o template inteiro e o split devolve, como se fossem classes:
 *
 *     flex   ${cond   ?   "a"   :   "b"}   gap-2
 *
 * Medido no alvo: **936 usos de ruido** (`?` 159x, `:` 159x, `}` 111x, e o resto
 * em `"a"`-com-aspas), inflando o universo de 31.726 para 32.662 e contaminando
 * TODOS os percentuais do plano. `measure-disposition.mjs` tinha um paliativo
 * (`RUIDO = /^[?:}{)(]$|^["']/`) que filtrava POR LISTA os simbolos vistos — o
 * que conserta o sintoma daquele script e deixa o defeito vivo nos outros tres,
 * alem de nao devolver as classes REAIS que estao dentro do ternario.
 *
 * ── A REGRA CERTA ─────────────────────────────────────────────────────────────
 *
 * Nao se da split no texto cru: extraem-se os LITERAIS DE STRING de dentro da
 * expressao, e so eles viram classes. Codigo (identificador, operador, chamada)
 * nunca e classe; literal SEMPRE e, esteja ele solto, dentro de um ternario,
 * dentro de `clsx(...)`, dentro de uma chave de objeto (`clsx({"a": x})`) ou
 * dentro de uma interpolacao de template.
 *
 * Consequencia: a correcao NAO SO remove ruido, ela RECUPERA classes legitimas
 * que o regex antigo jogava fora — as duas pontas do ternario
 * (`cond ? "a b" : "c d"` -> a, b, c, d), os literais de `clsx("a", x && "b")`,
 * e o atributo com aspas simples (`className='a b'`), que o regex antigo nem
 * casava. O teste `test/classname-extract.test.mjs` trava as duas direcoes:
 * ruido que tem que SUMIR e classe que NAO PODE sumir.
 *
 * ── O QUE CONTINUA FORA, DE PROPOSITO ─────────────────────────────────────────
 *
 *   `${expr}`               a interpolacao em si nao e classe. O marcador `${}`
 *                           fica GRUDADO no texto (`px-${}`), entao o token
 *                           parcial `px-` e descartado por `splitClasses` em vez
 *                           de virar uma classe inexistente.
 *   `styles.foo`            acesso a membro nao e literal.
 *   `x === "dark"`          operando de COMPARACAO nao e classe. Sem este guarda,
 *                           `className={t === "dark" ? "bg-black" : "bg-white"}`
 *                           registraria `dark` como uso de classe.
 *   `styles["card"]`        chave de acesso computado a membro nao e classe. Um
 *                           `[` que vem depois de identificador/`]`/`)` e acesso;
 *                           depois de `(`/`,`/operador e literal de ARRAY, cujos
 *                           itens SAO classes (`clsx(["a","b"])`).
 *
 * Tudo o que esta funcao devolve e auditavel item a item por
 * `--dump-literais` em `measure-disposition.mjs`.
 */

/** Marcador que substitui `${...}` num template literal. Nao e classe. */
export const INTERP = "${}";

/**
 * As classes de um texto de atributo, ja filtradas de interpolacao.
 *
 * Fica AQUI (e nao em `bundle-census.mjs`) porque o filtro de `${` e a outra
 * metade da regra de extracao: separar os dois foi o que permitiu que a regra
 * divergisse em silencio entre os scripts.
 */
export function splitClasses(bruto) {
  return partirRespeitandoColchete(bruto)
    .filter((c) => c && !c.startsWith("$") && !c.includes("${"));
}

/**
 * Separa por espaco, MENOS dentro de `[]`.
 *
 * `split(/\s+/)` cru quebra valor arbitrario com espaco no meio. Medido no
 * alvo: `font-['Plus Jakarta Sans']` virava TRES tokens — `font-['Plus`,
 * `Jakarta` e `Sans']` — e os tres apareciam no residuo do ratchet como se
 * fossem classes distintas, inflando o vocabulario com fragmentos que nao
 * existem. Uma familia de fonte contada como tres decisoes de design.
 *
 * O mesmo vale para qualquer arbitrario com espaco: `grid-cols-[repeat(2,
 * minmax(0, 1fr))]`, `shadow-[0 1px 2px rgb(0 0 0 / 0.1)]`.
 *
 * Colchete nao fechado NAO consome o resto da string: o texto vem de codigo
 * real e um `[` solto e mais provavel que um arbitrario gigante. A profundidade
 * volta a zero no fim e o token corrente e emitido como esta.
 */
function partirRespeitandoColchete(bruto) {
  const out = [];
  let atual = "";
  let prof = 0;
  for (const ch of bruto) {
    if (ch === "[") prof += 1;
    else if (ch === "]") prof = Math.max(0, prof - 1);
    if (/\s/.test(ch) && prof === 0) {
      if (atual) out.push(atual);
      atual = "";
      continue;
    }
    atual += ch;
  }
  if (atual) out.push(atual);
  /*
   * Desbalanceado = nao confie na varredura. Com `[` aberto e nunca fechado a
   * profundidade nunca volta a zero e TODO o resto da string vira um token so,
   * fundindo classes que nao tem relacao num fragmento gigante — pior que o
   * defeito original. Nesse caso volta ao split cru, que ao menos separa.
   */
  if (prof !== 0) return bruto.split(/\s+/);
  return out;
}

/**
 * String literal de JS iniciada em `i` (`text[i]` e `"` ou `'`).
 *
 * Regras de JS, nao de JSX: `\` escapa e a quebra de linha crua TERMINA a
 * varredura (string JS nao atravessa linha). `ok:false` = literal nao fechado,
 * quase sempre sinal de que o offset nao era literal nenhum.
 */
export function readJsString(text, i) {
  const q = text[i];
  let j = i + 1;
  let out = "";
  while (j < text.length) {
    const ch = text[j];
    if (ch === "\\") { out += text[j + 1] ?? ""; j += 2; continue; }
    if (ch === q) return { content: out, end: j + 1, ok: true };
    if (ch === "\n") break;
    out += ch;
    j++;
  }
  return { content: out, end: j, ok: false };
}

/**
 * String de ATRIBUTO JSX iniciada em `i`.
 *
 * Deliberadamente diferente de `readJsString`: em JSX o valor entre aspas e
 * texto bruto que PODE atravessar linhas e onde `\` nao escapa nada. O regex
 * antigo (`"([^"]*)"`) tambem aceitava quebra de linha, e o alvo usa a forma
 * multilinha; tratar isto com as regras de JS truncaria atributos reais.
 */
export function readJsxAttrString(text, i) {
  const q = text[i];
  const end = text.indexOf(q, i + 1);
  if (end < 0) return { content: text.slice(i + 1), end: text.length, ok: false };
  return { content: text.slice(i + 1, end), end: end + 1, ok: true };
}

/**
 * Template literal iniciado em `i` (backtick). Devolve o texto estatico com cada
 * `${...}` colapsado no marcador `INTERP`, e as expressoes das interpolacoes
 * separadas — para que quem quiser possa recursar nelas (e um ternario dentro de
 * interpolacao tem classes reais).
 */
export function readTemplate(text, i) {
  let j = i + 1;
  let quasi = "";
  const interps = [];
  while (j < text.length) {
    const ch = text[j];
    if (ch === "\\") { quasi += text.slice(j, j + 2); j += 2; continue; }
    if (ch === "`") return { quasi, interps, end: j + 1, ok: true };
    if (ch === "$" && text[j + 1] === "{") {
      const b = matchBrace(text, j + 1);
      interps.push(text.slice(j + 2, Math.max(j + 2, b.end - 1)));
      quasi += INTERP;
      j = b.end;
      continue;
    }
    quasi += ch;
    j++;
  }
  return { quasi, interps, end: text.length, ok: false };
}

/**
 * Fim do bloco `{...}` que abre em `i`, respeitando string, template (com `${}`
 * aninhado) e comentario.
 *
 * Um `indexOf("}")` corta no meio de `cn(a, { x: y })`; um contador de chaves
 * ingenuo corta no meio de `` `${a ? "}" : ""}` ``. As duas formas existem no
 * alvo.
 */
export function matchBrace(text, i) {
  let depth = 0;
  let j = i;
  while (j < text.length) {
    const ch = text[j];
    if (ch === '"' || ch === "'") { j = readJsString(text, j).end; continue; }
    if (ch === "`") { j = readTemplate(text, j).end; continue; }
    if (ch === "/" && text[j + 1] === "/") {
      const n = text.indexOf("\n", j);
      j = n < 0 ? text.length : n + 1;
      continue;
    }
    if (ch === "/" && text[j + 1] === "*") {
      const n = text.indexOf("*/", j);
      j = n < 0 ? text.length : n + 2;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return { end: j + 1, ok: true }; }
    j++;
  }
  return { end: text.length, ok: false };
}

/** Ultimo caractere nao-branco antes de `i` (ignorando comentario de linha). */
function prevSignificant(expr, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(expr[j])) j--;
  return j >= 0 ? { ch: expr[j], at: j } : { ch: "", at: -1 };
}

/**
 * `x === "dark"`, `x >= 'y'`, `case "z":` — operando de comparacao, nao classe.
 *
 * Tres casos de borda que a primeira versao errava e o teste trava:
 *   `x = "flex"`    ATRIBUICAO -> e contrato de classes, NAO descarta.
 *   `x >= "a"`      o char anterior ao `=` e `>`, tambem e comparacao.
 *   `() => "flex"`  seta, NAO comparacao (o `>` vem depois de `=`).
 */
function ehOperandoDeComparacao(expr, i) {
  const { ch, at } = prevSignificant(expr, i);
  const anterior = at > 0 ? expr[at - 1] : "";
  if (ch === "=") return "=!<>".includes(anterior);
  if (ch === "<") return true;
  if (ch === ">") return anterior !== "=";
  const antes = expr.slice(Math.max(0, at - 10), at + 1);
  return /\b(?:case|typeof)\s*$/.test(antes);
}

/**
 * Argumento de metodo de STRING (`s.includes("dark")`), nao classe.
 *
 * Nao da para generalizar "argumento de chamada": `cn("flex")` e `clsx("flex")`
 * sao exatamente chamadas cujos argumentos SAO classes. A lista e nominal e
 * curta de proposito — cada nome aqui e um metodo cujo argumento e por definicao
 * um valor de comparacao ou um separador, nunca uma classe.
 */
const METODOS_DE_STRING = new Set([
  "includes", "startsWith", "endsWith", "indexOf", "lastIndexOf",
  "split", "join", "replace", "replaceAll", "match", "test", "localeCompare",
]);

function ehArgumentoDeMetodoDeString(expr, i) {
  const { ch, at } = prevSignificant(expr, i);
  if (ch !== "(") return false;
  const antes = expr.slice(0, at);
  const m = antes.match(/\.\s*([A-Za-z_$][\w$]*)\s*$/);
  return !!m && METODOS_DE_STRING.has(m[1]);
}

/** `styles["card"]` — chave de acesso computado. `["a","b"]` (array) NAO entra. */
function ehChaveDeAcesso(expr, i) {
  const { ch, at } = prevSignificant(expr, i);
  if (ch !== "[") return false;
  const { ch: antesDoColchete } = prevSignificant(expr, at);
  return /[\w$\])]/.test(antesDoColchete);
}

/**
 * Todos os literais de string de uma expressao, incluindo os das interpolacoes
 * de template. Cada item e o CONTEUDO do literal, ainda nao dividido em classes.
 *
 * `descartados` traz o que os guardas removeram, com o motivo — porque um filtro
 * que apaga em silencio e como o censo mente na outra direcao.
 */
export function literaisNaExpressao(expr, descartados = []) {
  const out = [];
  let j = 0;
  while (j < expr.length) {
    const ch = expr[j];
    if (ch === "/" && expr[j + 1] === "/") {
      const n = expr.indexOf("\n", j);
      j = n < 0 ? expr.length : n + 1;
      continue;
    }
    if (ch === "/" && expr[j + 1] === "*") {
      const n = expr.indexOf("*/", j);
      j = n < 0 ? expr.length : n + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const r = readJsString(expr, j);
      if (ehOperandoDeComparacao(expr, j)) descartados.push({ valor: r.content, motivo: "comparacao" });
      else if (ehChaveDeAcesso(expr, j)) descartados.push({ valor: r.content, motivo: "acesso-computado" });
      else if (ehArgumentoDeMetodoDeString(expr, j)) descartados.push({ valor: r.content, motivo: "metodo-de-string" });
      else out.push(r.content);
      j = r.end;
      continue;
    }
    if (ch === "`") {
      const r = readTemplate(expr, j);
      if (ehChaveDeAcesso(expr, j)) descartados.push({ valor: r.quasi, motivo: "acesso-computado" });
      else out.push(r.quasi);
      for (const it of r.interps) out.push(...literaisNaExpressao(it, descartados));
      j = r.end;
      continue;
    }
    j++;
  }
  return out;
}

/**
 * A expressao com o CONTEUDO de cada literal substituido por espacos, mantendo
 * os offsets. Serve para varrer IDENTIFICADORES (resolucao de contrato nomeado)
 * sem que uma palavra dentro de uma string vire referencia a `const`.
 */
export function apenasCodigo(expr) {
  let out = "";
  let j = 0;
  while (j < expr.length) {
    const ch = expr[j];
    if (ch === '"' || ch === "'") {
      const r = readJsString(expr, j);
      out += " ".repeat(r.end - j);
      j = r.end;
      continue;
    }
    if (ch === "`") {
      const r = readTemplate(expr, j);
      out += apenasCodigoTemplate(expr.slice(j, r.end));
      j = r.end;
      continue;
    }
    out += ch;
    j++;
  }
  return out;
}

/**
 * O texto de um template com os QUASIS apagados e o CODIGO das interpolacoes
 * preservado — `` `${BASE} extra` `` continua citando `BASE`. Preserva o
 * comprimento para que os offsets nao andem.
 */
function apenasCodigoTemplate(t) {
  let out = " ";
  let j = 1;
  while (j < t.length) {
    const ch = t[j];
    if (ch === "\\") { out += "  "; j += 2; continue; }
    if (ch === "`") { out += " "; j++; continue; }
    if (ch === "$" && t[j + 1] === "{") {
      const b = matchBrace(t, j + 1);
      out += "  " + apenasCodigo(t.slice(j + 2, Math.max(j + 2, b.end - 1))) + " ";
      j = b.end;
      continue;
    }
    out += " ";
    j++;
  }
  return out;
}

/**
 * Formas de `className` que o scanner reconhece.
 *
 * O sufixo e de proposito: `wrapperClassName="flex gap-2"`, `inputClassName`,
 * `activeClassName` carregam classes REAIS repassadas a um filho, e o regex
 * antigo (`className\s*=`, sem ancora de palavra) as contava. Ancorar em
 * `\bclassName` teria REMOVIDO essas classes do universo — a correcao do ruido
 * nao pode custar ocorrencia legitima.
 *
 * O lookbehind garante que a varredura comeca no inicio do identificador, entao
 * `[\w$]*` nao come um pedaco de outra palavra.
 */
const CLASSNAME_RX = /(?<![\w$])[\w$]*[Cc]lassName\s*=\s*/g;

/**
 * Os atributos `className` de um arquivo.
 *
 * Devolve, por atributo:
 *   `kind`     `"literal"` (`className="…"` / `className='…'`) ou `"expr"`.
 *   `expr`     o codigo entre chaves, para `kind:"expr"`.
 *   `classes`  as classes extraidas dos LITERAIS. Nao inclui contrato nomeado —
 *              quem resolve `const` e o censo, que tem a tabela.
 *   `index`    offset do inicio de `className`, para reportar linha.
 *
 * Um atributo cujo valor nao e nem string nem `{...}` (JSX invalido) e ignorado.
 */
export function classNameAttributes(text, descartados = []) {
  const out = [];
  CLASSNAME_RX.lastIndex = 0;
  let m;
  while ((m = CLASSNAME_RX.exec(text))) {
    const at = m.index + m[0].length;
    const ch = text[at];
    if (ch === '"' || ch === "'") {
      const r = readJsxAttrString(text, at);
      out.push({ kind: "literal", raw: r.content, expr: null, classes: splitClasses(r.content), index: at });
      CLASSNAME_RX.lastIndex = r.end;
      continue;
    }
    if (ch === "{") {
      const b = matchBrace(text, at);
      const expr = text.slice(at + 1, Math.max(at + 1, b.end - 1));
      const classes = literaisNaExpressao(expr, descartados).flatMap(splitClasses);
      out.push({ kind: "expr", raw: expr, expr, classes, index: at });
      CLASSNAME_RX.lastIndex = b.end;
      continue;
    }
    // `className={...}` malformado ou `className` que nao e atributo.
  }
  return out;
}

/** Atalho: todas as classes literais de um arquivo, em ordem de aparicao. */
export function classesDoArquivo(text) {
  return classNameAttributes(text).flatMap((a) => a.classes);
}
