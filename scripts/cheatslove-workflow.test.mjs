import assert from "node:assert/strict";
import { runCheatsLoveWorkflowSimulation } from "../finance/cheatslove-workflow.mjs";

const ADDRESS = `0x${"1".repeat(40)}`;
const INVOICE_ID = "testinvoice12345";

function fakePlaywright({ invoiceAmount = "9.9", asset = "USDC_BASE", challenge = false } = {}) {
  const clicked = [];
  let invoiceStage = "loading";
  const invoiceText = () => {
    if (invoiceStage === "loading") { invoiceStage = "email"; return ""; }
    if (invoiceStage === "email") return "Awaiting Payment... 00:25:46 CHLV Reseller 9.9 USDC_BASE Enter your e-mail To the next step";
    if (invoiceStage === "currency") return "Awaiting Payment... 00:25:44 Choose Currency USDC Choose network";
    if (invoiceStage === "network") return "Awaiting Payment... 00:25:42 Choose Network This currency supports various networks Base USD Coin ERC-20 9.9 USDC_BASE";
    return `Awaiting Payment... 00:25:40 To complete your payment, please send ${invoiceAmount} ${asset} to the address below: ${ADDRESS} ERC-20`;
  };
  const locatorFor = (pageType, selector) => ({
    first() { return this; },
    async isVisible() {
      if (pageType === "topup") return true;
      if (selector === 'input[type="email"]') return invoiceStage === "email";
      if (selector.includes("To the next step")) return invoiceStage === "email";
      if (selector.includes("Choose network")) return invoiceStage === "currency";
      if (selector.includes("USDC_BASE")) return invoiceStage === "network";
      return false;
    },
    async innerText() { return pageType === "invoice" ? invoiceText() : challenge ? "Current balance $12.34 CAPTCHA" : "Current balance $12.34 Create invoice"; },
    async click() {
      clicked.push({ pageType, selector });
      if (selector.includes("To the next step")) invoiceStage = "currency";
      else if (selector.includes("Choose network")) invoiceStage = "network";
      else if (selector.includes("USDC_BASE")) invoiceStage = "details";
    },
    async fill() {},
    async selectOption() {},
    async waitFor() {},
  });
  const invoicePage = {
    locator: (selector) => locatorFor("invoice", selector),
    url: () => invoiceStage === "loading" ? "about:blank" : `https://plisio.net/invoice/${INVOICE_ID}`,
    async evaluate() { return null; }, // The live Plisio invoice has no global invoice.app.
    async waitForLoadState() {},
    async waitForTimeout() {},
  };
  const topupPage = {
    locator: (selector) => locatorFor("topup", selector),
    url: () => "https://res.cheatslove.com/my-account/topup",
    async goto() {},
    async waitForTimeout() {},
    async waitForEvent() { throw new Error("Popup event was missed"); },
    setDefaultTimeout() {},
  };
  const context = {
    pages: () => [topupPage],
    async waitForEvent() { return invoicePage; },
  };
  return {
    clicked,
    module: { chromium: { launch: async () => ({ contexts: () => [context], close: async () => {} }) } },
  };
}

const liveShape = fakePlaywright();
const ready = await runCheatsLoveWorkflowSimulation({
  amountCents: 990,
  baseUrl: "https://res.cheatslove.com/login",
  playwrightModule: liveShape.module,
  simulationEmail: "simulation@example.com",
  simulation: true,
  includeExactAddress: true,
});
assert.equal(ready.status, "READY_FOR_APPROVAL_TEST");
assert.equal(ready.ok, true);
assert.equal(ready.network, "Base");
assert.equal(ready.address, ADDRESS);
assert.equal(ready.invoiceId, INVOICE_ID);
assert.equal(ready.invoiceUrl, `https://plisio.net/invoice/${INVOICE_ID}`);
assert.ok(new Date(ready.expiresAt).getTime() > Date.now());
assert.ok(liveShape.clicked.some(({ selector }) => selector.includes("USDC_BASE")));

const wrongAmount = await runCheatsLoveWorkflowSimulation({
  amountCents: 990,
  baseUrl: "https://res.cheatslove.com/login",
  playwrightModule: fakePlaywright({ invoiceAmount: "9.8" }).module,
  simulationEmail: "simulation@example.com",
  simulation: true,
});
assert.equal(wrongAmount.status, "NEEDS_ATTENTION");
assert.equal(wrongAmount.ok, false);
assert.match(wrongAmount.message, /exact amount/i);

const wrongNetwork = await runCheatsLoveWorkflowSimulation({
  amountCents: 990,
  baseUrl: "https://res.cheatslove.com/login",
  playwrightModule: fakePlaywright({ asset: "USDC_SOL" }).module,
  simulationEmail: "simulation@example.com",
  simulation: true,
});
assert.equal(wrongNetwork.status, "NEEDS_ATTENTION");
assert.equal(wrongNetwork.ok, false);

const belowMinimum = await runCheatsLoveWorkflowSimulation({
  amountCents: 100,
  baseUrl: "https://res.cheatslove.com/login",
  playwrightModule: fakePlaywright().module,
  simulation: true,
});
assert.equal(belowMinimum.status, "NEEDS_ATTENTION");
assert.match(belowMinimum.message, /minimum top-up/i);

const challenged = await runCheatsLoveWorkflowSimulation({
  amountCents: 990,
  baseUrl: "https://res.cheatslove.com/login",
  playwrightModule: fakePlaywright({ challenge: true }).module,
  simulation: true,
});
assert.equal(challenged.status, "NEEDS_ATTENTION");
assert.equal(challenged.challenge, "security-challenge");

console.log("cheatslove-workflow.test.mjs: all assertions passed");
