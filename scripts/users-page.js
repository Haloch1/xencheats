import { getCurrentSession } from "./supabase-client.js";
import { initReveal, renderMessage } from "./site.js";

initReveal();

const OWNER_KEY_STORAGE = "halo-owner-requests-key";

const messageBox = document.querySelector("[data-users-message]");
const accessForm = document.querySelector("[data-users-access-form]");
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

function getOwnerKey() {
  return window.localStorage.getItem(OWNER_KEY_STORAGE) || "";
}

function setOwnerKey(value) {
  window.localStorage.setItem(OWNER_KEY_STORAGE, value);
}

function renderUsers(users) {
  if (!users.length) {
    usersList.innerHTML = '<div class="member-empty">No users found.</div>';
    return;
  }

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
          <small>ID ${escapeHtml(user.id)}</small>
          <small>Created ${formatTimestamp(user.createdAt)}</small>
        </article>
      `
    )
    .join("");
}

async function loadUsers() {
  const session = await getCurrentSession();

  if (!session) {
    usersShell.hidden = true;
    renderMessage(messageBox, "Sign in first, then reload this owner page.", "warn");
    return;
  }

  const ownerKey = getOwnerKey();

  if (!ownerKey) {
    usersShell.hidden = true;
    renderMessage(messageBox, "Enter the owner key to load users.", "info");
    return;
  }

  const response = await fetch("/api/admin/users", {
    credentials: "same-origin",
    headers: {
      "x-owner-key": ownerKey,
    },
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Unable to load users.");
  }

  usersShell.hidden = false;
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

  setOwnerKey(ownerKey);

  try {
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
