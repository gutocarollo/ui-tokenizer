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
  // The first Next dev route compile took 22.4 s in the real 54-scenario run;
  // the evidence contract then allows up to 8 s for a DOM quiet window before
  // fonts/assets, stability screenshots and axe. Playwright's 30 s default is
  // therefore lower than the measured legitimate path and killed /accounts at
  // page.screenshot. Keep failures bounded, but budget the whole measured test.
  timeout: 60_000,
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
    //
    // As flags de DETERMINISMO abaixo nao sao cosmeticas: sem elas a esteira
    // tem piso de ruido proprio. Medido com execucoes NULAS (duas capturas,
    // zero mudanca de codigo entre elas): TODAS acusaram par divergente, de 1 a
    // 5 pixels, sempre na coluna x=293, sempre com delta so no canal AZUL
    // (43 -> 49 -> 55) e com o vizinho x=294 sendo rgb(79,148,208). Ou seja:
    // antialiasing da borda esquerda de um elemento azul sangrando para a
    // coluna anterior, em quantidade que varia entre renders.
    //
    // Enquanto o piso de ruido for maior que zero, uma politica `preserve`
    // (que exige 0 pixel exato alterado) e INSATISFAZIVEL ate por um no-op, e
    // aprovar um lote passa a depender de sorte de render. Raster por software
    // e posicionamento de fonte fixo tiram a GPU da equacao.
    launchOptions: {
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-gpu-compositing",
        "--disable-partial-raster",
        "--disable-checker-imaging",
        "--disable-threaded-animation",
        "--run-all-compositor-stages-before-draw",
        "--disable-skia-runtime-opts",
        "--disable-lcd-text",
        "--disable-font-subpixel-positioning",
        "--force-color-profile=srgb",
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
