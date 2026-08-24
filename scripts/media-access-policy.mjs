const PRIVILEGED_ROLES = new Set(["owner", "admin"]);

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
  if (discordStaff) return { allowed: false, reason: "staff_accounts_are_not_eligible" };
  if (!hasMediaRole) return { allowed: false, reason: "media_role_required" };
  if (!approvalStatus) return { allowed: false, reason: "media_approval_pending", createRequest: true };
  if (approvalStatus === "active") return { allowed: true, reason: "approved" };
  if (approvalStatus === "under_review") return { allowed: false, reason: "media_approval_pending" };
  return { allowed: false, reason: "media_member_inactive" };
}

/**
 * Discord panel claims are role-gated, not owner-approval-gated. Keep the
 * cooldown and rolling allowance pure so the server route can be tested
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
  if (discordStaff) return { allowed: false, reason: "staff_accounts_are_not_eligible" };
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
