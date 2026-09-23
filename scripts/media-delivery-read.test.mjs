import assert from "node:assert/strict";
import { pollMediaDeliveryKey } from "../finance/media-delivery-read.mjs";

let reads = 0;
let waits = 0;
assert.equal(await pollMediaDeliveryKey(async () => (++reads === 3 ? "delivered-key" : null), {
  attempts: 3,
  wait: async () => { waits += 1; },
}), "delivered-key");
assert.equal(reads, 3);
assert.equal(waits, 2);

reads = 0;
assert.equal(await pollMediaDeliveryKey(async () => { reads += 1; return null; }, {
  attempts: 3,
  wait: async () => {},
}), null);
assert.equal(reads, 3, "a pending order is read a bounded number of times");

console.log("Media delivery read tests passed");
