export const LOYALTY_ORDERS_PER_REWARD = 5;
export const LOYALTY_SPEND_PER_REWARD_CENTS = 7_500;
export const LOYALTY_REWARD_CENTS = 250;
export const LOYALTY_PROGRAM_START_AT = "2026-09-26T15:11:25.000Z";

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

export function loyaltyRewardTransactionId(userId, milestone) {
  return `loyalty_${userId}_${milestone}`;
}

export async function syncCustomerLoyaltyRewards({
  userId,
  orders,
  supabaseAdmin,
  loadStripeRefundMap,
  programStartsAt = LOYALTY_PROGRAM_START_AT,
  onError = () => {},
}) {
  const eligibleOrders = (orders || []).filter((order) =>
    order?.status === "fulfilled" && Number(order.amount_cents) > 0 && isEligibleAfterStart(order, programStartsAt)
  );
  let refundSnapshot = { known: true, byPaymentIntent: new Map() };
  if (eligibleOrders.some((order) => order.stripe_payment_intent)) {
    try {
      refundSnapshot = typeof loadStripeRefundMap === "function"
        ? await loadStripeRefundMap()
        : { known: false, byPaymentIntent: new Map() };
    } catch {
      refundSnapshot = { known: false, byPaymentIntent: new Map() };
    }
  }

  const progress = calculateCustomerLoyalty(orders, {
    refundsKnown: refundSnapshot.known === true && refundSnapshot.complete !== false,
    refundCentsByPaymentIntent: refundSnapshot.byPaymentIntent,
    programStartsAt,
  });
  const maximumMilestone = Math.floor(progress.fulfilledOrderCount / LOYALTY_ORDERS_PER_REWARD);
  const milestoneIds = Array.from({ length: maximumMilestone }, (_, index) =>
    loyaltyRewardTransactionId(userId, index + 1)
  );
  const snapshot = (status, earnedRewardsCount = null, newlyAwardedCount = 0) => ({
    status,
    eligibleOrderCount: progress.eligibleOrderCount,
    eligibleSpendCents: progress.eligibleSpendCents,
    progressOrders: progress.progressOrders,
    progressSpendCents: progress.progressSpendCents,
    ordersPerReward: LOYALTY_ORDERS_PER_REWARD,
    spendPerRewardCents: LOYALTY_SPEND_PER_REWARD_CENTS,
    rewardCents: LOYALTY_REWARD_CENTS,
    earnedRewardsCount,
    newlyAwardedCount,
  });

  if (progress.status !== "ready") return snapshot("verification-unavailable");
  if (!supabaseAdmin) return snapshot("credit-pending");

  const readRewardTransactions = async (ids) => {
    const transactions = new Map();
    for (let start = 0; start < ids.length; start += 100) {
      const batch = ids.slice(start, start + 100);
      const { data, error } = await supabaseAdmin
        .from("balance_transactions")
        .select("stripe_session_id, user_id, type, amount_cents")
        .in("stripe_session_id", batch);
      if (error) throw error;

      for (const row of data || []) {
        if (!batch.includes(row.stripe_session_id)) continue;
        if (row.user_id !== userId || row.type !== "adjustment" || Number(row.amount_cents) !== LOYALTY_REWARD_CENTS) {
          throw new Error("Loyalty reward transaction does not match the expected account or amount.");
        }
        transactions.set(row.stripe_session_id, row);
      }
    }
    return transactions;
  };

  let newlyAwardedCount = 0;
  try {
    let transactions = await readRewardTransactions(milestoneIds);
    for (let milestone = 1; milestone <= progress.earnedMilestones; milestone += 1) {
      const transactionId = loyaltyRewardTransactionId(userId, milestone);
      if (transactions.has(transactionId)) continue;

      const { error } = await supabaseAdmin.rpc("credit_balance", {
        p_user_id: userId,
        p_amount_cents: LOYALTY_REWARD_CENTS,
        p_type: "adjustment",
        p_stripe_session_id: transactionId,
        p_note: `XenCheats loyalty credit — milestone ${milestone}`,
      });

      if (error) {
        if (error.code !== "23505" && !/duplicate key|unique constraint/i.test(error.message || "")) {
          throw error;
        }
        // Another simultaneous account request may have won the idempotency
        // race. Accept it only after verifying the committed transaction.
        transactions = await readRewardTransactions(milestoneIds);
        if (!transactions.has(transactionId)) throw error;
      } else {
        newlyAwardedCount += 1;
      }
    }

    transactions = await readRewardTransactions(milestoneIds);
    const earnedRewardsCount = [...transactions.keys()].filter((id) => milestoneIds.includes(id)).length;
    return snapshot("ready", earnedRewardsCount, newlyAwardedCount);
  } catch (error) {
    try { onError(error); } catch {}
    return snapshot("credit-pending", null, newlyAwardedCount);
  }
}
