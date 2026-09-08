const PRIVILEGED_ROLES = new Set(["owner", "admin"]);

function zoneOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(date);
  const value = parts.find((part) => part.type === "timeZoneName")?.value || "GMT";
  const match = value.match(/^GMT([+-])(\d{2})(?::?(\d{2}))?$/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] || 0);
  return (match[1] === "-" ? -1 : 1) * minutes * 60 * 1000;
}

/** Return the UTC instant for Monday 00:00 in the supplied IANA timezone. */
export function getMediaWeekStartIso(nowMs = Date.now(), timeZone = "America/Chicago") {
  const now = new Date(nowMs);
  if (!Number.isFinite(now.getTime())) return new Date(0).toISOString();
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now).map((part) => [part.type, part.value]));
  const localDay = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const daysSinceMonday = (localDay.getUTCDay() + 6) % 7;
  localDay.setUTCDate(localDay.getUTCDate() - daysSinceMonday);
  const localMidnight = Date.UTC(localDay.getUTCFullYear(), localDay.getUTCMonth(), localDay.getUTCDate());
  const utcMidnight = localMidnight - zoneOffsetMs(new Date(localMidnight), timeZone);
  return new Date(utcMidnight).toISOString();
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

/** Pure media access rules, kept separate so they can be tested without services. */
export function evaluateMediaAccess({
  appRole = "",
  discordOwner = false,
  discordStaff = false,
  hasMediaRole = false,
  approvalStatus = null,
} = {}) {
  const privileged = discordOwner || PRIVILEGED_ROLES.has(normalizeRole(appRole));
  if (privileged) return { allowed: true, reason: "privileged" };
  // Staff without the Media role are not eligible; staff who also hold the
  // Media role are treated the same as any other media member.
  if (!hasMediaRole) return { allowed: false, reason: discordStaff ? "staff_accounts_are_not_eligible" : "media_role_required" };
  // The live Discord Media role is the approval. Legacy rows that were
  // previously under review or paused are auto-activated on the next visit.
  // Only an explicit owner/admin removal remains a hard deny.
  if (approvalStatus === "removed") return { allowed: false, reason: "media_member_inactive" };
  if (approvalStatus === "active") return { allowed: true, reason: "role_verified" };
  return { allowed: true, reason: "role_auto_approved" };
}

/**
 * Discord panel claims are role-gated, not owner-approval-gated. Keep the
 * cooldown and weekly allowance pure so the server route can be tested
 * without Discord or Supabase.
 */
export function evaluateMediaPanelClaim({
  hasMediaRole = false,
  discordStaff = false,
  claimsLast7Days = 0,
  lastClaimAt = null,
  nowMs = Date.now(),
  cooldownMs = 24 * 60 * 60 * 1000,
  weeklyLimit = 4,
} = {}) {
  if (!hasMediaRole) return { allowed: false, reason: "media_role_required" };
  if (Number(claimsLast7Days) >= Math.max(1, Number(weeklyLimit) || 4)) {
    return { allowed: false, reason: "weekly_limit" };
  }
  const lastClaimMs = lastClaimAt ? new Date(lastClaimAt).getTime() : NaN;
  if (Number.isFinite(lastClaimMs) && nowMs - lastClaimMs < cooldownMs) {
    return {
      allowed: false,
      reason: "daily_cooldown",
      retryAt: new Date(lastClaimMs + cooldownMs).toISOString(),
    };
  }
  return { allowed: true, reason: "eligible" };
}
