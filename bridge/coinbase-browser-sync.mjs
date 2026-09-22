import path from "node:path";
import { chromium } from "playwright";

const DEFAULT_COINBASE_URL = "https://www.coinbase.com/assets";
const LOGIN_MARKERS = [
  "sign in to coinbase",
  "log in to coinbase",
  "verify your identity",
  "enter your code",
];
const SECURITY_MARKERS = [
  "performing security verification",
  "security verification",
  "verify you are not a bot",
  "cloudflare",
  "captcha",
  "security check",
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
  const securityMarker = SECURITY_MARKERS.find((marker) => lower.includes(marker));
  if (securityMarker) {
    return {
      status: "NEEDS_OWNER_ACTION",
      availableCents: null,
      reason: `Coinbase security verification is required (${securityMarker}).`,
    };
  }
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
    // Coinbase may challenge headless automation even when the owner has
    // already authenticated the persistent profile. Use the normal visible
    // Chrome profile by default so the bridge shares the same session and
    // security context. Set XEN_COINBASE_BROWSER_HEADLESS=true only for an
    // explicitly controlled test environment.
    headless: /^(1|true|yes|on)$/i.test(String(process.env.XEN_COINBASE_BROWSER_HEADLESS || "false")),
    args: profileName ? [`--profile-directory=${profileName}`] : [],
  });
  return { browser: context, context, ownsBrowser: true };
}

async function firstVisible(locator) {
  const count = await locator.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) return candidate;
  }
  return null;
}

async function visible(locator) {
  return Boolean(await firstVisible(locator));
}

async function waitForVisible(locator, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const candidate = await firstVisible(locator);
    if (candidate) return candidate;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return firstVisible(locator);
}

async function closeStaleSendModal(page) {
  /* A prior read-only probe can leave Coinbase's send modal mounted over the
     home page after navigation. Its overlay intercepts the next Send click,
     so unwind only that modal with Coinbase's own Go back control. */
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const modal = page.getByTestId("modal-dialog-motion");
    if (!await visible(modal)) return;
    const modalText = await modal.innerText().catch(() => "");
    if (!/(send crypto|select network|enter amount|recipient)/i.test(modalText)) return;
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(400);
    if (!await visible(modal)) return;
    const back = await firstVisible(page.getByRole("button", { name: "Go back" }));
    if (!back) return;
    await back.click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
}

async function chooseReadOnlyProbeNetwork(page) {
  /*
   * Coinbase currently inserts a network picker between manual recipient
   * entry and the asset selector. This network is only a read-only probe to
   * expose the send sheet's explicit availability text; it is never used as
   * an invoice or payment network. Prefer Ethereum because Coinbase labels it
   * as the default network and it normally needs no acknowledgement. If the
   * UI presents a warning, stop and surface owner action rather than clicking
   * through a third-party safety confirmation.
   */
  const networkPicker = page.locator('[data-testid^="l2-list-item-"]');
  const networkVisible = await waitForVisible(networkPicker, 15_000);
  if (!networkVisible) return { status: "not_present" };

  const ethereum = page.getByTestId("l2-list-item-ethereum-cell-pressable");
  const base = page.getByTestId("l2-list-item-base-cell-pressable");
  const candidate = await firstVisible(ethereum) || await firstVisible(base);
  if (!candidate) return { status: "not_present" };
  await candidate.click({ timeout: 5_000, force: true }).catch(() => {});
  await Promise.race([
    page.getByTestId("network-warning-step-understand").waitFor({ state: "visible", timeout: 6_000 }),
    page.getByTestId("send-asset-selector-cell-USDC-cell-pressable").waitFor({ state: "visible", timeout: 6_000 }),
    page.getByTestId("currency-input").waitFor({ state: "visible", timeout: 6_000 }),
  ]).catch(() => {});

  const warning = page.getByTestId("network-warning-step-understand");
  if (await visible(warning)) {
    return {
      status: "NEEDS_OWNER_ACTION",
      reason: "Coinbase displayed a network safety acknowledgement during the read-only balance check.",
    };
  }
  if (await visible(page.locator('[data-testid^="l2-list-item-"]'))) {
    /* The list can survive one React render after a click. Retry only the
       same read-only network selection; never advance into preview/send. */
    const retryCandidate = await firstVisible(ethereum) || await firstVisible(base);
    if (retryCandidate) await retryCandidate.click({ timeout: 5_000, force: true }).catch(() => {});
    await page.waitForTimeout(700);
    if (await visible(warning)) {
      return {
        status: "NEEDS_OWNER_ACTION",
        reason: "Coinbase displayed a network safety acknowledgement during the read-only balance check.",
      };
    }
  }
  return { status: "selected" };
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
  await page.waitForTimeout(2500);
  // Coinbase renders the authenticated home/asset data after the shell loads.
  // Wait briefly for the explicit USDC + availability text so a valid session
  // is not misclassified as BALANCE_NOT_FOUND during the initial skeleton.
  if (!/login|signin|verify|challenge/i.test(page.url())) {
    await page.waitForFunction(
      () => Boolean(document.querySelector('[data-testid="quick-action-send-cell-pressable"]'))
        || /USDC[\s\S]{0,120}?\$\s*[0-9][\s\S]{0,40}?\bAvailable\b/i.test(document.body?.innerText || ""),
      { timeout: 25_000 },
    ).catch(() => {});
  }
  const currentUrl = page.url();
  await closeStaleSendModal(page);
  let bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
  let parsed;
  const lowerBodyText = bodyText.toLowerCase();
  const securityMarker = SECURITY_MARKERS.find((marker) => lowerBodyText.includes(marker));
  if (securityMarker) {
    parsed = { status: "NEEDS_OWNER_ACTION", availableCents: null, reason: `Coinbase security verification is required (${securityMarker}).` };
  } else if (/(?:login|signin|verify|challenge)/i.test(currentUrl) || LOGIN_MARKERS.some((marker) => lowerBodyText.includes(marker))) {
    parsed = { status: "LOGIN_REQUIRED", availableCents: null, reason: "Coinbase login or verification is required." };
  } else {
    /* Open the real send sheet before reading a balance. The portfolio page's
       USDC total is not necessarily available to send (pending/locked funds
       are commonly shown there). This click is read-only and never reaches
       recipient, amount, review, or Send. */
    const sendButton = page.getByTestId("quick-action-send-cell-pressable");
    const sendButtonVisible = await waitForVisible(sendButton, 20_000);
    const sendTextButton = page.getByText("Send crypto", { exact: true });
    const sendControl = sendButtonVisible || await firstVisible(sendTextButton);
    if (!sendControl) {
      parsed = { status: "SEND_UI_NOT_FOUND", availableCents: null, reason: "Coinbase send UI was not available; portfolio totals were not used." };
    } else {
      await sendControl.click().catch(() => {});
      await page.waitForTimeout(1_500);
      /* Coinbase exposes the asset selector only after a recipient is chosen.
         Use a fixed valid EVM probe address solely to open the read-only asset
         sheet; no amount, preview, or send action is ever performed. Deployments
         may override it with XEN_COINBASE_BALANCE_PROBE_ADDRESS. */
      const recipientInput = page.getByTestId("recipient-search-input");
      const recipientControl = await firstVisible(recipientInput);
      if (recipientControl) {
        const probeAddress = String(process.env.XEN_COINBASE_BALANCE_PROBE_ADDRESS || "0xeac32f5a33680a2477a9929259afb91c813de071").trim();
        await recipientControl.fill(probeAddress).catch(() => {});
        const manualRecipient = page.getByTestId("recipient-manual-address-cell-pressable");
        const manualControl = await waitForVisible(manualRecipient, 10_000);
        if (manualControl) await manualControl.click().catch(() => {});
        if (!await visible(manualRecipient)) {
          const exactRecipient = page.getByText(probeAddress, { exact: true });
          const exactControl = await waitForVisible(exactRecipient, 2_000);
          if (exactControl) await exactControl.click().catch(() => {});
          if (!exactControl) {
            const shortRecipient = `${probeAddress.slice(0, 6)}...${probeAddress.slice(-6)}`;
            const recentRecipient = page.getByText(shortRecipient, { exact: true });
            const recentControl = await waitForVisible(recentRecipient, 3_000);
            if (recentControl) await recentControl.click().catch(() => {});
          }
        }
      }

      /* Recipient selection is asynchronous. Wait for the next Coinbase
         surface instead of sampling once while the modal is still loading. */
      await Promise.race([
        page.getByTestId("l2-list-item-ethereum-cell-pressable").waitFor({ state: "visible", timeout: 15_000 }),
        page.getByTestId("send-asset-selector-cell-USDC-cell-pressable").waitFor({ state: "visible", timeout: 15_000 }),
        page.getByTestId("currency-input").waitFor({ state: "visible", timeout: 15_000 }),
      ]).catch(() => {});
      const probeNetwork = await chooseReadOnlyProbeNetwork(page);
      if (probeNetwork.status === "NEEDS_OWNER_ACTION") {
        parsed = { status: probeNetwork.status, availableCents: null, reason: probeNetwork.reason };
      }
      const usdcButton = page.getByTestId("send-asset-selector-cell-USDC-cell-pressable");
      if (parsed?.status !== "NEEDS_OWNER_ACTION") {
        await waitForVisible(usdcButton, 8_000);
      }
      const usdcControl = await firstVisible(usdcButton);
      const usdcVisible = Boolean(usdcControl);
      if (parsed?.status !== "NEEDS_OWNER_ACTION" && usdcControl) await usdcControl.click().catch(() => {});
      const amountInput = page.getByTestId("currency-input");
      if (parsed?.status !== "NEEDS_OWNER_ACTION") {
        await waitForVisible(amountInput, 8_000);
      }
      const amountVisible = await visible(amountInput);
      const activeSendText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
      const activeUsdc = /enter\s+amount[\s\S]{0,320}\bUSDC\b[\s\S]{0,120}(?:available|preview)/i.test(activeSendText);
      /* When a previous recipient selection leaves USDC already selected,
         Coinbase hides the asset-selector button but still exposes the
         currency input and the explicit USDC available balance. */
      const sendSurfaceReady = amountVisible && (usdcVisible || activeUsdc);
      if (parsed?.status !== "NEEDS_OWNER_ACTION" && !sendSurfaceReady) {
        parsed = { status: "SEND_UI_NOT_FOUND", availableCents: null, reason: "Coinbase send sheet did not expose the USDC amount field; portfolio totals were not used." };
      } else if (parsed?.status !== "NEEDS_OWNER_ACTION") {
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
