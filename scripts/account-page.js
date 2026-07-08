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
const guestView = document.querySelector("[data-guest-view]");
const memberView = document.querySelector("[data-member-view]");
const sessionUsername = document.querySelector("[data-session-username]");
const sessionEmail = document.querySelector("[data-session-email]");
const signUpForm = document.querySelector("[data-signup-form]");
const signInForm = document.querySelector("[data-signin-form]");
const resetRequestForm = document.querySelector("[data-reset-request-form]");
const passwordUpdateForm = document.querySelector("[data-password-update-form]");
const signOutButton = document.querySelector("[data-signout]");
const ordersList = document.querySelector("[data-orders-list]");
const keysList = document.querySelector("[data-keys-list]");
const authSwitchButtons = document.querySelectorAll("[data-auth-tab]");
const authPanes = document.querySelectorAll("[data-auth-pane]");
const passwordToggleButtons = document.querySelectorAll("[data-password-toggle]");

/* Only allow same-origin relative paths ("/products/", not "//evil.com",
   "https://evil.com", or "javascript:..."). Prevents open redirect / XSS. */
const rawNextPath = new URLSearchParams(window.location.search).get("next");
const nextPath = rawNextPath && /^\/(?!\/)/.test(rawNextPath) ? rawNextPath : null;
let isPasswordRecovery = false;

function showStatusMessage(message, tone = "info") {
  [statusBox, cardStatusBox].forEach((target) => {
    if (!target) {
      return;
    }

    target.hidden = false;
    renderMessage(target, message, tone);
  });

  if (window.matchMedia("(max-width: 760px)").matches) {
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

function actionDeskHref(record) {
  const params = new URLSearchParams();

  if (record?.orderId) {
    params.set("order", record.orderId);
  }

  if (record?.baseProductSlug) {
    params.set("product", record.baseProductSlug);
  }

  const query = params.toString();
  return query ? `/desk/?${query}` : "/desk/";
}

function renderOrders(orders) {
  if (!ordersList) {
    return;
  }

  /* Never show pending orders (e.g. abandoned checkouts) — only real ones. */
  const visibleOrders = (orders || []).filter((order) => order.status !== "pending");

  if (!visibleOrders.length) {
    renderListEmpty(
      ordersList,
      "No orders yet. Use the products page to start your first checkout."
    );
    return;
  }

  ordersList.innerHTML = visibleOrders
    .map(
      (order) => `
        <article class="member-item">
          <div class="member-item-top">
            <strong>${escapeHtml(order.productName)}</strong>
            <span class="member-chip member-chip-${escapeHtml(order.status)}">${escapeHtml(order.status)}</span>
          </div>
          <p>${escapeHtml(order.priceDisplay)}</p>
          <small>Opened ${formatTimestamp(order.createdAt)}${order.fulfilledAt ? ` | Delivered ${formatTimestamp(order.fulfilledAt)}` : ""}</small>
          <div class="member-item-actions">
            <a class="button button-secondary button-small" href="${escapeHtml(order.instructionHref || "/instructions/")}">Setup Guide</a>
            <a class="button button-secondary button-small" href="${escapeHtml(actionDeskHref(order))}">Open Help</a>
            <a class="button button-secondary button-small" href="/reviews/">Leave Review</a>
            <button class="button button-secondary button-small" type="button" data-copy-value="${escapeHtml(order.id)}" data-copy-label="Order ID">Copy Order ID</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderKeys(keys) {
  if (!keysList) {
    return;
  }

  if (!keys.length) {
    renderListEmpty(
      keysList,
      "No keys assigned yet. Paid orders will appear here after stock is available."
    );
    return;
  }

  keysList.innerHTML = keys
    .map(
      (licenseKey) => `
        <article class="member-item">
          <div class="member-item-top">
            <strong>${escapeHtml(licenseKey.productName)}</strong>
            <span class="member-chip member-chip-${escapeHtml(licenseKey.orderStatus || licenseKey.status)}">${escapeHtml(licenseKey.orderStatus || licenseKey.status)}</span>
          </div>
          <code>${escapeHtml(licenseKey.keyValue)}</code>
          ${licenseKey.orderId ? `<small class="order-id-line">Order: <code class="order-id-code">${escapeHtml(licenseKey.orderId)}</code></small>` : ""}
          <small>Assigned ${formatTimestamp(licenseKey.assignedAt)}${licenseKey.fulfilledAt ? ` | Fulfilled ${formatTimestamp(licenseKey.fulfilledAt)}` : ""}</small>
          <div class="member-item-actions">
            <button class="button button-primary button-small" type="button" data-copy-value="${escapeHtml(licenseKey.keyValue)}" data-copy-label="Key">Copy Key</button>
            <a class="button button-secondary button-small" href="${escapeHtml(licenseKey.instructionHref || "/instructions/")}">Setup Guide</a>
            <a class="button button-secondary button-small" href="${escapeHtml(actionDeskHref(licenseKey))}">Open Help</a>
            ${licenseKey.orderId ? `<button class="button button-secondary button-small" type="button" data-copy-value="${escapeHtml(licenseKey.orderId)}" data-copy-label="Order ID">Copy Order ID</button>` : ""}
          </div>
        </article>
      `
    )
    .join("");
}

function clearMemberData() {
  renderOrders([]);
  renderKeys([]);
}

async function copyText(value, label) {
  try {
    await navigator.clipboard.writeText(value);
    showStatusMessage(`${label} copied.`, "success");
  } catch {
    showStatusMessage(`Couldn't copy the ${label.toLowerCase()}.`, "error");
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
    sessionUsername.textContent = `Username: ${username}`;
  }

  if (!session) {
    clearMemberData();
  }
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

  renderOrders(payload.orders || []);
  renderKeys(payload.licenseKeys || []);
  loadDiscordStatus(session);
}

async function refreshSession() {
  const session = await getCurrentSession();
  setView(session);

  if (!session) {
    return;
  }

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
  if (nextPath && nextPath !== window.location.pathname) {
    showStatusMessage(`${message} Redirecting...`, "success");
    window.location.href = nextPath;
    return;
  }

  if (session) {
    setView(session);
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

signUpForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabase) {
    showStatusMessage(getAuthConfigMessage(), "warn");
    return;
  }

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
  }
});

signInForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabase) {
    showStatusMessage(getAuthConfigMessage(), "warn");
    return;
  }

  const formData = new FormData(signInForm);
  const email = formData.get("email");
  const password = formData.get("password");

  try {
    const session = await signInWithServerSession(email, password);
    await finishAuth("Signed in successfully.", session);
  } catch (error) {
    showStatusMessage(error instanceof Error ? error.message : "Unable to sign in.", "error");
    return;
  }
});

resetRequestForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabase) {
    showStatusMessage(getAuthConfigMessage(), "warn");
    return;
  }

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
});

passwordUpdateForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabase) {
    showStatusMessage(getAuthConfigMessage(), "warn");
    return;
  }

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
if (discordResult === "error") {
  setTimeout(() => showStatusMessage("Failed to link Discord. Please try again.", "error"), 300);
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

memberView?.addEventListener("click", async (event) => {
  const copyButton = event.target.closest("[data-copy-value]");

  if (!copyButton) {
    return;
  }

  await copyText(copyButton.dataset.copyValue || "", copyButton.dataset.copyLabel || "Value");
});

signOutButton?.addEventListener("click", async () => {
  if (!supabase) {
    return;
  }

  await supabase.auth.signOut();
  await clearServerSession();
  clearMemberData();
  setView(null);
  showStatusMessage("Signed out.", "info");
});

/* Balance top-up panel */
const topupPanel = document.querySelector("[data-topup-panel]");
if (topupPanel) {
  const balanceAmountEl = topupPanel.querySelector("[data-balance-amount]");
  const presetWrap = topupPanel.querySelector("[data-topup-presets]");
  const amountInput = topupPanel.querySelector("[data-topup-input]");
  const cardBtn = topupPanel.querySelector("[data-topup-card]");
  const cryptoBtn = topupPanel.querySelector("[data-topup-crypto]");
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
  cryptoBtn?.addEventListener("click", () => startTopup("/api/balance/create-topup-crypto", cryptoBtn));

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
 
