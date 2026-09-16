import crypto from "node:crypto";

export function hashGuestCheckoutToken(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function timingSafeStringEqual(leftValue, rightValue) {
  const left = Buffer.from(String(leftValue || ""), "utf8");
  const right = Buffer.from(String(rightValue || ""), "utf8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function createGuestCheckoutToken(ttlMs, now = Date.now()) {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    token,
    hash: hashGuestCheckoutToken(token),
    expiresAt: new Date(now + ttlMs).toISOString(),
  };
}

export function guestTokenMatchesOrder(token, order, now = Date.now()) {
  const storedHash = String(order?.guest_access_token_hash || "").trim();
  if (!token || !/^[a-f0-9]{64}$/i.test(storedHash)) return false;

  const expiresAt = new Date(order?.guest_access_token_expires_at || 0).getTime();
  return Number.isFinite(expiresAt)
    && expiresAt > now
    && timingSafeStringEqual(hashGuestCheckoutToken(token), storedHash);
}
