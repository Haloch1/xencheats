import assert from "node:assert/strict";
import { runCheatsLoveWorkflowSimulation } from "../finance/cheatslove-workflow.mjs";

function fakePlaywright(bodyText = "Balance: $12.34 Network: Polygon Address: 0x12345678901234567890 Invoice ID: inv_demo_123") {
  const locator = (selector) => ({
    first() { return this; },
    async isVisible() { return true; },
    async innerText() { return bodyText; },
    async click() {},
    async fill() {},
  });
  const page = {
    locator,
    async goto() {},
    async waitForTimeout() {},
    setDefaultTimeout() {},
  };
  const context = { pages: () => [page], newPage: async () => page };
  return { chromium: { launch: async () => ({ contexts: () => [context], close: async () => {} }) } };
}

const ready = await runCheatsLoveWorkflowSimulation({
  amountCents: 500,
  baseUrl: "https://supplier.example",
  playwrightModule: fakePlaywright(),
  simulation: true,
});
assert.equal(ready.status, "READY_FOR_REVIEW");
assert.equal(ready.ok, true);
assert.equal(ready.amountCents, 500);
assert.equal(ready.network, "Polygon");
assert.equal(ready.invoiceId, "inv_demo_123");

const challenged = await runCheatsLoveWorkflowSimulation({
  amountCents: 500,
  baseUrl: "https://supplier.example",
  playwrightModule: fakePlaywright("Balance: $12.34 CAPTCHA verification required"),
  simulation: true,
});
assert.equal(challenged.status, "NEEDS_ATTENTION");
assert.equal(challenged.challenge, "security-challenge");

console.log("cheatslove-workflow.test.mjs: all assertions passed");
