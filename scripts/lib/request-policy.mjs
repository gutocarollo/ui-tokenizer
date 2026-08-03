export function isFrameworkDiagnosticRequest(method, requestUrl) {
  if (method !== "POST") return false;
  try {
    return new URL(requestUrl).pathname === "/__nextjs_original-stack-frames";
  } catch {
    return false;
  }
}
