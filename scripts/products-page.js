import { getCurrentSession, authConfigured } from "./supabase-client.js";
import { initReveal, renderMessage } from "./site.js";
import haloLogoImage from "../assets/hc-logo.png";
import rainbowSixCategoryImage from "../assets/r6.webp";
import fortniteCategoryImage from "../assets/fortnite.webp";
import rustCategoryImage from "../assets/rust.webp";
const spooferCategoryImage = "/assets/rft-media/spoofer.jpg";
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
import battlefieldCategoryImage from "../assets/battlefield.webp";
import codCategoryImage from "../assets/cod.webp";
import cs2CategoryImage from "../assets/cs2.webp";
import deltaForceCategoryImage from "../assets/deltaforce.webp";
import fragpunkCategoryImage from "../assets/fragpunk.webp";
import marvelRivalsCategoryImage from "../assets/marvelrivals.webp";
import overwatchCategoryImage from "../assets/overwatch.webp";
import pubgCategoryImage from "../assets/pubg.webp";
import dmaCategoryImage from "../assets/dma-category-toolkit.png";
import dmaCardToolkitImage from "../assets/product-dma-card-toolkit.png";
import dmaFuserToolkitImage from "../assets/product-dma-fuser-toolkit.png";
import dmaFirmwareToolkitImage from "../assets/product-dma-firmware-toolkit.png";
import dmaMakcuToolkitImage from "../assets/product-dma-makcu-toolkit.png";
const minecraftCategoryImage = "/assets/categories/minecraft.jpg";
const rocketLeagueCategoryImage = "/assets/categories/rocket-league.jpg";
const valorantCategoryImage = "/assets/categories/valorant.jpg";
const gtaVCategoryImage = "/assets/categories/gta-v.jpg";
const arcRaidersCategoryImage = "/assets/categories/arc-raiders.jpg";
import r6sAptitudeToolkitImage from "../assets/product-r6s-aptitude-toolkit.png";
import r6sExodusLiteToolkitImage from "../assets/product-r6s-exodus-lite-toolkit.png";
import r6sExodusToolkitImage from "../assets/product-r6s-exodus-toolkit.png";
import r6sUnlockAllToolkitImage from "../assets/product-r6s-unlock-all-toolkit.png";
// New per-product tablet images (2026-08-02 batch)
import productCs2ArcaneImage from "../assets/product-cs2-arcane.webp";
import productCs2PredatorImage from "../assets/product-cs2-predator.webp";
import productCs2SkinchangerImage from "../assets/product-cs2-skinchanger.webp";
import productCs2StrikeforceImage from "../assets/product-cs2-strikeforce.webp";
import productFortniteAncientImage from "../assets/product-fortnite-ancient.webp";
import productFortniteArcaneImage from "../assets/product-fortnite-arcane.webp";
import productFortniteDullwaveImage from "../assets/product-fortnite-dullwave.webp";
import productR6sAncientImage from "../assets/product-r6s-ancient.webp";
import productR6sChamsImage from "../assets/product-r6s-chams.webp";
import productR6sCrusaderImage from "../assets/product-r6s-crusader.webp";
import productR6sNoRecoilImage from "../assets/product-r6s-no-recoil.webp";
import productR6sVegaImage from "../assets/product-r6s-vega.webp";
import productR6sLethalImage from "../assets/product-r6s-lethal.webp";
import productRustDullwaveImage from "../assets/product-rust-dullwave.webp";
import productRustMasonFullImage from "../assets/product-rust-mason-full.webp";
import productRustMasonLiteImage from "../assets/product-rust-mason-lite.webp";
// New per-product tablet images (2026-08-02 batch 2)
import productBattlefieldFecurityImage from "../assets/product-battlefield-fecurity.webp";
import productCodDullwaveImage from "../assets/product-cod-dullwave.webp";
import productCodLunarImage from "../assets/product-cod-lunar.webp";
import productEftMasonImage from "../assets/product-eft-mason.webp";
import productEftSkyImage from "../assets/product-eft-sky.webp";
import productEftSugarImage from "../assets/product-eft-sugar.webp";
import productEacBeSpooferImage from "../assets/product-eac-be-spoofer.webp";
import productBattlefield6AncientImage from "../assets/product-battlefield6-ancient.webp";
import productEftChamsImage from "../assets/product-eft-chams.webp";
import productEftCrusaderImage from "../assets/product-eft-crusader.webp";
import productEftSuperiorImage from "../assets/product-eft-superior.webp";
import productR6sNfaAccountImage from "../assets/product-r6s-nfa-account.webp";
import productSpooferLunarImage from "../assets/product-spoofer-lunar.webp";
import productSpooferShadowImage from "../assets/product-spoofer-shadow.webp";
// New per-product tablet images (2026-08-02 batch 3)
import productRustMrProImage from "../assets/product-rust-mrpro.webp";
import productApexMasonImage from "../assets/product-apex-mason.webp";
import productApexAncientImage from "../assets/product-apex-ancient.webp";
import productApexDullwaveImage from "../assets/product-apex-dullwave.webp";
import productApexArcaneImage from "../assets/product-apex-arcane.webp";
import productPubgArcaneImage from "../assets/product-pubg-arcane.webp";
import productPubgShadowImage from "../assets/product-pubg-shadow.webp";
import productDeltaForceDullwaveImage from "../assets/product-delta-force-dullwave.webp";
import productDeltaForceAncientImage from "../assets/product-delta-force-ancient.webp";
import productDeltaForceLunaChamsImage from "../assets/product-delta-force-luna-chams.webp";
import productMarvelRivalsDullwaveImage from "../assets/product-marvel-rivals-dullwave.webp";
import productMarvelRivalsPredatorImage from "../assets/product-marvel-rivals-predator.webp";
import productMarvelRivalsShadowImage from "../assets/product-marvel-rivals-shadow.webp";

initReveal();

const grid = document.querySelector("[data-products-grid]");
let notice = document.querySelector("[data-products-message]");
const accountLink = document.querySelector("[data-account-link]");
const categoryStrip = document.querySelector("[data-category-strip]");
const catalogBundle = document.querySelector("[data-catalog-bundle]");
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
let catalogRefreshRunning = false;
const catalogRefreshMs = 60_000;
const setupBundleDiscountPercent = 5;
const excludedCatalogTerms = [];
const boostingServiceListing = {
  slug: "boosting-services",
  name: "Boosting Services",
  category: "Boosting Services",
  game: "Boosting Services",
  vendor: "XenCheats",
  badge: "Quote only",
  available: true,
  featured: true,
  serviceOnly: true,
  priceDisplay: "To be Calculated",
  summary:
    "Custom boosting arranged through a private Discord ticket. Tell the team what you need, receive a clear quote, and approve it before any payment is requested.",
  features: [
    "Game and goal reviewed by staff",
    "Private Discord ticket for every request",
    "Quote confirmed before payment",
  ],
  featureGroups: [
    {
      title: "How it works",
      items: [
        "Join the XenCheats Discord",
        "Open a private ticket with your request",
        "Review the scope, timing, and final quote",
      ],
    },
  ],
  generalInfo: [
    "Pricing depends on the game, target, account status, requested scope, and deadline.",
    "No payment is taken until staff confirms the request and quote.",
  ],
  requirements: ["A Discord account", "Game and current progress", "Target and preferred deadline"],
  variants: [],
};
/* Promo codes live only on the server (Render env var PROMO_CODES) so they
   are never committed to the public repo. The client only knows whether
   promos are enabled; individual codes are validated via POST /api/promo/validate. */
let promoEnabled = false;
const productArtwork = {
  // Toolkit artwork matched to the product context.
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
  // New per-product tablet images (2026-08-02 batch) — keyed by the real,
  // current catalog slugs from data/products.js.
  "cs2-arcane": productCs2ArcaneImage,
  "cs2-predator": productCs2PredatorImage,
  "cs2-skinchanger": productCs2SkinchangerImage,
  "cs2-strikeforce": productCs2StrikeforceImage,
  "fortnite-ancient": productFortniteAncientImage,
  "fortnite-arcane": productFortniteArcaneImage,
  "fortnite-dullwave": productFortniteDullwaveImage,
  "r6s-ancient": productR6sAncientImage,
  "r6s-chams": productR6sChamsImage,
  "r6s-crusader": productR6sCrusaderImage,
  "r6s-no-recoil": productR6sNoRecoilImage,
  "r6s-vega": productR6sVegaImage,
  "rust-dullwave": productRustDullwaveImage,
  "rust-mason-full": productRustMasonFullImage,
  "rust-mason-lite": productRustMasonLiteImage,
  // New per-product tablet images (2026-08-02 batch 2)
  "battlefield-fecurity": productBattlefieldFecurityImage,
  "cod-dullwave": productCodDullwaveImage,
  "cod-lunar": productCodLunarImage,
  "eft-mason": productEftMasonImage,
  "eft-sky": productEftSkyImage,
  "eft-sugar": productEftSugarImage,
  "eac-be-spoofer": productEacBeSpooferImage,
  "battlefield6-ancient": productBattlefield6AncientImage,
  "eft-chams": productEftChamsImage,
  "eft-crusader": productEftCrusaderImage,
  "eft-superior": productEftSuperiorImage,
  "r6s-nfa-account": productR6sNfaAccountImage,
  "spoofer-lunar": productSpooferLunarImage,
  "spoofer-shadow": productSpooferShadowImage,
  "r6s-lethal": productR6sLethalImage,
  // New per-product tablet images (2026-08-02 batch 3)
  "rust-mrpro": productRustMrProImage,
  "apex-mason": productApexMasonImage,
  "apex-ancient": productApexAncientImage,
  "apex-dullwave": productApexDullwaveImage,
  "apex-arcane": productApexArcaneImage,
  "pubg-arcane": productPubgArcaneImage,
  "pubg-shadow": productPubgShadowImage,
  "delta-force-dullwave": productDeltaForceDullwaveImage,
  "delta-force-ancient": productDeltaForceAncientImage,
  "delta-force-luna-chams": productDeltaForceLunaChamsImage,
  "marvel-rivals-dullwave": productMarvelRivalsDullwaveImage,
  "marvel-rivals-predator": productMarvelRivalsPredatorImage,
  "marvel-rivals-shadow": productMarvelRivalsShadowImage,
  // DMA hardware references supplied for the physical-product listings.
  "r6-aptitude": r6sAptitudeToolkitImage,
  "exodus-lite": r6sExodusLiteToolkitImage,
  "r6s-exodus": r6sExodusToolkitImage,
  "unlock-all": r6sUnlockAllToolkitImage,
  "makcu": dmaMakcuToolkitImage,
  "fuser": dmaFuserToolkitImage,
  "dma-firmware": dmaFirmwareToolkitImage,
  "dma-card": dmaCardToolkitImage,
  // No separate bundle artwork was supplied; the DMA Card image is the closest representative.
  "dma-bundle": dmaCardToolkitImage,
};

/* Account nav button is rendered icon-only by initWallet(); no text set here. */

if (!authConfigured) {
  renderMessage(
    notice,
    "Account login is still being configured, so checkout is not available yet.",
    "warn"
  );
}

async function loadProducts({ withFocusedStock = false } = {}) {
  const focusedProductSlug = dedicatedProductSlug
    || new URLSearchParams(window.location.search).get("product");
  const endpoint = withFocusedStock && focusedProductSlug
    ? `/api/products?stockFor=${encodeURIComponent(focusedProductSlug)}`
    : "/api/products";
  const response = await fetch(endpoint, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Unable to load products.");
  }

  const data = await response.json();
  promoEnabled = data.promoEnabled === true;
  return (Array.isArray(data.products) ? data.products : [])
    .filter((product) => product?.slug !== "boosting-services" && product?.serviceOnly !== true);
}

function refreshOpenProductAvailability() {
  if (!activeProduct) return;

  const selectedVariantSlug = activeVariant?.slug;
  const refreshedProduct = catalogProducts.find((product) => product.slug === activeProduct.slug);
  const modal = document.querySelector("[data-variant-modal]");
  if (!refreshedProduct || !modal || modal.hidden) return;

  activeProduct = refreshedProduct;
  modal.querySelector("[data-variant-status]").textContent = refreshedProduct.badge || "";
  setVariantStatusTone(modal, refreshedProduct.badge);

  modal.querySelectorAll("[data-variant-option]").forEach((option) => {
    const variant = refreshedProduct.variants?.find(
      (item) => item.slug === option.dataset.variantSlug
    );
    const canSelect = Boolean(
      variant?.checkoutReady || variant?.checkoutBlocked || refreshedProduct.testOnly
    );
    option.disabled = !canSelect;
    const stockText = option.querySelector("small");
    if (stockText) stockText.textContent = variant.stockLabel || (canSelect ? "In Stock" : "Out of Stock");
  });

  const selectedVariant =
    refreshedProduct.variants?.find((variant) => variant.slug === selectedVariantSlug) ||
    refreshedProduct.variants?.find((variant) => variant.checkoutReady || variant.checkoutBlocked) ||
    refreshedProduct.variants?.[0];
  selectVariant(selectedVariant?.slug);
}

async function refreshCatalogAvailability() {
  if (catalogRefreshRunning) return;
  catalogRefreshRunning = true;

  try {
    catalogProducts = (await loadProducts({ withFocusedStock: true })).filter(isAllowedProduct);
    updateStats(catalogProducts);
    if (!dedicatedProductSlug) renderCatalogView();
    refreshOpenProductAvailability();
  } catch (error) {
    console.warn("[Product stock refresh]", error.message);
  } finally {
    catalogRefreshRunning = false;
  }
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

function starsHtml(count) {
  const parsed = Number.parseInt(count, 10);
  const n = Number.isFinite(parsed) ? Math.max(0, Math.min(5, parsed)) : 5;
  return "&#9733;".repeat(n) + "&#9734;".repeat(5 - n);
}

function formatReviewDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return "";
  }
}

let allReviewsPromise = null;
function loadAllReviews() {
  if (!allReviewsPromise) {
    allReviewsPromise = fetch("/api/reviews")
      .then((res) => res.json())
      .then((data) => data.reviews || [])
      .catch(() => []);
  }
  return allReviewsPromise;
}

async function renderProductReviews(product) {
  const modal = document.querySelector("[data-variant-modal]");
  const listEl = modal?.querySelector("[data-reviews-list]");
  const countEl = modal?.querySelector("[data-reviews-count]");
  const ratingEl = modal?.querySelector("[data-variant-rating]");

  if (!listEl) return;

  listEl.innerHTML = '<div class="member-empty">Loading reviews...</div>';
  if (ratingEl) ratingEl.hidden = true;

  const all = await loadAllReviews();

  /* Product switched while the fetch was in flight — don't paint stale reviews. */
  if (activeProduct !== product) return;

  const mine = all.filter((review) => review.product_name === product.name);

  if (!mine.length) {
    listEl.innerHTML =
      '<div class="member-empty">No reviews yet for this product. <a href="/reviews/">Leave one</a> after your purchase.</div>';
    if (countEl) countEl.textContent = "";
    return;
  }

  const avg = mine.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / mine.length;

  if (countEl) {
    countEl.textContent = `(${mine.length} ${mine.length === 1 ? "review" : "reviews"})`;
  }

  if (ratingEl) {
    ratingEl.hidden = false;
    ratingEl.innerHTML = `${starsHtml(Math.round(avg))} <b>${avg.toFixed(1)}</b>`;
  }

  const cards = mine
    .slice(0, 6)
    .map((review) => {
      const isDiscord = review.source === "discord";
      const avatarHtml = review.avatar
        ? `<img class="review-avatar-img" src="${escapeHtml(review.avatar)}" alt="" />`
        : `<span class="review-avatar">${escapeHtml((review.username || "?")[0].toUpperCase())}</span>`;
      const verifiedLabel = isDiscord ? "&#10003; Discord Review" : "&#10003; Verified Purchase";

      return `
        <div class="review-card">
          <div class="review-header">
            <div class="review-user">
              ${avatarHtml}
              <div class="review-user-info">
                <span class="review-username">${escapeHtml(review.username || "Anonymous")}</span>
                <span class="review-verified">${verifiedLabel}</span>
              </div>
            </div>
            <span class="review-stars">${starsHtml(review.rating)}</span>
          </div>
          <p class="review-body">${escapeHtml(review.review_text)}</p>
          <div class="review-footer">
            <span class="review-date">${formatReviewDate(review.created_at)}</span>
          </div>
        </div>`;
    })
    .join("");

  const moreLink =
    mine.length > 6
      ? `<a class="variant-reviews-more" href="/reviews/">See all ${mine.length} reviews &rarr;</a>`
      : "";

  listEl.innerHTML = cards + moreLink;
}

function renderRelatedProducts(product) {
  const modal = document.querySelector("[data-variant-modal]");
  const section = modal?.querySelector("[data-related-section]");
  const list = modal?.querySelector("[data-related-list]");
  const heading = modal?.querySelector("[data-related-heading]");

  if (!section || !list) return;

  const category = product.category || product.game || "";
  const related = catalogProducts
    .filter((item) => item.slug !== product.slug && (item.category || item.game) === category)
    .slice(0, 3);

  if (!related.length) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  if (heading) heading.textContent = `More ${category}`;

  list.innerHTML = related
    .map(
      (item) => `
        <a class="variant-related-card" href="/products/${encodeURIComponent(item.slug)}/">
          <span class="variant-related-thumb">
            <img src="${productImageSrc(item)}" alt="" loading="lazy" />
            ${item.badge ? `<span class="product-status-badge ${badgeTone(item.badge)}">${escapeHtml(item.badge)}</span>` : ""}
          </span>
          <span class="variant-related-name">${escapeHtml(item.name)}</span>
          <span class="variant-related-price">${escapeHtml(item.priceDisplay || "")}</span>
        </a>`
    )
    .join("");
}

function getBundleProducts() {
  const bundleTargets = [
    { slug: "r6s-nfa-account", names: ["nfa ranked ready prelinked", "linked nfa"] },
    { slug: "r6s-crusader", names: ["crusader r6s", "crusader r6s\u2122", "crusader r6s siege"] },
  ];

  return bundleTargets
    .map(({ slug, names }) => catalogProducts.find((item) => {
      const productSlug = String(item.slug || "").toLowerCase();
      const productName = String(item.name || "").toLowerCase();
      return productSlug === slug || names.some((name) => productName === name || productName.includes(name));
    }))
    .filter(Boolean)
    .map((product) => ({
      product,
      variant: (product.variants || []).find((variant) => variant.checkoutReady),
    }));
}

function discountedBundleCents(cents) {
  return Math.max(0, Math.round(Number(cents || 0) * (1 - setupBundleDiscountPercent / 100)));
}

function renderBundleOffer() {
  const modal = document.querySelector("[data-variant-modal]");
  const section = modal?.querySelector("[data-bundle-section]");
  const itemsEl = modal?.querySelector("[data-bundle-items]");
  const totalEl = modal?.querySelector("[data-bundle-total]");
  const button = modal?.querySelector("[data-bundle-add]");
  const message = modal?.querySelector("[data-bundle-message]");

  if (!section || !itemsEl || !button) return;

  const bundle = getBundleProducts();
  const isEligibleProduct = bundle.some(
    ({ product }) => product.slug === activeProduct?.slug
  );

  if (bundle.length !== 2 || !isEligibleProduct) {
    section.hidden = true;
    return;
  }

  const readyBundle = bundle.filter(({ variant }) => variant);
  const totalCents = readyBundle.reduce((total, { variant }) => {
    const price = parseMoney(variant.priceDisplay);
    return total + (price ? Math.round(price * 100) : 0);
  }, 0);

  section.hidden = false;
  button.disabled = readyBundle.length !== bundle.length;
  button.textContent = readyBundle.length === bundle.length ? "Add bundle to cart" : "Bundle temporarily unavailable";
  if (totalEl) totalEl.textContent = totalCents
    ? `From ${formatMoney(discountedBundleCents(totalCents) / 100)} (5% off)`
    : "Check availability";
  if (message) {
    message.hidden = readyBundle.length === bundle.length;
    message.textContent = "One item is currently unavailable.";
  }

  itemsEl.innerHTML = bundle.map(({ product, variant }) => {
    const price = variant?.priceDisplay || "Unavailable";
    return `
      <span class="variant-bundle-item${variant ? "" : " is-unavailable"}">
        <span class="variant-bundle-thumb">
          <img src="${escapeHtml(productImageSrc(product))}" alt="" loading="lazy" />
        </span>
        <span class="variant-bundle-copy">
          <strong>${escapeHtml(product.name)}</strong>
          <small>${escapeHtml(variant?.name || "Currently unavailable")}</small>
        </span>
        <em>${escapeHtml(price)}</em>
      </span>`;
  }).join("");
}

function addBundleToCart(button) {
  const bundle = getBundleProducts();

  if (bundle.length !== 2 || bundle.some(({ variant }) => !variant) || !window.haloCart?.add) return;

  bundle.forEach(({ product, variant }) => {
    const dollars = parseMoney(variant.priceDisplay);
    window.haloCart.add({
      productSlug: product.slug,
      variantSlug: variant.slug,
      productName: product.name,
      variantName: variant.name,
      imageSrc: productImageSrc(product),
      priceCents: dollars ? discountedBundleCents(Math.round(dollars * 100)) : 0,
      qty: 1,
      maxQuantity: variant.quantityLimit || product.quantityLimit || null,
    });
  });

  const original = button.textContent;
  button.textContent = "Bundle added";
  button.disabled = true;
  window.setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
  }, 1400);
}

function addCatalogSetupToCart(button) {
  const selectedBundle = getBundleProducts();

  if (!selectedBundle.length || selectedBundle.some(({ variant }) => !variant) || !window.haloCart?.add) return;

  selectedBundle.forEach(({ product, variant }) => {
    const dollars = parseMoney(variant.priceDisplay);
    window.haloCart.add({
      productSlug: product.slug,
      variantSlug: variant.slug,
      productName: product.name,
      variantName: variant.name,
      imageSrc: productImageSrc(product),
      priceCents: dollars ? discountedBundleCents(Math.round(dollars * 100)) : 0,
      qty: 1,
      maxQuantity: variant.quantityLimit || product.quantityLimit || null,
    });
  });

  const original = button.textContent;
  button.textContent = "Setup added";
  button.disabled = true;
  window.setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
  }, 1400);
}

function renderCatalogBundle() {
  if (!catalogBundle) return;

  const bundle = getBundleProducts();
  if (bundle.length !== 2) {
    catalogBundle.hidden = true;
    return;
  }

  const selectedBundle = bundle;
  const ready = selectedBundle.length > 0 && selectedBundle.every(({ variant }) => variant);
  const total = selectedBundle.reduce((sum, { variant }) => {
    const price = parseMoney(variant?.priceDisplay);
    return sum + (price ? Math.round(price * 100) : 0);
  }, 0);

  catalogBundle.hidden = false;
  catalogBundle.innerHTML = `
    <div class="catalog-bundle-copy">
      <span class="catalog-bundle-kicker">Most bought in a bundle</span>
      <h2>Crusader R6S + NFA Ranked Ready</h2>
      <p>Pair a Crusader R6S key with one NFA Ranked Ready account and add the complete setup to your cart.</p>
    </div>
    <div class="catalog-bundle-products">
      ${selectedBundle.map(({ product, variant }) => `
        <div class="catalog-bundle-product">
          <a class="catalog-bundle-product-link" href="/products/${encodeURIComponent(product.slug)}/">
            <span class="catalog-bundle-image"><img src="${escapeHtml(productImageSrc(product))}" alt="" loading="lazy" /></span>
            <span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(variant?.priceDisplay || "Unavailable")}</small></span>
          </a>
        </div>`).join('<span class="catalog-bundle-plus" aria-hidden="true">+</span>')}
    </div>
    <button class="button button-primary catalog-bundle-action" type="button" data-catalog-bundle-add ${ready ? "" : "disabled"}>
      ${ready ? `Add bundle${total ? ` · ${formatMoney(discountedBundleCents(total) / 100)} (5% off)` : ""}` : "Setup unavailable"}
    </button>`;
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

const preferredCategoryOrder = [
  "Rainbow Six Siege",
  "Fortnite",
  "Rust",
  "Counter-Strike 2",
  "Apex Legends",
  "Accounts",
  "Spoofer",
  "Call of Duty",
  "Escape from Tarkov",
  "Valorant",
  "Minecraft",
  "GTA V",
  "Rocket League",
];

function orderCategoryEntries(groups) {
  const entries = [...groups.entries()];
  const order = new Map(preferredCategoryOrder.map((category, index) => [category, index]));

  return entries
    .map((entry, originalIndex) => ({
      entry,
      originalIndex,
      rank: order.has(entry[0]) ? order.get(entry[0]) : preferredCategoryOrder.length,
    }))
    .sort((left, right) => left.rank - right.rank || left.originalIndex - right.originalIndex)
    .map(({ entry }) => entry);
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

  return !product?.serviceOnly
    && product?.slug !== "boosting-services"
    && !/boosting\s+services/i.test(searchable)
    && !excludedCatalogTerms.some((term) => searchable.includes(term));
}

function getStartingPrice(product) {
  const match = product.priceDisplay.match(/\$([0-9]+(?:\.[0-9]{2})?)/);
  return match ? Number(match[1]) : Infinity;
}

function getTotalStock(product) {
  return (product.variants || []).reduce((total, variant) => {
    const numericCount = Number(variant.stockCount);
    if (Number.isInteger(numericCount) && numericCount >= 0) {
      return total + numericCount;
    }

    const match = String(variant.stockLabel || "").match(/^(\d+)/);
    return total + (match ? Number(match[1]) : 0);
  }, 0);
}

function stockBadgeHtml(product) {
  if (!Array.isArray(product.variants) || product.variants.length === 0) return "";

  const stockAwareVariants = (product.variants || []).filter(
    (variant) => variant.checkoutReady || Number(variant.stockCount) > 0 || product.testOnly
  );
  const count = getTotalStock({ variants: stockAwareVariants });
  /* A product is only advertised as available when checkout can fulfill at
     least one variant. Testing previews are the exception: they intentionally
     expose verified supplier stock while checkout remains disabled. */
  const resellerBacked = stockAwareVariants.some(
    (variant) => variant.stockLabel === "In Stock"
  );
  if (count > 0) {
    return `<span class="card-stock in-stock">${count} ${count === 1 ? "Key" : "Keys"} Available</span>`;
  }
  if (resellerBacked) {
    return `<span class="card-stock in-stock">In Stock</span>`;
  }
  return `<span class="card-stock out-of-stock">Out of Stock</span>`;
}

function hasResellerStock(product) {
  return (product.variants || []).some(
    (variant) => variant.checkoutReady && variant.stockLabel === "In Stock"
  );
}

function isStockedProduct(product) {
  const purchasableVariants = (product.variants || []).filter((variant) => variant.checkoutReady);
  return getTotalStock({ variants: purchasableVariants }) > 0 || hasResellerStock(product);
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

  const categories = ["all", ...orderCategoryEntries(groups).map(([category]) => category)];
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
  if (/minecraft/i.test(category)) return minecraftCategoryImage;
  if (/rocket league/i.test(category)) return rocketLeagueCategoryImage;
  if (/valorant/i.test(category)) return valorantCategoryImage;
  if (/gta v/i.test(category)) return gtaVCategoryImage;
  if (/arc raiders/i.test(category)) return arcRaidersCategoryImage;
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

  if (/battlefield/i.test(category)) {
    return battlefieldCategoryImage;
  }

  if (/call of duty/i.test(category)) {
    return codCategoryImage;
  }

  if (/counter-strike|cs2/i.test(category)) {
    return cs2CategoryImage;
  }

  if (/delta force/i.test(category)) {
    return deltaForceCategoryImage;
  }

  if (/fragpunk/i.test(category)) {
    return fragpunkCategoryImage;
  }

  if (/marvel rivals/i.test(category)) {
    return marvelRivalsCategoryImage;
  }

  if (/overwatch/i.test(category)) {
    return overwatchCategoryImage;
  }

  if (/pubg/i.test(category)) {
    return pubgCategoryImage;
  }

  if (/dma/i.test(category)) {
    return dmaCategoryImage;
  }

  const categoryProduct = catalogProducts.find(
    (product) => (product.category || product.game) === category && product.artwork
  );
  if (categoryProduct?.artwork) {
    return categoryProduct.artwork;
  }

  return haloLogoImage;
}

function productImageSrc(product) {
  return productArtwork[product.slug] || product.artwork || categoryImageSrc(product.category || product.game || "");
}

function isBoostingService(product) {
  return product?.serviceOnly === true || product?.slug === boostingServiceListing.slug;
}

function boostingPlaceholderMarkup(className = "") {
  return `
    <div class="catalog-service-placeholder ${className}" aria-hidden="true">
      <span class="catalog-service-placeholder-kicker">XENCHEATS SERVICE</span>
      <strong>BOOSTING<br />SERVICES</strong>
      <small>Private quote via Discord</small>
    </div>`;
}

function renderCategoryCard(category, categoryProducts = []) {
  const card = document.createElement("article");
  const imageSrc = categoryImageSrc(category);
  const productCount = categoryProducts.length;
  card.className = "catalog-category-card";
  card.dataset.categoryCard = category;
  /* The card is activated by a delegated click handler on the grid, so
     without these it is mouse-only: not reachable by Tab, no accessible
     name (the <img alt> alone doesn't name the control), and the existing
     :focus-visible / :focus-within CSS could never fire. */
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `View ${category} products`);
  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    card.click();
  });
  const isServiceCategory = /boosting services/i.test(category);
  card.innerHTML = `
    <div class="category-card-art">
      ${isServiceCategory ? boostingPlaceholderMarkup("category-service-placeholder") : `<img src="${imageSrc}" alt="" loading="lazy" />`}
      <span class="category-card-view-overlay" aria-hidden="true"><span>Explore</span></span>
    </div>
    <div class="category-card-body">
      <div class="category-card-counts">
        <span class="category-card-count">${productCount} product${productCount === 1 ? "" : "s"}</span>
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
    ...orderCategoryEntries(groups).map(([category, categoryProducts]) =>
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

function badgeTone(badge) {
  const value = String(badge || "").toLowerCase();
  if (value.includes("undetected")) return "tone-green";
  if (value.includes("updating")) return "tone-amber";
  if (value.includes("coming soon")) return "tone-muted";
  return "tone-blue";
}

function setVariantStatusTone(modal, badge) {
  const row = modal?.querySelector(".variant-status-row");
  if (!row) return;
  row.classList.toggle("is-updating", String(badge || "").toLowerCase().includes("updating"));
}

function renderProductCard(product, index) {
  const item = document.createElement("article");
  item.className = `product-card product-card-page catalog-product${
    product.featured ? " featured" : ""
  }`;
  item.dataset.delay = String(30 + (index % 4) * 35);
  const thumbnail = isBoostingService(product)
    ? boostingPlaceholderMarkup("product-service-placeholder")
    : `<img
        class="product-thumbnail-image"
        src="${productImageSrc(product)}"
        alt=""
        loading="lazy"
      />`;
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const readyVariants = variants.filter((variant) => variant.checkoutReady).length;
  const serviceListing = isBoostingService(product);
  const variantLabel = serviceListing
    ? "Custom service"
    : `${variants.length} option${variants.length === 1 ? "" : "s"}`;
  const availabilityLabel = serviceListing
    ? "Private quote"
    : readyVariants
      ? `${readyVariants} ready now`
      : isComingSoonProduct(product)
        ? "Coming soon"
        : "Temporarily unavailable";
  item.innerHTML = `
    <a
      class="product-thumbnail-button"
      href="/products/${encodeURIComponent(product.slug)}/"
      aria-label="View ${escapeHtml(product.name)}"
    >
      ${thumbnail}
      ${product.badge ? `<span class="product-status-badge ${badgeTone(product.badge)}">${escapeHtml(product.badge)}</span>` : ""}
      <span class="product-thumbnail-overlay" aria-hidden="true">
        <span>View</span>
      </span>
    </a>
    <div class="product-card-info">
      <div class="product-card-heading">
        <span class="product-card-kicker">${escapeHtml(product.category || product.game || "Catalog")}</span>
        <h4 class="product-card-name">${escapeHtml(product.name)}</h4>
      </div>
      <p class="product-card-summary">${escapeHtml(product.summary || "Open the product to view features, requirements, and available options.")}</p>
      <div class="product-card-availability">
        <span>${escapeHtml(variantLabel)}</span>
        <span class="${readyVariants || serviceListing ? "is-ready" : "is-unavailable"}"><i aria-hidden="true"></i>${escapeHtml(availabilityLabel)}</span>
      </div>
      ${stockBadgeHtml(product)}
      <div class="product-card-meta">
        <span class="product-card-price">${escapeHtml(product.priceDisplay || "")}</span>
        <span class="product-card-cta">View details&nbsp;&rarr;</span>
      </div>
    </div>
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
      <div class="variant-art" data-variant-art>
        <img class="variant-product-image" data-variant-product-image alt="" />
        <img class="product-image-blur product-image-blur-top" data-variant-product-blur alt="" aria-hidden="true" />
        <img class="product-image-blur product-image-blur-bottom" data-variant-product-blur alt="" aria-hidden="true" />
        <div class="variant-art-brand" aria-hidden="true"><span>XenCheats</span></div>
        <span class="product-status-badge variant-art-status" data-variant-art-badge></span>
        <div class="variant-art-caption" data-variant-art-caption aria-hidden="true"></div>
        <div class="variant-art-gallery" data-variant-art-gallery aria-hidden="true">
          <span class="variant-art-gallery-thumb is-active">
            <img data-variant-gallery-thumb alt="" />
          </span>
        </div>
      </div>
      <div class="variant-details">
        <section class="variant-bundle" data-bundle-section hidden>
          <div class="variant-bundle-heading">
            <div>
              <span class="variant-bundle-kicker">Most bought in a bundle</span>
              <h4>Crusader R6S + NFA Ranked Ready</h4>
            </div>
            <span class="variant-bundle-total" data-bundle-total></span>
          </div>
          <div class="variant-bundle-items" data-bundle-items></div>
          <button class="button button-primary variant-bundle-button" type="button" data-bundle-add>
            Add bundle to cart
          </button>
          <p class="variant-bundle-message" data-bundle-message hidden></p>
        </section>
        <p class="eyebrow">Product view</p>
        <div class="variant-product-kicker">
          <span data-variant-category></span>
          <span>Verified listing</span>
        </div>
        <h3 id="variant-title" data-variant-title></h3>
        <div class="variant-rating" data-variant-rating hidden></div>
        <div class="variant-status-row">
          <span class="variant-dot"></span>
          <strong data-variant-status></strong>
          <span data-variant-price></span>
          <em data-variant-stock>In Stock</em>
        </div>
        <p data-variant-summary></p>
          <label class="variant-label">Select option</label>
          <div class="variant-options" data-variant-options></div>
          <label class="variant-label variant-quantity-label" data-variant-quantity-wrap hidden>
            Quantity
            <input class="variant-quantity-input" data-variant-quantity type="number" min="1" max="5" value="1" inputmode="numeric" />
          </label>
        <form class="variant-promo-form" data-promo-form ${promoEnabled ? "" : "hidden"}>
          <label>
            <span>Promo code</span>
            <input type="text" name="promoCode" placeholder="Enter promo code" autocomplete="off" />
          </label>
          <button class="button button-secondary" type="submit">Apply</button>
        </form>
        <p class="variant-promo-message" data-promo-message hidden></p>
        <div class="checkout-breakdown" data-checkout-breakdown>
          <div class="checkout-breakdown-row">
            <span>Subtotal</span>
            <strong data-checkout-subtotal>$0.00</strong>
          </div>
          <div class="checkout-breakdown-row">
            <span>Stripe processing fee</span>
            <strong data-checkout-fee>$0.00</strong>
          </div>
          <div class="checkout-breakdown-row checkout-breakdown-total">
            <span>Total with card</span>
            <strong data-checkout-total>$0.00</strong>
          </div>
        </div>
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
          <button class="button button-secondary" type="button" data-variant-cart>Add to Cart</button>
          <a class="button button-primary variant-discord-button" data-variant-discord href="https://discord.gg/xencheats" target="_blank" rel="noopener noreferrer" hidden>Join Discord for help</a>
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
        <section class="variant-media-section" id="product-media" data-detail-media-section hidden>
          <h4>Media</h4>
          <div class="variant-media-grid" data-detail-media></div>
        </section>
        <section class="variant-reviews-section" id="product-reviews">
          <h4>Customer Reviews <span class="variant-reviews-count" data-reviews-count></span></h4>
          <div class="variant-reviews-list" data-reviews-list></div>
        </section>
        <section class="variant-related-section" id="product-related" data-related-section hidden>
          <h4><span data-related-heading>You might also like</span></h4>
          <div class="variant-related-list" data-related-list></div>
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
    if (event.target.matches("[data-variant-quantity]")) {
      event.target.value = String(activeVariantQuantity());
      updateVariantPricing();
    }
  });

  modal.addEventListener("click", async (event) => {
    const closeButton = event.target.closest("[data-variant-close]");
    const option = event.target.closest("[data-variant-option]");
    const checkoutButton = event.target.closest("[data-variant-checkout]");
    const balanceButton = event.target.closest("[data-variant-balance]");
    const cartButton = event.target.closest("[data-variant-cart]");
    const notifyButton = event.target.closest("[data-variant-notify]");
    const bundleButton = event.target.closest("[data-bundle-add]");

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

    if (notifyButton) {
      await requestRestockNotify(notifyButton);
    }

    if (bundleButton) {
      addBundleToCart(bundleButton);
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

function renderProductMedia(product) {
  const isHttpUrl = (value) => {
    try {
      return /^https?:$/.test(new URL(String(value)).protocol);
    } catch {
      return false;
    }
  };
  const images = (Array.isArray(product.media) ? product.media : [])
    .filter(isHttpUrl)
    .map((src, index) => `
      <figure class="variant-media-item">
        <img src="${escapeHtml(src)}" alt="${escapeHtml(product.name)} media ${index + 1}" loading="lazy" referrerpolicy="no-referrer" />
      </figure>
    `);
  const videos = (Array.isArray(product.videos) ? product.videos : [])
    .filter(isHttpUrl)
    .map((src, index) => `
      <figure class="variant-media-item">
        <iframe src="${escapeHtml(src)}" title="${escapeHtml(product.name)} video ${index + 1}" loading="lazy" allow="fullscreen" allowfullscreen></iframe>
      </figure>
    `);
  return [...images, ...videos].join("");
}

function renderInfoList(items, instructionHref = "", externalHref = "", downloadHref = "") {
  const safeItems = items?.length ? items : ["Open a support ticket if you need setup guidance."];
  const info = safeItems.map((item) => `<div>${escapeHtml(item)}</div>`).join("");

  if (!instructionHref && !externalHref && !downloadHref) {
    return info;
  }

  const instructionLink = instructionHref
    ? `<a class="variant-info-link" href="${escapeHtml(instructionHref)}">View on-site instructions</a>`
    : "";
  const externalLink = externalHref
    ? `<a class="variant-info-link" href="${escapeHtml(externalHref)}" target="_blank" rel="noopener noreferrer">Open documentation</a>`
    : "";
  const downloadLink = downloadHref
    ? `<a class="variant-info-link" href="${escapeHtml(downloadHref)}" target="_blank" rel="noopener noreferrer">Open download</a>`
    : "";
  return `${info}${instructionLink}${externalLink}${downloadLink}`;
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

/* Draws attention to the "I understand..." checkbox when someone tries to
   check out without accepting it — the page-level notice banner can be easy
   to miss while a modal is open, so this makes it impossible to miss. */
function flagTermsCheckbox() {
  const label = document.querySelector("[data-terms-check]")?.closest(".variant-terms");
  if (!label) return;
  label.scrollIntoView({ behavior: "smooth", block: "center" });
  label.classList.remove("terms-needs-attention");
  // Force reflow so the animation restarts if it's already flagged.
  void label.offsetWidth;
  label.classList.add("terms-needs-attention");
  window.setTimeout(() => label.classList.remove("terms-needs-attention"), 1600);
}

function updateVariantPricing() {
  const modal = ensureVariantModal();
  const priceTarget = modal.querySelector("[data-variant-price]");
  const subtotalTarget = modal.querySelector("[data-checkout-subtotal]");
  const feeTarget = modal.querySelector("[data-checkout-fee]");
  const totalTarget = modal.querySelector("[data-checkout-total]");

  const baseCents = activeVariantPriceCents();
  const discountPercent = Number(activePromo?.discountPercent) || 0;
  const subtotalCents = Math.max(0, Math.round(baseCents * (1 - discountPercent / 100)));
  // Gross up so the displayed Stripe fee covers the processor fee on the total.
  const quantity = activeVariantQuantity();
  const feeIncluded = Boolean(activeProduct?.stripeFeeIncluded || activeVariant?.stripeFeeIncluded);
  const feeCents = !feeIncluded && subtotalCents > 0
    ? Math.max(0, Math.ceil((subtotalCents * 0.029 + 30) / 0.971))
    : 0;

  if (priceTarget) {
    priceTarget.innerHTML = getVariantDisplayPrice(activeVariant);
  }
  if (subtotalTarget) subtotalTarget.textContent = formatMoney((subtotalCents * quantity) / 100);
  if (feeTarget) feeTarget.textContent = feeIncluded ? "Included" : formatMoney(feeCents / 100);
  if (totalTarget) totalTarget.textContent = formatMoney(((subtotalCents * quantity) + feeCents) / 100);
}

function activeVariantQuantity() {
  const limit = Number(activeVariant?.quantityLimit || activeProduct?.quantityLimit || 1);
  const input = document.querySelector("[data-variant-quantity]");
  const value = Math.max(1, Number.parseInt(input?.value || "1", 10) || 1);
  return Math.min(value, Number.isInteger(limit) && limit > 0 ? limit : 1);
}

function updateCheckoutButtonState() {
  const modal = ensureVariantModal();
  const checkoutButton = modal.querySelector("[data-variant-checkout]");
  const balanceButton = modal.querySelector("[data-variant-balance]");
  const cartButton = modal.querySelector("[data-variant-cart]");
  const discordButton = modal.querySelector("[data-variant-discord]");
  const notifyButton = modal.querySelector("[data-variant-notify]");
  const canAttempt = Boolean(activeVariant?.checkoutReady);
  const unavailable = Boolean(activeVariant) && !canAttempt;
  const testingListing = Boolean(activeProduct?.testOnly);

  /* Note: buttons stay clickable even when the terms checkbox isn't checked
     yet — disabling them here would swallow the click entirely, so the user
     would never see the "please check the box" notice. The checkout
     functions themselves check termsAccepted() and flag the checkbox. */
  checkoutButton.hidden = unavailable;
  checkoutButton.disabled = !canAttempt;
  checkoutButton.textContent = canAttempt ? "Pay with Card" : "Unavailable";
  if (balanceButton) {
    balanceButton.hidden = unavailable;
    balanceButton.disabled = !canAttempt;
    balanceButton.textContent = canAttempt ? "Pay with Balance" : "Unavailable";
  }
  if (cartButton) {
    /* Adding to cart doesn't require terms acceptance; only needs a valid, ready variant. */
    cartButton.hidden = unavailable;
    cartButton.disabled = !activeVariant?.checkoutReady;
  }
  if (discordButton) {
    discordButton.hidden = testingListing || !unavailable;
    discordButton.href = activeVariant?.discordUrl || "https://discord.gg/xencheats";
  }
  if (notifyButton) {
    /* Unavailable and delayed variants are handled through Discord instead of
       collecting restock requests the fulfillment service cannot complete yet. */
    notifyButton.hidden = true;
    notifyButton.disabled = true;
  }
  const message = modal.querySelector("[data-notify-message]");
  if (message) {
    message.hidden = !unavailable;
    message.textContent = activeVariant?.stockLabel === "Out of Stock"
      ? "This variant is out of stock. Join Discord for availability updates."
      : "This variant is temporarily unavailable. Join Discord and we'll help.";
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

function renderBoostingServicePage(product, { dedicated = false } = {}) {
  const host = dedicatedProductHost || document.body;
  const details = [
    ["Quote first", "Your request is reviewed before a price is confirmed."],
    ["Private ticket", "Keep the game, goal, timing, and account details in one staff-only Discord ticket."],
    ["Clear scope", "Staff will confirm what is included, the expected timeline, and the final total."],
  ];

  host.innerHTML = `
    <section class="boosting-service-detail reveal is-visible" aria-labelledby="boosting-service-title">
      <div class="boosting-service-media">
        ${boostingPlaceholderMarkup("boosting-service-art")}
      </div>
      <div class="boosting-service-copy">
        <p class="eyebrow">Service request</p>
        <div class="variant-product-kicker"><span>Boosting Services</span><span>Quote only</span></div>
        <h1 id="boosting-service-title">Boosting Services</h1>
        <div class="boosting-service-price">To be Calculated</div>
        <p>${escapeHtml(product.summary)}</p>
        <div class="boosting-service-actions">
          <a class="button button-primary" href="https://discord.gg/xencheats" target="_blank" rel="noopener">Join Discord &amp; Open a Ticket</a>
          <a class="button button-secondary" href="/products/">Back to products</a>
        </div>
        <p class="boosting-service-note">A quote is confirmed in your ticket before payment. There is no automatic checkout for this service.</p>
      </div>
    </section>
    <section class="boosting-service-details" aria-label="Boosting service details">
      <div class="catalog-group-heading"><div><p class="eyebrow">Simple process</p><h2>Tell us what you need.</h2></div></div>
      <div class="boosting-service-detail-grid">
        ${details.map(([title, text]) => `<article><span>0${details.findIndex(([itemTitle]) => itemTitle === title) + 1}</span><h3>${title}</h3><p>${text}</p></article>`).join("")}
      </div>
      <div class="boosting-service-info">
        <h3>Before opening your ticket</h3>
        <ul>${product.requirements.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
    </section>
  `;

  if (dedicated) {
    const breadcrumb = document.querySelector("[data-product-breadcrumb]");
    if (breadcrumb) breadcrumb.textContent = product.name;
    document.title = `${product.name} | XenCheats`;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute("content", product.summary);
  }
}

function openVariantModal(product, { updateUrl = true } = {}) {
  if (!product) {
    renderMessage(notice, "That product could not be loaded. Refresh and try again.", "error");
    return;
  }

  activeProduct = product;
  logProductView(product.slug);

  if (isBoostingService(product)) {
    if (dedicatedProductSlug) {
      renderBoostingServicePage(product, { dedicated: true });
      return;
    }

    const serviceModal = document.createElement("div");
    serviceModal.className = "boosting-service-modal";
    serviceModal.innerHTML = `<div class="variant-backdrop" data-service-close></div><div class="boosting-service-modal-card">${boostingPlaceholderMarkup("boosting-service-art")}<div class="boosting-service-modal-copy"><button class="variant-close" type="button" data-service-close aria-label="Close service details">&times;</button><p class="eyebrow">Service request</p><h2>${escapeHtml(product.name)}</h2><strong>To be Calculated</strong><p>${escapeHtml(product.summary)}</p><a class="button button-primary" href="https://discord.gg/xencheats" target="_blank" rel="noopener">Join Discord &amp; Open a Ticket</a></div></div>`;
    document.body.append(serviceModal);
    document.body.classList.add("modal-open");
    serviceModal.addEventListener("click", (event) => {
      if (!event.target.closest("[data-service-close]")) return;
      serviceModal.remove();
      document.body.classList.remove("modal-open");
    });
    return;
  }

  activeVariant =
    product.variants?.find((variant) => variant.checkoutReady || variant.checkoutBlocked) ||
    product.variants?.[0] ||
    null;

  const modal = ensureVariantModal();
  resetVariantControls(modal);
  modal.querySelector("[data-variant-title]").textContent = product.name;
  modal.querySelector("[data-variant-category]").textContent = product.category || product.game || "Catalog";
  modal.querySelector("[data-variant-status]").textContent = product.badge;
  setVariantStatusTone(modal, product.badge);
  modal.querySelector("[data-variant-summary]").textContent = product.summary;
  modal.querySelector("[data-detail-about]").textContent = product.summary;
  modal.querySelector("[data-detail-features]").innerHTML = renderFeatureGroups(product);
  modal.querySelector("[data-detail-info]").innerHTML = renderInfoList(
    product.generalInfo,
    product.instructionHref,
    "",
    product.downloadHref
  );
  modal.querySelector("[data-detail-requirements]").innerHTML = renderInfoList(product.requirements);
  const mediaSection = modal.querySelector("[data-detail-media-section]");
  const mediaGrid = modal.querySelector("[data-detail-media]");
  const mediaMarkup = renderProductMedia(product);
  if (mediaSection && mediaGrid) {
    mediaGrid.innerHTML = mediaMarkup;
    mediaSection.hidden = !mediaMarkup;
  }

  const artwork = modal.querySelector("[data-variant-product-image]");

  if (artwork) {
    artwork.src = productImageSrc(product);
    artwork.alt = `${product.name} artwork`;
  }

  const galleryThumb = modal.querySelector("[data-variant-gallery-thumb]");

  if (galleryThumb) {
    galleryThumb.src = productImageSrc(product);
    galleryThumb.alt = `${product.name} thumbnail`;
  }

  modal.querySelectorAll("[data-variant-product-blur]").forEach((image) => {
    image.src = productImageSrc(product);
  });

  /* Products without dedicated artwork fall back to a wide category photo.
     That image looks small and empty when "contain"-fit into the tall art
     panel built for portrait box-art, so switch that panel to a full-bleed
     cover treatment and add a caption instead of leaving it looking bare. */
  const artPanel = modal.querySelector("[data-variant-art]");
  const hasOwnArt = Boolean(productArtwork[product.slug] || product.artwork);
  if (artPanel) {
    artPanel.classList.toggle("variant-art-cover", !hasOwnArt);
  }
  const artCaption = modal.querySelector("[data-variant-art-caption]");
  if (artCaption) {
    artCaption.textContent = hasOwnArt ? "" : (product.category || product.game || "");
    artCaption.hidden = hasOwnArt;
  }

  const artBadge = modal.querySelector("[data-variant-art-badge]");
  if (artBadge) {
    if (product.badge) {
      artBadge.hidden = false;
      artBadge.textContent = product.badge;
      artBadge.className = `product-status-badge variant-art-status ${badgeTone(product.badge)}`;
    } else {
      artBadge.hidden = true;
    }
  }

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
      const canSelectVariant = variant.checkoutReady || variant.checkoutBlocked || product.testOnly;
      button.type = "button";
      button.className = "variant-option";
      button.dataset.variantOption = "";
      button.dataset.variantSlug = variant.slug;
      button.disabled = !canSelectVariant;
      button.innerHTML = `
        <span>
          <strong>${escapeHtml(variant.name)}</strong>
          <small>${escapeHtml(variant.stockLabel || (canSelectVariant ? "In Stock" : "Out of Stock"))}</small>
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
  renderProductReviews(product);
  renderRelatedProducts(product);
  renderBundleOffer();

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
    stockBadge.textContent = activeVariant?.stockLabel || "Out of Stock";
  }

  const quantityWrap = modal.querySelector("[data-variant-quantity-wrap]");
  const quantityInput = modal.querySelector("[data-variant-quantity]");
  const quantityLimit = Number(activeVariant?.quantityLimit || activeProduct?.quantityLimit || 0);
  if (quantityWrap) quantityWrap.hidden = quantityLimit < 2;
  if (quantityInput) {
    quantityInput.max = String(quantityLimit || 1);
    quantityInput.value = String(Math.min(Math.max(1, Number(quantityInput.value) || 1), quantityLimit || 1));
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

  const sections = orderCategoryEntries(groups).map(([category, categoryProducts]) => {
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

async function startCheckout(productSlug, variantSlug, quantity = 1) {
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
      quantity,
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
    renderMessage(notice, "Please check “I understand all sales are final” before continuing.", "warn");
    flagTermsCheckbox();
    return;
  }

  if (!activeVariant.checkoutReady) {
    if (activeVariant.checkoutBlocked) {
      renderMessage(
        notice,
        activeVariant.checkoutError ||
          "This item is temporarily unavailable. Please contact support.",
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
    await startCheckout(activeProduct.slug, activeVariant.slug, activeVariantQuantity());
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
    qty: activeVariantQuantity(),
    maxQuantity: activeVariant.quantityLimit || activeProduct.quantityLimit || null,
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
    renderMessage(notice, "Please check “I understand all sales are final” before continuing.", "warn");
    flagTermsCheckbox();
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
        quantity: activeVariantQuantity(),
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
    if (payload.discordKeyDelivery && /dma|account/i.test(String(activeProduct?.name || ""))) {
      renderMessage(
        notice,
        `Purchase received. Join the Discord for DMA or account delivery.`,
        "success"
      );
      button.textContent = "Order received";
      window.setTimeout(() => {
        window.location.href = "/account/";
      }, 1800);
      return;
    }
    if (payload.manualDelivery) {
      const quantity = Math.max(1, Number(payload.quantity) || 1);
      const noun = quantity === 1 ? "account" : "accounts";
      renderMessage(
        notice,
        `Purchase received. Your ${quantity} ${noun} will appear on your account after processing.`,
        "success"
      );
      button.textContent = "Order received";
      window.setTimeout(() => {
        window.location.href = "/account/";
      }, 1800);
      return;
    }
    if (payload.pending) {
      renderMessage(
        notice,
        /dma|account/i.test(String(activeProduct?.name || ""))
          ? "Purchase received. Join the Discord for DMA or account delivery."
          : "Purchase received. Delivery is pending and will appear on your account page.",
        "warn"
      );
      button.textContent = "Order pending";
      window.setTimeout(() => {
        window.location.href = "/account/";
      }, 1800);
      return;
    }
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

/* Crypto checkout is intentionally not offered by the storefront. */
/*
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
    renderMessage(notice, "Please check “I understand all sales are final” before continuing.", "warn");
    flagTermsCheckbox();
    return;
  }

  if (!activeVariant.checkoutReady) {
    if (activeVariant.checkoutBlocked) {
      renderMessage(
        notice,
        activeVariant.checkoutError ||
          "This item is temporarily unavailable. Please contact support.",
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
*/

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
  if (requestedProduct) void refreshCatalogAvailability();
  setInterval(refreshCatalogAvailability, catalogRefreshMs);
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

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-catalog-bundle-add]");
  if (button) addCatalogSetupToCart(button);
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

const filterToggle = document.querySelector("[data-filter-toggle]");
const filterPanel = document.querySelector("[data-filter-panel]");

filterToggle?.addEventListener("click", () => {
  const isOpen = !filterPanel.classList.contains("is-open");
  filterPanel.classList.toggle("is-open", isOpen);
  filterToggle.classList.toggle("is-active", isOpen);
  filterToggle.setAttribute("aria-expanded", String(isOpen));
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
