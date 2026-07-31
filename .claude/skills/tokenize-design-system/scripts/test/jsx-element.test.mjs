import assert from "node:assert/strict";
import test from "node:test";
import {
  openingTagAt, carryingTagStart, elementFacts, subtreeOf, interactiveDescendants,
} from "../lib/jsx-element.mjs";

/** Offset do primeiro `className` do trecho — onde o token sempre mora. */
const at = (src) => src.indexOf("className");

test("le a tag de abertura inteira mesmo com arrow function no atributo", () => {
  // Este e O caso que quebrou. `indexOf(">")` para no `>` da seta e devolve
  // `<div onClick={() =`, entao a tag some e o elemento vira "fora de JSX".
  const src = `<div onClick={() => onClick(value)} className="hover:bg-surface-hover">x</div>`;
  const open = openingTagAt(src, 0);
  assert.ok(open.includes("className"), "a tag de abertura tem que chegar ate o className");
  assert.ok(open.endsWith(">"));
  assert.equal(carryingTagStart(src, at(src)), 0);
});

test("acha `<div onClick>` multilinha e reporta o handler", () => {
  const src = [
    "<div",
    "  onClick={() => onClick(value)}",
    '  className={`w-full p-2 hover:bg-surface-hover ${checked ? "bg-x" : ""}`}',
    ">",
    '  <input type="checkbox" className="peer hidden" readOnly={true} />',
    "</div>",
  ].join("\n");
  const f = elementFacts(src, at(src));
  assert.equal(f.tag, "div");
  assert.equal(f.hasOnClick, true);
  assert.equal(f.hasTabIndex, false);
  assert.equal(f.role, null);
  assert.equal(f.nestedControl, "checkbox", "o controle nativo escondido tem que ser visto");
});

test("le `role` de elemento ja acessivel — o caso JobRow", () => {
  // HTML correto que mesmo assim cai na fila, porque `ROLE_OWNER` nao tem
  // a chave `button`. Se este teste passar e o cluster continuar sem owner,
  // o defeito e da TABELA, nao do app.
  const src = [
    "<div",
    '  role="button"',
    "  tabIndex={0}",
    "  onClick={() => navigate(p)}",
    '  onKeyDown={(e) => { if (e.key === "Enter") navigate(p); }}',
    '  className="hover:bg-surface-hover"',
    ">",
  ].join("\n");
  const f = elementFacts(src, at(src));
  assert.equal(f.tag, "div");
  assert.equal(f.role, "button");
  assert.equal(f.hasTabIndex, true);
  assert.equal(f.hasOnKeyDown, true);
});

test("nao confunde irmao fechado anterior com a tag portadora", () => {
  const src = `<span className="a">i</span>\n<button className="bg-surface-hover">t</button>`;
  const off = src.lastIndexOf("className");
  assert.equal(elementFacts(src, off).tag, "button");
});

test("distingue gatilho de tooltip (sem handler) de elemento clicavel", () => {
  const src = [
    "<div",
    '  className="cursor-pointer hover:bg-surface-hover"',
    '  data-tooltip-id="lemonade-base-url"',
    ">",
    "  <Info size={16} />",
    "</div>",
  ].join("\n");
  const f = elementFacts(src, at(src));
  assert.equal(f.hasOnClick, false);
  assert.equal(f.hasTooltip, true);
  assert.match(f.classText, /cursor-pointer/);
});

test("reconhece o preenchimento de barra de progresso por style inline", () => {
  const src = '<div className="h-full bg-surface-info-tint" style={{ width: `${pct}%` }} />';
  assert.equal(elementFacts(src, at(src)).inlineWidthPct, true);
});

test("`<label>` envolvendo controle resolve o tipo do controle", () => {
  const src = `<label className="hover:bg-surface-hover">\n  <input type="radio" name="g" />\n</label>`;
  const f = elementFacts(src, at(src));
  assert.equal(f.tag, "label");
  assert.equal(f.nestedControl, "radio");
});

test("`<li>` dentro de `<ul>` e reconhecido como item de lista", () => {
  const src = `<ul>\n  <li onClick={() => pick(f)} className="hover:bg-surface-hover">n</li>\n</ul>`;
  const f = elementFacts(src, at(src));
  assert.equal(f.tag, "li");
  assert.equal(f.parentIsList, true);
});

test("ocorrencia fora de JSX nao inventa tag", () => {
  const src = 'const SHARED = " bg-surface-elevated text-content-inverse";';
  assert.equal(elementFacts(src, src.indexOf("bg-surface")), null);
});

test("subarvore fecha na tag correspondente, contando aninhamento da mesma tag", () => {
  const src = '<div className="bg-surface-hover">\n <div>a</div>\n <span>b</span>\n</div>\n<div>fora</div>';
  const sub = subtreeOf(src, 0);
  assert.equal(sub.complete, true);
  assert.ok(sub.text.includes("<span>b</span>"));
  assert.ok(!sub.text.includes("fora"), "nao pode vazar para o irmao seguinte");
});

test("elemento auto-fechado nao tem subarvore", () => {
  const src = '<div className="bg-surface-hover" />\n<button>x</button>';
  const sub = subtreeOf(src, 0);
  assert.equal(sub.selfClosing, true);
  assert.equal(interactiveDescendants(src, 0).items.length, 0);
});

test("subarvore sem fechamento e DESCONHECIDA, nao vazia", () => {
  // O caso perigoso: sem `complete`, um truncamento viraria "nao ha
  // descendente interativo" — afirmacao de ausencia sem ter olhado.
  const src = '<div className="bg-surface-hover">\n <button>x</button>';
  const d = interactiveDescendants(src, 0);
  assert.equal(d.complete, false);
});

test("nested-interactive: `<button>` real dentro do container clicavel", () => {
  // ModelRouters/index.jsx:206 — `<div onClick>` com DOIS `<button>` dentro.
  // Virar `<button>` produz content model invalido; virar `role="button"`
  // produz `nested-interactive` do axe. As duas vias falham.
  const src = [
    '<div onClick={goToRules} className="cursor-pointer hover:bg-surface-hover">',
    "  <span>nome</span>",
    "  <button onClick={handleEditClick}><Edit2 /></button>",
    "  <button onClick={handleDelete}><X /></button>",
    "</div>",
  ].join("\n");
  const f = elementFacts(src, at(src));
  assert.equal(f.hasNestedInteractive, true);
  assert.equal(f.subtreeUnknown, false);
  assert.equal(f.descendants.blocking.length, 2);
  assert.deepEqual(f.descendants.blocking.map((i) => i.tag), ["button", "button"]);
});

test("nested-interactive: descendente com `role` de widget e `tabIndex`", () => {
  // WorkspaceFileRow/index.jsx:62 — o descendente ja e um checkbox ARIA focavel.
  const src = [
    '<div onClick={toggleRowSelection} className="hover:bg-surface-hover cursor-pointer">',
    '  <div role="checkbox" aria-checked={selected} tabIndex={0} onClick={handleRowSelection} />',
    "</div>",
  ].join("\n");
  const f = elementFacts(src, at(src));
  assert.equal(f.hasNestedInteractive, true);
  assert.ok(f.descendants.blocking[0].reasons.includes('role="checkbox"'));
});

test("input `peer hidden` conta no CONTENT MODEL mas nao e focavel", () => {
  // O padrao A1 deste alvo. `<button>` em volta seria markup invalido (a via
  // nativa quebra), mas `display:none` tira o input da ordem de foco, entao a
  // via de ATRIBUTOS nao produz `nested-interactive`. Confundir os dois eixos
  // infla o risco da via barata com um controle que ninguem alcanca.
  const src = [
    '<div onClick={pick} className="hover:bg-surface-hover">',
    "  <span>titulo</span>",
    '  <input type="checkbox" className="peer hidden" readOnly />',
    "  <p>descricao</p>",
    "</div>",
  ].join("\n");
  const f = elementFacts(src, at(src));
  assert.equal(f.hasNestedInteractive, true, "content model: `<input>` dentro de `<button>` e invalido");
  assert.equal(f.hasNestedFocusable, false, "`hidden` = display:none = fora da ordem de foco");

  const visivel = src.replace('className="peer hidden"', 'className="peer"');
  assert.equal(elementFacts(visivel, at(visivel)).hasNestedFocusable, true);
});

test("container apresentacional puro NAO e marcado como nested-interactive", () => {
  const src = [
    '<div onClick={pick} className="hover:bg-surface-hover">',
    "  <span>titulo</span>",
    "  <p>descricao</p>",
    "</div>",
  ].join("\n");
  const f = elementFacts(src, at(src));
  assert.equal(f.hasNestedInteractive, false);
  assert.equal(f.hasNestedFocusable, false);
});

test("spread de PROPS e detectado; spread de OBJETO em expressao nao", () => {
  // O falso positivo real: `SkillList/index.jsx:44`. Um regex por `{...`
  // marcava a `<div>` como tendo props de runtime por causa do argumento do
  // handler, e o item saia do ganho por motivo falso.
  const props = '<div {...getRootProps()} className="hover:bg-surface-hover">';
  assert.equal(elementFacts(props, at(props)).hasSpread, true);
  assert.equal(elementFacts(props, at(props)).spreadName, "getRootProps()");

  const objeto = '<div onClick={() => handleClick?.({ ...config, imported: true })} className="hover:bg-surface-hover">';
  assert.equal(elementFacts(objeto, at(objeto)).hasSpread, false, "spread dentro de expressao nao e spread de props");
});
