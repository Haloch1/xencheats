import { getCurrentSession } from "./supabase-client.js";
import { initReveal, renderMessage } from "./site.js";

initReveal();

const messageBox = document.querySelector("[data-users-message]");
const accessForm = document.querySelector("[data-users-access-form]");
const accessCard = accessForm?.closest(".admin-access-card");
const usersShell = document.querySelector("[data-users-shell]");
const usersList = document.querySelector("[data-users-list]");

function formatTimestamp(value) {
  if (!value) {
    return "Unknown";
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

function renderUsers(users) {
  if (!users.length) {
    usersList.innerHTML = '<div class="member-empty">No users found.</div>';
    return;
  }

  const providerLabel = (p) => p === "discord" ? "Discord" : p === "google" ? "Google" : "Email";

  usersList.innerHTML = users
    .map(
      (user) => `
        <article class="request-card">
          <div class="member-item-top">
            <strong>${escapeHtml(user.username || "No username")}</strong>
            <span class="member-chip member-chip-${user.emailConfirmedAt ? "fulfilled" : "pending"}">
              ${user.emailConfirmedAt ? "confirmed" : "unconfirmed"}
            </span>
          </div>
          <p class="request-account-line">${escapeHtml(user.email || "No email")}</p>
          <small>via ${escapeHtml(providerLabel(user.provider))}</small>
          <small>ID ${escapeHtml(user.id)}</small>
          <small>Created ${formatTimestamp(user.createdAt)}</small>
        </article>
      `
    )
    .join("");
}

function lockUsersPanel() {
  usersShell.hidden = true;
  usersShell.classList.remove("is-visible");
  if (accessCard) {
    accessCard.hidden = false;
  }
}

function unlockUsersPanel() {
  usersShell.hidden = false;
  usersShell.classList.add("is-visible");
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
    throw new Error(payload.error || "Unable to unlock owner panel.");
  }
}

async function loadUsers() {
  const session = await getCurrentSession();

  if (!session) {
    lockUsersPanel();
    renderMessage(messageBox, "Sign in first, then reload this owner page.", "warn");
    return;
  }

  const response = await fetch("/api/admin/users", {
    credentials: "same-origin",
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Unable to load users.");
  }

  unlockUsersPanel();
  renderUsers(payload.users || []);
  renderMessage(messageBox, "Users loaded. Passwords are intentionally never exposed.", "success");
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
    await loadUsers();
  } catch (error) {
    renderMessage(
      messageBox,
      error instanceof Error ? error.message : "Unable to load users.",
      "error"
    );
  }
});

loadUsers().catch(() => {});
