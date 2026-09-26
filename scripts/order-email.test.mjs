import assert from "node:assert/strict";
import {
  buildCartItemCheckoutSession,
  checkoutCustomerEmail,
  customerDeliveryComplete,
  hasCustomerEmail,
  normalizeCustomerDeliveryEmail,
} from "../lib/customer-order-email.mjs";

const guestStripeSession = {
  id: "cs_test_cart",
  payment_intent: "pi_test_cart",
  customer_details: { email: "  buyer@example.com  " },
  customer_email: null,
  metadata: { type: "cart" },
};

assert.equal(checkoutCustomerEmail(guestStripeSession), "buyer@example.com");
assert.equal(checkoutCustomerEmail({ customer_email: " buyer@example.com " }), "buyer@example.com");
assert.equal(checkoutCustomerEmail({ customer_details: { email: " " } }), null);
assert.equal(normalizeCustomerDeliveryEmail(" buyer@example.com "), "buyer@example.com");
assert.equal(normalizeCustomerDeliveryEmail("Unknown"), null);
assert.equal(normalizeCustomerDeliveryEmail("not-an-email"), null);
assert.equal(hasCustomerEmail("not-an-email"), true);
assert.equal(hasCustomerEmail("Unknown"), false);
assert.equal(customerDeliveryComplete({ emailRequired: true, emailDelivered: false, discordDelivered: true }), false);
assert.equal(customerDeliveryComplete({ emailRequired: true, emailDelivered: true, discordDelivered: false }), true);
assert.equal(customerDeliveryComplete({ emailRequired: false, emailDelivered: false, discordDelivered: true }), true);

const cartItemSession = buildCartItemCheckoutSession(guestStripeSession, "order-123");
assert.equal(cartItemSession.id, "cs_test_cart:order-123");
assert.equal(cartItemSession.stripe_session_id, "cs_test_cart");
assert.equal(cartItemSession.payment_intent, "pi_test_cart");
assert.equal(checkoutCustomerEmail(cartItemSession), "buyer@example.com");
assert.equal(cartItemSession.metadata.orderId, "order-123");
assert.equal(cartItemSession.metadata.cartItem, "true");

console.log("Customer order email tests passed.");
