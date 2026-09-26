import assert from "node:assert/strict";
import test from "node:test";
import {
  ownerAvailabilityRouting,
  OWNER_UNAVAILABLE_TICKET_COPY,
  parseOwnerAvailabilityCommand,
} from "../lib/owner-availability.mjs";

test("available owner receives only explicitly requested escalation mentions", () => {
  assert.deepEqual(ownerAvailabilityRouting(true), {
    includeOwnerMention: false,
    notifyOwner: false,
    unavailableCopy: null,
  });
  assert.deepEqual(ownerAvailabilityRouting(true, true), {
    includeOwnerMention: true,
    notifyOwner: true,
    unavailableCopy: null,
  });
});

test("unavailable owner is mentioned without notification on ticket escalation", () => {
  assert.deepEqual(ownerAvailabilityRouting(false), {
    includeOwnerMention: true,
    notifyOwner: false,
    unavailableCopy: OWNER_UNAVAILABLE_TICKET_COPY,
  });
  assert.equal(ownerAvailabilityRouting(false, true).notifyOwner, false);
});

test("owner DM command checks and updates availability without accepting malformed values", () => {
  assert.deepEqual(parseOwnerAvailabilityCommand("!available"), { action: "get" });
  assert.deepEqual(parseOwnerAvailabilityCommand("!available true"), { action: "set", available: true });
  assert.deepEqual(parseOwnerAvailabilityCommand("!AVAILABLE FALSE"), { action: "set", available: false });
  assert.equal(parseOwnerAvailabilityCommand("!available maybe"), null);
  assert.equal(parseOwnerAvailabilityCommand("!available true extra"), null);
});
