/**
 * Contrato de autenticação da evidência visual — STUB do PROCESSO.
 *
 * O processo é ALVO-AGNÓSTICO (D4, 2026-08-03): este repo não sabe — e não
 * pode saber — como app nenhum autentica. Cada app-alvo fornece a SUA
 * implementação deste módulo no MESMO path da cópia vendorizada
 * (`tests/visual/_helpers/login.mjs`), fazendo o que for preciso: preencher
 * formulário de login, setar cookie de sessão, chamar API e injetar token no
 * storage que o app lê.
 *
 * Contrato consumido por `baseline.spec.ts` e `evidence.spec.ts` (import
 * dinâmico, só em projeto autenticado):
 *
 *   export async function loginForVisualEvidence(context): Promise<session>
 *
 * Regras que a implementação do alvo DEVE seguir:
 * - Credenciais entram por env (`UI_EVIDENCE_SESSION` pré-emitida, ou
 *   `UI_EVIDENCE_USER`/`UI_EVIDENCE_PASS`) — nunca hardcoded.
 * - Falha de login LANÇA. Autenticação fail-open recria a evidência
 *   mal-rotulada que este contrato existe para impedir: rota protegida
 *   redireciona para o login com HTTP 200, e um runner ingênuo rotularia os
 *   pixels do login como a rota pedida.
 */

export async function loginForVisualEvidence(context) {
  const cookieName = process.env.UI_EVIDENCE_AUTH_COOKIE_NAME;
  const cookieValue = process.env.UI_EVIDENCE_AUTH_COOKIE_VALUE;
  const storageKey = process.env.UI_EVIDENCE_AUTH_STORAGE_KEY;
  const storageValue = process.env.UI_EVIDENCE_AUTH_STORAGE_VALUE;
  const webUrl = process.env.PLAYWRIGHT_WEB_URL;

  if (cookieName && cookieValue && webUrl) {
    const url = new URL(webUrl);
    await context.addCookies([
      {
        name: cookieName,
        value: cookieValue,
        domain: url.hostname,
        path: "/",
        secure: url.protocol === "https:",
        sameSite: "Lax",
      },
    ]);
    if (storageKey && storageValue) {
      await context.addInitScript(
        ({ key, value }) => localStorage.setItem(key, value),
        { key: storageKey, value: storageValue }
      );
    }
    return { method: "environment-cookie", cookieName, storageKey: storageKey ?? null };
  }

  throw new Error(
    "ui-evidence: o alvo não forneceu autenticação. Vendorize " +
      "tests/visual/_helpers/login.mjs no alvo ou declare " +
      "UI_EVIDENCE_AUTH_COOKIE_NAME/UI_EVIDENCE_AUTH_COOKIE_VALUE/PLAYWRIGHT_WEB_URL."
  );
}
