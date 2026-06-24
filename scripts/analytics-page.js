import { getCurrentSession } from "./supabase-client.js";
import { initReveal, renderMessage } from "./site.js";

initReveal();

const REFRESH_INTERVAL_MS = 10_000;

const messageBox = document.querySelector("[data-analytics-message]");
const accessForm = document.querySelector("[data-analytics-access-form]");
const accessCard = accessForm?.closest(".admin-access-card");
const analyticsShell = document.querySelector("[data-analytics-shell]");
const activeVisitors = document.querySelector("[data-active-visitors]");
const activeWindow = document.querySelector("[data-active-window]");
const updatedAt = document.querySelector("[data-analytics-updated]");
const pageActivityList = document.querySelector("[data-page-activity-list]");
const visitorViewList = document.querySelector("[data-visitor-view-list]");

let refreshTimer = null;

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

async function unlockOwnerPanel(ownerKey) {
  const response = await fetch("/api/owner/sign-in", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ownerKey }),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Unable to unlock panel.");
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
            IP ${escapeHtml(view.ipAddress || "unknown")} - ${escapeHtml(
        view.visitorLabel || "anonymous"
      )} - ${formatTimestamp(view.viewedAt)}
          </small>
        </article>
      `
    )
    .join("");
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
  renderMessage(messageBox, "Panel unlocked.", "success");
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
}

accessForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(accessForm);
  const ownerKey = String(formData.get("ownerKey") || "").trim();

  if (!ownerKey) {
    return;
  }

  try {
    await unlockOwnerPanel(ownerKey);
    await loadAnalytics();
    startRefreshLoop();
  } catch (error) {
    renderMessage(
      messageBox,
      error instanceof Error ? error.message : "Unable to unlock panel.",
      "error"
    );
  }
});

loadAnalytics()
  .then(startRefreshLoop)
  .catch(() => {});
