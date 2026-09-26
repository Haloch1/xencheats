import assert from "node:assert/strict";
import { canExposeOrderLookupKey, escapeExactLikePattern } from "../lib/order-lookup-access.mjs";

assert.equal(canExposeOrderLookupKey({ appRole: "owner" }), true);
assert.equal(canExposeOrderLookupKey({ appRole: "ADMIN" }), true);
assert.equal(canExposeOrderLookupKey({ appRole: "staff" }), false);
assert.equal(canExposeOrderLookupKey({ appRole: "employee" }), false);
assert.equal(canExposeOrderLookupKey({ discordAdmin: true }), true);
assert.equal(canExposeOrderLookupKey({ discordAdmin: false, appRole: "" }), false);

assert.equal(
  escapeExactLikePattern("member_name%\\@example.com"),
  "member\\_name\\%\\\\@example.com",
);

console.log("Order lookup key-access and exact-email-pattern tests passed.");
