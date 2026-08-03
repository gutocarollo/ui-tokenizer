import test from "node:test";
import assert from "node:assert/strict";

import {
  filterDevToolingConsoleErrors,
  isFrameworkDiagnosticRequest,
} from "./request-policy.mjs";

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

test("react-scan CSP noise is removed only as a complete diagnostic cohort", () => {
  const probe =
    "Fetch API cannot load https://www.react-grab.com/api/version?source=react-scan&v=1";
  const worker =
    "Creating a worker from 'blob:http://localhost/random' violates the Content Security Policy";
  const product = "Product request failed";
  assert.deepEqual(
    filterDevToolingConsoleErrors([probe, worker, product]),
    [product]
  );
  assert.deepEqual(filterDevToolingConsoleErrors([worker, product]), [worker, product]);
});
