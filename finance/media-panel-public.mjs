export function toMemberMediaCampaign(campaign) {
  if (!campaign || typeof campaign !== "object") return null;
  const status = String(campaign.status || "").toLowerCase();
  return {
    id: campaign.id || null,
    product_slug: campaign.product_slug || "",
    variant_label: campaign.variant_label || "",
    status: status === "pending" ? "cancelled" : status,
    created_at: campaign.created_at || null,
    claimed_at: campaign.claimed_at || null,
    credit_expires_at: campaign.credit_expires_at || null,
  };
}

export function toMemberMediaProduct({
  product,
  variant,
  inventorySlug,
  localCount = 0,
  hasReadySupplier = false,
  hasConfiguredSupplier = false,
  supplierStockCount = null,
} = {}) {
  if (!product || !variant) return null;
  const localStock = Number.isInteger(localCount) && localCount > 0 ? localCount : 0;
  const exactSupplierStock = Number.isInteger(supplierStockCount) && supplierStockCount > 0
    ? supplierStockCount
    : null;
  const hasLocalOrSupplierStock = localStock > 0 || hasReadySupplier === true;
  const catalogBadge = String(product.badge || "").trim();
  const catalogStatus = /unavailable|out\s*of\s*stock|coming\s*soon/i.test(catalogBadge)
    ? "Unavailable"
    : (catalogBadge || "Available");
  const availabilityState = hasLocalOrSupplierStock
    ? "available"
    : hasConfiguredSupplier === true ? "checking" : "unavailable";
  const stockLabel = localStock > 0
    ? `${localStock} ${localStock === 1 ? "key" : "keys"} ready`
    : hasReadySupplier === true
      ? exactSupplierStock == null
        ? "Available"
        : `${exactSupplierStock} ${exactSupplierStock === 1 ? "key" : "keys"} available`
      : availabilityState === "checking" ? "Checking live stock" : "Unavailable";

  return {
    slug: product.slug,
    name: product.name,
    category: product.category || product.game || "Other",
    artwork: product.artwork || "",
    status: hasLocalOrSupplierStock ? "Available" : catalogStatus,
    summary: product.summary || "Digital delivery with live availability checks.",
    featured: product.featured === true,
    variantSlug: variant.slug,
    variantName: variant.name,
    inventorySlug,
    priceDisplay: variant.priceDisplay,
    stockLabel,
    stockCount: localStock > 0 ? localStock : exactSupplierStock,
    availabilityState,
    deliveryAvailable: availabilityState === "available" || availabilityState === "checking",
  };
}
