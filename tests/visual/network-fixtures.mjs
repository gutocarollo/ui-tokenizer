import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

export const NETWORK_FIXTURE_FILE = fileURLToPath(
  new URL("./network-fixtures.json", import.meta.url)
);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function requireNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim() !== value || !value) {
    throw new Error(`${field} must be a non-empty trimmed string.`);
  }
}

function validateFixtureDocument(document, filePath) {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error(`Network fixture file must contain an object: ${filePath}`);
  }
  requireNonEmptyString(document.schemaVersion, "schemaVersion");
  if (document.readOnly !== true) {
    throw new Error(
      `Network fixture file must declare readOnly=true: ${filePath}`
    );
  }
  if (!Array.isArray(document.fixtures) || document.fixtures.length === 0) {
    throw new Error(`Network fixture file must contain fixtures: ${filePath}`);
  }

  const fixtureIds = new Set();
  for (const fixture of document.fixtures) {
    requireNonEmptyString(fixture?.id, "fixture.id");
    requireNonEmptyString(fixture?.routePattern, `${fixture.id}.routePattern`);
    if (fixtureIds.has(fixture.id)) {
      throw new Error(`Duplicate network fixture ID: ${fixture.id}`);
    }
    fixtureIds.add(fixture.id);
    if (
      !fixture.routeParams ||
      typeof fixture.routeParams !== "object" ||
      Array.isArray(fixture.routeParams)
    ) {
      throw new Error(`${fixture.id}.routeParams must be an object.`);
    }
    for (const [name, value] of Object.entries(fixture.routeParams)) {
      requireNonEmptyString(name, `${fixture.id}.routeParams key`);
      requireNonEmptyString(value, `${fixture.id}.routeParams.${name}`);
    }
    if (
      !Array.isArray(fixture.contractSources) ||
      fixture.contractSources.length === 0
    ) {
      throw new Error(`${fixture.id}.contractSources must not be empty.`);
    }
    for (const source of fixture.contractSources) {
      requireNonEmptyString(source, `${fixture.id}.contractSources`);
      if (path.isAbsolute(source) || source.includes("..")) {
        throw new Error(
          `${fixture.id}.contractSources must use repository-relative paths.`
        );
      }
    }
    if (!Array.isArray(fixture.responses) || fixture.responses.length === 0) {
      throw new Error(`${fixture.id}.responses must not be empty.`);
    }

    const responseKeys = new Set();
    for (const response of fixture.responses) {
      if (response?.method !== "GET") {
        throw new Error(
          `${fixture.id} may declare GET responses only; received ${JSON.stringify(response?.method)}.`
        );
      }
      requireNonEmptyString(response.path, `${fixture.id}.response.path`);
      if (
        !response.path.startsWith("/api/") ||
        response.path.includes("?") ||
        response.path.includes("#") ||
        response.path.includes(":")
      ) {
        throw new Error(
          `${fixture.id} response paths must be concrete /api paths without query strings.`
        );
      }
      if (
        !Number.isInteger(response.status) ||
        response.status < 200 ||
        response.status >= 300
      ) {
        throw new Error(`${fixture.id} response status must be a 2xx integer.`);
      }
      if (!Object.hasOwn(response, "body")) {
        throw new Error(`${fixture.id} response body is required.`);
      }
      const responseKey = `${response.method} ${response.path}`;
      if (responseKeys.has(responseKey)) {
        throw new Error(
          `${fixture.id} contains a duplicate response: ${responseKey}`
        );
      }
      responseKeys.add(responseKey);
    }
  }
  return document;
}

export function loadReadOnlyNetworkFixtures(filePath = NETWORK_FIXTURE_FILE) {
  const source = readFileSync(filePath, "utf8");
  let document;
  try {
    document = JSON.parse(source);
  } catch (error) {
    throw new Error(
      `Invalid network fixture JSON at ${filePath}: ${String(error)}`
    );
  }
  return deepFreeze(validateFixtureDocument(document, filePath));
}

export const READ_ONLY_NETWORK_FIXTURES = loadReadOnlyNetworkFixtures();

export const NETWORK_FIXTURE_IDS = deepFreeze(
  Object.fromEntries(
    READ_ONLY_NETWORK_FIXTURES.fixtures.map((fixture) => [
      fixture.routePattern,
      fixture.id,
    ])
  )
);

export const NETWORK_FIXTURE_REGISTRY_FINGERPRINT = createHash("sha256")
  .update(readFileSync(NETWORK_FIXTURE_FILE))
  .digest("hex");

export function getReadOnlyNetworkFixture(fixtureId) {
  requireNonEmptyString(fixtureId, "networkFixtureId");
  const fixture = READ_ONLY_NETWORK_FIXTURES.fixtures.find(
    (candidate) => candidate.id === fixtureId
  );
  if (!fixture) {
    throw new Error(`Unknown read-only network fixture: ${fixtureId}`);
  }
  return fixture;
}

function exactApiMatcher(apiPath) {
  const escapedPath = apiPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escapedPath}(?:\\?.*)?$`);
}

export async function installReadOnlyNetworkFixture(context, fixtureId) {
  if (fixtureId === null || fixtureId === undefined) return [];
  if (!context || typeof context.route !== "function") {
    throw new Error("A Playwright BrowserContext is required.");
  }

  const fixture = getReadOnlyNetworkFixture(fixtureId);
  for (const response of fixture.responses) {
    await context.route(exactApiMatcher(response.path), async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (request.method() !== "GET" || pathname !== response.path) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: response.status,
        contentType: "application/json",
        body: JSON.stringify(response.body),
      });
    });
  }
  return fixture.responses.map(({ method, path: apiPath, status }) => ({
    method,
    path: apiPath,
    status,
  }));
}
