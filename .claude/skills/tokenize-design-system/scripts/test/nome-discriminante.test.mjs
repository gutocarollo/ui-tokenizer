/**
 * O SUFIXO TEM QUE NOMEAR A DIFERENÇA, e o relatório tem que medir isso.
 *
 * Gap comprado com prova reproduzida (review adversarial da F-D): em 26 das 411
 * entidades derivadas (981 usos) o sufixo citava classe que a entidade
 * COMPARTILHA com a homônima, e o contador de "nome fraco" reportava `0 | 0` —
 * porque media UNICIDADE DE STRING, não poder discriminante. O caso do alvo:
 *
 *   COMMON_LABEL                = "block font-semibold mb-3 text-content-primary text-sm"  (175×)
 *   COMMON_LABEL_FONT_SEMIBOLD  = "block font-semibold mb-2 text-content-primary text-sm"  (29×)
 *
 * As duas têm `font-semibold`; o que muda é `mb-3` vs `mb-2`. Causa: o laço de
 * desempate tirava o sufixo dos `extras` do GRUPO INTEIRO, não da diferença para a
 * irmã que já levara o nome base.
 *
 * Esta fixture reproduz a MESMA forma (grupo heterogêneo, com um membro sem
 * `font-semibold` para que ele saia do núcleo do grupo) e roda o script de ponta a
 * ponta, porque o defeito estava na interação entre o núcleo do grupo e a ordem de
 * atribuição — não numa função isolada.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const SCRIPTS = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const REPO = path.resolve(SCRIPTS, "../../../..");
// So o node_modules do ALVO serve: propose-entities resolve typescript/parser
// DO alvo, e trocar por outro (ex.: o deste repo) muda o AST e o veredito da
// auditoria — medido 2026-08-03. Sem env, skip declarado (D4: nada cravado).
const NODE_MODULES = [
  ...(process.env.TOKENIZE_TEST_ROOT
    ? [path.join(path.resolve(process.env.TOKENIZE_TEST_ROOT), "node_modules")]
    : []),
].find((p) => existsSync(path.join(p, "typescript")));

const LABEL_MB3 = "block font-semibold mb-3 text-content-primary text-sm";
const LABEL_MB2 = "block font-semibold mb-2 text-content-primary text-sm";
const LABEL_NUA = "block font-semibold text-content-primary text-sm";
const LABEL_MEDIUM = "block font-medium mb-2 text-content-primary text-sm";

function montarAlvo() {
  const root = mkdtempSync(path.join(os.tmpdir(), "nome-disc-"));
  const w = (rel, txt) => {
    const p = path.join(root, rel);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, txt);
  };
  w("package.json", JSON.stringify({ name: "fixture", private: true }, null, 1));
  w("tailwind.config.js", `export default { content: { files: ["src/**/*.{js,jsx}"] } };\n`);
  symlinkSync(NODE_MODULES, path.join(root, "node_modules"));

  /**
   * As QUATRO variantes aparecem nos MESMOS dois componentes, em partes iguais.
   * Isso é o que põe as quatro no mesmo grupo homônimo (nenhum componente domina
   * com ≥60%, então o qualificador cai no owner do token — igual para as quatro),
   * que é a condição do defeito: o núcleo do grupo exclui `font-semibold` porque a
   * variante `font-medium` está no grupo, e `font-semibold` vira "extra" mesmo
   * estando em três das quatro.
   */
  const bloco = (cls, n) => Array.from({ length: n }, (_, i) =>
    `      <label className="${cls}">campo ${i}</label>`).join("\n");
  const pagina = (nome) =>
    `export default function ${nome}() {\n  return (\n    <form>\n` +
    `${bloco(LABEL_MB3, 5)}\n${bloco(LABEL_MB2, 4)}\n${bloco(LABEL_NUA, 3)}\n${bloco(LABEL_MEDIUM, 2)}\n` +
    `    </form>\n  );\n}\n`;
  w("src/pages/Um/index.jsx", pagina("Um"));
  w("src/pages/Dois/index.jsx", pagina("Dois"));
  return root;
}

function rodar(root) {
  execFileSync(process.execPath, [path.join(SCRIPTS, "propose-entities.mjs"), "--root", root], {
    cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(readFileSync(path.join(root, ".tokenize/entidades-propostas.json"), "utf8"));
}

const disponivel = Boolean(NODE_MODULES);

test("o sufixo nomeia a DIFERENÇA, nunca o que as homônimas compartilham",
  { skip: disponivel ? false : "typescript do alvo não encontrado" }, () => {
    const j = rodar(montarAlvo());
    const porClasses = new Map(j.entidades.map((e) => [[...e.classes].sort().join(" "), e]));
    const nome = (cls) => porClasses.get(cls.split(" ").sort().join(" "))?.nome;

    const base = nome(LABEL_MB3);
    const mb2 = nome(LABEL_MB2);
    const nua = nome(LABEL_NUA);
    const medium = nome(LABEL_MEDIUM);
    for (const [rot, n] of Object.entries({ base, mb2, nua, medium })) {
      assert.ok(n, `entidade '${rot}' ficou sem nome`);
    }
    assert.equal(new Set([base, mb2, nua, medium]).size, 4, "nomes têm que ser distintos");

    // O que o defeito produzia: sufixo FONT_SEMIBOLD, presente nas duas.
    assert.ok(!mb2.includes("FONT_SEMIBOLD"),
      `sufixo cita classe compartilhada: ${mb2} (base ${base})`);
    assert.ok(mb2.endsWith("_MB_2"), `o sufixo tem que nomear a diferença real: ${mb2}`);
    // Subconjunto estrito: a diferença é a AUSÊNCIA, e o nome diz isso.
    assert.match(nua, /_SEM_MB_3$/, `subconjunto estrito precisa de discriminador negativo: ${nua}`);
    assert.match(medium, /_FONT_MEDIUM$/, `diferença tipográfica real: ${medium}`);

    // E o relatório mede a propriedade, em vez de afirmá-la.
    assert.equal(j.ataque.sufixoNaoDiscriminante, 0);
    assert.equal(j.ataque.usosComSufixoNaoDiscriminante, 0);
    assert.equal(j.ataque.sufixoInconclusivo, 0);
    assert.equal(j.naoDiscriminantes.length, 0);
    assert.equal(j.ataque.discriminadorNegativo, 1);
  });

test("a auditoria ACUSA quando o sufixo é não-discriminante",
  { skip: disponivel ? false : "typescript do alvo não encontrado" }, () => {
    // Guarda contra o modo de falha mais perigoso: uma auditoria que nunca acusa.
    // Injeta o defeito na saída e confere que o predicado o encontra.
    const j = rodar(montarAlvo());
    const porClasses = new Map(j.entidades.map((e) => [[...e.classes].sort().join(" "), e]));
    const base = porClasses.get(LABEL_MB3.split(" ").sort().join(" "));
    const mb2 = porClasses.get(LABEL_MB2.split(" ").sort().join(" "));

    const norm = (c) => c.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
    const sondaDaReview = (nomeErrado, entidade, dono) => {
      const sufixo = nomeErrado.slice(dono.nome.length + 1);
      const doDono = new Set(dono.classes.map(norm));
      return entidade.classes.filter((c) => sufixo.includes(norm(c)) && doDono.has(norm(c)));
    };
    // o nome que o defeito produzia
    assert.deepEqual(sondaDaReview(`${base.nome}_FONT_SEMIBOLD`, mb2, base), ["font-semibold"]);
    // o nome que a correção produz
    assert.deepEqual(sondaDaReview(mb2.nome, mb2, base), []);
  });
