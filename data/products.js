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

function disabledVariants(productSlug, rows) {
  return rows.map(([slug, name, amount]) => unavailableVariant(productSlug, slug, name, amount));
}

function categoryMeta(category) {
  return {
    vendor: category,
    game: category,
    category,
    badge: "Online",
    featured: false,
    available: true,
  };
}

const r6Multiplier = 1;
const newProductMultiplier = 1;
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
  badge: "Coming Soon",
  featured: false,
  available: false,
};

const spooferMeta = {
  vendor: "Spoofer",
  game: "Spoofer",
  category: "Spoofer",
  badge: "Coming Soon",
  featured: false,
  available: false,
};

const accountsMeta = {
  vendor: "Accounts",
  game: "Accounts",
  category: "Accounts",
  badge: "Coming Soon",
  featured: false,
  available: false,
};

const apexMeta = {
  vendor: "Apex Legends",
  game: "Apex Legends",
  category: "Apex Legends",
  badge: "Coming Soon",
  featured: false,
  available: false,
};

const eftMeta = {
  vendor: "Escape From Tarkov",
  game: "Escape From Tarkov",
  category: "Escape From Tarkov",
  badge: "Coming Soon",
  featured: false,
  available: false,
};

const rustMeta = {
  vendor: "Rust",
  game: "Rust",
  category: "Rust",
  badge: "Coming Soon",
  featured: false,
  available: false,
};

const productCatalog = [
  {
    ...r6Meta,
    slug: "crusader-r6",
    name: "Crusader R6",
    sale: 15,
    priceDisplay: `From ${money(Math.round(adjustAmount(699, r6Multiplier) * 0.85))}`,
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
      saleVariant("crusader-r6", "day", "1 Day Key", adjustAmount(699, r6Multiplier), 15),
      saleVariant("crusader-r6", "week", "1 Week Key", adjustAmount(2199, r6Multiplier), 15),
      saleVariant("crusader-r6", "month", "1 Month Key", adjustAmount(4199, r6Multiplier), 15),
    ],
  },
  {
    ...r6Meta,
    slug: "vega-r6-external",
    name: "Vega R6 External",
    priceDisplay: `From ${money(adjustAmount(699, r6Multiplier))}`,
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
      keyVariant("vega-r6-external", "day", "1 Day Key", adjustAmount(699, r6Multiplier)),
      keyVariant("vega-r6-external", "three-day", "3 Day Key", adjustAmount(1199, r6Multiplier)),
      keyVariant("vega-r6-external", "week", "1 Week Key", adjustAmount(2699, r6Multiplier)),
      keyVariant("vega-r6-external", "month", "1 Month Key", adjustAmount(5199, r6Multiplier)),
    ],
  },
  {
    ...r6Meta,
    slug: "r6-frost",
    name: "R6 Frost",
    sale: 15,
    priceDisplay: `From ${money(Math.round(adjustAmount(1199, r6Multiplier) * 0.85))}`,
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
      saleVariant("r6-frost", "day", "1 Day Key", adjustAmount(1199, r6Multiplier), 15),
      saleVariant("r6-frost", "week", "1 Week Key", adjustAmount(3199, r6Multiplier), 15),
      saleVariant("r6-frost", "month", "1 Month Key", adjustAmount(5700, r6Multiplier), 15),
    ],
  },
  {
    ...r6Meta,
    slug: "r6-ancient",
    name: "R6 Ancient",
    priceDisplay: `From ${money(adjustAmount(549, r6Multiplier))}`,
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
      keyVariant("r6-ancient", "day", "1 Day Key", adjustAmount(549, r6Multiplier)),
      keyVariant("r6-ancient", "week", "7 Day Key", adjustAmount(1499, r6Multiplier)),
      keyVariant("r6-ancient", "month", "30 Day Key", adjustAmount(2999, r6Multiplier)),
      keyVariant("r6-ancient", "lifetime", "Lifetime Key", adjustAmount(30199, r6Multiplier)),
    ],
  },
  {
    ...r6Meta,
    slug: "r6-recoil-private",
    name: "R6 Recoil Private",
    priceDisplay: `From ${money(adjustAmount(399, r6Multiplier))}`,
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
      keyVariant("r6-recoil-private", "day", "1 Day Key", adjustAmount(399, r6Multiplier)),
      keyVariant("r6-recoil-private", "week", "7 Day Key", adjustAmount(799, r6Multiplier)),
      keyVariant("r6-recoil-private", "month", "30 Day Key", adjustAmount(2199, r6Multiplier)),
      keyVariant("r6-recoil-private", "lifetime", "Lifetime Key", adjustAmount(3199, r6Multiplier)),
    ],
  },
  {
    ...r6Meta,
    slug: "exodus-r6",
    name: "Exodus R6",
    priceDisplay: `From ${money(adjustAmount(499, r6Multiplier))}`,
    summary:
      "R6 access with aim assistance, visual support, and HWID-related setup coverage.",
    features: ["Aim support", "ESP support", "HWID support"],
    variants: [
      keyVariant("exodus-r6", "day", "1 Day Key", adjustAmount(499, r6Multiplier)),
      keyVariant("exodus-r6", "three-day", "3 Day Key", adjustAmount(799, r6Multiplier)),
      keyVariant("exodus-r6", "week", "7 Day Key", adjustAmount(1499, r6Multiplier)),
      keyVariant("exodus-r6", "month", "30 Day Key", adjustAmount(2199, r6Multiplier)),
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
    priceDisplay: `From ${money(adjustAmount(499, r6Multiplier))}`,
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
      keyVariant("invision-chams", "day", "1 Day Key", adjustAmount(499, r6Multiplier)),
      keyVariant("invision-chams", "week", "7 Day Key", adjustAmount(1499, r6Multiplier)),
      keyVariant("invision-chams", "month", "1 Month Key", adjustAmount(2699, r6Multiplier)),
    ],
  },
  {
    ...r6Meta,
    slug: "r6-frost-lite",
    name: "R6 Frost Lite",
    priceDisplay: `From ${money(adjustAmount(599, r6Multiplier))}`,
    summary:
      "Lean version of R6 Frost focused on aim and ESP only, without misc utilities.",
    features: ["Memory aim", "Silent aim", "Custom chams"],
    featureGroups: [
      { title: "Memory Aim" },
      { title: "Silent Aim" },
      { title: "Aimbot Smoothing" },
      { title: "Closest Bone to Crosshair" },
      { title: "Player ESP" },
      { title: "World ESP" },
      { title: "Custom Chams" },
      { title: "Streamable" },
    ],
    generalInfo: [
      "Stripped-down version of Frost with aim and ESP only, no recoil or spread tools.",
      "Good fit if you want a lighter setup with less overhead.",
      ...universalSetupNotes,
    ],
    requirements: ["Windows 10: 20H2 to 22H2", "Windows 11: 21H2 to 25H2"],
    variants: [
      keyVariant("r6-frost-lite", "day", "1 Day Key", adjustAmount(599, r6Multiplier)),
      keyVariant("r6-frost-lite", "week", "1 Week Key", adjustAmount(1999, r6Multiplier)),
      keyVariant("r6-frost-lite", "month", "1 Month Key", adjustAmount(3999, r6Multiplier)),
    ],
  },
  {
    ...r6Meta,
    slug: "r6-unlock-all",
    name: "R6 Unlock All",
    priceDisplay: `From ${money(adjustAmount(2999, r6Multiplier))}`,
    summary:
      "Full unlock tool for Rainbow Six Siege covering operators, skins, charms, and cosmetics.",
    features: ["Unlock all operators", "Unlock all skins", "Global compatibility"],
    featureGroups: [
      { title: "Unlock all operators" },
      { title: "Unlock all skins & cosmetics" },
      { title: "Unlock all charms" },
      { title: "Global compatibility" },
      { title: "Easy setup" },
    ],
    generalInfo: [
      "Unlocks all in-game content globally and works with any account.",
      "Lifetime tier includes ongoing updates.",
      ...universalSetupNotes,
    ],
    requirements: [
      "Windows 10/11 64-bit",
      "Rainbow Six Siege installed",
      "Ubisoft Connect account",
      "Internet connection",
    ],
    variants: [
      keyVariant("r6-unlock-all", "month", "1 Month Key", adjustAmount(2999, r6Multiplier)),
      keyVariant("r6-unlock-all", "lifetime", "Lifetime Key", adjustAmount(6999, r6Multiplier)),
    ],
  },
  {
    ...fortniteMeta,
    slug: "fortnite-full",
    name: "Fortnite Full",
    priceDisplay: `From ${money(adjustAmount(599, newProductMultiplier))}`,
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
      adjustedUnavailableVariant("fortnite-full", "day", "1 Day Key", 599, newProductMultiplier),
      adjustedUnavailableVariant("fortnite-full", "week", "7 Day Key", 1299, newProductMultiplier),
      adjustedUnavailableVariant("fortnite-full", "month", "30 Day Key", 2499, newProductMultiplier),
    ],
  },
  {
    ...fortniteMeta,
    slug: "fortnite-ancient",
    name: "Fortnite Ancient",
    priceDisplay: `From ${money(adjustAmount(399, newProductMultiplier))}`,
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
      adjustedUnavailableVariant("fortnite-ancient", "day", "1 Day Key", 399, newProductMultiplier),
      adjustedUnavailableVariant("fortnite-ancient", "week", "7 Day Key", 1999, newProductMultiplier),
      adjustedUnavailableVariant("fortnite-ancient", "month", "30 Day Key", 3999, newProductMultiplier),
    ],
  },
  {
    ...apexMeta,
    slug: "ignite-apex",
    name: "Ignite - Apex Legends",
    priceDisplay: `From ${money(799)}`,
    summary:
      "Precision aim assist for Apex Legends with triggerbot, full player and world ESP, and movement automation.",
    features: ["Aimbot suite", "Triggerbot", "Movement tools"],
    featureGroups: [
      {
        title: "Aimbot",
        items: ["Enable", "Aimbot key", "Speed", "FOV", "Max distance", "Retarget time", "Detach time", "Filter team"],
      },
      {
        title: "Player ESP",
        items: ["Enemy", "Team", "Max distance", "Box", "Head dot", "Skeleton", "Weapon", "Distance"],
      },
      {
        title: "World ESP",
        items: ["Pistols", "Shotguns", "SMG", "AR", "Snipers", "Ammo", "Meds", "Optics"],
      },
      {
        title: "Triggerbot",
        items: ["Enable", "Triggerbot key", "Detection threshold", "Magnetic", "Filter team"],
      },
      {
        title: "Misc",
        items: ["BHOP", "Tap strafe", "Wall jump"],
      },
      {
        title: "Config",
        items: ["Load", "Save", "Delete", "Clear"],
      },
    ],
    generalInfo: [
      "Streamproof and Medal.tv compatible with global support.",
      "Movement tools include BHOP, Tap Strafe, and Wall Jump automation.",
      ...universalSetupNotes,
    ],
    requirements: ["Windows 10 / 11", "Administrator access"],
    variants: [
      unavailableVariant("ignite-apex", "day", "1 Day Key", 799),
      unavailableVariant("ignite-apex", "three-day", "3 Day Key", 1499),
      unavailableVariant("ignite-apex", "week", "7 Day Key", 1999),
      unavailableVariant("ignite-apex", "month", "30 Day Key", 3999),
      unavailableVariant("ignite-apex", "lifetime", "Lifetime Key", 18000),
    ],
  },
  {
    ...apexMeta,
    slug: "exodus-apex",
    name: "Exodus - Apex Legends",
    priceDisplay: `From ${money(299)}`,
    summary:
      "Feature-rich Apex external with configurable aimbot, weapon-specific settings, loot visuals, and rarity filtering.",
    features: ["Weapon configs", "Loot ESP", "Smart loot"],
    featureGroups: [
      {
        title: "Aimbot",
        items: ["Static FOV in zoom", "Aim if out of FOV", "Prediction", "Visible check", "Ignore knocked", "Draw FOV", "Hitbox selection"],
      },
      {
        title: "Player Visuals",
        items: ["Box", "Name", "Health", "Shield", "Skeleton", "Weapon", "Distance", "Barrel"],
      },
      {
        title: "Loot Visuals",
        items: ["Enable", "Draw glow", "Glow material", "Draw distance", "Render distance"],
      },
      {
        title: "Loot Categories",
        items: ["Rifle", "SMG", "LMG", "Marksman", "Sniper", "Shotgun", "Pistol"],
      },
      {
        title: "Misc",
        items: ["Auto tap strafe", "Auto super glide", "BunnyHop", "Big map radar"],
      },
    ],
    generalInfo: [
      "Includes weapon-specific configurations and smart loot filtering by rarity.",
      "Supports custom loot categories with per-item overrides.",
      ...universalSetupNotes,
    ],
    requirements: ["Windows 10 / 11", "Administrator access"],
    variants: [
      unavailableVariant("exodus-apex", "day", "1 Day Key", 299),
      unavailableVariant("exodus-apex", "three-day", "3 Day Key", 500),
      unavailableVariant("exodus-apex", "week", "7 Day Key", 1500),
      unavailableVariant("exodus-apex", "month", "30 Day Key", 2999),
    ],
  },
  {
    ...apexMeta,
    slug: "ancient-apex",
    name: "Ancient - Apex Legends",
    priceDisplay: `From ${money(200)}`,
    summary:
      "Apex Legends setup with aim tools, player ESP, and configuration sharing.",
    features: ["Aim support", "Player ESP", "Config sharing"],
    featureGroups: [
      { title: "Aimbot", items: ["Aim key", "Smooth", "FOV", "Target selection"] },
      { title: "Visuals", items: ["Player ESP", "Skeleton", "Distance", "Radar"] },
      { title: "Config", items: ["Save", "Load", "Share"] },
    ],
    generalInfo: [
      "Currently being updated. Check back soon for availability.",
      ...universalSetupNotes,
    ],
    requirements: ["Windows 10 / 11", "Intel or AMD CPU"],
    variants: [
      unavailableVariant("ancient-apex", "day", "1 Day Key", 200),
      unavailableVariant("ancient-apex", "week", "7 Day Key", 1000),
      unavailableVariant("ancient-apex", "month", "30 Day Key", 2000),
    ],
  },
  {
    ...eftMeta,
    slug: "eft-coffee-chams",
    name: "Coffee Chams - EFT",
    priceDisplay: `From ${money(750)}`,
    summary:
      "Chams-focused EFT tool with loot-through-walls, recoil and stamina modifications, and FOV controls.",
    features: ["Chams visuals", "Loot through walls", "Recoil control"],
    featureGroups: [
      {
        title: "Misc",
        items: ["Infinite stamina", "No sway", "No recoil", "Modify recoil", "No visor", "Recoil percent selector", "No pain effects", "No sprint inertia"],
      },
      {
        title: "Visuals",
        items: ["Enemy chams", "Local player chams", "Loot item chams", "Corpse chams", "Visibility check", "Zoom helper", "Normal FOV selector", "Aiming FOV selector"],
      },
    ],
    generalInfo: [
      "Chams-focused with loot through walls and recoil customization.",
      "Built for visual clarity over feature overload.",
      ...universalSetupNotes,
    ],
    requirements: ["Windows 10 / 11", "Escape From Tarkov installed"],
    variants: [
      unavailableVariant("eft-coffee-chams", "week", "7 Day Key", 750),
      unavailableVariant("eft-coffee-chams", "month", "30 Day Key", 1500),
    ],
  },
  {
    ...eftMeta,
    slug: "eft-coffee-lite",
    name: "Coffee Lite - EFT",
    priceDisplay: `From ${money(400)}`,
    summary:
      "Full-featured EFT suite with silent aimbot, deep exploits, loot and player ESP, and customizable loot filtering.",
    features: ["Silent aimbot", "Loot ESP", "Exploit tools"],
    featureGroups: [
      {
        title: "Aimbot",
        items: ["Silent aimbot", "Aimkey selection", "Show aimline", "Crosshair", "Aim FOV", "Aimbone selection", "Modify recoil", "Grenade aim"],
      },
      {
        title: "Exploits",
        items: ["Debug camera", "Anti AFK", "Session ID spoof", "Long jump", "Keep gun steady", "Instant plant"],
      },
      {
        title: "Loot ESP",
        items: ["Top loot list", "Active quest items", "Price per slot", "Loot chams", "Loot list size", "Default distance cap"],
      },
      {
        title: "Player ESP",
        items: ["Box settings", "Skeleton", "Draw distance", "Pink chams", "Look direction ray"],
      },
      {
        title: "Loot Filtering",
        items: ["Add items by name", "Ignore distance cap", "Ignore min price", "Override name", "Override color"],
      },
    ],
    generalInfo: [
      "Full EFT suite with silent aim, loot through walls, radar, and thermal.",
      "Deep loot filtering lets you customize exactly what shows up.",
      ...universalSetupNotes,
    ],
    requirements: ["Windows 10 / 11", "Escape From Tarkov installed"],
    variants: [
      unavailableVariant("eft-coffee-lite", "day", "1 Day Key", 400),
      unavailableVariant("eft-coffee-lite", "week", "7 Day Key", 2250),
      unavailableVariant("eft-coffee-lite", "month", "30 Day Key", 4500),
    ],
  },
  {
    ...eftMeta,
    slug: "ancient-eft",
    name: "Ancient - EFT External",
    priceDisplay: `From ${money(300)}`,
    summary:
      "External EFT setup with aim tools, player ESP, and loot awareness.",
    features: ["Aim support", "Player ESP", "Loot visuals"],
    featureGroups: [
      { title: "Aimbot", items: ["Smooth", "FOV", "Bone selection"] },
      { title: "Visuals", items: ["Players", "Loot", "Distance", "Skeleton"] },
      { title: "Misc", items: ["Config support", "Streamproof"] },
    ],
    generalInfo: [
      "Currently being updated. Check back soon for availability.",
      ...universalSetupNotes,
    ],
    requirements: ["Windows 10 / 11", "Escape From Tarkov installed"],
    variants: [
      unavailableVariant("ancient-eft", "day", "1 Day Key", 300),
      unavailableVariant("ancient-eft", "week", "7 Day Key", 1250),
      unavailableVariant("ancient-eft", "month", "30 Day Key", 2500),
    ],
  },
  {
    ...spooferMeta,
    slug: "xim-spoofer",
    name: "Xim Spoofer",
    priceDisplay: `From ${money(adjustAmount(499, newProductMultiplier))}`,
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
      adjustedUnavailableVariant("xim-spoofer", "day", "1 Day Key", 499, newProductMultiplier),
      adjustedUnavailableVariant("xim-spoofer", "three-day", "3 Days Key", 813, newProductMultiplier),
      adjustedUnavailableVariant("xim-spoofer", "week", "1 Week Key", 1720, newProductMultiplier),
      adjustedUnavailableVariant("xim-spoofer", "month", "1 Month Key", 3532, newProductMultiplier),
      adjustedUnavailableVariant("xim-spoofer", "lifetime", "Lifetime Key", 11462, newProductMultiplier),
    ],
  },
  {
    ...accountsMeta,
    slug: "linked-nfa",
    name: "Linked NFA",
    priceDisplay: `From ${money(adjustAmount(599, newProductMultiplier))}`,
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
      unavailableVariant("linked-nfa", "account", "1 NFA Account", adjustAmount(599, newProductMultiplier)),
    ],
  },
  {
    ...accountsMeta,
    slug: "stacked-pc-account",
    name: "Stacked PC Account",
    priceDisplay: `From ${money(adjustAmount(1999, newProductMultiplier))}`,
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
      adjustedUnavailableVariant("stacked-pc-account", "account", "1 NFA Stacked Linked Account", 1999, newProductMultiplier),
    ],
  },
  {
    ...fortniteMeta,
    slug: "disconnect-fortnite-external",
    name: "Disconnect - Fortnite External",
    priceDisplay: `From ${money(900)}`,
    summary:
      "External Fortnite option with aim control, ESP, radar, item visuals, and streamproof-focused support.",
    features: ["External build", "Player and item ESP", "Radar tools"],
    featureGroups: [
      { title: "Aimbot", items: ["Prediction", "Hitbox selection", "Smoothing", "FOV"] },
      { title: "Visuals", items: ["Box", "Skeleton", "Name", "Distance", "Snaplines"] },
      { title: "Utility", items: ["Radar", "Item ESP", "Config system", "Streamproof mode"] },
    ],
    generalInfo: ["Use this if you want an external Fortnite setup with stream-friendly behavior."],
    requirements: ["CPU: Intel / AMD", "OS: Windows 10 / 11"],
    variants: disabledVariants("disconnect-fortnite-external", [
      ["day", "1 Day Key", 900],
      ["three-day", "3 Days Key", 1800],
      ["week", "7 Days Key", 3500],
      ["month", "30 Days Key", 6500],
      ["lifetime", "Lifetime Key", 30000],
    ]),
  },
  {
    ...fortniteMeta,
    slug: "fortnite-ignite-aimbot",
    name: "Fortnite Ignite Aimbot",
    priceDisplay: `From ${money(1000)}`,
    summary:
      "Fortnite aim-focused package with customizable targeting, player visuals, world ESP, and trigger tools.",
    features: ["Custom aimbot", "World ESP", "Triggerbot"],
    featureGroups: [
      { title: "Aimbot", items: ["Speed", "FOV", "Max distance", "Prediction", "Hitbox selection"] },
      { title: "Player ESP", items: ["Box", "Skeleton", "Weapon", "Name", "Distance"] },
      { title: "Config", items: ["Load", "Save", "Delete", "Clear"] },
    ],
    generalInfo: ["A stronger Fortnite option for users who want deeper aim and visual tuning."],
    requirements: ["Windows 10 / 11", "Administrator access"],
    variants: disabledVariants("fortnite-ignite-aimbot", [
      ["day", "1 Day Key", 1000],
      ["three-day", "3 Days Key", 2000],
      ["week", "7 Days Key", 3150],
      ["month", "30 Days Key", 7000],
      ["lifetime", "Lifetime Key", 42000],
    ]),
  },
  {
    ...fortniteMeta,
    slug: "fortnite-exodus",
    name: "Fortnite Exodus",
    priceDisplay: `From ${money(200)}`,
    summary:
      "Fortnite package with aim assistance, loot visuals, player ESP, fight mode, and weapon-specific settings.",
    features: ["Weapon configs", "Loot ESP", "Fight mode"],
    featureGroups: [
      { title: "Aimbot", items: ["Prediction", "Visible check", "Ignore knocked", "Aim step"] },
      { title: "Visuals", items: ["Box", "Skeleton", "Name", "Weapon", "Distance"] },
      { title: "Loot", items: ["Categories", "Render distance", "Containers", "Vehicles"] },
    ],
    generalInfo: ["Good budget option for Fortnite users who still want a full feature spread."],
    requirements: ["Windows 10 / 11", "Administrator access"],
    variants: disabledVariants("fortnite-exodus", [
      ["day", "1 Day Key", 200],
      ["three-day", "3 Days Key", 400],
      ["week", "7 Days Key", 1000],
      ["month", "30 Days Key", 2000],
    ]),
  },
  {
    ...rustMeta,
    slug: "rust-ancient",
    name: "Ancient - Rust",
    priceDisplay: `From ${money(300)}`,
    summary:
      "Rust setup with silent aim support, player and world ESP, radar, and configurable entity visuals.",
    features: ["Silent aim", "World ESP", "Radar"],
    featureGroups: [
      { title: "Aimbot", items: ["Smooth", "FOV", "Bone selection", "Target filters"] },
      { title: "Visuals", items: ["Players", "NPCs", "Sleepers", "Skeleton", "Off-screen arrows"] },
      { title: "World", items: ["Ore", "Crates", "Animals", "Deployables", "Vehicles"] },
    ],
    generalInfo: ["Rust option for users who want both combat support and world awareness."],
    requirements: ["Windows 10 / 11", "Intel or AMD CPU"],
    variants: disabledVariants("rust-ancient", [
      ["day", "1 Day Key", 300],
      ["week", "7 Days Key", 1250],
      ["month", "30 Days Key", 2500],
    ]),
  },
  {
    ...rustMeta,
    slug: "rust-exodus",
    name: "Exodus - Rust External",
    priceDisplay: `From ${money(200)}`,
    summary:
      "External Rust product with aim tools, player ESP, world filters, radar, movement tools, and config support.",
    features: ["External Rust build", "Player ESP", "Movement tools"],
    featureGroups: [
      { title: "Aimbot", items: ["Memory mode", "Silent mode", "Prediction", "FOV"] },
      { title: "Player ESP", items: ["Skeleton", "Username", "Held item", "Distance", "Chams"] },
      { title: "Utility", items: ["Radar", "World ESP", "Omni sprint", "Third person"] },
    ],
    generalInfo: ["External Rust access with a wide feature set and many visual filters."],
    requirements: ["Windows 10 / 11", "Administrator access"],
    variants: disabledVariants("rust-exodus", [
      ["day", "1 Day Key", 200],
      ["three-day", "3 Days Key", 400],
      ["week", "7 Days Key", 1000],
      ["month", "30 Days Key", 2000],
    ]),
  },
  {
    ...rustMeta,
    slug: "rust-ignite",
    name: "Ignite - Rust External",
    priceDisplay: `From ${money(480)}`,
    summary:
      "Rust external with silent aim, player and item ESP, combat utilities, movement tools, and config handling.",
    features: ["Silent aimbot", "Item ESP", "Combat utilities"],
    featureGroups: [
      { title: "Aimbot", items: ["Speed", "FOV", "Max distance", "Hitbox selection"] },
      { title: "ESP", items: ["Players", "Items", "Prefabs", "Custom colors"] },
      { title: "Misc", items: ["Instant tools", "Movement helpers", "Config save/load"] },
    ],
    generalInfo: ["Higher-feature Rust external option with deep item and prefab controls."],
    requirements: ["Windows 10 / 11", "Administrator access"],
    variants: disabledVariants("rust-ignite", [
      ["day", "1 Day Key", 480],
      ["three-day", "3 Days Key", 1080],
      ["week", "7 Days Key", 1500],
      ["month", "30 Days Key", 3600],
      ["lifetime", "Lifetime Key", 21600],
    ]),
  },
  {
    ...rustMeta,
    slug: "rust-krush",
    name: "Krush - Rust External",
    priceDisplay: `From ${money(300)}`,
    summary:
      "Rust external with normal and silent aim modes, detailed ESP filters, out-of-FOV arrows, and exploit toggles.",
    features: ["Normal and silent aim", "ESP filters", "OOF arrows"],
    featureGroups: [
      { title: "Aim", items: ["Silent aimbot", "Standard aimbot", "Priority modes", "Bone selection"] },
      { title: "ESP", items: ["Player", "NPC", "World", "Raid", "Ores", "Loot"] },
      { title: "Misc", items: ["No recoil", "Bright night", "Crosshair", "Config manager"] },
    ],
    generalInfo: ["Rust listing built around granular filters and readable visual controls."],
    requirements: ["Windows 10 / 11", "Administrator access"],
    variants: disabledVariants("rust-krush", [
      ["day", "1 Day Key", 300],
      ["week", "7 Days Key", 1500],
      ["month", "30 Days Key", 3000],
    ]),
  },
  {
    ...rustMeta,
    slug: "rust-mek",
    name: "MEK - Rust External",
    priceDisplay: `From ${money(480)}`,
    summary:
      "Rust external package with silent and memory aim, streamproof visuals, combat utilities, and config management.",
    features: ["Streamproof external", "Silent and memory aim", "Combat tools"],
    featureGroups: [
      { title: "Misc", items: ["Fast loot", "No fall damage", "Spider-man", "Infinite jump"] },
      { title: "Aimbot", items: ["Silent aim", "Memory aim", "Hit chance", "FOV controls"] },
      { title: "Visuals", items: ["Player ESP", "Teammate ESP", "Chams", "Resources", "Crates"] },
    ],
    generalInfo: ["Rust tool for users who want a streamproof external workflow."],
    requirements: ["Windows 10 / 11", "Administrator access"],
    variants: disabledVariants("rust-mek", [
      ["day", "1 Day Key", 480],
      ["three-day", "3 Days Key", 960],
      ["week", "7 Days Key", 1800],
      ["month", "30 Days Key", 3600],
      ["long", "9999 Day Key", 15000],
    ]),
  },
  {
    ...spooferMeta,
    slug: "spoofer-exodus-temp",
    name: "Exodus Temp Spoofer",
    priceDisplay: `From ${money(150)}`,
    summary:
      "Temporary HWID masking product with cleaner support and coverage for several major anti-cheat environments.",
    features: ["Temporary spoofing", "Cleaner support", "Multi-game coverage"],
    featureGroups: [
      { title: "Spoof list", items: ["Disk serials", "RAM serials", "Monitor serials", "Network IDs"] },
      { title: "Cleaner support", items: ["Rust", "Apex Legends", "Escape From Tarkov"] },
      { title: "Anti-cheat coverage", items: ["EAC", "BE", "FiveM", "Ricochet"] },
    ],
    generalInfo: ["Use support before running if you are unsure whether temporary spoofing is enough."],
    requirements: ["Windows 10 / 11", "Administrator access"],
    variants: disabledVariants("spoofer-exodus-temp", [
      ["day", "1 Day Key", 150],
      ["three-day", "3 Days Key", 300],
      ["week", "7 Days Key", 500],
      ["month", "30 Days Key", 1000],
    ]),
  },
  {
    ...spooferMeta,
    slug: "spoofer-verse-perm",
    name: "Verse - Perm Spoofer",
    priceDisplay: `From ${money(1200)}`,
    summary:
      "Permanent spoofing option for supported games and motherboard brands, with setup checks before purchase.",
    features: ["Permanent spoofing", "Motherboard coverage", "Setup checks"],
    featureGroups: [
      { title: "Supported games", items: ["League of Legends", "Fortnite", "Apex Legends", "Rust"] },
      { title: "Motherboards", items: ["ASUS", "Gigabyte", "MSI", "ASRock", "HP"] },
      { title: "Notes", items: ["Open a ticket for Lenovo, Acer, or Dell", "TPM bypass not included"] },
    ],
    generalInfo: ["Open a support ticket first if your motherboard brand is not listed."],
    requirements: ["Windows 10 / 11", "Supported motherboard"],
    variants: disabledVariants("spoofer-verse-perm", [
      ["one-time", "One Time Key", 1200],
      ["lifetime", "Lifetime Key", 3500],
    ]),
  },
];

export const products = productCatalog.map((product) => ({
  ...product,
  generalInfo: [product.generalInfo?.[0] || defaultGeneralInfo],
  instructionHref: `/instructions/#${product.slug}`,
}));
