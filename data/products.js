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

function keyVariant(productSlug, slug, name, amount, options = {}) {
  return {
    slug,
    name,
    stockLabel: options.stockLabel || "In Stock",
    priceDisplay: options.priceDisplay || money(amount),
    amount,
    inventorySlug: `${productSlug}-${slug}`,
    stripeEnvKey: options.stripeEnvKey || stripeEnvKey(productSlug, slug),
    checkoutBlocked: Boolean(options.checkoutBlocked),
    checkoutError: options.checkoutError || "",
  };
}

function unavailableVariant(productSlug, slug, name, amount) {
  return keyVariant(productSlug, slug, name, amount, {
    stockLabel: "0 In Stock",
    stripeEnvKey: `DISABLED_${stripeEnvKey(productSlug, slug)}`,
  });
}

function stockedButBlockedVariant(productSlug, slug, name, amount, stockCount) {
  return keyVariant(productSlug, slug, name, amount, {
    stockLabel: `${stockCount} ${stockCount === 1 ? "Key" : "Keys"} Available`,
    stripeEnvKey: `BLOCKED_${stripeEnvKey(productSlug, slug)}`,
    checkoutBlocked: true,
    checkoutError:
      "Error occurred. Please open a ticket in Discord so support can help you with this item.",
  });
}

function adjustedUnavailableVariant(productSlug, slug, name, baseAmount, multiplier) {
  return unavailableVariant(productSlug, slug, name, adjustAmount(baseAmount, multiplier));
}

function adjustedBlockedVariant(productSlug, slug, name, baseAmount, stockCount, multiplier) {
  return stockedButBlockedVariant(productSlug, slug, name, adjustAmount(baseAmount, multiplier), stockCount);
}

const r6Multiplier = 0.9;
const newProductMultiplier = 1.1;
const defaultGeneralInfo = "Open the setup instructions before using this product.";
const universalSetupNotes = [];

const r6Meta = {
  vendor: "Rainbow Six Siege",
  game: "Rainbow Six Siege",
  category: "Rainbow Six Siege",
  badge: "Online",
  featured: false,
  available: true,
};

const fortniteMeta = {
  vendor: "Fortnite",
  game: "Fortnite",
  category: "Fortnite",
  badge: "Online",
  featured: false,
  available: true,
};

const spooferMeta = {
  vendor: "Spoofer",
  game: "Spoofer",
  category: "Spoofer",
  badge: "Online",
  featured: false,
  available: true,
};

const accountsMeta = {
  vendor: "Accounts",
  game: "Accounts",
  category: "Accounts",
  badge: "Online",
  featured: false,
  available: true,
};

const productCatalog = [
  {
    ...r6Meta,
    slug: "crusader-r6",
    name: "Crusader R6",
    priceDisplay: `From ${money(adjustAmount(499, r6Multiplier))}`,
    summary:
      "A balanced R6 setup built for fast reads, aim tuning, and cleaner match awareness.",
    features: ["Trigger support", "Player info overlay", "Config profiles"],
    featureGroups: [
      {
        title: "Misc",
        items: ["Gadget ESP", "Hit damage effect", "Crosshair"],
      },
      {
        title: "Aimbot",
        items: ["Active aimbot", "Aimbot keys", "FOV size", "Hitboxes", "Sensitivity", "Mark target"],
      },
      {
        title: "Visuals",
        items: [
          "Player ESP",
          "ESP box",
          "ESP line",
          "Player distance",
          "Skeleton",
          "Player names",
          "Head hitbox selection",
          "Health bar",
        ],
      },
    ],
    generalInfo: [
      "Best for users who want a stronger assisted setup without a cluttered menu.",
      "Use support if you need help matching the build to your Windows version.",
      ...universalSetupNotes,
    ],
    requirements: ["CPU: Intel / AMD", "OS: Windows 10 / 11"],
    variants: [
      adjustedBlockedVariant("crusader-r6", "day", "1 Day Key", 499, 2, r6Multiplier),
      adjustedUnavailableVariant("crusader-r6", "week", "1 Week Key", 1999, r6Multiplier),
      adjustedUnavailableVariant("crusader-r6", "month", "1 Month Key", 3999, r6Multiplier),
    ],
  },
  {
    ...r6Meta,
    slug: "vega-r6-external",
    name: "Vega R6 External",
    priceDisplay: `From ${money(adjustAmount(499, r6Multiplier))}`,
    summary:
      "External R6 access focused on smooth aim control, readable visuals, and capture-friendly use.",
    features: ["External build", "Aimbot suite", "Streamproof support"],
    featureGroups: [
      {
        title: "Misc",
        items: [
          "FPS lock",
          "Save and export configs",
          "Streamproof for GeForce",
          "OBS support",
          "Medal support",
          "Game-capture software support",
        ],
      },
      {
        title: "Aimbot",
        items: [
          "Aim filter by crosshair and distance",
          "Smoothing",
          "FOV",
          "Distance check",
          "Multipoint bones",
          "Filter team",
        ],
      },
      {
        title: "Visuals",
        items: ["Skeleton", "Box", "Head marker", "Names", "Distance", "Filter team", "Radar", "FOV circle"],
      },
    ],
    generalInfo: [
      "Made for players who want an external-style setup with simple configuration.",
      "Recording and capture behavior can depend on your GPU and capture app.",
      ...universalSetupNotes,
    ],
    requirements: ["Windows 10", "Windows 11 21H2 - 25H2", "UEFI based motherboard"],
    variants: [
      adjustedBlockedVariant("vega-r6-external", "day", "1 Day Key", 499, 1, r6Multiplier),
      adjustedUnavailableVariant("vega-r6-external", "three-day", "3 Day Key", 999, r6Multiplier),
      adjustedUnavailableVariant("vega-r6-external", "week", "1 Week Key", 2499, r6Multiplier),
      adjustedUnavailableVariant("vega-r6-external", "month", "1 Month Key", 4999, r6Multiplier),
    ],
  },
  {
    ...r6Meta,
    slug: "r6-frost",
    name: "R6 Frost",
    priceDisplay: `From ${money(adjustAmount(999, r6Multiplier))}`,
    summary:
      "High-control R6 option with clean enemy reads, world information, and smooth performance tuning.",
    features: ["Optimized ESP", "Aim control", "Streamable setup"],
    featureGroups: [
      { title: "Memory aim" },
      { title: "Aimbot smoothing" },
      { title: "Closest bone to crosshair" },
      { title: "No recoil" },
      { title: "Player ESP" },
      { title: "World ESP" },
      { title: "Custom chams" },
      { title: "Streamable" },
    ],
    generalInfo: [
      "Built around clear information instead of heavy visual clutter.",
      "Good fit if you want aim support and ESP tools in one package.",
      ...universalSetupNotes,
    ],
    requirements: ["Windows 10: 20H2 to 22H2", "Windows 11: 21H2 to 25H2"],
    variants: [
      adjustedUnavailableVariant("r6-frost", "day", "1 Day Key", 999, r6Multiplier),
      adjustedUnavailableVariant("r6-frost", "week", "1 Week Key", 2999, r6Multiplier),
      adjustedUnavailableVariant("r6-frost", "month", "1 Month Key", 5500, r6Multiplier),
    ],
  },
  {
    ...r6Meta,
    slug: "r6-ancient",
    name: "R6 Ancient",
    priceDisplay: `From ${money(adjustAmount(349, r6Multiplier))}`,
    summary:
      "Config-heavy R6 access with aim options, visual tools, and operator ability controls.",
    features: ["Aim control", "Character abilities", "Full config"],
    featureGroups: [
      {
        title: "Aimbot",
        items: ["Enable", "Aim key", "FOV", "Smooth", "Sensitivity", "Target bone", "Nearest bone", "Target lock"],
      },
      {
        title: "Config",
        items: ["Save", "Load", "Delete", "Share"],
      },
      {
        title: "Visuals",
        items: ["Box", "Skeleton", "Skeleton thickness", "Lines", "Line thickness", "Health"],
      },
      {
        title: "Abilities",
        items: ["All characters", "Icon size control"],
      },
    ],
    generalInfo: [
      "Designed for people who like saving and adjusting detailed profiles.",
      "Some BIOS and Windows settings may need to be checked before setup.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Intel + AMD CPU",
      "Windows 10 - 11 | 1909 - 25H2",
      "SVM [AMD] / VT-X [INTEL] enabled in BIOS",
      "16GB RAM or more",
      "Hyper-V disabled for AMD CPU only",
      "Hyper-V enabled for Intel CPU only",
      "Firmware in UEFI mode only for Intel CPU",
      "GPT disk format only for Intel CPU",
      "Secure Boot disabled",
    ],
    variants: [
      adjustedUnavailableVariant("r6-ancient", "day", "1 Day Key", 349, r6Multiplier),
      adjustedUnavailableVariant("r6-ancient", "week", "7 Day Key", 1299, r6Multiplier),
      adjustedUnavailableVariant("r6-ancient", "month", "30 Day Key", 2799, r6Multiplier),
      adjustedUnavailableVariant("r6-ancient", "lifetime", "Lifetime Key", 29999, r6Multiplier),
    ],
  },
  {
    ...r6Meta,
    slug: "r6-recoil-private",
    name: "R6 Recoil Private",
    priceDisplay: `From ${money(adjustAmount(199, r6Multiplier))}`,
    summary:
      "Private R6 build centered on recoil control, basic aim help, and clean ESP visibility.",
    features: ["Private build", "ESP support", "Streamproof support"],
    featureGroups: [
      {
        title: "Aimbot",
        items: ["Smoothing", "FOV", "Distance check", "Bone selection"],
      },
      {
        title: "Visuals",
        items: ["Skeleton", "Box", "Health", "Distance", "Names"],
      },
      {
        title: "Misc",
        items: ["Streamproof", "Save and export configs"],
      },
    ],
    generalInfo: [
      "Simple option for users who want the core tools without a huge feature stack.",
      "Support can help confirm setup steps before you run it.",
      ...universalSetupNotes,
    ],
    requirements: ["Windows 10", "Windows 11 21H2 - 25H2", "UEFI based motherboard"],
    variants: [
      adjustedBlockedVariant("r6-recoil-private", "day", "1 Day Key", 199, 1, r6Multiplier),
      adjustedUnavailableVariant("r6-recoil-private", "week", "7 Day Key", 599, r6Multiplier),
      adjustedUnavailableVariant("r6-recoil-private", "month", "30 Day Key", 1999, r6Multiplier),
      adjustedUnavailableVariant("r6-recoil-private", "lifetime", "Lifetime Key", 2999, r6Multiplier),
    ],
  },
  {
    ...r6Meta,
    slug: "exodus-r6",
    name: "Exodus R6",
    priceDisplay: `From ${money(adjustAmount(299, r6Multiplier))}`,
    summary:
      "R6 access with aim assistance, visual support, and HWID-related setup coverage.",
    features: ["Aim support", "ESP support", "HWID support"],
    variants: [
      adjustedBlockedVariant("exodus-r6", "day", "1 Day Key", 299, 1, r6Multiplier),
      adjustedUnavailableVariant("exodus-r6", "three-day", "3 Day Key", 599, r6Multiplier),
      adjustedUnavailableVariant("exodus-r6", "week", "7 Day Key", 1299, r6Multiplier),
      adjustedUnavailableVariant("exodus-r6", "month", "30 Day Key", 1999, r6Multiplier),
    ],
    featureGroups: [
      {
        title: "Aimbot",
        items: ["Smoothing", "FOV", "Distance check"],
      },
      {
        title: "Visuals",
        items: ["Skeleton", "Box", "Health", "Distance", "Names"],
      },
      {
        title: "Misc",
        items: ["HWID spoofer support", "Save and export configs"],
      },
    ],
    generalInfo: [
      "This one can require a more careful setup than the lighter products.",
      "Open a support ticket if you are unsure about HWID or setup requirements.",
      ...universalSetupNotes,
    ],
    requirements: ["Windows 10", "Windows 11 21H2 - 25H2", "UEFI based motherboard"],
  },
  {
    ...r6Meta,
    slug: "invision-chams",
    name: "Invision Chams",
    priceDisplay: `From ${money(adjustAmount(299, r6Multiplier))}`,
    summary:
      "Visual-only R6 enhancement aimed at better clarity, awareness, and faster target recognition.",
    features: ["Visual clarity", "Low impact", "NVIDIA only"],
    featureGroups: [
      { title: "Clean visual enhancements for improved clarity" },
      { title: "Smooth performance with low system impact" },
      { title: "Updated often for stability and reliability" },
      { title: "Built to help with awareness, visibility, and faster response time" },
    ],
    generalInfo: [
      "Best for users who only want visual clarity tools instead of a full aim package.",
      "NVIDIA hardware is required for the intended setup path.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Requires a physical USB device or properly configured virtual USB",
      "Windows 11: 23H2 (22631), 24H2 (26100), 25H2 (26200)",
      "Windows 10: 22H2, limited build dependent",
      "Not supported: Windows 10 21H1 / 21H2",
      "NVIDIA GPUs only",
    ],
    variants: [
      adjustedUnavailableVariant("invision-chams", "day", "1 Day Key", 299, r6Multiplier),
      adjustedUnavailableVariant("invision-chams", "week", "7 Day Key", 1299, r6Multiplier),
      adjustedUnavailableVariant("invision-chams", "month", "1 Month Key", 2499, r6Multiplier),
    ],
  },
  {
    ...fortniteMeta,
    slug: "fortnite-full",
    name: "Fortnite Full",
    priceDisplay: `From ${money(adjustAmount(479, newProductMultiplier))}`,
    summary:
      "Full Fortnite access with aim tuning, visual awareness, and loot information in one setup.",
    features: ["Aimbot tools", "ESP visuals", "Loot awareness"],
    featureGroups: [
      { title: "Combat", items: ["Aim smoothing", "FOV control", "Target selection"] },
      { title: "Visuals", items: ["Player ESP", "Loot ESP", "Distance info"] },
      { title: "Config", items: ["Profiles", "Hotkeys", "Support-guided setup"] },
    ],
    generalInfo: [
      "Check your Windows version and game build before requesting setup support.",
      "Use a support ticket if you need help with fullscreen/windowed display behavior.",
      ...universalSetupNotes,
    ],
    requirements: ["Windows 10 / 11", "Administrator access", "Stable internet connection"],
    variants: [
      adjustedUnavailableVariant("fortnite-full", "day", "1 Day Key", 479, newProductMultiplier),
      adjustedUnavailableVariant("fortnite-full", "week", "7 Day Key", 1039, newProductMultiplier),
      adjustedUnavailableVariant("fortnite-full", "month", "30 Day Key", 2000, newProductMultiplier),
    ],
  },
  {
    ...fortniteMeta,
    slug: "fortnite-ancient",
    name: "Fortnite Ancient",
    priceDisplay: `From ${money(adjustAmount(319, newProductMultiplier))}`,
    summary:
      "Fortnite setup with advanced aim options, radar-style awareness, loot visuals, and config sharing.",
    features: ["Advanced aim", "Radar awareness", "Config sharing"],
    featureGroups: [
      { title: "Aimbot", items: ["Aim key", "Smooth", "FOV", "Trigger support"] },
      { title: "Visuals", items: ["Player ESP", "Loot ESP", "Radar"] },
      { title: "Config", items: ["Save profiles", "Load profiles", "Share settings"] },
    ],
    generalInfo: [
      "Best for users who want more configuration control than a simple preset product.",
      "Keep your setup details ready when opening a desk ticket.",
      ...universalSetupNotes,
    ],
    requirements: ["Windows 10 / 11", "Intel or AMD CPU", "Secure setup guidance recommended"],
    variants: [
      adjustedUnavailableVariant("fortnite-ancient", "day", "1 Day Key", 319, newProductMultiplier),
      adjustedUnavailableVariant("fortnite-ancient", "week", "7 Day Key", 1599, newProductMultiplier),
      adjustedUnavailableVariant("fortnite-ancient", "month", "30 Day Key", 3199, newProductMultiplier),
    ],
  },
  {
    ...spooferMeta,
    slug: "xim-spoofer",
    name: "Xim Spoofer",
    priceDisplay: `From ${money(adjustAmount(399, newProductMultiplier))}`,
    summary:
      "Hardware reset support for users who need a clean device-identity setup path across supported games.",
    features: ["Hardware reset support", "Multi-game support", "Guided setup"],
    featureGroups: [
      { title: "Coverage", items: ["Device reset flow", "Temporary and longer options", "Desk-assisted setup"] },
      { title: "Setup", items: ["Check Windows build", "Confirm motherboard mode", "Follow support notes"] },
      { title: "Aftercare", items: ["Restart guidance", "Status checks", "Ticket follow-up"] },
    ],
    generalInfo: [
      "This category can require careful system checks before use.",
      "Open a ticket before setup if you are unsure about your Windows or motherboard configuration.",
      ...universalSetupNotes,
    ],
    requirements: ["Windows 10 / 11", "UEFI motherboard preferred", "Administrator access"],
    variants: [
      adjustedUnavailableVariant("xim-spoofer", "day", "1 Day Key", 399, newProductMultiplier),
      adjustedUnavailableVariant("xim-spoofer", "three-day", "3 Day Key", 650, newProductMultiplier),
      adjustedUnavailableVariant("xim-spoofer", "week", "1 Week Key", 1376, newProductMultiplier),
      adjustedUnavailableVariant("xim-spoofer", "month", "1 Month Key", 2826, newProductMultiplier),
      adjustedUnavailableVariant("xim-spoofer", "lifetime", "Lifetime Key", 970, newProductMultiplier),
    ],
  },
  {
    ...accountsMeta,
    slug: "linked-nfa",
    name: "Linked NFA",
    priceDisplay: `From ${money(adjustAmount(479, newProductMultiplier))}`,
    summary:
      "Not full-access ranked-ready account option for users who want a quick account handoff.",
    features: ["NFA account", "Ranked-ready option", "Ticket delivery"],
    featureGroups: [
      { title: "Account", items: ["Linked account details", "NFA access", "Support handoff"] },
      { title: "Delivery", items: ["Ticket confirmation", "Account notes", "Follow-up support"] },
    ],
    generalInfo: [
      "Account products are delivered through support after review.",
      "Change any available security details immediately after receiving access.",
      ...universalSetupNotes,
    ],
    requirements: ["Member account", "Valid contact method", "Support ticket required"],
    variants: [
      adjustedUnavailableVariant("linked-nfa", "account", "Account", 479, newProductMultiplier),
    ],
  },
  {
    ...accountsMeta,
    slug: "stacked-pc-account",
    name: "Stacked PC Account",
    priceDisplay: `From ${money(adjustAmount(1599, newProductMultiplier))}`,
    summary:
      "Stacked linked Rainbow Six Siege PC account with ranked-ready inventory and account notes.",
    features: ["Stacked PC account", "Loaded inventory", "Ranked-ready"],
    featureGroups: [
      { title: "Account", items: ["Linked PC account", "Loaded inventory", "Ranked-ready status"] },
      { title: "Delivery", items: ["Ticket confirmation", "Account notes", "Follow-up support"] },
    ],
    generalInfo: [
      "Account products are delivered manually so support can verify the exact handoff details.",
      "Review all account notes before changing details or opening a follow-up ticket.",
      ...universalSetupNotes,
    ],
    requirements: ["Member account", "Valid contact method", "Support ticket required"],
    variants: [
      adjustedUnavailableVariant("stacked-pc-account", "account", "Account", 1599, newProductMultiplier),
    ],
  },
];

export const products = productCatalog.map((product) => ({
  ...product,
  generalInfo: [product.generalInfo?.[0] || defaultGeneralInfo],
  instructionHref: `/instructions/#${product.slug}`,
}));
