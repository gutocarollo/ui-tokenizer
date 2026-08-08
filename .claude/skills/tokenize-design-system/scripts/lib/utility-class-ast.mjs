/**
 * Localiza o literal fisico que possui uma utility arbitraria.
 *
 * O extrator pode projetar um mesmo TemplateExpression em mais de uma folha
 * (quasi estatico + ramos resolvidos). O APPLY precisa editar o no fisico uma
 * vez, preservando interpolacoes, e nao confundir numero de folhas com numero
 * de spans no arquivo.
 */
export function findUtilityClassLiteral({
  ts,
  sourceFile,
  line,
  candidateRaw,
}) {
  let found = null;
  const visit = (node) => {
    if (found) return;
    const isClassContainer =
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateExpression(node);
    if (isClassContainer) {
      const start = node.getStart(sourceFile);
      const location = sourceFile.getLineAndCharacterOfPosition(start);
      const text = node.getText(sourceFile);
      if (location.line + 1 === line && text.includes(candidateRaw)) {
        found = { start, end: node.getEnd(), text };
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

/**
 * Troca o valor arbitrário por custom property sem perder a inferência de tipo
 * que o literal físico carregava. `text-[0.7rem]` é inequivocamente tamanho;
 * `text-[var(--x)]` não é — Tailwind pode tratá-lo como cor. O type hint faz a
 * projeção continuar semanticamente idêntica depois da centralização.
 */
export function variableUtilityCandidate({ candidateRaw, cssReference, axis }) {
  const utility = candidateRaw.match(/(?:^|:)([^:\s]+)-\[/u)?.[1] ?? null;
  const hint =
    utility === "text"
      ? axis === "typography"
        ? "length"
        : axis === "color"
          ? "color"
          : null
      : utility === "bg" && axis === "color"
        ? "color"
        : ["border", "outline"].includes(utility)
          ? axis === "color"
            ? "color"
            : "length"
          : utility === "stroke"
            ? axis === "color"
              ? "color"
              : "length"
            : null;
  const reference = hint ? `${hint}:${cssReference}` : cssReference;
  return candidateRaw.replace(/\[[\s\S]*\]/u, `[${reference}]`);
}
