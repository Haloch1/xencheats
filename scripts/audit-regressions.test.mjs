import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { EventEmitter } from "node:events";
import crypto from "node:crypto";
import test from "node:test";

const source = await readFile(new URL("../server.js", import.meta.url), "utf8");
const quiet = { log() {}, warn() {}, error() {} };
function section(start, end) {
  const offset = source.indexOf(start);
  assert.ok(offset >= 0, `Missing source section: ${start}`);
  const finish = source.indexOf(end, offset);
  assert.ok(finish > offset, `Missing section end: ${end}`);
  return source.slice(offset, finish);
}
function response() {
  return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; } };
}
function query(result, onWrite = () => {}) {
  const q = { update(value) { onWrite(value); return q; }, then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); } };
  for (const method of ["select", "eq", "is", "in", "neq", "limit", "order", "or"]) q[method] = () => q;
  q.maybeSingle = async () => result;
  return q;
}

test("crypto webhook fails closed on returned database errors and invalid stored amounts", async () => {
  let handler;
  let deliveries = 0;
  let result;
  const context = vm.createContext({
    app: { post(_path, _parser, fn) { handler = fn; } }, express: { json() {} },
    nowpaymentsIpnKey: "test-only-ipn-secret", crypto, isConfiguredValue: Boolean,
    timingSafeCompare: (left, right) => left === right,
    supabaseAdmin: { from: () => query(result) }, console: quiet,
    syncPaidOrder: async () => { deliveries++; }, sendSecurityDiscordAlert: async () => {},
  });
  vm.runInContext(section('app.post("/api/nowpayments-ipn"', "app.use(express.json());"), context);
  const body = { payment_status: "finished", order_id: "test-order", payment_id: 1, price_amount: 1, price_currency: "usd" };
  context.body = body;
  const signature = crypto.createHmac("sha512", "test-only-ipn-secret").update(vm.runInContext("JSON.stringify(sortObjectKeys(body))", context)).digest("hex");
  for (const invalid of [
    { data: null, error: { message: "database unavailable" } },
    { data: null, error: null },
    { data: { amount_cents: null }, error: null },
    { data: { amount_cents: 0 }, error: null },
  ]) {
    result = invalid;
    const res = response();
    await handler({ headers: { "x-nowpayments-sig": signature }, body }, res);
    assert.equal(deliveries, 0, "No key allocation after failed amount verification");
    assert.equal(res.code, 500, "Provider should retry verification later");
  }
  result = { data: { amount_cents: 500 }, error: null };
  const underpaid = response();
  await handler({ headers: { "x-nowpayments-sig": signature }, body }, underpaid);
  assert.equal(deliveries, 0);
  assert.equal(underpaid.body.held, true);
  result = { data: { amount_cents: 100 }, error: null };
  await handler({ headers: { "x-nowpayments-sig": signature }, body }, response());
  assert.equal(deliveries, 1, "Valid verified payments retain fulfillment");
  await handler({ headers: { "x-nowpayments-sig": "invalid" }, body }, response());
  assert.equal(deliveries, 1, "Invalid signature never reaches fulfillment");
});

test("local assignment cannot take a key reserved between lookup and update", async () => {
  for (const owner of [null, "test-order", "another-order"]) {
    const key = { id: "test-key", key_value: "test-only-key", reserved_order_id: null };
    let deliveries = 0;
    let reads = 0;
    const supabaseAdmin = { from() {
      let write = false;
      let reservationGuard = false;
      const q = query({});
      q.update = () => { write = true; return q; };
      q.or = (filter) => { reservationGuard = filter === "reserved_order_id.is.null,reserved_order_id.eq.test-order"; return q; };
      q.then = (resolve, reject) => Promise.resolve({ data: ++reads === 1 ? [] : [{ id: key.id, cost_cents: null }], error: null }).then(resolve, reject);
      q.maybeSingle = async () => {
        assert.equal(write, true);
        key.reserved_order_id = owner; // A competing checkout wins after the SELECT.
        const allowed = !reservationGuard || owner === null || owner === "test-order";
        return { data: allowed ? key : null, error: null };
      };
      return q;
    } };
    const context = vm.createContext({ supabaseAdmin, releaseExpiredLocalStockReservations: async () => {}, markOrderFulfilled: async () => { deliveries++; }, postFulfillment: async () => ({ delivered: true }), recordOrderFulfillmentCost: async () => {}, isLocalAccountProduct: () => false, getCatalogItemByInventorySlug: () => ({}) });
    vm.runInContext(section("async function tryFulfillFromLocalStock(", "/* Create one durable retry job"), context);
    await context.tryFulfillFromLocalStock({ id: "test-order", product_slug: "test-product", user_id: "test-user" }, {}, {});
    assert.equal(deliveries, owner === "another-order" ? 0 : 1);
  }
});

test("stale fulfillment fallback cannot downgrade fulfilled or canceled orders", async () => {
  const core = section("async function syncPaidOrderCore(", "async function syncPaidOrder(session)");
  for (const manual of [false, true]) {
    const start = manual ? core.indexOf('const { data: transitioned, error: transitionError }') : core.lastIndexOf('const { data: transitioned, error }');
    const end = core.indexOf('.select("id");', start) + '.select("id");'.length;
    assert.ok(start >= 0 && end > start);
    for (const liveStatus of ["pending", "paid", "fulfilled", "canceled"]) {
      const row = { status: liveStatus };
      const predicates = [];
      let payload;
      const q = query({});
      q.update = (value) => { payload = value; return q; };
      q.eq = (column, value) => { if (column === "status") predicates.push(() => row.status === value); return q; };
      q.neq = (_column, value) => { predicates.push(() => row.status !== value); return q; };
      q.in = (_column, values) => { predicates.push(() => values.includes(row.status)); return q; };
      q.then = (resolve, reject) => {
        if (predicates.every((fn) => fn())) Object.assign(row, payload);
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      };
      const context = vm.createContext({ supabaseAdmin: { from: () => q }, order: { id: "test-order", status: "pending" }, session: {}, stripeSessionReference: () => null });
      await vm.runInContext(`(async () => { ${core.slice(start, end)} })()`, context);
      assert.equal(row.status, liveStatus === "pending" ? "paid" : liveStatus);
    }
  }
});

test("ffmpeg stdin failures reject the moderation job without uncaught EPIPE", async () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = new EventEmitter();
  child.kill = () => {};
  child.stdin.end = () => queueMicrotask(() => child.stdin.emit("error", Object.assign(new Error("write EPIPE"), { code: "EPIPE" })));
  const context = vm.createContext({ ffmpegPath: "mock-ffmpeg", spawn: () => child, Buffer, setTimeout, clearTimeout });
  vm.runInContext(section("function renderMediaContactSheet(", "async function prepareMediaFrame("), context);
  await assert.rejects(context.renderMediaContactSheet(Buffer.from("not-a-video")), /EPIPE/);
});

test("media notification failures preserve committed orders and claimed credits", async () => {
  for (const creditClaim of [false, true]) {
    for (const failurePoint of ["campaign-write", "notification"]) {
    const route = creditClaim
      ? section('app.post("/api/media/credits/:id/claim"', "const pageRoutes = new Map(")
      : section('app.post("/api/media/campaigns"', 'app.get("/api/admin/media/campaigns"');
    const start = route.indexOf('if (delivery.status === "fulfilled")');
    const body = route.slice(start, route.lastIndexOf("});"));
    const writes = [];
    const context = vm.createContext({
      delivery: { status: "fulfilled", supplier: "local inventory", keyValue: "test-only-key" },
      order: { id: "test-order" }, campaign: { id: "test-campaign" }, credit: { id: "test-credit", campaign_id: "test-campaign" },
      user: { id: "test-user" }, member: { discord_id: "test-discord", username: "test-user" },
      selection: { product: { name: "Test product" }, variant: { name: "1 Day" } },
      deliveryConfirmed: false, creditClaimed: true, supplierOrderAccepted: false,
      orderId: "test-order", campaignId: "test-campaign", console: quiet, res: response(),
      markOrderFulfilled: async () => {},
      postFulfillment: async () => { throw new Error("notification temporarily unavailable"); },
      supabaseAdmin: { from(table) {
        const q = query({ error: null }, (value) => writes.push({ table, value }));
        if (table === "media_campaigns" && failurePoint === "campaign-write") q.then = (resolve, reject) => Promise.reject(new Error("campaign connection unavailable")).then(resolve, reject);
        q.insert = () => q;
        q.delete = () => { writes.push({ table, deleted: true }); return q; };
        q.catch = () => Promise.resolve();
        return q;
      } },
    });
    vm.runInContext(section("function mediaApiError(", "async function getMediaMemberForUser("), context);
    await vm.runInContext(`(async () => { try { ${body} })()`, context);
    assert.equal(context.deliveryConfirmed, true);
    assert.match(context.res.body.error, /key was saved/i);
    assert.equal(writes.some((write) => write.deleted || write.value?.status === "canceled" || write.value?.status === "cancelled" || write.value?.status === "available"), false, "Committed delivery must never be undone by notification failure");
    }
  }
});
