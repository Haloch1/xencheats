import { getCurrentSession } from "./supabase-client.js";
import { initReveal, renderMessage } from "./site.js";

initReveal();

const REFRESH_INTERVAL_MS = 15000;

const messageBox = document.querySelector("[data-desk-message]");
const threadList = document.querySelector("[data-desk-thread-list]");
const threadTitle = document.querySelector("[data-desk-thread-title]");
const threadMeta = document.querySelector("[data-desk-thread-meta]");
const threadMessages = document.querySelector("[data-desk-thread-messages]");
const replyForm = document.querySelector("[data-member-reply-form]");

let activeThreadId = null;
let activeThreads = [];

/* ── Unread tracking (localStorage) ── */
function getReadTimestamps() {
  try { return JSON.parse(localStorage.getItem("desk_read_ts") || "{}"); } catch { return {}; }
}

function markThreadRead(threadId, thread) {
  const ts = getReadTimestamps();
  const lastMsg = thread.messages?.at(-1);
  ts[threadId] = lastMsg?.createdAt || new Date().toISOString();
  localStorage.setItem("desk_read_ts", JSON.stringify(ts));
}

function hasUnread(thread) {
  const ts = getReadTimestamps();
  const readAt = ts[thread.id];
  if (!readAt) return thread.messages?.some(m => m.senderType === "admin" || m.senderType === "bot");
  return thread.messages?.some(m => (m.senderType === "admin" || m.senderType === "bot") && new Date(m.createdAt) > new Date(readAt));
}

function getUnreadCount(threads) {
  return threads.filter(hasUnread).length;
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

let previousUnreadCount = 0;

function shouldPauseRefresh() {
  const activeElement = document.activeElement;
  const replyDraft = String(replyForm?.elements?.body?.value || "").trim();

  return Boolean(
    activeElement &&
      replyForm?.contains(activeElement) &&
      (activeElement.tagName === "TEXTAREA" || replyDraft.length)
  );
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

function linkify(text) {
  return text.replace(
    /(https?:\/\/[^\s<]+|(?:halocheats\.cc|discord\.gg)\/[^\s<]*)/g,
    (url) => {
      const href = url.startsWith("http") ? url : `https://${url}`;
      return `<a href="${href}" target="_blank" rel="noopener">${url}</a>`;
    }
  );
}

function renderThreadMessages(thread) {
  activeThreadId = thread.id;
  markThreadRead(thread.id, thread);
  threadTitle.textContent = thread.subject;
  threadMeta.textContent = `${thread.status.toUpperCase()} | Last update ${formatTimestamp(
    thread.lastMessageAt || thread.updatedAt || thread.createdAt
  )}`;
  replyForm.hidden = false;

  threadMessages.innerHTML = thread.messages
    .map(
      (message) => `
        <article class="desk-message-bubble desk-message-bubble-${message.senderType === "bot" ? "admin" : message.senderType}">
          <span>${message.senderType === "admin" ? "Support" : message.senderType === "bot" ? "AI Support" : "You"}</span>
          <p>${message.senderType === "bot" || message.senderType === "admin" ? linkify(escapeHtml(message.body)) : escapeHtml(message.body)}</p>
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
    threadList.innerHTML =
      '<div class="member-empty">No threads yet. Open a request from the homepage live desk.</div>';
    threadTitle.textContent = "Select a thread";
    threadMeta.textContent = "Choose a thread from the left to read the full conversation.";
    threadMessages.innerHTML = '<div class="member-empty">No thread selected.</div>';
    replyForm.hidden = true;
    return;
  }

  const unreadTotal = getUnreadCount(threads);
  const headerEl = document.querySelector(".desk-inbox-header h3");
  if (headerEl) headerEl.textContent = unreadTotal > 0 ? `Your conversations (${unreadTotal} new)` : "Your conversations";

  // Update tab title with unread count
  document.title = unreadTotal > 0 ? `(${unreadTotal}) Desk Inbox | Halo Cheats` : "Desk Inbox | Halo Cheats";

  // Play notification sound if new unread messages appeared
  if (unreadTotal > previousUnreadCount && previousUnreadCount >= 0) {
    try { new Audio("data:audio/wav;base64,UklGRl9vT19teleVk...").play().catch(() => {}); } catch {}
    // Fallback: use system notification if available
    if (Notification.permission === "granted") {
      new Notification("Halo Cheats Support", { body: "You have a new reply from support.", icon: "/assets/hc-logo.png" });
    } else if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }
  previousUnreadCount = unreadTotal;

  threadList.innerHTML = threads
    .map(
      (thread) => {
        const unread = hasUnread(thread);
        const lastMsg = thread.messages.at(-1);
        const previewSender = lastMsg?.senderType === "admin" ? "Support" : lastMsg?.senderType === "bot" ? "AI" : "You";
        const previewText = lastMsg?.body || "No messages yet.";
        return `
        <button class="desk-thread-item${unread ? " desk-thread-unread" : ""}" type="button" data-thread-id="${thread.id}">
          <div class="desk-thread-item-top">
            <strong>${escapeHtml(thread.subject)}</strong>
            <span class="desk-unread-dot${unread ? "" : " is-hidden"}" title="New reply"></span>
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
  renderThreadMessages(nextThread);
}

async function loadThreads() {
  const session = await getCurrentSession();

  if (!session) {
    renderMessage(
      messageBox,
      "Sign in first to load your desk inbox and support replies.",
      "warn"
    );
    threadList.innerHTML =
      '<div class="member-empty">Sign in from the account page to load your inbox.</div>';
    replyForm.hidden = true;
    return;
  }

  const response = await fetch("/api/live-desk/mine", {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Unable to load your desk inbox.");
  }

  renderMessage(
    messageBox,
    "Signed in. New support replies will show up in this inbox.",
    "success"
  );
  renderThreads(payload.threads || []);
}

threadList?.addEventListener("click", (event) => {
  const button = event.target.closest(".desk-thread-item");

  if (!button) {
    return;
  }

  const thread = activeThreads.find((item) => item.id === button.dataset.threadId);

  if (thread) {
    renderThreadMessages(thread);
  }
});

replyForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!activeThreadId) {
    return;
  }

  const session = await getCurrentSession();

  if (!session) {
    renderMessage(messageBox, "Please sign in again before sending a desk reply.", "warn");
    return;
  }

  const formData = new FormData(replyForm);
  const body = String(formData.get("body") || "").trim();

  if (!body) {
    return;
  }

  const submitButton = replyForm.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Sending Message...";
  }

  try {
    const response = await fetch("/api/live-desk/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        threadId: activeThreadId,
        body,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Unable to send your message.");
    }

    replyForm.reset();
    await loadThreads();
    renderMessage(messageBox, "Message sent. Support will see it in the live desk queue.", "success");
  } catch (error) {
    renderMessage(
      messageBox,
      error instanceof Error ? error.message : "Unable to send your message.",
      "error"
    );
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Send Message";
    }
  }
});

try {
  await loadThreads();
} catch (error) {
  renderMessage(
    messageBox,
    error instanceof Error ? error.message : "Unable to load your desk inbox.",
    "error"
  );
}

window.setInterval(() => {
  if (shouldPauseRefresh()) {
    return;
  }

  loadThreads().catch(() => {});
}, REFRESH_INTERVAL_MS);
