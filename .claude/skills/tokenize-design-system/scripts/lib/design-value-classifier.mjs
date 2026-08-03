/**
 * Classificacao conservadora do censo de design.
 *
 * O extrator observa muito mais do que hardcodes: referencias ao tema vivo,
 * geometria de SVG, assets, classes compiladas e definicoes de token tambem
 * sao design-occurrence. Este modulo impede que "foi censado" seja traduzido
 * para "precisa virar token".
 *
 * A saida tem tres classes:
 *   - terminal: o sitio ja aponta para contrato/token ou esta fora do escopo;
 *   - actionable: valor fisico simples que um lote pode migrar sem adivinhar;
 *   - unresolved: expressao composta/opaca que precisa de extracao AST mais
 *     granular ou decisao, e portanto NAO pode ser lavada como excecao.
 */

const ASSET_KINDS = new Set([
  "font-asset",
  "image-asset",
  "icon-asset",
  "illustration",
]);

const TOKEN_KINDS = new Set([
  "css-custom-property",
  "token-definition",
  "token-alias",
  "generated-class",
]);

const BEHAVIOURAL_PROPERTIES = new Set([
  "cursor",
  "display",
  "font-style",
  "fontStyle",
  "pointer-events",
  "position",
  "text-align",
  "text-transform",
  "textAlign",
  "textTransform",
  "visibility",
  "white-space",
  "whiteSpace",
]);

const SIMPLE_REFERENCE = /^(?:(?:[A-Za-z_$][\w$]*)(?:\??\.[A-Za-z_$][\w$]*|\[[^\]]+\])+|[A-Z][A-Z0-9_]*|var\(\s*--[\w-]+(?:\s*,[^)]*)?\)|\{[a-z0-9._-]+\})$/i;

const COLOR_LITERAL = /(?:#[a-f\d]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\s*\(|^["']?(?:black|white|transparent|currentColor|inherit)["']?$)/i;
const NUMBER_OR_DIMENSION = /^["']?-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|%|vh|vw|vmin|vmax|ch|ex|s|ms|deg)?["']?$/i;
const SIMPLE_MOTION = /^["'][^"']*(?:\d+(?:\.\d+)?(?:ms|s)|cubic-bezier\(|steps\()[^"']*["']$/i;

function clean(value) {
  return String(value ?? "").trim().replace(/;$/, "").trim();
}

export function isCentralReference(value) {
  return SIMPLE_REFERENCE.test(clean(value));
}

export function isSimplePhysicalLiteral(occurrence) {
  const value = clean(occurrence?.rawValue);
  if (!value || !occurrence?.property) return false;
  if (isCentralReference(value)) return false;
  if (occurrence.axis === "color" || occurrence.occurrenceKind === "gradient") {
    return COLOR_LITERAL.test(value) || /gradient\(/i.test(value);
  }
  if (["spacing", "sizing", "radius", "opacity", "z-index"].includes(occurrence.axis)) {
    return NUMBER_OR_DIMENSION.test(value);
  }
  if (occurrence.axis === "typography") {
    return !BEHAVIOURAL_PROPERTIES.has(occurrence.property) &&
      (NUMBER_OR_DIMENSION.test(value) || /^(?:[1-9]00|normal|bold)$/i.test(value));
  }
  if (occurrence.axis === "motion") return SIMPLE_MOTION.test(value);
  if (occurrence.axis === "border") {
    return NUMBER_OR_DIMENSION.test(value) || COLOR_LITERAL.test(value);
  }
  return false;
}

export function isArbitraryPhysicalUtility(normalized) {
  return (normalized?.candidates ?? []).some((candidate) => {
    const value = String(candidate.value ?? "");
    if (!/^\[.*\]$/s.test(value)) return false;
    const inner = value.slice(1, -1).trim();
    return (
      COLOR_LITERAL.test(inner) ||
      NUMBER_OR_DIMENSION.test(inner) ||
      /gradient\(/i.test(inner)
    );
  });
}

function terminal(status, reason) {
  return { disposition: "terminal", status, reason };
}

/**
 * Classifica UM registro. `normalized` e a projecao da utility-class, quando
 * existe; sem ela uma classe nao pode ser declarada viva por intuicao.
 */
export function classifyDesignOccurrence(
  occurrence,
  { normalized = null, authoredClasses = new Set(), duplicateOf = null } = {}
) {
  const kind = occurrence.occurrenceKind;
  const value = clean(occurrence.rawValue);

  if (TOKEN_KINDS.has(kind)) {
    return terminal(
      "approved-token",
      "a ocorrencia e definicao, alias ou projecao gerada de token; nao e hardcode consumidor"
    );
  }
  if (duplicateOf) {
    return terminal(
      "approved-contract",
      `mesmo sitio ja e representado pela ocorrencia atomica ${duplicateOf}; a projecao duplicada nao e uma segunda divida`
    );
  }
  if (ASSET_KINDS.has(kind)) {
    return terminal(
      "approved-contract",
      "o asset versionado e hashado e o proprio contrato visual; seus bytes nao sao escala de token"
    );
  }
  if (kind === "utility-class") {
    if (isArbitraryPhysicalUtility(normalized)) {
      return {
        disposition: "actionable",
        status: "discovered",
        reason: "utility arbitraria carrega valor fisico e precisa de token nomeado",
      };
    }
    const candidatos = normalized?.candidates ?? [];
    const candidatosCobertos = candidatos.every(
      (candidate) =>
        candidate.status === "valid" || authoredClasses.has(candidate.raw)
    );
    const fragmentos = normalized?.source?.unresolvedDynamicFragments ?? [];
    if (
      candidatosCobertos &&
      (fragmentos.length > 0 ||
        candidatos.some((candidate) => candidate.status === "opaque"))
    ) {
      return terminal(
        "approved-contract",
        "partes estaticas compilam e os fragmentos restantes apontam para composicao/stylesheet central existente"
      );
    }
    if (
      normalized?.reconciliationStatus === "valid" &&
      normalized?.fingerprints?.compiledCssFingerprint
    ) {
      return terminal(
        "approved-token",
        "a classe foi normalizada e sua regra existe no CSS compilado do alvo"
      );
    }
    return {
      disposition: "unresolved",
      status: occurrence.reconciliation?.status ?? "opaque",
      reason:
        occurrence.reconciliation?.reason ??
        "classe sem prova de CSS compilado ou sem reconciliacao explicita",
    };
  }
  if (kind === "svg-presentation") {
    return terminal(
      "approved-contract",
      "atributo encapsulado no contrato do SVG; viewBox/dimensoes sao geometria e pigmento local pertence ao asset"
    );
  }
  if (kind === "motion-keyframe") {
    return terminal(
      "approved-contract",
      "keyframe nomeado e versionado e um contrato de movimento, nao um valor solto de consumo"
    );
  }
  if (BEHAVIOURAL_PROPERTIES.has(occurrence.property)) {
    return terminal(
      "approved-out-of-scope",
      `a propriedade ${occurrence.property} descreve comportamento/layout discreto, nao uma escala de token`
    );
  }
  if (isCentralReference(value)) {
    return terminal(
      "approved-contract",
      "o sitio referencia um contrato central existente (tema, constante, alias ou custom property)"
    );
  }
  if (isSimplePhysicalLiteral(occurrence)) {
    return {
      disposition: "actionable",
      status: "discovered",
      reason: "valor fisico simples em eixo tokenizavel",
    };
  }
  if (kind === "css-declaration" && occurrence.axis === "layout") {
    return terminal(
      "approved-out-of-scope",
      "declaracao de layout estrutural; centralizar o valor nao cria contrato de design reutilizavel"
    );
  }
  if (occurrence.reconciliation?.status === "opaque" || !occurrence.property) {
    return {
      disposition: "unresolved",
      status: occurrence.reconciliation?.status ?? "opaque",
      reason:
        occurrence.reconciliation?.reason ??
        "expressao composta sem propriedade atomica; exige extracao AST antes de qualquer codemod",
    };
  }
  return terminal(
    "approved-out-of-scope",
    "valor local nao corresponde a literal fisico simples nem a escala centralizavel"
  );
}
