import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
  type Response,
} from "@playwright/test";
import axe from "axe-core";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  captureStem,
  matrixScenarioId,
} from "../../scripts/lib/evidence-matrix.mjs";
import {
  filterDevToolingConsoleErrors,
  isFrameworkDiagnosticRequest,
  normalizeVolatileDiagnosticSignal,
} from "../../scripts/lib/request-policy.mjs";
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
  stabilityMaskSelectors?: string[];
  stabilityRationale?: string;
  freezeClock?: boolean;
  fixedTime?: boolean;
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
const MASK_COLOR = "#6b7280";

/**
 * Playwright rounds a locator's fractional border box before painting `mask`.
 * The excluded element can still contribute one antialiased edge pixel outside
 * that integer box (measured on the dashboard iframe at y=887). Paint a
 * one-pixel outline in the same mask colour during the screenshot so the mask
 * covers the composited edge as well as the element interior. `outline` does
 * not affect layout, and no tolerance budget is introduced.
 */
function stabilityMaskEdgeStyle(stabilityMaskSelectors: string[]) {
  return [...stabilityMaskSelectors, ...MASK_SELECTORS]
    .map(
      (selector) =>
        `:where(${selector}) { outline: 1px solid ${MASK_COLOR} !important; outline-offset: 0 !important; }`
    )
    .join("\n");
}

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
  return [...new Set(values.map(normalizeVolatileDiagnosticSignal))].sort(
    (left, right) => left.localeCompare(right)
  );
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

async function waitForDomAndAssets(page: Page, frozenClock = false) {
  await page
    .waitForLoadState("networkidle", { timeout: 10_000 })
    .catch(() => {});
  await page.evaluate(
    () => (document as Document & { fonts?: FontFaceSet }).fonts?.ready
  );
  if (frozenClock) {
    // The route policy intentionally paused window timers. Quiet-window and
    // image timeout promises below use those same timers and would therefore
    // deadlock the harness. The controller-side wait remains real-time.
    await page.waitForTimeout(600);
    return;
  }
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
  await settleDocumentFonts(page);
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

async function settleDocumentFonts(page: Page) {
  await page.evaluate(async () => {
    // Chromium can re-resolve web fonts while preparing a screenshot
    // (Playwright issue #29968). Waiting only for FontFaceSet.ready is not
    // sufficient when unicode-ranged/variable faces have not been selected
    // with the glyphs that are actually visible on the page.
    await document.fonts.ready;
    // A face may be intentionally unreachable in the read-only network
    // fixture. Its fallback is still a valid settled state; one rejection
    // must not abort the capture while the remaining faces are loaded.
    await Promise.allSettled([...document.fonts].map((font) => font.load()));

    const glyphsByFont = new Map<string, Set<string>>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement;
      const text = node.textContent?.trim();
      if (!element || !text) continue;
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const glyphs = glyphsByFont.get(style.font) ?? new Set<string>();
      for (const glyph of text) glyphs.add(glyph);
      glyphsByFont.set(style.font, glyphs);
    }
    await Promise.allSettled(
      [...glyphsByFont].map(([font, glyphs]) =>
        document.fonts.load(font, [...glyphs].join(""))
      )
    );
    await document.fonts.ready;

    // Materialize the post-font layout before the stability screenshots. Two
    // frames keep the durable screenshot from becoming the first consumer of
    // the newly selected glyph metrics.
    void document.documentElement.offsetWidth;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  });
}

const DEV_TOOLING_SELECTORS = [
  '[data-react-scan="true"]',
  "#react-scan-root",
  "nextjs-portal",
];

async function suppressDevTooling(page: Page) {
  await page.evaluate((selectors) => {
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) element.remove();
    }
  }, DEV_TOOLING_SELECTORS);
}

async function evidenceMasks(
  page: Page,
  stabilityMaskSelectors: string[]
): Promise<Locator[]> {
  for (const selector of stabilityMaskSelectors) {
    const count = await page.locator(selector).count();
    if (count === 0) {
      throw new Error(
        `ui-evidence: declared stability mask matched no element: ${selector}`
      );
    }
  }
  return [...stabilityMaskSelectors, ...MASK_SELECTORS].map((selector) =>
    page.locator(selector)
  );
}

async function waitForVisualStability(
  page: Page,
  stabilityMaskSelectors: string[] = [],
  fullPage = true
): Promise<Locator[]> {
  const masks = await evidenceMasks(page, stabilityMaskSelectors);
  const maskEdgeStyle = stabilityMaskEdgeStyle(stabilityMaskSelectors);
  let prior: string | null = null;
  let identicalStreak = 0;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.waitForTimeout(750);
    await suppressDevTooling(page);
    const bytes = await page.screenshot({
      animations: "disabled",
      caret: "hide",
      fullPage,
      ...(masks.length
        ? { mask: masks, maskColor: MASK_COLOR, style: maskEdgeStyle }
        : {}),
    });
    const digest = createHash("sha256").update(bytes).digest("hex");
    identicalStreak = digest === prior ? identicalStreak + 1 : 0;
    if (identicalStreak >= 2) return masks;
    prior = digest;
  }
  throw new Error(
    "ui-evidence: rendered pixels did not stabilize after 12 probes"
  );
}

async function runAxe(page: Page) {
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

          await page.addInitScript({ content: axe.source });
          await authenticate(context, scenario.authRole);
          const fixedTime = new Date("2026-01-15T12:00:00.000Z");
          if (scenario.freezeClock) {
            await page.clock.install({ time: fixedTime });
            await page.clock.pauseAt(fixedTime);
          } else if (scenario.fixedTime) {
            await page.clock.setFixedTime(fixedTime);
          }
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
          await waitForDomAndAssets(page, scenario.freezeClock === true);
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

          if (scenario.freezeClock) await page.clock.resume();
          const axeViolationIds = await runAxe(page);
          if (scenario.freezeClock) {
            const currentBrowserTime = await page.evaluate(() => Date.now());
            await page.clock.pauseAt(new Date(currentBrowserTime));
            expect(
              normalizedPathname(page.url()),
              `${scenario.scenarioId}: accessibility audit resumed a redirect timer`
            ).toBe(wantedPath);
          }
          const overflow = await detectHorizontalOverflow(page);
          await suppressDevTooling(page);
          // Axe and dev-tool suppression can invalidate Chromium's font
          // selection/layout caches. Re-select the visible glyphs after those
          // probes, then let the screenshot-only stability proof run last.
          await settleDocumentFonts(page);
          // Axe, overflow inspection and dev-tool suppression can invalidate
          // paint/font caches even when they do not mutate the DOM.  The
          // stability proof must therefore be the final operation before the
          // durable screenshot; otherwise we certify probes and persist a
          // different raster.
          const fullPage = await page.evaluate(
            () =>
              Math.max(
                document.documentElement.scrollHeight,
                document.body.scrollHeight
              ) > window.innerHeight + 1
          );
          const stabilityMasks = await waitForVisualStability(
            page,
            scenario.stabilityMaskSelectors ?? [],
            fullPage
          );
          const stem = captureStem(matrixId);
          const pngPath = path.join(outputDirectory, `${stem}.png`);
          const screenshotOptions = {
            path: pngPath,
            animations: "disabled" as const,
            caret: "hide" as const,
            ...(stabilityMasks.length
              ? {
                  mask: stabilityMasks,
                  maskColor: MASK_COLOR,
                  style: stabilityMaskEdgeStyle(
                    scenario.stabilityMaskSelectors ?? []
                  ),
                }
              : {}),
          };
          if (scenario.captureRegion) {
            await page
              .locator(scenario.captureRegion)
              .screenshot(screenshotOptions);
          } else {
            await page.screenshot({ ...screenshotOptions, fullPage });
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
                consoleErrors: stableSignals(
                  filterDevToolingConsoleErrors(consoleErrors)
                ),
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
