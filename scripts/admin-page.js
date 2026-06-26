/* ── Admin Dashboard ── */

const loginGate = document.getElementById("loginGate");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const ownerKeyInput = document.getElementById("ownerKeyInput");
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

async function apiFetch(url) {
  const res = await fetch(url, { credentials: "include" });
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

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.style.display = "none";
  const key = ownerKeyInput.value.trim();
  if (!key) return;

  try {
    const res = await fetch("/api/owner/sign-in", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerKey: key }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Invalid key");
    isAuthed = true;
    showDashboard();
    loadOverview();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.style.display = "block";
  }
});

// Check if already authed by trying an admin endpoint
async function checkAuth() {
  try {
    await apiFetch("/api/admin/visitors");
    isAuthed = true;
    showDashboard();
    loadOverview();
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
  const loaders = {
    overview: loadOverview,
    orders: loadOrders,
    keys: loadKeys,
    users: loadUsers,
    analytics: loadAnalytics,
    support: loadSupport,
    status: loadStatus,
  };
  if (loaders[name]) loaders[name]();
}

// ── Overview ──

async function loadOverview() {
  try {
    const [orders, keys, users, visitors] = await Promise.all([
      apiFetch("/api/admin/orders?limit=10"),
      apiFetch("/api/admin/keys"),
      apiFetch("/api/admin/users"),
      apiFetch("/api/admin/visitors"),
    ]);

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
          <td><button class="admin-toolbar btn-secondary" style="padding:4px 10px;font-size:0.75rem;border-radius:6px;" onclick="viewOrder('${esc(o.id)}')">View</button></td>
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
        <td><button class="admin-toolbar btn-secondary" style="padding:4px 10px;font-size:0.75rem;border-radius:6px;" onclick="viewOrder('${esc(o.id)}')">View</button></td>
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
      <button class="modal-close" onclick="closeModal()">Close</button>
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
        '<tr><td colspan="4" class="empty-state">No users yet.</td></tr>';
      return;
    }

    tbody.innerHTML = data.users
      .map(
        (u) => `
      <tr>
        <td>${esc(u.username || "-")}</td>
        <td>${esc(u.email)}</td>
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

async function loadAnalytics() {
  try {
    const data = await apiFetch("/api/admin/visitors");
    document.getElementById("analyticsActiveNow").textContent =
      data.activeVisitors;

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

    const activityEl = document.getElementById("analyticsActivity");
    if (!data.recentViews || !data.recentViews.length) {
      activityEl.innerHTML =
        '<div class="empty-state">No recent activity.</div>';
    } else {
      activityEl.innerHTML = data.recentViews
        .slice(0, 20)
        .map(
          (v) => `
        <div class="activity-item">
          <span class="activity-path">${esc(v.pagePath || v.path || "-")}</span>
          ${v.userLabel ? `<span class="activity-user"> · ${esc(v.userLabel)}</span>` : ""}
          <span> · ${fmtDate(v.timestamp || v.time)}</span>
        </div>
      `
        )
        .join("");
    }
  } catch (err) {
    console.error("Analytics load error:", err);
  }
}

// ── Support ──

async function loadSupport() {
  try {
    const data = await apiFetch("/api/admin/live-desk");
    const tbody = document.getElementById("supportBody");

    if (!data.threads || !data.threads.length) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="empty-state">No support threads.</td></tr>';
      return;
    }

    tbody.innerHTML = data.threads
      .map(
        (t) => `
      <tr>
        <td>${esc(t.subject)}</td>
        <td>${esc(t.contactName || t.contact_name || "-")} ${t.contactMethod || t.contact_method ? `(${esc(t.contactMethod || t.contact_method)})` : ""}</td>
        <td>${chip(t.status)}</td>
        <td>${fmtDate(t.lastMessageAt || t.last_message_at || t.updatedAt || t.updated_at)}</td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    console.error("Support load error:", err);
  }
}

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
            <select onchange="updateStatus('${esc(prod.name)}', this.value, '${esc(cat.name)}')">
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

// ── Boot ──
checkAuth();
