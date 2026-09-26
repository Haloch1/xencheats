import assert from "node:assert/strict";
import {
  calculateCustomerLoyalty,
  LOYALTY_PROGRAM_START_AT,
  LOYALTY_ORDERS_PER_REWARD,
  LOYALTY_PRODUCT_REWARD_MAX_RETAIL_CENTS,
  LOYALTY_SPEND_PER_REWARD_CENTS,
  getEligibleLoyaltyProducts,
  isEligibleLoyaltyProduct,
  summarizeLoyaltyProductRewards,
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
assert.equal(LOYALTY_PRODUCT_REWARD_MAX_RETAIL_CENTS, 500);

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

const makeProduct = (overrides = {}) => ({
  slug: "game-one",
  name: "Game One",
  available: true,
  variants: [{
    slug: "day",
    name: "1 Day Key",
    amount: 499,
    priceDisplay: "$4.99",
    stockLabel: "In Stock",
    supplierDigital: true,
  }],
  ...overrides,
});
assert.equal(isEligibleLoyaltyProduct(makeProduct(), makeProduct().variants[0]), true, "$4.99 one-day digital products qualify");
assert.equal(isEligibleLoyaltyProduct(makeProduct({ variants: [{ ...makeProduct().variants[0], amount: 500 }] }), { ...makeProduct().variants[0], amount: 500 }), false, "$5.00 is not under $5");
assert.equal(isEligibleLoyaltyProduct(makeProduct(), { ...makeProduct().variants[0], name: "7 Day Key" }), false, "longer durations do not qualify");
assert.equal(isEligibleLoyaltyProduct(makeProduct({ available: false }), makeProduct().variants[0]), false, "unavailable products do not qualify");
assert.equal(isEligibleLoyaltyProduct(makeProduct({ manualDelivery: true }), makeProduct().variants[0]), false, "manual products do not qualify");
assert.equal(isEligibleLoyaltyProduct(makeProduct(), { ...makeProduct().variants[0], manualDelivery: true }), false, "manual-delivery variants do not qualify");
assert.equal(isEligibleLoyaltyProduct(makeProduct(), { ...makeProduct().variants[0], checkoutBlocked: true }), false, "blocked variants do not qualify");
assert.equal(isEligibleLoyaltyProduct(makeProduct(), { ...makeProduct().variants[0], stockLabel: "Unavailable" }), false, "unavailable stock does not qualify");
assert.deepEqual(getEligibleLoyaltyProducts([
  makeProduct(),
  makeProduct({ slug: "exact-five", variants: [{ ...makeProduct().variants[0], amount: 500 }] }),
]).map((item) => item.productSlug), ["game-one"]);
assert.equal(getEligibleLoyaltyProducts([makeProduct()])[0].priceDisplay, "$4.99", "displayed price is derived from the authoritative cents value");

const completedReward = summarizeLoyaltyProductRewards(2, [{ milestone: 1, status: "completed" }]);
assert.equal(completedReward.completedRewardsCount, 1);
assert.equal(completedReward.availableRewardsCount, 1);
assert.equal(completedReward.nextRedeemableMilestone, 2);
const pendingReward = summarizeLoyaltyProductRewards(2, [{ milestone: 1, status: "processing" }]);
assert.equal(pendingReward.pendingRewardsCount, 1);
assert.equal(pendingReward.nextRedeemableMilestone, null, "an unresolved claim prevents another reward claim");
const failedReward = summarizeLoyaltyProductRewards(2, [{ milestone: 1, status: "failed" }]);
assert.equal(failedReward.availableRewardsCount, 2);
assert.equal(failedReward.nextRedeemableMilestone, 1, "a safely failed claim can be retried");

console.log("Customer loyalty tests passed: spend/order thresholds, net refunds, excluded statuses, free-product eligibility, and redemption idempotency states.");
