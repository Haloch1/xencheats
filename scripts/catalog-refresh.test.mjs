import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("./products-page.js", import.meta.url), "utf8");
const sweep = source.slice(source.indexOf("async function sweepVisibleCatalogStock()"), source.indexOf("function slugify("));
const refresh = source.slice(source.indexOf("async function refreshCatalogAvailability("), source.indexOf("/* RFT exposes exact quantity"));
const product = (slug, available) => ({ slug, available, category: "Test", variants: [{ stockLabel: "Unavailable" }] });

async function runSweep(products, { hidden = false, hideAfterRequest = false } = {}) {
  const calls = [];
  const document = { hidden };
  const context = vm.createContext({
    document, catalogStockSweepRunning: false, dedicatedProductSlug: "", activeCategory: "Test",
    catalogStockSweepGeneration: 0, catalogProducts: products, catalogStockSweepLimit: 12,
    catalogStockSweepDelayMs: 0, window: { setTimeout: (fn) => fn() },
    refreshCatalogAvailability: async ({ productSlug }) => {
      calls.push(productSlug);
      if (hideAfterRequest) document.hidden = true;
    },
  });
  await vm.runInContext(`${sweep}; sweepVisibleCatalogStock()`, context);
  assert.equal(context.catalogStockSweepRunning, false);
  return calls;
}

assert.deepEqual(await runSweep([product("disabled", false), product("enabled", true), product("legacy", undefined)]), ["enabled", "legacy"]);
assert.deepEqual(await runSweep([product("enabled", true)], { hidden: true }), []);
assert.deepEqual(await runSweep([product("one", true), product("two", true)], { hideAfterRequest: true }), ["one"]);
assert.equal((await runSweep(Array.from({ length: 20 }, (_, i) => product(`p${i}`, true)))).length, 12);

let requests = 0;
const context = vm.createContext({
  document: { hidden: true }, catalogRefreshRunning: false, dedicatedProductSlug: "", catalogProducts: [],
  window: { location: { search: "" } }, URLSearchParams,
  loadProducts: async () => { requests++; return []; }, isAllowedProduct: () => true,
  updateStats() {}, renderCatalogView() {}, refreshOpenProductAvailability() {}, console,
});
vm.runInContext(refresh, context);
await vm.runInContext("refreshCatalogAvailability()", context);
assert.equal(requests, 0, "Hidden tabs must not poll");
context.document.hidden = false;
await vm.runInContext("refreshCatalogAvailability()", context);
assert.equal(requests, 1, "Visible tabs must still refresh");
assert.equal(context.catalogRefreshRunning, false);
console.log("Catalog refresh: 6 behavior checks passed.");
