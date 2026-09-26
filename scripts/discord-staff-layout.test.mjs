import assert from "node:assert/strict";
import { ChannelType } from "discord.js";
import { organizeDiscordStaffLayout, planDiscordStaffLayout } from "../lib/discord-staff-layout.mjs";

const channels = new Map();
function add(id, name, type, parentId = null) {
  const channel = {
    id, name, type, parentId,
    permissionOverwrites: { cache: new Map() },
    async setName(nextName) { this.name = nextName; },
  };
  channels.set(id, channel);
  return channel;
}
const info = add("info", "Staff info", ChannelType.GuildCategory);
const staff = add("staff", "Staff stuff", ChannelType.GuildCategory);
const operations = add("operations", "admin stuff", ChannelType.GuildCategory);
add("finance", "finance", ChannelType.GuildText, operations.id);
add("key", "key-logs", ChannelType.GuildText, operations.id);
add("stock", "stocks", ChannelType.GuildText, operations.id);
add("applications", "applications", ChannelType.GuildText, operations.id);
for (const name of ["tickets", "moderator-only"]) add(name, name, ChannelType.GuildText, staff.id);
for (const name of ["purchases", "transcript", "accounts", "leaves", "snapshots"]) add(name, name, ChannelType.GuildText, operations.id);

const options = { financeChannelId: "finance", keyAuditChannelId: "key" };
const first = planDiscordStaffLayout(channels, options);
assert.equal(first.renames.length, 8);
assert.equal(first.categories.filter((item) => item.needsRename).length, 3);
assert.equal(first.deployments, null);
const guild = {
  channels: {
    async fetch() { return channels; },
    async create(input) {
      assert.equal(input.parent, operations.id);
      assert.deepEqual(input.permissionOverwrites, []);
      return add("deployments", input.name, input.type, input.parent);
    },
  },
};
const logger = { log() {} };
const audit = await organizeDiscordStaffLayout(guild, { ...options, mode: "audit", logger });
assert.equal(audit.applied, false);
assert.equal(first.renames[0].channel.name, "tickets");
const applied = await organizeDiscordStaffLayout(guild, { ...options, mode: "apply", logger });
assert.equal(applied.applied, true);
assert.equal(applied.deploymentsId, "deployments");
assert.equal(applied.applicationsId, "applications");
const second = planDiscordStaffLayout(channels, options);
assert.equal(second.renames.length, 0);
assert.equal(second.categories.filter((item) => item.needsRename).length, 0);
assert.equal(second.deployments.id, "deployments");
assert.equal(info.name, "STAFF INFO");
const repeated = await organizeDiscordStaffLayout(guild, { ...options, mode: "apply", logger });
assert.equal(repeated.deploymentsId, "deployments");
assert.throws(() => planDiscordStaffLayout(channels, { ...options, financeChannelId: "stock" }), /anchors/);
console.log("Discord staff layout tests passed");
