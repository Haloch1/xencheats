const DEFAULT_COOLDOWN_MS = 5_000;
const MAX_COOLDOWN_MS = 60_000;

function retryAfterMs(value, now) {
  const header = String(value || "").trim();
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1_000);
  const timestamp = Date.parse(header);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : null;
}

export function groqRetryDelayMs(response, {
  attempt = 0,
  now = Date.now(),
  fallbackMs = 700,
  maxWaitMs = 2_500,
} = {}) {
  if (response?.headers?.get("x-groq-local-cooldown") === "1") return null;
  const providerDelay = retryAfterMs(response?.headers?.get("retry-after"), now);
  const delay = providerDelay ?? Math.max(0, fallbackMs) * (2 ** Math.max(0, attempt));
  return delay <= maxWaitMs ? delay : null;
}

export function createGroqRateLimitedFetch(fetchImpl = globalThis.fetch, {
  now = Date.now,
  cooldownMs = DEFAULT_COOLDOWN_MS,
  maxCooldownMs = MAX_COOLDOWN_MS,
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required.");
  let blockedUntil = 0;

  return async function groqRateLimitedFetch(input, init) {
    const currentTime = now();
    if (blockedUntil > currentTime) {
      const remainingMs = blockedUntil - currentTime;
      return new Response(JSON.stringify({ error: { type: "local_rate_limit_cooldown" } }), {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": String(Math.ceil(remainingMs / 1_000)),
          "x-groq-local-cooldown": "1",
        },
      });
    }

    const response = await fetchImpl(input, init);
    if (response.status === 429) {
      const providerDelay = retryAfterMs(response.headers?.get("retry-after"), now());
      const delay = Math.min(maxCooldownMs, Math.max(0, providerDelay ?? cooldownMs));
      blockedUntil = Math.max(blockedUntil, now() + delay);
    }
    return response;
  };
}
