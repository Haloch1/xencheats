import assert from "node:assert/strict";
import { canTransitionFundingPlan, isTerminalFundingPlanStatus } from "../finance/reinvestment-state.mjs";
import { assertCoinbaseSendEnabled } from "../finance/coinbase-integration.mjs";

assert.equal(canTransitionFundingPlan("approved", "operator_starting"), true);
assert.equal(canTransitionFundingPlan("approved", "submitted"), false);
assert.equal(canTransitionFundingPlan("submitted", "approved"), false);
assert.equal(canTransitionFundingPlan("operator_starting", "needs_owner_action"), true);
assert.equal(isTerminalFundingPlanStatus("completed"), true);
assert.equal(isTerminalFundingPlanStatus("approved"), false);
assert.throws(() => assertCoinbaseSendEnabled({ sendEnabled: "false", liveExecutionEnabled: "false" }), /COINBASE_SEND_DISABLED/);
assert.throws(() => assertCoinbaseSendEnabled({ sendEnabled: "true", liveExecutionEnabled: "false" }), /COINBASE_SEND_DISABLED/);
console.log("reinvestment bridge state and send-lock tests passed");
