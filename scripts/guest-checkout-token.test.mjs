import assert from "node:assert/strict";
import {
  createGuestCheckoutToken,
  guestTokenMatchesOrder,
  hashGuestCheckoutToken,
} from "../lib/guest-checkout.js";

const now = Date.parse("2026-09-15T12:00:00.000Z");
const token = "a".repeat(64);
const validOrder = {
  guest_access_token_hash: hashGuestCheckoutToken(token),
  guest_access_token_expires_at: new Date(now + 60_000).toISOString(),
};

assert.equal(guestTokenMatchesOrder(token, validOrder, now), true);
assert.equal(guestTokenMatchesOrder("b".repeat(64), validOrder, now), false);
assert.equal(guestTokenMatchesOrder(token, {
  ...validOrder,
  guest_access_token_expires_at: new Date(now - 1).toISOString(),
}, now), false);
assert.equal(guestTokenMatchesOrder(token, {}, now), false);

const created = createGuestCheckoutToken(60_000, now);
assert.equal(created.token.length, 64);
assert.equal(created.hash, hashGuestCheckoutToken(created.token));
assert.equal(created.expiresAt, new Date(now + 60_000).toISOString());

console.log("Guest checkout token tests passed.");
