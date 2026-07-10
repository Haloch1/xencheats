// stock/analysis/risk.js
// Entry zone, invalidation and risk/reward math. Pure, no I/O.

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

const EMPTY = {
  entryLow: null,
  entryHigh: null,
  invalidation: null,
  nearestSupport: null,
  nearestResistance: null,
  upside: null,
  downside: null,
  riskReward: null
};

/**
 * Compute a trade plan from price, nearest support/resistance and ATR.
 *   - entry zone ~ price ± 0.5 * ATR
 *   - invalidation just below nearest support, else price - 1.5 * ATR
 *   - target is nearest resistance above price, else price + 2 * ATR
 *   - riskReward = upside / downside; null (rejected) when downside <= 0
 * Returns { entryLow, entryHigh, invalidation, nearestSupport, nearestResistance,
 *           upside, downside, riskReward }.
 */
export function computeRisk({ price, support, resistance, atr } = {}) {
  try {
    if (!isNum(price) || !isNum(atr) || atr <= 0) {
      return {
        ...EMPTY,
        nearestSupport: isNum(support) ? support : null,
        nearestResistance: isNum(resistance) ? resistance : null
      };
    }
    const entryLow = price - 0.5 * atr;
    const entryHigh = price + 0.5 * atr;
    const nearestSupport = isNum(support) ? support : null;
    const nearestResistance = isNum(resistance) ? resistance : null;

    let invalidation;
    if (nearestSupport !== null && nearestSupport < price) {
      // Just below the nearest support level.
      invalidation = nearestSupport - 0.25 * atr;
    } else {
      invalidation = price - 1.5 * atr;
    }

    const target =
      nearestResistance !== null && nearestResistance > price
        ? nearestResistance
        : price + 2 * atr;

    const upside = target - price;
    const downside = price - invalidation;

    // Reject the setup (riskReward = null) when downside is not positive.
    let riskReward = null;
    if (downside > 0 && upside > 0) riskReward = upside / downside;

    return {
      entryLow,
      entryHigh,
      invalidation,
      nearestSupport,
      nearestResistance,
      upside,
      downside,
      riskReward
    };
  } catch (err) {
    console.error("[Stock] computeRisk failed:", err.message);
    return { ...EMPTY };
  }
}
