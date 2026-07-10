// stock/validate.js
// Candle-array validation and normalization. Pure, no I/O.

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// Coerce a candle time (Date | number | string) to epoch ms, or null if invalid.
function toMs(time) {
  if (time instanceof Date) {
    const t = time.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof time === "number") return Number.isFinite(time) ? time : null;
  if (typeof time === "string") {
    const t = new Date(time).getTime();
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

/**
 * Remove duplicate timestamps (last one wins) and sort ascending by time.
 * Returns a new array of candles with a normalized `time` (Date).
 */
export function dedupeAndSort(candles) {
  if (!Array.isArray(candles)) return [];
  const byTime = new Map();
  for (const c of candles) {
    if (!c) continue;
    const t = toMs(c.time);
    if (t === null) continue;
    byTime.set(t, { ...c, time: c.time instanceof Date ? c.time : new Date(t) });
  }
  return [...byTime.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
}

/**
 * Validate a candle array.
 * Checks: enough candles (>= minLength after de-dup), timestamps ascending,
 * removes duplicate timestamps, rejects NaN / non-positive prices, rejects
 * negative volume, and rejects a stale latest candle (older than maxAgeMs).
 *
 * @param {Array} candles
 * @param {number} minLength
 * @param {object} [opts]
 * @param {number} [opts.maxAgeMs] latest candle must be newer than now - maxAgeMs
 * Returns { ok:boolean, reason:string, candles?:Array } (candles = cleaned array when ok).
 */
export function validateCandles(candles, minLength = 30, { maxAgeMs } = {}) {
  try {
    if (!Array.isArray(candles) || candles.length === 0) {
      return { ok: false, reason: "no candles provided" };
    }
    const sorted = dedupeAndSort(candles);
    if (sorted.length < minLength) {
      return { ok: false, reason: `need at least ${minLength} candles, got ${sorted.length}` };
    }
    for (const c of sorted) {
      for (const k of ["open", "high", "low", "close"]) {
        const v = c[k];
        if (!isNum(v) || v <= 0) return { ok: false, reason: `invalid ${k} value` };
      }
      if (c.high < c.low) return { ok: false, reason: "high is below low" };
      if (c.volume !== undefined && c.volume !== null) {
        if (!isNum(c.volume) || c.volume < 0) return { ok: false, reason: "invalid volume value" };
      }
    }
    // Ascending check (dedupeAndSort guarantees strict ordering, this is a belt-and-braces guard).
    for (let i = 1; i < sorted.length; i++) {
      if (toMs(sorted[i].time) <= toMs(sorted[i - 1].time)) {
        return { ok: false, reason: "timestamps are not strictly ascending" };
      }
    }
    if (isNum(maxAgeMs)) {
      const latestMs = toMs(sorted[sorted.length - 1].time);
      if (latestMs === null) return { ok: false, reason: "latest candle has an invalid timestamp" };
      if (Date.now() - latestMs > maxAgeMs) {
        return { ok: false, reason: "latest candle is stale" };
      }
    }
    return { ok: true, reason: "ok", candles: sorted };
  } catch (err) {
    return { ok: false, reason: "validation error: " + err.message };
  }
}
