import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = (await readFile(new URL("../server.js", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const quiet = { log() {}, warn() {}, error() {} };
function section(start, end) {
  const offset = source.indexOf(start);
  const finish = source.indexOf(end, offset);
  assert.ok(offset >= 0 && finish > offset);
  return source.slice(offset, finish);
}

test("balance delivery failures and empty results cannot downgrade a completed or canceled order", async () => {
  for (const status of ["fulfilled", "canceled", "pending"]) {
    for (const throws of [false, true]) {
      const row = { id: "simulated-order", status, fulfilled_at: status === "fulfilled" ? "2026-09-18T00:00:00Z" : null };
      const context = vm.createContext({
        console: quiet, setTimeout: () => 0, BALANCE_FULFILLMENT_WAIT_MS: 100,
        supabaseAdmin: {
          rpc: async () => ({ data: 500, error: null }),
          from() {
            const filters = [];
            let value;
            const q = {
              insert: () => q, select: () => q,
              single: async () => ({ data: { id: row.id }, error: null }),
              update(v) { value = v; return q; },
              eq(k, v) { filters.push((r) => r[k] === v); return q; },
              in(k, v) { filters.push((r) => v.includes(r[k])); return q; },
              is(k, v) { filters.push((r) => r[k] === v); return q; },
              then(resolve, reject) {
                if (value && filters.every((f) => f(row))) Object.assign(row, value);
                return Promise.resolve({ error: null }).then(resolve, reject);
              },
            };
            return q;
          },
        },
        syncPaidOrder: async () => { if (throws) throw new Error("Notification unavailable"); return null; },
      });
      vm.runInContext(section("async function fulfillFromBalance(", "/* Fulfill a whole cart"), context);
      await context.fulfillFromBalance({ id: "simulated-user" }, { inventorySlug: "simulated-product", product: { name: "Test" } }, 100);
      assert.equal(row.status, status === "pending" ? "paid" : status, `${status}, throws=${throws}`);
    }
  }
});

test("reseller local delivery excludes reserved stock even when a reservation races the lookup", async () => {
  for (const reservationTiming of ["existing", "race", "none"]) {
    const row = { id: "simulated-key", key_value: "simulated-license", status: "unused", reserved_order_id: reservationTiming === "existing" ? "another-order" : null };
    const context = vm.createContext({
      console: quiet, RESELLER_PRODUCT_WEEKLY_LIMITS: {}, createApiOrderNumber: () => "simulated-reseller-order",
      supabaseAdmin: { from() {
        const filters = [];
        let value;
        const q = {
          select: () => q, order: () => q, limit: () => q,
          eq(k, v) { if (k !== "product_slug") filters.push((r) => r[k] === v); return q; },
          is(k, v) { filters.push((r) => r[k] === v); return q; },
          in(k, v) { filters.push((r) => v.includes(r[k])); return q; },
          update(v) { value = v; return q; },
          then(resolve, reject) {
            const matches = filters.every((f) => f(row));
            const data = matches ? [{ ...row }] : [];
            if (value && matches) Object.assign(row, value);
            if (!value && reservationTiming === "race") row.reserved_order_id = "another-order";
            return Promise.resolve({ data, error: null }).then(resolve, reject);
          },
        };
        return q;
      } },
    });
    vm.runInContext(section("async function performResellerPurchaseUnlocked(", 'app.post("/api/reseller/buy"'), context);
    const result = await context.performResellerPurchaseUnlocked(null, { inventorySlug: "simulated-product", product: { slug: "test" }, variant: { amount: 100 } }, 1);
    assert.equal(result.success, reservationTiming === "none", reservationTiming);
    assert.equal(row.status, reservationTiming === "none" ? "assigned" : "unused", reservationTiming);
  }
});

test("reseller top-up database read failures reject so verified webhooks can retry", async () => {
  const failure = { message: "Simulated database outage" };
  const context = vm.createContext({
    console: quiet,
    supabaseAdmin: { from() {
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: null, error: failure }) };
      return q;
    } },
  });
  vm.runInContext(section("async function creditResellerTopupFromStripe(", "/* Spend balance"), context);
  await assert.rejects(context.creditResellerTopupFromStripe({ id: "simulated-session", metadata: { resellerId: "simulated-reseller", amountCents: "100" } }), (error) => error === failure);
});

test("reseller catalog availability follows its actual local or RFT delivery route", async () => {
  const fixtures = [
    { slug: "empty", local: 0, supplierReady: false },
    { slug: "supplier-only", local: 0, supplierReady: true },
    { slug: "local", local: 1, supplierReady: false },
    { slug: "rft-stale-local", local: 1, supplierReady: false, supplier: "sellauth" },
    { slug: "rft-ready", local: 0, supplierReady: true, supplier: "sellauth" },
  ];
  const context = vm.createContext({
    products: fixtures.map((f) => ({ slug: f.slug, name: f.slug, supplier: f.supplier, variants: [{ slug: "day", name: "1 Day", amount: 100, supplierDigital: true, stockLabel: "Available" }] })),
    getUnusedLicenseKeyCounts: async () => new Map(fixtures.map((f) => [`${f.slug}-day`, f.local])),
    isCatalogProductAvailable: () => true,
    getSupplierRoutes: (slug) => fixtures.find((f) => `${f.slug}-day` === slug)?.supplierReady ? ["sellauth"] : [],
    isKeyAvailable: (slug) => fixtures.find((f) => `${f.slug}-day` === slug)?.supplierReady,
    sellAuthResellerApiKey: "simulated-configured-key", getSellAuthSelection: () => ({}),
    supplierRouteCanFulfillQuantity: (slug) => fixtures.find((f) => `${f.slug}-day` === slug)?.supplierReady,
    getBestKnownWholesaleCostCents: () => null,
    resellerTierForTopup: () => ({ tier: "legacy", minTopupCents: 0 }), RESELLER_TOPUP_TIERS: [],
  });
  vm.runInContext(section("async function buildResellerCatalog(", 'app.get("/api/reseller/products"'), context);
  const catalog = await context.buildResellerCatalog(null);
  assert.deepEqual(Array.from(catalog.products, (p) => p.product_slug).sort(), ["local", "rft-ready"]);
});

test("local stock counts exclude keys reserved by a checkout", async () => {
  const rows = [{ product_slug: "simulated-product", reserved_order_id: null }, { product_slug: "simulated-product", reserved_order_id: "another-order" }];
  const context = vm.createContext({
    console: quiet, products: [{ variants: [{}] }], getVariantInventorySlug: () => "simulated-product",
    supabaseAdmin: { from() {
      const filters = [];
      const q = {
        select: () => q, in: () => q, eq: () => q,
        is(k, v) { filters.push((r) => r[k] === v); return q; },
        then(resolve, reject) { return Promise.resolve({ data: rows.filter((r) => filters.every((f) => f(r))), error: null }).then(resolve, reject); },
      };
      return q;
    } },
  });
  vm.runInContext(section("async function getUnusedLicenseKeyCounts(", "function getAuthToken("), context);
  assert.equal((await context.getUnusedLicenseKeyCounts()).get("simulated-product"), 1);
});
