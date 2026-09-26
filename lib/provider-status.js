const STATUS_LABELS = [
  ["Use at own risk!", /use\s+at\s+own\s+risk|at\s+your\s+own\s+risk|risky|risk/i],
  ["Updating", /updating|update|maintenance|offline|detected|unavailable|down/i],
  ["Testing", /testing|test\s*mode|in\s+testing/i],
  ["Undetected", /undetected|online|operational|available|working|safe/i],
];

export function normalizeStatusLabel(value) {
  const text = String(value || "").replace(/[_-]+/g, " ").trim();
  if (!text) return null;
  return STATUS_LABELS.find(([, pattern]) => pattern.test(text))?.[0] || null;
}

export function normalizeProviderName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x2d;|&#45;/gi, "-")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)));
}

export function htmlToStatusLines(html) {
  return decodeHtml(String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|section|article|li|tr|td|th|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function entriesFromLine(line) {
  const results = [];
  const statusPattern = "(?:online|undetected|operational|available|working|safe|testing|test\\s+mode|updating|maintenance|offline|detected|unavailable|down|use\\s+at\\s+own\\s+risk|at\\s+your\\s+own\\s+risk|risky)!?";
  const pair = new RegExp(`^(.{2,140}?)\\s*(?:[:|–—]|\\s+-\\s+)\\s*(${statusPattern})$`, "i");
  const reverse = new RegExp(`^(${statusPattern})\\s*(?:[:|–—]|\\s+-\\s+)\\s*(.{2,140})$`, "i");
  const direct = line.match(pair) || line.match(reverse);
  if (direct) {
    const reverseOrder = Boolean(line.match(reverse));
    const name = reverseOrder ? direct[2] : direct[1];
    const rawStatus = reverseOrder ? direct[1] : direct[2];
    const badge = normalizeStatusLabel(rawStatus);
    if (badge) results.push({ name: name.trim(), badge });
  }
  return results;
}

export function parseProviderStatusHtml(html) {
  const lines = htmlToStatusLines(html);
  const entries = [];
  for (let i = 0; i < lines.length; i += 1) {
    const statusField = lines[i].match(/^status\s*:\s*(.+)$/i);
    if (statusField && lines[i - 1]) {
      const badge = normalizeStatusLabel(statusField[1]);
      if (badge) entries.push({ name: lines[i - 1], badge });
    } else {
      entries.push(...entriesFromLine(lines[i]));
    }
    const status = /^(?:online|undetected|operational|available|working|safe|testing|test\s*mode|updating|maintenance|offline|detected|unavailable|down|use\s+at\s+own\s+risk|at\s+your\s+own\s+risk|risky)!?$/i.test(lines[i].trim())
      ? normalizeStatusLabel(lines[i])
      : null;
    if (status && lines[i].length < 45 && lines[i - 1]) {
      entries.push({ name: lines[i - 1], badge: status });
    }
  }
  const deduped = new Map();
  for (const entry of entries) {
    const key = normalizeProviderName(entry.name);
    if (key && !deduped.has(key)) deduped.set(key, entry);
  }
  return [...deduped.values()];
}

export function extractStructuredProviderStatuses(payload) {
  const entries = [];
  const visit = (value, fallbackName = "") => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, fallbackName);
      return;
    }
    const name = value.name || value.product || value.product_name || value.title || value.label || fallbackName;
    const rawStatus = value.status || value.state || value.availability || value.product_status;
    const badge = normalizeStatusLabel(rawStatus);
    if (name && badge) entries.push({ name: String(name), badge });
    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child === "object") visit(child, key);
    }
  };
  visit(payload);
  const deduped = new Map();
  for (const entry of entries) {
    const key = normalizeProviderName(entry.name);
    if (key && !deduped.has(key)) deduped.set(key, entry);
  }
  return [...deduped.values()];
}

export function matchProviderStatuses(entries, products, { supplier } = {}) {
  const candidates = (products || []).filter((product) => !supplier || product?.supplier === supplier);
  const rows = [];
  for (const entry of entries || []) {
    const wanted = normalizeProviderName(entry.name);
    if (!wanted) continue;
    const matches = candidates.filter((product) => {
      const names = [product.name, product.slug, product.supplierProductName, ...(product.supplierProductAliases || [])]
        .map(normalizeProviderName)
        .filter(Boolean);
      return names.includes(wanted);
    });
    if (matches.length !== 1) continue;
    rows.push({
      slug: matches[0].slug,
      productName: matches[0].name,
      badge: entry.badge,
      sourceName: entry.name,
    });
  }
  return rows;
}

const CHEATSLOVE_STATUS_LABELS = new Map([
  ["undetected", "Undetected"],
  ["updating", "Updating"],
  ["testing", "Testing"],
  ["risky", "Use at own risk!"],
  ["detected", "Detected"],
  ["unknown", "Unknown"],
  ["discontinued", "Discontinued"],
]);

const CHEATSLOVE_STATUS_CATEGORY_ALIASES = new Map([
  ["apexlegends", "apex"],
  ["counterstrike2", "counterstrike"],
]);

const CHEATSLOVE_STATUS_PRODUCT_ALIASES = new Map([
  ["battlefield|ancient", "6 ancient"],
  ["counterstrike|predatorsystems", "predator"],
  ["marvelrivals|predatorsystems", "predator"],
  ["pubg|arcane", "arcane cheats"],
  ["rainbowsixsiege|chams", "chams wallhack"],
]);

function normalizeStatusSourceKey(value) {
  return normalizeProviderName(value).replace(/&amp;/g, "");
}

function normalizeCheatsLoveStatus(value) {
  const key = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return CHEATSLOVE_STATUS_LABELS.get(key) || null;
}

/* Cheats.Love's public /api/status feed uses its own per-status-row IDs,
   which are different from the reseller catalog product IDs. Match by exact
   game/category and product name, with only the known display-name aliases
   below. Ambiguous or unknown rows are deliberately ignored. */
export function matchCheatsLoveProductStatuses(payload, products) {
  if (!Array.isArray(payload)) return [];
  const candidates = (products || []).filter((product) => product?.cheatsLoveProductId != null);
  const rowsBySlug = new Map();

  for (const entry of payload) {
    if (!entry || typeof entry !== "object") continue;
    const category = normalizeStatusSourceKey(entry.category);
    const wantedCategory = CHEATSLOVE_STATUS_CATEGORY_ALIASES.get(category) || category;
    const sourceName = normalizeStatusSourceKey(entry.name);
    const badge = normalizeCheatsLoveStatus(entry.status);
    if (!wantedCategory || !sourceName || !badge) continue;

    const aliasName = normalizeStatusSourceKey(CHEATSLOVE_STATUS_PRODUCT_ALIASES.get(`${wantedCategory}|${sourceName}`));
    const matches = candidates.filter((product) => {
      const productCategory = normalizeStatusSourceKey(product.category);
      const normalizedProductCategory = CHEATSLOVE_STATUS_CATEGORY_ALIASES.get(productCategory) || productCategory;
      if (normalizedProductCategory !== wantedCategory) return false;
      const productNames = [product.name, product.supplierProductName, ...(product.supplierProductAliases || [])]
        .map(normalizeStatusSourceKey)
        .filter(Boolean);
      return productNames.includes(sourceName) || Boolean(aliasName && productNames.includes(aliasName));
    });
    if (matches.length !== 1) continue;

    const product = matches[0];
    rowsBySlug.set(product.slug, {
      slug: product.slug,
      productName: product.name,
      badge,
      sourceName: `${String(entry.category).trim()} / ${String(entry.name).trim()}`,
      displayGame: String(entry.category).trim(),
      variant: String(entry.name).trim(),
    });
  }

  return [...rowsBySlug.values()];
}

