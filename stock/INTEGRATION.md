# Stock Buy-Signal Feature — Integration Guide

This folder contains the **isolated library modules** for the stock buy-signal
feature. They are plain ES modules (matching the project's `"type":"module"`), do
their own error handling, and never throw to the caller. `server.js` is expected to
wire these together — nothing here imports `server.js`, creates a Supabase client, or
starts a scheduler on its own.

> **Compliance:** every user-facing string is a *technical-analysis signal, not
> financial advice*. Wording such as "potential buying opportunity", "strong bullish
> setup detected", and "high-confidence signal based on the configured strategy" is
> used deliberately. The words "guaranteed", "guaranteed profit", "risk-free", and any
> promise that a price will rise are never used. Every alert embed includes the
> disclaimer: *"This is an automated market signal, not personalized financial advice.
> Markets involve risk, and this signal may be wrong."*

---

## Modules & exports

### `stock/config.js`
- `getStockConfig(env = process.env)` → typed, clamped config object:
  `{ alertChannelId, alertsEnabled, scanIntervalMinutes, signalMinScore,
  alertCooldownHours, minRiskReward, relVolThreshold, earningsBlockDays,
  includePremarket, includeAfterhours, rescoreDelta }`.

### `stock/providers/twelveData.js`
- `async getTimeSeries(symbol, interval, outputsize)` → `[{ time:Date, open, high, low, close, volume }]`
  sorted **oldest → newest**. `interval` ∈ `"1day" | "1h" | "4h"`. Native `4h` is
  attempted first; if the account/plan doesn't support it, it falls back to fetching
  `1h` and aggregating into 4h buckets. Returns `[]` on failure.
- `async getQuote(symbol)` → `{ price, name, currency }` (`price` null on failure).
- `withRetry(fn, { retries = 3 })` → runs `fn` with exponential backoff (500ms, 1s, 2s)
  for network/429/5xx errors. Exported for reuse.
- Internal rate limiting: max **8 requests / rolling 60s**. Reads
  `process.env.STOCK_DATA_API_KEY`. **The API key is never logged.**
- Default export: `{ getTimeSeries, getQuote, withRetry }` (usable as a `provider`).

### `stock/indicators/index.js` (pure, no I/O)
Return-shape: arrays **aligned to input length** with **leading `null`s**, except
`relativeVolume` which returns the **latest scalar** (or `null`).
- `ema(values, period)` → array
- `sma(values, period)` → array
- `rsi(closes, period = 14)` → array
- `macd(closes, fast = 12, slow = 26, signal = 9)` → `{ macd:[], signal:[], histogram:[] }`
- `atr(candles, period = 14)` → array
- `bollinger(closes, period = 20, mult = 2)` → `{ upper:[], middle:[], lower:[] }`
- `roc(closes, period = 12)` → array
- `obv(candles)` → array
- `averageVolume(candles, period = 20)` → array (SMA of volume)
- `relativeVolume(candles, period = 20)` → **scalar** (latest volume / trailing avg) or `null`

### `stock/analysis/priceStructure.js` (pure)
- `findSwings(candles, lookback = 5)` → `{ swingHighs:[{index,price,time}], swingLows:[...] }`
- `supportResistance(candles)` → `{ support, resistance, recentSwingHigh, recentSwingLow }`
- `trendStructure(candles)` → `{ label:"uptrend"|"downtrend"|"range", higherHighs, higherLows }`
- `detectBreakout(candles, lookback = 20)` → `{ breakout, level }`
- `detectPullback(candles, lookback = 10)` → `{ pullback, depth }`

### `stock/analysis/trend.js`
- `analyzeTimeframe(candles)` → on success:
  `{ ok:true, ema20, ema50, sma200, price, aboveSma200, ema20AboveEma50, sma200Slope,
  rsi, macd:{cross, histRising}, roc, atr, bb:{pctFromLower, pctFromUpper}, relVolume,
  obvRising, trend:"bullish"|"bearish"|"neutral", structure }`. On short/invalid
  input → `{ ok:false, reason }`.

### `stock/analysis/risk.js` (pure)
- `computeRisk({ price, support, resistance, atr })` →
  `{ entryLow, entryHigh, invalidation, nearestSupport, nearestResistance, upside,
  downside, riskReward }`. Entry zone = price ± 0.5·ATR; invalidation just below
  nearest support (else price − 1.5·ATR); `riskReward = upside/downside`, and is `null`
  when `downside <= 0`.

### `stock/analysis/scorer.js` (pure)
- `SCORE_WEIGHTS` → `{ longTerm:20, medium:15, momentum:20, volume:15, entry:20, risk:10 }` (frozen)
- `scoreSignal({ daily, h4, h1, market, risk, relVolThreshold })` →
  `{ score, breakdown:{longTerm,medium,momentum,volume,entry,risk}, reasons:[], warnings:[], flags }`.
  `market` only **penalizes** (never blocks); `risk` (optional) improves risk scoring.
- `confidenceLabel(score)` → `"Very high"(90-100)|"High"(80-89)|"Moderate"(70-79)|"Low"(<70)`
- `evaluateConfirmations({ score, minScore, daily, momentumOk, volumeOrPriceActionOk,
  extended, dataCurrent, riskReward, minRiskReward, cooldownActive })` →
  `{ qualifies:bool, reasons:[] }`. All rules must pass (see the doc comment in the file).

### `stock/marketCalendar.js` (no external deps, ET via `Intl`)
- `isRegularMarketOpen(date = new Date())` → bool (Mon–Fri, 09:30–16:00 ET, minus holidays)
- `isMarketHoliday(date)` → bool (hardcoded 2025 + 2026 observed dates; **extend for 2027+**)
- `nextMarketOpen(date)` → `Date` of the next 09:30 ET open

### `stock/marketContext.js`
- `async getMarketCondition(provider)` → `{ label:"Healthy"|"Cautious"|"Bearish",
  spyBelow50, qqqWeak, scorePenalty, note }`. Uses `provider.getTimeSeries` for SPY/QQQ.

### `stock/alertEmbed.js`
- `buildAlertEmbed(signal)` → discord.js-compatible plain embed object (title
  "Potential Stock Buying Opportunity", green color, ticker/company/score/confidence/
  price/entry/support/invalidation/resistance/risk-reward fields, "Why this signal was
  generated", "Possible risks", "Timeframes", an America/Chicago timestamp, and the
  disclaimer as footer **and** a final field).
- `buildTestAlertEmbed()` → a clearly-labeled `[TEST]` SAMPLE embed using fake NVDA data.
- `DISCLAIMER` → the compliance string.

### `stock/data.js` (Supabase layer — client passed in, never created here)
- `isValidTicker(t)` → bool (`/^[A-Z]{1,6}(\.[A-Z]{1,3})?$/`)
- `async getWatchlist(supabase)`
- `async addTicker(supabase, ticker, companyName, createdBy)` (validates ticker)
- `async removeTicker(supabase, ticker)`
- `async getSettings(supabase)` (row or sensible defaults)
- `async updateSettings(supabase, patch)`
- `async recordSignal(supabase, signalRow)`
- `async getRecentSignal(supabase, ticker)` (for cooldown)
- `async updateSignalMessageId(supabase, id, messageId)`

### `stock/validate.js` (pure)
- `validateCandles(candles, minLength, { maxAgeMs })` → `{ ok, reason, candles? }`
- `dedupeAndSort(candles)` → cleaned/sorted candle array

---

## How `server.js` should call these

> `server.js` already has `supabaseAdmin`, the Discord `client`, and env vars.

### 1. Init the scanner on `setInterval`
```js
import { getStockConfig } from "./stock/config.js";
import provider from "./stock/providers/twelveData.js";
import { getWatchlist } from "./stock/data.js";

const stockCfg = getStockConfig(process.env);

function startStockScanner() {
  if (!stockCfg.alertsEnabled) return;
  const runOnce = () => scanWatchlist().catch((e) => console.error("[Stock] scan failed:", e.message));
  runOnce(); // run one scan immediately on boot
  setInterval(runOnce, stockCfg.scanIntervalMinutes * 60 * 1000);
}
```

### 2. Run one scan
```js
import { isRegularMarketOpen } from "./stock/marketCalendar.js";
import { getMarketCondition } from "./stock/marketContext.js";
import { analyzeSingle } from "./stock/…"; // your wiring helper (below)

async function scanWatchlist() {
  if (!isRegularMarketOpen() && !stockCfg.includeAfterhours) return; // respect sessions
  const market = await getMarketCondition(provider);
  const watchlist = await getWatchlist(supabaseAdmin);
  for (const row of watchlist) {
    await evaluateTicker(row.ticker, market); // one ticker failing must not stop the loop
  }
}
```

### 3. Evaluate one ticker (also powers `/stock-check`)
```js
import { validateCandles } from "./stock/validate.js";
import { analyzeTimeframe } from "./stock/analysis/trend.js";
import { supportResistance } from "./stock/analysis/priceStructure.js";
import { computeRisk } from "./stock/analysis/risk.js";
import { scoreSignal, confidenceLabel, evaluateConfirmations } from "./stock/analysis/scorer.js";
import { getRecentSignal, recordSignal, updateSignalMessageId } from "./stock/data.js";

async function evaluateTicker(ticker, market) {
  const [dailyRaw, h4Raw, h1Raw, quote] = await Promise.all([
    provider.getTimeSeries(ticker, "1day", 260),
    provider.getTimeSeries(ticker, "4h", 200),
    provider.getTimeSeries(ticker, "1h", 200),
    provider.getQuote(ticker)
  ]);

  const dv = validateCandles(dailyRaw, 200, { maxAgeMs: 5 * 24 * 60 * 60 * 1000 });
  if (!dv.ok) { console.error(`[Stock] ${ticker}: ${dv.reason}`); return null; }

  const daily = analyzeTimeframe(dv.candles);
  const h4 = analyzeTimeframe(h4Raw);
  const h1 = analyzeTimeframe(h1Raw);
  const sr = supportResistance(dv.candles);
  const risk = computeRisk({ price: quote.price ?? daily.price, support: sr.support, resistance: sr.resistance, atr: daily.atr });
  const scored = scoreSignal({ daily, h4, h1, market, risk, relVolThreshold: stockCfg.relVolThreshold });

  // cooldown check
  const recent = await getRecentSignal(supabaseAdmin, ticker);
  const cooldownActive = recent && (Date.now() - new Date(recent.created_at).getTime()) < stockCfg.alertCooldownHours * 3600e3;

  const decision = evaluateConfirmations({
    score: scored.score,
    minScore: stockCfg.signalMinScore,
    daily,
    momentumOk: scored.flags?.momentumOk,
    volumeOrPriceActionOk: scored.flags?.volumeOk || scored.flags?.priceActionOk,
    extended: scored.flags?.extended,
    dataCurrent: dv.ok,
    riskReward: risk.riskReward,
    minRiskReward: stockCfg.minRiskReward,
    cooldownActive
  });

  return { ticker, quote, daily, h4, h1, sr, risk, scored, decision };
}
```

### 4. Build + send the alert embed
```js
import { buildAlertEmbed } from "./stock/alertEmbed.js";

async function emitAlert(result) {
  if (!result?.decision?.qualifies) return;
  const { ticker, quote, daily, h4, h1, sr, risk, scored } = result;
  const embed = buildAlertEmbed({
    ticker,
    company: quote.name,
    price: quote.price ?? daily.price,
    currency: quote.currency,
    score: scored.score,
    confidence: confidenceLabel(scored.score),
    entry: { low: risk.entryLow, high: risk.entryHigh },
    support: risk.nearestSupport ?? sr.support,
    invalidation: risk.invalidation,
    resistance: risk.nearestResistance ?? sr.resistance,
    riskReward: risk.riskReward,
    reasons: scored.reasons,
    warnings: scored.warnings,
    timeframes: { daily: daily.trend, h4: h4.trend, h1: h1.trend },
    generatedAt: new Date()
  });

  const channel = await client.channels.fetch(stockCfg.alertChannelId);
  const msg = await channel.send({ embeds: [embed] });

  const rec = await recordSignal(supabaseAdmin, {
    ticker, score: scored.score, price: quote.price ?? daily.price, created_at: new Date().toISOString()
  });
  if (rec.ok && rec.row?.id) await updateSignalMessageId(supabaseAdmin, rec.row.id, msg.id);
}
```

`/stock-check <TICKER>` reuses `evaluateTicker` and replies with `buildAlertEmbed(...)`
(or a "no qualifying signal" note). `buildTestAlertEmbed()` is handy for a `/stock-test`
command to verify Discord wiring without hitting the data API.

---

## Expected Supabase schema (created separately)

- `stock_watchlist` — `ticker` (PK, text), `company_name` (text), `created_by` (text), `created_at` (timestamptz default now())
- `stock_signals` — `id` (PK), `ticker` (text), `score` (int), `price` (numeric), `message_id` (text), `created_at` (timestamptz default now()) — plus any payload/jsonb columns you want
- `stock_alert_settings` — single settings row (`id` = 1), columns matching `getSettings` defaults

## Environment variables
`STOCK_DATA_API_KEY` (Twelve Data), plus the `STOCK_*` knobs read by `getStockConfig`
(see `config.js` for names, defaults, and clamps).

## Tests
`npm test` runs the vitest suite in `stock/tests/` (no network; fixture candle arrays).
