import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

const apiBase = "https://discord.com/api/v10";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(scriptDir, "..", "server.js");
const staticOnly = process.argv.includes("--static");
const failures = [];
const warnings = [];

function unique(values) {
  return [...new Set(values)];
}

function duplicates(values) {
  const seen = new Set();
  return unique(values.filter((value) => seen.has(value) || !seen.add(value)));
}

function reportFailure(message) {
  failures.push(message);
  console.error(`[Discord check] FAIL: ${message}`);
}

function reportWarning(message) {
  warnings.push(message);
  console.warn(`[Discord check] WARN: ${message}`);
}

function configured(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function validDiscordId(value) {
  return /^\d{17,22}$/.test(value);
}

function permissionSet(roles, guildId, memberRoleIds) {
  const selected = new Set([guildId, ...memberRoleIds]);
  return roles.reduce(
    (permissions, role) => selected.has(role.id) ? permissions | BigInt(role.permissions || 0) : permissions,
    0n,
  );
}

function applyOverwrite(permissions, overwrite) {
  if (!overwrite) return permissions;
  return (permissions & ~BigInt(overwrite.deny || 0)) | BigInt(overwrite.allow || 0);
}

function permissionsInChannel(basePermissions, channel, guildId, botMember) {
  if ((basePermissions & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator) {
    return basePermissions;
  }
  const overwrites = channel.permission_overwrites || [];
  let permissions = applyOverwrite(
    basePermissions,
    overwrites.find((overwrite) => overwrite.id === guildId),
  );

  let roleAllow = 0n;
  let roleDeny = 0n;
  const roleIds = new Set(botMember.roles || []);
  for (const overwrite of overwrites) {
    if (overwrite.type !== 0 || !roleIds.has(overwrite.id)) continue;
    roleAllow |= BigInt(overwrite.allow || 0);
    roleDeny |= BigInt(overwrite.deny || 0);
  }
  permissions = (permissions & ~roleDeny) | roleAllow;
  return applyOverwrite(
    permissions,
    overwrites.find((overwrite) => overwrite.type === 1 && overwrite.id === botMember.user.id),
  );
}

function missingPermissions(permissions, requiredPermissions) {
  if ((permissions & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator) return [];
  return requiredPermissions
    .filter(([, bit]) => (permissions & bit) !== bit)
    .map(([label]) => label);
}

const source = fs.readFileSync(serverPath, "utf8");
const commandNames = [...source.matchAll(/new\s+SlashCommandBuilder\(\)\s*\.setName\("([a-z0-9_-]+)"\)/g)]
  .map((match) => match[1]);
const handlerNames = [...source.matchAll(/interaction\.commandName\s*===\s*"([a-z0-9_-]+)"/g)]
  .map((match) => match[1]);
const uniqueCommands = unique(commandNames);
const uniqueHandlers = unique(handlerNames);
const duplicateCommands = duplicates(commandNames);
const missingHandlers = uniqueCommands.filter((name) => !uniqueHandlers.includes(name));
const orphanHandlers = uniqueHandlers.filter((name) => !uniqueCommands.includes(name));

try {
  const buildersStart = source.indexOf("const commandBuilders = [");
  const arrayStart = buildersStart >= 0 ? source.indexOf("[", buildersStart) : -1;
  const arrayEnd = arrayStart >= 0 ? source.indexOf("\n      ];", arrayStart) : -1;
  if (arrayStart < 0 || arrayEnd < 0) throw new Error("command builder array was not found");
  const buildCommands = new Function(
    "SlashCommandBuilder",
    `return ${source.slice(arrayStart, arrayEnd + 9).trim().replace(/;$/, "")};`,
  );
  const payloads = buildCommands(SlashCommandBuilder).map((builder) => builder.toJSON());
  const payloadNames = payloads.map((payload) => payload.name);
  if (payloadNames.length !== uniqueCommands.length) {
    reportFailure(`Slash builder validation produced ${payloadNames.length} payloads for ${uniqueCommands.length} definitions.`);
  }
  const mismatchedPayloadNames = uniqueCommands.filter((name) => !payloadNames.includes(name));
  if (mismatchedPayloadNames.length) {
    reportFailure(`Slash builder payloads missing: ${mismatchedPayloadNames.join(", ")}.`);
  }
} catch (error) {
  reportFailure(`Slash command payload validation failed: ${error.message}`);
}

if (!uniqueCommands.length) reportFailure("No slash command definitions were found in server.js.");
if (uniqueCommands.length > 100) reportFailure(`${uniqueCommands.length} global slash commands exceed Discord's 100-command limit.`);
if (duplicateCommands.length) reportFailure(`Duplicate slash commands: ${duplicateCommands.join(", ")}.`);
if (missingHandlers.length) reportFailure(`Commands without handlers: ${missingHandlers.join(", ")}.`);
if (orphanHandlers.length) reportFailure(`Handlers without command definitions: ${orphanHandlers.join(", ")}.`);
if (!/const\s+discordAiRuntimeEnabled\s*=\s*false\s*;/.test(source)) {
  reportFailure("Discord AI is not globally disabled as required.");
}
if (!/process\.env\.DISCORD_RESTOCK_CHANNEL_ID/.test(source)) {
  reportFailure("The restock channel environment setting is not wired into the bot.");
}
if (!/process\.env\.DISCORD_LEAVES_CHANNEL_ID/.test(source)) {
  reportFailure("The leaves channel environment setting is not wired into the bot.");
}
if (!/\[Discord interaction error\]/.test(source)) {
  reportFailure("The interaction handler has no global user-facing error fallback.");
}
if (/\bpingtest\b/.test(source)) {
  reportFailure("The temporary /pingtest diagnostic command is still present.");
}
for (const commandName of ["lookup", "ban", "say", "ticket-panel"]) {
  const handlerStart = source.indexOf(`if (interaction.commandName === "${commandName}")`);
  const handlerHead = handlerStart >= 0 ? source.slice(handlerStart, handlerStart + 700) : "";
  if (!/isDiscordOwnerInteraction\(interaction\)/.test(handlerHead)) {
    reportFailure(`/${commandName} is labeled owner-only but is not owner-gated at runtime.`);
  }
}
const definitionMatches = [...source.matchAll(/new\s+SlashCommandBuilder\(\)\s*\.setName\("([a-z0-9_-]+)"\)/g)];
for (let index = 0; index < definitionMatches.length; index += 1) {
  const definition = definitionMatches[index];
  const definitionEnd = definitionMatches[index + 1]?.index ?? definition.index + 3500;
  const definitionBlock = source.slice(definition.index, definitionEnd);
  const description = definitionBlock.match(/\.setDescription\("([^"]+)"\)/)?.[1] || "";
  const commandName = definition[1];
  const handlerNeedle = `interaction.commandName === "${commandName}"`;
  const handlerHeads = [];
  let handlerStart = source.indexOf(handlerNeedle);
  while (handlerStart >= 0) {
    handlerHeads.push(source.slice(handlerStart, handlerStart + 900));
    handlerStart = source.indexOf(handlerNeedle, handlerStart + handlerNeedle.length);
  }
  if (/\(owner only\)/i.test(description) && !handlerHeads.some((head) => /isDiscordOwnerInteraction\(interaction\)/.test(head))) {
    reportFailure(`/${commandName} is described as owner-only but is not owner-gated at runtime.`);
  }
  if (/\(admin only\)/i.test(description) && !handlerHeads.some((head) => /isDiscordAdminInteraction\(interaction\)/.test(head))) {
    reportFailure(`/${commandName} is described as admin-only but is not admin-gated at runtime.`);
  }
}
if (/discord_(?:access|refresh)_token:\s*tokenData\./.test(source)) {
  reportFailure("Discord OAuth credentials are still being stored as plaintext user metadata.");
}
if (!/createCipheriv\("aes-256-gcm"/.test(source) || !/discord_oauth_tokens/.test(source)) {
  reportFailure("Encrypted Discord OAuth token storage is not wired in.");
}
if (/\[Verification debug\]/.test(source)) {
  reportFailure("Temporary verification network diagnostics are still logging private request data.");
}
if (!/isOnSlashCooldown\("ticket-create"/.test(source) || !/discordMaxOpenTicketsPerUser/.test(source)) {
  reportFailure("Discord ticket creation is missing duplicate/cooldown protection.");
}
const reviewListenerStart = source.indexOf('if (!discordReviewChannelId || message.channel.id !== discordReviewChannelId) return;');
const reviewListener = reviewListenerStart >= 0 ? source.slice(reviewListenerStart, reviewListenerStart + 7000) : "";
if (!reviewListener || /if \(!discordAiRuntimeEnabled\) return;/.test(reviewListener.slice(0, 500))) {
  reportFailure("The Discord review pipeline is incorrectly disabled with Discord AI.");
}
const reviewRaterStart = source.indexOf("async function moderateAndRateReview");
const reviewRaterEnd = source.indexOf("/* ── Reviews: public approved reviews", reviewRaterStart);
const reviewRater = reviewRaterStart >= 0 && reviewRaterEnd > reviewRaterStart
  ? source.slice(reviewRaterStart, reviewRaterEnd)
  : "";
if (!reviewRater || /api\.groq\.com|generativelanguage\.googleapis\.com|\bfetch\s*\(/.test(reviewRater)) {
  reportFailure("Discord review rating still depends on an AI provider.");
}
for (const [label, marker, nextMarker] of [
  ["cross-channel spam guard", "Cross-channel spam guard", "Link filter + scam/phishing text detection"],
  ["link filter", "Link filter + scam/phishing text detection", "Product status sync"],
]) {
  const markerStart = source.indexOf(marker);
  const markerEnd = markerStart >= 0 ? source.indexOf(nextMarker, markerStart + marker.length) : -1;
  const listenerHead = markerStart >= 0
    ? source.slice(markerStart, markerEnd > markerStart ? markerEnd : markerStart + 8000)
    : "";
  if (!/discordBot\.prependListener\("messageCreate"/.test(listenerHead) || !/message\._filtered\s*=\s*true/.test(listenerHead)) {
    reportFailure(`The ${label} does not synchronously block downstream Discord listeners.`);
  }
}

console.log(
  `[Discord check] Static command audit: ${uniqueCommands.length} definitions, `
  + `${uniqueHandlers.length} handlers, AI disabled`,
);

if (staticOnly) {
  console.log(`[Discord check] Static result: ${failures.length ? `${failures.length} failure(s)` : "OK"}`);
  if (failures.length) process.exitCode = 2;
} else {
  const required = ["DISCORD_BOT_TOKEN", "DISCORD_CLIENT_ID", "DISCORD_GUILD_ID"];
  const missing = required.filter((name) => !configured(name));
  if (missing.length) reportFailure(`Missing required settings: ${missing.join(", ")}.`);
  if (!configured("DISCORD_CLIENT_SECRET")) {
    reportWarning("DISCORD_CLIENT_SECRET is missing; the gateway can run, but Discord account linking cannot.");
  }

  const idVariables = [...source.matchAll(/process\.env\.(DISCORD_[A-Z0-9_]+_ID)/g)]
    .map((match) => match[1]);
  for (const name of unique(idVariables)) {
    const value = configured(name);
    if (value && !validDiscordId(value)) reportFailure(`${name} is not a valid Discord snowflake ID.`);
  }

  if (!failures.length) {
    const token = configured("DISCORD_BOT_TOKEN").replace(/^Bot\s+/i, "");
    const clientId = configured("DISCORD_CLIENT_ID");
    const guildId = configured("DISCORD_GUILD_ID");
    const headers = { Authorization: `Bot ${token}` };

    async function discordGet(route) {
      const response = await fetch(`${apiBase}${route}`, {
        headers,
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(`${response.status} ${payload.message || "Discord request failed"}`);
        error.status = response.status;
        throw error;
      }
      return payload;
    }

    try {
      const bot = await discordGet("/users/@me");
      const application = await discordGet("/applications/@me");
      const guild = await discordGet(`/guilds/${guildId}`);
      const channels = await discordGet(`/guilds/${guildId}/channels`);
      const roles = await discordGet(`/guilds/${guildId}/roles`);
      const botMember = await discordGet(`/guilds/${guildId}/members/${bot.id}`);

      console.log(`[Discord check] Bot: ${bot.username}`);
      console.log(`[Discord check] Application: ${application.name}`);
      console.log(`[Discord check] Guild: ${guild.name}`);

      if (bot.id !== clientId || application.id !== clientId) {
        reportFailure("DISCORD_CLIENT_ID does not belong to the configured bot token.");
      }
      if (guild.id !== guildId) reportFailure("Discord returned a different guild than DISCORD_GUILD_ID.");

      const flags = Number(application.flags || 0);
      const hasGuildMembersIntent = Boolean(flags & ((1 << 14) | (1 << 15)));
      const hasMessageContentIntent = Boolean(flags & ((1 << 18) | (1 << 19)));
      console.log(`[Discord check] Server Members Intent: ${hasGuildMembersIntent ? "enabled" : "MISSING"}`);
      console.log(`[Discord check] Message Content Intent: ${hasMessageContentIntent ? "enabled" : "MISSING"}`);
      if (!hasGuildMembersIntent) reportFailure("Server Members privileged intent is disabled.");
      if (!hasMessageContentIntent) reportFailure("Message Content privileged intent is disabled.");

      const roleResources = [
        { label: "Customer role", env: "DISCORD_CUSTOMER_ROLE_ID", required: true, managed: true },
        { label: "Admin role", env: "DISCORD_ADMIN_ROLE_ID", required: true },
        { label: "Employee role", env: "DISCORD_EMPLOYEE_ROLE_ID", required: true },
        { label: "Owner role", env: "DISCORD_OWNER_ROLE_ID", required: true },
        { label: "Repeat buyer role", env: "DISCORD_REPEAT_BUYER_ROLE_ID", managed: true },
        { label: "Verified role", env: "DISCORD_VERIFIED_ROLE_ID", required: true, managed: true },
        { label: "Unverified role", env: "DISCORD_UNVERIFIED_ROLE_ID", required: true, managed: true },
        { label: "Reseller role", env: "DISCORD_RESELLER_ROLE_ID", managed: true },
        { label: "Media role", env: "DISCORD_MEDIA_ROLE_ID", managed: true },
        { label: "Media manager role", env: "DISCORD_MEDIA_MANAGER_ROLE_ID" },
      ];
      const channelResources = [
        { label: "Verification channel", env: "DISCORD_VERIFICATION_CHANNEL_ID", fallback: "1528634343369736284", required: true, types: [0, 5] },
        { label: "Support channel", env: "DISCORD_SUPPORT_CHANNEL_ID", fallback: "1528634344405729386", required: true, types: [0, 5] },
        { label: "Ticket category", env: "DISCORD_TICKET_CATEGORY_ID", fallback: "1528634344174780596", required: true, types: [4] },
        { label: "Pending ticket category", env: "DISCORD_PENDING_TICKET_CATEGORY_ID", fallback: "1529891065794924564", required: true, types: [4] },
        { label: "Inactive ticket category", env: "DISCORD_INACTIVE_TICKET_CATEGORY_ID", types: [4] },
        { label: "Ticket queue channel", env: "DISCORD_TICKET_QUEUE_CHANNEL_ID", types: [0, 5] },
        { label: "Restock channel", env: "DISCORD_RESTOCK_CHANNEL_ID", fallback: "1533570508845486272", required: true, types: [0, 5] },
        { label: "Low stock channel", env: "DISCORD_LOW_STOCK_CHANNEL_ID", types: [0, 5] },
        { label: "Review channel", env: "DISCORD_REVIEW_CHANNEL_ID", types: [0, 5] },
        { label: "Proof channel", env: "DISCORD_PROOF_CHANNEL_ID", types: [0, 5] },
        { label: "Payments channel", env: "DISCORD_PAYMENTS_CHANNEL_ID", types: [0, 5] },
        { label: "Leaves channel", env: "DISCORD_LEAVES_CHANNEL_ID", fallback: "1529854614198026340", required: true, types: [0, 5] },
        { label: "Questions channel", env: "DISCORD_QUESTIONS_CHANNEL_ID", fallback: "1528634344174780590", required: true, types: [0, 5] },
        { label: "Transcript channel", env: "DISCORD_TRANSCRIPT_CHANNEL_ID", types: [0, 5] },
        { label: "Moderation channel", env: "DISCORD_MODERATION_CHANNEL_ID", types: [0, 5] },
        { label: "Signup channel", env: "DISCORD_SIGNUP_CHANNEL_ID", types: [0, 5] },
        { label: "Verification appeal channel", env: "DISCORD_VERIFICATION_APPEAL_CHANNEL_ID", fallback: "1530685965205635162", required: true, types: [0, 5] },
        { label: "Staff guide channel", env: "DISCORD_STAFF_GUIDE_CHANNEL_ID", fallback: "1530269093100388583", types: [0, 5] },
        { label: "Status source channel", env: "DISCORD_STATUS_SOURCE_CHANNEL_ID", fallback: "1531112552891813949", types: [0, 5] },
        { label: "Status target channel", env: "DISCORD_STATUS_TARGET_CHANNEL_ID", fallback: "1531148640481972284", types: [0, 5] },
        { label: "Media category", env: "DISCORD_MEDIA_CATEGORY_ID", types: [4] },
        { label: "Media review channel", env: "DISCORD_MEDIA_REVIEW_CHANNEL_ID", types: [0, 5] },
      ];

      const botRolePositions = botMember.roles
        .map((id) => roles.find((role) => role.id === id)?.position || 0);
      const highestBotRolePosition = Math.max(0, ...botRolePositions);

      for (const resource of roleResources) {
        const id = configured(resource.env);
        const role = id ? roles.find((item) => item.id === id) : null;
        console.log(`[Discord check] ${resource.label}: ${role ? `OK (@${role.name})` : id ? "INVALID ID" : "not configured"}`);
        if ((resource.required || id) && !role) reportFailure(`${resource.label} is ${id ? "invalid" : "not configured"}.`);
        if (role?.managed && resource.managed) reportFailure(`${resource.label} is integration-managed and cannot be assigned by this bot.`);
        if (role && resource.managed && role.position >= highestBotRolePosition) {
          reportFailure(`${resource.label} (@${role.name}) is not below the bot's highest role.`);
        }
      }

      const basePermissions = permissionSet(roles, guildId, botMember.roles || []);
      const requiredGuildPermissions = [
        ["View Channels", PermissionFlagsBits.ViewChannel],
        ["Send Messages", PermissionFlagsBits.SendMessages],
        ["Read Message History", PermissionFlagsBits.ReadMessageHistory],
        ["Embed Links", PermissionFlagsBits.EmbedLinks],
        ["Attach Files", PermissionFlagsBits.AttachFiles],
        ["Add Reactions", PermissionFlagsBits.AddReactions],
        ["Manage Channels", PermissionFlagsBits.ManageChannels],
        ["Manage Messages", PermissionFlagsBits.ManageMessages],
        ["Manage Roles", PermissionFlagsBits.ManageRoles],
        ["Manage Threads", PermissionFlagsBits.ManageThreads],
        ["Create Public Threads", PermissionFlagsBits.CreatePublicThreads],
        ["Create Private Threads", PermissionFlagsBits.CreatePrivateThreads],
        ["Send Messages in Threads", PermissionFlagsBits.SendMessagesInThreads],
        ["Mention Everyone", PermissionFlagsBits.MentionEveryone],
        ["Kick Members", PermissionFlagsBits.KickMembers],
        ["Ban Members", PermissionFlagsBits.BanMembers],
        ["Moderate Members", PermissionFlagsBits.ModerateMembers],
      ];
      const missingGuildPermissions = missingPermissions(basePermissions, requiredGuildPermissions);
      console.log(`[Discord check] Server permissions: ${missingGuildPermissions.length ? `MISSING (${missingGuildPermissions.join(", ")})` : "OK"}`);
      if (missingGuildPermissions.length) {
        reportFailure(`Bot role lacks server permissions: ${missingGuildPermissions.join(", ")}.`);
      }

      const commonChannelPermissions = [
        ["View Channel", PermissionFlagsBits.ViewChannel],
        ["Send Messages", PermissionFlagsBits.SendMessages],
        ["Read Message History", PermissionFlagsBits.ReadMessageHistory],
        ["Embed Links", PermissionFlagsBits.EmbedLinks],
      ];
      for (const resource of channelResources) {
        const id = configured(resource.env, resource.fallback);
        const channel = id ? channels.find((item) => item.id === id) : null;
        const typeValid = channel && resource.types.includes(channel.type);
        console.log(`[Discord check] ${resource.label}: ${channel ? (typeValid ? `OK (#${channel.name})` : "WRONG CHANNEL TYPE") : id ? "INVALID ID" : "not configured"}`);
        if ((resource.required || id) && !channel) reportFailure(`${resource.label} is ${id ? "invalid" : "not configured"}.`);
        if (channel && !typeValid) reportFailure(`${resource.label} has the wrong Discord channel type.`);
        if (channel && typeValid && channel.type !== 4) {
          const channelPermissions = permissionsInChannel(basePermissions, channel, guildId, botMember);
          const missing = missingPermissions(channelPermissions, commonChannelPermissions);
          if (missing.length) reportFailure(`${resource.label} denies the bot: ${missing.join(", ")}.`);
        }
      }

      if (bot.id === clientId && application.id === clientId) {
        const [guildCommands, globalCommands] = await Promise.all([
          discordGet(`/applications/${clientId}/guilds/${guildId}/commands`),
          discordGet(`/applications/${clientId}/commands`),
        ]);
        for (const [scope, registered] of [["guild", guildCommands], ["global", globalCommands]]) {
          const registeredNames = registered.map((command) => command.name);
          const missingRegistered = uniqueCommands.filter((name) => !registeredNames.includes(name));
          const staleRegistered = registeredNames.filter((name) => !uniqueCommands.includes(name));
          console.log(`[Discord check] ${scope} commands: ${registeredNames.length}/${uniqueCommands.length}`);
          if (missingRegistered.length) reportFailure(`${scope} commands missing: ${missingRegistered.join(", ")}.`);
          if (staleRegistered.length) reportFailure(`${scope} commands stale: ${staleRegistered.join(", ")}.`);
        }
      }
    } catch (error) {
      const tokenHint = error.status === 401
        ? " Reset the bot token in Discord Developer Portal, then replace DISCORD_BOT_TOKEN locally and on Render."
        : "";
      reportFailure(`${error.message}.${tokenHint}`);
    }
  }

  console.log(
    `[Discord check] Result: ${failures.length ? `${failures.length} failure(s)` : "OK"}`
    + `${warnings.length ? `, ${warnings.length} warning(s)` : ""}`,
  );
  if (failures.length) process.exitCode = 2;
}
