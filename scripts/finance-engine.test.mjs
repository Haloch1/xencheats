import assert from "node:assert/strict";
import {
  allocateOrderToBatches,
  applyRefundToAllocations,
  calculateRunway,
  calculateConfidenceDetails,
  calculateSafeToReinvest,
  calculateSalesVelocity,
  createReinvestmentBatch,
} from "../finance/reinvestment-engine.mjs";

const now = Date.parse("2026-09-20T12:00:00Z");
const at = (hoursAgo) => new Date(now - hoursAgo * 60 * 60 * 1000).toISOString();

// Missing Coinbase availability is a required-source failure, not a reason to
// silently treat the account as zero or lower the safety threshold.
{
  const details = calculateConfidenceDetails({
    freshness: { stripeMinutes: 0, supplierMinutes: 0, ordersMinutes: 0, coinbaseMinutes: Infinity },
    coinbaseKnown: false,
  });
  assert.equal(details.confidence, "low");
  assert.match(details.factors.find((factor) => factor.name.includes("Coinbase"))?.effect || "", /LOW/i);
}

// Case 1: opening $30, verified deposit $20, closing $50 => $20 reinvestment.
{
  const batch = createReinvestmentBatch({ amountCents: 2000, verifiedAmountCents: 2000, startingBalanceCents: 3000, simulation: true });
  assert.equal(batch.amountCents, 2000);
  assert.equal(batch.capitalRemainingCents, 2000);
  assert.equal(batch.verifiedAmountCents, 2000);
}

// Incremental refunds reduce attributed profit once without rewriting gross revenue.
{
  const batch = createReinvestmentBatch({ id: "refund", amountCents: 1000 });
  const { allocations } = allocateOrderToBatches([batch], {
    orderId: "refunded-order",
    supplierCostCents: 1000,
    revenueCents: 1800,
  });
  const result = applyRefundToAllocations([batch], allocations, 300);
  assert.equal(result.appliedRefundCents, 300);
  assert.equal(batch.revenueAttributedCents, 1800);
  assert.equal(batch.refundsAttributedCents, 300);
  assert.equal(batch.grossProfitCents, 500);
}

// Case 2 is represented by a transaction amount, not a balance delta.
{
  const batch = createReinvestmentBatch({ amountCents: 3000, verifiedAmountCents: 3000, startingBalanceCents: 2000 });
  assert.equal(batch.amountCents, 3000);
  assert.notEqual(batch.amountCents, 2000);
}

// Case 3: FIFO consumes the older batch first.
{
  const old = createReinvestmentBatch({ id: "old", amountCents: 3000, createdAt: "2026-09-01T00:00:00Z" });
  const fresh = createReinvestmentBatch({ id: "new", amountCents: 2000, createdAt: "2026-09-02T00:00:00Z" });
  const result = allocateOrderToBatches([old, fresh], { orderId: "order-3", supplierCostCents: 1000, revenueCents: 1800 });
  assert.deepEqual(result.allocations.map((item) => item.supplierCostCents), [1000]);
  assert.equal(old.capitalRemainingCents, 2000);
  assert.equal(fresh.capitalRemainingCents, 2000);
}

// Case 4: $3 old + $20 new funding for an $8 order => $3/$5 split.
{
  const old = createReinvestmentBatch({ id: "old", amountCents: 300, createdAt: "2026-09-01T00:00:00Z" });
  const fresh = createReinvestmentBatch({ id: "new", amountCents: 2000, createdAt: "2026-09-02T00:00:00Z" });
  const result = allocateOrderToBatches([old, fresh], { orderId: "order-4", supplierCostCents: 800, revenueCents: 1600 });
  assert.deepEqual(result.allocations.map((item) => item.supplierCostCents), [300, 500]);
  assert.deepEqual(result.allocations.map((item) => item.revenueCents), [600, 1000]);
  assert.equal(old.capitalRemainingCents, 0);
  assert.equal(old.status, "FULLY_DEPLOYED");
  assert.equal(fresh.capitalRemainingCents, 1500);
}

// Pending Stripe money is never included in current spendable cash.
{
  const decision = calculateSafeToReinvest({
    nowMs: now,
    availableCashCents: 5000,
    availableUsdcCents: 0,
    stripePendingCents: 8000,
    supplierBalanceCents: 2400,
    burnCentsPerHour: 500,
    openOrderCommitmentCents: 0,
    mediaCommitmentCents: 0,
    upcomingExpensesCents: 0,
    supplierBalanceKnown: true,
    dataStale: false,
    reconciliationOk: true,
    confidence: "high",
    config: { expectedFundingHours: 2, safetyMarginHours: 1, minimumTargetRunwayHours: 1, dynamicReserveHours: 0, minimumReserveCents: 0 },
  });
  assert.equal(decision.usesStripePending, false);
  assert.equal(decision.spendableNowCents, 5000);
  assert.equal(decision.projectedSafeAfterPayoutCents, decision.safeToReinvestCents + 8000);
}

// Customer wallet balances remain reserved instead of becoming supplier spend.
{
  const decision = calculateSafeToReinvest({
    availableCashCents: 5000,
    supplierBalanceCents: 1000,
    supplierBalanceKnown: true,
    customerLiabilityCents: 4000,
    customerLiabilityKnown: true,
    burnCentsPerHour: 0,
    confidence: "high",
    config: { expectedFundingHours: 0, safetyMarginHours: 0, minimumTargetRunwayHours: 0, dynamicReserveHours: 0 },
  });
  assert.equal(decision.customerLiabilityCents, 4000);
  assert.equal(decision.reserveCents, 4000);
  assert.equal(decision.safeToReinvestCents, 1000);
}

// An unreadable wallet liability fails closed even when cash is available.
{
  const decision = calculateSafeToReinvest({
    availableCashCents: 5000,
    supplierBalanceCents: 1000,
    supplierBalanceKnown: true,
    customerLiabilityKnown: false,
    burnCentsPerHour: 0,
    confidence: "high",
  });
  assert.equal(decision.safeToReinvestCents, 0);
  assert.match(decision.blockedReasons.join(" "), /wallet liability is unavailable/i);
}

// Stale data/reconciliation mismatch blocks simulation funding proposals.
{
  const decision = calculateSafeToReinvest({
    availableCashCents: 5000,
    supplierBalanceCents: 1000,
    burnCentsPerHour: 100,
    supplierBalanceKnown: true,
    dataStale: true,
    reconciliationOk: true,
    confidence: "high",
  });
  assert.equal(decision.safeToReinvestCents, 0);
  assert.equal(decision.status, "LOW");
  assert.match(decision.blockedReasons.join(" "), /stale/i);
}

// Demand acceleration is deterministic and safe at zero activity.
{
  const velocity = calculateSalesVelocity([], { nowMs: now });
  assert.equal(velocity.currentBurnCentsPerHour, 0);
  assert.equal(velocity.demandState, "NORMAL");
  assert.equal(calculateRunway(1000, 0).hours, null);
}

// A recent spike raises the state without using an AI/model call.
{
  const velocity = calculateSalesVelocity([
    { createdAt: at(0.5), supplierCostCents: 1200, status: "fulfilled" },
    { createdAt: at(1.5), supplierCostCents: 1200, status: "fulfilled" },
    { createdAt: at(72), supplierCostCents: 100, status: "fulfilled" },
  ], { nowMs: now });
  assert.ok(["ELEVATED", "HIGH", "SURGING"].includes(velocity.demandState));
  assert.ok(velocity.currentBurnCentsPerHour > 0);
}

// A recent fulfilled order without a confirmed supplier cost must be explicit.
{
  const velocity = calculateSalesVelocity([
    { createdAt: at(1), supplierCostCents: null, status: "fulfilled" },
  ], { nowMs: now });
  assert.equal(velocity.eligibleOrderCount, 1);
  assert.equal(velocity.unknownCostOrderCount, 1);
  const decision = calculateSafeToReinvest({
    availableCashCents: 5000,
    supplierBalanceCents: 1000,
    burnCentsPerHour: 100,
    supplierBalanceKnown: true,
    dataStale: false,
    reconciliationOk: true,
    orderHistoryComplete: velocity.unknownCostOrderCount === 0,
  });
  assert.equal(decision.safeToReinvestCents, 0);
  assert.match(decision.blockedReasons.join(" "), /confidence is low/i);
}

console.log("finance-engine.test.mjs: all assertions passed");
