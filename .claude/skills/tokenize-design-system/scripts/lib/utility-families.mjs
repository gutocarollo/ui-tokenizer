/**
 * utility-families.mjs — THE SINGLE TABLE OF UTILITY PREFIX -> DESIGN FAMILY.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The same knowledge — "which Tailwind prefixes carry a design decision" — was
 * written twice, by hand, in two places that never agreed:
 *
 *   score-naming.mjs   PREFIX_PROPERTY, 12 prefixes, ALL of them paint.
 *   measure-coverage.mjs  TOKENIZAVEL, a regex literal with 22 families.
 *
 * The second copy is where the plan's blocking number (`tokenizavel fora de
 * entidade`) comes from, and it already produced one measured false green: the
 * first version wrote `p` and `m` raw, and `p(?:-|$)` matches `p-2.5` but NOT
 * `px- py- pt- pb- pl- pr- ps- pe-` nor `mt- mb- ml- mr- mx- my- ms- me-`.
 * Eleven of fifteen spacing variants fell out, and because spacing is a
 * BLOCKING family, 1.294 uses of mandatory work were filed as "approvable
 * exception". The bug was in the copy the oracle did not read.
 *
 * One table, imported by both. A family added here moves the coverage number
 * and the scoring reach together, or it moves neither.
 *
 * WHAT THIS FILE IS NOT
 * ---------------------
 * It is NOT the law. `reference/law.md` §4.3 is a CLOSED vocabulary of seven
 * PAINT properties — `background-color`, `foreground-color`, `border-color`,
 * `outline-color`, `box-shadow`, `fill`, `stroke`. Radius, spacing and
 * typography have NO SLOT there. This table therefore carries two different
 * kinds of row, and `lawSlotFor()` is the only thing allowed to decide which is
 * which. Projecting `padding` into a slot that does not exist would emit ids
 * like `card.padding` that `parseName` can never parse back, and would score
 * every spacing use as a silent 0/60 H-021 — a false red on top of a false
 * green. Rows without a slot FAIL CLOSED at the scoring boundary instead.
 */

/**
 * prefix -> the CSS property the prefix SETS, plus the design family.
 *
 * `property` for paint rows is the §4.3 projection, NOT the literal CSS the
 * compiler emits: `ring-` emits `--tw-ring-color` and `shadow-` emits
 * `--tw-shadow-color`, neither of which is a §4.3 term and neither of which may
 * appear in a token id. For non-paint rows `property` is the literal CSS
 * property, because there is no vocabulary to project onto yet.
 */
export const UTILITY_FAMILIES = {
  /* ---- paint · §4.3 HAS a slot for every property below ------------------ */
  bg: { property: "background-color", family: "paint" },
  text: { property: "foreground-color", family: "paint", valueDependent: "font-size" },
  border: { property: "border-color", family: "paint" },
  ring: { property: "outline-color", family: "paint" },
  divide: { property: "border-color", family: "paint" },
  outline: { property: "outline-color", family: "paint" },
  shadow: { property: "box-shadow", family: "paint" },
  fill: { property: "fill", family: "paint" },
  stroke: { property: "stroke", family: "paint" },
  placeholder: { property: "foreground-color", family: "paint" },
  accent: { property: "foreground-color", family: "paint" },
  caret: { property: "foreground-color", family: "paint" },

  /* ---- radius · NO §4.3 SLOT --------------------------------------------- */
  /* Corner is a SIDE axis, not a different property — the same way `border-`
   * maps to `border-color` regardless of which side it paints. */
  rounded: { property: "border-radius", family: "radius" },
  "rounded-t": { property: "border-radius", family: "radius" },
  "rounded-r": { property: "border-radius", family: "radius" },
  "rounded-b": { property: "border-radius", family: "radius" },
  "rounded-l": { property: "border-radius", family: "radius" },
  "rounded-s": { property: "border-radius", family: "radius" },
  "rounded-e": { property: "border-radius", family: "radius" },
  "rounded-tl": { property: "border-radius", family: "radius" },
  "rounded-tr": { property: "border-radius", family: "radius" },
  "rounded-br": { property: "border-radius", family: "radius" },
  "rounded-bl": { property: "border-radius", family: "radius" },
  "rounded-ss": { property: "border-radius", family: "radius" },
  "rounded-se": { property: "border-radius", family: "radius" },
  "rounded-ee": { property: "border-radius", family: "radius" },
  "rounded-es": { property: "border-radius", family: "radius" },

  /* ---- spacing · NO §4.3 SLOT -------------------------------------------- */
  p: { property: "padding", family: "spacing" },
  px: { property: "padding", family: "spacing" },
  py: { property: "padding", family: "spacing" },
  pt: { property: "padding", family: "spacing" },
  pr: { property: "padding", family: "spacing" },
  pb: { property: "padding", family: "spacing" },
  pl: { property: "padding", family: "spacing" },
  ps: { property: "padding", family: "spacing" },
  pe: { property: "padding", family: "spacing" },
  m: { property: "margin", family: "spacing" },
  mx: { property: "margin", family: "spacing" },
  my: { property: "margin", family: "spacing" },
  mt: { property: "margin", family: "spacing" },
  mr: { property: "margin", family: "spacing" },
  mb: { property: "margin", family: "spacing" },
  ml: { property: "margin", family: "spacing" },
  ms: { property: "margin", family: "spacing" },
  me: { property: "margin", family: "spacing" },
  gap: { property: "gap", family: "spacing" },
  "gap-x": { property: "column-gap", family: "spacing" },
  "gap-y": { property: "row-gap", family: "spacing" },
  /* `space-x-4` does not emit `gap`: it emits margin on the children. */
  "space-x": { property: "margin", family: "spacing" },
  "space-y": { property: "margin", family: "spacing" },

  /* ---- typography · NO §4.3 SLOT ----------------------------------------- */
  /* `font-` is genuinely two properties under one prefix: `font-bold` is
   * font-weight, `font-mono` is font-family. Which one is decided by the VALUE,
   * which only the compiler knows (axis B). Declared here, not guessed. */
  font: { property: "font-weight", family: "typography", valueDependent: "font-family" },
  leading: { property: "line-height", family: "typography" },
  tracking: { property: "letter-spacing", family: "typography" },
};

/**
 * Back-compatible projection consumed by score-naming, derive-tokens,
 * context-clusters, find-owner and cluster-leftovers: prefix -> property.
 */
export const PREFIX_PROPERTY = Object.fromEntries(
  Object.entries(UTILITY_FAMILIES).map(([prefix, row]) => [prefix, row.property])
);

/** prefix -> "paint" | "radius" | "spacing" | "typography". */
export const PREFIX_FAMILY = Object.fromEntries(
  Object.entries(UTILITY_FAMILIES).map(([prefix, row]) => [prefix, row.family])
);

/**
 * The §4.3 property this prefix projects onto, or null when the law has no slot
 * for it. `vocabulary` is the object returned by `readVocabulary()`, so the law
 * file stays the single authority and this module never restates §4.3.
 */
export function lawSlotFor(prefix, vocabulary) {
  const property = PREFIX_PROPERTY[prefix];
  if (!property) return null;
  return vocabulary.properties.includes(property) ? property : null;
}

/** Every prefix whose property the law cannot express today. */
export function unlawedPrefixes(vocabulary) {
  return Object.keys(UTILITY_FAMILIES).filter((prefix) => !lawSlotFor(prefix, vocabulary));
}

const escapeForRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Alternation of every prefix, LONGEST FIRST.
 *
 * The order is load-bearing, not cosmetic. JavaScript alternation is
 * first-match-wins, so an unsorted `rounded|rounded-t` consumes `rounded` out of
 * `rounded-t-card` and hands `t-card` to the token capture — the same shape of
 * bug as `p` swallowing `px`. Every call site builds its regex from here so the
 * ordering cannot be forgotten in one of five copies.
 */
export function prefixAlternation(prefixes = Object.keys(UTILITY_FAMILIES)) {
  return [...prefixes]
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .map(escapeForRegex)
    .join("|");
}

/**
 * Strips a Tailwind variant chain (`hover:`, `md:`, `group-hover/gear:`,
 * `[&_p]:`) from the front of a class, leaving the utility.
 *
 * Measured on the target: the previous hard-coded allowlist
 * (`hover|focus|active|group-hover|dark|light|disabled|focus-visible|sm|md|lg|xl|2xl`)
 * missed 389 uses whose base IS a tokenizable family — 339 of them
 * `placeholder:`, plus `peer-checked/public:`, `group-disabled:`, `enabled:`,
 * `after:`, `[&_p]:`. Same defect class as the `p`/`px` one: a family that is
 * blocking work filed as approvable exception because the matcher could not see
 * it.
 *
 * The variant name deliberately excludes `[`, `(` and `"`, so an arbitrary
 * value that legitimately contains a colon — `bg-[url(https://x.png)]` — is NOT
 * eaten. Measured on the target: 0 false negatives introduced.
 */
export function stripVariants(className) {
  const VARIANT = /^(?:\[[^\]]*\]|[A-Za-z0-9_@&./-]+):/;
  let rest = className;
  for (let guard = 0; guard < 16; guard++) {
    const match = rest.match(VARIANT);
    if (!match) break;
    rest = rest.slice(match[0].length);
  }
  return rest;
}

/** The variant chain, as a regex fragment. Same shape as `stripVariants`. */
const VARIANT_CHAIN = "(?:(?:\\[[^\\]]*\\]|[A-Za-z0-9_@&./-]+):)*";

/**
 * Does this class belong to a family a design system NAMES?
 *
 * `flex`, `absolute`, `w-`, `h-`, `z-` are composition and sizing, not design
 * decisions, and stay out on purpose. The leading `-?` keeps negative spacing
 * (`-mt-4`, `md:-mx-2`) inside the family it belongs to.
 *
 * Exported as a RegExp because `lib/bundle-census.mjs` publishes it under its
 * historical name `TOKENIZAVEL` and its consumers call `.test()`. There is only
 * ONE implementation: `isTokenizableUtility` delegates here rather than
 * re-deriving the answer from `stripVariants`, so the two can never drift.
 */
export const TOKENIZABLE_UTILITY_RX = new RegExp(
  `^${VARIANT_CHAIN}-?(?:${prefixAlternation()})(?:-|$)`
);

export function isTokenizableUtility(className) {
  return TOKENIZABLE_UTILITY_RX.test(className);
}

/** The utility prefix of a class, or null when it is not a design family. */
export function familyPrefixOf(className) {
  const base = stripVariants(className).replace(/^-/, "");
  for (const prefix of [...Object.keys(UTILITY_FAMILIES)].sort((a, b) => b.length - a.length)) {
    if (base === prefix || base.startsWith(prefix + "-")) return prefix;
  }
  return null;
}
