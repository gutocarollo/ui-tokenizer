import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyDesignOccurrence,
  isArbitraryPhysicalUtility,
  isCentralReference,
  isSimplePhysicalLiteral,
} from "../lib/design-value-classifier.mjs";

const occurrence = (overrides = {}) => ({
  occurrenceKind: "inline-style",
  axis: "color",
  property: "color",
  rawValue: "'#ef4444'",
  reconciliation: { status: "discovered", reason: null },
  ...overrides,
});

test("referencias centrais nao sao chamadas de hardcode", () => {
  for (const value of [
    "theme.text.layer2",
    "colors.background.layer1",
    "BUTTON_TRANSITION",
    "var(--color-card)",
    "{color.primitive.gray-900}",
  ]) {
    assert.equal(isCentralReference(value), true, value);
    assert.equal(
      classifyDesignOccurrence(occurrence({ rawValue: value })).status,
      "approved-contract",
      value
    );
  }
});

test("literal fisico simples permanece acionavel", () => {
  for (const sample of [
    occurrence({ rawValue: "'#ef4444'" }),
    occurrence({ axis: "spacing", property: "gap", rawValue: "'12px'" }),
    occurrence({ axis: "typography", property: "fontWeight", rawValue: "600" }),
    occurrence({ axis: "motion", property: "transition", rawValue: "'all 200ms ease'" }),
  ]) {
    assert.equal(isSimplePhysicalLiteral(sample), true, sample.rawValue);
    const verdict = classifyDesignOccurrence(sample);
    assert.equal(verdict.disposition, "actionable", sample.rawValue);
    assert.equal(verdict.status, "discovered", sample.rawValue);
  }
});

test("SVG encapsulado, assets e comportamento nao inflam hardcodes", () => {
  assert.equal(
    classifyDesignOccurrence(occurrence({ occurrenceKind: "svg-presentation", property: "fill" })).status,
    "approved-contract"
  );
  assert.equal(
    classifyDesignOccurrence(occurrence({ occurrenceKind: "icon-asset", property: null, rawValue: "icon.svg" })).status,
    "approved-contract"
  );
  assert.equal(
    classifyDesignOccurrence(occurrence({ axis: "layout", property: "cursor", rawValue: "'pointer'" })).status,
    "approved-out-of-scope"
  );
});

test("utility so e terminal com prova de CSS compilado", () => {
  const utility = occurrence({ occurrenceKind: "utility-class", property: null, rawValue: "bg-card" });
  assert.equal(classifyDesignOccurrence(utility).disposition, "unresolved");
  assert.equal(
    classifyDesignOccurrence(utility, {
      normalized: {
        reconciliationStatus: "valid",
        fingerprints: { compiledCssFingerprint: "a".repeat(64) },
      },
    }).status,
    "approved-token"
  );
});

test("utility arbitraria fisica e acionavel; classe autoral e contrato", () => {
  const utility = occurrence({
    occurrenceKind: "utility-class",
    property: null,
    rawValue: "max-h-[300px]",
  });
  const arbitrary = {
    reconciliationStatus: "valid",
    source: { unresolvedDynamicFragments: [] },
    candidates: [
      { raw: "max-h-[300px]", value: "[300px]", status: "valid" },
    ],
    fingerprints: { compiledCssFingerprint: "a".repeat(64) },
  };
  assert.equal(isArbitraryPhysicalUtility(arbitrary), true);
  assert.equal(
    classifyDesignOccurrence(utility, { normalized: arbitrary }).disposition,
    "actionable"
  );

  const authored = {
    reconciliationStatus: "opaque",
    source: { unresolvedDynamicFragments: [] },
    candidates: [
      { raw: "custom-checkbox", value: "checkbox", status: "opaque" },
    ],
    fingerprints: { compiledCssFingerprint: null },
  };
  assert.equal(
    classifyDesignOccurrence(utility, {
      normalized: authored,
      authoredClasses: new Set(["custom-checkbox"]),
    }).status,
    "approved-contract"
  );
});

test("objeto inline composto continua nao resolvido em vez de virar excecao", () => {
  const verdict = classifyDesignOccurrence(
    occurrence({
      property: null,
      rawValue: "color: theme.text.layer2, fontSize: 12",
    })
  );
  assert.equal(verdict.disposition, "unresolved");
  assert.match(verdict.reason, /extracao AST/);
});
