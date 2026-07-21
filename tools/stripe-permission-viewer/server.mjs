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

async function inspectKey(key) {
  if (typeof key !== "string" || !/^rk_(test|live)_/.test(key)) {
    throw new Error("Enter a Stripe restricted key beginning with rk_live_ or rk_test_.");
  }

  const stripe = new Stripe(key, { maxNetworkRetries: 1, timeout: 15_000 });
  const results = [];

  for (const [resource, check] of checks) {
    try {
      await check(stripe);
      results.push({ resource, readAccess: "allowed" });
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
    note: "These are read-only capability checks. Stripe does not expose write-permission metadata through the API, so write access remains unknown.",
    results,
  };
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

    if (request.method === "POST" && request.url === "/api/inspect") {
      if (request.headers["x-permission-viewer-token"] !== APP_TOKEN) {
        sendJson(response, 403, { error: "Invalid local session." });
        return;
      }
      const body = await readJson(request);
      sendJson(response, 200, await inspectKey(body.key));
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
