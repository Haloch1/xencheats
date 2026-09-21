import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canTransitionFundingPlan, isTerminalFundingPlanStatus } from "../finance/reinvestment-state.mjs";
import { assertCoinbaseSendEnabled } from "../finance/coinbase-integration.mjs";
import { parseCoinbaseAvailableUsdcText } from "../bridge/coinbase-browser-sync.mjs";

assert.equal(canTransitionFundingPlan("approved", "operator_starting"), true);
assert.equal(canTransitionFundingPlan("approved", "submitted"), false);
assert.equal(canTransitionFundingPlan("submitted", "approved"), false);
assert.equal(canTransitionFundingPlan("operator_starting", "needs_owner_action"), true);
assert.equal(isTerminalFundingPlanStatus("completed"), true);
assert.equal(isTerminalFundingPlanStatus("approved"), false);
assert.throws(() => assertCoinbaseSendEnabled({ sendEnabled: "false", liveExecutionEnabled: "false" }), /COINBASE_SEND_DISABLED/);
assert.throws(() => assertCoinbaseSendEnabled({ sendEnabled: "true", liveExecutionEnabled: "false" }), /COINBASE_SEND_DISABLED/);
assert.deepEqual(
  parseCoinbaseAvailableUsdcText("USDC\nTotal balance\n$61.85\nAvailable to send\n$15.00"),
  { status: "VALID", availableCents: 1500, sendableCents: null, feeCents: 0, minimumSendCents: 0, availableToSendVerified: true, context: "USDC | Total balance | $61.85 | Available to send | $15.00" },
);
assert.equal(parseCoinbaseAvailableUsdcText("Pay with\nUSDC\n$87.13\nAvailable").availableCents, 8713);
assert.equal(parseCoinbaseAvailableUsdcText("Sign in to Coinbase").status, "LOGIN_REQUIRED");
assert.equal(parseCoinbaseAvailableUsdcText("USDC\nTotal balance\n$61.85").status, "BALANCE_NOT_FOUND");
assert.equal(parseCoinbaseAvailableUsdcText("USDC\nAvailable balance\n$61.85").status, "BALANCE_NOT_FOUND");
assert.equal(parseCoinbaseAvailableUsdcText("USDC\nAvailable\n$61.85").status, "BALANCE_NOT_FOUND");
const registrationScript = await readFile(new URL("../bridge/register-xen-reinvestment-bridge.ps1", import.meta.url), "utf8");
assert.match(registrationScript, /Get-Command node/);
assert.match(registrationScript, /Split-Path -Parent \$PSScriptRoot/);
assert.doesNotMatch(registrationScript, /-WorkingDirectory \(Split-Path -Parent \$BridgeScript\)/);
console.log("reinvestment bridge state and send-lock tests passed");
