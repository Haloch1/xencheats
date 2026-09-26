import { ChannelType } from "discord.js";

const CATEGORY_RENAMES = [
  ["Staff info", "STAFF INFO"],
  ["Staff stuff", "STAFF WORKSPACE"],
  ["admin stuff", "OPERATIONS LOGS"],
];

const CHANNEL_RENAMES = [
  ["Staff stuff", "tickets", "ticket-queue"],
  ["Staff stuff", "moderator-only", "moderation-logs"],
  ["admin stuff", "purchases", "order-logs"],
  ["admin stuff", "key-logs", "key-delivery-audit"],
  ["admin stuff", "transcript", "ticket-transcripts"],
  ["admin stuff", "accounts", "account-signups"],
  ["admin stuff", "leaves", "member-leaves"],
  ["admin stuff", "snapshots", "supplier-balance-snapshots"],
];

const MIGRATION_REASON = "Organize XenCheats staff and operations channels";

function uniqueChannel(channels, name, parentId, type) {
  const matches = [...channels.values()].filter((channel) =>
    channel.name === name && channel.type === type
    && (parentId === undefined || channel.parentId === parentId));
  if (matches.length > 1) throw new Error(`Multiple channels named ${name} found`);
  return matches[0] || null;
}

export function planDiscordStaffLayout(channels, { financeChannelId, keyAuditChannelId } = {}) {
  const finance = channels.get(financeChannelId);
  const keyAudit = channels.get(keyAuditChannelId);
  if (finance?.name !== "finance" || !["key-logs", "key-delivery-audit"].includes(keyAudit?.name)) {
    throw new Error("XenCheats channel anchors did not match; no changes made");
  }

  const categories = new Map();
  for (const [oldName, newName] of CATEGORY_RENAMES) {
    const oldCategory = uniqueChannel(channels, oldName, undefined, ChannelType.GuildCategory);
    const newCategory = uniqueChannel(channels, newName, undefined, ChannelType.GuildCategory);
    if (oldCategory && newCategory) throw new Error(`Both category names exist: ${oldName}, ${newName}`);
    const category = oldCategory || newCategory;
    if (!category) throw new Error(`Missing category: ${oldName}`);
    categories.set(oldName, category);
  }

  const renames = [];
  for (const [categoryName, oldName, newName] of CHANNEL_RENAMES) {
    const parentId = categories.get(categoryName).id;
    const oldChannel = uniqueChannel(channels, oldName, parentId, ChannelType.GuildText);
    const newChannel = uniqueChannel(channels, newName, parentId, ChannelType.GuildText);
    if (oldChannel && newChannel) throw new Error(`Both channel names exist: ${oldName}, ${newName}`);
    const channel = oldChannel || newChannel;
    if (!channel) throw new Error(`Missing channel: ${oldName}`);
    if (oldChannel) renames.push({ channel, newName });
  }

  const operationsId = categories.get("admin stuff").id;
  const stocks = uniqueChannel(channels, "stocks", operationsId, ChannelType.GuildText);
  if (!stocks) throw new Error("Missing stock channel; no changes made");
  const deployments = uniqueChannel(channels, "deployments", operationsId, ChannelType.GuildText);
  const applications = uniqueChannel(channels, "applications", operationsId, ChannelType.GuildText);
  if (!applications) throw new Error("Missing application channel; no changes made");

  return {
    categories: CATEGORY_RENAMES.map(([oldName, newName]) => ({
      channel: categories.get(oldName),
      newName,
      needsRename: categories.get(oldName).name !== newName,
    })),
    renames,
    stocks,
    deployments,
    applications,
    operationsId,
  };
}

export async function organizeDiscordStaffLayout(guild, { mode, financeChannelId, keyAuditChannelId, logger = console }) {
  if (!["audit", "apply"].includes(mode)) throw new Error("Invalid staff layout mode");
  const channels = await guild.channels.fetch();
  const plan = planDiscordStaffLayout(channels, { financeChannelId, keyAuditChannelId });
  logger.log(`[Discord layout] ${mode}: ${plan.renames.length} channel names, ${plan.categories.filter((item) => item.needsRename).length} category names, stocks ${plan.stocks.id}, applications ${plan.applications.id}, deployments ${plan.deployments ? `exists ${plan.deployments.id}` : "missing"}.`);
  if (mode === "audit") return { applied: false, deploymentsId: plan.deployments?.id || null, applicationsId: plan.applications.id };

  let deployments = plan.deployments;
  if (!deployments) {
    deployments = await guild.channels.create({
      name: "deployments",
      type: ChannelType.GuildText,
      parent: plan.operationsId,
      topic: "Production deployment notices and build results.",
      permissionOverwrites: [...plan.stocks.permissionOverwrites.cache.values()].map((overwrite) => ({
        id: overwrite.id,
        type: overwrite.type,
        allow: overwrite.allow.bitfield,
        deny: overwrite.deny.bitfield,
      })),
      reason: MIGRATION_REASON,
    });
    logger.log(`[Discord layout] Created deployments channel ${deployments.id}.`);
  }
  for (const { channel, newName } of plan.renames) {
    await channel.setName(newName, MIGRATION_REASON);
    logger.log(`[Discord layout] Renamed channel ${channel.id} to ${newName}.`);
  }
  for (const { channel, newName, needsRename } of plan.categories) {
    if (!needsRename) continue;
    await channel.setName(newName, MIGRATION_REASON);
    logger.log(`[Discord layout] Renamed category ${channel.id} to ${newName}.`);
  }
  return { applied: true, deploymentsId: deployments.id, applicationsId: plan.applications.id };
}
