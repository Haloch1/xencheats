// stock/analysis/trend.js
// Per-timeframe technical analysis built on the pure indicator + price-structure modules.

import {
  ema,
  sma,
  rsi,
  macd,
  atr,
  bollinger,
  roc,
  obv,
  relativeVolume
} from "../indicators/index.js";
import { trendStructure } from "./priceStructure.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Analyze a single timeframe's candle array.
 * On short/invalid input returns { ok:false, reason }. On success returns a rich object:
 * { ok:true, ema20, ema50, sma200, price, aboveSma200, ema20AboveEma50, sma200Slope,
 *   rsi, macd:{cross,histRising}, roc, atr, bb:{pctFromLower,pctFromUpper},
 *   relVolume, obvRising, trend:"bullish"|"bearish"|"neutral", structure }.
 */
export function analyzeTimeframe(candles) {
  try {
    if (!Array.isArray(candles) || candles.length < 30) {
      return { ok: false, reason: "not enough candles (need at least 30)" };
    }
    const closes = candles.map((c) => (c ? c.close : NaN));
    if (closes.some((c) => !isNum(c))) {
      return { ok: false, reason: "invalid close data" };
    }
    const last = closes.length - 1;
    const price = closes[last];

    const ema20Arr = ema(closes, 20);
    const ema50Arr = ema(closes, 50);
    const sma200Arr = sma(closes, 200);
    const rsiArr = rsi(closes, 14);
    const macdObj = macd(closes);
    const atrArr = atr(candles, 14);
    const bbObj = bollinger(closes, 20, 2);
    const rocArr = roc(closes, 12);
    const obvArr = obv(candles);

    const ema20v = ema20Arr[last];
    const ema50v = ema50Arr[last];
    const sma200v = sma200Arr[last];

    // sma200 slope over the last 5 bars (positive => rising).
    let sma200Slope = null;
    const slopeIdx = last - 5;
    if (slopeIdx >= 0 && isNum(sma200Arr[slopeIdx]) && isNum(sma200v)) {
      sma200Slope = sma200v - sma200Arr[slopeIdx];
    }

    // MACD cross state.
    const mLast = macdObj.macd[last];
    const sLast = macdObj.signal[last];
    const mPrev = macdObj.macd[last - 1];
    const sPrev = macdObj.signal[last - 1];
    let cross = "none";
    if ([mLast, sLast, mPrev, sPrev].every(isNum)) {
      if (mPrev <= sPrev && mLast > sLast) cross = "bullish";
      else if (mPrev >= sPrev && mLast < sLast) cross = "bearish";
      else cross = mLast > sLast ? "bullish-hold" : "bearish-hold";
    }
    const histLast = macdObj.histogram[last];
    const histPrev = macdObj.histogram[last - 1];
    const histRising = isNum(histLast) && isNum(histPrev) ? histLast > histPrev : false;

    // Bollinger position (fraction of band width from lower / upper).
    let pctFromLower = null;
    let pctFromUpper = null;
    if (isNum(bbObj.lower[last]) && isNum(bbObj.upper[last])) {
      const range = bbObj.upper[last] - bbObj.lower[last];
      if (range > 0) {
        pctFromLower = (price - bbObj.lower[last]) / range;
        pctFromUpper = (bbObj.upper[last] - price) / range;
      }
    }

    const relVolume = relativeVolume(candles, 20);
    const obvRising = isNum(obvArr[last]) && isNum(obvArr[last - 3]) ? obvArr[last] > obvArr[last - 3] : false;
    const structure = trendStructure(candles);

    const aboveSma200 = isNum(sma200v)
      ? price > sma200v
      : isNum(ema50v)
        ? price > ema50v
        : false;
    const ema20AboveEma50 = isNum(ema20v) && isNum(ema50v) ? ema20v > ema50v : false;

    // Simple weighted trend vote.
    let bull = 0;
    let bear = 0;
    if (isNum(ema20v)) (price > ema20v ? bull++ : bear++);
    ema20AboveEma50 ? bull++ : bear++;
    aboveSma200 ? bull++ : bear++;
    if (structure.label === "uptrend") bull++;
    if (structure.label === "downtrend") bear++;
    let trend = "neutral";
    if (bull >= 3 && bull > bear) trend = "bullish";
    else if (bear >= 3 && bear > bull) trend = "bearish";

    return {
      ok: true,
      ema20: isNum(ema20v) ? ema20v : null,
      ema50: isNum(ema50v) ? ema50v : null,
      sma200: isNum(sma200v) ? sma200v : null,
      price,
      aboveSma200,
      ema20AboveEma50,
      sma200Slope,
      rsi: isNum(rsiArr[last]) ? rsiArr[last] : null,
      macd: { cross, histRising },
      roc: isNum(rocArr[last]) ? rocArr[last] : null,
      atr: isNum(atrArr[last]) ? atrArr[last] : null,
      bb: { pctFromLower, pctFromUpper },
      relVolume,
      obvRising,
      trend,
      structure
    };
  } catch (err) {
    console.error("[Stock] analyzeTimeframe failed:", err.message);
    return { ok: false, reason: "analysis error: " + err.message };
  }
}
