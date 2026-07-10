// stock/providers/twelveData.js
// Twelve Data market-data provider. Uses global fetch (Node 18+).
// Reads the API key from process.env.STOCK_DATA_API_KEY. The key is NEVER logged.
//
// Features:
//   - getTimeSeries(symbol, interval, outputsize)  -> candles oldest -> newest
//   - getQuote(symbol)                             -> { price, name, currency }
//   - in-module rate limiting: max 8 requests / rolling 60s
//   - withRetry(fn, {retries}) with exponential backoff (500ms, 1s, 2s)

const BASE_URL = "https://api.twelvedata.com";
const RATE_LIMIT = 8;
const WINDOW_MS = 60_000;
const BACKOFF_MS = [500, 1000, 2000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Rolling-window rate limiter shared across the module.
let requestTimestamps = [];

async function acquireSlot() {
  // Wait until fewer than RATE_LIMIT requests fall inside the rolling window.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const now = Date.now();
    requestTimestamps = requestTimestamps.filter((t) => now - t < WINDOW_MS);
    if (requestTimestamps.length < RATE_LIMIT) {
      requestTimestamps.push(now);
      return;
    }
    const oldest = requestTimestamps[0];
    const wait = Math.max(10, WINDOW_MS - (now - oldest) + 10);
    await sleep(wait);
  }
}

function apiKey() {
  const key = process.env.STOCK_DATA_API_KEY;
  if (!key) {
    // Do not include any key material in the message (there is none here anyway).
    throw new Error("STOCK_DATA_API_KEY is not configured");
  }
  return key;
}

class ProviderError extends Error {
  constructor(message, { status = 0, retriable = false } = {}) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.retriable = retriable;
  }
}

/**
 * Retry helper with exponential backoff for network/429/5xx errors.
 * Non-retriable errors (e.g. bad symbol) are thrown immediately.
 */
export async function withRetry(fn, { retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err && typeof err.status === "number" ? err.status : 0;
      const retriable =
        (err && err.retriable === true) ||
        status === 429 ||
        status >= 500 ||
        (err && (err.name === "FetchError" || err.name === "TypeError" || err.code));
      if (attempt === retries || !retriable) break;
      const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
      console.error(`[Stock] provider request failed (attempt ${attempt + 1}/${retries + 1}); retrying in ${delay}ms:`, err.message);
      await sleep(delay);
    }
  }
  throw lastErr;
}

// Low-level GET against the Twelve Data JSON API. Handles both HTTP errors and
// the { status:"error", message } body Twelve Data returns with a 200.
async function apiGet(path, params) {
  await acquireSlot();
  const url = new URL(BASE_URL + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  url.searchParams.set("apikey", apiKey());

  let res;
  try {
    res = await fetch(url, { headers: { accept: "application/json" } });
  } catch (err) {
    throw new ProviderError(`network error: ${err.message}`, { retriable: true });
  }
  if (!res.ok) {
    throw new ProviderError(`HTTP ${res.status}`, {
      status: res.status,
      retriable: res.status === 429 || res.status >= 500
    });
  }
  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw new ProviderError(`invalid JSON response: ${err.message}`, { retriable: true });
  }
  if (json && json.status === "error") {
    const code = Number(json.code) || 0;
    const retriable = code === 429;
    throw new ProviderError(`Twelve Data error: ${json.message || "unknown"}`, {
      status: code,
      retriable
    });
  }
  return json;
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

// Twelve Data returns "YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss". Parse to a Date.
function parseDatetime(dt) {
  if (!dt) return new Date(NaN);
  const normalized = dt.includes(" ") ? dt.replace(" ", "T") + "Z" : dt + "T00:00:00Z";
  return new Date(normalized);
}

function mapValues(json) {
  const values = Array.isArray(json && json.values) ? json.values : [];
  // Twelve Data delivers newest-first; convert and reverse to oldest -> newest.
  const candles = values
    .map((v) => ({
      time: parseDatetime(v.datetime),
      open: toNum(v.open),
      high: toNum(v.high),
      low: toNum(v.low),
      close: toNum(v.close),
      volume: v.volume !== undefined ? toNum(v.volume) : 0
    }))
    .reverse();
  return candles;
}

const INTERVAL_MAP = {
  "1day": "1day",
  "1h": "1h",
  "4h": "4h"
};

// Aggregate oldest->newest 1h candles into 4h buckets (4 one-hour bars per bucket).
function aggregateTo4h(hourly) {
  const out = [];
  for (let i = 0; i < hourly.length; i += 4) {
    const chunk = hourly.slice(i, i + 4);
    if (!chunk.length) continue;
    out.push({
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map((c) => c.high)),
      low: Math.min(...chunk.map((c) => c.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((s, c) => s + (Number.isFinite(c.volume) ? c.volume : 0), 0)
    });
  }
  return out;
}

/**
 * Fetch a time series, oldest -> newest.
 * @param {string} symbol   e.g. "AAPL"
 * @param {"1day"|"1h"|"4h"} interval
 * @param {number} outputsize number of candles to return
 * Returns [{ time:Date, open, high, low, close, volume }] or [] on failure.
 */
export async function getTimeSeries(symbol, interval = "1day", outputsize = 200) {
  try {
    const mapped = INTERVAL_MAP[interval];
    if (!mapped) throw new ProviderError(`unsupported interval: ${interval}`);

    if (interval === "4h") {
      // Try native 4h; if the plan does not support it, fall back to 1h aggregation.
      try {
        const json = await withRetry(() =>
          apiGet("/time_series", { symbol, interval: "4h", outputsize })
        );
        const candles = mapValues(json);
        if (candles.length) return candles;
      } catch (err) {
        console.error(`[Stock] native 4h unavailable for ${symbol}; aggregating from 1h:`, err.message);
      }
      const hourlyJson = await withRetry(() =>
        apiGet("/time_series", { symbol, interval: "1h", outputsize: outputsize * 4 })
      );
      return aggregateTo4h(mapValues(hourlyJson));
    }

    const json = await withRetry(() =>
      apiGet("/time_series", { symbol, interval: mapped, outputsize })
    );
    return mapValues(json);
  } catch (err) {
    console.error(`[Stock] getTimeSeries(${symbol}, ${interval}) failed:`, err.message);
    return [];
  }
}

/**
 * Fetch a real-time quote.
 * Returns { price, name, currency } (price NaN and name/currency null on failure).
 */
export async function getQuote(symbol) {
  try {
    const json = await withRetry(() => apiGet("/quote", { symbol }));
    const price = toNum(json.close ?? json.price);
    return {
      price: Number.isFinite(price) ? price : null,
      name: json.name || null,
      currency: json.currency || null
    };
  } catch (err) {
    console.error(`[Stock] getQuote(${symbol}) failed:`, err.message);
    return { price: null, name: null, currency: null };
  }
}

export default { getTimeSeries, getQuote, withRetry };
