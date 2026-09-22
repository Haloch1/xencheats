/* Explicit funding-plan state machine shared by the HTTP bridge and tests. */

export const FUNDING_PLAN_STATUSES = Object.freeze([
  "proposed", "blocked", "ready", "awaiting_approval", "approved",
  "operator_starting", "coinbase_open", "reviewing", "submitting",
  "submitted", "onchain_pending", "onchain_confirmed", "supplier_pending",
  "completed", "simulation_complete", "rejected", "expired", "reconciliation_required",
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
  // Once Send may have been clicked, an uncertain result must be reconciled
  // against Coinbase activity. It must never become a retryable failure.
  submitting: new Set(["submitted", "reconciliation_required"]),
  reconciliation_required: new Set(["submitted", "cancelled"]),
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

export function isRecoverableOperatorStart(plan, operatorId, nowMs = Date.now(), leaseMs = 120_000) {
  if (!plan || plan.status !== "operator_starting") return false;
  if (!operatorId || plan.operator_id !== operatorId) return false;
  if (plan.coinbase_transaction_id || plan.coinbase_transaction_hash) return false;
  const startedAt = Date.parse(plan.operator_started_at || plan.operator_claimed_at || "");
  if (!Number.isFinite(startedAt) || nowMs - startedAt < leaseMs) return false;
  const approvalExpiresAt = plan.approval_expires_at ? Date.parse(plan.approval_expires_at) : null;
  if (approvalExpiresAt !== null && (!Number.isFinite(approvalExpiresAt) || approvalExpiresAt <= nowMs)) return false;
  return true;
}

export function isTerminalFundingPlanStatus(status) {
  return new Set(["completed", "rejected", "expired", "cancelled", "failed", "cancelled_revalidation"]).has(String(status || ""));
}

export function classifyActiveRealFundingPlans(plans = [], nowMs = Date.now()) {
  const active = (plans || []).filter((plan) => plan && plan.simulation === false);
  const inFlight = active.find((plan) => [
    "operator_starting", "coinbase_open", "reviewing", "submitting",
    "submitted", "onchain_pending", "onchain_confirmed", "supplier_pending",
    "reconciliation_required",
  ].includes(plan.status) || plan.coinbase_transaction_id || plan.coinbase_transaction_hash);
  if (inFlight) return { inFlight, existing: null, expirable: [] };
  const existing = active.find((plan) => {
    const invoice = plan.decision?.bridgeInvoice;
    return plan.decision?.coinbaseOnly === true
      && invoice?.invoiceId && invoice?.address && invoice?.network
      && Number(invoice.amountCents) === Number(plan.safe_to_reinvest_cents)
      && new Date(invoice.expiresAt || 0).getTime() > nowMs;
  });
  return { inFlight: null, existing: existing || null, expirable: existing ? [] : active.filter((plan) => ["awaiting_approval", "approved"].includes(plan.status)) };
}

export function validateSubmittingReport(plan, details = {}, nowMs = Date.now()) {
  if (plan?.status !== "reviewing" || plan?.simulation !== false || !plan?.approved_at || !plan?.approved_by
    || plan?.decision?.liveExecutionAuthorized !== true) return { ok: false, reason: "PLAN_NOT_AUTHORIZED" };
  if (plan.coinbase_transaction_id || plan.coinbase_transaction_hash || plan.submitted_at) return { ok: false, reason: "TRANSACTION_ALREADY_RECORDED" };
  const invoice = plan.decision?.bridgeInvoice;
  if (!invoice?.invoiceId || !/^0x[a-f0-9]{40}$/i.test(String(invoice.address || ""))
    || !invoice.network || !Number.isFinite(Date.parse(invoice.expiresAt || ""))
    || Date.parse(invoice.expiresAt) <= nowMs
    || (plan.approval_expires_at && Date.parse(plan.approval_expires_at) <= nowMs)) {
    return { ok: false, reason: "APPROVED_INVOICE_INVALID" };
  }
  const amount = Number(plan.safe_to_reinvest_cents);
  const review = details.review;
  const network = (value) => String(value || "").toLowerCase().replace(/\([^)]*\)/g, "").replace(/[-_\s]+/g, "");
  if (details.finalSendFound !== true || !Number.isSafeInteger(amount) || amount <= 0
    || Number(invoice.amountCents) !== amount || !review
    || String(review.asset || "").toUpperCase() !== "USDC"
    || Number(review.amountCents) !== amount
    || Number(review.recipientAmountCents) < amount
    || String(review.recipient || "").toLowerCase() !== String(invoice.address).toLowerCase()
    || network(review.network) !== network(invoice.network)) {
    return { ok: false, reason: "COINBASE_REVIEW_MISMATCH" };
  }
  return { ok: true };
}

