import assert from "node:assert/strict";
import { isRftOnlyProduct } from "../lib/supplier-routing-policy.mjs";

const r6UnlockAll = {
  slug: "unlock-all",
  name: "Unlock All",
  supplier: "sellauth",
  supplierProductName: "Unlock All",
};
const codUnlockAll = {
  slug: "cod-bo7-unlock-all",
  name: "BO7/WZ - Unlock All + Spoofer",
  supplier: "sellauth",
};
const unrelatedProduct = {
  slug: "cod-bo7-ghost-external",
  name: "BO7 - Ghost External + Spoofer",
  supplier: "ghostware",
};

assert.equal(isRftOnlyProduct(r6UnlockAll), true);
assert.equal(isRftOnlyProduct(codUnlockAll), true);
assert.equal(isRftOnlyProduct(unrelatedProduct), false);
assert.equal(isRftOnlyProduct({ slug: "r6s-nfa-account", name: "Unlock All account" }), false);
console.log("unlock-all routing tests passed");
