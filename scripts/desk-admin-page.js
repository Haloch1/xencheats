import { getCurrentSession } from "./supabase-client.js";
import { initReveal, renderMessage } from "./site.js";

initReveal();

const REFRESH_INTERVAL_MS = 15000;

const messageBox = document.querySelector("[data-admin-message]");
const accessCard = document.querySelector(".admin-access-card");
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
let userRole = null;

/* ── Unread tracking (admin side - tracks member messages) ── */
function getAdminReadTimestamps() {
  try { return JSON.parse(localStorage.getItem("desk_admin_read_ts") || "{}"); } catch { return {}; }
}

function markAdminThreadRead(threadId, thread) {
  const ts = getAdminReadTimestamps();
  const lastMsg = thread.messages?.at(-1);
  ts[threadId] = lastMsg?.createdAt || new Date().toISOString();
  localStorage.setItem("desk_admin_read_ts", JSON.stringify(ts));
}

function hasAdminUnread(thread) {
  const ts = getAdminReadTimestamps();
  const readAt = ts[thread.id];
  if (!readAt) return thread.messages?.some(m => m.senderType === "member");
  return thread.messages?.some(m => m.senderType === "member" && new Date(m.createdAt) > new Date(readAt));
}

function getAdminUnreadCount(threads) {
  return threads.filter(hasAdminUnread).length;
}

function formatTimestamp(value) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function timeAgo(value) {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatTimestamp(value);
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
  if (accessCard) {
    accessCard.hidden = false;
    accessCard.classList.add("is-visible");
  }
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
  if (accessCard) {
    accessCard.hidden = true;
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
  markAdminThreadRead(thread.id, thread);
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
          <span>${message.senderType === "admin" ? "Support" : message.senderType === "bot" ? "AI Support" : "Member"}</span>
          <p>${escapeHtml(message.body)}</p>
          <small>${formatTimestamp(message.createdAt)}</small>
        </article>
      `
    )
    .join("");

  // Auto-scroll to newest message
  threadMessages.scrollTop = threadMessages.scrollHeight;

  threadList.querySelectorAll(".desk-thread-item").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.threadId === thread.id);
    item.querySelector(".desk-unread-dot")?.classList.toggle("is-hidden", item.dataset.threadId === thread.id);
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

  const unreadTotal = getAdminUnreadCount(threads);
  const headerEl = document.querySelector("[data-admin-thread-list]")?.closest(".desk-inbox-panel")?.querySelector("h3");
  if (headerEl) headerEl.textContent = unreadTotal > 0 ? `Support threads (${unreadTotal} new)` : "Support threads";

  // Update tab title with unread count
  document.title = unreadTotal > 0 ? `(${unreadTotal}) Admin Desk | Halo Cheats` : "Admin Desk | Halo Cheats";

  threadList.innerHTML = threads
    .map(
      (thread) => {
        const unread = hasAdminUnread(thread);
        const lastMsg = thread.messages?.at(-1);
        const previewSender = lastMsg?.senderType === "admin" ? "You" : lastMsg?.senderType === "bot" ? "AI" : "Member";
        const previewText = lastMsg?.body || "No messages yet.";
        return `
        <button class="desk-thread-item${unread ? " desk-thread-unread" : ""}" type="button" data-thread-id="${thread.id}">
          <div class="desk-thread-item-top">
            <strong>${escapeHtml(thread.subject)}</strong>
            <span class="desk-unread-dot${unread ? "" : " is-hidden"}" title="New message"></span>
            <span class="member-chip member-chip-${thread.status}">${thread.status}</span>
          </div>
          <p><span class="desk-preview-sender">${previewSender}:</span> ${escapeHtml(previewText.slice(0, 80))}${previewText.length > 80 ? "..." : ""}</p>
          <small>${timeAgo(thread.lastMessageAt || thread.updatedAt || thread.createdAt)}</small>
        </button>
      `;
      }
    )
    .join("");

  const nextThread = threads.find((thread) => thread.id === activeThreadId) || threads[0];
  renderActiveThread(nextThread);
}

async function loadThreads() {
  if (!userRole) {
    renderMessage(messageBox, "Sign in with a staff or admin account.", "info");
    lockAdminDesk();
    return;
  }

  const response = await fetch("/api/admin/live-desk", {
    credentials: "same-origin",
  });
  const payload = await response.json();

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      lockAdminDesk();
    }

    throw new Error(payload.error || "Unable to load admin desk threads.");
  }

  unlockAdminDesk();
  renderMessage(messageBox, "Admin desk unlocked.", "success");
  renderThreads(payload.threads || []);
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
    submitButton.textContent = "Sending...";
    submitButton.style.opacity = "0.5";
  }

  // Optimistically show the message right away
  const optimisticHtml = `
    <article class="desk-message-bubble desk-message-bubble-admin">
      <span>Support</span>
      <p>${escapeHtml(body)}</p>
      <small>just now</small>
    </article>
  `;
  threadMessages.insertAdjacentHTML("beforeend", optimisticHtml);
  threadMessages.scrollTop = threadMessages.scrollHeight;

  try {
    const response = await fetch("/api/admin/live-desk/reply", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
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
    renderMessage(messageBox, "Reply sent.", "success");
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
      submitButton.style.opacity = "";
    }
  }
});

deleteThreadButton?.addEventListener("click", async () => {
  if (!activeThreadId) {
    return;
  }

  const thread = activeThreads.find((item) => item.id === activeThreadId);
  const label = thread?.subject || "this ticket";

  /* Admin path: direct delete */
  if (userRole === "admin") {
    const confirmed = window.confirm(`Delete "${label}"? This cannot be undone.`);
    if (!confirmed) return;

    deleteThreadButton.disabled = true;
    deleteThreadButton.textContent = "Deleting...";

    try {
      const response = await fetch(
        `/api/admin/live-desk/${encodeURIComponent(activeThreadId)}`,
        { method: "DELETE", credentials: "same-origin" }
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to delete the ticket.");
      }

      activeThreadId = null;
      await loadThreads();
      renderMessage(messageBox, "Ticket deleted.", "success");
    } catch (error) {
      renderMessage(
        messageBox,
        error instanceof Error ? error.message : "Unable to delete the ticket.",
        "error"
      );
    } finally {
      deleteThreadButton.disabled = false;
      deleteThreadButton.textContent = "Delete Ticket";
    }
    return;
  }

  /* Staff path: request a delete key */
  const confirmed = window.confirm(
    `Request a one-time delete key for "${label}"? An admin will receive the key.`
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
      }
    );
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to request a delete key.");
    }

    renderMessage(
      messageBox,
      "Delete key requested. Ask an admin for the one-time key from Discord.",
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

/* Check role and load desk */
try {
  const roleRes = await fetch("/api/auth/role", { credentials: "same-origin" });
  const roleData = await roleRes.json();
  userRole = roleData.role;

  if (userRole === "admin" || userRole === "staff") {
    await loadThreads();
  } else {
    renderMessage(messageBox, "Sign in with a staff or admin account to access the desk.", "warn");
    lockAdminDesk();
  }
} catch (error) {
  renderMessage(
    messageBox,
    error instanceof Error ? error.message : "Unable to check access.",
    "error"
  );
}

window.setInterval(() => {
  if (!userRole || shouldPauseRefresh()) {
    return;
  }

  loadThreads().catch(() => {});
}, REFRESH_INTERVAL_MS);
