import assert from "node:assert/strict";
import test from "node:test";
import {
  matchCheatsLoveProductStatuses,
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

test("maps Cheats.Love status feed by exact game and name, not feed IDs", () => {
  const rows = matchCheatsLoveProductStatuses([
    { id: 17, category: "Apex", name: "Ancient", status: "undetected" },
    { id: 812, category: "Counter-Strike", name: "Predator Systems", status: "risky" },
    { id: 22, category: "Rainbow Six Siege", name: "Chams", status: "testing" },
    { id: 99, category: "Escape from Tarkov", name: "Sugar", status: "discontinued" },
    { id: 101, category: "Delta Force", name: "Luna-Chams", status: "unknown" },
    { id: 102, category: "Apex", name: "Not In Catalog", status: "updating" },
  ], [
    { slug: "apex-ancient", name: "Ancient", category: "Apex Legends", cheatsLoveProductId: 189 },
    { slug: "rft-ancient", name: "Ancient", category: "Apex Legends", supplier: "sellauth" },
    { slug: "cs2-predator", name: "Predator", category: "Counter-Strike 2", cheatsLoveProductId: 1756 },
    { slug: "r6s-chams", name: "Chams Wallhack", category: "Rainbow Six Siege", cheatsLoveProductId: 1621 },
    { slug: "eft-sugar", name: "Sugar", category: "Escape from Tarkov", cheatsLoveProductId: 256 },
    { slug: "delta-force-luna-chams", name: "Luna Chams", category: "Delta Force", cheatsLoveProductId: 185 },
  ]);

  assert.deepEqual(rows.map(({ slug, badge }) => [slug, badge]), [
    ["apex-ancient", "Undetected"],
    ["cs2-predator", "Use at own risk!"],
    ["r6s-chams", "Testing"],
    ["eft-sugar", "Discontinued"],
    ["delta-force-luna-chams", "Unknown"],
  ]);
});

test("ignores ambiguous and malformed Cheats.Love status feeds", () => {
  const products = [
    { slug: "apex-a", name: "Ancient", category: "Apex Legends", cheatsLoveProductId: 189 },
    { slug: "apex-b", name: "Ancient", category: "Apex Legends", cheatsLoveProductId: 190 },
  ];
  assert.deepEqual(matchCheatsLoveProductStatuses({ products: [] }, products), []);
  assert.deepEqual(matchCheatsLoveProductStatuses([
    { category: "Apex", name: "Ancient", status: "unknown-new-status" },
    { category: "Apex", name: "Ancient", status: "undetected" },
  ], products), []);
});
