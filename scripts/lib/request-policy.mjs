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
