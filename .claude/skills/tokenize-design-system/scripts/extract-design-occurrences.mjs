#!/usr/bin/env node
/**
 * Portable, fail-closed design-occurrence extractor.
 *
 * Class-bearing JSX/TS expressions come from the bundled canonical
 * classname-miner-v2 AST dataset. The closed scanner registry adds the other
 * 18 source kinds plus static class syntax outside TypeScript/JavaScript.
 *
 * Usage:
 *   node extract-design-occurrences.mjs --root <app> --out <directory>
 *     [--run-id tokenize-...] [--miner-occurrences <occ.ndjson>]
 *     [--source-roots <csv>] [--source-fingerprint <sha256>]
 *     [--toolchain-fingerprint <sha256>]
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  axesForClassName,
  OCCURRENCE_KINDS,
  SOURCE_KIND_REGISTRY,
  primaryAxisFor,
} from "./lib/axis-discovery.mjs";
import {
  sha256,
  splitClassCandidates,
  stableStringify,
} from "./lib/tailwind-normalizer.mjs";

const HELP = `extract-design-occurrences.mjs

Usage:
  node extract-design-occurrences.mjs --root <app> --out <directory> [options]

Options:
  --run-id <tokenize-id>          Artifact run ID (default: tokenize-local)
  --miner-occurrences <file>      Reuse canonical miner occ.ndjson
  --source-roots <csv>            Override tokenization.config.json sourceRoots
  --source-fingerprint <sha256>   Header override supplied by an orchestrator
  --toolchain-fingerprint <sha256> Header override supplied by an orchestrator
  --generated-at <ISO timestamp>  Header override for reproducible fixtures
  --help                          Show this text

Outputs:
  design-occurrences.ndjson
  extraction-summary.json
`;

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(HELP);
  process.exit(0);
}

const root = path.resolve(argValue("--root") ?? process.cwd());
const outDirectory = path.resolve(
  argValue("--out") ?? path.join(root, ".tokenize-design-system", "extract")
);
const runId = argValue("--run-id") ?? "tokenize-local";
const generatedAt = argValue("--generated-at") ?? new Date().toISOString();
if (!/^tokenize-[a-zA-Z0-9._-]+$/.test(runId)) {
  throw new Error(`Invalid --run-id: ${runId}`);
}
if (!existsSync(root)) throw new Error(`Root does not exist: ${root}`);

function readJson(file, fallback = null) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function readJsonStrict(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(
      `Invalid JSON configuration ${file}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

const tokenizationConfigPath = path.join(
  root,
  "tokens",
  "tokenization.config.json"
);
const tokenizationConfig = existsSync(tokenizationConfigPath)
  ? readJsonStrict(tokenizationConfigPath)
  : {};
const configuredSourceRoots = (
  argValue("--source-roots")?.split(",") ??
  tokenizationConfig.sourceRoots ?? ["src"]
)
  .map((value) => String(value).trim())
  .filter(Boolean);
if (configuredSourceRoots.length === 0) {
  throw new Error("At least one source root is required");
}
const sourceRoots = configuredSourceRoots.map((value) =>
  path.resolve(root, value)
);
for (const sourceRoot of sourceRoots) {
  if (!existsSync(sourceRoot)) {
    throw new Error(`Configured source root does not exist: ${sourceRoot}`);
  }
}
const configuredTokenSourcePath = tokenizationConfig.tokenFile
  ? path.resolve(root, tokenizationConfig.tokenFile)
  : null;
const tokenDirectory = path.join(root, "tokens");
const tokenSourcePaths = [
  ...new Set([
    ...(configuredTokenSourcePath && existsSync(configuredTokenSourcePath)
      ? [configuredTokenSourcePath]
      : []),
    ...(existsSync(tokenDirectory)
      ? readdirSync(tokenDirectory)
          .filter((name) => name.endsWith(".tokens.json"))
          .map((name) => path.join(tokenDirectory, name))
      : []),
  ]),
].sort();
const publicRoot = path.join(root, "public");
const configuredTailwindConfigPath = tokenizationConfig.tailwindConfig
  ? path.resolve(root, tokenizationConfig.tailwindConfig)
  : null;
const tailwindConfigSourcePath =
  configuredTailwindConfigPath && existsSync(configuredTailwindConfigPath)
    ? configuredTailwindConfigPath
    : (["tailwind.config.js", "tailwind.config.mjs", "tailwind.config.ts"]
        .map((name) => path.join(root, name))
        .find(existsSync) ?? null);
const themeMappingPaths = [
  "tokens/theme-map.json",
  "tokens/theme-baseline.json",
]
  .map((file) => path.join(root, file))
  .filter(existsSync);
const rootEntryPaths = ["index.html", "app.html"]
  .map((file) => path.join(root, file))
  .filter(existsSync);

const SKIP_DIRECTORIES = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "playwright-report",
  "test-results",
]);
const TEXT_EXTENSIONS = new Set([
  ".astro",
  ".css",
  ".html",
  ".js",
  ".jsx",
  ".json",
  ".less",
  ".mdx",
  ".sass",
  ".scss",
  ".svelte",
  ".ts",
  ".tsx",
  ".vue",
  ".svg",
]);
const ASSET_MIME = new Map([
  [".avif", "image/avif"],
  [".bmp", "image/bmp"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".eot", "application/vnd.ms-fontobject"],
  [".otf", "font/otf"],
  [".ttf", "font/ttf"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function walk(directory, accumulator = []) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return accumulator;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (SKIP_DIRECTORIES.has(entry.name) || entry.name.startsWith("."))
      continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, accumulator);
    else accumulator.push(absolute);
  }
  return accumulator;
}

function relativeToRoot(absolute) {
  return path.relative(root, absolute).split(path.sep).join("/");
}

const authoredFiles = sourceRoots.flatMap((sourceRoot) => walk(sourceRoot));
const supplementaryPublicFiles = existsSync(publicRoot)
  ? walk(publicRoot).filter((file) => {
      const extension = path.extname(file).toLowerCase();
      return extension === ".css" || ASSET_MIME.has(extension);
    })
  : [];
const allFiles = [
  ...new Set(
    authoredFiles
      .concat(supplementaryPublicFiles)
      .concat(tokenSourcePaths)
      .concat(themeMappingPaths)
      .concat(rootEntryPaths)
      .concat(
        tailwindConfigSourcePath && existsSync(tailwindConfigSourcePath)
          ? [tailwindConfigSourcePath]
          : []
      )
      .map((file) => realpathSync(file))
  ),
].sort();
const textFiles = allFiles
  .filter((file) => TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()))
  .map((absolute) => ({
    absolute,
    relative: relativeToRoot(absolute),
    extension: path.extname(absolute).toLowerCase(),
    source: readFileSync(absolute, "utf8"),
  }));
const assets = allFiles
  .filter((file) => ASSET_MIME.has(path.extname(file).toLowerCase()))
  .map((absolute) => ({
    absolute,
    relative: relativeToRoot(absolute),
    extension: path.extname(absolute).toLowerCase(),
    mimeType: ASSET_MIME.get(path.extname(absolute).toLowerCase()),
  }));

function fingerprintFiles(files) {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(relativeToRoot(file));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function detectToolchainFingerprint() {
  const files = [
    "package.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "package-lock.json",
    "tailwind.config.js",
    "tailwind.config.mjs",
    "vite.config.js",
    "vite.config.mjs",
    "tsconfig.json",
    "jsconfig.json",
    "tokens/tokenization.config.json",
  ]
    .map((file) => path.join(root, file))
    .filter(existsSync)
    .sort();
  return sha256(
    stableStringify({
      node: process.version,
      fileFingerprint: fingerprintFiles(files),
      scannerRegistry: SOURCE_KIND_REGISTRY,
    })
  );
}

const sourceFingerprint =
  argValue("--source-fingerprint") ?? fingerprintFiles(allFiles);
const toolchainFingerprint =
  argValue("--toolchain-fingerprint") ?? detectToolchainFingerprint();
for (const [name, value] of [
  ["source fingerprint", sourceFingerprint],
  ["toolchain fingerprint", toolchainFingerprint],
]) {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
}
const header = {
  schemaVersion: "1.0.0",
  runId,
  sourceFingerprint,
  toolchainFingerprint,
  generatedAt,
};

function lineColumn(source, offset) {
  const before = source.slice(0, offset);
  const line = (before.match(/\n/g) ?? []).length + 1;
  const lastNewline = before.lastIndexOf("\n");
  return {
    line,
    column: offset - lastNewline,
  };
}

function maskComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (comment) =>
      comment.replace(/[^\n]/g, " ")
    );
}

function regexDrafts(file, regex, makeDraft, source = file.source) {
  const drafts = [];
  regex.lastIndex = 0;
  for (const match of source.matchAll(regex)) {
    const draft = makeDraft(match);
    if (!draft) continue;
    drafts.push({
      file,
      offset: match.index ?? 0,
      ...draft,
    });
  }
  return drafts;
}

function balancedBlock(source, openingBrace) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = openingBrace; index < source.length; index += 1) {
    const character = source[index];
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
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openingBrace, index + 1);
    }
  }
  return null;
}

function sourceLanguage(file) {
  return file.extension.replace(/^\./, "") || "binary";
}

function commonDraft({
  occurrenceKind,
  file,
  offset,
  rawValue,
  property = null,
  selectorOrObjectPath = null,
  opaqueReason = null,
  asset = null,
  classExpression = null,
  occurrenceId = null,
  context = null,
  axisHint = null,
}) {
  return {
    occurrenceKind,
    file,
    offset,
    rawValue: String(rawValue ?? ""),
    property,
    selectorOrObjectPath,
    opaqueReason,
    asset,
    classExpression,
    occurrenceId,
    context,
    axisHint,
  };
}

function implicitRoleFor(tag, props = {}) {
  if (tag === "button") return "button";
  if (tag === "a" && (props.href || props.to)) return "link";
  if (tag === "input") return "textbox";
  if (tag === "select") return "combobox";
  if (tag === "textarea") return "textbox";
  if (tag === "nav") return "navigation";
  if (tag === "main") return "main";
  if (tag === "aside") return "complementary";
  if (tag === "header") return "banner";
  if (tag === "footer") return "contentinfo";
  return null;
}

function resolverKind(expressionKind) {
  if (/twMerge/i.test(expressionKind)) return "twMerge";
  if (/clsx/i.test(expressionKind)) return "clsx";
  if (/cva/i.test(expressionKind)) return "cva";
  if (/template/i.test(expressionKind)) return "template";
  if (/conditional|ternary/i.test(expressionKind)) return "conditional";
  if (/literal|jsx-attr|string|const/i.test(expressionKind)) return "direct";
  return "unknown";
}

const AST_CLASS_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const AST_BRANCH_LIMIT = 128;
let targetTypeScript = null;
let targetTypeScriptError = null;
try {
  targetTypeScript = createRequire(path.join(root, "package.json"))(
    "typescript"
  );
} catch (error) {
  targetTypeScriptError =
    error instanceof Error ? error.message : String(error);
}
const astCompleteness = {
  adapter: "target-typescript-jsx-completeness",
  available: Boolean(targetTypeScript),
  unavailableReason: targetTypeScriptError,
  attributesExamined: 0,
  supplementedOccurrences: 0,
  unresolvedAttributes: 0,
  truncatedAttributes: 0,
};

function isInSourceRoots(absoluteFile) {
  return sourceRoots.some((sourceRoot) => {
    const relative = path.relative(sourceRoot, absoluteFile);
    return (
      relative === "" ||
      (!relative.startsWith(`..${path.sep}`) &&
        relative !== ".." &&
        !path.isAbsolute(relative))
    );
  });
}

function stableMinerOccurrenceId(occurrence, fileName) {
  return `occ:${sha256(
    stableStringify({
      occurrenceKind: "utility-class",
      file: fileName,
      line: occurrence.line ?? null,
      column: occurrence.column ?? null,
      rawClassName: occurrence.fullClassName ?? "",
      expressionKind: occurrence.sourceExpressionKind ?? "unknown",
      element: occurrence.jsxElement ?? null,
      component: occurrence.componentOwner ?? null,
    })
  ).slice(0, 24)}`;
}

function branchResult(
  branches = [""],
  { unresolved = [], conditions = [], truncated = false } = {}
) {
  return {
    branches: [...new Set(branches.map(String))].slice(0, AST_BRANCH_LIMIT),
    unresolved: new Set(unresolved),
    conditions: new Set(conditions),
    truncated: truncated || branches.length > AST_BRANCH_LIMIT,
  };
}

function unionBranchResults(...results) {
  return branchResult(
    results.flatMap((result) => result.branches),
    {
      unresolved: results.flatMap((result) => [...result.unresolved]),
      conditions: results.flatMap((result) => [...result.conditions]),
      truncated: results.some((result) => result.truncated),
    }
  );
}

function sequenceBranchResults(left, right, separator = "") {
  const branches = [];
  let truncated = left.truncated || right.truncated;
  outer: for (const leftBranch of left.branches) {
    for (const rightBranch of right.branches) {
      const joiner = leftBranch && rightBranch ? separator : "";
      branches.push(`${leftBranch}${joiner}${rightBranch}`);
      if (branches.length >= AST_BRANCH_LIMIT) {
        truncated = true;
        break outer;
      }
    }
  }
  return branchResult(branches, {
    unresolved: [...left.unresolved, ...right.unresolved],
    conditions: [...left.conditions, ...right.conditions],
    truncated,
  });
}

function sourceText(node, sourceFile) {
  try {
    return node.getText(sourceFile);
  } catch {
    return "";
  }
}

function collectClassBranches(ts, node, sourceFile, depth = 0) {
  if (!node) return branchResult();
  if (depth > 64) {
    return branchResult([""], {
      unresolved: [sourceText(node, sourceFile) || "<deep-expression>"],
      truncated: true,
    });
  }
  if (
    ts.isStringLiteralLike(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  ) {
    return branchResult([node.text]);
  }
  if (ts.isParenthesizedExpression(node)) {
    return collectClassBranches(ts, node.expression, sourceFile, depth + 1);
  }
  if (
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node) ||
    (typeof ts.isSatisfiesExpression === "function" &&
      ts.isSatisfiesExpression(node))
  ) {
    return collectClassBranches(ts, node.expression, sourceFile, depth + 1);
  }
  if (ts.isTemplateExpression(node)) {
    let result = branchResult([node.head.text]);
    for (const span of node.templateSpans) {
      result = sequenceBranchResults(
        result,
        collectClassBranches(ts, span.expression, sourceFile, depth + 1)
      );
      result = sequenceBranchResults(result, branchResult([span.literal.text]));
    }
    return result;
  }
  if (ts.isConditionalExpression(node)) {
    const whenTrue = collectClassBranches(
      ts,
      node.whenTrue,
      sourceFile,
      depth + 1
    );
    const whenFalse = collectClassBranches(
      ts,
      node.whenFalse,
      sourceFile,
      depth + 1
    );
    const result = unionBranchResults(whenTrue, whenFalse);
    result.conditions.add(sourceText(node.condition, sourceFile));
    return result;
  }
  if (ts.isBinaryExpression(node)) {
    const operator = node.operatorToken.kind;
    if (operator === ts.SyntaxKind.PlusToken) {
      return sequenceBranchResults(
        collectClassBranches(ts, node.left, sourceFile, depth + 1),
        collectClassBranches(ts, node.right, sourceFile, depth + 1)
      );
    }
    if (operator === ts.SyntaxKind.AmpersandAmpersandToken) {
      const result = unionBranchResults(
        branchResult([""]),
        collectClassBranches(ts, node.right, sourceFile, depth + 1)
      );
      result.conditions.add(sourceText(node.left, sourceFile));
      return result;
    }
    if (
      operator === ts.SyntaxKind.BarBarToken ||
      operator === ts.SyntaxKind.QuestionQuestionToken
    ) {
      return unionBranchResults(
        collectClassBranches(ts, node.left, sourceFile, depth + 1),
        collectClassBranches(ts, node.right, sourceFile, depth + 1)
      );
    }
  }
  if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
    let result = branchResult([""]);
    for (const argument of node.arguments ?? []) {
      result = sequenceBranchResults(
        result,
        collectClassBranches(ts, argument, sourceFile, depth + 1),
        " "
      );
    }
    return result;
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.reduce(
      (result, element) =>
        sequenceBranchResults(
          result,
          collectClassBranches(ts, element, sourceFile, depth + 1),
          " "
        ),
      branchResult([""])
    );
  }
  if (ts.isObjectLiteralExpression(node)) {
    let result = branchResult([""]);
    for (const property of node.properties) {
      if (ts.isSpreadAssignment(property)) {
        result.unresolved.add(sourceText(property.expression, sourceFile));
        continue;
      }
      const name = property.name;
      let key = null;
      if (name && (ts.isIdentifier(name) || ts.isStringLiteralLike(name))) {
        key = name.text;
      } else if (name && ts.isComputedPropertyName(name)) {
        result.unresolved.add(sourceText(name.expression, sourceFile));
      }
      if (key) {
        result = sequenceBranchResults(
          result,
          unionBranchResults(branchResult([""]), branchResult([key])),
          " "
        );
      }
    }
    return result;
  }
  if (
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword ||
    ts.isNumericLiteral(node) ||
    (ts.isIdentifier(node) && node.text === "undefined")
  ) {
    return branchResult([""]);
  }
  return branchResult([""], {
    unresolved: [sourceText(node, sourceFile) || `<syntax-${node.kind}>`],
  });
}

function scriptKindFor(ts, extension) {
  return extension === ".tsx"
    ? ts.ScriptKind.TSX
    : extension === ".jsx"
      ? ts.ScriptKind.JSX
      : extension === ".ts"
        ? ts.ScriptKind.TS
        : ts.ScriptKind.JS;
}

function jsxTagName(attribute, sourceFile) {
  const opening = attribute.parent?.parent;
  return opening?.tagName ? sourceText(opening.tagName, sourceFile) : null;
}

function jsxStaticProps(ts, attribute, sourceFile) {
  const props = {};
  for (const candidate of attribute.parent?.properties ?? []) {
    if (!ts.isJsxAttribute(candidate)) continue;
    const name = sourceText(candidate.name, sourceFile);
    if (candidate.initializer && ts.isStringLiteral(candidate.initializer)) {
      props[name] = candidate.initializer.text;
    }
  }
  return props;
}

function componentOwnerFor(ts, node) {
  let cursor = node.parent;
  while (cursor) {
    if (ts.isFunctionDeclaration(cursor) && cursor.name) {
      return cursor.name.text;
    }
    if (
      (ts.isArrowFunction(cursor) || ts.isFunctionExpression(cursor)) &&
      ts.isVariableDeclaration(cursor.parent) &&
      ts.isIdentifier(cursor.parent.name)
    ) {
      return cursor.parent.name.text;
    }
    cursor = cursor.parent;
  }
  return null;
}

function scanTypeScriptClassCompleteness(existingDrafts) {
  const files = textFiles.filter(
    (file) =>
      AST_CLASS_EXTENSIONS.has(file.extension) &&
      isInSourceRoots(file.absolute) &&
      /\bclass(?:Name)?\s*=/.test(file.source)
  );
  if (files.length === 0) return [];
  if (!targetTypeScript) {
    throw new Error(
      `Target TypeScript is required for JSX class completeness: ${targetTypeScriptError}`
    );
  }
  const ts = targetTypeScript;
  const existing = new Set(
    existingDrafts.map((draft) => {
      const location =
        draft.line && draft.column
          ? { line: draft.line, column: draft.column }
          : lineColumn(draft.file.source ?? "", draft.offset);
      return stableStringify({
        file: draft.file.relative,
        line: location.line,
        column: location.column,
        raw: draft.rawValue.trim(),
      });
    })
  );
  const supplements = [];
  for (const file of files) {
    const sourceFile = ts.createSourceFile(
      file.absolute,
      file.source,
      ts.ScriptTarget.Latest,
      true,
      scriptKindFor(ts, file.extension)
    );
    function visit(node) {
      if (ts.isJsxAttribute(node)) {
        const attributeName = sourceText(node.name, sourceFile);
        if (
          (attributeName === "className" || attributeName === "class") &&
          node.initializer
        ) {
          astCompleteness.attributesExamined += 1;
          const initializer = node.initializer;
          const expression = ts.isJsxExpression(initializer)
            ? initializer.expression
            : initializer;
          const result = collectClassBranches(ts, expression, sourceFile);
          const unresolved = [...result.unresolved].filter(Boolean).sort();
          if (unresolved.length > 0) astCompleteness.unresolvedAttributes += 1;
          if (result.truncated) astCompleteness.truncatedAttributes += 1;
          const start = initializer.getStart(sourceFile);
          const location = lineColumn(file.source, start);
          const props = jsxStaticProps(ts, node, sourceFile);
          const tag = jsxTagName(node, sourceFile);
          const distinctBranches = [...new Set(result.branches)].filter(
            (raw, index, branches) =>
              raw.trim() ||
              unresolved.length > 0 ||
              (result.truncated && index === branches.length - 1)
          );
          for (const [branchIndex, rawBranch] of distinctBranches.entries()) {
            const rawClassName = rawBranch.trim();
            const dedupeKey = stableStringify({
              file: file.relative,
              line: location.line,
              column: location.column,
              raw: rawClassName,
            });
            if (
              existing.has(dedupeKey) &&
              unresolved.length === 0 &&
              !result.truncated
            ) {
              continue;
            }
            const branchId = `ast:${sha256(
              `${file.relative}\0${start}\0${branchIndex}\0${rawClassName}`
            ).slice(0, 20)}`;
            const opaqueReason = result.truncated
              ? "class expression branch expansion reached the safety ceiling"
              : unresolved.length > 0
                ? "class expression contains unresolved dynamic fragments"
                : null;
            supplements.push(
              commonDraft({
                occurrenceKind: "utility-class",
                file,
                offset: start,
                rawValue: rawClassName,
                occurrenceId: `occ:${sha256(branchId).slice(0, 24)}`,
                opaqueReason,
                classExpression: classExpression({
                  expressionKind: ts.isStringLiteral(initializer)
                    ? "jsx-attr:literal"
                    : "jsx-attr:typescript-completeness",
                  branchId,
                  rawClassName,
                  unresolvedDynamicFragments: unresolved,
                  branchExpansionTruncated: result.truncated,
                  conditionExpression:
                    [...result.conditions].filter(Boolean).sort().join(" | ") ||
                    null,
                }),
                context: {
                  component: componentOwnerFor(ts, node),
                  nativeTag: tag,
                  implicitRole: implicitRoleFor(tag, props),
                  explicitRole: props.role ?? null,
                  nearestLandmark: null,
                  routeAreas: [],
                  interactionState: null,
                },
              })
            );
            existing.add(dedupeKey);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
  astCompleteness.supplementedOccurrences = supplements.length;
  return supplements;
}

function normalizeMinerFile(file) {
  if (path.isAbsolute(file)) return relativeToRoot(file);
  const rootBase = path.basename(root);
  if (file.startsWith(`${rootBase}/`)) return file.slice(rootBase.length + 1);
  const direct = path.resolve(root, file);
  if (existsSync(direct)) return relativeToRoot(direct);
  try {
    const repositoryRoot = execFileSync(
      "git",
      ["rev-parse", "--show-toplevel"],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    const repositoryRelative = path.resolve(repositoryRoot, file);
    if (existsSync(repositoryRelative))
      return relativeToRoot(repositoryRelative);
  } catch {
    // Non-git projects still retain the miner path as supplied.
  }
  return file.split(path.sep).join("/");
}

function loadMinerRows() {
  const supplied = argValue("--miner-occurrences");
  if (supplied) {
    return readFileSync(path.resolve(supplied), "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
  const temporary = mkdtempSync(path.join(tmpdir(), "tokenize-miner-"));
  const miner = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "classname-miner-v2.mjs"
  );
  const result = spawnSync(
    process.execPath,
    [miner, "--root", root, "--ext", "js,jsx,ts,tsx", "--emit-full", temporary],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
    }
  );
  try {
    if (result.status !== 0) {
      throw new Error(
        `Canonical classname miner failed (${result.status}): ${
          result.stderr || result.stdout
        }`
      );
    }
    return readFileSync(path.join(temporary, "occ.ndjson"), "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

function classExpression({
  expressionKind,
  resolver = null,
  branchId,
  rawClassName,
  rawTokens = null,
  unresolvedDynamicFragments = [],
  branchExpansionTruncated = false,
  conditionExpression = null,
}) {
  return {
    expressionKind: expressionKind || "unknown",
    resolverKind: resolver ?? resolverKind(expressionKind || "unknown"),
    branchId,
    conditionExpression,
    rawClassName,
    rawTokens: rawTokens ?? splitClassCandidates(rawClassName).tokens,
    unresolvedDynamicFragments,
    branchExpansionTruncated,
  };
}

function scanUtilityClasses() {
  const drafts = [];
  const seenMinerIds = new Set();
  for (const occurrence of loadMinerRows()) {
    const fileName = normalizeMinerFile(occurrence.file);
    const absoluteMinerFile = path.resolve(root, fileName);
    if (!isInSourceRoots(absoluteMinerFile)) continue;
    const sourceFile = textFiles.find(
      (candidate) => candidate.relative === fileName
    ) ?? {
      absolute: path.join(root, fileName),
      relative: fileName,
      extension: path.extname(fileName),
      source: "",
    };
    const rawClassName = occurrence.fullClassName ?? "";
    const props = occurrence.props ?? {};
    const tag = occurrence.jsxElement ?? null;
    const variants = occurrence.variantPrefixes ?? [];
    const stableOccurrenceId = stableMinerOccurrenceId(occurrence, fileName);
    if (seenMinerIds.has(stableOccurrenceId)) continue;
    seenMinerIds.add(stableOccurrenceId);
    drafts.push(
      commonDraft({
        occurrenceKind: "utility-class",
        file: sourceFile,
        offset: 0,
        rawValue: rawClassName,
        occurrenceId: stableOccurrenceId,
        classExpression: classExpression({
          expressionKind: occurrence.sourceExpressionKind ?? "unknown",
          branchId: stableOccurrenceId,
          rawClassName,
          rawTokens:
            occurrence.tokens ?? splitClassCandidates(rawClassName).tokens,
        }),
        context: {
          component: occurrence.componentOwner ?? null,
          nativeTag: tag,
          implicitRole: implicitRoleFor(tag, props),
          explicitRole: typeof props.role === "string" ? props.role : null,
          nearestLandmark:
            (occurrence.ancestorChain ?? []).find((ancestor) =>
              /^(?:main|nav|aside|header|footer)$/.test(ancestor)
            ) ?? null,
          routeAreas: occurrence.routeArea
            ? [String(occurrence.routeArea)]
            : [],
          interactionState:
            variants.find((variant) =>
              /^(?:hover|focus|focus-visible|active|disabled|checked|open)$/.test(
                variant
              )
            ) ?? null,
        },
      })
    );
    drafts.at(-1).line = occurrence.line;
    drafts.at(-1).column = occurrence.column;
  }
  drafts.push(...scanTypeScriptClassCompleteness(drafts));

  for (const file of textFiles.filter((candidate) =>
    new Set([".astro", ".html", ".mdx", ".svelte", ".vue"]).has(
      candidate.extension
    )
  )) {
    drafts.push(
      ...regexDrafts(
        file,
        /\bclass(?:Name)?\s*=\s*(["'])([\s\S]*?)\1/g,
        (match) =>
          commonDraft({
            occurrenceKind: "utility-class",
            file,
            offset: match.index,
            rawValue: match[2],
            classExpression: classExpression({
              expressionKind: "static-markup-attribute",
              resolver: "direct",
              branchId: `static-${match.index}`,
              rawClassName: match[2],
            }),
          })
      )
    );
  }
  for (const file of textFiles.filter((candidate) =>
    new Set([".css", ".less", ".sass", ".scss"]).has(candidate.extension)
  )) {
    drafts.push(
      ...regexDrafts(file, /@apply\s+([^;{}]+);/g, (match) =>
        commonDraft({
          occurrenceKind: "utility-class",
          file,
          offset: match.index,
          rawValue: match[1].trim(),
          selectorOrObjectPath: "@apply",
          classExpression: classExpression({
            expressionKind: "css-at-apply",
            resolver: "direct",
            branchId: `apply-${match.index}`,
            rawClassName: match[1].trim(),
          }),
        })
      )
    );
  }
  for (const draft of drafts) {
    if (!draft.axisHint && axesForClassName(draft.rawValue).length === 0) {
      draft.axisHint = authoredClassAxis(draft.rawValue);
    }
  }
  return drafts;
}

function cssFiles() {
  return textFiles.filter((file) =>
    new Set([".css", ".less", ".sass", ".scss"]).has(file.extension)
  );
}

let authoredClassAxisIndex = null;
function authoredClassAxis(rawClassName) {
  if (authoredClassAxisIndex === null) {
    const index = new Map();
    for (const file of cssFiles()) {
      for (const block of file.source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const axes = new Set();
        for (const apply of block[2].matchAll(/@apply\s+([^;{}]+);/g)) {
          axesForClassName(apply[1]).forEach((axis) => axes.add(axis));
        }
        for (const declaration of block[2].matchAll(
          /(?:^|;)\s*([-a-zA-Z][\w-]*)\s*:\s*[^;{}]+/g
        )) {
          const axis = primaryAxisFor({
            occurrenceKind: "css-declaration",
            property: declaration[1],
            rawValue: "",
          });
          if (axis !== "unmapped") axes.add(axis);
        }
        if (axes.size === 0) continue;
        for (const selectorClass of block[1].matchAll(
          /\.((?:\\.|[-_a-zA-Z0-9])+)/g
        )) {
          const className = selectorClass[1].replace(/\\(.)/g, "$1");
          const existing = index.get(className) ?? new Set();
          axes.forEach((axis) => existing.add(axis));
          index.set(className, existing);
        }
      }
    }
    authoredClassAxisIndex = index;
  }
  for (const candidate of splitClassCandidates(rawClassName).tokens) {
    const axes = authoredClassAxisIndex.get(candidate);
    if (axes?.size) return [...axes][0];
  }
  return null;
}

function scanCssDeclarations() {
  return cssFiles().flatMap((file) => {
    const masked = maskComments(file.source);
    const declarationDraft = (match, propertyIndex, valueIndex) => {
      const property = match[propertyIndex];
      if (property.startsWith("--")) return null;
      return commonDraft({
        occurrenceKind: "css-declaration",
        file,
        offset: match.index,
        rawValue: match[valueIndex].trim(),
        property,
      });
    };
    return [
      ...regexDrafts(
        file,
        /(^|[;{]\s*)([-a-zA-Z][\w-]*)\s*:\s*([^;{}]+)(?=;|\})/gm,
        (match) => declarationDraft(match, 2, 3),
        masked
      ),
      ...(file.extension === ".sass"
        ? regexDrafts(
            file,
            /^[ \t]+([-a-zA-Z][\w-]*)\s*:\s*(\S.*)$/gm,
            (match) => declarationDraft(match, 1, 2),
            masked
          )
        : []),
    ];
  });
}

function scanCssCustomProperties() {
  return cssFiles().flatMap((file) => {
    const masked = maskComments(file.source);
    const makeDraft = (match, propertyIndex, valueIndex) =>
      commonDraft({
        occurrenceKind: "css-custom-property",
        file,
        offset: match.index,
        rawValue: match[valueIndex].trim(),
        property: match[propertyIndex],
      });
    return [
      ...regexDrafts(
        file,
        /(^|[;{]\s*)(--[\w-]+)\s*:\s*([^;{}]+)(?=;|\})/gm,
        (match) => makeDraft(match, 2, 3),
        masked
      ),
      ...(file.extension === ".sass"
        ? regexDrafts(
            file,
            /^[ \t]+(--[\w-]+)\s*:\s*(\S.*)$/gm,
            (match) => makeDraft(match, 1, 2),
            masked
          )
        : []),
    ];
  });
}

function scriptFiles() {
  return textFiles.filter((file) =>
    new Set([
      ".astro",
      ".js",
      ".jsx",
      ".mdx",
      ".svelte",
      ".ts",
      ".tsx",
      ".vue",
    ]).has(file.extension)
  );
}

function scanInlineStyles() {
  return scriptFiles().flatMap((file) => [
    ...regexDrafts(file, /\bstyle\s*=\s*\{\{([\s\S]{0,8000}?)\}\}/g, (match) =>
      commonDraft({
        occurrenceKind: "inline-style",
        file,
        offset: match.index,
        rawValue: match[1].trim(),
        property: /^[A-Za-z_$][\w$]*$/.test(match[1].trim())
          ? match[1].trim()
          : null,
        selectorOrObjectPath: "style",
        opaqueReason: /\.\.\.|\$\{/.test(match[1])
          ? "inline style contains unresolved dynamic fragments"
          : null,
      })
    ),
    ...regexDrafts(file, /\bstyle\s*=\s*\{(?!\{)([^{}\n]+)\}/g, (match) =>
      commonDraft({
        occurrenceKind: "inline-style",
        file,
        offset: match.index,
        rawValue: match[1].trim(),
        selectorOrObjectPath: "style",
        opaqueReason: "inline style expression requires runtime resolution",
      })
    ),
  ]);
}

function scanCssInJs() {
  return scriptFiles().flatMap((file) => [
    ...regexDrafts(
      file,
      /\b((?:styled(?:\.\w+|\([^)]*\))|css))\s*`([\s\S]{0,16000}?)`/g,
      (match) =>
        commonDraft({
          occurrenceKind: "css-in-js",
          file,
          offset: match.index,
          rawValue: match[2],
          selectorOrObjectPath: match[1],
          opaqueReason: match[2].includes("${")
            ? "CSS-in-JS template contains runtime interpolation"
            : null,
        })
    ),
    ...regexDrafts(
      file,
      /\b((?:css|styled))\s*\(\s*\{([\s\S]{0,8000}?)\}\s*\)/g,
      (match) =>
        commonDraft({
          occurrenceKind: "css-in-js",
          file,
          offset: match.index,
          rawValue: match[2],
          selectorOrObjectPath: match[1],
          opaqueReason: /\.\.\.|\[[^\]]+\]\s*:/.test(match[2])
            ? "CSS-in-JS object contains dynamic keys or spreads"
            : null,
        })
    ),
  ]);
}

function scanSvgPresentation() {
  const drafts = [];
  for (const file of textFiles) {
    for (const tagMatch of file.source.matchAll(
      /<(?:svg|path|circle|ellipse|line|polyline|polygon|rect|text|g)\b[^>]*>/g
    )) {
      for (const attribute of tagMatch[0].matchAll(
        /\b(fill|stroke|strokeWidth|stroke-width|opacity|color|width|height|viewBox)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g
      )) {
        drafts.push(
          commonDraft({
            occurrenceKind: "svg-presentation",
            file,
            offset: (tagMatch.index ?? 0) + (attribute.index ?? 0),
            rawValue: attribute[2] ?? attribute[3] ?? attribute[4] ?? "",
            property: attribute[1],
            selectorOrObjectPath: "svg-presentation-attribute",
            opaqueReason: attribute[4]
              ? "SVG presentation value is a JavaScript expression"
              : null,
          })
        );
      }
    }
  }
  return drafts;
}

function scanChartConfig() {
  return scriptFiles()
    .filter(
      (file) =>
        /(?:recharts|chart\.js|echarts|visx|victory|nivo|plotly|apexcharts)/i.test(
          file.source
        ) ||
        /(?:^|\/)(?:charts?|visuali[sz]ation)(?:\/|[-.])/i.test(file.relative)
    )
    .flatMap((file) =>
      regexDrafts(
        file,
        /\b(color|fill|stroke|backgroundColor|borderColor|fontFamily|fontSize|fontWeight|lineHeight|opacity|radius|barSize|strokeWidth)\s*:\s*([^,\n}]+)/g,
        (match) =>
          commonDraft({
            occurrenceKind: "chart-config",
            file,
            offset: match.index,
            rawValue: match[2].trim(),
            property: match[1],
            selectorOrObjectPath: `chart.${match[1]}`,
            opaqueReason: /^[A-Za-z_$][\w.$[\]]*$/.test(match[2].trim())
              ? "chart design value is a runtime reference"
              : null,
          })
      )
    );
}

function scanCanvasDraw() {
  return scriptFiles()
    .filter((file) =>
      /getContext\s*\(\s*["']2d["']|CanvasRenderingContext2D/.test(file.source)
    )
    .flatMap((file) =>
      regexDrafts(
        file,
        /\.(fillStyle|strokeStyle|shadowColor|shadowBlur|lineWidth|lineCap|lineJoin|font|globalAlpha)\s*=\s*([^;\n]+)/g,
        (match) =>
          commonDraft({
            occurrenceKind: "canvas-draw",
            file,
            offset: match.index,
            rawValue: match[2].trim(),
            property: match[1],
            selectorOrObjectPath: `canvas.${match[1]}`,
            opaqueReason: /^[A-Za-z_$][\w.$[\]]*$/.test(match[2].trim())
              ? "canvas design value is a runtime reference"
              : null,
          })
      )
    );
}

function scanTypography() {
  const property =
    "(?:font(?:-family|-size|-style|-weight)?|line-height|letter-spacing|text-align|text-transform|white-space)";
  const configTypography = [];
  for (const file of textFiles.filter(
    (candidate) => candidate.absolute === tailwindConfigSourcePath
  )) {
    for (const match of file.source.matchAll(/\bfontFamily\s*:\s*\{/g)) {
      const openingBrace = (match.index ?? 0) + match[0].lastIndexOf("{");
      const block = balancedBlock(file.source, openingBrace);
      configTypography.push(
        commonDraft({
          occurrenceKind: "typography",
          file,
          offset: match.index,
          rawValue: block ?? match[0],
          property: "fontFamily",
          selectorOrObjectPath: "theme.extend.fontFamily",
          opaqueReason: block ? null : "unbalanced Tailwind fontFamily block",
        })
      );
    }
  }
  return [
    ...cssFiles().flatMap((file) =>
      regexDrafts(
        file,
        new RegExp(`\\b(${property})\\s*:\\s*([^;{}]+)(?=;|\\})`, "g"),
        (match) =>
          commonDraft({
            occurrenceKind: "typography",
            file,
            offset: match.index,
            rawValue: match[2].trim(),
            property: match[1],
          }),
        maskComments(file.source)
      )
    ),
    ...scriptFiles().flatMap((file) =>
      regexDrafts(
        file,
        /\b(fontFamily|fontSize|fontStyle|fontWeight|lineHeight|letterSpacing|textAlign|textTransform|whiteSpace)\s*:\s*([^,\n}]+)/g,
        (match) => {
          if (
            file.absolute === tailwindConfigSourcePath &&
            /^[{[]$/.test(match[2].trim())
          ) {
            return null;
          }
          return commonDraft({
            occurrenceKind: "typography",
            file,
            offset: match.index,
            rawValue: match[2].trim(),
            property: match[1],
          });
        }
      )
    ),
    ...configTypography,
  ];
}

function assetDraft(kind, asset) {
  return commonDraft({
    occurrenceKind: kind,
    file: {
      ...asset,
      source: "",
    },
    offset: 0,
    rawValue: asset.relative,
    asset: {
      path: asset.relative,
      mimeType: asset.mimeType,
      contentSha256: sha256(readFileSync(asset.absolute)),
    },
  });
}

function scanFontAssets() {
  return assets
    .filter(
      (asset) => /^font\//.test(asset.mimeType) || asset.extension === ".eot"
    )
    .map((asset) => assetDraft("font-asset", asset));
}

function scanMotionKeyframes() {
  const drafts = [];
  for (const file of cssFiles()) {
    for (const match of file.source.matchAll(
      /@(?:-\w+-)?keyframes\s+([\w-]+)\s*\{/g
    )) {
      const openingBrace = (match.index ?? 0) + match[0].lastIndexOf("{");
      const block = balancedBlock(file.source, openingBrace);
      drafts.push(
        commonDraft({
          occurrenceKind: "motion-keyframe",
          file,
          offset: match.index,
          rawValue: block ? `${match[0].slice(0, -1)}${block}` : match[0],
          property: "keyframes",
          selectorOrObjectPath: match[1],
          opaqueReason: block ? null : "unbalanced @keyframes block",
        })
      );
    }
  }
  for (const file of textFiles.filter(
    (candidate) => candidate.absolute === tailwindConfigSourcePath
  )) {
    for (const match of file.source.matchAll(/\bkeyframes\s*:\s*\{/g)) {
      const openingBrace = (match.index ?? 0) + match[0].lastIndexOf("{");
      const block = balancedBlock(file.source, openingBrace);
      drafts.push(
        commonDraft({
          occurrenceKind: "motion-keyframe",
          file,
          offset: match.index,
          rawValue: block ?? match[0],
          property: "keyframes",
          selectorOrObjectPath: "theme.extend.keyframes",
          opaqueReason: block
            ? null
            : "unbalanced Tailwind keyframes configuration",
        })
      );
    }
  }
  return drafts;
}

function scanMotionTransitions() {
  const configAnimations = [];
  for (const file of textFiles.filter(
    (candidate) => candidate.absolute === tailwindConfigSourcePath
  )) {
    for (const match of file.source.matchAll(/\banimation\s*:\s*\{/g)) {
      const openingBrace = (match.index ?? 0) + match[0].lastIndexOf("{");
      const block = balancedBlock(file.source, openingBrace);
      if (!block) {
        configAnimations.push(
          commonDraft({
            occurrenceKind: "motion-transition",
            file,
            offset: match.index,
            rawValue: match[0],
            property: "animation",
            selectorOrObjectPath: "theme.extend.animation",
            opaqueReason: "unbalanced Tailwind animation configuration",
          })
        );
        continue;
      }
      for (const entry of block.matchAll(
        /(["']?)([\w-]+)\1\s*:\s*(["'])([^"']+)\3/g
      )) {
        configAnimations.push(
          commonDraft({
            occurrenceKind: "motion-transition",
            file,
            offset: (match.index ?? 0) + (entry.index ?? 0),
            rawValue: entry[4],
            property: `animation.${entry[2]}`,
            selectorOrObjectPath: `theme.extend.animation.${entry[2]}`,
          })
        );
      }
    }
  }
  return [
    ...cssFiles().flatMap((file) =>
      regexDrafts(
        file,
        /\b((?:transition|animation)(?:-[\w-]+)?)\s*:\s*([^;{}]+)(?=;|\})/g,
        (match) =>
          commonDraft({
            occurrenceKind: "motion-transition",
            file,
            offset: match.index,
            rawValue: match[2].trim(),
            property: match[1],
          }),
        maskComments(file.source)
      )
    ),
    ...scriptFiles().flatMap((file) =>
      regexDrafts(
        file,
        /\b(transition|transitionProperty|transitionDuration|transitionTimingFunction|animation|animationName|animationDuration|animate)\s*:\s*([^,\n}]+)/g,
        (match) => {
          if (
            match[1] === "animate" &&
            /^(?:true|false|null|undefined)$/.test(match[2].trim())
          ) {
            return null;
          }
          if (
            file.absolute === tailwindConfigSourcePath &&
            /^[{[]$/.test(match[2].trim())
          ) {
            return null;
          }
          return commonDraft({
            occurrenceKind: "motion-transition",
            file,
            offset: match.index,
            rawValue: match[2].trim(),
            property: match[1],
            opaqueReason: /^[A-Za-z_$][\w.$[\]]*$/.test(match[2].trim())
              ? "motion value is a runtime reference"
              : null,
          });
        }
      )
    ),
    ...configAnimations,
  ];
}

function scanImageAssets() {
  return assets
    .filter(
      (asset) =>
        asset.mimeType.startsWith("image/") &&
        asset.extension !== ".svg" &&
        asset.extension !== ".ico"
    )
    .map((asset) => assetDraft("image-asset", asset));
}

function scanIconAssets() {
  return assets
    .filter(
      (asset) =>
        asset.extension === ".svg" ||
        asset.extension === ".ico" ||
        /(?:^|\/)icons?(?:\/|[-_.])/i.test(asset.relative)
    )
    .map((asset) => assetDraft("icon-asset", asset));
}

function scanGradients() {
  return textFiles.flatMap((file) =>
    regexDrafts(
      file,
      /(?:repeating-)?(?:linear|radial|conic)-gradient\((?:[^()]|\([^()]*\)){1,4000}\)/g,
      (match) =>
        commonDraft({
          occurrenceKind: "gradient",
          file,
          offset: match.index,
          rawValue: match[0],
          property: "gradient",
          opaqueReason: match[0].includes("${")
            ? "gradient contains runtime interpolation"
            : null,
        })
    )
  );
}

function scanIllustrations() {
  return assets
    .filter(
      (asset) =>
        asset.mimeType.startsWith("image/") &&
        /(?:illustrat|artwork|empty[-_ ]?state|hero[-_ ]?art|onboard[-_ ]?art)/i.test(
          asset.relative
        )
    )
    .map((asset) => assetDraft("illustration", asset));
}

function dtcgAxis(type, objectPath) {
  const normalizedType = String(type ?? "").toLowerCase();
  const pathText = objectPath.join(".").toLowerCase();
  if (/color/.test(normalizedType)) return "color";
  if (/duration|cubicbezier|transition/.test(normalizedType)) return "motion";
  if (/font|typography/.test(normalizedType)) return "typography";
  if (/shadow/.test(normalizedType)) return "elevation";
  if (/border|stroke/.test(normalizedType)) return "border";
  if (/opacity/.test(pathText)) return "opacity";
  if (/zindex|z-index/.test(pathText)) return "z-index";
  if (/breakpoint/.test(pathText)) return "breakpoint";
  if (/radius/.test(pathText)) return "radius";
  if (/spacing|space|gap|padding|margin|inset/.test(pathText)) {
    return "spacing";
  }
  if (/font|lineheight|letterspacing/.test(pathText)) return "typography";
  if (/size|width|height|dimension/.test(pathText)) return "sizing";
  return null;
}

function dtcgDraftsForFile(kind, tokenSourcePath) {
  const source = readFileSync(tokenSourcePath, "utf8");
  const parsed = readJson(tokenSourcePath, null);
  if (!parsed) {
    return [
      commonDraft({
        occurrenceKind: kind,
        file: textFiles.find((file) => file.absolute === tokenSourcePath) ?? {
          absolute: tokenSourcePath,
          relative: relativeToRoot(tokenSourcePath),
          extension: path.extname(tokenSourcePath),
          source,
        },
        offset: 0,
        rawValue: source,
        opaqueReason: "token source is not valid JSON",
      }),
    ];
  }
  const file = textFiles.find(
    (candidate) => candidate.absolute === tokenSourcePath
  ) ?? {
    absolute: tokenSourcePath,
    relative: relativeToRoot(tokenSourcePath),
    extension: path.extname(tokenSourcePath),
    source,
  };
  const drafts = [];
  let searchCursor = 0;
  function containsAlias(value) {
    if (typeof value === "string") return /\{[^{}]+\}/.test(value);
    if (Array.isArray(value)) return value.some(containsAlias);
    if (value && typeof value === "object") {
      return Object.values(value).some(containsAlias);
    }
    return false;
  }
  function visit(value, objectPath = [], inheritedType = "") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const effectiveType =
      typeof value.$type === "string" ? value.$type : inheritedType;
    if (Object.hasOwn(value, "$value")) {
      const raw = stableStringify(value.$value);
      const alias = containsAlias(value.$value);
      if (kind === "token-definition" || (kind === "token-alias" && alias)) {
        const leafName = objectPath.at(-1) ?? "$root";
        const located = source.indexOf(JSON.stringify(leafName), searchCursor);
        if (located >= 0) searchCursor = located + leafName.length;
        drafts.push(
          commonDraft({
            occurrenceKind: kind,
            file,
            offset: located >= 0 ? located : 0,
            rawValue: raw,
            property: objectPath.join("."),
            selectorOrObjectPath: objectPath.join("."),
            axisHint: dtcgAxis(effectiveType, objectPath),
          })
        );
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (!key.startsWith("$")) {
        visit(child, [...objectPath, key], effectiveType);
      }
    }
  }
  visit(parsed);
  return drafts;
}

function dtcgDrafts(kind) {
  return tokenSourcePaths.flatMap((tokenSourcePath) =>
    dtcgDraftsForFile(kind, tokenSourcePath)
  );
}

function jsonThemeMappingDrafts(kind) {
  const drafts = [];
  for (const mappingPath of themeMappingPaths) {
    const parsed = readJson(mappingPath, null);
    if (!parsed) continue;
    const file = textFiles.find(
      (candidate) => candidate.absolute === realpathSync(mappingPath)
    ) ?? {
      absolute: mappingPath,
      relative: relativeToRoot(mappingPath),
      extension: ".json",
      source: readFileSync(mappingPath, "utf8"),
    };
    let searchCursor = 0;
    function visit(value, objectPath = []) {
      if (value && typeof value === "object") {
        if (Array.isArray(value)) {
          value.forEach((child, index) =>
            visit(child, [...objectPath, String(index)])
          );
        } else {
          Object.entries(value).forEach(([key, child]) =>
            visit(child, [...objectPath, key])
          );
        }
        return;
      }
      if (typeof value !== "string") return;
      if (
        objectPath.includes("unassigned") ||
        objectPath.at(-1) === "frozenAt"
      ) {
        return;
      }
      const alias =
        /\bvar\(\s*--|^(?:color|space|radius|duration|ease|z-index)-/.test(
          value
        );
      if (
        (kind === "token-alias" && !alias) ||
        (kind === "token-definition" && alias)
      ) {
        return;
      }
      const leafName = objectPath.at(-1) ?? "$root";
      const located = file.source.indexOf(
        JSON.stringify(leafName),
        searchCursor
      );
      if (located >= 0) searchCursor = located + leafName.length;
      const property = objectPath.join(".");
      drafts.push(
        commonDraft({
          occurrenceKind: kind,
          file,
          offset: located >= 0 ? located : 0,
          rawValue: JSON.stringify(value),
          property,
          selectorOrObjectPath: property,
          axisHint:
            value.startsWith("color-") || /var\(\s*--color-/.test(value)
              ? "color"
              : value.startsWith("space-")
                ? "spacing"
                : value.startsWith("radius-")
                  ? "radius"
                  : value.startsWith("duration-") || value.startsWith("ease-")
                    ? "motion"
                    : value.startsWith("z-index-")
                      ? "z-index"
                      : null,
        })
      );
    }
    visit(parsed);
  }
  return drafts;
}

const GENERATED_SECTION_AXIS = new Map([
  ["colors", "color"],
  ["chartHex", "color"],
  ["spacing", "spacing"],
  ["fontSize", "typography"],
  ["borderRadius", "radius"],
  ["borderWidth", "border"],
  ["boxShadow", "elevation"],
  ["transitionDuration", "motion"],
  ["transitionTimingFunction", "motion"],
  ["screens", "breakpoint"],
  ["zIndex", "z-index"],
  ["opacity", "opacity"],
]);

function generatedBridgeDrafts(kind) {
  const drafts = [];
  for (const file of textFiles.filter((candidate) =>
    /(?:^|\/)styles\/generated\/tokens\.js$/.test(candidate.relative)
  )) {
    for (const match of file.source.matchAll(
      /(["'])([^"']+)\1\s*:\s*(["'])([^"']*)\3/g
    )) {
      const alias = /\bvar\(\s*--/.test(match[4]);
      if (
        (kind === "token-alias" && !alias) ||
        (kind === "token-definition" && alias)
      ) {
        continue;
      }
      let section = null;
      let sectionOffset = -1;
      for (const candidate of GENERATED_SECTION_AXIS.keys()) {
        const located = file.source.lastIndexOf(`"${candidate}"`, match.index);
        if (located > sectionOffset) {
          section = candidate;
          sectionOffset = located;
        }
      }
      const property = section ? `${section}.${match[2]}` : match[2];
      drafts.push(
        commonDraft({
          occurrenceKind: kind,
          file,
          offset: match.index,
          rawValue: match[4],
          property,
          selectorOrObjectPath: property,
          axisHint: GENERATED_SECTION_AXIS.get(section) ?? null,
        })
      );
    }
  }
  return drafts;
}

function tailwindConfigAliasDrafts() {
  const file = textFiles.find(
    (candidate) => candidate.absolute === tailwindConfigSourcePath
  );
  if (!file) return [];
  return regexDrafts(
    file,
    /(["']?)([\w-]+)\1\s*:\s*(["'])([^"']*\bvar\(\s*--[^"']*)\3/g,
    (match) =>
      commonDraft({
        occurrenceKind: "token-alias",
        file,
        offset: match.index,
        rawValue: match[4],
        property: match[2],
        selectorOrObjectPath: `tailwind.theme.${match[2]}`,
      })
  );
}

function scanTokenDefinitions() {
  return [
    ...dtcgDrafts("token-definition"),
    ...jsonThemeMappingDrafts("token-definition"),
    ...generatedBridgeDrafts("token-definition"),
    ...cssFiles()
      .filter((file) => /(?:^|\/)generated(?:\/|[-_.])/.test(file.relative))
      .flatMap((file) =>
        regexDrafts(file, /(--[\w-]+)\s*:\s*([^;{}]+)(?=;|\})/g, (match) => {
          if (/\bvar\(\s*--/.test(match[2])) return null;
          return commonDraft({
            occurrenceKind: "token-definition",
            file,
            offset: match.index,
            rawValue: match[2].trim(),
            property: match[1],
            selectorOrObjectPath: match[1],
          });
        })
      ),
  ];
}

function scanTokenAliases() {
  return [
    ...dtcgDrafts("token-alias"),
    ...jsonThemeMappingDrafts("token-alias"),
    ...generatedBridgeDrafts("token-alias"),
    ...tailwindConfigAliasDrafts(),
    ...cssFiles()
      .filter((file) => /(?:^|\/)generated(?:\/|[-_.])/.test(file.relative))
      .flatMap((file) =>
        regexDrafts(
          file,
          /(--[\w-]+)\s*:\s*([^;{}]*\bvar\(\s*--[^;{}]+)(?=;|\})/g,
          (match) =>
            commonDraft({
              occurrenceKind: "token-alias",
              file,
              offset: match.index,
              rawValue: match[2].trim(),
              property: match[1],
              selectorOrObjectPath: match[1],
            })
        )
      ),
  ];
}

function scanGeneratedClasses() {
  return cssFiles()
    .filter((file) => /(?:^|\/)generated(?:\/|[-_.])/.test(file.relative))
    .flatMap((file) =>
      regexDrafts(
        file,
        /\.(-?[_a-zA-Z][\w-]*)\b(?=[^{}]*\{)/g,
        (match) =>
          commonDraft({
            occurrenceKind: "generated-class",
            file,
            offset: match.index,
            rawValue: match[1],
            selectorOrObjectPath: `.${match[1]}`,
            classExpression: classExpression({
              expressionKind: "generated-css-selector",
              resolver: "direct",
              branchId: `generated-${match.index}`,
              rawClassName: match[1],
            }),
          }),
        maskComments(file.source)
      )
    );
}

const SCANNER_ADAPTERS = new Map([
  ["utility-class", scanUtilityClasses],
  ["css-declaration", scanCssDeclarations],
  ["css-custom-property", scanCssCustomProperties],
  ["inline-style", scanInlineStyles],
  ["css-in-js", scanCssInJs],
  ["svg-presentation", scanSvgPresentation],
  ["chart-config", scanChartConfig],
  ["canvas-draw", scanCanvasDraw],
  ["typography", scanTypography],
  ["font-asset", scanFontAssets],
  ["motion-keyframe", scanMotionKeyframes],
  ["motion-transition", scanMotionTransitions],
  ["image-asset", scanImageAssets],
  ["icon-asset", scanIconAssets],
  ["gradient", scanGradients],
  ["illustration", scanIllustrations],
  ["token-definition", scanTokenDefinitions],
  ["token-alias", scanTokenAliases],
  ["generated-class", scanGeneratedClasses],
]);

const registryKinds = SOURCE_KIND_REGISTRY.map((entry) => entry.occurrenceKind);
if (
  SCANNER_ADAPTERS.size !== OCCURRENCE_KINDS.length ||
  OCCURRENCE_KINDS.some((kind) => !SCANNER_ADAPTERS.has(kind)) ||
  registryKinds.some((kind) => !SCANNER_ADAPTERS.has(kind))
) {
  throw new Error(
    "Executable scanners do not cover the closed source-kind registry"
  );
}

function occurrenceFromDraft(draft) {
  const location =
    draft.line && draft.column
      ? { file: draft.file.relative, line: draft.line, column: draft.column }
      : {
          file: draft.file.relative,
          ...lineColumn(draft.file.source ?? "", draft.offset),
        };
  const occurrenceId =
    draft.occurrenceId ??
    `occ:${sha256(
      `${draft.occurrenceKind}\0${location.file}\0${draft.offset}\0${draft.rawValue}`
    ).slice(0, 24)}`;
  const context = draft.context ?? {
    component: null,
    nativeTag: null,
    implicitRole: null,
    explicitRole: null,
    nearestLandmark: null,
    routeAreas: [],
    interactionState: null,
  };
  return {
    ...header,
    artifactType: "design-occurrence",
    occurrenceId,
    occurrenceKind: draft.occurrenceKind,
    axis:
      draft.axisHint ??
      primaryAxisFor({
        occurrenceKind: draft.occurrenceKind,
        property: draft.property,
        rawValue: draft.rawValue,
      }),
    location,
    sourceLanguage: sourceLanguage(draft.file),
    rawValue: draft.rawValue,
    property: draft.property,
    context,
    sourcePayload: {
      selectorOrObjectPath: draft.selectorOrObjectPath,
      classExpression: draft.classExpression,
      asset: draft.asset,
    },
    reconciliation: {
      status: draft.opaqueReason ? "opaque" : "discovered",
      decisionId: null,
      exceptionId: null,
      reason: draft.opaqueReason,
    },
  };
}

const occurrences = [];
const scannerResults = [];
for (const registryEntry of SOURCE_KIND_REGISTRY) {
  const scanner = SCANNER_ADAPTERS.get(registryEntry.occurrenceKind);
  try {
    const drafts = scanner();
    const start = occurrences.length;
    for (const draft of drafts) {
      occurrences.push(occurrenceFromDraft(draft));
    }
    scannerResults.push({
      occurrenceKind: registryEntry.occurrenceKind,
      disposition: registryEntry.disposition,
      adapter: registryEntry.adapter,
      status: "executed",
      filesExamined: allFiles.length,
      matches: occurrences.length - start,
      rationale: registryEntry.rationale,
      error: null,
    });
  } catch (error) {
    scannerResults.push({
      occurrenceKind: registryEntry.occurrenceKind,
      disposition: registryEntry.disposition,
      adapter: registryEntry.adapter,
      status: "failed",
      filesExamined: allFiles.length,
      matches: 0,
      rationale: registryEntry.rationale,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

occurrences.sort(
  (a, b) =>
    a.location.file.localeCompare(b.location.file) ||
    a.location.line - b.location.line ||
    a.location.column - b.location.column ||
    a.occurrenceKind.localeCompare(b.occurrenceKind) ||
    a.occurrenceId.localeCompare(b.occurrenceId)
);
const duplicateIds = occurrences
  .map((occurrence) => occurrence.occurrenceId)
  .filter((id, index, ids) => ids.indexOf(id) !== index);
if (duplicateIds.length > 0) {
  throw new Error(
    `Duplicate occurrence IDs: ${[...new Set(duplicateIds)].join(", ")}`
  );
}

const opaqueIds = occurrences
  .filter((occurrence) => occurrence.reconciliation.status === "opaque")
  .map((occurrence) => occurrence.occurrenceId);
const failedKinds = scannerResults
  .filter((result) => result.status === "failed")
  .map((result) => result.occurrenceKind);
const countsByKind = Object.fromEntries(
  OCCURRENCE_KINDS.map((kind) => [
    kind,
    occurrences.filter((occurrence) => occurrence.occurrenceKind === kind)
      .length,
  ])
);
const summary = {
  schemaVersion: "extraction-summary.v1",
  runId,
  sourceFingerprint,
  toolchainFingerprint,
  generatedAt,
  sourceRoots: sourceRoots.map(relativeToRoot),
  supplementaryRoots: existsSync(publicRoot)
    ? [
        {
          path: relativeToRoot(publicRoot),
          disposition: "scan-static-css-and-design-assets",
          rationale:
            "Public CSS, fonts, icons, and images render in the product; generated JavaScript bundles remain outside authored-source AST extraction.",
        },
      ]
    : [],
  supplementaryDesignFiles: [
    ...rootEntryPaths,
    ...themeMappingPaths,
    ...(tailwindConfigSourcePath ? [tailwindConfigSourcePath] : []),
  ].map(relativeToRoot),
  registeredOccurrenceKinds: [...OCCURRENCE_KINDS],
  classCompleteness: astCompleteness,
  scannerResults,
  counts: {
    files: allFiles.length,
    textFiles: textFiles.length,
    assets: assets.length,
    occurrences: occurrences.length,
    byOccurrenceKind: countsByKind,
    opaque: opaqueIds.length,
  },
  opaqueOccurrenceIds: opaqueIds,
  failedOccurrenceKinds: failedKinds,
  exhaustive: failedKinds.length === 0 && opaqueIds.length === 0,
};

mkdirSync(outDirectory, { recursive: true });
writeFileSync(
  path.join(outDirectory, "design-occurrences.ndjson"),
  `${occurrences.map((occurrence) => JSON.stringify(occurrence)).join("\n")}\n`
);
writeFileSync(
  path.join(outDirectory, "extraction-summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`
);

if (failedKinds.length > 0) {
  console.error(
    `Extraction incomplete: failed scanners: ${failedKinds.join(", ")}`
  );
  process.exitCode = 1;
} else if (opaqueIds.length > 0) {
  console.error(
    `Extraction produced ${opaqueIds.length} opaque occurrences; artifacts were written for reconciliation`
  );
  process.exitCode = 2;
} else {
  console.log(
    `Extracted ${occurrences.length} design occurrences across ${allFiles.length} files; ` +
      `${opaqueIds.length} opaque; outputs: ${outDirectory}`
  );
}
