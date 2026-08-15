const { Client, WebhookClient } = require('discord.js-selfbot-v13');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const WEBHOOKS_FILE = path.join(__dirname, 'webhooks.json');

// Render's "Secret Files" feature (used to keep config.json out of git) mounts
// files at /etc/secrets/<filename>, not into the app's own directory. Check the
// local path first (works when running on your own machine), then fall back to
// Render's secret-file location (works when deployed).
const LOCAL_CONFIG_FILE = path.join(__dirname, 'config.json');
const RENDER_SECRET_CONFIG_FILE = '/etc/secrets/config.json';
const CONFIG_FILE = fs.existsSync(LOCAL_CONFIG_FILE) ? LOCAL_CONFIG_FILE : RENDER_SECRET_CONFIG_FILE;

const DEFAULT_CONFIG = {
    targetGuildId: null,
    modes: {
        fullServerCopy: false,
        autoCreateChannels: true
    },
    sourceGuildId: null,
    channels: [],
    categorySettings: {
        targetCategoryId: null,
        copyCategoryStructure: false
    },
    botSettings: {
        username: 'Bot'
    },
    loopMessage: {
        enabled: false,
        sourceChannelId: '',
        messageId: '',      // legacy single-message field, still supported
        messageIds: [],      // loop specific messages from the same channel
        wholeChannel: false, // instead of fixed IDs, re-mirror whatever's currently in the channel each cycle
        fetchLimit: 50,       // max messages to pull when wholeChannel is true
        intervalSeconds: 60,
        randomJitterSeconds: 0
    }
};

function mergeConfig(value = {}) {
    const loaded = value && typeof value === 'object' ? value : {};
    return {
        ...DEFAULT_CONFIG,
        ...loaded,
        modes: { ...DEFAULT_CONFIG.modes, ...(loaded.modes || {}) },
        categorySettings: { ...DEFAULT_CONFIG.categorySettings, ...(loaded.categorySettings || {}) },
        botSettings: { ...DEFAULT_CONFIG.botSettings, ...(loaded.botSettings || {}) },
        loopMessage: { ...DEFAULT_CONFIG.loopMessage, ...(loaded.loopMessage || {}) },
        channels: loaded.channels ?? DEFAULT_CONFIG.channels
    };
}

// Load configuration from config.json
let config = mergeConfig();

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            const loadedConfig = JSON.parse(data);
            config = mergeConfig(loadedConfig);
            console.log('📂 Loaded configuration from config.json');
        } else {
            console.log('⚠️ config.json not found, using defaults and .env fallback');
        }
    } catch (error) {
        console.error('❌ Error loading config.json:', error.message);
    }
}

// Load config on startup
loadConfig();

let configWatcher = null;
let configReloadTimer = null;

// Watch for changes to config.json
function watchConfigFile() {
    if (configWatcher || !fs.existsSync(CONFIG_FILE)) return;
    console.log('👀 Watching config.json for changes...');
    configWatcher = fs.watch(CONFIG_FILE, (eventType) => {
        if (eventType === 'change') {
            console.log('\n🔄 Detected change in config.json, reloading...');
            clearTimeout(configReloadTimer);
            configReloadTimer = setTimeout(() => {
                loadConfig();
                refreshRuntimeSettings();
                loadChannelsFromConfig();
                if (client.isReady()) {
                    void startLoopMessage();
                }
            }, 250);
        }
    });
    configWatcher.on('error', (error) => {
        console.error('❌ Config watcher error:', error.message);
        configWatcher = null;
    });
}

// Token (sensitive - keep in .env). Whatever token you were already using with
// this project goes here — this file doesn't care whether it came from the
// Developer Portal or is the token your normal client uses.
const TOKEN = String(process.env.TOKEN || process.env.BOT_TOKEN || '')
    .trim()
    .replace(/^Bot\s+/i, '');

// Configuration values (prioritize config.json, fallback to .env)
let BOT_USERNAME;
let TARGET_GUILD_ID;
let TARGET_CATEGORY_ID;
let COPY_CATEGORY_STRUCTURE;
let SOURCE_GUILD_ID;
let FULL_SERVER_COPY;
let AUTO_CREATE_CHANNELS;

function refreshRuntimeSettings() {
    BOT_USERNAME = String(config.botSettings?.username || process.env.BOT_USERNAME || 'Mirror Bot').trim().slice(0, 80) || 'Mirror Bot';
    TARGET_GUILD_ID = String(config.targetGuildId || process.env.TARGET_GUILD_ID || '').trim();
    TARGET_CATEGORY_ID = String(config.categorySettings?.targetCategoryId || process.env.TARGET_CATEGORY_ID || '').trim() || null;
    COPY_CATEGORY_STRUCTURE = config.categorySettings?.copyCategoryStructure === true
        || process.env.COPY_CATEGORY_STRUCTURE === 'true';
    SOURCE_GUILD_ID = String(config.sourceGuildId || process.env.SOURCE_GUILD_ID || '').trim() || null;
    FULL_SERVER_COPY = config.modes?.fullServerCopy === true || process.env.FULL_SERVER_COPY === 'true';
    AUTO_CREATE_CHANNELS = config.modes?.autoCreateChannels !== false
        && process.env.AUTO_CREATE_CHANNELS !== 'false';
}

refreshRuntimeSettings();

if (!TOKEN) {
    console.error('❌ No token configured! Set TOKEN (or BOT_TOKEN) in .env');
    process.exit(1);
}

// Storage for channel mappings: { sourceChannelId: { webhookUrl, targetChannelId, targetChannelName } }
let channelWebhookMap = {};

// Lock to prevent concurrent webhook creation for the same channel
const creationLocks = new Map();

// Load existing webhook mappings from file
function loadWebhookMappings() {
    try {
        if (fs.existsSync(WEBHOOKS_FILE)) {
            const data = fs.readFileSync(WEBHOOKS_FILE, 'utf8');
            channelWebhookMap = JSON.parse(data);
            console.log('📂 Loaded existing webhook mappings:', Object.keys(channelWebhookMap).length);
        } else {
            console.log('📂 No existing webhook mappings found, starting fresh');
        }
    } catch (error) {
        console.error('❌ Error loading webhook mappings:', error.message);
        channelWebhookMap = {};
    }
}

// Save webhook mappings to file
function saveWebhookMappings() {
    try {
        const temporaryFile = `${WEBHOOKS_FILE}.tmp`;
        fs.writeFileSync(temporaryFile, JSON.stringify(channelWebhookMap, null, 2), { mode: 0o600 });
        fs.renameSync(temporaryFile, WEBHOOKS_FILE);
        console.log('💾 Saved webhook mappings to file');
    } catch (error) {
        console.error('❌ Error saving webhook mappings:', error.message);
    }
}

// Load source channel IDs from config or .env (supports unlimited channels)
let sourceChannelIds = [];
let channelCount = 0;
let channelMappings = {}; // Maps source channel ID to target channel ID

function isDiscordSnowflake(value) {
    return /^\d{17,22}$/.test(String(value || '').trim());
}

// Function to load channels from config
function loadChannelsFromConfig() {
    try {
        // Support both array format and object mapping format
        let newChannels = [];
        let newMappings = {};
        let usesManualMappings = false;

        if (Array.isArray(config.channels)) {
            // Array format: ["channel_id_1", "channel_id_2"]
            newChannels = config.channels;
        } else if (typeof config.channels === 'object' && config.channels !== null) {
            // Object format: {"source_id": "target_id"}
            usesManualMappings = true;
            newChannels = Object.keys(config.channels);
            newMappings = config.channels;
        }

        newChannels = newChannels.map(value => String(value || '').trim());
        const invalidChannels = newChannels.filter(channelId => !isDiscordSnowflake(channelId));
        if (invalidChannels.length) {
            console.warn(`⚠️ Ignoring ${invalidChannels.length} invalid source channel ID(s).`);
        }
        newChannels = [...new Set(newChannels.filter(isDiscordSnowflake))];
        const validMappings = [];
        for (const [source, target] of Object.entries(newMappings)) {
            if (!newChannels.includes(source)) continue;
            const targetId = String(target || '').trim();
            if (!isDiscordSnowflake(targetId)) {
                console.warn(`⚠️ Ignoring source ${source}: its target channel ID is invalid.`);
                continue;
            }
            if (source === targetId) {
                console.warn(`⚠️ Ignoring source ${source}: it maps back into itself.`);
                continue;
            }
            validMappings.push([source, targetId]);
        }
        newMappings = Object.fromEntries(validMappings);
        if (usesManualMappings) {
            const validMappedSources = new Set(Object.keys(newMappings));
            newChannels = newChannels.filter(source => validMappedSources.has(source));
        }

        const added = newChannels.filter(ch => !sourceChannelIds.includes(ch));
        const removed = sourceChannelIds.filter(ch => !newChannels.includes(ch));

        sourceChannelIds = [...newChannels];
        channelMappings = { ...newMappings };
        channelCount = sourceChannelIds.length;

        if (added.length > 0) {
            console.log(`✅ Added ${added.length} new channel(s):`, added);
        }
        if (removed.length > 0) {
            console.log(`🗑️ Removed ${removed.length} channel(s):`, removed);
        }

        console.log(`📊 Total channels loaded: ${channelCount}`);
        if (Object.keys(newMappings).length > 0) {
            console.log(`🗺️ Manual channel mappings: ${Object.keys(newMappings).length}`);
        }
        return true;
    } catch (error) {
        console.error('❌ Error loading channels from config:', error.message);
    }
    return false;
}

// Watch for changes to config.json
function watchChannelsFile() {
    watchConfigFile();
}

if (FULL_SERVER_COPY) {
    if (!SOURCE_GUILD_ID) {
        console.error('❌ FULL_SERVER_COPY enabled but SOURCE_GUILD_ID not configured!');
        process.exit(1);
    }
    console.log(`🌐 FULL SERVER COPY MODE enabled for server: ${SOURCE_GUILD_ID}`);
    console.log('📡 Will monitor ALL channels in the source server');
} else {
    console.log('🔍 Loading source channel IDs...');

    // First try loading from config.json
    const loadedFromConfig = loadChannelsFromConfig();

    // If config.json doesn't exist or is empty, fall back to .env
    if (!loadedFromConfig || channelCount === 0) {
        console.log('📝 Loading from .env file...');
        for (let i = 1; i <= 200; i++) {
            const channelKey = `CHANNEL_${i}`;
            const channelId = process.env[channelKey];

            if (!channelId) {
                if (channelCount > 0) {
                    break; // Stop if we've found channels and now hit a gap
                }
                continue; // Skip gaps in numbering
            }

            if (!isDiscordSnowflake(channelId)) {
                console.warn(`⚠️ Ignoring invalid ${channelKey}.`);
                continue;
            }

            sourceChannelIds.push(channelId);
            channelCount++;
            console.log(`✅ Loaded source channel ${i}: ${channelId}`);
        }
    }

    if (channelCount === 0 && !(config.loopMessage && config.loopMessage.enabled)) {
        console.error('❌ No source channels configured! Add channels to config.json or CHANNEL_1, CHANNEL_2, etc. to .env');
        process.exit(1);
    }
}

if (!TARGET_GUILD_ID) {
    console.error('❌ TARGET_GUILD_ID not configured! Add it to config.json or .env');
    process.exit(1);
}
if (!isDiscordSnowflake(TARGET_GUILD_ID)) {
    console.error('❌ TARGET_GUILD_ID is not a valid Discord server ID.');
    process.exit(1);
}
if (FULL_SERVER_COPY && !isDiscordSnowflake(SOURCE_GUILD_ID)) {
    console.error('❌ SOURCE_GUILD_ID is not a valid Discord server ID.');
    process.exit(1);
}
if (FULL_SERVER_COPY && SOURCE_GUILD_ID === TARGET_GUILD_ID) {
    console.error('❌ Source and target guilds must be different in full-server copy mode (this prevents a webhook loop).');
    process.exit(1);
}

console.log(`\n📊 Mode: 🪝 WEBHOOK MIRROR`);
if (FULL_SERVER_COPY) {
    console.log(`🌐 Full server copy: ENABLED (Source: ${SOURCE_GUILD_ID})`);
} else {
    console.log(`📊 Total source channels to monitor: ${channelCount}`);
}
console.log(`🎯 Target guild ID: ${TARGET_GUILD_ID}`);
console.log(`🏗️ Auto-create channels: ${AUTO_CREATE_CHANNELS ? 'ENABLED' : 'DISABLED (using manual mappings)'}`);
if (TARGET_CATEGORY_ID) {
    console.log(`📁 Target category ID: ${TARGET_CATEGORY_ID}`);
}
if (COPY_CATEGORY_STRUCTURE) {
    console.log(`📋 Category structure copying: ENABLED`);
}

// Load existing webhook mappings
loadWebhookMappings();

async function findOrCreateTargetWebhook(targetChannel, discordClient) {
    try {
        const webhooks = await targetChannel.fetchWebhooks();
        const reusable = webhooks.find(webhook =>
            webhook.token
            && webhook.name === BOT_USERNAME
            && (!webhook.owner?.id || webhook.owner.id === discordClient.user.id)
        );
        if (reusable?.url) {
            console.log(`✅ Reusing existing webhook in ${targetChannel.name}`);
            return reusable;
        }
    } catch (error) {
        console.warn(`⚠️ Could not inspect existing webhooks in ${targetChannel.name}: ${error.message}`);
    }

    console.log(`🔗 Creating webhook in ${targetChannel.name}...`);
    return targetChannel.createWebhook(BOT_USERNAME);
}

// Function to get or create webhook for a source channel
async function getOrCreateWebhook(sourceChannel, discordClient) {
    const sourceChannelId = sourceChannel.id;
    const sourceChannelName = sourceChannel.name;

    console.log(`\n🔍 Processing channel: ${sourceChannelName} (${sourceChannelId})`);

    // Check if we already have a webhook for this channel
    const storedMapping = channelWebhookMap[sourceChannelId];
    const configuredTargetChannelId = channelMappings[sourceChannelId] || null;
    const mappingMatchesConfig = !configuredTargetChannelId
        || storedMapping?.targetChannelId === configuredTargetChannelId;
    // Old entries without destination metadata are rebuilt once. Reusing an
    // unverifiable URL could silently keep posting into a previous guild.
    const mappingMatchesGuild = storedMapping?.targetGuildId === TARGET_GUILD_ID;
    if (storedMapping?.webhookUrl && mappingMatchesConfig && mappingMatchesGuild) {
        console.log(`✅ Using existing webhook for ${sourceChannelName}`);
        return storedMapping.webhookUrl;
    }
    if (storedMapping?.webhookUrl) {
        console.log(`🔄 Destination mapping changed for ${sourceChannelName}; rebuilding webhook mapping.`);
        delete channelWebhookMap[sourceChannelId];
        saveWebhookMappings();
    }

    // If auto-create is disabled, check for manual mapping
    if (!AUTO_CREATE_CHANNELS) {
        const targetChannelId = channelMappings[sourceChannelId];

        if (!targetChannelId) {
            console.error(`❌ Auto-create disabled and no manual mapping found for ${sourceChannelName} (${sourceChannelId})`);
            console.error(`   Add mapping to config.json: { "channels": { "${sourceChannelId}": "target_channel_id" } }`);
            return null;
        }
        if (targetChannelId === sourceChannelId) {
            console.error(`❌ Refusing to mirror ${sourceChannelName} back into itself.`);
            return null;
        }

        console.log(`🗺️ Using manual mapping to target channel: ${targetChannelId}`);

        try {
            const targetGuild = await discordClient.guilds.fetch(TARGET_GUILD_ID);
            const targetChannel = await targetGuild.channels.fetch(targetChannelId);

            if (!targetChannel) {
                console.error(`❌ Target channel not found: ${targetChannelId}`);
                return null;
            }

            console.log(`✅ Found target channel: ${targetChannel.name} (${targetChannelId})`);

            const webhook = await findOrCreateTargetWebhook(targetChannel, discordClient);
            console.log(`✅ Webhook ready in ${targetChannel.name}`);

            // Store mapping
            channelWebhookMap[sourceChannelId] = {
                webhookUrl: webhook.url,
                targetGuildId: TARGET_GUILD_ID,
                targetChannelId: targetChannel.id,
                targetChannelName: targetChannel.name,
                sourceChannelName: sourceChannelName,
                createdAt: new Date().toISOString(),
                manualMapping: true
            };

            saveWebhookMappings();
            return webhook.url;

        } catch (error) {
            console.error(`❌ Error setting up manual mapping:`, error.message);
            return null;
        }
    }

    // Check if creation is already in progress for this channel
    if (creationLocks.has(sourceChannelId)) {
        console.log(`⏳ Waiting for existing creation process for ${sourceChannelName}...`);
        return await creationLocks.get(sourceChannelId);
    }

    console.log(`🆕 No webhook found, creating new channel and webhook...`);

    // Create a promise for this creation process and store it in the lock
    const creationPromise = (async () => {
        try {
            // Get target guild
            const targetGuild = await discordClient.guilds.fetch(TARGET_GUILD_ID);
            if (!targetGuild) {
                console.error(`❌ Could not fetch target guild: ${TARGET_GUILD_ID}`);
                return null;
            }

            console.log(`📍 Target guild: ${targetGuild.name}`);

            // Determine category for new channel
            let categoryId = TARGET_CATEGORY_ID;

            if (COPY_CATEGORY_STRUCTURE && sourceChannel.parent) {
                // Try to find or create matching category
                const sourceCategoryName = sourceChannel.parent.name;
                console.log(`📂 Source category: ${sourceCategoryName}`);

                let targetCategory = targetGuild.channels.cache.find(
                    c => c.type === 'GUILD_CATEGORY' && c.name === sourceCategoryName
                );

                if (!targetCategory) {
                    console.log(`🆕 Creating category: ${sourceCategoryName}`);
                    targetCategory = await targetGuild.channels.create(sourceCategoryName, {
                        type: 'GUILD_CATEGORY'
                    });
                } else {
                    console.log(`✅ Found existing category: ${sourceCategoryName}`);
                }

                categoryId = targetCategory.id;
            }

            // Check if channel with same name already exists
            let targetChannel = targetGuild.channels.cache.find(
                c => c.name === sourceChannelName && c.type === 'GUILD_TEXT'
            );

            if (!targetChannel) {
                console.log(`🆕 Creating channel: ${sourceChannelName}`);
                targetChannel = await targetGuild.channels.create(sourceChannelName, {
                    type: 'GUILD_TEXT',
                    parent: categoryId || undefined
                });
                console.log(`✅ Created channel: ${targetChannel.name} (${targetChannel.id})`);
            } else {
                console.log(`✅ Found existing channel: ${targetChannel.name} (${targetChannel.id})`);
            }

            if (targetChannel.id === sourceChannelId) {
                console.error(`❌ Refusing to mirror ${sourceChannelName} back into the same channel.`);
                return null;
            }

            const webhook = await findOrCreateTargetWebhook(targetChannel, discordClient);
            console.log(`✅ Webhook ready in ${targetChannel.name}`);

            // Store mapping
            channelWebhookMap[sourceChannelId] = {
                webhookUrl: webhook.url,
                targetGuildId: TARGET_GUILD_ID,
                targetChannelId: targetChannel.id,
                targetChannelName: targetChannel.name,
                sourceChannelName: sourceChannelName,
                createdAt: new Date().toISOString()
            };

            saveWebhookMappings();

            return webhook.url;

        } catch (error) {
            console.error(`❌ Error creating webhook for ${sourceChannelName}:`, error.message);
            if (error.code) {
                console.error(`   Error code: ${error.code}`);
            }
            return null;
        } finally {
            // Remove the lock after completion (success or failure)
            creationLocks.delete(sourceChannelId);
        }
    })();

    // Store the promise in the lock map
    creationLocks.set(sourceChannelId, creationPromise);

    // Wait for and return the result
    return await creationPromise;
}

const client = new Client({
    checkUpdate: false
});

if (fs.existsSync(CONFIG_FILE)) {
    watchChannelsFile();
}

client.on('error', error => console.error('❌ Discord client error:', error.message));
client.on('warn', warning => console.warn('⚠️ Discord client warning:', warning));

client.once('ready', async () => {
    console.log(`\n✅ Logged in as ${client.user.tag}`);

    // If full server copy mode, populate channel IDs from the source server
    if (FULL_SERVER_COPY && SOURCE_GUILD_ID) {
        try {
            const sourceGuild = await client.guilds.fetch(SOURCE_GUILD_ID);
            const guildChannels = await sourceGuild.channels.fetch();
            const textChannels = guildChannels.filter(ch => ch && ch.type === 'GUILD_TEXT'); // Text channels only
            sourceChannelIds = [...textChannels.keys()];
            console.log(`🌐 Loaded ${sourceChannelIds.length} text channels from source server: ${sourceGuild.name}`);
            textChannels.forEach(ch => console.log(`   - ${ch.name} (${ch.id})`));
        } catch (error) {
            console.error(`❌ Failed to load source server channels: ${error.message}`);
            process.exit(1);
        }
    }

    console.log(`📡 Monitoring ${sourceChannelIds.length} source channels`);
    console.log(`🔄 Ready to mirror messages!\n`);

    await startLoopMessage();
});

// Reusable forwarder: takes a message object and mirrors it, via webhook, to its
// mapped target channel. Used by both the live listener and the interval-based
// "loop message" feature below.
async function forwardMessage(message, allowWebhookRecovery = true) {
    const webhookUrl = await getOrCreateWebhook(message.channel, client);

    if (!webhookUrl) {
        console.error(`❌ Failed to get webhook for channel ${message.channel.name}`);
        return;
    }

    let webhook = null;
    try {
        webhook = new WebhookClient({ url: webhookUrl });

        const payload = {
            username: BOT_USERNAME,
            // Mirrored user/role syntax must never ping unrelated members in
            // the destination server.
            allowedMentions: { parse: [] }
        };

        // Text content (strip @everyone/@here to avoid accidental mass pings)
        if (message.content && message.content.length > 0) {
            payload.content = message.content
                .replace(/@everyone/g, '')
                .replace(/@here/g, '');
        }

        // All embeds, forwarded together (Discord allows up to 10 per message)
        if (message.embeds.length > 0) {
            payload.embeds = message.embeds.slice(0, 10).map(embed => ({
                title: embed.title || undefined,
                description: embed.description || undefined,
                url: embed.url || undefined,
                color: embed.color ?? undefined,
                timestamp: embed.timestamp || undefined,
                footer: embed.footer && embed.footer.text
                    ? { text: embed.footer.text, icon_url: embed.footer.iconURL || embed.footer.icon_url }
                    : undefined,
                image: embed.image ? { url: embed.image.url } : undefined,
                thumbnail: embed.thumbnail ? { url: embed.thumbnail.url } : undefined,
                author: embed.author
                    ? { name: embed.author.name, icon_url: embed.author.iconURL || embed.author.icon_url, url: embed.author.url }
                    : undefined,
                fields: embed.fields && embed.fields.length > 0 ? embed.fields : undefined
            }));
        }

        // All attachments, forwarded together (Discord allows up to 10 files per message)
        if (message.attachments.size > 0) {
            payload.files = Array.from(message.attachments.values())
                .slice(0, 10)
                .map(att => ({ attachment: att.url, name: att.name || undefined }));
        }

        if (!payload.content && !payload.embeds && !payload.files) {
            console.log('ℹ️ Nothing to forward (empty message)');
            return;
        }

        await webhook.send(payload);
        console.log(`✅ Message successfully mirrored from ${message.channel.name}\n`);

    } catch (error) {
        console.error(`❌ Error forwarding message from ${message.channel.name}:`, error.message);
        const invalidWebhook = error.code === 10015
            || error.code === 50027
            || /unknown webhook|invalid webhook token/i.test(error.message || '');
        if (allowWebhookRecovery && invalidWebhook) {
            console.warn(`⚠️ Stored webhook for ${message.channel.name} is invalid; rebuilding it once.`);
            delete channelWebhookMap[message.channel.id];
            saveWebhookMappings();
            return forwardMessage(message, false);
        }
    } finally {
        webhook?.destroy?.();
    }
}

client.on('messageCreate', async message => {
    // Ignore our own messages
    if (message.author.id === client.user.id || message.webhookId) {
        return;
    }

    // Check if this is a monitored source channel
    if (!sourceChannelIds.includes(message.channel.id)) {
        return;
    }

    console.log(`\n📨 Message received in ${message.channel.name} (${message.channel.id})`);
    console.log(`   Author: ${message.author.tag}`);
    console.log(`   Embeds: ${message.embeds.length}, Attachments: ${message.attachments.size}`);

    await forwardMessage(message);
});

// ============================================================
// Loop-message feature: repeatedly re-copy content from a source channel to
// its mapped target channel, on an interval. Configure via config.json ->
// "loopMessage". Two modes:
//   - messageId / messageIds: loop specific, fixed messages
//   - wholeChannel: true    : re-fetch and re-mirror whatever's CURRENTLY
//                             posted in the channel, fresh, every cycle
// Everything in a given cycle is sent together, back to back.
// ============================================================
let loopMessageTimer = null; // single shared setTimeout handle
let loopGeneration = 0;

function stopLoopMessage() {
    loopGeneration += 1;
    if (loopMessageTimer) {
        clearTimeout(loopMessageTimer);
        loopMessageTimer = null;
        console.log('🛑 Stopped loop-message timer');
    }
}

// Resolves the current set of messages to send, based on config mode.
// Called fresh each cycle so wholeChannel mode always reflects live content.
async function getLoopMessages(cfg, sourceChannel) {
    if (cfg.wholeChannel) {
        const requestedLimit = Number(cfg.fetchLimit || 50);
        const limit = Number.isFinite(requestedLimit)
            ? Math.min(Math.max(1, requestedLimit), 100)
            : 50;
        const fetched = await sourceChannel.messages.fetch({ limit });
        // Oldest first, so they land in the target channel in original posting order.
        return [...fetched.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    }

    const messageIds = [
        ...(Array.isArray(cfg.messageIds) ? cfg.messageIds : []),
        ...(cfg.messageId ? [cfg.messageId] : [])
    ].filter((id, index, arr) => id && arr.indexOf(id) === index); // de-dupe

    const messageObjs = [];
    for (const messageId of messageIds) {
        try {
            messageObjs.push(await sourceChannel.messages.fetch(messageId));
        } catch (error) {
            console.error(`❌ Failed to fetch loop-message ${messageId}: ${error.message}`);
        }
    }
    return messageObjs;
}

// Schedules the next send at baseMs + a random 0..jitterMs on top, then
// re-schedules itself after each round (so every gap is independently
// random, not just a fixed interval with one-time jitter).
function scheduleNextLoopSend(cfg, sourceChannel, baseMs, jitterMs, generation) {
    if (generation !== loopGeneration) return;
    const delay = baseMs + Math.floor(Math.random() * (jitterMs + 1));
    console.log(`⏱️ Next looped send in ~${Math.round(delay / 60000)} min`);

    loopMessageTimer = setTimeout(async () => {
        if (generation !== loopGeneration) return;
        try {
            const messageObjs = await getLoopMessages(cfg, sourceChannel);
            if (messageObjs.length === 0) {
                console.log('ℹ️ No loop-message(s) found this cycle — skipping send');
            } else {
                console.log(`\n🔁 Re-sending ${messageObjs.length} looped message(s)...`);
                for (const messageObj of messageObjs) {
                    try {
                        await forwardMessage(messageObj);
                    } catch (error) {
                        console.error(`❌ Loop-message send failed for ${messageObj.id}: ${error.message}`);
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Loop-message cycle failed: ${error.message}`);
        }
        scheduleNextLoopSend(cfg, sourceChannel, baseMs, jitterMs, generation);
    }, delay);
}

async function startLoopMessage() {
    const cfg = config.loopMessage;
    stopLoopMessage();
    const generation = loopGeneration;

    if (!cfg || !cfg.enabled) {
        return;
    }

    if (!isDiscordSnowflake(cfg.sourceChannelId)) {
        console.error('❌ loopMessage enabled but sourceChannelId is missing or invalid in config.json');
        return;
    }
    if (!cfg.wholeChannel) {
        const hasIds = (Array.isArray(cfg.messageIds) && cfg.messageIds.length > 0) || cfg.messageId;
        if (!hasIds) {
            console.error('❌ loopMessage enabled but messageId(s) missing (or set "wholeChannel": true to mirror the whole channel instead)');
            return;
        }
    }

    const requestedInterval = Number(cfg.intervalSeconds || 60);
    const requestedJitter = Number(cfg.randomJitterSeconds || 0);
    const baseMs = (Number.isFinite(requestedInterval) ? Math.max(1, requestedInterval) : 60) * 1000;
    const jitterMs = (Number.isFinite(requestedJitter) ? Math.max(0, requestedJitter) : 0) * 1000;

    // Make sure this channel is tracked so getOrCreateWebhook can map it
    if (!sourceChannelIds.includes(cfg.sourceChannelId)) {
        sourceChannelIds.push(cfg.sourceChannelId);
    }

    let sourceChannel;
    try {
        sourceChannel = await client.channels.fetch(cfg.sourceChannelId);
    } catch (error) {
        console.error(`❌ Failed to fetch loop-message source channel: ${error.message}`);
        return;
    }

    const messageObjs = await getLoopMessages(cfg, sourceChannel);
    if (messageObjs.length === 0) {
        console.error('❌ No loop-message(s) could be fetched — nothing armed');
        return;
    }

    console.log(cfg.wholeChannel
        ? `🔁 Loop-message armed (whole-channel mode): will re-mirror #${sourceChannel.name} (currently ${messageObjs.length} message(s)) every ${baseMs / 1000}s (+0-${jitterMs / 1000}s random)`
        : `🔁 Loop-message armed: will re-copy ${messageObjs.length} message(s) from #${sourceChannel.name} every ${baseMs / 1000}s (+0-${jitterMs / 1000}s random)`);

    // Send once immediately on arm/startup, then continue on the shared random interval.
    console.log(`\n🔁 Sending initial copy of ${messageObjs.length} looped message(s)...`);
    for (const messageObj of messageObjs) {
        try {
            await forwardMessage(messageObj);
        } catch (error) {
            console.error(`❌ Loop-message initial send failed for ${messageObj.id}: ${error.message}`);
        }
    }

    scheduleNextLoopSend(cfg, sourceChannel, baseMs, jitterMs, generation);
}

let loginRetryTimer = null;
let loginAttempts = 0;

async function loginWithRetry() {
    try {
        await client.login(TOKEN);
        loginAttempts = 0;
    } catch (error) {
        const authFailure = error?.code === 'TokenInvalid'
            || error?.status === 401
            || /invalid token|unauthorized|\b401\b/i.test(error?.message || '');
        console.error('❌ Failed to log in:', error.message);
        if (authFailure) {
            console.error('❌ The configured mirror token is invalid; rotate it before restarting this worker.');
            stopLoopMessage();
            configWatcher?.close?.();
            client.destroy();
            process.exitCode = 1;
            setTimeout(() => process.exit(1), 100);
            return;
        }
        loginAttempts += 1;
        const delay = Math.min(5 * 60_000, 15_000 * (2 ** Math.min(loginAttempts - 1, 5)));
        console.warn(`⚠️ Retrying mirror login in ${Math.round(delay / 1000)}s.`);
        loginRetryTimer = setTimeout(() => {
            loginRetryTimer = null;
            void loginWithRetry();
        }, delay);
    }
}

process.on('unhandledRejection', reason => {
    console.error('❌ Unhandled mirror promise rejection:', reason instanceof Error ? reason.stack : reason);
});

let shuttingDown = false;
function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`🛑 ${signal} received; closing the mirror worker.`);
    stopLoopMessage();
    if (loginRetryTimer) clearTimeout(loginRetryTimer);
    if (configReloadTimer) clearTimeout(configReloadTimer);
    configWatcher?.close?.();
    client.destroy();
    setTimeout(() => process.exit(0), 100).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

void loginWithRetry();
