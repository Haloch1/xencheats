import { chromium } from "playwright";

export function invoiceIsPaid(body, { amountCents, network } = {}) {
  const text = String(body || "").replace(/\u00a0/g, " ");
  const amount = (Number(amountCents) / 100).toFixed(2);
  const asset = `USDC_${String(network || "").trim().toUpperCase()}`;
  const exactAmount = new RegExp(`(?:^|[^0-9.])${amount.replace(".", "\\.")}\\s+${asset}(?![A-Z0-9_])`, "i");
  return Number.isSafeInteger(Number(amountCents)) && Number(amountCents) > 0
    && /\bCHLV Reseller\b/i.test(text)
    && exactAmount.test(text)
    && /\bPayment completed\b/i.test(text);
}

export function matchesSupplierCredit(row, plan) {
  if (!row || !plan || row.supplier !== "cheatslove" || row.transaction_type !== "deposit" || row.status !== "confirmed") return false;
  const amount = Number(plan.safe_to_reinvest_cents);
  if (!Number.isSafeInteger(amount) || amount <= 0 || Number(row.amount_cents) !== amount) return false;
  const occurredAt = Date.parse(row.occurred_at || "");
  const submittedAt = Date.parse(plan.submitted_at || "");
  if (!Number.isFinite(occurredAt) || !Number.isFinite(submittedAt) || occurredAt < submittedAt) return false;
  const metadata = row.metadata || {};
  const opening = Number(metadata.openingBalanceCents);
  const closing = Number(metadata.closingBalanceCents);
  const orderSpend = Number(metadata.orderSpendCents);
  return Number.isSafeInteger(opening) && Number.isSafeInteger(closing) && Number.isSafeInteger(orderSpend)
    && closing - opening + orderSpend === amount;
}

export async function readPlisioInvoicePaid(invoice, { launch = () => chromium.launch({ headless: true }) } = {}) {
  const invoiceId = String(invoice?.invoiceId || "");
  if (!/^[a-f0-9]{24}$/i.test(invoiceId)) throw new Error("PLISIO_INVOICE_ID_INVALID");
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.goto(`https://plisio.net/invoice/${invoiceId}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForFunction(() => /Payment completed|Awaiting payment|Waiting for payment|Invoice expired/i.test(document.body?.innerText || ""), undefined, { timeout: 15_000 }).catch(() => {});
    const body = await page.locator("body").innerText({ timeout: 10_000 });
    return { paid: invoiceIsPaid(body, invoice), checkedAt: new Date().toISOString() };
  } finally {
    await browser.close().catch(() => {});
  }
}
