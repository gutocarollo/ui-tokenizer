import test from "node:test";
import assert from "node:assert/strict";

import { isFrameworkDiagnosticRequest } from "./request-policy.mjs";

test("Next dev stack-frame diagnostics are not product mutations", () => {
  assert.equal(
    isFrameworkDiagnosticRequest(
      "POST",
      "http://localhost:3010/__nextjs_original-stack-frames"
    ),
    true
  );
  assert.equal(
    isFrameworkDiagnosticRequest("POST", "http://localhost:3010/api/users"),
    false
  );
  assert.equal(
    isFrameworkDiagnosticRequest(
      "GET",
      "http://localhost:3010/__nextjs_original-stack-frames"
    ),
    false
  );
});
