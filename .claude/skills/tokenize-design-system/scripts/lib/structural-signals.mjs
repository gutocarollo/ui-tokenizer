export const STRUCTURAL_SIGNALS = Object.freeze([
  ["overlay", /fixed\s+inset-0|z-modal|backdrop|ModalWrapper|createPortal/],
  ["scrollable", /overflow-y-auto|overflow-y-scroll|overflow-scroll/],
  ["grid", /grid-cols-\d|grid\s+grid-cols/],
  ["row", /flex\s+items-center\s+justify-between|group\s|group"/],
  ["field", /<input|<textarea|<select/],
  ["button", /<button/],
  ["directional-border", /border-[trbl]\b|border-(?:top|bottom|left|right)/],
]);

export function structuralSignalsFor(source) {
  return STRUCTURAL_SIGNALS.filter(([, pattern]) => pattern.test(source)).map(
    ([name]) => name
  );
}
