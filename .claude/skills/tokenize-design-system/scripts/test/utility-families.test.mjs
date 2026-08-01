/**
 * Two-way regression for the utility-family table.
 *
 * ONE-WAY REGRESSION IS HOW THE LAST BUG SHIPPED. A must-match list alone would
 * have passed the broken `p(?:-|$)` regex for `p-2.5` while `px-4` fell out, and
 * a must-NOT-match list alone would have passed an empty table. Both directions
 * run, always.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  UTILITY_FAMILIES,
  PREFIX_PROPERTY,
  PREFIX_FAMILY,
  isTokenizableUtility,
  familyPrefixOf,
  prefixAlternation,
  stripVariants,
  lawSlotFor,
  unlawedPrefixes,
} from "../lib/utility-families.mjs";
import { readVocabulary } from "../score-naming.mjs";

/* --------------------------------------------------------- must MATCH ----- */

const MUST_MATCH = [
  // the list demanded by F-E
  "px-4", "py-2", "mt-2", "mx-2", "ms-1", "rounded-lg", "gap-3",
  "font-semibold", "leading-5", "tracking-tight", "hover:px-2", "md:mt-4",
  // the paint families that already worked, so widening cannot lose them
  "bg-surface-panel", "text-content-primary", "border-none", "ring-2",
  "divide-y", "outline-none", "shadow-lg", "fill-current", "stroke-2",
  "placeholder-content-tertiary", "accent-primary", "caret-content-primary",
  // the eleven spacing variants the first regex dropped
  "p-2.5", "pt-1", "pb-1", "pl-3", "pr-3", "ps-2", "pe-2",
  "mb-4", "ml-auto", "mr-auto", "my-6", "me-2",
  // corner radius, which needs longest-first alternation
  "rounded-t-lg", "rounded-tl-sm", "rounded-ss-none", "rounded-full", "rounded",
  // gap / space
  "gap-x-2", "gap-y-4", "space-x-2", "space-y-1", "space-x-reverse",
  // negative spacing keeps its family
  "-mt-4", "-mx-2", "md:-mb-1",
  // variant chains the hard-coded allowlist could not see (measured: 389 uses)
  "placeholder:text-sm", "peer-checked/public:bg-surface-panel",
  "group-disabled:text-content-disabled", "enabled:hover:bg-surface-hover",
  "after:mt-1", "[&_p]:mb-2", "light:placeholder:text-content-tertiary",
  "group-hover/gear:light:text-content-primary",
];

for (const cls of MUST_MATCH) {
  test(`tokenizable: ${cls}`, () => {
    assert.equal(isTokenizableUtility(cls), true, `${cls} must be seen as a design family`);
    assert.notEqual(familyPrefixOf(cls), null, `${cls} must resolve to a prefix`);
  });
}

/* ----------------------------------------------------- must NOT MATCH ----- */

const MUST_NOT_MATCH = [
  // the list demanded by F-E
  "mask-none", "min-w-0", "max-h-96", "flex", "w-full", "h-4",
  "mix-blend-multiply", "pointer-events-none", "absolute", "z-10",
  // the composition utilities that dominate the exception queue
  "flex-col", "items-center", "justify-between", "block", "inline-flex",
  "relative", "fixed", "grid", "grid-cols-2", "shrink-0", "overflow-hidden",
  "top-1/2", "left-3", "right-0", "bottom-0", "hidden", "truncate",
  "cursor-pointer", "select-none", "whitespace-nowrap", "underline", "uppercase",
  // near-misses that share a first letter with a spacing prefix
  "place-items-center", "peer", "print:hidden", "prose", "min-h-screen",
  "max-w-md", "mix-blend-normal",
  // motion and opacity: real design families, but OUT of the F-E scope on
  // purpose. If someone adds them, this line fails and forces the decision to
  // be made in the open instead of drifting into the coverage number.
  "transition-all", "duration-300", "ease-in-out", "animate-spin", "opacity-50",
  // sizing under a variant must stay out even when the variant is stripped
  "md:w-1/2", "hover:z-20", "lg:flex",
];

for (const cls of MUST_NOT_MATCH) {
  test(`NOT tokenizable: ${cls}`, () => {
    assert.equal(isTokenizableUtility(cls), false, `${cls} must stay out of the design families`);
  });
}

/* ------------------------------------------------------------ mechanics --- */

test("prefixAlternation is longest-first, so rounded does not swallow rounded-t", () => {
  const rx = new RegExp(`^(?:${prefixAlternation()})-([a-z][a-z0-9-]*)$`);
  assert.equal("rounded-t-card".match(rx)[1], "card");
  assert.equal("rounded-card".match(rx)[1], "card");
  // the original defect, in its own shape: `p` must not consume `px-`
  assert.equal("px-card".match(rx)[1], "card");
  assert.equal("placeholder-card".match(rx)[1], "card");
});

test("stripVariants keeps an arbitrary value that contains a colon", () => {
  assert.equal(stripVariants("bg-[url(https://x.png)]"), "bg-[url(https://x.png)]");
  assert.equal(stripVariants("hover:md:px-2"), "px-2");
  assert.equal(stripVariants("[&_p]:mb-2"), "mb-2");
  assert.equal(stripVariants("group-hover/gear:light:text-x"), "text-x");
  // a stray quote from a template-literal ternary is NOT a variant; leaving it
  // visible is the point — a malformed class must not be silently repaired.
  assert.equal(stripVariants('"hover:bg-x'), '"hover:bg-x');
});

test("family classification is exhaustive and stable", () => {
  const families = new Set(Object.values(PREFIX_FAMILY));
  assert.deepEqual([...families].sort(), ["paint", "radius", "spacing", "typography"]);
  for (const [prefix, row] of Object.entries(UTILITY_FAMILIES)) {
    assert.equal(typeof row.property, "string", `${prefix} needs a property`);
    assert.equal(PREFIX_PROPERTY[prefix], row.property);
  }
});

/* ------------------------------------------- attribution of the delta ----- */

/**
 * The regex `lib/bundle-census.mjs` carried before F-E, pinned verbatim.
 *
 * `measure-coverage.mjs` moved 71 uses from "approvable exception" to
 * "mandatory work" after F-E, and a delta on a BLOCKING number has to be
 * attributable or it is just a number that changed. These two tests localise it:
 * the family set is unchanged, so every one of the 71 comes from the variant
 * chain, not from a family quietly entering the coverage denominator.
 */
const HISTORICAL = /^(?:hover:|focus:|active:|group-hover:|dark:|light:|disabled:|focus-visible:|sm:|md:|lg:|xl:|2xl:)*-?(?:bg|text|border|ring|shadow|fill|stroke|outline|divide|accent|caret|placeholder|p[xytrbles]?|m[xytrbles]?|gap|space|rounded|font|leading|tracking)(?:-|$)/;

test("no family entered or left the coverage denominator: identical without variants", () => {
  const corpus = [...MUST_MATCH, ...MUST_NOT_MATCH].filter((c) => !c.includes(":"));
  assert.equal(corpus.length > 60, true, "the corpus must be big enough to mean something");
  for (const cls of corpus) {
    assert.equal(
      isTokenizableUtility(cls), HISTORICAL.test(cls),
      `${cls} changed family membership — F-E was supposed to widen the VARIANT reach, not the family set`
    );
  }
});

test("the whole delta is the variant chain the old allowlist could not see", () => {
  const invisible = [
    "placeholder:text-sm", "peer-checked/public:bg-surface-panel",
    "group-disabled:text-content-disabled", "enabled:hover:bg-surface-hover",
    "after:mt-1", "[&_p]:mb-2", "light:placeholder:text-content-tertiary",
    "group-hover/gear:light:text-content-primary",
  ];
  for (const cls of invisible) {
    assert.equal(HISTORICAL.test(cls), false, `${cls} was supposed to be invisible before F-E`);
    assert.equal(isTokenizableUtility(cls), true, `${cls} must be visible after F-E`);
  }
});

/* -------------------------------------------------------------- the law --- */

/*
 * ATUALIZADO 2026-08-01 — E ESTE TESTE FEZ O TRABALHO DELE.
 *
 * A versao anterior afirmava "§4.3 must not silently gain <property>" para toda
 * familia nao-paint, e a ultima linha dizia: "if this ever becomes 0 the law was
 * amended: re-run F-E and re-measure". A lei FOI emendada — o dono decidiu que
 * espacamento e tipografia estao no escopo (F-E do plano mestre), e a §4.3 foi
 * de 7 para 16 propriedades. Os dois testes quebraram na hora, que e exatamente
 * o contrato: emenda de lei nao passa em silencio, passa por aqui.
 *
 * O invariante NAO muda de natureza, so de alcance: toda propriedade que uma
 * familia governada projeta TEM que existir na §4.3. O que mudou e quais
 * familias sao governadas — agora paint, radius, spacing e typography, ou seja,
 * todas as quatro. LAW GAP vazio deixou de ser sinal de defeito e passou a ser
 * o estado esperado; se ele voltar a crescer, e porque uma familia NOVA entrou
 * no motor sem a lei saber, e o teste reprova de novo.
 */
test("§4.3 tem slot para TODA propriedade que uma familia governada projeta", () => {
  const vocabulary = readVocabulary();
  const semSlot = [];
  for (const [prefix, row] of Object.entries(UTILITY_FAMILIES)) {
    const slot = lawSlotFor(prefix, vocabulary);
    if (slot === null) semSlot.push(`${prefix}- (${row.family}/${row.property})`);
    else assert.equal(slot, row.property, `§4.3 deve manter ${row.property} para ${prefix}-`);
  }
  assert.deepEqual(
    semSlot,
    [],
    "familia projeta propriedade que a lei nao nomeia — ou a lei perdeu um slot, " +
      "ou o motor ganhou uma familia sem emenda: " + semSlot.join(", ")
  );
});

test("o LAW GAP esta vazio, e volta a reprovar se uma familia nova entrar sem lei", () => {
  const vocabulary = readVocabulary();
  const gap = unlawedPrefixes(vocabulary);
  assert.deepEqual(
    gap,
    [],
    "prefixos sem slot na lei: " + gap.join(", ") +
      " — emende a §4.3 ou remova a familia do motor, nao deixe divergir"
  );
});

test("os tres dominios da §4.3 cobrem as quatro familias do motor", () => {
  const vocabulary = readVocabulary();
  const familias = new Set(Object.values(UTILITY_FAMILIES).map((r) => r.family));
  assert.deepEqual(
    [...familias].sort(),
    ["paint", "radius", "spacing", "typography"],
    "familia nova no motor exige decisao de lei — nao adicione sem emendar a §4.3"
  );
  assert.equal(vocabulary.properties.length, 16, "§4.3 tem 16 propriedades desde a emenda de 2026-08-01");
});
