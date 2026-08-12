import assert from "node:assert/strict";
import { products } from "../data/products.js";
import {
  buildSupportQuery,
  classifyTranscriptEvidence,
  getCommonSupportReply,
  isDuplicateSupportReply,
  resolveSupportProducts,
} from "../lib/support-core.js";

for (const product of products) {
  const exact = resolveSupportProducts(products, `${product.game || product.category || ""} ${product.name}`, { limit: 6 });
  assert.equal(exact.ambiguous, false, `Exact product should not be ambiguous: ${product.slug}`);
  assert.equal(exact.products[0]?.slug, product.slug, `Exact product mismatch: ${product.slug}`);
}

const r6Ancient = resolveSupportProducts(products, "r6 ancient loader does not open");
assert.equal(r6Ancient.ambiguous, false);
assert.equal(r6Ancient.products[0]?.slug, "r6s-ancient");

const fortniteAncient = resolveSupportProducts(products, "fortnite ancient device error");
assert.equal(fortniteAncient.products[0]?.slug, "fortnite-ancient");

const ambiguousAncient = resolveSupportProducts(products, "ancient loader error", { limit: 10 });
assert.equal(ambiguousAncient.ambiguous, true);
assert.match(ambiguousAncient.clarification, /which game/i);

const remembered = buildSupportQuery("how do i turn off hyper v", [
  { role: "user", content: "I use R6S Ancient on Windows 11" },
]);
assert.match(remembered, /R6S Ancient/);
const retainedDetails = buildSupportQuery("I don't have a screenshot", [
  { role: "user", content: "The loader closes when I open it" },
  { role: "assistant", content: "Which product and Windows version?" },
  { role: "user", content: "Ancient R6 on Windows 11" },
]);
assert.match(retainedDetails, /loader closes/i);
assert.match(retainedDetails, /Ancient R6 on Windows 11/i);
assert.match(retainedDetails, /don't have a screenshot/i);
assert.match(getCommonSupportReply("how do i turn off hyper v"), /bcdedit \/set hypervisorlaunchtype off/);
assert.equal(getCommonSupportReply("the loader still closes", [
  { role: "user", content: "how do i turn off hyper v" },
  { role: "assistant", content: "Disable Hyper-V and restart." },
]), "");
assert.equal(getCommonSupportReply("bye"), "Bye! Come back anytime if you need a hand.");
const missingKeyHelp = getCommonSupportReply("I paid but my key is missing");
assert.match(missingKeyHelp, /Your Keys and Order History/i);
assert.match(missingKeyHelp, /optionally paste the Order ID/i);
assert.doesNotMatch(missingKeyHelp, /^Send (your|the) Order ID/i);
assert.equal(isDuplicateSupportReply("Try restarting Windows and run it again.", [
  { role: "assistant", content: "Try restarting Windows and run it again." },
]), true);

assert.equal(classifyTranscriptEvidence([
  { role: "user", content: "The loader closes with device error." },
  { role: "staff", content: "Turn off memory integrity, restart, and run the loader as administrator." },
  { role: "user", content: "That worked, it is fixed now." },
]).level, "verified");

assert.equal(classifyTranscriptEvidence([
  { role: "user", content: "We fixed it in VC." },
  { role: "user", content: "Thanks" },
]).level, "tone_only");

console.log("Support evals passed.");
