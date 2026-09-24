import assert from "node:assert/strict";
import { tikTokLiveHandle, isTikTokShareLink, resolveTikTokLiveHandle, parseTikTokLiveResponse, readTikTokLiveFromPublicPage, liveDurationWindow, formatLiveDuration } from "../lib/tiktok-live-tracker.mjs";

assert.equal(tikTokLiveHandle("https://www.tiktok.com/@Creator.123/live?foo=bar"), "creator.123");
assert.equal(tikTokLiveHandle("https://www.tiktok.com/@creator/video/123"), null);
assert.equal(tikTokLiveHandle("https://evil.tiktok.com/@creator/live"), null);
assert.equal(isTikTokShareLink("https://vm.tiktok.com/Z123/"), true);
assert.equal(isTikTokShareLink("https://evil.example/t/123"), false);
const redirected = await resolveTikTokLiveHandle("https://vm.tiktok.com/Z123/", async () => ({
  status: 302, headers: new Headers({ location: "https://www.tiktok.com/@creator/live" }), body: null,
}));
assert.equal(redirected, "creator");
const denied = await resolveTikTokLiveHandle("https://vm.tiktok.com/Z123/", async () => ({
  status: 302, headers: new Headers({ location: "https://evil.example/@creator/live" }), body: null,
}));
assert.equal(denied, null);
const now = new Date("2026-09-23T12:05:00Z");
const live = parseTikTokLiveResponse({ success: true, is_live: true, liveRoomUserInfo: { uniqueId: "Creator", roomId: "123" }, liveRoom: { startTime: 1790164800 } }, "creator", now);
assert.equal(live.isLive, true);
assert.equal(live.roomId, "123");
assert.equal(live.startedAt, "2026-09-23T12:00:00.000Z");
assert.deepEqual(parseTikTokLiveResponse({ success: true, is_live: false }, "creator", now), { isLive: false, observedAt: now.toISOString() });
assert.throws(() => parseTikTokLiveResponse({ success: false, is_live: false }, "creator", now));
assert.throws(() => parseTikTokLiveResponse({ success: true, is_live: true, roomId: "123", liveRoom: { startTime: 1790164800 }, liveRoomUserInfo: { uniqueId: "other" } }, "creator", now));
const publicState = (status) => `<script id="SIGI_STATE" type="application/json">${JSON.stringify({ LiveRoom: { liveRoomUserInfo: { user: { uniqueId: "creator", roomId: "123", status }, liveRoom: { startTime: 1790164800, status } } } })}</script>`;
const publicFetch = (status) => async () => ({ ok: true, text: async () => publicState(status) });
assert.equal((await readTikTokLiveFromPublicPage("creator", publicFetch(2))).roomId, "123");
assert.equal((await readTikTokLiveFromPublicPage("creator", publicFetch(4))).isLive, false);
await assert.rejects(readTikTokLiveFromPublicPage("creator", async () => ({ ok: true, text: async () => "<html></html>" })));
const duration = liveDurationWindow("2026-09-23T12:00:00Z", "2026-09-23T12:59:00Z", "2026-09-23T13:00:00Z");
assert.deepEqual(duration, { minSeconds: 3540, maxSeconds: 3600 });
assert.equal(formatLiveDuration(duration.minSeconds), "59m");
assert.equal(formatLiveDuration(duration.maxSeconds), "1h 0m");
console.log("TikTok LIVE tracker tests passed");
