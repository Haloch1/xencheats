import path from "node:path";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const DEFAULT_HOME_URL = "https://www.coinbase.com/home";
const DEFAULT_CDP_URL = process.platform === "win32" ? "http://127.0.0.1:9222" : "";
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

function usdcMicros(value) {
  const match = String(value ?? "").replace(/,/g, "").match(/^\s*([0-9]+)(?:\.([0-9]{1,6}))?\s*$/);
  if (!match) return null;
  return Number(match[1]) * 1_000_000 + Number((match[2] || "").padEnd(6, "0"));
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

export function localSendLocksAllow(env = process.env) {
  // Render owns the authoritative live gates. The Windows bridge may not
  // define them; an explicitly disabled local gate remains an emergency stop.
  return ["COINBASE_SEND_ENABLED", "FINANCE_LIVE_EXECUTION_ENABLED"]
    .every((key) => env[key] === undefined || enabled(env[key]));
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
  const feeMatch = reviewText.match(/incl\.\s*~?\$\s*([0-9][0-9,]*(?:\.[0-9]{1,8})?)\s+network fee/i);
  const amountMatch = reviewText.match(/(?:^|\n)\s*([0-9][0-9,]*(?:\.[0-9]{1,8})?)\s+USDC\s*(?:\n|$)/i);
  return {
    asset: sendMatch?.[2] ? sendMatch[2].toUpperCase() : null,
    amountCents: sendMatch ? cents(sendMatch[1]) : null,
    recipient: recipientMatch?.[1] || null,
    network: networkMatch ? text(networkMatch[1]).split("\n")[0] : null,
    recipientAmountCents: amountMatch ? cents(amountMatch[1]) : null,
    recipientAmountMicros: amountMatch ? usdcMicros(amountMatch[1]) : null,
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
    recipientAmount: review.recipientAmountMicros != null && review.recipientAmountMicros >= expected.amountCents * 10_000,
  };
  return { matches, ok: Object.values(matches).every(Boolean), expected, review };
}

export function detectCoinbaseSecurityChallenge(url, body) {
  const value = `${url || ""}\n${body || ""}`.toLowerCase();
  const markers = [
    "captcha", "verify your identity", "enter your code", "security check",
    "performing security verification", "verify you are not a bot", "cloudflare",
    "device confirmation", "passkey", "two-factor", "2fa", "challenge",
    "flagged as a scam", "scam warning", "possible scam", "potential scam",
    "may be a scam", "reported as a scam", "suspicious recipient",
    "suspicious address", "possible fraud", "fraud warning",
  ];
  return markers.find((marker) => value.includes(marker)) || null;
}

/* Coinbase confirmation pages vary by account/UI release and often do not
   include the transfer id in visible body text. Keep the evidence parser
   deliberately narrow: only IDs associated with transfer/transaction fields
   or Coinbase transfer URLs are accepted. A missing ID remains a hard
   reconciliation stop; callers must never retry blindly. */
export function extractCoinbaseTransactionEvidence({ url = "", body = "", responses = [] } = {}) {
  const values = [];
  const add = (value) => {
    const candidate = text(value);
    if (!candidate || candidate.length < 8 || candidate.length > 256) return;
    if (!/[0-9]/.test(candidate) && !/^(?:0x|tx|transfer|transaction)[_-]?/i.test(candidate) && candidate.length < 16) return;
    if (!values.includes(candidate)) values.push(candidate);
  };
  const scan = (value) => {
    if (value == null) return;
    if (typeof value === "string") {
      const source = value;
      const patterns = [
        /(?:transaction|transfer)[^\n]{0,80}?(?:id|hash)?\s*[:#=]\s*([A-Za-z0-9_-]{8,128}|0x[a-f0-9]{16,})/ig,
        /(?:transactionId|transferId|txid|txHash|transactionHash)\s*["':=\s]+([A-Za-z0-9_-]{8,128}|0x[a-f0-9]{16,})/ig,
        /(?:\/transfers?\/|\/transactions?\/)([A-Za-z0-9_-]{8,128})/ig,
        /\/tx\/(0x[a-f0-9]{64})(?:[?#/]|$)/ig,
      ];
      for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) add(match[1]);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) scan(item);
      return;
    }
    if (typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        if (/^(id|hash|txid|transactionid|transferid|transactionhash)$/i.test(key)) add(item);
        else if (/transaction|transfer|send/i.test(key)) scan(item);
      }
    }
  };
  scan(url);
  scan(body);
  for (const response of responses || []) scan(response);
  return { transactionId: values[0] || null, candidates: values };
}

export function parseCoinbaseTransferDetails({ body = "", explorerUrl = "" } = {}) {
  const value = String(body).replace(/\u00a0/g, " ");
  const hash = String(explorerUrl).match(/\/tx\/(0x[a-f0-9]{64})(?:[?#/]|$)/i)?.[1] || null;
  const amount = value.match(/(?:^|\n)Amount\s*\n\s*([0-9][0-9,]*(?:\.[0-9]{1,8})?)\s+USDC\b/i)?.[1];
  return {
    transactionHash: hash,
    recipient: value.match(/(?:^|\n)To\s*\n\s*(0x[a-f0-9]{40})\b/i)?.[1] || null,
    network: value.match(/On network\s*\n\s*([^\r\n]+)/i)?.[1]?.trim() || null,
    amountMicros: amount ? usdcMicros(amount) : null,
    complete: /Your transaction is complete!/i.test(value),
  };
}

async function browserSession({ cdpUrl, profileDir, profileName, headless } = {}) {
  if (cdpUrl) {
    try {
      const browser = await chromium.connectOverCDP(cdpUrl);
      return { context: browser.contexts()[0], close: async () => {}, ownsBrowser: false };
    } catch (error) {
      throw new Error(`COINBASE_BROWSER_UNAVAILABLE:${error.message}`);
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
  const byText = await firstVisible(page.getByText(new RegExp(`^${text(network).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")));
  if (!byText) throw new Error("COINBASE_OPERATOR_NETWORK_NOT_FOUND");
  await byText.click();
}

export async function runCoinbaseBrowserOperator(input, {
  context,
  page,
  cdpUrl = process.env.XEN_COINBASE_BROWSER_CDP_URL ?? DEFAULT_CDP_URL,
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
  const responseEvidence = [];
  let responseListener = null;
  let activePage = null;
  try {
    activePage = page || session.context.pages().find((candidate) => /coinbase\.com/i.test(candidate.url())) || session.context.pages()[0] || await session.context.newPage();
    await activePage.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await activePage.waitForTimeout(2500);
    let body = await activePage.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
    const challenge = detectCoinbaseSecurityChallenge(activePage.url(), body);
    if (challenge) return { status: "NEEDS_OWNER_ACTION", reason: `Coinbase security challenge: ${challenge}` };
    if (!/coinbase\.com/i.test(activePage.url()) || /sign\s*in|log\s*in/i.test(body)) return { status: "LOGIN_REQUIRED", reason: "Authenticated Coinbase session is not available." };

    const sendButton = await waitVisible(activePage.getByTestId("quick-action-send-cell-pressable"), 30_000);
    if (!sendButton) throw new Error("COINBASE_OPERATOR_SEND_ENTRY_NOT_FOUND");
    await sendButton.click();
    await activePage.getByTestId("recipient-search-input").fill(plan.recipient);
    const recipientButton = await waitVisible(activePage.getByTestId("recipient-manual-address-cell-pressable"));
    if (!recipientButton) throw new Error("COINBASE_OPERATOR_RECIPIENT_NOT_ACCEPTED");
    await recipientButton.click();
    await activePage.getByTestId("send-asset-selector-cell-USDC-cell-pressable").click();
    await clickNetwork(activePage, plan.network);
    body = await activePage.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
    const transferWarning = detectCoinbaseSecurityChallenge(activePage.url(), body);
    if (transferWarning) return { status: "NEEDS_OWNER_ACTION", reason: `Coinbase security or scam warning: ${transferWarning}`, finalSendClicked: false };
    const warning = await waitVisible(activePage.getByTestId("network-warning-step-understand"), 4_000);
    if (warning) await warning.click();
    const amountInput = activePage.getByTestId("currency-input");
    const visibleAmountInput = await waitVisible(amountInput);
    if (!visibleAmountInput) throw new Error("COINBASE_OPERATOR_AMOUNT_FIELD_NOT_FOUND");
    const amountStep = activePage.getByTestId("step-amountEntry-active");
    if (/^\s*USD\b/i.test(await amountStep.innerText().catch(() => ""))) {
      const unitSwitch = amountStep.getByRole("button", { name: "switch", exact: true });
      if (!await waitVisible(unitSwitch, 5_000)) throw new Error("COINBASE_OPERATOR_USDC_UNIT_NOT_FOUND");
      await unitSwitch.click();
    }
    if (!/^\s*USDC\b/i.test(await amountStep.innerText().catch(() => ""))) throw new Error("COINBASE_OPERATOR_USDC_UNIT_NOT_CONFIRMED");
    await visibleAmountInput.fill(dollars(plan.amountCents));
    let enteredAmountCents = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      enteredAmountCents = cents(await visibleAmountInput.inputValue().catch(() => ""));
      if (enteredAmountCents === plan.amountCents) break;
      await activePage.waitForTimeout(250);
    }
    if (enteredAmountCents !== plan.amountCents) throw new Error(`COINBASE_OPERATOR_AMOUNT_ENTRY_MISMATCH:${enteredAmountCents ?? "unknown"}`);
    const preview = activePage.getByTestId("preview-send-button");
    if (!await waitEnabled(preview)) throw new Error("COINBASE_OPERATOR_PREVIEW_DISABLED");
    await preview.click();
    const finalButton = await waitVisible(activePage.getByTestId("send-now-button"), 25_000);
    body = await activePage.locator("body").innerText({ timeout: 10_000 });
    const previewChallenge = detectCoinbaseSecurityChallenge(activePage.url(), body);
    if (previewChallenge) return { status: "NEEDS_OWNER_ACTION", reason: `Coinbase security challenge: ${previewChallenge}`, finalSendClicked: false };
    const review = parseCoinbaseReview(body);
    const comparison = compareCoinbaseReview(plan, review);
    if (!comparison.ok) return { status: "REVIEW_MISMATCH", ...comparison };
    if (!finalButton) throw new Error("COINBASE_OPERATOR_FINAL_SEND_NOT_FOUND");
    await onReview?.({ ...comparison, finalSendFound: true });
    if (dryRun || !allowLiveSend) {
      return { status: "REVIEWING", dryRun: true, finalSendFound: true, finalSendClicked: false, ...comparison };
    }
    if (!localSendLocksAllow()) {
      return { status: "COINBASE_SEND_DISABLED", reason: "An explicit Windows send lock is disabled.", dryRun: true, finalSendFound: true, finalSendClicked: false, ...comparison };
    }
    if (!plan.liveExecutionAuthorized) throw new Error("COINBASE_PLAN_AUTHORIZATION_MISSING");
    await onBeforeSend?.({ ...comparison, finalSendFound: true });
    responseListener = (response) => {
      const responseUrl = response.url();
      if (!/transfer|transaction|send/i.test(responseUrl)) return;
      responseEvidence.push(responseUrl);
      response.json().then((payload) => responseEvidence.push(payload)).catch(() => {});
    };
    activePage.on("response", responseListener);
    try {
      await finalButton.click();
      await activePage.waitForTimeout(3000);
      body = await activePage.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
    } catch (error) {
      // Playwright may time out after dispatching the click. Never classify
      // that uncertainty as a safe pre-send failure.
      return { status: "RECONCILIATION_REQUIRED", reason: `Coinbase Send result is uncertain: ${String(error?.message || error).slice(0, 300)}`, submitted: null, finalSendClicked: true, ...comparison };
    }
    const postChallenge = detectCoinbaseSecurityChallenge(activePage.url(), body);
    if (postChallenge) return { status: "RECONCILIATION_REQUIRED", reason: `Coinbase security challenge after Send click: ${postChallenge}. Check Coinbase activity before any retry.`, submitted: null, finalSendClicked: true, ...comparison };
    const evidence = extractCoinbaseTransactionEvidence({ url: activePage.url(), body, responses: responseEvidence });
    try {
      const viewDetails = await waitVisible(activePage.getByTestId("view-transactions-button"), 15_000);
      if (viewDetails) {
        await viewDetails.click();
        const explorer = await waitVisible(activePage.getByTestId("block-explorer-button"), 15_000);
        const details = parseCoinbaseTransferDetails({
          body: await activePage.locator("body").innerText({ timeout: 10_000 }).catch(() => ""),
          explorerUrl: explorer ? await explorer.getAttribute("href").catch(() => "") : "",
        });
        if (details.transactionHash) {
          const detailMatches = details.complete
            && details.amountMicros === plan.amountCents * 10_000
            && String(details.recipient || "").toLowerCase() === plan.recipient.toLowerCase()
            && normalizedNetwork(details.network) === normalizedNetwork(plan.network);
          if (!detailMatches) return { status: "RECONCILIATION_REQUIRED", reason: "Coinbase transfer details differ from the approved plan.", finalSendClicked: true, ...comparison };
          return { status: "SUBMITTED", submitted: true, finalSendClicked: true, transactionId: details.transactionHash, transactionHash: details.transactionHash, ...comparison };
        }
      }
    } catch (error) {
      return { status: "RECONCILIATION_REQUIRED", reason: `Coinbase transfer details could not be read after Send: ${String(error?.message || error).slice(0, 200)}`, finalSendClicked: true, ...comparison };
    }
    if (!evidence.transactionId) return { status: "RECONCILIATION_REQUIRED", submitted: true, finalSendClicked: true, ...comparison };
    return { status: "SUBMITTED", submitted: true, finalSendClicked: true, transactionId: evidence.transactionId, ...comparison };
  } finally {
    if (responseListener) activePage?.off?.("response", responseListener);
    await session.close();
  }
}

function bridgeUrl(endpoint) {
  return `${String(process.env.XEN_REINVESTMENT_BRIDGE_URL || "https://xencheats.wtf").replace(/\/+$/, "")}${endpoint}`;
}

export async function reportBridge(planId, status, details = {}) {
  const token = String(process.env.XEN_REINVESTMENT_BRIDGE_TOKEN || "").trim();
  const operatorId = String(process.env.XEN_REINVESTMENT_OPERATOR_ID || "").trim();
  if (!token || !operatorId) throw new Error("REINVESTMENT_BRIDGE_REPORT_CONFIG_MISSING");
  const response = await fetch(bridgeUrl("/api/bridge/reinvestment/report"), {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "x-xen-bridge-token": token },
    body: JSON.stringify({ planId, operatorId, status, details }),
  });
  if (!response.ok) throw new Error(`REINVESTMENT_BRIDGE_REPORT_REJECTED:${response.status}`);
  const result = await response.json().catch(() => null);
  if (result?.accepted !== true) throw new Error("REINVESTMENT_BRIDGE_REPORT_NOT_CONFIRMED");
  return result;
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
      onReview: (details) => reportBridge(job.planId, "reviewing", { finalSendFound: true, matches: details.matches }),
      // Fail closed: Coinbase's irreversible button must not be clicked unless
      // the backend has durably accepted the SUBMITTING transition.
      onBeforeSend: ({ review }) => reportBridge(job.planId, "submitting", {
        finalSendFound: true,
        review: {
          asset: review.asset,
          amountCents: review.amountCents,
          recipientAmountCents: review.recipientAmountCents,
          recipient: review.recipient,
          network: review.network,
        },
      }),
    });
  } catch (error) {
    result = { status: "NEEDS_OWNER_ACTION", reason: String(error?.message || error) };
  }
  const status = result.status === "SUBMITTED" ? "submitted"
    : result.status === "REVIEWING" ? "reviewing"
      : result.status === "NEEDS_OWNER_ACTION" || result.status === "LOGIN_REQUIRED" || result.status === "COINBASE_SEND_DISABLED" ? "needs_owner_action"
        : result.status === "RECONCILIATION_REQUIRED" ? "reconciliation_required" : "failed";
  await reportBridge(job.planId, status, {
    error: result.reason || (result.status === "RECONCILIATION_REQUIRED"
      ? "Coinbase Send was clicked but no transaction ID was captured. Reconcile Coinbase activity before any retry."
      : status === "failed" ? result.status : null),
    transactionId: result.transactionId || undefined,
    transactionHash: result.transactionHash || undefined,
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
    runJobFile(jobFile).then(() => {
      // CDP owns a live browser connection, so natural process exit would wait
      // forever and block the bridge's next balance refresh.
      process.exit(0);
    }).catch((error) => {
      console.error(String(error?.message || error));
      process.exit(1);
    });
  }
}
