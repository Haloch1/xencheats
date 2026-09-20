/* Explicit funding-plan state machine shared by the HTTP bridge and tests. */

export const FUNDING_PLAN_STATUSES = Object.freeze([
  "proposed", "blocked", "ready", "awaiting_approval", "approved",
  "operator_starting", "coinbase_open", "reviewing", "submitting",
  "submitted", "onchain_pending", "onchain_confirmed", "supplier_pending",
  "completed", "simulation_complete", "rejected", "expired",
  "needs_owner_action", "cancelled", "failed", "cancelled_revalidation",
]);

const transitions = {
  proposed: new Set(["approved", "rejected", "expired", "cancelled"]),
  blocked: new Set(["proposed", "ready", "cancelled"]),
  ready: new Set(["awaiting_approval", "approved", "cancelled"]),
  awaiting_approval: new Set(["approved", "rejected", "expired", "cancelled"]),
  approved: new Set(["operator_starting", "cancelled", "expired", "cancelled_revalidation"]),
  operator_starting: new Set(["coinbase_open", "needs_owner_action", "failed", "cancelled_revalidation", "cancelled"]),
  coinbase_open: new Set(["reviewing", "needs_owner_action", "failed", "cancelled"]),
  reviewing: new Set(["submitting", "needs_owner_action", "failed", "cancelled"]),
  submitting: new Set(["submitted", "needs_owner_action", "failed", "cancelled"]),
  submitted: new Set(["onchain_pending", "onchain_confirmed", "supplier_pending", "needs_owner_action", "failed"]),
  onchain_pending: new Set(["onchain_confirmed", "needs_owner_action", "failed"]),
  onchain_confirmed: new Set(["supplier_pending", "completed", "needs_owner_action", "failed"]),
  supplier_pending: new Set(["completed", "needs_owner_action", "failed"]),
  completed: new Set(),
  simulation_complete: new Set(["proposed", "cancelled"]),
  rejected: new Set(),
  expired: new Set(),
  needs_owner_action: new Set(["operator_starting", "cancelled", "failed", "expired"]),
  cancelled: new Set(),
  failed: new Set(["operator_starting", "cancelled"]),
  cancelled_revalidation: new Set(),
};

export const FUNDING_PLAN_TRANSITIONS = Object.freeze(
  Object.fromEntries(Object.entries(transitions).map(([from, values]) => [from, Object.freeze([...values])])),
);

export function canTransitionFundingPlan(from, to) {
  const source = String(from || "");
  const target = String(to || "");
  return source === target || Boolean(transitions[source]?.has(target));
}

export function isTerminalFundingPlanStatus(status) {
  return new Set(["completed", "rejected", "expired", "cancelled", "failed", "cancelled_revalidation"]).has(String(status || ""));
}

