import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Response,
} from "@playwright/test";
import axe from "axe-core";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  captureStem,
  matrixScenarioId,
} from "../../scripts/lib/evidence-matrix.mjs";
import { isFrameworkDiagnosticRequest } from "../../scripts/lib/request-policy.mjs";
import { installReadOnlyNetworkFixture } from "./network-fixtures.mjs";
import { THEME_STATES } from "./theme-map.config";

type ScenarioStep = {
  type: string;
  target: string | null;
  value: unknown;
};

type VisualScenario = {
  scenarioId: string;
  route: string;
  routePattern: string;
  routeParams: Record<string, string>;
  fixtureId: string;
  networkFixtureId: string | null;
  authRole: string;
  interactionState: string;
  preconditions: ScenarioStep[];
  actions: ScenarioStep[];
  assertions: ScenarioStep[];
  witness: { type: string; value: string } | null;
  assertReady: ScenarioStep | null;
  captureRegion: string | null;
  expectedVisualEffect: "preserve" | "change" | "mixed";
  expectedRenderedErrorSelector: string | null;
  semanticReadTransports: Array<{
    method: string;
    path: string;
    contractSources: string[];
  }>;
  readOnly: boolean;
};

type EvidenceSelection = {
  schemaVersion: string;
  scenarios: VisualScenario[];
  themes: string[];
  projects: string[];
  locales: string[];
  writingModes: string[];
  expectedScenarioIds: string[];
  matrixFingerprint: string;
};

const selectionPath = process.env.UI_EVIDENCE_SELECTION_FILE;
const outputDirectory = process.env.UI_EVIDENCE_OUTPUT_DIR;
if (!selectionPath || !outputDirectory) {
  throw new Error(
    "Evidence capture is fail-closed: UI_EVIDENCE_SELECTION_FILE and " +
      "UI_EVIDENCE_OUTPUT_DIR are both required. Run scripts/ui-evidence.sh."
  );
}

const selection = JSON.parse(
  readFileSync(selectionPath, "utf8")
) as EvidenceSelection;
if (
  !Array.isArray(selection.scenarios) ||
  !selection.scenarios.length ||
  !Array.isArray(selection.expectedScenarioIds) ||
  !selection.expectedScenarioIds.length
) {
  throw new Error(
    "Evidence capture is fail-closed: the selected matrix is empty or malformed."
  );
}
mkdirSync(outputDirectory, { recursive: true });

const MASK_SELECTORS = (process.env.HARNESS_UI_EVIDENCE_MASK_SELECTORS || "")
  .split(",")
  .map((selector) => selector.trim())
  .filter(Boolean);

function normalizedPathname(url: string) {
  return new URL(url).pathname.replace(/\/$/, "") || "/";
}

function stableUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.slice(0, 1_000);
  }
}

function stableSignals(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function matchesSemanticReadTransport(
  scenario: VisualScenario,
  method: string,
  requestUrl: string
) {
  const pathname = new URL(requestUrl).pathname;
  return (scenario.semanticReadTransports || []).some(
    (transport) => transport.method === method && transport.path === pathname
  );
}

async function authenticate(context: BrowserContext, authRole: string) {
  if (authRole === "anonymous") return;
  const { loginForVisualEvidence } = await import("./_helpers/login.mjs");
  await loginForVisualEvidence(context);
}

async function applyPrecondition(context: BrowserContext, step: ScenarioStep) {
  if (
    step.type !== "local-storage" ||
    !step.target ||
    typeof step.value !== "string"
  ) {
    throw new Error(
      `Unsupported or malformed read-only precondition: ${JSON.stringify(step)}`
    );
  }
  await context.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: step.target, value: step.value }
  );
}

async function performAction(
  page: Page,
  step: ScenarioStep
): Promise<Response | null> {
  switch (step.type) {
    case "goto": {
      if (typeof step.value !== "string")
        throw new Error("goto requires a string value");
      return page.goto(step.value, { waitUntil: "load" });
    }
    case "click":
      if (!step.target) throw new Error("click requires a target");
      await page.locator(step.target).click();
      return null;
    case "fill":
      if (!step.target || typeof step.value !== "string") {
        throw new Error("fill requires a target and string value");
      }
      await page.locator(step.target).fill(step.value);
      return null;
    case "select":
      if (!step.target || typeof step.value !== "string") {
        throw new Error("select requires a target and string value");
      }
      await page.locator(step.target).selectOption(step.value);
      return null;
    case "press":
      if (!step.target || typeof step.value !== "string") {
        throw new Error("press requires a target and string value");
      }
      await page.locator(step.target).press(step.value);
      return null;
    case "check":
      if (!step.target) throw new Error("check requires a target");
      await page.locator(step.target).check();
      return null;
    case "uncheck":
      if (!step.target) throw new Error("uncheck requires a target");
      await page.locator(step.target).uncheck();
      return null;
    case "hover":
      if (!step.target) throw new Error("hover requires a target");
      await page.locator(step.target).hover();
      return null;
    case "wait-for":
      if (!step.target) throw new Error("wait-for requires a target");
      await page.locator(step.target).waitFor({
        state:
          step.value === "attached" ||
          step.value === "detached" ||
          step.value === "hidden"
            ? step.value
            : "visible",
      });
      return null;
    default:
      throw new Error(`Unsupported scenario action: ${step.type}`);
  }
}

async function applyAssertion(page: Page, assertion: ScenarioStep) {
  if (assertion.type !== "assert" || !assertion.target) {
    throw new Error(
      `Unsupported scenario assertion: ${JSON.stringify(assertion)}`
    );
  }
  const locator = page.locator(assertion.target);
  switch (assertion.value) {
    case "attached":
      await locator.waitFor({ state: "attached" });
      break;
    case "visible":
      await expect(locator).toBeVisible();
      break;
    case "hidden":
      await expect(locator).toBeHidden();
      break;
    case "enabled":
      await expect(locator).toBeEnabled();
      break;
    case "disabled":
      await expect(locator).toBeDisabled();
      break;
    default:
      throw new Error(
        `Unsupported assertion value ${JSON.stringify(assertion.value)} for ${assertion.target}`
      );
  }
}

async function applyTheme(
  page: Page,
  theme: string,
  locale: string,
  writingMode: string
) {
  const state = THEME_STATES[theme];
  if (!state) throw new Error(`Unknown theme in selected matrix: ${theme}`);
  await page.evaluate(
    ({ selectedTheme, selectedLocale, selectedWritingMode, selectedState }) => {
      localStorage.setItem("theme", selectedTheme);
      document.documentElement.lang = selectedLocale;
      document.documentElement.dir =
        selectedWritingMode === "rtl" ? "rtl" : "ltr";
      for (const [key, value] of Object.entries(
        selectedState.documentAttrs || {}
      )) {
        document.documentElement.setAttribute(key, value);
      }
      for (const className of selectedState.documentClasses || []) {
        document.documentElement.classList.add(className);
      }
    },
    {
      selectedTheme: theme,
      selectedLocale: locale,
      selectedWritingMode: writingMode,
      selectedState: state,
    }
  );
}

async function waitForDomAndAssets(page: Page) {
  await page
    .waitForLoadState("networkidle", { timeout: 10_000 })
    .catch(() => {});
  await page.evaluate(
    () => (document as Document & { fonts?: FontFaceSet }).fonts?.ready
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let timer = window.setTimeout(resolve, 600);
        const observer = new MutationObserver(() => {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            observer.disconnect();
            resolve();
          }, 600);
        });
        observer.observe(document.body, {
          attributes: true,
          childList: true,
          subtree: true,
        });
        window.setTimeout(() => {
          observer.disconnect();
          resolve();
        }, 8_000);
      })
  );
  await page.evaluate(async () => {
    const elementImages = Array.from(document.images).map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    });
    const backgroundUrls = new Set<string>();
    for (const element of document.querySelectorAll<HTMLElement>("*")) {
      const backgroundImage = getComputedStyle(element).backgroundImage;
      for (const match of backgroundImage.matchAll(
        /url\(["']?([^"')]+)["']?\)/g
      )) {
        if (match[1] && !match[1].startsWith("data:"))
          backgroundUrls.add(match[1]);
      }
    }
    const backgroundImages = [...backgroundUrls].map(
      (url) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          const timeout = window.setTimeout(resolve, 3_000);
          const done = () => {
            window.clearTimeout(timeout);
            resolve();
          };
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
          image.src = url;
        })
    );
    await Promise.all([...elementImages, ...backgroundImages]);
  });
}

async function runAxe(page: Page) {
  await page.addScriptTag({ content: axe.source });
  return page.evaluate(async () => {
    const axeApi = (
      window as Window & {
        axe?: {
          run: (
            context: Document,
            options: Record<string, unknown>
          ) => Promise<{ violations: Array<{ id: string }> }>;
        };
      }
    ).axe;
    if (!axeApi) throw new Error("axe-core did not initialize in the page");
    const result = await axeApi.run(document, { resultTypes: ["violations"] });
    return [
      ...new Set(result.violations.map((violation) => violation.id)),
    ].sort();
  });
}

async function detectHorizontalOverflow(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1 ||
      document.body.scrollWidth > document.body.clientWidth + 1
  );
}

for (const scenario of selection.scenarios) {
  for (const theme of selection.themes) {
    for (const locale of selection.locales) {
      for (const writingMode of selection.writingModes) {
        test(`evidence: ${scenario.scenarioId} [${theme}, ${locale}, ${writingMode}]`, async ({
          page,
          context,
        }, testInfo) => {
          test.skip(
            !selection.projects.includes(testInfo.project.name),
            `Project ${testInfo.project.name} is outside the selected evidence matrix`
          );
          expect(
            scenario.readOnly,
            `${scenario.scenarioId} must be read-only`
          ).toBe(true);

          const matrixId = matrixScenarioId({
            scenarioId: scenario.scenarioId,
            theme,
            project: testInfo.project.name,
            locale,
            writingMode,
          });
          expect(
            selection.expectedScenarioIds,
            `${matrixId} must be declared by the prepared matrix`
          ).toContain(matrixId);

          const consoleErrors: string[] = [];
          const pageErrors: string[] = [];
          const networkFailures: string[] = [];
          const abortedRequests: string[] = [];
          const mutatingRequests: string[] = [];
          const semanticReadRequests: string[] = [];
          page.on("console", (message) => {
            if (message.type() === "error") {
              consoleErrors.push(message.text().slice(0, 1_000));
            }
          });
          page.on("pageerror", (error) => {
            pageErrors.push(String(error).slice(0, 1_000));
          });
          page.on("requestfailed", (request) => {
            const failure = request.failure()?.errorText || "failed";
            const signal = `${request.method()} ${stableUrl(request.url())}: ${failure}`;
            if (failure === "net::ERR_ABORTED") abortedRequests.push(signal);
            else networkFailures.push(signal);
          });
          page.on("request", (request) => {
            if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
              const signal = `${request.method()} ${stableUrl(request.url())}`;
              if (isFrameworkDiagnosticRequest(request.method(), request.url())) {
                // Next dev tools use POST to symbolize stack frames. It is a
                // framework-local diagnostic read, not a product mutation;
                // console/page errors remain recorded independently.
              } else if (
                matchesSemanticReadTransport(
                  scenario,
                  request.method(),
                  request.url()
                )
              ) {
                semanticReadRequests.push(signal);
              } else {
                mutatingRequests.push(signal);
              }
            }
          });
          page.on("response", (response) => {
            if (response.status() >= 400) {
              networkFailures.push(
                `HTTP ${response.status()} ${response.request().method()} ${stableUrl(response.url())}`
              );
            }
          });

          await authenticate(context, scenario.authRole);
          const installedNetworkResponses = await installReadOnlyNetworkFixture(
            context,
            scenario.networkFixtureId
          );
          for (const precondition of scenario.preconditions) {
            await applyPrecondition(context, precondition);
          }
          const themeState = THEME_STATES[theme];
          if (!themeState) throw new Error(`Unknown theme: ${theme}`);
          await context.addInitScript(
            ({ selectedTheme, selectedLocale, selectedWritingMode, seed }) => {
              localStorage.setItem("theme", selectedTheme);
              for (const [key, value] of Object.entries(seed || {})) {
                localStorage.setItem(key, value);
              }
              document.addEventListener(
                "DOMContentLoaded",
                () => {
                  document.documentElement.lang = selectedLocale;
                  document.documentElement.dir =
                    selectedWritingMode === "rtl" ? "rtl" : "ltr";
                },
                { once: true }
              );
            },
            {
              selectedTheme: theme,
              selectedLocale: locale,
              selectedWritingMode: writingMode,
              seed: themeState.seedLocalStorage,
            }
          );

          let navigationResponse: Response | null = null;
          for (const action of scenario.actions) {
            const response = await performAction(page, action);
            if (response) navigationResponse = response;
          }
          expect(
            navigationResponse,
            `${scenario.scenarioId} must contain a successful goto action`
          ).not.toBeNull();
          expect(
            navigationResponse?.status(),
            `${scenario.scenarioId}: an HTTP error page is not evidence`
          ).toBeLessThan(400);

          const wantedPath = scenario.route.replace(/\/$/, "") || "/";
          expect(
            normalizedPathname(page.url()),
            `${scenario.scenarioId}: navigation landed on the wrong route`
          ).toBe(wantedPath);

          const errorSelector =
            process.env.HARNESS_UI_EVIDENCE_ERROR_SELECTOR || "";
          if (errorSelector) {
            if (scenario.expectedRenderedErrorSelector) {
              const expectedError = page.locator(
                scenario.expectedRenderedErrorSelector
              );
              await expect(
                expectedError,
                `${scenario.scenarioId}: the declared rendered error is absent`
              ).toBeVisible();
              expect(
                await page.locator(errorSelector).count(),
                `${scenario.scenarioId}: an undeclared rendered error is present`
              ).toBe(await expectedError.count());
            } else {
              await expect(
                page.locator(errorSelector),
                `${scenario.scenarioId}: the configured rendered-error selector is present`
              ).toHaveCount(0);
            }
          }
          for (const assertion of scenario.assertions) {
            await applyAssertion(page, assertion);
          }
          if (scenario.witness?.type === "visible-text") {
            await expect(
              page.getByText(scenario.witness.value, { exact: false })
            ).toBeVisible();
          } else if (scenario.witness) {
            throw new Error(
              `Unsupported scenario witness: ${JSON.stringify(scenario.witness)}`
            );
          }

          await applyTheme(page, theme, locale, writingMode);
          await waitForDomAndAssets(page);
          await applyTheme(page, theme, locale, writingMode);
          if (scenario.assertReady)
            await applyAssertion(page, scenario.assertReady);

          expect(
            normalizedPathname(page.url()),
            `${scenario.scenarioId}: post-hydration redirect invalidated the capture`
          ).toBe(wantedPath);
          expect(
            mutatingRequests,
            `${scenario.scenarioId}: a read-only evidence scenario issued mutating requests`
          ).toEqual([]);

          const axeViolationIds = await runAxe(page);
          const overflow = await detectHorizontalOverflow(page);
          const stem = captureStem(matrixId);
          const pngPath = path.join(outputDirectory, `${stem}.png`);
          const screenshotOptions = {
            path: pngPath,
            animations: "disabled" as const,
            caret: "hide" as const,
            ...(MASK_SELECTORS.length
              ? {
                  mask: MASK_SELECTORS.map((selector) =>
                    page.locator(selector)
                  ),
                }
              : {}),
          };
          if (scenario.captureRegion) {
            await page
              .locator(scenario.captureRegion)
              .screenshot(screenshotOptions);
          } else {
            await page.screenshot({ ...screenshotOptions, fullPage: true });
          }

          const viewport = page.viewportSize();
          writeFileSync(
            path.join(outputDirectory, `${stem}.meta.json`),
            `${JSON.stringify(
              {
                scenarioId: matrixId,
                baseScenarioId: scenario.scenarioId,
                route: scenario.route,
                routePattern: scenario.routePattern,
                routeParams: scenario.routeParams,
                fixtureId: scenario.fixtureId,
                networkFixtureId: scenario.networkFixtureId,
                installedNetworkResponses,
                interactionState: scenario.interactionState,
                theme,
                project: testInfo.project.name,
                locale,
                writingMode,
                viewport,
                deviceScaleFactor: await page.evaluate(
                  () => window.devicePixelRatio
                ),
                finalUrl: page.url(),
                httpStatus: navigationResponse?.status() ?? null,
                consoleErrors: stableSignals(consoleErrors),
                pageErrors: stableSignals(pageErrors),
                networkFailures: stableSignals(networkFailures),
                abortedRequests: stableSignals(abortedRequests),
                mutatingRequests: stableSignals(mutatingRequests),
                semanticReadRequests: stableSignals(semanticReadRequests),
                expectedRenderedErrorSelector:
                  scenario.expectedRenderedErrorSelector,
                axeViolationIds,
                overflow,
                capturedAt: new Date().toISOString(),
              },
              null,
              2
            )}\n`
          );
        });
      }
    }
  }
}
