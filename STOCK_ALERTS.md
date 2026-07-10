# Stock Buy-Signal Alerts

Automated technical-analysis scanner for the Discord bot. It watches a configurable
list of tickers, scores each one 0–100 across multiple timeframes and indicators, and
posts an alert to a Discord channel only when a high-confidence, multi-factor bullish
setup is detected.

**This is a signal tool, not financial advice.** Every alert says so. The bot never
claims a guaranteed profit, a risk-free trade, or that a price will rise. A large price
drop alone never triggers an alert — the setup must combine trend, momentum, volume,
structure, acceptable volatility, and a reasonable risk-to-reward.

## Feature overview

- Multi-timeframe analysis: daily (broad trend) + 4h and 1h (entry). 4h falls back to
  aggregated 1h candles if the data plan doesn't support 4h.
- Indicators: EMA 20/50, SMA 200, RSI 14, MACD, ATR 14, Bollinger Bands, ROC, OBV,
  average/relative volume, plus support/resistance and swing structure.
- Transparent scoring (`stock/analysis/scorer.js`): long-term trend 20, medium-term 15,
  momentum 20, volume 15, entry quality 20, risk conditions 10 = 100.
- Confirmation gate: score alone is not enough. A signal must also have a non-bearish
  daily trend, a momentum confirmation, a volume/price-action confirmation, not be
  over-extended, have current/complete data, meet the min risk-to-reward, and not be in
  cooldown.
- Broad-market context: SPY/QQQ trend can lower a score and add a caution note; it does
  not hard-block individual signals.
- Deduplication: one alert per ticker per cooldown window (default 24h) unless the score
  jumps by `STOCK_RESCORE_DELTA`.
- Market calendar: scans only during US regular hours (America/New_York), skipping
  weekends and 2025–2026 US market holidays.

## Required environment variables

Set these in Render (see `.env.example` for the full annotated list). Only
`STOCK_DATA_API_KEY` is mandatory.

| Var | Default | Purpose |
|---|---|---|
| `STOCK_DATA_API_KEY` | — | Twelve Data API key (required) |
| `STOCK_ALERT_CHANNEL_ID` | `1525096741387505796` | Alert channel |
| `STOCK_ALERTS_ENABLED` | `true` | Master on/off |
| `STOCK_SCAN_INTERVAL_MINUTES` | `15` | Scan cadence |
| `STOCK_SIGNAL_MIN_SCORE` | `80` | Min score to alert |
| `STOCK_ALERT_COOLDOWN_HOURS` | `24` | Re-alert suppression |
| `STOCK_MIN_RISK_REWARD` | `1.5` | Min risk-to-reward |
| `STOCK_RELVOL_THRESHOLD` | `1.2` | Relative-volume gate |
| `STOCK_EARNINGS_BLOCK_DAYS` | `3` | Earnings caution window |
| `STOCK_INCLUDE_PREMARKET` / `STOCK_INCLUDE_AFTERHOURS` | `false` | Extended-hours scanning |
| `STOCK_RESCORE_DELTA` | `8` | Re-alert score jump |

## Market-data provider (Twelve Data)

1. Create a free account at https://twelvedata.com and copy your API key.
2. Set `STOCK_DATA_API_KEY` in Render. Free tier is ~800 requests/day and 8/min; the
   scanner rate-limits itself to 8/min and backs off on 429s.

## Discord permissions and channel

The bot needs **View Channel** and **Send Messages** (and **Embed Links**) in the alert
channel `1525096741387505796`. If it can't find or post to the channel, it logs a clear
`[Stock]` error and keeps running.

## Database migration

Run `stock-alerts-schema.sql` once in the Supabase SQL editor. It creates
`stock_watchlist`, `stock_signals`, and `stock_alert_settings` (RLS on, service-role
only), seeds the settings row, and optionally seeds a starter watchlist.

## Managing the watchlist

Admin-only slash commands:

- `/stock-watchlist` — list monitored tickers
- `/stock-add ticker:AAPL` — validate + add
- `/stock-remove ticker:AAPL` — remove
- `/stock-alerts enabled:true|false` — toggle automatic alerts
- `/stock-settings` — show scan interval, min score, cooldown, min risk-reward, channel

## Manual check

`/stock-check ticker:NVDA` runs a full analysis immediately and returns the result even
if it does not qualify for an alert (score, breakdown, timeframes, risk range, reasons).

## Testing alerts

`/stock-test-alert` posts a clearly-labeled `[TEST]` sample alert to the alert channel
using fake data. It does not store a signal or affect cooldowns.

## How scoring works

See `stock/analysis/scorer.js`. Points are awarded per category and summed to 0–100;
`80+` is required by default and mapped to a confidence label (90–100 Very high, 80–89
High, 70–79 Moderate, below 70 Low). Only High and Very high are auto-posted.

## Known limitations

- Data can be delayed on the free Twelve Data tier; the scanner rejects stale/incomplete
  candles rather than alerting on them.
- Earnings/news risk checks depend on provider coverage. On the free tier earnings data
  may be unavailable; the earnings-block setting is wired but is best-effort. Treat every
  alert as needing your own review, especially near earnings.
- Backtesting and paper-trading harnesses are scaffolded around the same scorer but are
  not part of this first deploy; the scoring/indicator logic is unit-verified.
- The US holiday list in `stock/marketCalendar.js` covers 2025–2026 and must be extended
  for later years.

## Financial-risk disclaimer

These alerts are automated technical-analysis signals, not personalized financial
advice. Markets involve risk, signals can be wrong, and past behavior does not predict
future results. Nothing here executes real trades. Do your own research.
