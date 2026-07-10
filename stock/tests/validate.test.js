// stock/tests/validate.test.js
import { describe, it, expect } from "vitest";
import { validateCandles, dedupeAndSort } from "../validate.js";

function makeCandles(n, { baseTime = Date.UTC(2025, 0, 1), stepMs = 86400000 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      time: new Date(baseTime + i * stepMs),
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1000
    });
  }
  return out;
}

describe("dedupeAndSort", () => {
  it("removes duplicate timestamps and sorts ascending", () => {
    const a = { time: new Date(2000), open: 1, high: 2, low: 0.5, close: 1.5, volume: 1 };
    const b = { time: new Date(1000), open: 1, high: 2, low: 0.5, close: 1.5, volume: 1 };
    const dupe = { time: new Date(2000), open: 9, high: 9, low: 9, close: 9, volume: 9 };
    const sorted = dedupeAndSort([a, b, dupe]);
    expect(sorted.length).toBe(2);
    expect(sorted[0].time.getTime()).toBe(1000);
    expect(sorted[1].time.getTime()).toBe(2000);
    // last-write-wins on the duplicate timestamp
    expect(sorted[1].close).toBe(9);
  });
});

describe("validateCandles", () => {
  it("accepts a healthy series", () => {
    const res = validateCandles(makeCandles(40), 30);
    expect(res.ok).toBe(true);
    expect(res.candles.length).toBe(40);
  });

  it("rejects a series that is too short", () => {
    const res = validateCandles(makeCandles(10), 30);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/at least/);
  });

  it("rejects NaN prices", () => {
    const candles = makeCandles(40);
    candles[20].close = NaN;
    const res = validateCandles(candles, 30);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/invalid close/);
  });

  it("rejects negative prices", () => {
    const candles = makeCandles(40);
    candles[5].low = -1;
    const res = validateCandles(candles, 30);
    expect(res.ok).toBe(false);
  });

  it("rejects negative volume", () => {
    const candles = makeCandles(40);
    candles[5].volume = -100;
    const res = validateCandles(candles, 30);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/volume/);
  });

  it("rejects a stale latest candle", () => {
    // Build 40 old daily candles ending well in the past.
    const old = Date.UTC(2020, 0, 1);
    const candles = makeCandles(40, { baseTime: old });
    const res = validateCandles(candles, 30, { maxAgeMs: 48 * 60 * 60 * 1000 });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/stale/);
  });

  it("accepts a fresh latest candle within the max age", () => {
    const now = Date.now();
    const candles = makeCandles(40, { baseTime: now - 39 * 86400000 });
    // ensure the last candle is 'now'
    candles[candles.length - 1].time = new Date(now);
    const res = validateCandles(candles, 30, { maxAgeMs: 48 * 60 * 60 * 1000 });
    expect(res.ok).toBe(true);
  });
});
