import { getCurrentSession } from "./supabase-client.js";

const params = new URLSearchParams(window.location.search);
const sessionId = params.get("session_id");
const loading = document.getElementById("orderLoading");
const content = document.getElementById("orderContent");

async function verifyOrder() {
  if (!sessionId) {
    showError("No session ID found. If you just completed a payment, check your account page.");
    return;
  }

  const session = await getCurrentSession();
  if (!session) {
    window.location.href = `/account/?next=/checkout/success/?session_id=${sessionId}`;
    return;
  }

  try {
    const res = await fetch(
      `/api/checkout/complete?session_id=${encodeURIComponent(sessionId)}`,
      {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }
    );

    const data = await res.json();

    if (!res.ok) {
      showError(data.error || "Something went wrong verifying your order.");
      return;
    }

    showOrder(data);
  } catch (err) {
    showError(
      "Could not verify your order. Check your account page or contact support."
    );
  }
}

function showOrder(data) {
  loading.style.display = "none";
  content.style.display = "block";

  const keyList = Array.isArray(data.keys) ? data.keys.filter(Boolean) : [];
  const hasKeys = keyList.length > 0;

  let keyHtml;
  if (hasKeys) {
    keyHtml = keyList
      .map(
        (key) => `
      <div class="key-display">
        <div class="key-label">Your License Key</div>
        <div class="key-value">${escapeHtml(String(key))}</div>
        <button class="copy-btn" data-copy-key="${escapeAttr(String(key))}">Copy Key</button>
      </div>
    `
      )
      .join("");
  } else {
    keyHtml = `
      <div class="key-display">
        <div class="key-label">Key Assignment</div>
        <div style="color:var(--muted);">Your key is being prepared. Check your account page shortly.</div>
      </div>
    `;
  }

  content.innerHTML = `
    <div class="order-result">
      <p class="eyebrow">Order Complete</p>
      <h2>Thank you for your purchase!</h2>
      <p class="order-subtitle">${escapeHtml(data.productName || "")}</p>
      ${keyHtml}
      <div class="order-meta">
        <span>Order ID: ${escapeHtml(data.orderId || "")}</span>
        <span>A receipt has been sent to your email.</span>
      </div>
      <div class="dashboard-actions" style="margin-top:24px;">
        <a class="button button-primary" href="/account/">View Account</a>
        <a class="button button-secondary" href="/products/">Back to Products</a>
      </div>
    </div>
  `;

  content.querySelectorAll("[data-copy-key]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.copyKey;
      try {
        await navigator.clipboard.writeText(key);
        btn.textContent = "Copied!";
        setTimeout(() => {
          btn.textContent = "Copy Key";
        }, 2000);
      } catch {
        btn.textContent = "Select and copy manually";
      }
    });
  });
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
