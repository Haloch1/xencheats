import { EventEmitter } from "node:events";

const DISCORD_EPOCH = 1420070400000n;

export function discordSnowflakeCreatedAt(id) {
  try {
    return new Date(Number((BigInt(String(id)) >> 22n) + DISCORD_EPOCH));
  } catch {
    return null;
  }
}

export function riskScoreForMember({ accountAgeDays, avatarPresent, joinedRecently, quicklyLeft, activationCount = 0 }) {
  let score = 0;
  if (Number.isFinite(accountAgeDays) && accountAgeDays < 1) score += 42;
  else if (Number.isFinite(accountAgeDays) && accountAgeDays < 7) score += 24;
  else if (Number.isFinite(accountAgeDays) && accountAgeDays < 30) score += 10;
  if (avatarPresent === false) score += 12;
  if (joinedRecently) score += 8;
  if (quicklyLeft) score += 28;
  if (activationCount === 0) score += 6;
  return Math.min(100, score);
}

export function toOhlc(points) {
  let previous = 0;
  return points.map((point) => {
    const close = Number(point.value) || 0;
    const open = previous;
    previous = close;
    return { time: point.time, open, high: Math.max(open, close), low: Math.min(open, close), close };
  });
}

function asIso(value = new Date()) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function memberRoles(member) {
  return [...(member?.roles?.cache?.values?.() || [])]
    .filter((role) => role.name !== "@everyone")
    .map((role) => ({ id: role.id, name: role.name, position: role.position }))
    .sort((a, b) => b.position - a.position);
}

function safeUser(memberOrUser) {
  const user = memberOrUser?.user || memberOrUser;
  return {
    id: user?.id ? String(user.id) : null,
    username: user?.username || null,
    displayName: memberOrUser?.displayName || user?.globalName || user?.username || null,
    isBot: Boolean(user?.bot),
    avatarPresent: Boolean(user?.avatar),
  };
}

function chunk(items, size = 500) {
  const result = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

export function createDiscordAnalytics({ supabase, guildId, enabled = true, presenceEnabled = false, snapshotMinutes = 5, logger = console }) {
  const events = new EventEmitter();
  const openVoiceSessions = new Map();
  const inviteUses = new Map();
  let activeGuild = null;
  let snapshotTimer = null;
  let aggregateTimer = null;
  let automationTimer = null;
  let settings = null;
  let started = false;
  let lastError = null;
  let lastSnapshotAt = null;
  let lastAggregateAt = null;

  const usable = () => Boolean(enabled && supabase && guildId);
  const belongs = (guild) => Boolean(guild && String(guild.id) === String(guildId));
  const notify = (type, detail = {}) => events.emit("update", { type, detail, at: new Date().toISOString() });
  const fail = (where, error) => {
    lastError = `${where}: ${String(error?.message || error)}`.slice(0, 300);
    logger.error?.(`[Discord analytics] ${lastError}`);
  };
  const safely = async (where, operation) => {
    try { return await operation(); } catch (error) { fail(where, error); return null; }
  };

  async function writeEvent({ userId, type, at = new Date(), origin = "gateway", metadata = {}, key = null }) {
    if (!usable() || !userId) return;
    const occurredAt = asIso(at);
    const eventKey = key || `${guildId}:${userId}:${type}:${occurredAt}`;
    const { error } = await supabase.from("discord_analytics_member_events").upsert({
      event_key: eventKey,
      guild_id: String(guildId),
      user_id: String(userId),
      event_type: type,
      occurred_at: occurredAt,
      origin,
      metadata,
    }, { onConflict: "event_key", ignoreDuplicates: true });
    if (error) throw error;
  }

  async function loadSettings(force = false) {
    if (!usable()) return null;
    if (settings && !force) return settings;
    const { data, error } = await supabase.from("discord_analytics_settings")
      .select("*").eq("guild_id", String(guildId)).maybeSingle();
    if (error) throw error;
    settings = data || {
      guild_id: String(guildId), enabled: true, presence_tracking_enabled: Boolean(presenceEnabled),
      ignored_channel_ids: [], ignored_role_ids: [], alert_config: {},
    };
    return settings;
  }

  async function ensureSettings() {
    if (!usable()) return null;
    const now = new Date().toISOString();
    const { error } = await supabase.from("discord_analytics_settings").upsert({
      guild_id: String(guildId),
      enabled: true,
      presence_tracking_enabled: Boolean(presenceEnabled),
      tracking_started_at: now,
      updated_at: now,
    }, { onConflict: "guild_id", ignoreDuplicates: true });
    if (error) throw error;
    return loadSettings(true);
  }

  function channelIsIgnored(channelId) {
    return Array.isArray(settings?.ignored_channel_ids) && settings.ignored_channel_ids.includes(String(channelId));
  }

  function matchInviteForJoin() {
    const changed = [];
    for (const [code, current] of inviteUses.entries()) {
      if (Number(current.lastDelta) > 0) changed.push(current);
    }
    if (changed.length !== 1) return null;
    changed[0].lastDelta = 0;
    return changed[0];
  }

  async function refreshInvites(guild = activeGuild) {
    if (!usable() || !belongs(guild)) return [];
    const fetched = await guild.invites.fetch();
    const now = new Date().toISOString();
    const nextCodes = new Set();
    const rows = [];
    for (const invite of fetched.values()) {
      const prior = inviteUses.get(invite.code);
      const row = {
        guild_id: String(guildId), code: invite.code,
        inviter_id: invite.inviter?.id || null,
        inviter_username: invite.inviter?.username || null,
        uses: Number(invite.uses) || 0, max_uses: invite.maxUses ?? null,
        expires_at: invite.expiresAt?.toISOString?.() || null,
        created_at: invite.createdAt?.toISOString?.() || null,
        snapshot_at: now, active: true,
      };
      inviteUses.set(invite.code, { ...row, lastDelta: Math.max(0, Number(row.uses) - Number(prior?.uses ?? row.uses)) });
      rows.push(row);
      nextCodes.add(invite.code);
    }
    for (const [code] of inviteUses.entries()) {
      if (!nextCodes.has(code)) inviteUses.delete(code);
    }
    if (rows.length) {
      const { error } = await supabase.from("discord_analytics_invites").upsert(rows, { onConflict: "guild_id,code" });
      if (error) throw error;
    }
    return rows;
  }

  async function recordMemberJoin(member, { origin = "gateway" } = {}) {
    if (!usable() || !belongs(member?.guild)) return;
    await safely("record member join", async () => {
      await loadSettings();
      if (settings?.enabled === false) return;
      const user = safeUser(member);
      if (!user.id) return;
      const joinedAt = member.joinedAt || new Date();
      const accountCreatedAt = discordSnowflakeCreatedAt(user.id);
      // Usage counters change before Discord emits the member event. Refresh
      // them here, then attribute only when exactly one invite advanced.
      await refreshInvites(member.guild).catch(() => null);
      const invite = matchInviteForJoin();
      const roles = memberRoles(member);
      const memberRow = {
        guild_id: String(guildId), user_id: user.id, username: user.username, display_name: user.displayName,
        is_bot: user.isBot, avatar_present: user.avatarPresent, joined_at: asIso(joinedAt),
        account_created_at: accountCreatedAt?.toISOString() || null,
        account_age_at_join_seconds: accountCreatedAt ? Math.max(0, Math.round((joinedAt - accountCreatedAt) / 1000)) : null,
        pending_at_join: Boolean(member.pending), roles_at_join: roles, current_roles: roles,
        invite_code: invite?.code || null, inviter_id: invite?.inviter_id || null,
        last_activity_at: asIso(joinedAt), left_at: null, is_current: true, source: origin, updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("discord_analytics_members").upsert(memberRow, { onConflict: "guild_id,user_id" });
      if (error) throw error;
      await writeEvent({ userId: user.id, type: "join", at: joinedAt, origin, key: `join:${guildId}:${user.id}:${asIso(joinedAt)}`, metadata: {
        account_created_at: memberRow.account_created_at, account_age_at_join_seconds: memberRow.account_age_at_join_seconds,
        avatar_present: user.avatarPresent, invite_code: memberRow.invite_code, inviter_id: memberRow.inviter_id,
      } });
      notify("member_join", { userId: user.id });
    });
  }

  async function recordMemberLeave(member) {
    if (!usable() || !belongs(member?.guild)) return;
    await safely("record member leave", async () => {
      const user = safeUser(member);
      if (!user.id) return;
      const at = new Date();
      const { error } = await supabase.from("discord_analytics_members").upsert({
        guild_id: String(guildId), user_id: user.id, username: user.username, display_name: user.displayName,
        is_bot: user.isBot, avatar_present: user.avatarPresent, current_roles: memberRoles(member),
        left_at: asIso(at), is_current: false, updated_at: asIso(at), source: "gateway",
      }, { onConflict: "guild_id,user_id" });
      if (error) throw error;
      await writeEvent({ userId: user.id, type: "leave", at, key: `leave:${guildId}:${user.id}:${asIso(at)}` });
      notify("member_leave", { userId: user.id });
    });
  }

  async function recordMessage(message, { origin = "gateway" } = {}) {
    if (!usable() || !belongs(message?.guild) || !message?.author || channelIsIgnored(message.channelId)) return;
    await safely("record message", async () => {
      await loadSettings();
      if (settings?.enabled === false || channelIsIgnored(message.channelId)) return;
      const user = safeUser(message.author);
      const sentAt = message.createdAt || new Date();
      const { error } = await supabase.from("discord_analytics_messages").upsert({
        message_id: String(message.id), guild_id: String(guildId), channel_id: String(message.channelId),
        channel_name: message.channel?.name || null, author_id: user.id, is_bot: user.isBot, sent_at: asIso(sentAt),
        message_type: message.type != null ? String(message.type) : null,
        has_reply: Boolean(message.reference?.messageId), attachment_count: message.attachments?.size || 0,
        reaction_count: message.reactions?.cache?.size || 0, origin,
      }, { onConflict: "message_id", ignoreDuplicates: true });
      if (error) throw error;
      if (!user.isBot) {
        await supabase.from("discord_analytics_members").upsert({
          guild_id: String(guildId), user_id: user.id, username: user.username, display_name: user.displayName,
          is_bot: false, avatar_present: user.avatarPresent, first_message_at: asIso(sentAt), last_activity_at: asIso(sentAt),
          updated_at: asIso(sentAt), is_current: true, source: origin,
        }, { onConflict: "guild_id,user_id", ignoreDuplicates: true });
      }
      notify("message", { channelId: String(message.channelId) });
    });
  }

  async function recordVoiceState(oldState, newState) {
    const state = newState || oldState;
    if (!usable() || !belongs(state?.guild) || state.member?.user?.bot) return;
    await safely("record voice state", async () => {
      const user = safeUser(state.member);
      const key = `${guildId}:${user.id}`;
      const oldChannelId = oldState?.channelId ? String(oldState.channelId) : null;
      const newChannelId = newState?.channelId ? String(newState.channelId) : null;
      const at = new Date();
      const open = openVoiceSessions.get(key);
      if (oldChannelId && oldChannelId !== newChannelId && open) {
        await supabase.from("discord_analytics_voice_sessions").update({ ended_at: asIso(at) })
          .eq("guild_id", String(guildId)).eq("user_id", user.id).eq("channel_id", open.channelId).eq("started_at", open.startedAt);
        await writeEvent({ userId: user.id, type: "voice_leave", at, key: `voice_leave:${guildId}:${user.id}:${open.startedAt}` });
        openVoiceSessions.delete(key);
      }
      if (newChannelId && oldChannelId !== newChannelId) {
        const startedAt = asIso(at);
        await supabase.from("discord_analytics_voice_sessions").upsert({
          guild_id: String(guildId), user_id: user.id, channel_id: newChannelId,
          channel_name: newState.channel?.name || null, started_at: startedAt, origin: "gateway",
        }, { onConflict: "guild_id,user_id,channel_id,started_at", ignoreDuplicates: true });
        openVoiceSessions.set(key, { channelId: newChannelId, startedAt });
        await supabase.from("discord_analytics_members").upsert({
          guild_id: String(guildId), user_id: user.id, username: user.username, display_name: user.displayName,
          is_bot: false, avatar_present: user.avatarPresent, first_voice_at: startedAt, last_activity_at: startedAt,
          updated_at: startedAt, is_current: true, source: "gateway",
        }, { onConflict: "guild_id,user_id", ignoreDuplicates: true });
        await writeEvent({ userId: user.id, type: "voice_join", at, key: `voice_join:${guildId}:${user.id}:${startedAt}`, metadata: { channel_id: newChannelId } });
      }
      notify("voice", { userId: user.id });
    });
  }

  async function recordPresence(_oldPresence, presence) {
    if (!presenceEnabled || !usable() || !belongs(presence?.guild) || presence.user?.bot) return;
    await safely("record presence", async () => {
      const user = safeUser(presence.user);
      await writeEvent({ userId: user.id, type: "presence", key: `presence:${guildId}:${user.id}:${presence.status}:${Math.floor(Date.now() / 60_000)}`, metadata: { status: presence.status || "offline" } });
    });
  }

  async function recordSnapshot(guild = activeGuild, source = "gateway") {
    if (!usable() || !belongs(guild)) return;
    await safely("record member snapshot", async () => {
      const bucket = new Date(Math.floor(Date.now() / (snapshotMinutes * 60_000)) * snapshotMinutes * 60_000).toISOString();
      const cached = [...guild.members.cache.values()];
      const humans = cached.filter((member) => !member.user.bot).length;
      const bots = cached.filter((member) => member.user.bot).length;
      const online = presenceEnabled ? cached.filter((member) => member.presence?.status && member.presence.status !== "offline").length : null;
      const voice = cached.filter((member) => Boolean(member.voice?.channelId)).length;
      const { error } = await supabase.from("discord_analytics_member_count_snapshots").upsert({
        guild_id: String(guildId), bucket_start: bucket, resolution: `${snapshotMinutes}m`, source,
        member_count: Number(guild.memberCount) || cached.length, human_count: humans, bot_count: bots, online_count: online, voice_count: voice,
      }, { onConflict: "guild_id,bucket_start,resolution,source" });
      if (error) throw error;
      lastSnapshotAt = new Date().toISOString();
      notify("snapshot", { memberCount: Number(guild.memberCount) || cached.length });
    });
  }

  async function refreshDailyStats(days = 90) {
    if (!usable()) return;
    await safely("refresh daily stats", async () => {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const [eventsResult, messagesResult, voiceResult, snapshotsResult] = await Promise.all([
        supabase.from("discord_analytics_member_events").select("event_type,occurred_at,user_id").eq("guild_id", String(guildId)).gte("occurred_at", since).limit(100000),
        supabase.from("discord_analytics_messages").select("sent_at,author_id,is_bot").eq("guild_id", String(guildId)).gte("sent_at", since).limit(100000),
        supabase.from("discord_analytics_voice_sessions").select("started_at,ended_at,user_id").eq("guild_id", String(guildId)).gte("started_at", since).limit(100000),
        supabase.from("discord_analytics_member_count_snapshots").select("bucket_start,member_count").eq("guild_id", String(guildId)).gte("bucket_start", since).order("bucket_start", { ascending: true }).limit(100000),
      ]);
      for (const result of [eventsResult, messagesResult, voiceResult, snapshotsResult]) if (result.error) throw result.error;
      const byDay = new Map();
      const rowFor = (stamp) => {
        const day = String(stamp).slice(0, 10);
        if (!byDay.has(day)) byDay.set(day, { guild_id: String(guildId), day, joins: 0, leaves: 0, messages: 0, active: new Set(), senders: new Set(), voice: 0, ending_member_count: null });
        return byDay.get(day);
      };
      for (const event of eventsResult.data || []) {
        const row = rowFor(event.occurred_at);
        if (event.event_type === "join") row.joins += 1;
        if (event.event_type === "leave") row.leaves += 1;
        row.active.add(event.user_id);
      }
      for (const message of messagesResult.data || []) {
        if (message.is_bot) continue;
        const row = rowFor(message.sent_at); row.messages += 1; row.active.add(message.author_id); row.senders.add(message.author_id);
      }
      for (const session of voiceResult.data || []) {
        const row = rowFor(session.started_at);
        const end = session.ended_at ? new Date(session.ended_at) : new Date();
        row.voice += Math.max(0, Math.min(24 * 60, Math.round((end - new Date(session.started_at)) / 60_000)));
        row.active.add(session.user_id);
      }
      for (const snapshot of snapshotsResult.data || []) rowFor(snapshot.bucket_start).ending_member_count = snapshot.member_count;
      const rows = [...byDay.values()].map((row) => ({
        guild_id: row.guild_id, day: row.day, joins: row.joins, leaves: row.leaves, messages: row.messages,
        active_members: row.active.size, unique_senders: row.senders.size, voice_minutes: row.voice,
        ending_member_count: row.ending_member_count, source: "computed", refreshed_at: new Date().toISOString(),
      }));
      if (rows.length) {
        const { error } = await supabase.from("discord_analytics_daily_stats").upsert(rows, { onConflict: "guild_id,day" });
        if (error) throw error;
      }
      lastAggregateAt = new Date().toISOString();
      notify("aggregate", { days: rows.length });
    });
  }

  async function applyAutomations() {
    if (!usable() || !activeGuild) return;
    await safely("apply stat roles and counters", async () => {
      const [rolesResult, countersResult, messagesResult, voiceResult] = await Promise.all([
        supabase.from("discord_analytics_stat_roles").select("role_id,metric,threshold,enabled").eq("guild_id", String(guildId)).eq("enabled", true),
        supabase.from("discord_analytics_counters").select("channel_id,metric,format,enabled").eq("guild_id", String(guildId)).eq("enabled", true),
        supabase.from("discord_analytics_messages").select("author_id,is_bot,sent_at").eq("guild_id", String(guildId)).limit(100000),
        supabase.from("discord_analytics_voice_sessions").select("user_id,started_at,ended_at").eq("guild_id", String(guildId)).limit(100000),
      ]);
      for (const result of [rolesResult, countersResult, messagesResult, voiceResult]) if (result.error) throw result.error;
      const messageCount = new Map();
      for (const row of messagesResult.data || []) if (!row.is_bot) messageCount.set(row.author_id, (messageCount.get(row.author_id) || 0) + 1);
      const voiceMinutes = new Map();
      for (const row of voiceResult.data || []) {
        const end = row.ended_at ? new Date(row.ended_at) : new Date();
        const minutes = Math.max(0, Math.min(24 * 60, Math.round((end - new Date(row.started_at)) / 60_000)));
        voiceMinutes.set(row.user_id, (voiceMinutes.get(row.user_id) || 0) + minutes);
      }
      for (const rule of rolesResult.data || []) {
        const role = activeGuild.roles.cache.get(rule.role_id);
        if (!role) continue;
        for (const member of activeGuild.members.cache.values()) {
          if (member.user.bot || member.roles.cache.has(rule.role_id)) continue;
          const joinedDays = member.joinedAt ? Math.floor((Date.now() - member.joinedAt.getTime()) / 86_400_000) : 0;
          const metric = rule.metric === "message_count" ? (messageCount.get(member.id) || 0)
            : rule.metric === "voice_minutes" ? (voiceMinutes.get(member.id) || 0) : joinedDays;
          if (metric >= Number(rule.threshold)) {
            await member.roles.add(role, `Discord analytics ${rule.metric} threshold reached`).catch((error) => fail("assign stat role", error));
          }
        }
      }
      const cached = [...activeGuild.members.cache.values()];
      const values = {
        members: Number(activeGuild.memberCount) || cached.length,
        online: presenceEnabled ? cached.filter((member) => member.presence?.status && member.presence.status !== "offline").length : null,
        voice: cached.filter((member) => Boolean(member.voice?.channelId)).length,
        messages_today: (messagesResult.data || []).filter((row) => !row.is_bot && String(row.sent_at).slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
      };
      for (const counter of countersResult.data || []) {
        const value = values[counter.metric];
        if (value == null) continue;
        const channel = activeGuild.channels.cache.get(counter.channel_id);
        if (!channel?.setName) continue;
        const nextName = String(counter.format || "{value}").replaceAll("{value}", String(value)).slice(0, 100);
        if (nextName && channel.name !== nextName) await channel.setName(nextName, "Discord analytics counter update").catch((error) => fail("update counter", error));
      }
      notify("automations", { statRoles: rolesResult.data?.length || 0, counters: countersResult.data?.length || 0 });
    });
  }

  async function createBackfillJob(kind = "members") {
    if (!usable() || !["members", "messages", "voice_reconcile"].includes(kind)) throw new Error("Unsupported backfill type.");
    const { data, error } = await supabase.from("discord_analytics_backfill_jobs").insert({
      guild_id: String(guildId), kind, status: "queued", cursor: {}, total_hint: kind === "members" ? activeGuild?.memberCount || null : null,
    }).select("*").single();
    if (error) throw error;
    void processBackfillJob(data.id);
    return data;
  }

  async function resumeBackfillJobs() {
    if (!usable()) return;
    const { data, error } = await supabase.from("discord_analytics_backfill_jobs")
      .select("id").eq("guild_id", String(guildId)).in("status", ["queued", "running"]).order("created_at", { ascending: true }).limit(3);
    if (error) throw error;
    for (const job of data || []) void processBackfillJob(job.id);
  }

  async function processBackfillJob(jobId) {
    if (!usable() || !activeGuild) return;
    await safely("process backfill job", async () => {
      const { data: job, error: readError } = await supabase.from("discord_analytics_backfill_jobs").select("*").eq("id", jobId).maybeSingle();
      if (readError) throw readError;
      if (!job || !["queued", "running"].includes(job.status)) return;
      await supabase.from("discord_analytics_backfill_jobs").update({ status: "running", started_at: job.started_at || new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", job.id);
      if (job.kind === "voice_reconcile") {
        for (const member of activeGuild.members.cache.values()) if (member.voice?.channelId) await recordVoiceState({ guild: activeGuild, member, channelId: null }, member.voice);
        await supabase.from("discord_analytics_backfill_jobs").update({ status: "complete", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", job.id);
        return;
      }
      if (job.kind === "members") {
        const after = job.cursor?.after || undefined;
        const members = await activeGuild.members.fetch({ limit: 1000, after });
        const rows = [...members.values()].map((member) => {
          const user = safeUser(member); const joinedAt = member.joinedAt || new Date(); const createdAt = discordSnowflakeCreatedAt(user.id);
          return { guild_id: String(guildId), user_id: user.id, username: user.username, display_name: user.displayName, is_bot: user.isBot,
            avatar_present: user.avatarPresent, joined_at: asIso(joinedAt), account_created_at: createdAt?.toISOString() || null,
            account_age_at_join_seconds: createdAt ? Math.max(0, Math.round((joinedAt - createdAt) / 1000)) : null,
            pending_at_join: Boolean(member.pending), roles_at_join: memberRoles(member), current_roles: memberRoles(member), is_current: true,
            source: "discord_member_backfill", updated_at: new Date().toISOString() };
        });
        for (const part of chunk(rows)) {
          const { error } = await supabase.from("discord_analytics_members").upsert(part, { onConflict: "guild_id,user_id" }); if (error) throw error;
        }
        const processed = Number(job.processed_count || 0) + rows.length;
        if (rows.length < 1000) {
          await supabase.from("discord_analytics_backfill_jobs").update({ status: "complete", processed_count: processed, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", job.id);
          await recordSnapshot(activeGuild, "discord_member_backfill");
          notify("backfill_complete", { id: job.id, kind: job.kind, processed });
        } else {
          const afterId = rows[rows.length - 1].user_id;
          await supabase.from("discord_analytics_backfill_jobs").update({ cursor: { after: afterId }, processed_count: processed, updated_at: new Date().toISOString() }).eq("id", job.id);
          setTimeout(() => void processBackfillJob(job.id), 750).unref?.();
          notify("backfill_progress", { id: job.id, kind: job.kind, processed });
        }
        return;
      }
      // Message history is intentionally channel-by-channel and resumable. It
      // stores only message metadata; content is never read into analytics DB.
      const channels = [...activeGuild.channels.cache.values()].filter((channel) => channel.isTextBased?.() && !channel.isDMBased?.());
      const cursor = job.cursor || {}; const channelIndex = Number(cursor.channelIndex) || 0;
      const channel = channels[channelIndex];
      if (!channel) {
        await supabase.from("discord_analytics_backfill_jobs").update({ status: "complete", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", job.id);
        notify("backfill_complete", { id: job.id, kind: job.kind, processed: job.processed_count }); return;
      }
      if (channelIsIgnored(channel.id)) {
        await supabase.from("discord_analytics_backfill_jobs").update({ cursor: { channelIndex: channelIndex + 1 }, updated_at: new Date().toISOString() }).eq("id", job.id);
        setTimeout(() => void processBackfillJob(job.id), 250).unref?.(); return;
      }
      const messages = await channel.messages.fetch({ limit: 100, before: cursor.before || undefined });
      const rows = [...messages.values()].map((message) => ({
        message_id: String(message.id), guild_id: String(guildId), channel_id: String(channel.id), channel_name: channel.name || null,
        author_id: String(message.author.id), is_bot: Boolean(message.author.bot), sent_at: asIso(message.createdAt), message_type: String(message.type),
        has_reply: Boolean(message.reference?.messageId), attachment_count: message.attachments?.size || 0, reaction_count: message.reactions?.cache?.size || 0, origin: "discord_message_backfill",
      }));
      if (rows.length) {
        for (const part of chunk(rows)) { const { error } = await supabase.from("discord_analytics_messages").upsert(part, { onConflict: "message_id", ignoreDuplicates: true }); if (error) throw error; }
      }
      const processed = Number(job.processed_count || 0) + rows.length;
      const nextCursor = rows.length < 100 ? { channelIndex: channelIndex + 1 } : { channelIndex, before: rows[rows.length - 1].message_id };
      await supabase.from("discord_analytics_backfill_jobs").update({ cursor: nextCursor, processed_count: processed, updated_at: new Date().toISOString() }).eq("id", job.id);
      setTimeout(() => void processBackfillJob(job.id), 750).unref?.();
      notify("backfill_progress", { id: job.id, kind: job.kind, processed });
    });
  }

  async function start(guild) {
    if (!usable() || !belongs(guild) || started) return;
    activeGuild = guild; started = true;
    await safely("initialize", async () => { await ensureSettings(); await refreshInvites(guild); await recordSnapshot(guild, "startup"); await refreshDailyStats(); });
    snapshotTimer = setInterval(() => void recordSnapshot(activeGuild), Math.max(1, snapshotMinutes) * 60_000); snapshotTimer.unref?.();
    aggregateTimer = setInterval(() => void refreshDailyStats(), 15 * 60_000); aggregateTimer.unref?.();
    automationTimer = setInterval(() => void applyAutomations(), 60 * 60_000); automationTimer.unref?.();
    void createBackfillJob("voice_reconcile").catch((error) => fail("voice reconcile", error));
    void resumeBackfillJobs().catch((error) => fail("resume backfills", error));
    void applyAutomations();
    notify("ready", { guildId: String(guildId) });
  }

  function getHealth() {
    return { enabled: usable(), started, guildId: guildId ? String(guildId) : null, presenceEnabled: Boolean(presenceEnabled), lastError, lastSnapshotAt, lastAggregateAt, openVoiceSessions: openVoiceSessions.size };
  }

  return { events, start, loadSettings, ensureSettings, refreshInvites, recordMemberJoin, recordMemberLeave, recordMessage, recordVoiceState, recordPresence, recordSnapshot, refreshDailyStats, applyAutomations, createBackfillJob, processBackfillJob, resumeBackfillJobs, getHealth };
}
