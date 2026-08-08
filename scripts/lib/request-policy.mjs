export function isFrameworkDiagnosticRequest(method, requestUrl) {
  if (method !== "POST") return false;
  try {
    return new URL(requestUrl).pathname === "/__nextjs_original-stack-frames";
  } catch {
    return false;
  }
}

/**
 * Remove somente o coorte de erros do react-scan/react-grab. O erro de worker
 * blob, isoladamente, poderia ser do produto e permanece; ele só é reconhecido
 * como tooling quando a mesma página também registrou o probe versionado do
 * react-grab.
 */
export function filterDevToolingConsoleErrors(errors) {
  const values = Array.isArray(errors) ? errors : [];
  const hasReactScanProbe = values.some((value) =>
    String(value).includes("react-grab.com/api/version?source=react-scan")
  );
  if (!hasReactScanProbe) return [...values];
  return values.filter((value) => {
    const message = String(value);
    if (message.includes("react-grab.com/api/version?source=react-scan")) {
      return false;
    }
    return !(
      message.includes("Creating a worker from 'blob:") &&
      message.includes("Content Security Policy")
    );
  });
}

/**
 * Canonicalize volatile diagnostic transport while retaining error identity.
 * A CSP nonce changes on every document response. V8 stack frames bind the
 * same error message to build-generated chunks, offsets, and server origins.
 * Neither is product behavior, so preserve the message/directive and remove
 * only those volatile parts.
 */
export function normalizeVolatileDiagnosticSignal(value) {
  return String(value)
    .replace(
      /nonce-(?!\.\.\.)([A-Za-z0-9+/_=-]+)/gu,
      "nonce-<dynamic>"
    )
    .replace(/\n\s+at(?:\s+|$)[\s\S]*$/u, "")
    // The evidence server is intentionally relocatable (before and after may
    // run in distinct worktrees/ports). Keep scheme, loopback host, path,
    // method and status, but make only the ephemeral local port non-semantic.
    .replace(
      /(https?:\/\/(?:localhost|127\.0\.0\.1)):\d+/gu,
      "$1:<dynamic-port>"
    );
}
