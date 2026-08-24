import assert from "node:assert/strict";
import { evaluateMediaAccess } from "./media-access-policy.mjs";

const cases = [
  [{ hasMediaRole: false, approvalStatus: "active" }, "media_role_required"],
  [{ hasMediaRole: true, approvalStatus: null }, "media_approval_pending"],
  [{ hasMediaRole: true, approvalStatus: "under_review" }, "media_approval_pending"],
  [{ hasMediaRole: true, approvalStatus: "active" }, "approved"],
  [{ hasMediaRole: true, approvalStatus: "removed" }, "media_member_inactive"],
  [{ hasMediaRole: true, discordStaff: true, approvalStatus: "active" }, "staff_accounts_are_not_eligible"],
  [{ appRole: "admin", hasMediaRole: false }, "privileged"],
  [{ discordOwner: true, hasMediaRole: false }, "privileged"],
];

for (const [input, reason] of cases) assert.equal(evaluateMediaAccess(input).reason, reason, JSON.stringify(input));
assert.equal(evaluateMediaAccess({ hasMediaRole: true }).createRequest, true);
console.log(`Media access policy: ${cases.length} cases passed.`);

