import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { products } from "./data/products.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 4242);
const distDir = path.join(__dirname, "dist");
const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL || "";
const discordLiveDeskMention = process.env.DISCORD_LIVE_DESK_MENTION || "";
const adminAccessKey = process.env.ADMIN_ACCESS_KEY || "";
const liveDeskCooldownMs = 45_000;
const liveDeskCooldownByIp = new Map();

function isConfiguredValue(value) {
  return Boolean(value && !/(replace_me|your_supabase|your-project|your_)/i.test(value));
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

function getAuthToken(req) {
  const authorization = req.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
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

  if (!token) {
    throw Object.assign(new Error("Sign in before using this action."), {
      status: 401,
    });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
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

function ensureAdminAccess(req) {
  if (!isConfiguredValue(adminAccessKey)) {
    throw Object.assign(new Error("Admin desk is not configured yet."), {
      status: 500,
    });
  }

  if (req.headers["x-admin-key"] !== adminAccessKey) {
    throw Object.assign(new Error("Admin access denied."), {
      status: 401,
    });
  }
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

    return;
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
    .select("id")
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
    })
    .eq("id", order.id);

  if (orderUpdateError) {
    throw orderUpdateError;
  }
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
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }
  }
);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/products", (_req, res) => {
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
    featured: product.featured,
    available: product.available !== false,
    variants: (product.variants || []).map((variant) => ({
      slug: variant.slug,
      name: variant.name,
      stockLabel: variant.stockLabel || "In Stock",
      priceDisplay: variant.priceDisplay,
      checkoutReady:
        product.available !== false &&
        Boolean(stripe) &&
        isConfiguredValue(process.env[variant.stripeEnvKey]),
    })),
    checkoutReady:
      product.available !== false &&
      Boolean(stripe) &&
      (product.variants || []).some((variant) =>
        isConfiguredValue(process.env[variant.stripeEnvKey])
      ),
  }));

  res.json({ products: catalog });
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

  const name = trimField(req.body?.name, 80);
  const contact = trimField(req.body?.contact, 140);
  const topic = trimField(req.body?.topic, 80);
  const details = trimField(req.body?.details, 900);
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
      const discordResponse = await sendLiveDeskDiscordAlert(
        threadInsert.data,
        messageInsert.data,
        member
      );

      if (discordResponse && discordResponse.ok === false) {
        throw new Error(`Discord webhook failed with status ${discordResponse.status}.`);
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
      error:
        error instanceof Error ? error.message : "Unable to send the live desk request.",
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
      error: error instanceof Error ? error.message : "Unable to load desk threads.",
    });
  }
});

app.post("/api/live-desk/reply", async (req, res) => {
  try {
    const member = await getAuthenticatedUser(req);
    const threadId = trimField(req.body?.threadId, 80);
    const body = trimField(req.body?.body, 900);

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
      error: error instanceof Error ? error.message : "Unable to send your desk reply.",
    });
  }
});

app.get("/api/admin/live-desk", async (req, res) => {
  try {
    ensureAdminAccess(req);

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
      error: error instanceof Error ? error.message : "Unable to load admin desk threads.",
    });
  }
});

app.post("/api/admin/live-desk/reply", async (req, res) => {
  try {
    ensureAdminAccess(req);

    const threadId = trimField(req.body?.threadId, 80);
    const body = trimField(req.body?.body, 900);
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
      error: error instanceof Error ? error.message : "Unable to send the admin reply.",
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
        .select("id, product_slug, status, created_at, fulfilled_at")
        .eq("user_id", member.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("license_keys")
        .select("id, product_slug, key_value, status, assigned_at")
        .eq("assigned_user_id", member.id)
        .order("assigned_at", { ascending: false }),
    ]);

    if (ordersResult.error) {
      throw ordersResult.error;
    }

    if (keysResult.error) {
      throw keysResult.error;
    }

    res.json({
      user: {
        id: member.id,
        email: member.email,
      },
      orders: (ordersResult.data || []).map(normalizeOrder),
      licenseKeys: (keysResult.data || []).map((licenseKey) => {
        const catalogItem = getCatalogItemByInventorySlug(licenseKey.product_slug);

        return {
          id: licenseKey.id,
          productSlug: licenseKey.product_slug,
          productName: catalogItem?.name || licenseKey.product_slug,
          keyValue: licenseKey.key_value,
          assignedAt: licenseKey.assigned_at,
          status: licenseKey.status,
        };
      }),
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error:
        error instanceof Error ? error.message : "Unable to load account data right now.",
    });
  }
});

app.post("/api/create-checkout-session", async (req, res) => {
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
      error:
        error instanceof Error ? error.message : "Unable to create checkout session.",
    });
  }
});

app.use(express.static(distDir));

const pageRoutes = new Map([
  ["/", "index.html"],
  ["/products", "products/index.html"],
  ["/account", "account/index.html"],
  ["/status", "status/index.html"],
  ["/desk", "desk/index.html"],
  ["/desk-admin", "desk-admin/index.html"],
  ["/checkout/success", "checkout/success/index.html"],
  ["/checkout/cancel", "checkout/cancel/index.html"],
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
