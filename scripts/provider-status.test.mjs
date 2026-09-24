import assert from "node:assert/strict";
import test from "node:test";
import {
  matchProviderStatuses,
  normalizeStatusLabel,
  parseProviderStatusHtml,
} from "../lib/provider-status.js";

test("normalizes the statuses shown by reseller panels", () => {
  assert.equal(normalizeStatusLabel("Online"), "Undetected");
  assert.equal(normalizeStatusLabel("Testing"), "Testing");
  assert.equal(normalizeStatusLabel("Use at own risk"), "Use at own risk!");
  assert.equal(normalizeStatusLabel("Updating"), "Updating");
});

test("parses product status rows without treating a whole product line as a status", () => {
  const entries = parseProviderStatusHtml(`
    <article><h3>Arcane</h3><p>Status: Online</p></article>
    <div>Ancient - Testing</div>
    <div>Ghost</div><div>Use at own risk!</div>
  `);
  assert.deepEqual(entries, [
    { name: "Arcane", badge: "Undetected" },
    { name: "Ancient", badge: "Testing" },
    { name: "Ghost", badge: "Use at own risk!" },
  ]);
});

test("matches only one unambiguous supplier product", () => {
  const rows = matchProviderStatuses(
    [{ name: "Arcane", badge: "Undetected" }, { name: "Unknown", badge: "Updating" }],
    [
      { slug: "rft-arcane", name: "Arcane", supplier: "sellauth" },
      { slug: "cheatslove-arcane", name: "Arcane", supplier: "cheatslove" },
      { slug: "rft-unique", name: "Unique", supplier: "sellauth" },
    ],
    { supplier: "sellauth" },
  );
  assert.deepEqual(rows, [{ slug: "rft-arcane", productName: "Arcane", badge: "Undetected", sourceName: "Arcane" }]);
});
