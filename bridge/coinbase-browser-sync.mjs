import path from "node:path";
import { chromium } from "playwright";

const DEFAULT_COINBASE_URL = "https://www.coinbase.com/assets";
const LOGIN_MARKERS = [
  "sign in to coinbase",
  "log in to coinbase",
  "verify your identity",
  "enter your code",
];

function amountFromText(value) {
  const match = String(value || "").replace(/,/g, "").match(/(?:\$\s*)?([0-9]+(?:\.[0-9]{1,8})?)/);
  if (!match) return null;
  const amount = Number(match[1]);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function amountCents(value) {
  const amount = amountFromText(value);
  return amount == null ? null : Math.round(amount * 100);
}

/**
 * Parse only an explicit USDC available-to-send value. The parser intentionally
 * refuses a generic USDC total so a locked/pending balance cannot be treated as
 * spendable by accident.
 */
export function parseCoinbaseAvailableUsdcText(text) {
  const raw = String(text || "");
  const normalized = raw.replace(/\u00a0/g, " ");
  const lower = normalized.toLowerCase();
  if (LOGIN_MARKERS.some((marker) => lower.includes(marker))) {
    return { status: "LOGIN_REQUIRED", availableCents: null, reason: "Coinbase login or verification is required." };
  }

  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const candidates = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/usdc/i.test(lines[index])) continue;
    const block = lines.slice(Math.max(0, index - 4), Math.min(lines.length, index + 9)).join(" | ");
    if (!/(available\s*(?:to\s*send|for\s*send)|sendable)/i.test(block)) continue;
    const matches = [...block.matchAll(/(?:available\s*(?:to\s*send|for\s*send)|sendable)[^$\d]{0,80}(?:\$\s*)?([0-9][0-9,]*(?:\.[0-9]{1,8})?)/ig)];
    for (const match of matches) {
      const cents = amountCents(match[1]);
      if (cents != null) candidates.push({ cents, context: block.slice(0, 500) });
    }
  }
  if (!candidates.length) {
    const explicitPatterns = [
      /USDC[\s\S]{0,160}?available\s*(?:to\s*send|for\s*send)[^$\d]{0,40}(?:\$\s*)?([0-9][0-9,]*(?:\.[0-9]{1,8})?)/ig,
      /available\s*(?:to\s*send|for\s*send)[\s\S]{0,160}?USDC[^$\d]{0,40}(?:\$\s*)?([0-9][0-9,]*(?:\.[0-9]{1,8})?)/ig,
      /* Coinbase's authenticated send sheet can render multiple explicit
         "USDC $X Available" pairs while the portfolio shell remains mounted.
         Collect every pair and select the last one below. */
      /USDC[\s\S]{0,80}?(?:\$\s*)?([0-9][0-9,]*(?:\.[0-9]{1,8})?)[\s\S]{0,24}?\bAvailable\b/ig,
    ];
    for (const pattern of explicitPatterns) {
      for (const match of normalized.matchAll(pattern)) {
        const cents = amountCents(match[1]);
        if (cents != null) candidates.push({ cents, context: match[0].slice(0, 500) });
      }
    }
  }
  if (!candidates.length) {
    return { status: "BALANCE_NOT_FOUND", availableCents: null, reason: "No explicit USDC available-to-send value was found." };
  }
  // Do not infer fees or a maximum sendable amount from an account total.
  // Those values are populated only when the Coinbase send UI explicitly
  // exposes them in a later operator step.
  /* When Coinbase leaves the account shell mounted behind the send sheet,
     both the portfolio total and the sendable amount can appear in body text.
     The last explicit availability value belongs to the active send sheet;
     never let the earlier portfolio total win. */
  const selected = candidates.at(-1);
  return {
    status: "VALID",
    availableCents: selected.cents,
    sendableCents: null,
    feeCents: 0,
    minimumSendCents: 0,
    availableToSendVerified: true,
    context: selected.context,
  };
}

async function existingContext({ cdpUrl, profileDir, profileName }) {
  if (cdpUrl) {
    try {
      const browser = await chromium.connectOverCDP(cdpUrl);
      // The CDP browser belongs to the user. Never close it from the bridge.
      return { browser, context: browser.contexts()[0], ownsBrowser: false };
    } catch (error) {
      if (!profileDir) throw new Error(`Coinbase browser CDP unavailable: ${error.message}`);
    }
  }
  if (!profileDir) throw new Error("No Coinbase browser session configured. Set XEN_COINBASE_BROWSER_CDP_URL or XEN_COINBASE_BROWSER_PROFILE_DIR.");
  const context = await chromium.launchPersistentContext(path.resolve(profileDir), {
    channel: process.env.XEN_COINBASE_BROWSER_CHANNEL || "chrome",
    headless: /^(1|true|yes|on)$/i.test(String(process.env.XEN_COINBASE_BROWSER_HEADLESS || "false")),
    args: profileName ? [`--profile-directory=${profileName}`] : [],
  });
  return { browser: context, context, ownsBrowser: true };
}

export async function readCoinbaseBrowserUsdcBalance({
  cdpUrl = process.env.XEN_COINBASE_BROWSER_CDP_URL || "",
  profileDir = process.env.XEN_COINBASE_BROWSER_PROFILE_DIR || path.join(process.env.LOCALAPPDATA || path.join(process.env.HOME || process.cwd(), "AppData", "Local"), "XenReinvestmentBridge", "CoinbaseProfile"),
  profileName = process.env.XEN_COINBASE_BROWSER_PROFILE_NAME || "Default",
  url = process.env.XEN_COINBASE_BROWSER_URL || DEFAULT_COINBASE_URL,
} = {}) {
  const session = await existingContext({ cdpUrl: String(cdpUrl).trim(), profileDir: String(profileDir).trim(), profileName: String(profileName).trim() });
  let page = session.context.pages().find((candidate) => /coinbase\.com/i.test(candidate.url())) || session.context.pages()[0];
  if (!page) page = await session.context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(1500);
  // Coinbase renders the authenticated home/asset data after the shell loads.
  // Wait briefly for the explicit USDC + availability text so a valid session
  // is not misclassified as BALANCE_NOT_FOUND during the initial skeleton.
  if (!/login|signin|verify|challenge/i.test(page.url())) {
    await page.waitForFunction(
      () => /USDC[\s\S]{0,120}?\$\s*[0-9][\s\S]{0,40}?\bAvailable\b/i.test(document.body?.innerText || ""),
      { timeout: 15_000 },
    ).catch(() => {});
  }
  const currentUrl = page.url();
  let bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
  let parsed;
  if (/(?:login|signin|verify|challenge)/i.test(currentUrl) || LOGIN_MARKERS.some((marker) => bodyText.toLowerCase().includes(marker))) {
    parsed = { status: "LOGIN_REQUIRED", availableCents: null, reason: "Coinbase login or verification is required." };
  } else {
    /* Open the real send sheet before reading a balance. The portfolio page's
       USDC total is not necessarily available to send (pending/locked funds
       are commonly shown there). This click is read-only and never reaches
       recipient, amount, review, or Send. */
    const sendButton = page.getByTestId("quick-action-send-cell-pressable");
    await sendButton.first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
    if (!await sendButton.first().isVisible().catch(() => false)) {
      parsed = { status: "SEND_UI_NOT_FOUND", availableCents: null, reason: "Coinbase send UI was not available; portfolio totals were not used." };
    } else {
      await sendButton.first().click().catch(() => {});
      await page.waitForTimeout(1_500);
      /* Coinbase exposes the asset selector only after a recipient is chosen.
         Use a fixed valid EVM probe address solely to open the read-only asset
         sheet; no amount, preview, or send action is ever performed. Deployments
         may override it with XEN_COINBASE_BALANCE_PROBE_ADDRESS. */
      const recipientInput = page.getByTestId("recipient-search-input");
      if (await recipientInput.first().isVisible().catch(() => false)) {
        const probeAddress = String(process.env.XEN_COINBASE_BALANCE_PROBE_ADDRESS || "0xeac32f5a33680a2477a9929259afb91c813de071").trim();
        await recipientInput.first().fill(probeAddress).catch(() => {});
        const manualRecipient = page.getByTestId("recipient-manual-address-cell-pressable");
        await manualRecipient.first().waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
        if (await manualRecipient.first().isVisible().catch(() => false)) await manualRecipient.first().click().catch(() => {});
        if (!await manualRecipient.first().isVisible().catch(() => false)) {
          const exactRecipient = page.getByText(probeAddress, { exact: true });
          await exactRecipient.first().waitFor({ state: "visible", timeout: 2_000 }).catch(() => {});
          if (await exactRecipient.first().isVisible().catch(() => false)) await exactRecipient.first().click().catch(() => {});
          if (!await exactRecipient.first().isVisible().catch(() => false)) {
            const shortRecipient = `${probeAddress.slice(0, 6)}...${probeAddress.slice(-6)}`;
            const recentRecipient = page.getByText(shortRecipient, { exact: true });
            await recentRecipient.first().waitFor({ state: "visible", timeout: 3_000 }).catch(() => {});
            if (await recentRecipient.first().isVisible().catch(() => false)) await recentRecipient.first().click().catch(() => {});
          }
        }
      }
      const usdcButton = page.getByTestId("send-asset-selector-cell-USDC-cell-pressable");
      await usdcButton.first().waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
      const usdcVisible = await usdcButton.first().isVisible().catch(() => false);
      if (usdcVisible) await usdcButton.first().click().catch(() => {});
      const amountInput = page.getByTestId("currency-input");
      await amountInput.first().waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
      const sendSurfaceReady = usdcVisible && await amountInput.first().isVisible().catch(() => false);
      if (!sendSurfaceReady) {
        parsed = { status: "SEND_UI_NOT_FOUND", availableCents: null, reason: "Coinbase send sheet did not expose the USDC amount field; portfolio totals were not used." };
      } else {
        await page.waitForTimeout(500);
        bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => bodyText);
        /* The send sheet is rendered over the account shell. Scope parsing to
           its final "Enter amount" section so the portfolio's USDC total cannot
           win when both values are present in the DOM. */
        const lowerBody = bodyText.toLowerCase();
        const sendStart = lowerBody.lastIndexOf("enter amount");
        const sendSurface = sendStart >= 0 ? bodyText.slice(sendStart) : bodyText;
        parsed = parseCoinbaseAvailableUsdcText(sendSurface);
      }
    }
  }
  const result = {
    source: "authenticated_browser",
    capturedAt: new Date().toISOString(),
    pageUrl: currentUrl,
    status: parsed.status,
    availableUsdcCents: parsed.availableCents,
    availableToSend: parsed.status === "VALID",
    availableToSendVerified: parsed.availableToSendVerified === true,
    sendableCents: parsed.sendableCents ?? null,
    feeCents: parsed.feeCents ?? 0,
    minimumSendCents: parsed.minimumSendCents ?? 0,
    context: parsed.context || null,
    reason: parsed.reason || null,
  };
  if (session.ownsBrowser) await session.browser.close().catch(() => {});
  return result;
}
