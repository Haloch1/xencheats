import { getCurrentSession } from "./supabase-client.js";
import { initReveal, renderMessage } from "./site.js";

initReveal();

const ADMIN_STAFF_TOKEN_STORAGE = "halo-admin-staff-token";
const ADMIN_PENDING_ACCESS_STORAGE = "halo-admin-pending-access";
const REFRESH_INTERVAL_MS = 15000;
const ACCESS_POLL_INTERVAL_MS = 5000;

const messageBox = document.querySelector("[data-admin-message]");
const accessForm = document.querySelector("[data-admin-access-form]");
const deskShell = document.querySelector("[data-admin-desk]");
const threadList = document.querySelector("[data-admin-thread-list]");
const threadTitle = document.querySelector("[data-admin-thread-title]");
const threadMeta = document.querySelector("[data-admin-thread-meta]");
const threadMessages = document.querySelector("[data-admin-thread-messages]");
const replyForm = document.querySelector("[data-admin-reply-form]");
const deleteThreadButton = document.querySelector("[data-admin-delete-thread]");
const deleteKeyModal = document.querySelector("[data-delete-key-modal]");
const deleteKeyForm = document.querySelector("[data-delete-key-form]");
const deleteKeyCloseButton = document.querySelector("[data-delete-key-close]");

let activeThreads = [];
let activeThreadId = null;
let accessPollTimer = null;

function formatTimestamp(value) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStaffToken() {
  return window.sessionStorage.getItem(ADMIN_STAFF_TOKEN_STORAGE) || "";
}

function setStaffToken(value) {
  window.sessionStorage.setItem(ADMIN_STAFF_TOKEN_STORAGE, value);
}

function clearStaffToken() {
  window.sessionStorage.removeItem(ADMIN_STAFF_TOKEN_STORAGE);
}

function getPendingAccess() {
  try {
    return JSON.parse(window.sessionStorage.getItem(ADMIN_PENDING_ACCESS_STORAGE) || "null");
  } catch {
    return null;
  }
}

function setPendingAccess(value) {
  window.sessionStorage.setItem(ADMIN_PENDING_ACCESS_STORAGE, JSON.stringify(value));
}

function clearPendingAccess() {
  window.sessionStorage.removeItem(ADMIN_PENDING_ACCESS_STORAGE);
}

function openDeleteKeyModal() {
  if (!deleteKeyModal) {
    return;
  }

  deleteKeyModal.hidden = false;
  document.body.classList.add("modal-open");
  deleteKeyForm?.elements?.deleteKey?.focus();
}

function closeDeleteKeyModal() {
  if (!deleteKeyModal) {
    return;
  }

  deleteKeyModal.hidden = true;
  document.body.classList.remove("modal-open");
  deleteKeyForm?.reset();
}

function lockAdminDesk() {
  if (!deskShell) {
    return;
  }

  deskShell.hidden = true;
  deskShell.classList.add("admin-desk-locked");
  deskShell.style.display = "none";
  replyForm.hidden = true;
  deleteThreadButton.hidden = true;
}

function unlockAdminDesk() {
  if (!deskShell) {
    return;
  }

  deskShell.hidden = false;
  deskShell.classList.remove("admin-desk-locked");
  deskShell.style.removeProperty("display");
  deskShell.classList.add("is-visible");
}

function getStaffHeaders() {
  return {
    "x-admin-staff-token": getStaffToken(),
  };
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

function shouldPauseRefresh() {
  const activeElement = document.activeElement;
  const replyDraft = String(replyForm?.elements?.body?.value || "").trim();

  return Boolean(
    activeElement &&
      replyForm?.contains(activeElement) &&
      (activeElement.tagName === "TEXTAREA" || replyDraft.length)
  );
}

function renderActiveThread(thread) {
  activeThreadId = thread.id;
  threadTitle.textContent = thread.subject;
  threadMeta.textContent = `${thread.contactName || "Unknown"} | ${
    thread.contactMethod || "No contact"
  } | ${thread.status.toUpperCase()}`;
  replyForm.hidden = false;
  deleteThreadButton.hidden = false;
  replyForm.elements.status.value = thread.status;

  threadMessages.innerHTML = thread.messages
    .map(
      (message) => `
        <article class="desk-message-bubble desk-message-bubble-${message.senderType}">
          <span>${message.senderType === "admin" ? "Support" : "Member"}</span>
          <p>${escapeHtml(message.body)}</p>
          <small>${formatTimestamp(message.createdAt)}</small>
        </article>
      `
    )
    .join("");

  threadList.querySelectorAll(".desk-thread-item").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.threadId === thread.id);
  });
}

function renderThreads(threads) {
  activeThreads = threads;

  if (!threads.length) {
    activeThreadId = null;
    threadList.innerHTML = '<div class="member-empty">No support threads yet.</div>';
    threadTitle.textContent = "Select a thread";
    threadMeta.textContent = "Pick a thread from the left to review the conversation and send a reply.";
    threadMessages.innerHTML = '<div class="member-empty">No thread selected.</div>';
    replyForm.hidden = true;
    deleteThreadButton.hidden = true;
    return;
  }

  threadList.innerHTML = threads
    .map(
      (thread) => `
        <button class="desk-thread-item" type="button" data-thread-id="${thread.id}">
          <div class="desk-thread-item-top">
            <strong>${escapeHtml(thread.subject)}</strong>
            <span class="member-chip member-chip-${thread.status}">${thread.status}</span>
          </div>
          <p>${escapeHtml(thread.contactName || "Unknown")} | ${escapeHtml(
            thread.contactMethod || "No contact"
          )}</p>
          <small>${formatTimestamp(thread.lastMessageAt || thread.updatedAt || thread.createdAt)}</small>
        </button>
      `
    )
    .join("");

  const nextThread = threads.find((thread) => thread.id === activeThreadId) || threads[0];
  renderActiveThread(nextThread);
}

async function loadThreads() {
  if (!getStaffToken()) {
    renderMessage(messageBox, "Request approval before loading the admin desk.", "info");
    lockAdminDesk();
    return;
  }

  const response = await fetch("/api/admin/live-desk", {
    credentials: "same-origin",
    headers: getStaffHeaders(),
  });
  const payload = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      clearStaffToken();
      lockAdminDesk();
    }

    throw new Error(payload.error || "Unable to load admin desk threads.");
  }

  unlockAdminDesk();
  renderMessage(
    messageBox,
    "Admin desk unlocked with approved staff access.",
    "success"
  );
  renderThreads(payload.threads || []);
}

async function pollAccessRequest() {
  const pending = getPendingAccess();

  if (!pending?.id || !pending?.requestToken || !pending?.staffToken) {
    return;
  }

  const response = await fetch(
    `/api/admin/access-request/${encodeURIComponent(pending.id)}?token=${encodeURIComponent(
      pending.requestToken
    )}`,
    {
      credentials: "same-origin",
    }
  );
  const payload = await response.json();

  if (!response.ok) {
    clearPendingAccess();
    throw new Error(payload.error || "Unable to check access request.");
  }

  if (payload.request?.status === "approved") {
    setStaffToken(pending.staffToken);
    clearPendingAccess();
    window.clearInterval(accessPollTimer);
    accessPollTimer = null;
    await loadThreads();
    renderMessage(messageBox, "Access approved. Staff session is active.", "success");
    return;
  }

  if (payload.request?.status === "denied") {
    clearPendingAccess();
    window.clearInterval(accessPollTimer);
    accessPollTimer = null;
    renderMessage(messageBox, "Access request denied. Ask the owner before trying again.", "error");
    return;
  }

  renderMessage(
    messageBox,
    `Access request pending for ${payload.request?.discordUsername || "staff"}. Keep this page open.`,
    "info"
  );
}

function startAccessPolling() {
  if (accessPollTimer) {
    return;
  }

  accessPollTimer = window.setInterval(() => {
    pollAccessRequest().catch((error) => {
      renderMessage(
        messageBox,
        error instanceof Error ? error.message : "Unable to check access request.",
        "error"
      );
    });
  }, ACCESS_POLL_INTERVAL_MS);
}

threadList?.addEventListener("click", (event) => {
  const button = event.target.closest(".desk-thread-item");

  if (!button) {
    return;
  }

  const thread = activeThreads.find((item) => item.id === button.dataset.threadId);

  if (thread) {
    renderActiveThread(thread);
  }
});

accessForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(accessForm);
  const adminKey = String(formData.get("adminKey") || "").trim();
  const discordUsername = String(formData.get("discordUsername") || "").trim();
  const reason = String(formData.get("reason") || "").trim();

  if (!adminKey || !discordUsername || !reason) {
    return;
  }

  const session = await getCurrentSession();

  if (!session) {
    renderMessage(
      messageBox,
      "Sign in to your site account before requesting admin desk access.",
      "warn"
    );
    return;
  }

  const submitButton = accessForm.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Requesting...";
  }

  try {
    const response = await fetch("/api/admin/access-request", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey,
      },
      body: JSON.stringify({
        discordUsername,
        reason,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to request access.");
    }

    setPendingAccess({
      id: payload.request.id,
      requestToken: payload.requestToken,
      staffToken: payload.staffToken,
      discordUsername,
    });
    clearStaffToken();
    accessForm.reset();
    renderMessage(
      messageBox,
      "Access request sent. Wait for approval on the requests page.",
      "success"
    );
    await pollAccessRequest();
    startAccessPolling();
  } catch (error) {
    renderMessage(
      messageBox,
      error instanceof Error ? error.message : "Unable to request access.",
      "error"
    );
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Request Desk Access";
    }
  }
});

replyForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!activeThreadId) {
    return;
  }

  const formData = new FormData(replyForm);
  const body = String(formData.get("body") || "").trim();
  const status = String(formData.get("status") || "pending");

  if (!body) {
    return;
  }

  const submitButton = replyForm.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Sending Reply...";
  }

  try {
    const response = await fetch("/api/admin/live-desk/reply", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...getStaffHeaders(),
      },
      body: JSON.stringify({
        threadId: activeThreadId,
        body,
        status,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to send the reply.");
    }

    replyForm.reset();
    await loadThreads();
    renderMessage(messageBox, "Reply sent and logged.", "success");
  } catch (error) {
    renderMessage(
      messageBox,
      error instanceof Error ? error.message : "Unable to send the reply.",
      "error"
    );
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Send Reply";
    }
  }
});

deleteThreadButton?.addEventListener("click", async () => {
  if (!activeThreadId) {
    return;
  }

  const thread = activeThreads.find((item) => item.id === activeThreadId);
  const label = thread?.subject || "this ticket";
  const confirmed = window.confirm(
    `Request a one-time delete key for "${label}"? The owner webhook will receive the key.`
  );

  if (!confirmed) {
    return;
  }

  deleteThreadButton.disabled = true;
  deleteThreadButton.textContent = "Requesting Key...";

  try {
    const response = await fetch(
      `/api/admin/live-desk/${encodeURIComponent(activeThreadId)}/request-delete-key`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: getStaffHeaders(),
      }
    );
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to request a delete key.");
    }

    renderMessage(
      messageBox,
      "Delete key requested. Ask the owner for the one-time key from Discord.",
      "success"
    );
    openDeleteKeyModal();
  } catch (error) {
    renderMessage(
      messageBox,
      error instanceof Error ? error.message : "Unable to request a delete key.",
      "error"
    );
  } finally {
    deleteThreadButton.disabled = false;
    deleteThreadButton.textContent = "Delete Ticket";
  }
});

deleteKeyCloseButton?.addEventListener("click", closeDeleteKeyModal);

deleteKeyModal?.addEventListener("click", (event) => {
  if (event.target === deleteKeyModal) {
    closeDeleteKeyModal();
  }
});

deleteKeyForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!activeThreadId) {
    return;
  }

  const formData = new FormData(deleteKeyForm);
  const deleteKey = String(formData.get("deleteKey") || "").trim();
  const submitButton = deleteKeyForm.querySelector('button[type="submit"]');

  if (!deleteKey) {
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Deleting...";
  }

  try {
    const response = await fetch(
      `/api/admin/live-desk/${encodeURIComponent(activeThreadId)}/confirm-delete`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...getStaffHeaders(),
        },
        body: JSON.stringify({ deleteKey }),
      }
    );
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to delete the ticket.");
    }

    closeDeleteKeyModal();
    activeThreadId = null;
    await loadThreads();
    renderMessage(messageBox, "Ticket deleted with one-time key and logged.", "success");
  } catch (error) {
    renderMessage(
      messageBox,
      error instanceof Error ? error.message : "Unable to delete the ticket.",
      "error"
    );
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Confirm Delete";
    }
  }
});

if (getStaffToken()) {
  try {
    await loadThreads();
  } catch (error) {
    renderMessage(
      messageBox,
      error instanceof Error ? error.message : "Unable to load admin desk threads.",
      "error"
    );
  }
} else if (getPendingAccess()) {
  await pollAccessRequest().catch((error) => {
    renderMessage(
      messageBox,
      error instanceof Error ? error.message : "Unable to check access request.",
      "error"
    );
  });
  startAccessPolling();
} else {
  renderMessage(messageBox, "Enter the staff key, Discord username, and reason to request access.", "info");
}

window.setInterval(() => {
  if (!getStaffToken() || shouldPauseRefresh()) {
    return;
  }

  loadThreads().catch(() => {});
}, REFRESH_INTERVAL_MS);
