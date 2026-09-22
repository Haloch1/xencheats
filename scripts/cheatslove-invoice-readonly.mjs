import { chromium } from "playwright";
import { parseInvoiceDetails, readInvoiceSteps } from "../finance/cheatslove-workflow.mjs";

const invoiceUrl = String(process.argv[2] || "");
const expectedCents = Number(process.argv[3]);
if (!/^https:\/\/plisio\.net\/invoice\/[a-z0-9_-]{8,}$/i.test(invoiceUrl)
  || !Number.isSafeInteger(expectedCents) || expectedCents < 500) {
  throw new Error("Usage: node scripts/cheatslove-invoice-readonly.mjs https://plisio.net/invoice/ID expectedAmountCents");
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(invoiceUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const steps = await readInvoiceSteps(page, { simulation: true, simulationEmail: "simulation@example.com" });
  const details = parseInvoiceDetails(steps.text, page.url());
  const addressVerified = /^0x[a-f0-9]{40}$/i.test(details.address || "");
  const amountMatches = details.amountCents === expectedCents;
  const expiryValid = new Date(details.expiresAt || 0).getTime() > Date.now();
  const ok = !steps.challenge && !steps.needsAttention && Boolean(details.invoiceId)
    && addressVerified && amountMatches && details.network === "Base" && expiryValid;
  console.log(JSON.stringify({
    ok,
    invoiceId: details.invoiceId,
    amountCents: details.amountCents,
    amountMatches,
    network: details.network,
    addressVerified,
    expiryValid,
    challenge: steps.challenge || null,
    needsAttention: steps.needsAttention || null,
  }));
  if (!ok) process.exitCode = 1;
} finally {
  await browser.close();
}
