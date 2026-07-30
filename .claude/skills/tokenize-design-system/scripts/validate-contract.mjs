#!/usr/bin/env node
/**
 * Validates that the bundled naming law, prose oracle, and executable oracle
 * describe one scoring contract. This is deliberately repository-independent:
 * it reads only files inside this skill and never scans or edits a target app.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ABSOLUTE_COMPLETION_PREDICATE_IDS } from "./lib/absolute-completion-contract.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(SCRIPT_DIR, "..");
const read = (relativePath) =>
  readFileSync(path.join(SKILL_DIR, relativePath), "utf8");

const law = read("reference/law.md");
const oracle = read("reference/oracle.md");
const anatomy = read("reference/anatomy-property.md");
const examples = read("reference/examples.md");
const workflow = read("reference/end-to-end-workflow.md");
const schemas = JSON.parse(read("reference/artifact-schemas.json"));
const executable = read("scripts/score-naming.mjs");

const expected = new Map([
  ["owner present and in the vocabulary", 30],
  ["no context word", 25],
  ["no redundant word", 15],
  ["coherent anatomy × property pair", 10],
  ["state with a default pair", 10],
  ["no segment outside the law", 10],
]);

const normalize = (value) =>
  value.toLowerCase().replaceAll("`", "").replace(/\s+/g, " ").trim();

function fail(message) {
  console.error(`validate-contract: FAIL — ${message}`);
  process.exitCode = 1;
}

function assertWeightMap(label, actual) {
  for (const [criterion, points] of expected) {
    if (actual.get(criterion) !== points) {
      fail(
        `${label}: expected \`${criterion}\`=${points}, got ${
          actual.has(criterion) ? actual.get(criterion) : "missing"
        }`
      );
    }
  }
  const extra = [...actual].filter(([criterion]) => !expected.has(criterion));
  if (extra.length) {
    fail(
      `${label}: unexpected criteria ${extra.map(([name]) => name).join(", ")}`
    );
  }
  const total = [...actual.values()].reduce((sum, points) => sum + points, 0);
  if (total !== 100) fail(`${label}: score totals ${total}, expected 100`);
}

const lawScore = law.slice(
  law.indexOf("### 7.4 NAME SCORE"),
  law.indexOf("### 7.5 APPLICATION SCORE")
);
const lawWeights = new Map();
for (const match of lawScore.matchAll(
  /^\|\s*([^|]+?)\s*\|\s*\*\*(\d+)\*\*\s*\|/gm
)) {
  const criterion = normalize(match[1]);
  if (criterion !== "criterion") lawWeights.set(criterion, Number(match[2]));
}
assertWeightMap("reference/law.md", lawWeights);

const oracleScore = oracle.slice(
  oracle.indexOf("## 1. NAME SCORE"),
  oracle.indexOf("## 2. APPLICATION SCORE")
);
const oracleWeights = new Map();
for (const match of oracleScore.matchAll(
  /^###\s+1\.\d+\s+(.+?)\s+—\s+(\d+)\s+points\s*$/gm
)) {
  oracleWeights.set(normalize(match[1]), Number(match[2]));
}
assertWeightMap("reference/oracle.md", oracleWeights);

const executableNameScore = executable.slice(
  executable.indexOf("export function scoreName"),
  executable.indexOf(
    "/* ------------------------------------------------------ application score"
  )
);
const executableCriterionNames = new Map([
  ["owner", "owner present and in the vocabulary"],
  ["no-context", "no context word"],
  ["no-redundancy", "no redundant word"],
  ["coherent-pair", "coherent anatomy × property pair"],
  ["state-with-base", "state with a default pair"],
  ["no-remainder", "no segment outside the law"],
]);
const executableWeights = new Map();
for (const [code, criterion] of executableCriterionNames) {
  const matches = [
    ...executableNameScore.matchAll(
      new RegExp(`c:\\s*"${code}"[\\s\\S]{0,240}?maxPoints:\\s*(\\d+)`, "g")
    ),
  ];
  const values = new Set(matches.map((match) => Number(match[1])));
  if (values.size !== 1) {
    fail(
      `scripts/score-naming.mjs: criterion \`${code}\` has ${
        values.size
          ? `multiple maxPoints (${[...values].join(", ")})`
          : "no maxPoints"
      }`
    );
  } else {
    executableWeights.set(criterion, [...values][0]);
  }
}
assertWeightMap("scripts/score-naming.mjs", executableWeights);

const cutoff = executable.match(/export const CUTOFF\s*=\s*(\d+)/);
if (!cutoff || Number(cutoff[1]) !== 70) {
  fail(
    `scripts/score-naming.mjs: cutoff is ${cutoff?.[1] ?? "missing"}, expected 70`
  );
}

if (/^✓.*button\.container\./m.test(law)) {
  fail("reference/law.md: a positive example still creates button.container");
}
const emission = law.slice(law.indexOf("## 6. Emission"), law.indexOf("## 7."));
if (/button\.container\./.test(emission)) {
  fail("reference/law.md: emission contract still creates button.container");
}
if (!anatomy.includes("Do not create a new token with `container`")) {
  fail("reference/anatomy-property.md: missing the no-new-container rule");
}
if (
  !examples.includes("button.container.background-color") ||
  !examples.includes("button.background-color")
) {
  fail("reference/examples.md: missing the measured bad/good container pair");
}

const expectedArtifactTypes = [
  "runConfig",
  "runState",
  "designOccurrence",
  "normalizedOccurrence",
  "axisDiscovery",
  "inventoryReport",
  "clusterPacket",
  "decision",
  "batchContract",
  "impactedContext",
  "scenario",
  "evidenceManifest",
  "mutationManifest",
  "deterministicChecks",
  "comparison",
  "visualReview",
  "adversarialReview",
  "acceptance",
  "finalProof",
];
const rootArtifactTypes = schemas.oneOf.map((entry) =>
  entry.$ref.replace("#/$defs/", "")
);
if (
  JSON.stringify(rootArtifactTypes) !== JSON.stringify(expectedArtifactTypes)
) {
  fail(
    "reference/artifact-schemas.json: root artifact types differ from the " +
      `closed 19-type contract (${rootArtifactTypes.join(", ")})`
  );
}

const expectedOccurrenceKinds = [
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
];
if (
  JSON.stringify(schemas.$defs.occurrenceKind.enum) !==
  JSON.stringify(expectedOccurrenceKinds)
) {
  fail(
    "reference/artifact-schemas.json: occurrenceKind must cover the closed " +
      "19-kind design universe"
  );
}

const runConfig = schemas.$defs.runConfig.allOf[1];
const sourceKindRegistry = runConfig.properties.sourceKindRegistry;
if (
  sourceKindRegistry.minItems !== expectedOccurrenceKinds.length ||
  sourceKindRegistry.maxItems !== expectedOccurrenceKinds.length
) {
  fail(
    "reference/artifact-schemas.json: sourceKindRegistry is not structurally " +
      "bound to all 19 occurrence kinds"
  );
}
if (runConfig.properties.sourceRoots.$ref !== "#/$defs/nonEmptyStringSet") {
  fail("reference/artifact-schemas.json: sourceRoots may be vacuous");
}
for (const dimension of [
  "themes",
  "projects",
  "browsers",
  "locales",
  "writingModes",
]) {
  if (
    runConfig.properties.matrix.properties[dimension].$ref !==
    "#/$defs/nonEmptyStringSet"
  ) {
    fail(`reference/artifact-schemas.json: matrix.${dimension} may be vacuous`);
  }
}

const axisDiscovery = schemas.$defs.axisDiscovery.allOf[1].properties;
if (
  axisDiscovery.registeredOccurrenceKinds.minItems !== 19 ||
  axisDiscovery.registeredOccurrenceKinds.maxItems !== 19 ||
  axisDiscovery.registeredOccurrenceKinds.uniqueItems !== true
) {
  fail(
    "reference/artifact-schemas.json: axis discovery does not require all " +
      "19 distinct occurrence kinds"
  );
}
if (schemas.$defs.rawOccurrence) {
  fail(
    "reference/artifact-schemas.json: obsolete class-only rawOccurrence remains"
  );
}
if (!schemas.$defs.designOccurrence || !schemas.$defs.normalizedOccurrence) {
  fail(
    "reference/artifact-schemas.json: design occurrence and class projection " +
      "must both exist"
  );
}

const batchContract = schemas.$defs.batchContract.allOf[1];
if (
  !batchContract.anyOf?.every((branch) =>
    Object.values(branch.properties).every(
      (property) => property.minItems === 1
    )
  )
) {
  fail(
    "reference/artifact-schemas.json: a batch may request zero changed and " +
      "zero unchanged scenarios"
  );
}

const evidence = schemas.$defs.evidenceManifest.allOf[1].properties;
for (const field of ["requestedScenarioIds", "producedScenarioIds"]) {
  if (evidence[field].$ref !== "#/$defs/nonEmptyStringSet") {
    fail(`reference/artifact-schemas.json: evidence ${field} may be vacuous`);
  }
}
if (evidence.captures.minItems !== 1) {
  fail("reference/artifact-schemas.json: evidence captures may be vacuous");
}
if (schemas.$defs.comparison.allOf[1].properties.pairs.minItems !== 1) {
  fail("reference/artifact-schemas.json: comparison pairs may be vacuous");
}
const visualReview = schemas.$defs.visualReview.allOf[1];
if (
  !visualReview.required.includes("requiredReviewScenarioIds") ||
  visualReview.properties.requiredReviewScenarioIds.$ref !==
    "#/$defs/nonEmptyStringSet" ||
  visualReview.properties.entries.minItems !== 1
) {
  fail("reference/artifact-schemas.json: visual review may be vacuous");
}

const residualKeys =
  schemas.$defs.finalProof.allOf[1].properties.residualCounts.required;
for (const key of [
  "unreconciledDesignOccurrences",
  "uncoveredAxes",
  "uncoveredOccurrenceKinds",
]) {
  if (!residualKeys.includes(key)) {
    fail(`reference/artifact-schemas.json: final proof omits ${key}`);
  }
}
const doneRule = schemas.$defs.finalProof.allOf[1].allOf?.find(
  (rule) => rule.if?.properties?.verdict?.const === "done"
);
const doneResiduals = doneRule?.then?.properties?.residualCounts?.properties;
if (
  !doneRule ||
  doneRule.then?.properties?.predicates?.items?.properties?.status?.const !==
    "pass" ||
  residualKeys.some((key) => doneResiduals?.[key]?.const !== 0)
) {
  fail(
    "reference/artifact-schemas.json: verdict=done does not force every " +
      "predicate to pass and every residual count to zero"
  );
}
for (const invariant of [
  "Source-kind registry",
  "Design reconciliation",
  "Class projection parity",
  "Axis discovery",
  "Scenario coverage",
  "Review completeness",
]) {
  if (!workflow.includes(`| ${invariant} |`)) {
    fail(`reference/end-to-end-workflow.md: missing ${invariant} invariant`);
  }
}
for (const predicateId of ABSOLUTE_COMPLETION_PREDICATE_IDS) {
  const occurrences = workflow.split(predicateId).length - 1;
  if (occurrences !== 1) {
    fail(
      `reference/end-to-end-workflow.md: absolute predicate ${predicateId} ` +
        `must occur exactly once; found ${occurrences}`
    );
  }
}
if (ABSOLUTE_COMPLETION_PREDICATE_IDS.length !== 24) {
  fail(
    "scripts/lib/absolute-completion-contract.mjs: Section 14 must expose " +
      "exactly 24 predicates"
  );
}

if (!process.exitCode) {
  console.log(
    "validate-contract: PASS — law, oracle, and script agree on " +
      "30+25+15+10+10+10=100; cutoff=70; no positive button.container " +
      "contract; 19 artifact types and 19 design-occurrence kinds are closed; " +
      "matrix/evidence/review artifacts are non-vacuous; the closed 24-predicate " +
      "absolute completion contract is documented exactly once"
  );
}
