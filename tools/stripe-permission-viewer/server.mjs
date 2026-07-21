import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import Stripe from "stripe";

const HOST = "127.0.0.1";
const PORT = 4400;
const APP_TOKEN = randomBytes(32).toString("hex");
const pageTemplate = await readFile(new URL("./index.html", import.meta.url), "utf8");

const checks = [
  ["Account details", (stripe) => stripe.accounts.retrieve()],
  ["Balance", (stripe) => stripe.balance.retrieve()],
  ["Balance Transactions", (stripe) => stripe.balanceTransactions.list({ limit: 1 })],
  ["Charges", (stripe) => stripe.charges.list({ limit: 1 })],
  ["Customers", (stripe) => stripe.customers.list({ limit: 1 })],
  ["Payment Intents", (stripe) => stripe.paymentIntents.list({ limit: 1 })],
  ["Setup Intents", (stripe) => stripe.setupIntents.list({ limit: 1 })],
  ["Payment Links", (stripe) => stripe.paymentLinks.list({ limit: 1 })],
  ["Payment Method Configurations", (stripe) => stripe.paymentMethodConfigurations.list({ limit: 1 })],
  ["Payment Method Domains", (stripe) => stripe.paymentMethodDomains.list({ limit: 1 })],
  ["Refunds", (stripe) => stripe.refunds.list({ limit: 1 })],
  ["Disputes", (stripe) => stripe.disputes.list({ limit: 1 })],
  ["Checkout Sessions", (stripe) => stripe.checkout.sessions.list({ limit: 1 })],
  ["Subscriptions", (stripe) => stripe.subscriptions.list({ limit: 1 })],
  ["Subscription Schedules", (stripe) => stripe.subscriptionSchedules.list({ limit: 1 })],
  ["Invoices", (stripe) => stripe.invoices.list({ limit: 1 })],
  ["Invoice Items", (stripe) => stripe.invoiceItems.list({ limit: 1 })],
  ["Credit Notes", (stripe) => stripe.creditNotes.list({ limit: 1 })],
  ["Quotes", (stripe) => stripe.quotes.list({ limit: 1 })],
  ["Plans", (stripe) => stripe.plans.list({ limit: 1 })],
  ["Billing Meters", (stripe) => stripe.billing.meters.list({ limit: 1 })],
  ["Billing Portal Configurations", (stripe) => stripe.billingPortal.configurations.list({ limit: 1 })],
  ["Products", (stripe) => stripe.products.list({ limit: 1 })],
  ["Prices", (stripe) => stripe.prices.list({ limit: 1 })],
  ["Shipping Rates", (stripe) => stripe.shippingRates.list({ limit: 1 })],
  ["Coupons", (stripe) => stripe.coupons.list({ limit: 1 })],
  ["Promotion Codes", (stripe) => stripe.promotionCodes.list({ limit: 1 })],
  ["Payouts", (stripe) => stripe.payouts.list({ limit: 1 })],
  ["Transfers", (stripe) => stripe.transfers.list({ limit: 1 })],
  ["Application Fees", (stripe) => stripe.applicationFees.list({ limit: 1 })],
  ["Connected Accounts", (stripe) => stripe.accounts.list({ limit: 1 })],
  ["Webhook Endpoints", (stripe) => stripe.webhookEndpoints.list({ limit: 1 })],
  ["Events", (stripe) => stripe.events.list({ limit: 1 })],
  ["Files", (stripe) => stripe.files.list({ limit: 1 })],
  ["Radar Reviews", (stripe) => stripe.reviews.list({ limit: 1 })],
  ["Radar Early Fraud Warnings", (stripe) => stripe.radar.earlyFraudWarnings.list({ limit: 1 })],
  ["Radar Value Lists", (stripe) => stripe.radar.valueLists.list({ limit: 1 })],
  ["Tax Rates", (stripe) => stripe.taxRates.list({ limit: 1 })],
  ["Tax Calculations", (stripe) => stripe.tax.calculations.list({ limit: 1 })],
  ["Tax Transactions", (stripe) => stripe.tax.transactions.list({ limit: 1 })],
  ["Tax Registrations", (stripe) => stripe.tax.registrations.list({ limit: 1 })],
  ["Tax Settings", (stripe) => stripe.tax.settings.retrieve()],
  ["Entitlement Features", (stripe) => stripe.entitlements.features.list({ limit: 1 })],
  ["Terminal Locations", (stripe) => stripe.terminal.locations.list({ limit: 1 })],
  ["Terminal Readers", (stripe) => stripe.terminal.readers.list({ limit: 1 })],
  ["Terminal Configurations", (stripe) => stripe.terminal.configurations.list({ limit: 1 })],
  ["Issuing Cards", (stripe) => stripe.issuing.cards.list({ limit: 1 })],
  ["Issuing Cardholders", (stripe) => stripe.issuing.cardholders.list({ limit: 1 })],
  ["Issuing Authorizations", (stripe) => stripe.issuing.authorizations.list({ limit: 1 })],
  ["Issuing Transactions", (stripe) => stripe.issuing.transactions.list({ limit: 1 })],
  ["Issuing Disputes", (stripe) => stripe.issuing.disputes.list({ limit: 1 })],
  ["Identity Verification Sessions", (stripe) => stripe.identity.verificationSessions.list({ limit: 1 })],
  ["Financial Connections Accounts", (stripe) => stripe.financialConnections.accounts.list({ limit: 1 })],
  ["Climate Orders", (stripe) => stripe.climate.orders.list({ limit: 1 })],
  ["Climate Products", (stripe) => stripe.climate.products.list({ limit: 1 })],
  ["Climate Suppliers", (stripe) => stripe.climate.suppliers.list({ limit: 1 })],
  ["Reporting Report Runs", (stripe) => stripe.reporting.reportRuns.list({ limit: 1 })],
  ["Reporting Report Types", (stripe) => stripe.reporting.reportTypes.list({ limit: 1 })],
  ["Country Specifications", (stripe) => stripe.countrySpecs.list({ limit: 1 })],
  ["Exchange Rates", (stripe) => stripe.exchangeRates.list({ limit: 1 })],
  ["Apple Pay Domains", (stripe) => stripe.applePayDomains.list({ limit: 1 })],
];

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) throw new Error("Request is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function errorStatus(error) {
  if (error?.statusCode === 401) return "invalid_key";
  if (error?.statusCode === 403 || error?.type === "StripePermissionError") return "denied";
  return "unavailable";
}

function safePreview(resource, value) {
  if (resource === "Account details") {
    return {
      id: value.id,
      type: value.type,
      country: value.country,
      default_currency: value.default_currency,
      charges_enabled: value.charges_enabled,
      payouts_enabled: value.payouts_enabled,
      details_submitted: value.details_submitted,
    };
  }

  if (resource === "Balance") {
    return {
      livemode: value.livemode,
      available: value.available?.map(({ amount, currency, source_types }) => ({ amount, currency, source_types })),
      pending: value.pending?.map(({ amount, currency, source_types }) => ({ amount, currency, source_types })),
      instant_available: value.instant_available?.map(({ amount, currency, source_types }) => ({ amount, currency, source_types })),
    };
  }

  const allowedFields = [
    "id", "object", "created", "livemode", "status", "active", "type",
    "amount", "amount_refunded", "amount_paid", "amount_due", "amount_remaining",
    "currency", "paid", "captured", "refunded", "payment_status", "mode",
    "unit_amount", "billing_scheme", "product", "price", "quantity",
    "current_period_start", "current_period_end", "collection_method",
    "charges_enabled", "payouts_enabled", "default_currency", "country",
  ];

  const sanitize = (item) => {
    if (!item || typeof item !== "object") return item;
    const output = {};
    for (const field of allowedFields) {
      if (item[field] !== undefined && item[field] !== null && typeof item[field] !== "object") {
        output[field] = item[field];
      }
    }
    if (item.recurring && typeof item.recurring === "object") {
      output.recurring = {
        interval: item.recurring.interval,
        interval_count: item.recurring.interval_count,
        usage_type: item.recurring.usage_type,
      };
    }
    return output;
  };

  if (Array.isArray(value?.data)) {
    return {
      returned_items: value.data.length,
      has_more: Boolean(value.has_more),
      items: value.data.map(sanitize),
    };
  }

  return sanitize(value);
}

async function inspectKey(key) {
  if (typeof key !== "string" || !/^rk_(test|live)_/.test(key)) {
    throw new Error("Enter a Stripe restricted key beginning with rk_live_ or rk_test_.");
  }

  const stripe = new Stripe(key, { maxNetworkRetries: 1, timeout: 15_000 });
  const results = [];

  for (const [resource, check] of checks) {
    try {
      const value = await check(stripe);
      results.push({ resource, readAccess: "allowed", output: safePreview(resource, value) });
    } catch (error) {
      const status = errorStatus(error);
      if (status === "invalid_key") throw new Error("Stripe rejected this key as invalid or revoked.");
      results.push({
        resource,
        readAccess: status,
        detail: status === "denied" ? "The key lacks read permission." : "This check could not be completed.",
      });
    }
  }

  return {
    mode: key.startsWith("rk_live_") ? "live" : "test",
    checkedAt: new Date().toISOString(),
    note: "Output includes a redacted sample from each readable resource. Customer identity, contact information, payment details, metadata, credentials, and secrets are excluded. Write access remains unknown because this viewer performs no writes.",
    results,
  };
}

async function checkRefundWrite(key) {
  if (typeof key !== "string" || !/^rk_(test|live)_/.test(key)) {
    throw new Error("Enter a Stripe restricted key beginning with rk_live_ or rk_test_.");
  }

  const stripe = new Stripe(key, { maxNetworkRetries: 1, timeout: 15_000 });
  const charges = await stripe.charges.list({ limit: 1 });
  const charge = charges.data[0];
  if (!charge) {
    return {
      status: "inconclusive",
      detail: "No readable charge is available for the validation probe.",
    };
  }

  try {
    // Stripe requires a positive refund amount. A negative value lets the API
    // validate endpoint access without creating or changing a refund.
    await stripe.refunds.create({ charge: charge.id, amount: -1 });
    return {
      status: "unexpected",
      detail: "Stripe unexpectedly accepted the invalid request. Review the Stripe request log.",
    };
  } catch (error) {
    if (error?.statusCode === 401) {
      return { status: "invalid_key", detail: "Stripe rejected the key as invalid or revoked." };
    }
    if (error?.statusCode === 403 || error?.type === "StripePermissionError") {
      return { status: "denied", detail: "The key does not have permission to create refunds." };
    }
    if (error?.statusCode === 400 && (error?.param === "amount" || /amount|positive|greater/i.test(error?.message || ""))) {
      return {
        status: "likely_allowed",
        detail: "Stripe reached refund-amount validation, indicating that refund creation is likely permitted. No refund was created.",
      };
    }
    return {
      status: "inconclusive",
      detail: "Stripe rejected the probe for a reason that does not conclusively identify the refund permission.",
    };
  }
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'",
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(pageTemplate.replaceAll("__APP_TOKEN__", APP_TOKEN));
      return;
    }

    if (request.method === "POST" && ["/api/inspect", "/api/check-refund-write"].includes(request.url)) {
      if (request.headers["x-permission-viewer-token"] !== APP_TOKEN) {
        sendJson(response, 403, { error: "Invalid local session." });
        return;
      }
      const body = await readJson(request);
      const result = request.url === "/api/inspect"
        ? await inspectKey(body.key)
        : await checkRefundWrite(body.key);
      sendJson(response, 200, result);
      return;
    }

    sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    sendJson(response, 400, { error: error.message || "Unexpected error." });
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Close the other viewer window and try again.`);
  } else {
    console.error(`The local viewer could not start: ${error.message}`);
  }
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log(`Stripe Permission Viewer is available locally at ${url}`);
  console.log("Close this window when you are finished.");
  spawn("powershell.exe", ["-NoProfile", "-Command", `Start-Process '${url}'`], {
    detached: true,
    stdio: "ignore",
  }).unref();
});
