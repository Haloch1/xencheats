const MONEY_FIELDS = [
  "resellerPrice",
  "reseller_price",
  "wholesalePrice",
  "wholesale_price",
];
const RETAIL_FIELDS = ["retailPrice", "retail_price", "price"];

export function buyNfaMoneyToCents(value) {
  if (typeof value === "string") value = value.trim().replace(/[$,]/g, "");
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

export function buyNfaSellableCount(stockCount, balanceCents, resellerPriceCents) {
  const stock = Number(stockCount);
  const balance = Number(balanceCents);
  const cost = Number(resellerPriceCents);
  if (!Number.isSafeInteger(stock) || stock <= 0
    || !Number.isSafeInteger(balance) || balance < 0
    || !Number.isSafeInteger(cost) || cost < 0) return 0;
  if (cost === 0) return stock;
  return Math.max(0, Math.min(stock, Math.floor(balance / cost)));
}

export function buyNfaCanPurchase({ stockCount, balanceCents, resellerPriceCents, quantity = 1, configured, snapshotFresh }) {
  const requested = Math.max(1, Math.trunc(Number(quantity) || 1));
  return Boolean(configured && snapshotFresh
    && buyNfaSellableCount(stockCount, balanceCents, resellerPriceCents) >= requested);
}

export function buyNfaStorefrontPriceCents(retailPriceCents, resellerPriceCents, minimumMarginCents = 0) {
  const retail = Number(retailPriceCents);
  const cost = Number(resellerPriceCents);
  const margin = Number(minimumMarginCents);
  if (!Number.isSafeInteger(retail) || retail <= 0
    || !Number.isSafeInteger(cost) || cost < 0
    || !Number.isSafeInteger(margin) || margin < 0) return null;
  return Math.max(retail, cost + margin);
}

function unwrap(value) {
  let current = value;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!current || typeof current !== "object" || Array.isArray(current)) break;
    const nested = current.data ?? current.result ?? current.response;
    if (!nested || typeof nested !== "object") break;
    current = nested;
  }
  return current;
}

export function buyNfaBalanceCents(payload) {
  const source = unwrap(payload);
  const raw = source?.balanceUsd
    ?? source?.balance_usd
    ?? source?.balance
    ?? source?.walletBalance
    ?? source?.wallet_balance;
  return buyNfaMoneyToCents(raw);
}

function array(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function slugPart(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function numberStock(variant) {
  const raw = variant?.inStock
    ?? variant?.in_stock
    ?? variant?.stockCount
    ?? variant?.stock_count
    ?? variant?.stock
    ?? variant?.quantity;
  if (raw === true) return 1;
  if (raw === false || raw == null || raw === "") return 0;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function firstMoney(source, fields) {
  for (const field of fields) {
    if (source?.[field] != null) return buyNfaMoneyToCents(source[field]);
  }
  return null;
}

function collectCatalogProducts(payload) {
  const root = unwrap(payload);
  if (Array.isArray(root)) return root.map((product) => ({ product, parentCategory: null }));

  const topLevelCategories = array(root?.categories ?? root?.data?.categories);
  const entries = [];
  for (const category of topLevelCategories) {
    for (const product of array(category?.products ?? category?.items)) {
      entries.push({ product, parentCategory: category });
    }
  }
  if (entries.length) return entries;

  const topLevelProducts = array(root?.products ?? root?.items ?? root?.data?.products ?? root?.data?.items);
  if (topLevelProducts.length) return topLevelProducts.map((product) => ({ product, parentCategory: null }));
  const fields = root && typeof root === "object" ? Object.keys(root).slice(0, 20).join(", ") : typeof root;
  throw new Error(`BuyNfa returned an unrecognized catalog structure (top-level fields: ${fields || "none"}).`);
}

export function normalizeBuyNfaCatalog(payload) {
  const entries = collectCatalogProducts(payload);
  const normalized = [];
  const seen = new Set();
  const seenVariantSlugs = new Set();

  for (const { product, parentCategory } of entries) {
    const categorySlug = String(
      product?.categorySlug
        ?? product?.category_slug
        ?? parentCategory?.slug
        ?? parentCategory?.categorySlug
        ?? parentCategory?.category_slug
        ?? product?.category?.slug
        ?? product?.category
        ?? "",
    ).trim();
    const categoryName = String(
      product?.categoryName
        ?? product?.category_name
        ?? parentCategory?.name
        ?? parentCategory?.label
        ?? parentCategory?.categoryName
        ?? parentCategory?.category_name
        ?? product?.category?.name
        ?? categorySlug,
    ).trim();
    const productSlug = String(product?.productSlug ?? product?.product_slug ?? product?.slug ?? "").trim();
    const productName = String(product?.name ?? product?.title ?? productSlug).trim();
    if (!categorySlug || !productSlug || !productName) {
      throw new Error("BuyNfa returned a catalog product without stable category/product identifiers.");
    }

    const variants = array(product?.variants);
    if (!variants.length) throw new Error("BuyNfa returned a catalog product without variants.");
    const productKey = `${slugPart(categorySlug)}:${slugPart(productSlug)}`;
    for (const variant of variants) {
      const variantId = String(variant?.variantId ?? variant?.variant_id ?? variant?.id ?? "").trim();
      const variantName = String(variant?.name ?? variant?.variantName ?? variant?.displayName ?? variant?.title ?? variant?.label ?? variantId).trim();
      const stockCount = numberStock(variant);
      const resellerPriceCents = firstMoney(variant, MONEY_FIELDS);
      const retailPriceCents = firstMoney(variant, RETAIL_FIELDS);
      if (!variantId || !variantName || stockCount == null
        || resellerPriceCents == null || retailPriceCents == null || retailPriceCents <= 0) {
        throw new Error("BuyNfa returned a catalog variant with missing or invalid stock/pricing data.");
      }
      const key = `${productKey}:${variantId}`;
      if (seen.has(key)) throw new Error("BuyNfa returned duplicate catalog variant identifiers.");
      seen.add(key);
      const productSlugKey = "account-" + productKey.replace(/:/g, "-");
      const variantSlug = slugPart(variantId);
      if (!productSlugKey || !variantSlug) throw new Error("BuyNfa returned catalog identifiers that cannot be mapped safely.");
      const variantSlugKey = `${productSlugKey}:${variantSlug}`;
      if (seenVariantSlugs.has(variantSlugKey)) throw new Error("BuyNfa returned variant identifiers that normalize to the same storefront slug.");
      seenVariantSlugs.add(variantSlugKey);
      normalized.push({
        categorySlug,
        categoryName,
        productSlug,
        productName,
        productKey: productSlugKey,
        variantId,
        variantName,
        variantSlug,
        inventorySlug: `${productSlugKey}-${variantSlug}`,
        stockCount,
        resellerPriceCents,
        retailPriceCents,
      });
    }
  }

  if (!normalized.length) throw new Error("BuyNfa returned an empty catalog.");
  return normalized;
}

export function buyNfaOrderId(payload) {
  const queue = [payload];
  const seen = new Set();
  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    const id = value.orderId ?? value.order_id ?? value.id;
    if (typeof id === "string" || typeof id === "number") {
      const normalized = String(id).trim();
      if (normalized) return normalized;
    }
    for (const field of ["data", "result", "order"]) {
      if (value[field] && typeof value[field] === "object") queue.push(value[field]);
    }
  }
  return null;
}

function credentialLines(value, prefix = "", depth = 0) {
  if (depth > 5 || value == null) return [];
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text ? [`${prefix || "Account details"}: ${text}`] : [];
  }
  if (Array.isArray(value)) return value.flatMap((item) => credentialLines(item, prefix, depth + 1));
  if (typeof value !== "object") return [];

  const lines = [];
  for (const [key, nested] of Object.entries(value)) {
    const label = key.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    if (/^(credentials?|account|login|delivery|delivered|data|result)$/i.test(key)) {
      lines.push(...credentialLines(nested, prefix, depth + 1));
    } else if (/email|user|login|pass|recover|phone|2fa|code|credential|token|platform|steam|ubisoft|xbox|account|identifier|key/i.test(key)) {
      if (typeof nested === "string" || typeof nested === "number") {
        const text = String(nested).trim();
        if (text) lines.push(`${prefix ? `${prefix} ` : ""}${label}: ${text}`);
      } else {
        lines.push(...credentialLines(nested, prefix ? `${prefix} ${label}` : label, depth + 1));
      }
    }
  }
  return lines;
}

export function buyNfaDeliveryText(payload) {
  const root = unwrap(payload);
  if (typeof root === "string" && root.trim()) return root.trim();
  const directText = [
    root?.credentials,
    root?.credential,
    root?.data,
    root?.result,
    root?.response,
    root?.order?.credentials,
    root?.order?.credential,
  ].find((value) => typeof value === "string" && value.trim());
  if (directText) return directText.trim();
  const candidates = [
    root?.credentials,
    root?.credential,
    root?.account,
    root?.delivery,
    root?.delivered,
    root?.data,
    root?.result,
    root?.response,
    root?.order?.credentials,
    root?.order?.account,
    root?.order?.delivery,
    root?.order?.delivered,
  ];
  for (const candidate of candidates) {
    const lines = credentialLines(candidate);
    if (lines.length) return [...new Set(lines)].join("\n");
  }
  return null;
}
