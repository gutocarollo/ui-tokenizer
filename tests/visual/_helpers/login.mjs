/* global fetch, localStorage */

/**
 * Real authentication for the visual-evidence engine.
 *
 * Why it exists: the harness `auth.setup.ts` is intentionally a throwing stub.
 * Without a session, protected routes redirect to `/login?nt=1` with HTTP 200.
 * A naive runner would then label the login pixels as the requested route.
 *
 * Method: authenticate through `POST /api/request-token` and inject the result
 * into the same localStorage contract read by
 * `frontend/src/hooks/useLoginMode.js`.
 *
 * Credentials come only from `UI_EVIDENCE_USER` / `UI_EVIDENCE_PASS`, or from
 * a pre-issued `UI_EVIDENCE_SESSION`. Multi-user settings require an admin.
 */
import process from "node:process";

const API_BASE =
  process.env.UI_EVIDENCE_API_BASE || "http://localhost:3005/api";

/**
 * Authenticate through the API and return `{ token, user }`.
 * Missing credentials or login failures throw; fail-open authentication would
 * recreate the mislabeled evidence this helper exists to prevent.
 */
export async function apiLogin() {
  // A pre-issued `{token,user}` session avoids persisting a break-glass admin
  // password or mutating the database merely to take screenshots.
  const preIssued = process.env.UI_EVIDENCE_SESSION;
  if (preIssued) {
    const parsed = JSON.parse(preIssued);
    if (!parsed?.token || !parsed?.user) {
      throw new Error(
        "ui-evidence: UI_EVIDENCE_SESSION must be JSON shaped as {token,user}"
      );
    }
    return { token: parsed.token, user: parsed.user };
  }
  const username = process.env.UI_EVIDENCE_USER;
  const password = process.env.UI_EVIDENCE_PASS;
  if (!username || !password) {
    throw new Error(
      "ui-evidence: neither UI_EVIDENCE_SESSION nor UI_EVIDENCE_USER/PASS is set; " +
        "authenticated routes cannot be captured. Export a session or credentials, " +
        "or select only anonymous routes such as --routes /login."
    );
  }
  const res = await fetch(`${API_BASE}/request-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(
      `ui-evidence: login failed with HTTP ${res.status} at ${API_BASE}/request-token`
    );
  }
  const data = await res.json();
  if (!data?.valid || !data?.token) {
    throw new Error(
      `ui-evidence: login rejected (valid=${data?.valid}) — ${data?.message ?? "no message"}`
    );
  }
  return { token: data.token, user: data.user };
}

/**
 * Apply the session to a Playwright BrowserContext before the first paint.
 * @param {import('@playwright/test').BrowserContext} context
 * @param {{token: string, user: object}} session
 */
export async function applySession(context, session) {
  await context.addInitScript(
    ({ t, u }) => {
      try {
        localStorage.setItem("makersai_authToken", t);
        localStorage.setItem("makersai_user", u);
        localStorage.setItem("makersai_authTimestamp", String(Date.now()));
      } catch {
        /* A storage-less about:blank context is harmless; the next page retries. */
      }
    },
    { t: session.token, u: JSON.stringify(session.user) }
  );
}

/** Authenticate and apply the resulting session to the context. */
export async function loginForVisualEvidence(context) {
  const session = await apiLogin();
  await applySession(context, session);
  return session;
}
