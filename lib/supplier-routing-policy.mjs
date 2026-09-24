/**
 * Products whose fulfillment is owned by the RFT/SellAuth API.
 *
 * Unlock All is intentionally RFT-only. Keeping the rule independent of the
 * live provider snapshots prevents a stale or mis-mapped Ghostware listing
 * from becoming a fallback route.
 */
export function isRftOnlyProduct(product) {
  if (!product || product?.slug === "r6s-nfa-account") return false;
  const values = [
    product.slug,
    product.name,
    product.supplierProductName,
    ...(Array.isArray(product.supplierProductAliases) ? product.supplierProductAliases : []),
  ];
  return values.some((value) => /(?:^|[\s_-])unlock[\s_-]*all(?:$|[\s_\-+|:/])/i.test(String(value || "")));
}
