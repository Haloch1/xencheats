import "dotenv/config";

const apiBase = "https://discord.com/api/v10";
const required = ["DISCORD_BOT_TOKEN", "DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_GUILD_ID"];
const missing = required.filter((name) => !String(process.env[name] || "").trim());

if (missing.length) {
  console.error(`[Discord check] Missing: ${missing.join(", ")}`);
  process.exit(1);
}

const headers = { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` };

async function discordGet(path) {
  const response = await fetch(`${apiBase}${path}`, { headers });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`${response.status} ${payload.message || "Discord request failed"}`);
  }

  return payload;
}

try {
  const bot = await discordGet("/users/@me");
  const application = await discordGet("/applications/@me");
  const guild = await discordGet(`/guilds/${process.env.DISCORD_GUILD_ID}`);
  const channels = await discordGet(`/guilds/${process.env.DISCORD_GUILD_ID}/channels`);
  const roles = await discordGet(`/guilds/${process.env.DISCORD_GUILD_ID}/roles`);
  const botMember = await discordGet(`/guilds/${process.env.DISCORD_GUILD_ID}/members/${bot.id}`);
  const flags = Number(application.flags || 0);
  const hasGuildMembersIntent = Boolean(flags & ((1 << 14) | (1 << 15)));
  const hasMessageContentIntent = Boolean(flags & ((1 << 18) | (1 << 19)));
  const botRolePositions = botMember.roles
    .map((id) => roles.find((role) => role.id === id)?.position || 0);
  const highestBotRolePosition = Math.max(0, ...botRolePositions);
  const resources = [
    ["Customer role", "DISCORD_CUSTOMER_ROLE_ID", roles],
    ["Admin role", "DISCORD_ADMIN_ROLE_ID", roles],
    ["Employee role", "DISCORD_EMPLOYEE_ROLE_ID", roles],
    ["Owner role", "DISCORD_OWNER_ROLE_ID", roles],
    ["Repeat buyer role", "DISCORD_REPEAT_BUYER_ROLE_ID", roles],
    ["Verified role", "DISCORD_VERIFIED_ROLE_ID", roles],
    ["Unverified role", "DISCORD_UNVERIFIED_ROLE_ID", roles],
    ["Verification channel", "DISCORD_VERIFICATION_CHANNEL_ID", channels],
    ["Support channel", "DISCORD_SUPPORT_CHANNEL_ID", channels],
    ["Restock channel", "DISCORD_RESTOCK_CHANNEL_ID", channels],
    ["Low stock channel", "DISCORD_LOW_STOCK_CHANNEL_ID", channels],
    ["Review channel", "DISCORD_REVIEW_CHANNEL_ID", channels],
    ["Proof channel", "DISCORD_PROOF_CHANNEL_ID", channels],
    ["Payments channel", "DISCORD_PAYMENTS_CHANNEL_ID", channels],
    ["Leaves channel", "DISCORD_LEAVES_CHANNEL_ID", channels],
    ["Questions channel", "DISCORD_QUESTIONS_CHANNEL_ID", channels],
    ["Transcript channel", "DISCORD_TRANSCRIPT_CHANNEL_ID", channels],
  ];

  console.log(`[Discord check] Bot: ${bot.username}`);
  console.log(`[Discord check] Application: ${application.name}`);
  console.log(`[Discord check] Guild: ${guild.name}`);
  console.log(`[Discord check] Server Members Intent: ${hasGuildMembersIntent ? "enabled" : "MISSING"}`);
  console.log(`[Discord check] Message Content Intent: ${hasMessageContentIntent ? "enabled" : "MISSING"}`);

  resources.forEach(([label, variable, list]) => {
    const id = String(process.env[variable] || "").trim();
    const resource = id ? list.find((item) => item.id === id) : null;
    console.log(`[Discord check] ${label}: ${resource ? `OK (#${resource.name})` : id ? "INVALID ID" : "not configured"}`);
  });

  const managedRoleVariables = [
    "DISCORD_CUSTOMER_ROLE_ID",
    "DISCORD_VERIFIED_ROLE_ID",
    "DISCORD_UNVERIFIED_ROLE_ID",
    "DISCORD_REPEAT_BUYER_ROLE_ID",
  ];
  const blockedRoles = managedRoleVariables
    .map((variable) => roles.find((role) => role.id === String(process.env[variable] || "").trim()))
    .filter((role) => role && role.position >= highestBotRolePosition);

  console.log(`[Discord check] Role hierarchy: ${blockedRoles.length ? `BLOCKED (${blockedRoles.map((role) => role.name).join(", ")})` : "OK"}`);

  if (!hasGuildMembersIntent || !hasMessageContentIntent || blockedRoles.length) {
    process.exitCode = 2;
  }
} catch (error) {
  const tokenHint = /^401\b/.test(error.message)
    ? " Reset the bot token in Discord Developer Portal, then replace DISCORD_BOT_TOKEN locally and on Render."
    : "";
  console.error(`[Discord check] Failed: ${error.message}.${tokenHint}`);
  process.exitCode = 1;
}
