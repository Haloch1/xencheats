const STATUS_MAP = new Map([
    ['undetected', 'undetected'],
    ['updating', 'updating'],
    ['detected', 'detected'],
]);

function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeStatus(value) {
    const key = cleanText(value).toLowerCase();
    return STATUS_MAP.get(key) || null;
}

function fieldValue(embed, name) {
    const field = (embed?.fields || []).find((entry) => cleanText(entry?.name).toLowerCase() === name);
    return cleanText(field?.value);
}

function parseStatusChangeEmbed(embed) {
    if (cleanText(embed?.title).toLowerCase() !== 'status change') return null;
    const product = fieldValue(embed, 'product');
    const newStatus = normalizeStatus(fieldValue(embed, 'new status'));
    if (!product || !newStatus) return null;
    return {
        product,
        status: newStatus,
        changedFrom: fieldValue(embed, 'changed from') || null,
    };
}

function snowflakeAfter(left, right) {
    if (!right) return true;
    try { return BigInt(String(left)) > BigInt(String(right)); }
    catch { return false; }
}

function compareSnowflakes(left, right) {
    try {
        const a = BigInt(String(left));
        const b = BigInt(String(right));
        return a < b ? -1 : a > b ? 1 : 0;
    } catch { return String(left).localeCompare(String(right)); }
}

function atomicWrite(fs, filePath, value) {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), { mode: 0o600 });
    fs.renameSync(tempPath, filePath);
}

function createStatusBackendUpdater({ endpoint, token, fetchImpl = globalThis.fetch }) {
    const url = String(endpoint || '').replace(/\/+$/, '');
    const sharedToken = String(token || '').trim();
    if (!url || !sharedToken || typeof fetchImpl !== 'function') return null;
    return async function updateStatus(update) {
        const response = await fetchImpl(`${url}/api/internal/product-status`, {
            method: 'POST',
            headers: {
                authorization: `Bearer ${sharedToken}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify(update),
            signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`backend status update failed (${response.status})${body ? `: ${body.slice(0, 180)}` : ''}`);
        }
        return response.json().catch(() => ({ ok: true }));
    };
}

function createStatusPoller({ client, guildId, channelId, update, statePath, fs, logger = console, intervalMs = 60 * 60 * 1000 }) {
    let timer = null;
    let polling = false;
    const stateFile = String(statePath || '').trim();

    function readState() {
        if (!stateFile || !fs?.existsSync(stateFile)) return {};
        try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')) || {}; }
        catch (error) { logger.warn?.(`[Status sync] Ignoring unreadable state file: ${error.message}`); return {}; }
    }

    function saveState(state) {
        if (!stateFile || !fs) return;
        try { atomicWrite(fs, stateFile, state); }
        catch (error) { logger.error?.(`[Status sync] Could not save state: ${error.message}`); }
    }

    async function poll() {
        if (polling || !client?.isReady?.() || typeof update !== 'function') return { processed: 0, skipped: 0 };
        polling = true;
        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel?.isTextBased?.() || String(channel.guildId || '') !== String(guildId)) {
                throw new Error('configured channel is not a text channel in the configured guild');
            }
            const state = readState();
            const pages = [];
            let after = state.lastSeenMessageId || undefined;
            for (let page = 0; page < (after ? 10 : 1); page += 1) {
                const fetched = await channel.messages.fetch({ limit: 100, ...(after ? { after } : {}) });
                const batch = [...fetched.values()]
                    .filter((message) => String(message.guildId || '') === String(guildId))
                    .sort((a, b) => compareSnowflakes(a.id, b.id));
                if (!batch.length) break;
                pages.push(...batch);
                if (!after || batch.length < 100) break;
                const nextAfter = batch.at(-1).id;
                if (nextAfter === after) break;
                after = nextAfter;
            }
            const messages = pages.sort((a, b) => compareSnowflakes(a.id, b.id));
            const pending = messages.filter((message) => snowflakeAfter(message.id, state.lastSeenMessageId));
            const updates = new Map();
            for (const message of pending) {
                for (const embed of message.embeds || []) {
                    const parsed = parseStatusChangeEmbed(embed);
                    if (parsed) updates.set(parsed.product.toLowerCase(), { ...parsed, messageId: message.id, guildId: String(guildId), channelId: String(channelId) });
                }
            }
            for (const parsed of updates.values()) await update(parsed);
            const newestMessage = messages.at(-1);
            if (newestMessage) saveState({ lastSeenMessageId: newestMessage.id, updatedAt: new Date().toISOString() });
            logger.log?.(`[Status sync] Checked ${pending.length} new message(s); updated ${updates.size} product(s).`);
            return { processed: updates.size, skipped: Math.max(0, pending.length - updates.size) };
        } finally {
            polling = false;
        }
    }

    return {
        start() {
            if (timer) return;
            void poll().catch((error) => logger.error?.(`[Status sync] Poll failed: ${error.message}`));
            timer = setInterval(() => void poll().catch((error) => logger.error?.(`[Status sync] Poll failed: ${error.message}`)), Math.max(60_000, Number(intervalMs) || 3_600_000));
            timer.unref?.();
        },
        stop() { if (timer) clearInterval(timer); timer = null; },
        poll,
    };
}

module.exports = { createStatusBackendUpdater, createStatusPoller, normalizeStatus, parseStatusChangeEmbed };
