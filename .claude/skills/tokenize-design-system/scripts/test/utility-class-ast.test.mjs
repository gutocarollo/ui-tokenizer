import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import {
  findUtilityClassLiteral,
  variableUtilityCandidate,
} from "../lib/utility-class-ast.mjs";

const require = createRequire(import.meta.url);
const ts = require("typescript");

test("localiza TemplateExpression e preserva a interpolacao ao trocar utility", () => {
  const source = [
    "const expanded = true;",
    "const node = <div className={`flex px-[63px] ${expanded ? \"max-h-[500px]\" : \"max-h-0\"}`} />;",
  ].join("\n");
  const sourceFile = ts.createSourceFile(
    "sample.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const found = findUtilityClassLiteral({
    ts,
    sourceFile,
    line: 2,
    candidateRaw: "px-[63px]",
  });
  assert.ok(found);
  assert.match(found.text, /\$\{expanded \?/);
  const replacement = found.text.replace(
    "px-[63px]",
    "px-[var(--spacing-component-lead-info-sections-px)]"
  );
  assert.match(replacement, /px-\[var\(--spacing-component-lead-info-sections-px\)\]/);
  assert.match(replacement, /\$\{expanded \?/);
});

test("nao aceita outra linha nem candidato ausente", () => {
  const sourceFile = ts.createSourceFile(
    "sample.tsx",
    "const node = <div className=\"px-[63px]\" />;",
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  assert.equal(findUtilityClassLiteral({
    ts,
    sourceFile,
    line: 2,
    candidateRaw: "px-[63px]",
  }), null);
  assert.equal(findUtilityClassLiteral({
    ts,
    sourceFile,
    line: 1,
    candidateRaw: "px-[64px]",
  }), null);
});

test("preserva o tipo length ao centralizar text arbitrário de tipografia", () => {
  assert.equal(
    variableUtilityCandidate({
      candidateRaw: "text-[0.7rem]",
      cssReference: "var(--typography-component-render-header-cell-text)",
      axis: "typography",
    }),
    "text-[length:var(--typography-component-render-header-cell-text)]"
  );
  assert.equal(
    variableUtilityCandidate({
      candidateRaw: "hover:text-[11px]",
      cssReference: "var(--typography-component-label-text)",
      axis: "typography",
    }),
    "hover:text-[length:var(--typography-component-label-text)]"
  );
});

test("distingue cor ambígua e não inventa hint para utility inequívoca", () => {
  assert.equal(
    variableUtilityCandidate({
      candidateRaw: "text-[#969696]",
      cssReference: "var(--color-component-label-color)",
      axis: "color",
    }),
    "text-[color:var(--color-component-label-color)]"
  );
  assert.equal(
    variableUtilityCandidate({
      candidateRaw: "px-[63px]",
      cssReference: "var(--spacing-component-panel-px)",
      axis: "spacing",
    }),
    "px-[var(--spacing-component-panel-px)]"
  );
});
