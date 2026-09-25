import assert from "node:assert/strict";
import {
  buyNfaBalanceCents,
  buyNfaCanPurchase,
  buyNfaDeliveryText,
  buyNfaOrderId,
  buyNfaSellableCount,
  buyNfaStorefrontPriceCents,
  normalizeBuyNfaCatalog,
} from "../lib/buynfa-reseller.mjs";

assert.equal(buyNfaBalanceCents({ balance: "$0.00" }), 0);
assert.equal(buyNfaBalanceCents({ data: { balance: "12.34" } }), 1234);
assert.equal(buyNfaBalanceCents({ balance: -1 }), null);
assert.equal(buyNfaBalanceCents({}), null);
assert.equal(buyNfaSellableCount(481, 0, 24), 0);
assert.equal(buyNfaSellableCount(481, 24, 24), 1);
assert.equal(buyNfaSellableCount(481, 100, 24), 4);
assert.equal(buyNfaSellableCount(3, 100, 0), 3);
assert.equal(buyNfaCanPurchase({ stockCount: 481, balanceCents: 23, resellerPriceCents: 24, configured: true, snapshotFresh: true }), false);
assert.equal(buyNfaCanPurchase({ stockCount: 481, balanceCents: 48, resellerPriceCents: 24, quantity: 2, configured: true, snapshotFresh: true }), true);
assert.equal(buyNfaCanPurchase({ stockCount: 481, balanceCents: 48, resellerPriceCents: 24, quantity: 3, configured: true, snapshotFresh: true }), false);
assert.equal(buyNfaCanPurchase({ stockCount: 481, balanceCents: 4800, resellerPriceCents: 24, configured: true, snapshotFresh: false }), false);
assert.equal(buyNfaStorefrontPriceCents(25, 24, 0), 25);
assert.equal(buyNfaStorefrontPriceCents(25, 24, 25), 49);
assert.equal(buyNfaStorefrontPriceCents(25, 24, -1), null);

const catalog = normalizeBuyNfaCatalog({
  data: {
    categories: [{
      slug: "cs2",
      name: "CS2",
      products: [{
        slug: "cs2-account",
        name: "CS2 NFA Account",
        variants: [
          { variantId: "prime-account", name: "Prime Account", inStock: 328, resellerPrice: "0.24", retailPrice: "0.25" },
          { variantId: "empty-account", name: "Empty Account", stock: 0, reseller_price: 0.1, retail_price: 0.12 },
        ],
      }],
    }],
  },
});
assert.equal(catalog.length, 2);
assert.equal(catalog[0].categorySlug, "cs2");
assert.equal(catalog[0].productSlug, "cs2-account");
assert.equal(catalog[0].variantId, "prime-account");
assert.equal(catalog[0].stockCount, 328);
assert.equal(catalog[0].resellerPriceCents, 24);
assert.equal(catalog[0].retailPriceCents, 25);
assert.equal(catalog[0].productKey.startsWith("account-"), true);
assert.equal(catalog[0].productKey.includes("buynfa"), false);
assert.equal(catalog[1].stockCount, 0);

assert.throws(() => normalizeBuyNfaCatalog({ data: { products: [{ slug: "incomplete" }] } }));
assert.equal(buyNfaOrderId({ data: { order: { id: "order-123" } } }), "order-123");
assert.equal(
  buyNfaDeliveryText({ data: { order: { credentials: { email: "buyer@example.test", password: "private-value" } } } }),
  "email: buyer@example.test\npassword: private-value",
);
assert.equal(buyNfaDeliveryText({ data: "email: buyer@example.test | password: private-value" }), "email: buyer@example.test | password: private-value");
assert.equal(buyNfaDeliveryText({ order: { status: "delivered", customerEmail: "not-a-credential@example.test" } }), null);

console.log("BuyNfa reseller parser checks passed.");
