import {
  parseCandidateSyntax,
  splitClassCandidates,
} from "./tailwind-normalizer.mjs";

export const DESIGN_AXES = Object.freeze([
  "color",
  "spacing",
  "sizing",
  "typography",
  "border",
  "radius",
  "elevation",
  "opacity",
  "motion",
  "iconography",
  "layout",
  "breakpoint",
  "z-index",
]);

export const OCCURRENCE_KINDS = Object.freeze([
  "utility-class",
  "css-declaration",
  "css-custom-property",
  "inline-style",
  "css-in-js",
  "svg-presentation",
  "chart-config",
  "canvas-draw",
  "typography",
  "font-asset",
  "motion-keyframe",
  "motion-transition",
  "image-asset",
  "icon-asset",
  "gradient",
  "illustration",
  "token-definition",
  "token-alias",
  "generated-class",
]);

/**
 * This is a closed registry: extraction startup fails when one of the schema's
 * 19 kinds has no executable adapter. Zero matches is valid evidence; a
 * missing or failed adapter is not.
 */
export const SOURCE_KIND_REGISTRY = Object.freeze([
  {
    occurrenceKind: "utility-class",
    disposition: "scan",
    adapter: "canonical-classname-miner+static-template-scanner",
    rationale:
      "Canonical TypeScript AST extraction plus static HTML/Vue/Svelte and @apply coverage.",
  },
  {
    occurrenceKind: "css-declaration",
    disposition: "scan",
    adapter: "authored-css-declaration-scanner",
    rationale: "Scans static declarations in authored CSS-family sources.",
  },
  {
    occurrenceKind: "css-custom-property",
    disposition: "scan",
    adapter: "css-custom-property-scanner",
    rationale: "Scans every authored --name:value declaration.",
  },
  {
    occurrenceKind: "inline-style",
    disposition: "scan",
    adapter: "jsx-inline-style-scanner",
    rationale: "Retains static and unresolved JSX style expressions.",
  },
  {
    occurrenceKind: "css-in-js",
    disposition: "scan",
    adapter: "css-in-js-scanner",
    rationale: "Scans styled/css template and object construction sites.",
  },
  {
    occurrenceKind: "svg-presentation",
    disposition: "scan",
    adapter: "svg-presentation-scanner",
    rationale: "Scans SVG presentation attributes in markup sources.",
  },
  {
    occurrenceKind: "chart-config",
    disposition: "scan",
    adapter: "chart-config-scanner",
    rationale: "Scans design-bearing keys in files with chart evidence.",
  },
  {
    occurrenceKind: "canvas-draw",
    disposition: "scan",
    adapter: "canvas-draw-scanner",
    rationale: "Scans 2D canvas design assignments and calls.",
  },
  {
    occurrenceKind: "typography",
    disposition: "scan",
    adapter: "typography-scanner",
    rationale: "Scans typography declarations and configuration keys.",
  },
  {
    occurrenceKind: "font-asset",
    disposition: "scan",
    adapter: "font-asset-scanner",
    rationale: "Hashes font assets under declared source roots.",
  },
  {
    occurrenceKind: "motion-keyframe",
    disposition: "scan",
    adapter: "keyframe-scanner",
    rationale: "Extracts complete balanced @keyframes blocks.",
  },
  {
    occurrenceKind: "motion-transition",
    disposition: "scan",
    adapter: "motion-transition-scanner",
    rationale: "Scans transition and animation declarations/configuration.",
  },
  {
    occurrenceKind: "image-asset",
    disposition: "scan",
    adapter: "image-asset-scanner",
    rationale: "Hashes raster and modern image assets in scope.",
  },
  {
    occurrenceKind: "icon-asset",
    disposition: "scan",
    adapter: "icon-asset-scanner",
    rationale: "Hashes SVG and conventional icon assets in scope.",
  },
  {
    occurrenceKind: "gradient",
    disposition: "scan",
    adapter: "gradient-scanner",
    rationale: "Scans CSS gradient functions in authored sources.",
  },
  {
    occurrenceKind: "illustration",
    disposition: "scan",
    adapter: "illustration-asset-scanner",
    rationale:
      "Hashes assets whose path provides illustration/artwork evidence.",
  },
  {
    occurrenceKind: "token-definition",
    disposition: "scan",
    adapter: "dtcg-and-css-token-definition-scanner",
    rationale: "Scans DTCG $value leaves and generated CSS definitions.",
  },
  {
    occurrenceKind: "token-alias",
    disposition: "scan",
    adapter: "dtcg-and-css-token-alias-scanner",
    rationale: "Scans DTCG aliases and CSS var() indirections.",
  },
  {
    occurrenceKind: "generated-class",
    disposition: "scan",
    adapter: "generated-css-class-scanner",
    rationale: "Scans selectors in explicitly generated source artifacts.",
  },
]);

const SOURCE_KIND_SET = new Set(OCCURRENCE_KINDS);
if (
  SOURCE_KIND_REGISTRY.length !== OCCURRENCE_KINDS.length ||
  new Set(SOURCE_KIND_REGISTRY.map((entry) => entry.occurrenceKind)).size !==
    OCCURRENCE_KINDS.length ||
  SOURCE_KIND_REGISTRY.some(
    (entry) =>
      !SOURCE_KIND_SET.has(entry.occurrenceKind) ||
      entry.disposition !== "scan" ||
      !entry.adapter
  )
) {
  throw new Error(
    "Source-kind registry does not cover the closed 19-kind universe"
  );
}

const PROPERTY_RULES = [
  [
    /^(?:color|background(?:-color)?|caret-color|accent-color|column-rule-color|text-decoration-color)$/,
    "color",
  ],
  [
    /^(?:margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left|scroll-margin|scroll-padding)(?:-.+)?$/,
    "spacing",
  ],
  [
    /^(?:width|height|min-width|max-width|min-height|max-height|inline-size|block-size|flex-basis|aspect-ratio)$/,
    "sizing",
  ],
  [
    /^(?:font|font-family|font-size|font-style|font-weight|line-height|letter-spacing|text-align|text-transform|text-decoration|text-decoration-.+|text-wrap|white-space|word-break|text-overflow|src)$/,
    "typography",
  ],
  [/^(?:border-radius|border-(?:start|end|top|bottom).*-radius)$/, "radius"],
  [
    /^(?:border(?:-.+)?|outline(?:-.+)?|box-sizing|stroke-width|line-cap|line-join)$/,
    "border",
  ],
  [/^(?:box-shadow|filter|-webkit-filter|backdrop-filter)$/, "elevation"],
  [/^(?:opacity|global-alpha)$/, "opacity"],
  [
    /^(?:animation|animation-.+|transition|transition-.+|transform|transform-.+|will-change)$/,
    "motion",
  ],
  [/^(?:fill|stroke|marker-.+)$/, "iconography"],
  [
    /^(?:display|position|float|clear|overflow|overflow-.+|overscroll-.+|scroll-behavior|-webkit-overflow-scrolling|-ms-overflow-style|flex|flex-.+|grid|grid-.+|align-.+|justify-.+|place-.+|columns|object-.+|cursor|pointer-events|visibility|appearance|-webkit-appearance|list-style|resize|clip|clip-path|mask-.+|-webkit-mask-.+)$/,
    "layout",
  ],
  [/^z-index$/, "z-index"],
];

export function axisForProperty(property) {
  const normalized = String(property ?? "")
    .trim()
    .replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)
    .toLowerCase();
  if (!normalized) return "unmapped";
  if (/^--tw-(?:translate|rotate|skew|scale)/.test(normalized)) return "motion";
  if (/^--tw-(?:pan|pinch|scroll-snap)/.test(normalized)) return "layout";
  if (/^--tw-gradient/.test(normalized)) return "color";
  if (/^--tw-(?:ordinal|slashed-zero|numeric)/.test(normalized)) {
    return "typography";
  }
  if (
    /^--tw-(?:brightness|contrast|grayscale|hue-rotate|invert|saturate|sepia|backdrop-)/.test(
      normalized
    )
  ) {
    return "elevation";
  }
  if (/(?:^|[._-])(?:breakpoint|screen)(?:[._-]|$)/.test(normalized)) {
    return "breakpoint";
  }
  if (
    /(?:^|[._-])z-?index(?:[._-]|$)/.test(normalized) ||
    /^z-index(?:[._-]|$)/.test(normalized)
  ) {
    return "z-index";
  }
  if (/^--color-/.test(normalized) || /(?:^|-)color$/.test(normalized)) {
    return "color";
  }
  if (
    normalized === "border-radius" ||
    /(?:^|[._-])radius(?:[._-]|$)/.test(normalized)
  ) {
    return "radius";
  }
  if (
    /(?:^|[._-])(?:border|divider|connector|ring)(?:[._-]|$)/.test(normalized)
  ) {
    return "border";
  }
  if (
    /^--text-(?:label|body|heading|title|display|micro|caption|hero)(?:-|$)/.test(
      normalized
    )
  ) {
    return "typography";
  }
  if (
    /^--theme-.+(?:bg|text|icon|hover|selected|active|inactive|loader|placeholder)(?:-|$)/.test(
      normalized
    ) ||
    /^--(?:primary|success|destructive|info|premium|warning)(?:-rgb)?$/.test(
      normalized
    ) ||
    /^--rti-(?:bg|main|tag|tag-remove)$/.test(normalized) ||
    /(?:^|[._-])c-[a-f0-9]+(?:[._-]|$)/.test(normalized)
  ) {
    return "color";
  }
  if (
    /(?:^|[._-])(?:color|background|foreground|surface|content|fill|stroke)(?:[._-]|$)/.test(
      normalized
    )
  ) {
    return "color";
  }
  if (
    /(?:^|[._-])(?:space|spacing|gap|padding|margin|inset)(?:[._-]|$)/.test(
      normalized
    )
  ) {
    return "spacing";
  }
  if (
    /(?:^|[._-])(?:font|typography|leading|tracking)(?:[._-]|$)/.test(
      normalized
    )
  ) {
    return "typography";
  }
  if (/(?:^|[._-])(?:size|width|height)(?:[._-]|$)/.test(normalized)) {
    return "sizing";
  }
  if (/(?:^|[._-])(?:min|max)-[wh](?:[._-]|$)/.test(normalized)) {
    return "sizing";
  }
  if (/(?:^|[._-])radius(?:[._-]|$)/.test(normalized)) return "radius";
  if (/(?:^|[._-])(?:blur|backdrop-blur)(?:[._-]|$)/.test(normalized)) {
    return "elevation";
  }
  if (/(?:^|[._-])(?:shadow|elevation)(?:[._-]|$)/.test(normalized)) {
    return "elevation";
  }
  if (/(?:^|[._-])opacity(?:[._-]|$)/.test(normalized)) return "opacity";
  if (
    /(?:^|[._-])(?:motion|duration|ease|transition|animation)(?:[._-]|$)/.test(
      normalized
    )
  ) {
    return "motion";
  }
  if (normalized.startsWith("--")) {
    if (/color|background|foreground|surface|content|border/.test(normalized)) {
      return "color";
    }
    if (/space|gap|padding|margin|inset/.test(normalized)) return "spacing";
    if (/size|width|height/.test(normalized)) return "sizing";
    if (/font|line-height|tracking|leading/.test(normalized))
      return "typography";
    if (/radius/.test(normalized)) return "radius";
    if (/shadow|elevation/.test(normalized)) return "elevation";
    if (/opacity/.test(normalized)) return "opacity";
    if (/motion|duration|ease|transition|animation/.test(normalized))
      return "motion";
    if (/z-index|z-/.test(normalized)) return "z-index";
    if (/modal-scrim/.test(normalized)) return "color";
    if (/modal-max-h/.test(normalized)) return "sizing";
    if (/modal-enter/.test(normalized)) return "motion";
    if (/row-(?:h|icon)/.test(normalized)) return "sizing";
    if (
      /row-(?:px|indent|ctl)/.test(normalized) ||
      /^--rti-s$/.test(normalized)
    ) {
      return "spacing";
    }
    return "unmapped";
  }
  return (
    PROPERTY_RULES.find(([pattern]) => pattern.test(normalized))?.[1] ??
    "unmapped"
  );
}

const BREAKPOINT_VARIANT =
  /^(?:sm|md|lg|xl|2xl|max-.+|min-.+|@.+|\[@media.+\])$/;

export function axesForCandidate(rawCandidate) {
  const parsed = parseCandidateSyntax(rawCandidate);
  if (parsed.status === "invalid") return [];
  const axes = new Set();
  if (parsed.variants.some((variant) => BREAKPOINT_VARIANT.test(variant))) {
    axes.add("breakpoint");
  }
  const root = parsed.utilityRoot ?? "";
  const value = parsed.value ?? "";
  if (root === "arbitrary-property") {
    axes.add(axisForProperty(value.split(":", 1)[0]));
  } else if (
    /^(?:p[trblesxy]?|m[trblesxy]?|gap(?:-[xy])?|space-[xy]|inset(?:-[xy])?|top|right|bottom|left)$/.test(
      root
    )
  ) {
    axes.add("spacing");
  } else if (/^(?:w|h|min-w|max-w|min-h|max-h|size|basis|aspect)$/.test(root)) {
    axes.add("sizing");
  } else if (
    root === "text" &&
    /^(?:xs|sm|base|lg|xl|[2-9]xl|\[.+\])(?:\/.+)?$/.test(value)
  ) {
    axes.add("typography");
  } else if (
    root === "text" &&
    /^(?:left|center|right|justify|start|end|ellipsis|clip|wrap|nowrap|balance|pretty)$/.test(
      value
    )
  ) {
    axes.add("typography");
  } else if (
    /^(?:font|leading|tracking|whitespace|break|wrap|truncate|line-clamp|underline|overline)$/.test(
      root
    )
  ) {
    axes.add("typography");
  } else if (/^(?:rounded)/.test(root)) {
    axes.add("radius");
  } else if (/^(?:border|divide|outline|ring)/.test(root)) {
    axes.add("border");
    if (
      /(?:transparent|current|inherit|black|white|[a-z]+-\d+|\[.+\])/.test(
        value
      )
    ) {
      axes.add("color");
    }
  } else if (/^(?:shadow|drop-shadow)/.test(root)) {
    axes.add("elevation");
  } else if (/opacity/.test(root)) {
    axes.add("opacity");
  } else if (
    /^(?:animate|transition|duration|delay|ease|transform|translate|rotate|scale|skew|origin)/.test(
      root
    )
  ) {
    axes.add("motion");
  } else if (/^(?:fill|stroke)$/.test(root)) {
    axes.add("iconography");
    axes.add("color");
  } else if (
    /^(?:bg|text|from|via|to|placeholder|accent|caret|decoration)$/.test(root)
  ) {
    axes.add("color");
  } else if (root === "z") {
    axes.add("z-index");
  } else if (root === "scheme") {
    axes.add("color");
  } else if (
    /^(?:flex|grid|block|inline|hidden|table|contents|absolute|relative|fixed|sticky|static|sr-only|overflow|object|order|col|row|place|items|justify|self|grow|shrink|cursor|pointer|list)/.test(
      root
    )
  ) {
    axes.add("layout");
  }
  return [...axes].filter((axis) => axis !== "unmapped").sort();
}

export function axesForClassName(rawClassName) {
  const { tokens } = splitClassCandidates(rawClassName);
  return [...new Set(tokens.flatMap(axesForCandidate))].sort();
}

export function primaryAxisFor({
  occurrenceKind,
  property = null,
  rawValue = "",
}) {
  if (
    occurrenceKind === "utility-class" ||
    occurrenceKind === "generated-class"
  ) {
    for (const candidate of splitClassCandidates(rawValue).tokens) {
      const axes = axesForCandidate(candidate);
      const propertyAxis = axes.find((axis) => axis !== "breakpoint");
      if (propertyAxis) return propertyAxis;
      if (axes[0]) return axes[0];
    }
    return "unmapped";
  }
  if (occurrenceKind === "font-asset" || occurrenceKind === "typography") {
    return "typography";
  }
  if (
    occurrenceKind === "motion-keyframe" ||
    occurrenceKind === "motion-transition"
  ) {
    return "motion";
  }
  if (
    occurrenceKind === "icon-asset" ||
    occurrenceKind === "svg-presentation"
  ) {
    return "iconography";
  }
  if (
    occurrenceKind === "image-asset" ||
    occurrenceKind === "illustration" ||
    occurrenceKind === "gradient"
  ) {
    return "color";
  }
  if (occurrenceKind === "inline-style" || occurrenceKind === "css-in-js") {
    const firstProperty =
      String(rawValue).match(
        /(?:^|[{;,]\s*)(--[\w-]+|[A-Za-z][\w-]*)\s*:/
      )?.[1] ?? property;
    return axisForProperty(firstProperty);
  }
  if (
    occurrenceKind === "css-custom-property" ||
    occurrenceKind === "token-definition" ||
    occurrenceKind === "token-alias"
  ) {
    const propertyAxis = axisForProperty(property);
    if (propertyAxis !== "unmapped") return propertyAxis;
    const raw = String(rawValue).toLowerCase();
    if (
      /(?:^|["'{(\s])(?:#(?:[a-f0-9]{3,8})\b|(?:rgb|hsl|hwb|lab|lch|oklab|oklch|color)\(|transparent\b)|var\(\s*--(?:color|theme)-/.test(
        raw
      ) ||
      /\{[^{}]*(?:color|\.c-[a-f0-9]+)[^{}]*\}/.test(raw)
    ) {
      return "color";
    }
    if (/(?:cubic-bezier|steps)\(|\b\d+(?:\.\d+)?m?s\b/.test(raw)) {
      return "motion";
    }
  }
  return axisForProperty(property);
}

export function makeAxisDiscovery({
  header,
  discoveryId,
  occurrences,
  configuredAxes = DESIGN_AXES,
  scannerResults,
  upstreamExhaustive = true,
}) {
  const discoveredAxisSet = new Set();
  const byAxis = Object.fromEntries(
    [...configuredAxes, "unmapped"].map((axis) => [axis, 0])
  );
  const byOccurrenceKind = Object.fromEntries(
    OCCURRENCE_KINDS.map((kind) => [kind, 0])
  );

  for (const occurrence of occurrences) {
    byOccurrenceKind[occurrence.occurrenceKind] =
      (byOccurrenceKind[occurrence.occurrenceKind] ?? 0) + 1;
    const inferredAxes =
      occurrence.occurrenceKind === "utility-class" ||
      occurrence.occurrenceKind === "generated-class"
        ? axesForClassName(occurrence.rawValue)
        : [occurrence.axis].filter((axis) => axis !== "unmapped");
    const axes =
      inferredAxes.length === 0 && occurrence.axis !== "unmapped"
        ? [occurrence.axis]
        : inferredAxes;
    if (occurrence.axis === "unmapped") byAxis.unmapped += 1;
    for (const axis of axes) {
      discoveredAxisSet.add(axis);
      byAxis[axis] = (byAxis[axis] ?? 0) + 1;
    }
  }

  const discoveredOccurrenceKinds = OCCURRENCE_KINDS.filter(
    (kind) => byOccurrenceKind[kind] > 0
  );
  if (discoveredOccurrenceKinds.length === 0) {
    throw new Error(
      "Axis discovery requires at least one observed occurrence kind"
    );
  }
  const resultByKind = new Map(
    scannerResults.map((result) => [result.occurrenceKind, result])
  );
  const coveredOccurrenceKinds = OCCURRENCE_KINDS.filter((kind) => {
    const result = resultByKind.get(kind);
    return (
      result?.status === "executed" ||
      result?.status === "approved-out-of-scope"
    );
  });
  const uncoveredOccurrenceKinds = OCCURRENCE_KINDS.filter(
    (kind) => !coveredOccurrenceKinds.includes(kind)
  );
  const discoveredAxes = [...discoveredAxisSet].sort();
  const reconciledAxes = discoveredAxes.filter((axis) =>
    configuredAxes.includes(axis)
  );
  const uncoveredAxes = discoveredAxes.filter(
    (axis) => !configuredAxes.includes(axis)
  );
  if (byAxis.unmapped > 0) uncoveredAxes.push("unmapped");

  return {
    ...header,
    artifactType: "axis-discovery",
    discoveryId,
    configuredAxes: [...configuredAxes],
    discoveredAxes: discoveredAxes.length > 0 ? discoveredAxes : ["unmapped"],
    reconciledAxes,
    uncoveredAxes: [...new Set(uncoveredAxes)].sort(),
    registeredOccurrenceKinds: [...OCCURRENCE_KINDS],
    discoveredOccurrenceKinds,
    coveredOccurrenceKinds,
    uncoveredOccurrenceKinds,
    occurrenceCounts: {
      byAxis,
      byOccurrenceKind,
    },
    exhaustive:
      upstreamExhaustive &&
      uncoveredOccurrenceKinds.length === 0 &&
      uncoveredAxes.length === 0,
  };
}
