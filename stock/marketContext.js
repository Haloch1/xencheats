// stock/marketContext.js
// Broad-market condition from SPY and QQQ vs their 50-day averages.
// The market context only PENALIZES the score; it never fully blocks signals.

import { sma } from "./indicators/index.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// Returns true/false when computable, null when there is not enough data.
function isBelowSma(candles, period) {
  if (!Array.isArray(candles) || candles.length < period + 1) return null;
  const closes = candles.map((c) => (c ? c.close : NaN));
  const smaArr = sma(closes, period);
  const last = closes.length - 1;
  const price = closes[last];
  const avg = smaArr[last];
  if (!isNum(price) || !isNum(avg)) return null;
  return price < avg;
}

/**
 * Assess the broad market using the provider (needs getTimeSeries).
 * Returns { label:"Healthy"|"Cautious"|"Bearish", spyBelow50, qqqWeak, scorePenalty, note }.
 */
export async function getMarketCondition(provider) {
  const result = {
    label: "Healthy",
    spyBelow50: false,
    qqqWeak: false,
    scorePenalty: 0,
    note: "Broad market is holding above its 50-day averages."
  };
  try {
    if (!provider || typeof provider.getTimeSeries !== "function") {
      return { ...result, note: "Market context unavailable; provider missing." };
    }
    const [spy, qqq] = await Promise.all([
      provider.getTimeSeries("SPY", "1day", 120).catch(() => null),
      provider.getTimeSeries("QQQ", "1day", 120).catch(() => null)
    ]);
    const spyBelow = isBelowSma(spy, 50);
    const qqqBelow = isBelowSma(qqq, 50);
    result.spyBelow50 = spyBelow === true;
    result.qqqWeak = qqqBelow === true;

    if (spyBelow === true && qqqBelow === true) {
      result.label = "Bearish";
      result.scorePenalty = 15;
      result.note = "Both SPY and QQQ are below their 50-day moving averages.";
    } else if (spyBelow === true) {
      result.label = "Cautious";
      result.scorePenalty = 8;
      result.note = "SPY is below its 50-day moving average.";
    } else if (qqqBelow === true) {
      result.label = "Cautious";
      result.scorePenalty = 8;
      result.note = "QQQ is below its 50-day moving average.";
    }
    return result;
  } catch (err) {
    console.error("[Stock] getMarketCondition failed:", err.message);
    return { ...result, note: "Market context unavailable due to an error." };
  }
}
