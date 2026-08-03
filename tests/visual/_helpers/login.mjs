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

export async function loginForVisualEvidence() {
  throw new Error(
    "ui-evidence: este é o stub do PROCESSO — o app-alvo fornece " +
      "tests/visual/_helpers/login.mjs na cópia vendorizada dele " +
      "(contrato: loginForVisualEvidence(context) autentica e aplica a sessão)."
  );
}
