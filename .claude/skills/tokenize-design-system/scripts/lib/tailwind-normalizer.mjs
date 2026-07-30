import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const NORMALIZER_VERSION = "tailwind-normalizer.v2";

const OPEN_TO_CLOSE = new Map([
  ["[", "]"],
  ["(", ")"],
  ["{", "}"],
]);
const CLOSE_TO_OPEN = new Map(
  [...OPEN_TO_CLOSE.entries()].map(([open, close]) => [close, open])
);

const EXACT_UTILITY_ROOTS = new Set([
  "absolute",
  "antialiased",
  "block",
  "contents",
  "fixed",
  "flex",
  "grid",
  "hidden",
  "inline",
  "inline-block",
  "inline-flex",
  "inline-grid",
  "isolate",
  "italic",
  "not-italic",
  "relative",
  "sr-only",
  "static",
  "sticky",
  "table",
  "truncate",
]);

const COMPOUND_UTILITY_ROOTS = [
  "backdrop-blur",
  "backdrop-brightness",
  "backdrop-contrast",
  "backdrop-grayscale",
  "backdrop-hue-rotate",
  "backdrop-invert",
  "backdrop-opacity",
  "backdrop-saturate",
  "backdrop-sepia",
  "background",
  "border-spacing-x",
  "border-spacing-y",
  "border-spacing",
  "col-span",
  "col-start",
  "col-end",
  "duration",
  "drop-shadow",
  "ease",
  "font",
  "from",
  "gap-x",
  "gap-y",
  "gap",
  "grid-cols",
  "grid-rows",
  "h",
  "inset-x",
  "inset-y",
  "inset",
  "leading",
  "line-clamp",
  "m",
  "max-h",
  "max-w",
  "mb",
  "me",
  "min-h",
  "min-w",
  "ml",
  "mr",
  "ms",
  "mt",
  "mx",
  "my",
  "object",
  "opacity",
  "order",
  "outline",
  "overflow-x",
  "overflow-y",
  "overflow",
  "p",
  "pb",
  "pe",
  "pl",
  "pr",
  "ps",
  "pt",
  "px",
  "py",
  "ring-offset",
  "ring",
  "rotate",
  "rounded-b",
  "rounded-bl",
  "rounded-br",
  "rounded-e",
  "rounded-ee",
  "rounded-es",
  "rounded-l",
  "rounded-r",
  "rounded-s",
  "rounded-se",
  "rounded-ss",
  "rounded-t",
  "rounded-tl",
  "rounded-tr",
  "rounded",
  "row-span",
  "row-start",
  "row-end",
  "scale-x",
  "scale-y",
  "scale",
  "shadow",
  "space-x",
  "space-y",
  "stroke",
  "text",
  "tracking",
  "transition",
  "translate-x",
  "translate-y",
  "via",
  "w",
  "z",
  "bg",
  "border",
  "bottom",
  "brightness",
  "content",
  "cursor",
  "delay",
  "divide",
  "fill",
  "flex",
  "grow",
  "left",
  "right",
  "shrink",
  "top",
  "to",
  "animate",
].sort((a, b) => b.length - a.length);

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function scanTopLevel(input, delimiter) {
  const parts = [];
  const stack = [];
  let quote = null;
  let escaped = false;
  let start = 0;
  let invalidReason = null;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (OPEN_TO_CLOSE.has(character)) {
      stack.push(character);
      continue;
    }
    if (CLOSE_TO_OPEN.has(character)) {
      const expected = CLOSE_TO_OPEN.get(character);
      if (stack.pop() !== expected) {
        invalidReason = `unmatched closing delimiter ${character}`;
        break;
      }
      continue;
    }
    const isDelimiter =
      stack.length === 0 &&
      (delimiter instanceof RegExp
        ? delimiter.test(character)
        : character === delimiter);
    if (isDelimiter) {
      parts.push(input.slice(start, index));
      start = index + 1;
    }
  }

  if (!invalidReason && quote) invalidReason = `unclosed quote ${quote}`;
  if (!invalidReason && stack.length > 0) {
    invalidReason = `unclosed delimiter ${stack.at(-1)}`;
  }
  if (!invalidReason) parts.push(input.slice(start));
  return { parts, invalidReason };
}

/**
 * Split a class expression without cutting whitespace inside arbitrary values.
 * The source string is not rewritten; returned candidates retain source order.
 */
export function splitClassCandidates(rawClassName) {
  const scanned = scanTopLevel(String(rawClassName ?? ""), /\s/);
  return {
    tokens: scanned.invalidReason
      ? [String(rawClassName ?? "").trim()].filter(Boolean)
      : scanned.parts.map((part) => part.trim()).filter(Boolean),
    invalidReason: scanned.invalidReason,
  };
}

function splitModifier(base) {
  const scanned = scanTopLevel(base, "/");
  if (scanned.invalidReason) return { base, modifier: null };
  if (scanned.parts.length <= 1) return { base, modifier: null };
  return {
    base: scanned.parts.shift(),
    modifier: scanned.parts.join("/"),
  };
}

function splitUtility(base) {
  if (base.startsWith("[") && base.endsWith("]")) {
    return {
      utilityRoot: "arbitrary-property",
      value: base.slice(1, -1),
    };
  }
  if (EXACT_UTILITY_ROOTS.has(base)) {
    return { utilityRoot: base, value: null };
  }
  const root = COMPOUND_UTILITY_ROOTS.find(
    (candidate) => base === candidate || base.startsWith(`${candidate}-`)
  );
  if (root) {
    return {
      utilityRoot: root,
      value: base === root ? null : base.slice(root.length + 1),
    };
  }
  const separator = base.indexOf("-");
  if (separator === -1) return { utilityRoot: base || null, value: null };
  return {
    utilityRoot: base.slice(0, separator) || null,
    value: base.slice(separator + 1) || null,
  };
}

/**
 * Syntax-only Tailwind candidate parser. The target Tailwind design system is
 * still the validity oracle; this parser exists to retain structure even when
 * the candidate is plain CSS or the target compiler is unavailable.
 */
export function parseCandidateSyntax(rawCandidate) {
  const raw = String(rawCandidate ?? "");
  const whitespaceScan = scanTopLevel(raw, /\s/);
  if (
    !raw ||
    whitespaceScan.invalidReason ||
    whitespaceScan.parts.filter(Boolean).length !== 1
  ) {
    return {
      raw,
      variants: [],
      important: false,
      negative: false,
      utilityRoot: null,
      value: null,
      modifier: null,
      canonicalCandidate: null,
      status: "invalid",
      invalidReason: !raw
        ? "empty candidate"
        : (whitespaceScan.invalidReason ?? "top-level whitespace in candidate"),
    };
  }

  const variantScan = scanTopLevel(raw, ":");
  if (variantScan.invalidReason || variantScan.parts.some((part) => !part)) {
    return {
      raw,
      variants: [],
      important: false,
      negative: false,
      utilityRoot: null,
      value: null,
      modifier: null,
      canonicalCandidate: null,
      status: "invalid",
      invalidReason: variantScan.invalidReason ?? "empty variant segment",
    };
  }

  const pieces = [...variantScan.parts];
  let base = pieces.pop();
  const variants = pieces;
  let important = false;
  if (base.startsWith("!")) {
    important = true;
    base = base.slice(1);
  }
  if (base.endsWith("!")) {
    important = true;
    base = base.slice(0, -1);
  }
  let negative = false;
  if (base.startsWith("-")) {
    negative = true;
    base = base.slice(1);
  }
  if (!base) {
    return {
      raw,
      variants,
      important,
      negative,
      utilityRoot: null,
      value: null,
      modifier: null,
      canonicalCandidate: null,
      status: "invalid",
      invalidReason: "candidate has no utility",
    };
  }

  const { base: unmodifiedBase, modifier } = splitModifier(base);
  const { utilityRoot, value } = splitUtility(unmodifiedBase);
  const canonicalBase = `${negative ? "-" : ""}${unmodifiedBase}${
    modifier ? `/${modifier}` : ""
  }${important ? "!" : ""}`;
  return {
    raw,
    variants,
    important,
    negative,
    utilityRoot,
    value,
    modifier,
    canonicalCandidate: `${variants.map((variant) => `${variant}:`).join("")}${canonicalBase}`,
    status: "valid",
    invalidReason: null,
  };
}

function splitCssValues(value) {
  return splitClassCandidates(String(value ?? "")).tokens;
}

function physicalEdges(property, values) {
  const [top, right = top, bottom = top, left = right] =
    values.length === 3 ? [values[0], values[1], values[2], values[1]] : values;
  return [
    [`${property}-top`, top],
    [`${property}-right`, right],
    [`${property}-bottom`, bottom],
    [`${property}-left`, left],
  ];
}

/**
 * Expand only CSS shorthands whose effective edge semantics are deterministic.
 *
 * A one-value all-edge shorthand is represented on logical axes so `p-2`
 * and `py-2 px-2` can be compiler-equivalent in every writing mode. Multi-
 * value physical shorthands remain physical. Physical `pl-*`/`pr-*` therefore
 * never collapse into logical `px-*` without computed-style evidence.
 */
function expandedDeclaration(property, value) {
  const normalizedProperty = property.trim().toLowerCase();
  const values = splitCssValues(value);
  const allEdge = /^(padding|margin|inset)$/.exec(normalizedProperty);
  if (allEdge && values.length === 1) {
    return [
      [`${allEdge[1]}-block-start`, values[0]],
      [`${allEdge[1]}-block-end`, values[0]],
      [`${allEdge[1]}-inline-start`, values[0]],
      [`${allEdge[1]}-inline-end`, values[0]],
    ];
  }
  if (allEdge && values.length >= 2 && values.length <= 4) {
    return physicalEdges(allEdge[1], values);
  }
  const logical = /^(padding|margin|inset)-(block|inline)$/.exec(
    normalizedProperty
  );
  if (logical && values.length >= 1 && values.length <= 2) {
    const [start, end = start] = values;
    return [
      [`${logical[1]}-${logical[2]}-start`, start],
      [`${logical[1]}-${logical[2]}-end`, end],
    ];
  }
  if (
    normalizedProperty === "gap" &&
    values.length >= 1 &&
    values.length <= 2
  ) {
    return [
      ["row-gap", values[0]],
      ["column-gap", values[1] ?? values[0]],
    ];
  }
  if (
    normalizedProperty === "overflow" &&
    values.length >= 1 &&
    values.length <= 2
  ) {
    return [
      ["overflow-x", values[0]],
      ["overflow-y", values[1] ?? values[0]],
    ];
  }
  return [[normalizedProperty, value.trim()]];
}

function declarationsFromCompiledCss(css, variantSignature) {
  const declarations = [];
  const blockStack = [];
  for (const line of String(css ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.endsWith("{")) {
      blockStack.push(trimmed.slice(0, -1).trim());
      continue;
    }
    if (trimmed === "}") {
      blockStack.pop();
      continue;
    }
    const declaration = /^([-\w]+)\s*:\s*(.*?)\s*;$/.exec(trimmed);
    if (
      !declaration ||
      blockStack.some((block) => block.startsWith("@property "))
    ) {
      continue;
    }
    const atRules = blockStack
      .filter((block) => block.startsWith("@"))
      .join(" > ");
    const important = /\s!important\s*$/i.test(declaration[2]);
    const value = declaration[2].replace(/\s!important\s*$/i, "").trim();
    for (const [property, expandedValue] of expandedDeclaration(
      declaration[1],
      value
    )) {
      declarations.push({
        scope: `${variantSignature}\0${atRules}`,
        property,
        value: expandedValue,
        important,
      });
    }
  }
  return declarations;
}

/**
 * Produce a selector-name-independent effective declaration projection for a
 * complete class recipe. The caller may supply target compiler class-order
 * values; otherwise input order is used. This is compiler-project evidence,
 * not a universal source rewrite rule.
 */
export function projectCompiledRecipe(evidence, classOrder = null) {
  if (
    evidence.length === 0 ||
    evidence.some(
      (item) =>
        !new Set(["tailwind-compiled", "tailwind-marker"]).has(
          item.evidenceStatus
        )
    )
  ) {
    return null;
  }
  const orderByCandidate = new Map(
    (classOrder ?? []).map(([candidate, order]) => [
      candidate,
      typeof order === "bigint" ? order : BigInt(order ?? 0),
    ])
  );
  const ordered = evidence
    .map((item, index) => ({
      item,
      index,
      order: orderByCandidate.get(item.candidate.raw) ?? BigInt(index),
    }))
    .sort(
      (left, right) =>
        Number(left.order - right.order) ||
        left.item.candidate.raw.localeCompare(right.item.candidate.raw) ||
        left.index - right.index
    );
  const effective = new Map();
  for (const { item } of ordered) {
    if (item.evidenceStatus === "tailwind-marker" || !item.css) continue;
    const variantSignature = stableStringify({
      variants: item.candidate.variants,
      important: item.candidate.important,
    });
    for (const declaration of declarationsFromCompiledCss(
      item.css,
      variantSignature
    )) {
      const key = `${declaration.scope}\0${declaration.property}`;
      const previous = effective.get(key);
      if (!previous || declaration.important || !previous.important) {
        effective.set(key, declaration);
      }
    }
  }
  return stableStringify(
    [...effective.values()].sort(
      (left, right) =>
        left.scope.localeCompare(right.scope) ||
        left.property.localeCompare(right.property) ||
        left.value.localeCompare(right.value)
    )
  );
}

function walkFiles(directory, predicate, accumulator = []) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return accumulator;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (
      entry.name.startsWith(".") ||
      new Set([
        "node_modules",
        "dist",
        "build",
        "coverage",
        "playwright-report",
        "test-results",
      ]).has(entry.name)
    ) {
      continue;
    }
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walkFiles(absolute, predicate, accumulator);
    else if (predicate(absolute)) accumulator.push(absolute);
  }
  return accumulator;
}

function resolvePackageVersion(requireFromRoot, packageName, resolvedEntry) {
  try {
    return requireFromRoot(`${packageName}/package.json`).version;
  } catch {
    let cursor = path.dirname(resolvedEntry);
    while (cursor !== path.dirname(cursor)) {
      const manifest = path.join(cursor, "package.json");
      if (existsSync(manifest)) {
        try {
          const parsed = JSON.parse(readFileSync(manifest, "utf8"));
          if (parsed.name === packageName && parsed.version)
            return parsed.version;
        } catch {
          // Continue walking. A malformed unrelated parent manifest is not the
          // package manifest we are looking for.
        }
      }
      cursor = path.dirname(cursor);
    }
    return "unknown";
  }
}

function readJsonIfPresent(file) {
  if (!file || !existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function configuredPaths(root) {
  const tokenizationConfigPath = path.join(
    root,
    "tokens",
    "tokenization.config.json"
  );
  const config = readJsonIfPresent(tokenizationConfigPath) ?? {};
  const tokenDirectory = path.join(root, "tokens");
  const discoveredTokenSources = existsSync(tokenDirectory)
    ? readdirSync(tokenDirectory)
        .filter((name) => name.endsWith(".tokens.json"))
        .map((name) => path.join(tokenDirectory, name))
    : [];
  return {
    tokenizationConfigPath,
    tokenSourcePaths: [
      ...new Set([
        ...(config.tokenFile ? [path.resolve(root, config.tokenFile)] : []),
        ...discoveredTokenSources,
      ]),
    ].sort(),
    tailwindConfigPath: config.tailwindConfig
      ? path.resolve(root, config.tailwindConfig)
      : null,
  };
}

export function discoverTailwindEntryCss(root) {
  const conventional = [
    "src/index.css",
    "src/globals.css",
    "src/styles/globals.css",
    "app/globals.css",
    "styles/globals.css",
  ].map((candidate) => path.join(root, candidate));
  for (const candidate of conventional) {
    if (
      existsSync(candidate) &&
      /@(?:import\s+["']tailwindcss["']|tailwind\s+(?:base|components|utilities))/.test(
        readFileSync(candidate, "utf8")
      )
    ) {
      return candidate;
    }
  }
  return (
    walkFiles(root, (file) => file.endsWith(".css")).find((file) =>
      /@(?:import\s+["']tailwindcss["']|tailwind\s+(?:base|components|utilities))/.test(
        readFileSync(file, "utf8")
      )
    ) ?? null
  );
}

function discoverPlainCssClasses(root) {
  const classes = new Set();
  for (const file of walkFiles(root, (candidate) =>
    candidate.endsWith(".css")
  )) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\.(-?[_a-zA-Z][\w-]*)\b/g)) {
      classes.add(match[1]);
    }
  }
  return classes;
}

function hashFileOrMarker(file, marker) {
  return file && existsSync(file)
    ? sha256(readFileSync(file))
    : sha256(`missing:${marker}`);
}

function hashFilesOrMarker(files, marker, base = null) {
  const present = files.filter((file) => file && existsSync(file)).sort();
  if (present.length === 0) return sha256(`missing:${marker}`);
  return sha256(
    stableStringify(
      present.map((file) => ({
        path: base
          ? path.relative(base, file).split(path.sep).join("/")
          : path.basename(file),
        sha256: sha256(readFileSync(file)),
      }))
    )
  );
}

/**
 * Load compiler and merge evidence from the target project, never from the
 * skill's dependency tree. Internal Tailwind APIs are feature-detected and the
 * adapter fails closed when they are unavailable.
 */
export async function createTargetNormalizer({
  root,
  entryCss = null,
  tailwindConfig = null,
  tokenSource = null,
} = {}) {
  const absoluteRoot = path.resolve(root ?? process.cwd());
  const configured = configuredPaths(absoluteRoot);
  const resolveFromTarget = (candidate) =>
    path.isAbsolute(candidate)
      ? candidate
      : path.resolve(absoluteRoot, candidate);
  const entryCssPath = resolveFromTarget(
    entryCss ??
      discoverTailwindEntryCss(absoluteRoot) ??
      "__missing-tailwind-entry.css"
  );
  const tailwindConfigPath = resolveFromTarget(
    tailwindConfig ?? configured.tailwindConfigPath ?? "tailwind.config.js"
  );
  const tokenSourcePaths = tokenSource
    ? [resolveFromTarget(tokenSource)]
    : configured.tokenSourcePaths;
  const plainCssClasses = discoverPlainCssClasses(absoluteRoot);
  const requireFromRoot = createRequire(
    path.join(absoluteRoot, "package.json")
  );

  let designSystem = null;
  let tailwindVersion = "unavailable";
  let unavailableReason = null;
  try {
    if (!existsSync(entryCssPath)) {
      throw new Error(`Tailwind entry CSS not found: ${entryCssPath}`);
    }
    const resolved = requireFromRoot.resolve("@tailwindcss/node");
    const tailwindNode = await import(pathToFileURL(resolved).href);
    if (typeof tailwindNode.__unstable__loadDesignSystem !== "function") {
      throw new Error(
        "@tailwindcss/node does not expose __unstable__loadDesignSystem"
      );
    }
    let tailwindEntry = resolved;
    try {
      tailwindEntry = requireFromRoot.resolve("tailwindcss");
    } catch {
      // @tailwindcss/node's pinned version remains useful provenance when its
      // peer Tailwind package cannot be resolved independently.
    }
    tailwindVersion = resolvePackageVersion(
      requireFromRoot,
      tailwindEntry === resolved ? "@tailwindcss/node" : "tailwindcss",
      tailwindEntry
    );
    designSystem = await tailwindNode.__unstable__loadDesignSystem(
      readFileSync(entryCssPath, "utf8"),
      { base: path.dirname(entryCssPath) }
    );
    if (
      typeof designSystem.candidatesToCss !== "function" ||
      typeof designSystem.canonicalizeCandidates !== "function"
    ) {
      throw new Error("Target Tailwind design-system compiler is incomplete");
    }
  } catch (error) {
    designSystem = null;
    unavailableReason = error instanceof Error ? error.message : String(error);
  }

  let twMerge = null;
  let twMergeVersion = null;
  try {
    const resolved = requireFromRoot.resolve("tailwind-merge");
    const module = await import(pathToFileURL(resolved).href);
    twMerge = module.twMerge ?? module.default?.twMerge ?? module.default;
    if (typeof twMerge !== "function") twMerge = null;
    twMergeVersion = resolvePackageVersion(
      requireFromRoot,
      "tailwind-merge",
      resolved
    );
  } catch {
    // Runtime-merge evidence is deliberately absent when the target does not
    // use tailwind-merge. Installing it only for analysis would change the
    // semantics being measured.
  }

  const provenance = {
    normalizerVersion: NORMALIZER_VERSION,
    tailwindVersion,
    tailwindEntryCssFingerprint: hashFileOrMarker(
      entryCssPath,
      "tailwind-entry-css"
    ),
    tailwindConfigFingerprint: hashFileOrMarker(
      tailwindConfigPath,
      "tailwind-config"
    ),
    tokenSourceFingerprint: hashFilesOrMarker(
      tokenSourcePaths,
      "token-source",
      absoluteRoot
    ),
    twMergeVersion,
    twMergeConfigFingerprint: twMerge
      ? sha256(
          stableStringify({
            packageVersion: twMergeVersion,
            targetConfig: hashFileOrMarker(
              tailwindConfigPath,
              "tailwind-config"
            ),
          })
        )
      : null,
  };

  function compilerEvidence(raw) {
    const syntax = parseCandidateSyntax(raw);
    if (syntax.status === "invalid") {
      return {
        candidate: syntax,
        css: null,
        evidenceStatus: "invalid-syntax",
        reason: syntax.invalidReason,
      };
    }
    if (/\$\{|\{\{|\+\s*[A-Za-z_$]|[A-Za-z_$]\s*\+/.test(raw)) {
      return {
        candidate: {
          ...syntax,
          canonicalCandidate: null,
          status: "opaque",
        },
        css: null,
        evidenceStatus: "unresolved-dynamic",
        reason: "candidate contains an unresolved dynamic fragment",
      };
    }
    if (/^(?:group|peer)(?:\/[A-Za-z0-9_-]+)?$/.test(raw)) {
      return {
        candidate: {
          ...syntax,
          canonicalCandidate: syntax.canonicalCandidate,
          status: "valid",
        },
        css: null,
        evidenceStatus: "tailwind-marker",
        reason: "Tailwind group/peer marker intentionally emits no CSS",
      };
    }
    if (!designSystem) {
      return {
        candidate: {
          ...syntax,
          canonicalCandidate: null,
          status: "opaque",
        },
        css: null,
        evidenceStatus: "compiler-unavailable",
        reason: unavailableReason,
      };
    }

    // Parse before compiling. `candidatesToCss` records non-emitting
    // candidates in Tailwind's invalidCandidates set; marker utilities such as
    // `group` and `peer` intentionally emit no standalone CSS but are valid
    // inputs for variants.
    const parsedByTarget =
      typeof designSystem.parseCandidate === "function"
        ? designSystem.parseCandidate(raw)
        : [];
    const css = designSystem.candidatesToCss([raw])[0] ?? null;
    if (!css && parsedByTarget.length > 0) {
      const canonical =
        designSystem.canonicalizeCandidates([raw])[0] ??
        syntax.canonicalCandidate;
      return {
        candidate: {
          ...syntax,
          canonicalCandidate: canonical,
          status: "valid",
        },
        css: null,
        evidenceStatus: "tailwind-marker",
        reason: "valid target candidate emits no standalone CSS",
      };
    }
    if (!css) {
      const baseClass =
        syntax.variants.length === 0 && !syntax.modifier
          ? `${syntax.negative ? "-" : ""}${syntax.utilityRoot ?? ""}${
              syntax.value ? `-${syntax.value}` : ""
            }`
          : null;
      const isPlainCss =
        plainCssClasses.has(raw) ||
        (baseClass && plainCssClasses.has(baseClass));
      return {
        candidate: {
          ...syntax,
          canonicalCandidate: null,
          status: "opaque",
        },
        css: null,
        evidenceStatus: isPlainCss ? "plain-css" : "unresolved",
        reason: isPlainCss
          ? "class is authored in plain CSS, not emitted by Tailwind"
          : "target Tailwind compiler emitted no CSS",
      };
    }
    const canonical =
      designSystem.canonicalizeCandidates([raw])[0] ??
      syntax.canonicalCandidate;
    return {
      candidate: {
        ...syntax,
        canonicalCandidate: canonical,
        status: "valid",
      },
      css,
      evidenceStatus: "tailwind-compiled",
      reason: null,
    };
  }

  return {
    root: absoluteRoot,
    available: Boolean(designSystem),
    unavailableReason,
    entryCssPath: existsSync(entryCssPath) ? entryCssPath : null,
    tailwindConfigPath: existsSync(tailwindConfigPath)
      ? tailwindConfigPath
      : null,
    tokenSourcePaths: tokenSourcePaths.filter(existsSync),
    provenance,
    compilerEvidence,
    compilerProjection(evidence) {
      if (!designSystem) return null;
      const candidates = evidence.map((item) => item.candidate.raw);
      return projectCompiledRecipe(
        evidence,
        typeof designSystem.getClassOrder === "function"
          ? designSystem.getClassOrder(candidates)
          : null
      );
    },
    runtimeMerge(rawClassName, resolverKind) {
      if (resolverKind !== "twMerge" || !twMerge) return null;
      return twMerge(rawClassName);
    },
    /**
     * Group-level canonical PROPOSAL from the official canonicalizer.
     *
     * `compilerEvidence` stays 1:1 — one raw candidate, one record — because
     * evidence must remain addressable per occurrence. Collapse is N→1, so it
     * cannot live there. It lives here, as a parallel group projection, exactly
     * like `compilerProjection` and `runtimeMerge` above.
     *
     * This is a PROPOSAL, never a substitute for evidence: the group call also
     * dedupes (`p-2 p-2` → `p-2`) and reorders, so the multiset fingerprint must
     * be computed from the 1:1 evidence, before this runs.
     *
     * Fail-closed to `null` when the compiler is unavailable, same as the two
     * siblings — a missing compiler must never look like "nothing to collapse".
     */
    compilerCanonicalGroup(rawTokens, options = {}) {
      if (!designSystem) return null;
      if (typeof designSystem.canonicalizeCandidates !== "function") return null;
      if (!Array.isArray(rawTokens) || rawTokens.length === 0) return null;
      try {
        return designSystem.canonicalizeCandidates(rawTokens, options);
      } catch {
        return null;
      }
    },
  };
}

export function fingerprintsForCandidates({
  rawClassName,
  rawTokens,
  evidence,
  context,
  runtimeMergedClassName = null,
  compiledRecipeProjection = undefined,
  compilerCanonicalGroupCandidates = null,
  provenance = null,
}) {
  const canonical = evidence.map(
    ({ candidate }) => candidate.canonicalCandidate ?? `opaque:${candidate.raw}`
  );
  const canonicalMultiset = [...canonical].sort();
  const canonicalSet = [...new Set(canonical)].sort();
  const compiledCss =
    compiledRecipeProjection === undefined
      ? projectCompiledRecipe(evidence)
      : compiledRecipeProjection;
  return {
    rawOrderHash: sha256(
      stableStringify({
        provenance,
        projection: "raw-order",
        rawClassName,
        rawTokens,
      })
    ),
    canonicalMultisetFingerprint: sha256(
      stableStringify({
        provenance,
        projection: "canonical-multiset",
        candidates: canonicalMultiset,
      })
    ),
    canonicalSetFingerprint: sha256(
      stableStringify({
        provenance,
        projection: "canonical-set",
        candidates: canonicalSet,
      })
    ),
    runtimeMergedFingerprint:
      runtimeMergedClassName === null
        ? null
        : sha256(
            stableStringify({
              provenance,
              projection: "runtime-merged",
              className: runtimeMergedClassName,
            })
          ),
    compilerCanonicalGroupFingerprint:
      compilerCanonicalGroupCandidates === null
        ? null
        : sha256(
            stableStringify({
              provenance,
              projection: "compiler-canonical-group",
              candidates: compilerCanonicalGroupCandidates,
            })
          ),
    compiledCssFingerprint:
      compiledCss === null
        ? null
        : sha256(
            stableStringify({
              provenance,
              projection: "compiled-css",
              css: compiledCss,
            })
          ),
    computedStyleFingerprints: [],
    semanticContextFingerprint: sha256(
      stableStringify({
        provenance,
        projection: "semantic-context",
        context,
      })
    ),
  };
}

export function schemaCandidate(candidate) {
  return {
    raw: candidate.raw,
    // The durable schema models semantic variant membership as a set. Raw and
    // canonicalCandidate retain the exact repeated sequence for compiler
    // specificity evidence (for example hover:hover:*).
    variants: [...new Set(candidate.variants)],
    important: candidate.important,
    negative: candidate.negative,
    utilityRoot: candidate.utilityRoot,
    value: candidate.value,
    modifier: candidate.modifier,
    canonicalCandidate: candidate.canonicalCandidate,
    status: candidate.status,
  };
}
