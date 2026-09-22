import "dotenv/config";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readCoinbaseBrowserUsdcBalance } from "./coinbase-browser-sync.mjs";

const rootUrl = String(process.env.XEN_REINVESTMENT_BRIDGE_URL || "https://xencheats.wtf").replace(/\/+$/, "");
const bridgeToken = String(process.env.XEN_REINVESTMENT_BRIDGE_TOKEN || "").trim();
const bridgeId = String(process.env.XEN_REINVESTMENT_BRIDGE_ID || `${os.hostname()}-${crypto.randomBytes(4).toString("hex")}`).slice(0, 128);
const intervalMs = Math.max(2000, Math.min(30_000, Number(process.env.XEN_REINVESTMENT_BRIDGE_INTERVAL_MS || 3000)));
const coinbaseSyncIntervalMs = Math.max(180_000, Math.min(900_000, Number(process.env.XEN_COINBASE_BROWSER_SYNC_INTERVAL_MS || 300_000)));
const jobDir = process.env.XEN_REINVESTMENT_JOB_DIR || (process.platform === "win32"
  ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "XenReinvestmentBridge", "jobs")
  : path.resolve("bridge/jobs"));
const logDir = process.env.XEN_REINVESTMENT_LOG_DIR || (process.platform === "win32"
  ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "XenReinvestmentBridge", "logs")
  : path.resolve("bridge/logs"));
const logFile = path.join(logDir, "bridge.log");
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let lastCoinbaseWarningFingerprint = "";
let activeOperators = 0;

function errorText(error) {
  return String(error?.message || error || "Unknown bridge error")
    .replace(/(token|password|secret|authorization)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 1000);
}

async function logEvent(level, event, details = {}) {
  const entry = { at: new Date().toISOString(), level, event, ...details };
  try {
    await mkdir(logDir, { recursive: true });
    await appendFile(logFile, `${JSON.stringify(entry)}\n`, { encoding: "utf8" });
  } catch (error) {
    // Logging must never stop the bridge or change the payment decision.
    console.warn(`[Reinvestment bridge] log write failed: ${errorText(error)}`);
  }
}

function apiUrl(endpoint) { return `${rootUrl}${endpoint}`; }

export function buildOperatorInvocation({ plan, jobFile, env = process.env } = {}) {
  const configuredCommand = String(env.XEN_REINVESTMENT_OPERATOR_COMMAND || "").trim();
  const quoteShell = (value) => `"${String(value).replaceAll('"', '\\"')}"`;
  if (!configuredCommand) {
    return {
      command: process.execPath,
      args: [path.join(projectRoot, "finance", "coinbase-browser-operator.mjs"), "--job", path.resolve(jobFile)],
      options: { shell: false, cwd: projectRoot },
    };
  }
  return {
    command: configuredCommand
      .replaceAll("{job}", quoteShell(path.resolve(jobFile)))
      .replaceAll("{plan}", String(plan?.id || "")),
    args: [],
    options: { shell: true, cwd: projectRoot },
  };
}

export function operatorExitFailureReason(status, { simulation = false } = {}) {
  if (status === "submitting") {
    return "Coinbase submission may have started, but the operator exited before recording the result. Reconcile Coinbase activity before any retry; no automatic retry was made.";
  }
  if (["operator_starting", "coinbase_open", "reviewing"].includes(status)) {
    if (simulation && status === "reviewing") return null;
    return "The Coinbase operator exited before reporting completion. Reconcile the plan and Coinbase activity before retrying; no automatic retry was made.";
  }
  return null;
}

export async function reconcileOperatorExit({ planId, exitCode, signal, getPlan, reportNeedsOwnerAction: report, log = logEvent } = {}) {
  await log("info", "operator_process_exited", { planId: planId || null, exitCode, signal: signal || null });
  let current;
  try {
    current = await getPlan();
  } catch (error) {
    await log("error", "operator_exit_status_unavailable", { planId: planId || null, reason: errorText(error) });
    return { reconciled: false, reason: "status_unavailable" };
  }
  const reason = operatorExitFailureReason(current?.status, { simulation: current?.simulation === true });
  if (!reason) return { reconciled: true, action: "none", status: current?.status || null };
  await log("error", "operator_exited_without_resolution", { planId: planId || null, status: current?.status || null, exitCode, signal: signal || null });
  const action = current.status === "submitting" ? "reconciliation_required" : "needs_owner_action";
  await report(planId, reason, action);
  return { reconciled: true, action, status: current?.status || null };
}

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
  const invocation = buildOperatorInvocation({ plan, jobFile });
  const dryRun = plan?.simulation !== false || plan?.decision?.liveExecutionAuthorized !== true;
  let child;
  try {
    child = spawn(invocation.command, invocation.args, {
      ...invocation.options,
      windowsHide: true,
      detached: true,
      stdio: "ignore",
      env: { ...process.env, XEN_REINVESTMENT_PLAN_FILE: jobFile, XEN_REINVESTMENT_DRY_RUN: String(dryRun), XEN_REINVESTMENT_OPERATOR_ID: bridgeId },
    });
  } catch (error) {
    const reason = errorText(error);
    void logEvent("error", "operator_spawn_failed", { planId: plan?.id || null, reason });
    return { launched: false, reason: `Coinbase operator could not start: ${reason}` };
  }
  child.once("spawn", () => {
    activeOperators += 1;
    void logEvent("info", "operator_process_started", { planId: plan?.id || null, pid: child.pid || null, dryRun });
  });
  // Spawn can succeed while the shell/CLI exits immediately (for example,
  // because a relative script path or job argument was parsed incorrectly).
  // Observe the exit and reconcile backend status; never relaunch a possibly
  // submitted payment automatically.
  child.once("error", (error) => {
    const reason = errorText(error);
    void logEvent("error", "operator_spawn_failed", { planId: plan?.id || null, reason });
    void reportNeedsOwnerAction(plan?.id, `Coinbase operator could not start: ${reason}`);
  });
  child.once("exit", (code, signal) => {
    activeOperators = Math.max(0, activeOperators - 1);
    void reconcileOperatorExit({
      planId: plan?.id,
      exitCode: code,
      signal,
      getPlan: async () => {
        const query = new URLSearchParams({ bridgeId });
        return (await request(`/api/bridge/reinvestment/plans/${encodeURIComponent(String(plan?.id || ""))}?${query}`)).plan;
      },
      reportNeedsOwnerAction,
      log: (level, event, details) => logEvent(level, event, { pid: child.pid || null, ...details }),
    }).catch((error) => logEvent("error", "operator_exit_reconcile_failed", { planId: plan?.id || null, reason: errorText(error) }));
  });
  void logEvent("info", "operator_spawn_requested", { planId: plan?.id || null, dryRun, jobFile, pid: child.pid || null });
  child.unref?.();
  return { launched: true };
}

async function reportNeedsOwnerAction(planId, reason, status = "needs_owner_action") {
  const safeReason = errorText(reason);
  await logEvent("error", "plan_needs_owner_action", { planId: planId || null, status, reason: safeReason });
  await request("/api/bridge/reinvestment/report", {
    method: "POST",
    body: JSON.stringify({ planId, operatorId: bridgeId, status, details: { error: safeReason } }),
  }).catch((error) => logEvent("error", "plan_status_report_failed", { planId: planId || null, reason: errorText(error) }));
}

export async function runOnce() {
  const claimed = await request("/api/bridge/reinvestment/claim", { method: "POST", body: JSON.stringify({ bridgeId }) });
  if (!claimed?.claimed || !claimed.valid || !claimed.plan) return claimed;
  let prepared;
  try {
    prepared = await request(`/api/bridge/reinvestment/prepare/${encodeURIComponent(claimed.plan.id)}`, { method: "POST", body: JSON.stringify({ operatorId: bridgeId }) });
  } catch (error) {
    await reportNeedsOwnerAction(claimed.plan.id, `Operator preparation failed: ${errorText(error)}`);
    return { claimed: true, planId: claimed.plan.id, operator: "needs_owner_action" };
  }
  let jobFile;
  try {
    jobFile = await writeJob(prepared.plan, prepared.invoice);
  } catch (error) {
    await reportNeedsOwnerAction(prepared.plan.id, `Funding job could not be written: ${errorText(error)}`);
    return { claimed: true, planId: prepared.plan.id, operator: "needs_owner_action" };
  }
  const launched = launchOperator({ plan: prepared.plan, jobFile });
  if (!launched.launched) {
    await reportNeedsOwnerAction(prepared.plan.id, launched.reason || "Coinbase operator could not start.");
  }
  return { claimed: true, planId: prepared.plan.id, jobFile, operator: launched.launched ? "launched" : "needs_owner_action" };
}

export async function syncCoinbaseBrowserBalance() {
  const result = await readCoinbaseBrowserUsdcBalance();
  if (result.status !== "VALID" || !Number.isSafeInteger(result.availableUsdcCents) || result.availableUsdcCents < 0) {
    const fingerprint = `${result.status || "UNKNOWN"}:${result.reason || ""}`;
    if (fingerprint !== lastCoinbaseWarningFingerprint) {
      lastCoinbaseWarningFingerprint = fingerprint;
      await logEvent("warn", "coinbase_sync_not_valid", {
        status: result.status || "UNKNOWN",
        reason: errorText(result.reason || "Available-to-send USDC was not confirmed."),
        pageUrl: result.pageUrl || null,
      });
      await request("/api/bridge/coinbase/status", {
        method: "POST",
        body: JSON.stringify({
          status: result.status || "UNKNOWN",
          reason: errorText(result.reason || "Available-to-send USDC was not confirmed."),
          pageUrl: result.pageUrl || null,
          observedAt: result.capturedAt || new Date().toISOString(),
        }),
      }).catch((error) => logEvent("warn", "coinbase_sync_status_report_failed", { reason: errorText(error) }));
    }
    return { synced: false, status: result.status, reason: result.reason || "Coinbase available-to-send balance was not confirmed." };
  }
  lastCoinbaseWarningFingerprint = "";
  await logEvent("info", "coinbase_sync_valid", {
    availableUsdcCents: result.availableUsdcCents,
    availableToSendVerified: true,
    capturedAt: result.capturedAt || null,
    pageUrl: result.pageUrl || null,
  });
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
    const coinbase = await syncCoinbaseBrowserBalance().catch(async (error) => {
      await logEvent("warn", "coinbase_sync_failed", { reason: errorText(error) });
      return { synced: false, reason: errorText(error) };
    });
    const reinvestment = await runOnce();
    return { coinbase, reinvestment };
  }
  let stopped = false;
  let lastCoinbaseSyncAt = 0;
  const stop = () => { stopped = true; };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  while (!stopped) {
    if (activeOperators === 0 && Date.now() - lastCoinbaseSyncAt >= coinbaseSyncIntervalMs) {
      lastCoinbaseSyncAt = Date.now();
      await syncCoinbaseBrowserBalance().catch(async (error) => {
        await logEvent("warn", "coinbase_sync_failed", { reason: errorText(error) });
        console.warn(`[Reinvestment bridge] Coinbase sync unavailable: ${errorText(error)}`);
        return null;
      });
    }
    await runOnce().catch(async (error) => {
      await logEvent("error", "poll_failed", { reason: errorText(error) });
      console.error(`[Reinvestment bridge] Poll failed: ${errorText(error)}`);
      return null;
    });
    if (!stopped) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return { stopped: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
