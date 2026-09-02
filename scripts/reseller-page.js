import { getCurrentSession } from "./supabase-client.js";
import { initReveal, renderMessage, currencyLabel } from "./site.js";

initReveal();

const messageBox = document.querySelector("[data-reseller-message]");
const guestView = document.querySelector("[data-reseller-guest]");
const noneView = document.querySelector("[data-reseller-none]");
const pendingView = document.querySelector("[data-reseller-pending]");
const deniedView = document.querySelector("[data-reseller-denied]");
const deniedEyebrow = document.querySelector("[data-reseller-denied-eyebrow]");
const deniedCopy = document.querySelector("[data-reseller-denied-copy]");
const approvedView = document.querySelector("[data-reseller-approved]");

const tierLabel = document.querySelector("[data-reseller-tier]");
const balanceLabel = document.querySelector("[data-reseller-balance]");
const discountLabel = document.querySelector("[data-reseller-discount]");
const keyLast4Label = document.querySelector("[data-reseller-key-last4]");
const websiteLabel = document.querySelector("[data-reseller-website]");
const discordServerLabel = document.querySelector("[data-reseller-discord-server]");
const volumeLabel = document.querySelector("[data-reseller-volume]");
const topupTotalLabel = document.querySelector("[data-reseller-topup-total]");

const progressWrap = document.querySelector("[data-reseller-progress-wrap]");
const progressFill = document.querySelector("[data-reseller-progress-fill]");
const progressLabel = document.querySelector("[data-reseller-progress-label]");

const tabButtons = document.querySelectorAll("[data-reseller-tab]");
const tabPanes = document.querySelectorAll("[data-reseller-pane]");

const topupMessage = document.querySelector("[data-reseller-topup-message]");
const topupPresetWrap = document.querySelector("[data-reseller-topup-presets]");
const topupCustomInput = document.querySelector("[data-reseller-topup-custom]");
const topupSubmitButton = document.querySelector("[data-reseller-topup-submit]");

const applyForm = document.querySelector("[data-reseller-apply-form]");
const applyMessage = document.querySelector("[data-reseller-apply-message]");

const productsGroups = document.querySelector("[data-reseller-products-groups]");
const productSearchInput = document.querySelector("[data-reseller-search]");
const categoryFilterSelect = document.querySelector("[data-reseller-category-filter]");
const buyMessage = document.querySelector("[data-reseller-buy-message]");
const keyReveal = document.querySelector("[data-reseller-key-reveal]");
const keyRevealValue = document.querySelector("[data-reseller-key-reveal-value]");
const keyCopyButton = document.querySelector("[data-reseller-key-copy]");
const keyDismissButton = document.querySelector("[data-reseller-key-dismiss]");
const catalogCountLabel = document.querySelector("[data-reseller-catalog-count]");
const readyCountLabel = document.querySelector("[data-reseller-ready-count]");
const categoryCountLabel = document.querySelector("[data-reseller-category-count]");

keyCopyButton?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(keyRevealValue?.textContent || "");
    const original = keyCopyButton.textContent;
    keyCopyButton.textContent = "Copied!";
    window.setTimeout(() => {
      keyCopyButton.textContent = original;
    }, 1500);
  } catch {
    // Clipboard API unavailable — the key is still visible to select/copy manually.
  }
});

keyDismissButton?.addEventListener("click", () => {
  if (keyReveal) {
    keyReveal.hidden = true;
  }
});

/* ── API tab: generate/rotate key ── */
const rotateButton = document.querySelector("[data-reseller-rotate-key]");
const rotateMessage = document.querySelector("[data-reseller-rotate-message]");
const rotateReveal = document.querySelector("[data-reseller-rotate-reveal]");
const rotateRevealValue = document.querySelector("[data-reseller-rotate-reveal-value]");
const rotateCopyButton = document.querySelector("[data-reseller-rotate-copy]");
const rotateDismissButton = document.querySelector("[data-reseller-rotate-dismiss]");
const rotateHint = document.querySelector("[data-reseller-rotate-hint]");

function updateKeyButtonState(hasKey) {
  if (rotateButton) {
    rotateButton.textContent = hasKey ? "Regenerate API key" : "Generate API key";
  }
  if (rotateHint) {
    rotateHint.textContent = hasKey
      ? "Regenerating immediately disables your old key. Anything using it will need the new one."
      : "You don't have a key yet — generate one to start using the API.";
  }
}

rotateCopyButton?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(rotateRevealValue?.textContent || "");
    const original = rotateCopyButton.textContent;
    rotateCopyButton.textContent = "Copied!";
    window.setTimeout(() => {
      rotateCopyButton.textContent = original;
    }, 1500);
  } catch {
    // Clipboard API unavailable — the key is still visible to select/copy manually.
  }
});

rotateDismissButton?.addEventListener("click", () => {
  if (rotateReveal) {
    rotateReveal.hidden = true;
  }
});

rotateButton?.addEventListener("click", async () => {
  const hasKey = rotateButton.textContent.startsWith("Regenerate");
  if (hasKey) {
    const confirmed = window.confirm(
      "Regenerate your API key? Your current key will stop working immediately — anything integrated against it will need the new one."
    );
    if (!confirmed) {
      return;
    }
  }

  const session = await getCurrentSession();
  if (!session?.access_token) {
    renderMessage(rotateMessage, "Sign in again to rotate your key.", "warn");
    return;
  }

  rotateButton.disabled = true;
  const originalText = rotateButton.textContent;
  rotateButton.textContent = "Regenerating...";

  try {
    const response = await fetch("/api/reseller/rotate-key", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Unable to rotate your API key.");
    }

    if (rotateReveal && rotateRevealValue) {
      rotateRevealValue.textContent = data.api_key;
      rotateReveal.hidden = false;
    }
    if (keyLast4Label) {
      keyLast4Label.textContent = `...${data.api_key_last4}`;
    }
    updateKeyButtonState(true);
    renderMessage(rotateMessage, "New API key generated.", "success");
  } catch (error) {
    renderMessage(rotateMessage, error instanceof Error ? error.message : "Unable to rotate your API key.", "error");
  } finally {
    rotateButton.disabled = false;
    rotateButton.textContent = originalText;
  }
});

let latestCatalog = [];
let latestReseller = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[character];
  });
}

function hideAll() {
  [guestView, noneView, pendingView, deniedView, approvedView].forEach((view) => {
    if (view) {
      view.hidden = true;
    }
  });
}

function centsToLabel(cents) {
  const value = Number(cents || 0) / 100;
  return currencyLabel(Number(value.toFixed(2)));
}

/* ── Tab switching ── */
tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.resellerTab;
    tabButtons.forEach((b) => b.classList.toggle("is-active", b === button));
    tabPanes.forEach((pane) => {
      const isTarget = pane.dataset.resellerPane === target;
      pane.hidden = !isTarget;
      pane.classList.toggle("is-active", isTarget);
    });
  });
});

/* ── Overview: tier progress bar ── */
function renderProgress(reseller) {
  if (!progressWrap || !progressFill || !progressLabel) {
    return;
  }
  const nextTier = reseller?.next_tier;
  if (!nextTier) {
    progressWrap.hidden = reseller?.tier !== "gold";
    if (reseller?.tier === "gold") {
      progressFill.style.width = "100%";
      progressLabel.textContent = `You're at the top tier — ${reseller.discount_percent}% off, as good as it gets.`;
    }
    return;
  }
  progressWrap.hidden = false;
  const lifetimeTopup = reseller?.lifetime_topup_cents || 0;
  const currentFloor = reseller?.current_tier_min_volume_cents || 0;
  const span = Math.max(1, nextTier.min_volume_cents - currentFloor);
  const progressed = Math.min(1, Math.max(0, (lifetimeTopup - currentFloor) / span));
  progressFill.style.width = `${Math.round(progressed * 100)}%`;
  progressLabel.textContent =
    `${centsToLabel(nextTier.cents_to_next_tier)} more in lifetime top-ups to reach ` +
    `${nextTier.tier.charAt(0).toUpperCase() + nextTier.tier.slice(1)} (${nextTier.discount_percent}% off), locked in until your next top-up tier.`;
}

/* ── Products tab: category dropdown, populated once per catalog load ── */
function populateCategoryFilter() {
  if (!categoryFilterSelect) {
    return;
  }
  const previousValue = categoryFilterSelect.value;
  const categories = [...new Set(latestCatalog.map((p) => p.category || "Other"))].sort();
  categoryFilterSelect.innerHTML =
    `<option value="">All categories</option>` +
    categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  if (categories.includes(previousValue)) {
    categoryFilterSelect.value = previousValue;
  }
}

const resellerCategoryArtwork = {
  "Rainbow Six Siege": "/assets/r6.webp",
  Fortnite: "/assets/fortnite.webp",
  Rust: "/assets/rust.webp",
  "Apex Legends": "/assets/apex.webp",
  "Escape from Tarkov": "/assets/tarkov.webp",
  "Call of Duty": "/assets/cod.webp",
  "Counter-Strike 2": "/assets/cs2.webp",
  Accounts: "/assets/accounts.webp",
  Spoofer: "/assets/spoofer.webp",
  Battlefield: "/assets/battlefield.webp",
  "Delta Force": "/assets/deltaforce.webp",
  "Marvel Rivals": "/assets/marvelrivals.webp",
  PUBG: "/assets/pubg.webp",
  Overwatch: "/assets/overwatch.webp",
  FragPunk: "/assets/fragpunk.webp",
  "ARC Raiders": "/assets/categories/arc-raiders.jpg",
  Minecraft: "/assets/categories/minecraft.jpg",
  "Rocket League": "/assets/categories/rocket-league.jpg",
  Valorant: "/assets/categories/valorant.jpg",
  "GTA V": "/assets/categories/gta-v.jpg",
};

function resellerArtwork(product) {
  if (product?.artwork) return product.artwork;
  const category = String(product?.category || "");
  const exact = resellerCategoryArtwork[category];
  if (exact) return exact;
  const match = Object.entries(resellerCategoryArtwork).find(([name]) =>
    category.toLowerCase().includes(name.toLowerCase())
  );
  return match?.[1] || "/assets/hc-logo.png";
}

function resellerStatusTone(status) {
  const value = String(status || "").toLowerCase();
  if (/(undetected|online|\bavailable\b|\bactive\b|ready)/.test(value)) return "is-ready";
  if (/(updating|offline|unavailable|coming soon)/.test(value)) return "is-unavailable";
  return "is-neutral";
}

function updateCatalogSummary() {
  const categories = new Set(latestCatalog.map((product) => product.category || "Other"));
  const readyProducts = latestCatalog.filter((product) =>
    product.variants?.some((variant) => variant.in_stock)
  );
  if (catalogCountLabel) catalogCountLabel.textContent = String(latestCatalog.length);
  if (readyCountLabel) readyCountLabel.textContent = String(readyProducts.length);
  if (categoryCountLabel) categoryCountLabel.textContent = String(categories.size);
}

/* ── Products tab: render a premium, image-led catalog grouped by category ── */
function renderProducts(filterText = "") {
  if (!productsGroups) {
    return;
  }
  updateCatalogSummary();
  const query = filterText.trim().toLowerCase();
  const categoryFilter = categoryFilterSelect?.value || "";

  const byCategory = new Map();
  latestCatalog.forEach((product) => {
    const category = product.category || "Other";
    if (categoryFilter && category !== categoryFilter) {
      return;
    }
    const matchingVariants = product.variants.filter((variant) => {
      if (!query) return true;
      return `${product.name} ${variant.name}`.toLowerCase().includes(query);
    });
    if (!matchingVariants.length) {
      return;
    }
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category).push({ ...product, variants: matchingVariants });
  });

  if (!byCategory.size) {
    productsGroups.innerHTML = `<p class="reseller-loading">${
      query || categoryFilter ? "No products match your filters." : "No products available right now."
    }</p>`;
    return;
  }

  const sections = [];
  for (const [category, categoryProducts] of [...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const productCards = categoryProducts.map((product) => {
      const availableVariants = product.variants.filter((variant) => variant.in_stock).length;
      const totalVariants = product.variants.length;
      const lowestPrice = Math.min(...product.variants.map((variant) => variant.your_amount_cents));
      const highestDiscount = Math.max(...product.variants.map((variant) => {
        if (!variant.list_amount_cents) return 0;
        return Math.round((1 - variant.your_amount_cents / variant.list_amount_cents) * 100);
      }));
      const status = product.status || "Available";
      const statusTone = resellerStatusTone(status);
      const stockTone = availableVariants ? "is-ready" : "is-unavailable";
      const stockLabel = availableVariants ? `${availableVariants}/${totalVariants} ready` : "Unavailable";
      const image = resellerArtwork(product);
      const variantRows = product.variants.map((variant) => {
        const discountPercent = variant.list_amount_cents
          ? Math.round((1 - variant.your_amount_cents / variant.list_amount_cents) * 100)
          : 0;
        return `
          <div class="reseller-variant-row ${variant.in_stock ? "is-available" : "is-unavailable"}">
            <div class="reseller-variant-name">
              <strong>${escapeHtml(variant.name)}</strong>
              <span class="reseller-variant-stock ${variant.in_stock ? "is-ready" : "is-unavailable"}"><i aria-hidden="true"></i>${variant.in_stock ? "In stock" : "Unavailable"}</span>
            </div>
            <div class="reseller-variant-prices">
              <span class="reseller-price-list">${centsToLabel(variant.list_amount_cents)}</span>
              <strong>${centsToLabel(variant.your_amount_cents)}</strong>
              ${discountPercent ? `<span class="reseller-discount-pill">-${discountPercent}%</span>` : ""}
            </div>
            <div class="reseller-variant-buy">
              <input type="number" class="reseller-qty-input" min="1" max="10" value="1" data-qty-input aria-label="Quantity for ${escapeHtml(variant.name)}" />
              <button
                type="button"
                class="button button-primary reseller-buy-button"
                data-buy-button
                data-inventory-slug="${escapeHtml(variant.inventory_slug)}"
                ${variant.in_stock ? "" : "disabled"}
              >${variant.in_stock ? "Buy" : "Unavailable"}</button>
            </div>
          </div>
        `;
      }).join("");

      return `
        <article class="reseller-product-card ${product.featured ? "is-featured" : ""}">
          <div class="reseller-product-card-art">
            <img src="${escapeHtml(image)}" alt="" loading="lazy" />
            <div class="reseller-product-card-art-shade" aria-hidden="true"></div>
            <div class="reseller-product-card-art-top">
              <span class="reseller-status-badge ${statusTone}"><i aria-hidden="true"></i>${escapeHtml(status)}</span>
              ${product.featured ? '<span class="reseller-featured-badge">Featured</span>' : ""}
            </div>
            <div class="reseller-product-card-art-bottom">
              <span>${escapeHtml(product.category || "Catalog")}</span>
              <span>${totalVariants} option${totalVariants === 1 ? "" : "s"}</span>
            </div>
          </div>
          <div class="reseller-product-card-body">
            <div class="reseller-product-card-heading">
              <div>
                <span class="reseller-product-kicker">Wholesale listing</span>
                <h4>${escapeHtml(product.name)}</h4>
              </div>
              <div class="reseller-product-from"><span>From</span><strong>${centsToLabel(lowestPrice)}</strong></div>
            </div>
            <p class="reseller-product-summary">${escapeHtml(product.summary || "Digital delivery with live availability checks.")}</p>
            <div class="reseller-product-metrics">
              <div><span>Live stock</span><strong class="${stockTone}"><i aria-hidden="true"></i>${stockLabel}</strong></div>
              <div><span>Your savings</span><strong>${highestDiscount ? `Up to ${highestDiscount}%` : "Tier pricing"}</strong></div>
            </div>
            <div class="reseller-variant-list">${variantRows}</div>
          </div>
        </article>
      `;
    }).join("");

    sections.push(`
      <div class="reseller-category-group">
        <div class="reseller-category-heading">
          <h4>${escapeHtml(category)}</h4>
          <span class="reseller-category-count">${categoryProducts.length} product${categoryProducts.length > 1 ? "s" : ""}</span>
        </div>
        ${productCards}
      </div>
    `);
  }

  productsGroups.innerHTML = sections.join("");
}

async function handleBuyClick(event) {
  const button = event.target.closest("[data-buy-button]");
  if (!button) {
    return;
  }
  const row = button.closest(".reseller-variant-row");
  const qtyInput = row?.querySelector("[data-qty-input]");
  const quantity = Math.min(Math.max(parseInt(qtyInput?.value, 10) || 1, 1), 10);
  const inventorySlug = button.dataset.inventorySlug;

  const session = await getCurrentSession();
  if (!session?.access_token) {
    renderMessage(buyMessage, "Sign in again to make a purchase.", "warn");
    return;
  }

  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Buying...";

  try {
    const response = await fetch("/api/reseller/purchase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ inventory_slug: inventorySlug, quantity }),
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Unable to complete the purchase.");
    }

    if (keyReveal && keyRevealValue) {
      keyRevealValue.textContent = (data.license_keys || [data.license_key]).filter(Boolean).join("\n");
      keyReveal.hidden = false;
    }
    renderMessage(buyMessage, `Purchased ${quantity} key${quantity > 1 ? "s" : ""} — order ${data.order_number}.`, "success");

    await loadCatalog();
  } catch (error) {
    renderMessage(buyMessage, error instanceof Error ? error.message : "Unable to complete the purchase.", "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

productsGroups?.addEventListener("click", handleBuyClick);
productSearchInput?.addEventListener("input", () => renderProducts(productSearchInput.value));
categoryFilterSelect?.addEventListener("change", () => renderProducts(productSearchInput?.value || ""));

/* ── Top up ── */
function readTopupAmountCents() {
  const cents = Math.round(parseFloat(topupCustomInput?.value) * 100);
  if (!Number.isFinite(cents) || cents < 500 || cents > 200_000) {
    return null;
  }
  return cents;
}

topupPresetWrap?.querySelectorAll(".topup-preset").forEach((button) => {
  button.addEventListener("click", () => {
    topupPresetWrap.querySelectorAll(".topup-preset").forEach((b) => b.classList.remove("is-active"));
    button.classList.add("is-active");
    if (topupCustomInput) {
      topupCustomInput.value = (Number(button.dataset.amount) / 100).toString();
    }
  });
});

topupCustomInput?.addEventListener("input", () => {
  topupPresetWrap?.querySelectorAll(".topup-preset").forEach((b) => b.classList.remove("is-active"));
});

topupSubmitButton?.addEventListener("click", async () => {
  const amountCents = readTopupAmountCents();
  if (!amountCents) {
    renderMessage(topupMessage, "Enter an amount between $5 and $2,000.", "warn");
    return;
  }
  const session = await getCurrentSession();
  if (!session?.access_token) {
    renderMessage(topupMessage, "Sign in first to add funds.", "warn");
    return;
  }
  topupSubmitButton.disabled = true;
  const original = topupSubmitButton.textContent;
  topupSubmitButton.textContent = "Redirecting...";
  try {
    const response = await fetch("/api/reseller/topup/create-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ amountCents }),
    });
    const data = await response.json();
    if (!response.ok || !data.url) {
      throw new Error(data.error || "Unable to start the top-up.");
    }
    window.location.href = data.url;
  } catch (error) {
    renderMessage(topupMessage, error instanceof Error ? error.message : "Unable to start the top-up.", "error");
    topupSubmitButton.disabled = false;
    topupSubmitButton.textContent = original;
  }
});

/* ── Load catalog + pricing ── */
async function loadCatalog() {
  const session = await getCurrentSession();
  if (!session?.access_token) {
    return;
  }
  try {
    const response = await fetch("/api/reseller/catalog", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      credentials: "same-origin",
    });
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    latestCatalog = data.products || [];
    latestReseller = data;
    populateCategoryFilter();
    renderProducts(productSearchInput?.value || "");
    renderProgress(data);
    if (balanceLabel) {
      balanceLabel.textContent = centsToLabel(data.balance_cents);
    }
    if (tierLabel) {
      tierLabel.textContent = (data.tier || "new").toUpperCase();
    }
    if (discountLabel) {
      discountLabel.textContent = `${data.discount_percent ?? 0}% off catalog`;
    }
  } catch {
    // Leave the last-known catalog rendered.
  }
}

/* ── Load reseller application/account status ── */
async function loadResellerStatus() {
  const session = await getCurrentSession();

  if (!session?.access_token) {
    hideAll();
    if (guestView) {
      guestView.hidden = false;
    }
    return;
  }

  try {
    const response = await fetch("/api/reseller/me", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      credentials: "same-origin",
    });

    if (!response.ok) {
      throw new Error("Unable to load reseller status.");
    }

    const data = await response.json();
    hideAll();

    if (data.status === "none" || !data.reseller) {
      if (noneView) {
        noneView.hidden = false;
      }
      return;
    }

    if (data.status === "pending") {
      if (pendingView) {
        pendingView.hidden = false;
      }
      return;
    }

    if (data.status === "denied" || data.status === "revoked") {
      if (data.status === "revoked") {
        if (deniedEyebrow) deniedEyebrow.textContent = "Reseller access revoked";
        if (deniedCopy) {
          deniedCopy.innerHTML = `Your reseller access was revoked by staff. You're welcome to apply again here, or run <code>/resellerapp</code> in Discord.`;
        }
      } else {
        if (deniedEyebrow) deniedEyebrow.textContent = "Application not approved";
        if (deniedCopy) {
          deniedCopy.innerHTML = `Your reseller application wasn't approved this time. You're welcome to apply again here, or run <code>/resellerapp</code> in Discord.`;
        }
      }
      if (deniedView) {
        deniedView.hidden = false;
      }
      return;
    }

    if (data.status === "approved") {
      const reseller = data.reseller;
      if (tierLabel) {
        tierLabel.textContent = (reseller.tier || "new").toUpperCase();
      }
      if (balanceLabel) {
        balanceLabel.textContent = centsToLabel(reseller.balance_cents);
      }
      if (discountLabel) {
        discountLabel.textContent = `${reseller.discount_percent ?? 0}% off catalog`;
      }
      if (keyLast4Label) {
        keyLast4Label.textContent = reseller.api_key_last4 ? `...${reseller.api_key_last4}` : "not generated yet";
      }
      updateKeyButtonState(Boolean(reseller.api_key_last4));
      if (websiteLabel) {
        websiteLabel.textContent = `Website: ${reseller.website || "—"}`;
      }
      if (discordServerLabel) {
        discordServerLabel.textContent = `Discord: ${reseller.discord_server || "—"}`;
      }
      if (volumeLabel) {
        volumeLabel.textContent = `Lifetime purchased: ${centsToLabel(reseller.lifetime_purchased_cents)}`;
      }
      if (topupTotalLabel) {
        topupTotalLabel.textContent = `Lifetime topped up: ${centsToLabel(reseller.lifetime_topup_cents)}`;
      }
      if (approvedView) {
        approvedView.hidden = false;
      }
      await loadCatalog();
      return;
    }

    if (noneView) {
      noneView.hidden = false;
    }
  } catch (error) {
    renderMessage(messageBox, error.message || "Unable to load your reseller status right now.", "error");
  }
}

/* ── Website reseller application form ── */
applyForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const session = await getCurrentSession();
  if (!session?.access_token) {
    renderMessage(applyMessage, "Sign in again to apply.", "warn");
    return;
  }

  const formData = new FormData(applyForm);
  const submitButton = applyForm.querySelector('button[type="submit"]');
  const originalText = submitButton?.textContent;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";
  }

  try {
    const response = await fetch("/api/reseller/apply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        website: formData.get("website"),
        discordServer: formData.get("discordServer"),
        volume: formData.get("volume"),
        why: formData.get("why"),
        extra: formData.get("extra"),
      }),
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Unable to submit your application.");
    }

    renderMessage(applyMessage, "Application submitted. The team will review it and DM you on Discord.", "success");
    applyForm.reset();
    window.setTimeout(loadResellerStatus, 1200);
  } catch (error) {
    renderMessage(applyMessage, error instanceof Error ? error.message : "Unable to submit your application.", "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  }
});

const topupParam = new URLSearchParams(window.location.search).get("topup");
if (topupParam === "success") {
  renderMessage(topupMessage, "Payment received. Your balance updates within a moment.", "success");
  window.setTimeout(loadCatalog, 1500);
  window.setTimeout(loadCatalog, 4500);
  window.history.replaceState({}, "", window.location.pathname);
} else if (topupParam === "cancel") {
  renderMessage(topupMessage, "Top-up canceled.", "warn");
  window.history.replaceState({}, "", window.location.pathname);
}

loadResellerStatus();
