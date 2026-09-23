const TIKTOK_HOSTS = new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"]);

export function tikTokLiveHandle(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !TIKTOK_HOSTS.has(url.hostname.toLowerCase())) return null;
    const match = url.pathname.match(/^\/@([a-zA-Z0-9._]{2,24})\/live\/?$/i);
    return match ? match[1].toLowerCase() : null;
  } catch { return null; }
}

export function isTikTokShareLink(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !TIKTOK_HOSTS.has(url.hostname.toLowerCase())) return false;
    return ((url.hostname === "vm.tiktok.com" || url.hostname === "vt.tiktok.com") && /^\/[a-zA-Z0-9]+\/?$/.test(url.pathname))
      || /^\/t\/[a-zA-Z0-9]+\/?$/.test(url.pathname);
  } catch { return false; }
}

export async function resolveTikTokLiveHandle(value, fetchImpl = fetch) {
  const direct = tikTokLiveHandle(value);
  if (direct) return direct;
  if (!isTikTokShareLink(value)) return null;
  let current = value;
  for (let redirects = 0; redirects < 5; redirects++) {
    const url = new URL(current);
    if (url.protocol !== "https:" || !TIKTOK_HOSTS.has(url.hostname.toLowerCase())) return null;
    const response = await fetchImpl(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(10000), headers: { "user-agent": "Mozilla/5.0" } });
    const location = response.headers.get("location");
    await response.body?.cancel?.();
    if (!location || response.status < 300 || response.status > 399) return tikTokLiveHandle(current);
    current = new URL(location, current).href;
    if (tikTokLiveHandle(current)) return tikTokLiveHandle(current);
  }
  return null;
}

export function parseTikTokLiveResponse(body, expectedHandle, observedAt = new Date()) {
  if (!body || body.success !== true || typeof body.is_live !== "boolean") throw new Error("TikTok LIVE provider response was not authoritative");
  const observedAtIso = observedAt.toISOString();
  if (!body.is_live) return { isLive: false, observedAt: observedAtIso };
  const actualHandle = String(body.liveRoomUserInfo?.uniqueId || "").toLowerCase();
  if (actualHandle && actualHandle !== String(expectedHandle).toLowerCase()) throw new Error("TikTok LIVE handle mismatch");
  const roomId = String(body.liveRoomUserInfo?.roomId || body.roomId || body.liveRoom?.id || "");
  const startSeconds = Number(body.liveRoom?.startTime);
  if (!roomId || !Number.isFinite(startSeconds) || startSeconds <= 0 || startSeconds * 1000 > observedAt.getTime() + 60000) {
    throw new Error("TikTok LIVE room or start time unavailable");
  }
  return { isLive: true, roomId, startedAt: new Date(startSeconds * 1000).toISOString(), observedAt: observedAtIso };
}

export async function readTikTokLive(handle, apiKey, fetchImpl = fetch) {
  if (!apiKey) throw new Error("SCRAPECREATORS_API_KEY is missing");
  const url = `https://api.scrapecreators.com/v1/tiktok/user/live?handle=${encodeURIComponent(handle)}`;
  const response = await fetchImpl(url, { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`TikTok LIVE provider HTTP ${response.status}`);
  return parseTikTokLiveResponse(await response.json(), handle);
}

export function liveDurationWindow(startedAt, lastLiveAt, firstOfflineAt) {
  const start = Date.parse(startedAt), last = Date.parse(lastLiveAt), offline = Date.parse(firstOfflineAt);
  if (![start, last, offline].every(Number.isFinite) || last < start || offline < last) throw new Error("Invalid TikTok LIVE observation window");
  return { minSeconds: Math.floor((last - start) / 1000), maxSeconds: Math.ceil((offline - start) / 1000) };
}

export function formatLiveDuration(seconds) {
  const hours = Math.floor(seconds / 3600), minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}
