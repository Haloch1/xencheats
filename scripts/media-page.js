import { initReveal } from "./site.js";

initReveal();
const guest = document.querySelector("[data-media-guest]");
const app = document.querySelector("[data-media-app]");
const message = document.querySelector("[data-media-message]");
const searchInput = document.querySelector("[data-media-search]");
const gameChips = document.querySelector("[data-media-game-chips]");
const productList = document.querySelector("[data-media-product-list]");
const selectedMeta = document.querySelector("[data-media-selected]");
const submitButton = document.querySelector("[data-media-submit]");
const latestKeyBox = document.querySelector("[data-media-credits]");
const campaignsBox = document.querySelector("[data-media-campaigns]");
const weeklyLimit = 4;
let mediaProducts = [];
let inventoryLookup = new Map();
let activeGame = "";
let searchQuery = "";
let selectedItem = null;

function showMessage(text, kind = "info") { if (!message) return; message.hidden = !text; message.className = `inline-message ${kind}`; message.textContent = text; }
const query = new URLSearchParams(window.location.search);
const handoffToken = query.get("handoff") || "";
if (query.get("discord") === "linked") {
  showMessage("Discord linked. Checking your Media role…", "success");
  window.history.replaceState({}, "", "/media/");
} else if (query.get("discord") === "auth_configuration") {
  showMessage("Discord sign-in could not finish because the website session service is not configured. Please contact the owner.", "error");
  window.history.replaceState({}, "", "/media/");
}
function renderGuestState({ discordLinked = false } = {}) {
  if (!guest) return;
  guest.hidden = false;
  const heading = guest.querySelector("h2");
  const copy = guest.querySelector("p:not(.eyebrow)");
  const link = guest.querySelector("a");
  if (discordLinked) {
    if (heading) heading.textContent = "Media access is not active.";
    if (copy) copy.textContent = "Your Discord account needs the Media role. Access is enabled automatically when that role is present; refresh after the role is added.";
    if (link) link.hidden = true;
    return;
  }
  if (heading) heading.textContent = "Continue with Discord to claim keys.";
  if (copy) copy.textContent = "Your Discord identity is used to verify media access. After authorization, you will return directly to this media panel.";
  if (link) link.hidden = false;
}
function mediaAccessMessage(reason) {
  const messages = {
    discord_not_linked: "Continue with Discord first so we can verify your identity.",
    discord_bot_offline: "Discord verification is temporarily offline. Please try again in a moment.",
    guild_unavailable: "The bot cannot reach the Discord server right now. Please try again shortly.",
    discord_member_not_found: "This Discord account is not currently in the server. Join the server, then try again.",
    media_role_required: "Your Discord account is linked, but it does not currently have the Media role. Ask the owner to add the role, then refresh this page.",
    media_approval_pending: "Your Media role was detected. Access is being activated automatically; refresh this page in a moment.",
    staff_accounts_are_not_eligible: "Staff accounts cannot claim media keys. Use an approved media account instead.",
    media_member_not_enrolled: "Your media access has not been created yet. Refresh once, then contact the owner if it remains unavailable.",
    media_member_initialization_failed: "Your media access could not be created. Please try again shortly or contact the owner.",
    media_member_inactive: "Your media access is currently inactive. Contact the owner if this is unexpected.",
  };
  return messages[reason] || "Your Discord account is linked, but media access is not ready yet. Please contact the owner.";
}
function esc(value) { const div = document.createElement("div"); div.textContent = value == null ? "" : String(value); return div.innerHTML; }
function formatDate(value) { return value ? new Date(value).toLocaleString() : "-"; }
function withinRollingWeek(value) { const timestamp = Date.parse(value || ""); return Number.isFinite(timestamp) && Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000; }

function renderGameChips() {
  if (!gameChips) return;
  const categories = [...new Set(mediaProducts.map((item) => item.category))].sort((a, b) => a.localeCompare(b));
  const allChip = `<button type="button" class="media-game-chip${activeGame ? "" : " is-active"}" data-game="">All games (${mediaProducts.length})</button>`;
  const chips = categories.map((category) => {
    const count = mediaProducts.filter((item) => item.category === category).length;
    return `<button type="button" class="media-game-chip${activeGame === category ? " is-active" : ""}" data-game="${esc(category)}">${esc(category)} (${count})</button>`;
  }).join("");
  gameChips.innerHTML = allChip + chips;
}

function filteredProducts() {
  const q = searchQuery.trim().toLowerCase();
  return mediaProducts
    .filter((item) => !activeGame || item.category === activeGame)
    .filter((item) => !q || item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

function renderProductList() {
  if (!productList) return;
  const items = filteredProducts();
  if (!items.length) {
    productList.innerHTML = `<p class="media-product-empty">No products match your search.</p>`;
    return;
  }
  productList.innerHTML = items.map((item) => {
    const isSelected = selectedItem && selectedItem.slug === item.slug;
    return `<button type="button" role="option" aria-selected="${isSelected ? "true" : "false"}" class="media-product-card${isSelected ? " is-selected" : ""}" data-slug="${esc(item.slug)}"><span class="media-product-card-main"><span class="media-game-tag">${esc(item.category)}</span><strong>${esc(item.name)}</strong></span><span class="media-price-pill">${esc(item.priceDisplay)} · 1 Day</span></button>`;
  }).join("");
}

function updateSelectedMeta() {
  if (!selectedMeta) return;
  if (!selectedItem) { selectedMeta.classList.remove("is-visible"); selectedMeta.innerHTML = ""; }
  else {
    selectedMeta.classList.add("is-visible");
    selectedMeta.innerHTML = `<span class="media-game-tag">${esc(selectedItem.category)}</span><span>${esc(selectedItem.name)}</span><span class="media-price-pill">${esc(selectedItem.priceDisplay)} · 1 Day</span>`;
  }
  if (submitButton) submitButton.disabled = !selectedItem;
}

function selectProduct(slug) {
  selectedItem = mediaProducts.find((item) => item.slug === slug) || null;
  renderProductList();
  updateSelectedMeta();
}

function renderIdleLatestKey() {
  if (!latestKeyBox) return;
  latestKeyBox.innerHTML = `<p class="muted">No key claimed yet this session. Claim one from the left to see it here.</p>`;
}
function renderDeliveredKey({ product, variant, key }) {
  if (!latestKeyBox) return;
  latestKeyBox.innerHTML = `<article class="media-list-item"><div><strong>${esc(product)}</strong><span>${esc(variant)}</span><code data-media-key-value>${esc(key)}</code></div><button class="button button-primary" type="button" data-media-copy-key>Copy</button></article>`;
}
function renderCampaigns(campaigns) {
  if (!campaigns.length) { campaignsBox.innerHTML = `<p class="muted">No claims yet.</p>`; return; }
  campaignsBox.innerHTML = campaigns.map((campaign) => {
    const known = inventoryLookup.get(campaign.product_slug);
    const tag = known ? `<span class="media-game-tag">${esc(known.category)}</span>` : "";
    return `<article class="media-list-item"><div>${tag}<strong>${esc(known?.name || campaign.product_slug)}</strong><span>${esc(campaign.variant_label)}</span><small>${esc(campaign.status)} | ${esc(formatDate(campaign.created_at))}</small></div><span class="status-pill">${esc(campaign.status)}</span></article>`;
  }).join("");
}
async function load() {
  try {
    if (handoffToken) {
      await fetch(`/api/auth/media-handoff?token=${encodeURIComponent(handoffToken)}`, {
        credentials: "include",
        cache: "no-store",
      }).catch(() => null);
    }
    let sessionResponse = await fetch("/api/auth/session", { cache: "no-store", credentials: "include" }).then((r) => r.json());
    if (!sessionResponse?.session?.user && query.get("discord") === "linked") {
      for (const delay of [250, 750, 1500]) {
        await new Promise((resolve) => window.setTimeout(resolve, delay));
        sessionResponse = await fetch("/api/auth/session", { cache: "no-store", credentials: "include" }).then((r) => r.json());
        if (sessionResponse?.session?.user) break;
      }
    }
    if (!sessionResponse?.session?.user) {
      renderGuestState({ discordLinked: query.get("discord") === "linked" });
      if (query.get("discord") === "linked") {
        showMessage("Discord was linked, but the website session did not arrive. Please try the Discord button once more or contact the owner.", "error");
      }
      return;
    }
    const discordLinked = Boolean(sessionResponse.session.user?.app_metadata?.discord_id);
    const mediaResponse = await fetch("/api/media/me", { cache: "no-store", credentials: "include" });
    if (mediaResponse.status === 403) { renderGuestState({ discordLinked }); showMessage(discordLinked ? "Your Discord account is linked, but media access is not enabled for it yet." : "Continue with Discord to verify media access, then ask staff to enroll you in the media program.", "warn"); return; }
    const media = await mediaResponse.json();
    if (!mediaResponse.ok) throw new Error(media.error || "Unable to load media access.");
    if (!media.eligible) {
      renderGuestState({ discordLinked });
      showMessage(discordLinked ? mediaAccessMessage(media.accessReason) : "Continue with Discord to verify media access, then ask the owner to add the Media role.", "warn");
      return;
    }
    mediaProducts = media.products || [];
    inventoryLookup = new Map(mediaProducts.map((item) => [item.inventorySlug, item]));
    app.hidden = false;
    const campaigns = media.campaigns || [];
    const usedThisWeek = campaigns.filter((campaign) => campaign.status === "claimed" && withinRollingWeek(campaign.claimed_at || campaign.created_at)).length;
    document.querySelector("[data-media-member-name]").textContent = media.member.username || "Media member";
    document.querySelector("[data-media-member-meta]").textContent = media.member.owner_access
      ? "Owner access · claim keys directly from this private panel."
      : "Media access verified through your Discord role · keys are delivered the instant you claim them.";
    document.querySelector("[data-media-access-label]").textContent = media.member.owner_access ? "Owner access active" : "Media access active";
    document.querySelector("[data-media-used]").textContent = Math.min(usedThisWeek, weeklyLimit);
    document.querySelector("[data-media-ready]").textContent = Math.max(0, weeklyLimit - usedThisWeek);
    document.querySelector("[data-media-catalog-count]").textContent = mediaProducts.length;
    if (activeGame && !mediaProducts.some((item) => item.category === activeGame)) activeGame = "";
    if (selectedItem && !mediaProducts.some((item) => item.slug === selectedItem.slug)) selectedItem = null;
    renderGameChips();
    renderProductList();
    updateSelectedMeta();
    renderCampaigns(campaigns);
  } catch (error) { showMessage(error.message, "error"); }
}
searchInput?.addEventListener("input", (event) => { searchQuery = event.target.value || ""; renderProductList(); });
gameChips?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-game]");
  if (!button) return;
  activeGame = button.dataset.game || "";
  renderGameChips();
  renderProductList();
});
productList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-slug]");
  if (!button) return;
  selectProduct(button.dataset.slug);
});
document.querySelector("[data-media-campaign-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const body = { productSlug: selectedItem?.slug, variantSlug: selectedItem?.variantSlug };
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    if (!body.productSlug || !body.variantSlug) throw new Error("Choose a product first.");
    const response = await fetch("/api/media/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to claim that key.");
    if (data.status === "fulfilled") {
      renderDeliveredKey(data);
      showMessage("Key delivered — it's shown below and was also sent to you by Discord DM as a backup.", "success");
      form.reset();
      searchQuery = "";
      selectedItem = null;
      renderProductList();
      updateSelectedMeta();
    } else {
      showMessage(data.message || "Your key was accepted and delivery is still finishing.", "warn");
    }
    await load();
  } catch (error) { showMessage(error.message, "error"); button.disabled = !selectedItem; }
});
latestKeyBox?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-media-copy-key]");
  if (!button) return;
  const codeEl = latestKeyBox.querySelector("[data-media-key-value]");
  const value = codeEl?.textContent || "";
  try {
    await navigator.clipboard.writeText(value);
    button.textContent = "Copied";
    window.setTimeout(() => { button.textContent = "Copy"; }, 1500);
  } catch {
    button.textContent = "Couldn't copy";
    window.setTimeout(() => { button.textContent = "Copy"; }, 1500);
  }
});
renderIdleLatestKey();
load();
