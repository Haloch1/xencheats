import assert from "node:assert/strict";
import {
  validateCoinbaseOperatorPlan,
  parseCoinbaseReview,
  compareCoinbaseReview,
  detectCoinbaseSecurityChallenge,
  extractCoinbaseTransactionEvidence,
} from "../finance/coinbase-browser-operator.mjs";

const plan = validateCoinbaseOperatorPlan({
  fundingPlanId: "plan-demo",
  asset: "USDC",
  amountCents: 2400,
  recipient: "0x46b3d37c530d6c01bd367136028bad28d7b5fa88",
  network: "Base",
  invoiceId: "invoice-demo",
  invoiceExpiration: new Date(Date.now() + 60_000).toISOString(),
});
assert.equal(plan.amountCents, 2400);
assert.equal(plan.asset, "USDC");
assert.throws(() => validateCoinbaseOperatorPlan({ ...plan, recipient: "not-an-address" }), /RECIPIENT_INVALID/);
assert.throws(() => validateCoinbaseOperatorPlan({ ...plan, invoiceExpiration: new Date(Date.now() - 60_000).toISOString() }), /INVOICE_EXPIRED/);

const review = parseCoinbaseReview(`Send $24.00 in USDC\n\n24 USDC\n\nSend to\n\n${plan.recipient}\n\nNetwork\n\nBase\n\nTotal\n\nincl. $0.00 network fee\n\n$24.00\nSend now`);
assert.equal(review.asset, "USDC");
assert.equal(review.amountCents, 2400);
assert.equal(review.recipient, plan.recipient);
assert.equal(review.network, "Base");
assert.equal(compareCoinbaseReview(plan, review).ok, true);
assert.equal(compareCoinbaseReview(plan, { ...review, amountCents: 2399 }).ok, false);
assert.equal(detectCoinbaseSecurityChallenge("https://www.coinbase.com/home", "Please enter your code"), "enter your code");
assert.equal(detectCoinbaseSecurityChallenge("https://www.coinbase.com/home", "Send $24.00 in USDC"), null);
assert.equal(extractCoinbaseTransactionEvidence({ url: "https://www.coinbase.com/transfers/transfer_abc12345" }).transactionId, "transfer_abc12345");
assert.equal(extractCoinbaseTransactionEvidence({ responses: [{ transferId: "transfer_abc12345" }] }).transactionId, "transfer_abc12345");
assert.equal(extractCoinbaseTransactionEvidence({ body: "Send complete. Reference: ordinary text" }).transactionId, null);
assert.equal(extractCoinbaseTransactionEvidence({ body: `Send to ${plan.recipient}` }).transactionId, null);

console.log("coinbase-browser-operator.test.mjs: all assertions passed");
