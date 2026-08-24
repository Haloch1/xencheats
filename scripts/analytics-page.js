import { getCurrentSession } from "./supabase-client.js";
import { initReveal, renderMessage } from "./site.js";

initReveal();

const REFRESH_INTERVAL_MS = 10_000;
const SLOW_REFRESH_INTERVAL_MS = 60_000;

const messageBox = document.querySelector("[data-analytics-message]");
const accessForm = document.querySelector("[data-analytics-access-form]");
const accessCard = accessForm?.closest(".admin-access-card");
const analyticsShell = document.querySelector("[data-analytics-shell]");
const activeVisitors = document.querySelector("[data-active-visitors]");
const activeWindow = document.querySelector("[data-active-window]");
const updatedAt = document.querySelector("[data-analytics-updated]");
const pageActivityList = document.querySelector("[data-page-activity-list]");
const visitorViewList = document.querySelector("[data-visitor-view-list]");
const statChart = document.querySelector("[data-stat-chart]");
const statTooltip = document.querySelector("[data-stat-tooltip]");
const statChartUpdated = document.querySelector("[data-stat-chart-updated]");
const statFields = {
  revenue: document.querySelector("[data-stat-revenue]"),
  revenueNote: document.querySelector("[data-stat-revenue-note]"),
  orders: document.querySelector("[data-stat-orders]"),
  ordersNote: document.querySelector("[data-stat-orders-note]"),
  average: document.querySelector("[data-stat-average]"),
  fulfillment: document.querySelector("[data-stat-fulfillment]"),
  conversion: document.querySelector("[data-stat-conversion]"),
  members: document.querySelector("[data-stat-members]"),
  membersNote: document.querySelector("[data-stat-members-note]"),
  verified: document.querySelector("[data-stat-verified]"),
  departures: document.querySelector("[data-stat-departures]"),
  support: document.querySelector("[data-stat-support]"),
};

let statDays = 30;

const funnelUpdated = document.querySelector("[data-funnel-updated]");
const funnelNote = document.querySelector("[data-funnel-note]");
const exitPagesList = document.querySelector("[data-exit-pages-list]");
const abandonmentTable = document.querySelector("[data-abandonment-table]");
const abandonmentEmpty = document.querySelector("[data-abandonment-empty]");
const funnelStat = {
  total: document.querySelector("[data-funnel-total]"),
  viewedProduct: document.querySelector("[data-funnel-viewed-product]"),
  abandoned: document.querySelector("[data-funnel-abandoned]"),
  bounced: document.querySelector("[data-funnel-bounced]"),
  active: document.querySelector("[data-funnel-active]"),
  converted: document.querySelector("[data-funnel-converted]"),
};

const churnUpdated = document.querySelector("[data-churn-updated]");
const departuresTable = document.querySelector("[data-departures-table]");
const departuresEmpty = document.querySelector("[data-departures-empty]");
const churnStat = {
  total: document.querySelector("[data-churn-total]"),
  avgDays: document.querySelector("[data-churn-avg-days]"),
  medianDays: document.querySelector("[data-churn-median-days]"),
  d7: document.querySelector("[data-churn-7d]"),
  d30: document.querySelector("[data-churn-30d]"),
  verified: document.querySelector("[data-churn-verified]"),
};

let refreshTimer = null;
let slowRefreshTimer = null;

function formatTimestamp(value) {
  if (!value) {
    return "Not loaded yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeStyle: "medium",
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

function lockAnalyticsPanel() {
  analyticsShell.hidden = true;
  analyticsShell.classList.remove("is-visible");

  if (accessCard) {
    accessCard.hidden = false;
  }

  window.clearInterval(refreshTimer);
  refreshTimer = null;
}

function unlockAnalyticsPanel() {
  analyticsShell.hidden = false;
  analyticsShell.classList.add("is-visible");

  if (accessCard) {
    accessCard.hidden = true;
  }
}

async function checkAdminRole() {
  const response = await fetch("/api/auth/role", { credentials: "same-origin" });
  const payload = await response.json();
  if (payload.role !== "admin") {
    throw new Error(payload.role ? "Staff accounts cannot access analytics." : "Sign in with an admin account.");
  }
}

function renderPages(pages) {
  if (!pages.length) {
    pageActivityList.innerHTML = '<div class="member-empty">No live visitors yet.</div>';
    return;
  }

  pageActivityList.innerHTML = pages
    .map(
      (page) => `
        <article class="analytics-page-row">
          <span>${escapeHtml(page.pagePath)}</span>
          <strong>${Number(page.count || 0)}</strong>
        </article>
      `
    )
    .join("");
}

function renderRecentViews(views) {
  if (!views.length) {
    visitorViewList.innerHTML = '<div class="member-empty">No page views logged yet.</div>';
    return;
  }

  visitorViewList.innerHTML = views
    .map(
      (view) => `
        <article class="analytics-view-row">
          <div>
            <strong>${escapeHtml(view.pagePath)}</strong>
            <span>${escapeHtml(view.referrer || "Direct")}</span>
          </div>
          <small>
            ${escapeHtml(view.userLabel ? `User ${view.userLabel}` : "Guest")} - IP ${escapeHtml(
        view.ipAddress || "unknown"
      )} - ${escapeHtml(
        view.visitorLabel || "anonymous"
      )} - ${formatTimestamp(view.viewedAt)}
          </small>
        </article>
      `
    )
    .join("");
}

function formatMoney(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function moneyString(value) {
  const parsed = Number.parseFloat(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? `$${parsed.toFixed(2)}` : "$0.00";
}

function renderStatChart(daily) {
  if (!statChart) return;
  const rows = Array.isArray(daily) && daily.length ? daily : [{ date: new Date().toISOString().slice(0, 10), views: 0, orders: 0, revenue: "$0.00" }];
  const width = 920;
  const height = 300;
  const pad = { top: 22, right: 18, bottom: 34, left: 12 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const values = {
    views: rows.map((row) => Number(row.views) || 0),
    orders: rows.map((row) => Number(row.orders) || 0),
    revenue: rows.map((row) => Number.parseFloat(String(row.revenue || "").replace(/[^0-9.-]/g, "")) || 0),
  };
  const maxBySeries = Object.fromEntries(Object.entries(values).map(([key, series]) => [key, Math.max(1, ...series)]));
  const point = (series, value, index) => {
    const x = pad.left + (rows.length === 1 ? innerWidth / 2 : (index / (rows.length - 1)) * innerWidth);
    const y = pad.top + innerHeight - (value / maxBySeries[series]) * innerHeight;
    return [x, y];
  };
  const path = (series) => values[series].map((value, index) => `${index ? "L" : "M"} ${point(series, value, index).join(" ")}`).join(" ");
  const areaPath = `${path("views")} L ${pad.left + innerWidth} ${pad.top + innerHeight} L ${pad.left} ${pad.top + innerHeight} Z`;
  const grid = [0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = pad.top + innerHeight - ratio * innerHeight;
    return `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" class="stat-chart-grid-line" />`;
  }).join("");
  const labels = rows.map((row, index) => {
    if (index !== 0 && index !== rows.length - 1 && index % Math.max(1, Math.floor(rows.length / 5)) !== 0) return "";
    const [x] = point("views", 0, index);
    return `<text x="${x}" y="${height - 9}" class="stat-chart-label" text-anchor="middle">${escapeHtml(row.date.slice(5))}</text>`;
  }).join("");
  const circles = rows.map((row, index) => {
    const [x, y] = point("views", values.views[index], index);
    return `<circle cx="${x}" cy="${y}" r="5" class="stat-chart-hit" data-stat-index="${index}" tabindex="0"><title>${row.date}: ${values.views[index]} views</title></circle>`;
  }).join("");
  statChart.innerHTML = `${grid}<path d="${areaPath}" class="stat-chart-area" /><path d="${path("views")}" class="stat-chart-line stat-chart-line-views" /><path d="${path("orders")}" class="stat-chart-line stat-chart-line-orders" /><path d="${path("revenue")}" class="stat-chart-line stat-chart-line-revenue" />${circles}${labels}`;

  const showTooltip = (index, event) => {
    if (!statTooltip) return;
    const row = rows[index];
    statTooltip.innerHTML = `<strong>${escapeHtml(row.date)}</strong><span>${values.views[index]} views · ${values.orders[index]} orders</span><span>${moneyString(row.revenue)} revenue</span>`;
    statTooltip.hidden = false;
    if (event?.clientX) {
      const bounds = statChart.getBoundingClientRect();
      statTooltip.style.left = `${Math.min(Math.max(event.clientX - bounds.left, 72), bounds.width - 72)}px`;
      statTooltip.style.top = `${Math.max(8, event.clientY - bounds.top - 80)}px`;
    }
  };
  statChart.querySelectorAll("[data-stat-index]").forEach((node) => {
    node.addEventListener("pointerenter", (event) => showTooltip(Number(node.dataset.statIndex), event));
    node.addEventListener("focus", () => showTooltip(Number(node.dataset.statIndex)));
  });
  statChart.onpointerleave = () => { if (statTooltip) statTooltip.hidden = true; };
}

function renderStatOverview(payload) {
  const totals = payload.totals || {};
  const discord = payload.discord || {};
  statFields.revenue.textContent = totals.revenue || "$0.00";
  statFields.revenueNote.textContent = `Last ${payload.days || statDays} days`;
  statFields.orders.textContent = String(totals.orders || 0);
  statFields.ordersNote.textContent = `${totals.ordersPerDay || "0.00"} per day`;
  statFields.average.textContent = totals.averageOrder || "$0.00";
  statFields.fulfillment.textContent = `${totals.fulfillmentRate || "0.0%"} fulfilled`;
  statFields.conversion.textContent = totals.conversionRate || "0.0%";
  statFields.members.textContent = String(discord.members || 0);
  statFields.membersNote.textContent = `${discord.online || 0} online now`;
  statFields.verified.textContent = String(discord.verified || 0);
  statFields.departures.textContent = String(totals.departures || 0);
  statFields.support.textContent = String((Number(totals.webTickets) || 0) + (Number(totals.discordTickets) || 0));
  statChartUpdated.textContent = `Updated ${formatTimestamp(payload.updatedAt)} · ${payload.days || statDays} days`;
  renderStatChart(payload.daily || []);
}

async function loadStatOverview() {
  const response = await fetch(`/api/admin/analytics/overview?days=${statDays}`, { credentials: "same-origin" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Unable to load store statistics.");
  renderStatOverview(payload);
}

function formatDays(value) {
  if (value === null || value === undefined) return "-";
  return `${value}d`;
}

function formatDate(value) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function renderExitPages(pages) {
  if (!exitPagesList) return;
  if (!pages.length) {
    exitPagesList.innerHTML = '<div class="member-empty">No data yet.</div>';
    return;
  }
  exitPagesList.innerHTML = pages
    .map(
      (page) => `
        <article class="analytics-page-row">
          <span>${escapeHtml(page.pagePath)}</span>
          <strong>${Number(page.exits || 0)}</strong>
        </article>
      `
    )
    .join("");
}

function renderAbandonment(rows) {
  if (!abandonmentTable) return;
  const body = rows
    .map(
      (row) => `
        <div class="analytics-table-row">
          <span>${escapeHtml(row.productSlug)}</span>
          <span>${Number(row.abandonedCount || 0)}</span>
          <span>${formatMoney(row.abandonedValueCents)}</span>
          <span>${Number(row.completedCount || 0)}</span>
        </div>
      `
    )
    .join("");
  abandonmentTable.querySelectorAll(".analytics-table-row:not(.analytics-table-head)").forEach((el) => el.remove());
  if (abandonmentEmpty) abandonmentEmpty.hidden = rows.length > 0;
  abandonmentTable.insertAdjacentHTML("beforeend", body);
}

function renderFunnelStats(summary) {
  if (!funnelStat.total) return;
  funnelStat.total.textContent = String(summary.totalVisitors || 0);
  funnelStat.viewedProduct.textContent = String(summary.viewedProduct || 0);
  funnelStat.abandoned.textContent = String(summary.abandonedAfterProductView || 0);
  funnelStat.bounced.textContent = String(summary.bouncedNoProductView || 0);
  funnelStat.active.textContent = String(summary.stillActive || 0);
  funnelStat.converted.textContent = String(summary.converted || 0);

  if (funnelNote) {
    const showNote = summary.converted === 0 && summary.cancelledAtCheckout === 0 && summary.abandonedAfterProductView > 0;
    funnelNote.hidden = !showNote;
    if (showNote) {
      funnelNote.textContent =
        "No checkout-success or checkout-cancel page views tracked yet in this window — tracking on those two pages just went live, so this number fills in over the next few days.";
    }
  }
}

async function loadFunnelAnalytics() {
  const response = await fetch("/api/admin/analytics/funnel?days=30&idleHours=2", {
    credentials: "same-origin",
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Unable to load funnel analytics.");
  }
  renderFunnelStats(payload.summary || {});
  renderExitPages(payload.exitPages || []);
  renderAbandonment(payload.checkoutAbandonment || []);
  if (funnelUpdated) funnelUpdated.textContent = `Updated ${formatTimestamp(payload.updatedAt)} · last 30 days`;
}

function renderDepartures(rows) {
  if (!departuresTable) return;
  const body = rows
    .map(
      (row) => `
        <div class="analytics-table-row analytics-table-row-5col">
          <span>${escapeHtml(row.tag || row.username || row.discordId)}</span>
          <span>${formatDate(row.joinedAt)}</span>
          <span>${formatDate(row.leftAt)}</span>
          <span>${formatDays(row.membershipDays)}</span>
          <span>${row.wasVerified ? "Yes" : "No"}</span>
        </div>
      `
    )
    .join("");
  departuresTable.querySelectorAll(".analytics-table-row:not(.analytics-table-head)").forEach((el) => el.remove());
  if (departuresEmpty) departuresEmpty.hidden = rows.length > 0;
  departuresTable.insertAdjacentHTML("beforeend", body);
}

function renderChurnStats(summary) {
  if (!churnStat.total) return;
  churnStat.total.textContent = String(summary.totalDepartures || 0);
  churnStat.avgDays.textContent = formatDays(summary.avgMembershipDays);
  churnStat.medianDays.textContent = formatDays(summary.medianMembershipDays);
  churnStat.d7.textContent = String(summary.leftWithin7Days || 0);
  churnStat.d30.textContent = String(summary.leftWithin30Days || 0);
  churnStat.verified.textContent = String(summary.wasVerifiedCount || 0);
}

async function loadChurnAnalytics() {
  const response = await fetch("/api/admin/analytics/churn?days=90", {
    credentials: "same-origin",
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Unable to load churn analytics.");
  }
  renderChurnStats(payload.summary || {});
  renderDepartures(payload.recent || []);
  if (churnUpdated) churnUpdated.textContent = `Updated ${formatTimestamp(payload.updatedAt)} · last 90 days`;
}

async function loadAnalytics() {
  const session = await getCurrentSession();

  if (!session) {
    lockAnalyticsPanel();
    renderMessage(messageBox, "Sign in required.", "warn");
    return;
  }

  const response = await fetch("/api/admin/visitors", {
    credentials: "same-origin",
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Unable to load panel.");
  }

  unlockAnalyticsPanel();
  activeVisitors.textContent = String(payload.activeVisitors || 0);
  activeWindow.textContent = `Active in the last ${payload.activeWindowSeconds || 75} seconds`;
  updatedAt.textContent = `Updated ${formatTimestamp(payload.updatedAt)}`;
  renderPages(payload.pages || []);
  renderRecentViews(payload.recentViews || []);
  await loadStatOverview();
  renderMessage(messageBox, "Panel unlocked.", "success");
}

// Funnel/churn are heavier aggregate queries than the live-visitor panel, so
// they load independently and don't block it — one failing doesn't take
// down the rest of the page.
async function loadSlowAnalytics() {
  const results = await Promise.allSettled([loadFunnelAnalytics(), loadChurnAnalytics()]);
  for (const result of results) {
    if (result.status === "rejected") console.error("[Analytics]", result.reason);
  }
}

function startRefreshLoop() {
  window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => {
    loadAnalytics().catch((error) => {
      renderMessage(
        messageBox,
        error instanceof Error ? error.message : "Unable to refresh panel.",
        "error"
      );
    });
  }, REFRESH_INTERVAL_MS);

  window.clearInterval(slowRefreshTimer);
  slowRefreshTimer = window.setInterval(loadSlowAnalytics, SLOW_REFRESH_INTERVAL_MS);
}

document.querySelectorAll("[data-stat-days]").forEach((button) => {
  button.addEventListener("click", async () => {
    const nextDays = Number(button.dataset.statDays);
    if (![7, 30, 90].includes(nextDays) || nextDays === statDays) return;
    statDays = nextDays;
    document.querySelectorAll("[data-stat-days]").forEach((item) => item.classList.toggle("is-active", item === button));
    try {
      await loadStatOverview();
    } catch (error) {
      renderMessage(messageBox, error instanceof Error ? error.message : "Unable to load statistics.", "error");
    }
  });
});

// Auto-check role and load if admin
(async () => {
  try {
    await checkAdminRole();
    await loadAnalytics();
    startRefreshLoop();
  } catch (error) {
    renderMessage(
      messageBox,
      error instanceof Error ? error.message : "Sign in with an admin account.",
      "error"
    );
  }
})();
