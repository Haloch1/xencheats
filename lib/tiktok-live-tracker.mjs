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
  const viewerCountCandidates = [
    body.viewer_count,
    body.viewerCount,
    body.liveRoomStats?.userCount,
    body.liveRoomUserInfo?.liveRoomStats?.userCount,
    body.liveRoom?.liveRoomStats?.userCount,
    body.liveRoom?.stats?.userCount,
  ];
  const viewerCount = viewerCountCandidates
    .map((value) => Number(value))
    .find((value) => Number.isInteger(value) && value >= 0);
  return {
    isLive: true,
    roomId,
    startedAt: new Date(startSeconds * 1000).toISOString(),
    observedAt: observedAtIso,
    viewerCount: viewerCount === undefined ? null : viewerCount,
  };
}

export async function readTikTokLive(handle, apiKey, fetchImpl = fetch) {
  if (!apiKey) return readTikTokLiveFromPublicPage(handle, fetchImpl);
  const url = `https://api.scrapecreators.com/v1/tiktok/user/live?handle=${encodeURIComponent(handle)}`;
  const response = await fetchImpl(url, { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) return readTikTokLiveFromPublicPage(handle, fetchImpl);
  return parseTikTokLiveResponse(await response.json(), handle);
}

export async function readTikTokLiveFromPublicPage(handle, fetchImpl = fetch) {
  if (!/^[a-zA-Z0-9._]{2,24}$/.test(handle)) throw new Error("Invalid TikTok handle");
  const response = await fetchImpl(`https://www.tiktok.com/@${handle}/live`, {
    headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`TikTok public page HTTP ${response.status}`);
  const html = await response.text();
  const match = html.match(/<script id="SIGI_STATE" type="application\/json">([\s\S]*?)<\/script>/i);
  if (!match) throw new Error("TikTok public page did not expose LIVE state");
  const state = JSON.parse(match[1]);
  const info = state.LiveRoom?.liveRoomUserInfo;
  const user = info?.user;
  const room = info?.liveRoom;
  if (String(user?.uniqueId || "").toLowerCase() !== handle.toLowerCase()) throw new Error("TikTok public page handle mismatch");
  if (Number(user.status) === 2 && Number(room?.status) === 2) {
    return parseTikTokLiveResponse({
      success: true, is_live: true,
      liveRoomUserInfo: { uniqueId: user.uniqueId, roomId: user.roomId },
      liveRoom: { startTime: room.startTime, liveRoomStats: info.liveRoomStats || room.liveRoomStats },
    }, handle);
  }
  if (Number(user.status) === 4 && Number(room?.status) === 4) {
    return { isLive: false, observedAt: new Date().toISOString() };
  }
  throw new Error("TikTok public page LIVE status is ambiguous");
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

export function buildTikTokLiveReport(session) {
  const duration = liveDurationWindow(session.started_at, session.last_live_at, session.first_offline_at);
  const min = formatLiveDuration(duration.minSeconds), max = formatLiveDuration(duration.maxSeconds);
  return {
    title: "TikTok LIVE finished",
    color: 0x22c55e,
    description: `<@${session.member_discord_id}> · [@${session.handle}](${session.live_url})`,
    fields: [
      { name: "Started", value: `<t:${Math.floor(Date.parse(session.started_at) / 1000)}:F>`, inline: false },
      { name: "Ended", value: `Between <t:${Math.floor(Date.parse(session.last_live_at) / 1000)}:t> and <t:${Math.floor(Date.parse(session.first_offline_at) / 1000)}:t>`, inline: false },
      { name: "Live duration", value: min === max ? `About ${min}` : `About ${min}–${max}`, inline: true },
      { name: "Peak concurrent viewers", value: String(Math.max(0, Number(session.peak_viewer_count) || 0)), inline: true },
      { name: "Verification", value: "TikTok start time; end bounded by live-status checks.", inline: false },
    ],
    footer: { text: `LIVE-${session.id}` },
    timestamp: session.ended_at || new Date().toISOString(),
  };
}

export async function sendTikTokLiveReport(channel, botUserId, session) {
  const marker = `LIVE-${session.id}`;
  const recent = await channel.messages.fetch({ limit: 100 });
  const existing = recent.find((message) => message.author.id === botUserId
    && message.embeds.some((embed) => embed.footer?.text === marker));
  if (existing) return existing;
  return channel.send({ embeds: [buildTikTokLiveReport(session)], allowedMentions: { parse: [] } });
}
