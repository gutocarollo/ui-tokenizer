import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("visual stability is the final paint-affecting operation before the durable screenshot", () => {
  const source = readFileSync(new URL("../../tests/visual/evidence.spec.ts", import.meta.url), "utf8");
  const axe = source.lastIndexOf("const axeViolationIds = await runAxe(page)");
  const overflow = source.lastIndexOf("const overflow = await detectHorizontalOverflow(page)");
  const tooling = source.lastIndexOf("await suppressDevTooling(page)");
  const fonts = source.lastIndexOf("await settleDocumentFonts(page)");
  const stability = source.lastIndexOf("const stabilityMasks = await waitForVisualStability(");
  const durableScreenshot = source.lastIndexOf("await page.screenshot({ ...screenshotOptions, fullPage })");

  for (const [label, index] of Object.entries({ axe, overflow, tooling, fonts, stability, durableScreenshot })) {
    assert.notEqual(index, -1, `${label} operation must remain explicit in evidence.spec.ts`);
  }
  assert.ok(axe < overflow, "axe must finish before overflow inspection");
  assert.ok(overflow < tooling, "overflow inspection must finish before tooling suppression");
  assert.ok(tooling < fonts, "font settlement must run after paint-affecting probes");
  assert.ok(fonts < stability, "paint-affecting cleanup must finish before stability proof");
  assert.ok(stability < durableScreenshot, "durable screenshot must immediately follow stability proof");
});

test("Chromium compositor determinism flags remain explicit", () => {
  const source = readFileSync(new URL("../../playwright.visual.config.ts", import.meta.url), "utf8");
  for (const flag of [
    "--disable-checker-imaging",
    "--disable-threaded-animation",
    "--run-all-compositor-stages-before-draw",
  ]) {
    assert.match(source, new RegExp(flag.replaceAll("-", "\\-")));
  }
});

test("viewport-sized pages avoid a redundant fullPage CDP surface", () => {
  const source = readFileSync(new URL("../../tests/visual/evidence.spec.ts", import.meta.url), "utf8");
  assert.match(source, /document\.documentElement\.scrollHeight/);
  assert.match(source, /await page\.screenshot\(\{ \.\.\.screenshotOptions, fullPage \}\)/);
  assert.doesNotMatch(source, /await page\.screenshot\(\{ \.\.\.screenshotOptions, fullPage: true \}\)/);
});
