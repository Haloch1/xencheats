import { getCurrentSession, authConfigured } from "./supabase-client.js";
import { initReveal, renderMessage } from "./site.js";
import haloLogoImage from "../assets/hc-logo.png";
import rainbowSixCategoryImage from "../assets/r6.webp";
import fortniteCategoryImage from "../assets/fortnite.webp";
import rustCategoryImage from "../assets/rust.webp";
import spooferCategoryImage from "../assets/spoofer.webp";
// R6 product images
import productCrusaderImage from "../assets/product-crusader-r6.webp";
import productVegaImage from "../assets/product-vega-r6-external.webp";
import productFrostImage from "../assets/product-r6-frost.webp";
import productRecoilImage from "../assets/product-r6-recoil-private.webp";
import productInvisionImage from "../assets/product-invision-chams.webp";
import productFrostLiteImage from "../assets/product-r6-frost-lite.webp";
import productUnlockAllImage from "../assets/product-r6-unlock-all.webp";
// Fortnite product images
import productFortniteFullImage from "../assets/product-fortnite-full.webp";
import productDisconnectFortniteImage from "../assets/product-disconnect-fortnite-external.webp";
import productFortniteIgniteImage from "../assets/product-fortnite-ignite-aimbot.webp";
// Rust product images
import productRustIgniteImage from "../assets/product-rust-ignite.webp";
import productRustKrushImage from "../assets/product-rust-krush.webp";
import productRustMekImage from "../assets/product-rust-mek.webp";
// Apex product images
import productIgniteApexImage from "../assets/product-ignite-apex.webp";
import productAncientApexImage from "../assets/product-ancient-apex.webp";
// EFT product images
import productCoffeeChamsImage from "../assets/product-eft-coffee-chams.webp";
import productCoffeeLiteImage from "../assets/product-eft-coffee-lite.webp";
import productAncientEftImage from "../assets/product-ancient-eft.webp";
// Spoofer product images
import productXimSpooferImage from "../assets/product-xim-spoofer.webp";
import productSpooferVerseImage from "../assets/product-spoofer-verse-perm.webp";
// Accounts product images
import productLinkedNfaImage from "../assets/product-linked-nfa.webp";
import productStackedPcImage from "../assets/product-stacked-pc-account.webp";
// Category images
import apexCategoryImage from "../assets/apex.webp";
import eftCategoryImage from "../assets/tarkov.webp";
import accountsCategoryImage from "../assets/accounts.webp";

initReveal();

const grid = document.querySelector("[data-products-grid]");
let notice = document.querySelector("[data-products-message]");
const accountLink = document.querySelector("[data-account-link]");
const categoryStrip = document.querySelector("[data-category-strip]");
const productSearch = document.querySelector("[data-product-search]");
const productSort = document.querySelector("[data-product-sort]");
const productAvailability = document.querySelector("[data-product-availability]");
const productStockOnly = document.querySelector("[data-product-stock-only]");
const productSaleOnly = document.querySelector("[data-product-sale-only]");
const gamesStat = document.querySelector("[data-catalog-games]");
const productsStat = document.querySelector("[data-catalog-products]");
const visibleStat = document.querySelector("[data-catalog-visible]");
const resultsLabel = document.querySelector("[data-catalog-results-label]");
const dedicatedProductMatch = window.location.pathname.match(
  /^\/products\/([a-z0-9][a-z0-9-]*)\/?$/i
);
const dedicatedProductSlug = dedicatedProductMatch
  ? decodeURIComponent(dedicatedProductMatch[1]).toLowerCase()
  : "";
let dedicatedProductHost = null;
let catalogProducts = [];
let activeProduct = null;
let activeVariant = null;
let activePromo = null;
let activeCategory = "all";
let searchQuery = "";
let sortMode = "recommended";
let availabilityMode = "all";
let stockOnly = false;
let saleOnly = false;
let aiSearchResults = null; // null = use normal filter, array = AI-ranked slugs
let aiSearchTimer = null;
let aiSearchController = null;
const excludedCatalogTerms = [];
/* Promo codes live only on the server (Render env var PROMO_CODES) so they
   are never committed to the public repo. The client only knows whether
   promos are enabled; individual codes are validated via POST /api/promo/validate. */
let promoEnabled = false;
const productArtwork = {
  // R6
  "crusader-r6": productCrusaderImage,
  "vega-r6-external": productVegaImage,
  "r6-frost": productFrostImage,
  "r6-recoil-private": productRecoilImage,
  "invision-chams": productInvisionImage,
  "r6-frost-lite": productFrostLiteImage,
  "r6-unlock-all": productUnlockAllImage,
  // Fortnite
  "fortnite-full": productFortniteFullImage,
  "disconnect-fortnite-external": productDisconnectFortniteImage,
  "fortnite-ignite-aimbot": productFortniteIgniteImage,
  // Rust
  "rust-ignite": productRustIgniteImage,
  "rust-krush": productRustKrushImage,
  "rust-mek": productRustMekImage,
  // Apex
  "ignite-apex": productIgniteApexImage,
  "ancient-apex": productAncientApexImage,
  // EFT
  "eft-coffee-chams": productCoffeeChamsImage,
  "eft-coffee-lite": productCoffeeLiteImage,
  "ancient-eft": productAncientEftImage,
  // Spoofer
  "xim-spoofer": productXimSpooferImage,
  "spoofer-verse-perm": productSpooferVerseImage,
  // Accounts
  "linked-nfa": productLinkedNfaImage,
  "stacked-pc-account": productStackedPcImage,
};

/* Account nav button is rendered icon-only by initWallet(); no text set here. */

if (!authConfigured) {
  renderMessage(
    notice,
    "Account login is still being configured, so checkout is not available yet.",
    "warn"
  );
}

async function loadProducts() {
  const response = await fetch("/api/products");

  if (!response.ok) {
    throw new Error("Unable to load products.");
  }

  const data = await response.json();
  promoEnabled = data.promoEnabled === true;
  return data.products;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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

function groupProducts(products) {
  return products.reduce((groups, product) => {
    const category = product.category || product.game || "Catalog";

    if (!groups.has(category)) {
      groups.set(category, []);
    }

    groups.get(category).push(product);
    return groups;
  }, new Map());
}

function isAllowedProduct(product) {
  const searchable = [
    product.name,
    product.vendor,
    product.game,
    product.category,
    product.slug,
  ]
    .join(" ")
    .toLowerCase();

  return !excludedCatalogTerms.some((term) => searchable.includes(term));
}

function getStartingPrice(product) {
  const match = product.priceDisplay.match(/\$([0-9]+(?:\.[0-9]{2})?)/);
  return match ? Number(match[1]) : Infinity;
}

function getTotalStock(product) {
  return (product.variants || []).reduce((total, variant) => {
    const match = variant.stockLabel.match(/^(\d+)/);
    return total + (match ? Number(match[1]) : 0);
  }, 0);
}

function stockBadgeHtml(product) {
  const count = getTotalStock(product);
  /* If any variant says "In Stock" (reseller-backed), show as available */
  const resellerBacked = (product.variants || []).some(v => v.stockLabel === "In Stock");
  if (count > 0) {
    return `<span class="card-stock in-stock">${count} ${count === 1 ? "Key" : "Keys"} Available</span>`;
  }
  if (resellerBacked) {
    return `<span class="card-stock in-stock">In Stock</span>`;
  }
  return `<span class="card-stock out-of-stock">Out of Stock</span>`;
}

function hasResellerStock(product) {
  return (product.variants || []).some((variant) => variant.stockLabel === "In Stock");
}

function isStockedProduct(product) {
  return getTotalStock(product) > 0 || hasResellerStock(product);
}

function isReadyProduct(product) {
  return (product.variants || []).some((variant) => variant.checkoutReady);
}

function isComingSoonProduct(product) {
  return !product.available || /coming soon/i.test(String(product.badge || ""));
}

function renderCategoryStrip(groups) {
  if (!categoryStrip) {
    return;
  }

  const categories = ["all", ...groups.keys()];
  const links = categories.map((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.categoryFilter = category;
    button.className = category === activeCategory ? "is-active" : "";
    button.textContent = category === "all" ? "All" : category;
    return button;
  });

  categoryStrip.replaceChildren(...links);
}

function categoryImageLabel(category) {
  if (/rainbow six/i.test(category)) {
    return "R6";
  }

  return category
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function categoryImageSrc(category) {
  if (/rainbow six/i.test(category)) {
    return rainbowSixCategoryImage;
  }

  if (/accounts/i.test(category)) {
    return accountsCategoryImage;
  }

  if (/fortnite/i.test(category)) {
    return fortniteCategoryImage;
  }

  if (/rust/i.test(category)) {
    return rustCategoryImage;
  }

  if (/spoofer/i.test(category)) {
    return spooferCategoryImage;
  }

  if (/apex/i.test(category)) {
    return apexCategoryImage;
  }

  if (/tarkov|eft/i.test(category)) {
    return eftCategoryImage;
  }

  return haloLogoImage;
}

function productImageSrc(product) {
  return productArtwork[product.slug] || categoryImageSrc(product.category || product.game || "");
}

function renderCategoryCard(category, products) {
  const card = document.createElement("article");
  const label = categoryImageLabel(category);
  const imageSrc = categoryImageSrc(category);
  card.className = "catalog-category-card";
  card.dataset.categoryCard = category;
  card.innerHTML = `
    <div class="category-card-art">
      <img src="${imageSrc}" alt="${escapeHtml(category)}" loading="lazy" />
    </div>
    <div class="category-card-body">
      <span class="category-card-count">${products.length} ${products.length === 1 ? "product" : "products"}</span>
    </div>
  `;
  return card;
}

function renderCategoryCards(products) {
  const groups = groupProducts(products);
  renderCategoryStrip(groups);

  if (!groups.size) {
    grid.innerHTML = '<div class="member-empty">No product categories available yet.</div>';
    return;
  }

  const section = document.createElement("section");
  section.className = "catalog-category-grid";
  section.replaceChildren(
    ...[...groups.entries()].map(([category, categoryProducts]) =>
      renderCategoryCard(category, categoryProducts)
    )
  );

  grid.replaceChildren(section);
}

function productMatchesSearch(product) {
  if (!searchQuery) {
    return true;
  }

  // If AI search returned results, use those
  if (aiSearchResults !== null) {
    return aiSearchResults.includes(product.slug);
  }

  // Fallback: simple client-side includes match
  return [product.name, product.summary, product.vendor, product.game, product.category]
    .join(" ")
    .toLowerCase()
    .includes(searchQuery);
}

function renderProductCard(product, index) {
  const item = document.createElement("article");
  item.className = `product-card product-card-page catalog-product${
    product.featured ? " featured" : ""
  }`;
  item.dataset.delay = String(30 + (index % 4) * 35);
  item.innerHTML = `
    <a
      class="product-thumbnail-button"
      href="/products/${encodeURIComponent(product.slug)}/"
      aria-label="View ${escapeHtml(product.name)}"
    >
      <img
        class="product-thumbnail-image"
        src="${productImageSrc(product)}"
        alt=""
        loading="lazy"
      />
      <img class="product-image-blur product-image-blur-top" src="${productImageSrc(product)}" alt="" loading="lazy" aria-hidden="true" />
      <img class="product-image-blur product-image-blur-bottom" src="${productImageSrc(product)}" alt="" loading="lazy" aria-hidden="true" />
      <span class="product-thumbnail-overlay" aria-hidden="true">
        <span>View</span>
      </span>
    </a>
  `;

  return item;
}

function buildResultsLabel(products) {
  const pieces = [];

  if (activeCategory !== "all") {
    pieces.push(activeCategory);
  }

  if (searchQuery) {
    pieces.push(`search: "${searchQuery}"`);
  }

  if (availabilityMode === "ready") {
    pieces.push("ready now");
  } else if (availabilityMode === "stocked") {
    pieces.push("in stock");
  } else if (availabilityMode === "coming-soon") {
    pieces.push("coming soon");
  }

  if (stockOnly) {
    pieces.push("stock only");
  }

  if (saleOnly) {
    pieces.push("deals");
  }

  if (!pieces.length) {
    return `Showing ${products.length} ${products.length === 1 ? "listing" : "listings"} across the full catalog.`;
  }

  return `Showing ${products.length} ${products.length === 1 ? "listing" : "listings"} for ${pieces.join(" · ")}.`;
}

function sortProducts(products) {
  const nextProducts = [...products];

  if (sortMode === "recommended" && aiSearchResults !== null && searchQuery) {
    nextProducts.sort((a, b) => {
      const aIdx = aiSearchResults.indexOf(a.slug);
      const bIdx = aiSearchResults.indexOf(b.slug);
      if (aIdx === -1 && bIdx === -1) return 0;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
    return nextProducts;
  }

  switch (sortMode) {
    case "price-asc":
      nextProducts.sort((a, b) => getStartingPrice(a) - getStartingPrice(b));
      break;
    case "price-desc":
      nextProducts.sort((a, b) => getStartingPrice(b) - getStartingPrice(a));
      break;
    case "stock-desc":
      nextProducts.sort((a, b) => getTotalStock(b) - getTotalStock(a) || getStartingPrice(a) - getStartingPrice(b));
      break;
    case "name-asc":
      nextProducts.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      nextProducts.sort((a, b) => {
        const featuredDelta = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
        if (featuredDelta) return featuredDelta;
        const saleDelta = Number(Boolean(b.sale)) - Number(Boolean(a.sale));
        if (saleDelta) return saleDelta;
        const readyDelta = Number(isReadyProduct(b)) - Number(isReadyProduct(a));
        if (readyDelta) return readyDelta;
        return 0;
      });
      break;
  }

  return nextProducts;
}

function applyCatalogFilters(products) {
  const filtered = products.filter((product) => {
    if (!productMatchesSearch(product)) {
      return false;
    }

    if (availabilityMode === "ready" && !isReadyProduct(product)) {
      return false;
    }

    if (availabilityMode === "stocked" && !isStockedProduct(product)) {
      return false;
    }

    if (availabilityMode === "coming-soon" && !isComingSoonProduct(product)) {
      return false;
    }

    if (stockOnly && !isStockedProduct(product)) {
      return false;
    }

    if (saleOnly && !product.sale) {
      return false;
    }

    return true;
  });

  return sortProducts(filtered);
}

function ensureVariantModal() {
  let modal = document.querySelector("[data-variant-modal]");

  if (modal) {
    return modal;
  }

  modal = document.createElement("div");
  modal.className = `variant-modal${dedicatedProductSlug ? " product-detail-shell" : ""}`;
  modal.hidden = !dedicatedProductSlug;
  modal.dataset.variantModal = "";
  modal.innerHTML = `
    ${dedicatedProductSlug ? "" : '<div class="variant-backdrop" data-variant-close></div>'}
    <section class="variant-dialog" ${dedicatedProductSlug ? "" : 'role="dialog" aria-modal="true"'} aria-labelledby="variant-title">
      ${dedicatedProductSlug ? '<a class="product-detail-back" href="/products/">&larr; All products</a>' : '<button class="variant-close" type="button" data-variant-close aria-label="Close variant selector">&times;</button>'}
      <div class="variant-art">
        <img class="variant-product-image" data-variant-product-image alt="" />
        <img class="product-image-blur product-image-blur-top" data-variant-product-blur alt="" aria-hidden="true" />
        <img class="product-image-blur product-image-blur-bottom" data-variant-product-blur alt="" aria-hidden="true" />
        <div class="variant-art-brand" aria-hidden="true"><span>XenCheats</span></div>
      </div>
      <div class="variant-details">
        <p class="eyebrow">Product view</p>
        <div class="variant-product-kicker">
          <span data-variant-category></span>
          <span>Verified listing</span>
        </div>
        <h3 id="variant-title" data-variant-title></h3>
        <div class="variant-status-row">
          <span class="variant-dot"></span>
          <strong data-variant-status></strong>
          <span data-variant-price></span>
          <em data-variant-stock>In Stock</em>
        </div>
        <p data-variant-summary></p>
        <label class="variant-label">Select option</label>
        <div class="variant-options" data-variant-options></div>
        <form class="variant-promo-form" data-promo-form ${promoEnabled ? "" : "hidden"}>
          <label>
            <span>Promo code</span>
            <input type="text" name="promoCode" placeholder="Enter promo code" autocomplete="off" />
          </label>
          <button class="button button-secondary" type="submit">Apply</button>
        </form>
        <p class="variant-promo-message" data-promo-message hidden></p>
        <label class="variant-terms">
          <input type="checkbox" data-terms-check />
          <span>
            I understand all sales are final. I have read and agree to the
            <a href="/terms/" target="_blank" rel="noreferrer">Terms of Service</a>.
          </span>
        </label>
        <div class="variant-actions">
          <button class="button button-primary" type="button" data-variant-checkout>Pay with Card</button>
          <button class="button button-balance" type="button" data-variant-balance>Pay with Balance</button>
          <button class="button button-crypto" type="button" data-variant-crypto>Pay with Crypto</button>
          <button class="button button-secondary" type="button" data-variant-cart>Add to Cart</button>
          <button class="button button-primary" type="button" data-variant-notify hidden>Notify me when back in stock</button>
        </div>
        <p class="variant-notify-message" data-notify-message hidden></p>
        <div class="variant-trust-row">
          <span>Secure</span>
          <span>Instant</span>
          <span>HWID Lock</span>
          <span>24/7</span>
        </div>
      </div>
      <div class="variant-extra">
        <section class="variant-about" id="product-about">
          <h4>About this product</h4>
          <p data-detail-about></p>
        </section>
        <section class="variant-feature-section" id="product-features">
          <h4>Features</h4>
          <div class="variant-feature-grid" data-detail-features></div>
        </section>
        <section class="variant-info-section" id="product-information">
          <h4>General Information</h4>
          <div class="variant-info-list" data-detail-info></div>
        </section>
        <section class="variant-requirements-section" id="product-requirements">
          <h4>System Requirements</h4>
          <div class="variant-requirements" data-detail-requirements></div>
        </section>
      </div>
    </section>
  `;
  (dedicatedProductHost || document.body).append(modal);

  modal.addEventListener("submit", async (event) => {
    const promoForm = event.target.closest("[data-promo-form]");

    if (!promoForm) {
      return;
    }

    event.preventDefault();
    const code = String(new FormData(promoForm).get("promoCode") || "")
      .trim()
      .toUpperCase();
    const message = modal.querySelector("[data-promo-message]");
    const applyBtn = promoForm.querySelector("button[type=submit]");

    if (!code) {
      activePromo = null;
      renderPromoMessage(message, "Enter a promo code.", "error");
      updateVariantPricing();
      updateCheckoutButtonState();
      return;
    }

    if (applyBtn) applyBtn.disabled = true;

    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok || !payload.valid) {
        activePromo = null;
        renderPromoMessage(message, "Invalid promo code.", "error");
      } else {
        activePromo = { code: payload.code, discountPercent: payload.percent };
        renderPromoMessage(message, `${payload.code} applied: ${payload.percent}% off.`, "success");
      }
    } catch {
      activePromo = null;
      renderPromoMessage(message, "Could not validate code. Try again.", "error");
    } finally {
      if (applyBtn) applyBtn.disabled = false;
      updateVariantPricing();
      updateCheckoutButtonState();
    }
  });

  modal.addEventListener("change", (event) => {
    if (event.target.matches("[data-terms-check]")) {
      updateCheckoutButtonState();
    }
  });

  modal.addEventListener("click", async (event) => {
    const closeButton = event.target.closest("[data-variant-close]");
    const option = event.target.closest("[data-variant-option]");
    const checkoutButton = event.target.closest("[data-variant-checkout]");
    const balanceButton = event.target.closest("[data-variant-balance]");
    const cartButton = event.target.closest("[data-variant-cart]");
    const cryptoButton = event.target.closest("[data-variant-crypto]");
    const notifyButton = event.target.closest("[data-variant-notify]");

    if (closeButton) {
      closeVariantModal();
      return;
    }

    if (option) {
      selectVariant(option.dataset.variantSlug);
      return;
    }

    if (checkoutButton) {
      await checkoutSelectedVariant(checkoutButton);
    }

    if (balanceButton) {
      await checkoutSelectedVariantBalance(balanceButton);
    }

    if (cartButton) {
      addActiveVariantToCart(cartButton);
    }

    if (cryptoButton) {
      await checkoutSelectedVariantCrypto(cryptoButton);
    }

    if (notifyButton) {
      await requestRestockNotify(notifyButton);
    }
  });

  return modal;
}

function renderPromoMessage(target, message, tone) {
  if (!target) {
    return;
  }

  target.hidden = false;
  target.textContent = message;
  target.className = `variant-promo-message ${tone}`;
}

function parseMoney(value) {
  const match = String(value || "").match(/\$([0-9]+(?:\.[0-9]{2})?)/);
  return match ? Number(match[1]) : null;
}

function formatMoney(value) {
  return `$${value.toFixed(2)}`;
}

function getVariantDisplayPrice(variant) {
  const basePrice = parseMoney(variant?.priceDisplay);

  if (!basePrice) {
    return escapeHtml(variant?.priceDisplay || "");
  }

  if (!activePromo) {
    if (variant.originalPrice) {
      return `${escapeHtml(variant.priceDisplay)} <small>${escapeHtml(variant.originalPrice)}</small>`;
    }
    return escapeHtml(variant.priceDisplay);
  }

  const discounted = basePrice * (1 - activePromo.discountPercent / 100);
  return `${formatMoney(discounted)} <small>${escapeHtml(variant.originalPrice || variant.priceDisplay)}</small>`;
}

function renderFeatureGroups(product) {
  const featureGroups = product.featureGroups?.length
    ? product.featureGroups
    : [
        {
          title: "Included",
          items: product.features || [],
        },
      ];

  return featureGroups
    .map(
      (group) => {
        const items = group.items || [];

        return `
        <article class="variant-feature-card${items.length ? "" : " variant-feature-card-compact"}">
          <strong>${escapeHtml(group.title)}</strong>
          ${
            items.length
              ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
              : ""
          }
        </article>
      `;
      }
    )
    .join("");
}

function renderInfoList(items, instructionHref = "") {
  const safeItems = items?.length ? items : ["Open a support ticket if you need setup guidance."];
  const info = safeItems.map((item) => `<div>${escapeHtml(item)}</div>`).join("");

  if (!instructionHref) {
    return info;
  }

  return `${info}<a class="variant-info-link" href="${escapeHtml(instructionHref)}">Open product instructions</a>`;
}

function resetVariantControls(modal) {
  activePromo = null;
  const promoForm = modal.querySelector("[data-promo-form]");
  const promoMessage = modal.querySelector("[data-promo-message]");
  const termsCheck = modal.querySelector("[data-terms-check]");

  promoForm?.reset();

  if (promoMessage) {
    promoMessage.hidden = true;
    promoMessage.textContent = "";
  }

  if (termsCheck) {
    termsCheck.checked = false;
  }
}

function termsAccepted() {
  return Boolean(document.querySelector("[data-terms-check]")?.checked);
}

function updateVariantPricing() {
  const modal = ensureVariantModal();
  const priceTarget = modal.querySelector("[data-variant-price]");

  if (priceTarget) {
    priceTarget.innerHTML = getVariantDisplayPrice(activeVariant);
  }
}

function updateCheckoutButtonState() {
  const modal = ensureVariantModal();
  const checkoutButton = modal.querySelector("[data-variant-checkout]");
  const balanceButton = modal.querySelector("[data-variant-balance]");
  const cartButton = modal.querySelector("[data-variant-cart]");
  const cryptoButton = modal.querySelector("[data-variant-crypto]");
  const notifyButton = modal.querySelector("[data-variant-notify]");
  const canAttempt = Boolean(activeVariant?.checkoutReady || activeVariant?.checkoutBlocked);
  /* Out of stock (not a blocked/error variant) → offer restock notify instead */
  const outOfStock = Boolean(activeVariant) && !canAttempt;

  checkoutButton.hidden = outOfStock;
  checkoutButton.disabled = !canAttempt || !termsAccepted();
  checkoutButton.textContent = canAttempt ? "Pay with Card" : "Unavailable";
  if (balanceButton) {
    balanceButton.hidden = outOfStock;
    balanceButton.disabled = !canAttempt || !termsAccepted();
    balanceButton.textContent = canAttempt ? "Pay with Balance" : "Unavailable";
  }
  if (cartButton) {
    /* Adding to cart doesn't require terms acceptance; only needs a valid, ready variant. */
    cartButton.hidden = outOfStock;
    cartButton.disabled = !activeVariant?.checkoutReady;
  }
  if (cryptoButton) {
    cryptoButton.hidden = outOfStock;
    cryptoButton.disabled = !canAttempt || !termsAccepted();
    cryptoButton.textContent = canAttempt ? "Pay with Crypto" : "Unavailable";
  }
  if (notifyButton) {
    notifyButton.hidden = !outOfStock;
    notifyButton.disabled = false;
  }
}

async function requestRestockNotify(button) {
  const modal = ensureVariantModal();
  const msg = modal.querySelector("[data-notify-message]");
  if (!activeProduct) return;

  const session = await getCurrentSession();
  if (!session) {
    window.location.href = `/account/?next=/products/&intent=notify&product=${activeProduct.slug}`;
    return;
  }

  button.disabled = true;
  const original = button.textContent;
  button.textContent = "Setting up...";
  try {
    const res = await fetch("/api/notify-restock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ productSlug: activeProduct.slug }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || "Could not set up the notification.");
    if (msg) {
      msg.hidden = false;
      msg.textContent = payload.message || "We'll notify you when it's back in stock.";
      msg.className = "variant-notify-message success";
    }
    button.textContent = "You're on the list";
  } catch (err) {
    if (msg) {
      msg.hidden = false;
      msg.textContent = err.message;
      msg.className = "variant-notify-message error";
    }
    button.textContent = original;
    button.disabled = false;
  }
}

const viewedProductSlugs = new Set();
function logProductView(slug) {
  if (!slug || viewedProductSlugs.has(slug)) return;
  viewedProductSlugs.add(slug);
  try {
    fetch("/api/product-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

function updateProductUrl(productSlug, mode = "push") {
  if (dedicatedProductSlug) {
    return;
  }

  const url = new URL(window.location.href);

  if (productSlug) {
    url.searchParams.set("product", productSlug);
  } else {
    url.searchParams.delete("product");
  }

  window.history[mode === "replace" ? "replaceState" : "pushState"](
    { product: productSlug || null },
    "",
    `${url.pathname}${url.search}${url.hash}`
  );
}

function prepareDedicatedProductPage() {
  const main = document.querySelector("main");

  if (!main) {
    return null;
  }

  main.className = "product-detail-main";
  main.innerHTML = `
    <nav class="product-breadcrumb" aria-label="Breadcrumb">
      <a href="/products/">Products</a>
      <span aria-hidden="true">/</span>
      <span data-product-breadcrumb>Product</span>
    </nav>
    <div class="inline-message info products-message" data-products-message hidden></div>
    <div data-product-page-host></div>
  `;
  dedicatedProductHost = main.querySelector("[data-product-page-host]");
  notice = main.querySelector("[data-products-message]");
  return dedicatedProductHost;
}

function renderMissingProduct() {
  if (!dedicatedProductHost) {
    return;
  }

  dedicatedProductHost.innerHTML = `
    <section class="product-not-found">
      <p class="eyebrow">Product not found</p>
      <h1>This listing is no longer available.</h1>
      <p>Browse the catalog to find a current product and its available options.</p>
      <a class="button button-primary" href="/products/">Back to products</a>
    </section>
  `;
}

function openVariantModal(product, { updateUrl = true } = {}) {
  if (!product) {
    renderMessage(notice, "That product could not be loaded. Refresh and try again.", "error");
    return;
  }

  activeProduct = product;
  logProductView(product.slug);
  activeVariant =
    product.variants?.find((variant) => variant.checkoutReady || variant.checkoutBlocked) ||
    product.variants?.[0] ||
    null;

  const modal = ensureVariantModal();
  resetVariantControls(modal);
  modal.querySelector("[data-variant-title]").textContent = product.name;
  modal.querySelector("[data-variant-category]").textContent = product.category || product.game || "Catalog";
  modal.querySelector("[data-variant-status]").textContent = product.badge;
  modal.querySelector("[data-variant-summary]").textContent = product.summary;
  modal.querySelector("[data-detail-about]").textContent = product.summary;
  modal.querySelector("[data-detail-features]").innerHTML = renderFeatureGroups(product);
  modal.querySelector("[data-detail-info]").innerHTML = renderInfoList(
    product.generalInfo,
    product.instructionHref
  );
  modal.querySelector("[data-detail-requirements]").innerHTML = renderInfoList(product.requirements);

  const artwork = modal.querySelector("[data-variant-product-image]");

  if (artwork) {
    artwork.src = productImageSrc(product);
    artwork.alt = `${product.name} artwork`;
  }

  modal.querySelectorAll("[data-variant-product-blur]").forEach((image) => {
    image.src = productImageSrc(product);
  });

  if (dedicatedProductSlug) {
    const breadcrumb = document.querySelector("[data-product-breadcrumb]");
    if (breadcrumb) breadcrumb.textContent = product.name;
    document.title = `${product.name} | XenCheats`;
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute(
        "content",
        product.summary || `View ${product.name} options and features.`
      );
    }
  }

  const options = modal.querySelector("[data-variant-options]");
  options.replaceChildren(
    ...(product.variants || []).map((variant) => {
      const button = document.createElement("button");
      const canSelectVariant = variant.checkoutReady || variant.checkoutBlocked;
      button.type = "button";
      button.className = "variant-option";
      button.dataset.variantOption = "";
      button.dataset.variantSlug = variant.slug;
      button.disabled = !canSelectVariant;
      button.innerHTML = `
        <span>
          <strong>${escapeHtml(variant.name)}</strong>
          <small>${escapeHtml(canSelectVariant ? variant.stockLabel : "0 In Stock")}</small>
        </span>
        <em>${variant.originalPrice ? `${escapeHtml(variant.priceDisplay)} <small>${escapeHtml(variant.originalPrice)}</small>` : escapeHtml(variant.priceDisplay)}</em>
      `;
      return button;
    })
  );

  modal.hidden = false;
  if (!dedicatedProductSlug) {
    document.body.classList.add("modal-open");
  }
  selectVariant(activeVariant?.slug);

  if (updateUrl && new URLSearchParams(window.location.search).get("product") !== product.slug) {
    updateProductUrl(product.slug);
  }
}

function closeVariantModal({ updateUrl = true } = {}) {
  if (dedicatedProductSlug) {
    return;
  }

  const modal = document.querySelector("[data-variant-modal]");

  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.classList.remove("modal-open");

  if (updateUrl && new URLSearchParams(window.location.search).has("product")) {
    updateProductUrl("", "replace");
  }
}

function selectVariant(variantSlug) {
  if (!activeProduct) {
    return;
  }

  activeVariant = activeProduct.variants?.find((variant) => variant.slug === variantSlug) || null;
  const modal = ensureVariantModal();
  const checkoutButton = modal.querySelector("[data-variant-checkout]");

  modal.querySelectorAll("[data-variant-option]").forEach((option) => {
    option.classList.toggle("is-selected", option.dataset.variantSlug === activeVariant?.slug);
  });

  const stockBadge = modal.querySelector("[data-variant-stock]");

  if (stockBadge) {
    stockBadge.textContent = activeVariant?.stockLabel || "0 In Stock";
  }

  updateVariantPricing();
  updateCheckoutButtonState();
}

function renderProductGroups(products) {
  const groups = groupProducts(products);
  renderCategoryStrip(groupProducts(catalogProducts));

  if (!products.length) {
    grid.innerHTML = '<div class="member-empty">No products match that search.</div>';
    return;
  }

  const sections = [...groups.entries()].map(([category, categoryProducts]) => {
    const section = document.createElement("section");
    section.className = "catalog-group";
    section.id = slugify(category);
    section.innerHTML = `
      <div class="catalog-group-heading">
        <div>
          <span>${String(categoryProducts.length).padStart(2, "0")} listings</span>
          <h3>${escapeHtml(category)}</h3>
        </div>
        <button class="button button-secondary" type="button" data-category-filter="all">Back to categories</button>
      </div>
    `;

    const list = document.createElement("div");
    list.className = "product-grid page-product-grid catalog-grid";
    list.replaceChildren(...categoryProducts.map(renderProductCard));
    section.append(list);
    return section;
  });

  grid.replaceChildren(...sections);
}

function renderCatalogView() {
  const baseProducts = catalogProducts.filter((product) => {
    return activeCategory === "all" || (product.category || product.game) === activeCategory;
  });
  const matchingProducts = applyCatalogFilters(baseProducts);

  if (visibleStat) {
    visibleStat.textContent = matchingProducts.length;
  }

  if (resultsLabel) {
    resultsLabel.textContent = buildResultsLabel(matchingProducts);
  }

  const usingDefaultCatalogView =
    activeCategory === "all" &&
    !searchQuery &&
    sortMode === "recommended" &&
    availabilityMode === "all" &&
    !stockOnly &&
    !saleOnly;

  if (usingDefaultCatalogView) {
    renderCategoryCards(catalogProducts);
    return;
  }

  renderProductGroups(matchingProducts);
}

function updateStats(products) {
  const categories = new Set(products.map((product) => product.category || product.game));
  if (gamesStat) {
    gamesStat.textContent = categories.size;
  }

  if (productsStat) {
    productsStat.textContent = products.length;
  }
}

async function startCheckout(productSlug, variantSlug) {
  const session = await getCurrentSession();

  if (!session) {
    window.location.href = `/account/?next=/products/&intent=checkout&product=${productSlug}&variant=${variantSlug}`;
    return;
  }

  const response = await fetch("/api/create-checkout-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      productSlug,
      variantSlug,
      promoCode: activePromo?.code || undefined,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Unable to start checkout.");
  }

  window.location.href = payload.url;
}

async function checkoutSelectedVariant(button) {
  if (!activeProduct || !activeVariant) {
    renderMessage(notice, "Pick a variant before checkout.", "warn");
    return;
  }

  if (!termsAccepted()) {
    renderMessage(notice, "Agree to the Terms of Service before continuing.", "warn");
    return;
  }

  if (!activeVariant.checkoutReady) {
    if (activeVariant.checkoutBlocked) {
      renderMessage(
        notice,
        activeVariant.checkoutError ||
          "Error occurred. Please open a ticket in Discord so support can help you with this item.",
        "error"
      );
      return;
    }

    renderMessage(notice, "This variant is unavailable.", "warn");
    return;
  }

  button.disabled = true;
  button.textContent = "Opening Checkout...";

  try {
    await startCheckout(activeProduct.slug, activeVariant.slug);
  } catch (error) {
    renderMessage(notice, error.message, "error");
    button.disabled = false;
    button.textContent = "Pay with Card";
  }
}

function activeVariantPriceCents() {
  const dollars = parseMoney(activeVariant?.priceDisplay);
  return dollars ? Math.round(dollars * 100) : 0;
}

function addActiveVariantToCart(button) {
  if (!activeProduct || !activeVariant) {
    renderMessage(notice, "Pick a variant first.", "warn");
    return;
  }

  if (!activeVariant.checkoutReady) {
    renderMessage(notice, "This variant is unavailable.", "warn");
    return;
  }

  if (!window.haloCart?.add) {
    renderMessage(notice, "Cart is unavailable right now.", "error");
    return;
  }

  window.haloCart.add({
    productSlug: activeProduct.slug,
    variantSlug: activeVariant.slug,
    productName: activeProduct.name,
    variantName: activeVariant.name,
    imageSrc: productImageSrc(activeProduct),
    priceCents: activeVariantPriceCents(),
    qty: 1,
  });

  const original = button.textContent;
  button.textContent = "Added";
  button.disabled = true;
  window.setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
  }, 1200);
}

async function checkoutSelectedVariantBalance(button) {
  if (!activeProduct || !activeVariant) {
    renderMessage(notice, "Pick a variant before checkout.", "warn");
    return;
  }

  if (!termsAccepted()) {
    renderMessage(notice, "Agree to the Terms of Service before continuing.", "warn");
    return;
  }

  if (!activeVariant.checkoutReady) {
    renderMessage(notice, "This variant is unavailable.", "warn");
    return;
  }

  const session = await getCurrentSession();
  if (!session) {
    window.location.href = `/account/?next=/products/&intent=checkout&product=${activeProduct.slug}&variant=${activeVariant.slug}`;
    return;
  }

  button.disabled = true;
  const original = button.textContent;
  button.textContent = "Processing...";

  try {
    const response = await fetch("/api/purchase-with-balance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        productSlug: activeProduct.slug,
        variantSlug: activeVariant.slug,
        promoCode: activePromo?.code || undefined,
      }),
    });

    const payload = await response.json();

    if (response.status === 402) {
      renderMessage(
        notice,
        "Not enough balance. Add funds on your account page, then try again.",
        "warn"
      );
      button.disabled = false;
      button.textContent = original;
      return;
    }

    if (!response.ok) {
      throw new Error(payload.error || "Unable to complete the purchase.");
    }

    window.haloCart?.refreshBalance?.();
    renderMessage(
      notice,
      "Purchased with balance. Your key is on your account page and Discord DM.",
      "success"
    );
    button.textContent = "Purchased";
    window.setTimeout(() => {
      window.location.href = "/account/";
    }, 1400);
  } catch (error) {
    renderMessage(notice, error instanceof Error ? error.message : "Purchase failed.", "error");
    button.disabled = false;
    button.textContent = original;
  }
}

async function startCryptoCheckout(productSlug, variantSlug) {
  const session = await getCurrentSession();

  if (!session) {
    window.location.href = `/account/?next=/products/&intent=checkout&product=${productSlug}&variant=${variantSlug}`;
    return;
  }

  const response = await fetch("/api/create-crypto-checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      productSlug,
      variantSlug,
      promoCode: activePromo?.code || undefined,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Unable to start crypto checkout.");
  }

  window.location.href = payload.url;
}

async function checkoutSelectedVariantCrypto(button) {
  if (!activeProduct || !activeVariant) {
    renderMessage(notice, "Pick a variant before checkout.", "warn");
    return;
  }

  if (!termsAccepted()) {
    renderMessage(notice, "Agree to the Terms of Service before continuing.", "warn");
    return;
  }

  if (!activeVariant.checkoutReady) {
    if (activeVariant.checkoutBlocked) {
      renderMessage(
        notice,
        activeVariant.checkoutError ||
          "Error occurred. Please open a ticket in Discord so support can help you with this item.",
        "error"
      );
      return;
    }

    renderMessage(notice, "This variant is unavailable.", "warn");
    return;
  }

  button.disabled = true;
  button.textContent = "Opening Crypto...";

  try {
    await startCryptoCheckout(activeProduct.slug, activeVariant.slug);
  } catch (error) {
    renderMessage(notice, error.message, "error");
    button.disabled = false;
    button.textContent = "Pay with Crypto";
  }
}

try {
  catalogProducts = (await loadProducts()).filter(isAllowedProduct);
  updateStats(catalogProducts);
  const requestedProduct =
    dedicatedProductSlug || new URLSearchParams(window.location.search).get("product");

  if (dedicatedProductSlug) {
    prepareDedicatedProductPage();
    const product = catalogProducts.find((item) => item.slug === dedicatedProductSlug);
    if (product) {
      openVariantModal(product, { updateUrl: false });
    } else {
      renderMissingProduct();
    }
  } else {
    renderCatalogView();
    if (requestedProduct) {
      openVariantModal(
        catalogProducts.find((product) => product.slug === requestedProduct),
        { updateUrl: false }
      );
    }
  }
  initReveal();
} catch (error) {
  renderMessage(notice, error.message, "error");
}

categoryStrip?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category-filter]");

  if (!button) {
    return;
  }

  activeCategory = button.dataset.categoryFilter;
  renderCatalogView();
});

grid?.addEventListener("click", async (event) => {
  const categoryCard = event.target.closest("[data-category-card]");

  if (categoryCard) {
    activeCategory = categoryCard.dataset.categoryCard;
    renderCatalogView();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const categoryButton = event.target.closest("[data-category-filter]");

  if (categoryButton) {
    activeCategory = categoryButton.dataset.categoryFilter;
    renderCatalogView();
    return;
  }

  const addCartBtn = event.target.closest(".add-cart-button");
  if (addCartBtn) {
    const cartProduct = catalogProducts.find((item) => item.slug === addCartBtn.dataset.addCartSlug);
    addProductDefaultToCart(cartProduct, addCartBtn);
    return;
  }

  const button = event.target.closest("button.pay-button");

  if (!button) {
    return;
  }

  const product = catalogProducts.find((item) => item.slug === button.dataset.productSlug);
  openVariantModal(product);
});

/* Add-to-cart from a product card. One purchasable variant → add directly;
   several → open a variation + price picker anchored to the button. */
function addProductDefaultToCart(product, button) {
  if (!product) {
    return;
  }

  const selectable = (product.variants || []).filter((v) => v.checkoutReady);

  if (!selectable.length) {
    renderMessage(notice, "This product is out of stock right now.", "warn");
    return;
  }

  if (!window.haloCart?.add) {
    renderMessage(notice, "Cart is unavailable right now.", "error");
    return;
  }

  if (selectable.length === 1) {
    addVariantToCart(product, selectable[0], button);
    return;
  }

  openCartVariantPicker(product, button, selectable);
}

function addVariantToCart(product, variant, button) {
  const dollars = parseMoney(variant.priceDisplay);
  window.haloCart.add({
    productSlug: product.slug,
    variantSlug: variant.slug,
    productName: product.name,
    variantName: variant.name,
    imageSrc: productImageSrc(product),
    priceCents: dollars ? Math.round(dollars * 100) : 0,
    qty: 1,
  });

  if (button) {
    const original = button.innerHTML;
    button.innerHTML = "Added to cart";
    button.disabled = true;
    window.setTimeout(() => {
      button.innerHTML = original;
      button.disabled = false;
    }, 1300);
  }
}

let openCartPop = null;
let openCartPopBackdrop = null;

function closeCartPop() {
  if (!openCartPop) {
    return;
  }
  openCartPop.remove();
  openCartPop = null;
  if (openCartPopBackdrop) {
    openCartPopBackdrop.remove();
    openCartPopBackdrop = null;
  }
  document.body.classList.remove("cart-pop-open");
  document.removeEventListener("click", onDocClickCartPop, true);
  window.removeEventListener("scroll", closeCartPop, true);
  window.removeEventListener("resize", closeCartPop);
}

function onDocClickCartPop(event) {
  if (!openCartPop) {
    return;
  }
  if (!openCartPop.contains(event.target) && !event.target.closest(".add-cart-button")) {
    closeCartPop();
  }
}

function openCartVariantPicker(product, button, variants) {
  closeCartPop();

  const isMobile = window.matchMedia("(max-width: 760px)").matches;

  const pop = document.createElement("div");
  pop.className = `cart-variant-pop${isMobile ? " cart-variant-pop--sheet" : ""}`;
  pop.innerHTML = `
    <div class="cvp-head">Choose an option</div>
    <div class="cvp-list">
      ${variants
        .map(
          (v) => `
        <button type="button" class="cvp-opt" data-variant-slug="${escapeHtml(v.slug)}">
          <span class="cvp-name">${escapeHtml(v.name)}</span>
          <span class="cvp-price">${escapeHtml(v.priceDisplay || "")}</span>
        </button>
      `
        )
        .join("")}
    </div>
    ${isMobile ? '<button type="button" class="cvp-cancel" data-cvp-cancel>Cancel</button>' : ""}
  `;

  if (isMobile) {
    /* Bottom sheet with a backdrop — reliable and easy to tap on phones. */
    const backdrop = document.createElement("div");
    backdrop.className = "cart-variant-backdrop";
    backdrop.addEventListener("click", closeCartPop);
    document.body.appendChild(backdrop);
    openCartPopBackdrop = backdrop;
    document.body.classList.add("cart-pop-open");
  }

  document.body.appendChild(pop);
  openCartPop = pop;

  if (!isMobile) {
    /* Anchored popover on desktop. */
    const rect = button.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    let top = rect.top - popRect.height - 8;
    if (top < 8) {
      top = rect.bottom + 8;
    }
    let left = rect.left + rect.width / 2 - popRect.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - popRect.width - 8));
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
  }

  pop.addEventListener("click", (event) => {
    if (event.target.closest("[data-cvp-cancel]")) {
      closeCartPop();
      return;
    }
    const opt = event.target.closest(".cvp-opt");
    if (!opt) {
      return;
    }
    const variant = variants.find((v) => v.slug === opt.dataset.variantSlug);
    if (variant) {
      addVariantToCart(product, variant, button);
    }
    closeCartPop();
  });

  window.setTimeout(() => {
    document.addEventListener("click", onDocClickCartPop, true);
    window.addEventListener("resize", closeCartPop);
    if (!isMobile) {
      window.addEventListener("scroll", closeCartPop, true);
    }
  }, 0);
}

productSearch?.addEventListener("input", (event) => {
  searchQuery = event.target.value.trim().toLowerCase();

  // Reset AI results for immediate client-side filtering
  aiSearchResults = null;
  renderCatalogView();

  // Cancel any pending AI search
  if (aiSearchTimer) clearTimeout(aiSearchTimer);
  if (aiSearchController) aiSearchController.abort();

  // Debounced AI search for queries 3+ chars
  if (searchQuery.length >= 3) {
    productSearch.classList.add("searching");
    aiSearchTimer = setTimeout(async () => {
      try {
        aiSearchController = new AbortController();
        const resp = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery }),
          signal: aiSearchController.signal,
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data.results && data.results.length > 0) {
            aiSearchResults = data.results;
            renderCatalogView();
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.warn("[AI Search]", err.message);
        }
        // Silently fall back to client-side filtering (already rendered)
      } finally {
        productSearch.classList.remove("searching");
      }
    }, 300);
  } else {
    productSearch.classList.remove("searching");
  }
});

productSort?.addEventListener("change", (event) => {
  sortMode = event.target.value || "recommended";
  renderCatalogView();
});

productAvailability?.addEventListener("change", (event) => {
  availabilityMode = event.target.value || "all";
  renderCatalogView();
});

productStockOnly?.addEventListener("change", (event) => {
  stockOnly = Boolean(event.target.checked);
  renderCatalogView();
});

productSaleOnly?.addEventListener("change", (event) => {
  saleOnly = Boolean(event.target.checked);
  renderCatalogView();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeVariantModal();
  }
});

window.addEventListener("popstate", () => {
  const productSlug = new URLSearchParams(window.location.search).get("product");

  if (!productSlug) {
    closeVariantModal({ updateUrl: false });
    return;
  }

  openVariantModal(
    catalogProducts.find((product) => product.slug === productSlug),
    { updateUrl: false }
  );
});
