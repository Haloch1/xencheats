// stock/analysis/priceStructure.js
// Pure price-structure analysis: swing points, support/resistance, trend structure,
// breakout and pullback detection. No I/O. Guards against short/invalid input.

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Find swing highs and lows. A swing high at index i is a candle whose high is
 * strictly greater than every high within `lookback` bars on each side (same for lows).
 * Returns { swingHighs:[{index,price,time}], swingLows:[{index,price,time}] }.
 */
export function findSwings(candles, lookback = 5) {
  const swingHighs = [];
  const swingLows = [];
  const n = Array.isArray(candles) ? candles.length : 0;
  const lb = Math.max(1, Math.floor(lookback));
  for (let i = lb; i < n - lb; i++) {
    const c = candles[i];
    if (!c || !isNum(c.high) || !isNum(c.low)) continue;
    let isHigh = true;
    let isLow = true;
    for (let j = i - lb; j <= i + lb; j++) {
      if (j === i) continue;
      const o = candles[j];
      if (!o || !isNum(o.high) || !isNum(o.low)) { isHigh = false; isLow = false; break; }
      if (o.high >= c.high) isHigh = false;
      if (o.low <= c.low) isLow = false;
    }
    if (isHigh) swingHighs.push({ index: i, price: c.high, time: c.time });
    if (isLow) swingLows.push({ index: i, price: c.low, time: c.time });
  }
  return { swingHighs, swingLows };
}

/**
 * Support / resistance derived from recent swing points relative to the latest close.
 * Returns { support, resistance, recentSwingHigh, recentSwingLow }.
 */
export function supportResistance(candles) {
  const n = Array.isArray(candles) ? candles.length : 0;
  if (n === 0) {
    return { support: null, resistance: null, recentSwingHigh: null, recentSwingLow: null };
  }
  const lookback = Math.min(5, Math.max(1, Math.floor(n / 6)));
  const { swingHighs, swingLows } = findSwings(candles, lookback);
  const price = candles[n - 1].close;
  const recentSwingHigh = swingHighs.length ? swingHighs[swingHighs.length - 1].price : null;
  const recentSwingLow = swingLows.length ? swingLows[swingLows.length - 1].price : null;

  // Support: the highest swing low that still sits below the current price.
  let support = null;
  for (const s of swingLows) {
    if (isNum(price) && s.price < price && (support === null || s.price > support)) support = s.price;
  }
  // Resistance: the lowest swing high that sits above the current price.
  let resistance = null;
  for (const s of swingHighs) {
    if (isNum(price) && s.price > price && (resistance === null || s.price < resistance)) resistance = s.price;
  }
  // Fallbacks to the window extremes when no qualifying swing was found.
  if (support === null) {
    const lows = candles.map((c) => c.low).filter(isNum);
    support = lows.length ? Math.min(...lows) : null;
  }
  if (resistance === null) {
    const highs = candles.map((c) => c.high).filter(isNum);
    resistance = highs.length ? Math.max(...highs) : null;
  }
  return { support, resistance, recentSwingHigh, recentSwingLow };
}

/**
 * Trend structure from the last two swing highs/lows.
 * Returns { label:"uptrend"|"downtrend"|"range", higherHighs:bool, higherLows:bool }.
 */
export function trendStructure(candles) {
  const { swingHighs, swingLows } = findSwings(candles, 3);
  let higherHighs = false;
  let higherLows = false;
  let lowerHighs = false;
  let lowerLows = false;

  if (swingHighs.length >= 2 && swingLows.length >= 2) {
    // Enough pivots: classify from the last two swing highs and lows.
    const ha = swingHighs[swingHighs.length - 2].price;
    const hb = swingHighs[swingHighs.length - 1].price;
    higherHighs = hb > ha;
    lowerHighs = hb < ha;
    const la = swingLows[swingLows.length - 2].price;
    const lb = swingLows[swingLows.length - 1].price;
    higherLows = lb > la;
    lowerLows = lb < la;
  } else {
    // Strongly trending series can have too few pivots; fall back to comparing the
    // extremes of the first vs second half of the window.
    const n = Array.isArray(candles) ? candles.length : 0;
    if (n >= 4) {
      const mid = Math.floor(n / 2);
      const first = candles.slice(0, mid);
      const second = candles.slice(mid);
      const maxHigh = (arr) => Math.max(...arr.map((c) => c.high).filter(isNum));
      const minLow = (arr) => Math.min(...arr.map((c) => c.low).filter(isNum));
      const fh = maxHigh(first);
      const sh = maxHigh(second);
      const fl = minLow(first);
      const sl = minLow(second);
      if (isNum(fh) && isNum(sh)) {
        higherHighs = sh > fh;
        lowerHighs = sh < fh;
      }
      if (isNum(fl) && isNum(sl)) {
        higherLows = sl > fl;
        lowerLows = sl < fl;
      }
    }
  }

  let label = "range";
  if (higherHighs && higherLows) label = "uptrend";
  else if (lowerHighs && lowerLows) label = "downtrend";
  return { label, higherHighs, higherLows };
}

/**
 * Detect a breakout: latest close above the prior `lookback`-bar high.
 * Returns { breakout:bool, level:number|null }.
 */
export function detectBreakout(candles, lookback = 20) {
  const n = Array.isArray(candles) ? candles.length : 0;
  if (n < lookback + 1) return { breakout: false, level: null };
  const window = candles.slice(n - 1 - lookback, n - 1);
  const highs = window.map((c) => c.high).filter(isNum);
  if (!highs.length) return { breakout: false, level: null };
  const priorHigh = Math.max(...highs);
  const latest = candles[n - 1].close;
  return { breakout: isNum(latest) && latest > priorHigh, level: priorHigh };
}

/**
 * Detect a healthy pullback: price has eased 1%-12% off the recent high.
 * Returns { pullback:bool, depth:number|null } where depth is fractional (0.05 = 5%).
 */
export function detectPullback(candles, lookback = 10) {
  const n = Array.isArray(candles) ? candles.length : 0;
  if (n < lookback + 2) return { pullback: false, depth: null };
  const window = candles.slice(n - 1 - lookback, n);
  const highs = window.map((c) => c.high).filter(isNum);
  if (!highs.length) return { pullback: false, depth: null };
  const recentHigh = Math.max(...highs);
  const latest = candles[n - 1].close;
  if (!isNum(latest) || recentHigh <= 0) return { pullback: false, depth: null };
  const depth = (recentHigh - latest) / recentHigh;
  const pullback = depth > 0.01 && depth < 0.12;
  return { pullback, depth };
}
