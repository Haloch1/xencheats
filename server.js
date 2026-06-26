import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { products } from "./data/products.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.set("trust proxy", 1);
const port = Number(process.env.PORT || 4242);
const distDir = path.join(__dirname, "dist");
const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL || "";
const discordLiveDeskMention = process.env.DISCORD_LIVE_DESK_MENTION || "";
const discordSignupWebhookUrl = process.env.DISCORD_SIGNUP_WEBHOOK_URL || "";
const discordSecurityWebhookUrl =
  process.env.DISCORD_SECURITY_WEBHOOK_URL || discordSignupWebhookUrl;
const discordOrderWebhookUrl = process.env.DISCORD_ORDER_WEBHOOK_URL || "";
const adminAccessKey = process.env.ADMIN_ACCESS_KEY || "";
const ownerRequestsKey = process.env.OWNER_REQUESTS_KEY || "";
const groqApiKey = process.env.GROQ_API_KEY || "";
const liveDeskCooldownMs = 45_000;
const liveDeskCooldownByIp = new Map();
const staffAccessTtlMs = 1000 * 60 * 60 * 8;
const deleteApprovalTtlMs = 1000 * 60 * 15;
const visitorHeartbeatTtlMs = 75_000;
const visitorPageViewCooldownMs = 1000 * 60 * 10;
const visitorViewLogLimit = 120;
const visitorSessions = new Map();
const recentVisitorViews = [];

function isConfiguredValue(value) {
  return Boolean(value && !/(replace_me|your_supabase|your-project|your_)/i.test(value));
}

function maskSecret(value) {
  if (!isConfiguredValue(value)) {
    return "Not configured";
  }

  const visible = value.slice(-6);
  return `Configured (ends in ${visible})`;
}

const stripe = isConfiguredValue(process.env.STRIPE_SECRET_KEY)
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
const supabaseAdmin =
  isConfiguredValue(supabaseUrl) && isConfiguredValue(supabaseSecretKey)
    ? createClient(supabaseUrl, supabaseSecretKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;
const supabaseAuth =
  isConfiguredValue(supabaseUrl) && isConfiguredValue(supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

const accessCookieName = "hc_access_token";
const refreshCookieName = "hc_refresh_token";
const ownerCookieName = "hc_owner_session";
const authCookieMaxAgeSeconds = 60 * 60 * 24 * 30;
const ownerCookieMaxAgeSeconds = 60 * 60 * 8;
const secureCookie = baseUrl.startsWith("https://");
const authRateLimitByIp = new Map();
const adminAccessRateLimitByKey = new Map();
const deleteKeyRateLimitByKey = new Map();
const resellerApiRateLimitByKey = new Map();

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || "";

  return cookieHeader.split(";").reduce((cookies, item) => {
    const [rawName, ...rawValue] = item.trim().split("=");

    if (!rawName) {
      return cookies;
    }

    cookies[rawName] = decodeURIComponent(rawValue.join("=") || "");
    return cookies;
  }, {});
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  parts.push("Path=/");
  parts.push("SameSite=Lax");
  parts.push("HttpOnly");

  if (secureCookie) {
    parts.push("Secure");
  }

  if (options.maxAge === 0) {
    parts.push("Max-Age=0");
  } else {
    parts.push(`Max-Age=${options.maxAge || authCookieMaxAgeSeconds}`);
  }

  return parts.join("; ");
}

function setAuthCookies(res, session) {
  if (!session?.access_token || !session?.refresh_token) {
    return;
  }

  res.setHeader("Set-Cookie", [
    serializeCookie(accessCookieName, session.access_token, {
      maxAge: session.expires_in || 3600,
    }),
    serializeCookie(refreshCookieName, session.refresh_token),
  ]);
}

function clearAuthCookies(res) {
  res.setHeader("Set-Cookie", [
    serializeCookie(accessCookieName, "", { maxAge: 0 }),
    serializeCookie(refreshCookieName, "", { maxAge: 0 }),
  ]);
}

function setOwnerCookie(res) {
  res.setHeader(
    "Set-Cookie",
    serializeCookie(ownerCookieName, hashToken(ownerRequestsKey), {
      maxAge: ownerCookieMaxAgeSeconds,
    })
  );
}

function clearOwnerCookie(res) {
  res.setHeader("Set-Cookie", serializeCookie(ownerCookieName, "", { maxAge: 0 }));
}

function getProductBySlug(productSlug) {
  return products.find((item) => item.slug === productSlug);
}

function getProductSelection(productSlug, variantSlug) {
  const product = getProductBySlug(productSlug);

  if (!product) {
    return null;
  }

  const variant = product.variants?.find((item) => item.slug === variantSlug);

  if (!variant) {
    return null;
  }

  return {
    product,
    variant,
    inventorySlug: variant.inventorySlug || `${product.slug}-${variant.slug}`,
    name: `${product.name} - ${variant.name}`,
    priceDisplay: variant.priceDisplay,
  };
}

function getCatalogItemByInventorySlug(inventorySlug) {
  for (const product of products) {
    const variant = product.variants?.find((item) => {
      return (item.inventorySlug || `${product.slug}-${item.slug}`) === inventorySlug;
    });

    if (variant) {
      return {
        product,
        variant,
        name: `${product.name} - ${variant.name}`,
        priceDisplay: variant.priceDisplay,
      };
    }
  }

  const product = getProductBySlug(inventorySlug);

  if (!product) {
    return null;
  }

  return {
    product,
    variant: null,
    name: product.name,
    priceDisplay: product.priceDisplay,
  };
}

function getVariantInventorySlug(product, variant) {
  return variant.inventorySlug || `${product.slug}-${variant.slug}`;
}

function formatKeyStockLabel(count) {
  if (!count) {
    return "0 In Stock";
  }

  return `${count} ${count === 1 ? "Key" : "Keys"} Available`;
}

async function getUnusedLicenseKeyCounts() {
  const counts = new Map();

  if (!supabaseAdmin) {
    return counts;
  }

  const inventorySlugs = products.flatMap((product) =>
    (product.variants || []).map((variant) => getVariantInventorySlug(product, variant))
  );

  if (!inventorySlugs.length) {
    return counts;
  }

  const { data, error } = await supabaseAdmin
    .from("license_keys")
    .select("product_slug")
    .in("product_slug", inventorySlugs)
    .eq("status", "unused");

  if (error) {
    throw error;
  }

  for (const row of data || []) {
    counts.set(row.product_slug, (counts.get(row.product_slug) || 0) + 1);
  }

  return counts;
}

function getAuthToken(req) {
  const authorization = req.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    return parseCookies(req)[accessCookieName] || null;
  }

  return authorization.slice("Bearer ".length).trim();
}

async function getAuthenticatedUser(req) {
  if (!supabaseAdmin) {
    throw Object.assign(new Error(""), {
      status: 500,
    });
  }

  const token = getAuthToken(req);
  const cookies = parseCookies(req);

  if (!token) {
    throw Object.assign(new Error("Sign in before using this action."), {
      status: 401,
    });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    const refreshToken = cookies[refreshCookieName];

    if (refreshToken && supabaseAuth) {
      const refreshResult = await supabaseAuth.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (!refreshResult.error && refreshResult.data.user) {
        return refreshResult.data.user;
      }
    }

    throw Object.assign(new Error("Your session is no longer valid. Please sign in again."), {
      status: 401,
    });
  }

  return data.user;
}

function normalizeOrder(order) {
  const catalogItem = getCatalogItemByInventorySlug(order.product_slug);

  return {
    id: order.id,
    productSlug: order.product_slug,
    productName: catalogItem?.name || order.product_slug,
    priceDisplay: catalogItem?.priceDisplay || "N/A",
    status: order.status,
    createdAt: order.created_at,
    fulfilledAt: order.fulfilled_at,
  };
}

function getConfiguredResellerApiKeys() {
  return String(process.env.RESELLER_API_KEYS || "")
    .split(",")
    .map((key) => key.trim())
    .filter(isConfiguredValue);
}

function getBearerApiKey(req) {
  const authorization = req.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice("Bearer ".length).trim();
}

function secureTokenMatches(candidate, allowedToken) {
  const candidateHash = Buffer.from(hashToken(candidate));
  const allowedHash = Buffer.from(hashToken(allowedToken));

  return (
    candidateHash.length === allowedHash.length &&
    crypto.timingSafeEqual(candidateHash, allowedHash)
  );
}

function ensureResellerApiAccess(req) {
  const configuredKeys = getConfiguredResellerApiKeys();

  if (!configuredKeys.length) {
    throw Object.assign(new Error("Reseller API is not configured."), {
      status: 500,
    });
  }

  const apiKey = getBearerApiKey(req);

  if (!apiKey || !configuredKeys.some((key) => secureTokenMatches(apiKey, key))) {
    throw Object.assign(new Error("API access denied."), {
      status: 401,
    });
  }

  checkRateLimit(
    resellerApiRateLimitByKey,
    hashToken(apiKey),
    1_000,
    "Too many API requests."
  );

  return apiKey;
}

function normalizeVariantLabel(value) {
  return trimField(value, 80)
    .toLowerCase()
    .replace(/\bkeys?\b/g, "")
    .replace(/\bdays\b/g, "day")
    .replace(/\bweeks\b/g, "week")
    .replace(/\bmonths\b/g, "month")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getCatalogItemByVariantInventorySlug(inventorySlug) {
  for (const product of products) {
    const variant = product.variants?.find(
      (item) => getVariantInventorySlug(product, item) === inventorySlug
    );

    if (variant) {
      return {
        product,
        variant,
        inventorySlug,
        name: `${product.name} - ${variant.name}`,
        priceDisplay: variant.priceDisplay,
      };
    }
  }

  return null;
}

function getResellerProductSelection(body) {
  const inventorySlug = trimField(body?.inventory_slug, 160);

  if (inventorySlug) {
    return getCatalogItemByVariantInventorySlug(inventorySlug);
  }

  const productSlug = trimField(body?.product_slug, 160);
  const variantSlug = trimField(body?.variant_slug, 160);

  if (productSlug && variantSlug) {
    return getProductSelection(productSlug, variantSlug);
  }

  const product = getProductBySlug(productSlug);

  if (!product) {
    return null;
  }

  const requestedLabel = normalizeVariantLabel(body?.variant_label);

  if (!requestedLabel) {
    return null;
  }

  const variant = product.variants?.find((item) => {
    return (
      normalizeVariantLabel(item.name) === requestedLabel ||
      normalizeVariantLabel(item.slug) === requestedLabel
    );
  });

  if (!variant) {
    return null;
  }

  return {
    product,
    variant,
    inventorySlug: getVariantInventorySlug(product, variant),
    name: `${product.name} - ${variant.name}`,
    priceDisplay: variant.priceDisplay,
  };
}

function normalizeApiQuantity(value) {
  const quantity = Number.parseInt(value, 10);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return 1;
  }

  return quantity;
}

function createApiOrderNumber() {
  return `HC-API-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function ensureAdminAccess(req) {
  if (!isConfiguredValue(adminAccessKey)) {
    throw Object.assign(new Error("Admin desk is not configured yet."), {
      status: 500,
    });
  }

  const provided = req.headers["x-admin-key"] || "";
  if (!provided || !timingSafeCompare(provided, adminAccessKey)) {
    throw Object.assign(new Error("Admin access denied."), {
      status: 401,
    });
  }
}

function ensureOwnerAccess(req) {
  if (!isConfiguredValue(ownerRequestsKey)) {
    throw Object.assign(new Error("Owner request panel is not configured yet."), {
      status: 500,
    });
  }

  const cookies = parseCookies(req);
  const ownerSession = cookies[ownerCookieName];

  if (!ownerSession || !timingSafeCompare(ownerSession, hashToken(ownerRequestsKey))) {
    throw Object.assign(new Error("Owner access denied."), {
      status: 401,
    });
  }
}

function createSecretToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function hashToken(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function createOneTimeDeleteKey() {
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}

function checkRateLimit(bucket, key, windowMs, message) {
  const now = Date.now();
  const lastAttemptAt = bucket.get(key) || 0;

  if (now - lastAttemptAt < windowMs) {
    const secondsLeft = Math.ceil((windowMs - (now - lastAttemptAt)) / 1000);

    throw Object.assign(new Error(`${message} Try again in ${secondsLeft} seconds.`), {
      status: 429,
    });
  }

  bucket.set(key, now);
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.length) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
}

function trimField(value, maxLength = 500) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

/** Timing-safe string comparison to prevent timing attacks on secrets */
function timingSafeCompare(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA); // constant-time even on length mismatch
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Strip HTML/script tags to prevent stored XSS */
function sanitizeInput(value, maxLength = 500) {
  return trimField(value, maxLength)
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "");
}

function normalizeVisitorId(value) {
  const visitorId = trimField(value, 80);

  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(visitorId)) {
    return "";
  }

  return visitorId;
}

function normalizeVisitorPath(value) {
  const pagePath = trimField(value, 160) || "/";

  if (!pagePath.startsWith("/")) {
    return "/";
  }

  return pagePath.replace(/[<>"'`]/g, "").slice(0, 160);
}

function normalizeVisitorReferrer(value) {
  const referrer = trimField(value, 220);

  if (!referrer) {
    return "Direct";
  }

  try {
    const referrerUrl = new URL(referrer);
    const siteHost = new URL(baseUrl).host;

    if (referrerUrl.host === siteHost) {
      return `Internal ${normalizeVisitorPath(`${referrerUrl.pathname}${referrerUrl.search}`)}`;
    }

    return referrerUrl.hostname.slice(0, 120);
  } catch {
    return "Unknown";
  }
}

function normalizeVisitorIp(value) {
  return trimField(value, 80).replace(/[<>"'`]/g, "") || "unknown";
}

function normalizeVisitorUserLabel(user) {
  const username = normalizeUsername(user?.user_metadata?.username);
  const email = trimField(user?.email, 120);

  return username || email || "";
}

async function getOptionalVisitorUserLabel(req) {
  if (!getAuthToken(req)) {
    return "";
  }

  try {
    const user = await getAuthenticatedUser(req);
    return normalizeVisitorUserLabel(user);
  } catch {
    return "";
  }
}

function recordVisitorPageView({ visitorId, userLabel, pagePath, referrer, ipAddress, now }) {
  recentVisitorViews.unshift({
    id: createSecretToken(8),
    visitorLabel: hashToken(visitorId).slice(0, 10),
    userLabel: trimField(userLabel, 120),
    pagePath,
    referrer: normalizeVisitorReferrer(referrer),
    ipAddress: normalizeVisitorIp(ipAddress),
    viewedAt: new Date(now).toISOString(),
  });

  if (recentVisitorViews.length > visitorViewLogLimit) {
    recentVisitorViews.length = visitorViewLogLimit;
  }
}

function pruneVisitorSessions() {
  const activeAfter = Date.now() - visitorHeartbeatTtlMs;

  for (const [visitorId, session] of visitorSessions.entries()) {
    if (session.lastSeenAt < activeAfter) {
      visitorSessions.delete(visitorId);
    }
  }
}

function normalizeUsername(value) {
  return trimField(value, 32);
}

function isValidUsername(value) {
  return /^[a-zA-Z0-9_.-]{3,32}$/.test(value);
}

async function loadSupportThreads(queryBuilder) {
  const threadResult = await queryBuilder;

  if (threadResult.error) {
    throw threadResult.error;
  }

  const threads = threadResult.data || [];
  const threadIds = threads.map((thread) => thread.id);

  if (!threadIds.length) {
    return [];
  }

  const messagesResult = await supabaseAdmin
    .from("support_messages")
    .select("id, thread_id, sender_type, body, created_at")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: true });

  if (messagesResult.error) {
    throw messagesResult.error;
  }

  const messagesByThreadId = new Map();

  for (const message of messagesResult.data || []) {
    const collection = messagesByThreadId.get(message.thread_id) || [];
    collection.push({
      id: message.id,
      senderType: message.sender_type,
      body: message.body,
      createdAt: message.created_at,
    });
    messagesByThreadId.set(message.thread_id, collection);
  }

  return threads.map((thread) => ({
    id: thread.id,
    subject: thread.subject,
    status: thread.status,
    createdAt: thread.created_at,
    updatedAt: thread.updated_at,
    lastMessageAt: thread.last_message_at,
    contactName: thread.contact_name,
    contactMethod: thread.contact_method,
    messages: messagesByThreadId.get(thread.id) || [],
  }));
}

function normalizeAccessRequest(row, includeSensitive = false) {
  const normalized = {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    discordUsername: row.discord_username,
    reason: row.reason,
    status: row.status,
    requestedAt: row.requested_at,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    deniedAt: row.denied_at,
    deniedBy: row.denied_by,
    expiresAt: row.expires_at,
    userAgent: row.user_agent,
  };

  if (includeSensitive) {
    normalized.staffTokenHash = row.staff_token_hash;
  }

  return normalized;
}

function normalizeAuditLog(row) {
  return {
    id: row.id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    actorRequestId: row.actor_request_id,
    actorDiscordUsername: row.actor_discord_username,
    details: row.details || {},
    createdAt: row.created_at,
    userAgent: row.user_agent,
  };
}

async function getApprovedStaffAccess(req) {
  if (!supabaseAdmin) {
    throw Object.assign(new Error("Admin access storage is not configured."), {
      status: 500,
    });
  }

  const member = await getAuthenticatedUser(req);
  const staffToken = req.headers["x-admin-staff-token"];

  if (!staffToken) {
    throw Object.assign(new Error("Staff approval is required before using the desk."), {
      status: 401,
    });
  }

  const accessResult = await supabaseAdmin
    .from("admin_access_requests")
    .select(
      "id, user_id, user_email, discord_username, reason, status, requested_at, approved_at, approved_by, denied_at, denied_by, expires_at, user_agent, staff_token_hash"
    )
    .eq("staff_token_hash", hashToken(staffToken))
    .eq("status", "approved")
    .maybeSingle();

  if (accessResult.error) {
    throw accessResult.error;
  }

  if (!accessResult.data) {
    throw Object.assign(new Error("Staff approval is required before using the desk."), {
      status: 401,
    });
  }

  if (accessResult.data.user_id !== member.id) {
    throw Object.assign(new Error("Staff approval belongs to a different signed-in account."), {
      status: 401,
    });
  }

  if (new Date(accessResult.data.expires_at).getTime() <= Date.now()) {
    throw Object.assign(new Error("Staff approval expired. Request access again."), {
      status: 401,
    });
  }

  return normalizeAccessRequest(accessResult.data, true);
}

async function insertAdminAuditLog(req, action, targetType, targetId, actor, details = {}) {
  if (!supabaseAdmin) {
    return;
  }

  const logInsert = await supabaseAdmin.from("admin_audit_logs").insert({
    action,
    target_type: targetType,
    target_id: targetId,
    actor_request_id: actor?.id || null,
    actor_discord_username: actor?.discordUsername || "unknown",
    details,
    user_agent: trimField(req.headers["user-agent"], 300),
  });

  if (logInsert.error) {
    throw logInsert.error;
  }
}

async function sendDiscordWebhook(webhookUrl, payload) {
  if (!isConfiguredValue(webhookUrl)) {
    return null;
  }

  return fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

async function sendSignupDiscordAlert(user) {
  const response = await sendDiscordWebhook(discordSignupWebhookUrl, {
    content: "New Halo Cheats account created",
    embeds: [
      {
        title: "New account signup",
        color: 0xff2a2a,
        fields: [
          {
            name: "Email",
            value: user?.email || "Unknown",
          },
          {
            name: "Username",
            value: user?.user_metadata?.username || "Not set",
          },
          {
            name: "User ID",
            value: user?.id || "Unknown",
          },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  });

  if (response && response.ok === false) {
    console.error(`[Discord webhook] Signup alert failed with status ${response.status}.`);
  }
}

async function sendSecurityDiscordAlert(title, fields = []) {
  const response = await sendDiscordWebhook(discordSecurityWebhookUrl, {
    content: title,
    embeds: [
      {
        title,
        color: 0xffb020,
        fields,
        timestamp: new Date().toISOString(),
      },
    ],
  });

  if (response && response.ok === false) {
    console.error(`[Discord webhook] Security alert failed with status ${response.status}.`);
  }
}

async function sendLiveDeskDiscordAlert(thread, message, user, eventLabel = "New live desk thread opened") {
  if (!isConfiguredValue(discordWebhookUrl)) {
    return;
  }

  const contentPrefix = isConfiguredValue(discordLiveDeskMention)
    ? `${discordLiveDeskMention} `
    : "";

  return fetch(discordWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: `${contentPrefix}${eventLabel}`,
      embeds: [
        {
          title: thread.subject,
          color: 0xff2a2a,
          description: message.body,
          fields: [
            {
              name: "Member",
              value: thread.contact_name || "Unknown",
              inline: true,
            },
            {
              name: "Contact",
              value: thread.contact_method || "Unknown",
              inline: true,
            },
            {
              name: "Thread ID",
              value: thread.id,
              inline: false,
            },
            {
              name: "Desk Inbox",
              value: `${baseUrl}/desk-admin/`,
              inline: false,
            },
          ],
          footer: {
            text: user?.email ? `Signed-in member: ${user.email}` : "Guest live desk request",
          },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });
}

async function syncPaidOrder(session) {
  if (!supabaseAdmin) {
    throw new Error("Supabase server auth is not configured.");
  }

  const orderId = session.metadata?.orderId || null;
  let order = null;

  if (orderId) {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, product_slug, status, fulfilled_at")
      .eq("id", orderId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    order = data;
  }

  if (!order && session.id) {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, product_slug, status, fulfilled_at")
      .eq("stripe_session_id", session.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    order = data;
  }

  if (!order) {
    throw new Error(`No order record found for checkout session ${session.id}.`);
  }

  const assignedKeyResult = await supabaseAdmin
    .from("license_keys")
    .select("id, key_value, assigned_order_id")
    .eq("assigned_order_id", order.id)
    .limit(1);

  if (assignedKeyResult.error) {
    throw assignedKeyResult.error;
  }

  const alreadyAssignedKey = assignedKeyResult.data?.[0] ?? null;

  if (alreadyAssignedKey) {
    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        status: "fulfilled",
        stripe_session_id: session.id,
        stripe_payment_intent: session.payment_intent || null,
        fulfilled_at: order.fulfilled_at || new Date().toISOString(),
      })
      .eq("id", order.id);

    if (error) {
      throw error;
    }

    return { keyValue: alreadyAssignedKey.key_value };
  }

  const { data: availableKeys, error: availableKeyError } = await supabaseAdmin
    .from("license_keys")
    .select("id")
    .eq("product_slug", order.product_slug)
    .eq("status", "unused")
    .order("created_at", { ascending: true })
    .limit(1);

  if (availableKeyError) {
    throw availableKeyError;
  }

  const availableKey = availableKeys?.[0] ?? null;

  if (!availableKey) {
    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        status: "paid",
        stripe_session_id: session.id,
        stripe_payment_intent: session.payment_intent || null,
      })
      .eq("id", order.id);

    if (error) {
      throw error;
    }

    return;
  }

  const assignedAt = new Date().toISOString();

  const { data: updatedKey, error: keyAssignError } = await supabaseAdmin
    .from("license_keys")
    .update({
      status: "assigned",
      assigned_user_id: order.user_id,
      assigned_order_id: order.id,
      assigned_at: assignedAt,
    })
    .eq("id", availableKey.id)
    .eq("status", "unused")
    .is("assigned_user_id", null)
    .select("id, key_value")
    .maybeSingle();

  if (keyAssignError) {
    throw keyAssignError;
  }

  if (!updatedKey) {
    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        status: "paid",
        stripe_session_id: session.id,
        stripe_payment_intent: session.payment_intent || null,
      })
      .eq("id", order.id);

    if (error) {
      throw error;
    }

    return;
  }

  const { error: orderUpdateError } = await supabaseAdmin
    .from("orders")
    .update({
      status: "fulfilled",
      stripe_session_id: session.id,
      stripe_payment_intent: session.payment_intent || null,
      fulfilled_at: assignedAt,
      delivered_key_value: updatedKey.key_value,
    })
    .eq("id", order.id);

  if (orderUpdateError) {
    throw orderUpdateError;
  }

  /* ── Discord order log ── */
  if (isConfiguredValue(discordOrderWebhookUrl)) {
    const catalogItem = getCatalogItemByInventorySlug(order.product_slug);
    sendDiscordWebhook(discordOrderWebhookUrl, {
      embeds: [{
        title: "Order Fulfilled",
        color: 0x00c851,
        fields: [
          { name: "Product", value: catalogItem?.name || order.product_slug, inline: true },
          { name: "Status", value: "Fulfilled", inline: true },
          { name: "Order ID", value: order.id, inline: false },
          { name: "User ID", value: order.user_id || "Unknown", inline: false },
          { name: "Time", value: assignedAt, inline: false },
        ],
      }],
    }).catch((err) => console.error("[Discord order log]", err.message));
  }

  /* ── Sandbox mode: disabled for now so stock count decreases on purchase ── */
  // if (process.env.SANDBOX_MODE === "true") {
  //   console.log(`[Sandbox] Resetting key ${updatedKey.id} back to unused for reuse`);
  //   await supabaseAdmin
  //     .from("license_keys")
  //     .update({
  //       status: "unused",
  //       assigned_user_id: null,
  //       assigned_order_id: null,
  //       assigned_at: null,
  //     })
  //     .eq("id", updatedKey.id);
  // }

  return { keyValue: updatedKey.key_value };
}

app.post(
  "/api/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe || !isConfiguredValue(process.env.STRIPE_WEBHOOK_SECRET)) {
      return res.status(500).send("Stripe webhook is not configured.");
    }

    const signature = req.headers["stripe-signature"];

    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      if (event.type === "checkout.session.completed") {
        await syncPaidOrder(event.data.object);
        console.log("Checkout completed:", event.data.object.id);
      }

      return res.json({ received: true });
    } catch (error) {
      console.error("[Stripe webhook]", error.message);
      return res.status(400).send("Webhook signature verification failed.");
    }
  }
);

app.use(express.json());

/* ── Security middleware ── */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", supabaseUrl || ""],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));

app.use(cors({
  origin: [
    "https://halocheats.cc",
    "https://www.halocheats.cc",
    ...(process.env.NODE_ENV !== "production" ? ["http://localhost:3000", "http://localhost:4242"] : []),
  ],
  credentials: true,
}));

// Global rate limit: 100 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, slow down." },
});
app.use("/api/", globalLimiter);

// Strict rate limit for auth endpoints: 10 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again in 15 minutes." },
});
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth/signin", authLimiter);
app.use("/api/auth/reset-password", authLimiter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

/* ── Product status from Supabase ── */
app.get("/api/status", async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("product_statuses")
      .select("category, product_name, status")
      .order("category")
      .order("sort_order");

    if (error) throw error;

    // Group rows into categories
    const catMap = new Map();
    for (const row of data) {
      if (!catMap.has(row.category)) catMap.set(row.category, []);
      catMap.get(row.category).push({ name: row.product_name, status: row.status });
    }

    const categories = [...catMap.entries()].map(([name, products]) => ({ name, products }));
    res.json(categories);
  } catch (err) {
    console.error("Status fetch error:", err.message);
    res.status(500).json({ error: "Could not load status data." });
  }
});

/* Update a product status (owner only) */
app.post("/api/status/update", async (req, res) => {
  try { ensureOwnerAccess(req); } catch (e) { return res.status(e.status || 401).json({ error: e.message }); }

  const product = sanitizeInput(req.body?.product_name, 100);
  const status = sanitizeInput(req.body?.status, 30);
  const category = sanitizeInput(req.body?.category, 100);

  if (!product || !status) return res.status(400).json({ error: "product_name and status required." });

  try {
    const query = supabaseAdmin
      .from("product_statuses")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("product_name", product);

    if (category) query.eq("category", category);

    const { error } = await query;
    if (error) throw error;

    res.json({ ok: true, product, status });
  } catch (err) {
    res.status(500).json({ error: "Unable to update product status." });
  }
});

app.post("/api/visitors/heartbeat", async (req, res) => {
  const visitorId = normalizeVisitorId(req.body?.visitorId);

  if (!visitorId) {
    return res.status(400).json({ error: "Visitor session is invalid." });
  }

  const now = Date.now();
  const existing = visitorSessions.get(visitorId);
  const pagePath = normalizeVisitorPath(req.body?.pagePath);
  const userLabel = await getOptionalVisitorUserLabel(req);
  const shouldLogPageView =
    !existing ||
    existing.pagePath !== pagePath ||
    (userLabel && existing.userLabel !== userLabel) ||
    now - (existing.lastLoggedAt || 0) > visitorPageViewCooldownMs;

  if (shouldLogPageView) {
    recordVisitorPageView({
      visitorId,
      userLabel,
      pagePath,
      referrer: req.body?.referrer,
      ipAddress: getClientIp(req),
      now,
    });
  }

  visitorSessions.set(visitorId, {
    firstSeenAt: existing?.firstSeenAt || now,
    lastSeenAt: now,
    lastLoggedAt: shouldLogPageView ? now : existing?.lastLoggedAt || now,
    userLabel: userLabel || existing?.userLabel || "",
    pagePath,
  });

  pruneVisitorSessions();
  return res.json({ ok: true });
});

app.post("/api/owner/sign-in", async (req, res) => {
  try {
    const ownerKey = trimField(req.body?.ownerKey, 300);

    checkRateLimit(
      authRateLimitByIp,
      `owner:${getClientIp(req)}`,
      10_000,
      "Too many owner sign-in attempts."
    );

    if (!isConfiguredValue(ownerRequestsKey)) {
      return res.status(500).json({ error: "Owner panel is not configured yet." });
    }

    if (!ownerKey || !timingSafeCompare(ownerKey, ownerRequestsKey)) {
      return res.status(401).json({ error: "Owner access denied." });
    }

    setOwnerCookie(res);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error instanceof Error ? error.message : "Unable to unlock owner panel.",
    });
  }
});

app.post("/api/owner/sign-out", (_req, res) => {
  clearOwnerCookie(res);
  return res.json({ ok: true });
});

app.post("/api/auth/sign-up", async (req, res) => {
  if (!supabaseAuth) {
    return res.status(500).json({ error: "Account signup is not configured." });
  }

  try {
    checkRateLimit(
      authRateLimitByIp,
      `signup:${getClientIp(req)}`,
      15_000,
      "Too many signup attempts."
    );
  } catch (error) {
    return res.status(error.status || 429).json({
      error: error instanceof Error ? error.message : "Too many signup attempts.",
    });
  }

  const email = trimField(req.body?.email, 320);
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || "");

  if (!email || !username || !password) {
    return res.status(400).json({ error: "Email, username, and password are required." });
  }

  if (!isValidUsername(username)) {
    return res.status(400).json({
      error: "Username must be 3-32 characters using letters, numbers, dots, underscores, or dashes.",
    });
  }

  const { data, error } = await supabaseAuth.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${baseUrl}/account/`,
      data: {
        username,
      },
    },
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    await sendSignupDiscordAlert(data.user);
  } catch (alertError) {
    console.error(alertError);
  }

  if (data.session) {
    setAuthCookies(res, data.session);
  }

  return res.json({
    session: data.session
      ? {
          access_token: data.session.access_token,
          expires_at: data.session.expires_at,
          user: data.user,
        }
      : null,
    user: data.user,
  });
});

app.post("/api/auth/sign-in", async (req, res) => {
  if (!supabaseAuth) {
    return res.status(500).json({ error: "Account sign-in is not configured." });
  }

  try {
    checkRateLimit(
      authRateLimitByIp,
      `signin:${getClientIp(req)}`,
      3_000,
      "Too many sign-in attempts."
    );
  } catch (error) {
    return res.status(error.status || 429).json({
      error: error instanceof Error ? error.message : "Too many sign-in attempts.",
    });
  }

  const email = trimField(req.body?.email, 320);
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const { data, error } = await supabaseAuth.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return res.status(401).json({ error: error?.message || "Invalid login credentials." });
  }

  setAuthCookies(res, data.session);
  return res.json({
    session: {
      access_token: data.session.access_token,
      expires_at: data.session.expires_at,
      user: data.user,
    },
  });
});

app.get("/api/auth/session", async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Account sessions are not configured." });
  }

  const cookies = parseCookies(req);
  const accessToken = cookies[accessCookieName];
  const refreshToken = cookies[refreshCookieName];

  if (accessToken) {
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (!error && data.user) {
      return res.json({
        session: {
          access_token: accessToken,
          user: data.user,
        },
      });
    }
  }

  if (!refreshToken || !supabaseAuth) {
    clearAuthCookies(res);
    return res.json({ session: null });
  }

  const { data, error } = await supabaseAuth.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    clearAuthCookies(res);
    return res.json({ session: null });
  }

  setAuthCookies(res, data.session);
  return res.json({
    session: {
      access_token: data.session.access_token,
      expires_at: data.session.expires_at,
      user: data.user,
    },
  });
});

app.post("/api/auth/sign-out", (_req, res) => {
  clearAuthCookies(res);
  return res.json({ ok: true });
});

app.get("/api/products", async (_req, res) => {
  try {
    const keyCounts = await getUnusedLicenseKeyCounts();
    const catalog = products.map((product) => ({
      slug: product.slug,
      name: product.name,
      vendor: product.vendor,
      game: product.game,
      category: product.category,
      priceDisplay: product.priceDisplay,
      badge: product.badge,
      summary: product.summary,
      features: product.features,
      featureGroups: product.featureGroups || [],
      generalInfo: product.generalInfo || [],
      instructionHref: product.instructionHref || "",
      requirements: product.requirements || [],
      featured: product.featured,
      available: product.available !== false,
      variants: (product.variants || []).map((variant) => {
        const inventorySlug = getVariantInventorySlug(product, variant);
        const stockCount = keyCounts.get(inventorySlug) || 0;
        const hasKeys = stockCount > 0;
        const isExplicitlyBlocked = Boolean(product.checkoutBlocked || variant.checkoutBlocked);
        const stripePriceKey = variant.stripeEnvKey || "";
        const hasStripePrice = isConfiguredValue(process.env[stripePriceKey]);
        const checkoutReady = hasKeys && hasStripePrice && !isExplicitlyBlocked;
        const checkoutBlocked = isExplicitlyBlocked && hasKeys;

        return {
          slug: variant.slug,
          name: variant.name,
          stockLabel: formatKeyStockLabel(stockCount),
          priceDisplay: variant.priceDisplay,
          checkoutBlocked,
          checkoutError:
            variant.checkoutError ||
            product.checkoutError ||
            "Error occurred. Please open a ticket in Discord so support can help you with this item.",
          checkoutReady,
        };
      }),
      checkoutReady: false,
    }));

    res.json({ products: catalog });
  } catch (error) {
    res.status(500).json({
      error: "Unable to load products.",
    });
  }
});

app.post("/api/live-desk", async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({
      error: "Live desk is not configured yet. Add SUPABASE_SECRET_KEY in .env.",
    });
  }

  const clientIp = getClientIp(req);
  const now = Date.now();
  const lastOpenedAt = liveDeskCooldownByIp.get(clientIp) || 0;

  if (now - lastOpenedAt < liveDeskCooldownMs) {
    const secondsLeft = Math.ceil((liveDeskCooldownMs - (now - lastOpenedAt)) / 1000);

    return res.status(429).json({
      error: `Please wait ${secondsLeft} seconds before opening another desk request.`,
    });
  }

  const name = sanitizeInput(req.body?.name, 80);
  const contact = sanitizeInput(req.body?.contact, 140);
  const topic = sanitizeInput(req.body?.topic, 80);
  const details = sanitizeInput(req.body?.details, 900);
  const honey = trimField(req.body?.company, 80);

  if (honey) {
    return res.json({ ok: true });
  }

  if (!name || !contact || !topic || !details) {
    return res.status(400).json({
      error: "Name, contact, topic, and request details are all required.",
    });
  }

  try {
    const member = await getAuthenticatedUser(req);

    const threadInsert = await supabaseAdmin
      .from("support_threads")
      .insert({
        user_id: member.id,
        contact_name: name,
        contact_method: contact,
        subject: topic,
        status: "open",
        last_message_at: new Date().toISOString(),
      })
      .select(
        "id, subject, status, created_at, updated_at, last_message_at, contact_name, contact_method"
      )
      .single();

    if (threadInsert.error) {
      throw threadInsert.error;
    }

    const messageInsert = await supabaseAdmin
      .from("support_messages")
      .insert({
        thread_id: threadInsert.data.id,
        sender_type: "user",
        body: details,
      })
      .select("id, thread_id, sender_type, body, created_at")
      .single();

    if (messageInsert.error) {
      throw messageInsert.error;
    }

    await supabaseAdmin
      .from("support_threads")
      .update({
        updated_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
      })
      .eq("id", threadInsert.data.id);

    if (isConfiguredValue(discordWebhookUrl)) {
      try {
        const discordResponse = await sendLiveDeskDiscordAlert(
          threadInsert.data,
          messageInsert.data,
          member
        );

        if (discordResponse && discordResponse.ok === false) {
          console.error(`[Discord webhook] Live desk alert failed with status ${discordResponse.status}.`);
        }
      } catch (discordError) {
        console.error("[Discord webhook] Live desk alert error:", discordError.message);
      }
    }

    liveDeskCooldownByIp.set(clientIp, now);

    return res.json({
      ok: true,
      threadId: threadInsert.data.id,
      message: "Live desk request sent. You can track replies in your desk inbox.",
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: "Unable to send the live desk request.",
    });
  }
});

app.get("/api/live-desk/mine", async (req, res) => {
  try {
    const member = await getAuthenticatedUser(req);
    const threads = await loadSupportThreads(
      supabaseAdmin
        .from("support_threads")
        .select(
          "id, subject, status, created_at, updated_at, last_message_at, contact_name, contact_method"
        )
      .eq("user_id", member.id)
      .order("updated_at", { ascending: false })
    );

    return res.json({ threads });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: "Unable to load desk threads.",
    });
  }
});

app.post("/api/live-desk/reply", async (req, res) => {
  try {
    const member = await getAuthenticatedUser(req);
    const threadId = trimField(req.body?.threadId, 80);
    const body = sanitizeInput(req.body?.body, 900);

    if (!threadId || !body) {
      return res.status(400).json({
        error: "Thread and reply body are required.",
      });
    }

    const threadLookup = await supabaseAdmin
      .from("support_threads")
      .select(
        "id, user_id, subject, status, created_at, updated_at, last_message_at, contact_name, contact_method"
      )
      .eq("id", threadId)
      .eq("user_id", member.id)
      .maybeSingle();

    if (threadLookup.error) {
      throw threadLookup.error;
    }

    if (!threadLookup.data) {
      return res.status(404).json({
        error: "That support thread was not found on your account.",
      });
    }

    const messageInsert = await supabaseAdmin
      .from("support_messages")
      .insert({
        thread_id: threadId,
        sender_type: "user",
        body,
      })
      .select("id, thread_id, sender_type, body, created_at")
      .single();

    if (messageInsert.error) {
      throw messageInsert.error;
    }

    const threadUpdate = await supabaseAdmin
      .from("support_threads")
      .update({
        status: "open",
        updated_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
      })
      .eq("id", threadId)
      .eq("user_id", member.id)
      .select(
        "id, subject, status, created_at, updated_at, last_message_at, contact_name, contact_method"
      )
      .single();

    if (threadUpdate.error) {
      throw threadUpdate.error;
    }

    return res.json({
      ok: true,
      thread: {
        id: threadUpdate.data.id,
        subject: threadUpdate.data.subject,
        status: threadUpdate.data.status,
        createdAt: threadUpdate.data.created_at,
        updatedAt: threadUpdate.data.updated_at,
        lastMessageAt: threadUpdate.data.last_message_at,
        contactName: threadUpdate.data.contact_name,
        contactMethod: threadUpdate.data.contact_method,
      },
      message: {
        id: messageInsert.data.id,
        threadId: messageInsert.data.thread_id,
        senderType: messageInsert.data.sender_type,
        body: messageInsert.data.body,
        createdAt: messageInsert.data.created_at,
      },
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: "Unable to send your desk reply.",
    });
  }
});

app.post("/api/admin/access-request", async (req, res) => {
  try {
    checkRateLimit(
      adminAccessRateLimitByKey,
      `access:${getClientIp(req)}`,
      20_000,
      "Too many staff access requests."
    );
    ensureAdminAccess(req);
    const member = await getAuthenticatedUser(req);

    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Admin access storage is not configured." });
    }

    const discordUsername = sanitizeInput(req.body?.discordUsername, 80);
    const reason = sanitizeInput(req.body?.reason, 500);

    if (!discordUsername || !reason) {
      return res.status(400).json({
        error: "Discord username and reason are required.",
      });
    }

    const requestToken = createSecretToken(24);
    const staffToken = createSecretToken(32);
    const requestInsert = await supabaseAdmin
      .from("admin_access_requests")
      .insert({
        request_token_hash: hashToken(requestToken),
        staff_token_hash: hashToken(staffToken),
        user_id: member.id,
        user_email: member.email || "unknown",
        discord_username: discordUsername,
        reason,
        status: "pending",
        expires_at: new Date(Date.now() + staffAccessTtlMs).toISOString(),
        user_agent: trimField(req.headers["user-agent"], 300),
      })
      .select(
        "id, user_id, user_email, discord_username, reason, status, requested_at, approved_at, approved_by, denied_at, denied_by, expires_at, user_agent"
      )
      .single();

    if (requestInsert.error) {
      throw requestInsert.error;
    }

    await sendSecurityDiscordAlert("Admin desk access requested", [
      {
        name: "Signed-in email",
        value: member.email || "Unknown",
        inline: false,
      },
      {
        name: "Username",
        value: member.user_metadata?.username || "Not set",
        inline: true,
      },
      {
        name: "Discord",
        value: discordUsername,
        inline: true,
      },
      {
        name: "Reason",
        value: reason,
        inline: false,
      },
      {
        name: "Review",
        value: `${baseUrl}/requests/`,
        inline: false,
      },
    ]).catch((error) => console.error(error));

    return res.json({
      request: normalizeAccessRequest(requestInsert.data),
      requestToken,
      staffToken,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: "Unable to create access request.",
    });
  }
});

app.get("/api/admin/access-request/:requestId", async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Admin access storage is not configured." });
    }

    const requestId = trimField(req.params?.requestId, 80);
    const requestToken = trimField(req.query?.token, 200);

    if (!requestId || !requestToken) {
      return res.status(400).json({ error: "Access request and token are required." });
    }

    const requestResult = await supabaseAdmin
      .from("admin_access_requests")
      .select(
        "id, user_id, user_email, discord_username, reason, status, requested_at, approved_at, approved_by, denied_at, denied_by, expires_at, user_agent, request_token_hash"
      )
      .eq("id", requestId)
      .maybeSingle();

    if (requestResult.error) {
      throw requestResult.error;
    }

    if (!requestResult.data || requestResult.data.request_token_hash !== hashToken(requestToken)) {
      return res.status(404).json({ error: "Access request was not found." });
    }

    return res.json({ request: normalizeAccessRequest(requestResult.data) });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: "Unable to load access request.",
    });
  }
});

app.get("/api/admin/access-requests", async (req, res) => {
  try {
    await getAuthenticatedUser(req);
    ensureOwnerAccess(req);

    const [requestsResult, logsResult] = await Promise.all([
      supabaseAdmin
        .from("admin_access_requests")
        .select(
          "id, user_id, user_email, discord_username, reason, status, requested_at, approved_at, approved_by, denied_at, denied_by, expires_at, user_agent"
        )
        .order("requested_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("admin_audit_logs")
        .select(
          "id, action, target_type, target_id, actor_request_id, actor_discord_username, details, created_at, user_agent"
        )
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (requestsResult.error) {
      throw requestsResult.error;
    }

    if (logsResult.error) {
      throw logsResult.error;
    }

    return res.json({
      requests: (requestsResult.data || []).map((request) =>
        normalizeAccessRequest(request)
      ),
      auditLogs: (logsResult.data || []).map((log) => normalizeAuditLog(log)),
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: "Unable to load access requests.",
    });
  }
});

app.post("/api/admin/access-requests/:requestId/approve", async (req, res) => {
  try {
    await getAuthenticatedUser(req);
    ensureOwnerAccess(req);

    const requestId = trimField(req.params?.requestId, 80);
    const approvedBy = trimField(req.body?.approvedBy, 80) || "owner";
    const expiresAt = new Date(Date.now() + staffAccessTtlMs).toISOString();

    const updateResult = await supabaseAdmin
      .from("admin_access_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: approvedBy,
        denied_at: null,
        denied_by: null,
        expires_at: expiresAt,
      })
      .eq("id", requestId)
      .select(
        "id, user_id, user_email, discord_username, reason, status, requested_at, approved_at, approved_by, denied_at, denied_by, expires_at, user_agent"
      )
      .single();

    if (updateResult.error) {
      throw updateResult.error;
    }

    await insertAdminAuditLog(req, "approve_staff_access", "admin_access_request", requestId, {
      id: requestId,
      discordUsername: approvedBy,
    });

    return res.json({ request: normalizeAccessRequest(updateResult.data) });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: "Unable to approve request.",
    });
  }
});

app.post("/api/admin/access-requests/:requestId/deny", async (req, res) => {
  try {
    await getAuthenticatedUser(req);
    ensureOwnerAccess(req);

    const requestId = trimField(req.params?.requestId, 80);
    const deniedBy = trimField(req.body?.deniedBy, 80) || "owner";

    const updateResult = await supabaseAdmin
      .from("admin_access_requests")
      .update({
        status: "denied",
        denied_at: new Date().toISOString(),
        denied_by: deniedBy,
      })
      .eq("id", requestId)
      .select(
        "id, user_id, user_email, discord_username, reason, status, requested_at, approved_at, approved_by, denied_at, denied_by, expires_at, user_agent"
      )
      .single();

    if (updateResult.error) {
      throw updateResult.error;
    }

    await insertAdminAuditLog(req, "deny_staff_access", "admin_access_request", requestId, {
      id: requestId,
      discordUsername: deniedBy,
    });

    return res.json({ request: normalizeAccessRequest(updateResult.data) });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: "Unable to deny request.",
    });
  }
});

app.delete("/api/admin/access-requests/:requestId", async (req, res) => {
  try {
    await getAuthenticatedUser(req);
    ensureOwnerAccess(req);

    const requestId = trimField(req.params?.requestId, 80);
    const deletedBy = trimField(req.body?.deletedBy, 80) || "owner";

    if (!requestId) {
      return res.status(400).json({ error: "Access request is required." });
    }

    const requestLookup = await supabaseAdmin
      .from("admin_access_requests")
      .select("id, discord_username, reason, status")
      .eq("id", requestId)
      .maybeSingle();

    if (requestLookup.error) {
      throw requestLookup.error;
    }

    if (!requestLookup.data) {
      return res.status(404).json({ error: "Access request was not found." });
    }

    await insertAdminAuditLog(
      req,
      "delete_staff_access_request",
      "admin_access_request",
      requestId,
      {
        id: requestId,
        discordUsername: deletedBy,
      },
      {
        deletedRequest: requestLookup.data,
      }
    );

    const deleteResult = await supabaseAdmin
      .from("admin_access_requests")
      .delete()
      .eq("id", requestId);

    if (deleteResult.error) {
      throw deleteResult.error;
    }

    return res.json({ ok: true });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: "Unable to delete access request.",
    });
  }
});

app.get("/api/admin/visitors", async (req, res) => {
  try {
    await getAuthenticatedUser(req);
    ensureOwnerAccess(req);
    pruneVisitorSessions();

    const pages = Array.from(visitorSessions.values()).reduce((summary, session) => {
      summary[session.pagePath] = (summary[session.pagePath] || 0) + 1;
      return summary;
    }, {});

    const pageBreakdown = Object.entries(pages)
      .map(([pagePath, count]) => ({ pagePath, count }))
      .sort((left, right) => right.count - left.count || left.pagePath.localeCompare(right.pagePath));

    return res.json({
      activeVisitors: visitorSessions.size,
      activeWindowSeconds: Math.round(visitorHeartbeatTtlMs / 1000),
      pages: pageBreakdown,
      recentViews: recentVisitorViews.slice(0, 40),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: "Unable to load panel.",
    });
  }
});

app.get("/api/admin/users", async (req, res) => {
  try {
    await getAuthenticatedUser(req);
    ensureOwnerAccess(req);

    if (!supabaseAdmin) {
      return res.status(500).json({ error: "User directory is not configured." });
    }

    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 100,
    });

    if (error) {
      throw error;
    }

    const users = (data.users || []).map((user) => ({
      id: user.id,
      email: user.email,
      username: user.user_metadata?.username || "",
      createdAt: user.created_at,
      emailConfirmedAt: user.email_confirmed_at,
    }));

    return res.json({ users });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: "Unable to load users.",
    });
  }
});

app.get("/api/admin/live-desk", async (req, res) => {
  try {
    // Allow either staff token OR owner cookie
    let authorized = false;
    try { ensureOwnerAccess(req); authorized = true; } catch {}
    if (!authorized) {
      await getApprovedStaffAccess(req);
    }

    const threads = await loadSupportThreads(
      supabaseAdmin
        .from("support_threads")
        .select(
          "id, subject, status, created_at, updated_at, last_message_at, contact_name, contact_method"
        )
        .order("updated_at", { ascending: false })
        .limit(50)
    );

    return res.json({ threads });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: "Unable to load admin desk threads.",
    });
  }
});

app.post("/api/admin/live-desk/reply", async (req, res) => {
  try {
    // Allow either staff token OR owner cookie
    let staffAccess = null;
    let isOwner = false;
    try { ensureOwnerAccess(req); isOwner = true; } catch {}
    if (!isOwner) {
      staffAccess = await getApprovedStaffAccess(req);
    }

    const threadId = trimField(req.body?.threadId, 80);
    const body = sanitizeInput(req.body?.body, 900);
    const status = trimField(req.body?.status, 24) || "pending";

    if (!threadId || !body) {
      return res.status(400).json({
        error: "Thread and reply body are required.",
      });
    }

    const messageInsert = await supabaseAdmin
      .from("support_messages")
      .insert({
        thread_id: threadId,
        sender_type: "admin",
        body,
      })
      .select("id, thread_id, sender_type, body, created_at")
      .single();

    if (messageInsert.error) {
      throw messageInsert.error;
    }

    const threadUpdate = await supabaseAdmin
      .from("support_threads")
      .update({
        status,
        updated_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
      })
      .eq("id", threadId)
      .select(
        "id, subject, status, created_at, updated_at, last_message_at, contact_name, contact_method"
      )
      .single();

    if (threadUpdate.error) {
      throw threadUpdate.error;
    }

    if (staffAccess) {
      await insertAdminAuditLog(req, "reply_ticket", "support_thread", threadId, staffAccess, {
        status,
      });
    }

    return res.json({
      ok: true,
      thread: {
        id: threadUpdate.data.id,
        subject: threadUpdate.data.subject,
        status: threadUpdate.data.status,
        createdAt: threadUpdate.data.created_at,
        updatedAt: threadUpdate.data.updated_at,
        lastMessageAt: threadUpdate.data.last_message_at,
        contactName: threadUpdate.data.contact_name,
        contactMethod: threadUpdate.data.contact_method,
      },
      message: {
        id: messageInsert.data.id,
        threadId: messageInsert.data.thread_id,
        senderType: messageInsert.data.sender_type,
        body: messageInsert.data.body,
        createdAt: messageInsert.data.created_at,
      },
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: "Unable to send the admin reply.",
    });
  }
});

app.post("/api/admin/live-desk/:threadId/request-delete-key", async (req, res) => {
  try {
    let staffAccess;
    let authorized = false;
    try { ensureOwnerAccess(req); authorized = true; } catch {}
    if (!authorized) { staffAccess = await getApprovedStaffAccess(req); }
    const threadId = trimField(req.params?.threadId, 80);

    checkRateLimit(
      deleteKeyRateLimitByKey,
      `delete-key:${staffAccess?.id || "owner"}:${threadId}`,
      60_000,
      "Too many delete key requests for this ticket."
    );

    if (!threadId) {
      return res.status(400).json({
        error: "Thread is required.",
      });
    }

    const threadLookup = await supabaseAdmin
      .from("support_threads")
      .select("id, subject, contact_name, contact_method")
      .eq("id", threadId)
      .maybeSingle();

    if (threadLookup.error) {
      throw threadLookup.error;
    }

    if (!threadLookup.data) {
      return res.status(404).json({
        error: "That support thread was not found.",
      });
    }

    const deleteKey = createOneTimeDeleteKey();
    const expiresAt = new Date(Date.now() + deleteApprovalTtlMs).toISOString();
    const approvalInsert = await supabaseAdmin
      .from("admin_delete_approvals")
      .insert({
        thread_id: threadId,
        staff_request_id: staffAccess?.id || null,
        staff_discord_username: staffAccess?.discordUsername || "owner",
        token_hash: hashToken(deleteKey),
        status: "pending",
        expires_at: expiresAt,
        user_agent: trimField(req.headers["user-agent"], 300),
      })
      .select("id")
      .single();

    if (approvalInsert.error) {
      throw approvalInsert.error;
    }

    await insertAdminAuditLog(
      req,
      "request_ticket_delete_key",
      "support_thread",
      threadId,
      staffAccess || { id: null, discordUsername: "owner" },
      {
        deleteApprovalId: approvalInsert.data.id,
        expiresAt,
      }
    );

    await sendSecurityDiscordAlert("Ticket delete key requested", [
      {
        name: "Staff",
        value: staffAccess?.discordUsername || "owner",
        inline: true,
      },
      {
        name: "Ticket",
        value: `${threadLookup.data.subject || "Unknown"} (${threadId})`,
        inline: false,
      },
      {
        name: "One-time delete key",
        value: deleteKey,
        inline: false,
      },
      {
        name: "Expires",
        value: new Date(expiresAt).toLocaleString("en-US", {
          timeZone: "America/Chicago",
        }),
        inline: true,
      },
    ]).catch((error) => console.error(error));

    return res.json({
      ok: true,
      expiresAt,
      message: "Delete key requested. Ask the owner for the one-time key from Discord.",
    });
  } catch (error) {
    console.error("request-delete-key error:", error);
    return res.status(error.status || 500).json({
      error: "Unable to request a delete key.",
    });
  }
});

app.post("/api/admin/live-desk/:threadId/confirm-delete", async (req, res) => {
  try {
    let staffAccess;
    let authorized = false;
    try { ensureOwnerAccess(req); authorized = true; } catch {}
    if (!authorized) { staffAccess = await getApprovedStaffAccess(req); }
    const threadId = trimField(req.params?.threadId, 80);
    const deleteKey = trimField(req.body?.deleteKey, 80).replace(/\s+/g, "").toUpperCase();

    if (!threadId || !deleteKey) {
      return res.status(400).json({
        error: "Thread and delete key are required.",
      });
    }

    const threadLookup = await supabaseAdmin
      .from("support_threads")
      .select("id")
      .eq("id", threadId)
      .maybeSingle();

    if (threadLookup.error) {
      throw threadLookup.error;
    }

    if (!threadLookup.data) {
      return res.status(404).json({
        error: "That support thread was not found.",
      });
    }

    const approvalLookup = await supabaseAdmin
      .from("admin_delete_approvals")
      .select("id, expires_at, status")
      .eq("thread_id", threadId)
      .eq("token_hash", hashToken(deleteKey))
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (approvalLookup.error) {
      throw approvalLookup.error;
    }

    if (!approvalLookup.data) {
      return res.status(401).json({
        error: "Invalid delete key for this ticket.",
      });
    }

    if (new Date(approvalLookup.data.expires_at).getTime() <= Date.now()) {
      await supabaseAdmin
        .from("admin_delete_approvals")
        .update({ status: "expired" })
        .eq("id", approvalLookup.data.id);

      return res.status(401).json({
        error: "Delete key expired. Request a new one.",
      });
    }

    const messagesDelete = await supabaseAdmin
      .from("support_messages")
      .delete()
      .eq("thread_id", threadId);

    if (messagesDelete.error) {
      throw messagesDelete.error;
    }

    const threadDelete = await supabaseAdmin
      .from("support_threads")
      .delete()
      .eq("id", threadId);

    if (threadDelete.error) {
      throw threadDelete.error;
    }

    const approvalUpdate = await supabaseAdmin
      .from("admin_delete_approvals")
      .update({
        status: "used",
        used_at: new Date().toISOString(),
      })
      .eq("id", approvalLookup.data.id);

    if (approvalUpdate.error) {
      throw approvalUpdate.error;
    }

    await insertAdminAuditLog(req, "delete_ticket", "support_thread", threadId, staffAccess || { id: null, discordUsername: "owner" }, {
      threadId,
      deleteApprovalId: approvalLookup.data.id,
    });

    return res.json({ ok: true });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: "Unable to delete the ticket.",
    });
  }
});

/* ── Admin: look up any order by ID ── */
app.get("/api/admin/orders/:orderId", async (req, res) => {
  try {
    ensureOwnerAccess(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  try {
    const { orderId } = req.params;

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ error: "Order not found." });
    }

    // Get the user info
    let user = null;
    if (order.user_id) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(order.user_id);
      if (userData?.user) {
        user = {
          id: userData.user.id,
          email: userData.user.email,
          username: userData.user.user_metadata?.username || null,
        };
      }
    }

    // Get the assigned key (if any)
    const { data: keyData } = await supabaseAdmin
      .from("license_keys")
      .select("id, product_slug, key_value, status, assigned_at")
      .eq("assigned_order_id", orderId);

    const catalogItem = getCatalogItemByInventorySlug(order.product_slug);

    res.json({
      order: {
        id: order.id,
        productSlug: order.product_slug,
        productName: catalogItem?.name || order.product_slug,
        status: order.status,
        createdAt: order.created_at,
        fulfilledAt: order.fulfilled_at,
        deliveredKeyValue: order.delivered_key_value || null,
        stripeSessionId: order.stripe_session_id || null,
        stripePaymentIntent: order.stripe_payment_intent || null,
      },
      user,
      assignedKeys: (keyData || []).map((k) => ({
        id: k.id,
        keyValue: k.key_value,
        status: k.status,
        assignedAt: k.assigned_at,
      })),
    });
  } catch (error) {
    res.status(500).json({
      error: "Unable to look up order.",
    });
  }
});

/* ── Admin: list recent orders ── */
app.get("/api/admin/orders", async (req, res) => {
  try {
    ensureOwnerAccess(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const statusFilter = req.query.status || null;

    let query = supabaseAdmin
      .from("orders")
      .select("id, product_slug, user_id, status, created_at, fulfilled_at, delivered_key_value")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) throw error;

    const orders = (data || []).map((order) => {
      const catalogItem = getCatalogItemByInventorySlug(order.product_slug);
      return {
        id: order.id,
        productSlug: order.product_slug,
        productName: catalogItem?.name || order.product_slug,
        userId: order.user_id,
        status: order.status,
        createdAt: order.created_at,
        fulfilledAt: order.fulfilled_at,
        hasKey: Boolean(order.delivered_key_value),
      };
    });

    res.json({ orders });
  } catch (error) {
    res.status(500).json({
      error: "Unable to list orders.",
    });
  }
});

/* ── Admin: key inventory ── */
app.get("/api/admin/keys", async (req, res) => {
  try {
    ensureOwnerAccess(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  try {
    const statusFilter = req.query.status || null;
    const productFilter = req.query.product || null;

    let query = supabaseAdmin
      .from("license_keys")
      .select("id, product_slug, key_value, status, assigned_user_id, assigned_order_id, assigned_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (statusFilter) query = query.eq("status", statusFilter);
    if (productFilter) query = query.eq("product_slug", productFilter);

    const { data, error } = await query;
    if (error) throw error;

    const keys = (data || []).map((k) => {
      const catalogItem = getCatalogItemByInventorySlug(k.product_slug);
      return {
        id: k.id,
        productSlug: k.product_slug,
        productName: catalogItem?.name || k.product_slug,
        keyValue: k.key_value,
        status: k.status,
        assignedUserId: k.assigned_user_id,
        assignedOrderId: k.assigned_order_id,
        assignedAt: k.assigned_at,
        createdAt: k.created_at,
      };
    });

    // Summary counts
    const summary = { total: keys.length, unused: 0, assigned: 0 };
    for (const k of keys) {
      if (k.status === "unused") summary.unused++;
      else if (k.status === "assigned") summary.assigned++;
    }

    res.json({ keys, summary });
  } catch (error) {
    res.status(500).json({
      error: "Unable to list keys.",
    });
  }
});

app.get("/api/account", async (req, res) => {
  try {
    const member = await getAuthenticatedUser(req);

    const orderSeedResult = await supabaseAdmin
      .from("orders")
      .select(
        "id, product_slug, status, created_at, fulfilled_at, stripe_session_id, stripe_payment_intent"
      )
      .eq("user_id", member.id)
      .order("created_at", { ascending: false });

    if (orderSeedResult.error) {
      throw orderSeedResult.error;
    }

    const paidOrders = (orderSeedResult.data || []).filter((order) => order.status === "paid");

    await Promise.all(
      paidOrders.map((order) =>
        syncPaidOrder({
          id: order.stripe_session_id || null,
          payment_intent: order.stripe_payment_intent || null,
          metadata: {
            orderId: order.id,
          },
        }).catch((error) => {
          console.error("Unable to retry fulfillment for order", order.id, error);
        })
      )
    );

    const [ordersResult, keysResult] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id, product_slug, status, created_at, fulfilled_at, delivered_key_value")
        .eq("user_id", member.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("license_keys")
        .select("id, product_slug, key_value, status, assigned_at, assigned_order_id")
        .eq("assigned_user_id", member.id)
        .order("assigned_at", { ascending: false }),
    ]);

    if (ordersResult.error) {
      throw ordersResult.error;
    }

    if (keysResult.error) {
      throw keysResult.error;
    }

    // Build a quick order lookup for linking keys to orders
    const orderMap = new Map();
    for (const o of ordersResult.data || []) {
      orderMap.set(o.id, o);
    }

    // Build license keys from both license_keys table AND order-level delivered keys
    const keysFromTable = (keysResult.data || []).map((licenseKey) => {
      const catalogItem = getCatalogItemByInventorySlug(licenseKey.product_slug);
      const linkedOrder = licenseKey.assigned_order_id
        ? orderMap.get(licenseKey.assigned_order_id)
        : null;
      return {
        id: licenseKey.id,
        productSlug: licenseKey.product_slug,
        productName: catalogItem?.name || licenseKey.product_slug,
        keyValue: licenseKey.key_value,
        assignedAt: licenseKey.assigned_at,
        status: licenseKey.status,
        orderId: licenseKey.assigned_order_id || null,
        orderStatus: linkedOrder?.status || null,
        fulfilledAt: linkedOrder?.fulfilled_at || null,
      };
    });

    // Add keys from fulfilled orders that have delivered_key_value (covers sandbox mode)
    const orderDeliveredKeys = (ordersResult.data || [])
      .filter((o) => o.delivered_key_value && o.status === "fulfilled")
      .map((o) => {
        const catalogItem = getCatalogItemByInventorySlug(o.product_slug);
        return {
          id: o.id,
          productSlug: o.product_slug,
          productName: catalogItem?.name || o.product_slug,
          keyValue: o.delivered_key_value,
          assignedAt: o.fulfilled_at,
          status: "assigned",
          orderId: o.id,
          orderStatus: o.status,
          fulfilledAt: o.fulfilled_at,
        };
      });

    // Merge: use table keys if available, otherwise use order-delivered keys
    const allKeyValues = new Set(keysFromTable.map((k) => k.keyValue));
    const mergedKeys = [
      ...keysFromTable,
      ...orderDeliveredKeys.filter((k) => !allKeyValues.has(k.keyValue)),
    ];

    res.json({
      user: {
        id: member.id,
        email: member.email,
      },
      orders: (ordersResult.data || []).map(normalizeOrder),
      licenseKeys: mergedKeys,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: "Unable to load account.",
    });
  }
});

app.post("/api/reseller/buy", async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({
      success: false,
      error: "Supabase server auth is not configured.",
    });
  }

  try {
    ensureResellerApiAccess(req);
  } catch (error) {
    return res.status(error.status || 401).json({
      success: false,
      error: error instanceof Error ? error.message : "API access denied.",
    });
  }

  const selection = getResellerProductSelection(req.body);
  const quantity = normalizeApiQuantity(req.body?.quantity);

  if (!selection) {
    return res.status(404).json({
      success: false,
      error: "Product variant not found.",
    });
  }

  if (selection.product.available === false) {
    return res.status(409).json({
      success: false,
      error: "This product is currently unavailable.",
    });
  }

  try {
    const { data: availableKeys, error: availableKeyError } = await supabaseAdmin
      .from("license_keys")
      .select("id, key_value")
      .eq("product_slug", selection.inventorySlug)
      .eq("status", "unused")
      .order("created_at", { ascending: true })
      .limit(quantity);

    if (availableKeyError) {
      throw availableKeyError;
    }

    if ((availableKeys || []).length < quantity) {
      return res.json({
        success: false,
        error: "Out of stock.",
        product_slug: selection.inventorySlug,
        available: (availableKeys || []).length,
      });
    }

    const assignedAt = new Date().toISOString();
    const keyIds = availableKeys.map((key) => key.id);
    const { data: assignedKeys, error: assignError } = await supabaseAdmin
      .from("license_keys")
      .update({
        status: "assigned",
        assigned_at: assignedAt,
      })
      .in("id", keyIds)
      .eq("status", "unused")
      .select("id, key_value");

    if (assignError) {
      throw assignError;
    }

    if ((assignedKeys || []).length < quantity) {
      return res.json({
        success: false,
        error: "Stock changed while processing. Try again.",
      });
    }

    return res.json({
      success: true,
      order_number: createApiOrderNumber(),
      product_slug: selection.inventorySlug,
      product_name: selection.name,
      quantity,
      license_key: assignedKeys[0]?.key_value || null,
      license_keys: assignedKeys.map((key) => key.key_value),
      amount_cents: (selection.variant.amount || 0) * quantity,
      fulfilled_at: assignedAt,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Unable to complete reseller API order.",
    });
  }
});

/* ── Verify checkout and deliver key on success page ── */
app.get("/api/checkout/complete", authLimiter, async (req, res) => {
  try {
    const member = await getAuthenticatedUser(req);
    const sessionId = req.query.session_id;

    if (!sessionId) {
      return res.status(400).json({ error: "Missing session_id." });
    }

    // Retrieve the Stripe session to verify payment
    const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);

    if (stripeSession.payment_status !== "paid") {
      return res.status(402).json({ error: "Payment not completed." });
    }

    // Find the order
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, product_slug, status, fulfilled_at, stripe_session_id")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return res.status(404).json({ error: "Order not found." });
    if (order.user_id !== member.id) return res.status(403).json({ error: "Unauthorized." });

    // If still pending/paid, fulfill now
    let syncResult = null;
    if (order.status === "pending" || order.status === "paid") {
      syncResult = await syncPaidOrder(stripeSession);
    }

    // Fetch the fulfilled order (delivered_key_value persists even in sandbox mode)
    const { data: updatedOrder, error: updatedOrderError } = await supabaseAdmin
      .from("orders")
      .select("id, product_slug, status, fulfilled_at, delivered_key_value")
      .eq("id", order.id)
      .single();

    if (updatedOrderError) throw updatedOrderError;

    const catalogItem = getCatalogItemByInventorySlug(order.product_slug);
    // Priority: order's delivered_key_value > syncResult > license_keys table
    const keyValue = updatedOrder.delivered_key_value || syncResult?.keyValue || null;
    const keys = keyValue ? [keyValue] : [];

    res.json({
      orderId: order.id,
      productName: catalogItem?.name || order.product_slug,
      status: updatedOrder.status || order.status,
      fulfilledAt: updatedOrder.fulfilled_at || null,
      keys: keys.map((k) => k.key_value),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: "Unable to verify checkout.",
    });
  }
});

app.post("/api/create-checkout-session", async (req, res) => {
  /* ── Purchases disabled: button still visible but checkout silently fails ── */
  if (process.env.PURCHASES_DISABLED === "true") {
    return res.status(503).json({ error: "Purchases are temporarily unavailable. Please try again later." });
  }

  if (!stripe) {
    return res.status(500).json({
      error:
        "Stripe is not configured yet. Add STRIPE_SECRET_KEY and the STRIPE_PRICE_* values.",
    });
  }

  let member;

  try {
    member = await getAuthenticatedUser(req);
  } catch (error) {
    return res.status(error.status || 500).json({
      error:
        error instanceof Error ? error.message : "Unable to verify your member session.",
    });
  }

  const { productSlug, variantSlug } = req.body ?? {};

  const selection = getProductSelection(productSlug, variantSlug);

  if (!selection) {
    return res.status(404).json({ error: "Product variant not found." });
  }

  if (selection.product.available === false) {
    return res.status(409).json({ error: "This product is currently unavailable." });
  }

  if (selection.product.checkoutBlocked || selection.variant.checkoutBlocked) {
    return res.status(409).json({
      error:
        selection.variant.checkoutError ||
        selection.product.checkoutError ||
        "Error occurred. Please open a ticket in Discord so support can help you with this item.",
    });
  }

  const stripePriceId = process.env[selection.variant.stripeEnvKey];

  if (!isConfiguredValue(stripePriceId)) {
    return res.status(500).json({
      error: `Missing ${selection.variant.stripeEnvKey}. Add your Stripe Price ID in .env.`,
    });
  }

  try {
    if (!supabaseAdmin) {
      return res.status(500).json({
        error: "Supabase server auth is not configured. Add SUPABASE_SECRET_KEY in .env.",
      });
    }

    const { data: order, error: orderInsertError } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: member.id,
        product_slug: selection.inventorySlug,
        status: "pending",
      })
      .select("id")
      .single();

    if (orderInsertError) {
      throw orderInsertError;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: stripePriceId, quantity: 1 }],
      customer_email: member.email || undefined,
      payment_intent_data: {
        receipt_email: member.email || undefined,
      },
      success_url: `${baseUrl}/checkout/success/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout/cancel/`,
      metadata: {
        orderId: order.id,
        productSlug: selection.product.slug,
        variantSlug: selection.variant.slug,
        inventorySlug: selection.inventorySlug,
        userId: member.id,
      },
    });

    const { error: orderUpdateError } = await supabaseAdmin
      .from("orders")
      .update({
        stripe_session_id: session.id,
      })
      .eq("id", order.id);

    if (orderUpdateError) {
      throw orderUpdateError;
    }

    return res.json({ url: session.url });
  } catch (error) {
    return res.status(500).json({
      error: "Unable to create checkout session.",
    });
  }
});

/* ── Reviews: Groq AI moderation ── */

async function moderateReviewWithAI(reviewText, productName, rating) {
  if (!groqApiKey) {
    return { approved: true, reason: null };
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `You are a review moderator for an online gaming software store. Decide if a product review is legitimate or should be rejected. Reject reviews that are: trolling, spam, completely irrelevant to the product, contain hate speech, threats, or personal attacks, are gibberish or random characters, or are clearly fake. Accept reviews that express genuine opinions about the product even if negative. Respond with ONLY valid JSON: {"approved": true} or {"approved": false, "reason": "brief reason"}`,
          },
          {
            role: "user",
            content: `Product: "${productName}"\nRating: ${rating}/5\nReview: "${reviewText}"`,
          },
        ],
        temperature: 0.1,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      console.error("Groq API error:", response.status);
      return { approved: true, reason: null };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(content);
    return {
      approved: Boolean(parsed.approved),
      reason: parsed.reason || null,
    };
  } catch (error) {
    console.error("Groq moderation error:", error);
    return { approved: true, reason: null };
  }
}

/* ── Reviews: public approved reviews ── */
app.get("/api/reviews", async (_req, res) => {
  try {
    const result = await supabaseAdmin
      .from("reviews")
      .select("id, product_slug, rating, review_text, created_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(100);

    if (result.error) throw result.error;

    return res.json({ reviews: result.data || [] });
  } catch (error) {
    return res.status(500).json({ error: "Unable to load reviews." });
  }
});

/* ── Reviews: user's reviewable purchases ── */
app.get("/api/reviews/my-purchases", async (req, res) => {
  try {
    const member = await getAuthenticatedUser(req);

    const ordersResult = await supabaseAdmin
      .from("orders")
      .select("id, product_slug, status, created_at")
      .eq("user_id", member.id)
      .eq("status", "fulfilled")
      .order("created_at", { ascending: false });

    if (ordersResult.error) throw ordersResult.error;

    const reviewsResult = await supabaseAdmin
      .from("reviews")
      .select("order_id, status, ai_rejection_reason")
      .eq("user_id", member.id);

    if (reviewsResult.error) throw reviewsResult.error;

    const reviewMap = new Map();
    for (const r of reviewsResult.data || []) {
      reviewMap.set(r.order_id, r);
    }

    const purchases = (ordersResult.data || []).map((order) => {
      const product = products.find((p) =>
        p.variants.some((v) => v.inventorySlug === order.product_slug)
      );
      const variant = product?.variants.find((v) => v.inventorySlug === order.product_slug);
      const existing = reviewMap.get(order.id);

      return {
        orderId: order.id,
        productSlug: order.product_slug,
        productName: product?.name || order.product_slug,
        variantName: variant?.name || "",
        purchasedAt: order.created_at,
        reviewStatus: existing?.status || null,
        rejectionReason: existing?.ai_rejection_reason || null,
      };
    });

    return res.json({ purchases });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: "Unable to load purchases.",
    });
  }
});

/* ── Reviews: submit a review ── */
app.post("/api/reviews", async (req, res) => {
  try {
    const member = await getAuthenticatedUser(req);
    const orderId = trimField(req.body?.orderId, 80);
    const rating = parseInt(req.body?.rating, 10);
    const reviewText = sanitizeInput(req.body?.reviewText, 1000);

    if (!orderId || !rating || !reviewText) {
      return res.status(400).json({ error: "Order, rating, and review text are required." });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5." });
    }

    if (reviewText.length < 10) {
      return res.status(400).json({ error: "Review must be at least 10 characters." });
    }

    const orderCheck = await supabaseAdmin
      .from("orders")
      .select("id, product_slug, status")
      .eq("id", orderId)
      .eq("user_id", member.id)
      .eq("status", "fulfilled")
      .maybeSingle();

    if (orderCheck.error) throw orderCheck.error;

    if (!orderCheck.data) {
      return res.status(403).json({ error: "You can only review products you have purchased." });
    }

    const existingReview = await supabaseAdmin
      .from("reviews")
      .select("id, status")
      .eq("user_id", member.id)
      .eq("order_id", orderId)
      .maybeSingle();

    if (existingReview.data && existingReview.data.status === "approved") {
      return res.status(409).json({ error: "You have already reviewed this purchase." });
    }

    const product = products.find((p) =>
      p.variants.some((v) => v.inventorySlug === orderCheck.data.product_slug)
    );
    const productName = product?.name || orderCheck.data.product_slug;

    const moderation = await moderateReviewWithAI(reviewText, productName, rating);

    const reviewData = {
      user_id: member.id,
      order_id: orderId,
      product_slug: orderCheck.data.product_slug,
      rating,
      review_text: reviewText,
      ai_approved: moderation.approved,
      ai_rejection_reason: moderation.reason,
      status: moderation.approved ? "approved" : "rejected",
    };

    if (existingReview.data) {
      const update = await supabaseAdmin
        .from("reviews")
        .update(reviewData)
        .eq("id", existingReview.data.id);
      if (update.error) throw update.error;
    } else {
      const insert = await supabaseAdmin.from("reviews").insert(reviewData);
      if (insert.error) throw insert.error;
    }

    if (!moderation.approved) {
      return res.status(422).json({
        error: "Your review was not approved by our moderation system.",
        reason: moderation.reason || "Review did not meet our guidelines.",
      });
    }

    return res.json({ ok: true, message: "Review submitted and approved." });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: "Unable to submit review.",
    });
  }
});

app.use(express.static(distDir));

const pageRoutes = new Map([
  ["/", "index.html"],
  ["/products", "products/index.html"],
  ["/account", "account/index.html"],
  ["/status", "status/index.html"],
  ["/terms", "terms/index.html"],
  ["/desk", "desk/index.html"],
  ["/desk-admin", "desk-admin/index.html"],
  ["/requests", "requests/index.html"],
  ["/analytics", "analytics/index.html"],
  ["/users", "users/index.html"],
  ["/checkout/success", "checkout/success/index.html"],
  ["/checkout/cancel", "checkout/cancel/index.html"],
  ["/reviews", "reviews/index.html"],
]);

pageRoutes.forEach((relativePath, route) => {
  const routes = route === "/" ? [route] : [route, `${route}/`];

  app.get(routes, (_req, res) => {
    res.sendFile(path.join(distDir, relativePath));
  });
});

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
