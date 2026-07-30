import { defineConfig, devices } from "@playwright/test";

// Visual-only Playwright configuration. It is intentionally separate from the
// product E2E suite and uses the local frontend port by default.
const WEB_URL = process.env.PLAYWRIGHT_WEB_URL || "http://localhost:3006";
const STORAGE = "playwright/.auth/admin.json";

const mobileSm = { width: 360, height: 740 };
const mobileMd = { width: 390, height: 844 };
const tablet = { width: 768, height: 1024 };
const desktop = { width: 1440, height: 900 };

// One worker avoids contention in a shared development database and stack.
export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["html", { outputFolder: "playwright-visual-report", open: "never" }],
  ],
  use: {
    baseURL: WEB_URL,
    // Reduced motion makes animated scenes deterministic.
    reducedMotion: "reduce",
    // Chromium on this VPS requires no-sandbox flags.
    launchOptions: {
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    },
  },
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      maxDiffPixelRatio: 0.01,
    },
  },
  // Authentication is injected per scenario by evidence.spec.ts. Every project
  // therefore runs the same route/state contract at a different viewport.
  projects: [
    {
      name: "mobile-sm",
      use: {
        ...devices["Pixel 5"],
        browserName: "chromium",
        viewport: mobileSm,
      },
    },
    {
      name: "mobile-md",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        viewport: mobileMd,
      },
    },
    {
      name: "tablet",
      use: {
        ...devices["iPad Mini"],
        browserName: "chromium",
        viewport: tablet,
      },
    },
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: desktop },
    },
  ],
  // No webServer: the evidence runner performs a fail-fast stack preflight.
});
