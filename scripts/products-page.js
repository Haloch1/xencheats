import { getCurrentSession, authConfigured } from "./supabase-client.js";
import { initReveal, renderMessage } from "./site.js";
import haloLogoImage from "../assets/hc-logo.png";
import rainbowSixCategoryImage from "../assets/rainbow-six-siege-category.png";
import fortniteCategoryImage from "../assets/fortnite-category.png";
import rustCategoryImage from "../assets/rust-category.webp";
import spooferCategoryImage from "../assets/spoofer-category.webp";
// R6 product images
import productCrusaderImage from "../assets/product-crusader-r6.png";
import productVegaImage from "../assets/product-vega-r6-external.png";
import productFrostImage from "../assets/product-r6-frost.png";
import productAncientR6Image from "../assets/product-r6-ancient.png";
import productRecoilImage from "../assets/product-r6-recoil-private.png";
import productExodusR6Image from "../assets/product-exodus-r6.png";
import productInvisionImage from "../assets/product-invision-chams.png";
// Fortnite product images
import productFortniteFullImage from "../assets/product-fortnite-full.png";
import productFortniteAncientImage from "../assets/product-fortnite-ancient.png";
import productDisconnectFortniteImage from "../assets/product-disconnect-fortnite-external.png";
import productFortniteIgniteImage from "../assets/product-fortnite-ignite-aimbot.png";
import productFortniteExodusImage from "../assets/product-fortnite-exodus.png";
// Rust product images
import productRustAncientImage from "../assets/product-rust-ancient.png";
import productRustExodusImage from "../assets/product-rust-exodus.png";
import productRustIgniteImage from "../assets/product-rust-ignite.png";
import productRustKrushImage from "../assets/product-rust-krush.png";
import productRustMekImage from "../assets/product-rust-mek.png";
// Spoofer product images
import productXimSpooferImage from "../assets/product-xim-spoofer.png";
import productSpooferExodusImage from "../assets/product-spoofer-exodus-temp.png";
import productSpooferVerseImage from "../assets/product-spoofer-verse-perm.png";
// Accounts product images
import productLinkedNfaImage from "../assets/product-linked-nfa.png";
import productStackedPcImage from "../assets/product-stacked-pc-account.png";

initReveal();

const grid = document.querySelector("[data-products-grid]");
const notice = document.querySelector("[data-products-message]");
const accountLink = document.querySelector("[data-account-link]");
const categoryStrip = document.querySelector("[data-category-strip]");
const productSearch = document.querySelector("[data-product-search]");
const gamesStat = document.querySelector("[data-catalog-games]");
const productsStat = document.querySelector("[data-catalog-products]");
let catalogProducts = [];
let activeProduct = null;
let activeVariant = null;
let activePromo = null;
let activeCategory = "all";
let searchQuery = "";
let aiSearchResults = null; // null = use normal filter, array = AI-ranked slugs
let aiSearchTimer = null;
let aiSearchController = null;
const excludedCatalogTerms = [];
const promoCodes = {
  HALO10: 10,
  R6SAVE: 15,
};
const productArtwork = {
  // R6
  "crusader-r6": productCrusaderImage,
  "vega-r6-external": productVegaImage,
  "r6-frost": productFrostImage,
  "r6-ancient": productAncientR6Image,
  "r6-recoil-private": productRecoilImage,
  "exodus-r6": productExodusR6Image,
  "invision-chams": productInvisionImage,
  // Fortnite
  "fortnite-full": productFortniteFullImage,
  "fortnite-ancient": productFortniteAncientImage,
  "disconnect-fortnite-external": productDisconnectFortniteImage,
  "fortnite-ignite-aimbot": productFortniteIgniteImage,
  "fortnite-exodus": productFortniteExodusImage,
  // Rust
  "rust-ancient": productRustAncientImage,
  "rust-exodus": productRustExodusImage,
  "rust-ignite": productRustIgniteImage,
  "rust-krush": productRustKrushImage,
  "rust-mek": productRustMekImage,
  // Spoofer
  "xim-spoofer": productXimSpooferImage,
  "spoofer-exodus-temp": productSpooferExodusImage,
  "spoofer-verse-perm": productSpooferVerseImage,
  // Accounts
  "linked-nfa": productLinkedNfaImage,
  "stacked-pc-account": productStackedPcImage,
};

if (accountLink) {
  accountLink.textContent = "Account";
}

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

  const { products } = await response.json();
  return products;
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
  if (count > 0) {
    return `<span class="card-stock in-stock">${count} ${count === 1 ? "Key" : "Keys"} Available</span>`;
  }
  return `<span class="card-stock out-of-stock">Out of Stock</span>`;
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
    return rainbowSixCategoryImage;
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
      <img src="${imageSrc}" alt="" />
      <strong>${escapeHtml(label)}</strong>
    </div>
    <div class="category-card-body">
      <div>
        <h3>${escapeHtml(category)}</h3>
        <p>${products.length} ${products.length === 1 ? "product" : "products"}</p>
      </div>
      <div class="category-card-action">
        <span>Browse ${escapeHtml(category)}</span>
        <button class="button button-primary" type="button">View</button>
      </div>
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
  const statusClass = product.available ? "live" : "unavailable";
  item.className = `product-card product-card-page catalog-product${
    product.featured ? " featured" : ""
  }`;
  item.dataset.delay = String(30 + (index % 4) * 35);
  item.innerHTML = `
    <div class="product-top">
      <span class="product-status ${product.featured ? "pulse" : statusClass}">${escapeHtml(product.badge)}</span>
      <span class="product-tier">${escapeHtml(product.vendor)}</span>
    </div>
    <h3>${escapeHtml(product.name)}</h3>
    <p>${escapeHtml(product.summary)}</p>
    <ul class="feature-list">
      ${product.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}
    </ul>
    ${stockBadgeHtml(product)}
    <div class="product-footer">
      <strong>${escapeHtml(product.priceDisplay)}</strong>
      <button class="button button-primary pay-button" data-product-slug="${escapeHtml(product.slug)}">
        View
      </button>
    </div>
  `;

  return item;
}

function ensureVariantModal() {
  let modal = document.querySelector("[data-variant-modal]");

  if (modal) {
    return modal;
  }

  modal = document.createElement("div");
  modal.className = "variant-modal";
  modal.hidden = true;
  modal.dataset.variantModal = "";
  modal.innerHTML = `
    <div class="variant-backdrop" data-variant-close></div>
    <section class="variant-dialog" role="dialog" aria-modal="true" aria-labelledby="variant-title">
      <button class="variant-close" type="button" data-variant-close aria-label="Close variant selector">&times;</button>
      <div class="variant-art">
        <div class="variant-box-scene">
          <div class="variant-box-side">
            <span>Halo</span>
            <strong>Cheats</strong>
          </div>
          <div class="variant-box-front">
            <img class="variant-product-image" data-variant-product-image alt="" />
            <div class="variant-box-brand">
              <strong>Halo<span>Cheats</span></strong>
            </div>
            <div class="variant-box-title">
              <span data-variant-art-category>R6</span>
              <strong data-variant-art-title>Access Key</strong>
            </div>
            <div class="variant-box-footer">
              <span>Instant delivery</span>
              <span>Global compatibility</span>
            </div>
          </div>
        </div>
      </div>
      <div class="variant-details">
        <p class="eyebrow">Product view</p>
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
        <form class="variant-promo-form" data-promo-form>
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
          <button class="button button-secondary" type="button" data-variant-close>Cancel</button>
          <button class="button button-primary" type="button" data-variant-checkout>Pay with Card</button>
          <button class="button button-crypto" type="button" data-variant-crypto>Pay with Crypto</button>
        </div>
        <div class="variant-trust-row">
          <span>Secure</span>
          <span>Instant</span>
          <span>HWID Lock</span>
          <span>24/7</span>
        </div>
      </div>
      <div class="variant-extra">
        <section class="variant-about">
          <h4>About this product</h4>
          <p data-detail-about></p>
        </section>
        <section class="variant-feature-section">
          <h4>Features</h4>
          <div class="variant-feature-grid" data-detail-features></div>
        </section>
        <section class="variant-info-section">
          <h4>General Information</h4>
          <div class="variant-info-list" data-detail-info></div>
        </section>
        <section class="variant-requirements-section">
          <h4>System Requirements</h4>
          <div class="variant-requirements" data-detail-requirements></div>
        </section>
      </div>
    </section>
  `;
  document.body.append(modal);

  modal.addEventListener("submit", (event) => {
    const promoForm = event.target.closest("[data-promo-form]");

    if (!promoForm) {
      return;
    }

    event.preventDefault();
    const code = String(new FormData(promoForm).get("promoCode") || "")
      .trim()
      .toUpperCase();
    const message = modal.querySelector("[data-promo-message]");

    if (!code || !promoCodes[code]) {
      activePromo = null;
      renderPromoMessage(message, "Invalid promo code.", "error");
      updateVariantPricing();
      updateCheckoutButtonState();
      return;
    }

    activePromo = {
      code,
      discountPercent: promoCodes[code],
    };
    renderPromoMessage(message, `${code} applied: ${promoCodes[code]}% off.`, "success");
    updateVariantPricing();
    updateCheckoutButtonState();
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
    const cryptoButton = event.target.closest("[data-variant-crypto]");

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

    if (cryptoButton) {
      await checkoutSelectedVariantCrypto(cryptoButton);
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
    return escapeHtml(variant.priceDisplay);
  }

  const discounted = basePrice * (1 - activePromo.discountPercent / 100);
  return `${formatMoney(discounted)} <small>${escapeHtml(variant.priceDisplay)}</small>`;
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
  const info = safeItems.slice(0, 1).map((item) => `<div>${escapeHtml(item)}</div>`).join("");

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
  const cryptoButton = modal.querySelector("[data-variant-crypto]");
  const canAttempt = Boolean(activeVariant?.checkoutReady || activeVariant?.checkoutBlocked);

  checkoutButton.disabled = !canAttempt || !termsAccepted();
  checkoutButton.textContent = canAttempt ? "Pay with Card" : "Unavailable";
  if (cryptoButton) {
    cryptoButton.disabled = !canAttempt || !termsAccepted();
    cryptoButton.textContent = canAttempt ? "Pay with Crypto" : "Unavailable";
  }
}

function openVariantModal(product) {
  if (!product) {
    renderMessage(notice, "That product could not be loaded. Refresh and try again.", "error");
    return;
  }

  activeProduct = product;
  activeVariant =
    product.variants?.find((variant) => variant.checkoutReady || variant.checkoutBlocked) ||
    product.variants?.[0] ||
    null;

  const modal = ensureVariantModal();
  resetVariantControls(modal);
  modal.querySelector("[data-variant-title]").textContent = product.name;
  modal.querySelector("[data-variant-art-title]").textContent = product.name;
  modal.querySelector("[data-variant-art-category]").textContent = product.category || product.game || "Product";
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
        <em>${escapeHtml(variant.priceDisplay)}</em>
      `;
      return button;
    })
  );

  modal.hidden = false;
  document.body.classList.add("modal-open");
  selectVariant(activeVariant?.slug);
}

function closeVariantModal() {
  const modal = document.querySelector("[data-variant-modal]");

  if (!modal) {
    return;
  }

  modal.hidden = true;
  document.body.classList.remove("modal-open");
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
  let matchingProducts = baseProducts.filter(productMatchesSearch);

  // If AI search returned results, sort by AI relevance ranking
  if (aiSearchResults !== null && searchQuery) {
    matchingProducts.sort((a, b) => {
      const aIdx = aiSearchResults.indexOf(a.slug);
      const bIdx = aiSearchResults.indexOf(b.slug);
      if (aIdx === -1 && bIdx === -1) return 0;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
  }

  if (activeCategory === "all" && !searchQuery) {
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
  renderCatalogView();
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

  const button = event.target.closest(".pay-button");

  if (!button) {
    return;
  }

  const product = catalogProducts.find((item) => item.slug === button.dataset.productSlug);
  openVariantModal(product);
});

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

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeVariantModal();
  }
});
