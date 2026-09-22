import "dotenv/config";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { readCoinbaseBrowserUsdcBalance } from "./coinbase-browser-sync.mjs";

const rootUrl = String(process.env.XEN_REINVESTMENT_BRIDGE_URL || "https://xencheats.wtf").replace(/\/+$/, "");
const bridgeToken = String(process.env.XEN_REINVESTMENT_BRIDGE_TOKEN || "").trim();
const bridgeId = String(process.env.XEN_REINVESTMENT_BRIDGE_ID || `${os.hostname()}-${crypto.randomBytes(4).toString("hex")}`).slice(0, 128);
const intervalMs = Math.max(2000, Math.min(30_000, Number(process.env.XEN_REINVESTMENT_BRIDGE_INTERVAL_MS || 3000)));
const coinbaseSyncIntervalMs = Math.max(180_000, Math.min(900_000, Number(process.env.XEN_COINBASE_BROWSER_SYNC_INTERVAL_MS || 300_000)));
const jobDir = process.env.XEN_REINVESTMENT_JOB_DIR || (process.platform === "win32"
  ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "XenReinvestmentBridge", "jobs")
  : path.resolve("bridge/jobs"));

function apiUrl(endpoint) { return `${rootUrl}${endpoint}`; }

async function request(endpoint, options = {}) {
  if (!bridgeToken) throw new Error("XEN_REINVESTMENT_BRIDGE_TOKEN is not configured.");
  const headers = { accept: "application/json", "content-type": "application/json", "x-xen-bridge-token": bridgeToken, ...options.headers };
  const response = await fetch(apiUrl(endpoint), { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload?.error || `Bridge request failed (${response.status}).`));
  return payload;
}

export async function writeJob(plan, invoice) {
  await mkdir(jobDir, { recursive: true });
  const filename = `${String(plan.id).replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
  const file = path.join(jobDir, filename);
  const bridgeInvoice = invoice || plan?.decision?.bridgeInvoice || null;
  const liveExecutionAuthorized = plan?.simulation === false && plan?.decision?.liveExecutionAuthorized === true;
  const job = {
    planId: plan.id,
    supplier: plan.supplier,
    status: plan.status,
    amountCents: plan.safe_to_reinvest_cents,
    invoice: bridgeInvoice,
    liveExecutionAuthorized,
    dryRun: !liveExecutionAuthorized,
    createdAt: new Date().toISOString(),
  };
  await writeFile(file, `${JSON.stringify(job, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return file;
}

export function launchOperator({ plan, jobFile }) {
  const template = String(process.env.XEN_REINVESTMENT_OPERATOR_COMMAND || "node finance/coinbase-browser-operator.mjs --job {job}").trim();
  const threadId = String(process.env.XEN_REINVESTMENT_OPERATOR_THREAD_ID || "").trim();
  const command = threadId && !process.env.XEN_REINVESTMENT_OPERATOR_COMMAND
    ? `codex exec resume ${threadId} "Read the funding job at ${jobFile}; use only the backend values and respect all execution locks."`
    : template.replaceAll("{job}", jobFile).replaceAll("{plan}", String(plan.id));
  const dryRun = plan?.simulation !== false || plan?.decision?.liveExecutionAuthorized !== true;
  const child = spawn(command, { shell: true, windowsHide: true, detached: true, stdio: "ignore", env: { ...process.env, XEN_REINVESTMENT_PLAN_FILE: jobFile, XEN_REINVESTMENT_DRY_RUN: String(dryRun), XEN_REINVESTMENT_OPERATOR_ID: bridgeId } });
  child.unref?.();
  return { launched: true };
}

export async function runOnce() {
  const claimed = await request("/api/bridge/reinvestment/claim", { method: "POST", body: JSON.stringify({ bridgeId }) });
  if (!claimed?.claimed || !claimed.valid || !claimed.plan) return claimed;
  const prepared = await request(`/api/bridge/reinvestment/prepare/${encodeURIComponent(claimed.plan.id)}`, { method: "POST", body: JSON.stringify({ operatorId: bridgeId }) });
  const jobFile = await writeJob(prepared.plan, prepared.invoice);
  const launched = launchOperator({ plan: prepared.plan, jobFile });
  if (!launched.launched) {
    await request("/api/bridge/reinvestment/report", { method: "POST", body: JSON.stringify({ planId: prepared.plan.id, operatorId: bridgeId, status: "needs_owner_action", details: { error: launched.reason } }) }).catch(() => {});
  }
  return { claimed: true, planId: prepared.plan.id, jobFile, operator: launched.launched ? "launched" : "needs_owner_action" };
}

export async function syncCoinbaseBrowserBalance() {
  const result = await readCoinbaseBrowserUsdcBalance();
  if (result.status !== "VALID" || !Number.isSafeInteger(result.availableUsdcCents) || result.availableUsdcCents < 0) {
    return { synced: false, status: result.status, reason: result.reason || "Coinbase available-to-send balance was not confirmed." };
  }
  const accepted = await request("/api/bridge/coinbase/balance", {
    method: "POST",
    body: JSON.stringify({
      availableUsdcCents: result.availableUsdcCents,
      capturedAt: result.capturedAt,
      status: result.status,
      availableToSend: result.availableToSend,
      availableToSendVerified: result.availableToSendVerified,
      sendableCents: result.sendableCents,
      feeCents: result.feeCents,
      minimumSendCents: result.minimumSendCents,
      context: result.context,
      pageUrl: result.pageUrl,
    }),
  });
  return { synced: true, availableUsdcCents: result.availableUsdcCents, snapshot: accepted.snapshot };
}

export async function main({ once = process.argv.includes("--once") } = {}) {
  if (!bridgeToken) throw new Error("XEN_REINVESTMENT_BRIDGE_TOKEN is not configured.");
  if (once) {
    const coinbase = await syncCoinbaseBrowserBalance().catch((error) => ({ synced: false, reason: error.message }));
    const reinvestment = await runOnce();
    return { coinbase, reinvestment };
  }
  let stopped = false;
  let lastCoinbaseSyncAt = 0;
  const stop = () => { stopped = true; };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  while (!stopped) {
    if (Date.now() - lastCoinbaseSyncAt >= coinbaseSyncIntervalMs) {
      lastCoinbaseSyncAt = Date.now();
      await syncCoinbaseBrowserBalance().catch(() => null);
    }
    await runOnce().catch(() => null);
    if (!stopped) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return { stopped: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
