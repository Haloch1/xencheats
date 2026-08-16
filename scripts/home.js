import { getCurrentSession } from "./supabase-client.js";
import { initReveal } from "./site.js";
import { initSocialProof } from "./social-proof.js";
import rainbowSixCategoryImage from "../assets/r6.webp";
import fortniteCategoryImage from "../assets/fortnite.webp";
import rustCategoryImage from "../assets/rust.webp";
import spooferCategoryImage from "../assets/spoofer.webp";
import apexCategoryImage from "../assets/apex.webp";
import eftCategoryImage from "../assets/tarkov.webp";
import accountsCategoryImage from "../assets/accounts.webp";
import battlefieldCategoryImage from "../assets/battlefield.webp";
import codCategoryImage from "../assets/cod.webp";
import cs2CategoryImage from "../assets/cs2.webp";
import deltaForceCategoryImage from "../assets/deltaforce.webp";
import fragpunkCategoryImage from "../assets/fragpunk.webp";
import marvelRivalsCategoryImage from "../assets/marvelrivals.webp";
import overwatchCategoryImage from "../assets/overwatch.webp";
import pubgCategoryImage from "../assets/pubg.webp";
import haloLogoImage from "../assets/hc-logo.png";

initReveal();
initSocialProof();

function initCheatMenu() {
  const menu = document.querySelector("[data-cheat-menu]");
  if (!menu) return;

  const tabs = [...menu.querySelectorAll("[data-cheat-tab]")];
  const panels = [...menu.querySelectorAll("[data-cheat-panel]")];
  const ranges = [...menu.querySelectorAll('input[type="range"]')];
  const resetButton = menu.querySelector("[data-cheat-reset]");

  const updateRange = (input) => {
    const output = input.closest(".cheat-range-input")?.querySelector("output");
    if (!output) return;
    if (!("suffix" in input.dataset)) {
      input.dataset.suffix = output.textContent.replace(input.defaultValue, "");
    }
    const progress = ((Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100;
    input.style.setProperty("--range-progress", `${progress}%`);
    output.textContent = `${input.value}${input.dataset.suffix}`;
  };

  const activateTab = (name, focus = false) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.cheatTab === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.cheatPanel !== name;
    });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.cheatTab));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(event.key)) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
      const next = tabs[(index + step + tabs.length) % tabs.length];
      activateTab(next.dataset.cheatTab, true);
    });
  });

  ranges.forEach((input) => {
    updateRange(input);
    input.addEventListener("input", () => updateRange(input));
  });

  menu.querySelectorAll("[data-cheat-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const values = {
        legit: [7.5, 45, 45],
        balanced: [4.2, 65, 88],
        max: [1.5, 105, 100]
      }[button.dataset.cheatPreset];
      const aimRanges = menu.querySelectorAll('[data-cheat-panel="aimbot"] input[type="range"]');
      aimRanges.forEach((input, rangeIndex) => {
        input.value = values[rangeIndex];
        updateRange(input);
      });
      menu.querySelectorAll("[data-cheat-preset]").forEach((preset) => preset.classList.toggle("is-active", preset === button));
    });
  });

  resetButton?.addEventListener("click", () => {
    menu.querySelectorAll("input, select").forEach((control) => {
      if (control instanceof HTMLInputElement && control.type === "checkbox") {
        control.checked = control.defaultChecked;
      } else if (control instanceof HTMLInputElement) {
        control.value = control.defaultValue;
        updateRange(control);
      } else if (control instanceof HTMLSelectElement) {
        control.selectedIndex = 0;
      }
    });
    menu.querySelectorAll("[data-cheat-preset]").forEach((preset) => preset.classList.remove("is-active"));
    activateTab("aimbot");
    resetButton.classList.add("is-confirmed");
    resetButton.textContent = "Config reset";
    window.setTimeout(() => {
      resetButton.classList.remove("is-confirmed");
      resetButton.textContent = "Reset config";
    }, 1200);
  });
}

initCheatMenu();

/* ── "Most Popular Categories" — ranked from real demand (sales + views) ── */
function escapeHtmlHome(value) {
  return String(value || "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function homeCategoryImage(category) {
  if (/rainbow six/i.test(category)) return rainbowSixCategoryImage;
  if (/accounts/i.test(category)) return accountsCategoryImage;
  if (/fortnite/i.test(category)) return fortniteCategoryImage;
  if (/rust/i.test(category)) return rustCategoryImage;
  if (/spoofer/i.test(category)) return spooferCategoryImage;
  if (/apex/i.test(category)) return apexCategoryImage;
  if (/tarkov|eft/i.test(category)) return eftCategoryImage;
  if (/battlefield/i.test(category)) return battlefieldCategoryImage;
  if (/call of duty/i.test(category)) return codCategoryImage;
  if (/counter-strike|cs2/i.test(category)) return cs2CategoryImage;
  if (/delta force/i.test(category)) return deltaForceCategoryImage;
  if (/fragpunk/i.test(category)) return fragpunkCategoryImage;
  if (/marvel rivals/i.test(category)) return marvelRivalsCategoryImage;
  if (/overwatch/i.test(category)) return overwatchCategoryImage;
  if (/pubg/i.test(category)) return pubgCategoryImage;
  return haloLogoImage;
}

async function loadPopularCategories() {
  const grid = document.querySelector("[data-popular-grid]");
  if (!grid) {
    return;
  }
  try {
    const res = await fetch("/api/popular-categories");
    if (!res.ok) {
      return;
    }
    const data = await res.json();
    const list = Array.isArray(data.categories) ? data.categories : [];
    if (!list.length) {
      return;
    }

    grid.innerHTML = list
      .map((c, i) => {
        const count = Number(c.count) || 0;
        return `
          <a class="catalog-category-card reveal" data-delay="${20 + i * 70}" href="/products/">
            <div class="category-card-art">
              <img src="${homeCategoryImage(c.category)}" alt="${escapeHtmlHome(c.category)}" loading="lazy" />
              <span class="category-card-view-overlay" aria-hidden="true"><span>View</span></span>
            </div>
            <div class="category-card-body">
              <span>
                <strong class="category-card-title">${escapeHtmlHome(c.category)}</strong>
                <small class="category-card-count">${count} product${count === 1 ? "" : "s"}</small>
              </span>
            </div>
          </a>
        `;
      })
      .join("");

    // Duplicate the cards to make the horizontal loop seamless. The copies are
    // decorative so keyboard and screen-reader users only encounter each game once.
    [...grid.children].forEach((card) => {
      const clone = card.cloneNode(true);
      clone.classList.remove("reveal");
      clone.removeAttribute("data-delay");
      clone.setAttribute("aria-hidden", "true");
      clone.setAttribute("tabindex", "-1");
      clone.querySelectorAll("a, button").forEach((control) => {
        control.setAttribute("tabindex", "-1");
      });
      grid.appendChild(clone);
    });
    grid.classList.add("popular-game-marquee");

    initReveal();
  } catch {}
}

loadPopularCategories();

/* ── Latest 3 reviews below the live desk ── */
function escReview(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
function reviewStars(count) {
  // `parseInt(count) || 5` turned a real 0-star rating into 5 stars.
  const parsed = Number.parseInt(count, 10);
  const n = Number.isFinite(parsed) ? Math.max(0, Math.min(5, parsed)) : 5;
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

/* Account nav button is rendered icon-only by initWallet(); no text set here. */

/* .catch: this is a top-level await, so a rejection here would abort the
   entire rest of this module -- the Discord popup wiring and all its event
   listeners below never get registered, silently. */
const initialSession = await getCurrentSession().catch(() => null);

/* ── Discord link popup ── */
const discordPopup = document.getElementById("discordPopup");
const discordPopupClose = document.getElementById("discordPopupClose");
const discordPopupDismiss = document.getElementById("discordPopupDismiss");
const discordPopupTitle = document.getElementById("discordPopupTitle");
const discordPopupText = document.getElementById("discordPopupText");
const discordPopupAction = document.getElementById("discordPopupAction");

async function maybeShowDiscordPopup() {
  if (!discordPopup) return;
  /* Guarded: localStorage throws in private mode / with storage blocked. */
  try {
    if (localStorage.getItem("hc_discord_popup_dismissed")) return;
  } catch {}

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
  try { localStorage.setItem("hc_discord_popup_dismissed", "1"); } catch {}
  discordPopup.hidden = true;
});
discordPopup?.addEventListener("click", (e) => {
  if (e.target === discordPopup) discordPopup.hidden = true;
});

maybeShowDiscordPopup();
