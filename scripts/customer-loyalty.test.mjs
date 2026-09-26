import assert from "node:assert/strict";
import {
  calculateCustomerLoyalty,
  LOYALTY_PROGRAM_START_AT,
  LOYALTY_ORDERS_PER_REWARD,
  LOYALTY_REWARD_CENTS,
  LOYALTY_SPEND_PER_REWARD_CENTS,
  loyaltyRewardTransactionId,
  syncCustomerLoyaltyRewards,
} from "../finance/customer-loyalty.mjs";

const orders = (count, amountCents, extras = {}) => Array.from({ length: count }, (_, index) => ({
  id: `order-${index + 1}`,
  status: "fulfilled",
  amount_cents: amountCents,
  created_at: new Date(Date.parse(LOYALTY_PROGRAM_START_AT) + 60_000).toISOString(),
  ...extras,
}));

assert.equal(LOYALTY_ORDERS_PER_REWARD, 5);
assert.equal(LOYALTY_SPEND_PER_REWARD_CENTS, 3000);
assert.equal(LOYALTY_REWARD_CENTS, 250);

assert.equal(calculateCustomerLoyalty(orders(4, 2500)).earnedMilestones, 0, "order-count gate blocks four orders");
assert.equal(calculateCustomerLoyalty(orders(5, 599)).earnedMilestones, 0, "spend gate blocks $29.95");

const firstReward = calculateCustomerLoyalty(orders(5, 600));
assert.equal(firstReward.earnedMilestones, 1, "five $6 fulfilled orders earn one reward at $30 total spend");
assert.equal(firstReward.eligibleSpendCents, 3000);
assert.equal(firstReward.progressOrders, 0);
assert.equal(firstReward.progressSpendCents, 0);

assert.equal(calculateCustomerLoyalty(orders(10, 600)).earnedMilestones, 2, "milestones repeat only when both thresholds repeat");
assert.equal(calculateCustomerLoyalty(orders(10, 300)).earnedMilestones, 1, "second $30 spend threshold is enforced exactly");
assert.equal(calculateCustomerLoyalty(orders(10, 299)).earnedMilestones, 0, "$29.90 does not meet the first spend threshold");
assert.equal(calculateCustomerLoyalty(
  orders(5, 1500).map((order) => ({ ...order, created_at: new Date(Date.parse(LOYALTY_PROGRAM_START_AT) - 1).toISOString() })),
  { programStartsAt: LOYALTY_PROGRAM_START_AT },
).earnedMilestones, 0, "pre-launch purchases are not retroactively credited");

const filtered = calculateCustomerLoyalty([
  ...orders(4, 2000),
  { status: "pending", amount_cents: 5000 },
  { status: "paid", amount_cents: 5000 },
  { status: "canceled", amount_cents: 5000 },
  { status: "fulfilled", amount_cents: 0 },
  { status: "fulfilled", amount_cents: -100 },
]);
assert.equal(filtered.eligibleOrderCount, 4, "pending, paid, canceled, zero, and negative rows do not qualify");
assert.equal(filtered.eligibleSpendCents, 8000);
assert.equal(filtered.earnedMilestones, 0);

const partialRefund = calculateCustomerLoyalty(
  orders(5, 600, { stripe_payment_intent: "pi-shared" }),
  { refundCentsByPaymentIntent: new Map([["pi-shared", 1]]) },
);
assert.equal(partialRefund.eligibleOrderCount, 5);
assert.equal(partialRefund.eligibleSpendCents, 2999);
assert.equal(partialRefund.earnedMilestones, 0, "partial refunds reduce qualifying spend");

const fullyRefunded = calculateCustomerLoyalty(
  orders(5, 600, { stripe_payment_intent: "pi-refunded" }),
  { refundCentsByPaymentIntent: new Map([["pi-refunded", 3000]]) },
);
assert.equal(fullyRefunded.eligibleOrderCount, 0, "fully refunded payment group does not count as orders");
assert.equal(fullyRefunded.eligibleSpendCents, 0);

const unverifiable = calculateCustomerLoyalty(orders(5, 1500, { stripe_payment_intent: "pi-unknown" }), { refundsKnown: false });
assert.equal(unverifiable.status, "unavailable");
assert.equal(unverifiable.earnedMilestones, 0, "unknown refund history never issues a reward");

assert.equal(loyaltyRewardTransactionId("user-123", 2), "loyalty_user-123_2");

function createFakeWallet({ simulateUniqueRace = false } = {}) {
  const transactions = new Map();
  const wallet = { balanceCents: 0, rpcCalls: 0 };
  const client = {
    from(table) {
      assert.equal(table, "balance_transactions");
      return {
        select() {
          return {
            async in(field, ids) {
              assert.equal(field, "stripe_session_id");
              return {
                data: ids.map((id) => transactions.get(id)).filter(Boolean),
                error: null,
              };
            },
          };
        },
      };
    },
    async rpc(name, args) {
      assert.equal(name, "credit_balance");
      wallet.rpcCalls += 1;
      if (simulateUniqueRace) {
        simulateUniqueRace = false;
        wallet.balanceCents += args.p_amount_cents;
        transactions.set(args.p_stripe_session_id, {
          stripe_session_id: args.p_stripe_session_id,
          user_id: args.p_user_id,
          type: args.p_type,
          amount_cents: args.p_amount_cents,
        });
        return { error: { code: "23505", message: "duplicate key" } };
      }
      if (!transactions.has(args.p_stripe_session_id)) {
        wallet.balanceCents += args.p_amount_cents;
        transactions.set(args.p_stripe_session_id, {
          stripe_session_id: args.p_stripe_session_id,
          user_id: args.p_user_id,
          type: args.p_type,
          amount_cents: args.p_amount_cents,
        });
      }
      return { error: null };
    },
  };
  return { client, wallet };
}

const fakeOrders = orders(5, 1500);
const { client: fakeWalletClient, wallet: fakeWallet } = createFakeWallet();
const firstSync = await syncCustomerLoyaltyRewards({ userId: "user-123", orders: fakeOrders, supabaseAdmin: fakeWalletClient });
assert.equal(firstSync.status, "ready");
assert.equal(firstSync.earnedRewardsCount, 1);
assert.equal(firstSync.newlyAwardedCount, 1);
assert.equal(fakeWallet.balanceCents, 250);
const repeatSync = await syncCustomerLoyaltyRewards({ userId: "user-123", orders: fakeOrders, supabaseAdmin: fakeWalletClient });
assert.equal(repeatSync.earnedRewardsCount, 1);
assert.equal(repeatSync.newlyAwardedCount, 0);
assert.equal(fakeWallet.balanceCents, 250, "repeated account refresh never credits a milestone twice");
assert.equal(fakeWallet.rpcCalls, 1, "an already credited milestone skips the RPC");

const { client: racedClient, wallet: racedWallet } = createFakeWallet({ simulateUniqueRace: true });
const racedSync = await syncCustomerLoyaltyRewards({ userId: "user-race", orders: fakeOrders, supabaseAdmin: racedClient });
assert.equal(racedSync.status, "ready", "a concurrent idempotency winner is verified and accepted");
assert.equal(racedSync.earnedRewardsCount, 1);
assert.equal(racedWallet.balanceCents, 250, "a unique-key race does not double-credit");

const { client: blockedClient, wallet: blockedWallet } = createFakeWallet();
const blockedSync = await syncCustomerLoyaltyRewards({
  userId: "user-unverified",
  orders: orders(5, 1500, { stripe_payment_intent: "pi-unverified" }),
  supabaseAdmin: blockedClient,
  loadStripeRefundMap: async () => ({ known: false, byPaymentIntent: new Map() }),
});
assert.equal(blockedSync.status, "verification-unavailable");
assert.equal(blockedWallet.balanceCents, 0, "unknown refund data never issues store credit");

const { client: incompleteClient, wallet: incompleteWallet } = createFakeWallet();
const incompleteSync = await syncCustomerLoyaltyRewards({
  userId: "user-incomplete",
  orders: orders(5, 1500, { stripe_payment_intent: "pi-incomplete" }),
  supabaseAdmin: incompleteClient,
  loadStripeRefundMap: async () => ({ known: true, complete: false, byPaymentIntent: new Map() }),
});
assert.equal(incompleteSync.status, "verification-unavailable");
assert.equal(incompleteWallet.balanceCents, 0, "truncated refund history never issues a reward");

console.log("Customer loyalty tests passed: dual thresholds, net refunds, excluded statuses, complete refund verification, repeat-refresh idempotency, and concurrent-credit protection.");
