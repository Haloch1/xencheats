const fs = require('fs');
const path = require('path');
require('dotenv').config();

const localConfigPath = path.join(__dirname, 'config.json');
const renderConfigPath = '/etc/secrets/config.json';
const exampleConfigPath = path.join(__dirname, 'config.json.example');
const configPath = fs.existsSync(localConfigPath)
    ? localConfigPath
    : fs.existsSync(renderConfigPath) ? renderConfigPath : exampleConfigPath;
const checkingExample = configPath === exampleConfigPath;
const failures = [];

function fail(message) {
    failures.push(message);
    console.error(`❌ ${message}`);
}

function snowflake(value) {
    return /^\d{17,22}$/.test(String(value || '').trim());
}

let config;
try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
    fail(`Configuration is not valid JSON: ${error.message}`);
    config = {};
}

if (!config || typeof config !== 'object' || Array.isArray(config)) {
    fail('Configuration root must be a JSON object.');
}
if (!config.modes || typeof config.modes !== 'object') fail('modes must be an object.');
if (!config.categorySettings || typeof config.categorySettings !== 'object') fail('categorySettings must be an object.');
if (!config.botSettings || typeof config.botSettings !== 'object') fail('botSettings must be an object.');
if (!config.loopMessage || typeof config.loopMessage !== 'object') fail('loopMessage must be an object.');
if (!Array.isArray(config.channels) && (!config.channels || typeof config.channels !== 'object')) {
    fail('channels must be an array of source IDs or an object mapping source IDs to target IDs.');
}

const targetGuildId = String(config.targetGuildId || process.env.TARGET_GUILD_ID || '').trim();
const sourceGuildId = String(config.sourceGuildId || process.env.SOURCE_GUILD_ID || '').trim();
const fullServerCopy = config.modes?.fullServerCopy === true || process.env.FULL_SERVER_COPY === 'true';

if (!checkingExample) {
    if (!snowflake(targetGuildId)) fail('targetGuildId/TARGET_GUILD_ID must be a Discord snowflake.');
    if (fullServerCopy && !snowflake(sourceGuildId)) fail('sourceGuildId/SOURCE_GUILD_ID is required in full-server copy mode.');
    if (fullServerCopy && sourceGuildId === targetGuildId) fail('Source and target guilds must be different.');

    const pairs = Array.isArray(config.channels)
        ? config.channels.map(source => [source, null])
        : Object.entries(config.channels || {});
    for (const [source, target] of pairs) {
        if (!snowflake(source)) fail(`Invalid source channel ID: ${source}`);
        if (target && !snowflake(target)) fail(`Invalid target channel ID for ${source}: ${target}`);
        if (target && String(source) === String(target)) fail(`Source channel ${source} maps to itself.`);
    }

    const loop = config.loopMessage || {};
    if (loop.enabled) {
        if (!snowflake(loop.sourceChannelId)) fail('loopMessage.sourceChannelId must be a Discord snowflake.');
        const ids = [loop.messageId, ...(Array.isArray(loop.messageIds) ? loop.messageIds : [])].filter(Boolean);
        if (!loop.wholeChannel && !ids.length) fail('Enabled loopMessage needs messageId(s) or wholeChannel=true.');
        for (const id of ids) if (!snowflake(id)) fail(`Invalid loop-message ID: ${id}`);
    }
}

const token = String(process.env.TOKEN || process.env.BOT_TOKEN || '').trim().replace(/^Bot\s+/i, '');
if (token && !/^[A-Za-z0-9._-]{40,}$/.test(token)) fail('Configured token has an invalid format.');

console.log(`📂 Checked ${path.basename(configPath)} (${checkingExample ? 'example structure' : 'runtime configuration'})`);
console.log(`📊 Mirror configuration result: ${failures.length ? `${failures.length} failure(s)` : 'OK'}`);
if (failures.length) process.exitCode = 2;
