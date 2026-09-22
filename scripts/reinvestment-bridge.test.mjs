import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canTransitionFundingPlan, isRecoverableOperatorStart, isTerminalFundingPlanStatus } from "../finance/reinvestment-state.mjs";
import { assertCoinbaseSendEnabled } from "../finance/coinbase-integration.mjs";
import { parseCoinbaseAvailableUsdcText } from "../bridge/coinbase-browser-sync.mjs";

assert.equal(canTransitionFundingPlan("approved", "operator_starting"), true);
assert.equal(canTransitionFundingPlan("approved", "submitted"), false);
assert.equal(canTransitionFundingPlan("submitted", "approved"), false);
assert.equal(canTransitionFundingPlan("operator_starting", "needs_owner_action"), true);
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
