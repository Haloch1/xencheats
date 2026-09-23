const nonNegativeCents = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
};

/**
 * Decide whether a media key's replacement cost fits inside a rolling
 * customer-funded marketing budget. Customer sales are measured over seven
 * days, so a quiet day does not erase budget earned on earlier days.
 */
export function evaluateMediaClaimBudget({
  customerContributionCents,
  mediaSpendSevenDaysCents,
  mediaSpend24HoursCents,
  requestedCostCents,
  budgetPercent = 25,
} = {}) {
  const contribution = nonNegativeCents(customerContributionCents);
  const spentSevenDays = nonNegativeCents(mediaSpendSevenDaysCents);
  const spent24Hours = nonNegativeCents(mediaSpend24HoursCents);
  const requested = nonNegativeCents(requestedCostCents);
  const percent = Math.max(0, Math.min(100, Number.isFinite(Number(budgetPercent)) ? Number(budgetPercent) : 25));
  const budgetCents = Math.floor(contribution * percent / 100);
  const weeklyRemainingCents = Math.max(0, budgetCents - spentSevenDays);
  // Allow a single normal claim even when its cost is more than half the
  // rolling budget. Once used, cap further same-day claims at half the
  // seven-day allowance to slow down rapid balance depletion.
  const dailyCapCents = Math.ceil(budgetCents / 2);
  const dailyRemainingCents = Math.max(0, dailyCapCents - spent24Hours);
  const dailyAllowed = spent24Hours === 0 || requested <= dailyRemainingCents;

  let reason = "within_budget";
  if (requested <= 0) reason = "cost_unavailable";
  else if (budgetCents <= 0) reason = "no_recent_customer_margin";
  else if (requested > weeklyRemainingCents) reason = "rolling_budget_exhausted";
  else if (!dailyAllowed) reason = "daily_pacing_limit";

  return {
    allowed: reason === "within_budget",
    reason,
    budgetCents,
    weeklyRemainingCents,
    dailyCapCents,
    dailyRemainingCents,
    requestedCostCents: requested,
  };
}

/** Use the highest confirmed configured supplier cost to cover fallback
 * routing; fall back to retail value when supplier pricing is unavailable. */
export function estimateMediaReplacementCostCents({ supplierCostsCents = [], retailValueCents } = {}) {
  const confirmed = supplierCostsCents
    .map(Number)
    .filter((amount) => Number.isSafeInteger(amount) && amount > 0);
  if (confirmed.length) return Math.max(...confirmed);
  const retail = Number(retailValueCents);
  return Number.isSafeInteger(retail) && retail > 0 ? retail : null;
}
