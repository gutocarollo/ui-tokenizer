import assert from "node:assert/strict";
import test from "node:test";

import {
  installReadOnlyNetworkFixture,
  READ_ONLY_NETWORK_FIXTURES,
} from "../../tests/visual/network-fixtures.mjs";

function fakeRoute({ method, url, headers = {} }) {
  const calls = [];
  return {
    calls,
    route: {
      request() {
        return {
          method: () => method,
          url: () => url,
          headers: () => headers,
        };
      },
      async fulfill(options) {
        calls.push({ kind: "fulfill", options });
      },
      async continue() {
        calls.push({ kind: "continue" });
      },
    },
  };
}

test("read-only network fixture answers credentialed CORS GET and preflight", async () => {
  const fixture = READ_ONLY_NETWORK_FIXTURES.fixtures[0];
  const response = fixture.responses[0];
  const handlers = [];
  const context = {
    async route(matcher, handler) {
      handlers.push({ matcher, handler });
    },
  };
  await installReadOnlyNetworkFixture(context, fixture.id);
  const handler = handlers.find(({ matcher }) =>
    matcher.test(`http://127.0.0.1:8000${response.path}`)
  )?.handler;
  assert.equal(typeof handler, "function");

  const origin = "http://localhost:3103";
  const preflight = fakeRoute({
    method: "OPTIONS",
    url: `http://127.0.0.1:8000${response.path}`,
    headers: {
      origin,
      "access-control-request-headers": "x-impersonate-email",
    },
  });
  await handler(preflight.route);
  assert.deepEqual(preflight.calls, [
    {
      kind: "fulfill",
      options: {
        status: 204,
        headers: {
          "access-control-allow-origin": origin,
          "access-control-allow-credentials": "true",
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-allow-headers": "x-impersonate-email",
          vary: "Origin",
        },
        body: "",
      },
    },
  ]);

  const get = fakeRoute({
    method: "GET",
    url: `http://127.0.0.1:8000${response.path}`,
    headers: { origin },
  });
  await handler(get.route);
  assert.equal(get.calls[0].kind, "fulfill");
  assert.equal(get.calls[0].options.status, response.status);
  assert.equal(
    get.calls[0].options.headers["access-control-allow-origin"],
    origin
  );
  assert.equal(
    get.calls[0].options.headers["access-control-allow-credentials"],
    "true"
  );
});
