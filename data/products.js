function stripeEnvKey(productSlug, variantSlug) {
  return `STRIPE_PRICE_${productSlug}_${variantSlug}`
    .replace(/-/g, "_")
    .toUpperCase();
}

function keyVariant(productSlug, slug, name, amount) {
  return {
    slug,
    name,
    stockLabel: "In Stock",
    priceDisplay: `$${(amount / 100).toFixed(2)}`,
    amount,
    inventorySlug: `${productSlug}-${slug}`,
    stripeEnvKey: stripeEnvKey(productSlug, slug),
  };
}

function timedVariants(productSlug, prices) {
  return [
    keyVariant(productSlug, "day", "Day Key", prices.day),
    keyVariant(productSlug, "three-day", "3 Day Key", prices.threeDay),
    keyVariant(productSlug, "week", "Week Key", prices.week),
    keyVariant(productSlug, "month", "Month Key", prices.month),
  ];
}

const productCatalog = [
  {
    slug: "crusader-r6",
    name: "Crusader R6",
    vendor: "Rainbow Six Siege",
    game: "Rainbow Six Siege",
    category: "Rainbow Six Siege",
    priceDisplay: "From $4.99",
    badge: "Testing",
    summary: "Rainbow Six access route with quick checkout and post-purchase desk coverage.",
    features: ["Rainbow Six Siege", "Variant keys", "Activation support"],
    featured: false,
    available: false,
    variants: timedVariants("crusader-r6", {
      day: 499,
      threeDay: 999,
      week: 1999,
      month: 4299,
    }),
  },
  {
    slug: "void-r6",
    name: "Void R6",
    vendor: "Rainbow Six Siege",
    game: "Rainbow Six Siege",
    category: "Rainbow Six Siege",
    priceDisplay: "From $3.99",
    badge: "Testing",
    summary: "Currently unavailable on the public source catalog.",
    features: ["R6 listing", "Stock watch", "Desk updates"],
    featured: false,
    available: false,
    variants: timedVariants("void-r6", {
      day: 399,
      threeDay: 799,
      week: 1999,
      month: 3299,
    }),
  },
  {
    slug: "fragstate-r6",
    name: "Fragstate R6",
    vendor: "Rainbow Six Siege",
    game: "Rainbow Six Siege",
    category: "Rainbow Six Siege",
    priceDisplay: "From $4.99",
    badge: "Testing",
    summary: "R6 listing with partner routing and checkout-linked order tracking.",
    features: ["R6 listing", "Partner routed", "Order tracking"],
    featured: false,
    available: false,
    variants: timedVariants("fragstate-r6", {
      day: 499,
      threeDay: 1099,
      week: 2199,
      month: 4499,
    }),
  },
  {
    slug: "aptitude-ai-script-r6",
    name: "Aptitude AI Script R6",
    vendor: "Sellers Choice",
    game: "Rainbow Six Siege",
    category: "Rainbow Six Siege",
    priceDisplay: "From $11.99",
    badge: "Testing",
    summary: "Popular R6 script listing with priority placement in the catalog.",
    features: ["Sellers choice", "R6 script", "Priority listing"],
    featured: true,
    available: false,
    variants: timedVariants("aptitude-ai-script-r6", {
      day: 1199,
      threeDay: 1999,
      week: 3499,
      month: 5799,
    }),
  },
  {
    slug: "ancient-r6",
    name: "Ancient R6",
    vendor: "Rainbow Six Siege",
    game: "Rainbow Six Siege",
    category: "Rainbow Six Siege",
    priceDisplay: "From $4.99",
    badge: "Testing",
    summary: "Compact R6 listing for members who want a lower-range option.",
    features: ["R6 listing", "Compact range", "Desk support"],
    featured: false,
    available: false,
    variants: timedVariants("ancient-r6", {
      day: 499,
      threeDay: 899,
      week: 1599,
      month: 2999,
    }),
  },
  {
    slug: "titan-lite-r6",
    name: "Titan Lite R6",
    vendor: "Rainbow Six Siege",
    game: "Rainbow Six Siege",
    category: "Rainbow Six Siege",
    priceDisplay: "From $6.99",
    badge: "Testing",
    summary: "Broader R6 price range with delivery and activation follow-up.",
    features: ["R6 listing", "Wide range", "Activation help"],
    featured: false,
    available: false,
    variants: timedVariants("titan-lite-r6", {
      day: 699,
      threeDay: 2499,
      week: 5499,
      month: 13999,
    }),
  },
  {
    slug: "r6-accounts",
    name: "R6 Accounts",
    vendor: "Rainbow Six Siege",
    game: "Rainbow Six Siege",
    category: "Rainbow Six Siege",
    priceDisplay: "From $2.99",
    badge: "Testing",
    summary: "Account listing with member checkout and follow-up support.",
    features: ["Account listing", "Lowest entry", "Delivery follow-up"],
    featured: false,
    available: false,
    variants: [
      keyVariant("r6-accounts", "starter", "Starter Account", 299),
      keyVariant("r6-accounts", "standard", "Standard Account", 999),
      keyVariant("r6-accounts", "premium", "Premium Account", 2499),
    ],
  },
  {
    slug: "vega-r6",
    name: "Vega R6",
    vendor: "Rainbow Six Siege",
    game: "Rainbow Six Siege",
    category: "Rainbow Six Siege",
    priceDisplay: "From $4.99",
    badge: "Testing",
    summary: "R6 listing with clean checkout flow and ticket support if needed.",
    features: ["R6 listing", "Fast checkout", "Ticket support"],
    featured: false,
    available: false,
    variants: timedVariants("vega-r6", {
      day: 499,
      threeDay: 899,
      week: 1799,
      month: 3499,
    }),
  },
];

export const products = productCatalog.map((product) => ({
  ...product,
  badge: product.slug === "void-r6" ? "Available" : "Testing",
  available: product.slug === "void-r6",
}));
