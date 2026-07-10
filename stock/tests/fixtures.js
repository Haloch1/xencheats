// stock/tests/fixtures.js
// Shared, network-free fixtures + helpers for the stock unit tests.

// Wilder's classic 15-close RSI example. First RSI(14) ~= 70.46.
export const RSI_CLOSES = [
  44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89,
  46.03, 45.61, 46.28, 46.28
];

// Build a candle from a close (flat +/-1 range, given volume).
export function candleFromClose(close, i = 0, volume = 1000) {
  return {
    time: new Date(Date.UTC(2025, 0, 1) + i * 86400000),
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume
  };
}

// Turn an array of closes into candles.
export function candlesFromCloses(closes, volume = 1000) {
  return closes.map((c, i) => candleFromClose(c, i, volume));
}

// A deterministic rising (uptrend) candle series of `n` bars.
export function uptrendCandles(n = 220, start = 100, step = 0.5) {
  const candles = [];
  for (let i = 0; i < n; i++) {
    const wobble = Math.sin(i / 5) * 0.6; // mild oscillation so swings exist
    const close = start + i * step + wobble;
    candles.push({
      time: new Date(Date.UTC(2025, 0, 1) + i * 86400000),
      open: close - 0.2,
      high: close + 1.0,
      low: close - 1.0,
      close,
      volume: 1_000_000 + (i % 5) * 50_000
    });
  }
  return candles;
}

// A deterministic falling (downtrend) candle series of `n` bars.
export function downtrendCandles(n = 220, start = 200, step = 0.5) {
  const candles = [];
  for (let i = 0; i < n; i++) {
    const close = start - i * step + Math.sin(i / 5) * 0.6;
    candles.push({
      time: new Date(Date.UTC(2025, 0, 1) + i * 86400000),
      open: close + 0.2,
      high: close + 1.0,
      low: close - 1.0,
      close,
      volume: 1_000_000
    });
  }
  return candles;
}

// A ready-made strongly bullish per-timeframe object (analyzeTimeframe-shaped).
export function bullishDaily(overrides = {}) {
  return {
    ok: true,
    ema20: 105,
    ema50: 102,
    sma200: 95,
    price: 106,
    aboveSma200: true,
    ema20AboveEma50: true,
    sma200Slope: 0.4,
    rsi: 55,
    macd: { cross: "bullish", histRising: true },
    roc: 3.2,
    atr: 2.1,
    bb: { pctFromLower: 0.35, pctFromUpper: 0.45 },
    relVolume: 1.6,
    obvRising: true,
    trend: "bullish",
    structure: { label: "uptrend", higherHighs: true, higherLows: true },
    ...overrides
  };
}
