import {
  authConfigured,
  clearServerSession,
  getAuthConfigMessage,
  getCurrentSession,
  signInWithServerSession,
  signUpWithServerSession,
  supabase,
} from "./supabase-client.js";
import { initReveal, renderMessage } from "./site.js";

initReveal();

const statusBox = document.querySelector("[data-account-message]");
const cardStatusBox = document.querySelector("[data-account-card-message]");
const accountActionMessage = document.querySelector("[data-account-action-message]");
const guestView = document.querySelector("[data-guest-view]");
const memberView = document.querySelector("[data-member-view]");
const sessionUsername = document.querySelector("[data-session-username]");
const sessionEmail = document.querySelector("[data-session-email]");
const sessionRole = document.querySelector("[data-session-role]");
const dashboardLabel = document.querySelector("[data-dashboard-label]");
const accountAvatar = document.querySelector("[data-account-avatar]");
const accountStatOrders = document.querySelector('[data-account-stat="orders"]');
const accountStatBalance = document.querySelector('[data-account-stat="balance"]');
const accountOverviewBalance = document.querySelector("[data-account-overview-balance]");
const accountTabButtons = document.querySelectorAll("[data-account-tab]");
const accountBalancePanel = document.querySelector("[data-topup-panel]");
const accountOverviewSections = [
  document.querySelector(".discord-link-section"),
  document.querySelector("[data-admin-perks]"),
  document.querySelector(".member-grid"),
].filter(Boolean);

function setAccountTab(tabName) {
  const showBalance = tabName === "balance";
  accountTabButtons.forEach((button) => {
    const isActive = button.dataset.accountTab === tabName;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  accountOverviewSections.forEach((section) => {
    section.classList.toggle("is-account-tab-hidden", showBalance);
  });
  accountBalancePanel?.classList.toggle("is-account-tab-hidden", !showBalance);
}

accountTabButtons.forEach((button) => {
  button.addEventListener("click", () => setAccountTab(button.dataset.accountTab || "overview"));
});
setAccountTab("overview");
const signUpForm = document.querySelector("[data-signup-form]");
const signInForm = document.querySelector("[data-signin-form]");
const resetRequestForm = document.querySelector("[data-reset-request-form]");
const passwordUpdateForm = document.querySelector("[data-password-update-form]");
const signOutButton = document.querySelector("[data-signout]");
const ordersList = document.querySelector("[data-orders-list]");
const suggestedShell = document.querySelector("[data-suggested-shell]");
const suggestedGrid = document.querySelector("[data-suggested-grid]");
const adminPerksPanel = document.querySelector("[data-admin-perks]");
const adminPerksTitle = document.querySelector("[data-admin-perks-title]");
const adminPerksCopy = document.querySelector("[data-admin-perks-copy]");
const adminPerksBadges = document.querySelector("[data-admin-perks-badges]");
const adminPerksActions = document.querySelector("[data-admin-perks-actions]");
const authSwitchButtons = document.querySelectorAll("[data-auth-tab]");
const authPanes = document.querySelectorAll("[data-auth-pane]");
const passwordToggleButtons = document.querySelectorAll("[data-password-toggle]");
const googleAuthLabel = document.querySelector("[data-google-auth-label]");
const discordAuthLabel = document.querySelector("[data-discord-auth-label]");

/* Only allow same-origin relative paths ("/products/", not "//evil.com",
   "https://evil.com", or "javascript:..."). Prevents open redirect / XSS. */
const accountQuery = new URLSearchParams(window.location.search);
const rawNextPath = accountQuery.get("next");
const nextPath = rawNextPath && /^\/(?!\/)/.test(rawNextPath) ? rawNextPath : null;
const pendingAuthPathKey = "xencheats_pending_auth_path";

function buildPostAuthPath() {
  if (nextPath) {
    const destination = new URL(nextPath, window.location.origin);
    const intent = accountQuery.get("intent");
    const product = accountQuery.get("product");
    const variant = accountQuery.get("variant");

    if (/^(checkout|notify)$/.test(intent || "")) destination.searchParams.set("intent", intent);
    if (/^[a-z0-9-]+$/i.test(product || "")) destination.searchParams.set("product", product);
    if (/^[a-z0-9-]+$/i.test(variant || "")) destination.searchParams.set("variant", variant);

    const path = `${destination.pathname}${destination.search}${destination.hash}`;
    sessionStorage.setItem(pendingAuthPathKey, JSON.stringify({ path, savedAt: Date.now() }));
    return path;
  }

  try {
    const pending = JSON.parse(sessionStorage.getItem(pendingAuthPathKey) || "null");
    if (
      pending &&
      /^\/(?!\/)/.test(pending.path || "") &&
      Date.now() - Number(pending.savedAt || 0) < 30 * 60 * 1000
    ) {
      return pending.path;
    }
  } catch {
    sessionStorage.removeItem(pendingAuthPathKey);
  }

  return null;
}

const postAuthPath = buildPostAuthPath();
let isPasswordRecovery = false;
let catalogProductsPromise = null;

function fetchRoleLabel(role) {
  if (role === "admin") {
    return "Admin access";
  }

  if (role === "staff") {
    return "Staff access";
  }

  return "";
}

function fetchDashboardLabel(role) {
  if (role === "admin") return "Admin dashboard";
  if (role === "staff") return "Staff dashboard";
  return "Member dashboard";
}

function renderAdminPerks(role) {
  if (!adminPerksPanel || !adminPerksTitle || !adminPerksCopy || !adminPerksBadges || !adminPerksActions) {
    return;
  }

  if (role !== "admin" && role !== "staff") {
    adminPerksPanel.hidden = true;
    adminPerksBadges.innerHTML = "";
    adminPerksActions.innerHTML = "";
    return;
  }

  const configs = {
    admin: {
      title: "Admin tools unlocked",
      copy:
        "This account can manage live desk traffic, open the full store panel, and review staff flow without leaving the member dashboard.",
      badges: ["Full admin panel", "Desk moderation", "Analytics access", "Staff approvals"],
      actions: [
        { href: "/admin/", label: "Open Admin Panel", tone: "button-primary" },
        { href: "/desk-admin/", label: "Open Desk Admin", tone: "button-secondary" },
        { href: "/analytics/", label: "View Analytics", tone: "button-secondary" },
        { href: "/requests/", label: "Staff Requests", tone: "button-secondary" },
      ],
    },
    staff: {
      title: "Staff tools unlocked",
      copy:
        "This account can work the member queue, reply from the hidden desk inbox, and keep active tickets moving faster.",
      badges: ["Desk inbox", "Reply access", "Ticket workflow", "Member queue"],
      actions: [
        { href: "/desk-admin/", label: "Open Desk Admin", tone: "button-primary" },
        { href: "#", label: "Member Inbox", tone: "button-secondary" },
        { href: "/products/", label: "Check Products", tone: "button-secondary" },
      ],
    },
  };

  const config = configs[role];
  adminPerksTitle.textContent = config.title;
  adminPerksCopy.textContent = config.copy;
  adminPerksBadges.innerHTML = config.badges
    .map((badge) => `<span class="admin-perk-badge">${escapeHtml(badge)}</span>`)
    .join("");
  adminPerksActions.innerHTML = config.actions
    .map(
      (action) =>
        `<a class="button ${action.tone}" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>`
    )
    .join("");
  adminPerksPanel.hidden = false;
}

async function fetchAccountRole(session) {
  if (!session?.access_token) {
    return null;
  }

  try {
    const response = await fetch("/api/auth/role", {
      credentials: "same-origin",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    const payload = await response.json();
    return payload.role || null;
  } catch {
    return null;
  }
}

function showStatusMessage(message, tone = "info", { forceScroll = false } = {}) {
  // The guest card already contains its own message location. Showing the
  // same OAuth result above and inside the card creates two error banners on
  // phones and pushes the form below the fold.
  const target = guestView && !guestView.hidden
    ? (cardStatusBox || statusBox)
    : (statusBox || cardStatusBox);

  [statusBox, cardStatusBox].forEach((box) => {
    if (box && box !== target) box.hidden = true;
  });

  if (target) {
    target.hidden = false;
    renderMessage(target, message, tone);
    // Important results (e.g. a blocked verification) need to be scrolled
    // into view on every screen size, not just mobile - on desktop the
    // dashboard renders above the fold and buries the banner otherwise,
    // which is what made it look like it "flashed and disappeared."
    if (forceScroll) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  if (!forceScroll && window.matchMedia("(max-width: 760px)").matches) {
    cardStatusBox?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function setAuthTab(tabName) {
  authSwitchButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authTab === tabName);
  });

  authPanes.forEach((pane) => {
    const isActive = pane.dataset.authPane === tabName;
    pane.classList.toggle("is-active", isActive);
    pane.hidden = !isActive;
  });

  const isSignIn = tabName === "signin";
  if (googleAuthLabel) googleAuthLabel.textContent = isSignIn ? "Sign in with Google" : "Continue with Google";
  if (discordAuthLabel) discordAuthLabel.textContent = isSignIn ? "Sign in with Discord" : "Continue with Discord";
}

function formatTimestamp(value) {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

function renderListEmpty(target, message) {
  if (!target) {
    return;
  }

  target.innerHTML = `<div class="member-empty">${message}</div>`;
}

function hideSuggestedProducts() {
  if (suggestedShell) {
    suggestedShell.hidden = true;
  }

  if (suggestedGrid) {
    suggestedGrid.innerHTML = "";
  }
}

async function loadCatalogProducts() {
  if (!catalogProductsPromise) {
    catalogProductsPromise = fetch("/api/products")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load products.");
        }

        const payload = await response.json();
        return payload.products || [];
      })
      .catch((error) => {
        catalogProductsPromise = null;
        throw error;
      });
  }

  return catalogProductsPromise;
}

function pickSuggestedProducts(products, orders, keys) {
  const purchasedSlugs = new Set();

  [...(orders || []), ...(keys || [])].forEach((record) => {
    const slug = record?.baseProductSlug || record?.productSlug;
    if (slug) {
      purchasedSlugs.add(slug);
    }
  });

  if (!purchasedSlugs.size) {
    return [];
  }

  const purchasedProducts = products.filter((product) => purchasedSlugs.has(product.slug));
  const purchasedCategories = new Set(purchasedProducts.map((product) => product.category).filter(Boolean));
  const purchasedGames = new Set(purchasedProducts.map((product) => product.game).filter(Boolean));

  return products
    .filter((product) => !purchasedSlugs.has(product.slug))
    .filter((product) => product.available !== false)
    .map((product) => {
      const readyCount = (product.variants || []).filter((variant) => variant.checkoutReady).length;
      const stockedCount = (product.variants || []).filter((variant) => variant.stockLabel === "In Stock").length;

      let score = 0;
      if (purchasedCategories.has(product.category)) score += 5;
      if (purchasedGames.has(product.game)) score += 3;
      if (product.sale) score += 2;
      if (product.featured) score += 1;
      if (readyCount > 0) score += 2;
      if (stockedCount > 0) score += 1;

      return { product, score, readyCount, stockedCount };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.readyCount !== a.readyCount) return b.readyCount - a.readyCount;
      if (Boolean(b.product.sale) !== Boolean(a.product.sale)) {
        return Number(Boolean(b.product.sale)) - Number(Boolean(a.product.sale));
      }
      if (Boolean(b.product.featured) !== Boolean(a.product.featured)) {
        return Number(Boolean(b.product.featured)) - Number(Boolean(a.product.featured));
      }
      return String(a.product.name || "").localeCompare(String(b.product.name || ""));
    })
    .slice(0, 3)
    .map(({ product, stockedCount }) => ({
      slug: product.slug,
      name: product.name,
      category: product.category || product.game || "Catalog",
      summary: product.summary,
      priceDisplay: product.priceDisplay || "See products",
      badge: product.sale ? `${product.sale}% OFF` : product.badge || (stockedCount > 0 ? "In Stock" : "Listed"),
      tone: product.sale
        ? "paid"
        : /offline|down|detected|unavailable/i.test(String(product.badge || ""))
          ? "unknown"
          : "online",
      stockLine: stockedCount > 0 ? `${stockedCount} key${stockedCount === 1 ? "" : "s"} showing in stock` : "Browse durations on the products page",
    }));
}

function renderSuggestedProducts(items) {
  if (!suggestedShell || !suggestedGrid) {
    return;
  }

  if (!items.length) {
    hideSuggestedProducts();
    return;
  }

  suggestedGrid.innerHTML = items
    .map(
      (item) => `
        <article class="suggested-product-card">
          <div class="suggested-product-top">
            <span class="member-chip member-chip-${escapeHtml(item.tone)}">${escapeHtml(item.badge)}</span>
            <span class="suggested-product-category">${escapeHtml(item.category)}</span>
          </div>
          <strong>${escapeHtml(item.name)}</strong>
          <p>${escapeHtml(item.summary)}</p>
          <div class="suggested-product-meta">
            <span>${escapeHtml(item.priceDisplay)}</span>
            <small>${escapeHtml(item.stockLine)}</small>
          </div>
          <div class="member-item-actions suggested-product-actions">
            <a class="button button-primary button-small" href="/products/">View Product</a>
            <a class="button button-secondary button-small" href="/instructions/">Read Setup</a>
          </div>
        </article>
      `
    )
    .join("");

  suggestedShell.hidden = false;
}

/* There is no /desk/ page (only /desk-admin/). Support is the in-page AI
   widget, opened by the delegated [data-open-support] handler in
   ai-widget.js, so these "Open Help" links point at "#" and carry that
   attribute rather than navigating to a route that 404s. */
function actionDeskHref() {
  return "#";
}

/* Statuses that never belong in the customer-facing order history: pending
   is an abandoned/incomplete checkout, and canceled orders (both spellings
   are used server-side) aren't a purchase the customer needs to see. */
const HIDDEN_ORDER_STATUSES = new Set(["pending", "canceled", "cancelled"]);

const RECEIPT_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12a1 1 0 0 1 1 1v18l-3-2-3 2-3-2-3 2-3-2V3a1 1 0 0 1 1-1Z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>`;
const KEY_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.5 12.5 20 3M17 6l3 3M14 9l2 2"/></svg>`;
const COPY_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>`;

function orderIdButtonHtml(id, label) {
  return `<button type="button" class="account-record-id" data-copy-value="${escapeHtml(id)}" data-copy-label="${escapeHtml(label || "Order ID")}" title="Click to copy the full order ID">${escapeHtml(String(id || "").slice(0, 10))}${COPY_ICON_SVG}</button>`;
}

function keyValueHtml(licenseKey, showProductName) {
  return `
    <div class="account-key-value">
      <span>${showProductName ? `License key &mdash; ${escapeHtml(licenseKey.productName)}` : "License key"}</span>
      <div class="account-key-row">
        <code>${escapeHtml(licenseKey.keyValue)}</code>
        <button class="button button-primary button-small" type="button" data-copy-value="${escapeHtml(licenseKey.keyValue)}" data-copy-label="Key">Copy Key</button>
      </div>
    </div>
  `;
}

/* Orders and delivered keys render as one merged list: each order card shows
   its own license key(s) inline (a single order can have more than one key
   for a bundle), so the customer isn't hunting between two separate panels
   for the same purchase. Keys without a matching visible order (rare — e.g.
   a manually assigned key) still render as their own card so nothing is
   lost. */
function renderOrders(orders, keys) {
  if (!ordersList) {
    return;
  }

  /* Never show pending orders (e.g. abandoned checkouts) or canceled ones —
     only real, active purchase history. */
  const visibleOrders = (orders || []).filter(
    (order) => !HIDDEN_ORDER_STATUSES.has(order.status)
  );
  const visibleOrderIds = new Set(visibleOrders.map((order) => order.id));

  const keysByOrder = new Map();
  const orphanKeys = [];
  (keys || []).forEach((licenseKey) => {
    if (licenseKey.orderId && visibleOrderIds.has(licenseKey.orderId)) {
      const bucket = keysByOrder.get(licenseKey.orderId) || [];
      bucket.push(licenseKey);
      keysByOrder.set(licenseKey.orderId, bucket);
    } else {
      orphanKeys.push(licenseKey);
    }
  });

  if (!visibleOrders.length && !orphanKeys.length) {
    renderListEmpty(
      ordersList,
      "No orders yet. Use the products page to start your first checkout."
    );
    return;
  }

  /* A "paid" order means Stripe was charged but no key could be delivered yet
     (automated fulfillment and local stock both came up empty at the
     time). Server-side this already gets retried automatically every time
     the account page loads (see GET /api/account -> syncPaidOrder), and staff
     get a Discord alert — but the customer previously saw nothing beyond a
     bare "paid" chip. This banner tells them what's going on and gives a
     real, clickable path to priority help instead of leaving them guessing. */
  const unfulfilledNoticeHtml = (order) =>
    order.status === "paid"
      ? /dma|account/i.test(`${order.product_slug || ""} ${order.productName || ""}`)
        ? `<p class="member-item-notice">
             Payment received — join the
             <a href="https://discord.gg/xencheats" target="_blank" rel="noopener">Discord server</a>
             for DMA or account delivery.
           </p>`
        : `<p class="member-item-notice">
             Payment received — delivery is pending. Message us in
             <a href="#" data-open-support>live chat</a> with your Order ID
             (tap the Order ID below to copy it) and we'll verify it. You can also join our
             <a href="https://discord.gg/xencheats" target="_blank" rel="noopener">Discord server</a>
             as a backup.
           </p>`
      : "";

  const orderCardHtml = (order) => {
    const orderKeys = keysByOrder.get(order.id) || [];
    return `
        <article class="member-item account-record-card account-order-card">
          <div class="account-record-heading">
            <div class="account-record-title">
              <span class="account-record-icon account-record-icon-order" aria-hidden="true">${RECEIPT_ICON_SVG}</span>
              <div>
                <span class="account-record-kicker">Purchase</span>
                <strong>${escapeHtml(order.productName)}</strong>
              </div>
            </div>
            <span class="member-chip member-chip-${escapeHtml(order.status)}">${escapeHtml(order.status)}</span>
          </div>
          <div class="account-record-meta">
            <span><small>Amount</small><strong>${escapeHtml(order.priceDisplay)}</strong></span>
            <span><small>Placed</small><strong>${formatTimestamp(order.createdAt)}</strong></span>
            <span><small>Order ID</small>${orderIdButtonHtml(order.id)}</span>
          </div>
          ${order.fulfilledAt ? `<p class="account-record-delivery">Delivered ${formatTimestamp(order.fulfilledAt)}</p>` : ""}
          ${unfulfilledNoticeHtml(order)}
          ${orderKeys.map((licenseKey) => keyValueHtml(licenseKey, orderKeys.length > 1)).join("")}
          <div class="member-item-actions">
            <a class="button button-secondary button-small" href="${escapeHtml(order.instructionHref || "/instructions/")}">Setup Guide</a>
            <a class="button button-secondary button-small" href="#" data-open-support>Open Help</a>
            <a class="button button-secondary button-small" href="/reviews/">Leave Review</a>
          </div>
        </article>
      `;
  };

  const orphanKeyCardHtml = (licenseKey) => `
        <article class="member-item account-record-card account-key-card">
          <div class="account-record-heading">
            <div class="account-record-title">
              <span class="account-record-icon account-record-icon-key" aria-hidden="true">${KEY_ICON_SVG}</span>
              <div>
                <span class="account-record-kicker">License access</span>
                <strong>${escapeHtml(licenseKey.productName)}</strong>
              </div>
            </div>
            <span class="member-chip member-chip-${escapeHtml(licenseKey.orderStatus || licenseKey.status)}">${escapeHtml(licenseKey.orderStatus || licenseKey.status)}</span>
          </div>
          ${keyValueHtml(licenseKey, false)}
          <div class="account-record-meta">
            <span><small>Assigned</small><strong>${formatTimestamp(licenseKey.assignedAt)}</strong></span>
            ${licenseKey.orderId ? `<span><small>Order</small>${orderIdButtonHtml(licenseKey.orderId)}</span>` : ""}
          </div>
          <div class="member-item-actions">
            <a class="button button-secondary button-small" href="${escapeHtml(licenseKey.instructionHref || "/instructions/")}">Setup Guide</a>
            <a class="button button-secondary button-small" href="#" data-open-support>Open Help</a>
          </div>
        </article>
      `;

  ordersList.innerHTML =
    visibleOrders.map(orderCardHtml).join("") + orphanKeys.map(orphanKeyCardHtml).join("");
}

function clearMemberData() {
  renderOrders([], []);
  if (accountStatOrders) accountStatOrders.textContent = "0";
    hideSuggestedProducts();
}

async function copyText(value, label) {
  try {
    await navigator.clipboard.writeText(value);
    if (accountActionMessage) {
      accountActionMessage.hidden = false;
      renderMessage(accountActionMessage, `${label} copied.`, "success");
      clearTimeout(accountActionMessage._hideTimer);
      accountActionMessage._hideTimer = setTimeout(() => {
        accountActionMessage.hidden = true;
      }, 2600);
    } else {
      showStatusMessage(`${label} copied.`, "success");
    }
  } catch {
    if (accountActionMessage) {
      accountActionMessage.hidden = false;
      renderMessage(accountActionMessage, `Couldn't copy the ${label.toLowerCase()}.`, "error");
    } else {
      showStatusMessage(`Couldn't copy the ${label.toLowerCase()}.`, "error");
    }
  }
}

function setView(session) {
  const showGuestView = !session || isPasswordRecovery;
  const showMemberView = Boolean(session) && !isPasswordRecovery;

  guestView.hidden = !showGuestView;
  memberView.hidden = !showMemberView;

  /* The "Create your member account" heading is a signup prompt - hide it once
     the visitor is signed in. */
  const accountHeading = document.querySelector("[data-account-heading]");
  if (accountHeading) {
    accountHeading.hidden = showMemberView;
  }

  if (showGuestView) {
    guestView.classList.add("is-visible");
  }

  if (showMemberView) {
    memberView.classList.add("is-visible");
  }

  if (sessionEmail) {
    sessionEmail.textContent = session?.user?.email || "";
  }

  if (sessionUsername) {
    const username = session?.user?.user_metadata?.username || "Not set";
    sessionUsername.textContent = username;
    if (accountAvatar) {
      accountAvatar.textContent = username.slice(0, 1).toUpperCase();
    }
  }

  if (sessionRole) {
    sessionRole.hidden = true;
    sessionRole.textContent = "";
    sessionRole.classList.remove("is-admin", "is-staff");
  }

  if (dashboardLabel) {
    dashboardLabel.textContent = fetchDashboardLabel(null);
  }

  renderAdminPerks(null);

  if (!session) {
    clearMemberData();
  }
}

function setRoleView(role) {
  if (sessionRole) {
    const label = fetchRoleLabel(role);
    sessionRole.hidden = !label;
    sessionRole.textContent = label;
    sessionRole.classList.toggle("is-admin", role === "admin");
    sessionRole.classList.toggle("is-staff", role === "staff");
  }

  if (dashboardLabel) {
    dashboardLabel.textContent = fetchDashboardLabel(role);
  }

  renderAdminPerks(role);
}

async function loadAccountData(session) {
  if (!session) {
    clearMemberData();
    return;
  }

  const response = await fetch("/api/account", {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Unable to load account data.");
  }

  const orders = payload.orders || [];
  const licenseKeys = payload.licenseKeys || [];

  if (accountStatOrders) accountStatOrders.textContent = String(orders.filter((order) => !HIDDEN_ORDER_STATUSES.has(order.status)).length);

  renderOrders(orders, licenseKeys);

  try {
    const catalogProducts = await loadCatalogProducts();
    const suggestedItems = pickSuggestedProducts(catalogProducts, orders, licenseKeys);
    renderSuggestedProducts(suggestedItems);
  } catch {
    hideSuggestedProducts();
  }

  loadDiscordStatus(session);
}

async function refreshSession() {
  const session = await getCurrentSession();
  setView(session);

  if (!session) {
    return;
  }

  if (postAuthPath && postAuthPath !== window.location.pathname && !isPasswordRecovery) {
    sessionStorage.removeItem(pendingAuthPathKey);
    window.location.href = postAuthPath;
    return;
  }

  const role = await fetchAccountRole(session);
  setRoleView(role);

  try {
    await loadAccountData(session);
  } catch (error) {
    showStatusMessage(
      error instanceof Error ? error.message : "Unable to load account data.",
      "error"
    );
  }
}

async function finishAuth(message, session = null) {
  if (postAuthPath && postAuthPath !== window.location.pathname) {
    showStatusMessage(`${message} Redirecting...`, "success");
    sessionStorage.removeItem(pendingAuthPathKey);
    window.location.href = postAuthPath;
    return;
  }

  if (session) {
    setView(session);
    const role = await fetchAccountRole(session);
    setRoleView(role);
    showStatusMessage(message, "success");

    try {
      await loadAccountData(session);
    } catch (error) {
      showStatusMessage(
        error instanceof Error ? error.message : "Unable to load account data.",
        "error"
      );
    }

    return;
  }

  await refreshSession();
  showStatusMessage(message, "success");
}

authSwitchButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setAuthTab(button.dataset.authTab);
  });
});

passwordToggleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const field = button.closest(".password-field");
    const input = field?.querySelector("input");

    if (!input) {
      return;
    }

    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    button.textContent = isHidden ? "Hide" : "Show";
    button.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
  });
});

if (supabase) {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      isPasswordRecovery = true;
      setAuthTab("update-password");
      setView(session);
      showStatusMessage("Enter a new password to finish your reset.", "info");
      return;
    }

    await refreshSession();
  });
}

refreshSession().catch((error) => {
  showStatusMessage(
    error instanceof Error ? error.message : "Unable to load account session.",
    "error"
  );
});

/* Disables a form's submit button while its request is in flight. Returns null
   if the form is already submitting, so the caller can bail out early. */
function lockSubmit(form) {
  const button = form?.querySelector('button[type="submit"]');
  if (!button || button.disabled) return null;

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Please wait...";

  return () => {
    button.disabled = false;
    button.textContent = originalText;
  };
}

signUpForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabase) {
    showStatusMessage(getAuthConfigMessage(), "warn");
    return;
  }

  const unlockSignUp = lockSubmit(signUpForm);
  if (!unlockSignUp) return;

  const formData = new FormData(signUpForm);
  const username = formData.get("username");
  const email = formData.get("email");
  const password = formData.get("password");

  try {
    const result = await signUpWithServerSession(email, username, password);
    signUpForm.reset();

    if (result?.existingAccount) {
      await finishAuth("Welcome back! Signed you in.", result.session || result);
      return;
    }

    const session = result?.session || result;

    if (!session) {
      showStatusMessage(
        "Account created. Check your email for the confirmation link, then come back here and sign in.",
        "success"
      );
      setAuthTab("signin");
      return;
    }

    await finishAuth("Account created.", session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create account.";

    if (error?.existingAccount) {
      showStatusMessage(message, "warn");
      setAuthTab("signin");
      return;
    }

    showStatusMessage(message, "error");
  } finally {
    unlockSignUp();
  }
});

signInForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabase) {
    showStatusMessage(getAuthConfigMessage(), "warn");
    return;
  }

  const unlockSignIn = lockSubmit(signInForm);
  if (!unlockSignIn) return;

  const formData = new FormData(signInForm);
  const email = formData.get("email");
  const password = formData.get("password");

  try {
    const session = await signInWithServerSession(email, password);
    await finishAuth("Signed in successfully.", session);
  } catch (error) {
    showStatusMessage(error instanceof Error ? error.message : "Unable to sign in.", "error");
  } finally {
    unlockSignIn();
  }
});

resetRequestForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabase) {
    showStatusMessage(getAuthConfigMessage(), "warn");
    return;
  }

  const unlockReset = lockSubmit(resetRequestForm);
  if (!unlockReset) return;

  try {
    const formData = new FormData(resetRequestForm);
    const email = formData.get("email");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/account/`,
    });

    if (error) {
      showStatusMessage(error.message, "error");
      return;
    }

    resetRequestForm.reset();
    showStatusMessage("Password reset link sent. Check your email to continue.", "success");
    setAuthTab("signin");
  } finally {
    unlockReset();
  }
});

passwordUpdateForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabase) {
    showStatusMessage(getAuthConfigMessage(), "warn");
    return;
  }

  const unlockPasswordUpdate = lockSubmit(passwordUpdateForm);
  if (!unlockPasswordUpdate) return;

  try {
    const formData = new FormData(passwordUpdateForm);
    const password = formData.get("password");
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      showStatusMessage(error.message, "error");
      return;
    }

    passwordUpdateForm.reset();
    isPasswordRecovery = false;
    await supabase.auth.signOut();
    await clearServerSession();
    setView(null);
    setAuthTab("signin");
    showStatusMessage("Password updated. Sign in with your new password.", "success");
  } finally {
    unlockPasswordUpdate();
  }
});

/* Discord link */
const discordSection = document.getElementById("discordLinkSection");
const discordLabel = document.getElementById("discordLinkLabel");
const discordUsername = document.getElementById("discordLinkUsername");
const discordLinkBtn = document.getElementById("discordLinkBtn");
const discordUnlinkBtn = document.getElementById("discordUnlinkBtn");

async function loadDiscordStatus(session) {
  if (!session || !discordSection) return;
  discordSection.style.display = "block";

  try {
    const res = await fetch("/api/auth/discord/status", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();

    if (data.linked) {
      discordLabel.textContent = "Discord linked";
      discordUsername.textContent = data.discordUsername || "";
      discordLinkBtn.style.display = "none";
      discordUnlinkBtn.style.display = "inline-flex";
    } else {
      discordLabel.textContent = "Discord not linked";
      discordUsername.textContent = "";
      discordLinkBtn.style.display = "inline-flex";
      discordUnlinkBtn.style.display = "none";
    }
  } catch {
    // silent
  }
}

discordUnlinkBtn?.addEventListener("click", async () => {
  const session = await getCurrentSession();
  if (!session) return;

  discordUnlinkBtn.disabled = true;
  try {
    const res = await fetch("/api/auth/discord/unlink", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();

    if (data.signedOut) {
      // Discord-only account: unlink = sign out
      if (supabase) await supabase.auth.signOut();
      await clearServerSession();
      clearMemberData();
      setView(null);
      showStatusMessage("Discord unlinked. Sign in again to continue.", "info");
      return;
    }

    await loadDiscordStatus(session);
    showStatusMessage("Discord account unlinked.", "info");
  } catch {
    showStatusMessage("Failed to unlink Discord.", "error");
  } finally {
    discordUnlinkBtn.disabled = false;
  }
});

// Check for OAuth callback results in URL
const urlParams = new URLSearchParams(window.location.search);
const discordResult = urlParams.get("discord");
const googleResult = urlParams.get("google");

if (discordResult === "linked" || discordResult === "verified") {
  const msg = discordResult === "verified"
    ? "Verified! Your Discord is linked and you now have access to the server."
    : "Discord account linked. You'll receive keys via DM after purchase.";
  setTimeout(() => showStatusMessage(msg, "success"), 300);
  window.history.replaceState({}, "", window.location.pathname);
}
if (discordResult === "error" || discordResult === "callback_error") {
  setTimeout(() => showStatusMessage("Failed to link Discord. Please try again.", "error"), 300);
  window.history.replaceState({}, "", window.location.pathname);
}
if (discordResult === "session_expired") {
  setTimeout(() => showStatusMessage("Discord sign-in expired before it finished. Please try again.", "error"), 300);
  window.history.replaceState({}, "", window.location.pathname);
}
if (discordResult === "oauth_configuration") {
  setTimeout(() => showStatusMessage("Discord linking is temporarily unavailable. Please contact support.", "error"), 300);
  window.history.replaceState({}, "", window.location.pathname);
}
if (discordResult === "email_required") {
  setTimeout(() => showStatusMessage("Verify an email on Discord, then try signing in again.", "error"), 300);
  window.history.replaceState({}, "", window.location.pathname);
}
if (googleResult === "linked") {
  setTimeout(() => showStatusMessage("Signed in with Google.", "success"), 300);
  window.history.replaceState({}, "", window.location.pathname);
}
if (googleResult === "error") {
  setTimeout(() => showStatusMessage("Failed to sign in with Google. Please try again.", "error"), 300);
  window.history.replaceState({}, "", window.location.pathname);
}
if (googleResult === "unavailable") {
  setTimeout(() => showStatusMessage("Google sign-in isn't set up yet. Use email or Discord for now.", "error"), 300);
  window.history.replaceState({}, "", window.location.pathname);
}

memberView?.addEventListener("click", async (event) => {
  const copyButton = event.target.closest("[data-copy-value]");

  if (!copyButton) {
    return;
  }

  await copyText(copyButton.dataset.copyValue || "", copyButton.dataset.copyLabel || "Value");
});

signOutButton?.addEventListener("click", async () => {
  try {
    if (supabase) {
      await supabase.auth.signOut();
    }
  } finally {
    // The server cookie is the authoritative session. Always clear it even
    // when the optional browser Supabase client is unavailable or errors.
    await clearServerSession();
  }
  clearMemberData();
  setView(null);
  showStatusMessage("Signed out.", "info");
});

/* Balance top-up panel */
const topupPanel = accountBalancePanel;
if (topupPanel) {
  const balanceAmountEl = topupPanel.querySelector("[data-balance-amount]");
  const presetWrap = topupPanel.querySelector("[data-topup-presets]");
  const amountInput = topupPanel.querySelector("[data-topup-input]");
  const cardBtn = topupPanel.querySelector("[data-topup-card]");
  const topupMessage = topupPanel.querySelector("[data-topup-message]");

  const money = (cents) => `$${((Number(cents) || 0) / 100).toFixed(2)}`;

  async function loadBalance() {
    const session = await getCurrentSession();
    if (!session?.access_token) {
      return;
    }
    try {
      const res = await fetch("/api/balance", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      if (balanceAmountEl) {
        balanceAmountEl.textContent = money(data.balanceCents);
      }
      if (accountStatBalance) {
        accountStatBalance.textContent = money(data.balanceCents);
      }
      if (accountOverviewBalance) {
        accountOverviewBalance.textContent = money(data.balanceCents);
      }
      window.haloCart?.refreshBalance?.();
    } catch {}
  }

  presetWrap?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-amount]");
    if (!button) {
      return;
    }
    presetWrap.querySelectorAll(".topup-preset").forEach((b) => b.classList.remove("is-active"));
    button.classList.add("is-active");
    amountInput.value = (Number(button.dataset.amount) / 100).toString();
  });

  amountInput?.addEventListener("input", () => {
    presetWrap?.querySelectorAll(".topup-preset").forEach((b) => b.classList.remove("is-active"));
  });

  function readAmountCents() {
    const cents = Math.round(parseFloat(amountInput.value) * 100);
    if (!Number.isFinite(cents) || cents < 100 || cents > 50000) {
      return null;
    }
    return cents;
  }

  async function startTopup(endpoint, button) {
    const amountCents = readAmountCents();
    if (!amountCents) {
      renderMessage(topupMessage, "Enter an amount between $1 and $500.", "warn");
      return;
    }
    const session = await getCurrentSession();
    if (!session?.access_token) {
      renderMessage(topupMessage, "Sign in first to add funds.", "warn");
      return;
    }
    button.disabled = true;
    const original = button.textContent;
    button.textContent = "Redirecting...";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ amountCents }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Unable to start the top-up.");
      }
      window.location.href = data.url;
    } catch (err) {
      renderMessage(topupMessage, err instanceof Error ? err.message : "Unable to start the top-up.", "error");
      button.disabled = false;
      button.textContent = original;
    }
  }

  cardBtn?.addEventListener("click", () => startTopup("/api/balance/create-topup-session", cardBtn));

  const topupParam = new URLSearchParams(window.location.search).get("topup");
  if (topupParam === "success") {
    renderMessage(topupMessage, "Payment received. Your balance updates within a moment.", "success");
    window.setTimeout(loadBalance, 1500);
    window.setTimeout(loadBalance, 4500);
    window.history.replaceState({}, "", window.location.pathname);
  } else if (topupParam === "cancel") {
    renderMessage(topupMessage, "Top-up canceled.", "warn");
    window.history.replaceState({}, "", window.location.pathname);
  }

  loadBalance();
}
 
