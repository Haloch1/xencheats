import { initReveal } from "./site.js";

initReveal();
const guest = document.querySelector("[data-media-guest]");
const app = document.querySelector("[data-media-app]");
const message = document.querySelector("[data-media-message]");
const productSelect = document.querySelector("[data-media-product]");
const variantSelect = document.querySelector("[data-media-variant]");
const creditsBox = document.querySelector("[data-media-credits]");
const campaignsBox = document.querySelector("[data-media-campaigns]");
let products = [];
const MEDIA_PRODUCTS = new Set(["r6s-crusader", "r6s-ancient", "r6s-chams"]);

function showMessage(text, kind = "info") { if (!message) return; message.hidden = !text; message.className = `inline-message ${kind}`; message.textContent = text; }
const query = new URLSearchParams(window.location.search);
if (query.get("discord") === "linked") {
  showMessage("Discord linked. Checking your Media role and private panel access…", "success");
  window.history.replaceState({}, "", "/media/");
}
function renderGuestState({ discordLinked = false } = {}) {
  if (!guest) return;
  guest.hidden = false;
  const heading = guest.querySelector("h2");
  const copy = guest.querySelector("p:not(.eyebrow)");
  const link = guest.querySelector("a");
  if (discordLinked) {
    if (heading) heading.textContent = "Media access is not enabled yet.";
    if (copy) copy.textContent = "Your Discord account is already linked. Ask the owner to add the Media role and enroll your account, then refresh this page to open the private media panel.";
    if (link) link.hidden = true;
    return;
  }
  if (heading) heading.textContent = "Continue with Discord to request keys.";
  if (copy) copy.textContent = "Your Discord identity is used to verify media access. After authorization, you will return directly to this media panel.";
  if (link) link.hidden = false;
}
function esc(value) { const div = document.createElement("div"); div.textContent = value == null ? "" : String(value); return div.innerHTML; }
function formatDate(value) { return value ? new Date(value).toLocaleString() : "-"; }
function withinRollingWeek(value) { const timestamp = Date.parse(value || ""); return Number.isFinite(timestamp) && Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000; }
function productFor(slug) { return products.find((item) => item.slug === slug); }
function populateVariants() {
  const product = productFor(productSelect.value);
  variantSelect.innerHTML = `<option value="">Choose a variant</option>`;
  variantSelect.disabled = !product;
  (product?.variants || []).filter((variant) => /^1\s*day(?:\s+key)?$/i.test(String(variant.name || "").trim())).forEach((variant) => { const option = document.createElement("option"); option.value = variant.name; option.textContent = `${variant.name} - ${variant.stockLabel || "Availability checked at claim"}`; variantSelect.append(option); });
}
function renderCredits(credits) {
  if (!credits.length) { creditsBox.innerHTML = `<p class="muted">No approved credits are waiting. Submit a request when you are ready to publish.</p>`; return; }
  creditsBox.innerHTML = credits.map((credit) => `<article class="media-list-item"><div><strong>${esc(credit.variant_label)}</strong><span>${esc(credit.product_slug)}</span><small>Expires ${esc(formatDate(credit.expires_at))}</small></div><button class="button button-primary" data-claim-credit="${esc(credit.id)}">Claim key</button></article>`).join("");
}
function renderCampaigns(campaigns) {
  if (!campaigns.length) { campaignsBox.innerHTML = `<p class="muted">No submissions yet.</p>`; return; }
  campaignsBox.innerHTML = campaigns.map((campaign) => `<article class="media-list-item"><div><strong>${esc(campaign.variant_label)}</strong><span>Discord role allowance</span><small>${esc(campaign.status)} | ${esc(formatDate(campaign.created_at))}</small></div><span class="status-pill">${esc(campaign.status)}</span></article>`).join("");
}
async function load() {
  try {
    const session = await fetch("/api/auth/session", { cache: "no-store" }).then((r) => r.json());
    if (!session?.user) {
      renderGuestState();
      return;
    }
    const discordLinked = Boolean(session.user?.app_metadata?.discord_id);
    const [mediaResponse, productsResponse] = await Promise.all([fetch("/api/media/me", { cache: "no-store" }), fetch("/api/products", { cache: "no-store" })]);
    if (mediaResponse.status === 403) { renderGuestState({ discordLinked }); showMessage(discordLinked ? "Your Discord account is linked, but media access is not enabled for it yet." : "Continue with Discord to verify media access, then ask staff to enroll you in the media program.", "warn"); return; }
    const media = await mediaResponse.json();
    if (!mediaResponse.ok) throw new Error(media.error || "Unable to load media access.");
    if (!media.eligible) {
      renderGuestState({ discordLinked });
      showMessage(discordLinked
        ? "Discord is linked, but this account does not have the Media role yet. Ask the owner to add the role, then refresh this page."
        : "Continue with Discord to verify media access, then ask the owner to add the Media role.", "warn");
      return;
    }
    products = ((await productsResponse.json()).products || []).filter((item) => MEDIA_PRODUCTS.has(item.slug));
    app.hidden = false;
    const campaigns = media.campaigns || [];
    const credits = media.credits || [];
    const usedThisWeek = campaigns.filter((campaign) => withinRollingWeek(campaign.created_at)).length;
    document.querySelector("[data-media-member-name]").textContent = media.member.username || "Media member";
    document.querySelector("[data-media-member-meta]").textContent = media.member.owner_access
      ? "Owner access · request keys directly from this private panel."
      : "Media access verified through your Discord role · request only when ready to use a key.";
    document.querySelector("[data-media-access-label]").textContent = media.member.owner_access ? "Owner access active" : "Media access active";
    document.querySelector("[data-media-used]").textContent = Math.min(usedThisWeek, 4);
    document.querySelector("[data-media-ready]").textContent = credits.length;
    products.filter((item) => item.available !== false).forEach((product) => { const option = document.createElement("option"); option.value = product.slug; option.textContent = product.name; productSelect.append(option); });
    renderCredits(credits); renderCampaigns(campaigns);
  } catch (error) { showMessage(error.message, "error"); }
}
productSelect?.addEventListener("change", populateVariants);
document.querySelector("[data-media-campaign-form]")?.addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget; const body = { productSlug: productSelect.value, variantLabel: variantSelect.value, note: document.querySelector("[data-media-note]")?.value }; const button = form.querySelector("button"); button.disabled = true; try { const response = await fetch("/api/media/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to request a media key."); showMessage("Your one-day media credit is ready to claim.", "success"); form.reset(); variantSelect.innerHTML = `<option value="">Choose a product first</option>`; variantSelect.disabled = true; await load(); } catch (error) { showMessage(error.message, "error"); } finally { button.disabled = false; } });
creditsBox?.addEventListener("click", async (event) => { const button = event.target.closest("[data-claim-credit]"); if (!button) return; button.disabled = true; try { const response = await fetch(`/api/media/credits/${button.dataset.claimCredit}/claim`, { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to claim credit."); button.closest("article").innerHTML = `<div><strong>Key delivered</strong><span>${esc(data.product)} | ${esc(data.variant)}</span><code>${esc(data.key || data.message || "Pending supplier delivery")}</code></div>`; showMessage(data.status === "pending" ? "Credit claimed; supplier delivery is pending." : "Key delivered successfully.", "success"); } catch (error) { showMessage(error.message, "error"); button.disabled = false; } });
load();
