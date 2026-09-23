import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { guestTokenMatchesOrder, hashGuestCheckoutToken } from "../lib/guest-checkout.js";
import { evaluateMediaPanelClaim, getMediaWeekStartIso } from "./media-access-policy.mjs";

const source = (await readFile(new URL("../server.js", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const quiet = { log() {}, warn() {}, error() {} };
function section(start, end) {
  const offset = source.indexOf(start);
  const finish = source.indexOf(end, offset);
  assert.ok(offset >= 0 && finish > offset);
  return source.slice(offset, finish);
}
function response() {
  const headers = new Map();
  return {
    code: 200, status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    set(name, value) { headers.set(name, value); return this; },
    setHeader(name, value) { headers.set(name, value); },
    getHeader(name) { return headers.get(name); },
  };
}
function query(result, writes = [], table = "") {
  const q = {};
  for (const method of ["select", "eq", "in", "is", "limit", "gte", "not"]) q[method] = () => q;
  q.update = (value) => { writes.push({ table, value }); return q; };
  q.insert = () => q;
  q.delete = () => { writes.push({ table, deleted: true }); return q; };
  q.maybeSingle = q.single = async () => result;
  q.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return q;
}

test("fulfilled guest deliveries remain readable on refresh with the same private cookie", async () => {
  for (const cart of [false, true]) {
    let handler;
    const sessionId = "cs_test_simulated_session";
    const token = "a".repeat(64);
    const order = {
      id: "simulated-order", user_id: null, product_slug: "simulated-product-day",
      status: "fulfilled", delivered_key_value: "simulated-license",
      stripe_session_id: sessionId,
      guest_access_token_hash: hashGuestCheckoutToken(token),
      guest_access_token_expires_at: new Date(Date.now() + 60_000).toISOString(),
    };
    const context = vm.createContext({
      app: { get(_path, _limiter, fn) { handler = fn; } }, authLimiter: {}, console: quiet,
      getOptionalAuthenticatedUser: async () => null,
      hashToken: hashGuestCheckoutToken, guestCheckoutTokenTtlMs: 7 * 86400000, baseUrl: "https://example.test",
      guestTokenMatchesOrder,
      stripe: { checkout: { sessions: { retrieve: async () => ({
        id: sessionId, payment_status: "paid", metadata: cart ? { type: "cart" } : { orderId: order.id },
      }) } } },
      supabaseAdmin: { from: () => query({ data: cart ? [order] : order, error: null }) },
      getCartOrderIds: () => [order.id],
      getCatalogItemByInventorySlug: () => ({ product: { slug: "simulated-product" } }),
      getCustomerProductName: () => "Simulated product",
      isManualDeliverySelection: () => false, isDiscordDeliveryProduct: () => false,
      buildCheckoutDeliveryItem: () => ({}),
      AUTOMATIC_KEY_RETRY_ENABLED: false,
      syncPaidOrder: async () => { assert.fail("Already fulfilled orders must not allocate again"); },
      fulfillCartStripe: async () => { assert.fail("Already fulfilled carts must not allocate again"); },
    });
    vm.runInContext(section("function guestCheckoutCookieName(", "/* This value only associates"), context);
    vm.runInContext(section('app.get("/api/checkout/complete",', "/**\n * Check if a key is available"), context);
    const cookies = new Map();
    function applyCookies(res) {
      for (const cookie of res.getHeader("Set-Cookie") || []) {
        const pair = cookie.split(";")[0];
        const separator = pair.indexOf("=");
        const name = pair.slice(0, separator);
        if (/Max-Age=0(?:;|$)/.test(cookie)) cookies.delete(name);
        else cookies.set(name, pair.slice(separator + 1));
      }
    }
    const initial = response();
    context.setGuestCheckoutCookie(initial, { secure: true }, sessionId, token);
    assert.match(initial.getHeader("Set-Cookie")[0], /HttpOnly; SameSite=Lax; Secure/);
    applyCookies(initial);
    const req = () => ({ secure: true, query: { session_id: sessionId }, get(name) {
      return name === "cookie" ? [...cookies].map(([key, value]) => `${key}=${value}`).join("; ") : "";
    } });
    for (let visit = 0; visit < 2; visit++) {
      const res = response();
      await handler(req(), res);
      assert.equal(res.code, 200, `Guest visit ${visit + 1} (${cart ? "cart" : "single"})`);
      assert.equal(res.body.keys[0], "simulated-license");
      assert.equal(res.getHeader("Cache-Control"), "no-store");
      applyCookies(res);
    }
    order.guest_access_token_expires_at = new Date(Date.now() - 1).toISOString();
    const expired = response();
    await handler(req(), expired);
    assert.equal(expired.code, 403, "Expired cookies must not authorize delivery");
    order.guest_access_token_expires_at = new Date(Date.now() + 60_000).toISOString();
    cookies.set(context.guestCheckoutCookieName(sessionId), "b".repeat(64));
    const wrong = response();
    await handler(req(), wrong);
    assert.equal(wrong.code, 403, "Wrong bearer tokens remain rejected");
    cookies.clear();
    cookies.set(context.guestCheckoutCookieName("another-session"), token);
    const otherSession = response();
    await handler(req(), otherSession);
    assert.equal(otherSession.code, 403, "Another session's cookie cannot authorize delivery");
  }
});

test("website media fulfillment write failures retain assigned keys and their order or credit", async () => {
  for (const creditClaim of [false, true]) {
    const route = creditClaim
      ? section('app.post("/api/media/credits/:id/claim"', "const pageRoutes = new Map(")
      : section('app.post("/api/media/campaigns"', 'app.get("/api/admin/media/campaigns"');
    const body = route.slice(route.indexOf('if (delivery.status === "fulfilled")'), route.lastIndexOf("});"));
    const writes = [];
    const context = vm.createContext({
      delivery: { status: "fulfilled", supplier: "local inventory", keyValue: "simulated-license" },
      order: { id: "simulated-order" }, campaign: { id: "simulated-campaign" },
      credit: { id: "simulated-credit", campaign_id: "simulated-campaign" },
      user: { id: "simulated-user" }, member: { discord_id: "simulated-discord" },
      releaseMediaClaimBudgetReservation() {},
      mediaBudgetReservationId: null,
      selection: { product: { name: "Simulated product" }, variant: { name: "1 Day" } },
      deliveryAssigned: false, deliveryConfirmed: false, creditClaimed: true, supplierOrderAccepted: false,
      orderId: "simulated-order", campaignId: "simulated-campaign", console: quiet, res: response(),
      markOrderFulfilled: async () => { throw new Error("Order write unavailable"); },
      supabaseAdmin: { from: (table) => query({ error: null }, writes, table) },
    });
    vm.runInContext(section("function mediaApiError(", "async function getMediaMemberForUser("), context);
    vm.runInContext(section("async function ignoreMediaCleanupQuery(", 'app.get("/api/media/me"'), context);
    await vm.runInContext(`(async () => { try { ${body} })()`, context);
    assert.equal(writes.some((w) => w.deleted || ["canceled", "cancelled", "available"].includes(w.value?.status)), false,
      "An assigned key must never lose its durable order or reopen its credit");
    assert.equal(context.res.code, 500);
    assert.match(context.res.body.error, /assigned/i);
  }
});

test("website media key insert failures preserve accepted supplier order references", async () => {
  for (const creditClaim of [false, true]) {
    const route = creditClaim
      ? section('app.post("/api/media/credits/:id/claim"', "const pageRoutes = new Map(")
      : section('app.post("/api/media/campaigns"', 'app.get("/api/admin/media/campaigns"');
    const receivedStart = route.indexOf("supplierOrderAccepted = Boolean(delivery?.supplierOrderId);");
    const body = route.slice(receivedStart >= 0 ? receivedStart : route.indexOf('if (delivery.status === "fulfilled")'), route.lastIndexOf("});"));
    const writes = [];
    const context = vm.createContext({
      delivery: { status: "fulfilled", supplier: "Simulated supplier", supplierOrderId: "simulated-invoice", keyValue: "simulated-license" },
      order: { id: "simulated-order" }, campaign: { id: "simulated-campaign" },
      credit: { id: "simulated-credit", campaign_id: "simulated-campaign" }, user: { id: "simulated-user" },
      releaseMediaClaimBudgetReservation() {},
      mediaBudgetReservationId: null,
      selection: { inventorySlug: "simulated-product-day" },
      deliveryAssigned: false, deliveryConfirmed: false, creditClaimed: true, supplierOrderAccepted: false,
      orderId: "simulated-order", campaignId: "simulated-campaign", console: quiet, res: response(),
      MEDIA_DELIVERY_UNAVAILABLE_MESSAGE: "Delivery unavailable.",
      supabaseAdmin: { from: (table) => query({ error: table === "license_keys" ? { message: "Insert unavailable" } : null }, writes, table) },
    });
    vm.runInContext(section("function mediaApiError(", "async function getMediaMemberForUser("), context);
    vm.runInContext(section("async function ignoreMediaCleanupQuery(", 'app.get("/api/media/me"'), context);
    await vm.runInContext(`(async () => { try { ${body} })()`, context);
    assert.equal(context.supplierOrderAccepted, true);
    assert.equal(writes.some((w) => w.table === "orders" && w.deleted), false,
      "Deleting the order would cascade away the accepted supplier link");
    assert.ok(context.res.code >= 500);
  }
});

test("Discord media record failures retain local and supplier key assignments", async () => {
  for (const local of [false, true]) {
    for (const failure of ["order-write", "campaign-write", "campaign-returned-error"]) {
      const writes = [];
      const context = vm.createContext({
        campaignId: "simulated-campaign", orderId: "simulated-order", stage: "", supplierOrderAccepted: false,
        deliveryAssigned: false, deliveryConfirmed: false,
        discordUserId: "simulated-discord", existingMember: { user_id: "simulated-user" },
        order: { id: "simulated-order" }, campaign: { id: "simulated-campaign" },
        selection: { inventorySlug: "simulated-product-day", product: { name: "Simulated product" }, variant: { name: "1 Day" } },
        interaction: { user: { id: "simulated-discord" } }, console: quiet,
        claimDiscordMediaLocalKey: async () => local ? "simulated-license" : null,
        deliverAutomaticMediaKey: async () => ({ status: "fulfilled", keyValue: "simulated-license", supplier: "simulated-supplier", supplierOrderId: "simulated-invoice" }),
        markOrderFulfilled: async () => { if (failure === "order-write") throw new Error("Order write unavailable"); },
        sendDiscordDM: async () => {}, notifyOwnerOfMediaKeyClaim: async () => {},
        mediaPanelClaimInFlight: new Set(["simulated-discord"]),
        releaseMediaClaimBudgetReservation() {},
        mediaBudgetReservationId: null,
        supabaseAdmin: { from(table) {
          const result = { error: (failure === "order-write" && table === "orders") || (failure === "campaign-returned-error" && table === "media_campaigns")
            ? { message: "Delivery record write unavailable" } : null };
          const q = query(result, writes, table);
          if (failure === "campaign-write" && table === "media_campaigns") {
            q.then = (resolve, reject) => Promise.reject(new Error("Campaign connection unavailable")).then(resolve, reject);
          }
          return q;
        } },
      });
      vm.runInContext(section("async function updateMediaClaimRecord(", "/* Discord-only media members"), context);
      const route = section("async function claimDiscordMediaPanelKey(", "function mediaRankForXp(");
      const body = route.slice(route.indexOf('stage = "claiming local key";'), route.lastIndexOf("}"));
      const result = await vm.runInContext(`(async () => { try { ${body} })()`, context);
      assert.equal(result.ok, false, "Failed required delivery writes must not report fulfillment");
      assert.equal(writes.some((w) => w.deleted || ["canceled", "cancelled"].includes(w.value?.status)), false,
        "An assigned key must never be canceled or orphaned by a later write failure");
      assert.match(result.message, /assigned/i);
      assert.equal(context.mediaPanelClaimInFlight.size, 0);
    }
  }
});

test("media API errors do not disclose internal supplier errors", () => {
  const context = vm.createContext({});
  vm.runInContext(section("function mediaApiError(", "async function getMediaMemberForUser("), context);
  const res = response();
  context.mediaApiError(res, { status: 503, message: "Simulated supplier rejected private credential" }, "Unable to deliver this key.");
  assert.equal(res.code, 503);
  assert.equal(res.body.error, "Unable to deliver this key.");
});

test("Discord media allowance includes successful website claims", async () => {
  const claim = {
    id: "simulated-campaign", discord_id: "simulated-discord", product_slug: "simulated-product-day",
    proof_platform: "role allowance", counts_toward_allowance: true, status: "claimed",
    claimed_at: new Date(Date.now() - 3600000).toISOString(), note: "Media key delivered instantly from the website panel",
  };
  const writes = [];
  const context = vm.createContext({
    mediaPanelClaimInFlight: new Set(), console: quiet,
    releaseMediaClaimBudgetReservation() {},
    MEDIA_CLAIMS_ENABLED: true,
    isMediaMember: () => true, isDiscordStaff: () => false,
    mediaPanelDaySelection: () => ({ inventorySlug: claim.product_slug }),
    getMediaWeekStartIso, evaluateMediaPanelClaim, REPORT_TIME_ZONE: "America/Chicago", mediaCreditWeeklyLimit: 4,
    supabaseAdmin: { from(table) {
      const q = query({ data: [], error: null }, writes, table);
      let platform;
      q.eq = (column, value) => { if (column === "proof_platform") platform = value; return q; };
      q.then = (resolve, reject) => Promise.resolve({
        data: table === "media_campaigns" && (!platform || platform === claim.proof_platform) ? [claim] : [], error: null,
      }).then(resolve, reject);
      q.maybeSingle = async () => { assert.fail("Cooldown must reject before member writes or delivery"); };
      return q;
    } },
  });
  vm.runInContext(section("async function claimDiscordMediaPanelKey(", "function mediaRankForXp("), context);
  const result = await context.claimDiscordMediaPanelKey({
    interaction: { guild: {}, channelId: "simulated-panel", user: { id: claim.discord_id }, member: { roles: { cache: {} } } },
    productSlug: "simulated-product", panelChannelId: "simulated-panel",
  });
  assert.equal(result.reason, "daily_cooldown");
  assert.equal(writes.length, 0);
  assert.equal(context.mediaPanelClaimInFlight.size, 0);
});

test("media key delivery routes do not impose a rolling spend budget", () => {
  const routes = [
    section("async function claimDiscordMediaPanelKey(", "function mediaRankForXp("),
    section('app.post("/api/media/campaigns"', 'app.get("/api/admin/media/campaigns"'),
    section('app.post("/api/media/credits/:id/claim"', "const pageRoutes = new Map("),
  ];
  for (const route of routes) {
    const supplier = route.indexOf("deliverAutomaticMediaKey(");
    assert.ok(supplier >= 0, "Every claim route must attempt key delivery");
    assert.equal(route.includes("reserveMediaClaimBudget("), false, "No claim route may gate delivery on spending");
  }
});
