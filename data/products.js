import { dedicatedRftGuideSlugs } from "./dedicated-guides.js";
import { rftSourceCatalog } from "./rft-source-catalog.js";

function stripeEnvKey(productSlug, variantSlug) {
  return `STRIPE_PRICE_${productSlug}_${variantSlug}`
    .replace(/-/g, "_")
    .toUpperCase();
}

function money(amount) {
  return `$${(amount / 100).toFixed(2)}`;
}

function adjustAmount(amount, multiplier) {
  return Math.round(amount * multiplier);
}

// Retail pricing applies the same configured markup to every supplier-backed
// cost and finishes storefront prices at .99 so live supplier costs never
// appear as the storefront price.
export const AUTOMATED_PRICE_MARKUP_PERCENT = 40;

// Kept as an exported compatibility surface for admin/import code. Supplier
// products are no longer exempt: every supplier cost uses the same markup.
export const AUTOMATED_PRICE_MARKUP_EXEMPT_SLUGS = new Set();

export function applyAutomatedPriceMarkup(amount) {
  const cents = Number(amount) || 0;
  if (cents <= 0) return cents;
  return Math.max(
    99,
    Math.ceil((cents * (1 + AUTOMATED_PRICE_MARKUP_PERCENT / 100)) / 100) * 100 - 1,
  );
}

export function priceForProduct(productSlug, amount) {
  return applyAutomatedPriceMarkup(amount);
}

function keyVariant(productSlug, slug, name, amount, options = {}) {
  const result = {
    slug,
    name,
    stockLabel: options.stockLabel || "In Stock",
    priceDisplay: options.priceDisplay || money(amount),
    amount,
    inventorySlug: `${productSlug}-${slug}`,
    stripeEnvKey: options.stripeEnvKey || stripeEnvKey(productSlug, slug),
    checkoutBlocked: Boolean(options.checkoutBlocked),
    checkoutError: options.checkoutError || "",
    manualDelivery: Boolean(options.manualDelivery),
    quantityLimit: Number.isInteger(options.quantityLimit) ? options.quantityLimit : null,
    stripeFeeIncluded: Boolean(options.stripeFeeIncluded),
    supplierVariantName: options.supplierVariantName || null,
    supplierDigital: options.supplierDigital !== false,
  };
  if (options.originalAmount) {
    result.originalPrice = money(options.originalAmount);
  }
  return result;
}

function saleVariant(productSlug, slug, name, originalAmount, salePercent, options = {}) {
  const saleAmount = Math.round(originalAmount * (1 - salePercent / 100));
  return keyVariant(productSlug, slug, name, saleAmount, {
    ...options,
    originalAmount,
  });
}

function unavailableVariant(productSlug, slug, name, amount) {
  return keyVariant(productSlug, slug, name, amount, {
    stockLabel: "Unavailable",
    stripeEnvKey: `DISABLED_${stripeEnvKey(productSlug, slug)}`,
  });
}

function stockedButBlockedVariant(productSlug, slug, name, amount, stockCount) {
  return keyVariant(productSlug, slug, name, amount, {
    stockLabel: `${stockCount} ${stockCount === 1 ? "Key" : "Keys"} Available`,
    stripeEnvKey: `BLOCKED_${stripeEnvKey(productSlug, slug)}`,
    checkoutBlocked: true,
    checkoutError: "This item is temporarily unavailable. Please contact support.",
  });
}

function adjustedUnavailableVariant(productSlug, slug, name, baseAmount, multiplier) {
  return unavailableVariant(productSlug, slug, name, adjustAmount(baseAmount, multiplier));
}

function adjustedBlockedVariant(productSlug, slug, name, baseAmount, stockCount, multiplier) {
  return stockedButBlockedVariant(productSlug, slug, name, adjustAmount(baseAmount, multiplier), stockCount);
}

function disabledVariants(productSlug, rows) {
  return rows.map(([slug, name, amount]) => unavailableVariant(productSlug, slug, name, amount));
}

function categoryMeta(category) {
  return {
    vendor: category,
    game: category,
    category,
    badge: "Available",
    featured: false,
    available: true,
  };
}

const r6Multiplier = 1;
const newProductMultiplier = 1;
const defaultGeneralInfo = "Open the setup instructions before using this product.";
const universalSetupNotes = [];
const ancientSetupNote =
  "Might require Discord or Medal overlay; make sure hardware acceleration is enabled in the Discord overlay. SteelSeries may also be needed for Nvidia and AMD users; follow the setup shown in the guide.";

// Stable WooCommerce IDs from Cheats.Love. Display names are intentionally
// independent from these IDs so branding changes cannot break stock matching.
const cheatsLoveCatalog = {
  "rust-dullwave": { productId: 13445, variants: { day: 13447, "three-day": 13448, week: 13449, month: 13450 } },
  "rust-mason-lite": { productId: 7805, variants: { day: 7814, week: 7815, month: 7816 } },
  "rust-mason-full": { productId: 7801, variants: { day: 7802, week: 7803, month: 7804 } },
  "rust-mrpro": { productId: 2351, variants: { day: 2352, week: 2353, month: 2354 } },
  "fortnite-dullwave": { productId: 13460, variants: { day: 13461, "three-day": 13462, week: 13463, month: 13464 } },
  "fortnite-ancient": { productId: 191, variants: { day: 242, week: 243, month: 244 } },
  "fortnite-arcane": { productId: 62, variants: { day: 117, "three-day": 118, week: 119, month: 120 } },
  "r6s-ancient": { productId: 9482, variants: { day: 9484, week: 9485, month: 9486 } },
  "r6s-crusader": { productId: 181, variants: { day: 194, week: 195, month: 196 } },
  "r6s-vega": { productId: 7146, variants: { day: 7147, "three-day": 7148, week: 7149, month: 7150 } },
  "r6s-chams": { productId: 1621, variants: { day: 1622, week: 1623, month: 1624 } },
  "r6s-lethal": { productId: 193, variants: { day: 248, week: 249, month: 250, year: 251 } },
  "r6s-no-recoil": { productId: 61, variants: { day: 113, week: 115, month: 116, "three-month": 112 } },
  "apex-mason": { productId: 7818, variants: { day: 7821, week: 7822, month: 7823 } },
  "apex-ancient": { productId: 189, variants: { day: 235, week: 236, month: 237 } },
  "apex-dullwave": { productId: 184, variants: { day: 200, week: 201, month: 202 } },
  "apex-arcane": { productId: 63, variants: { day: 121, week: 122, month: 123 } },
  "cs2-predator": { productId: 1756, variants: { day: 1760, week: 1761, month: 1762, "three-month": 1763 } },
  "cs2-arcane": { productId: 16, variants: { day: 17, "fifteen-day": 18, month: 19 } },
  "cs2-strikeforce": { productId: 261, variants: { day: 296, week: 294, month: 295 } },
  "cs2-skinchanger": { productId: 427, variants: { day: 428, week: 429, month: 430 } },
  "pubg-arcane": { productId: 411, variants: { day: 412, week: 413, month: 414 } },
  "pubg-shadow": { productId: 59, variants: { day: 106, week: 107, month: 108 } },
  "delta-force-dullwave": { productId: 13451, variants: { day: 13456, "three-day": 13457, week: 13458, month: 13459 } },
  "delta-force-ancient": { productId: 190, variants: { day: 238, week: 239, month: 241 } },
  "delta-force-luna-chams": { productId: 185, variants: { day: 203, week: 204, month: 205 } },
  "marvel-rivals-dullwave": { productId: 560, variants: { day: 561, week: 562, month: 563 } },
  "marvel-rivals-predator": { productId: 1768, variants: { day: 1769, week: 1770, month: 1771, "three-month": 1772 } },
  "marvel-rivals-shadow": { productId: 4603, variants: { day: 4604, week: 4605, month: 4606 } },
  "battlefield-fecurity": { productId: 421, variants: { day: 422, week: 423, month: 424 } },
  "battlefield6-ancient": { productId: 2694, variants: { day: 2696, week: 2697, month: 2698 } },
  "cod-lunar": { productId: 8805, variants: { "bo6-day": 9085, "bo6-week": 9087, "bo6-month": 9089, "bo7-day": 9086, "bo7-week": 9088, "bo7-month": 9090 } },
  "cod-dullwave": { productId: 259, variants: { day: 279, week: 280, month: 281 } },
  "eft-crusader": { productId: 53, variants: { day: 69, week: 67, month: 68 } },
  "eft-superior": { productId: 255, variants: { day: 270, week: 271, month: 272 } },
  "eft-sugar": { productId: 256, variants: { day: 273, week: 274, month: 275 } },
  "eft-sky": { productId: 253, variants: { day: 266, week: 264, month: 265 } },
  "eft-chams": { productId: 254, variants: { day: 267, week: 268, month: 269 } },
  "eft-mason": { productId: 7808, variants: { day: 7811, week: 7812, month: 7813 } },
  "spoofer-lunar": { productId: 9497, variants: { day: 9498, week: 9499, month: 9500 } },
  "spoofer-shadow": { productId: 4609, variants: { day: 4610, week: 4611, month: 4612 } },
  "eac-be-spoofer": { productId: 305, variants: { day: 314, week: 312, month: 313 } },
};

const r6Meta = {
  vendor: "Rainbow Six Siege",
  game: "Rainbow Six Siege",
  category: "Rainbow Six Siege",
  badge: "Available",
  featured: false,
  available: true,
};

const fortniteMeta = {
  vendor: "Fortnite",
  game: "Fortnite",
  category: "Fortnite",
  badge: "Available",
  featured: false,
  available: true,
};

const spooferMeta = {
  vendor: "Spoofer",
  game: "Spoofer",
  category: "Spoofer",
  badge: "Available",
  featured: false,
  available: true,
};

const accountsMeta = {
  vendor: "Accounts",
  game: "Accounts",
  category: "Accounts",
  badge: "Available",
  featured: false,
  available: true,
};

const apexMeta = {
  vendor: "Apex Legends",
  game: "Apex Legends",
  category: "Apex Legends",
  badge: "Available",
  featured: false,
  available: true,
};

const rustMeta = {
  vendor: "Rust",
  game: "Rust",
  category: "Rust",
  badge: "Available",
  featured: false,
  available: true,
};

const productCatalog = [
  {
    ...rustMeta,
    badge: "Undetected",
    slug: "rust-dullwave",
    name: "Rust - Dullwave",
    priceDisplay: `From ${money(730)}`,
    summary:
      "Premium undetected Rust cheat built for tactical domination, pairing precision aim tools with a strong Rust ESP for total raid awareness.",
    features: ["Aimbot", "Player ESP", "Loot ESP"],
    featureGroups: [
      { title: "Aimbot", items: ["Enable aimbot", "Aim key", "FOV control", "Smoothing"] },
      { title: "ESP", items: ["Player ESP", "Loot filters", "Distance info"] },
      { title: "Misc", items: ["Config save/load", "Low resource use"] },
    ],
    generalInfo: [
      "Loader password is shared setup-wide; check the instructions page before first launch.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11 (21H2, 22H2, 23H2, 24H2, 25H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
      "Flashdrive required: No",
    ],
    variants: [
      keyVariant("rust-dullwave", "day", "1 Day Key", 730),
      keyVariant("rust-dullwave", "three-day", "3 Day Key", 1450),
      keyVariant("rust-dullwave", "week", "7 Day Key", 3310),
      keyVariant("rust-dullwave", "month", "30 Day Key", 4640),
    ],
  },
  {
    ...rustMeta,
    badge: "Undetected",
    slug: "rust-mason-lite",
    name: "Rust Mason Lite",
    priceDisplay: `From ${money(270)}`,
    summary:
      "Lite Rust ESP with automatic player boxes and zero configuration. Launch it, join the game, and get instant visual awareness.",
    features: ["Auto player ESP", "Zero setup", "USB loader flow"],
    featureGroups: [
      { title: "ESP", items: ["Automatic player box ESP", "No menus or config required"] },
    ],
    generalInfo: [
      "USB-only loader; full injection steps are on the instructions page.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Cheat type: Lite Rust ESP (auto player box)",
      "Game: Rust (Steam)",
      "OS: Windows 10 x64 (2004, 20H2, 21H1, 21H2, 22H2), Windows 11 (21H2, 22H2, 23H2 up to build 3880)",
      "Anti-cheat: Easy Anti-Cheat",
      "Stream-Proof: No",
      "Flashdrive required: Yes",
    ],
    variants: [
      keyVariant("rust-mason-lite", "day", "1 Day Key", 270),
      keyVariant("rust-mason-lite", "week", "7 Day Key", 1110),
      keyVariant("rust-mason-lite", "month", "30 Day Key", 2085),
    ],
  },
  {
    ...rustMeta,
    badge: "Undetected",
    slug: "rust-mason-full",
    name: "Rust Mason Full",
    priceDisplay: `From ${money(555)}`,
    summary:
      "Full Rust cheat with advanced aimbot precision, deep ESP visuals, and full configuration control for total map awareness.",
    features: ["Aimbot", "Full ESP", "Config control"],
    featureGroups: [
      { title: "Aimbot", items: ["Advanced aim precision", "FOV control", "Target selection"] },
      { title: "Visuals", items: ["Player ESP", "Loot ESP", "Resource ESP"] },
      { title: "Misc", items: ["Full config save/load", "HWID spoofer included"] },
    ],
    generalInfo: [
      "Loader must run from a USB flash drive; see the two-stage injection walkthrough on the instructions page.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Rust (Steam)",
      "OS: Windows 10 & 11 x64 (up to 25H2)",
      "Anti-cheat: Easy Anti-Cheat",
      "Stream-Proof: Yes (screenshots & recordings)",
      "Flashdrive required: Yes",
    ],
    variants: [
      keyVariant("rust-mason-full", "day", "1 Day Key", 555),
      keyVariant("rust-mason-full", "week", "7 Day Key", 2225),
      keyVariant("rust-mason-full", "month", "30 Day Key", 5000),
    ],
  },
  {
    ...rustMeta,
    badge: "Undetected",
    slug: "rust-mrpro",
    name: "Rust - MrPro",
    priceDisplay: `From ${money(640)}`,
    summary:
      "Rust cheat built for Intel systems, covering aim and visual tools in one setup. Intel processors only.",
    features: ["Aimbot", "Player ESP", "Intel-only build"],
    featureGroups: [
      { title: "Aimbot", items: ["Aim controls", "FOV settings"] },
      { title: "Visuals", items: ["Player ESP", "Distance info"] },
    ],
    generalInfo: [
      "Attention: Intel processors only. Open a Discord ticket for setup help.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam",
      "CPU: Intel only",
      "GPU: Nvidia & AMD",
      "OS: Windows 10 (21H2, 22H2), Windows 11 (21H2, 22H2, 23H2, 24H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      keyVariant("rust-mrpro", "day", "1 Day Key", 640),
      keyVariant("rust-mrpro", "week", "7 Day Key", 3220),
      keyVariant("rust-mrpro", "month", "30 Day Key", 6440),
    ],
  },
  {
    ...fortniteMeta,
    badge: "Undetected",
    slug: "fortnite-dullwave",
    name: "Fortnite - Dullwave",
    priceDisplay: `From ${money(465)}`,
    summary:
      "Undetected Fortnite cheat built for total arena control, pairing a precise aimbot with a strong Fortnite ESP for full tactical awareness.",
    features: ["Aimbot", "Player ESP", "Stream-friendly design"],
    featureGroups: [
      { title: "Aimbot", items: ["Enable aimbot", "Aim key", "FOV control", "Smoothing", "Target selection"] },
      { title: "ESP", items: ["Player ESP", "Distance info", "Box/skeleton visuals"] },
      { title: "Misc", items: ["Config save/load", "Low resource use"] },
    ],
    generalInfo: [
      "Loader password is shared setup-wide; check the instructions page before first launch.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Epic Games",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10 (1903-22H2), Windows 11 (21H2-25H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
      "Flashdrive required: No",
    ],
    variants: [
      keyVariant("fortnite-dullwave", "day", "1 Day Key", 465),
      keyVariant("fortnite-dullwave", "three-day", "3 Day Key", 930),
      keyVariant("fortnite-dullwave", "week", "7 Day Key", 1850),
      keyVariant("fortnite-dullwave", "month", "30 Day Key", 3575),
    ],
  },
  {
    ...fortniteMeta,
    badge: "Undetected",
    slug: "fortnite-ancient",
    name: "Fortnite Ancient",
    priceDisplay: `From ${money(400)}`,
    summary:
      "Fortnite setup with aim tools, player ESP, and configuration sharing built for Epic Games Store.",
    features: ["Aim support", "Player ESP", "Config sharing"],
    featureGroups: [
      { title: "Aimbot", items: ["Aim key", "Smooth", "FOV", "Target selection"] },
      { title: "Visuals", items: ["Player ESP", "Skeleton", "Distance", "Radar"] },
      { title: "Config", items: ["Save", "Load", "Share"] },
    ],
    generalInfo: [
      "Follow the full preparation and injection walkthrough on the instructions page before first launch.",
      ancientSetupNote,
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Epic Games Store (EGS)",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11 (21H2, 22H2, 23H2, 24H2, 25H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      keyVariant("fortnite-ancient", "day", "1 Day Key", 400),
      keyVariant("fortnite-ancient", "week", "7 Day Key", 2000),
      keyVariant("fortnite-ancient", "month", "30 Day Key", 4000),
    ],
  },
  {
    ...fortniteMeta,
    badge: "Undetected",
    slug: "fortnite-arcane",
    name: "Fortnite - Arcane",
    priceDisplay: `From ${money(700)}`,
    summary:
      "Full-featured Fortnite package with a tunable aimbot, distance-aware visuals, and stream-safe visibility checks.",
    features: ["Aimbot suite", "Player ESP", "Anti-detection prep"],
    featureGroups: [
      { title: "Aimbot", items: ["Enable aimbot", "FOV control", "Smoothing", "Target selection"] },
      { title: "Visuals", items: ["Player ESP", "Distance", "Visibility check"] },
      { title: "Misc", items: ["HWID spoofer prompt on first launch", "Config save/load"] },
    ],
    generalInfo: [
      "Requires the Visual C++ Redistributable and a PC restart before first launch; see the instructions page.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Epic Games Store (EGS)",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11 (21H2, 22H2, 23H2, 24H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
      "Stream-Proof: No",
    ],
    variants: [
      keyVariant("fortnite-arcane", "day", "1 Day Key", 700),
      unavailableVariant("fortnite-arcane", "three-day", "3 Day Key", 1800),
      keyVariant("fortnite-arcane", "week", "7 Day Key", 3500),
      keyVariant("fortnite-arcane", "month", "30 Day Key", 6000),
    ],
  },
  {
    ...r6Meta,
    badge: "Undetected",
    slug: "r6s-ancient",
    name: "R6S Ancient",
    priceDisplay: `From ${money(400)}`,
    summary:
      "Full-featured Rainbow Six Siege loadout combining a tunable aimbot, layered player ESP, and gadget control for both attackers and defenders.",
    features: ["Aimbot suite", "Player ESP", "Gadget control"],
    featureGroups: [
      {
        title: "Aimbot",
        items: [
          "Enable aimbot",
          "Aim key",
          "Draw FOV",
          "FOV slider",
          "Aim smoothness",
          "Aim sensitivity",
          "Target bones",
          "Nearest bone",
          "Target lock",
        ],
      },
      {
        title: "Player ESP",
        items: [
          "Draw box",
          "Draw skeleton",
          "Skeleton thickness slider",
          "Draw health",
          "Draw lines",
          "Lines thickness slider",
          "Draw operator icon",
        ],
      },
      {
        title: "Gadget Abilities",
        items: [
          "Enable all attackers",
          "Breach hammer",
          "Breaching rounds",
          "Shock drone",
          "Cluster charges",
          "Rifle shield",
          "Exothermic chargers",
          "Enable all defenders",
          "Gas grenades",
          "Armor panels",
          "Cardiac sensor",
          "Stim pistols",
          "Black eye",
          "Silent step",
        ],
      },
      {
        title: "Config",
        items: ["Create new config", "Import config", "Abilities icon size slider"],
      },
    ],
    generalInfo: [
      "Covers both attacker and defender gadgets alongside the aim and ESP tools.",
      "Includes a built-in spoofer, though results can vary by system.",
      ancientSetupNote,
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: UPlay (Ubisoft Connect), Steam, Epic Games",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11 (21H2, 22H2, 23H2, 24H2, 25H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
      "Built-in spoofer included (may not work on all systems)",
    ],
    variants: [
      keyVariant("r6s-ancient", "day", "1 Day Key", 400),
      keyVariant("r6s-ancient", "week", "7 Day Key", 2000),
      keyVariant("r6s-ancient", "month", "30 Day Key", 3900),
    ],
  },
  {
    ...r6Meta,
    badge: "Undetected",
    slug: "r6s-crusader",
    name: "Crusader R6S",
    priceDisplay: `From ${money(400)}`,
    summary:
      "Aim- and ESP-focused Rainbow Six Siege tool built around clean target reads and adjustable aim assist.",
    features: ["Player ESP", "Aimbot"],
    featureGroups: [
      {
        title: "Player ESP",
        items: [
          "Player ESP",
          "ESP box",
          "ESP line (top, center, bottom)",
          "Player distance",
          "Skeleton",
          "Name",
          "Head hitbox",
          "Health (bar/text)",
          "Team check",
          "Max distance",
        ],
      },
      {
        title: "Aimbot",
        items: [
          "Active aimbot",
          "Two bindable aimbot keys",
          "FOV size",
          "Draw FOV",
          "Hitbox selection",
          "Mark target",
          "Sensitivity",
          "Static crosshair",
        ],
      },
    ],
    generalInfo: [
      "Keeps to the two core categories, aim and visuals, without extra add-ons.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: UPlay (Ubisoft Connect), Steam, Epic Games",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      keyVariant("r6s-crusader", "day", "1 Day Key", 400),
      keyVariant("r6s-crusader", "week", "7 Day Key", 2000),
      keyVariant("r6s-crusader", "month", "30 Day Key", 4000),
    ],
  },
  {
    ...r6Meta,
    badge: "Undetected",
    slug: "r6s-vega",
    name: "R6S Vega",
    priceDisplay: `From ${money(400)}`,
    summary:
      "Adaptive Rainbow Six Siege X toolkit pairing a real-time aimbot with map-wide visuals and stream-safe overlays.",
    features: ["Adaptive aimbot", "Full visuals", "Streamproof"],
    featureGroups: [
      {
        title: "Aimbot",
        items: ["Aim filter (crosshair & distance)", "Smoothing", "FOV", "Distance check", "Multipoint bones", "Filter team"],
      },
      {
        title: "Visuals",
        items: ["Skeleton", "Box", "Head marker", "Names", "Distance", "Filter team", "Radar", "FOV circle"],
      },
      {
        title: "Misc",
        items: ["FPS lock", "Save & export configs", "Streamproof (GeForce, OBS, Medal, and other capture software)"],
      },
    ],
    generalInfo: [
      "Aim behavior adjusts on the fly rather than sticking to one fixed setting.",
      "Alienware PCs are not supported.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: UPlay (Ubisoft Connect), Steam, Epic Games",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11 (up to 25H2)",
      "Full-screen mode: supported",
      "Streamproof: not compatible with Alienware PCs",
    ],
    variants: [
      keyVariant("r6s-vega", "day", "1 Day Key", 400),
      keyVariant("r6s-vega", "three-day", "3 Day Key", 800),
      keyVariant("r6s-vega", "week", "7 Day Key", 1600),
      keyVariant("r6s-vega", "month", "30 Day Key", 3000),
    ],
  },
  {
    ...r6Meta,
    badge: "Undetected",
    slug: "r6s-chams",
    name: "R6S Chams Wallhack",
    priceDisplay: `From ${money(350)}`,
    summary:
      "Lightweight Rainbow Six Siege wallhack focused purely on chams-based visibility through walls, built to stay low-impact on performance.",
    features: ["Chams wallhack", "Low performance impact"],
    featureGroups: [
      {
        title: "Visuals",
        items: ["Chams-based wallhack", "Enemy visibility through walls"],
      },
    ],
    generalInfo: [
      "A stripped-back option for players who only want wall visibility without a full feature set.",
      "Requires a USB flash drive as part of the NVIDIA-only setup path.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: UPlay (Ubisoft Connect), Steam, Epic Games",
      "CPU: Intel & AMD",
      "GPU: Nvidia only",
      "OS: Windows 10 (22H2), Windows 11 (22H2, 23H2, 24H2, 25H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
      "Requires a USB flash drive; Nvidia GPU only",
    ],
    variants: [
      keyVariant("r6s-chams", "day", "1 Day Key", 350),
      keyVariant("r6s-chams", "week", "7 Day Key", 1500),
      keyVariant("r6s-chams", "month", "30 Day Key", 3000),
    ],
  },
  {
    ...r6Meta,
    badge: "Undetected",
    slug: "r6s-lethal",
    name: "R6S Lethal (Full)",
    priceDisplay: `From ${money(1099)}`,
    summary:
      "The most complete Rainbow Six Siege package in the lineup, combining full ESP coverage, an aim suite, and utility tools in one internal build.",
    features: ["Full ESP suite", "Aimbot + misc aim tools", "Utility features"],
    featureGroups: [
      {
        title: "ESP",
        items: [
          "Player ESP",
          "Box ESP",
          "Skeleton ESP",
          "Line ESP (top, center, bottom)",
          "Distance ESP",
          "Name ESP",
          "Head dot ESP",
          "Health ESP (bar & text)",
          "Operator name ESP",
          "Operator icon ESP",
          "Team check",
          "Visibility check",
          "World ESP",
          "Grenade ESP",
          "Smoke ESP",
          "Stun ESP",
          "Drone ESP",
          "Barrier ESP",
          "Trap ESP",
          "Max distance filter",
        ],
      },
      {
        title: "Aimbot & Misc Aim",
        items: [
          "Active aimbot",
          "Anti-recoil",
          "View angle aim",
          "Distance limiter",
          "Aimbot smoothing",
          "Aim bone selection",
          "Aim key selection",
          "Shift head",
          "Targeting FOV",
          "Mark target",
          "Visibility check",
          "Force fire",
          "Target drones",
          "Draw FOV",
          "Static crosshair",
        ],
      },
      {
        title: "Misc",
        items: [
          "Display local coordinates",
          "No recoil",
          "Auto-save config",
          "Streamproof",
          "Internal cheat (no FPS drops)",
          "Full DX12 support",
          "Borderless & windowed support",
        ],
      },
    ],
    generalInfo: [
      "The full version of the lineup, built for players who want everything in one package.",
      "A few misc entries (spread reduction, skip reload animation, unlock all operators) are temporarily disabled.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: UPlay (Ubisoft Connect), Steam, Epic Games",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      keyVariant("r6s-lethal", "day", "1 Day Key", 1099),
      keyVariant("r6s-lethal", "week", "7 Day Key", 3299),
      keyVariant("r6s-lethal", "month", "30 Day Key", 5299),
      keyVariant("r6s-lethal", "year", "1 Year Key", 34999),
    ],
  },
  {
    ...r6Meta,
    badge: "Undetected",
    slug: "r6s-no-recoil",
    name: "R6S No Recoil Script",
    priceDisplay: `From ${money(300)}`,
    summary:
      "External no-recoil tool for Rainbow Six Siege with per-operator profiles and a live toggle overlay, built to run alongside any aim or ESP tool.",
    features: ["Recoil removal", "Per-operator profiles", "Toggle overlay"],
    featureGroups: [
      {
        title: "Key Features",
        items: [
          "Advanced recoil removal (vertical & horizontal)",
          "Real-time toggle",
          "Operator-based profiles",
          "In-game overlay",
          "External design",
          "Immediate license delivery",
          "Multi-language support (English, German, Russian)",
          "Low resource use",
        ],
      },
      {
        title: "Compatibility",
        items: [
          "Included setup tutorial",
          "Works alongside ESP, radar, and aimbots",
          "Custom hotkeys",
          "Runs silently",
          "Frequent updates",
          "Runs outside game memory space",
          "Adjustable recoil strength and sensitivity",
          "Instant profile switching mid-game",
        ],
      },
    ],
    generalInfo: [
      "A dedicated recoil tool meant to run alongside whatever cheat suite you're already using.",
      "Setup takes a few minutes with the included walkthrough.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: UPlay (Ubisoft Connect), Steam, Epic Games",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      keyVariant("r6s-no-recoil", "day", "1 Day Key", 300),
      keyVariant("r6s-no-recoil", "week", "7 Day Key", 1000),
      keyVariant("r6s-no-recoil", "month", "30 Day Key", 2000),
      keyVariant("r6s-no-recoil", "three-month", "90 Day Key", 3500),
    ],
  },
  {
    ...apexMeta,
    badge: "Undetected",
    slug: "apex-mason",
    name: "Apex - Mason",
    priceDisplay: `From ${money(400)}`,
    summary:
      "Full Apex Legends cheat with auto-tracking aimbot precision, detailed player and loot ESP, and instant configuration switching.",
    features: ["Aimbot", "Player & loot ESP", "Config switching"],
    featureGroups: [
      { title: "Aimbot", items: ["Auto-tracking precision", "FOV control", "Target selection"] },
      { title: "Visuals", items: ["Player ESP", "Loot ESP"] },
      { title: "Misc", items: ["Instant config switching", "HWID spoofer included"] },
    ],
    generalInfo: [
      "Loader must run from a USB flash drive; see the two-stage injection walkthrough on the instructions page.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Cheat type: Full Apex Legends cheat (aimbot, ESP, loot)",
      "Game: Apex Legends (Steam)",
      "OS: Windows 10 & 11 x64 (up to 25H2)",
      "Anti-cheat: Easy Anti-Cheat",
      "Stream-Proof: Yes (screenshots & recordings)",
      "Flashdrive required: Yes",
    ],
    variants: [
      keyVariant("apex-mason", "day", "1 Day Key", 400),
      keyVariant("apex-mason", "week", "7 Day Key", 2500),
      keyVariant("apex-mason", "month", "30 Day Key", 3280),
    ],
  },
  {
    ...apexMeta,
    badge: "Undetected",
    slug: "apex-ancient",
    name: "Apex Ancient",
    priceDisplay: `From ${money(300)}`,
    summary:
      "Apex Legends setup with aim tools, player ESP, and configuration sharing.",
    features: ["Aim support", "Player ESP", "Config sharing"],
    featureGroups: [
      { title: "Aimbot", items: ["Aim key", "Smooth", "FOV", "Target selection"] },
      { title: "Visuals", items: ["Player ESP", "Skeleton", "Distance", "Radar"] },
      { title: "Config", items: ["Save", "Load", "Share"] },
    ],
    generalInfo: [
      "Follow the full preparation and injection walkthrough on the instructions page before first launch.",
      ancientSetupNote,
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam, EA App, Origin",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11 (21H2, 22H2, 23H2, 24H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      keyVariant("apex-ancient", "day", "1 Day Key", 300),
      keyVariant("apex-ancient", "week", "7 Day Key", 1500),
      keyVariant("apex-ancient", "month", "30 Day Key", 3000),
    ],
  },
  {
    ...apexMeta,
    badge: "Undetected",
    slug: "apex-dullwave",
    name: "Apex - Dullwave",
    priceDisplay: `From ${money(390)}`,
    summary:
      "Undetected Apex Legends cheat with smooth aim assist and full player ESP, built for reliable ranked and pubs performance.",
    features: ["Aimbot", "Player ESP", "Low resource use"],
    featureGroups: [
      { title: "Aimbot", items: ["Enable aimbot", "Aim key", "FOV control", "Smoothing"] },
      { title: "ESP", items: ["Player ESP", "Distance info"] },
      { title: "Misc", items: ["Config save/load"] },
    ],
    generalInfo: [
      "Loader password is shared setup-wide; check the instructions page before first launch.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10 (1903-22H2), Windows 11 (21H2-25H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      keyVariant("apex-dullwave", "day", "1 Day Key", 390),
      keyVariant("apex-dullwave", "week", "7 Day Key", 1585),
      keyVariant("apex-dullwave", "month", "30 Day Key", 3000),
    ],
  },
  {
    ...apexMeta,
    badge: "Undetected",
    slug: "apex-arcane",
    name: "Apex - Arcane",
    priceDisplay: `From ${money(500)}`,
    summary:
      "Full-featured Apex Legends package with a tunable aimbot, distance-aware visuals, and stream-safe visibility checks.",
    features: ["Aimbot suite", "Player ESP", "Anti-detection prep"],
    featureGroups: [
      { title: "Aimbot", items: ["Enable aimbot", "FOV control", "Smoothing", "Target selection"] },
      { title: "Visuals", items: ["Player ESP", "Distance", "Visibility check"] },
      { title: "Misc", items: ["HWID spoofer prompt on first launch", "Config save/load"] },
    ],
    generalInfo: [
      "Requires the Visual C++ Redistributable and a PC restart before first launch; see the instructions page.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11",
      "Full-screen mode: not supported (windowed/borderless only)",
      "Stream-Proof: No",
    ],
    variants: [
      keyVariant("apex-arcane", "day", "1 Day Key", 500),
      keyVariant("apex-arcane", "week", "7 Day Key", 2000),
      keyVariant("apex-arcane", "month", "30 Day Key", 4000),
    ],
  },
  {
    ...categoryMeta("Counter-Strike 2"),
    badge: "Undetected",
    slug: "cs2-predator",
    name: "CS2 - Predator",
    priceDisplay: `From ${money(195)}`,
    summary:
      "Private Counter-Strike 2 cheat covering a fully configurable aimbot, pSilent aim, triggerbot, informative ESP, an inventory changer for skins/gloves/agents, and world settings like night mode, C4 timer, and grenade helpers.",
    features: ["Aimbot", "pSilent aim", "Triggerbot", "Player & item ESP", "Inventory changer"],
    featureGroups: [
      { title: "Aimbot", items: ["Aim mode & key (always / on key press)", "Hitbox & priority hitbox select", "FOV type & size, smoothing", "Auto wall, auto fire", "pSilent aim", "RCS (recoil control)"] },
      { title: "Player & Item ESP", items: ["Enemies/teammates wallhack", "Box, skeleton, name, health, armor, weapon", "Distance & status info", "Item box/ammo/weapon/chams ESP"] },
      { title: "Triggerbot", items: ["Bone select", "Hitchance", "Only-scope option", "Ignore smoke/flash"] },
      { title: "Inventory Changer", items: ["Unlock any skin, glove, or agent", "Seed, wear, StatTrak, souvenir control"] },
      { title: "World & Misc", items: ["Night mode, C4 timer, grenade helpers", "Trusted (safe) mode", "Config save/load", "Multi-language menu"] },
    ],
    generalInfo: [
      "Manage your subscription and download the loader from the Predator panel; check the instructions page before first launch.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11 (21H2, 22H2, 23H2, 24H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      keyVariant("cs2-predator", "day", "1 Day Key", 195),
      keyVariant("cs2-predator", "week", "7 Day Key", 350),
      keyVariant("cs2-predator", "month", "30 Day Key", 590),
      keyVariant("cs2-predator", "three-month", "90 Day Key", 1360),
    ],
  },
  {
    ...categoryMeta("Counter-Strike 2"),
    badge: "Undetected",
    slug: "cs2-arcane",
    name: "CS2 - Arcane Cheat",
    priceDisplay: `From ${money(195)}`,
    summary:
      "Full-featured Counter-Strike 2 package covering a configurable aimbot, 2D/3D player ESP, world item ESP, triggerbot, sniper scope styles, and an internal radar.",
    features: ["Configurable aimbot", "Player & item ESP", "Triggerbot", "Radar"],
    featureGroups: [
      { title: "Aimbot", items: ["Aim on teammate toggle", "Smooth factor & FOV radius", "Aim always / switch delay", "Bone select (head/neck/chest/stomach)", "Player lock & keybind"] },
      { title: "Player & Weapon ESP", items: ["2D/3D boxes with team colors", "Skeleton & joints", "Name, health, armor", "Snaplines, map callouts & distance", "Weapon type/icon/ammo"] },
      { title: "Items & Tools", items: ["World item ESP with custom colors per type", "Triggerbot (delay, scoped-only)", "Sniper scope styles", "Internal map radar"] },
      { title: "Misc", items: ["Bomb timer", "Anti-flash", "BunnyHop", "Recoil control", "Configs (save/load/delete)"] },
    ],
    generalInfo: [
      "Requires the Visual C++ Redistributable and a PC restart before first launch; see the instructions page.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11",
      "Full-screen mode: not supported (windowed/borderless only)",
      "Stream-Proof: No",
    ],
    variants: [
      keyVariant("cs2-arcane", "day", "1 Day Key", 195),
      keyVariant("cs2-arcane", "fifteen-day", "15 Day Key", 300),
      keyVariant("cs2-arcane", "month", "30 Day Key", 450),
    ],
  },
  {
    ...categoryMeta("Counter-Strike 2"),
    badge: "Undetected",
    slug: "cs2-strikeforce",
    name: "CS2 - Strikeforce",
    priceDisplay: `From ${money(130)}`,
    summary:
      "Counter-Strike 2 aimbot and wallhack with full recoil control, world ESP for bombs and drops, and a night mode radar setup.",
    features: ["Aimbot with RCS", "Player & world ESP", "Radar"],
    featureGroups: [
      { title: "Aimbot", items: ["FOV & smooth", "Check flash / ignore smoke", "Shot delay & after-kill delay", "RCS (recoil control) per weapon"] },
      { title: "Player ESP", items: ["Boxes & skeleton", "Health, names, weapon", "Eye direction & snaplines"] },
      { title: "World ESP", items: ["Dropped weapons & bombs", "Planted bomb timer", "Defuse kits", "Thrown grenades"] },
      { title: "Misc", items: ["Radar & recoil crosshair", "Spectator check", "NoFlash & night mode", "Config save/load, Chinese/Russian language"] },
    ],
    generalInfo: [
      "Loader password is shared setup-wide; check the instructions page before first launch.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11",
      "Full-screen mode: not supported (windowed/borderless only)",
      "Flashdrive required: Yes",
    ],
    variants: [
      keyVariant("cs2-strikeforce", "day", "1 Day Key", 130),
      keyVariant("cs2-strikeforce", "week", "7 Day Key", 215),
      keyVariant("cs2-strikeforce", "month", "30 Day Key", 360),
    ],
  },
  {
    ...categoryMeta("Counter-Strike 2"),
    badge: "Undetected",
    slug: "cs2-skinchanger",
    name: "CS2 - Skinchanger",
    priceDisplay: `From ${money(175)}`,
    summary:
      "Unlock any weapon, knife, or glove skin in Counter-Strike 2, with full control over wear, pattern, StarTrak, and custom item names.",
    features: ["Weapon/knife/glove changer", "Skin search & rarity filters", "Wear, pattern & StarTrak control"],
    featureGroups: [
      { title: "Inventory Changer", items: ["Weapon, knife & glove changer", "Search by category"] },
      { title: "Skins", items: ["Every in-game skin available", "Search by name", "Color filters by rarity"] },
      { title: "Item Options", items: ["Wear & pattern (paint seed)", "StarTrak counter", "Custom item name", "Add/remove items from list"] },
    ],
    generalInfo: [
      "Loader password is shared setup-wide; check the instructions page before first launch.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      keyVariant("cs2-skinchanger", "day", "1 Day Key", 175),
      keyVariant("cs2-skinchanger", "week", "7 Day Key", 300),
      keyVariant("cs2-skinchanger", "month", "30 Day Key", 600),
    ],
  },
  {
    ...categoryMeta("PUBG"),
    badge: "Undetected",
    slug: "pubg-arcane",
    name: "PUBG - Arcane Cheats",
    priceDisplay: `From ${money(500)}`,
    summary:
      "Full-featured PUBG package with a tunable aimbot, distance-aware visuals, and stream-safe visibility checks.",
    features: ["Aimbot suite", "Player ESP", "Anti-detection prep"],
    featureGroups: [
      { title: "Aimbot", items: ["Enable aimbot", "FOV control", "Smoothing", "Target selection"] },
      { title: "Visuals", items: ["Player ESP", "Distance", "Visibility check"] },
      { title: "Misc", items: ["HWID spoofer prompt on first launch", "Config save/load"] },
    ],
    generalInfo: [
      "This product is not compatible with laptops — a desktop PC is required.",
      "Requires the Visual C++ Redistributable and a PC restart before first launch; see the instructions page.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam, Kakao",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11",
      "Full-screen mode: not supported (windowed/borderless only)",
      "Stream-Proof: Yes",
      "Laptop compatible: No (desktop PC required)",
    ],
    variants: [
      keyVariant("pubg-arcane", "day", "1 Day Key", 500),
      keyVariant("pubg-arcane", "week", "7 Day Key", 2200),
      keyVariant("pubg-arcane", "month", "30 Day Key", 4000),
    ],
  },
  {
    ...categoryMeta("PUBG"),
    badge: "Undetected",
    slug: "pubg-shadow",
    name: "PUBG - Shadow",
    priceDisplay: `From ${money(220)}`,
    summary:
      "Full PUBG package covering player ESP, vehicle & airdrop tracking, loot detection, and a mini-map radar, with a free HWID spoofer included.",
    features: ["Player ESP", "Vehicle & airdrop ESP", "Loot ESP", "Radar"],
    featureGroups: [
      { title: "Player ESP", items: ["Boxes, skeleton & snaplines", "Visible check & bot detection", "Health, kill count & level", "Knocked-player tracking", "Max distance control"] },
      { title: "World & Loot ESP", items: ["Vehicles & airdrops with distance", "Dropped items, weapons & armor", "Scopes, attachments & meds", "Adjustable render distance"] },
      { title: "Misc", items: ["Spectator count", "Static crosshair", "Custom ESP colors & hotkeys", "Mini-map radar", "Free HWID spoofer included"] },
    ],
    generalInfo: [
      "Keep Windows Security enabled. If the loader is blocked or quarantined, stop and contact support.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10 (1903, 1909, 2004, 20H2, 21H1, 21H2, 22H2), Windows 11 (21H2, 22H2, 23H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      keyVariant("pubg-shadow", "day", "1 Day Key", 220),
      keyVariant("pubg-shadow", "week", "7 Day Key", 760),
      keyVariant("pubg-shadow", "month", "30 Day Key", 1520),
    ],
  },
  {
    ...categoryMeta("Delta Force"),
    badge: "Undetected",
    slug: "delta-force-dullwave",
    name: "Delta Force - Dullwave",
    priceDisplay: `From ${money(650)}`,
    summary:
      "Tactical Delta Force aimbot with humanized smoothing and target lock, paired with full player/bot ESP and a loot & economy ESP for fast progression.",
    features: ["Tactical aimbot", "Player & bot ESP", "Loot & economy ESP"],
    featureGroups: [
      { title: "Aimbot", items: ["Bind & bone select", "Humanize & dynamic smooth", "Aim lock & visible check", "Customizable FOV with draw overlay"] },
      { title: "Player & Bot ESP", items: ["Corner/2D/filled box styles", "Health bar & nickname", "Skeleton & snapline", "Level, distance & corpse ESP"] },
      { title: "Loot & Economy ESP", items: ["Price & rarity display", "Containers & weapon highlighting", "Min-price loot filter", "Separate distance sliders"] },
    ],
    generalInfo: [
      "Loader password is shared setup-wide; check the instructions page before first launch.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10 (1903, 1909, 2004, 20H1, 20H2, 21H1, 21H2, 22H2), Windows 11 (21H2, 22H2, 23H2, 24H2, 25H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
      "Flashdrive required: No",
    ],
    variants: [
      keyVariant("delta-force-dullwave", "day", "1 Day Key", 650),
      keyVariant("delta-force-dullwave", "three-day", "3 Day Key", 1300),
      keyVariant("delta-force-dullwave", "week", "7 Day Key", 2250),
      keyVariant("delta-force-dullwave", "month", "30 Day Key", 4240),
    ],
  },
  {
    ...categoryMeta("Delta Force"),
    badge: "Undetected",
    slug: "delta-force-ancient",
    name: "Delta Force - Ancient",
    priceDisplay: `From ${money(400)}`,
    summary:
      "Delta Force aimbot with static and curved aim modes plus a full player ESP and radar, including a built-in HWID spoofer and StreamProof protection.",
    features: ["Static/curved aimbot", "Player ESP & radar", "HWID spoofer included"],
    featureGroups: [
      { title: "Aimbot", items: ["Static or curved aim", "Dual aim keys", "FOV with draw overlay", "Bone select & nearest-bone", "Lock target (incl. knocked)"] },
      { title: "Player ESP & Radar", items: ["Box, skeleton & line ESP", "Health & name ESP", "Team check", "Mini-map radar with size control"] },
      { title: "Misc", items: ["StreamProof", "Built-in HWID spoofer", "English & Chinese language", "Custom colors & font size", "Config save/load"] },
    ],
    generalInfo: [
      "Follow the full preparation and injection walkthrough on the instructions page before first launch.",
      ancientSetupNote,
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam, Garena, Epic Games, Delta Force Launcher, Global",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11 (21H2, 22H2, 23H2, 24H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      keyVariant("delta-force-ancient", "day", "1 Day Key", 400),
      keyVariant("delta-force-ancient", "week", "7 Day Key", 2000),
      keyVariant("delta-force-ancient", "month", "30 Day Key", 4000),
    ],
  },
  {
    ...categoryMeta("Delta Force"),
    badge: "Undetected",
    slug: "delta-force-luna-chams",
    name: "Delta Force - Luna Chams",
    priceDisplay: `From ${money(2000)}`,
    summary:
      "High-end Delta Force chams package built exclusively for Intel systems, giving instant player visibility through any surface.",
    features: ["Player chams", "Intel-only build", "Instant visibility"],
    featureGroups: [
      { title: "Visuals", items: ["Player chams through walls", "Team check"] },
    ],
    generalInfo: [
      "Attention: Intel processors only — this build will not run on AMD systems. Open a Discord ticket for setup help.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam, WeGame",
      "CPU: Intel only",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      keyVariant("delta-force-luna-chams", "day", "1 Day Key", 2000),
      keyVariant("delta-force-luna-chams", "week", "7 Day Key", 10000),
      keyVariant("delta-force-luna-chams", "month", "30 Day Key", 20000),
    ],
  },
  {
    ...categoryMeta("Marvel Rivals"),
    badge: "Undetected",
    slug: "marvel-rivals-dullwave",
    name: "Marvel Rivals - Dullwave",
    priceDisplay: `From ${money(385)}`,
    summary:
      "Undetected Marvel Rivals cheat with a humanized aimbot, full player wallhack, and an industry-leading anti-detection system for stable, low-impact performance.",
    features: ["Humanized aimbot", "Player wallhack", "Anti-detection system"],
    featureGroups: [
      { title: "Aimbot", items: ["Bind & bone select", "Visible check (invisibles)", "Humanize & smooth", "FOV with draw overlay & color", "Snapline to target"] },
      { title: "Player ESP", items: ["2D/corner box styles", "Health bar & nickname", "Distance & skeleton", "Snapline & enemy-only toggle"] },
      { title: "Performance & Support", items: ["Zero FPS drop, low CPU/GPU use", "Ban-protection anti-detection", "Stable across maps/patches", "Easy install, 24/7 support"] },
    ],
    generalInfo: [
      "Loader password is shared setup-wide; check the instructions page before first launch.",
      ancientSetupNote,
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam, Epic Games (EGS)",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10 (2004, 20H1, 20H2, 21H1, 21H2, 22H2), Windows 11 (21H2, 22H2, 23H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
      "Flashdrive required: No",
    ],
    variants: [
      keyVariant("marvel-rivals-dullwave", "day", "1 Day Key", 385),
      keyVariant("marvel-rivals-dullwave", "week", "7 Day Key", 1585),
      keyVariant("marvel-rivals-dullwave", "month", "30 Day Key", 2915),
    ],
  },
  {
    ...categoryMeta("Marvel Rivals"),
    badge: "Undetected",
    slug: "marvel-rivals-predator",
    name: "Marvel Rivals - Predator",
    priceDisplay: `From ${money(300)}`,
    summary:
      "Subscription-managed Marvel Rivals cheat with a full vector aimbot, hero-aware wallhack, radar hack, and a built-in HWID spoofer, all handled through the Predator panel.",
    features: ["Vector aimbot", "Hero-aware wallhack", "Radar hack", "HWID spoofer included"],
    featureGroups: [
      { title: "Aimbot", items: ["Aim mode (always/hold key)", "Hitbox & priority select", "FOV type & smooth", "Prediction & visible check"] },
      { title: "Wallhack", items: ["Players & teammates", "Health bar & nickname", "Hero name & ultimate charge", "Box, skeleton & glow"] },
      { title: "Radar & Misc", items: ["Radar with out-of-view indicator", "StreamProof", "Built-in HWID spoofer", "Menu key & key bind list"] },
    ],
    generalInfo: [
      "Manage your subscription and download the loader from the Predator panel; check the instructions page before first launch.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11 (21H2, 22H2, 23H2, 24H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      keyVariant("marvel-rivals-predator", "day", "1 Day Key", 300),
      keyVariant("marvel-rivals-predator", "week", "7 Day Key", 800),
      keyVariant("marvel-rivals-predator", "month", "30 Day Key", 1700),
      keyVariant("marvel-rivals-predator", "three-month", "90 Day Key", 3500),
    ],
  },
  {
    ...categoryMeta("Marvel Rivals"),
    badge: "Undetected",
    slug: "marvel-rivals-shadow",
    name: "Marvel Rivals - Shadow",
    priceDisplay: `From ${money(430)}`,
    summary:
      "Marvel Rivals aimbot with vector and silent modes plus a full hero-aware wallhack, Lua scripting, skin changer, and a built-in HWID spoofer.",
    features: ["Vector/silent aimbot", "Hero-aware wallhack", "Skin changer & scripts", "HWID spoofer included"],
    featureGroups: [
      { title: "Aimbot & Combat", items: ["Vector & silent aimbot", "Aim mode (always/toggle/hold)", "Humanizer & smooth", "Triggerbot & spinbot", "Visible check & ignore teammate"] },
      { title: "Visuals (WH)", items: ["Box, glow & hero name", "Health & ultimate charge", "Distance to targets", "Health-pack & portal tracking"] },
      { title: "Other Shadow Features", items: ["Custom .lua scripts", "SkinChanger", "BunnyHop script", "Safe mode & built-in HWID spoofer"] },
    ],
    generalInfo: [
      "Loader password is shared setup-wide; check the instructions page before first launch.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam, POE Launcher",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11 (21H2, 22H2, 23H2, 24H2, 25H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      keyVariant("marvel-rivals-shadow", "day", "1 Day Key", 430),
      keyVariant("marvel-rivals-shadow", "week", "7 Day Key", 1230),
      keyVariant("marvel-rivals-shadow", "month", "30 Day Key", 2470),
    ],
  },
  {
    ...categoryMeta("Overwatch 2"),
    badge: "Undetected",
    slug: "overwatch2-mason",
    name: "Overwatch 2 - Mason",
    priceDisplay: `From ${money(510)}`,
    summary:
      "Overwatch 2 vector aimbot with adjustable FOV and sensitivity, paired with a 2D box ESP for enhanced enemy awareness.",
    features: ["Vector aimbot", "2D box ESP", "Team switch"],
    featureGroups: [
      { title: "Aimbot", items: ["Vector-based aiming", "Adjustable FOV", "Smoothing", "Sensitivity config", "Hold-key activation"] },
      { title: "Visuals", items: ["2D box ESP around enemies", "Aimbot FOV overlay"] },
    ],
    generalInfo: [
      "Loader must run from a USB flash drive; see the two-stage injection walkthrough on the instructions page.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam, Epic Games (EGS)",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10 (2004, 20H2, 21H1, 21H2, 22H2), Windows 11 (21H2, 22H2, 23H2)",
      "System architecture: 64-bit",
      "Full-screen mode: not supported (windowed/borderless only)",
      "Flashdrive required: Yes",
    ],
    variants: [
      keyVariant("overwatch2-mason", "day", "1 Day Key", 510),
      keyVariant("overwatch2-mason", "week", "7 Day Key", 1900),
      keyVariant("overwatch2-mason", "month", "30 Day Key", 3800),
    ],
  },
  {
    ...categoryMeta("Battlefield"),
    badge: "Undetected",
    slug: "battlefield-fecurity",
    name: "Battlefield - Fecurity",
    priceDisplay: `From ${money(800)}`,
    summary:
      "Battlefield aimbot with vectored and silent modes plus full player and vehicle ESP, covering enemy positions, health, and distance in real time.",
    features: ["Vectored/silent aimbot", "Player ESP", "Vehicle ESP"],
    featureGroups: [
      { title: "Aimbot", items: ["Vectored & silent aim", "Aim-at-shoot", "FOV with draw overlay", "Prediction & target switch delay", "Bone & hitbox priority"] },
      { title: "Player ESP", items: ["Enemy/visible-only filters", "Box ESP with outline", "Skeleton & health", "Name & distance"] },
      { title: "Vehicle ESP & Misc", items: ["Vehicle box, health & distance", "Custom ESP colors", "Distance unit toggle", "Built-in HWID spoofer"] },
    ],
    generalInfo: [
      "If the loader link isn't working, contact support in Discord for a mirror.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam, EA App, Origin, BF 2042, BF 5, BF 1",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11 (21H2, 22H2, 23H2, 24H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      keyVariant("battlefield-fecurity", "day", "1 Day Key", 800),
      keyVariant("battlefield-fecurity", "week", "7 Day Key", 3500),
      keyVariant("battlefield-fecurity", "month", "30 Day Key", 7000),
    ],
  },
  {
    ...categoryMeta("Battlefield"),
    badge: "Undetected",
    slug: "battlefield6-ancient",
    name: "Battlefield 6 - Ancient",
    priceDisplay: `From ${money(400)}`,
    summary:
      "Fully adjustable Battlefield 6 aimbot with pixel-precise control paired with a complete ESP suite and StreamProof protection for full battlefield awareness.",
    features: ["Adjustable aimbot", "Full ESP/wallhack", "StreamProof"],
    featureGroups: [
      { title: "Aimbot", items: ["FOV control", "Smoothing", "Target bones", "Prediction", "Hotkey support"] },
      { title: "ESP", items: ["Player positions", "Names", "Health", "Distance", "Vehicles"] },
      { title: "Misc", items: ["StreamProof", "Customizable crosshair", "FPS overlay", "Instant config loading"] },
    ],
    generalInfo: [
      "Loader password is shared setup-wide; check the instructions page before first launch.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam, EA App, Epic Games, Microsoft Store (Xbox)",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11 (21H2, 22H2, 23H2, 24H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      keyVariant("battlefield6-ancient", "day", "1 Day Key", 400),
      keyVariant("battlefield6-ancient", "week", "7 Day Key", 2000),
      keyVariant("battlefield6-ancient", "month", "30 Day Key", 4000),
    ],
  },
  {
    ...categoryMeta("Call of Duty"),
    badge: "Undetected",
    slug: "cod-lunar",
    name: "CoD - Lunar External",
    priceDisplay: `From ${money(500)}`,
    summary:
      "Undetected Call of Duty external cheat with precision aimbot, clear ESP, and a full radar, built streamproof for stability across Warzone and Black Ops titles.",
    features: ["External aimbot", "2D/3D ESP", "Loot ESP", "Full radar", "Streamproof"],
    featureGroups: [
      { title: "Aimbot", items: ["Bone select (head/neck/chest/nearest)", "Mouse & controller key binds", "Aim priority (bone or FOV)", "Prediction, smoothness & deadzone"] },
      { title: "ESP", items: ["2D/3D box with depth", "Bones & snap lines", "Health, distance, nickname & weapon", "Team toggle, thickness editor"] },
      { title: "Loot & Radar", items: ["Loot filters (armor, gasmasks, killstreaks, crates, stims)", "Loot distance cap", "Full radar for players, zombies & bots", "Custom per-entity radar distance"] },
      { title: "Configs & System", items: ["Unlock all cosmetics", "Config manager (save/load up to 3)", "Color editor", "Anti-record (hides overlay on screenshots/streams)"] },
    ],
    generalInfo: [
      "Loader link is sent via Discord after purchase; open a ticket if you don't receive it within a few minutes.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Battle.net, Steam",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11 (21H2, 22H2, 23H2, 24H2, 25H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      keyVariant("cod-lunar", "bo6-day", "Black Ops 6 - 1 Day Key", 500),
      keyVariant("cod-lunar", "bo6-week", "Black Ops 6 - 7 Day Key", 1500),
      keyVariant("cod-lunar", "bo6-month", "Black Ops 6 - 30 Day Key", 3000),
      keyVariant("cod-lunar", "bo7-day", "Black Ops 7 - 1 Day Key", 500),
      keyVariant("cod-lunar", "bo7-week", "Black Ops 7 - 7 Day Key", 1500),
      keyVariant("cod-lunar", "bo7-month", "Black Ops 7 - 30 Day Key", 3000),
    ],
  },
  {
    ...categoryMeta("Call of Duty"),
    badge: "Undetected",
    slug: "cod-dullwave",
    name: "CoD - Dullwave",
    priceDisplay: `From ${money(450)}`,
    summary:
      "Undetected Call of Duty cheat covering configurable aimbot targeting, a full wallhack with box/skeleton overlays, loot detection, and a real-time radar.",
    features: ["Configurable aimbot", "Player wallhack", "Loot ESP & radar"],
    featureGroups: [
      { title: "Aimbot", items: ["Body-part targeting", "Key bind activation", "Movement prediction", "FOV & smoothness", "Team-only / bot targeting toggle"] },
      { title: "ESP", items: ["Player & bot wallhack", "2D box / corner box styles", "Skeleton overlay & snaplines", "Health, distance & nickname"] },
      { title: "Loot, Radar & Misc", items: ["Armor, ammo & gas mask ESP", "Kill-streak visibility", "Radar overlay (bots, teams, distances)", "Field of view changer"] },
    ],
    generalInfo: [
      "Loader password is shared setup-wide; check the instructions page before first launch.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Battle.net, Steam",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10 (2004, 20H1, 20H2, 21H1, 21H2, 22H2), Windows 11 (21H2, 22H2, 23H2, 24H2, 25H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
      "Flashdrive required: No",
    ],
    variants: [
      keyVariant("cod-dullwave", "day", "1 Day Key", 450),
      keyVariant("cod-dullwave", "week", "7 Day Key", 1717),
      keyVariant("cod-dullwave", "month", "30 Day Key", 3314),
    ],
  },
  {
    ...categoryMeta("FragPunk"),
    badge: "Undetected",
    slug: "fragpunk-dullwave",
    name: "FragPunk - Dullwave",
    priceDisplay: `From ${money(465)}`,
    summary:
      "Undetected FragPunk cheat with a humanized aimbot and full player wallhack, backed by an industry-leading anti-detection system for stable performance.",
    features: ["Humanized aimbot", "Player wallhack", "Anti-detection system"],
    featureGroups: [
      { title: "Aimbot", items: ["Bind & bone select", "FOV with draw overlay", "Aim lock & humanize", "Invisibles (through obstacles)", "Smooth & max distance"] },
      { title: "Player ESP", items: ["2D/corner box styles", "Health bar & nickname", "Distance & skeleton", "Snapline to targets"] },
      { title: "Performance & Support", items: ["No FPS drop on weaker PCs", "Ban-protection anti-detection", "Stable across maps/patches", "Easy install, 24/7 support"] },
    ],
    generalInfo: [
      "Loader password is shared setup-wide; check the instructions page before first launch.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11 (21H2, 22H2, 23H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
      "Flashdrive required: No",
    ],
    variants: [
      keyVariant("fragpunk-dullwave", "day", "1 Day Key", 465),
      keyVariant("fragpunk-dullwave", "week", "7 Day Key", 1850),
      keyVariant("fragpunk-dullwave", "month", "30 Day Key", 3580),
    ],
  },
  {
    ...categoryMeta("Escape from Tarkov"),
    badge: "Undetected",
    slug: "eft-crusader",
    name: "EFT - Crusader",
    priceDisplay: `From ${money(500)}`,
    summary:
      "Balanced Escape from Tarkov aimbot and full ESP package built for consistent raid performance without going overboard.",
    features: ["Balanced aimbot", "Full ESP", "Raid awareness"],
    featureGroups: [
      { title: "Aimbot", items: ["Enable aimbot", "Aim key", "FOV control", "Smoothing"] },
      { title: "ESP", items: ["Player ESP", "Loot filters", "Distance info"] },
    ],
    generalInfo: [
      "Loader password is shared setup-wide; check the instructions page before first launch.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Battlestate Games Launcher",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11 (21H2, 22H2, 23H2, 24H2, 25H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      keyVariant("eft-crusader", "day", "1 Day Key", 500),
      keyVariant("eft-crusader", "week", "7 Day Key", 2600),
      keyVariant("eft-crusader", "month", "30 Day Key", 5000),
    ],
  },
  {
    ...categoryMeta("Escape from Tarkov"),
    badge: "Undetected",
    slug: "eft-superior",
    name: "EFT - Superior",
    priceDisplay: `From ${money(640)}`,
    summary:
      "Full-featured Escape from Tarkov package covering ESP, aimbot, wallhack, and misc tools alongside an included HWID spoofer.",
    features: ["Aimbot", "ESP & wallhack", "Misc tools", "HWID spoofer"],
    featureGroups: [
      { title: "Aimbot", items: ["Enable aimbot", "Aim key", "FOV control", "Smoothing"] },
      { title: "ESP", items: ["Player ESP", "Wallhack", "Loot filters", "Distance info"] },
      { title: "Misc", items: ["Misc tools", "HWID spoofer included"] },
    ],
    generalInfo: [
      "Loader password is shared setup-wide; check the instructions page before first launch.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Battlestate Games Launcher",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11 (21H2, 22H2, 23H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      keyVariant("eft-superior", "day", "1 Day Key", 640),
      keyVariant("eft-superior", "week", "7 Day Key", 3200),
      keyVariant("eft-superior", "month", "30 Day Key", 5120),
    ],
  },
  {
    ...categoryMeta("Escape from Tarkov"),
    badge: "Undetected",
    slug: "eft-sugar",
    name: "EFT - Sugar",
    priceDisplay: `From ${money(5120)}`,
    summary:
      "Feature-heavy Escape from Tarkov cheat with a built-in HWID spoofer, covering aimbot, full visual and loot ESP, and a wide exploit set for raid control.",
    features: ["Aimbot", "Player & loot ESP", "Exploits", "Built-in spoofer"],
    featureGroups: [
      { title: "Aimbot", items: ["Silent aimbot", "Bullet manipulation & instant hit", "Bone & target-role selection", "Autowall & autofire", "Max distance limit"] },
      { title: "Visuals - ESP", items: ["Player ESP & chams", "Skeleton, box, health, ammo, weapon ESP", "Render distance control"] },
      { title: "Loot ESP", items: ["Loot filter by category & price", "Containers, corpses & quest items", "Custom loot filters & colors"] },
      { title: "Misc & Exploits", items: ["No recoil, no spread, no sway", "Night/thermal vision, no weight", "Speedhack, bunnyhop, infinite stamina", "Built-in spoofer"] },
    ],
    generalInfo: [
      "Loader password is shared setup-wide; check the instructions page before first launch.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Battlestate Games Launcher (BSG)",
      "Anti-Cheat: BattlEye",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10 (20H1, 20H2, 21H1, 21H2, 22H2), Windows 11 (21H2, 22H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      unavailableVariant("eft-sugar", "day", "1 Day Key", 1400),
      keyVariant("eft-sugar", "week", "7 Day Key", 5120),
      keyVariant("eft-sugar", "month", "30 Day Key", 10230),
    ],
  },
  {
    ...categoryMeta("Escape from Tarkov"),
    badge: "Undetected",
    slug: "eft-sky",
    name: "EFT - Sky",
    priceDisplay: `From ${money(450)}`,
    summary:
      "Advanced Escape from Tarkov aimbot with configurable targeting and a clean player ESP overlay for private, raid-ready play.",
    features: ["Configurable aimbot", "Player ESP", "Box & skeleton overlay"],
    featureGroups: [
      { title: "Aimbot", items: ["Bone-specific targeting", "Key bind activation", "Movement prediction", "Adjustable FOV & smoothness", "Aim range limit"] },
      { title: "Visuals - ESP", items: ["Player wallhack", "Box highlighting (2D/corner, filled)", "Skeleton overlay", "Health info"] },
    ],
    generalInfo: [
      "Loader password is shared setup-wide; check the instructions page before first launch.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Steam, Battlestate Games Launcher",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11 (21H2, 22H2, 23H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      keyVariant("eft-sky", "day", "1 Day Key", 450),
      keyVariant("eft-sky", "week", "7 Day Key", 1530),
      keyVariant("eft-sky", "month", "30 Day Key", 2940),
    ],
  },
  {
    ...categoryMeta("Escape from Tarkov"),
    badge: "Undetected",
    slug: "eft-chams",
    name: "EFT - Chams+",
    priceDisplay: `From ${money(510)}`,
    summary:
      "Undetected Escape from Tarkov chams and loot cheat with no-recoil and infinite stamina options, built for lightweight, discreet raids.",
    features: ["Player chams", "Loot ESP", "No recoil", "Infinite stamina"],
    featureGroups: [
      { title: "Aimbot", items: ["Bone-specific targeting", "Key bind activation", "Movement prediction", "Adjustable FOV & smoothness"] },
      { title: "Loot & Misc", items: ["Loot ESP wallhack", "Show all nearby loot", "Item filter by category or name", "No recoil, infinite stamina (risky)", "Config file save"] },
    ],
    generalInfo: [
      "Loader password is shared setup-wide; check the instructions page before first launch.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: Battlestate Games Launcher (BSG)",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10 (2004, 20H1, 20H2, 21H1, 21H2, 22H2), Windows 11 (21H2, 22H2, 23H2)",
      "Full-screen mode: not supported (windowed/borderless only)",
    ],
    variants: [
      keyVariant("eft-chams", "day", "1 Day Key", 510),
      keyVariant("eft-chams", "week", "7 Day Key", 2050),
      keyVariant("eft-chams", "month", "30 Day Key", 3840),
    ],
  },
  {
    ...categoryMeta("Escape from Tarkov"),
    badge: "Undetected",
    slug: "eft-mason",
    name: "EFT - Mason",
    priceDisplay: `From ${money(555)}`,
    summary:
      "Full-control Escape from Tarkov cheat with auto-tracking aimbot precision, detailed player and loot ESP, and instant configuration switching.",
    features: ["Auto-tracking aimbot", "Player & loot ESP", "Recoil reduction", "Cloud configs"],
    featureGroups: [
      { title: "Aimbot", items: ["Auto-tracking aim", "Aim key, radius & smoothing", "Aim spot & auto switch target"] },
      { title: "Visualization", items: ["Player & dummy ESP", "Bounding box & snaplines", "Health bar overlay"] },
      { title: "Misc & Config", items: ["Reduce recoil (adjustable %)", "Menu, panic & battle-mode keys", "Save/load config via clipboard"] },
    ],
    generalInfo: [
      "A USB flash drive is required to run this loader; check the instructions page before first launch.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Cheat type: Full EFT cheat (Aimbot, ESP, Loot)",
      "Game version: Steam",
      "Anti-Cheat: Easy Anti-Cheat",
      "OS: Windows 10 & 11 x64 (up to 25H2)",
      "Stream-proof: Yes (screenshots & recordings)",
      "Flashdrive required: Yes (USB flash drive)",
    ],
    variants: [
      keyVariant("eft-mason", "day", "1 Day Key", 555),
      keyVariant("eft-mason", "week", "7 Day Key", 2225),
      keyVariant("eft-mason", "month", "30 Day Key", 5010),
    ],
  },
  {
    ...spooferMeta,
    badge: "Undetected",
    slug: "spoofer-lunar",
    name: "Spoofer - Lunar",
    supplier: "sellauth",
    supplierProductName: "Spoofer - Lunar",
    supplierProductAliases: ["Lunar Spoofer", "Lunar HWID Spoofer"],
    priceDisplay: `From ${money(500)}`,
    summary:
      "Universal temp HWID & TPM spoofer built to bypass bans, stay undetected, and protect your real hardware ID across all Windows versions.",
    features: ["Temp HWID spoof", "TPM spoof", "Universal Windows support"],
    featureGroups: [
      { title: "Coverage", items: ["Temp HWID spoof", "TPM spoof", "Optional seed change (F2)"] },
      { title: "Setup", items: ["BIOS TPM & virtualization steps", "Secure Boot check", "Loader activation"] },
    ],
    generalInfo: [
      "Does not currently support Rust or Fortnite. For COD Ranked, spoof once, restart your PC, then spoof again.",
      ...universalSetupNotes,
    ],
    requirements: ["Windows 10 / 11", "BIOS/UEFI access", "TPM & virtualization support"],
    variants: [
      keyVariant("spoofer-lunar", "day", "1 Day Key", 500, { supplierVariantName: "1 Day" }),
      keyVariant("spoofer-lunar", "week", "7 Day Key", 1500, { supplierVariantName: "7 Day" }),
      keyVariant("spoofer-lunar", "month", "30 Day Key", 3000, { supplierVariantName: "30 Day" }),
    ],
  },
  {
    ...spooferMeta,
    slug: "spoofer-shadow",
    name: "Spoofer - Shadow",
    supplier: "sellauth",
    supplierProductName: "Spoofer - Shadow",
    supplierProductAliases: ["Shadow Spoofer", "Shadow HWID Spoofer"],
    priceDisplay: `From ${money(200)}`,
    summary:
      "Lightweight, regularly updated temp HWID spoofer that works with EAC and BattleEye. Fast and easy to use across multiple games.",
    features: ["EAC & BattleEye support", "Lightweight", "Multi-game"],
    featureGroups: [
      { title: "Coverage", items: ["EAC (EasyAntiCheat)", "BE (BattleEye AC)"] },
    ],
    generalInfo: [
      "Keep Windows Security enabled. If the loader is blocked or quarantined, stop and contact support.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Game version: EAC (EasyAntiCheat), BE (BattleEye AC)",
      "CPU: Intel & AMD",
      "GPU: Nvidia & AMD",
      "OS: Windows 10, Windows 11 (21H2, 22H2, 23H2, 24H2, 25H2)",
    ],
    variants: [
      keyVariant("spoofer-shadow", "day", "1 Day Key", 200, { supplierVariantName: "1 Day" }),
      keyVariant("spoofer-shadow", "week", "7 Day Key", 740, { supplierVariantName: "7 Day" }),
      keyVariant("spoofer-shadow", "month", "30 Day Key", 1360, { supplierVariantName: "30 Day" }),
    ],
  },
  {
    ...spooferMeta,
    slug: "eac-be-spoofer",
    name: "EAC / BE Spoofer",
    supplier: "sellauth",
    supplierProductName: "EAC / BE Spoofer",
    supplierProductAliases: ["EAC BE Spoofer", "EAC/BE Spoofer", "Easy Anti-Cheat / BattlEye Spoofer"],
    priceDisplay: `From ${money(399)}`,
    summary:
      "Dedicated spoofer for EAC- and BattleEye-protected games, covering a clean hardware identity reset in one setup.",
    features: ["EAC & BattleEye coverage", "Clean identity reset"],
    featureGroups: [
      { title: "Coverage", items: ["EasyAntiCheat", "BattleEye"] },
    ],
    generalInfo: [
      "Open a support ticket if you are unsure about your Windows version compatibility.",
      ...universalSetupNotes,
    ],
    requirements: ["CPU: Intel & AMD", "OS: Windows 10 - Windows 11 (21H2, 22H2, 23H2)"],
    variants: [
      keyVariant("eac-be-spoofer", "day", "1 Day Key", 399, { supplierVariantName: "1 Day" }),
      keyVariant("eac-be-spoofer", "week", "7 Day Key", 999, { supplierVariantName: "7 Day" }),
      keyVariant("eac-be-spoofer", "month", "30 Day Key", 1999, { supplierVariantName: "30 Day" }),
    ],
  },
  {
    ...accountsMeta,
    badge: "Available",
    available: true,
    quantityLimit: 5,
    stripeFeeIncluded: true,
    slug: "r6s-nfa-account",
    name: "NFA Ranked Ready Prelinked",
    supplier: "sellauth",
    supplierProductName: "NFA Accounts",
    supplierProductAliases: ["NFA Ranked Ready Prelinked", "NFA Ranked Ready", "NFA Account", "R6S Accounts", "R6 Accounts", "Rainbow Six Siege Accounts"],
    priceDisplay: money(300),
    summary: "Ranked-ready prelinked NFA Rainbow Six Siege account with current availability checks.",
    features: ["Ranked-ready NFA account", "Prelinked account", "Current availability"],
    featureGroups: [
      { title: "Account", items: ["Non-Full Access (NFA)", "Ranked-ready", "Prelinked" ] },
      { title: "Availability", items: ["Available", "In stock", "Up to 5 accounts per order"] },
    ],
    generalInfo: [
      "This listing is currently available and in stock.",
      "Account details are released after the order is confirmed.",
    ],
    requirements: ["A valid Rainbow Six Siege account destination", "Maximum quantity: 5"],
    variants: [
      keyVariant("r6s-nfa-account", "account", "NFA Ranked Ready Prelinked", 300, {
        supplierVariantName: "NFA Ranked Ready Prelinked",
        supplierVariantAliases: ["NFA Accounts", "NFA Ranked Ready", "NFA Account", "Account", "R6S Account"],
        quantityLimit: 5,
        stripeFeeIncluded: true,
      }),
    ],
  },
  {
    ...r6Meta,
    badge: "Undetected",
    slug: "r6-aptitude",
    name: "Aptitude",
    supplier: "sellauth",
    supplierProductName: "Aptitude",
    priceDisplay: `From ${money(1199)}`,
    summary: "External Rainbow Six recoil and smart-trigger assistance delivered through a preconfigured account.",
    features: ["Adaptive recoil profiles", "Smart trigger assistance", "Rapid fire and quick peek"],
    featureGroups: [
      { title: "Recoil", items: ["Primary and secondary weapon profiles", "Attachment-aware control", "ADS sensitivity tuning", "Automatic weapon and operator detection"] },
      { title: "Smart AI", items: ["Multiple target-detection modes", "Angle-hold assistance", "Adjustable activation behavior", "Pixel and Glaz support"] },
      { title: "Extras", items: ["Rapid fire", "Quick peek", "Configurable hotkeys"] },
    ],
    generalInfo: ["This product is delivered as a preconfigured account rather than a standard activation key."],
    requirements: ["Windows 10 or Windows 11", "No direct game-memory connection", "Follow the delivered account instructions before launch"],
    variants: [
      keyVariant("r6-aptitude", "month-recoil", "1 Month Recoil Script", 1199, { supplierVariantName: "Month Recoil Script" }),
      keyVariant("r6-aptitude", "lifetime-recoil", "Lifetime Recoil Script", 2999, { supplierVariantName: "Lifetime Recoil Script" }),
      keyVariant("r6-aptitude", "month-smart-ai", "1 Month Smart AI", 2499, { supplierVariantName: "Month Smart AI" }),
      keyVariant("r6-aptitude", "lifetime-smart-ai", "Lifetime Smart AI", 5999, { supplierVariantName: "Lifetime Smart AI" }),
    ],
  },
  {
    ...r6Meta,
    badge: "Undetected",
    available: true,
    slug: "exodus-lite",
    name: "Exodus Lite",
    supplier: "sellauth",
    supplierProductName: "Exodus Lite",
    priceDisplay: `From ${money(299)}`,
    summary: "Lightweight Rainbow Six visual toolkit for player and gadget awareness without the full aim suite.",
    features: ["Player ESP", "Gadget ESP", "Configurable distance limits"],
    featureGroups: [
      { title: "Player ESP", items: ["Boxes and corner boxes", "Health, skeleton, and head marker", "Distance and snaplines", "Configurable display range"] },
      { title: "Gadget ESP", items: ["Drones and cameras", "Claymores and proximity alarms", "Hard-breach and bulletproof gadgets"] },
    ],
    generalInfo: ["Use the setup guide to verify Windows, BIOS, and graphics compatibility before running the loader."],
    requirements: ["Official Windows 10/11 Home or Pro (1909-25H2)", "BIOS virtualization enabled", "Integrated graphics disabled", "16 GB RAM", "Review current Windows update exclusions in the setup guide"],
    variants: [
      keyVariant("exodus-lite", "day", "1 Day Key", 299, { supplierVariantName: "Day" }),
      keyVariant("exodus-lite", "three-day", "3 Day Key", 599, { supplierVariantName: "3 Days" }),
      keyVariant("exodus-lite", "week", "7 Day Key", 1199, { supplierVariantName: "Week" }),
      keyVariant("exodus-lite", "month", "30 Day Key", 2499, { supplierVariantName: "Month" }),
    ],
  },
  {
    ...r6Meta,
    badge: "Undetected",
    available: true,
    slug: "r6s-exodus",
    name: "Exodus",
    supplier: "sellauth",
    supplierProductName: "Exodus",
    priceDisplay: `From ${money(399)}`,
    summary: "Full Rainbow Six package combining configurable aim assistance with player and gadget visuals.",
    features: ["Configurable aimbot", "Player ESP", "Complete gadget ESP"],
    featureGroups: [
      { title: "Aimbot", items: ["Adjustable FOV and smoothing", "Multiple hitboxes", "Kill delay", "Two aim keys"] },
      { title: "Player ESP", items: ["Box, line, distance, and skeleton", "Head and health display", "Team filtering"] },
      { title: "Gadget ESP", items: ["Live gadget identification", "Deployable and camera awareness"] },
    ],
    generalInfo: ["Confirm every compatibility requirement in the setup guide before opening the loader."],
    requirements: ["Official Windows 10/11 Home or Pro (1909-25H2)", "BIOS virtualization enabled", "Integrated graphics disabled", "16 GB RAM", "Review current Windows update exclusions in the setup guide"],
    variants: [
      keyVariant("r6s-exodus", "day", "1 Day Key", 399, { supplierVariantName: "Day" }),
      keyVariant("r6s-exodus", "three-day", "3 Day Key", 799, { supplierVariantName: "3 Days" }),
      keyVariant("r6s-exodus", "week", "7 Day Key", 1999, { supplierVariantName: "Week" }),
      keyVariant("r6s-exodus", "month", "30 Day Key", 3999, { supplierVariantName: "Month" }),
    ],
  },
  {
    ...r6Meta,
    badge: "Undetected",
    slug: "unlock-all",
    name: "Unlock All",
    supplier: "sellauth",
    supplierProductName: "Unlock All",
    supplierProductAliases: ["Sapphire: R6S Unlock All", "Sapphire"],
    priceDisplay: `From ${money(699)}`,
    summary: "Cosmetic unlock access covering a large collection of Rainbow Six operators, skins, charms, and limited items.",
    features: ["15,000+ cosmetics", "Operators and premium collections", "Rare and discontinued items"],
    featureGroups: [
      { title: "Cosmetics", items: ["Weapon and attachment skins", "Charms and operator cosmetics", "Released and selected unreleased items"] },
      { title: "Collections", items: ["Glacier and Gold Dust", "Esports and Pro League sets", "Rare and discontinued collections"] },
    ],
    generalInfo: ["Unlocked items are equipped through the supplied workflow; review the guide before making account changes."],
    requirements: ["Rainbow Six Siege account", "Windows PC", "Follow the supplied activation workflow"],
    variants: [
      keyVariant("unlock-all", "three-day", "3 Day Key", 699, { supplierVariantName: "3 Days" }),
      keyVariant("unlock-all", "week", "7 Day Key", 1499, { supplierVariantName: "Week" }),
      keyVariant("unlock-all", "month", "30 Day Key", 2999, { supplierVariantName: "Month" }),
    ],
  },
  {
    ...categoryMeta("DMA"),
    slug: "makcu",
    name: "MAKCU",
    supplier: "sellauth",
    supplierProductName: "MAKCU",
    checkoutError: "This hardware order could not be completed. Please contact support.",
    priceDisplay: money(2499),
    summary: "Low-latency hardware bridge for UART, mouse, and computer connectivity with plug-and-play operation.",
    features: ["Up to 1000 Hz", "Low-latency input", "UART and mouse connectivity"],
    featureGroups: [{ title: "Hardware", items: ["Custom controller hardware", "USB connectivity", "Plug-and-play setup", "Up to 1000 Hz polling"] }],
    generalInfo: ["This physical product is delivered after checkout. Confirm compatibility and shipping details before ordering if needed."],
    requirements: ["Available USB connection", "Compatible host and gaming computers"],
    variants: [keyVariant("makcu", "hardware", "MAKCU", 2499, { supplierVariantName: "MAKCU" })],
  },
  {
    ...categoryMeta("DMA"),
    slug: "fuser",
    name: "Dichen HDMI Fuser",
    supplier: "sellauth",
    supplierProductName: "Dichen HDMI Fuser",
    checkoutError: "This hardware order could not be completed. Please contact support.",
    priceDisplay: money(9999),
    summary: "EDID-injecting video fuser offered in HDMI and DisplayPort configurations for DMA setups.",
    features: ["Automatic EDID injection", "HDMI or DisplayPort", "Plug-and-play setup"],
    featureGroups: [{ title: "Supported output", items: ["1080p up to 240 Hz", "2560x1080 up to 200 Hz", "1440p up to 144 Hz", "3440x1440 up to 100 Hz", "4K up to 60 Hz"] }],
    generalInfo: ["Choose the connector that matches the intended monitor and capture layout. Delivery details appear after checkout."],
    requirements: ["Compatible HDMI or DisplayPort setup", "Secondary display/capture layout"],
    variants: [
      keyVariant("fuser", "display-port", "DisplayPort", 9999, { supplierVariantName: "Display Port" }),
      keyVariant("fuser", "hdmi", "HDMI", 9999, { supplierVariantName: "HDMI" }),
    ],
  },
  {
    ...categoryMeta("DMA"),
    slug: "dma-firmware",
    name: "DMA Firmware",
    supplier: "sellauth",
    supplierProductName: "DMA Firmware",
    priceDisplay: `From ${money(8999)}`,
    summary: "Firmware tiers for common anti-cheat environments, bound to the original DMA card hardware identity.",
    features: ["Multiple coverage tiers", "Hardware-bound license", "30-day firmware warranty"],
    featureGroups: [
      { title: "Basic", items: ["BattlEye", "FiveM", "Ricochet", "Javelin"] },
      { title: "Standard", items: ["Easy Anti-Cheat", "BattlEye", "FiveM", "Ricochet", "Javelin"] },
      { title: "Advanced+", items: ["Vanguard", "Easy Anti-Cheat", "BattlEye", "Ricochet", "Javelin"] },
    ],
    generalInfo: ["Firmware is tied to the original DMA card DNA, is not transferable, and includes a 30-day warranty."],
    requirements: ["Compatible DMA card", "Original card DNA/details", "Select the coverage tier required for the intended environment"],
    variants: [
      keyVariant("dma-firmware", "basic", "Basic Firmware", 8999, { supplierVariantName: "Basic Firmware" }),
      keyVariant("dma-firmware", "standard", "Standard Firmware", 22499, { supplierVariantName: "Standard Firmware" }),
      keyVariant("dma-firmware", "advanced-plus", "Advanced+ Firmware", 37999, { supplierVariantName: "Advanced+ Firmware" }),
    ],
  },
  {
    ...categoryMeta("DMA"),
    slug: "dma-card",
    name: "DMA Card",
    supplier: "sellauth",
    supplierProductName: "DMA Card",
    checkoutError: "This hardware order could not be completed. Please contact support.",
    priceDisplay: `From ${money(9999)}`,
    summary: "Artix-7 FPGA DMA hardware with a high-speed FT601 USB interface and USB-C flashing support.",
    features: ["Artix-7 FPGA", "FT601 USB 3.2 interface", "USB-C firmware flashing"],
    featureGroups: [{ title: "Hardware", items: ["Up to 200 MB/s transfer", "5 Gbps USB interface", "Tested before shipping", "Firmware sold separately"] }],
    generalInfo: ["This physical hardware does not include firmware unless explicitly stated. Delivery details appear after checkout."],
    requirements: ["Available PCIe slot", "Secondary PC or laptop", "USB 3.2 recommended", "Required cables and accessories"],
    variants: [
      keyVariant("dma-card", "75t-generic", "75T Generic DMA (No Firmware)", 9999, { supplierVariantName: "75T Generic DMA (NO FIRMWARE)" }),
      keyVariant("dma-card", "100t-premium", "100T Premium DMA (No Firmware)", 10999, { supplierVariantName: "100T DMA PREMIUM (NO FIRMWARE)" }),
    ],
  },
  {
    ...categoryMeta("DMA"),
    slug: "dma-bundle",
    name: "DMA Bundle",
    supplier: "sellauth",
    supplierProductName: "DMA Bundle",
    checkoutError: "This hardware order could not be completed. Please contact support.",
    priceDisplay: `From ${money(39999)}`,
    summary: "Complete DMA kit combining a card, fuser, MAKCU, standard firmware, cables, documentation, and setup support.",
    features: ["Complete hardware kit", "Standard firmware", "Cables and setup support"],
    featureGroups: [{ title: "Included", items: ["75T or 100T DMA card", "HDMI or DisplayPort fuser", "MAKCU", "Standard firmware", "Cables, documentation, and support"] }],
    generalInfo: ["Select both the DMA-card tier and fuser connector required for the intended setup. Delivery details appear after checkout."],
    requirements: ["Secondary PC or laptop", "Available PCIe slot", "Compatible monitor/capture layout"],
    variants: [
      keyVariant("dma-bundle", "75t-hdmi", "75T HDMI Bundle", 39999, { supplierVariantName: "75T HDMI Bundle" }),
      keyVariant("dma-bundle", "75t-dp", "75T DisplayPort Bundle", 39999, { supplierVariantName: "75T DP Bundle" }),
      keyVariant("dma-bundle", "100t-hdmi", "100T HDMI Bundle", 41999, { supplierVariantName: "100T HDMI Bundle" }),
      keyVariant("dma-bundle", "100t-dp", "100T DisplayPort Bundle", 41999, { supplierVariantName: "100T DP Bundle" }),
    ],
  },
];

/* Additional digital listings. The fulfillment connection stays server-side;
   storefront copy and pricing remain independent from the private routing. */
function rftVariantSlug(label) {
  return String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function rftVariantDisplayName(label) {
  if (label === "Steam") return "Steam Account";
  if (label === "One-Time Use") return label;
  return `${label} Key`;
}

function rftFeatures(name) {
  const value = String(name || "").toLowerCase();
  const features = ["Digital fulfillment", "Live availability visibility", "Balance-aware checkout"];
  if (/internal|external|cheat/.test(value)) features.unshift("Game-specific digital listing");
  if (/radar|esp/.test(value)) features.unshift("Visual-awareness focused listing");
  if (/spoofer/.test(value)) features.unshift("Spoofer workflow");
  if (/mod menu/.test(value)) features.unshift("Mod-menu workflow");
  if (/account|steam/.test(value)) features.unshift("Account delivery");
  if (/status rotator/.test(value)) features.unshift("Discord status automation");
  if (/android|ios/.test(value)) features.unshift("Mobile-compatible listing");
  return [...new Set(features)].slice(0, 5);
}

function rftRequirements(category, name) {
  const value = String(name || "").toLowerCase();
  if (/android|ios/.test(value)) {
    return ["Compatible mobile device", "The listed game installed", "Select the intended mobile term before checkout"];
  }
  if (/discord/.test(value)) {
    return ["A Discord account", "Access to the delivered app or bot workflow", "Select the intended subscription term before checkout"];
  }
  if (/account|steam/.test(value)) {
    return ["A compatible destination account", "Secure account handoff details", "Select the intended account listing before checkout"];
  }
  return [
    `Windows PC with ${category} installed`,
    "A compatible game or service account",
    "Select the intended term before checkout",
  ];
}

const rftLocalArtworkFiles = [
  "apex-akuma.jpg", "apex-raiko.jpg", "arc-raiders-akuma.jpg", "arc-raiders-ancient.jpg",
  "arc-raiders-arcane.jpg", "arc-raiders-skyra.jpg", "arc-raiders-spectre.jpg", "arc-raiders-yami.jpg",
  "battlefield-arcane.jpg", "bo7-ghost-external.jpg", "bo7-mist.jpg", "bo7-royal.jpg",
  "bo7-thunex.jpg", "bo7-wz-ghost-internal.jpg", "bo7-wz-mist-dma-cheat.jpg", "bo7-wz-shield.jpg",
  "bo7-wz-unlock-all.jpg", "bo7-wz-zeroaim.jpg", "bo7-zerox.jpg", "delta-force-akuma.jpg",
  "delta-force-toshi.jpg", "eft-ancient-chams.jpg", "eft-ancient.jpg", "fortnite-akuma.jpg",
  "fortnite-disconnect.jpg", "gta-v-arcane.jpg", "gta-v-lexis-mod.jpg", "gta-v.jpg",
  "marvel-rivals-arcane.jpg", "minecraft-drip-web-client.jpg", "minecraft-melonity.jpg", "minecraft.jpg",
  "pubg-ancient.jpg", "pubg-arcane.jpg", "rocket-league-chester-internal.jpg", "rocket-league.jpg",
  "rust-ancient.jpg", "rust-arcane.jpg", "rust-disconnect.jpg", "rust-skyra.jpg",
  "valorant-akuma-full.jpg", "valorant-shield-browser-radar.jpg", "valorant-shield.jpg",
  "valorant-trigger-bot.jpg", "valorant.jpg",
];

function rftNameTokens(value) {
  const ignored = new Set(["cheat", "internal", "external", "the", "and", "full"]);
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/)
    .filter((token) => token && !ignored.has(token));
}

function rftLocalArtwork(name, category) {
  const wanted = new Set(rftNameTokens(`${category} ${name}`));
  let best = null;
  let bestScore = 0;
  for (const file of rftLocalArtworkFiles) {
    const tokens = new Set(rftNameTokens(file.replace(/\.[^.]+$/, "")));
    const matched = [...tokens].filter((token) => wanted.has(token)).length;
    const unmatched = [...tokens].filter((token) => !wanted.has(token)).length;
    const score = matched * 10 - unmatched;
    if (score > bestScore) { best = file; bestScore = score; }
  }
  if (bestScore >= 20) return `/assets/rft-media/${best}`;
  const brand = rftNameTokens(name).find((token) =>
    ["ancient", "arcane", "akuma", "shield", "ghost", "disconnect", "mist", "skyra", "raiko", "spectre", "yami", "toshi", "thunex", "zerox", "zeroaim", "royal"].includes(token)
  );
  const brandFallback = brand && rftLocalArtworkFiles.find((file) => rftNameTokens(file).includes(brand));
  if (brandFallback) return `/assets/rft-media/${brandFallback}`;
  const categoryTokens = rftNameTokens(category);
  const categoryFallback = rftLocalArtworkFiles.find((file) =>
    categoryTokens.length && categoryTokens.every((token) => rftNameTokens(file).includes(token))
  );
  return categoryFallback ? `/assets/rft-media/${categoryFallback}` : "";
}

function rftDisplayName(name, category) {
  const aliases = {
    "Apex Legends": ["Apex Legends", "Apex"],
    "ARK: Survival Ascended": ["ARK Survival Ascended", "ARK Ascended", "ARK"],
    "Arena Breakout Infinite": ["Arena Breakout Infinite", "Arena Breakout", "ABI"],
    "Call of Duty": ["Call of Duty", "COD", "BO7", "BO6", "WZ", "MW2", "MW3", "MW19", "DMZ"],
    "Counter-Strike 2": ["Counter-Strike 2", "Counter Strike 2", "CS2", "CS"],
    "Dark and Darker": ["Dark and Darker", "Dark & Darker"],
    "Dead by Daylight": ["Dead by Daylight", "DBD"],
    "Discord Tools": ["Discord Tools", "Discord"],
    "Escape from Tarkov": ["Escape from Tarkov", "Tarkov", "EFT"],
    "Hunt: Showdown": ["Hunt Showdown", "Hunt: Showdown"],
    "Rainbow Six Siege": ["Rainbow Six Siege", "R6S"],
    "R.E.P.O.": ["R.E.P.O.", "R.E.P.O", "REPO"],
  };
  let result = String(name || "");
  for (const alias of aliases[category] || [category]) {
    const pattern = String(alias || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
    if (pattern) result = result.replace(new RegExp(`\\b${pattern}\\b`, "ig"), " ");
  }
  return result
    .replace(/\b(?:cheat|hack)\b/ig, " ")
    .replace(/\s*[:|–—]\s*/g, " ")
    .replace(/\s*\/\s*/g, " ")
    .replace(/\s+-\s+/g, " ")
    .replace(/^\s*[:|–—-]+|[:|–—-]+\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function rftProduct({
  slug,
  name,
  category,
  variants,
  status = "Undetected",
  artwork = "",
  download = "",
  docs = "",
  featured = false,
  testOnly = false,
  supplierProductAliases = [],
}) {
  const normalizedStatus = status || "Undetected";
  const statusIsUnavailable = ["updating", "offline"].includes(normalizedStatus.toLowerCase());
  const amounts = variants.map(([, amount]) => Math.round(amount * 100));
  const sourceDetails = rftSourceCatalog[slug] || {};
  const featureList = sourceDetails.features?.length ? sourceDetails.features : rftFeatures(name);
  const featureGroups = sourceDetails.featureGroups?.length
    ? sourceDetails.featureGroups
    : [
        { title: "Listing features", items: featureList },
        {
          title: "Availability",
          items: [
            "Status is shown on the product",
            "Availability is checked before checkout",
            "Account coverage is checked before fulfillment",
          ],
        },
      ];
  const displayName = rftDisplayName(name, category) || name;
  return {
    ...categoryMeta(category),
    supplier: "sellauth",
    supplierProductName: name,
    supplierProductAliases: [name, ...supplierProductAliases],
    slug,
    name: displayName,
    badge: normalizedStatus,
    available: !statusIsUnavailable,
    featured,
    testOnly: Boolean(testOnly),
    priceDisplay: variants.length === 1 ? money(amounts[0]) : `From ${money(Math.min(...amounts))}`,
    summary: `${displayName} with live status and availability checks before checkout.`,
    features: featureList,
    featureGroups,
    generalInfo: [
      "This listing is delivered digitally. The storefront checks availability, stock, and account coverage before an order can be created.",
      "Delivery and setup vary by product; use the matching inline guide section when one is available.",
    ],
    requirements: sourceDetails.requirements?.length
      ? sourceDetails.requirements
      : rftRequirements(category, name),
    artwork: rftLocalArtwork(name, category) || artwork,
    media: sourceDetails.media || [],
    videos: sourceDetails.videos || [],
    downloadHref: download,
    docsHref: docs,
    instructionHref: "/instructions/#digital-product-guides",
    variants: variants.map(([label, amount]) =>
      keyVariant(slug, rftVariantSlug(label), rftVariantDisplayName(label), Math.round(amount * 100), {
        supplierVariantName: label,
      })
    ),
  };
}

const rftArcaneDownload = "https://mega.nz/folder/SFEijIYB#ItpPdnVINK3H-rQXK6DJjw";
const rftArcaneDocs = "https://docs.google.com/document/d/1mdHKIddTJ1DcCcoxO4e1ai_J0bUho-Q0VFg9hQ09HAs/edit?tab=t.0#heading=h.7vk902ha5an";
const rftArcaneArtwork = "https://trixxware.com/uploads/monthly_2026_05/Arc_Raiders_Arcane.webp.c5af3754118e60b82572de0b4d726bb5.webp";
const rftDbdArtwork = "https://trixxware.com/uploads/monthly_2025_07/DeadByDaylight.jpg.ef9ae4225b1b81c1894e4fc30cdef984.jpg";
const rftAkumaDownload = "https://mega.nz/folder/ftADHAyb#yPaukCM0LP5zYL1wR46t4Q";
const rftAncientDownload = "https://gofile.io/d/7t9T2w";

const rftPanelProducts = [
  rftProduct({ slug: "spoofer-ghost-permanent", name: "Ghost: Perm Spoofer", category: "Spoofer", status: "Undetected", variants: [["One-Time Use", 16], ["Lifetime", 40]] }),
  rftProduct({ slug: "spoofer-diddy-temp", name: "Diddy Temp Spoofer", category: "Spoofer", status: "Undetected", variants: [["1 Day", 3], ["1 Week", 12], ["1 Month", 25], ["Lifetime", 90]] }),
  rftProduct({ slug: "spoofer-ghost-temp", name: "Ghost: Temp Spoofer (COD Ready)", category: "Spoofer", status: "Undetected", variants: [["1 Day", 3], ["1 Week", 10], ["1 Month", 20], ["Lifetime", 50]] }),
  rftProduct({ slug: "spoofer-torix-temp", name: "Torix: Temp Spoofer", category: "Spoofer", status: "Undetected", variants: [["1 Day", 3], ["3 Days", 6], ["1 Week", 14], ["1 Month", 30], ["Lifetime", 100]] }),
  rftProduct({ slug: "gta-v-arcane", name: "Arcane: GTA V Cheat", category: "GTA V", status: "Undetected", featured: true, artwork: "https://i.ibb.co/rDrXbg2/image.png", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["7 Days", 5.5], ["30 Days", 16.5], ["90 Days", 33]] }),
  rftProduct({ slug: "palworld-phantom", name: "Phantom: Palworld Internal Cheat", category: "Palworld", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/Palworld_Phantomn.webp.69a0152db4a71927c2a6dd6870d4c7f7.webp", download: "https://mega.nz/file/Ox41kI5b#rTqOYlJGkfOX-YrsOM1CrlPiyGHCNtfHc9COcyVsi4E", variants: [["1 Day", 2], ["1 Week", 6], ["1 Month", 12], ["Lifetime", 40]] }),
  rftProduct({ slug: "arc-raiders-arcane", name: "Arcane: ARC Raiders Cheat", category: "ARC Raiders", status: "Undetected", download: rftArcaneDownload, docs: "https://docs.google.com/document/d/1G0FXceLJ1RvIxUX8--tll-667gaILzkKG97ftfRtgtc/edit?tab=t.0#heading=h.7vk902ha5an", featured: true, variants: [["1 Day", 5.5], ["1 Week", 24.2], ["1 Month", 44]] }),
  rftProduct({ slug: "arc-raiders-ancient", name: "Ancient: ARC Raiders Cheat", category: "ARC Raiders", status: "Undetected", download: rftAncientDownload, docs: rftAncientDownload, variants: [["1 Day", 5], ["1 Week", 20], ["1 Month", 40]] }),
  rftProduct({ slug: "division-2-polar", name: "Polar: The Division 2 Internal", category: "The Division 2", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_01/Division-2-Trix.png.57634b375d6024ef1a21e66eefc105bb.png", download: "http://tiny.cc/vpl8101", variants: [["1 Week", 32], ["1 Month", 70]] }),
  rftProduct({ slug: "division-1-polar", name: "Polar: The Division 1 Internal", category: "The Division 1", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_04/Division-Trixx.png.ed8524e03d376bd2c1188cf0904db1de.png", download: "http://tiny.cc/xic2101", variants: [["1 Week", 32], ["1 Month", 70]] }),
  rftProduct({ slug: "valorant-shield-external", name: "Shield: Valorant External Cheat", category: "Valorant", status: "Testing", testOnly: true, supplierProductAliases: ["Shield", "Shield Valorant", "Valorant Shield", "Shield External"], artwork: "https://i.ibb.co/rGKnL4P8/image.jpg", download: "https://panelloader.com/ValSEC/", featured: true, variants: [["3 Days", 9.6], ["1 Week", 16], ["1 Month", 30.4]] }),
  rftProduct({ slug: "dead-by-daylight-raiko", name: "Raiko - Dead by Daylight Internal Cheat", category: "Dead by Daylight", status: "Undetected", artwork: rftDbdArtwork, download: "https://mega.nz/folder/fkZk2Yhb#34ZBBv2afccYgncfY0qpYw", variants: [["1 Day", 3.6], ["1 Week", 14], ["1 Month", 24]] }),
  rftProduct({ slug: "arc-raiders-browser-radar", name: "Arcane: ARC Raiders Browser Radar", category: "ARC Raiders", status: "Undetected", artwork: "https://i.ibb.co/DD5DhVf4/photo-5208842526373125120-y.jpg", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["3 Days", 5], ["15 Days", 20], ["1 Month", 40]] }),
  rftProduct({ slug: "left-4-dead-2-predator", name: "Predator: Left 4 Dead 2 Cheat", category: "Left 4 Dead 2", variants: [["1 Day", 2], ["1 Week", 5], ["1 Month", 8]] }),
  rftProduct({ slug: "forza-horizon-6-engine", name: "Forza Horizon 6: Engine Cheat", category: "Forza Horizon 6", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_06/f6-trixx-mist.webp.1ff1b49a1045f0a2b86540b34d2f43b4.webp", download: "https://mega.nz/file/i0oiGD5a#g_iTaLND5o58tFUQLJ4gsNRQTsUqYa_L6uGTUyV2sXg", variants: [["1 Day", 1], ["1 Week", 3], ["1 Month", 10], ["Lifetime", 20]] }),
  rftProduct({ slug: "meccha-chameleon-mimicry", name: "Mimicry: Meccha Chameleon Internal Cheat", category: "Meccha Chameleon", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_06/Meccha_Chameleon_Mimicry.webp.22484f59e93687c10d3a28f038eeb006.webp", download: "https://gofile.io/d/fJJvXI", variants: [["1 Day", 2], ["1 Week", 4], ["1 Month", 7], ["Lifetime", 10]] }),
  rftProduct({ slug: "among-us-eclipse", name: "Eclipse: Among Us Internal Cheat", category: "Among Us", status: "Undetected", artwork: "https://i.ibb.co/MrB4Pw6/image.png", download: "https://mega.nz/file/WphAnZ5S#173pcZy0l1DARJ_p8aC6NbWjqSj6Po2lxe2l3663r8A", variants: [["1 Day", 2], ["1 Week", 4], ["1 Month", 7], ["Lifetime", 10]] }),
  rftProduct({ slug: "repo-lucent", name: "Lucent: R.E.P.O Internal Cheat", category: "R.E.P.O.", status: "Undetected", artwork: "https://i.ibb.co/dw3jjwfY/repo1.png", download: "https://mega.nz/file/qwJyga5R#8js6Wpaei3bQaOchLSp2SYeR96_nbR-5QwfMYxeu6Y0", variants: [["1 Day", 2], ["1 Week", 4], ["1 Month", 7], ["Lifetime", 10]] }),
  rftProduct({ slug: "meccha-chameleon-krush", name: "Krush: Meccha Chameleon Internal Cheat", category: "Meccha Chameleon", status: "Undetected", download: "https://mega.nz/file/rRszhYRC#YJpDDtwcxW5WBh6NZQPToSx6APtJsZ8pq44vUm_ioAQ", variants: [["1 Day", 4], ["1 Week", 8], ["1 Month", 15]] }),
  rftProduct({ slug: "arc-raiders-akuma", name: "Akuma: ARC Raiders Internal Cheat", category: "ARC Raiders", status: "Updating", download: rftAkumaDownload, variants: [["1 Day", 6], ["1 Week", 15], ["1 Month", 45]] }),
  rftProduct({ slug: "valorant-shield-radar", name: "Shield: Valorant Browser Radar", category: "Valorant", status: "Undetected", artwork: "https://i.ibb.co/sdQGwNs9/image.png", download: "https://panelloader.com.br/ValRadar", variants: [["3 Days", 8], ["1 Week", 14], ["1 Month", 28]] }),
  rftProduct({ slug: "meccha-chameleon-painter", name: "Meccha Chameleon Auto Painter Cheat", category: "Meccha Chameleon", status: "Undetected", artwork: "https://i.ibb.co/Mk4PGm6C/meccha-auto-painter-1.webp", download: "https://mega.nz/file/L9hTUabY#0x5uQhnQBDaqpzrup94-wHBva-ml1X5hReEFyM722vs", variants: [["1 Day", 2], ["1 Week", 4], ["1 Month", 7], ["Lifetime", 10]] }),
  rftProduct({ slug: "rocket-league-chester", name: "Chester: Rocket League Internal Cheat", category: "Rocket League", status: "Undetected", artwork: "https://i.ibb.co/RTB0hSQt/image.png", download: "https://mega.nz/file/P8QgSCyZ#p1TiZ1QpawA78rllCXd1l6ab6y_wQO1VZTx0-w313_k", variants: [["1 Day", 4], ["1 Month", 20]] }),
  rftProduct({ slug: "nba-2k26-akuma", name: "Akuma: NBA 2K26 Internal Cheat", category: "NBA 2K26", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_07/NBA_2k26_Akuma.webp.12b7ac7e25c87effc7a553fefbb32afd.webp", download: rftAkumaDownload, variants: [["1 Week", 30], ["1 Month", 80]] }),
  rftProduct({ slug: "palworld-arcane", name: "Arcane: Palworld Cheat", category: "Palworld", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/Palworld_Phantomn.webp.69a0152db4a71927c2a6dd6870d4c7f7.webp", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Week", 5.5], ["1 Month", 16.5], ["3 Month", 38.5]] }),
  rftProduct({ slug: "omnicontrol-pro", name: "OmniControl Pro", category: "Utilities", status: "Undetected", download: "https://omnicontrol.me/api/download", docs: "https://omnicontrol.me/docs", variants: [["1 Month", 7], ["Lifetime", 30]] }),
  rftProduct({ slug: "mistfall-hunter-arcane", name: "Arcane: Mistfall Hunter Cheat", category: "Mistfall Hunter", status: "Undetected", artwork: rftArcaneArtwork, download: rftArcaneDownload, docs: "https://docs.google.com/document/d/1G0FXceLJ1RvIxUX8--tll-667gaILzkKG97ftfRtgtc/edit?tab=t.0#heading=h.7vk902ha5an", variants: [["1 Day", 5.5], ["1 Week", 24.2], ["1 Month", 44]] }),
  rftProduct({ slug: "wardogs-ancient", name: "Ancient: Wardogs Cheat", category: "Wardogs", status: "Undetected", artwork: "https://i.ibb.co/v43J912n/image-2026-08-21-16-05-48.png", download: rftAncientDownload, docs: rftAncientDownload, variants: [["1 Day", 3], ["1 Week", 15], ["1 Month", 30]] }),
  rftProduct({ slug: "wardogs-arcane", name: "Arcane: Wardogs Cheat", category: "Wardogs", status: "Undetected", artwork: "https://i.ibb.co/BVNJv6gW/Screenshot-3.png", download: rftArcaneDownload, docs: "https://docs.google.com/document/d/1G0FXceLJ1RvIxUX8--tll-667gaILzkKG97ftfRtgtc/edit?tab=t.0#heading=h.7vk902ha5an", variants: [["1 Day", 4.4], ["1 Week", 16.5], ["1 Month", 33]] }),
  rftProduct({ slug: "valorant-trigger-bot", name: "Valorant Trigger Bot", category: "Valorant", status: "Undetected", download: "http://loader.colortune.ru/", variants: [["1 Day", 5], ["1 Week", 12], ["1 Month", 24]] }),
  rftProduct({ slug: "valorant-esp", name: "Valorant ESP", category: "Valorant", status: "Undetected", artwork: "https://i.postimg.cc/HntXqyyz/image.png", download: "http://loader.colortune.ru/", variants: [["1 Day", 9], ["1 Week", 28], ["1 Month", 60]] }),
  rftProduct({ slug: "fresh-steams", name: "Fresh Steams", category: "Accounts", artwork: "https://trixxware.com/uploads/monthly_2025_08/Steam-Accounts.png.d4f406ce47be5738ff3d21b465199044.png", variants: [["Steam", 1]] }),
  rftProduct({ slug: "roblox-dx9ware", name: "Roblox - DX9WARE", category: "Roblox", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/Roblox_DX9WARE.webp.102df13515e8915aa07e4cc44c0d6b36.webp", download: "https://mega.nz/folder/O9x2nCwb#zXDFv8s61KL2lYsfRfNZ2g", variants: [["Lifetime", 20]] }),
  rftProduct({ slug: "gta-v-lexis", name: "GTA V - Lexis Mod Menu", category: "GTA V", status: "Undetected", download: "https://lexis.re/login", featured: true, variants: [["1 Month", 54]] }),
  rftProduct({ slug: "sea-of-thieves-arcane", name: "Arcane: Sea Of Thieves Cheat", category: "Sea of Thieves", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/SOT_Arcane.webp.439894f3088afacb0709de7f13cbdd4a.webp", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Day", 4.4], ["1 Week", 13.2], ["1 Month", 24.2]] }),
  rftProduct({ slug: "active-matter-arcane", name: "Arcane: Active Matter Cheat", category: "Active Matter", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/ActiveMatterArcane.webp.07c48bdc404da12d115097035edaa74d.webp", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Day", 5.5], ["1 Week", 24.2], ["1 Month", 44]] }),
  rftProduct({ slug: "ark-ascended-arcane", name: "Arcane: ARK Ascended Cheat", category: "ARK: Survival Ascended", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/ARK_2_Arcane.webp.9019cc6cd6e5eae9d474f4ef0b340a95.webp", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Day", 6.6], ["1 Week", 24.2], ["1 Month", 52.8]] }),
  rftProduct({ slug: "dark-and-darker-arcane", name: "Arcane: Dark & Darker Cheat", category: "Dark and Darker", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/DND_Arcane.webp.a260a3858e0f068c54cf8ad09c111165.webp", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Day", 3.3], ["1 Week", 6.6], ["1 Month", 13.2]] }),
  rftProduct({ slug: "dayz-arcane", name: "Arcane: DayZ Cheat", category: "DayZ", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/Dayz_Arcane.webp.e6c746183f4a1abb6ffaee40af716905.webp", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Day", 3.3], ["1 Week", 14.3], ["1 Month", 28.6]] }),
  rftProduct({ slug: "dead-by-daylight-arcane", name: "Arcane: Dead By Daylight Cheat", category: "Dead by Daylight", status: "Undetected", artwork: rftDbdArtwork, download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Day", 4.4], ["1 Week", 16.5], ["1 Month", 33]] }),
  rftProduct({ slug: "deadside-arcane", name: "Arcane: Deadside Cheat", category: "Deadside", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/Deadside_Arcane.webp.d8efcdad6ba5e05295d7c1128c9bb8d2.webp", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Day", 4.4], ["1 Week", 13.2], ["1 Month", 24.2]] }),
  rftProduct({ slug: "dune-awakening-arcane", name: "Arcane: Dune Awakening Cheat", category: "Dune Awakening", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/Dune_Awakening_Arcane.webp.a2e4b11fbc50f797f114698330859020.webp", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Day", 5.5], ["1 Week", 16.5], ["1 Month", 33]] }),
  rftProduct({ slug: "farlight-84-arcane", name: "Arcane: Farlight 84 Cheat", category: "Farlight 84", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/F84_Arcane.webp.e5eade9741f6f8b0201b7e5fff7e582f.webp", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Day", 3.3], ["1 Week", 6.6], ["1 Month", 13.2]] }),
  rftProduct({ slug: "hell-let-loose-arcane", name: "Arcane: Hell Let Loose Cheat", category: "Hell Let Loose", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/HLL_Arcane.webp.b89a0219ef7f44613b0656762984ead7.webp", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Day", 4.4], ["1 Week", 16.5], ["1 Month", 33]] }),
  rftProduct({ slug: "hunt-showdown-arcane", name: "Arcane: Hunt Showdown Cheat", category: "Hunt: Showdown", status: "Updating", artwork: "https://trixxware.com/uploads/monthly_2026_05/Hunt_Showdown_Arcane.webp.2886cfc555e95a47fba6bf8f9a720001.webp", download: rftArcaneDownload, docs: "https://docs.google.com/document/d/1G0FXceLJ1RvIxUX8--tll-667gaILzkKG97ftfRtgtc/edit?tab=t.0#heading=h.7vk902ha5an", variants: [["1 Day", 3.3], ["1 Week", 11], ["1 Month", 22]] }),
  rftProduct({ slug: "off-the-grid-arcane", name: "Arcane: Off The Grid Cheat", category: "Off The Grid", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/OTG_Arcane.webp.33368fefffce4ff3df28c4cf8b3896ef.webp", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Day", 3.3], ["1 Week", 11], ["1 Month", 22]] }),
  rftProduct({ slug: "scum-arcane", name: "Arcane: SCUM Cheat", category: "SCUM", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/Scum_Arcane.webp.a355ab6911d3b052f63535c98a8a505f.webp", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Day", 4.4], ["1 Week", 16.5], ["1 Month", 33]] }),
  rftProduct({ slug: "squad-arcane", name: "Arcane: Squad Cheat", category: "Squad", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/Squad_Arcane.webp.b534d4436b5b911af5dcffca9ba974c2.webp", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Day", 3.3], ["1 Week", 13.2], ["1 Month", 24.2], ["3 Months", 66]] }),
  rftProduct({ slug: "war-thunder-arcane", name: "Arcane: War Thunder Cheat", category: "War Thunder", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/War_Thunder_Arcane.webp.873179eac9c5f3af3f5eb4c832da22c3.webp", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Day", 5.5], ["1 Week", 19.8], ["1 Month", 38.5]] }),
  rftProduct({ slug: "the-finals-arcane", name: "Arcane: The Finals Cheat", category: "The Finals", status: "Updating", artwork: "https://trixxware.com/uploads/monthly_2025_07/TheFinals.jpg.9fa7fb62ab02d21e42bd81179d772aab.jpg", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Day", 5.5], ["1 Week", 24.2], ["1 Month", 44]] }),
  rftProduct({ slug: "arena-breakout-dullwave", name: "Arena Breakout Infinite: Dullwave External", category: "Arena Breakout Infinite", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2025_11/ABI-Trix.png.ab6e3b85fc72570802f23d620876c724.png", download: "https://dullwave.com/web/download/arena&request=start", featured: true, variants: [["1 Day", 11.2], ["1 Week", 32], ["1 Month", 58]] }),
  rftProduct({ slug: "arena-breakout-akuma", name: "Akuma - Arena Breakout Cheat (Full)", category: "Arena Breakout Infinite", status: "Undetected", download: rftAkumaDownload, docs: "https://unnamed-tech.gitbook.io/unnamedtech/tutorial-error-fix/arena-breakout-infinite-internal", variants: [["1 Day", 10], ["1 Week", 30], ["1 Month", 60]] }),
  rftProduct({ slug: "valorant-akuma-full", name: "Akuma - Valorant Cheat (Full)", category: "Valorant", status: "Undetected", artwork: "https://i.postimg.cc/gj21nL5G/image.png", download: rftAkumaDownload, docs: "https://unnamed-tech.gitbook.io/unnamedtech/tutorial-error-fix/valorant-external", variants: [["1 Day", 8], ["1 Week", 30], ["1 Month", 60]] }),
  rftProduct({ slug: "minecraft-melonity", name: "Minecraft: Melonity Cheat", category: "Minecraft", status: "Undetected", artwork: "https://i.ibb.co/VYzRhK9v/image.png", download: "https://melonity.gg/minecraft/profile", variants: [["1 Month", 10]] }),
  rftProduct({ slug: "minecraft-drip", name: "Minecraft - Drip Web Client", category: "Minecraft", status: "Undetected", download: "https://drip.gg/account", variants: [["1 Week", 17], ["1 Month", 35]] }),
  rftProduct({ slug: "arc-raiders-spectre", name: "Spectre: ARC Raiders Internal Cheat", category: "ARC Raiders", status: "Undetected", download: "https://codultimate.com/", variants: [["1 Day", 6], ["1 Week", 24], ["1 Month", 50]] }),
  rftProduct({ slug: "division-2-lexis", name: "The Division 2 - Lexis Internal Cheat", category: "The Division 2", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/Division_2_Lexis.webp.54194c5b20daf01ee373f2c701352c4e.webp", download: "https://lexis.re/login", variants: [["1 Week", 48], ["1 Month", 84], ["3 Months", 180]] }),
  rftProduct({ slug: "pioner-arcane", name: "Arcane: PIONER Cheat", category: "PIONER", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/Pioner_Arcane.webp.db3c1d3c1308dde9661b361e90e4e0de.webp", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Day", 3.3], ["1 Week", 13.2], ["1 Month", 24.2], ["3 Months", 66]] }),
  rftProduct({ slug: "midnight-walkers-arcane", name: "Arcane: The Midnight Walkers Cheat", category: "The Midnight Walkers", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/TMW_Arcane.webp.3e76f99ac991b21d6ff2309cfb828a8e.webp", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Day", 4.4], ["1 Week", 13.2], ["1 Month", 24.2]] }),
  rftProduct({ slug: "arma-reforger-arcane", name: "Arcane: ARMA Reforger Cheat", category: "ARMA Reforger", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/Arma_Reforger_Arcane.webp.8e11f5d4e4b76cd0fe93cb9d035c4862.webp", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Day", 5.5], ["1 Week", 24.2], ["1 Month", 44]] }),
  rftProduct({ slug: "humanitz-arcane", name: "Arcane: HumanitZ Cheat", category: "HumanitZ", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/HumanitZ_Arcane.webp.8d370ac4c9cca3d0993b9a05e18dd96f.webp", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Day", 4.4], ["1 Week", 13.2], ["1 Month", 24.2]] }),
  rftProduct({ slug: "first-descendant-arcane", name: "Arcane: The First Descendant Cheat", category: "The First Descendant", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/TFD_Arcane.webp.330e960932cff458c890dd4278c25809.webp", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Day", 4.4], ["1 Week", 13.2], ["1 Month", 24.2]] }),
  rftProduct({ slug: "arc-raiders-yami", name: "Yami: ARC Raiders External + Spoofer", category: "ARC Raiders", status: "Undetected", download: "https://gofile.io/d/W6IITS", variants: [["1 Day", 3], ["1 Week", 14], ["1 Month", 28], ["Lifetime", 100]] }),
  rftProduct({ slug: "discord-status-rotator-app", name: "Discord: Status Rotator App", category: "Discord Tools", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/Discord_Status_Rotator_App.webp.529526f0348b785bd9ad79e6ee1504b4.webp", download: "https://status-rotator.com/unb/app", docs: "https://status-rotator.com/unb/docs", variants: [["Lifetime", 14]] }),
  rftProduct({ slug: "discord-status-rotator-bot", name: "Discord: Status Rotator Bot", category: "Discord Tools", status: "Online", artwork: "https://trixxware.com/uploads/monthly_2026_05/Discord_Status_Rotator_Bot.webp.b76dd500f02d93950261940fa7faf03a.webp", download: "https://discord.com/oauth2/authorize?client_id=1222954796571430992", docs: "https://status-rotator.com/unb/docs", variants: [["1 Month", 4.6], ["1 Year", 28]] }),
  rftProduct({ slug: "fivem-ambani", name: "Ambani: FiveM Cheat", category: "FiveM", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/Fivem_Ambani.webp.b0114439aab271daecd368b724a08300.webp", download: "https://mega.nz/file/6xpn3LDR#K6xH6Qp8GZEhdJ71bAN_foOFLjBooCpf44-sjeP1ZnY", docs: "https://ambani.dev/auth/register", variants: [["1 Week", 15], ["1 Month", 22.5], ["Lifetime", 55]] }),
  rftProduct({ slug: "arc-raiders-skyra", name: "Skyra: ARC Raiders Cheat", category: "ARC Raiders", status: "Undetected", artwork: "https://i.ibb.co/qYnwfJMM/image.png", download: "https://flosense.xyz/", docs: "https://gofile.io/d/6jeeGa", variants: [["1 Day", 4], ["1 Week", 20], ["1 Month", 40]] }),
  rftProduct({ slug: "8-ball-pool-android", name: "AimKing: 8 Ball Pool Cheat (Android)", category: "8 Ball Pool", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/8-Ball-Pool-Android-1.webp.6c5bcb120338494f0ca569e9427ca1d1.webp", download: "https://www.mediafire.com/file/mxvkqlhdb0uw05s/8-ball-pool_56.19.0%2528akloadernl%2529.apk/file", docs: "https://www.mediafire.com/file/y4zzlq5kxmsm652/AKLoader-3.7.7-%2528arm32_and_arm64%2529.apk/file", variants: [["3 Days", 12], ["1 Week", 24], ["1 Month", 48]] }),
  rftProduct({ slug: "free-fire-fluorite", name: "Fluorite: Free Fire Mobile Cheat (iOS)", category: "Free Fire", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/Free_Fire_Fluorite.webp.d45a87a0856a2bfd0f258665e9825e2d.webp", download: "https://mega.nz/file/ygoH1ITL#OHcyGiQf0WUhOusgCGo-Td8xwFEBycywKzvmhzOll64", docs: "https://gofile.io/d/33rmKd", variants: [["1 Day", 7], ["1 Week", 28], ["1 Month", 48]] }),
  rftProduct({ slug: "8-ball-pool-ios", name: "Fluorite: 8 Ball Pool Cheat (iOS)", category: "8 Ball Pool", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2026_05/8-Ball-Pool-IOS.webp.9b254ed6579ee0da1ed100f60dce79b2.webp", download: "https://mega.nz/folder/K04TgaaC#5spg9T8G7W6MPhpe2fzOiA", docs: "https://gofile.io/d/33rmKd", variants: [["1 Day", 9], ["1 Week", 26], ["1 Month", 46]] }),
  rftProduct({ slug: "osu-pulse", name: "Pulse: Osu! External Cheat", category: "osu!", status: "Updating", artwork: "https://trixxware.com/uploads/monthly_2026_05/Osu_Pulse.webp.8650fc46813c435805eb9429a0d2cd13.webp", download: "https://mega.nz/file/sJMAyCYZ#y91f8UeZ-p3Aut_YeWXk15hwQAx9smZPq2aTuWkJRvw", variants: [["1 Day", 2], ["1 Week", 6], ["1 Month", 20]] }),
  rftProduct({ slug: "deadlock-predator", name: "Predator: Deadlock Cheat", category: "Deadlock", status: "Undetected", download: "https://predator.systems/panel/subscriptions", variants: [["1 Day", 4], ["1 Week", 12], ["1 Month", 26]] }),
  rftProduct({ slug: "conan-exiles-arcane", name: "Arcane: Conan Exiles Cheat", category: "Conan Exiles", status: "Undetected", artwork: "https://i.ibb.co/6RPMhvys/Screenshot-2026-05-27-142021.png", download: rftArcaneDownload, docs: rftArcaneDocs, variants: [["1 Day", 4.4], ["1 Week", 16.5], ["1 Month", 33]] }),
  rftProduct({ slug: "abi-radar-ancient", name: "Ancient: ABI Radar Cheat", category: "Arena Breakout Infinite", status: "Undetected", artwork: "https://trixxware.com/uploads/monthly_2025_11/ABI-Trix.png.ab6e3b85fc72570802f23d620876c724.png", variants: [["1 Day", 4.4], ["1 Week", 22], ["1 Month", 44]] }),
  // Additional RFT listings for game categories already present in the catalog.
  // Equivalent products already sold above are intentionally not duplicated.
  rftProduct({ slug: "apex-raiko", name: "Raiko: Apex Legends Internal Cheat", category: "Apex Legends", status: "Undetected", download: "https://mega.nz/folder/fkZk2Yhb#34ZBBv2afccYgncfY0qpYw", variants: [["1 Day", 6], ["1 Week", 20], ["1 Month", 40]] }),
  rftProduct({ slug: "apex-akuma", name: "Akuma: Apex Legends Internal Cheat", category: "Apex Legends", status: "Undetected", download: "https://mega.nz/folder/ftADHAyb#yPaukCM0LP5zYL1wR46t4Q", variants: [["1 Day", 6], ["1 Week", 15], ["1 Month", 45]] }),
  rftProduct({ slug: "rust-disconnect", name: "Disconnect - Rust", category: "Rust", status: "Testing", download: "https://lewislitt.life/Store/install.html", docs: "https://lewislitt.life/Store/Instructions.pdf", variants: [["1 Day", 8], ["3 Days", 16], ["1 Week", 28], ["1 Month", 50], ["Lifetime", 300]] }),
  rftProduct({ slug: "rust-ancient", name: "Ancient: Rust Cheat", category: "Rust", status: "Undetected", download: rftAncientDownload, variants: [["1 Day", 5.5], ["1 Week", 27.5], ["1 Month", 55]] }),
  rftProduct({ slug: "rust-skyra", name: "Skyra: Rust Cheat", category: "Rust", status: "Undetected", download: "https://flosense.xyz/", docs: "https://gofile.io/d/6jeeGa", variants: [["1 Day", 4], ["1 Week", 20], ["1 Month", 40]] }),
  rftProduct({ slug: "rust-arcane", name: "Arcane: Rust Cheat", category: "Rust", status: "Undetected", download: "https://mega.nz/folder/SFEijIYB#ItpPdnVINK3H-rQXK6DJjw", docs: "https://docs.google.com/document/d/1G0FXceLJ1RvIxUX8--tll-667gaILzkKG97ftfRtgtc/edit?tab=t.0#heading=h.7vk902ha5an", variants: [["1 Day", 6.6], ["3 Days", 16.5], ["1 Week", 33], ["1 Month", 66]] }),
  rftProduct({ slug: "fortnite-disconnect", name: "Disconnect - Fortnite", category: "Fortnite", status: "Testing", download: "https://cheezit.life/", docs: "https://lewislitt.life/Store/Instructions.pdf", variants: [["1 Day", 10], ["3 Days", 16], ["1 Week", 32], ["1 Month", 54]] }),
  rftProduct({ slug: "fortnite-akuma", name: "Akuma: Fortnite Internal Cheat", category: "Fortnite", status: "Use at own risk", download: "https://gofile.io/d/ALawtb", docs: "https://unnamed-tech.gitbook.io/unnamedtech/tutorial-error-fix/fortnite-internal", variants: [["1 Day", 8], ["1 Week", 20], ["1 Month", 50]] }),
  rftProduct({ slug: "pubg-arcane-browser-radar", name: "Arcane: PUBG Browser Radar", category: "PUBG", status: "Undetected", download: "https://mega.nz/folder/SFEijIYB#ItpPdnVINK3H-rQXK6DJjw", docs: "https://docs.google.com/document/d/1mdHKIddTJ1DcCcoxO4e1ai_J0bUho-Q0VFg9hQ09HAs/edit?tab=t.0#heading=h.7vk902ha5an", variants: [["1 Day", 3.3], ["1 Week", 17], ["1 Month", 34]] }),
  rftProduct({ slug: "pubg-ancient", name: "Ancient: PUBG Cheat", category: "PUBG", status: "Undetected", download: "https://mega.nz/folder/esIEhJgZ#vDIjzvsbDVzmtmRKdwaJ4g", variants: [["1 Day", 4.4], ["1 Week", 22], ["1 Month", 44]] }),
  rftProduct({ slug: "pubg-arcane-esp-no-recoil", name: "Arcane: PUBG ESP + No Recoil Cheat", category: "PUBG", status: "Undetected", download: "https://mega.nz/folder/SFEijIYB#ItpPdnVINK3H-rQXK6DJjw", docs: "https://docs.google.com/document/d/1kkKRjp9WLb52-RVty3PVmXOmmV87uJu_nYbbCkqtXfY/edit?tab=t.0#heading=h.7vk902ha5an", variants: [["3 Days", 5.5], ["15 Days", 19.8], ["1 Month", 38.5]] }),
  rftProduct({ slug: "pubg-arcane-blindspot", name: "Arcane: PUBG Blindspot Cheat", category: "PUBG", status: "Undetected", download: "https://mega.nz/folder/SFEijIYB#ItpPdnVINK3H-rQXK6DJjw", docs: "https://docs.google.com/document/d/1mdHKIddTJ1DcCcoxO4e1ai_J0bUho-Q0VFg9hQ09HAs/edit?tab=t.0#heading=h.7vk902ha5an", variants: [["1 Day", 4.4], ["1 Week", 16.5], ["1 Month", 33]] }),
  rftProduct({ slug: "delta-force-toshi", name: "Toshi: Delta Force Internal Cheat", category: "Delta Force", status: "Undetected", download: "https://mega.nz/folder/fkZk2Yhb#34ZBBv2afccYgncfY0qpYw", variants: [["1 Day", 4], ["1 Week", 20], ["1 Month", 40]] }),
  rftProduct({ slug: "delta-force-akuma", name: "Akuma: Delta Force Internal Cheat", category: "Delta Force", status: "Undetected", download: "https://mega.nz/folder/ftADHAyb#yPaukCM0LP5zYL1wR46t4Q", variants: [["1 Day", 7], ["1 Week", 20], ["1 Month", 50]] }),
  rftProduct({ slug: "marvel-rivals-arcane", name: "Arcane: Marvel Rivals Cheat", category: "Marvel Rivals", status: "Undetected", download: "https://mega.nz/folder/SFEijIYB#ItpPdnVINK3H-rQXK6DJjw", docs: "https://docs.google.com/document/d/1mdHKIddTJ1DcCcoxO4e1ai_J0bUho-Q0VFg9hQ09HAs/edit?tab=t.0#heading=h.7vk902ha5an", variants: [["1 Day", 4.4], ["1 Week", 16.5], ["1 Month", 33]] }),
  rftProduct({ slug: "battlefield6-arcane", name: "Arcane: Battlefield 6 Cheat", category: "Battlefield", status: "Undetected", download: "https://mega.nz/folder/SFEijIYB#ItpPdnVINK3H-rQXK6DJjw", docs: "https://docs.google.com/document/d/1mdHKIddTJ1DcCcoxO4e1ai_J0bUho-Q0VFg9hQ09HAs/edit?tab=t.0#heading=h.7vk902ha5an", variants: [["1 Day", 5.5], ["1 Week", 24.2], ["1 Month", 44]] }),
  rftProduct({ slug: "eft-ancient-chams", name: "Ancient: EFT Chams", category: "Escape from Tarkov", status: "Undetected", download: rftAncientDownload, docs: rftAncientDownload, variants: [["1 Day", 3.3], ["1 Week", 7.7], ["1 Month", 16.5]] }),
  rftProduct({ slug: "eft-ancient-full", name: "Ancient: EFT Full External", category: "Escape from Tarkov", status: "Undetected", download: rftAncientDownload, docs: rftAncientDownload, variants: [["1 Day", 5.5], ["1 Week", 27.5], ["1 Month", 55]] }),
  rftProduct({ slug: "cod-bo7-zeroaim", name: "BO7/WZ - ZeroAim External", category: "Call of Duty", status: "Undetected", download: "https://gofile.io/d/Wz94CQ", variants: [["1 Day", 4], ["1 Week", 12], ["1 Month", 24]] }),
  rftProduct({ slug: "cod-bo7-ghost-external", name: "BO7 - Ghost External + Spoofer", category: "Call of Duty", download: "https://gofile.io/d/eyuWQh", variants: [["1 Day", 3], ["1 Week", 10], ["1 Month", 20], ["Lifetime", 80]] }),
  rftProduct({ slug: "cod-bo7-ghost-internal", name: "BO7 - Ghost Internal + Spoofer", category: "Call of Duty", status: "Testing", download: "https://gofile.io/d/eyuWQh", variants: [["1 Day", 3], ["1 Week", 10], ["1 Month", 20], ["Lifetime", 80]] }),
  rftProduct({ slug: "cod-bo7-shield", name: "Shield: BO7 External Cheat", category: "Call of Duty", status: "Undetected", download: "https://panelloader.com/Shield/", variants: [["3 Days", 6], ["1 Week", 12], ["1 Month", 24]] }),
  rftProduct({ slug: "cod-bo7-mist", name: "Mist: BO7 External Cheat + Spoofer", category: "Call of Duty", download: "https://gofile.io/d/DswZJa", variants: [["1 Day", 4], ["1 Week", 12], ["1 Month", 24], ["Lifetime", 100]] }),
  rftProduct({ slug: "cod-bo7-zerox", name: "BO7: Zerox Internal Cheat (RAGE)", category: "Call of Duty", download: "https://gofile.io/d/PWxsxX", variants: [["1 Day", 5], ["1 Week", 12], ["1 Month", 24]] }),
  rftProduct({ slug: "cod-bo7-dma-mist", name: "Mist: BO7/WZ DMA Cheat", category: "Call of Duty", status: "Undetected", download: "https://gofile.io/d/DswZJa", variants: [["1 Day", 3], ["1 Week", 9], ["1 Month", 18], ["3 Months", 40], ["Lifetime", 80]] }),
  rftProduct({ slug: "cod-bo7-royal", name: "BO7: Royal External Cheat", category: "Call of Duty", status: "Updating", download: "https://gofile.io/d/qHBeJU", variants: [["1 Day", 5], ["1 Week", 10], ["1 Month", 24]] }),
  rftProduct({ slug: "cod-bo7-unlock-all", name: "BO7/WZ - Unlock All + Spoofer", category: "Call of Duty", download: "https://gofile.io/d/eyuWQh", variants: [["1 Day", 1], ["1 Week", 5], ["1 Month", 10], ["Lifetime", 20]] }),
  rftProduct({ slug: "cod-ldv4", name: "COD: LDV4 External (MW3-BO7)", category: "Call of Duty", status: "Undetected", download: "https://mega.nz/file/j1hkmbZI#KV5lGwHv0wYwyID_2P2f6p3yIHnZPyRij4pw70d9rm8", variants: [["1 Day", 7], ["1 Week", 24], ["1 Month", 44]] }),
  rftProduct({ slug: "cod-progress", name: "COD: Progress External (MW2-BO7)", category: "Call of Duty", status: "Undetected", download: "https://gofile.io/d/14XWib", variants: [["1 Day", 7], ["1 Week", 24], ["1 Month", 44]] }),
  rftProduct({ slug: "cod-bo7-thunex", name: "Thunex: BO7 External Cheat", category: "Call of Duty", download: "https://mega.nz/folder/r89TgQLb#lwDeuDq6RSJPBm5RPMXq3g", docs: "https://docs.signcod.com/call-of-duty-section/thunex-section/thunex-external/how-to-install-thunex#step-2-enter-license-key", variants: [["1 Day", 7], ["1 Week", 24], ["1 Month", 44]] }),
  rftProduct({ slug: "cod-bo6-ghost", name: "BO6 - Ghost External + Spoofer", category: "Call of Duty", download: "https://gofile.io/d/eyuWQh", variants: [["1 Day", 4], ["1 Week", 12], ["1 Month", 24], ["Lifetime", 120]] }),
  rftProduct({ slug: "cod-bo6-unlock-all", name: "BO6 - Unlock All + Spoofer", category: "Call of Duty", download: "https://gofile.io/d/eyuWQh", variants: [["1 Day", 1], ["1 Week", 5], ["1 Month", 10], ["Lifetime", 20]] }),
  rftProduct({ slug: "cod-mw2-zerox", name: "MW2/DMZ: Zerox Internal (RAGE)", category: "Call of Duty", status: "Undetected", download: "https://gofile.io/d/PWxsxX", variants: [["1 Day", 3], ["1 Week", 8], ["1 Month", 15]] }),
  rftProduct({ slug: "cod-mw2-grey", name: "MW2/DMZ: Grey Internal", category: "Call of Duty", status: "Undetected", download: "https://gofile.io/d/IeY7OO", variants: [["1 Day", 4], ["1 Week", 15], ["1 Month", 25]] }),
  rftProduct({ slug: "cod-mw3-ghost", name: "MW3 - Ghost Internal + Spoofer", category: "Call of Duty", status: "Undetected", download: "https://gofile.io/d/eyuWQh", variants: [["1 Day", 1.2], ["1 Week", 3.5], ["1 Month", 10], ["Lifetime", 24]] }),
  rftProduct({ slug: "cod-mw3-asura", name: "MW3 Asura Internal", category: "Call of Duty", status: "Offline", download: "https://gitbm3guglhontpdg0vt.com/", variants: [["1 Day", 4], ["1 Week", 14], ["1 Month", 28]] }),
  rftProduct({ slug: "cod-mw3-unlock-all", name: "MW3 - Unlock All + Spoofer", category: "Call of Duty", status: "Undetected", download: "https://gofile.io/d/eyuWQh", variants: [["1 Day", 0.5], ["1 Week", 2], ["1 Month", 4], ["Lifetime", 8]] }),
  rftProduct({ slug: "cod-mw19-ghost", name: "MW19 - Ghost Internal + Spoofer", category: "Call of Duty", status: "Buggy", download: "https://gofile.io/d/eyuWQh", variants: [["1 Day", 1.5], ["1 Week", 4], ["1 Month", 12], ["Lifetime", 30]] }),
  rftProduct({ slug: "cod-mw19-unlock-all", name: "MW19 - Unlock All + Spoofer", category: "Call of Duty", status: "Undetected", download: "https://gofile.io/d/eyuWQh", variants: [["1 Day", 0.5], ["1 Week", 2], ["1 Month", 4], ["Lifetime", 8]] }),
  rftProduct({ slug: "cod-ancient", name: "Ancient: COD External Cheat", category: "Call of Duty", status: "Undetected", download: rftAncientDownload, docs: rftAncientDownload, variants: [["1 Day", 4.4], ["3 Days", 8.8], ["1 Week", 14.3], ["1 Month", 34], ["3 Months", 68]] }),
  rftProduct({ slug: "cod-fecurity", name: "Fecurity - COD", category: "Call of Duty", status: "Undetected", download: "https://mega.nz/folder/ORsFGQDT#nOKWTNSs97e42MbQhuIoSg", variants: [["1 Day", 7], ["1 Week", 18], ["1 Month", 44]] }),
  rftProduct({ slug: "cod-noah", name: "COD: Noah Internal Cheat", category: "Call of Duty", status: "Undetected", download: "https://evolve.sx/", variants: [["1 Day", 5], ["1 Week", 17], ["1 Month", 40]] }),
];
/* Keep the storefront focused on the requested categories. The remaining
   panel inventory stays out of the storefront until it is explicitly selected
   for a later pass. */
const importantRftCategories = new Set([
  "Apex Legends",
  "Rust",
  "Fortnite",
  "PUBG",
  "Delta Force",
  "Marvel Rivals",
  "Battlefield",
  "Escape from Tarkov",
  "Call of Duty",
  "GTA V",
  "Valorant",
  "Minecraft",
  "Rocket League",
  "ARC Raiders",
  "Spoofer",
]);
/* Keep the storefront limited to the established game catalog. The owner can
   still inspect every RFT listing for those games without exposing unrelated
   game categories from the supplier panel. */
export const previewAllRftProducts = false;
const rftPanelProductSlugs = new Set(rftPanelProducts.map((product) => product.slug));
const rftAdditionalProducts = previewAllRftProducts
  ? rftPanelProducts
  : rftPanelProducts.filter((product) => importantRftCategories.has(product.category));

/* Explicit storefront scope. FragPunk and Overwatch are no longer offered.
   COD is limited to the current BO7 listings plus the two restored
   Cheats.Love listings below. Keeping this gate at the final catalog boundary
   also prevents stale source entries from reappearing through a supplier
   refresh. */
const hiddenStorefrontProductSlugs = new Set([
  "fragpunk-dullwave",
  "overwatch2-mason",
]);
const restoredCheatsLoveProductSlugs = new Set(["cod-lunar", "cod-dullwave"]);
function isStorefrontProduct(product) {
  if (hiddenStorefrontProductSlugs.has(product.slug)) return false;
  if (
    product.category === "Call of Duty"
    && !(previewAllRftProducts && rftPanelProductSlugs.has(product.slug))
    && !/^cod-bo7-/i.test(product.slug)
    && !restoredCheatsLoveProductSlugs.has(product.slug)
  ) return false;
  return true;
}

export const products = [...productCatalog, ...rftAdditionalProducts]
  .filter(isStorefrontProduct)
  .map((product) => previewAllRftProducts && rftPanelProductSlugs.has(product.slug)
    ? { ...product, available: true, testOnly: true }
    : product)
  .map((product) => {
  const variants = (product.variants || []).map((variant) => {
    const amount = priceForProduct(product.slug, variant.amount);
    return {
      ...variant,
      amount,
      priceDisplay: money(amount),
      originalPrice: variant.originalPrice
        ? money(priceForProduct(product.slug, variant.amount))
        : variant.originalPrice,
      cheatsLoveVariationId: cheatsLoveCatalog[product.slug]?.variants?.[variant.slug] || null,
    };
  });
  const minimumAmount = variants.length ? Math.min(...variants.map((variant) => variant.amount)) : 0;
  const priceDisplay = product.priceDisplay?.startsWith("From ")
    ? `From ${money(minimumAmount)}`
    : (variants.length === 1 ? money(variants[0].amount) : product.priceDisplay);

  return {
    ...product,
    name: rftDisplayName(product.name, product.category || product.game) || product.name,
    priceDisplay,
    cheatsLoveProductId: cheatsLoveCatalog[product.slug]?.productId || null,
    variants,
    generalInfo: [product.generalInfo?.[0] || defaultGeneralInfo],
    instructionHref: dedicatedRftGuideSlugs.has(product.slug)
      ? `/instructions/#${product.slug}/Dedicated%20setup`
      : (product.available === false ? "" : (product.instructionHref || `/instructions/#${product.slug}`)),
  };
  });
