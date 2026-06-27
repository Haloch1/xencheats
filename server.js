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
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
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
const discordBotToken = process.env.DISCORD_BOT_TOKEN || "";
const discordClientId = process.env.DISCORD_CLIENT_ID || "";
const discordClientSecret = process.env.DISCORD_CLIENT_SECRET || "";
const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const discordGuildId = process.env.DISCORD_GUILD_ID || "";
const discordCustomerRoleId = process.env.DISCORD_CUSTOMER_ROLE_ID || "";
const discordRestockChannelId = process.env.DISCORD_RESTOCK_CHANNEL_ID || "";
const discordReviewChannelId = process.env.DISCORD_REVIEW_CHANNEL_ID || "1517988360956809297";
const discordVerifiedRoleId = process.env.DISCORD_VERIFIED_ROLE_ID || "";
const discordUnverifiedRoleId = process.env.DISCORD_UNVERIFIED_ROLE_ID || "";
const OWNER_ID = "1327675126338293921";
const BOT_ADMINS = [OWNER_ID, "1191199172448239639"];
const nowpaymentsApiKey = process.env.NOWPAYMENTS_API_KEY || "";
const nowpaymentsIpnKey = process.env.NOWPAYMENTS_IPN_KEY || "";
const discordLowStockChannelId = "1517987031723282607";
const liveDeskCooldownMs = 45_000;
const liveDeskCooldownByIp = new Map();
const signupIpMap = new Map(); // IP -> [userId, ...]  (rolling fraud check, not persisted)
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
      maxAge: 60 * 60 * 24 * 30,  // 30 days – refresh will rotate the token
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

async function getAuthenticatedUser(req, res) {
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
        // Send refreshed cookies back so the browser stays logged in
        if (refreshResult.data.session) {
          setAuthCookies(res, refreshResult.data.session);
        }
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
    const user = await getAuthenticatedUser(req, res);
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

  const member = await getAuthenticatedUser(req, res);
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

/* ── Discord bot client ── */
let discordBot = null;

if (isConfiguredValue(discordBotToken)) {
  discordBot = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  discordBot.once("ready", async () => {
    console.log(`[Discord] Bot logged in as ${discordBot.user.tag}`);

    // Set bot activity and bio
    discordBot.user.setPresence({
      activities: [{ name: "halocheats.cc", type: 0 }], // type 0 = Playing
      status: "online",
    });

    // Set bot bio (About Me) via API
    fetch("https://discord.com/api/v10/applications/@me", {
      method: "PATCH",
      headers: {
        Authorization: `Bot ${discordBotToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        description: "/key - View your active license keys\n/stock - Check product stock\n\nhalocheats.cc",
      }),
    }).catch((err) => console.error("[Discord] Bio update failed:", err.message));

    // Register slash commands
    try {
      const rest = new REST({ version: "10" }).setToken(discordBotToken);
      const commands = [
        new SlashCommandBuilder()
          .setName("key")
          .setDescription("View your active license keys from Halo Cheats"),
        new SlashCommandBuilder()
          .setName("stock")
          .setDescription("Check product availability and stock"),
        new SlashCommandBuilder()
          .setName("revenue")
          .setDescription("View revenue stats (owner only)"),
        new SlashCommandBuilder()
          .setName("addkey")
          .setDescription("Add a key to inventory (owner only)")
          .addStringOption(o => o.setName("product").setDescription("Product name").setRequired(true).setAutocomplete(true))
          .addStringOption(o => o.setName("duration").setDescription("Key duration").setRequired(true).setAutocomplete(true))
          .addStringOption(o => o.setName("key").setDescription("License key value").setRequired(true)),
        new SlashCommandBuilder()
          .setName("keys")
          .setDescription("List all unused keys (owner only)"),
        new SlashCommandBuilder()
          .setName("usekey")
          .setDescription("Mark a key as used (owner only)")
          .addStringOption(o => o.setName("key").setDescription("The key value to mark as used").setRequired(true)),
        new SlashCommandBuilder()
          .setName("lookup")
          .setDescription("Look up a user's info (owner only)")
          .addUserOption(o => o.setName("user").setDescription("Discord user to look up").setRequired(true)),
        new SlashCommandBuilder()
          .setName("ban")
          .setDescription("Ban a user from the server (owner only)")
          .addUserOption(o => o.setName("user").setDescription("User to ban").setRequired(true))
          .addStringOption(o => o.setName("reason").setDescription("Ban reason").setRequired(false)),
        new SlashCommandBuilder()
          .setName("say")
          .setDescription("Make the bot say something (owner only)")
          .addStringOption(o => o.setName("message").setDescription("Message to send").setRequired(true))
          .addChannelOption(o => o.setName("channel").setDescription("Channel to send in (default: current)").setRequired(false)),
        new SlashCommandBuilder()
          .setName("reinvite-all")
          .setDescription("Re-invite all authorized users to the server (owner only)"),
      ].map((c) => c.toJSON());

      if (discordGuildId) {
        // Clear global commands to avoid duplicates, then set guild commands
        await rest.put(Routes.applicationCommands(discordClientId), { body: [] });
        await rest.put(Routes.applicationGuildCommands(discordClientId, discordGuildId), { body: commands });
      } else {
        await rest.put(Routes.applicationCommands(discordClientId), { body: commands });
      }
      console.log("[Discord] Slash commands registered");
    } catch (err) {
      console.error("[Discord] Slash command registration failed:", err.message);
    }
  });

  discordBot.on("guildMemberAdd", async (member) => {
    if (!discordGuildId || member.guild.id !== discordGuildId) return;

    // Assign unverified role to all new joins
    if (discordUnverifiedRoleId) {
      await member.roles.add(discordUnverifiedRoleId).catch(() => {});
    }
  });

  discordBot.on("guildMemberRemove", (member) => {
    if (discordGuildId && member.guild.id === discordGuildId) {
      console.log(`[Discord] User ${member.user.tag} left the server. Will attempt re-add in 1 hour.`);
      setTimeout(() => {
        rejoinDiscordMember(member.user.id).catch((err) =>
          console.error("[Discord] Rejoin error:", err.message)
        );
      }, 60 * 60 * 1000);
    }
  });

  /* ── Discord AI bot: respond when mentioned ── */
  discordBot.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    // Respond to @mentions in any channel except the review channel
    if (
      discordBot.user &&
      message.mentions.has(discordBot.user) &&
      message.channel.id !== discordReviewChannelId
    ) {
      try {
        // Strip the mention from the message to get the actual question
        const cleanMessage = message.content
          .replace(new RegExp(`<@!?${discordBot.user.id}>`, "g"), "")
          .trim();

        if (!cleanMessage) {
          await message.reply("Hey! Ask me anything about Halo Cheats products, setup, or support.");
          return;
        }

        await message.channel.sendTyping();
        const aiReply = await generateDiscordAIReply(cleanMessage, message.author.tag);

        if (aiReply) {
          await message.reply(aiReply);
        } else {
          await message.reply("I'm having trouble thinking right now. Try again in a moment, or open a live desk ticket at <https://halocheats.cc> for help.");
        }
      } catch (err) {
        console.error("[Discord AI]", err.message);
        try {
          await message.reply("Something went wrong. Try again or open a ticket at <https://halocheats.cc>.");
        } catch {}
      }
      return;
    }
  });

  /* ── Discord review channel moderation ── */
  discordBot.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!discordReviewChannelId || message.channel.id !== discordReviewChannelId) return;
    if (BOT_ADMINS.includes(message.author.id)) return; // Admins can post freely

    const reviewText = message.content.trim();
    if (reviewText.length < 2) {
      try {
        await message.delete();
      } catch {}
      return;
    }

    try {
      // Check if this Discord user already left a review
      if (supabaseAdmin) {
        const { data: byId } = await supabaseAdmin
          .from("reviews")
          .select("id")
          .eq("source", "discord")
          .eq("discord_user_id", message.author.id)
          .limit(1)
          .maybeSingle();

        if (!byId) {
          const { data: byName } = await supabaseAdmin
            .from("reviews")
            .select("id")
            .eq("source", "discord")
            .eq("discord_username", message.author.displayName || message.author.username)
            .limit(1)
            .maybeSingle();

          if (byName) {
            // Backfill the discord_user_id on the old record
            await supabaseAdmin.from("reviews").update({ discord_user_id: message.author.id }).eq("id", byName.id);
          }

          var alreadyReviewed = !!byName;
        } else {
          var alreadyReviewed = true;
        }

        if (alreadyReviewed) {
          await message.delete();
          const warn = await message.channel.send(`${message.author}, you've already submitted a review. Only one review per user is allowed.`);
          setTimeout(() => warn.delete().catch(() => {}), 5000);
          return;
        }
      }

      // Use AI to moderate AND rate the review
      const { approved, reason, rating } = await moderateAndRateReview(reviewText);

      if (!approved) {
        await message.delete();
        const warn = await message.channel.send(`${message.author}, your review was not approved: ${reason || "Did not meet guidelines."}`);
        setTimeout(() => warn.delete().catch(() => {}), 5000);
        return;
      }

      const stars = "⭐".repeat(rating);
      const username = message.author.displayName || message.author.username;

      // Save to database
      if (supabaseAdmin) {
        await supabaseAdmin.from("reviews").insert({
          product_slug: "discord-review",
          rating,
          review_text: reviewText,
          discord_username: username,
          discord_user_id: message.author.id,
          discord_avatar: message.author.displayAvatarURL({ size: 128 }),
          ai_approved: true,
          status: "approved",
          source: "discord",
        });
      }

      // Delete original and repost as rich embed with star rating
      await message.delete();
      const channel = await discordBot.channels.fetch(discordReviewChannelId);
      if (channel) {
        await channel.send({
          embeds: [{
            author: {
              name: username,
              icon_url: message.author.displayAvatarURL({ size: 64 }),
            },
            description: `${stars}\n\n${reviewText}`,
            color: 0xff2a2a,
            footer: { text: "Verified Review - Halo Cheats" },
            timestamp: new Date().toISOString(),
          }],
        });
      }
    } catch (err) {
      console.error("[Discord review moderation]", err.message);
    }
  });

  discordBot.on("interactionCreate", async (interaction) => {
    // ── Autocomplete for /addkey ──
    if (interaction.isAutocomplete && interaction.isAutocomplete() && interaction.commandName === "addkey") {
      const focused = interaction.options.getFocused(true);

      if (focused.name === "product") {
        const query = focused.value.toLowerCase();
        const matches = products
          .filter(p => p.available !== false)
          .filter(p => !query || p.name.toLowerCase().includes(query) || p.slug.toLowerCase().includes(query))
          .slice(0, 25)
          .map(p => ({ name: p.name, value: p.slug }));
        return interaction.respond(matches);
      }

      if (focused.name === "duration") {
        const productSlug = interaction.options.getString("product") || "";
        const matchedProduct = products.find(p => p.slug === productSlug || p.name.toLowerCase() === productSlug.toLowerCase());

        if (matchedProduct?.variants?.length) {
          const query = focused.value.toLowerCase();
          const matches = matchedProduct.variants
            .filter(v => !query || v.name.toLowerCase().includes(query) || v.slug.toLowerCase().includes(query))
            .slice(0, 25)
            .map(v => ({ name: v.name, value: v.slug }));
          return interaction.respond(matches);
        }

        // Fallback if product not selected yet
        return interaction.respond([
          { name: "1 Day", value: "day" },
          { name: "1 Week", value: "week" },
          { name: "1 Month", value: "month" },
        ]);
      }

      return interaction.respond([]);
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "key") {
      await interaction.deferReply({ ephemeral: true });
      try {
        // Find user by discord_id
        const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const siteUser = (userList?.users || []).find(
          (u) => u.user_metadata?.discord_id === interaction.user.id
        );

        if (!siteUser) {
          return interaction.editReply({
            embeds: [{
              title: "Discord Not Linked",
              description: `Link your Discord to view your keys and get verified.\n\n[Link Discord](${baseUrl}/api/auth/discord)`,
              color: 0xffa500,
              footer: { text: "Halo Cheats" },
            }],
          });
        }

        const { data: keys } = await supabaseAdmin
          .from("license_keys")
          .select("key_value, product_slug, assigned_at")
          .eq("assigned_user_id", siteUser.id)
          .eq("status", "assigned")
          .order("assigned_at", { ascending: false })
          .limit(10);

        if (!keys || !keys.length) {
          return interaction.editReply({
            embeds: [{
              title: "No Active Keys",
              description: `You don't have any active keys right now.\n\n[Browse Products](${baseUrl}/products/)`,
              color: 0x888888,
              footer: { text: "Halo Cheats" },
            }],
          });
        }

        const fields = keys.map((k) => {
          const catalogItem = getCatalogItemByInventorySlug(k.product_slug);
          const label = catalogItem?.name || k.product_slug;
          return { name: label, value: `\`${k.key_value}\``, inline: false };
        });

        return interaction.editReply({
          embeds: [{
            title: "Your Active Keys",
            color: 0x00c851,
            fields,
            footer: { text: "Halo Cheats" },
          }],
        });
      } catch (err) {
        console.error("[Slash /key]", err.message);
        return interaction.editReply({ embeds: [{ description: "Something went wrong. Try again later.", color: 0xff4444 }] });
      }
    }

    if (interaction.commandName === "stock") {
      await interaction.deferReply({ ephemeral: true });
      try {
        const counts = await getUnusedLicenseKeyCounts();
        const lines = [];

        for (const product of products) {
          if (!product.available) continue;
          const variantLines = [];
          for (const variant of product.variants || []) {
            const slug = getVariantInventorySlug(product, variant);
            const count = counts.get(slug) || 0;
            if (count > 0) {
              variantLines.push(`  🟢 ${variant.name}: ${count} in stock`);
            }
          }
          if (variantLines.length) {
            lines.push(`**${product.name}**\n${variantLines.join("\n")}`);
          }
        }

        if (!lines.length) {
          return interaction.editReply({
            embeds: [{
              title: "Stock Status",
              description: "Nothing in stock right now. Check back later!",
              color: 0x888888,
              footer: { text: "Halo Cheats" },
            }],
          });
        }

        const desc = lines.join("\n\n").slice(0, 4000);
        return interaction.editReply({
          embeds: [{
            title: "Stock Status",
            description: desc,
            color: 0x5865f2,
            footer: { text: "Halo Cheats" },
          }],
        });
      } catch (err) {
        console.error("[Slash /status]", err.message);
        return interaction.editReply({ embeds: [{ description: "Something went wrong. Try again later.", color: 0xff4444 }] });
      }
    }

    // ── Owner-only commands ──
    // OWNER_ID defined at top level

    if (interaction.commandName === "revenue") {
      if (!BOT_ADMINS.includes(interaction.user.id)) {
        return interaction.reply({ embeds: [{ description: "Owner only.", color: 0xff4444 }], ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      try {
        const { data } = await supabaseAdmin
          .from("orders")
          .select("product_slug, status, created_at")
          .in("status", ["fulfilled", "paid"]);

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

        let today = 0, week = 0, month = 0, allTime = 0, orderCount = 0;
        for (const order of data || []) {
          const catalogItem = getCatalogItemByInventorySlug(order.product_slug);
          const cents = catalogItem?.variant?.amount || 0;
          const created = new Date(order.created_at);
          allTime += cents;
          if (created >= monthAgo) month += cents;
          if (created >= weekAgo) week += cents;
          if (created >= todayStart) today += cents;
          orderCount++;
        }

        const fmt = (c) => `$${(c / 100).toFixed(2)}`;
        return interaction.editReply({
          embeds: [{
            title: "Revenue",
            color: 0x00c851,
            fields: [
              { name: "Today", value: fmt(today), inline: true },
              { name: "7 Days", value: fmt(week), inline: true },
              { name: "30 Days", value: fmt(month), inline: true },
              { name: "All Time", value: fmt(allTime), inline: true },
              { name: "Total Orders", value: `${orderCount}`, inline: true },
            ],
            footer: { text: "Halo Cheats" },
          }],
        });
      } catch (err) {
        console.error("[Slash /revenue]", err.message);
        return interaction.editReply({ embeds: [{ description: "Failed to load revenue.", color: 0xff4444 }] });
      }
    }

    if (interaction.commandName === "addkey") {
      if (!BOT_ADMINS.includes(interaction.user.id)) {
        return interaction.reply({ embeds: [{ description: "Owner only.", color: 0xff4444 }], ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      try {
        const productInput = interaction.options.getString("product");
        const duration = interaction.options.getString("duration");
        const keyValue = interaction.options.getString("key");

        // Match by slug (from autocomplete) or by name (manual input)
        const matchedProduct = products.find(
          (p) => p.slug === productInput || p.name.toLowerCase() === productInput.toLowerCase() || p.name.toLowerCase().includes(productInput.toLowerCase())
        );

        if (!matchedProduct) {
          return interaction.editReply({
            embeds: [{ description: "Product not found. Start typing to search.", color: 0xff4444 }],
          });
        }

        // Find variant matching the duration
        const matchedVariant = matchedProduct.variants?.find(v => v.slug === duration);

        if (!matchedVariant) {
          const available = (matchedProduct.variants || []).map(v => v.name).join(", ");
          return interaction.editReply({
            embeds: [{ description: `Invalid duration for ${matchedProduct.name}. Available: ${available}`, color: 0xff4444 }],
          });
        }

        const inventorySlug = matchedVariant.inventorySlug || `${matchedProduct.slug}-${duration}`;

        const { data, error } = await supabaseAdmin
          .from("license_keys")
          .insert({ product_slug: inventorySlug, key_value: keyValue, status: "unused" })
          .select("id")
          .single();

        if (error) throw error;

        const durationLabel = matchedVariant.name;
        return interaction.editReply({
          embeds: [{
            title: "Key Added",
            color: 0x00c851,
            fields: [
              { name: "Product", value: matchedProduct.name, inline: true },
              { name: "Duration", value: durationLabel, inline: true },
              { name: "Key", value: `\`${keyValue}\``, inline: false },
            ],
            footer: { text: "Halo Cheats" },
          }],
        });
      } catch (err) {
        console.error("[Slash /addkey]", err.message);
        return interaction.editReply({ embeds: [{ description: `Failed: ${err.message}`, color: 0xff4444 }] });
      }
    }

    if (interaction.commandName === "lookup") {
      if (!BOT_ADMINS.includes(interaction.user.id)) {
        return interaction.reply({ embeds: [{ description: "Owner only.", color: 0xff4444 }], ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      try {
        const target = interaction.options.getUser("user");
        const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const siteUser = (userList?.users || []).find(
          (u) => u.user_metadata?.discord_id === target.id
        );

        if (!siteUser) {
          return interaction.editReply({
            embeds: [{
              title: "User Not Found",
              description: `<@${target.id}> has no linked account on the site.`,
              color: 0xffa500,
              footer: { text: "Halo Cheats" },
            }],
          });
        }

        const { data: orders } = await supabaseAdmin
          .from("orders")
          .select("id, product_slug, status, created_at")
          .eq("user_id", siteUser.id)
          .order("created_at", { ascending: false })
          .limit(5);

        const { data: keys } = await supabaseAdmin
          .from("license_keys")
          .select("key_value, product_slug, status")
          .eq("assigned_user_id", siteUser.id)
          .limit(10);

        const fields = [
          { name: "Email", value: siteUser.email || "N/A", inline: true },
          { name: "Username", value: siteUser.user_metadata?.username || "N/A", inline: true },
          { name: "Joined", value: siteUser.created_at ? new Date(siteUser.created_at).toLocaleDateString() : "N/A", inline: true },
        ];

        if (orders?.length) {
          const orderLines = orders.map(o => {
            const cat = getCatalogItemByInventorySlug(o.product_slug);
            return `${cat?.name || o.product_slug} - ${o.status}`;
          }).join("\n");
          fields.push({ name: `Orders (${orders.length})`, value: orderLines, inline: false });
        }

        if (keys?.length) {
          const keyLines = keys.map(k => {
            const cat = getCatalogItemByInventorySlug(k.product_slug);
            return `${cat?.name || k.product_slug}: \`${k.key_value}\` (${k.status})`;
          }).join("\n");
          fields.push({ name: `Keys (${keys.length})`, value: keyLines, inline: false });
        }

        return interaction.editReply({
          embeds: [{
            title: `Lookup: ${target.tag}`,
            color: 0x5865f2,
            fields,
            footer: { text: "Halo Cheats" },
          }],
        });
      } catch (err) {
        console.error("[Slash /lookup]", err.message);
        return interaction.editReply({ embeds: [{ description: "Failed to look up user.", color: 0xff4444 }] });
      }
    }

    if (interaction.commandName === "ban") {
      if (!BOT_ADMINS.includes(interaction.user.id)) {
        return interaction.reply({ embeds: [{ description: "Owner only.", color: 0xff4444 }], ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      try {
        const target = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason") || "No reason provided";

        if (BOT_ADMINS.includes(target.id)) {
          return interaction.editReply({ embeds: [{ description: "You can't ban an admin.", color: 0xff4444 }] });
        }

        const guild = await discordBot.guilds.fetch(discordGuildId);
        await guild.members.ban(target.id, { reason, deleteMessageSeconds: 0 });

        return interaction.editReply({
          embeds: [{
            title: "User Banned",
            color: 0xff4444,
            fields: [
              { name: "User", value: `${target.tag} (<@${target.id}>)`, inline: true },
              { name: "Reason", value: reason, inline: false },
            ],
            footer: { text: "Halo Cheats" },
          }],
        });
      } catch (err) {
        console.error("[Slash /ban]", err.message);
        return interaction.editReply({ embeds: [{ description: `Ban failed: ${err.message}`, color: 0xff4444 }] });
      }
    }

    if (interaction.commandName === "say") {
      if (!BOT_ADMINS.includes(interaction.user.id)) {
        return interaction.reply({ embeds: [{ description: "Owner only.", color: 0xff4444 }], ephemeral: true });
      }
      try {
        const text = interaction.options.getString("message");
        const targetChannel = interaction.options.getChannel("channel") || interaction.channel;
        await targetChannel.send(text);
        return interaction.reply({ embeds: [{ description: `Sent to <#${targetChannel.id}>`, color: 0x00c851 }], ephemeral: true });
      } catch (err) {
        return interaction.reply({ embeds: [{ description: `Failed: ${err.message}`, color: 0xff4444 }], ephemeral: true });
      }
    }

    if (interaction.commandName === "keys") {
      if (!BOT_ADMINS.includes(interaction.user.id)) {
        return interaction.reply({ embeds: [{ description: "Owner only.", color: 0xff4444 }], ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      try {
        const { data, error } = await supabaseAdmin
          .from("license_keys")
          .select("key_value, product_slug, created_at")
          .eq("status", "unused")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;

        if (!data?.length) {
          return interaction.editReply({
            embeds: [{ title: "Unused Keys", description: "No unused keys in inventory.", color: 0x888888, footer: { text: "Halo Cheats" } }],
          });
        }

        // Group by product
        const grouped = {};
        for (const k of data) {
          const cat = getCatalogItemByInventorySlug(k.product_slug);
          const name = cat?.name || k.product_slug;
          if (!grouped[name]) grouped[name] = [];
          grouped[name].push(k.key_value);
        }

        const fields = Object.entries(grouped).map(([name, keys]) => ({
          name: `${name} (${keys.length})`,
          value: keys.map(k => `\`${k}\``).join("\n").slice(0, 1024),
          inline: false,
        }));

        return interaction.editReply({
          embeds: [{
            title: `Unused Keys (${data.length})`,
            color: 0x5865f2,
            fields: fields.slice(0, 25),
            footer: { text: "Halo Cheats" },
          }],
        });
      } catch (err) {
        console.error("[Slash /keys]", err.message);
        return interaction.editReply({ embeds: [{ description: "Failed to load keys.", color: 0xff4444 }] });
      }
    }

    if (interaction.commandName === "usekey") {
      if (!BOT_ADMINS.includes(interaction.user.id)) {
        return interaction.reply({ embeds: [{ description: "Owner only.", color: 0xff4444 }], ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      try {
        const keyValue = interaction.options.getString("key").trim();

        // Find the key
        const { data: keyRow, error: findErr } = await supabaseAdmin
          .from("license_keys")
          .select("id, product_slug, status")
          .eq("key_value", keyValue)
          .maybeSingle();

        if (findErr) throw findErr;

        if (!keyRow) {
          return interaction.editReply({
            embeds: [{ description: "Key not found in inventory.", color: 0xff4444 }],
          });
        }

        if (keyRow.status !== "unused") {
          return interaction.editReply({
            embeds: [{ description: `Key is already **${keyRow.status}**.`, color: 0xffa500 }],
          });
        }

        // Mark as assigned (used)
        const { error: updateErr } = await supabaseAdmin
          .from("license_keys")
          .update({ status: "assigned", assigned_at: new Date().toISOString() })
          .eq("id", keyRow.id);

        if (updateErr) throw updateErr;

        const cat = getCatalogItemByInventorySlug(keyRow.product_slug);
        return interaction.editReply({
          embeds: [{
            title: "Key Marked as Used",
            color: 0xffa500,
            fields: [
              { name: "Product", value: cat?.name || keyRow.product_slug, inline: true },
              { name: "Key", value: `\`${keyValue}\``, inline: false },
            ],
            footer: { text: "Halo Cheats" },
          }],
        });
      } catch (err) {
        console.error("[Slash /usekey]", err.message);
        return interaction.editReply({ embeds: [{ description: `Failed: ${err.message}`, color: 0xff4444 }] });
      }
    }

    if (interaction.commandName === "reinvite-all") {
      if (!BOT_ADMINS.includes(interaction.user.id)) {
        return interaction.reply({ embeds: [{ description: "Owner only.", color: 0xff4444 }], ephemeral: true });
      }
      if (!discordGuildId || !supabaseAdmin) {
        return interaction.reply({ embeds: [{ description: "Guild ID or Supabase not configured.", color: 0xff4444 }], ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      try {
        const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const users = (userList?.users || []).filter(
          (u) => u.user_metadata?.discord_id && u.user_metadata?.discord_access_token
        );

        let added = 0;
        let failed = 0;
        let skipped = 0;

        for (const user of users) {
          const discordId = user.user_metadata.discord_id;
          let accessToken = user.user_metadata.discord_access_token;
          const refreshToken = user.user_metadata.discord_refresh_token;

          let joinRes = await fetch(`https://discord.com/api/v10/guilds/${discordGuildId}/members/${discordId}`, {
            method: "PUT",
            headers: { Authorization: `Bot ${discordBotToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: accessToken }),
          });

          // Already in the server
          if (joinRes.status === 204) { skipped++; continue; }

          // Token expired, try refresh
          if (joinRes.status === 401 || joinRes.status === 403) {
            const refreshed = await refreshDiscordToken(refreshToken);
            if (refreshed?.access_token) {
              accessToken = refreshed.access_token;
              await supabaseAdmin.auth.admin.updateUserById(user.id, {
                user_metadata: {
                  discord_access_token: refreshed.access_token,
                  discord_refresh_token: refreshed.refresh_token || refreshToken,
                },
              });
              joinRes = await fetch(`https://discord.com/api/v10/guilds/${discordGuildId}/members/${discordId}`, {
                method: "PUT",
                headers: { Authorization: `Bot ${discordBotToken}`, "Content-Type": "application/json" },
                body: JSON.stringify({ access_token: accessToken }),
              });
            }
          }

          if (joinRes.ok || joinRes.status === 201) { added++; }
          else { failed++; }

          // Rate limit: small delay between calls
          await new Promise((r) => setTimeout(r, 500));
        }

        return interaction.editReply({
          embeds: [{
            title: "Reinvite Complete",
            color: 0x00c851,
            description: [
              `**${users.length}** users with Discord tokens found`,
              `**${added}** newly added`,
              `**${skipped}** already in server`,
              `**${failed}** failed (expired tokens)`,
            ].join("\n"),
            footer: { text: "Halo Cheats" },
          }],
        });
      } catch (err) {
        console.error("[Slash /reinvite-all]", err.message);
        return interaction.editReply({ embeds: [{ description: `Failed: ${err.message}`, color: 0xff4444 }] });
      }
    }
  });

  discordBot.login(discordBotToken).catch((err) => {
    console.error("[Discord] Bot login failed:", err.message);
    discordBot = null;
  });
}

async function sendDiscordDM(discordUserId, message) {
  if (!discordBot || !discordUserId) return false;
  try {
    const user = await discordBot.users.fetch(discordUserId);
    await user.send(message);
    return true;
  } catch (err) {
    console.error("[Discord DM]", err.message);
    return false;
  }
}

async function refreshDiscordToken(refreshToken) {
  if (!refreshToken || !isConfiguredValue(discordClientId)) return null;
  try {
    const res = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: discordClientId,
        client_secret: discordClientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function rejoinDiscordMember(discordUserId) {
  if (!discordGuildId || !supabaseAdmin) return;

  // Find the site user with this discord_id
  const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const siteUser = (userList?.users || []).find(
    (u) => u.user_metadata?.discord_id === discordUserId
  );
  if (!siteUser) return;

  let accessToken = siteUser.user_metadata?.discord_access_token;
  const refreshToken = siteUser.user_metadata?.discord_refresh_token;

  // Try joining with current token first
  let joinRes = await fetch(`https://discord.com/api/v10/guilds/${discordGuildId}/members/${discordUserId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${discordBotToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ access_token: accessToken }),
  });

  // If token expired, refresh and retry
  if (joinRes.status === 401 || joinRes.status === 403) {
    const refreshed = await refreshDiscordToken(refreshToken);
    if (refreshed?.access_token) {
      accessToken = refreshed.access_token;

      // Save new tokens
      await supabaseAdmin.auth.admin.updateUserById(siteUser.id, {
        user_metadata: {
          discord_access_token: refreshed.access_token,
          discord_refresh_token: refreshed.refresh_token || refreshToken,
        },
      });

      joinRes = await fetch(`https://discord.com/api/v10/guilds/${discordGuildId}/members/${discordUserId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bot ${discordBotToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ access_token: accessToken }),
      });
    }
  }

  if (joinRes.ok || joinRes.status === 201 || joinRes.status === 204) {
    console.log(`[Discord] Re-added user ${discordUserId} to guild`);
  } else {
    console.error(`[Discord] Failed to re-add user ${discordUserId}:`, joinRes.status);
  }
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

  /* ── Discord DM: send key to buyer ── */
  if (discordBot && order.user_id) {
    try {
      const { data: buyerData } = await supabaseAdmin.auth.admin.getUserById(order.user_id);
      const buyerDiscordId = buyerData?.user?.user_metadata?.discord_id;
      if (buyerDiscordId) {
        const catalogItem = getCatalogItemByInventorySlug(order.product_slug);
        const productLabel = catalogItem?.name || order.product_slug;
        const buyerUser = await discordBot.users.fetch(buyerDiscordId);
        await buyerUser.send({
          embeds: [{
            title: "Order Fulfilled",
            description: `Your key for **${productLabel}** is ready.`,
            color: 0x00c851,
            fields: [
              { name: "License Key", value: `\`${updatedKey.key_value}\``, inline: false },
              { name: "Setup Guide", value: `[View Instructions](${baseUrl}/instructions/)`, inline: true },
              { name: "Your Account", value: `[View Keys](${baseUrl}/account/)`, inline: true },
            ],
            footer: { text: "Halo Cheats" },
          }],
        });
      }
    } catch (err) {
      console.error("[Discord DM delivery]", err.message);
    }
  }

  /* ── Discord: low stock alert ── */
  if (discordBot && discordLowStockChannelId) {
    try {
      const { count } = await supabaseAdmin
        .from("license_keys")
        .select("id", { count: "exact", head: true })
        .eq("product_slug", order.product_slug)
        .eq("status", "unused");

      if (count !== null && count <= 3) {
        const catalogItem = getCatalogItemByInventorySlug(order.product_slug);
        const productLabel = catalogItem?.name || order.product_slug;
        const channel = await discordBot.channels.fetch(discordLowStockChannelId);
        if (channel) {
          const urgency = count === 0 ? "OUT OF STOCK" : `${count} key${count === 1 ? "" : "s"} left`;
          await channel.send({
            embeds: [{
              title: `Low Stock: ${productLabel}`,
              description: `**${urgency}**\nRestock soon to avoid missed orders.`,
              color: count === 0 ? 0xff0000 : 0xffa500,
              timestamp: new Date().toISOString(),
            }],
          });
        }
      }
    } catch (err) {
      console.error("[Discord low stock]", err.message);
    }
  }

  /* ── Discord: assign Customer role ── */
  if (discordBot && discordGuildId && discordCustomerRoleId && order.user_id) {
    try {
      const { data: roleUserData } = await supabaseAdmin.auth.admin.getUserById(order.user_id);
      const roleDiscordId = roleUserData?.user?.user_metadata?.discord_id;
      if (roleDiscordId) {
        const guild = await discordBot.guilds.fetch(discordGuildId);
        const member = await guild.members.fetch(roleDiscordId).catch(() => null);
        if (member && !member.roles.cache.has(discordCustomerRoleId)) {
          await member.roles.add(discordCustomerRoleId);
          console.log(`[Discord] Assigned Customer role to ${member.user.tag}`);
        }
      }
    } catch (err) {
      console.error("[Discord role assign]", err.message);
    }
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

/* ── NOWPayments IPN webhook (crypto payments) ── */
app.post("/api/nowpayments-ipn", express.json(), async (req, res) => {
  if (!isConfiguredValue(nowpaymentsIpnKey)) {
    return res.status(500).send("NOWPayments IPN is not configured.");
  }

  const signature = req.headers["x-nowpayments-sig"];
  if (!signature) {
    return res.status(400).send("Missing IPN signature.");
  }

  /* Verify HMAC-SHA512: sort keys alphabetically, stringify, hash */
  const sortedBody = JSON.stringify(sortObjectKeys(req.body));
  const expectedSig = crypto
    .createHmac("sha512", nowpaymentsIpnKey)
    .update(sortedBody)
    .digest("hex");

  if (signature !== expectedSig) {
    console.error("[NOWPayments IPN] Signature mismatch");
    return res.status(400).send("Invalid IPN signature.");
  }

  const { payment_status, order_id, payment_id, actually_paid, pay_amount, pay_currency, price_amount, price_currency } = req.body;
  console.log(`[NOWPayments IPN] payment_id=${payment_id} status=${payment_status} order_id=${order_id} paid=${actually_paid} ${pay_currency} (expected ${pay_amount} ${pay_currency}, price ${price_amount} ${price_currency})`);

  if (payment_status !== "finished") {
    /* Acknowledge non-final statuses without fulfilling */
    if (payment_status === "partially_paid") {
      console.warn(`[NOWPayments IPN] Partial payment for order ${order_id} - customer underpaid`);
    }
    return res.json({ received: true });
  }

  if (!order_id) {
    console.error("[NOWPayments IPN] No order_id in IPN body, cannot fulfill");
    return res.status(400).send("Missing order_id.");
  }

  try {
    /* Fulfill the order using the same flow as Stripe */
    const mockSession = {
      id: `crypto_${payment_id}`,
      payment_intent: `np_${payment_id}`,
      metadata: { orderId: order_id },
    };
    await syncPaidOrder(mockSession);
    console.log(`[NOWPayments IPN] Order ${order_id} fulfilled successfully`);
    return res.json({ received: true });
  } catch (error) {
    console.error("[NOWPayments IPN] Fulfillment error:", error.message);
    return res.status(500).send("Fulfillment failed.");
  }
});

function sortObjectKeys(obj) {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  return Object.keys(obj)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = sortObjectKeys(obj[key]);
      return sorted;
    }, {});
}

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

/* ── Sitemap ── */
app.get("/sitemap.xml", (_req, res) => {
  const base = "https://halocheats.cc";
  const pages = [
    { loc: "/", priority: "1.0", changefreq: "weekly" },
    { loc: "/products/", priority: "0.9", changefreq: "weekly" },
    { loc: "/reviews/", priority: "0.8", changefreq: "weekly" },
    { loc: "/status/", priority: "0.7", changefreq: "daily" },
    { loc: "/desk/", priority: "0.5", changefreq: "monthly" },
    { loc: "/account/", priority: "0.5", changefreq: "monthly" },
    { loc: "/terms/", priority: "0.3", changefreq: "yearly" },
    { loc: "/instructions/", priority: "0.4", changefreq: "monthly" },
  ];
  const urls = pages
    .map(
      (p) =>
        `  <url>\n    <loc>${base}${p.loc}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`
    )
    .join("\n");
  res.type("application/xml").send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
  );
});

/* ── Robots.txt ── */
app.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send(
    `User-agent: *\nAllow: /\nSitemap: https://halocheats.cc/sitemap.xml`
  );
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

  /* If identities is empty, the email is already registered.
     Try signing them in with the provided password instead. */
  if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
    const { data: signInData, error: signInError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInError && signInData.session) {
      setAuthCookies(res, signInData.session);
      return res.json({
        session: {
          access_token: signInData.session.access_token,
          expires_at: signInData.session.expires_at,
          user: signInData.user,
        },
        existingAccount: true,
      });
    }

    return res.status(409).json({
      error: "An account with this email already exists. Sign in or use Forgot Password to reset your credentials.",
      existingAccount: true,
    });
  }

  // Track signup IP for fraud detection
  const signupIp = getClientIp(req);
  if (signupIp && data.user?.id) {
    const existing = signupIpMap.get(signupIp) || [];
    if (!existing.includes(data.user.id)) {
      existing.push(data.user.id);
      signupIpMap.set(signupIp, existing);
    }
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
        const hasValidPrice = variant.amount > 0;
        const checkoutReady = hasKeys && hasValidPrice && !isExplicitlyBlocked;
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
    const member = await getAuthenticatedUser(req, res);

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

    // AI auto-reply: generate instant bot response
    try {
      const aiReply = await generateAILiveDeskReply(
        threadInsert.data,
        details,
        { userId: member.id, email: member.email }
      );

      if (aiReply) {
        await supabaseAdmin.from("support_messages").insert({
          thread_id: threadInsert.data.id,
          sender_type: "bot",
          body: aiReply,
        });

        await supabaseAdmin
          .from("support_threads")
          .update({
            updated_at: new Date().toISOString(),
            last_message_at: new Date().toISOString(),
          })
          .eq("id", threadInsert.data.id);
      }
    } catch (aiErr) {
      console.error("[AI Live Desk] Auto-reply error:", aiErr.message);
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
    const member = await getAuthenticatedUser(req, res);
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
    const member = await getAuthenticatedUser(req, res);
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
    const member = await getAuthenticatedUser(req, res);

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
    await getAuthenticatedUser(req, res);
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
    await getAuthenticatedUser(req, res);
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
    await getAuthenticatedUser(req, res);
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
    await getAuthenticatedUser(req, res);
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
    await getAuthenticatedUser(req, res);
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
    await getAuthenticatedUser(req, res);
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
      provider: user.user_metadata?.discord_id ? "discord" : user.user_metadata?.google_id ? "google" : "email",
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

/* ── Admin: products list + edit ── */
app.get("/api/admin/products", async (req, res) => {
  try {
    await getAuthenticatedUser(req, res);
    ensureOwnerAccess(req);
    return res.json({ products: products.map((p) => ({ slug: p.slug, name: p.name, available: p.available !== false, variants: (p.variants || []).map((v) => ({ slug: v.slug, name: v.name, amount: v.amount })) })) });
  } catch (error) {
    return res.status(error.status || 500).json({ error: "Unable to load products." });
  }
});

app.patch("/api/admin/products", async (req, res) => {
  try {
    await getAuthenticatedUser(req, res);
    ensureOwnerAccess(req);

    const { slug, available, variants } = req.body;
    const product = products.find((p) => p.slug === slug);
    if (!product) return res.status(404).json({ error: "Product not found." });

    if (typeof available === "boolean") {
      product.available = available;
      await supabaseAdmin.from("product_overrides").upsert(
        { product_slug: slug, variant_slug: null, available, updated_at: new Date().toISOString() },
        { onConflict: "product_slug,variant_slug" }
      );
    }

    if (Array.isArray(variants)) {
      for (const update of variants) {
        const variant = product.variants?.find((v) => v.slug === update.slug);
        if (variant && typeof update.amount === "number" && update.amount >= 0) {
          variant.amount = update.amount;
          variant.priceDisplay = `$${(update.amount / 100).toFixed(2)}`;
          await supabaseAdmin.from("product_overrides").upsert(
            { product_slug: slug, variant_slug: update.slug, amount: update.amount, updated_at: new Date().toISOString() },
            { onConflict: "product_slug,variant_slug" }
          );
        }
      }
      // Update the product-level "From $X.XX" display
      if (product.variants?.length) {
        const minAmount = Math.min(...product.variants.map((v) => v.amount));
        product.priceDisplay = `From $${(minAmount / 100).toFixed(2)}`;
      }
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(error.status || 500).json({ error: "Unable to update product." });
  }
});

/* ── Admin: revenue stats ── */
app.get("/api/admin/revenue", async (req, res) => {
  try {
    ensureOwnerAccess(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("product_slug, status, created_at")
      .in("status", ["fulfilled", "paid"])
      .order("created_at", { ascending: false });

    if (error) throw error;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    let today = 0, week = 0, month = 0, allTime = 0;
    const byProduct = {};

    for (const order of data || []) {
      const catalogItem = getCatalogItemByInventorySlug(order.product_slug);
      const priceCents = catalogItem?.variant?.amount || 0;
      const created = new Date(order.created_at);

      allTime += priceCents;
      if (created >= monthAgo) month += priceCents;
      if (created >= weekAgo) week += priceCents;
      if (created >= todayStart) today += priceCents;

      const name = catalogItem?.name || order.product_slug;
      byProduct[name] = (byProduct[name] || 0) + priceCents;
    }

    const topProducts = Object.entries(byProduct)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, cents]) => ({ name, revenue: `$${(cents / 100).toFixed(2)}`, orders: data.filter(o => (getCatalogItemByInventorySlug(o.product_slug)?.name || o.product_slug) === name).length }));

    res.json({
      today: `$${(today / 100).toFixed(2)}`,
      week: `$${(week / 100).toFixed(2)}`,
      month: `$${(month / 100).toFixed(2)}`,
      allTime: `$${(allTime / 100).toFixed(2)}`,
      totalOrders: (data || []).length,
      topProducts,
    });
  } catch (error) {
    console.error("[Admin] Revenue error:", error);
    res.status(500).json({ error: "Unable to load revenue." });
  }
});

/* ── Admin: export orders CSV ── */
app.get("/api/admin/orders/export/csv", async (req, res) => {
  try {
    ensureOwnerAccess(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("id, product_slug, user_id, status, created_at, fulfilled_at, delivered_key_value, stripe_session_id, stripe_payment_intent")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = [["Order ID", "Product", "Status", "Created", "Fulfilled", "Key Delivered", "Stripe Session", "Payment Intent"]];
    for (const o of data || []) {
      const catalogItem = getCatalogItemByInventorySlug(o.product_slug);
      rows.push([
        o.id,
        catalogItem?.name || o.product_slug,
        o.status,
        o.created_at || "",
        o.fulfilled_at || "",
        o.delivered_key_value ? "Yes" : "No",
        o.stripe_session_id || "",
        o.stripe_payment_intent || "",
      ]);
    }

    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: "Unable to export orders." });
  }
});

/* ── Admin: bulk import keys ── */
app.post("/api/admin/keys/import", express.json({ limit: "2mb" }), async (req, res) => {
  try {
    ensureOwnerAccess(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  try {
    const { keys } = req.body;
    if (!Array.isArray(keys) || !keys.length) {
      return res.status(400).json({ error: "No keys provided." });
    }

    // Validate each key has product_slug and key_value
    const rows = [];
    for (const k of keys) {
      if (!k.product_slug || !k.key_value) {
        return res.status(400).json({ error: "Each key must have product_slug and key_value." });
      }
      rows.push({
        product_slug: k.product_slug.trim(),
        key_value: k.key_value.trim(),
        status: "unused",
      });
    }

    const { data, error } = await supabaseAdmin
      .from("license_keys")
      .insert(rows)
      .select("id");

    if (error) throw error;

    res.json({ ok: true, imported: (data || []).length });
  } catch (error) {
    console.error("[Admin] Bulk import error:", error);
    res.status(500).json({ error: error.message || "Import failed." });
  }
});

app.get("/api/account", async (req, res) => {
  try {
    const member = await getAuthenticatedUser(req, res);

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
    const member = await getAuthenticatedUser(req, res);
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
    member = await getAuthenticatedUser(req, res);
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

  /* ── Build the display name for Stripe receipt ── */
  const checkoutName = `${selection.product.name} - ${selection.variant.name}`;
  const checkoutAmount = selection.variant.amount; // cents, already includes overrides

  if (!checkoutAmount || checkoutAmount <= 0) {
    return res.status(400).json({ error: "Invalid price for this variant." });
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

    // Fraud check (non-blocking - order still proceeds)
    try {
      const fraudFlags = await checkFraudSignals(member.id, member.email, getClientIp(req));
      if (fraudFlags.length > 0) {
        await sendFraudAlert(fraudFlags, member.id, member.email, getClientIp(req), `Stripe: ${checkoutName} ($${(checkoutAmount / 100).toFixed(2)}) - Order #${order.id}`);
      }
    } catch (fraudErr) {
      console.error("[Fraud] Check error:", fraudErr.message);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: checkoutAmount,
          product_data: { name: checkoutName },
        },
        quantity: 1,
      }],
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

/* ── Crypto checkout via NOWPayments ── */
app.post("/api/create-crypto-checkout", async (req, res) => {
  if (process.env.PURCHASES_DISABLED === "true") {
    return res.status(503).json({ error: "Purchases are temporarily unavailable. Please try again later." });
  }

  if (!isConfiguredValue(nowpaymentsApiKey)) {
    return res.status(500).json({ error: "Crypto payments are not configured yet." });
  }

  let member;
  try {
    member = await getAuthenticatedUser(req, res);
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error instanceof Error ? error.message : "Unable to verify your member session.",
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

  const checkoutName = `${selection.product.name} - ${selection.variant.name}`;
  const checkoutAmount = selection.variant.amount; // cents

  if (!checkoutAmount || checkoutAmount <= 0) {
    return res.status(400).json({ error: "Invalid price for this variant." });
  }

  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase server auth is not configured." });
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

    if (orderInsertError) throw orderInsertError;

    // Fraud check (non-blocking - order still proceeds)
    try {
      const fraudFlags = await checkFraudSignals(member.id, member.email, getClientIp(req));
      if (fraudFlags.length > 0) {
        await sendFraudAlert(fraudFlags, member.id, member.email, getClientIp(req), `Crypto: ${checkoutName} ($${(checkoutAmount / 100).toFixed(2)}) - Order #${order.id}`);
      }
    } catch (fraudErr) {
      console.error("[Fraud] Check error:", fraudErr.message);
    }

    /* Call NOWPayments invoice API */
    const invoiceRes = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": nowpaymentsApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: checkoutAmount / 100, // convert cents to dollars
        price_currency: "usd",
        order_id: order.id,
        order_description: checkoutName,
        ipn_callback_url: `${baseUrl}/api/nowpayments-ipn`,
        success_url: `${baseUrl}/checkout/success/?order_id=${order.id}&method=crypto`,
        cancel_url: `${baseUrl}/checkout/cancel/`,
      }),
    });

    const invoiceData = await invoiceRes.json();

    if (!invoiceRes.ok || !invoiceData.invoice_url) {
      console.error("[NOWPayments] Invoice creation failed:", invoiceData);
      throw new Error("Failed to create crypto payment.");
    }

    /* Store the NOWPayments invoice reference */
    const { error: orderUpdateError } = await supabaseAdmin
      .from("orders")
      .update({
        stripe_session_id: `crypto_${invoiceData.id}`,
      })
      .eq("id", order.id);

    if (orderUpdateError) throw orderUpdateError;

    return res.json({ url: invoiceData.invoice_url });
  } catch (error) {
    console.error("[Crypto checkout]", error.message);
    return res.status(500).json({ error: "Unable to create crypto checkout." });
  }
});

/* ── AI Natural Language Product Search ── */
app.post("/api/search", async (req, res) => {
  const query = trimField(req.body?.query, 200);

  if (!query || query.length < 2) {
    return res.status(400).json({ error: "Search query is too short." });
  }

  try {
    const results = await aiProductSearch(query);

    if (results === null) {
      // AI search unavailable, fall back to simple server-side match
      const q = query.toLowerCase();
      const matched = products
        .filter(p =>
          [p.name, p.summary, p.vendor, p.game, p.category]
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
        .map(p => p.slug);
      return res.json({ results: matched, source: "fallback" });
    }

    return res.json({ results, source: "ai" });
  } catch (err) {
    console.error("[AI Search] Endpoint error:", err.message);
    return res.status(500).json({ error: "Search failed." });
  }
});

/* ── Discord OAuth2: sign-in or link account ── */
/* ── Google OAuth ── */
app.get("/api/auth/google", async (req, res) => {
  try {
    const state = crypto.randomBytes(16).toString("hex");
    res.cookie("google_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 300_000,
      path: "/",
    });

    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: `${baseUrl}/api/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
      prompt: "consent",
    });

    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  } catch (err) {
    return res.status(500).json({ error: "Unable to start Google auth." });
  }
});

app.get("/api/auth/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    const cookies = parseCookies(req);
    const stored = cookies.google_oauth_state || "";

    if (!code || !state || state !== stored) {
      return res.redirect("/account/?google=error");
    }

    res.cookie("google_oauth_state", "", { maxAge: 0, path: "/" });

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${baseUrl}/api/auth/google/callback`,
      }),
    });

    if (!tokenRes.ok) {
      console.error("[Google OAuth] Token exchange failed:", await tokenRes.text());
      return res.redirect("/account/?google=error");
    }

    const tokenData = await tokenRes.json();

    // Get Google user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return res.redirect("/account/?google=error");
    }

    const googleUser = await userRes.json();
    const email = googleUser.email;

    if (!email) {
      return res.redirect("/account/?google=error");
    }

    // Find or create Supabase user by email
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    let existingUser = userList?.users?.find((u) => u.email === email);

    const tempPassword = crypto.randomBytes(32).toString("hex");

    if (!existingUser) {
      const username = googleUser.name || email.split("@")[0];
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          username,
          google_id: googleUser.id,
          google_avatar: googleUser.picture,
        },
        app_metadata: { provider: "google", providers: ["google"] },
      });
      if (createErr) {
        console.error("[Google OAuth] User creation failed:", createErr.message);
        return res.redirect("/account/?google=error");
      }
      existingUser = created.user;

      try { await sendSignupDiscordAlert(existingUser); } catch {}
    } else {
      // Update password + google metadata
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password: tempPassword,
        user_metadata: {
          ...existingUser.user_metadata,
          google_id: googleUser.id,
          google_avatar: googleUser.picture,
        },
      });
    }

    // Create session
    if (supabaseAuth) {
      const { data: signInData, error: signInErr } = await supabaseAuth.auth.signInWithPassword({
        email: existingUser.email,
        password: tempPassword,
      });

      if (!signInErr && signInData.session) {
        setAuthCookies(res, signInData.session);
      } else {
        console.error("[Google OAuth] Session creation failed:", signInErr?.message);
        return res.redirect("/account/?google=error");
      }
    }

    return res.redirect("/account/?google=linked");
  } catch (err) {
    console.error("[Google OAuth] Callback error:", err.message);
    return res.redirect("/account/?google=error");
  }
});

app.get("/api/auth/discord", async (req, res) => {
  try {
    // If user is signed in, this is a "link" flow; otherwise it's a "sign-in" flow
    let userId = "";
    try {
      const member = await getAuthenticatedUser(req, res);
      if (member) userId = member.id;
    } catch {
      // Not signed in - that's fine, this will be a sign-in flow
    }

    const state = crypto.randomBytes(16).toString("hex");
    const mode = userId ? "link" : "signin";
    res.cookie("discord_oauth_state", `${state}:${userId}:${mode}`, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 300_000,
      path: "/",
    });

    const params = new URLSearchParams({
      client_id: discordClientId,
      redirect_uri: `${baseUrl}/api/auth/discord/callback`,
      response_type: "code",
      scope: "identify guilds guilds.join email connections",
      state,
    });

    return res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
  } catch (err) {
    return res.status(err.status || 500).json({ error: "Unable to start Discord auth." });
  }
});

app.get("/api/auth/discord/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    const cookies = parseCookies(req);
    const stored = cookies.discord_oauth_state || "";
    const parts = stored.split(":");
    const expectedState = parts[0];
    const userId = parts[1] || "";
    const mode = parts[2] || "link";

    if (!code || !state || state !== expectedState) {
      return res.redirect("/account/?discord=error");
    }

    // Clear the state cookie
    res.cookie("discord_oauth_state", "", { maxAge: 0, path: "/" });

    // Exchange code for token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: discordClientId,
        client_secret: discordClientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${baseUrl}/api/auth/discord/callback`,
      }),
    });

    if (!tokenRes.ok) {
      console.error("[Discord OAuth] Token exchange failed:", await tokenRes.text());
      return res.redirect("/account/?discord=error");
    }

    const tokenData = await tokenRes.json();
    // Get Discord user info
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      return res.redirect("/account/?discord=error");
    }

    const discordUser = await userRes.json();
    const discordMeta = {
      discord_id: discordUser.id,
      discord_username: discordUser.username,
      discord_avatar: discordUser.avatar,
      discord_access_token: tokenData.access_token,
      discord_refresh_token: tokenData.refresh_token,
    };

    if (mode === "link" && userId) {
      /* ── Link mode: attach Discord to existing Supabase user ── */
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: discordMeta,
      });
    } else {
      /* ── Sign-in mode: find or create Supabase user by discord_id ── */
      const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const realEmail = discordUser.email || "";
      const syntheticEmail = `discord_${discordUser.id}@halocheats.cc`;
      let existingUser = userList?.users?.find(
        (u) => u.user_metadata?.discord_id === discordUser.id || u.email === syntheticEmail || (realEmail && u.email === realEmail)
      );

      const tempPassword = crypto.randomBytes(32).toString("hex");

      if (!existingUser) {
        // Create new user with real Discord email (fall back to synthetic if none)
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: realEmail || syntheticEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { username: discordUser.username, ...discordMeta },
          app_metadata: { provider: "discord", providers: ["discord"] },
        });
        if (createErr) {
          console.error("[Discord OAuth] User creation failed:", createErr.message);
          return res.redirect("/account/?discord=error");
        }
        existingUser = created.user;

        try { await sendSignupDiscordAlert(existingUser); } catch {}
      } else {
        // Update password + discord tokens for session creation
        const updatePayload = {
          password: tempPassword,
          user_metadata: { ...existingUser.user_metadata, ...discordMeta },
        };
        // Upgrade synthetic email to real Discord email if available
        if (realEmail && existingUser.email === syntheticEmail) {
          updatePayload.email = realEmail;
          updatePayload.email_confirm = true;
        }
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, updatePayload);
        if (updatePayload.email) {
          existingUser.email = updatePayload.email;
        }
      }

      // Create a real Supabase session via signInWithPassword
      if (supabaseAuth) {
        const { data: signInData, error: signInErr } = await supabaseAuth.auth.signInWithPassword({
          email: existingUser.email,
          password: tempPassword,
        });

        if (!signInErr && signInData.session) {
          setAuthCookies(res, signInData.session);
        } else {
          console.error("[Discord OAuth] Session creation failed:", signInErr?.message);
          return res.redirect("/account/?discord=error");
        }
      }
    }

    // Auto-join user to the server
    if (discordGuildId && discordBotToken) {
      try {
        const joinRes = await fetch(`https://discord.com/api/v10/guilds/${discordGuildId}/members/${discordUser.id}`, {
          method: "PUT",
          headers: {
            Authorization: `Bot ${discordBotToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ access_token: tokenData.access_token }),
        });
        if (!joinRes.ok) {
          console.error(`[Discord] Auto-join failed (${joinRes.status}):`, await joinRes.text());
        }
      } catch (joinErr) {
        console.error("[Discord] Auto-join error:", joinErr.message);
      }
    }

    // Assign verified role, remove unverified role
    if (discordBot && discordGuildId && discordVerifiedRoleId) {
      try {
        const guild = await discordBot.guilds.fetch(discordGuildId);
        const member = await guild.members.fetch(discordUser.id).catch(() => null);
        if (member) {
          if (!member.roles.cache.has(discordVerifiedRoleId)) {
            await member.roles.add(discordVerifiedRoleId);
          }
          if (discordUnverifiedRoleId && member.roles.cache.has(discordUnverifiedRoleId)) {
            await member.roles.remove(discordUnverifiedRoleId);
          }
        }
      } catch (roleErr) {
        console.error("[Discord] Role assignment failed:", roleErr.message);
      }
    }

    return res.redirect("/account/?discord=linked");
  } catch (err) {
    console.error("[Discord OAuth] Callback error:", err.message);
    return res.redirect("/account/?discord=error");
  }
});

app.post("/api/auth/discord/unlink", async (req, res) => {
  try {
    const member = await getAuthenticatedUser(req, res);
    const isDiscordOnly = member.email?.startsWith("discord_") && member.email?.endsWith("@halocheats.cc");

    await supabaseAdmin.auth.admin.updateUserById(member.id, {
      user_metadata: {
        discord_id: null,
        discord_username: null,
        discord_avatar: null,
        discord_access_token: null,
        discord_refresh_token: null,
      },
    });

    // Discord-only accounts have no other sign-in method, so sign them out
    if (isDiscordOnly) {
      clearAuthCookies(res);
      return res.json({ ok: true, signedOut: true });
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(err.status || 500).json({ error: "Unable to unlink Discord." });
  }
});

app.get("/api/auth/discord/status", async (req, res) => {
  try {
    const member = await getAuthenticatedUser(req, res);
    const discordId = member.user_metadata?.discord_id || null;
    const discordUsername = member.user_metadata?.discord_username || null;

    return res.json({ linked: Boolean(discordId), discordId, discordUsername });
  } catch (err) {
    return res.status(err.status || 500).json({ error: "Unable to check Discord status." });
  }
});

/* ── Fraud flagging ── */

const DISPOSABLE_EMAIL_DOMAINS = [
  "tempmail.com", "guerrillamail.com", "mailinator.com", "throwaway.email",
  "yopmail.com", "sharklasers.com", "guerrillamailblock.com", "grr.la",
  "dispostable.com", "trashmail.com", "fakeinbox.com", "tempail.com",
  "maildrop.cc", "10minutemail.com", "temp-mail.org", "getnada.com",
  "emailondeck.com", "mintemail.com", "mohmal.com", "burnermail.io",
  "harakirimail.com", "tmail.ws", "getairmail.com",
];

async function checkFraudSignals(userId, email, clientIp) {
  const flags = [];

  // 1. Multiple accounts from same IP
  if (clientIp && signupIpMap.has(clientIp)) {
    const idsFromIp = signupIpMap.get(clientIp);
    if (idsFromIp.length >= 3) {
      flags.push(`Multiple accounts from same IP (${idsFromIp.length} accounts from ${clientIp})`);
    }
  }

  // 2. Rapid orders - 3+ orders in 1 hour
  if (supabaseAdmin && userId) {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentOrders } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("user_id", userId)
        .gte("created_at", oneHourAgo);

      if (recentOrders && recentOrders.length >= 3) {
        flags.push(`Rapid ordering (${recentOrders.length} orders in the last hour)`);
      }
    } catch (err) {
      console.error("[Fraud] Order check error:", err.message);
    }
  }

  // 3. Disposable email domain
  if (email) {
    const domain = email.split("@")[1]?.toLowerCase();
    if (domain && DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
      flags.push(`Disposable email domain (${domain})`);
    }
  }

  return flags;
}

async function sendFraudAlert(flags, userId, email, clientIp, orderDetails) {
  if (!flags.length) return;

  console.warn("[Fraud] Flags raised for user", userId, ":", flags.join("; "));

  if (isConfiguredValue(discordSecurityWebhookUrl)) {
    try {
      await sendDiscordWebhook(discordSecurityWebhookUrl, {
        embeds: [{
          title: "Fraud Alert",
          color: 0xff4444,
          fields: [
            { name: "User ID", value: userId || "Unknown", inline: true },
            { name: "Email", value: email || "Unknown", inline: true },
            { name: "IP", value: clientIp || "Unknown", inline: true },
            { name: "Order", value: orderDetails || "N/A", inline: false },
            { name: "Flags", value: flags.map(f => `- ${f}`).join("\n"), inline: false },
          ],
          timestamp: new Date().toISOString(),
        }],
      });
    } catch (err) {
      console.error("[Fraud] Discord alert error:", err.message);
    }
  }
}

/* ── AI: Cached product catalog string for Groq prompts ── */

let cachedProductCatalogString = null;

function getProductCatalogString() {
  if (cachedProductCatalogString) return cachedProductCatalogString;
  cachedProductCatalogString = products
    .map(p => `- ${p.name} (slug: ${p.slug}) | Game: ${p.game} | Category: ${p.category} | Summary: ${p.summary} | Features: ${p.features.join(", ")}`)
    .join("\n");
  return cachedProductCatalogString;
}

/* ── AI: Live Desk auto-reply ── */

async function generateAILiveDeskReply(thread, userMessage, userContext) {
  if (!groqApiKey) return null;

  // Fetch user's recent orders and keys for personalized help
  let orderInfo = "No order history available.";
  if (supabaseAdmin && userContext?.userId) {
    try {
      const { data: orders } = await supabaseAdmin
        .from("orders")
        .select("id, product_slug, status, created_at")
        .eq("user_id", userContext.userId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (orders && orders.length > 0) {
        orderInfo = orders.map(o =>
          `Order #${o.id}: ${o.product_slug} (${o.status}) - ${new Date(o.created_at).toLocaleDateString()}`
        ).join("\n");
      } else {
        orderInfo = "No orders found for this user.";
      }
    } catch (err) {
      console.error("[AI Live Desk] Order lookup error:", err.message);
    }
  }

  const systemPrompt = `You are the AI support assistant for Halo Cheats (halocheats.cc), a gaming software / mod license key store. Be helpful, concise, and casual.

PRODUCT CATALOG:
${getProductCatalogString()}

USER'S RECENT ORDERS:
${orderInfo}

COMMON TOPICS & ANSWERS:
- Setup instructions: Direct users to /instructions/ page for step-by-step setup guides.
- Account issues: Users can reset passwords from the sign-in page. Contact info changes need support.
- Payment/order status: Orders show in the account dashboard. Stripe payments process instantly. Crypto payments may take 10-30 minutes to confirm.
- HWID resets: Users needing HWID resets should mention the product and we'll help. This requires admin action.
- Refund policy: All sales are final. No refunds. This is stated clearly on the site.
- Product status: Check if a product is "Online" (working) or "Offline" (down for update).

RULES:
- Give direct, helpful answers. Keep responses under 150 words.
- If you can reference the user's orders/keys to personalize the answer, do so.
- If you genuinely cannot help or the question needs human intervention (e.g. HWID reset, billing dispute, technical bug), say so clearly and let the user know a human admin will follow up soon.
- Never make up information about product features or pricing. Refer to the catalog above.
- Do not share any internal system details.`;

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
          { role: "system", content: systemPrompt },
          { role: "user", content: `Support topic: ${thread.subject}\n\nUser message: ${userMessage}` },
        ],
        temperature: 0.4,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      console.error("[AI Live Desk] Groq API error:", response.status);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error("[AI Live Desk] Groq error:", err.message);
    return null;
  }
}

/* ── AI: Discord bot reply ── */

async function generateDiscordAIReply(userMessage, authorTag) {
  if (!groqApiKey) return null;

  const systemPrompt = `You are the AI assistant bot for Halo Cheats (halocheats.cc), a gaming software / mod license key store. You help users in the Discord server.

PRODUCT CATALOG:
${getProductCatalogString()}

COMMON TOPICS:
- Product info, pricing, features, and availability
- Setup help: direct to halocheats.cc/instructions/
- Account issues: direct to halocheats.cc/account/
- HWID resets: tell them to open a live desk ticket at halocheats.cc
- Refund policy: all sales final, no refunds
- Stock: check halocheats.cc/products/ for current availability

RULES:
- Be helpful, concise, and casual. Keep replies under 150 words.
- If the question is about something you don't know, suggest opening a live desk ticket at halocheats.cc.
- Never make up product details. Refer only to catalog info above.
- Don't share system internals or admin info.`;

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
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.5,
        max_tokens: 250,
      }),
    });

    if (!response.ok) {
      console.error("[Discord AI] Groq API error:", response.status);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error("[Discord AI] Groq error:", err.message);
    return null;
  }
}

/* ── AI: Natural language product search ── */

async function aiProductSearch(query) {
  if (!groqApiKey) return null;

  const systemPrompt = `You are a product search engine for Halo Cheats, a gaming mod/cheat store. Given a user's search query, return the product slugs that best match, ranked by relevance.

PRODUCT CATALOG:
${getProductCatalogString()}

RULES:
- Return ONLY a valid JSON array of slug strings, e.g. ["crusader-r6", "vega-r6-external"]
- Rank by relevance to the search query. Consider game name, product name, features, and category.
- If nothing matches, return an empty array [].
- Be generous with matching - include partial matches and related products.
- Return at most 10 results.
- Output ONLY the JSON array, nothing else.`;

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
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.error("[AI Search] Groq API error:", response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "[]";
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return null;
    // Validate slugs - only return ones that actually exist
    const validSlugs = new Set(products.map(p => p.slug));
    return parsed.filter(s => typeof s === "string" && validSlugs.has(s));
  } catch (err) {
    console.error("[AI Search] Groq error:", err.message);
    return null;
  }
}

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

/* ── Reviews: AI moderate + rate (for Discord channel reviews) ── */

async function moderateAndRateReview(reviewText) {
  if (!groqApiKey) {
    return { approved: true, reason: null, rating: 5 };
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
            content: `You are a review moderator for a gaming software store called Halo Cheats. You must do TWO things:
1. Decide if the review is legitimate (reject trolling, spam, gibberish, hate speech, threats, or clearly fake reviews). Accept genuine opinions even if negative.
2. Based on the sentiment and tone, assign a star rating:
   - 5 stars: very positive, loves it, highly recommends
   - 4 stars: positive, good experience, minor nitpicks
   - 3 stars: negative, has complaints or issues
   - 2 stars: very negative, bad experience
   Never give 1 star. Most positive reviews should get 5 stars.
Respond with ONLY valid JSON: {"approved": true, "rating": 5} or {"approved": false, "reason": "brief reason", "rating": 2}`,
          },
          {
            role: "user",
            content: `Review: "${reviewText}"`,
          },
        ],
        temperature: 0.1,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      console.error("Groq API error:", response.status);
      return { approved: true, reason: null, rating: 5 };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(content);
    const rating = Math.max(1, Math.min(5, parseInt(parsed.rating, 10) || 5));
    return {
      approved: Boolean(parsed.approved),
      reason: parsed.reason || null,
      rating,
    };
  } catch (error) {
    console.error("Groq rate+moderate error:", error);
    return { approved: true, reason: null, rating: 5 };
  }
}

/* ── Reviews: public approved reviews ── */
app.get("/api/reviews", async (_req, res) => {
  try {
    const result = await supabaseAdmin
      .from("reviews")
      .select("id, user_id, product_slug, rating, review_text, created_at, discord_username, discord_avatar, source")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(100);

    if (result.error) throw result.error;

    // Batch-fetch usernames for site users (skip Discord-sourced reviews)
    const userIds = [...new Set((result.data || []).map((r) => r.user_id).filter(Boolean))];
    const userMap = {};
    for (const uid of userIds) {
      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(uid);
        const name = normalizeUsername(userData?.user?.user_metadata?.username);
        if (name) userMap[uid] = name;
      } catch { /* skip */ }
    }

    const reviews = (result.data || []).map((r) => {
      const product = products.find((p) =>
        p.variants.some((v) => v.inventorySlug === r.product_slug)
      );
      const username = r.discord_username || userMap[r.user_id] || null;
      return {
        id: r.id,
        product_slug: r.product_slug,
        rating: r.rating,
        review_text: r.review_text,
        created_at: r.created_at,
        product_name: r.source === "discord" ? "Halo Cheats" : (product?.name || r.product_slug),
        username,
        avatar: r.discord_avatar || null,
        source: r.source || "site",
      };
    });

    return res.json({ reviews });
  } catch (error) {
    return res.status(500).json({ error: "Unable to load reviews." });
  }
});

/* ── Reviews: admin list all ── */
app.get("/api/admin/reviews", async (req, res) => {
  try {
    await getAuthenticatedUser(req, res);
    ensureOwnerAccess(req);

    const result = await supabaseAdmin
      .from("reviews")
      .select("id, user_id, product_slug, rating, review_text, status, created_at, discord_username, source")
      .order("created_at", { ascending: false })
      .limit(200);

    if (result.error) throw result.error;

    const userIds = [...new Set((result.data || []).map((r) => r.user_id).filter(Boolean))];
    const userMap = {};
    for (const uid of userIds) {
      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(uid);
        userMap[uid] = userData?.user?.user_metadata?.username || userData?.user?.email || uid;
      } catch {}
    }

    const reviews = (result.data || []).map((r) => ({
      id: r.id,
      username: r.discord_username || userMap[r.user_id] || "Unknown",
      rating: r.rating,
      review_text: r.review_text,
      status: r.status,
      source: r.source || "site",
      created_at: r.created_at,
    }));

    return res.json({ reviews });
  } catch (error) {
    return res.status(error.status || 500).json({ error: "Unable to load reviews." });
  }
});

/* ── Reviews: admin delete ── */
app.delete("/api/admin/reviews/:id", async (req, res) => {
  try {
    await getAuthenticatedUser(req, res);
    ensureOwnerAccess(req);

    const { error } = await supabaseAdmin.from("reviews").delete().eq("id", req.params.id);
    if (error) throw error;

    return res.json({ success: true });
  } catch (error) {
    return res.status(error.status || 500).json({ error: "Unable to delete review." });
  }
});

/* ── Reviews: user's reviewable purchases ── */
app.get("/api/reviews/my-purchases", async (req, res) => {
  try {
    const member = await getAuthenticatedUser(req, res);

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
    const member = await getAuthenticatedUser(req, res);
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

/* ── Key expiry reminders (week & month keys) ── */
const KEY_DURATIONS = {
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};
const EXPIRY_REMINDER_HOURS = 24; // remind 24 hours before expiry
const expiryRemindedSet = new Set(); // track order IDs already reminded

async function checkKeyExpiry() {
  if (!supabaseAdmin || !discordBot) return;

  try {
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, product_slug, fulfilled_at")
      .eq("status", "fulfilled")
      .not("fulfilled_at", "is", null);

    if (error || !orders) return;

    const now = Date.now();

    for (const order of orders) {
      if (expiryRemindedSet.has(order.id)) continue;

      // Check if this is a week or month key
      let duration = null;
      if (order.product_slug.endsWith("-week")) duration = KEY_DURATIONS.week;
      else if (order.product_slug.endsWith("-month")) duration = KEY_DURATIONS.month;
      else continue;

      const fulfilledAt = new Date(order.fulfilled_at).getTime();
      const expiresAt = fulfilledAt + duration;
      const reminderAt = expiresAt - EXPIRY_REMINDER_HOURS * 60 * 60 * 1000;

      if (now >= reminderAt && now < expiresAt) {
        expiryRemindedSet.add(order.id);

        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(order.user_id);
        const discordId = userData?.user?.user_metadata?.discord_id;
        if (!discordId) continue;

        const catalogItem = getCatalogItemByInventorySlug(order.product_slug);
        const productLabel = catalogItem?.name || order.product_slug;
        const hoursLeft = Math.max(1, Math.round((expiresAt - now) / (60 * 60 * 1000)));

        const expiryUser = await discordBot.users.fetch(discordId);
        await expiryUser.send({
          embeds: [{
            title: "Key Expiring Soon",
            description: `Your key for **${productLabel}** expires in about **${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}**.`,
            color: 0xffa500,
            fields: [
              { name: "Renew", value: `[Browse Products](${baseUrl}/products/)`, inline: false },
            ],
            footer: { text: "Halo Cheats" },
          }],
        });
        console.log(`[Expiry] Reminded user ${order.user_id} about ${order.product_slug}`);
      }
    }
  } catch (err) {
    console.error("[Expiry check]", err.message);
  }
}

// Run every 30 minutes
setInterval(checkKeyExpiry, 30 * 60 * 1000);
setTimeout(checkKeyExpiry, 15_000); // first check 15s after boot

/* ── Restock alerts ── */
const lastStockCounts = new Map();
let restockInitialized = false;

async function checkRestockAlerts() {
  if (!supabaseAdmin || !discordBot || !discordRestockChannelId) return;

  try {
    const counts = await getUnusedLicenseKeyCounts();

    if (!restockInitialized) {
      // First run: just save current counts, don't alert
      for (const [slug, count] of counts) {
        lastStockCounts.set(slug, count);
      }
      restockInitialized = true;
      console.log("[Restock] Initialized stock snapshot");
      return;
    }

    for (const [slug, count] of counts) {
      const prev = lastStockCounts.get(slug) || 0;

      if (count > prev && prev === 0) {
        // Product went from 0 to in-stock: restock alert
        const catalogItem = getCatalogItemByInventorySlug(slug);
        const productLabel = catalogItem?.name || slug;

        try {
          const channel = await discordBot.channels.fetch(discordRestockChannelId);
          if (channel) {
            await channel.send({
              embeds: [{
                title: "Restock Alert",
                description: `**${productLabel}** is back in stock! (${count} ${count === 1 ? "key" : "keys"} available)`,
                color: 0x00c851,
                timestamp: new Date().toISOString(),
                footer: { text: "Halo Cheats" },
              }],
            });
          }
        } catch (sendErr) {
          console.error("[Restock] Channel send error:", sendErr.message);
        }
      }

      lastStockCounts.set(slug, count);
    }

    // Also check for products that went to 0 (removed from counts map)
    for (const [slug] of lastStockCounts) {
      if (!counts.has(slug)) {
        lastStockCounts.set(slug, 0);
      }
    }
  } catch (err) {
    console.error("[Restock check]", err.message);
  }
}

// Run every 2 minutes
setInterval(checkRestockAlerts, 2 * 60 * 1000);
setTimeout(checkRestockAlerts, 10_000); // first check 10s after boot

/* ── 404 catch-all ── */
app.use((_req, res) => {
  res.status(404).sendFile(path.join(distDir, "404.html"));
});

/* ── Load product overrides from Supabase on startup ── */
async function loadProductOverrides() {
  if (!supabaseAdmin) return;
  try {
    const { data, error } = await supabaseAdmin
      .from("product_overrides")
      .select("product_slug, variant_slug, available, amount");
    if (error) { console.error("Failed to load product overrides:", error.message); return; }
    if (!data || !data.length) return;

    for (const row of data) {
      const product = products.find((p) => p.slug === row.product_slug);
      if (!product) continue;

      if (row.variant_slug === null && typeof row.available === "boolean") {
        product.available = row.available;
      }

      if (row.variant_slug) {
        const variant = product.variants?.find((v) => v.slug === row.variant_slug);
        if (variant && typeof row.amount === "number") {
          variant.amount = row.amount;
          variant.priceDisplay = `$${(row.amount / 100).toFixed(2)}`;
        }
      }
    }
    // Recalculate "From $X.XX" for any product that had variant overrides
    const touched = new Set(data.filter((r) => r.variant_slug).map((r) => r.product_slug));
    for (const slug of touched) {
      const product = products.find((p) => p.slug === slug);
      if (product?.variants?.length) {
        const minAmount = Math.min(...product.variants.map((v) => v.amount));
        product.priceDisplay = `From $${(minAmount / 100).toFixed(2)}`;
      }
    }
    console.log(`Loaded ${data.length} product override(s) from database.`);
  } catch (err) {
    console.error("Error loading product overrides:", err.message);
  }
}

loadProductOverrides().then(() => {
  app.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);
  });
});
