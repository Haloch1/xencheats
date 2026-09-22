import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { buildOperatorInvocation, operatorExitFailureReason, reconcileOperatorExit } from "../bridge/xen-reinvestment-bridge.mjs";
import { canTransitionFundingPlan, classifyActiveRealFundingPlans, isRecoverableOperatorStart, isTerminalFundingPlanStatus, validateSubmittingReport } from "../finance/reinvestment-state.mjs";
import { assertCoinbaseSendEnabled } from "../finance/coinbase-integration.mjs";
import { parseCoinbaseAvailableUsdcText } from "../bridge/coinbase-browser-sync.mjs";

assert.equal(canTransitionFundingPlan("approved", "operator_starting"), true);
assert.equal(canTransitionFundingPlan("approved", "submitted"), false);
assert.equal(canTransitionFundingPlan("submitted", "approved"), false);
assert.equal(canTransitionFundingPlan("operator_starting", "needs_owner_action"), true);
assert.equal(canTransitionFundingPlan("submitting", "needs_owner_action"), false);
assert.equal(canTransitionFundingPlan("submitting", "reconciliation_required"), true);
assert.equal(canTransitionFundingPlan("reconciliation_required", "operator_starting"), false);
const activeReal = { id: "active-real", status: "awaiting_approval", simulation: false, safe_to_reinvest_cents: 900, decision: { coinbaseOnly: true, bridgeInvoice: { invoiceId: "invoice-1", address: "0xabc", network: "Base", amountCents: 900, expiresAt: new Date(Date.now() + 60_000).toISOString() } } };
assert.equal(classifyActiveRealFundingPlans([activeReal]).existing?.id, "active-real");
assert.equal(classifyActiveRealFundingPlans([{ ...activeReal, status: "submitted" }]).inFlight?.status, "submitted");
assert.equal(classifyActiveRealFundingPlans([{ ...activeReal, status: "reconciliation_required" }]).inFlight?.status, "reconciliation_required");
assert.equal(classifyActiveRealFundingPlans([{ ...activeReal, decision: { ...activeReal.decision, bridgeInvoice: { ...activeReal.decision.bridgeInvoice, expiresAt: new Date(Date.now() - 60_000).toISOString() } } }]).expirable.length, 1);
const approvedInvoice = { invoiceId: "fresh", address: "0x46b3d37c530d6c01bd367136028bad28d7b5fa88", network: "Base", amountCents: 890, expiresAt: new Date(Date.now() + 60_000).toISOString() };
const reviewedPlan = { status: "reviewing", simulation: false, approved_at: new Date().toISOString(), approved_by: "owner", safe_to_reinvest_cents: 890, decision: { liveExecutionAuthorized: true, bridgeInvoice: approvedInvoice } };
const submittingDetails = { finalSendFound: true, review: { asset: "USDC", amountCents: 890, recipientAmountCents: 890, recipient: approvedInvoice.address, network: "Base" } };
assert.equal(validateSubmittingReport(reviewedPlan, submittingDetails).ok, true);
assert.equal(validateSubmittingReport({ ...reviewedPlan, status: "submitting" }, submittingDetails).ok, false);
assert.equal(validateSubmittingReport(reviewedPlan, { ...submittingDetails, review: { ...submittingDetails.review, recipient: "0x0000000000000000000000000000000000000000" } }).reason, "COINBASE_REVIEW_MISMATCH");
assert.equal(validateSubmittingReport(reviewedPlan, { ...submittingDetails, review: { ...submittingDetails.review, recipientAmountCents: 889 } }).ok, false);
assert.equal(validateSubmittingReport({ ...reviewedPlan, decision: { ...reviewedPlan.decision, bridgeInvoice: { ...approvedInvoice, expiresAt: new Date(Date.now() - 60_000).toISOString() } } }, submittingDetails).reason, "APPROVED_INVOICE_INVALID");
const recoverableClaim = {
  status: "operator_starting",
  operator_id: "windows-operator",
  operator_started_at: "2026-09-22T18:00:00.000Z",
  approval_expires_at: "2026-09-22T19:00:00.000Z",
  coinbase_transaction_id: null,
  coinbase_transaction_hash: null,
};
assert.equal(isRecoverableOperatorStart(recoverableClaim, "windows-operator", Date.parse("2026-09-22T18:03:00.000Z")), true);
assert.equal(isRecoverableOperatorStart(recoverableClaim, "another-bridge", Date.parse("2026-09-22T18:03:00.000Z")), false);
assert.equal(isRecoverableOperatorStart({ ...recoverableClaim, coinbase_transaction_id: "tx-1" }, "windows-operator", Date.parse("2026-09-22T18:03:00.000Z")), false);
assert.equal(isRecoverableOperatorStart({ ...recoverableClaim, approval_expires_at: "2026-09-22T18:02:00.000Z" }, "windows-operator", Date.parse("2026-09-22T18:03:00.000Z")), false);
assert.equal(isRecoverableOperatorStart({ ...recoverableClaim, operator_started_at: "2026-09-22T18:02:00.000Z" }, "windows-operator", Date.parse("2026-09-22T18:03:00.000Z")), false);
assert.equal(isTerminalFundingPlanStatus("completed"), true);
assert.equal(isTerminalFundingPlanStatus("approved"), false);
const jobFileWithSpaces = path.join(process.env.LOCALAPPDATA || "C:\\Users\\Test User\\AppData\\Local", "Xen Reinvestment Bridge", "jobs", "plan.json");
const invocation = buildOperatorInvocation({ plan: { id: "plan-demo" }, jobFile: jobFileWithSpaces, env: {} });
assert.equal(invocation.command, process.execPath);
assert.equal(invocation.options.shell, false);
assert.ok(path.isAbsolute(invocation.args[0]));
assert.equal(invocation.args[1], "--job");
assert.equal(invocation.args[2], path.resolve(jobFileWithSpaces));
const threadOverride = buildOperatorInvocation({
  plan: { id: "plan-demo" },
  jobFile: jobFileWithSpaces,
  env: { XEN_REINVESTMENT_OPERATOR_THREAD_ID: "legacy-codex-thread" },
});
assert.equal(threadOverride.command, process.execPath);
assert.equal(threadOverride.options.shell, false);
assert.equal(operatorExitFailureReason("coinbase_open")?.includes("no automatic retry"), true);
assert.equal(operatorExitFailureReason("submitting")?.includes("Reconcile Coinbase activity"), true);
assert.equal(operatorExitFailureReason("reviewing", { simulation: true }), null);
assert.equal(operatorExitFailureReason("submitted"), null);
const exitReports = [];
const exitEvents = [];
const exitResult = await reconcileOperatorExit({
  planId: "plan-live",
  exitCode: 1,
  getPlan: async () => ({ status: "coinbase_open", simulation: false }),
  reportNeedsOwnerAction: async (...args) => exitReports.push(args),
  log: async (...args) => exitEvents.push(args),
});
assert.deepEqual(exitResult, { reconciled: true, action: "needs_owner_action", status: "coinbase_open" });
assert.equal(exitReports.length, 1);
assert.match(exitReports[0][1], /no automatic retry/i);
assert.equal(exitEvents.at(-1)[1], "operator_exited_without_resolution");
const uncertainReports = [];
const uncertainResult = await reconcileOperatorExit({
  planId: "plan-submitting",
  exitCode: null,
  signal: "SIGTERM",
  getPlan: async () => ({ status: "submitting", simulation: false }),
  reportNeedsOwnerAction: async (...args) => uncertainReports.push(args),
  log: async () => {},
});
assert.equal(uncertainResult.action, "reconciliation_required");
assert.match(uncertainReports[0][1], /Reconcile Coinbase activity before any retry/i);
assert.equal(uncertainReports[0][2], "reconciliation_required");
const dryRunReports = [];
const dryRunResult = await reconcileOperatorExit({
  planId: "plan-dry",
  exitCode: 0,
  getPlan: async () => ({ status: "reviewing", simulation: true }),
  reportNeedsOwnerAction: async (...args) => dryRunReports.push(args),
  log: async () => {},
});
assert.equal(dryRunResult.action, "none");
assert.equal(dryRunReports.length, 0);
assert.throws(() => assertCoinbaseSendEnabled({ sendEnabled: "false", liveExecutionEnabled: "false" }), /COINBASE_SEND_DISABLED/);
assert.throws(() => assertCoinbaseSendEnabled({ sendEnabled: "true", liveExecutionEnabled: "false" }), /COINBASE_SEND_DISABLED/);
assert.deepEqual(
  parseCoinbaseAvailableUsdcText("USDC\nTotal balance\n$61.85\nAvailable to send\n$15.00"),
  { status: "VALID", availableCents: 1500, sendableCents: null, feeCents: 0, minimumSendCents: 0, availableToSendVerified: true, context: "USDC | Total balance | $61.85 | Available to send | $15.00" },
);
assert.equal(parseCoinbaseAvailableUsdcText("Pay with\nUSDC\n$87.13\nAvailable").availableCents, 8713);
assert.equal(
  parseCoinbaseAvailableUsdcText("USDC\n$63.13\nAvailable\nSend crypto\nUSDC\n$1.30\nAvailable").availableCents,
  130,
);
assert.equal(parseCoinbaseAvailableUsdcText("Sign in to Coinbase").status, "LOGIN_REQUIRED");
assert.equal(parseCoinbaseAvailableUsdcText("Performing security verification\nThis website uses a security service").status, "NEEDS_OWNER_ACTION");
assert.equal(parseCoinbaseAvailableUsdcText("USDC\nTotal balance\n$61.85").status, "BALANCE_NOT_FOUND");
assert.equal(parseCoinbaseAvailableUsdcText("USDC\nAvailable balance\n$61.85").status, "BALANCE_NOT_FOUND");
assert.equal(parseCoinbaseAvailableUsdcText("USDC\nAvailable\n$61.85").status, "BALANCE_NOT_FOUND");
const registrationScript = await readFile(new URL("../bridge/register-xen-reinvestment-bridge.ps1", import.meta.url), "utf8");
const serverSource = await readFile(new URL("../server.js", import.meta.url), "utf8");
assert.match(registrationScript, /Get-Command node/);
assert.match(registrationScript, /Split-Path -Parent \$PSScriptRoot/);
assert.doesNotMatch(registrationScript, /-WorkingDirectory \(Split-Path -Parent \$BridgeScript\)/);
assert.match(serverSource, /status === "completed" && OWNER_ID/);
assert.match(serverSource, /allowedMentions: \{ users: \[OWNER_ID\] \}/);
console.log("reinvestment bridge state and send-lock tests passed");
