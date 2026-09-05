import { getCurrentSession } from "./supabase-client.js";

const params = new URLSearchParams(window.location.search);
const sessionId = params.get("session_id");
const guestToken = params.get("guest_token");
const cryptoOrderId = params.get("order_id");
const paymentMethod = params.get("method");
const loading = document.getElementById("orderLoading");
const content = document.getElementById("orderContent");
const fulfillmentRetryDelaysMs = [2500, 5000, 8000, 12000, 16000];

async function requestCheckoutResult(session, query) {
  const res = await fetch(
    `/api/checkout/complete?${query.toString()}`,
    {
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {},
    }
  );

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = { error: "The checkout verification response was invalid." };
  }

  return { res, data };
}

function shouldWaitForFulfillment(data) {
  return data?.status === "paid"
    && !(Array.isArray(data.keys) && data.keys.some(Boolean))
    && !data.manualDelivery
    && !data.discordKeyDelivery;
}

async function verifyOrder() {
  /* Crypto payments: IPN may not have fired yet, show processing message */
  if (paymentMethod === "crypto" && cryptoOrderId) {
    showCryptoProcessing(cryptoOrderId);
    return;
  }

  if (!sessionId) {
    showError("No session ID found. If you just completed a payment, check your account page.");
    return;
  }

  const session = await getCurrentSession();
  if (!session && !guestToken) {
    window.location.href = `/account/?next=/checkout/success/?session_id=${sessionId}`;
    return;
  }

  try {
    const query = new URLSearchParams({ session_id: sessionId });
    if (guestToken) query.set("guest_token", guestToken);
    const isGuestCheckout = Boolean(guestToken && !session);
    let result = await requestCheckoutResult(session, query);

    if (!result.res.ok) {
      /* A paid Stripe session can briefly outlive the fulfillment request.
         Retry only transient server failures; never retry authorization or
         payment-state errors. The endpoint is order-locked and idempotent. */
      for (const delayMs of fulfillmentRetryDelaysMs) {
        if (result.res.status < 500) break;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        result = await requestCheckoutResult(session, query);
        if (result.res.ok || result.res.status < 500) break;
      }
    }

    if (!result.res.ok) {
      showError(explainCheckoutError(result.res.status, result.data.error));
      return;
    }

    showOrder(result.data, isGuestCheckout);

    /* RFT delivery is normally synchronous, but a successful payment may
       return before the supplier response has been persisted locally. Keep
       the customer on a useful confirmation state while the webhook or the
       first completion request finishes. This only reads the same order and
       never creates another supplier purchase. */
    if (shouldWaitForFulfillment(result.data)) {
      for (const delayMs of fulfillmentRetryDelaysMs) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        result = await requestCheckoutResult(session, query);
        if (!result.res.ok) {
          if (result.res.status >= 500) continue;
          break;
        }
        showOrder(result.data, isGuestCheckout);
        if (!shouldWaitForFulfillment(result.data)) break;
      }
    }
  } catch (err) {
    showError(
      "Could not verify your order. Check your account page or contact support."
    );
  }
}

function showOrder(data, isGuestCheckout = false) {
  loading.style.display = "none";
  content.style.display = "block";

  const legacyKeys = Array.isArray(data.keys) ? data.keys.filter(Boolean) : [];
  const deliveryItems = Array.isArray(data.deliveryItems) && data.deliveryItems.length
    ? data.deliveryItems
    : legacyKeys.map((key) => ({
      productName: data.productName || "Delivered item",
      status: data.status || "fulfilled",
      keyValue: String(key),
      accountDetails: "",
      instructions: [],
      instructionHref: "/instructions/",
    }));
  const copyValues = deliveryItems
    .map((item) => item.accountDetails || item.keyValue)
    .filter(Boolean);
  const combinedDelivery = copyValues.join("\n");

  const deliveryCards = deliveryItems.map((item, index) => {
    const accountDetails = String(item.accountDetails || "").trim();
    const keyValue = String(item.keyValue || "").trim();
    const instructions = Array.isArray(item.instructions) ? item.instructions.filter(Boolean) : [];
    const delivered = Boolean(accountDetails || keyValue) && item.status === "fulfilled";
    const statusLabel = delivered ? "✓ Delivered" : "Processing";
    const detailValue = accountDetails || keyValue;
    return `
      <details class="delivery-item" ${index === 0 ? "open" : ""}>
        <summary class="delivery-item-heading">
          <span>
            <strong>${escapeHtml(item.productName || data.productName || "Delivered item")}</strong>
            ${item.variantName ? `<small>${escapeHtml(item.variantName)}</small>` : ""}
          </span>
          <span class="delivery-status ${delivered ? "is-delivered" : "is-processing"}">${statusLabel}</span>
        </summary>
        <div class="delivery-item-body">
          ${instructions.length ? `
            <div class="delivery-section-label">Instructions</div>
            <ol class="delivery-instructions">${instructions.map((instruction) => `<li>${escapeHtml(instruction)}</li>`).join("")}</ol>
          ` : ""}
          ${detailValue ? `
            <div class="delivery-section-label">Deliverables</div>
            <div class="delivery-value-wrap">
              <code class="delivery-value">${escapeHtml(detailValue)}</code>
              <button type="button" class="copy-btn" data-copy-delivery="${escapeAttr(detailValue)}">Copy ${accountDetails ? "Details" : "Key"}</button>
            </div>
          ` : `<p class="delivery-processing-copy">Payment confirmed. This item is still being prepared.</p>`}
          ${item.instructionHref ? `<a class="delivery-guide-link" href="${escapeAttr(item.instructionHref)}">Open setup guide</a>` : ""}
        </div>
      </details>
    `;
  }).join("");

  const fallbackProcessing = !deliveryCards ? `
    <div class="key-display">
      <div class="key-label">Payment Confirmed</div>
      <div style="color:var(--muted);">Your payment is confirmed. This item is still being prepared.</div>
    </div>
  ` : "";
  const bulkActions = combinedDelivery ? `
    <div class="delivery-actions">
      <button type="button" class="button button-secondary button-small" data-copy-all-delivery>Copy All</button>
      <button type="button" class="button button-secondary button-small" data-download-delivery>Download</button>
    </div>
  ` : "";

  content.innerHTML = `
    <div class="order-result">
      <p class="eyebrow">Order Complete</p>
      <h2>Thank you for your purchase!</h2>
      <p class="order-subtitle">${escapeHtml(data.productName || "")}</p>
      ${deliveryCards ? `<section class="delivered-items" aria-label="Delivered items"><div class="delivered-items-heading"><span>Delivered items</span>${bulkActions}</div>${deliveryCards}</section>` : fallbackProcessing}
      <div class="order-meta">
        <span>Order ID: ${escapeHtml(data.orderId || "")}</span>
        <span>A receipt has been sent to your email.</span>
      </div>
      <div class="dashboard-actions" style="margin-top:24px;">
        <a class="button button-primary" href="/account/">${isGuestCheckout ? "Create an account" : "View Account"}</a>
        <a class="button button-secondary" href="/products/">Back to Products</a>
      </div>
    </div>
  `;

  const copyText = async (value, btn, label) => {
    try {
      await navigator.clipboard.writeText(value);
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = label; }, 2000);
    } catch {
      btn.textContent = "Select and copy manually";
    }
  };
  content.querySelectorAll("[data-copy-delivery]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await copyText(btn.dataset.copyDelivery, btn, btn.textContent);
    });
  });
  content.querySelector("[data-copy-all-delivery]")?.addEventListener("click", async (event) => {
    await copyText(combinedDelivery, event.currentTarget, "Copy All");
  });
  content.querySelector("[data-download-delivery]")?.addEventListener("click", () => {
    const blob = new Blob([combinedDelivery], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `xencheats-delivery-${String(data.orderId || "order").slice(0, 12)}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  });
}

function showCryptoProcessing(orderId) {
  loading.style.display = "none";
  content.style.display = "block";
  content.innerHTML = `
    <div class="order-result">
      <p class="eyebrow">Crypto Payment</p>
      <h2>Payment is being processed</h2>
      <p class="order-subtitle">Your crypto payment is being confirmed on the blockchain. This can take a few minutes depending on network traffic.</p>
      <div class="key-display">
        <div class="key-label">What happens next</div>
        <div style="color:var(--muted);">Once the payment is confirmed, your license key will appear on your account page and be sent via Discord DM.</div>
      </div>
      <div class="order-meta">
        <span>Order ID: ${escapeHtml(orderId)}</span>
      </div>
      <div class="dashboard-actions" style="margin-top:24px;">
        <a class="button button-primary" href="/account/">View Account</a>
        <a class="button button-secondary" href="/products/">Back to Products</a>
      </div>
    </div>
  `;
}

function showError(message) {
  loading.style.display = "none";
  content.style.display = "block";
  content.innerHTML = `
    <div class="order-result">
      <p class="eyebrow">Checkout</p>
      <h2>Something went wrong</h2>
      <p class="order-subtitle">${escapeHtml(message)}</p>
      <div class="dashboard-actions" style="margin-top:24px;">
        <a class="button button-primary" href="/account/">Check Account</a>
        <a class="button button-secondary" href="/products/">Back to Products</a>
      </div>
    </div>
  `;
}

function explainCheckoutError(status, serverMessage = "") {
  if (status === 401 || status === 403) return "Your checkout session is no longer valid. Sign in again, then open your account to check the order.";
  if (status === 404) return "We could not find this checkout session. Check your account orders or contact support with your payment receipt.";
  if (status === 409) return serverMessage || "This order is already being processed. Check your account shortly before trying again.";
  if (status >= 500) return "The payment went through, but the store could not finish checking the order. Wait a few minutes, then check your account or contact support.";
  return serverMessage || "We could not verify this order. Check your account or contact support with your order details.";
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, "&#39;");
}

verifyOrder();
