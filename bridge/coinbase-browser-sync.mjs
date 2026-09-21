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
    if (!/(available\s*(?:to\s*send|for\s*send|balance)?|sendable)/i.test(block)) continue;
    const matches = [...block.matchAll(/(?:available\s*(?:to\s*send|for\s*send|balance)?|sendable)[^$\d]{0,80}(?:\$\s*)?([0-9][0-9,]*(?:\.[0-9]{1,8})?)/ig)];
    for (const match of matches) {
      const cents = amountCents(match[1]);
      if (cents != null) candidates.push({ cents, context: block.slice(0, 500) });
    }
  }
  if (!candidates.length) {
    const explicit = normalized.match(/USDC[\s\S]{0,160}?available\s*(?:to\s*send|for\s*send|balance)?[^$\d]{0,40}(?:\$\s*)?([0-9][0-9,]*(?:\.[0-9]{1,8})?)/i)
      || normalized.match(/available\s*(?:to\s*send|for\s*send|balance)?[\s\S]{0,160}?USDC[^$\d]{0,40}(?:\$\s*)?([0-9][0-9,]*(?:\.[0-9]{1,8})?)/i);
    if (explicit) {
      const cents = amountCents(explicit[1]);
      if (cents != null) candidates.push({ cents, context: explicit[0].slice(0, 500) });
    }
  }
  if (!candidates.length) {
    return { status: "BALANCE_NOT_FOUND", availableCents: null, reason: "No explicit USDC available-to-send value was found." };
  }
  // Do not infer fees or a maximum sendable amount from an account total.
  // Those values are populated only when the Coinbase send UI explicitly
  // exposes them in a later operator step.
  return {
    status: "VALID",
    availableCents: candidates[0].cents,
    sendableCents: null,
    feeCents: 0,
    minimumSendCents: 0,
    availableToSendVerified: true,
    context: candidates[0].context,
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
  const currentUrl = page.url();
  const bodyText = await page.locator("body").innerText({ timeout: 10_000 }).catch(() => "");
  const parsed = /(?:login|signin|verify|challenge)/i.test(currentUrl)
    ? { status: "LOGIN_REQUIRED", availableCents: null, reason: "Coinbase login or verification is required." }
    : parseCoinbaseAvailableUsdcText(bodyText);
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
    reason: parsed.reason || null,
  };
  if (session.ownsBrowser) await session.browser.close().catch(() => {});
  return result;
}
