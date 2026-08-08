import test from "node:test";
import assert from "node:assert/strict";

import {
  filterDevToolingConsoleErrors,
  isFrameworkDiagnosticRequest,
  normalizeVolatileDiagnosticSignal,
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

test("CSP response nonces are canonicalized without removing the violation", () => {
  const left = "style-src 'nonce-AbC123_-' blocked; use nonce-...";
  const right = "style-src 'nonce-Zyx987+=' blocked; use nonce-...";
  assert.equal(
    normalizeVolatileDiagnosticSignal(left),
    normalizeVolatileDiagnosticSignal(right)
  );
  assert.match(normalizeVolatileDiagnosticSignal(left), /blocked/);
  assert.match(normalizeVolatileDiagnosticSignal(left), /nonce-\.\.\./);
});

test("V8 build frames are canonicalized without removing the error message", () => {
  const dev =
    "[GlobalAcquisition] Error fetching KPIs: TypeError: Failed to fetch\n" +
    "    at Object.fetch (http://localhost:3100/_next/static/chunks/dev-a.js:1:10)\n" +
    "    at queryFn (http://localhost:3100/_next/static/chunks/dev-b.js:2:20)";
  const production =
    "[GlobalAcquisition] Error fetching KPIs: TypeError: Failed to fetch\n" +
    "    at Object.fetch (http://localhost:4200/_next/static/chunks/prod-x.js:9:90)";

  assert.equal(
    normalizeVolatileDiagnosticSignal(dev),
    "[GlobalAcquisition] Error fetching KPIs: TypeError: Failed to fetch"
  );
  assert.equal(
    normalizeVolatileDiagnosticSignal(dev),
    normalizeVolatileDiagnosticSignal(production)
  );
});

test("multiline messages without V8 frames remain intact", () => {
  const message = "Validation failed:\nfield email is required";
  assert.equal(normalizeVolatileDiagnosticSignal(message), message);
});

test("loopback capture ports are canonicalized without erasing request identity", () => {
  const before = "HTTP 401 GET http://localhost:3102/api/calendar/events";
  const after = "HTTP 401 GET http://localhost:3100/api/calendar/events";

  assert.equal(
    normalizeVolatileDiagnosticSignal(before),
    normalizeVolatileDiagnosticSignal(after)
  );
  assert.equal(
    normalizeVolatileDiagnosticSignal(before),
    "HTTP 401 GET http://localhost:<dynamic-port>/api/calendar/events"
  );
  assert.notEqual(
    normalizeVolatileDiagnosticSignal(before),
    normalizeVolatileDiagnosticSignal(
      "HTTP 500 POST http://localhost:3100/api/calendar/events"
    )
  );
  assert.notEqual(
    normalizeVolatileDiagnosticSignal(before),
    normalizeVolatileDiagnosticSignal(
      "HTTP 401 GET http://localhost:3100/api/calendar/other"
    )
  );
});
