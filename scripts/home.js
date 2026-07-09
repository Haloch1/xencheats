import { getCurrentSession } from "./supabase-client.js";
import { initReveal, renderMessage } from "./site.js";
import { initSocialProof } from "./social-proof.js";

initReveal();
initSocialProof();

/* ── "Our Most Popular Cheats" — populated from real demand (sales + views) ── */
function escapeHtmlHome(value) {
  return String(value || "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

async function loadPopularProducts() {
  const grid = document.querySelector("[data-popular-grid]");
  if (!grid) {
    return;
  }
  try {
    const res = await fetch("/api/popular-products");
    if (!res.ok) {
      return;
    }
    const data = await res.json();
    const list = data.products || [];
    if (!list.length) {
      return;
    }

    grid.innerHTML = list
      .map((product, i) => {
        const price = String(product.priceDisplay || "").replace(/^from\s*/i, "");
        let statusText = "Online";
        let statusClass = "live";
        if (product.badge === "Offline") {
          statusText = "Offline";
          statusClass = "offline";
        } else if (product.featured) {
          statusText = "Priority";
          statusClass = "pulse";
        }
        return `
          <article class="product-card popular-tilt-card reveal${product.featured ? " featured" : ""}" data-delay="${20 + i * 70}">
            <div class="product-top">
              <span class="product-status ${statusClass}">${statusText}</span>
              <span class="product-tier">${escapeHtmlHome(product.tier || "Popular")}</span>
            </div>
            <h3>${escapeHtmlHome(product.name)}</h3>
            <p>${escapeHtmlHome(product.summary)}</p>
            <strong><span class="price-from">From</span>${escapeHtmlHome(price)}</strong>
            <a href="/products/">View Product</a>
          </article>
        `;
      })
      .join("");

    initReveal();
  } catch {}
}

loadPopularProducts();

/* ── Latest 3 reviews below the live desk ── */
function escReview(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
function reviewStars(count) {
  const n = Math.max(1, Math.min(5, parseInt(count, 10) || 5));
  return "&#9733;".repeat(n) + "&#9734;".repeat(5 - n);
}
function reviewDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return "";
  }
}
async function loadHomeReviews() {
  const grid = document.querySelector("[data-home-reviews]");
  const section = document.getElementById("reviews");
  if (!grid) {
    return;
  }
  try {
    const res = await fetch("/api/reviews");
    if (!res.ok) {
      throw new Error("reviews unavailable");
    }
    const data = await res.json();
    const reviews = (data.reviews || []).slice(0, 3);
    if (!reviews.length) {
      if (section) section.style.display = "none";
      return;
    }
    grid.innerHTML = reviews
      .map((r, i) => {
        const isDiscord = r.source === "discord";
        const avatarHtml = r.avatar
          ? `<img class="review-avatar-img" src="${escReview(r.avatar)}" alt="" />`
          : `<span class="review-avatar">${escReview((r.username || "?")[0].toUpperCase())}</span>`;
        const verified = isDiscord ? "&#10003; Discord Review" : "&#10003; Verified Purchase";
        return `
          <div class="review-card reveal" data-delay="${20 + i * 60}">
            <div class="review-header">
              <div class="review-user">
                ${avatarHtml}
                <div class="review-user-info">
                  <span class="review-username">${escReview(r.username || "Anonymous")}</span>
                  <span class="review-verified">${verified}</span>
                </div>
              </div>
              <span class="review-stars">${reviewStars(r.rating)}</span>
            </div>
            <p class="review-body">${escReview(r.review_text)}</p>
            <div class="review-footer">
              <span class="review-product">${escReview(r.product_name || r.product_slug)}</span>
              <span class="review-date">${reviewDate(r.created_at)}</span>
            </div>
          </div>`;
      })
      .join("");
    initReveal();
  } catch {
    if (section) section.style.display = "none";
  }
}
loadHomeReviews();

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

/* Account nav button is rendered icon-only by initWallet(); no text set here. */

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
