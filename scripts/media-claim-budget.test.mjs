import assert from "node:assert/strict";
import { evaluateMediaClaimBudget, estimateMediaReplacementCostCents, isPotentiallyCommittedMediaClaim } from "../finance/media-claim-budget.mjs";

const claimTime = Date.parse("2026-09-23T21:00:00Z");
assert.equal(isPotentiallyCommittedMediaClaim({
  status: "pending", note: "Media budget verification in progress", created_at: "2026-09-23T20:59:00Z", now: claimTime,
}), false, "a claim that has not passed the budget check must not consume budget after a restart");
assert.equal(isPotentiallyCommittedMediaClaim({
  status: "pending", note: "Media panel claim in progress", created_at: "2026-09-23T20:59:00Z", now: claimTime,
}), true, "an ambiguous legacy in-flight claim remains conservatively reserved");
assert.equal(isPotentiallyCommittedMediaClaim({
  status: "pending", note: "Media delivery in progress", created_at: "2026-09-23T20:59:00Z", now: claimTime,
}), true, "a stale delivery attempt remains reserved after a restart");
assert.equal(isPotentiallyCommittedMediaClaim({
  status: "cancelled", note: "Media claim stopped by rolling customer-margin budget", created_at: "2026-09-23T20:59:00Z", now: claimTime,
}), false, "a pre-delivery budget rejection must not consume media budget");
assert.equal(isPotentiallyCommittedMediaClaim({
  status: "cancelled", note: "Media claim cancelled because delivery was not immediate; no key was delivered.", created_at: "2026-09-23T20:59:00Z", now: claimTime,
}), true, "a supplier-accepted claim without delivery remains reserved");

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
assert.equal(evaluateMediaClaimBudget({
  customerContributionCents: 0,
  mediaSpendSevenDaysCents: 800,
  mediaSpend24HoursCents: 0,
  requestedCostCents: 400,
  promotionalFloorCents: 2000,
}).allowed, true, "the capped promotional floor permits a claim on a quiet day");
assert.equal(evaluateMediaClaimBudget({
  customerContributionCents: 0,
  mediaSpendSevenDaysCents: 1900,
  mediaSpend24HoursCents: 0,
  requestedCostCents: 400,
  promotionalFloorCents: 2000,
}).reason, "rolling_budget_exhausted", "the promotional floor remains capped over seven days");
assert.equal(estimateMediaReplacementCostCents({ supplierCostsCents: [410, 350, null], retailValueCents: 500 }), 410);
assert.equal(estimateMediaReplacementCostCents({ supplierCostsCents: [], retailValueCents: 500 }), 500);
assert.equal(estimateMediaReplacementCostCents({ supplierCostsCents: [], retailValueCents: null }), null);

console.log("Media claim budget tests passed");
