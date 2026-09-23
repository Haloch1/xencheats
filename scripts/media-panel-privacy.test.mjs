import assert from "node:assert/strict";
import { toMemberMediaCampaign, toMemberMediaProduct } from "../finance/media-panel-public.mjs";

const campaign = toMemberMediaCampaign({
  id: "campaign-id",
  product_slug: "r6s-no-recoil-day",
  variant_label: "1 Day Key",
  status: "pending",
  created_at: "2026-09-23T12:00:00.000Z",
  note: "Delivery via Cheats.Love",
  reviewer_note: "Ghostware fallback was used",
  proof_platform: "supplier-internal",
  supplier: "RFT",
});
assert.equal(campaign.status, "cancelled");
assert.deepEqual(Object.keys(campaign).sort(), [
  "claimed_at",
  "created_at",
  "credit_expires_at",
  "id",
  "product_slug",
  "status",
  "variant_label",
].sort());
assert.doesNotMatch(JSON.stringify(campaign), /Cheats\.Love|Ghostware|RFT|supplier-internal/i);

const product = toMemberMediaProduct({
  product: {
    slug: "r6s-no-recoil",
    name: "No Recoil",
    category: "Rainbow Six Siege",
    summary: "Instant delivery",
    supplier: "Cheats.Love",
    supplierProductName: "Ghostware listing",
  },
  variant: { slug: "day", name: "1 Day Key", priceDisplay: "$3" },
  inventorySlug: "r6s-no-recoil-day",
  supplierStockCount: 2,
  hasReadySupplier: true,
});
assert.equal(product.stockLabel, "2 keys available");
assert.deepEqual(Object.keys(product).sort(), [
  "availabilityState",
  "artwork",
  "category",
  "deliveryAvailable",
  "featured",
  "inventorySlug",
  "name",
  "priceDisplay",
  "slug",
  "status",
  "stockCount",
  "stockLabel",
  "summary",
  "variantName",
  "variantSlug",
].sort());
assert.doesNotMatch(JSON.stringify(product), /Cheats\.Love|Ghostware|supplierProductName|deliverySource/i);

const local = toMemberMediaProduct({
  product: { slug: "example", name: "Example", category: "Game" },
  variant: { slug: "day", name: "1 Day Key" },
  localCount: 1,
});
assert.equal(local.stockLabel, "1 key ready");
const checking = toMemberMediaProduct({
  product: { slug: "example", name: "Example", category: "Game" },
  variant: { slug: "day", name: "1 Day Key" },
  hasConfiguredSupplier: true,
});
assert.equal(checking.stockLabel, "Checking live stock");

console.log("Media panel supplier privacy tests passed");
