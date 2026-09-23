import assert from "node:assert/strict";
import { evaluateMediaClaimBudget, estimateMediaReplacementCostCents } from "../finance/media-claim-budget.mjs";

// A sales-free day does not matter: the rolling 7-day contribution still
// funds a claim from the prior days.
const quietToday = evaluateMediaClaimBudget({
  customerContributionCents: 20_000,
  mediaSpendSevenDaysCents: 0,
  mediaSpend24HoursCents: 0,
  requestedCostCents: 400,
});
assert.equal(quietToday.allowed, true);
assert.equal(quietToday.budgetCents, 5_000);

// Recent media use is charged against the same rolling allowance.
assert.equal(evaluateMediaClaimBudget({
  customerContributionCents: 10_000,
  mediaSpendSevenDaysCents: 2_500,
  mediaSpend24HoursCents: 0,
  requestedCostCents: 100,
}).reason, "rolling_budget_exhausted");

// A larger claim may use the remaining weekly budget once, but repeat claims
// in the same 24-hour window are paced to half of the weekly allowance.
assert.equal(evaluateMediaClaimBudget({
  customerContributionCents: 10_000,
  mediaSpendSevenDaysCents: 0,
  mediaSpend24HoursCents: 0,
  requestedCostCents: 2_000,
}).allowed, true);
assert.equal(evaluateMediaClaimBudget({
  customerContributionCents: 10_000,
  mediaSpendSevenDaysCents: 2_000,
  mediaSpend24HoursCents: 2_000,
  requestedCostCents: 500,
}).reason, "daily_pacing_limit");

assert.equal(evaluateMediaClaimBudget({
  customerContributionCents: 0,
  mediaSpendSevenDaysCents: 0,
  mediaSpend24HoursCents: 0,
  requestedCostCents: 100,
}).reason, "no_recent_customer_margin");
assert.equal(estimateMediaReplacementCostCents({ supplierCostsCents: [410, 350, null], retailValueCents: 500 }), 410);
assert.equal(estimateMediaReplacementCostCents({ supplierCostsCents: [], retailValueCents: 500 }), 500);
assert.equal(estimateMediaReplacementCostCents({ supplierCostsCents: [], retailValueCents: null }), null);

console.log("Media claim budget tests passed");
