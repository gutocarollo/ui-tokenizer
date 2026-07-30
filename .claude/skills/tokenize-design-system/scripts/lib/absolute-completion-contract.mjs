export const ABSOLUTE_COMPLETION_PREDICATES = Object.freeze([
  {
    predicateId: "inventory.class-projection-reconciled",
    category: "inventory",
    evidenceMode: "derived",
    reentryCode: "E-NORMALIZE",
  },
  {
    predicateId: "inventory.dynamic-fragments-accounted",
    category: "inventory",
    evidenceMode: "derived",
    reentryCode: "E-EXTRACT",
  },
  {
    predicateId: "inventory.design-occurrences-terminal",
    category: "inventory",
    evidenceMode: "derived",
    reentryCode: "E-CLASSIFY",
  },
  {
    predicateId: "inventory.occurrence-kinds-covered",
    category: "inventory",
    evidenceMode: "derived",
    reentryCode: "E-EXTRACT",
  },
  {
    predicateId: "inventory.axes-covered",
    category: "inventory",
    evidenceMode: "derived",
    reentryCode: "E-EXTRACT",
  },
  {
    predicateId: "inventory.exceptions-complete",
    category: "inventory",
    evidenceMode: "absolute-report",
    inventoryKind: "invalid-source",
    reentryCode: "E-CLASSIFY",
  },
  {
    predicateId: "tokens.hardcodes-and-arbitrary-zero",
    category: "tokens",
    evidenceMode: "absolute-report",
    inventoryKind: "hardcodes",
    reentryCode: "E-MIGRATION",
  },
  {
    predicateId: "tokens.naming-and-application-zero",
    category: "tokens",
    evidenceMode: "absolute-report",
    inventoryKind: "token-consumption",
    reentryCode: "E-CLASSIFY",
  },
  {
    predicateId: "tokens.classes-emitted-live",
    category: "tokens",
    evidenceMode: "absolute-report",
    inventoryKind: "token-consumption",
    reentryCode: "E-MIGRATION",
  },
  {
    predicateId: "tokens.scale-cardinalities-approved",
    category: "tokens",
    evidenceMode: "absolute-report",
    inventoryKind: "scale-cardinality",
    reentryCode: "E-DECISION",
  },
  {
    predicateId: "tokens.legacy-vocabulary-zero",
    category: "tokens",
    evidenceMode: "absolute-report",
    inventoryKind: "token-consumption",
    reentryCode: "E-MIGRATION",
  },
  {
    predicateId: "tokens.dtcg-parity",
    category: "tokens",
    evidenceMode: "absolute-report",
    inventoryKind: "token-consumption",
    reentryCode: "E-MIGRATION",
  },
  {
    predicateId: "rendered.routes-materialized",
    category: "rendered",
    evidenceMode: "absolute-report",
    inventoryKind: "coverage",
    reentryCode: "E-FIXTURE",
  },
  {
    predicateId: "rendered.scenarios-captured",
    category: "rendered",
    evidenceMode: "derived",
    reentryCode: "E-COMPARE",
  },
  {
    predicateId: "rendered.exact-matrix",
    category: "rendered",
    evidenceMode: "absolute-report",
    inventoryKind: "coverage",
    reentryCode: "E-COMPARE",
  },
  {
    predicateId: "rendered.pairs-integrity",
    category: "rendered",
    evidenceMode: "absolute-report",
    inventoryKind: "coverage",
    reentryCode: "E-COMPARE",
  },
  {
    predicateId: "rendered.runtime-regressions-zero",
    category: "rendered",
    evidenceMode: "absolute-report",
    inventoryKind: "accessibility",
    reentryCode: "E-MIGRATION",
  },
  {
    predicateId: "rendered.batch-effects-satisfied",
    category: "rendered",
    evidenceMode: "absolute-report",
    inventoryKind: "equivalence",
    reentryCode: "E-MIGRATION",
  },
  {
    predicateId: "rendered.image-reviews-complete",
    category: "rendered",
    evidenceMode: "absolute-report",
    inventoryKind: "coverage",
    reentryCode: "E-DECISION",
  },
  {
    predicateId: "process.accepted-batches-reversible",
    category: "process",
    evidenceMode: "absolute-report",
    inventoryKind: "coverage",
    reentryCode: "E-MIGRATION",
  },
  {
    predicateId: "process.final-census-fresh",
    category: "process",
    evidenceMode: "derived",
    reentryCode: "E-EXTRACT",
  },
  {
    predicateId: "process.final-matrix-and-gates-fresh",
    category: "process",
    evidenceMode: "derived",
    reentryCode: "E-COMPARE",
  },
  {
    predicateId: "process.fingerprints-current",
    category: "process",
    evidenceMode: "derived",
    reentryCode: "E-EXTRACT",
  },
  {
    predicateId: "process.final-adversarial-satisfied",
    category: "process",
    evidenceMode: "derived",
    reentryCode: "E-DECISION",
  },
]);

export const ABSOLUTE_COMPLETION_PREDICATE_IDS = Object.freeze(
  ABSOLUTE_COMPLETION_PREDICATES.map(({ predicateId }) => predicateId)
);

export const ABSOLUTE_REPORT_PREDICATES = Object.freeze(
  ABSOLUTE_COMPLETION_PREDICATES.filter(
    ({ evidenceMode }) => evidenceMode === "absolute-report"
  )
);

export const ABSOLUTE_REPORT_PREFIX = "absolute/";

export function absoluteReportId(predicateId) {
  return `${ABSOLUTE_REPORT_PREFIX}${predicateId}`;
}
