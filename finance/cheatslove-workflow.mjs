/*
 * Simulation-safe Cheats.Love browser workflow.
 *
 * The workflow is intentionally a state machine. It uses Playwright's
 * accessibility/DOM locators, never coordinates, and never submits a payment
 * while simulation is enabled. A live run must be explicitly enabled by the
 * caller and is still stopped when a CAPTCHA, 2FA prompt, or security review
 * appears.
 */

const CHALLENGE_RE = /captcha|cloudflare|verify you are human|two[- ]factor|2fa|security challenge|unusual activity/i;
const BALANCE_RE = /(?:balance|wallet)[^$\d]{0,32}\$?([\d,]+(?:\.\d{1,2})?)/i;

function textOf(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function moneyToCents(value) {
  const match = String(value || "").replace(/,/g, "").match(/-?\d+(?:\.\d{1,2})?/);
  return match ? Math.round(Number(match[0]) * 100) : null;
}

async function pageText(page) {
  return textOf(await page.locator("body").innerText().catch(() => ""));
}

async function firstVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) return locator;
  }
  return null;
}

export async function runCheatsLoveWorkflowSimulation({
  amountCents = 0,
  baseUrl = process.env.CHEATSLOVE_APP_URL || "",
  storageStatePath = process.env.CHEATSLOVE_STORAGE_STATE || "",
  browserFactory = null,
  playwrightModule = null,
  timeoutMs = 20_000,
  simulation = true,
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
    paymentId: null,
    message: "Cheats.Love browser workflow is not configured.",
  };
  if (!baseUrl) {
    result.message = "Set CHEATSLOVE_APP_URL before running the browser workflow.";
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
    const launchOptions = { headless: true };
    if (typeof browserFactory === "function") {
      browser = await browserFactory({ playwright, storageStatePath });
    } else {
      browser = await playwright.chromium.launch(launchOptions);
    }
    const context = browser.contexts?.()[0] || await browser.newContext(
      storageStatePath ? { storageState: storageStatePath } : undefined,
    );
    const page = context.pages?.()[0] || await context.newPage();
    page.setDefaultTimeout?.(timeoutMs);

    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    result.steps.push("authenticated-session-opened");
    const initialText = await pageText(page);
    if (CHALLENGE_RE.test(initialText)) {
      result.status = "NEEDS_ATTENTION";
      result.challenge = "security-challenge";
      result.message = "Cheats.Love presented a CAPTCHA/2FA/security challenge; stopped without submitting anything.";
      return result;
    }
    if (/sign in|log in|login/i.test(initialText) && !/balance|wallet/i.test(initialText)) {
      result.status = "NEEDS_ATTENTION";
      result.challenge = "authentication-required";
      result.message = "The saved session is not authenticated; sign in manually and save a session state.";
      return result;
    }

    const balanceMatch = initialText.match(BALANCE_RE);
    result.balanceBeforeCents = balanceMatch ? moneyToCents(balanceMatch[1]) : null;
    result.steps.push("balance-read");

    const topUp = await firstVisible(page, [
      'a:has-text("Top up")', 'a:has-text("Deposit")', 'button:has-text("Top up")',
      'button:has-text("Deposit")', '[aria-label*="top up" i]', '[aria-label*="deposit" i]',
    ]);
    if (!topUp) {
      result.status = "NEEDS_ATTENTION";
      result.message = "Authenticated page did not expose a top-up control with an accessible selector.";
      return result;
    }
    await topUp.click();
    result.steps.push("top-up-page-opened");
    const topUpText = await pageText(page);
    if (CHALLENGE_RE.test(topUpText)) {
      result.status = "NEEDS_ATTENTION";
      result.challenge = "security-challenge";
      result.message = "A security challenge appeared on the top-up page; stopped safely.";
      return result;
    }

    const amountInput = await firstVisible(page, [
      'input[ name="amount" ]', 'input[name*="amount" i]', 'input[placeholder*="amount" i]',
      'input[type="number"]', 'input[inputmode="decimal"]',
    ]);
    if (!amountInput) {
      result.status = "NEEDS_ATTENTION";
      result.message = "Top-up page did not expose an amount input with an accessible selector.";
      return result;
    }
    await amountInput.fill((amount / 100).toFixed(2));
    result.steps.push("amount-entered");

    const usdc = await firstVisible(page, [
      'label:has-text("USDC")', 'button:has-text("USDC")', '[role="radio"]:has-text("USDC")',
      'input[value*="usdc" i]',
    ]);
    if (!usdc) {
      result.status = "NEEDS_ATTENTION";
      result.message = "Top-up page did not expose a USDC payment option with an accessible selector.";
      return result;
    }
    await usdc.click();
    result.steps.push("usdc-selected");

    const invoiceButton = await firstVisible(page, [
      'button:has-text("Generate")', 'button:has-text("Create invoice")',
      'button:has-text("Continue")', 'button:has-text("Pay")',
    ]);
    if (invoiceButton) {
      await invoiceButton.click();
      await page.waitForTimeout(400);
      result.steps.push("invoice-details-requested");
    }
    const invoiceText = await pageText(page);
    if (CHALLENGE_RE.test(invoiceText)) {
      result.status = "NEEDS_ATTENTION";
      result.challenge = "security-challenge";
      result.message = "A security challenge appeared while generating the invoice; stopped safely.";
      return result;
    }
    const network = invoiceText.match(/(?:network|chain)\s*[:\-]?\s*([A-Z0-9 _-]{2,30}?)(?=\s+(?:address|wallet|invoice|payment)\b|$)/i);
    const address = invoiceText.match(/(?:address|wallet)\s*[:\-]?\s*([A-Za-z0-9]{20,})/i);
    const invoice = invoiceText.match(/(?:invoice|payment)\s*(?:id|#)?\s*[:\-]?\s*([A-Za-z0-9_-]{6,})/i);
    result.network = network ? textOf(network[1]) : null;
    result.address = address ? textOf(address[1]) : null;
    result.invoiceId = invoice ? textOf(invoice[1]) : null;
    result.steps.push("invoice-details-read");

    // Simulation must stop before any submit/confirm action. This also makes
    // the workflow safe to run from the worker and approval proposal paths.
    if (simulation) {
      result.ok = true;
      result.status = "READY_FOR_REVIEW";
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
