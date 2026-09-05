import { getCurrentSession } from "./supabase-client.js";

const params = new URLSearchParams(window.location.search);
const sessionId = params.get("session_id");
const guestToken = params.get("guest_token");
const cryptoOrderId = params.get("order_id");
const paymentMethod = params.get("method");
const loading = document.getElementById("orderLoading");
const content = document.getElementById("orderContent");
const fulfillmentRetryDelaysMs = [2500, 5000, 8000, 12000, 16000];
const COPY_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>';
const DOWNLOAD_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 19h14"/></svg>';

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
  const amountCents = Number(data.amountCents);
  const amountLabel = Number.isFinite(amountCents) && amountCents >= 0
    ? `$${(amountCents / 100).toFixed(2)}`
    : "Paid";
  const customerEmail = String(data.customerEmail || "").trim();
  const itemCount = Number(data.quantity) > 0 ? Number(data.quantity) : deliveryItems.length;
  const statusLabel = data.status === "fulfilled" ? "Fulfilled" : "Payment confirmed";

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
          <span class="delivery-heading-meta"><span class="delivery-status ${delivered ? "is-delivered" : "is-processing"}">${statusLabel}</span><span class="delivery-chevron" aria-hidden="true">⌄</span></span>
        </summary>
        <div class="delivery-item-body">
          ${instructions.length ? `
            <div class="delivery-section-label">Instructions</div>
            <div class="delivery-instructions" role="list">${instructions.map((instruction, instructionIndex) => `<div role="listitem"><span class="delivery-step-number" aria-hidden="true">${instructionIndex + 1}</span><span>${escapeHtml(instruction)}</span></div>`).join("")}</div>
          ` : ""}
          ${detailValue ? `
            <div class="delivery-section-label">Deliverables</div>
            <div class="delivery-value-wrap">
              <code class="delivery-value">${escapeHtml(detailValue)}</code>
              <button type="button" class="copy-btn" data-copy-delivery="${escapeAttr(detailValue)}" data-copy-label="Copy ${accountDetails ? "details" : "key"}"><span class="copy-btn-icon">${COPY_ICON_SVG}</span><span data-copy-label-text>Copy ${accountDetails ? "details" : "key"}</span></button>
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
      <button type="button" class="button button-secondary button-small action-button" data-copy-all-delivery data-copy-label="Copy all"><span class="action-button-icon">${COPY_ICON_SVG}</span><span data-copy-label-text>Copy all</span></button>
      <button type="button" class="button button-secondary button-small action-button" data-download-delivery><span class="action-button-icon">${DOWNLOAD_ICON_SVG}</span><span>Save file</span></button>
    </div>
  ` : "";

  content.innerHTML = `
    <div class="checkout-layout">
      <aside class="checkout-sidebar" aria-label="Order summary">
        <a class="checkout-brand" href="/" aria-label="XenCheats home">
          <span class="checkout-brand-mark">X</span>
          <span>XenCheats</span>
        </a>
        <div class="sidebar-total">
          <span class="sidebar-kicker">Order total</span>
          <strong>${amountLabel}</strong>
        </div>
        <div class="sidebar-product">
          <span class="sidebar-product-art" aria-hidden="true">XC</span>
          <span class="sidebar-product-copy">
            <strong>${escapeHtml(data.productName || "Your order")}</strong>
            <small>${itemCount === 1 ? "1 item" : `${itemCount} items`}</small>
          </span>
        </div>
        <div class="sidebar-breakdown">
          <div><span>Subtotal</span><strong>${amountLabel}</strong></div>
          <div><span>Status</span><strong class="sidebar-status">${statusLabel}</strong></div>
        </div>
        <div class="sidebar-email">
          <span class="sidebar-email-icon" aria-hidden="true">✉</span>
          <div>
            <strong>Check your email</strong>
            <p>${customerEmail ? `We've sent your receipt to <b>${escapeHtml(customerEmail)}</b>.` : "Your receipt has been sent to the email used at checkout."}</p>
            <small>Check your spam or junk folder if you don't see it.</small>
          </div>
        </div>
        <a class="sidebar-help" href="/#support">Need help? Contact support <span aria-hidden="true">→</span></a>
      </aside>
      <section class="checkout-main">
      <nav class="checkout-progress" aria-label="Checkout progress">
        <span class="progress-step is-done"><span class="progress-dot">✓</span>Order information</span>
        <span class="progress-step is-done"><span class="progress-dot">✓</span>Confirm &amp; pay</span>
        <span class="progress-step is-current"><span class="progress-dot">✓</span>Receive your items</span>
      </nav>
      <div class="success-hero">
        <span class="success-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="m8 12 2.7 2.7L16.5 9"></path></svg></span>
        <p class="eyebrow">Order complete</p>
        <h2>Thank you for your purchase!</h2>
        <p class="order-subtitle">Your items are ready. Check below for your product details.</p>
      </div>
      ${deliveryCards ? `<section class="delivered-items" aria-label="Delivered items"><div class="delivered-items-heading"><span>Delivered items</span>${bulkActions}</div>${deliveryCards}</section>` : fallbackProcessing}
      <div class="order-meta">
        <span>Order ID: ${escapeHtml(data.orderId || "")}</span>
        <span>A receipt has been sent to your email.</span>
      </div>
      <div class="dashboard-actions" style="margin-top:24px;">
        <a class="button button-primary" href="/account/">${isGuestCheckout ? "Create an account" : "View Account"}</a>
        <a class="button button-secondary" href="/products/">Back to Products</a>
      </div>
      </section>
    </div>
  `;

  const setCopyButtonLabel = (btn, label, success = false) => {
    const text = btn.querySelector("[data-copy-label-text]");
    if (text) text.textContent = label;
    btn.classList.toggle("is-success", success);
    btn.setAttribute("aria-label", label);
  };
  const copyText = async (value, btn, label) => {
    const originalLabel = btn.dataset.copyLabel || label;
    try {
      await navigator.clipboard.writeText(value);
      setCopyButtonLabel(btn, "Copied to clipboard", true);
      setTimeout(() => { setCopyButtonLabel(btn, originalLabel); }, 2000);
    } catch {
      setCopyButtonLabel(btn, "Copy manually");
      setTimeout(() => { setCopyButtonLabel(btn, originalLabel); }, 2500);
    }
  };
  content.querySelectorAll("[data-copy-delivery]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await copyText(btn.dataset.copyDelivery, btn, btn.textContent);
    });
  });
  content.querySelector("[data-copy-all-delivery]")?.addEventListener("click", async (event) => {
    await copyText(combinedDelivery, event.currentTarget, "Copy all");
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
