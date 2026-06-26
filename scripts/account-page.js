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

const nextPath = new URLSearchParams(window.location.search).get("next");
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

function renderOrders(orders) {
  if (!ordersList) {
    return;
  }

  if (!orders.length) {
    renderListEmpty(
      ordersList,
      "No orders yet. Use the products page to start your first checkout."
    );
    return;
  }

  ordersList.innerHTML = orders
    .map(
      (order) => `
        <article class="member-item">
          <div class="member-item-top">
            <strong>${escapeHtml(order.productName)}</strong>
            <span class="member-chip member-chip-${escapeHtml(order.status)}">${escapeHtml(order.status)}</span>
          </div>
          <p>${escapeHtml(order.priceDisplay)}</p>
          <small>Opened ${formatTimestamp(order.createdAt)}</small>
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
          <small>Assigned ${formatTimestamp(licenseKey.assignedAt)}${licenseKey.fulfilledAt ? ` · Fulfilled ${formatTimestamp(licenseKey.fulfilledAt)}` : ""}</small>
        </article>
      `
    )
    .join("");
}

function clearMemberData() {
  renderOrders([]);
  renderKeys([]);
}

function setView(session) {
  const showGuestView = !session || isPasswordRecovery;
  const showMemberView = Boolean(session) && !isPasswordRecovery;

  guestView.hidden = !showGuestView;
  memberView.hidden = !showMemberView;

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
    const session = await signUpWithServerSession(email, username, password);
    signUpForm.reset();

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
    showStatusMessage(
      error instanceof Error ? error.message : "Unable to create account.",
      "error"
    );
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
 
