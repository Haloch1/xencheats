function stripeEnvKey(productSlug, variantSlug) {
  return `STRIPE_PRICE_${productSlug}_${variantSlug}`
    .replace(/-/g, "_")
    .toUpperCase();
}

function keyVariant(productSlug, slug, name, amount, options = {}) {
  return {
    slug,
    name,
    stockLabel: options.stockLabel || "In Stock",
    priceDisplay: options.priceDisplay || `$${(amount / 100).toFixed(2)}`,
    amount,
    inventorySlug: `${productSlug}-${slug}`,
    stripeEnvKey: options.stripeEnvKey || stripeEnvKey(productSlug, slug),
  };
}

function testingVariant(productSlug, slug, name) {
  return keyVariant(productSlug, slug, name, 0, {
    stockLabel: "Testing",
    priceDisplay: "Testing",
    stripeEnvKey: `DISABLED_${stripeEnvKey(productSlug, slug)}`,
  });
}

const r6Meta = {
  vendor: "Rainbow Six Siege",
  game: "Rainbow Six Siege",
  category: "Rainbow Six Siege",
  badge: "Testing",
  featured: false,
  available: false,
};

const productCatalog = [
  {
    ...r6Meta,
    slug: "crusader-r6",
    name: "Crusader R6",
    priceDisplay: "From $3.99",
    summary:
      "Top-tier R6 Siege access with trigger tools, clean player info, and fast visual awareness.",
    features: ["Trigger support", "Player info overlay", "Config profiles"],
    variants: [
      testingVariant("crusader-r6", "day", "1 Day Key"),
      testingVariant("crusader-r6", "week", "1 Week Key"),
      testingVariant("crusader-r6", "month", "1 Month Key"),
    ],
  },
  {
    ...r6Meta,
    slug: "vega-r6-external",
    name: "Vega R6 External",
    priceDisplay: "From $3.99",
    summary:
      "External R6 setup with aim assistance, visual tools, and stream-friendly support.",
    features: ["External build", "Aim assistance", "Visual support"],
    variants: [
      testingVariant("vega-r6-external", "day", "1 Day Key"),
      testingVariant("vega-r6-external", "three-day", "3 Day Key"),
      testingVariant("vega-r6-external", "week", "1 Week Key"),
      testingVariant("vega-r6-external", "month", "1 Month Key"),
    ],
  },
  {
    ...r6Meta,
    slug: "r6-frost",
    name: "R6 Frost",
    priceDisplay: "From $7.99",
    summary:
      "Smooth Rainbow Six Siege tool focused on optimized visuals, aim control, and clean in-game information.",
    features: ["Optimized visuals", "Aim control", "Clean ESP"],
    variants: [
      testingVariant("r6-frost", "day", "1 Day Key"),
      testingVariant("r6-frost", "week", "1 Week Key"),
      testingVariant("r6-frost", "month", "1 Month Key"),
    ],
  },
  {
    ...r6Meta,
    slug: "r6-ancient",
    name: "R6 Ancient",
    priceDisplay: "From $2.79",
    summary:
      "Ancient R6 access with aim tools, visual awareness, ability support, and full config control.",
    features: ["Aim tools", "Visual awareness", "Full config"],
    variants: [
      testingVariant("r6-ancient", "day", "1 Day Key"),
      testingVariant("r6-ancient", "week", "7 Day Key"),
      testingVariant("r6-ancient", "month", "30 Day Key"),
      testingVariant("r6-ancient", "lifetime", "Lifetime Key"),
    ],
  },
  {
    ...r6Meta,
    slug: "r6-recoil-private",
    name: "R6 Recoil Private",
    priceDisplay: "From $1.59",
    summary:
      "Private Rainbow Six Siege access with recoil support, ESP tools, and streamlined setup.",
    features: ["Recoil support", "ESP tools", "Private setup"],
    variants: [
      testingVariant("r6-recoil-private", "day", "1 Day Key"),
      testingVariant("r6-recoil-private", "week", "7 Day Key"),
      testingVariant("r6-recoil-private", "month", "30 Day Key"),
      testingVariant("r6-recoil-private", "lifetime", "Lifetime Key"),
    ],
  },
  {
    ...r6Meta,
    slug: "exodus-r6",
    name: "Exodus R6",
    priceDisplay: "From $2.39",
    badge: "Available",
    summary:
      "Exodus Rainbow Six Siege access with aim support, ESP, and HWID spoofer support.",
    features: ["Aim support", "ESP support", "HWID support"],
    available: true,
    variants: [
      keyVariant("exodus-r6", "day", "1 Day Key", 239, {
        stripeEnvKey: "STRIPE_PRICE_EXODUS_R6_DAY",
      }),
      testingVariant("exodus-r6", "three-day", "3 Day Key"),
      testingVariant("exodus-r6", "week", "7 Day Key"),
      testingVariant("exodus-r6", "month", "30 Day Key"),
    ],
  },
  {
    ...r6Meta,
    slug: "invision-chams",
    name: "Invision Chams",
    priceDisplay: "From $2.39",
    summary:
      "Clean visual chams built for clarity, awareness, and quicker response time.",
    features: ["Visual chams", "Cleaner awareness", "Fast response"],
    variants: [
      testingVariant("invision-chams", "day", "1 Day Key"),
      testingVariant("invision-chams", "week", "7 Day Key"),
      testingVariant("invision-chams", "month", "1 Month Key"),
    ],
  },
];

export const products = productCatalog;
