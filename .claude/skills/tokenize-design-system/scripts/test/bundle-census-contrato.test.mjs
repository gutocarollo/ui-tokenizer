/**
 * O censo tem que enxergar o VEÍCULO que este projeto propõe.
 *
 * Gap comprado com prova reproduzida: `const` exportado + `className={NOME}` era
 * atributo DINÂMICO para o regex do censo, e a string do contrato passava a viver
 * num arquivo sem nenhum `className=`. Migrar um call site FAZIA O DENOMINADOR
 * ENCOLHER — 16 usos viravam 0 — e `measure-coverage` saía com `exit 0` e `NaN%`.
 * O portão de E5/E6 é medido depois do codemod; ele mediria zero e passaria.
 *
 * O teste central aqui é o de INVARIÂNCIA: os mesmos usos antes e depois da
 * migração, com a diferença aparecendo em `usosViaContrato`, não no denominador.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { census, pareceContratoDeClasses, tabelaDeContratos } from "../lib/bundle-census.mjs";

const BUNDLE =
  "border-none bg-theme-settings-input-bg text-content-primary text-sm rounded-lg block w-full p-2.5";

function projeto(arquivos) {
  const root = mkdtempSync(path.join(os.tmpdir(), "censo-"));
  for (const [rel, conteudo] of Object.entries(arquivos)) {
    const p = path.join(root, rel);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, conteudo);
  }
  return root;
}

test("migrar para `const` exportado NÃO encolhe o denominador", () => {
  const antes = census(projeto({
    "src/components/A/index.jsx":
      `export default () => (<div>\n` +
      `  <input className="${BUNDLE}" />\n` +
      `  <input className="${BUNDLE}" />\n` +
      `</div>);\n`,
  }));
  const depois = census(projeto({
    "src/utils/design-entities.js": `export const SETTINGS_INPUT_SELECT =\n  "${BUNDLE}";\n`,
    "src/components/A/index.jsx":
      `import { SETTINGS_INPUT_SELECT } from "@/utils/design-entities";\n` +
      `export default () => (<div>\n` +
      `  <input className={SETTINGS_INPUT_SELECT} />\n` +
      `  <input className={SETTINGS_INPUT_SELECT} />\n` +
      `</div>);\n`,
  }));

  assert.equal(antes.usos, 16);
  assert.equal(antes.atributos, 2);
  assert.equal(antes.usosViaContrato, 0);

  // A invariância é o ponto: mesmo denominador, mesma entidade, mesmo n.
  assert.equal(depois.usos, antes.usos);
  assert.equal(depois.atributos, antes.atributos);
  assert.equal(depois.bundles.size, antes.bundles.size);
  assert.equal([...depois.bundles.values()][0].n, 2);
  // E o ganho aparece onde tem que aparecer.
  assert.equal(depois.usosViaContrato, 16);
  assert.equal(depois.atributosViaContrato, 2);
  assert.equal(depois.dinamicos, 0, "o que foi resolvido sai da conta de dinâmico");
});

test("a DECLARAÇÃO sozinha não é uso — call site é que conta", () => {
  const c = census(projeto({
    "src/utils/design-entities.js": `export const SETTINGS_INPUT_SELECT = "${BUNDLE}";\n`,
  }));
  assert.equal(c.usos, 0);
  assert.equal(c.atributos, 0);
  assert.equal(c.contratos.size, 1);
});

test("forma composta com tailwind-merge resolve e fica marcada como mista", () => {
  const c = census(projeto({
    "src/utils/design-entities.js": `export const CARD = "flex items-center gap-2 rounded-lg";\n`,
    "src/components/B/index.jsx":
      `<div className={twMerge(CARD, props.className)} />\n`,
  }));
  assert.equal(c.usos, 4);
  assert.equal(c.atributosViaContrato, 1);
  assert.equal(c.atributosMistos, 1);
});

test("nome AMBÍGUO não resolve — inventar cobertura é pior que declarar o buraco", () => {
  const c = census(projeto({
    "src/a/tokens.js": `export const CARD = "flex items-center gap-2 rounded-lg";\n`,
    "src/b/tokens.js": `export const CARD = "grid gap-4 rounded-sm p-2";\n`,
    "src/components/C/index.jsx": `<div className={CARD} />\n`,
  }));
  assert.equal(c.contratos.size, 0);
  assert.equal(c.contratosAmbiguos.length, 1);
  assert.equal(c.usos, 0);
  assert.equal(c.identificadoresNaoResolvidos.get("CARD").n, 1, "o buraco fica VISÍVEL");
});

test("identificador desconhecido vira buraco declarado, não silêncio", () => {
  const c = census(projeto({
    "src/components/D/index.jsx": `<div className={estiloCalculado} />\n`,
  }));
  assert.equal(c.usos, 0);
  assert.equal(c.identificadoresNaoResolvidos.get("estiloCalculado").n, 1);
});

test("string de texto não vira contrato de classes", () => {
  assert.equal(pareceContratoDeClasses("Bem-vindo de volta"), false, "tem espaço + nada de utility");
  assert.equal(pareceContratoDeClasses("Salvar"), false);
  assert.equal(pareceContratoDeClasses("["), false, "piso de 2 classes: `const b = \"[\"` do bundle minificado");
  assert.equal(pareceContratoDeClasses("refetch-logo"), false, "evento nao e contrato");
  assert.equal(pareceContratoDeClasses("flex items-center"), true);
  assert.equal(pareceContratoDeClasses("hover:bg-primary/50 p-2.5"), true);

  const textos = new Map([["src/x.js", `const TITULO = "Salvar";\nconst CARD = "flex gap-2";\n`]]);
  const { contratos } = tabelaDeContratos(textos);
  assert.deepEqual([...contratos.keys()], ["CARD"]);
});
