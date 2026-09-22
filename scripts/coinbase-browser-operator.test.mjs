import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  reportBridge,
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
assert.equal(detectCoinbaseSecurityChallenge("https://www.coinbase.com/assets", "Performing security verification"), "performing security verification");
assert.equal(detectCoinbaseSecurityChallenge("https://www.coinbase.com/home", "Send $24.00 in USDC"), null);
assert.equal(extractCoinbaseTransactionEvidence({ url: "https://www.coinbase.com/transfers/transfer_abc12345" }).transactionId, "transfer_abc12345");
assert.equal(extractCoinbaseTransactionEvidence({ responses: [{ transferId: "transfer_abc12345" }] }).transactionId, "transfer_abc12345");
assert.equal(extractCoinbaseTransactionEvidence({ body: "Send complete. Reference: ordinary text" }).transactionId, null);
assert.equal(extractCoinbaseTransactionEvidence({ body: `Send to ${plan.recipient}` }).transactionId, null);

const priorEnv = {
  url: process.env.XEN_REINVESTMENT_BRIDGE_URL,
  token: process.env.XEN_REINVESTMENT_BRIDGE_TOKEN,
  operator: process.env.XEN_REINVESTMENT_OPERATOR_ID,
};
let rejectSubmitting = true;
const bridge = createServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) body += chunk;
  const report = JSON.parse(body);
  if (rejectSubmitting && report.status === "submitting") {
    response.writeHead(503).end(JSON.stringify({ error: "unavailable" }));
    return;
  }
  response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ accepted: true }));
});
await new Promise((resolve) => bridge.listen(0, "127.0.0.1", resolve));
try {
  process.env.XEN_REINVESTMENT_BRIDGE_URL = `http://127.0.0.1:${bridge.address().port}`;
  process.env.XEN_REINVESTMENT_BRIDGE_TOKEN = "test-token";
  process.env.XEN_REINVESTMENT_OPERATOR_ID = "test-operator";
  await assert.rejects(reportBridge("plan-demo", "submitting"), /REPORT_REJECTED:503/);
  rejectSubmitting = false;
  assert.equal((await reportBridge("plan-demo", "submitting")).accepted, true);
} finally {
  if (priorEnv.url === undefined) delete process.env.XEN_REINVESTMENT_BRIDGE_URL;
  else process.env.XEN_REINVESTMENT_BRIDGE_URL = priorEnv.url;
  if (priorEnv.token === undefined) delete process.env.XEN_REINVESTMENT_BRIDGE_TOKEN;
  else process.env.XEN_REINVESTMENT_BRIDGE_TOKEN = priorEnv.token;
  if (priorEnv.operator === undefined) delete process.env.XEN_REINVESTMENT_OPERATOR_ID;
  else process.env.XEN_REINVESTMENT_OPERATOR_ID = priorEnv.operator;
  await new Promise((resolve, reject) => bridge.close((error) => error ? reject(error) : resolve()));
}

console.log("coinbase-browser-operator.test.mjs: all assertions passed");
