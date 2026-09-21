/*
 * Deterministic finance primitives.
 *
 * This module has no network, database, Stripe, Discord, or provider imports.
 * Keeping the calculations pure makes the money decision easy to test and
 * prevents an AI/chat layer from becoming a source of financial truth.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const SUPPLIERS = Object.freeze(["cheatslove", "ghostware", "rft"]);

export const DEFAULT_FINANCE_CONFIG = Object.freeze({
  mode: "simulation",
  primarySupplier: "cheatslove",
  primarySupplierAllocationPercent: 100,
  minimumReserveCents: 0,
  safetyMarginHours: 3,
  expectedFundingHours: 12,
  minimumTargetRunwayHours: 2,
  dynamicReserveHours: 0.75,
  maxTransactionCents: 0,
  maxDailyReinvestmentCents: 0,
  minimumConfidence: "medium",
  maxDataAgeMinutes: 15,
});

const CONFIDENCE_RANK = Object.freeze({ low: 0, medium: 1, high: 2 });

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegativeCents(value) {
  return Math.max(0, Math.round(finiteNumber(value)));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function timestampMs(value, fallback = NaN) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizedSupplier(value, fallback = "unassigned") {
  const supplier = String(value || "").trim().toLowerCase();
  return SUPPLIERS.includes(supplier) ? supplier : fallback;
}

function statusCountsAsDemand(status) {
  return !["cancelled", "canceled", "refunded", "failed", "pending"].includes(
    String(status || "").trim().toLowerCase(),
  );
}

function orderCostCents(order) {
  const direct = Number(order?.supplierCostCents ?? order?.supplier_cost_cents);
  if (Number.isFinite(direct) && direct >= 0) return Math.round(direct);
  return null;
}

function orderCreatedAt(order) {
  return timestampMs(order?.createdAt ?? order?.created_at);
}

function orderRevenueCents(order) {
  return nonNegativeCents(order?.revenueCents ?? order?.amountCents ?? order?.amount_cents);
}

function orderRefundCents(order) {
  return nonNegativeCents(order?.refundCents ?? order?.refundedCents ?? order?.refund_cents);
}

export function normalizeFinanceConfig(input = {}) {
  const source = { ...DEFAULT_FINANCE_CONFIG, ...(input || {}) };
  const primarySupplier = normalizedSupplier(source.primarySupplier, "cheatslove");
  const mode = ["simulation", "approval", "auto"].includes(String(source.mode).toLowerCase())
    ? String(source.mode).toLowerCase()
    : "simulation";
  const minimumConfidence = ["low", "medium", "high"].includes(String(source.minimumConfidence).toLowerCase())
    ? String(source.minimumConfidence).toLowerCase()
    : "medium";
  return {
    ...DEFAULT_FINANCE_CONFIG,
    ...source,
    mode,
    primarySupplier,
    primarySupplierAllocationPercent: clamp(Math.round(finiteNumber(source.primarySupplierAllocationPercent, 100)), 0, 100),
    minimumReserveCents: nonNegativeCents(source.minimumReserveCents),
    safetyMarginHours: clamp(finiteNumber(source.safetyMarginHours, 3), 0, 168),
    expectedFundingHours: clamp(finiteNumber(source.expectedFundingHours, 12), 0, 720),
    minimumTargetRunwayHours: clamp(finiteNumber(source.minimumTargetRunwayHours, 2), 0, 168),
    dynamicReserveHours: clamp(finiteNumber(source.dynamicReserveHours, 0.75), 0, 24),
    maxTransactionCents: nonNegativeCents(source.maxTransactionCents),
    maxDailyReinvestmentCents: nonNegativeCents(source.maxDailyReinvestmentCents),
    minimumConfidence,
    maxDataAgeMinutes: clamp(finiteNumber(source.maxDataAgeMinutes, 15), 1, 10080),
  };
}

export function calculateSalesVelocity(orders = [], { nowMs = Date.now() } = {}) {
  const now = timestampMs(nowMs, Date.now());
  let eligibleOrderCount = 0;
  let unknownCostOrderCount = 0;
  const windows = [1, 3, 6, 12, 24, 168];
  const stats = Object.fromEntries(windows.map((hours) => [hours, {
    hours,
    costCents: 0,
    orders: 0,
    knownCostOrders: 0,
    rateCentsPerHour: 0,
  }]));

  for (const order of Array.isArray(orders) ? orders : []) {
    if (!statusCountsAsDemand(order?.status)) continue;
    const created = orderCreatedAt(order);
    if (!Number.isFinite(created) || created > now) continue;
    const ageHours = (now - created) / HOUR_MS;
    if (ageHours > 168) continue;
    eligibleOrderCount += 1;
    const cost = orderCostCents(order);
    if (cost == null) {
      unknownCostOrderCount += 1;
      continue;
    }
    const netCost = Math.max(0, cost - orderRefundCents(order));
    for (const hours of windows) {
      if (ageHours <= hours) {
        stats[hours].costCents += netCost;
        stats[hours].orders += 1;
        stats[hours].knownCostOrders += 1;
      }
    }
  }

  for (const item of Object.values(stats)) {
    item.rateCentsPerHour = item.costCents / item.hours;
  }

  const weights = [[1, 0.36], [3, 0.24], [6, 0.16], [12, 0.10], [24, 0.08], [168, 0.06]];
  const availableWeights = weights.filter(([hours]) => stats[hours].orders > 0 || hours === 168);
  const weightTotal = availableWeights.reduce((sum, [, weight]) => sum + weight, 0) || 1;
  const weightedRate = availableWeights.reduce((sum, [hours, weight]) => sum + stats[hours].rateCentsPerHour * weight, 0) / weightTotal;
  const baselineRate = stats[168].rateCentsPerHour;
  const recentRate = stats[1].orders ? stats[1].rateCentsPerHour : stats[3].rateCentsPerHour;
  const priorRate = stats[6].orders > stats[3].orders
    ? Math.max(0, (stats[6].costCents - stats[3].costCents) / 3)
    : baselineRate;
  const baselineForRatio = Math.max(1, baselineRate);
  const acceleration = clamp(Math.max(weightedRate, recentRate) / baselineForRatio, 0, 10);
  const demandState = acceleration >= 2.5
    ? "SURGING"
    : acceleration >= 1.7
      ? "HIGH"
      : acceleration >= 1.25
        ? "ELEVATED"
        : "NORMAL";

  return {
    windows: stats,
    currentBurnCentsPerHour: Math.max(0, Math.round(weightedRate)),
    baselineBurnCentsPerHour: Math.max(0, Math.round(baselineRate)),
    recentBurnCentsPerHour: Math.max(0, Math.round(recentRate)),
    priorBurnCentsPerHour: Math.max(0, Math.round(priorRate)),
    acceleration: Number(acceleration.toFixed(4)),
    demandState,
    orderCount: orders.length,
    eligibleOrderCount,
    unknownCostOrderCount,
    knownCostOrderCount: Object.values(stats).reduce((max, item) => Math.max(max, item.knownCostOrders), 0),
  };
}

export function calculateRunway(balanceCents, burnCentsPerHour) {
  const balance = nonNegativeCents(balanceCents);
  const burn = nonNegativeCents(burnCentsPerHour);
  if (burn <= 0) return { hours: null, label: "No recent spend", finite: true };
  const hours = balance / burn;
  return { hours: Number(hours.toFixed(2)), label: `${hours.toFixed(1)} hours`, finite: true };
}

export function confidenceRank(value) {
  return CONFIDENCE_RANK[String(value || "low").toLowerCase()] ?? 0;
}

function freshnessStatus(ageMinutes, maxAgeMinutes = 15) {
  const age = Number(ageMinutes);
  if (!Number.isFinite(age)) return "MISSING";
  if (age > maxAgeMinutes) return "STALE";
  if (age > 10) return "DEGRADED";
  return "GOOD";
}

/**
 * Explain every deterministic confidence input.  This deliberately stays
 * model-free so an operator can audit why a funding decision was blocked.
 */
export function calculateConfidenceDetails({
  freshness = {},
  reconciliationOk = true,
  orderHistoryComplete = true,
  demandVolatility = 0,
  payoutKnown = true,
  coinbaseKnown = true,
  supplierBalanceKnown = true,
  burnSample = {},
  openOrderCommitmentCents = 0,
  mediaCommitmentCents = 0,
  customerLiabilityCents = 0,
} = {}) {
  const ages = Object.values(freshness)
    .map((value) => finiteNumber(value, Infinity))
    .filter((value) => Number.isFinite(value));
  const freshnessValues = Object.values(freshness);
  const staleCount = freshnessValues.filter((value) => !Number.isFinite(Number(value)) || Number(value) > 15).length;
  const missingCount = freshnessValues.filter((value) => !Number.isFinite(Number(value))).length;
  const factors = [];
  const addFreshness = (name, key, required = true) => {
    const age = freshness[key];
    const status = freshnessStatus(age);
    let effect = "Current within the freshness window.";
    if (status === "MISSING") effect = required ? "Required source missing; confidence is LOW." : "No current sample; informational only.";
    else if (status === "STALE") effect = "Older than the 15-minute limit; funding is blocked until refreshed.";
    else if (status === "DEGRADED") effect = "Aging toward the 15-minute limit; confidence is reduced to MEDIUM.";
    factors.push({ name, status, ageMinutes: Number.isFinite(Number(age)) ? Number(age) : null, effect });
  };
  addFreshness("Stripe data freshness", "stripeMinutes");
  addFreshness("CheatsLove data freshness", "supplierMinutes");
  addFreshness("Coinbase/USDC data freshness", "coinbaseMinutes");
  factors.push({
    name: "Supplier ledger reconciliation",
    status: reconciliationOk ? "GOOD" : "DEGRADED",
    effect: reconciliationOk ? "Tracked ledger agrees with observed balances." : "Unreconciled ledger data forces confidence LOW.",
  });
  factors.push({
    name: "Order-history completeness",
    status: orderHistoryComplete ? "GOOD" : "DEGRADED",
    effect: orderHistoryComplete ? "All eligible orders have confirmed supplier costs." : "Unknown supplier costs make burn and reserve estimates unsafe; confidence is LOW.",
  });
  const eligibleOrders = Number(burnSample.eligibleOrderCount || 0);
  const unknownCosts = Number(burnSample.unknownCostOrderCount || 0);
  const burnStatus = unknownCosts > 0 ? "DEGRADED" : eligibleOrders === 0 ? "DEGRADED" : "GOOD";
  factors.push({
    name: "Burn-rate sample quality",
    status: burnStatus,
    eligibleOrders,
    unknownCostOrders: unknownCosts,
    effect: unknownCosts > 0
      ? `${unknownCosts} eligible order(s) lack a confirmed cost; confidence is LOW.`
      : eligibleOrders === 0
        ? "No eligible cost samples; burn rate is not evidence-backed."
        : "Burn rate uses confirmed supplier costs.",
  });
  const volatility = Number(demandVolatility) || 0;
  factors.push({
    name: "Demand volatility",
    status: volatility >= 2 ? "DEGRADED" : "GOOD",
    value: volatility,
    effect: volatility >= 2 ? "Demand is accelerating sharply; reserve multiplier is elevated." : "No high-volatility demand penalty.",
  });
  factors.push({
    name: "Payout certainty",
    status: payoutKnown ? "GOOD" : "MISSING",
    effect: payoutKnown ? "Stripe payout history is readable." : "Payout history is unavailable; confidence is LOW.",
  });
  factors.push({
    name: "CheatsLove balance availability",
    status: supplierBalanceKnown ? "GOOD" : "MISSING",
    effect: supplierBalanceKnown ? "Current supplier balance is readable." : "Supplier balance is unavailable; funding is blocked.",
  });
  factors.push({
    name: "Open commitments",
    status: "GOOD",
    amountCents: Math.max(0, Number(openOrderCommitmentCents) || 0),
    effect: "Reserved dollar-for-dollar before Safe to Reinvest is calculated.",
  });
  factors.push({
    name: "Media/customer liabilities",
    status: "GOOD",
    amountCents: Math.max(0, Number(mediaCommitmentCents) || 0) + Math.max(0, Number(customerLiabilityCents) || 0),
    effect: "Reserved before any supplier funding is considered.",
  });

  const rules = [
    "LOW if reconciliation fails, any required source is missing, two or more sources are stale, order costs are incomplete, payout history is unavailable, or Coinbase availability cannot be verified.",
    "MEDIUM if exactly one source is stale, a source is older than 10 minutes, or demand volatility is high.",
    "HIGH only when required sources are fresh, reconciled, complete, and payout/Coinbase availability are known.",
  ];
  let confidence = "high";
  if (!reconciliationOk || missingCount > 0 || staleCount >= 2 || !orderHistoryComplete || !payoutKnown || !coinbaseKnown || !supplierBalanceKnown) confidence = "low";
  else if (staleCount === 1 || (ages.length && Math.max(...ages) > 10) || volatility >= 2) confidence = "medium";
  return { confidence, factors, rules, staleCount, missingCount };
}

export function calculateConfidence(options = {}) {
  return calculateConfidenceDetails(options).confidence;
}

function reserveDemandMultiplier(demandState) {
  return ({ NORMAL: 1, ELEVATED: 1.15, HIGH: 1.35, SURGING: 1.65 })[demandState] || 1;
}

export function allocateToSuppliers(amountCents, { primarySupplier = "cheatslove", primarySupplierAllocationPercent = 100 } = {}) {
  const amount = nonNegativeCents(amountCents);
  const supplier = normalizedSupplier(primarySupplier, "cheatslove");
  const primary = Math.round(amount * clamp(finiteNumber(primarySupplierAllocationPercent, 100), 0, 100) / 100);
  const allocations = Object.fromEntries(SUPPLIERS.map((key) => [key, 0]));
  allocations[supplier] = primary;
  const remaining = amount - primary;
  if (remaining > 0) allocations.unassigned = remaining;
  return allocations;
}

/**
 * Coinbase USDC is a dedicated supplier-capital source.  Only values that
 * Coinbase explicitly exposes as sendable may reach this function.  The
 * optional sendable/minimum bounds come from the live Coinbase UI; no fee is
 * guessed here.
 */
export function calculateCoinbaseReinvestmentCents({
  availableCents = 0,
  sendableCents = null,
  feeCents = 0,
  minimumSendCents = 0,
  verified = true,
} = {}) {
  if (!verified) return 0;
  const available = nonNegativeCents(availableCents);
  const sendable = sendableCents == null ? available : Math.min(available, nonNegativeCents(sendableCents));
  const fee = nonNegativeCents(feeCents);
  const amount = Math.max(0, sendable - fee);
  const minimum = nonNegativeCents(minimumSendCents);
  return amount >= minimum ? amount : 0;
}

export function calculateSafeToReinvest(input = {}) {
  const config = normalizeFinanceConfig(input.config);
  const availableCashCents = nonNegativeCents(input.availableCashCents);
  const availableUsdcCents = nonNegativeCents(input.availableUsdcCents);
  const stripePendingCents = nonNegativeCents(input.stripePendingCents);
  // Coinbase USDC is dedicated supplier capital and is deliberately excluded
  // from the normal operating-cash reserve calculation below.
  const spendableNowCents = availableCashCents;
  const coinbaseReinvestableUsdcCents = calculateCoinbaseReinvestmentCents({
    availableCents: availableUsdcCents,
    sendableCents: input.coinbaseSendableCents,
    feeCents: input.coinbaseFeeCents,
    minimumSendCents: input.coinbaseMinimumSendCents,
    verified: input.coinbaseAvailableToSendVerified === true && input.coinbaseKnown !== false,
  });
  const burnCentsPerHour = nonNegativeCents(input.burnCentsPerHour);
  const demandState = String(input.demandState || "NORMAL").toUpperCase();
  const multiplier = reserveDemandMultiplier(demandState);
  const expectedFundingHours = Number.isFinite(Number(input.expectedFundingHours))
    ? clamp(Number(input.expectedFundingHours), 0, 720)
    : config.expectedFundingHours;
  const safetyMarginHours = Number.isFinite(Number(input.safetyMarginHours))
    ? clamp(Number(input.safetyMarginHours), 0, 168)
    : config.safetyMarginHours;
  const targetRunwayHours = Math.max(config.minimumTargetRunwayHours, expectedFundingHours + safetyMarginHours);
  const openOrderCommitmentCents = nonNegativeCents(input.openOrderCommitmentCents);
  const mediaCommitmentCents = nonNegativeCents(input.mediaCommitmentCents);
  const customerLiabilityCents = nonNegativeCents(input.customerLiabilityCents);
  const upcomingExpensesCents = nonNegativeCents(input.upcomingExpensesCents);
  const dynamicReserveCents = Math.ceil(burnCentsPerHour * config.dynamicReserveHours * multiplier);
  const targetRunwayReserveCents = Math.ceil(burnCentsPerHour * targetRunwayHours * multiplier);
  const reserveCents = openOrderCommitmentCents
    + mediaCommitmentCents
    + customerLiabilityCents
    + upcomingExpensesCents
    + Math.max(config.minimumReserveCents, dynamicReserveCents)
    + targetRunwayReserveCents;
  const reserveBreakdown = {
    openOrderCommitmentCents,
    mediaCommitmentCents,
    customerLiabilityCents,
    upcomingExpensesCents,
    dynamicReserveCents: Math.max(config.minimumReserveCents, dynamicReserveCents),
    targetRunwayReserveCents,
    totalCents: reserveCents,
    mediaOverlapGuard: "media commitments exclude costs already included in open order commitments",
    targetRunwayAndDynamicReserve: "dynamic reserve is an additional 0.75-hour buffer beyond the target runway reserve",
  };
  const runwayBefore = calculateRunway(nonNegativeCents(input.supplierBalanceCents), burnCentsPerHour);
  const projectedSupplierBalanceCents = nonNegativeCents(input.supplierBalanceCents) + nonNegativeCents(input.safeSupplierTopupCents);
  const runwayAfter = calculateRunway(projectedSupplierBalanceCents, burnCentsPerHour);
  const confidenceDetails = input.confidence
    ? { confidence: input.confidence, factors: [], rules: [], staleCount: 0, missingCount: 0 }
    : calculateConfidenceDetails({
    freshness: input.freshness,
    reconciliationOk: input.reconciliationOk !== false,
    orderHistoryComplete: input.orderHistoryComplete !== false,
    demandVolatility: Math.max(0, multiplier - 1),
    payoutKnown: input.payoutKnown !== false,
    coinbaseKnown: input.coinbaseKnown !== false,
    supplierBalanceKnown: input.supplierBalanceKnown !== false,
    burnSample: input.burnSample,
    openOrderCommitmentCents,
    mediaCommitmentCents,
    customerLiabilityCents,
  });
  const confidence = confidenceDetails.confidence;
  const blockedReasons = [];
  if (input.reconciliationOk === false) blockedReasons.push("supplier reconciliation is not confirmed");
  if (input.customerLiabilityKnown === false) blockedReasons.push("customer wallet liability is unavailable");
  if (input.dataStale === true) blockedReasons.push("one or more required data sources are stale");
  if (confidenceRank(confidence) < confidenceRank(config.minimumConfidence)) blockedReasons.push(`confidence is ${confidence}, below the configured ${config.minimumConfidence} minimum`);
  if (input.supplierBalanceKnown === false) blockedReasons.push("CheatsLove balance is unavailable");
  const dailyRemainingCents = config.maxDailyReinvestmentCents > 0
    ? Math.max(0, config.maxDailyReinvestmentCents - nonNegativeCents(input.reinvestedTodayCents))
    : Infinity;
  const transactionLimitCents = config.maxTransactionCents > 0 ? config.maxTransactionCents : Infinity;
  const rawSafeCents = Math.max(0, spendableNowCents - reserveCents);
  const cappedSafeCents = Math.min(rawSafeCents, transactionLimitCents, dailyRemainingCents);
  const safeToReinvestCents = blockedReasons.length ? 0 : Math.max(0, Math.floor(cappedSafeCents));
  const idealBalanceCents = openOrderCommitmentCents + mediaCommitmentCents + targetRunwayReserveCents;
  const idealTopupCents = Math.max(0, idealBalanceCents - nonNegativeCents(input.supplierBalanceCents));
  const projectedSafeAfterPayoutCents = Math.max(0, safeToReinvestCents + stripePendingCents);
  const runwayHours = runwayBefore.hours;
  const status = blockedReasons.length || safeToReinvestCents <= 0
    ? (runwayHours != null && runwayHours < 2 ? "CRITICAL" : "LOW")
    : runwayHours != null && runwayHours < targetRunwayHours ? "WATCH" : "GOOD";
  return {
    mode: config.mode,
    primarySupplier: config.primarySupplier,
    availableCashCents,
    availableUsdcCents,
    coinbaseReinvestableUsdcCents,
    coinbasePolicy: "100% AVAILABLE USDC -> CHEATSLOVE",
    coinbaseOnly: coinbaseReinvestableUsdcCents > 0,
    coinbaseAllocation: allocateToSuppliers(coinbaseReinvestableUsdcCents, { primarySupplier: "cheatslove", primarySupplierAllocationPercent: 100 }),
    spendableNowCents,
    stripePendingCents,
    reserveCents,
    reserveBreakdown,
    openOrderCommitmentCents,
    mediaCommitmentCents,
    customerLiabilityCents,
    upcomingExpensesCents,
    targetRunwayHours: Number(targetRunwayHours.toFixed(2)),
    targetRunwayReserveCents,
    dynamicReserveCents,
    currentBurnCentsPerHour: burnCentsPerHour,
    demandState,
    safeToReinvestCents,
    projectedSafeAfterPayoutCents,
    idealTopupCents,
    unfundedNeedCents: Math.max(0, idealTopupCents - safeToReinvestCents),
    runwayBefore,
    runwayAfter,
    confidence,
    confidenceFactors: confidenceDetails.factors,
    confidenceRules: confidenceDetails.rules,
    status,
    blockedReasons,
    allocation: allocateToSuppliers(safeToReinvestCents, config),
    usesStripePending: false,
    calculatedAt: new Date(timestampMs(input.nowMs, Date.now())).toISOString(),
  };
}

export function createReinvestmentBatch({
  id = null,
  supplier = "cheatslove",
  amountCents,
  verifiedAmountCents = 0,
  confidence = "low",
  sourceTransactionId = null,
  startingBalanceCents = 0,
  simulation = true,
  fundingPlanId = null,
  createdAt = new Date().toISOString(),
} = {}) {
  const amount = nonNegativeCents(amountCents);
  return {
    id,
    supplier: normalizedSupplier(supplier, "cheatslove"),
    amountCents: amount,
    verifiedAmountCents: Math.min(amount, nonNegativeCents(verifiedAmountCents)),
    confidence,
    sourceTransactionId,
    startingBalanceCents: nonNegativeCents(startingBalanceCents),
    capitalRemainingCents: amount,
    capitalConsumedCents: 0,
    revenueAttributedCents: 0,
    refundsAttributedCents: 0,
    grossProfitCents: 0,
    status: amount > 0 ? "ACTIVE" : "COMPLETED",
    simulation: Boolean(simulation),
    fundingPlanId,
    createdAt,
  };
}

export function allocateOrderToBatches(batches = [], {
  orderId,
  supplierCostCents,
  revenueCents = 0,
  refundCents = 0,
} = {}) {
  const cost = nonNegativeCents(supplierCostCents);
  const revenue = nonNegativeCents(revenueCents);
  const refund = Math.min(revenue, nonNegativeCents(refundCents));
  let remainingCost = cost;
  const allocations = [];
  const ordered = [...batches].sort((left, right) => timestampMs(left.createdAt) - timestampMs(right.createdAt));
  for (const batch of ordered) {
    if (remainingCost <= 0) break;
    const available = nonNegativeCents(batch.capitalRemainingCents);
    if (available <= 0 || String(batch.status || "").toUpperCase() === "COMPLETED") continue;
    const allocatedCostCents = Math.min(available, remainingCost);
    const revenueShareCents = cost > 0 ? Math.round(revenue * allocatedCostCents / cost) : 0;
    const refundShareCents = cost > 0 ? Math.round(refund * allocatedCostCents / cost) : 0;
    batch.capitalRemainingCents = available - allocatedCostCents;
    batch.capitalConsumedCents = nonNegativeCents(batch.capitalConsumedCents) + allocatedCostCents;
    batch.revenueAttributedCents = nonNegativeCents(batch.revenueAttributedCents) + revenueShareCents;
    batch.refundsAttributedCents = nonNegativeCents(batch.refundsAttributedCents) + refundShareCents;
    batch.grossProfitCents = batch.revenueAttributedCents - batch.refundsAttributedCents - batch.capitalConsumedCents;
    if (batch.capitalRemainingCents <= 0) batch.status = "FULLY_DEPLOYED";
    allocations.push({
      orderId,
      batchId: batch.id || null,
      supplierCostCents: allocatedCostCents,
      revenueCents: revenueShareCents,
      refundCents: refundShareCents,
      fundingFraction: cost > 0 ? Number((allocatedCostCents / cost).toFixed(8)) : 0,
    });
    remainingCost -= allocatedCostCents;
  }
  return { allocations, unfundedCostCents: remainingCost };
}

export function applyRefundToAllocations(batches = [], allocations = [], refundCents = 0) {
  let remaining = nonNegativeCents(refundCents);
  const byBatch = new Map((batches || []).map((batch) => [String(batch.id), batch]));
  for (const allocation of allocations || []) {
    if (remaining <= 0) break;
    const batch = byBatch.get(String(allocation.batchId));
    if (!batch) continue;
    const alreadyRefunded = nonNegativeCents(allocation.refundCents);
    const capacity = Math.max(0, nonNegativeCents(allocation.revenueCents) - alreadyRefunded);
    const applied = Math.min(capacity, remaining);
    allocation.refundCents = alreadyRefunded + applied;
    batch.refundsAttributedCents = nonNegativeCents(batch.refundsAttributedCents) + applied;
    batch.grossProfitCents = batch.revenueAttributedCents - batch.refundsAttributedCents - nonNegativeCents(batch.capitalConsumedCents);
    remaining -= applied;
  }
  return { appliedRefundCents: nonNegativeCents(refundCents) - remaining, unappliedRefundCents: remaining };
}

export function buildFundingPlan(decision, {
  id = null,
  createdAt = new Date().toISOString(),
  simulation = true,
} = {}) {
  const coinbaseAmount = nonNegativeCents(decision?.coinbaseReinvestableUsdcCents);
  const targetAmount = coinbaseAmount > 0 ? coinbaseAmount : nonNegativeCents(decision?.safeToReinvestCents);
  return {
    id,
    mode: decision?.mode || "simulation",
    supplier: decision?.primarySupplier || "cheatslove",
    // The database field is the amount this plan will fund.  For a Coinbase
    // plan that is the dedicated available-to-send amount; the decision JSON
    // retains the separate operating-cash Safe-to-Reinvest value.
    safeToReinvestCents: targetAmount,
    idealTopupCents: nonNegativeCents(decision?.idealTopupCents),
    unfundedNeedCents: nonNegativeCents(decision?.unfundedNeedCents),
    confidence: decision?.confidence || "low",
    status: decision?.blockedReasons?.length ? "blocked" : "proposed",
    simulation: Boolean(simulation),
    reason: Array.isArray(decision?.blockedReasons) && decision.blockedReasons.length
      ? decision.blockedReasons.join("; ")
      : coinbaseAmount > 0
        ? `Coinbase verified available-to-send USDC ${coinbaseAmount} cents is dedicated to ${decision?.primarySupplier || "cheatslove"}.`
        : `Spendable ${nonNegativeCents(decision?.spendableNowCents)} cents minus ${nonNegativeCents(decision?.reserveCents)} cents reserve leaves ${nonNegativeCents(decision?.safeToReinvestCents)} cents; allocate to ${decision?.primarySupplier || "cheatslove"}.`,
    decision: decision || {},
    createdAt,
  };
}
