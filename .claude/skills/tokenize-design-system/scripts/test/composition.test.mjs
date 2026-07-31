/**
 * Regressão da COMPOSIÇÃO — o instrumento 2 do oráculo, e o critério de núcleo.
 *
 * O que estes testes travam, cada um comprado com um defeito real desta rodada:
 *
 *  1. **(c) overlap relativo === (a) a maior.** O pedido listava três critérios
 *     de desempate como se fossem três escolhas. Dois são o MESMO: todo candidato
 *     é subconjunto do bundle, então |núcleo ∩ bundle| = |núcleo|, e o
 *     denominador |bundle| é constante dentro daquele bundle. Apresentá-los como
 *     opções diferentes seria inventar uma decisão. O teste prova a identidade
 *     por enumeração, não por argumento.
 *  2. **Maximalidade não é desempate, é correção.** Se A ⊂ B e os dois são
 *     candidatos, escolher A joga `B \ A` para `extras` — classes que já são
 *     contrato canônico saindo como "extra ad-hoc".
 *  3. **Gêmeas colapsam.** Duas chaves de bundle podem ter o MESMO conjunto de
 *     classes quando uma repete classe dentro do atributo. Se a maximalidade
 *     fosse por tamanho, as duas sobreviveriam como incomparáveis e o bundle
 *     apareceria como AMBÍGUO havendo uma entidade só.
 *  4. **`extras` é multiconjunto.** Descontar por conjunto apagaria a classe
 *     duplicada do call site — o defeito que a tokenização expõe de graça.
 *  5. **O conjunto detectado é o instrumento 2 de `measure-disposition`.** É a
 *     invariante que impede a proposta de falar de bundles que o oráculo não
 *     conta (o defeito dos dois censos, uma camada acima).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { census, bundleKey } from "../lib/bundle-census.mjs";
import {
  candidatosDe, contem, detectarComposicoes, entidadesDoCenso,
  extrasDe, indiceInvertido, maximaisDe,
} from "../lib/composition.mjs";

/* ---------------------------------------------------------------- utils --- */

/** Monta um `bundles` no formato do censo, sem passar por disco. */
function bundlesDe(especificacao) {
  const m = new Map();
  for (const [classes, n] of especificacao) m.set(bundleKey(classes), { n, classes });
  return m;
}

/* ----------------------------------------------------------- identidade --- */

test("(c) maior overlap relativo é IDÊNTICO a (a) a maior — não é terceiro critério", () => {
  const bundles = bundlesDe([
    [["a", "b", "c", "d"], 3],        // entidade E1 (4 classes)
    [["a", "b", "c", "d", "e", "f"], 2], // entidade E2 (6 classes), contém E1
    [["x", "y", "z", "w"], 5],        // entidade E3, disjunta
    [["a", "b", "c", "d", "e", "f", "g", "h"], 1], // composto: contém E1 e E2
  ]);
  const ents = entidadesDoCenso(bundles, 2, 4);
  const inv = indiceInvertido(ents);
  const alvo = bundles.get(bundleKey(["a", "b", "c", "d", "e", "f", "g", "h"]));
  const cands = candidatosDe(alvo.classes, ents, inv);
  assert.equal(cands.length, 2, "E1 e E2 são subconjuntos");

  const tamanhoBundle = new Set(alvo.classes).size;
  for (const k of cands) {
    const interseccao = [...ents.get(k)].filter((c) => alvo.classes.includes(c)).length;
    // todo candidato é SUBCONJUNTO: a interseção é o próprio candidato
    assert.equal(interseccao, ents.get(k).size);
    // e o denominador é o mesmo para todos -> ordenar por overlap === ordenar por |núcleo|
    assert.equal(tamanhoBundle, new Set(alvo.classes).size);
  }
  const porTamanho = [...cands].sort((a, b) => ents.get(b).size - ents.get(a).size);
  const porOverlap = [...cands].sort(
    (a, b) => ents.get(b).size / tamanhoBundle - ents.get(a).size / tamanhoBundle
  );
  assert.deepEqual(porOverlap, porTamanho, "as duas ordens têm que coincidir");
});

/* --------------------------------------------------------- maximalidade --- */

test("maximalidade: o núcleo é E2 (maior), nunca E1 — senão `B \\ A` vira extra ad-hoc", () => {
  const bundles = bundlesDe([
    [["a", "b", "c", "d"], 9],                     // E1, MUITO mais frequente
    [["a", "b", "c", "d", "e", "f"], 2],           // E2, contém E1
    [["a", "b", "c", "d", "e", "f", "g"], 1],      // composto
  ]);
  const ents = entidadesDoCenso(bundles, 2, 4);
  const comps = detectarComposicoes(bundles, ents);
  const rec = comps.get(bundleKey(["a", "b", "c", "d", "e", "f", "g"]));

  assert.equal(rec.candidatos.length, 2);
  assert.equal(rec.maximais.length, 1, "E1 ⊂ E2, então só E2 é maximal");
  assert.equal(rec.ambiguo, false, "cadeia de contenção resolve: não é ambiguidade real");
  assert.equal(rec.nucleo, bundleKey(["a", "b", "c", "d", "e", "f"]));
  assert.deepEqual(rec.extras, ["g"], "extras é só `g`, nunca `e f g`");
  assert.equal(
    rec.nucleoPorFrequencia, rec.nucleo,
    "mesmo com E1 9x contra E2 2x, o critério (b) roda sobre os MAXIMAIS — E1 nem disputa"
  );
});

test("ambiguidade REAL: dois maximais incomparáveis, e o critério decide", () => {
  const bundles = bundlesDe([
    [["a", "b", "c", "d", "e"], 2],   // E1, 5 classes
    [["a", "b", "c", "f"], 40],       // E2, 4 classes, MUITO frequente
    [["a", "b", "c", "d", "e", "f"], 1], // composto: contém E1 e E2, nenhum contém o outro
  ]);
  const ents = entidadesDoCenso(bundles, 2, 4);
  const rec = detectarComposicoes(bundles, ents).get(bundleKey(["a", "b", "c", "d", "e", "f"]));

  assert.equal(rec.ambiguo, true);
  assert.equal(rec.maximais.length, 2);
  assert.equal(rec.nucleo, bundleKey(["a", "b", "c", "d", "e"]), "(a) escolhe a de 5 classes");
  assert.equal(rec.nucleoPorFrequencia, bundleKey(["a", "b", "c", "f"]), "(b) escolheria a de 40x");
  assert.equal(rec.divergePorFrequencia, true, "e a divergência é REPORTADA, não escondida");
  assert.deepEqual(rec.extras, ["f"]);
});

test("gêmeas (mesmo conjunto, chaves diferentes por classe duplicada) NÃO viram ambiguidade", () => {
  const bundles = bundlesDe([
    [["a", "b", "c", "d"], 3],            // E1
    [["a", "b", "c", "d", "d"], 2],       // E1', gêmea: MESMO conjunto, chave diferente
    [["a", "b", "c", "d", "z"], 1],       // composto
  ]);
  const ents = entidadesDoCenso(bundles, 2, 4);
  const rec = detectarComposicoes(bundles, ents).get(bundleKey(["a", "b", "c", "d", "z"]));

  assert.equal(rec.candidatos.length, 2, "as duas entram como candidatas");
  assert.equal(rec.maximais.length, 1, "e colapsam por assinatura de conjunto");
  assert.equal(rec.ambiguo, false, "gêmea não é ambiguidade — é a MESMA entidade contada 2x");
  assert.equal(rec.gemeasNoNucleo.length, 1, "e a colisão é reportada, não apagada");
});

/* ------------------------------------------------------------ multiset --- */

test("`extras` desconta por MULTICONJUNTO: a classe duplicada do call site sobrevive", () => {
  assert.deepEqual(extrasDe(["a", "b", "c", "c", "z"], ["a", "b", "c"]), ["c", "z"]);
  assert.deepEqual(extrasDe(["a", "b", "c"], ["a", "b", "c"]), []);
});

test("`extrasDuplicados` separa o defeito do call site do extra legítimo", () => {
  const bundles = bundlesDe([
    [["a", "b", "c", "d"], 3],
    [["a", "b", "c", "d", "d", "z"], 1],
  ]);
  const ents = entidadesDoCenso(bundles, 2, 4);
  const rec = detectarComposicoes(bundles, ents).get(bundleKey(["a", "b", "c", "d", "d", "z"]));
  assert.deepEqual(rec.extras, ["d", "z"]);
  assert.deepEqual(rec.extrasDuplicados, ["d"], "`d` já estava no núcleo: é defeito, não extra");
});

/* ------------------------------------------------------------- básicos --- */

test("`contem` é contenção de conjunto, e um bundle disjunto não produz composição", () => {
  assert.equal(contem(new Set(["a", "b"]), new Set(["a"])), true);
  assert.equal(contem(new Set(["a"]), new Set(["a", "b"])), false);

  const bundles = bundlesDe([
    [["a", "b", "c", "d"], 3],
    [["x", "y", "z", "w", "v"], 1],
  ]);
  const ents = entidadesDoCenso(bundles, 2, 4);
  assert.equal(detectarComposicoes(bundles, ents).size, 0);
});

test("entidade NÃO se auto-detecta como composição", () => {
  const bundles = bundlesDe([[["a", "b", "c", "d"], 3]]);
  const ents = entidadesDoCenso(bundles, 2, 4);
  assert.equal(detectarComposicoes(bundles, ents).size, 0);
});

test("maximaisDe: entre 3 encadeados A ⊂ B ⊂ C, só C é maximal", () => {
  const bundles = bundlesDe([
    [["a", "b", "c", "d"], 2],
    [["a", "b", "c", "d", "e"], 2],
    [["a", "b", "c", "d", "e", "f"], 2],
  ]);
  const ents = entidadesDoCenso(bundles, 2, 4);
  const { maximais } = maximaisDe([...ents.keys()], ents);
  assert.equal(maximais.length, 1);
  assert.equal(maximais[0], bundleKey(["a", "b", "c", "d", "e", "f"]));
});

/* ------------------------------------- reconciliação com o censo REAL ----- */

test("sobre um alvo em DISCO: o conjunto detectado é o instrumento 2 do oráculo", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "comp-"));
  try {
    mkdirSync(path.join(dir, "src"), { recursive: true });
    writeFileSync(
      path.join(dir, "src", "a.jsx"),
      [
        'export const A = () => <div className="flex items-center gap-2 rounded-lg" />;',
        'export const B = () => <div className="flex items-center gap-2 rounded-lg" />;',
        // composto: contém o bundle acima + mt-2
        'export const C = () => <div className="flex items-center gap-2 rounded-lg mt-2" />;',
      ].join("\n")
    );
    const c = census(dir);
    const ents = entidadesDoCenso(c.bundles, 2, 4);
    const comps = detectarComposicoes(c.bundles, ents);

    assert.equal(ents.size, 1, "uma entidade: repete 2x e tem 4 classes");
    assert.equal(comps.size, 1, "um composto");

    const rec = [...comps.values()][0];
    assert.deepEqual(rec.extras, ["mt-2"]);
    assert.equal(rec.usos, 5, "5 classes x 1 call site");

    /* a invariante: A + composição não excedem o universo e não se sobrepõem */
    const usosEnt = [...ents.keys()].reduce(
      (s, k) => s + c.bundles.get(k).classes.length * c.bundles.get(k).n, 0
    );
    const usosComp = [...comps.keys()].reduce(
      (s, k) => s + c.bundles.get(k).classes.length * c.bundles.get(k).n, 0
    );
    assert.equal(usosEnt, 8);
    assert.equal(usosComp, 5);
    assert.equal(usosEnt + usosComp, c.usos, "aqui os dois instrumentos fecham o universo");
    for (const k of comps.keys()) assert.equal(ents.has(k), false, "os baldes são disjuntos");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
