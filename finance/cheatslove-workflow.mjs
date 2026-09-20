/*
 * Simulation-safe Cheats.Love browser workflow.
 *
 * It uses DOM/accessibility selectors only, creates an invoice when a
 * positive test amount is supplied, reads the network/address, and stops
 * before any payment/send/confirm action.
 */

const CHALLENGE_RE = /captcha|cloudflare|verify you are human|two[- ]factor|2fa|security challenge|unusual activity/i;
const AUTH_RE = /sign in to access|forgot password|\blogin\b/i;
const TOPUP_PATH = "/my-account/topup";

function textOf(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function moneyToCents(value) {
  const match = String(value || "").replace(/,/g, "").match(/-?\d+(?:\.\d{1,2})?/);
  return match ? Math.round(Number(match[0]) * 100) : null;
}

function maskAddress(value) {
  const address = textOf(value);
  if (!address) return null;
  return address.length <= 12 ? "[MASKED]" : `${address.slice(0, 6)}…${address.slice(-6)}`;
}

async function pageText(page) {
  return textOf(await page.locator("body").innerText().catch(() => ""));
}

async function clickFirst(page, selectors) {
  for (const selector of selectors) {
    try {
      const locator = typeof selector === "string" ? page.locator(selector).first() : selector;
      if (await locator.isVisible()) {
        await locator.click();
        return locator;
      }
    } catch {
      // Try the next resilient selector.
    }
  }
  return null;
}

async function fillFirst(page, selectors, value) {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if (await locator.isVisible()) {
        await locator.fill(value);
        return locator;
      }
    } catch {
      // Try the next selector.
    }
  }
  return null;
}

function parseInvoiceDetails(text, invoiceUrl, requestedCurrency) {
  const normalized = textOf(text);
  const addressMatch = normalized.match(/(?:address|wallet|recipient|send to)\s*[:\-]?\s*(0x[a-f0-9]{20,}|[a-z0-9]{24,})/i)
    || normalized.match(/\b(0x[a-f0-9]{20,})\b/i);
  const invoiceId = String(invoiceUrl || "").match(/\/invoice\/([a-z0-9_-]{8,})/i)?.[1] || null;
  const networkLabel = normalized.match(/\b(ERC-20|BEP-20|SPL|TRC-20|Base|Ethereum|Polygon|Solana)\b/i)?.[1] || null;
  const expiryText = normalized.match(/(?:expires?|valid until|expiration)\s*[:\-]?\s*([^|.]{4,80})/i)?.[1]?.trim() || null;
  const expiresAt = expiryText && !Number.isNaN(Date.parse(expiryText)) ? new Date(expiryText).toISOString() : null;
  const currency = String(requestedCurrency || "").toUpperCase();
  return {
    address: addressMatch?.[1] || null,
    invoiceId,
    network: currency === "USDC_BASE" ? `Base${networkLabel ? ` (${networkLabel})` : ""}` : networkLabel,
    expiresAt,
  };
}

async function createInvoicePage(context, page) {
  const popup = page.waitForEvent?.("popup", { timeout: 15_000 }).catch(() => null);
  const newPage = context.waitForEvent?.("page", { timeout: 15_000 }).catch(() => null);
  await clickFirst(page, [
    'button:has-text("Create invoice")',
    'button[type="submit"]:has-text("invoice")',
  ]);
  const result = await Promise.race([
    popup || Promise.resolve(null),
    newPage || Promise.resolve(null),
    new Promise((resolve) => setTimeout(() => resolve(null), 15_000)),
  ]);
  if (result) {
    await result.waitForLoadState?.("domcontentloaded").catch(() => {});
    await result.waitForTimeout?.(800);
  }
  return result || page;
}

async function readInvoiceSteps(invoicePage, { simulation, simulationEmail }) {
  let text = await pageText(invoicePage);
  if (CHALLENGE_RE.test(text)) return { challenge: "security-challenge", text };

  const emailInput = await fillFirst(invoicePage, [
    'input[type="email"]',
    'input[autocomplete="email"]',
  ], simulationEmail || "");
  if (emailInput) {
    if (!simulationEmail) return { needsAttention: "The invoice page requires an email before network details can be shown.", text };
    const next = await clickFirst(invoicePage, [
      'button:has-text("To the next step")',
      'button[type="submit"]:has-text("next")',
    ]);
    if (!next) return { needsAttention: "The invoice page did not expose its next-step control.", text };
    await invoicePage.waitForTimeout?.(700);
    text = await pageText(invoicePage);
  }

  const usdcNetwork = await clickFirst(invoicePage, [
    'button:has-text("USDC"):has-text("Choose network")',
  ]);
  if (usdcNetwork) {
    await invoicePage.waitForTimeout?.(300);
    await clickFirst(invoicePage, [
      'button:has-text("USDC_BASE")',
      'button:has-text("ERC-20"):has-text("USDC_BASE")',
    ]);
    await invoicePage.waitForTimeout?.(700);
    text = await pageText(invoicePage);
  }
  return { text, challenge: CHALLENGE_RE.test(text) ? "security-challenge" : null };
}

export async function runCheatsLoveWorkflowSimulation({
  amountCents = 0,
  baseUrl = process.env.CHEATSLOVE_APP_URL || "",
  storageStatePath = process.env.CHEATSLOVE_STORAGE_STATE || "",
  storageStateJson = process.env.CHEATSLOVE_STORAGE_STATE_JSON || "",
  username = process.env.CHEATSLOVE_USERNAME || "",
  password = process.env.CHEATSLOVE_PASSWORD || "",
  simulationEmail = process.env.CHEATSLOVE_SIMULATION_EMAIL || "",
  browserFactory = null,
  playwrightModule = null,
  timeoutMs = 30_000,
  simulation = true,
  includeExactAddress = false,
} = {}) {
  const amount = Math.max(0, Math.round(Number(amountCents) || 0));
  const result = {
    ok: false,
    mode: simulation ? "simulation" : "live",
    status: "UNAVAILABLE",
    amountCents: amount,
    steps: [],
    challenge: null,
    balanceBeforeCents: null,
    balanceAfterCents: null,
    network: null,
    address: null,
    invoiceId: null,
    invoiceUrl: null,
    expiresAt: null,
    paymentId: null,
    supplierRead: null,
    message: "Cheats.Love browser workflow is not configured.",
  };
  if (!baseUrl) {
    result.message = "Set CHEATSLOVE_APP_URL before running the browser workflow.";
    return result;
  }
  if (amount > 0 && amount < 500) {
    result.status = "NEEDS_ATTENTION";
    result.message = "Cheats.Love requires a minimum top-up of $5.00 for invoice simulation.";
    return result;
  }

  let playwright;
  try {
    playwright = playwrightModule || await import("playwright");
  } catch {
    result.message = "Playwright is not installed; API/simulation mode remains available.";
    return result;
  }

  let browser;
  try {
    if (typeof browserFactory === "function") {
      browser = await browserFactory({ playwright, storageStatePath, storageStateJson });
    } else {
      browser = await playwright.chromium.launch({ headless: true });
    }
    let storageOptions = {};
    if (storageStateJson) {
      try { storageOptions = { storageState: JSON.parse(storageStateJson) }; }
      catch { throw new Error("CHEATSLOVE_STORAGE_STATE_JSON is not valid JSON."); }
    } else if (storageStatePath) {
      storageOptions = { storageState: storageStatePath };
    }
    const context = browser.contexts?.()[0] || await browser.newContext(storageOptions);
    const page = context.pages?.()[0] || await context.newPage();
    page.setDefaultTimeout?.(timeoutMs);

    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForTimeout?.(700);
    let initialText = await pageText(page);
    result.steps.push("authenticated-session-opened");
    if (CHALLENGE_RE.test(initialText)) {
      result.status = "NEEDS_ATTENTION";
      result.challenge = "security-challenge";
      result.message = "Cheats.Love presented a CAPTCHA/2FA/security challenge; stopped without submitting anything.";
      return result;
    }

    if (AUTH_RE.test(initialText) && !/balance|wallet|my account|reseller/i.test(initialText)) {
      if (!username || !password) {
        result.status = "NEEDS_ATTENTION";
        result.challenge = "authentication-required";
        result.message = "The saved session is not authenticated and no login secret is configured.";
        return result;
      }
      const userInput = await fillFirst(page, ['input[autocomplete="username"]', 'input[type="text"]'], username);
      const passwordInput = await fillFirst(page, ['input[autocomplete="current-password"]', 'input[type="password"]'], password);
      if (!userInput || !passwordInput) {
        result.status = "NEEDS_ATTENTION";
        result.challenge = "authentication-required";
        result.message = "Cheats.Love login controls were not found with accessible selectors.";
        return result;
      }
      await clickFirst(page, ['button[type="submit"]', 'button:has-text("Sign In")']);
      await page.waitForLoadState?.("domcontentloaded").catch(() => {});
      await page.waitForTimeout?.(900);
      initialText = await pageText(page);
      if (CHALLENGE_RE.test(initialText)) {
        result.status = "NEEDS_ATTENTION";
        result.challenge = "security-challenge";
        result.message = "Cheats.Love presented a CAPTCHA/2FA/security challenge after login; stopped safely.";
        return result;
      }
    }
    if (AUTH_RE.test(initialText) && !/balance|wallet|my account|reseller/i.test(initialText)) {
      result.status = "NEEDS_ATTENTION";
      result.challenge = "authentication-required";
      result.message = "Cheats.Love did not expose an authenticated account after login.";
      return result;
    }

    const balanceMatch = initialText.match(/(?:current\s+balance|balance|wallet)\s*[:\-]?\s*\$?([\d,]+(?:\.\d{1,2})?)/i);
    result.balanceBeforeCents = balanceMatch ? moneyToCents(balanceMatch[1]) : null;
    if (context.request?.get) {
      const meResponse = await context.request.get(new URL("/api/me", new URL(baseUrl).origin).href).catch(() => null);
      if (meResponse?.ok?.()) {
        const me = await meResponse.json().catch(() => null);
        if (Number.isFinite(Number(me?.balance))) result.balanceBeforeCents = Math.round(Number(me.balance) * 100);
      }
      const [accountResponse, topupResponse] = await Promise.all([
        context.request.get(new URL("/api/my-account", new URL(baseUrl).origin).href).catch(() => null),
        context.request.get(new URL("/api/topup", new URL(baseUrl).origin).href).catch(() => null),
      ]);
      const account = accountResponse?.ok?.() ? await accountResponse.json().catch(() => null) : null;
      const topups = topupResponse?.ok?.() ? await topupResponse.json().catch(() => null) : null;
      if (account || topups) {
        result.supplierRead = {
          ordersTotal: Number.isFinite(Number(account?.total)) ? Number(account.total) : null,
          topupsTotal: Number.isFinite(Number(topups?.total)) ? Number(topups.total) : null,
          recentOrders: Array.isArray(account?.orders) ? account.orders.slice(0, 10).map((order) => ({
            id: order.id,
            status: order.status,
            amount: order.price_amount,
            currency: order.price_currency,
            createdAt: order.created_at,
            items: Array.isArray(order.items) ? order.items.map((item) => ({
              productId: item.product_id,
              product: item.product_name,
              quantity: item.quantity,
              unitPrice: item.unit_price,
            })) : [],
          })) : [],
          recentTopups: Array.isArray(topups?.topups) ? topups.topups.slice(0, 10).map((topup) => ({
            id: topup.id,
            orderNumber: topup.order_number,
            amountRequested: topup.amount_requested,
            amountReceived: topup.amount_received,
            currency: topup.currency,
            status: topup.status,
            credited: Boolean(topup.credited),
            createdAt: topup.created_at,
          })) : [],
        };
      }
    }
    result.steps.push("balance-read");

    const topUpUrl = new URL(TOPUP_PATH, new URL(baseUrl).origin).href;
    await page.goto(topUpUrl, { waitUntil: "networkidle", timeout: timeoutMs });
    await page.waitForTimeout?.(500);
    const topUpText = await pageText(page);
    if (CHALLENGE_RE.test(topUpText)) {
      result.status = "NEEDS_ATTENTION";
      result.challenge = "security-challenge";
      result.message = "A security challenge appeared on the top-up page; stopped safely.";
      return result;
    }
    result.steps.push("top-up-page-opened");
    if (!amount) {
      result.status = "READY_FOR_REVIEW";
      result.message = "No positive Safe-to-Reinvest amount is available, so no invoice was created.";
      result.ok = true;
      return result;
    }

    const amountInput = await fillFirst(page, ['input[name*="amount" i]', 'input[placeholder*="amount" i]', 'input[type="number"]', 'input[inputmode="decimal"]'], (amount / 100).toFixed(2));
    if (!amountInput) {
      result.status = "NEEDS_ATTENTION";
      result.message = "Top-up page did not expose an amount input with an accessible selector.";
      return result;
    }
    result.steps.push("amount-entered");

    const select = page.locator("select").first();
    if (!(await select.isVisible?.().catch(() => false))) {
      result.status = "NEEDS_ATTENTION";
      result.message = "Top-up page did not expose a payment-asset selector.";
      return result;
    }
    await select.selectOption?.("USDC_BASE");
    result.steps.push("usdc-base-selected");

    const invoicePage = await createInvoicePage(context, page);
    const invoiceUrl = typeof invoicePage.url === "function" ? textOf(invoicePage.url()) : "";
    const invoiceState = await readInvoiceSteps(invoicePage, { simulation, simulationEmail });
    if (invoiceState.challenge) {
      result.status = "NEEDS_ATTENTION";
      result.challenge = invoiceState.challenge;
      result.message = "A security challenge appeared while reading invoice details; stopped safely.";
      return result;
    }
    if (invoiceState.needsAttention) {
      result.status = "NEEDS_ATTENTION";
      result.message = invoiceState.needsAttention;
      return result;
    }
    const details = parseInvoiceDetails(invoiceState.text, invoiceUrl || invoicePage.url?.(), "USDC_BASE");
    result.network = details.network;
    result.address = includeExactAddress ? details.address : maskAddress(details.address);
    result.invoiceId = details.invoiceId;
    result.invoiceUrl = invoiceUrl || (details.invoiceId ? String(invoicePage.url?.() || "") : null) || null;
    result.expiresAt = details.expiresAt;
    result.paymentId = details.invoiceId;
    result.steps.push("fresh-invoice-opened", "invoice-details-read");
    if (!result.invoiceId || !result.address || !result.network) {
      result.status = "NEEDS_ATTENTION";
      result.message = "Invoice opened, but the exact invoice ID, address, or network could not be verified.";
      return result;
    }
    if (simulation) {
      result.ok = true;
      result.status = "READY_FOR_APPROVAL_TEST";
      result.message = "Simulation reached the fresh USDC invoice details and stopped before payment submission.";
      return result;
    }
    result.status = "NEEDS_ATTENTION";
    result.message = "Live payment execution is disabled by policy; enable it explicitly after owner approval.";
    return result;
  } catch (error) {
    result.status = "NEEDS_ATTENTION";
    result.message = error?.message || String(error);
    return result;
  } finally {
    await browser?.close?.().catch(() => {});
  }
}
