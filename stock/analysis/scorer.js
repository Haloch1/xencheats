// stock/analysis/scorer.js
// Transparent 0-100 buy-signal scoring model. Pure, no I/O.
//
// COMPLIANCE: this is a technical-analysis signal, not financial advice. All
// human-readable strings use cautious wording ("potential", "strong bullish setup
// detected", "high-confidence signal based on the configured strategy") and never
// promise profit or claim a price will rise.

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// Maximum points per category (sums to 100). Exposed so callers can render the model.
export const SCORE_WEIGHTS = Object.freeze({
  longTerm: 20,
  medium: 15,
  momentum: 20,
  volume: 15,
  entry: 20,
  risk: 10
});

// Default relative-volume threshold used inside the volume bucket.
const DEFAULT_RELVOL_THRESHOLD = 1.2;

const clampBucket = (pts, max) => Math.max(0, Math.min(max, pts));

/**
 * Score a multi-timeframe setup.
 * @param {object} args
 * @param {object} args.daily  analyzeTimeframe() output for the daily timeframe
 * @param {object} [args.h4]   analyzeTimeframe() output for the 4h timeframe
 * @param {object} [args.h1]   analyzeTimeframe() output for the 1h timeframe
 * @param {object} [args.market] getMarketCondition() output (optional; applies a penalty)
 * @param {object} [args.risk] computeRisk() output (optional; improves risk scoring)
 * @param {number} [args.relVolThreshold] override for the relative-volume threshold
 * Returns { score, breakdown:{longTerm,medium,momentum,volume,entry,risk}, reasons:[], warnings:[] }.
 */
export function scoreSignal({ daily, h4, h1, market, risk, relVolThreshold } = {}) {
  const reasons = [];
  const warnings = [];
  const relThresh = isNum(relVolThreshold) ? relVolThreshold : DEFAULT_RELVOL_THRESHOLD;

  try {
    if (!daily || daily.ok === false) {
      return {
        score: 0,
        breakdown: { longTerm: 0, medium: 0, momentum: 0, volume: 0, entry: 0, risk: 0 },
        reasons: [],
        warnings: ["Daily timeframe data was insufficient to evaluate a signal."]
      };
    }

    const d = daily;
    const price = d.price;
    const atrPct = isNum(d.atr) && isNum(price) && price > 0 ? d.atr / price : null;

    // ---- Long-term trend (max 20) ----
    let longTerm = 0;
    if (d.aboveSma200) {
      longTerm += 6;
      reasons.push("Price is trading above its long-term (200-day) average.");
    }
    if (isNum(d.ema50) && isNum(d.sma200) && d.ema50 > d.sma200) {
      longTerm += 5;
      reasons.push("The medium average is above the long-term average (bullish alignment).");
    }
    if (isNum(d.sma200Slope) && d.sma200Slope >= 0) {
      longTerm += 5;
    } else if (isNum(d.sma200Slope) && d.sma200Slope < 0) {
      warnings.push("The long-term average is still sloping down.");
    }
    if (d.trend === "bullish") {
      longTerm += 4;
    }
    longTerm = clampBucket(longTerm, SCORE_WEIGHTS.longTerm);

    // ---- Medium-term trend (max 15) ----
    let medium = 0;
    if (isNum(d.ema20) && isNum(d.ema50) && price > d.ema20 && price > d.ema50) {
      medium += 5;
      reasons.push("Price is holding above its short and medium moving averages.");
    }
    if (d.ema20AboveEma50) medium += 4;
    if (d.structure && d.structure.higherHighs && d.structure.higherLows) {
      medium += 3;
      reasons.push("Recent structure shows higher highs and higher lows.");
    }
    if (d.trend === "bullish" && isNum(d.rsi) && d.rsi >= 40 && d.rsi <= 60) {
      medium += 3;
      reasons.push("A healthy pullback within the uptrend was detected.");
    }
    medium = clampBucket(medium, SCORE_WEIGHTS.medium);

    // ---- Momentum (max 20) ----
    let momentum = 0;
    let momentumOk = false;
    if (isNum(d.rsi) && d.rsi >= 40 && d.rsi < 70) {
      momentum += 6;
      momentumOk = true;
      reasons.push("Momentum (RSI) is recovering and not yet overbought.");
    } else if (isNum(d.rsi) && d.rsi >= 70) {
      warnings.push("RSI is elevated, which can precede short-term pullbacks.");
    }
    if (d.macd && d.macd.cross === "bullish") {
      momentum += 6;
      momentumOk = true;
      reasons.push("A bullish MACD crossover was detected.");
    } else if (d.macd && d.macd.cross === "bullish-hold") {
      momentum += 3;
      momentumOk = true;
    }
    if (d.macd && d.macd.histRising) {
      momentum += 4;
      momentumOk = true;
    }
    if (isNum(d.roc) && d.roc > 0) {
      momentum += 4;
      momentumOk = true;
    }
    momentum = clampBucket(momentum, SCORE_WEIGHTS.momentum);

    // ---- Volume confirmation (max 15) ----
    let volume = 0;
    let volumeOk = false;
    if (isNum(d.relVolume) && d.relVolume > 1 && isNum(d.roc) && d.roc > 0) {
      volume += 5;
      volumeOk = true;
      reasons.push("Above-average volume accompanied the recent up move.");
    }
    if (isNum(d.relVolume) && d.relVolume >= relThresh) {
      volume += 5;
      volumeOk = true;
    }
    if (d.obvRising) {
      volume += 3;
      volumeOk = true;
      reasons.push("On-balance volume is rising, hinting at accumulation.");
    }
    if (
      isNum(d.bb && d.bb.pctFromUpper) &&
      d.bb.pctFromUpper < 0.15 &&
      isNum(d.relVolume) &&
      d.relVolume >= relThresh
    ) {
      volume += 2;
      volumeOk = true;
      reasons.push("A volume-confirmed breakout toward the upper band was detected.");
    }
    volume = clampBucket(volume, SCORE_WEIGHTS.volume);

    // ---- Entry quality (max 20) ----
    let entry = 0;
    let priceActionOk = false;
    if (isNum(d.bb && d.bb.pctFromLower) && d.bb.pctFromLower < 0.4) {
      entry += 5;
      priceActionOk = true;
      reasons.push("Price is near the lower band / support, offering a favorable entry.");
    }
    if (isNum(d.ema20) && isNum(d.atr) && d.atr > 0 && Math.abs(price - d.ema20) <= d.atr && d.trend !== "bearish") {
      entry += 5;
      priceActionOk = true;
      reasons.push("Price is retesting its short-term average within the trend.");
    }
    if (isNum(d.rsi) && d.rsi >= 35 && d.rsi <= 55 && d.trend !== "bearish") {
      entry += 4;
      priceActionOk = true;
    }
    if (h4 && h4.ok !== false && h4.trend === "bullish" && h1 && h1.ok !== false && h1.trend === "bullish") {
      entry += 3;
      priceActionOk = true;
      reasons.push("Lower timeframes (4h and 1h) are aligned to the upside.");
    }
    if (atrPct !== null && atrPct >= 0.005 && atrPct <= 0.06) {
      entry += 3;
    }
    entry = clampBucket(entry, SCORE_WEIGHTS.entry);

    // ---- Risk conditions (max 10) ----
    let riskPts = 0;
    let extended = false;
    if (atrPct !== null && atrPct >= 0.005 && atrPct <= 0.06) {
      riskPts += 3;
    } else if (atrPct !== null && atrPct > 0.06) {
      warnings.push("Volatility (ATR) is elevated; position sizing should account for wider swings.");
    }
    if (isNum(d.bb && d.bb.pctFromUpper) && d.bb.pctFromUpper > 0.1) {
      riskPts += 3;
    } else if (isNum(d.ema20) && price > d.ema20 * 1.15) {
      extended = true;
      warnings.push("Price is extended well above its short-term average.");
    }
    if (atrPct !== null && atrPct < 0.08) {
      riskPts += 2;
    }
    if (risk && isNum(risk.riskReward) && risk.riskReward >= 1.5) {
      riskPts += 2;
      reasons.push(`Risk-reward is favorable at about ${risk.riskReward.toFixed(2)} : 1.`);
    } else if (risk && isNum(risk.riskReward) && risk.riskReward < 1.5) {
      warnings.push("Risk-reward is below the preferred threshold.");
    }
    riskPts = clampBucket(riskPts, SCORE_WEIGHTS.risk);

    let score = longTerm + medium + momentum + volume + entry + riskPts;

    // Market context only penalizes; it never fully blocks.
    if (market && isNum(market.scorePenalty) && market.scorePenalty > 0) {
      score -= market.scorePenalty;
      if (market.note) warnings.push(`Broad-market caution: ${market.note}`);
    }
    score = Math.max(0, Math.min(100, Math.round(score)));

    if (!reasons.length) {
      reasons.push("A strong bullish setup was detected based on the configured strategy.");
    }

    return {
      score,
      breakdown: { longTerm, medium, momentum, volume, entry, risk: riskPts },
      reasons,
      warnings,
      // Extra flags handy for evaluateConfirmations (not required by the spec shape).
      flags: { momentumOk, volumeOk, priceActionOk, extended, atrPct }
    };
  } catch (err) {
    console.error("[Stock] scoreSignal failed:", err.message);
    return {
      score: 0,
      breakdown: { longTerm: 0, medium: 0, momentum: 0, volume: 0, entry: 0, risk: 0 },
      reasons: [],
      warnings: ["Scoring failed due to an internal error."]
    };
  }
}

/**
 * Map a numeric score to a confidence label.
 *   90-100 -> "Very high", 80-89 -> "High", 70-79 -> "Moderate", <70 -> "Low".
 */
export function confidenceLabel(score) {
  if (!isNum(score)) return "Low";
  if (score >= 90) return "Very high";
  if (score >= 80) return "High";
  if (score >= 70) return "Moderate";
  return "Low";
}

/**
 * Final gatekeeping before an alert is emitted. Every rule must pass to qualify:
 *   1. score >= minScore
 *   2. daily trend is not strongly bearish
 *   3. at least one momentum confirmation (momentumOk)
 *   4. at least one volume/price-action confirmation (volumeOrPriceActionOk)
 *   5. price is not excessively extended (extended === false)
 *   6. data is current & complete (dataCurrent === true)
 *   7. riskReward >= minRiskReward
 *   8. no active cooldown (cooldownActive === false)
 * Returns { qualifies:bool, reasons:[] } with compliant wording.
 */
export function evaluateConfirmations({
  score,
  minScore,
  daily,
  momentumOk,
  volumeOrPriceActionOk,
  extended,
  dataCurrent,
  riskReward,
  minRiskReward,
  cooldownActive
} = {}) {
  const reasons = [];
  const checks = [];

  const scoreOk = isNum(score) && isNum(minScore) && score >= minScore;
  checks.push(scoreOk);
  if (!scoreOk) reasons.push(`Signal score ${isNum(score) ? Math.round(score) : "n/a"} is below the configured minimum of ${minScore}.`);

  const trendOk = !daily || daily.trend !== "bearish";
  checks.push(trendOk);
  if (!trendOk) reasons.push("The daily trend is strongly bearish, so this setup is skipped.");

  const momOk = !!momentumOk;
  checks.push(momOk);
  if (!momOk) reasons.push("No momentum confirmation was detected for the configured strategy.");

  const volOk = !!volumeOrPriceActionOk;
  checks.push(volOk);
  if (!volOk) reasons.push("No volume or price-action confirmation was detected.");

  const notExtendedOk = !extended;
  checks.push(notExtendedOk);
  if (!notExtendedOk) reasons.push("Price is excessively extended above its moving averages.");

  const dataOk = !!dataCurrent;
  checks.push(dataOk);
  if (!dataOk) reasons.push("Market data is stale or incomplete.");

  const rrOk = isNum(riskReward) && isNum(minRiskReward) && riskReward >= minRiskReward;
  checks.push(rrOk);
  if (!rrOk) reasons.push(`Risk-reward ${isNum(riskReward) ? riskReward.toFixed(2) : "n/a"} is below the configured minimum of ${minRiskReward}.`);

  const cooldownOk = !cooldownActive;
  checks.push(cooldownOk);
  if (!cooldownOk) reasons.push("An alert cooldown is currently active for this ticker.");

  const qualifies = checks.every(Boolean);
  if (qualifies) {
    reasons.push("All confirmations passed: high-confidence signal based on the configured strategy.");
  }
  return { qualifies, reasons };
}
