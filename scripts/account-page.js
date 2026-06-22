import {
  authConfigured,
  getAuthConfigMessage,
  getCurrentSession,
  supabase,
} from "./supabase-client.js";
import { initReveal, renderMessage } from "./site.js";

initReveal();

const statusBox = document.querySelector("[data-account-message]");
const guestView = document.querySelector("[data-guest-view]");
const memberView = document.querySelector("[data-member-view]");
const sessionEmail = document.querySelector("[data-session-email]");
const signUpForm = document.querySelector("[data-signup-form]");
const signInForm = document.querySelector("[data-signin-form]");
const signOutButton = document.querySelector("[data-signout]");
const ordersList = document.querySelector("[data-orders-list]");
const keysList = document.querySelector("[data-keys-list]");
const authSwitchButtons = document.querySelectorAll("[data-auth-tab]");
const authPanes = document.querySelectorAll("[data-auth-pane]");

const nextPath = new URLSearchParams(window.location.search).get("next") || "/products/";

function showStatusMessage(message, tone = "info") {
  if (!statusBox) {
    return;
  }

  statusBox.hidden = false;
  renderMessage(statusBox, message, tone);
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
            <strong>${order.productName}</strong>
            <span class="member-chip member-chip-${order.status}">${order.status}</span>
          </div>
          <p>${order.priceDisplay}</p>
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
            <strong>${licenseKey.productName}</strong>
            <span class="member-chip member-chip-${licenseKey.status}">${licenseKey.status}</span>
          </div>
          <code>${licenseKey.keyValue}</code>
          <small>Assigned ${formatTimestamp(licenseKey.assignedAt)}</small>
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
  guestView.hidden = Boolean(session);
  memberView.hidden = !session;

  if (sessionEmail) {
    sessionEmail.textContent = session?.user?.email || "";
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

await refreshSession();

if (supabase) {
  supabase.auth.onAuthStateChange(async () => {
    await refreshSession();
  });
}

authSwitchButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setAuthTab(button.dataset.authTab);
  });
});

signUpForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabase) {
    showStatusMessage(getAuthConfigMessage(), "warn");
    return;
  }

  const formData = new FormData(signUpForm);
  const email = formData.get("email");
  const password = formData.get("password");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/account/`,
    },
  });

  if (error) {
    showStatusMessage(error.message, "error");
    return;
  }

  signUpForm.reset();

  if (data.session) {
    showStatusMessage("Account created. Redirecting...", "success");
    window.location.href = nextPath;
    return;
  }

  showStatusMessage("Account created. You can sign in now.", "success");
  setAuthTab("signin");
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

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    showStatusMessage(error.message, "error");
    return;
  }

  showStatusMessage("Signed in successfully. Redirecting...", "success");
  window.location.href = nextPath;
});

signOutButton?.addEventListener("click", async () => {
  if (!supabase) {
    return;
  }

  await supabase.auth.signOut();
  clearMemberData();
  showStatusMessage("Signed out.", "info");
});
