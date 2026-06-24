import { getCurrentSession } from "./supabase-client.js";
import { initReveal, renderMessage } from "./site.js";

initReveal();

const OWNER_LABEL_STORAGE = "halo-owner-label";

const messageBox = document.querySelector("[data-requests-message]");
const ownerAccessForm = document.querySelector("[data-owner-access-form]");
const requestsShell = document.querySelector("[data-requests-shell]");
const requestList = document.querySelector("[data-access-request-list]");
const auditLogList = document.querySelector("[data-audit-log-list]");

function formatTimestamp(value) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getOwnerLabel() {
  return window.localStorage.getItem(OWNER_LABEL_STORAGE) || "owner";
}

function setOwnerLabel(ownerLabel) {
  window.localStorage.setItem(OWNER_LABEL_STORAGE, ownerLabel);
}

function ownerHeaders() {
  return {
    "Content-Type": "application/json",
  };
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
    throw new Error(payload.error || "Unable to unlock owner panel.");
  }
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

function statusTone(status) {
  if (status === "approved") {
    return "fulfilled";
  }

  if (status === "denied") {
    return "failed";
  }

  return "pending";
}

function renderRequests(requests) {
  if (!requests.length) {
    requestList.innerHTML = '<div class="member-empty">No staff requests yet.</div>';
    return;
  }

  requestList.innerHTML = requests
    .map(
      (request) => `
        <article class="request-card">
          <div class="member-item-top">
            <strong>${escapeHtml(request.discordUsername || "Unknown staff")}</strong>
            <span class="member-chip member-chip-${statusTone(request.status)}">${request.status}</span>
          </div>
          <p class="request-account-line">${escapeHtml(request.userEmail || "No linked email")}</p>
          <p>${escapeHtml(request.reason || "No reason provided.")}</p>
          <small>Requested ${formatTimestamp(request.requestedAt)}</small>
          <div class="request-card-actions">
            <button class="button button-primary" type="button" data-approve-request="${request.id}" ${
              request.status === "pending" ? "" : "disabled"
            }>Approve</button>
            <button class="button button-danger" type="button" data-deny-request="${request.id}" ${
              request.status === "pending" ? "" : "disabled"
            }>Deny</button>
            <button class="button button-secondary" type="button" data-delete-request="${request.id}">
              Delete Request
            </button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAuditLogs(logs) {
  if (!logs.length) {
    auditLogList.innerHTML = '<div class="member-empty">No admin logs yet.</div>';
    return;
  }

  auditLogList.innerHTML = logs
    .map(
      (log) => `
        <article class="request-card request-card-log">
          <div class="member-item-top">
            <strong>${escapeHtml(log.action.replaceAll("_", " "))}</strong>
            <span class="member-chip member-chip-open">${escapeHtml(
              log.actorDiscordUsername || "unknown"
            )}</span>
          </div>
          <p>${escapeHtml(log.targetType)}: ${escapeHtml(log.targetId)}</p>
          <small>${formatTimestamp(log.createdAt)}</small>
        </article>
      `
    )
    .join("");
}

async function loadRequests() {
  const session = await getCurrentSession();

  if (!session) {
    requestsShell.hidden = true;
    renderMessage(messageBox, "Sign in first, then reload this owner panel.", "warn");
    return;
  }

  const response = await fetch("/api/admin/access-requests", {
    credentials: "same-origin",
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Unable to load staff requests.");
  }

  requestsShell.hidden = false;
  renderRequests(payload.requests || []);
  renderAuditLogs(payload.auditLogs || []);
  renderMessage(messageBox, "Owner panel unlocked.", "success");
}

async function updateRequest(requestId, action) {
  const response = await fetch(`/api/admin/access-requests/${requestId}/${action}`, {
    method: "POST",
    credentials: "same-origin",
    headers: ownerHeaders(),
    body: JSON.stringify({
      approvedBy: getOwnerLabel(),
      deniedBy: getOwnerLabel(),
    }),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || `Unable to ${action} request.`);
  }

  await loadRequests();
  renderMessage(messageBox, `Request ${action === "approve" ? "approved" : "denied"}.`, "success");
}

async function deleteRequest(requestId) {
  const confirmed = window.confirm("Delete this staff access request from the list?");

  if (!confirmed) {
    return;
  }

  const response = await fetch(`/api/admin/access-requests/${requestId}`, {
    method: "DELETE",
    credentials: "same-origin",
    headers: ownerHeaders(),
    body: JSON.stringify({
      deletedBy: getOwnerLabel(),
    }),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Unable to delete request.");
  }

  await loadRequests();
  renderMessage(messageBox, "Request deleted and logged.", "success");
}

ownerAccessForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(ownerAccessForm);
  const ownerKey = String(formData.get("ownerKey") || "").trim();
  const ownerLabel = String(formData.get("ownerLabel") || "").trim();

  if (!ownerKey || !ownerLabel) {
    return;
  }

  setOwnerLabel(ownerLabel);

  try {
    await unlockOwnerPanel(ownerKey);
    await loadRequests();
  } catch (error) {
    renderMessage(
      messageBox,
      error instanceof Error ? error.message : "Unable to unlock request panel.",
      "error"
    );
  }
});

requestList?.addEventListener("click", async (event) => {
  const approveButton = event.target.closest("[data-approve-request]");
  const denyButton = event.target.closest("[data-deny-request]");
  const deleteButton = event.target.closest("[data-delete-request]");

  if (!approveButton && !denyButton && !deleteButton) {
    return;
  }

  const requestId =
    approveButton?.dataset.approveRequest ||
    denyButton?.dataset.denyRequest ||
    deleteButton?.dataset.deleteRequest;
  const action = approveButton ? "approve" : "deny";

  try {
    if (deleteButton) {
      await deleteRequest(requestId);
      return;
    }

    await updateRequest(requestId, action);
  } catch (error) {
    renderMessage(
      messageBox,
      error instanceof Error ? error.message : `Unable to ${action} request.`,
      "error"
    );
  }
});

loadRequests().catch(() => {});
