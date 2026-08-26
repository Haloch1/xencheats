import { initReveal } from "./site.js";

const checks = document.getElementById("statusChecks");
const updated = document.getElementById("statusUpdated");
const productGrid = document.getElementById("productStatusGrid");

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
}

async function loadStatus() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error("Status unavailable");
    const payload = await response.json();
    updated.textContent = `Last checked ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(payload.updatedAt))}`;
    checks.innerHTML = payload.checks.map((check) => `<article><p class="eyebrow" style="color:${check.status === "operational" ? "var(--green)" : "var(--amber)"}">${escapeHtml(check.status)}</p><h3>${escapeHtml(check.name)}</h3><p>${escapeHtml(check.detail)}</p></article>`).join("");
  } catch {
    updated.textContent = "Status check unavailable. Please try again shortly.";
  }
}

function badgeTone(badge) {
  const value = String(badge || "").toLowerCase();
  if (value.includes("undetected")) return "tone-green";
  if (value.includes("updating")) return "tone-amber";
  if (value.includes("discontinued")) return "tone-muted";
  if (value.includes("coming soon")) return "tone-muted";
  if (value.includes("testing") || value.includes("own risk")) return "tone-amber";
  return "tone-blue";
}

async function loadProductStatus() {
  if (!productGrid) return;
  try {
    const response = await fetch("/api/products", { cache: "no-store" });
    if (!response.ok) throw new Error("Products unavailable");
    const payload = await response.json();
    const products = Array.isArray(payload) ? payload : payload.products || [];

    const groups = new Map();
    for (const product of products) {
      if (!product?.slug) continue;
      const game = product.game || product.category || "Other";
      if (!groups.has(game)) groups.set(game, []);
      groups.get(game).push({ name: product.name, badge: product.badge || "Undetected" });
    }

    if (!groups.size) {
      productGrid.innerHTML = `<p class="member-empty">No live product checks yet.</p>`;
      return;
    }

    productGrid.innerHTML = [...groups.entries()]
      .map(
        ([game, items]) => `
          <div class="status-product-group">
            <h4>${escapeHtml(game)}</h4>
            <div class="status-product-list">
              ${items
                .map(
                  (item) => `
                    <div class="status-product-row">
                      <span>${escapeHtml(item.name)}</span>
                      <span class="status-pill ${badgeTone(item.badge)}">${escapeHtml(item.badge)}</span>
                    </div>`
                )
                .join("")}
            </div>
          </div>`
      )
      .join("");
  } catch {
    productGrid.innerHTML = `<p class="member-empty">Product status is unavailable right now. Try again shortly.</p>`;
  }
}

initReveal();
loadStatus();
loadProductStatus();
setInterval(loadStatus, 60_000);
setInterval(loadProductStatus, 60_000);
