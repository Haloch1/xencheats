import assert from "node:assert/strict";
import { evaluateMediaAccess, evaluateMediaPanelClaim } from "./media-access-policy.mjs";

const cases = [
  [{ hasMediaRole: false, approvalStatus: "active" }, "media_role_required"],
  [{ hasMediaRole: true, approvalStatus: null }, "role_auto_approved"],
  [{ hasMediaRole: true, approvalStatus: "under_review" }, "role_auto_approved"],
  [{ hasMediaRole: true, approvalStatus: "active" }, "role_verified"],
  [{ hasMediaRole: true, approvalStatus: "removed" }, "media_member_inactive"],
  [{ hasMediaRole: true, discordStaff: true, approvalStatus: "active" }, "staff_accounts_are_not_eligible"],
  [{ appRole: "admin", hasMediaRole: false }, "privileged"],
  [{ discordOwner: true, hasMediaRole: false }, "privileged"],
];

for (const [input, reason] of cases) assert.equal(evaluateMediaAccess(input).reason, reason, JSON.stringify(input));
assert.equal(evaluateMediaAccess({ hasMediaRole: true }).allowed, true);

const now = Date.parse("2026-08-24T12:00:00.000Z");
const claimCases = [
  [{ hasMediaRole: false }, "media_role_required"],
  [{ hasMediaRole: true, discordStaff: true }, "staff_accounts_are_not_eligible"],
  [{ hasMediaRole: true, claimsLast7Days: 4 }, "weekly_limit"],
  [{ hasMediaRole: true, lastClaimAt: "2026-08-24T00:00:00.000Z", nowMs: now }, "daily_cooldown"],
  [{ hasMediaRole: true, lastClaimAt: "2026-08-23T11:59:59.000Z", nowMs: now }, "eligible"],
  [{ hasMediaRole: true, claimsLast7Days: 3, nowMs: now }, "eligible"],
];
for (const [input, reason] of claimCases) assert.equal(evaluateMediaPanelClaim(input).reason, reason, JSON.stringify(input));
console.log(`Media access policy: ${cases.length} access cases and ${claimCases.length} claim cases passed.`);
