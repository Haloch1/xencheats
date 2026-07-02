import { getCurrentSession } from "./supabase-client.js";
import { initReveal, renderMessage } from "./site.js";

initReveal();

/* Flip homepage product badges to red "Offline" when the store is closed (/soldout).
   Stays green "Online" while the store is open (/instock). */
fetch("/api/store-status")
  .then((r) => r.json())
  .then((d) => {
    if (d && d.soldOut) {
      document.querySelectorAll(".product-grid .product-status.live").forEach((el) => {
        el.textContent = "Offline";
        el.classList.remove("live");
        el.classList.add("offline");
      });
    }
  })
  .catch(() => {});

const accountLink = document.querySelector("[data-account-link]");
const liveDeskPrimary = document.querySelector("[data-live-desk-primary]");
const liveDeskSecondary = document.querySelector("[data-live-desk-secondary]");
const liveDeskStatus = document.querySelector("[data-live-desk-status]");
const liveDeskHours = document.querySelector("[data-live-desk-hours]");
const liveDeskReply = document.querySelector("[data-live-desk-reply]");
const liveDeskForm = document.querySelector("[data-live-desk-form]");
const liveDeskMessage = document.querySelector("[data-live-desk-message]");
const liveDeskSubmitButton = liveDeskForm?.querySelector('button[type="submit"]');

const liveDeskConfig = {
  primaryLabel: "Open Live Desk",
  primaryHref: "/desk/",
  secondaryLabel: "Account",
  secondaryHref: "/account/",
  status: "Desk Online",
  hours: "24/7 Coverage",
  reply: "~6 min",
};

if (liveDeskPrimary) {
  liveDeskPrimary.textContent = liveDeskConfig.primaryLabel;
  liveDeskPrimary.href = liveDeskConfig.primaryHref;
}

if (liveDeskSecondary) {
  liveDeskSecondary.textContent = liveDeskConfig.secondaryLabel;
  liveDeskSecondary.href = liveDeskConfig.secondaryHref;
}

if (liveDeskStatus) {
  liveDeskStatus.textContent = liveDeskConfig.status;
}

if (liveDeskHours) {
  liveDeskHours.textContent = liveDeskConfig.hours;
}

if (liveDeskReply) {
  liveDeskReply.textContent = liveDeskConfig.reply;
}

if (accountLink) {
  accountLink.textContent = "Account";
}

const initialSession = await getCurrentSession();

if (!initialSession) {
  renderMessage(
    liveDeskMessage,
    "Create an account or sign in before opening a live support request.",
    "warn"
  );

  if (liveDeskSubmitButton) {
    liveDeskSubmitButton.textContent = "Sign In To Open Request";
  }
}

/* ── Discord link popup ── */
const discordPopup = document.getElementById("discordPopup");
const discordPopupClose = document.getElementById("discordPopupClose");
const discordPopupDismiss = document.getElementById("discordPopupDismiss");
const discordPopupTitle = document.getElementById("discordPopupTitle");
const discordPopupText = document.getElementById("discordPopupText");
const discordPopupAction = document.getElementById("discordPopupAction");

async function maybeShowDiscordPopup() {
  if (!discordPopup) return;
  if (localStorage.getItem("hc_discord_popup_dismissed")) return;

  if (initialSession) {
    // Signed in - check if Discord is already linked
    try {
      const res = await fetch("/api/auth/discord/status", {
        headers: { Authorization: `Bearer ${initialSession.access_token}` },
      });
      const data = await res.json();
      if (data.linked) return; // already linked, skip
    } catch {
      return;
    }
    discordPopupTitle.textContent = "Link Your Discord";
    discordPopupText.textContent =
      "Link your Discord to receive keys via DM and get verified on our server.";
    discordPopupAction.textContent = "Link Discord";
    discordPopupAction.href = "/api/auth/discord";
  } else {
    // Not signed in - offer Discord as sign-in
    discordPopupTitle.textContent = "Sign In with Discord";
    discordPopupText.textContent =
      "Sign in with your Discord account to get verified, join the server, and receive keys via DM.";
    discordPopupAction.textContent = "Continue with Discord";
    discordPopupAction.href = "/api/auth/discord";
  }

  setTimeout(() => {
    discordPopup.hidden = false;
  }, 1500);
}

discordPopupClose?.addEventListener("click", () => {
  discordPopup.hidden = true;
});
discordPopupDismiss?.addEventListener("click", () => {
  localStorage.setItem("hc_discord_popup_dismissed", "1");
  discordPopup.hidden = true;
});
discordPopup?.addEventListener("click", (e) => {
  if (e.target === discordPopup) discordPopup.hidden = true;
});

maybeShowDiscordPopup();

liveDeskForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(liveDeskForm);
  const payload = Object.fromEntries(formData.entries());
  const submitButton = liveDeskSubmitButton;
  const session = await getCurrentSession();

  if (!session?.access_token) {
    renderMessage(
      liveDeskMessage,
      "Sign in first, then come back here to open your support request.",
      "warn"
    );
    window.setTimeout(() => {
      window.location.href = "/account/";
    }, 600);
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Sending Request...";
  }

  try {
    const response = await fetch("/api/live-desk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to send the live desk request.");
    }

    renderMessage(
      liveDeskMessage,
      "Desk request sent. You will be able to read support replies in your desk inbox.",
      "success"
    );
    liveDeskForm.reset();
    window.setTimeout(() => {
      window.location.href = "/desk/";
    }, 900);
  } catch (error) {
    renderMessage(
      liveDeskMessage,
      error instanceof Error ? error.message : "Unable to send the live desk request.",
      "error"
    );
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Send To Discord Desk";
    }
  }
});
