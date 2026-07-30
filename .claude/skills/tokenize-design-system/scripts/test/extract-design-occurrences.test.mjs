import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { OCCURRENCE_KINDS } from "../lib/axis-discovery.mjs";

function write(root, relative, contents) {
  const absolute = path.join(root, relative);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents);
}

test("invalid tokenization configuration fails before scanning", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "tokenize-config-test-"));
  write(fixture, "tokens/tokenization.config.json", "{ invalid");
  const script = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "extract-design-occurrences.mjs"
  );
  const result = spawnSync(
    process.execPath,
    [script, "--root", fixture, "--out", path.join(fixture, "out")],
    { encoding: "utf8" }
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid JSON configuration/);
});

test("closed scanner registry emits evidence for all 19 occurrence kinds", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "tokenize-extract-test-"));
  const output = path.join(fixture, "out");
  write(
    fixture,
    "tokens/tokenization.config.json",
    JSON.stringify({
      sourceRoots: ["src"],
      tokenFile: "tokens/system.tokens.json",
      tailwindConfig: "tailwind.config.js",
    })
  );
  write(
    fixture,
    "tokens/system.tokens.json",
    JSON.stringify({
      color: {
        base: { $type: "color", $value: "#ff0000" },
        alias: { $type: "color", $value: "{color.base}" },
      },
      typography: {
        label: {
          $type: "typography",
          $value: {
            fontFamily: "{font.family}",
            fontSize: "{size.base}",
            lineHeight: 1.25,
          },
        },
      },
    })
  );
  write(
    fixture,
    "src/component.html",
    '<main class="gap-2 px-2 mb-3"><button>Save</button></main>'
  );
  write(
    fixture,
    "src/component.jsx",
    `
      import { BarChart } from "recharts";
      const Card = styled.div\`color: red;\`;
      export function Demo() {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#f00";
        return <svg style={{ color: "red" }}><path fill="#fff" /></svg>;
      }
      const chart = { color: "#f00", fontSize: 12, animate: true };
    `
  );
  write(
    fixture,
    "src/styles/generated/theme.css",
    `
      :root {
        --space-card: 8px;
        --color-card: #fff;
        --color-card-alias: var(--color-card);
      }
      .generated-card {
        color: #fff;
        font-family: Inter;
        transition: color 100ms ease;
        background: linear-gradient(#fff, #000);
      }
      @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
    `
  );
  write(fixture, "src/assets/icon.svg", '<svg><path stroke="#000"/></svg>');
  write(fixture, "src/assets/photo.png", "fake-png");
  write(fixture, "src/assets/hero-illustration.png", "fake-illustration");
  write(fixture, "src/assets/inter.woff2", "fake-font");
  write(
    fixture,
    "src/indented.sass",
    ".card\n  color: red\n  --card-color: #f00\n"
  );
  const minerRow = {
    id: "occ:unstable-first",
    file: "src/component.jsx",
    line: 4,
    column: 14,
    componentOwner: "Demo",
    jsxElement: "svg",
    sourceExpressionKind: "jsx-attr:literal",
    fullClassName: "p-2 px-1",
    tokens: ["p-2", "px-1"],
    props: {},
    ancestorChain: [],
  };
  write(fixture, "miner.ndjson", `${JSON.stringify(minerRow)}\n`);

  const script = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "extract-design-occurrences.mjs"
  );
  const result = spawnSync(
    process.execPath,
    [
      script,
      "--root",
      fixture,
      "--out",
      output,
      "--run-id",
      "tokenize-fixture",
      "--miner-occurrences",
      path.join(fixture, "miner.ndjson"),
      "--generated-at",
      "2026-01-01T00:00:00.000Z",
    ],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const occurrences = readFileSync(
    path.join(output, "design-occurrences.ndjson"),
    "utf8"
  )
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const summary = JSON.parse(
    readFileSync(path.join(output, "extraction-summary.json"), "utf8")
  );
  assert.deepEqual(
    new Set(occurrences.map((occurrence) => occurrence.occurrenceKind)),
    new Set(OCCURRENCE_KINDS)
  );
  assert.equal(summary.scannerResults.length, 19);
  assert.equal(summary.failedOccurrenceKinds.length, 0);
  assert.equal(
    new Set(occurrences.map((item) => item.occurrenceId)).size,
    occurrences.length
  );
  const classOccurrence = occurrences.find(
    (occurrence) =>
      occurrence.occurrenceKind === "utility-class" &&
      occurrence.rawValue === "gap-2 px-2 mb-3"
  );
  assert.deepEqual(classOccurrence.sourcePayload.classExpression.rawTokens, [
    "gap-2",
    "px-2",
    "mb-3",
  ]);
  assert.ok(
    occurrences.some(
      (occurrence) =>
        occurrence.occurrenceKind === "token-alias" &&
        occurrence.property === "typography.label"
    )
  );
  assert.ok(
    occurrences.some(
      (occurrence) =>
        occurrence.occurrenceKind === "css-declaration" &&
        occurrence.location.file === "src/indented.sass" &&
        occurrence.property === "color"
    )
  );
  assert.ok(
    occurrences.some(
      (occurrence) =>
        occurrence.occurrenceKind === "css-custom-property" &&
        occurrence.location.file === "src/indented.sass" &&
        occurrence.property === "--card-color"
    )
  );
  assert.equal(
    occurrences.some(
      (occurrence) =>
        occurrence.occurrenceKind === "motion-transition" &&
        occurrence.rawValue === "true"
    ),
    false
  );

  const secondOutput = path.join(fixture, "out-second");
  write(
    fixture,
    "miner.ndjson",
    `${JSON.stringify({ ...minerRow, id: "occ:unstable-second" })}\n`
  );
  const repeated = spawnSync(
    process.execPath,
    [
      script,
      "--root",
      fixture,
      "--out",
      secondOutput,
      "--run-id",
      "tokenize-fixture",
      "--miner-occurrences",
      path.join(fixture, "miner.ndjson"),
      "--generated-at",
      "2026-01-01T00:00:00.000Z",
    ],
    { encoding: "utf8" }
  );
  assert.equal(repeated.status, 0, `${repeated.stdout}\n${repeated.stderr}`);
  const repeatedOccurrences = readFileSync(
    path.join(secondOutput, "design-occurrences.ndjson"),
    "utf8"
  )
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.deepEqual(
    repeatedOccurrences.map((item) => item.occurrenceId),
    occurrences.map((item) => item.occurrenceId)
  );

  write(fixture, "src/a.jsx", "export const A = () => null;\n");
  const unrelatedRow = {
    ...minerRow,
    id: "occ:unrelated-earlier",
    file: "src/a.jsx",
    line: 1,
    column: 1,
    componentOwner: "A",
    fullClassName: "m-1",
    tokens: ["m-1"],
  };
  write(
    fixture,
    "miner.ndjson",
    `${JSON.stringify(unrelatedRow)}\n${JSON.stringify({
      ...minerRow,
      id: "occ:shifted-original",
    })}\n`
  );
  const thirdOutput = path.join(fixture, "out-third");
  const withEarlierOccurrence = spawnSync(
    process.execPath,
    [
      script,
      "--root",
      fixture,
      "--out",
      thirdOutput,
      "--run-id",
      "tokenize-fixture",
      "--miner-occurrences",
      path.join(fixture, "miner.ndjson"),
      "--generated-at",
      "2026-01-01T00:00:00.000Z",
    ],
    { encoding: "utf8" }
  );
  assert.equal(
    withEarlierOccurrence.status,
    0,
    `${withEarlierOccurrence.stdout}\n${withEarlierOccurrence.stderr}`
  );
  const thirdOccurrences = readFileSync(
    path.join(thirdOutput, "design-occurrences.ndjson"),
    "utf8"
  )
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const originalBefore = occurrences.find(
    (item) =>
      item.occurrenceKind === "utility-class" &&
      item.location.file === "src/component.jsx" &&
      item.rawValue === "p-2 px-1"
  );
  const originalAfter = thirdOccurrences.find(
    (item) =>
      item.occurrenceKind === "utility-class" &&
      item.location.file === "src/component.jsx" &&
      item.rawValue === "p-2 px-1"
  );
  assert.equal(originalAfter.occurrenceId, originalBefore.occurrenceId);
});

test(
  "target TypeScript supplement retains single-token and unresolved JSX classes",
  { skip: !process.env.TOKENIZE_TEST_ROOT },
  () => {
    const fixture = mkdtempSync(path.join(tmpdir(), "tokenize-ast-test-"));
    const output = path.join(fixture, "out");
    write(fixture, "package.json", JSON.stringify({ private: true }));
    symlinkSync(
      path.join(process.env.TOKENIZE_TEST_ROOT, "node_modules"),
      path.join(fixture, "node_modules"),
      "dir"
    );
    write(
      fixture,
      "tokens/tokenization.config.json",
      JSON.stringify({ sourceRoots: ["src"] })
    );
    write(
      fixture,
      "src/component.tsx",
      `
        export function Fixture({ className, dynamicClass, condition }) {
          return <>
            <div className="m-1" />
            <div className={className} />
            <div className={\`p-2 \${condition ? "mb-2" : dynamicClass}\`} />
          </>;
        }
      `
    );
    write(fixture, "miner.ndjson", "");
    const script = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "extract-design-occurrences.mjs"
    );
    const result = spawnSync(
      process.execPath,
      [
        script,
        "--root",
        fixture,
        "--out",
        output,
        "--run-id",
        "tokenize-ast-fixture",
        "--miner-occurrences",
        path.join(fixture, "miner.ndjson"),
        "--generated-at",
        "2026-01-01T00:00:00.000Z",
      ],
      { encoding: "utf8" }
    );
    assert.equal(result.status, 2, `${result.stdout}\n${result.stderr}`);
    const occurrences = readFileSync(
      path.join(output, "design-occurrences.ndjson"),
      "utf8"
    )
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .filter((occurrence) => occurrence.occurrenceKind === "utility-class");
    assert.ok(occurrences.some((occurrence) => occurrence.rawValue === "m-1"));
    const pureDynamic = occurrences.find((occurrence) =>
      occurrence.sourcePayload.classExpression.unresolvedDynamicFragments.includes(
        "className"
      )
    );
    assert.equal(pureDynamic.rawValue, "");
    assert.equal(pureDynamic.reconciliation.status, "opaque");
    const mixed = occurrences.filter((occurrence) =>
      occurrence.sourcePayload.classExpression.unresolvedDynamicFragments.includes(
        "dynamicClass"
      )
    );
    assert.ok(mixed.some((occurrence) => occurrence.rawValue === "p-2 mb-2"));
    assert.ok(mixed.some((occurrence) => occurrence.rawValue === "p-2"));
    assert.ok(
      mixed.every(
        (occurrence) =>
          occurrence.sourcePayload.classExpression.branchExpansionTruncated ===
          false
      )
    );
  }
);
