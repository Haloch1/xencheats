/* ── Admin Dashboard ── */

const loginGate = document.getElementById("loginGate");
const dashboard = document.getElementById("dashboard");
const loginError = document.getElementById("loginError");
const orderModal = document.getElementById("orderModal");
const orderModalContent = document.getElementById("orderModalContent");

const panels = document.querySelectorAll(".admin-panel");
const navItems = document.querySelectorAll("[data-panel]");

let isAuthed = false;

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

function shortId(id) {
  if (!id) return "-";
  return id.length > 12 ? id.slice(0, 8) + "..." : id;
}

function chip(status) {
  return `<span class="chip chip-${esc(status)}">${esc(status)}</span>`;
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
  return res.json();
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

function loadPanel(name) {
  if (name !== "analytics") stopAnalyticsRefresh();
  const loaders = {
    overview: loadOverview,
    orders: loadOrders,
    keys: loadKeys,
    users: loadUsers,
    analytics: loadAnalytics,
    support: loadSupport,
    status: loadStatus,
    reviews: loadAdminReviews,
    products: loadProducts,
    transcripts: loadTranscripts,
  };
  if (loaders[name]) loaders[name]();
}

// ── Overview ──

async function loadOverview() {
  try {
    const [orders, keys, users, visitors, revenue] = await Promise.all([
      apiFetch("/api/admin/orders?limit=10"),
      apiFetch("/api/admin/keys"),
      apiFetch("/api/admin/users"),
      apiFetch("/api/admin/visitors"),
      apiFetch("/api/admin/revenue"),
    ]);

    // Revenue
    document.getElementById("revToday").textContent = revenue.today;
    document.getElementById("revWeek").textContent = revenue.week;
    document.getElementById("revMonth").textContent = revenue.month;
    document.getElementById("revAllTime").textContent = revenue.allTime;

    // Profit
    document.getElementById("profitToday").textContent = revenue.profitToday || "-";
    document.getElementById("profitWeek").textContent = revenue.profitWeek || "-";
    document.getElementById("profitMonth").textContent = revenue.profitMonth || "-";
    document.getElementById("profitAllTime").textContent = revenue.profitAllTime || "-";
    document.getElementById("statCost").textContent = revenue.totalCost || "-";
    document.getElementById("statFees").textContent = revenue.totalFees || "-";
    document.getElementById("statMargin").textContent = revenue.marginPct || "-";

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
    document.getElementById("statOrders").textContent = orders.orders.length;
    document.getElementById("statFulfilled").textContent = orders.orders.filter(
      (o) => o.status === "fulfilled"
    ).length;
    document.getElementById("statKeysAvail").textContent = keys.summary.unused;
    document.getElementById("statKeysUsed").textContent = keys.summary.assigned;
    document.getElementById("statUsers").textContent = users.users.length;
    document.getElementById("statVisitors").textContent =
      visitors.activeVisitors;

    const tbody = document.getElementById("overviewOrdersBody");
    if (!orders.orders.length) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="empty-state">No orders yet.</td></tr>';
    } else {
      tbody.innerHTML = orders.orders
        .slice(0, 8)
        .map(
          (o) => `
        <tr>
          <td>${esc(o.productName)}</td>
          <td>${chip(o.status)}</td>
          <td>${fmtDate(o.createdAt)}</td>
          <td><button class="btn-view" data-view-order="${esc(o.id)}">View</button></td>
        </tr>
      `
        )
        .join("");
    }
  } catch (err) {
    console.error("Overview load error:", err);
  }
}

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
        '<tr><td colspan="6" class="empty-state">No orders found.</td></tr>';
      return;
    }

    tbody.innerHTML = data.orders
      .map(
        (o) => `
      <tr>
        <td><code>${shortId(o.id)}</code></td>
        <td>${esc(o.productName)}</td>
        <td>${chip(o.status)}</td>
        <td>${o.hasKey ? "Yes" : "-"}</td>
        <td>${fmtDate(o.createdAt)}</td>
        <td><button class="btn-view" data-view-order="${esc(o.id)}">View</button></td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    console.error("Orders load error:", err);
  }
}

document.getElementById("orderStatusFilter").addEventListener("change", loadOrders);

document.getElementById("orderSearchBtn").addEventListener("click", async () => {
  const id = document.getElementById("orderSearchInput").value.trim();
  if (!id) return;
  await viewOrder(id);
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
      <div class="detail-row"><span class="label">Status</span><span class="value">${chip(o.status)}</span></div>
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

window.closeModal = function () {
  orderModal.classList.remove("is-open");
};

orderModal.addEventListener("click", (e) => {
  if (e.target === orderModal) closeModal();
});

// ── Keys ──

async function loadKeys() {
  const status = document.getElementById("keyStatusFilter").value;
  const qs = status ? `?status=${status}` : "";
  const note = document.getElementById("keysRefreshNote");

  try {
    const data = await apiFetch(`/api/admin/keys${qs}`);
    note.textContent = `${data.keys.length} keys`;

    const statsEl = document.getElementById("keysStats");
    statsEl.innerHTML = `
      <div class="stat-card"><div class="stat-label">Total</div><div class="stat-value">${data.summary.total}</div></div>
      <div class="stat-card"><div class="stat-label">Unused</div><div class="stat-value">${data.summary.unused}</div></div>
      <div class="stat-card"><div class="stat-label">Assigned</div><div class="stat-value">${data.summary.assigned}</div></div>
    `;

    const tbody = document.getElementById("keysBody");
    if (!data.keys.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="empty-state">No keys found.</td></tr>';
      return;
    }

    tbody.innerHTML = data.keys
      .map(
        (k) => `
      <tr>
        <td><code>${esc(k.keyValue)}</code></td>
        <td>${esc(k.productName)}</td>
        <td>${chip(k.status)}</td>
        <td>${k.assignedOrderId ? `<code>${shortId(k.assignedOrderId)}</code>` : "-"}</td>
        <td>${fmtDate(k.assignedAt)}</td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    console.error("Keys load error:", err);
  }
}

document.getElementById("keyStatusFilter").addEventListener("change", loadKeys);

// ── Users ──

async function loadUsers() {
  try {
    const data = await apiFetch("/api/admin/users");
    const tbody = document.getElementById("usersBody");

    if (!data.users.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="empty-state">No users yet.</td></tr>';
      return;
    }

    const providerLabel = (p) => {
      if (p === "discord") return "Discord";
      if (p === "google") return "Google";
      return "Email";
    };

    tbody.innerHTML = data.users
      .map(
        (u) => `
      <tr>
        <td>${esc(u.username || "-")}</td>
        <td>${esc(u.email)}</td>
        <td>${esc(providerLabel(u.provider))}</td>
        <td>${fmtDate(u.createdAt)}</td>
        <td>${u.emailConfirmedAt ? chip("confirmed") : chip("pending")}</td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    console.error("Users load error:", err);
  }
}

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
    const data = await apiFetch("/api/admin/visitors");
    const views = data.recentViews || [];

    document.getElementById("analyticsActiveNow").textContent = data.activeVisitors;
    document.getElementById("analyticsViewCount").textContent = views.length;
    document.getElementById("analyticsUpdatedAt").textContent = `Auto-refreshes every 10s · Updated ${fmtDate(data.updatedAt)}`;

    // Unique IPs
    const ips = new Set(views.map((v) => v.ipAddress).filter(Boolean));
    document.getElementById("analyticsUniqueIps").textContent = ips.size;

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
      '<tr><td colspan="5" class="empty-state">No support threads.</td></tr>';
    return;
  }

  tbody.innerHTML = supportThreads
    .map(
      (t) => `
    <tr style="cursor:pointer;" data-view-thread="${esc(t.id)}">
      <td><strong>${esc(t.subject)}</strong></td>
      <td>${esc(t.contactName || "-")} ${t.contactMethod ? `(${esc(t.contactMethod)})` : ""}</td>
      <td>${chip(t.status)}</td>
      <td>${fmtDate(t.lastMessageAt || t.updatedAt)}</td>
      <td><button class="btn-danger-sm" data-delete-thread="${esc(t.id)}" onclick="event.stopPropagation()">Delete</button></td>
    </tr>
  `
    )
    .join("");
}

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

// ── Status Editor ──

async function loadStatus() {
  try {
    const data = await fetch("/api/status").then((r) => r.json());
    const editor = document.getElementById("statusEditor");

    if (!data.length) {
      editor.innerHTML = '<div class="empty-state">No products configured.</div>';
      return;
    }

    const statusOptions = [
      "undetected",
      "online",
      "updating",
      "maintenance",
      "detected",
      "offline",
      "down",
      "unknown",
    ];

    let html = "";
    for (const cat of data) {
      html += `<h3 style="font-size:0.9rem; margin:20px 0 8px; color:var(--muted);">${esc(cat.name)}</h3>`;
      for (const prod of cat.products) {
        const options = statusOptions
          .map(
            (s) =>
              `<option value="${s}" ${prod.status === s ? "selected" : ""}>${s}</option>`
          )
          .join("");
        html += `
          <div class="status-row">
            <span class="status-cat">${esc(cat.name)}</span>
            <span class="status-name">${esc(prod.name)}</span>
            <select data-update-status data-product="${esc(prod.name)}" data-category="${esc(cat.name)}">
              ${options}
            </select>
          </div>
        `;
      }
    }

    editor.innerHTML = html;
  } catch (err) {
    console.error("Status load error:", err);
  }
}

window.updateStatus = async function (productName, status, category) {
  try {
    await apiPost("/api/status/update", {
      product_name: productName,
      status,
      category,
    });
  } catch (err) {
    alert("Failed to update: " + err.message);
  }
};

// ── Delegated event listeners (CSP-safe, no inline handlers) ──

document.addEventListener("click", (e) => {
  const viewBtn = e.target.closest("[data-view-order]");
  if (viewBtn) { viewOrder(viewBtn.dataset.viewOrder); return; }

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

document.addEventListener("change", (e) => {
  const sel = e.target.closest("[data-update-status]");
  if (sel) { updateStatus(sel.dataset.product, sel.value, sel.dataset.category); }
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
      keys.push({ product_slug: parts[0], key_value: parts[1] });
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

    const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);

    tbody.innerHTML = data.reviews
      .map(
        (r) => `
      <tr>
        <td>${esc(r.username)}</td>
        <td style="color:#ffd700;letter-spacing:1px;">${stars(r.rating)}</td>
        <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(r.review_text)}</td>
        <td>${esc(r.source === "discord" ? "Discord" : "Site")}</td>
        <td>${fmtDate(r.created_at)}</td>
        <td><button class="button button-small button-danger" data-delete-review="${r.id}">Delete</button></td>
      </tr>
    `
      )
      .join("");

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

// ── Transcripts ──

async function loadTranscripts() {
  const container = document.getElementById("transcriptsList");
  if (!container) return;

  try {
    const data = await apiFetch("/api/admin/transcripts");
    const transcripts = data.transcripts || [];

    if (!transcripts.length) {
      container.innerHTML = '<div class="empty-state">No transcripts yet. Closed Discord tickets will appear here.</div>';
      return;
    }

    container.innerHTML = transcripts.map(t => {
      const date = new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const time = new Date(t.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const dur = t.duration_minutes < 60 ? `${t.duration_minutes}m` : `${Math.floor(t.duration_minutes / 60)}h ${t.duration_minutes % 60}m`;
      const msgs = (t.messages || []).map(m => {
        const msgTime = new Date(m.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        const cssClass = m.isBot ? "transcript-msg transcript-msg-bot" : "transcript-msg";
        const author = m.isBot ? "Bot" : esc(m.author);
        return `<div class="${cssClass}"><span class="transcript-msg-author">${author}</span><span class="transcript-msg-time">${esc(msgTime)}</span><br>${esc(m.content)}</div>`;
      }).join("");

      return `
        <div class="transcript-card">
          <div class="transcript-header">
            <span class="transcript-topic">${esc(t.topic)}</span>
            <span class="transcript-meta">
              <span>${date} ${time}</span>
            </span>
          </div>
          <div class="transcript-meta" style="margin-top:4px">
            <span>By: ${esc(t.opened_by)}</span>
            <span>Closed: ${esc(t.closed_by)}</span>
            <span>Duration: ${dur}</span>
            <span>${t.message_count} messages</span>
          </div>
          <div class="transcript-messages">${msgs || '<em>No messages</em>'}</div>
        </div>`;
    }).join("");

    container.addEventListener("click", (e) => {
      const card = e.target.closest(".transcript-card");
      if (card) card.classList.toggle("is-open");
    });
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
