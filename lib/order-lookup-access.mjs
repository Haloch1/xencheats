const KEY_VIEWER_ROLES = new Set(["owner", "admin"]);

export function canExposeOrderLookupKey({ discordAdmin = false, appRole = "" } = {}) {
  return Boolean(discordAdmin)
    || KEY_VIEWER_ROLES.has(String(appRole || "").trim().toLowerCase());
}

export function escapeExactLikePattern(value) {
  return String(value || "").replace(/[\\%_]/g, (character) => `\\${character}`);
}
