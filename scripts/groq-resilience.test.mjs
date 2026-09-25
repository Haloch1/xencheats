import assert from "node:assert/strict";
import { createGroqRateLimitedFetch, groqRetryDelayMs } from "../lib/groq-resilience.mjs";

const now = Date.parse("2026-09-24T12:00:00.000Z");
assert.equal(groqRetryDelayMs(new Response(null, { status: 429, headers: { "retry-after": "1" } }), { now }), 1_000);
assert.equal(groqRetryDelayMs(new Response(null, { status: 429, headers: { "retry-after": new Date(now + 2_000).toUTCString() } }), { now }), 2_000);
assert.equal(groqRetryDelayMs(new Response(null, { status: 429, headers: { "retry-after": "30" } }), { now }), null);
assert.equal(groqRetryDelayMs(new Response(null, { status: 429 }), { attempt: 1, now }), 1_400);

let currentTime = now;
let networkCalls = 0;
const rateLimitedFetch = createGroqRateLimitedFetch(async () => {
  networkCalls += 1;
  return new Response("{}", { status: 429, headers: { "retry-after": "10" } });
}, { now: () => currentTime });

const first = await rateLimitedFetch("https://api.groq.com/openai/v1/chat/completions");
assert.equal(first.status, 429);
assert.equal(groqRetryDelayMs(first, { now: currentTime }), null, "long provider cooldowns should fall back instead of being retried immediately");
const second = await rateLimitedFetch("https://api.groq.com/openai/v1/chat/completions");
assert.equal(second.status, 429);
assert.equal(second.headers.get("x-groq-local-cooldown"), "1");
assert.equal(networkCalls, 1, "requests inside a cooldown must not hit Groq again");

currentTime += 10_000;
const afterCooldown = await rateLimitedFetch("https://api.groq.com/openai/v1/chat/completions");
assert.equal(afterCooldown.status, 429);
assert.equal(networkCalls, 2, "a request should be allowed after the provider cooldown ends");

let successCalls = 0;
const successfulFetch = createGroqRateLimitedFetch(async () => {
  successCalls += 1;
  return new Response('{"ok":true}', { status: 200 });
});
assert.equal((await successfulFetch("https://api.groq.com/openai/v1/chat/completions")).status, 200);
assert.equal(successCalls, 1);

console.log("Groq resilience checks passed (Retry-After, cooldown, and successful requests).");
