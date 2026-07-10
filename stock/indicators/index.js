// stock/indicators/index.js
// Pure technical-analysis indicator functions. No I/O, no logging, no side effects.
//
// Return-shape convention (documented per function):
//   - Most functions return an ARRAY aligned to the input length, with leading
//     `null` values for positions where the indicator is not yet defined.
//   - `relativeVolume` returns a single latest SCALAR (or null) as noted.
//
// Every function guards against short/invalid input, NaN and Infinity: on bad
// input they return a null-filled array (or null scalar) instead of throwing.

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Exponential Moving Average.
 * Returns an array aligned to `values.length` with leading nulls; the first
 * defined value (at index period-1) is seeded with the SMA of the first period.
 */
export function ema(values, period) {
  const n = Array.isArray(values) ? values.length : 0;
  const out = new Array(n).fill(null);
  if (n < period || period < 1) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) {
    if (!isNum(values[i])) return out;
    seed += values[i];
  }
  seed /= period;
  out[period - 1] = seed;
  let prev = seed;
  for (let i = period; i < n; i++) {
    if (!isNum(values[i])) { out[i] = null; continue; }
    prev = (values[i] - prev) * k + prev;
    out[i] = prev;
  }
  return out;
}

/**
 * Simple Moving Average.
 * Returns an array aligned to input length with leading nulls.
 */
export function sma(values, period) {
  const n = Array.isArray(values) ? values.length : 0;
  const out = new Array(n).fill(null);
  if (n < period || period < 1) return out;
  for (let i = period - 1; i < n; i++) {
    let sum = 0;
    let ok = true;
    for (let j = i - period + 1; j <= i; j++) {
      if (!isNum(values[j])) { ok = false; break; }
      sum += values[j];
    }
    out[i] = ok ? sum / period : null;
  }
  return out;
}

function rsiFromAverages(avgGain, avgLoss) {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Relative Strength Index (Wilder's smoothing).
 * Returns an array aligned to input length; first defined value at index `period`.
 */
export function rsi(closes, period = 14) {
  const n = Array.isArray(closes) ? closes.length : 0;
  const out = new Array(n).fill(null);
  if (n < period + 1 || period < 1) return out;
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (!isNum(diff)) return out;
    if (diff >= 0) gainSum += diff;
    else lossSum -= diff;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = rsiFromAverages(avgGain, avgLoss);
  for (let i = period + 1; i < n; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = rsiFromAverages(avgGain, avgLoss);
  }
  return out;
}

// EMA over a series that may have leading nulls (used for the MACD signal line).
function emaOfSparse(series, period) {
  const n = series.length;
  const out = new Array(n).fill(null);
  let start = 0;
  while (start < n && !isNum(series[start])) start++;
  if (n - start < period) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = start; i < start + period; i++) seed += series[i];
  seed /= period;
  out[start + period - 1] = seed;
  let prev = seed;
  for (let i = start + period; i < n; i++) {
    if (!isNum(series[i])) { out[i] = null; continue; }
    prev = (series[i] - prev) * k + prev;
    out[i] = prev;
  }
  return out;
}

/**
 * MACD. Returns { macd:[], signal:[], histogram:[] } — all arrays aligned to input length.
 */
export function macd(closes, fast = 12, slow = 26, signal = 9) {
  const n = Array.isArray(closes) ? closes.length : 0;
  const empty = {
    macd: new Array(n).fill(null),
    signal: new Array(n).fill(null),
    histogram: new Array(n).fill(null)
  };
  if (n < slow) return empty;
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (isNum(emaFast[i]) && isNum(emaSlow[i])) macdLine[i] = emaFast[i] - emaSlow[i];
  }
  const signalLine = emaOfSparse(macdLine, signal);
  const histogram = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (isNum(macdLine[i]) && isNum(signalLine[i])) histogram[i] = macdLine[i] - signalLine[i];
  }
  return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * Average True Range (Wilder's smoothing).
 * Takes candles [{high,low,close}]. Returns an array aligned to input length.
 */
export function atr(candles, period = 14) {
  const n = Array.isArray(candles) ? candles.length : 0;
  const out = new Array(n).fill(null);
  if (n < period + 1 || period < 1) return out;
  const tr = new Array(n).fill(null);
  for (let i = 1; i < n; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    if (!isNum(h) || !isNum(l) || !isNum(pc)) return out;
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i];
  let prev = sum / period;
  out[period] = prev;
  for (let i = period + 1; i < n; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

/**
 * Bollinger Bands. Returns { upper:[], middle:[], lower:[] } aligned to input length.
 */
export function bollinger(closes, period = 20, mult = 2) {
  const n = Array.isArray(closes) ? closes.length : 0;
  const middle = sma(closes, period);
  const upper = new Array(n).fill(null);
  const lower = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    if (!isNum(middle[i])) continue;
    let sumSq = 0;
    let ok = true;
    for (let j = i - period + 1; j <= i; j++) {
      if (!isNum(closes[j])) { ok = false; break; }
      sumSq += (closes[j] - middle[i]) ** 2;
    }
    if (!ok) continue;
    const sd = Math.sqrt(sumSq / period);
    upper[i] = middle[i] + mult * sd;
    lower[i] = middle[i] - mult * sd;
  }
  return { upper, middle, lower };
}

/**
 * Rate of Change (percent). Returns an array aligned to input length.
 */
export function roc(closes, period = 12) {
  const n = Array.isArray(closes) ? closes.length : 0;
  const out = new Array(n).fill(null);
  if (n < period + 1 || period < 1) return out;
  for (let i = period; i < n; i++) {
    const prev = closes[i - period];
    if (!isNum(prev) || prev === 0 || !isNum(closes[i])) continue;
    out[i] = ((closes[i] - prev) / prev) * 100;
  }
  return out;
}

/**
 * On-Balance Volume. Takes candles [{close,volume}]. Returns an array aligned to input length.
 */
export function obv(candles) {
  const n = Array.isArray(candles) ? candles.length : 0;
  const out = new Array(n).fill(null);
  if (n === 0) return out;
  let acc = 0;
  out[0] = 0;
  for (let i = 1; i < n; i++) {
    const c = candles[i].close;
    const pc = candles[i - 1].close;
    const v = candles[i].volume;
    if (!isNum(c) || !isNum(pc) || !isNum(v)) { out[i] = acc; continue; }
    if (c > pc) acc += v;
    else if (c < pc) acc -= v;
    out[i] = acc;
  }
  return out;
}

/**
 * Average volume (SMA of volume). Returns an array aligned to input length.
 */
export function averageVolume(candles, period = 20) {
  const vols = (Array.isArray(candles) ? candles : []).map(
    (c) => (c && isNum(c.volume) ? c.volume : NaN)
  );
  return sma(vols, period);
}

/**
 * Relative volume = latest volume / trailing average volume (excluding the latest bar).
 * Returns a single latest SCALAR (or null if not computable).
 */
export function relativeVolume(candles, period = 20) {
  const n = Array.isArray(candles) ? candles.length : 0;
  if (n < period + 1) return null;
  const vols = candles.map((c) => (c && isNum(c.volume) ? c.volume : NaN));
  const avgArr = sma(vols, period);
  const latest = vols[n - 1];
  const avg = avgArr[n - 2];
  if (!isNum(latest) || !isNum(avg) || avg === 0) return null;
  return latest / avg;
}
