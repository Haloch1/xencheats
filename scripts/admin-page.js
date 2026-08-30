/* ── Admin Dashboard ── */

const loginGate = document.getElementById("loginGate");
const dashboard = document.getElementById("dashboard");
const loginError = document.getElementById("loginError");
const orderModal = document.getElementById("orderModal");
const orderModalContent = document.getElementById("orderModalContent");
const adminActionToast = document.getElementById("adminActionToast");

const panels = document.querySelectorAll(".admin-panel");
const navItems = document.querySelectorAll("[data-panel]");

let isAuthed = false;
let overviewRangeDays = 7;

function showAdminToast(message, tone = "success") {
  if (!adminActionToast) return;
  adminActionToast.hidden = false;
  adminActionToast.textContent = message;
  adminActionToast.dataset.tone = tone;
  clearTimeout(adminActionToast._hideTimer);
  adminActionToast._hideTimer = setTimeout(() => {
    adminActionToast.hidden = true;
  }, 2600);
}

// ── Helpers ──

function esc(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(val) {
  if (!val) return "-";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(val));
}

function fmtMoney(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function shortId(id) {
  if (!id) return "-";
  return id.length > 12 ? id.slice(0, 8) + "..." : id;
}

/* Renders a full value (order ID, key, etc.) in monospace with a copy
   button, instead of forcing admins to open a modal just to read/copy it. */
function copyCell(value, emptyLabel = "—") {
  if (!value) return `<span class="cell-empty">${emptyLabel}</span>`;
  const safe = esc(value);
  return `<span class="copy-cell"><code>${safe}</code><button type="button" class="copy-btn" data-copy-value="${safe}" title="Copy" aria-label="Copy">⧉</button></span>`;
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy-value]");
  if (!button) return;
  try {
    await navigator.clipboard.writeText(button.getAttribute("data-copy-value"));
    const original = button.textContent;
    button.textContent = "✓";
    button.classList.add("copied");
    showAdminToast("Copied to clipboard.");
    setTimeout(() => {
      button.textContent = original;
      button.classList.remove("copied");
    }, 1200);
  } catch {
    // Clipboard API unavailable — the value is still visible/selectable.
  }
});

function chip(status) {
  return `<span class="chip chip-${esc(status)}">${esc(status)}</span>`;
}

/* Shows a clear, visible error row in a table body instead of leaving it
   stuck on its initial "Loading..." row forever when a fetch fails.
   loadPanel() re-fetches every time its sidebar item is clicked (including
   re-clicking the already-open tab), so no separate retry button is
   needed — reopening the tab is the retry. */
function tableError(tbodyId, colspan, context) {
  const tbody = document.getElementById(tbodyId);
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="error-state">Couldn't load ${esc(context)}. Reopen this tab to try again.</td></tr>`;
  }
}

/* Revenue/stat card values are usually a short dollar figure, but the
   server sends a full sentence — "Unavailable (N cost records missing)" —
   when a cost can't be confirmed yet (see CLAUDE.md: never show a missing
   cost as $0.00). Every card's color/border is otherwise hardcoded per
   field in the HTML, so that sentence used to render at full size in
   whatever color the field normally uses (e.g. green, implying a good
   number) and wrap awkwardly. Toggle a class instead of touching el.style
   so the element's own inline color still applies for real values. */
function setStatValue(el, text) {
  if (!el) return;
  const str = String(text ?? "-");
  const isPlaceholder = /^(Unavailable|Unknown)\b/.test(str);
  el.textContent = str;
  el.classList.toggle("is-placeholder", isPlaceholder);
  const card = el.closest(".revenue-card, .stat-card");
  if (card) card.classList.toggle("is-placeholder", isPlaceholder);
}

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, { credentials: "include", ...opts });
  if (res.status === 401) {
    isAuthed = false;
    showLogin();
    throw new Error("Not authenticated");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    isAuthed = false;
    showLogin();
    throw new Error("Not authenticated");
  }
  return res.json();
}

async function apiDelete(url) {
  const res = await fetch(url, { method: "DELETE", credentials: "include" });
  if (res.status === 401) {
    isAuthed = false;
    showLogin();
    throw new Error("Not authenticated");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Auth ──

function showLogin() {
  loginGate.style.display = "block";
  dashboard.style.display = "none";
}

function showDashboard() {
  loginGate.style.display = "none";
  dashboard.style.display = "flex";
}

// Check role from session
async function checkAuth() {
  try {
    const res = await fetch("/api/auth/role", { credentials: "include" });
    const data = await res.json();
    if (data.role === "admin") {
      isAuthed = true;
      showDashboard();
      loadOverview();
    } else {
      loginError.textContent = data.role
        ? "Your account has staff access only. Use the Desk Admin page."
        : "Sign in with an admin account to access this panel.";
      loginError.style.display = "block";
      showLogin();
    }
  } catch {
    showLogin();
  }
}

// ── Navigation ──

navItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.panel;
    navItems.forEach((b) => b.classList.toggle("is-active", b === btn));
    panels.forEach((p) =>
      p.classList.toggle("is-active", p.id === `panel-${target}`)
    );
    loadPanel(target);
  });
});

document.addEventListener("click", (event) => {
  const rangeButton = event.target.closest("[data-overview-range]");
  if (!rangeButton || !isAuthed) return;
  overviewRangeDays = Number(rangeButton.dataset.overviewRange) || 7;
  document.querySelectorAll("[data-overview-range]").forEach((button) => {
    button.classList.toggle("is-active", button === rangeButton);
    button.setAttribute("aria-pressed", button === rangeButton ? "true" : "false");
  });
  loadOverview();
});

function loadPanel(name) {
  if (name !== "analytics") stopAnalyticsRefresh();
  const loaders = {
    overview: loadOverview,
    orders: loadOrders,
    activity: loadActivity,
    keys: () => { loadKeys(); loadMissingCosts(); },
    users: loadUsers,
    analytics: loadAnalytics,
    support: loadSupport,
    reviews: loadAdminReviews,
    products: loadProducts,
    transcripts: loadTranscripts,
    demand: loadDemand,
  };
  if (loaders[name]) loaders[name]();
}

// ── Overview ──

function renderOverviewExtras(promoData, productData) {
  const promoSummary = document.getElementById("promoSummary");
  const promoList = document.getElementById("promoCodesList");
  const catalogSummary = document.getElementById("catalogSummary");
  const productList = document.getElementById("overviewProductsList");
  const promoCodes = promoData?.codes || [];
  const catalogProducts = productData?.products || [];

  if (promoSummary) {
    promoSummary.textContent = `${promoData?.summary?.used || 0} uses`;
  }
  if (promoList) {
    promoList.innerHTML = promoCodes.length
      ? promoCodes.map((promo) => {
        const uses = promo.uses == null ? "Usage not tracked" : `${promo.uses}${promo.maxUses == null ? "" : ` / ${promo.maxUses}`} used`;
        const status = promo.active ? "Active" : "Inactive";
        const deleteButton = promoData?.canDelete && promo.source !== "environment"
          ? `<button type="button" class="admin-promo-delete" data-delete-promo="${esc(promo.code)}">Delete</button>`
          : "";
        return `<div class="admin-promo-row"><div><strong>${esc(promo.code)}</strong><span>${esc(String(promo.percent))}% off · ${esc(uses)}</span></div><div class="admin-promo-actions"><span class="admin-mini-status ${promo.active ? "is-active" : "is-inactive"}">${status}</span>${deleteButton}</div></div>`;
      }).join("")
      : '<div class="empty-state">No discount codes configured.</div>';
  }

  const activeProducts = catalogProducts.filter((product) => product.available !== false);
  const variantCount = catalogProducts.reduce((sum, product) => sum + (product.variants || []).length, 0);
  if (catalogSummary) catalogSummary.textContent = `${activeProducts.length} active · ${variantCount} variants`;
  if (productList) {
    productList.innerHTML = catalogProducts.length
      ? catalogProducts.slice(0, 8).map((product) => {
        const variantCountForProduct = (product.variants || []).length;
        return `<div class="admin-product-row"><div><strong>${esc(product.name)}</strong><span>${variantCountForProduct} variant${variantCountForProduct === 1 ? "" : "s"}</span></div><span class="admin-mini-status ${product.available !== false ? "is-active" : "is-inactive"}">${product.available !== false ? "Active" : "Disabled"}</span></div>`;
      }).join("")
      : '<div class="empty-state">No products found.</div>';
  }
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-promo]");
  if (!button || button.disabled) return;
  const code = button.getAttribute("data-delete-promo");
  if (!code || !window.confirm(`Delete discount code ${code}? This cannot be undone.`)) return;
  button.disabled = true;
  try {
    await apiDelete(`/api/admin/promo-codes/${encodeURIComponent(code)}`);
    showAdminToast(`Deleted discount code ${code}.`);
    await loadOverview();
  } catch (error) {
    showAdminToast(error.message || "Could not delete the discount code.", "error");
    button.disabled = false;
  }
});

async function loadOverview() {
  try {
    const [orders, keys, users, visitors, revenue, promoData, productData] = await Promise.all([
      apiFetch("/api/admin/orders?limit=10"),
      apiFetch("/api/admin/keys"),
      apiFetch("/api/admin/users"),
      apiFetch("/api/admin/visitors"),
      apiFetch("/api/admin/revenue"),
      apiFetch("/api/admin/promo-codes"),
      apiFetch("/api/admin/products"),
    ]);

    renderOverviewExtras(promoData, productData);

    // Revenue
    document.getElementById("revToday").textContent = revenue.today;
    document.getElementById("revWeek").textContent = revenue.week;
    document.getElementById("revMonth").textContent = revenue.month;
    document.getElementById("revAllTime").textContent = revenue.allTime;

    // Profit
    setStatValue(document.getElementById("profitToday"), revenue.profitToday || "-");
    setStatValue(document.getElementById("profitWeek"), revenue.profitWeek || "-");
    setStatValue(document.getElementById("profitMonth"), revenue.profitMonth || "-");
    setStatValue(document.getElementById("profitAllTime"), revenue.profitAllTime || "-");
    setStatValue(document.getElementById("statCost"), revenue.totalCost || "-");
    setStatValue(document.getElementById("statFees"), revenue.totalFees || "-");
    setStatValue(document.getElementById("statMargin"), revenue.marginPct || "-");
    setStatValue(document.getElementById("statStripePending"), revenue.stripePending || "-");
    setStatValue(document.getElementById("statStripeAvailable"), revenue.stripeAvailable || "-");

    // Top products
    const tpBody = document.getElementById("topProductsBody");
    if (!revenue.topProducts.length) {
      tpBody.innerHTML = '<tr><td colspan="5" class="empty-state">No sales data yet.</td></tr>';
    } else {
      tpBody.innerHTML = revenue.topProducts.map(p => `
        <tr>
          <td>${esc(p.name)}</td>
          <td style="color:#6fdc8c; font-weight:600;">${esc(p.revenue)}</td>
          <td style="color:#6fdc8c;">${esc(p.profit)}</td>
          <td>${esc(p.margin)}</td>
          <td>${p.orders}</td>
        </tr>
      `).join("");
    }

    // Stats
    document.getElementById("statOrders").textContent = revenue.totalOrders;
    document.getElementById("statAverageOrder").textContent = revenue.averageOrder || "$0.00";
    document.getElementById("statPendingOrders").textContent = revenue.pendingOrders ?? 0;
    document.getElementById("statFulfilled").textContent = revenue.fulfilledOrders;
    document.getElementById("statKeysAvail").textContent = revenue.keysAvailable;
    document.getElementById("statKeysUsed").textContent = revenue.keysAssigned;
    document.getElementById("statUsers").textContent = revenue.registeredUsers;
    document.getElementById("statVisitors").textContent =
      visitors.activeVisitors;

    // Share the analytics endpoint so the overview and Analytics tab stay
    // consistent. A chart failure never blocks the core dashboard cards.
    const chartEl = document.getElementById("overviewPerformanceChart");
    const chartSummary = document.getElementById("overviewPerformanceSummary");
    if (chartEl) {
      try {
        const chartData = await apiFetch(`/api/admin/analytics/overview?days=${overviewRangeDays}`);
        const daily = chartData.daily || [];
        const maxViews = Math.max(1, ...daily.map((row) => Number(row.views) || 0));
        const maxOrders = Math.max(1, ...daily.map((row) => Number(row.orders) || 0));
        const totalViews = daily.reduce((sum, row) => sum + (Number(row.views) || 0), 0);
        const totalOrders = daily.reduce((sum, row) => sum + (Number(row.orders) || 0), 0);

        if (!daily.length) {
          chartEl.innerHTML = '<div class="overview-chart-empty">No performance data yet.</div>';
          if (chartSummary) chartSummary.textContent = "No recent activity";
        } else {
          const width = 1000;
          const height = 280;
          const pad = { top: 20, right: 54, bottom: 42, left: 52 };
          const plotWidth = width - pad.left - pad.right;
          const plotHeight = height - pad.top - pad.bottom;
          const x = (index) => pad.left + (daily.length === 1 ? plotWidth / 2 : (index / (daily.length - 1)) * plotWidth);
          const yViews = (value) => pad.top + plotHeight - ((value / maxViews) * plotHeight);
          const yOrders = (value) => pad.top + plotHeight - ((value / maxOrders) * plotHeight);
          const points = (valueKey, scale) => daily.map((row, index) => ({
            x: x(index),
            y: scale(Number(row[valueKey]) || 0),
          }));
          const viewCoords = points("views", yViews);
          const orderCoords = points("orders", yOrders);
          const smoothPath = (coords) => {
            if (coords.length === 1) return `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
            return coords.map((point, index) => {
              if (index === 0) return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
              const previous = coords[index - 1];
              const midpoint = (previous.x + point.x) / 2;
              return `C ${midpoint.toFixed(1)} ${previous.y.toFixed(1)}, ${midpoint.toFixed(1)} ${point.y.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
            }).join(" ");
          };
          const viewPath = smoothPath(viewCoords);
          const orderPath = smoothPath(orderCoords);
          const grid = [0, 1, 2, 3, 4].map((step) => {
            const yPos = pad.top + (plotHeight * step / 4);
            const viewValue = Math.round(maxViews * (1 - step / 4));
            const orderValue = Math.round(maxOrders * (1 - step / 4));
            return `<line class="overview-svg-grid" x1="${pad.left}" y1="${yPos}" x2="${width - pad.right}" y2="${yPos}" />
              <text class="overview-svg-axis left" x="${pad.left - 10}" y="${yPos + 4}" text-anchor="end">${viewValue.toLocaleString()}</text>
              <text class="overview-svg-axis right" x="${width - pad.right + 10}" y="${yPos + 4}">${orderValue}</text>`;
          }).join("");
          const labels = daily.map((row, index) => {
            const date = String(row.date || "");
            return `<text class="overview-svg-label" x="${x(index)}" y="${height - 12}" text-anchor="middle">${esc(date.slice(5) || date)}</text>`;
          }).join("");
          const pointsMarkup = daily.map((row, index) => {
            const views = Number(row.views) || 0;
            const ordersForDay = Number(row.orders) || 0;
            const date = String(row.date || "");
            return `<g class="overview-svg-point-group">
              <title>${esc(date)} · ${views.toLocaleString()} views · ${ordersForDay} orders · ${esc(row.revenue || "$0.00")}</title>
              <circle class="overview-svg-hit" cx="${x(index)}" cy="${yViews(views)}" r="12" />
              <circle class="overview-svg-point views" cx="${x(index)}" cy="${yViews(views)}" r="4" />
              <circle class="overview-svg-point orders" cx="${x(index)}" cy="${yOrders(ordersForDay)}" r="4" />
            </g>`;
          }).join("");
          chartEl.innerHTML = `<svg class="overview-performance-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Views and orders over the last ${overviewRangeDays} days">
            <defs>
              <linearGradient id="overviewViewFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ff4f5b" stop-opacity=".34"/><stop offset="1" stop-color="#ff4f5b" stop-opacity="0"/></linearGradient>
              <filter id="overviewGlow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>
            ${grid}
            <path class="overview-svg-area" d="${viewPath} L ${x(daily.length - 1).toFixed(1)} ${(pad.top + plotHeight).toFixed(1)} L ${x(0).toFixed(1)} ${(pad.top + plotHeight).toFixed(1)} Z" />
            <path class="overview-svg-line views" d="${viewPath}" />
            <path class="overview-svg-line orders" d="${orderPath}" />
            ${pointsMarkup}
            ${labels}
            <text class="overview-svg-axis-title left" x="${pad.left}" y="12">VIEWS</text>
            <text class="overview-svg-axis-title right" x="${width - pad.right}" y="12" text-anchor="end">ORDERS</text>
          </svg>`;
          if (chartSummary) chartSummary.textContent = `${totalViews.toLocaleString()} views · ${totalOrders.toLocaleString()} orders · ${overviewRangeDays} day${overviewRangeDays === 1 ? "" : "s"}`;
        }
      } catch {
        chartEl.innerHTML = '<div class="overview-chart-empty">Performance data is temporarily unavailable.</div>';
        if (chartSummary) chartSummary.textContent = "Chart unavailable";
      }
    }

    const tbody = document.getElementById("overviewOrdersBody");
    if (!orders.orders.length) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="empty-state">No orders yet.</td></tr>';
    } else {
      tbody.innerHTML = orders.orders
        .slice(0, 8)
        .map(
          (o) => `
        <tr>
          <td>${copyCell(o.id)}</td>
          <td>${esc(o.productName)}</td>
          <td>${chip(o.status)}</td>
          <td>${esc(o.paymentMethod || "Unknown")}</td>
          <td>${fmtMoney(o.amountCents)}</td>
          <td>${copyCell(o.key, "not delivered")}</td>
          <td>${fmtDate(o.createdAt)}</td>
          <td><button class="btn-view" data-view-order="${esc(o.id)}">View</button></td>
        </tr>
      `
        )
        .join("");
    }
  } catch (err) {
    console.error("Overview load error:", err);
    showAdminToast("Couldn't load the overview data. Try refreshing.", "error");
    tableError("overviewOrdersBody", 8, "recent orders");
    const tpBody = document.getElementById("topProductsBody");
    if (tpBody) tableError("topProductsBody", 5, "top products");
  }
}

document.getElementById("overviewRefreshBtn")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = "Refreshing...";
  try {
    await loadOverview();
  } finally {
    button.disabled = false;
    button.textContent = "Refresh data";
  }
});

// ── Orders ──

async function loadOrders() {
  const status = document.getElementById("orderStatusFilter").value;
  const qs = status ? `?status=${status}&limit=100` : "?limit=100";
  const note = document.getElementById("ordersRefreshNote");

  try {
    const data = await apiFetch(`/api/admin/orders${qs}`);
    note.textContent = `${data.orders.length} orders`;

    const tbody = document.getElementById("ordersBody");
    if (!data.orders.length) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="empty-state">No orders found.</td></tr>';
      return;
    }

    tbody.innerHTML = data.orders
      .map(
        (o) => `
      <tr>
        <td>${copyCell(o.id)}</td>
        <td>${esc(o.productName)}</td>
        <td>${chip(o.status)}</td>
        <td>${esc(o.paymentMethod || "Unknown")}</td>
        <td>${fmtMoney(o.amountCents)}</td>
        <td>${copyCell(o.key, "not delivered")}</td>
        <td>${fmtDate(o.createdAt)}</td>
        <td><button class="btn-view" data-view-order="${esc(o.id)}">View</button></td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    console.error("Orders load error:", err);
    showAdminToast("Couldn't load orders. Try refreshing.", "error");
    tableError("ordersBody", 8, "orders");
  }
}

document.getElementById("orderStatusFilter").addEventListener("change", loadOrders);

document.getElementById("orderSearchBtn").addEventListener("click", async () => {
  const query = document.getElementById("orderSearchInput").value.trim();
  if (!query) return;
  if (!query.includes("@")) return viewOrder(query);
  try {
    const result = await apiFetch(`/api/admin/order-lookup?q=${encodeURIComponent(query)}`);
    if (!result.orders?.length) return alert("No orders found for that member.");
    if (result.orders.length === 1) return viewOrder(result.orders[0].id);
    document.getElementById("ordersBody").innerHTML = result.orders.map((order) => `<tr><td>${copyCell(order.id)}</td><td>${esc(order.productName)}</td><td>${chip(order.status)}</td><td>${esc(order.paymentMethod || "Unknown")}</td><td>${fmtMoney(order.amountCents)}</td><td>${copyCell(order.key, "not delivered")}</td><td>${fmtDate(order.createdAt)}</td><td><button class="btn-view" data-view-order="${esc(order.id)}">View</button></td></tr>`).join("");
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById("orderSearchInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    document.getElementById("orderSearchBtn").click();
  }
});

// ── Order Detail Modal ──

window.viewOrder = async function (orderId) {
  try {
    const data = await apiFetch(`/api/admin/orders/${orderId}`);
    const o = data.order;
    const u = data.user;
    const keys = data.assignedKeys || [];

    let keysHtml = keys.length
      ? keys
          .map(
            (k) => `
        <div class="detail-row">
          <span class="label">Key</span>
          <span class="value"><code>${esc(k.keyValue)}</code></span>
        </div>
        <div class="detail-row">
          <span class="label">Key Status</span>
          <span class="value">${chip(k.status)}</span>
        </div>
      `
          )
          .join("")
      : "";

    // If no keys from license_keys table, show delivered key from order
    if (!keys.length && o.deliveredKeyValue) {
      keysHtml = `
        <div class="detail-row">
          <span class="label">Delivered Key</span>
          <span class="value"><code>${esc(o.deliveredKeyValue)}</code></span>
        </div>
      `;
    }

    orderModalContent.innerHTML = `
      <h3>Order Details</h3>
      <div class="detail-row"><span class="label">Order ID</span><span class="value"><code>${esc(o.id)}</code></span></div>
      <div class="detail-row"><span class="label">Product</span><span class="value">${esc(o.productName)}</span></div>
      <div class="detail-row"><span class="label">Price</span><span class="value">${fmtMoney(o.amountCents)}</span></div>
      <div class="detail-row"><span class="label">Status</span><span class="value">${chip(o.status)}</span></div>
      <div class="detail-row"><span class="label">Payment</span><span class="value">${esc(o.paymentMethod || "Unknown")}</span></div>
      <div class="detail-row"><span class="label">Created</span><span class="value">${fmtDate(o.createdAt)}</span></div>
      <div class="detail-row"><span class="label">Fulfilled</span><span class="value">${fmtDate(o.fulfilledAt)}</span></div>
      ${u ? `
        <div class="detail-row"><span class="label">Customer</span><span class="value">${esc(u.username || u.email)}</span></div>
        <div class="detail-row"><span class="label">Email</span><span class="value">${esc(u.email)}</span></div>
      ` : ""}
      ${keysHtml}
      ${o.stripeSessionId ? `<div class="detail-row"><span class="label">Stripe Session</span><span class="value"><code>${shortId(o.stripeSessionId)}</code></span></div>` : ""}
      ${o.stripePaymentIntent ? `<div class="detail-row"><span class="label">Payment Intent</span><span class="value"><code>${shortId(o.stripePaymentIntent)}</code></span></div>` : ""}
      <button class="modal-close" data-close-modal>Close</button>
    `;
    orderModal.classList.add("is-open");
  } catch (err) {
    alert("Order not found: " + err.message);
  }
};

window.viewUser = async function (userId) {
  try {
    const data = await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}`);
    const u = data.user;
    const orders = data.orders || [];
    const keys = data.keys || [];
    const orderRows = orders.length
      ? orders.map((order) => `
          <tr><td><code>${esc(shortId(order.id))}</code></td><td>${esc(order.productName)}</td><td>${chip(order.status)}</td><td>${fmtMoney(order.amountCents)}</td><td>${fmtDate(order.createdAt)}</td></tr>
        `).join("")
      : '<tr><td colspan="5" class="empty-state">No orders for this user.</td></tr>';
    const keyRows = keys.length
      ? keys.map((key) => `
          <tr><td>${esc(key.productName)}</td><td>${chip(key.status)}</td><td>${key.orderId ? `<code>${esc(shortId(key.orderId))}</code>` : "-"}</td><td>${fmtDate(key.assignedAt || key.createdAt)}</td></tr>
        `).join("")
      : '<tr><td colspan="4" class="empty-state">No assigned keys.</td></tr>';

    orderModalContent.innerHTML = `
      <h3>User Details</h3>
      <div class="detail-row"><span class="label">Username</span><span class="value">${esc(u.username || "-")}</span></div>
      <div class="detail-row"><span class="label">Email</span><span class="value">${esc(u.email || "-")}</span></div>
      <div class="detail-row"><span class="label">Provider</span><span class="value">${esc(u.provider)}</span></div>
      <div class="detail-row"><span class="label">Store balance</span><span class="value">${fmtMoney(data.balanceCents)}</span></div>
      <div class="detail-row"><span class="label">Total spent</span><span class="value">${fmtMoney(data.totalSpentCents)}</span></div>
      <div class="detail-row"><span class="label">Orders</span><span class="value">${orders.length}</span></div>
      <div class="detail-row"><span class="label">Account created</span><span class="value">${fmtDate(u.createdAt)}</span></div>
      <div class="detail-row"><span class="label">Last sign in</span><span class="value">${fmtDate(u.lastSignInAt)}</span></div>
      <div class="admin-balance-editor" data-user-balance-id="${esc(u.id)}">
        <label for="userBalanceInput">Set store balance</label>
        <div><input id="userBalanceInput" type="number" min="0" max="50000" step="0.01" value="${(Number(data.balanceCents || 0) / 100).toFixed(2)}" /><button type="button" data-save-user-balance>Save balance</button></div>
        <small>Admins only. Changes are recorded in the audit log.</small>
      </div>
      <h4 style="margin:22px 0 8px;">Order history</h4>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Order</th><th>Product</th><th>Status</th><th>Price</th><th>Date</th></tr></thead><tbody>${orderRows}</tbody></table></div>
      <h4 style="margin:22px 0 8px;">Assigned keys</h4>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Product</th><th>Status</th><th>Order</th><th>Assigned</th></tr></thead><tbody>${keyRows}</tbody></table></div>
      <button class="modal-close" data-close-modal>Close</button>
    `;
    orderModal.classList.add("is-open");
  } catch (err) {
    alert("User not found: " + err.message);
  }
};

window.closeModal = function () {
  orderModal.classList.remove("is-open");
};

orderModal.addEventListener("click", (e) => {
  if (e.target === orderModal) closeModal();
});

// ── Keys ──

let keyInventory = null;

function renderKeys() {
  if (!keyInventory) return;

  const status = document.getElementById("keyStatusFilter").value;
  const query = document.getElementById("keySearchInput").value.trim().toLowerCase();
  const note = document.getElementById("keysRefreshNote");
  const statsEl = document.getElementById("keysStats");

  statsEl.innerHTML = `
    <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value">${keyInventory.summary.total}</div></div>
    <div class="stat-card"><div class="stat-label">Ready to fulfill</div><div class="stat-value">${keyInventory.summary.unused}</div></div>
    <div class="stat-card"><div class="stat-label">Assigned</div><div class="stat-value">${keyInventory.summary.assigned}</div></div>
  `;

  const keys = keyInventory.keys
    .filter((key) => !status || key.status === status)
    .filter((key) => {
      if (!query) return true;
      return [key.productName, key.productSlug, key.keyValue, key.assignedOrderId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "unused" ? -1 : 1;
      return a.productName.localeCompare(b.productName);
    });

  note.textContent = `${keys.length} of ${keyInventory.summary.total} keys shown`;
  const tbody = document.getElementById("keysBody");
  if (!keys.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No keys match this inventory view.</td></tr>';
    return;
  }

  tbody.innerHTML = keys
    .map(
      (key) => `
      <tr>
        <td>${copyCell(key.keyValue)}</td>
        <td><strong>${esc(key.productName)}</strong></td>
        <td>${chip(key.status)}</td>
        <td>${key.assignedOrderId ? copyCell(key.assignedOrderId) : `<span class="cell-empty">—</span>`}</td>
        <td>${fmtDate(key.assignedAt)}</td>
      </tr>
    `
    )
    .join("");
}

async function loadKeys() {
  try {
    keyInventory = await apiFetch("/api/admin/keys");
    renderKeys();
  } catch (err) {
    console.error("Keys load error:", err);
    showAdminToast("Couldn't load key inventory. Try refreshing.", "error");
    tableError("keysBody", 5, "keys");
  }
}

document.getElementById("keyStatusFilter").addEventListener("change", renderKeys);
document.getElementById("keySearchInput").addEventListener("input", renderKeys);

// ── Missing supplier costs ──

async function loadMissingCosts() {
  const card = document.getElementById("missingCostCard");
  const groupsEl = document.getElementById("missingCostGroups");
  const note = document.getElementById("missingCostRefreshNote");
  if (!card || !groupsEl) return;

  try {
    const data = await apiFetch("/api/admin/costs/missing");
    const groups = Array.isArray(data.groups) ? data.groups : [];

    if (!groups.length) {
      card.hidden = true;
      return;
    }

    card.hidden = false;
    const totalOrders = groups.reduce((sum, g) => sum + g.orders.length, 0);
    if (note) note.textContent = `${totalOrders} order${totalOrders === 1 ? "" : "s"} across ${groups.length} product${groups.length === 1 ? "" : "s"}`;

    groupsEl.innerHTML = groups
      .map((group, index) => `
        <div class="missing-cost-row">
          <div class="missing-cost-row-info">
            <strong>${esc(group.productName)}</strong>
            <span>${group.orders.length} order${group.orders.length === 1 ? "" : "s"} · ${esc(group.productSlug)}</span>
          </div>
          <div class="missing-cost-actions">
            <input type="number" min="0" step="0.01" placeholder="$ cost per unit" data-missing-cost-input="${index}" aria-label="Cost per unit for ${esc(group.productName)}" />
            <button type="button" class="btn-view" data-missing-cost-apply="${index}">Apply to all ${group.orders.length}</button>
          </div>
        </div>
      `)
      .join("");

    groupsEl.querySelectorAll("[data-missing-cost-apply]").forEach((button) => {
      button.addEventListener("click", async () => {
        const index = Number(button.dataset.missingCostApply);
        const group = groups[index];
        const input = groupsEl.querySelector(`[data-missing-cost-input="${index}"]`);
        const dollars = Number(input?.value);
        if (!Number.isFinite(dollars) || dollars < 0) {
          showAdminToast("Enter a valid cost first.", "error");
          return;
        }
        const costCents = Math.round(dollars * 100);
        button.disabled = true;
        try {
          await apiPost("/api/admin/costs/set", {
            orderIds: group.orders.map((order) => order.id),
            costCents,
          });
          showAdminToast(`Saved cost for ${group.orders.length} order${group.orders.length === 1 ? "" : "s"}.`, "success");
          loadMissingCosts();
        } catch (err) {
          showAdminToast(err.message || "Couldn't save cost.", "error");
          button.disabled = false;
        }
      });
    });
  } catch (err) {
    console.error("Missing cost load error:", err);
  }
}

// ── Users ──

let adminUsers = [];

function renderUsers() {
  const tbody = document.getElementById("usersBody");
  const query = String(document.getElementById("usersSearchInput")?.value || "").trim().toLowerCase();
  const users = query
    ? adminUsers.filter((u) => `${u.username || ""} ${u.email || ""}`.toLowerCase().includes(query))
    : adminUsers;

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">${query ? "No users match that search." : "No users yet."}</td></tr>`;
    return;
  }

  const providerLabel = (p) => {
    if (p === "discord") return "Discord";
    if (p === "google") return "Google";
    return "Email";
  };

  tbody.innerHTML = users
    .map(
      (u) => `
      <tr>
        <td>${esc(u.username || "-")}</td>
        <td>${esc(u.email)}</td>
        <td>${esc(providerLabel(u.provider))}</td>
        <td>${fmtDate(u.createdAt)}</td>
        <td>${u.emailConfirmedAt ? chip("confirmed") : chip("pending")}</td>
        <td><button class="btn-view" data-view-user="${esc(u.id)}">View</button></td>
      </tr>
    `,
    )
    .join("");
}

async function loadUsers() {
  try {
    const data = await apiFetch("/api/admin/users");
    adminUsers = Array.isArray(data.users) ? data.users : [];
    renderUsers();
  } catch (err) {
    console.error("Users load error:", err);
    showAdminToast("Couldn't load users. Try refreshing.", "error");
    tableError("usersBody", 6, "users");
  }
}

document.getElementById("usersSearchInput")?.addEventListener("input", renderUsers);

// ── Analytics ──

let analyticsTimer = null;

function startAnalyticsRefresh() {
  stopAnalyticsRefresh();
  analyticsTimer = setInterval(() => {
    loadAnalytics().catch(() => {});
  }, 10_000);
}

function stopAnalyticsRefresh() {
  if (analyticsTimer) {
    clearInterval(analyticsTimer);
    analyticsTimer = null;
  }
}

async function loadAnalytics() {
  try {
    const [data, overview] = await Promise.all([
      apiFetch("/api/admin/visitors"),
      apiFetch("/api/admin/analytics/overview?days=30"),
    ]);
    const views = data.recentViews || [];
    const totals = overview.totals || {};
    const today = overview.today || {};
    const discord = overview.discord || {};

    document.getElementById("analyticsActiveNow").textContent = data.activeVisitors;
    document.getElementById("analyticsViewCount").textContent = totals.views ?? 0;
    document.getElementById("analyticsUniqueVisitors").textContent = totals.uniqueVisitors ?? 0;
    document.getElementById("analyticsOrders").textContent = totals.orders ?? 0;
    document.getElementById("analyticsOrdersPerDay").textContent = totals.ordersPerDay || "0.00";
    document.getElementById("analyticsAverageOrder").textContent = totals.averageOrder || "$0.00";
    document.getElementById("analyticsConversion").textContent = totals.conversionRate || "0.0%";
    document.getElementById("analyticsFulfillment").textContent = totals.fulfillmentRate || "0.0%";
    document.getElementById("analyticsRevenue").textContent = totals.revenue || "$0.00";
    setStatValue(document.getElementById("analyticsRevenueAfterMedia"), totals.revenueAfterMediaValue || totals.revenue || "$0.00");
    setStatValue(document.getElementById("analyticsSupplierCost"), totals.supplierCost || "$0.00");
    setStatValue(document.getElementById("analyticsMediaValue"), totals.mediaValue || "$0.00");
    setStatValue(document.getElementById("analyticsBalanceRedeemed"), totals.balanceRedeemed || "$0.00");
    document.getElementById("analyticsWebTickets").textContent = totals.webTickets ?? 0;
    document.getElementById("analyticsDiscordTickets").textContent = totals.discordTickets ?? 0;
    document.getElementById("analyticsDiscordMembers").textContent = `${discord.members || 0} / ${discord.online || 0}`;
    document.getElementById("analyticsDiscordVerified").textContent = discord.verified ?? 0;
    document.getElementById("analyticsDepartures").textContent = totals.departures ?? 0;
    document.getElementById("analyticsUpdatedAt").textContent = `30-day totals · Today: ${today.views || 0} views, ${today.orders || 0} orders · Auto-refreshes every 10s · Updated ${fmtDate(overview.updatedAt || data.updatedAt)}`;

    const chartEl = document.getElementById("analyticsDailyChart");
    const daily = overview.daily || [];
    const maxViews = Math.max(1, ...daily.map((row) => Number(row.views) || 0));
    chartEl.innerHTML = daily.map((row) => {
      const height = Math.max(4, Math.round(((Number(row.views) || 0) / maxViews) * 100));
      const label = String(row.date || "").slice(5);
      return `<div class="analytics-day" title="${esc(row.date)}: ${row.views} views, ${row.orders} orders, ${esc(row.revenue)} revenue">
        <span class="analytics-bar" style="height:${height}%;"></span>
        <span class="analytics-day-label">${esc(label)}</span>
      </div>`;
    }).join("");

    // Pages breakdown
    const pagesEl = document.getElementById("analyticsPages");
    if (!data.pages.length) {
      pagesEl.innerHTML = '<div class="empty-state">No active visitors.</div>';
    } else {
      pagesEl.innerHTML = data.pages
        .map(
          (p) => `
        <div class="visitor-row">
          <span class="visitor-page">${esc(p.pagePath)}</span>
          <span class="visitor-count">${p.count}</span>
        </div>
      `
        )
        .join("");
    }

    // Full visitor log table
    const activityEl = document.getElementById("analyticsActivity");
    if (!views.length) {
      activityEl.innerHTML = '<tr><td colspan="6" class="empty-state">No recent activity.</td></tr>';
    } else {
      activityEl.innerHTML = views
        .map(
          (v) => `
        <tr>
          <td>${esc(v.pagePath || "-")}</td>
          <td><code>${esc(v.ipAddress || "unknown")}</code></td>
          <td>${esc(v.referrer || "Direct")}</td>
          <td><code>${esc(v.visitorLabel || "-")}</code></td>
          <td>${v.userLabel ? `<span style="color:var(--accent);">${esc(v.userLabel)}</span>` : '<span style="color:var(--muted);">Guest</span>'}</td>
          <td>${fmtDate(v.viewedAt)}</td>
        </tr>
      `
        )
        .join("");
    }

    startAnalyticsRefresh();
  } catch (err) {
    console.error("Analytics load error:", err);
    showAdminToast("Couldn't load analytics. Try refreshing.", "error");
  }
}

// ── Demand ──

async function loadDemand() {
  try {
    const data = await apiFetch("/api/admin/product-stats");

    const boughtEl = document.getElementById("demandBought");
    const bought = data.mostBought || [];
    boughtEl.innerHTML = bought.length
      ? bought
          .map(
            (p) =>
              `<tr><td>${esc(p.name)}</td><td>${p.orders30}</td><td>${p.orders}</td><td style="color:#6fdc8c;">${esc(p.revenue)}</td></tr>`
          )
          .join("")
      : '<tr><td colspan="4" class="empty-state">No sales yet.</td></tr>';

    const viewedEl = document.getElementById("demandViewed");
    const viewed = data.mostViewed || [];
    viewedEl.innerHTML = viewed.length
      ? viewed
          .map((p) => `<tr><td>${esc(p.name)}</td><td>${p.views30}</td><td>${p.views}</td></tr>`)
          .join("")
      : '<tr><td colspan="3" class="empty-state">No views logged yet.</td></tr>';
  } catch (err) {
    console.error("Demand load error:", err);
    showAdminToast("Couldn't load demand data. Try refreshing.", "error");
    tableError("demandBought", 4, "top products");
    tableError("demandViewed", 3, "top viewed products");
  }
}

// ── Support ──

let supportThreads = [];

async function loadSupport() {
  try {
    const data = await apiFetch("/api/admin/live-desk");
    supportThreads = data.threads || [];
    renderSupportList();
  } catch (err) {
    console.error("Support load error:", err);
    showAdminToast("Couldn't load support tickets. Try refreshing.", "error");
    tableError("supportBody", 6, "support tickets");
  }
}

function renderSupportList() {
  const container = document.getElementById("supportContent");
  const tbody = document.getElementById("supportBody");
  const threadView = document.getElementById("supportThreadView");

  // Show list, hide thread view
  document.getElementById("supportListView").style.display = "block";
  threadView.style.display = "none";

  if (!supportThreads.length) {
    tbody.innerHTML =
        '<tr><td colspan="6" class="empty-state">No support threads.</td></tr>';
    return;
  }

  tbody.innerHTML = supportThreads
    .map(
      (t) => `
    <tr style="cursor:pointer;" data-view-thread="${esc(t.id)}" role="button" tabindex="0" aria-label="View ticket: ${esc(t.subject)}">
       <td><strong>${esc(t.subject)}</strong></td>
       <td>${chip(t.priority || "normal")}</td>
       <td>${esc(t.contactName || "-")} ${t.contactMethod ? `(${esc(t.contactMethod)})` : ""}</td>
      <td>${chip(t.status)}</td>
      <td>${fmtDate(t.lastMessageAt || t.updatedAt)}</td>
      <td><button class="btn-danger-sm" data-delete-thread="${esc(t.id)}" onclick="event.stopPropagation()">Delete</button></td>
    </tr>
  `
    )
    .join("");
}

let staffStatsRangeDays = 30;

function renderStaffStats(result) {
  const staff = result.staff || [];
  const totals = result.totals || {};
  const leaderboard = document.getElementById("staffLeaderboard");
  document.getElementById("staffActiveCount").textContent = totals.activeEmployees || 0;
  document.getElementById("staffReplyCount").textContent = totals.replies || 0;
  document.getElementById("staffTicketCount").textContent = totals.ticketsTouched || 0;
  document.getElementById("staffClosedCount").textContent = totals.ticketsClosed || 0;

  if (!staff.length) {
    leaderboard.innerHTML = '<div class="staff-performance-empty">No employee support activity was recorded in this period.</div>';
  } else {
    const maxScore = Math.max(1, ...staff.map((person) => Number(person.score || 0)));
    leaderboard.innerHTML = staff.map((person, index) => {
      const name = person.displayName || person.username || "Staff";
      const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
      const avatar = person.avatarUrl
        ? `<img src="${esc(person.avatarUrl)}" alt="" loading="lazy" />`
        : esc(initials || "ST");
      const contribution = Math.max(person.score ? 3 : 0, Math.round((Number(person.score || 0) / maxScore) * 100));
      const lastActive = person.lastActiveAt ? `Last active ${fmtDate(person.lastActiveAt)}` : "No activity in range";
      return `<article class="staff-rank-card">
        <span class="staff-rank-number">${index + 1}</span>
        <div class="staff-person">
          <span class="staff-avatar">${avatar}</span>
          <span class="staff-person-copy"><strong>${esc(name)}</strong><span>${esc(lastActive)}</span></span>
        </div>
        <div>
          <div class="staff-contribution-track" title="${Number(person.score || 0)} contribution points"><div class="staff-contribution-fill" style="width:${contribution}%"></div></div>
          <div class="staff-breakdown">
            <span><b>${Number(person.replies || 0)}</b> replies</span>
            <span><b>${Number(person.ticketsTouched || 0)}</b> tickets</span>
            <span><b>${Number(person.ticketsClosed || 0)}</b> closed</span>
            <span><b>${Number(person.activeDays || 0)}</b> active days</span>
            ${person.websiteReplies ? `<span><b>${Number(person.websiteReplies)}</b> website</span>` : ""}
            ${person.knowledgeReplies ? `<span><b>${Number(person.knowledgeReplies)}</b> knowledge</span>` : ""}
          </div>
        </div>
        <span class="staff-score"><strong>${Number(person.score || 0)}</strong><span>points</span></span>
      </article>`;
    }).join("");
  }

  const note = document.getElementById("staffPerformanceNote");
  note.textContent = `${result.scoreFormula || "1 per reply + 2 per ticket touched + 4 per ticket closed"}. ${result.employeeRosterAvailable ? "Employees with zero activity are included." : "Discord roster was unavailable, so only staff with recorded activity are shown."}`;
}

async function loadStaffStats() {
  const leaderboard = document.getElementById("staffLeaderboard");
  try {
    const result = await apiFetch(`/api/admin/staff-stats?days=${staffStatsRangeDays}`);
    renderStaffStats(result);
  } catch (error) {
    leaderboard.innerHTML = `<div class="staff-performance-empty">${esc(error.message)}</div>`;
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-staff-range]");
  if (!button || !isAuthed) return;
  staffStatsRangeDays = Number(button.dataset.staffRange) || 30;
  document.querySelectorAll("[data-staff-range]").forEach((rangeButton) => {
    const active = rangeButton === button;
    rangeButton.classList.toggle("is-active", active);
    rangeButton.setAttribute("aria-pressed", active ? "true" : "false");
  });
  document.getElementById("staffLeaderboard").innerHTML = '<div class="staff-performance-empty">Refreshing employee performance...</div>';
  loadStaffStats();
});

async function loadActivity() {
  const body = document.getElementById("activityBody");
  const query = document.getElementById("activitySearchInput")?.value.trim() || "";
  loadStaffStats();
  try {
    const result = await apiFetch(`/api/admin/activity${query ? `?q=${encodeURIComponent(query)}` : ""}`);
    if (!result.activity?.length) {
      body.innerHTML = '<tr><td colspan="5" class="empty-state">No matching staff activity.</td></tr>';
      return;
    }
    body.innerHTML = result.activity.map((entry) => `<tr><td>${esc(entry.actorDiscordUsername || "Unknown")}</td><td>${esc(String(entry.action || "").replace(/_/g, " "))}</td><td>${esc(entry.targetType || "-")}<br><code>${shortId(entry.targetId)}</code></td><td>${esc(JSON.stringify(entry.details || {}).slice(0, 180))}</td><td>${fmtDate(entry.createdAt)}</td></tr>`).join("");
  } catch (error) {
    body.innerHTML = `<tr><td colspan="5" class="empty-state">${esc(error.message)}</td></tr>`;
  }
}

document.getElementById("activitySearchBtn")?.addEventListener("click", loadActivity);
document.getElementById("activitySearchInput")?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); loadActivity(); }
});

window.viewThread = function (threadId) {
  const thread = supportThreads.find((t) => t.id === threadId);
  if (!thread) return;

  document.getElementById("supportListView").style.display = "none";
  const view = document.getElementById("supportThreadView");
  view.style.display = "block";

  const msgs = (thread.messages || [])
    .map(
      (m) => `
    <div class="thread-msg ${m.senderType === "admin" ? "thread-msg-admin" : "thread-msg-user"}">
      <div class="thread-msg-meta">
        <span class="thread-msg-sender">${m.senderType === "admin" ? "Support" : m.senderType === "bot" ? "AI Support" : esc(thread.contactName || "Customer")}</span>
        <span class="thread-msg-time">${fmtDate(m.createdAt)}</span>
      </div>
      <div class="thread-msg-body">${esc(m.body)}</div>
    </div>
  `
    )
    .join("");

  view.innerHTML = `
    <div class="thread-header">
      <button class="btn-view" data-back-to-tickets style="margin-bottom:16px;">Back to Tickets</button>
      <h3>${esc(thread.subject)}</h3>
      <div style="display:flex; gap:12px; align-items:center; margin-bottom:4px;">
        ${chip(thread.status)}
        <span style="color:var(--muted); font-size:0.82rem;">${esc(thread.contactName || "-")} ${thread.contactMethod ? `(${esc(thread.contactMethod)})` : ""}</span>
      </div>
      <div style="color:var(--muted); font-size:0.78rem;">Opened ${fmtDate(thread.createdAt)}</div>
    </div>
    <div class="thread-messages" id="threadMessages">${msgs || '<div class="empty-state">No messages in this thread.</div>'}</div>
    <div class="thread-reply-form">
      <textarea id="replyBody" placeholder="Type your reply..." rows="3"></textarea>
      <div class="thread-reply-actions">
        <select id="replyStatus">
          <option value="pending">Set Pending</option>
          <option value="open">Set Open</option>
          <option value="resolved">Set Resolved</option>
          <option value="closed">Set Closed</option>
        </select>
        <button data-send-reply="${esc(thread.id)}">Send Reply</button>
      </div>
    </div>
  `;

  // Scroll messages to bottom
  const msgsEl = document.getElementById("threadMessages");
  if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
};

window.sendReply = async function (threadId) {
  const body = document.getElementById("replyBody").value.trim();
  const status = document.getElementById("replyStatus").value;
  if (!body) return;

  try {
    const res = await apiPost("/api/admin/live-desk/reply", {
      threadId,
      body,
      status,
    });

    if (res.ok) {
      // Reload and re-open thread
      await loadSupport();
      viewThread(threadId);
    } else {
      alert("Failed to send: " + (res.error || "Unknown error"));
    }
  } catch (err) {
    alert("Failed to send: " + err.message);
  }
};

window.deleteThread = async function (threadId) {
  const thread = supportThreads.find((t) => t.id === threadId);
  const label = thread?.subject || "this ticket";
  if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;

  try {
    const res = await fetch(`/api/admin/live-desk/${encodeURIComponent(threadId)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || "Delete failed");
    await loadSupport();
  } catch (err) {
    alert("Failed to delete: " + err.message);
  }
};

// ── Delegated event listeners (CSP-safe, no inline handlers) ──

document.addEventListener("click", (e) => {
  const viewBtn = e.target.closest("[data-view-order]");
  if (viewBtn) { viewOrder(viewBtn.dataset.viewOrder); return; }

  const userBtn = e.target.closest("[data-view-user]");
  if (userBtn) { viewUser(userBtn.dataset.viewUser); return; }

  const saveBalanceBtn = e.target.closest("[data-save-user-balance]");
  if (saveBalanceBtn) {
    const editor = saveBalanceBtn.closest("[data-user-balance-id]");
    const input = editor?.querySelector("#userBalanceInput");
    const amount = Number(input?.value);
    if (!editor || !Number.isFinite(amount) || amount < 0 || amount > 50000) {
      alert("Enter a balance from $0.00 to $50,000.00.");
      return;
    }
    saveBalanceBtn.disabled = true;
    apiFetch(`/api/admin/users/${encodeURIComponent(editor.dataset.userBalanceId)}/balance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balanceCents: Math.round(amount * 100) }),
    }).then((result) => {
      input.value = (Number(result.balanceCents || 0) / 100).toFixed(2);
      saveBalanceBtn.textContent = "Saved";
      setTimeout(() => { saveBalanceBtn.textContent = "Save balance"; }, 1400);
    }).catch((err) => alert("Balance update failed: " + err.message)).finally(() => {
      saveBalanceBtn.disabled = false;
    });
    return;
  }

  const closeBtn = e.target.closest("[data-close-modal]");
  if (closeBtn) { closeModal(); return; }

  const deleteThreadBtn = e.target.closest("[data-delete-thread]");
  if (deleteThreadBtn) { deleteThread(deleteThreadBtn.dataset.deleteThread); return; }

  const threadRow = e.target.closest("[data-view-thread]");
  if (threadRow) { viewThread(threadRow.dataset.viewThread); return; }

  const backBtn = e.target.closest("[data-back-to-tickets]");
  if (backBtn) { renderSupportList(); return; }

  const replyBtn = e.target.closest("[data-send-reply]");
  if (replyBtn) { sendReply(replyBtn.dataset.sendReply); return; }
});

// Support ticket rows are keyboard-focusable (role="button" tabindex="0")
// but only had a click handler — Enter/Space did nothing. Mirrors the
// importZone keydown pattern above.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const threadRow = e.target.closest("[data-view-thread]");
  if (!threadRow) return;
  e.preventDefault();
  viewThread(threadRow.dataset.viewThread);
});

// ── Export CSV ──

document.getElementById("exportCsvBtn").addEventListener("click", () => {
  window.open("/api/admin/orders/export/csv", "_blank");
});

// ── Bulk Import Keys ──

const importZone = document.getElementById("importZone");
const importFileInput = document.getElementById("importFileInput");
const importResult = document.getElementById("importResult");

importZone.addEventListener("click", () => importFileInput.click());

importZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    importFileInput.click();
  }
});

importZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  importZone.style.borderColor = "rgba(255,255,255,0.4)";
});

importZone.addEventListener("dragleave", () => {
  importZone.style.borderColor = "";
});

importZone.addEventListener("drop", (e) => {
  e.preventDefault();
  importZone.style.borderColor = "";
  const file = e.dataTransfer.files[0];
  if (file) processImportFile(file);
});

importFileInput.addEventListener("change", () => {
  if (importFileInput.files[0]) processImportFile(importFileInput.files[0]);
});

async function processImportFile(file) {
  importResult.className = "import-result";
  importResult.style.display = "none";

  const text = await file.text();
  const lines = text.trim().split(/\r?\n/).filter(Boolean);

  // Detect and skip header row
  let startIdx = 0;
  if (lines[0] && /product_slug|product|slug/i.test(lines[0])) {
    startIdx = 1;
  }

  const keys = [];
  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    if (parts.length >= 2 && parts[0] && parts[1]) {
      const entry = { product_slug: parts[0], key_value: parts[1] };
      const dollars = Number(parts[2]);
      if (parts[2] && Number.isFinite(dollars) && dollars >= 0) {
        entry.cost_cents = Math.round(dollars * 100);
      }
      keys.push(entry);
    }
  }

  if (!keys.length) {
    importResult.className = "import-result error";
    importResult.textContent = "No valid keys found. Format: product_slug,key_value";
    importResult.style.display = "block";
    return;
  }

  try {
    const res = await apiPost("/api/admin/keys/import", { keys });
    if (res.ok) {
      importResult.className = "import-result success";
      importResult.textContent = `Imported ${res.imported} key${res.imported === 1 ? "" : "s"} successfully.`;
      importResult.style.display = "block";
      importFileInput.value = "";
      loadKeys();
      loadMissingCosts();
    } else {
      throw new Error(res.error || "Import failed");
    }
  } catch (err) {
    importResult.className = "import-result error";
    importResult.textContent = err.message;
    importResult.style.display = "block";
  }
}

// ── Admin Reviews ──

async function loadAdminReviews() {
  try {
    const data = await apiFetch("/api/admin/reviews");
    const tbody = document.getElementById("reviewsBody");

    if (!data.reviews.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No reviews yet.</td></tr>';
      return;
    }

    /* Clamp: an out-of-range rating made "☆".repeat() throw a RangeError,
       which killed the whole .map() and silently blanked this panel. */
    const stars = (n) => {
      const filled = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
      return "★".repeat(filled) + "☆".repeat(5 - filled);
    };

    tbody.innerHTML = data.reviews
      .map(
        (r) => `
      <tr>
        <td>${esc(r.username)}</td>
        <td style="color:#ffd700;letter-spacing:1px;">${stars(r.rating)}</td>
        <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(r.review_text)}</td>
        <td>${esc(r.source === "discord" ? "Discord" : "Site")}</td>
        <td>${fmtDate(r.created_at)}</td>
        <td><button class="btn-danger-sm" data-delete-review="${esc(r.id)}">Delete</button></td>
      </tr>
    `
      )
      .join("");

    // Bind once: loadAdminReviews() re-runs every time the Reviews panel is
    // opened, and re-binding stacked a duplicate DELETE per visit.
    if (tbody.dataset.deleteBound === "1") return;
    tbody.dataset.deleteBound = "1";

    tbody.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-delete-review]");
      if (!btn) return;
      if (!confirm("Delete this review?")) return;
      btn.disabled = true;
      btn.textContent = "...";
      try {
        await apiFetch(`/api/admin/reviews/${btn.dataset.deleteReview}`, { method: "DELETE" });
        loadAdminReviews();
      } catch (err) {
        alert(err.message);
        btn.disabled = false;
        btn.textContent = "Delete";
      }
    });
  } catch (err) {
    console.error("Reviews load error:", err);
  }
}

// ── Admin Products ──

async function loadProducts() {
  try {
    const data = await apiFetch("/api/admin/products");
    const editor = document.getElementById("productsEditor");

    if (!data.products.length) {
      editor.innerHTML = '<div class="empty-state">No products found.</div>';
      return;
    }

    editor.innerHTML = data.products
      .map(
        (p) => `
      <div class="product-edit-card" data-slug="${esc(p.slug)}">
        <div class="product-edit-header">
          <strong>${esc(p.name)}</strong>
          <label class="product-toggle">
            <input type="checkbox" data-toggle-product="${esc(p.slug)}" ${p.available !== false ? "checked" : ""} />
            <span>${p.available !== false ? "Active" : "Disabled"}</span>
          </label>
        </div>
        <div class="product-variants">
          ${(p.variants || [])
            .map(
              (v) => `
            <div class="product-variant-row">
              <span class="variant-name">${esc(v.name)}</span>
              <div class="variant-price-edit">
                <span>$</span>
                <input type="number" step="0.01" min="0" value="${(v.amount / 100).toFixed(2)}"
                  data-price-input data-product="${esc(p.slug)}" data-variant="${esc(v.slug)}" />
              </div>
            </div>
          `
            )
            .join("")}
        </div>
        <button class="button button-primary button-small product-save-btn" data-save-product="${esc(p.slug)}">Save</button>
      </div>
    `
      )
      .join("");

    // Bind once: loadProducts() re-runs on every Products panel visit, and
    // re-binding fired a duplicate PATCH per visit.
    if (editor.dataset.editBound === "1") return;
    editor.dataset.editBound = "1";

    editor.addEventListener("change", async (e) => {
      const toggle = e.target.closest("[data-toggle-product]");
      if (!toggle) return;
      const slug = toggle.dataset.toggleProduct;
      const available = toggle.checked;
      toggle.nextElementSibling.textContent = available ? "Active" : "Disabled";
      try {
        await apiFetch("/api/admin/products", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, available }),
        });
      } catch (err) {
        alert(err.message);
        toggle.checked = !available;
      }
    });

    editor.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-save-product]");
      if (!btn) return;
      const slug = btn.dataset.saveProduct;
      const card = btn.closest(".product-edit-card");
      const inputs = card.querySelectorAll("[data-price-input]");
      const variants = [];
      inputs.forEach((input) => {
        variants.push({
          slug: input.dataset.variant,
          amount: Math.round(parseFloat(input.value) * 100),
        });
      });
      btn.disabled = true;
      btn.textContent = "Saving...";
      try {
        await apiFetch("/api/admin/products", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, variants }),
        });
        btn.textContent = "Saved!";
        setTimeout(() => { btn.textContent = "Save"; btn.disabled = false; }, 1500);
      } catch (err) {
        alert(err.message);
        btn.textContent = "Save";
        btn.disabled = false;
      }
    });
  } catch (err) {
    console.error("Products load error:", err);
    document.getElementById("productsEditor").innerHTML = '<div class="empty-state">Failed to load products.</div>';
  }
}

// ── Transcript library ──

let transcriptLibrary = [];

function transcriptDuration(minutes) {
  const value = Number(minutes || 0);
  return value < 60 ? `${value}m` : `${Math.floor(value / 60)}h ${value % 60}m`;
}

function renderTranscriptLibrary(query = "") {
  const container = document.getElementById("transcriptsList");
  const count = document.getElementById("transcriptResultCount");
  if (!container || !count) return;

  const term = query.trim().toLowerCase();
  const visible = transcriptLibrary.filter((transcript) => {
    if (!term) return true;
    return [transcript.topic, transcript.channel_name, transcript.opened_by, transcript.closed_by]
      .some((value) => String(value || "").toLowerCase().includes(term));
  });

  count.textContent = `${visible.length} ${visible.length === 1 ? "record" : "records"}`;
  if (!visible.length) {
    container.innerHTML = '<div class="empty-state">No transcript matches that search.</div>';
    return;
  }

  container.innerHTML = visible.map((transcript) => {
    const created = new Date(transcript.created_at);
    const date = created.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const time = created.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const href = `/admin/transcripts/${encodeURIComponent(transcript.id)}`;
    return `
      <article class="transcript-card">
        <div class="transcript-card-main">
          <span class="transcript-topic">${esc(transcript.topic || "Support ticket")}</span>
          <span class="transcript-channel">#${esc(transcript.channel_name || "ticket")}</span>
          <div class="transcript-meta">
            <span>Opened by <b>${esc(transcript.opened_by || "Unknown")}</b></span>
            <span>Closed by <b>${esc(transcript.closed_by || "Unknown")}</b></span>
            <span><b>${transcriptDuration(transcript.duration_minutes)}</b> duration</span>
            <span><b>${esc(transcript.message_count || 0)}</b> messages</span>
          </div>
        </div>
        <div class="transcript-card-side">
          <span class="transcript-card-time">${esc(date)} at ${esc(time)}</span>
          <a class="btn-view" href="${href}">Open transcript</a>
        </div>
      </article>`;
  }).join("");
}

async function loadTranscripts() {
  const container = document.getElementById("transcriptsList");
  if (!container) return;

  try {
    const data = await apiFetch("/api/admin/transcripts");
    transcriptLibrary = data.transcripts || [];
    const totalMessages = transcriptLibrary.reduce((sum, transcript) => sum + Number(transcript.message_count || 0), 0);
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentCount = transcriptLibrary.filter((transcript) => new Date(transcript.created_at).getTime() >= weekAgo).length;
    const stats = document.querySelectorAll("#transcriptStats strong");
    if (stats.length === 3) {
      stats[0].textContent = transcriptLibrary.length;
      stats[1].textContent = recentCount;
      stats[2].textContent = totalMessages;
    }

    const latest = document.getElementById("openLatestTranscript");
    if (latest) {
      if (transcriptLibrary[0]?.id) {
        latest.href = `/admin/transcripts/${encodeURIComponent(transcriptLibrary[0].id)}`;
        latest.hidden = false;
      } else {
        latest.hidden = true;
      }
    }

    if (!transcriptLibrary.length) {
      document.getElementById("transcriptResultCount").textContent = "No records yet";
      container.innerHTML = '<div class="empty-state">No transcripts yet. Closed Discord tickets will appear here automatically.</div>';
      return;
    }

    const search = document.getElementById("transcriptSearchInput");
    if (search) search.oninput = () => renderTranscriptLibrary(search.value);
    renderTranscriptLibrary(search?.value || "");
  } catch (err) {
    console.error("Transcripts load error:", err);
    container.innerHTML = '<div class="empty-state">Failed to load transcripts.</div>';
  }
}

// ── Session keepalive (ping every 30 min to refresh cookies) ──
setInterval(async () => {
  if (!isAuthed) return;
  try { await apiFetch("/api/admin/visitors"); } catch { /* will redirect on next real action */ }
}, 30 * 60 * 1000);

// ── Boot ──
checkAuth();
