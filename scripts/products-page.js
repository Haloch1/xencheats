import { getCurrentSession, authConfigured } from "./supabase-client.js";
import { initReveal, renderMessage } from "./site.js";
import haloLogoImage from "../assets/hc-logo.png";
import rainbowSixCategoryImage from "../assets/rainbow-six-siege-category.png";

initReveal();

const grid = document.querySelector("[data-products-grid]");
const notice = document.querySelector("[data-products-message]");
const accountLink = document.querySelector("[data-account-link]");
const categoryStrip = document.querySelector("[data-category-strip]");
const productSearch = document.querySelector("[data-product-search]");
const gamesStat = document.querySelector("[data-catalog-games]");
const productsStat = document.querySelector("[data-catalog-products]");
const lowestStat = document.querySelector("[data-catalog-lowest]");
let catalogProducts = [];
let activeProduct = null;
let activeVariant = null;
let activeCategory = "all";
let searchQuery = "";
const excludedCatalogTerms = ["account", "spoofer"];

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

  return haloLogoImage;
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
    <div class="product-footer">
      <strong>${escapeHtml(product.priceDisplay)}</strong>
      <button class="button button-primary pay-button" data-product-slug="${escapeHtml(product.slug)}" ${
        product.available ? "" : "disabled"
      }>
        ${product.available ? "Buy Now" : "Testing"}
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
      <button class="variant-close" type="button" data-variant-close aria-label="Close variant selector">×</button>
      <div class="variant-art">
        <div class="variant-art-card">
          <div class="variant-logo-mark">HC</div>
          <div class="variant-art-copy">
            <span>Rainbow Six Siege</span>
            <strong data-variant-art-title>Access Key</strong>
            <small>Instant member delivery</small>
          </div>
          <div class="variant-card-strip">
            <span>01</span>
            <span>Verified Route</span>
          </div>
        </div>
      </div>
      <div class="variant-details">
        <p class="eyebrow">Select Variant</p>
        <h3 id="variant-title" data-variant-title></h3>
        <div class="variant-status-row">
          <span class="variant-dot"></span>
          <strong data-variant-status></strong>
          <span data-variant-price></span>
          <em>In Stock</em>
        </div>
        <p data-variant-summary></p>
        <label class="variant-label">Variant</label>
        <div class="variant-options" data-variant-options></div>
        <div class="variant-quantity">
          <label>Quantity</label>
          <div>
            <button type="button" disabled>-</button>
            <span>1</span>
            <button type="button" disabled>+</button>
          </div>
        </div>
        <div class="variant-actions">
          <button class="button button-secondary" type="button" data-variant-close>Cancel</button>
          <button class="button button-primary" type="button" data-variant-checkout>Buy Now</button>
        </div>
      </div>
    </section>
  `;
  document.body.append(modal);

  modal.addEventListener("click", async (event) => {
    const closeButton = event.target.closest("[data-variant-close]");
    const option = event.target.closest("[data-variant-option]");
    const checkoutButton = event.target.closest("[data-variant-checkout]");

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
  });

  return modal;
}

function openVariantModal(product) {
  if (!product) {
    renderMessage(notice, "That product could not be loaded. Refresh and try again.", "error");
    return;
  }

  if (!product.available) {
    renderMessage(notice, "This listing is unavailable right now.", "warn");
    return;
  }

  activeProduct = product;
  activeVariant = product.variants?.find((variant) => variant.checkoutReady) || product.variants?.[0] || null;

  const modal = ensureVariantModal();
  modal.querySelector("[data-variant-title]").textContent = product.name;
  modal.querySelector("[data-variant-art-title]").textContent = product.name;
  modal.querySelector("[data-variant-status]").textContent = product.badge;
  modal.querySelector("[data-variant-summary]").textContent = product.summary;

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
          <small>${escapeHtml(canSelectVariant ? variant.stockLabel : "Testing")}</small>
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

  modal.querySelector("[data-variant-price]").textContent = activeVariant?.priceDisplay || "";
  checkoutButton.disabled = !(activeVariant?.checkoutReady || activeVariant?.checkoutBlocked);
  checkoutButton.textContent =
    activeVariant?.checkoutReady || activeVariant?.checkoutBlocked ? "Buy Now" : "Testing";
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
  const matchingProducts = baseProducts.filter(productMatchesSearch);

  if (activeCategory === "all" && !searchQuery) {
    renderCategoryCards(catalogProducts);
    return;
  }

  renderProductGroups(matchingProducts);
}

function updateStats(products) {
  const categories = new Set(products.map((product) => product.category || product.game));
  const lowest = products.reduce((best, product) => Math.min(best, getStartingPrice(product)), Infinity);

  if (gamesStat) {
    gamesStat.textContent = categories.size;
  }

  if (productsStat) {
    productsStat.textContent = products.length;
  }

  if (lowestStat) {
    lowestStat.textContent = Number.isFinite(lowest) ? `$${lowest.toFixed(2)}` : "$0";
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

    renderMessage(notice, "This variant is still in testing.", "warn");
    return;
  }

  button.disabled = true;
  button.textContent = "Opening Checkout...";

  try {
    await startCheckout(activeProduct.slug, activeVariant.slug);
  } catch (error) {
    renderMessage(notice, error.message, "error");
    button.disabled = false;
    button.textContent = "Buy Now";
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
  renderCatalogView();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeVariantModal();
  }
});
