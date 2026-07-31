/**
 * Regressao da EXTRACAO DE CLASSES — as duas direcoes, sempre.
 *
 * O defeito comprado: o regex antigo capturava o texto CRU do atributo e dava
 * `split(/\s+/)`, entao `` className={`flex ${c ? "a" : "b"} gap-2`} `` produzia
 * `?`, `:` e `"b"}` como se fossem classes. Medido no alvo: 936 usos de ruido,
 * universo inflado de 31.726 para 32.662.
 *
 * Um teste que so cobrisse a direcao "o ruido sumiu" seria satisfeito por um
 * extrator que devolvesse `[]` sempre. Por isso cada caso aqui e um par: o que
 * NAO pode aparecer e o que NAO PODE SUMIR. A perda de classe legitima e o modo
 * de falha mais caro, porque ela encolhe o denominador em silencio e vira
 * "cobertura" na conta seguinte.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  apenasCodigo,
  classNameAttributes,
  classesDoArquivo,
  literaisNaExpressao,
  matchBrace,
  splitClasses,
} from "../lib/classname-extract.mjs";
import { pareceClasseUtil } from "../lib/bundle-census.mjs";

/** Helper: as classes de um trecho, em ordem estavel para comparar. */
const cls = (src) => classesDoArquivo(src);

/* ───────────────────────────────────────── o contrato pedido, caso a caso ── */

test('className="a b" -> [a, b]', () => {
  assert.deepEqual(cls('<div className="a b" />'), ["a", "b"]);
});

test('className={cond ? "a b" : "c d"} -> as DUAS pontas', () => {
  assert.deepEqual(cls('<div className={cond ? "a b" : "c d"} />'), ["a", "b", "c", "d"]);
});

test("className={`x ${v} y`} -> [x, y], interpolacao FORA", () => {
  assert.deepEqual(cls("<div className={`x ${v} y`} />"), ["x", "y"]);
});

test('className={clsx("a", cond && "b")} -> [a, b]', () => {
  assert.deepEqual(cls('<div className={clsx("a", cond && "b")} />'), ["a", "b"]);
});

test("className={styles.foo} -> [] (nao e literal)", () => {
  assert.deepEqual(cls("<div className={styles.foo} />"), []);
});

/* ────────────────────────────────────────────── o ruido que motivou tudo ── */

test("ternario DENTRO de template nao produz `?`, `:` nem `}`", () => {
  const out = cls('<div className={`flex ${cond ? "a" : "b"} gap-2`} />');
  assert.equal(out.includes("?"), false, "o `?` do ternario nao e classe");
  assert.equal(out.includes(":"), false, "o `:` do ternario nao e classe");
  assert.equal(out.includes("}"), false, "o `}` de fechamento nao e classe");
  assert.equal(out.some((c) => c.includes('"')), false, "aspas nao sobram na classe");
  // E as classes REAIS das duas pontas continuam la.
  assert.deepEqual(out, ["flex", "gap-2", "a", "b"]);
});

test("nenhuma classe extraida e pontuacao pura, em nenhuma das formas", () => {
  const fontes = [
    '<div className={a ? "p-2" : b ? "p-4" : "p-6"} />',
    '<div className={`w-full ${open ? "block" : "hidden"} ${x}`} />',
    '<div className={cn("flex", { "opacity-50": off }, extra)} />',
  ];
  for (const src of fontes) {
    for (const c of cls(src)) {
      assert.match(c, /^[^\s]+$/);
      assert.equal(/^[?:}{)([\]]+$/.test(c), false, `pontuacao pura vazou: ${c} em ${src}`);
      assert.equal(/["'`]/.test(c), false, `aspa vazou: ${c} em ${src}`);
    }
  }
});

/* ──────────────────────────────────── classes que NAO PODEM ser perdidas ── */

test("aspas simples no atributo e dentro da expressao contam", () => {
  assert.deepEqual(cls("<div className='a b' />"), ["a", "b"]);
  assert.deepEqual(cls("<div className={cond ? 'a' : 'b'} />"), ["a", "b"]);
});

test("chave de objeto do clsx e classe", () => {
  assert.deepEqual(cls('<div className={cn("flex", { "opacity-50": off })} />'), ["flex", "opacity-50"]);
});

test("array literal de classes conta; acesso computado nao", () => {
  assert.deepEqual(cls('<div className={cn(["a", "b"])} />'), ["a", "b"]);
  assert.deepEqual(cls('<div className={styles["card"]} />'), []);
});

test("prop com sufixo ClassName carrega classes reais e continua contando", () => {
  assert.deepEqual(cls('<X wrapperClassName="flex gap-2" />'), ["flex", "gap-2"]);
  assert.deepEqual(cls('<X inputClassName={cond ? "a" : "b"} />'), ["a", "b"]);
});

test("atributo multilinha (JSX permite quebra de linha) nao e truncado", () => {
  assert.deepEqual(cls('<div className="flex\n   items-center\n   gap-2" />'), [
    "flex", "items-center", "gap-2",
  ]);
});

test("literal dentro de interpolacao de template conta", () => {
  assert.deepEqual(cls('<div className={`base ${on ? "on-a on-b" : ""}`} />'), [
    "base", "on-a", "on-b",
  ]);
});

/* ──────────────────────────────────────── o que NAO e classe, por guarda ── */

test("operando de comparacao nao vira classe", () => {
  assert.deepEqual(cls('<div className={t === "dark" ? "bg-black" : "bg-white"} />'), [
    "bg-black", "bg-white",
  ]);
  assert.deepEqual(cls('<div className={n >= "2" ? "a" : "b"} />'), ["a", "b"]);
});

test("seta `=>` nao e confundida com comparacao", () => {
  assert.deepEqual(cls('<div className={items.map(() => "flex")} />'), ["flex"]);
});

test("atribuicao dentro da expressao continua sendo classe", () => {
  assert.deepEqual(cls('<div className={(x = "flex gap-2")} />'), ["flex", "gap-2"]);
});

test("argumento de metodo de string nao vira classe", () => {
  assert.deepEqual(cls('<div className={v.includes("dark") ? "a" : "b"} />'), ["a", "b"]);
  assert.deepEqual(cls('<div className={list.join(" ")} />'), []);
});

test("fragmento de classe colado na interpolacao e descartado inteiro", () => {
  // `px-${n}` nao e classe: `px-` sozinho nao existe.
  assert.deepEqual(cls("<div className={`px-${n} py-2`} />"), ["py-2"]);
});

/* ─────────────────────────────────────────────── casamento de chaves ── */

test("matchBrace nao corta no `}` dentro de string, template ou objeto", () => {
  const casos = [
    ['{cn(a, { x: y })} resto', "{cn(a, { x: y })}"],
    ['{`${a ? "}" : ""}`} resto', '{`${a ? "}" : ""}`}'],
    ["{/* } */ a} resto", "{/* } */ a}"],
  ];
  for (const [src, esperado] of casos) {
    const b = matchBrace(src, 0);
    assert.equal(b.ok, true, src);
    assert.equal(src.slice(0, b.end), esperado);
  }
});

test("expressao com objeto aninhado nao perde as classes que vem depois", () => {
  assert.deepEqual(cls('<div className={cn({ "a": 1 }, "b")} onClick={f} />'), ["a", "b"]);
});

/* ─────────────────────────────────────── apenasCodigo (contrato nomeado) ── */

test("apenasCodigo apaga o texto do literal e preserva o identificador", () => {
  const expr = 'cn(BASE, "flex gap-2")';
  const codigo = apenasCodigo(expr);
  assert.equal(codigo.length, expr.length, "offsets tem que continuar batendo");
  assert.match(codigo, /\bBASE\b/);
  assert.equal(/flex/.test(codigo), false, "conteudo do literal nao pode virar identificador");
});

test("apenasCodigo preserva identificador DENTRO da interpolacao", () => {
  const expr = "`${BASE} extra-1`";
  const codigo = apenasCodigo(expr);
  assert.equal(codigo.length, expr.length);
  assert.match(codigo, /\bBASE\b/);
  assert.equal(/extra-1/.test(codigo), false);
});

/* ───────────────────────────────────────────────────── metadados do atributo ── */

test("classifica atributo literal x expressao e devolve offset", () => {
  const src = '<a className="x" />\n<b className={y} />';
  const attrs = classNameAttributes(src);
  assert.equal(attrs.length, 2);
  assert.equal(attrs[0].kind, "literal");
  assert.equal(attrs[1].kind, "expr");
  assert.equal(attrs[1].expr, "y");
  assert.equal(src.slice(0, attrs[1].index).split("\n").length, 2);
});

test("splitClasses descarta interpolacao e mantem utility com variante", () => {
  assert.deepEqual(splitClasses('hover:bg-red-500 ${x} $y p-2'), ["hover:bg-red-500", "p-2"]);
});

/* ───────────────── a regua do gate (audit-extraction-delta) ── */

test("pareceClasseUtil separa classe de fragmento de codigo", () => {
  for (const c of ["flex", "hover:bg-surface-hover", "px-4", "after:content-['']", "w-1/2"]) {
    assert.equal(pareceClasseUtil(c), true, `${c} e classe`);
  }
  for (const c of ["===", "&&", "index", "selectedOption", "0", "block.isExpanded", 'hover:bg-x"', "-"]) {
    assert.equal(pareceClasseUtil(c), false, `${c} NAO e classe`);
  }
});

test("literaisNaExpressao registra o motivo do descarte", () => {
  const descartados = [];
  literaisNaExpressao('t === "dark" ? "a" : styles["b"]', descartados);
  assert.deepEqual(descartados.map((d) => d.motivo).sort(), ["acesso-computado", "comparacao"]);
});
