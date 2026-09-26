export const LOYALTY_ORDERS_PER_REWARD = 5;
export const LOYALTY_SPEND_PER_REWARD_CENTS = 3_000;
export const LOYALTY_PRODUCT_REWARD_MAX_RETAIL_CENTS = 500;
export const LOYALTY_PROGRAM_START_AT = "2026-09-26T15:11:25.000Z";

const LOYALTY_DAY_VARIANT = /^1\s*day(?:\s+key)?$/i;
const ACTIVE_REDEMPTION_STATUSES = new Set(["processing", "pending", "reconciliation_required"]);

function isEligibleAfterStart(order, programStartsAt) {
  if (!programStartsAt) return true;
  const createdAt = Date.parse(order?.created_at || "");
  return Number.isFinite(createdAt) && createdAt >= Date.parse(programStartsAt);
}

/**
 * Calculate purchase progress from server-loaded order rows. A charge shared
 * by several cart items is counted once for refunds; a fully refunded charge
 * contributes neither spend nor completed-order count.
 */
export function calculateCustomerLoyalty(orders, {
  refundsKnown = true,
  refundCentsByPaymentIntent = new Map(),
  programStartsAt = null,
} = {}) {
  const fulfilled = (Array.isArray(orders) ? orders : [])
    .filter((order) => order?.status === "fulfilled"
      && Number.isSafeInteger(Number(order.amount_cents))
      && Number(order.amount_cents) > 0
      && isEligibleAfterStart(order, programStartsAt))
    .map((order) => ({
      paymentIntent: typeof order.stripe_payment_intent === "string" ? order.stripe_payment_intent : "",
      amountCents: Number(order.amount_cents),
    }));

  if (!refundsKnown) {
    return {
      status: "unavailable",
      eligibleOrderCount: 0,
      eligibleSpendCents: 0,
      earnedMilestones: 0,
      progressOrders: 0,
      progressSpendCents: 0,
      fulfilledOrderCount: fulfilled.length,
    };
  }

  const groups = new Map();
  let eligibleSpendCents = 0;
  let eligibleOrderCount = 0;

  for (const order of fulfilled) {
    if (!order.paymentIntent) {
      eligibleOrderCount += 1;
      eligibleSpendCents += order.amountCents;
      continue;
    }

    const group = groups.get(order.paymentIntent) || { grossCents: 0, orderCount: 0 };
    group.grossCents += order.amountCents;
    group.orderCount += 1;
    groups.set(order.paymentIntent, group);
  }

  for (const [paymentIntent, group] of groups) {
    const refundedCents = Math.max(0, Math.trunc(Number(refundCentsByPaymentIntent.get(paymentIntent)) || 0));
    const netSpendCents = Math.max(0, group.grossCents - refundedCents);
    eligibleSpendCents += netSpendCents;
    if (netSpendCents > 0) eligibleOrderCount += group.orderCount;
  }

  const earnedMilestones = Math.min(
    Math.floor(eligibleOrderCount / LOYALTY_ORDERS_PER_REWARD),
    Math.floor(eligibleSpendCents / LOYALTY_SPEND_PER_REWARD_CENTS),
  );

  return {
    status: "ready",
    eligibleOrderCount,
    eligibleSpendCents,
    earnedMilestones,
    progressOrders: Math.min(LOYALTY_ORDERS_PER_REWARD, Math.max(0, eligibleOrderCount - earnedMilestones * LOYALTY_ORDERS_PER_REWARD)),
    progressSpendCents: Math.min(LOYALTY_SPEND_PER_REWARD_CENTS, Math.max(0, eligibleSpendCents - earnedMilestones * LOYALTY_SPEND_PER_REWARD_CENTS)),
    fulfilledOrderCount: fulfilled.length,
  };
}

export function isEligibleLoyaltyProduct(product, variant) {
  const priceCents = Number(variant?.amount);
  return Boolean(product)
    && product.available !== false
    && !product.checkoutBlocked
    && !product.manualDelivery
    && !product.testOnly
    && LOYALTY_DAY_VARIANT.test(String(variant?.name || "").trim())
    && Number.isSafeInteger(priceCents)
    && priceCents > 0
    && priceCents < LOYALTY_PRODUCT_REWARD_MAX_RETAIL_CENTS
    && !variant?.checkoutBlocked
    && !variant?.manualDelivery
    && variant?.supplierDigital !== false
    && !/^unavailable|out of stock/i.test(String(variant?.stockLabel || ""));
}

export function getEligibleLoyaltyProducts(catalog) {
  return (Array.isArray(catalog) ? catalog : [])
    .flatMap((product) => (product?.variants || [])
      .filter((variant) => isEligibleLoyaltyProduct(product, variant))
      .map((variant) => ({
        productSlug: String(product.slug || ""),
        productName: String(product.name || ""),
        variantSlug: String(variant.slug || ""),
        variantName: String(variant.name || ""),
        priceCents: Number(variant.amount),
        priceDisplay: `$${(Number(variant.amount) / 100).toFixed(2)}`,
      })))
    .filter((item) => item.productSlug && item.variantSlug)
    .sort((left, right) => left.productName.localeCompare(right.productName));
}

export function summarizeLoyaltyProductRewards(earnedMilestones, redemptions = []) {
  const earnedCount = Math.max(0, Math.trunc(Number(earnedMilestones) || 0));
  const byMilestone = new Map();
  for (const redemption of Array.isArray(redemptions) ? redemptions : []) {
    const milestone = Math.trunc(Number(redemption?.milestone));
    if (milestone > 0 && milestone <= earnedCount) byMilestone.set(milestone, redemption);
  }

  let completedRewardsCount = 0;
  let pendingRewardsCount = 0;
  let availableRewardsCount = 0;
  let nextRedeemableMilestone = null;
  for (let milestone = 1; milestone <= earnedCount; milestone += 1) {
    const status = String(byMilestone.get(milestone)?.status || "");
    if (status === "completed") {
      completedRewardsCount += 1;
      continue;
    }
    if (ACTIVE_REDEMPTION_STATUSES.has(status)) {
      pendingRewardsCount += 1;
      continue;
    }
    availableRewardsCount += 1;
    if (nextRedeemableMilestone === null) nextRedeemableMilestone = milestone;
  }

  if (pendingRewardsCount > 0) nextRedeemableMilestone = null;
  return {
    earnedRewardsCount: earnedCount,
    completedRewardsCount,
    pendingRewardsCount,
    availableRewardsCount,
    nextRedeemableMilestone,
  };
}
