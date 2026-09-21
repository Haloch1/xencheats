import path from "node:path";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const DEFAULT_HOME_URL = "https://www.coinbase.com/home";
const DEFAULT_PROFILE_DIR = path.join(
  process.env.LOCALAPPDATA || path.join(process.env.HOME || process.cwd(), "AppData", "Local"),
  "XenReinvestmentBridge",
  "CoinbaseProfile",
);

function text(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cents(value) {
  const match = String(value ?? "").replace(/,/g, "").match(/(?:\$\s*)?([0-9]+(?:\.[0-9]{1,8})?)/);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isFinite(number) ? Math.round(number * 100) : null;
}

function dollars(value) {
  const number = Number(value);
  return Number.isFinite(number) ? (number / 100).toFixed(2) : null;
}

function normalizedNetwork(value) {
  return text(value).toLowerCase().replace(/\([^)]*\)/g, "").replace(/[-_\s]+/g, "");
}

function enabled(value) {
  return /^(1|true|yes|on)$/i.test(String(value || ""));
}

export function validateCoinbaseOperatorPlan(plan = {}) {
  const required = ["fundingPlanId", "asset", "amountCents", "recipient", "network", "invoiceId", "invoiceExpiration"];
  const missing = required.filter((key) => plan[key] == null || String(plan[key]).trim() === "");
  if (missing.length) throw new Error(`COINBASE_OPERATOR_INPUT_MISSING:${missing.join(",")}`);
  if (String(plan.asset).toUpperCase() !== "USDC") throw new Error("COINBASE_OPERATOR_ASSET_MISMATCH");
  if (!Number.isSafeInteger(Number(plan.amountCents)) || Number(plan.amountCents) <= 0) throw new Error("COINBASE_OPERATOR_AMOUNT_INVALID");
  if (!/^0x[a-f0-9]{40}$/i.test(String(plan.recipient).trim())) throw new Error("COINBASE_OPERATOR_RECIPIENT_INVALID");
  const expiration = new Date(plan.invoiceExpiration);
  if (!Number.isFinite(expiration.getTime()) || expiration.getTime() <= Date.now()) throw new Error("COINBASE_OPERATOR_INVOICE_EXPIRED");
  return Object.freeze({
    fundingPlanId: String(plan.fundingPlanId),
    asset: "USDC",
    amountCents: Number(plan.amountCents),
    recipient: String(plan.recipient).trim(),
    network: text(plan.network),
    invoiceId: String(plan.invoiceId),
    invoiceExpiration: expiration.toISOString(),
    liveExecutionAuthorized: plan.liveExecutionAuthorized === true,
  });
}

export function parseCoinbaseReview(textValue) {
  const value = String(textValue || "").replace(/\u00a0/g, " ");
  const sendMatches = [...value.matchAll(/Send\s+\$\s*([0-9][0-9,]*(?:\.[0-9]{1,8})?)\s+in\s+([A-Z0-9]+)/ig)];
  const sendMatch = sendMatches.at(-1) || null;
  const reviewText = sendMatch ? value.slice(sendMatch.index) : value;
  const recipientMatch = reviewText.match(/Send\s+to\s*(?:\r?\n\s*)+(0x[a-f0-9]{40}|[a-f0-9]{40,})/i);
  const networkMatch = reviewText.match(/Network\s*(?:\r?\n\s*)+([^\r\n]+)/i);
  const feeMatch = value.match(/incl\.\s*\$\s*([0-9][0-9,]*(?:\.[0-9]{1,8})?)\s+network fee/i);
  const amountMatch = value.match(/(?:^|\n)\s*([0-9][0-9,]*(?:\.[0-9]{1,8})?)\s+USDC\s*(?:\n|$)/i);
  return {
    asset: sendMatch?.[2] ? sendMatch[2].toUpperCase() : null,
    amountCents: sendMatch ? cents(sendMatch[1]) : null,
    recipient: recipientMatch?.[1] || null,
    network: networkMatch ? text(networkMatch[1]).split("\n")[0] : null,
    recipientAmountCents: amountMatch ? cents(amountMatch[1]) : null,
    feeCents: feeMatch ? cents(feeMatch[1]) : null,
    raw: reviewText.slice(-4000),
  };
}

export function compareCoinbaseReview(plan, review) {
  const expected = validateCoinbaseOperatorPlan(plan);
  const matches = {
    asset: review.asset === expected.asset,
    amount: review.amountCents === expected.amountCents,
    recipient: String(review.recipient || "").toLowerCase() === expected.recipient.toLowerCase(),
    network: normalizedNetwork(review.network) === normalizedNetwork(expected.network),
    recipientAmount: review.recipientAmountCents == null || review.recipientAmountCents >= expected.amountCents,
  };
  return { matches, ok: Object.values(matches).every(Boolean), expected, review };
}

export function detectCoinbaseSecurityChallenge(url, body) {
  const value = `${url || ""}\n${body || ""}`.toLowerCase();
  const markers = ["captcha", "verify your identity", "enter your code", "security check", "device confirmation", "passkey", "two-factor", "2fa", "challenge"];
  return markers.find((marker) => value.includes(marker)) || null;
}

async function browserSession({ cdpUrl, profileDir, profileName, headless } = {}) {
  if (cdpUrl) {
    try {
      const browser = await chromium.connectOverCDP(cdpUrl);
      return { context: browser.contexts()[0], close: async () => {}, ownsBrowser: false };
    } catch (error) {
      if (!profileDir) throw new Error(`COINBASE_BROWSER_UNAVAILABLE:${error.message}`);
    }
  }
  const context = await chromium.launchPersistentContext(path.resolve(profileDir || DEFAULT_PROFILE_DIR), {
    channel: process.env.XEN_COINBASE_BROWSER_CHANNEL || "chrome",
    headless: headless ?? enabled(process.env.XEN_COINBASE_BROWSER_HEADLESS),
    args: profileName ? [`--profile-directory=${profileName}`] : [],
  });
  return { context, close: () => context.close().catch(() => {}), ownsBrowser: true };
}

async function firstVisible(locator) {
  const count = await locator.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    if (await locator.nth(index).isVisible().catch(() => false)) return locator.nth(index);
  }
  return null;
}

async function waitVisible(locator, timeout = 15_000) {
  await locator.first().waitFor({ state: "visible", timeout }).catch(() => {});
  return firstVisible(locator);
}

async function waitEnabled(locator, timeout = 15_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await locator.isEnabled().catch(() => false)) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function clickNetwork(page, network) {
  const slug = normalizedNetwork(network);
  const candidate = page.getByTestId(`l2-list-item-${slug}-cell-pressable`);
  const candidateVisible = await waitVisible(candidate, 10_000);
  if (candidateVisible) {
    await candidateVisible.click();
    return;
  }
  const byText = firstVisible(page.getByText(new RegExp(`^${text(network).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")));
  if (!byText) throw new Error("COINBASE_OPERATOR_NETWORK_NOT_FOUND");
  await byText.click();
}

export async function runCoinbaseBrowserOperator(input, {
  context,
  page,
  cdpUrl = process.env.XEN_COINBASE_BROWSER_CDP_URL || "",
  profileDir = process.env.XEN_COINBASE_BROWSER_PROFILE_DIR || DEFAULT_PROFILE_DIR,
  profileName = process.env.XEN_COINBASE_BROWSER_PROFILE_NAME || "Default",
  homeUrl = process.env.XEN_COINBASE_BROWSER_URL || DEFAULT_HOME_URL,
  dryRun = true,
  allowLiveSend = false,
  onReview = null,
  onBeforeSend = null,
} = {}) {
  const plan = validateCoinbaseOperatorPlan(input);
  const session = context ? { context, close: async () => {}, ownsBrowser: false } : await browserSession({ cdpUrl: String(cdpUrl).trim(), profileDir, profileName });
  try {
    const activePage = page || session.context.pages().find((candidate) => /coinbase\.com/i.test(candidate.url())) || session.context.pages()[0] || await session.context.newPage();
    await activePage.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await activePage.waitForTimeout(2500);
    let body = await activePage.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
    const challenge = detectCoinbaseSecurityChallenge(activePage.url(), body);
    if (challenge) return { status: "NEEDS_OWNER_ACTION", reason: `Coinbase security challenge: ${challenge}` };
    if (!/coinbase\.com/i.test(activePage.url()) || /sign\s*in|log\s*in/i.test(body)) return { status: "LOGIN_REQUIRED", reason: "Authenticated Coinbase session is not available." };

    const sendButton = await waitVisible(activePage.getByTestId("quick-action-send-cell-pressable"));
    if (!sendButton) throw new Error("COINBASE_OPERATOR_SEND_ENTRY_NOT_FOUND");
    await sendButton.click();
    await activePage.getByTestId("recipient-search-input").fill(plan.recipient);
    const recipientButton = await waitVisible(activePage.getByTestId("recipient-manual-address-cell-pressable"));
    if (!recipientButton) throw new Error("COINBASE_OPERATOR_RECIPIENT_NOT_ACCEPTED");
    await recipientButton.click();
    await activePage.getByTestId("send-asset-selector-cell-USDC-cell-pressable").click();
    await clickNetwork(activePage, plan.network);
    const warning = await waitVisible(activePage.getByTestId("network-warning-step-understand"), 4_000);
    if (warning) await warning.click();
    const amountInput = activePage.getByTestId("currency-input");
    if (!await waitVisible(amountInput)) throw new Error("COINBASE_OPERATOR_AMOUNT_FIELD_NOT_FOUND");
    await amountInput.fill(dollars(plan.amountCents));
    const enteredAmountCents = cents(await amountInput.evaluate((element) => element.value || element.textContent || "").catch(() => ""));
    if (enteredAmountCents !== plan.amountCents) throw new Error(`COINBASE_OPERATOR_AMOUNT_ENTRY_MISMATCH:${enteredAmountCents ?? "unknown"}`);
    const preview = activePage.getByTestId("preview-send-button");
    if (!await waitEnabled(preview)) throw new Error("COINBASE_OPERATOR_PREVIEW_DISABLED");
    await preview.click();
    await activePage.waitForTimeout(1000);
    body = await activePage.locator("body").innerText({ timeout: 10_000 });
    const review = parseCoinbaseReview(body);
    const comparison = compareCoinbaseReview(plan, review);
    if (!comparison.ok) return { status: "REVIEW_MISMATCH", ...comparison };
    const finalButton = await waitVisible(activePage.getByTestId("send-now-button"));
    if (!finalButton) throw new Error("COINBASE_OPERATOR_FINAL_SEND_NOT_FOUND");
    await onReview?.({ ...comparison, finalSendFound: true });
    if (dryRun || !allowLiveSend) {
      return { status: "REVIEWING", dryRun: true, finalSendFound: true, finalSendClicked: false, ...comparison };
    }
    if (!enabled(process.env.COINBASE_SEND_ENABLED) || !enabled(process.env.FINANCE_LIVE_EXECUTION_ENABLED)) {
      return { status: "COINBASE_SEND_DISABLED", dryRun: true, finalSendFound: true, finalSendClicked: false, ...comparison };
    }
    if (!plan.liveExecutionAuthorized) throw new Error("COINBASE_PLAN_AUTHORIZATION_MISSING");
    await onBeforeSend?.({ ...comparison, finalSendFound: true });
    await finalButton.click();
    await activePage.waitForTimeout(1500);
    body = await activePage.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
    const postChallenge = detectCoinbaseSecurityChallenge(activePage.url(), body);
    if (postChallenge) return { status: "NEEDS_OWNER_ACTION", reason: `Coinbase security challenge: ${postChallenge}`, submitted: false, ...comparison };
    const transactionId = body.match(/(?:transaction|transfer|send)[^\n]{0,80}\b([0-9a-f]{16,}|0x[0-9a-f]{16,})\b/i)?.[1] || null;
    if (!transactionId) return { status: "RECONCILIATION_REQUIRED", submitted: true, ...comparison };
    return { status: "SUBMITTED", submitted: true, transactionId, ...comparison };
  } finally {
    await session.close();
  }
}

function bridgeUrl(endpoint) {
  return `${String(process.env.XEN_REINVESTMENT_BRIDGE_URL || "https://xencheats.wtf").replace(/\/+$/, "")}${endpoint}`;
}

async function reportBridge(planId, status, details = {}) {
  const token = String(process.env.XEN_REINVESTMENT_BRIDGE_TOKEN || "").trim();
  const operatorId = String(process.env.XEN_REINVESTMENT_OPERATOR_ID || "").trim();
  if (!token || !operatorId) return;
  await fetch(bridgeUrl("/api/bridge/reinvestment/report"), {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "x-xen-bridge-token": token },
    body: JSON.stringify({ planId, operatorId, status, details }),
  }).catch(() => {});
}

async function runJobFile(jobFile) {
  const job = JSON.parse(await readFile(jobFile, "utf8"));
  const invoice = job.invoice || {};
  let result;
  try {
    result = await runCoinbaseBrowserOperator({
      fundingPlanId: job.planId,
      asset: invoice.currency === "USDC_BASE" || invoice.currency === "USDC" ? "USDC" : invoice.asset || "USDC",
      amountCents: Number(job.amountCents),
      recipient: invoice.address,
      network: invoice.network,
      invoiceId: invoice.invoiceId,
      invoiceExpiration: invoice.expiresAt,
      liveExecutionAuthorized: job.liveExecutionAuthorized === true,
    }, {
      dryRun: job.dryRun !== false,
      allowLiveSend: job.dryRun === false,
      onReview: (details) => reportBridge(job.planId, "reviewing", { finalSendFound: true, matches: details.matches }).catch(() => {}),
      onBeforeSend: () => reportBridge(job.planId, "submitting", { finalSendFound: true }).catch(() => {}),
    });
  } catch (error) {
    result = { status: "NEEDS_OWNER_ACTION", reason: String(error?.message || error) };
  }
  const status = result.status === "SUBMITTED" ? "submitted"
    : result.status === "REVIEWING" ? "reviewing"
      : result.status === "NEEDS_OWNER_ACTION" || result.status === "LOGIN_REQUIRED" || result.status === "COINBASE_SEND_DISABLED" ? "needs_owner_action"
        : result.status === "RECONCILIATION_REQUIRED" ? "needs_owner_action" : "failed";
  await reportBridge(job.planId, status, {
    error: result.reason || (status === "failed" ? result.status : null),
    transactionId: result.transactionId || undefined,
    network: result.review?.network || invoice.network,
    asset: result.review?.asset || invoice.currency || "USDC",
    amountCents: result.review?.amountCents || job.amountCents,
    finalSendFound: result.finalSendFound === true,
    finalSendClicked: result.finalSendClicked === true,
  });
  process.stdout.write(`${JSON.stringify({ status: result.status, finalSendClicked: result.finalSendClicked === true })}\n`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const jobIndex = process.argv.indexOf("--job");
  const jobFile = jobIndex >= 0 ? process.argv[jobIndex + 1] : "";
  if (!jobFile) {
    console.error("COINBASE_OPERATOR_JOB_REQUIRED");
    process.exitCode = 2;
  } else {
    runJobFile(jobFile).catch((error) => {
      console.error(String(error?.message || error));
      process.exitCode = 1;
    });
  }
}
