import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const METADATA_KEYS = new Set(["$description", "$type", "$value", "$extensions", "$deprecated"]);

function firstExisting(root, candidates) {
  return candidates.map((candidate) => path.join(root, candidate)).find(existsSync) ?? null;
}

function readConfiguration(root) {
  const file = firstExisting(root, ["tokenization.config.json", "tokens/tokenization.config.json"]);
  if (!file) return { file: null, values: {} };
  try {
    return { file, values: JSON.parse(readFileSync(file, "utf8")) };
  } catch (error) {
    throw new Error("Cannot parse tokenization configuration " + file + ": " + error.message);
  }
}

/**
 * Resolve project topology without encoding a repository layout in each oracle.
 * tokenization.config.json may provide sourceRoots, tokenFile, bridgeFile, and
 * tailwindConfig. Relative paths are rooted at --root.
 */
export function resolveProjectLayout(root) {
  const { file: configurationFile, values } = readConfiguration(root);
  const configuredRoots = values.sourceRoots ?? values.sourceRoot;
  const sourceRootValues = Array.isArray(configuredRoots)
    ? configuredRoots
    : configuredRoots ? [configuredRoots] : [];
  const sourceRoots = (sourceRootValues.length ? sourceRootValues : ["src", "app", "components"])
    .map((candidate) => path.resolve(root, candidate))
    .filter(existsSync);
  if (!sourceRoots.length) {
    throw new Error("No source root found under " + root + ". Add tokenization.config.json with sourceRoots.");
  }

  const tokenCandidate = values.tokenFile
    ? path.resolve(root, values.tokenFile)
    : firstExisting(root, ["tokens/color.tokens.json", "tokens/tokens.json", "design-tokens.json"]);
  if (!tokenCandidate || !existsSync(tokenCandidate)) {
    throw new Error("No DTCG token file found under " + root + ". Add tokenization.config.json with tokenFile.");
  }

  const bridgeFile = values.bridgeFile
    ? path.resolve(root, values.bridgeFile)
    : firstExisting(root, [
      "src/styles/generated/tokens.js",
      "src/styles/generated/tokens.mjs",
      "app/styles/generated/tokens.js",
      "styles/generated/tokens.js",
    ]);
  const tailwindConfig = values.tailwindConfig
    ? path.resolve(root, values.tailwindConfig)
    : firstExisting(root, ["tailwind.config.js", "tailwind.config.cjs", "tailwind.config.ts"]);

  return { root, configurationFile, sourceRoots, tokenFile: tokenCandidate, bridgeFile, tailwindConfig };
}

function addLeafName(names, trail) {
  const ignored = new Set(["semantic", "component", "primitive", "light", "dark"]);
  const publicTrail = trail.filter((segment) => !ignored.has(segment));
  if (publicTrail.length) names.add(publicTrail.join("-"));
}

/** Read emitted names from a bridge when available, otherwise infer DTCG leaf paths. */
export async function loadColourNames(layout) {
  if (layout.bridgeFile) {
    const bridge = await import(pathToFileURL(layout.bridgeFile).href);
    const colors = (bridge.default ?? bridge).colors;
    if (colors && typeof colors === "object") return new Set(Object.keys(colors));
  }

  const document = JSON.parse(readFileSync(layout.tokenFile, "utf8"));
  const names = new Set();
  const walk = (node, trail = []) => {
    if (!node || typeof node !== "object") return;
    if (Object.prototype.hasOwnProperty.call(node, "$value")) {
      addLeafName(names, trail);
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (!METADATA_KEYS.has(key)) walk(child, key === "$root" ? trail : [...trail, key]);
    }
  };
  walk(document);
  return names;
}

export function readTokenDocument(layout) {
  return JSON.parse(readFileSync(layout.tokenFile, "utf8"));
}
