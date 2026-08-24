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

