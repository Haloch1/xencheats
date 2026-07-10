// stock/tests/indicators.test.js
import { describe, it, expect } from "vitest";
import {
  ema,
  sma,
  rsi,
  macd,
  atr,
  bollinger,
  roc,
  obv,
  averageVolume,
  relativeVolume
} from "../indicators/index.js";
import { RSI_CLOSES, candlesFromCloses, candleFromClose } from "./fixtures.js";

describe("sma", () => {
  it("computes a simple moving average with leading nulls", () => {
    const out = sma([1, 2, 3, 4, 5], 3);
    expect(out).toEqual([null, null, 2, 3, 4]);
  });
  it("returns null-filled array for short input", () => {
    expect(sma([1, 2], 5)).toEqual([null, null]);
  });
});

describe("ema", () => {
  it("seeds with the SMA and applies the multiplier", () => {
    const out = ema([1, 2, 3, 4, 5], 3);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]).toBeCloseTo(2, 10);
    expect(out[3]).toBeCloseTo(3, 10);
    expect(out[4]).toBeCloseTo(4, 10);
  });
  it("guards against NaN input", () => {
    expect(ema([1, NaN, 3], 3)).toEqual([null, null, null]);
  });
});

describe("rsi", () => {
  it("matches Wilder's classic example (~70.46)", () => {
    const out = rsi(RSI_CLOSES, 14);
    expect(out.length).toBe(RSI_CLOSES.length);
    // first defined value is at index `period`
    expect(out[13]).toBeNull();
    expect(out[14]).toBeCloseTo(70.46, 1);
  });
  it("returns null-filled array when too short", () => {
    expect(rsi([1, 2, 3], 14).every((v) => v === null)).toBe(true);
  });
});

describe("macd", () => {
  it("returns aligned arrays for macd/signal/histogram", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3) * 5 + i * 0.2);
    const out = macd(closes);
    expect(out.macd.length).toBe(closes.length);
    expect(out.signal.length).toBe(closes.length);
    expect(out.histogram.length).toBe(closes.length);
    const last = closes.length - 1;
    // histogram = macd - signal where both defined
    expect(out.histogram[last]).toBeCloseTo(out.macd[last] - out.signal[last], 8);
  });
  it("returns empty (null) arrays when shorter than the slow period", () => {
    const out = macd([1, 2, 3], 12, 26, 9);
    expect(out.macd.every((v) => v === null)).toBe(true);
  });
});

describe("atr", () => {
  it("computes a constant ATR for a constant true range", () => {
    // Flat closes at 100 -> high 101, low 99, prevClose 100 -> TR = 2 everywhere.
    const candles = Array.from({ length: 30 }, (_, i) => candleFromClose(100, i));
    const out = atr(candles, 14);
    expect(out.length).toBe(30);
    expect(out[13]).toBeNull();
    expect(out[14]).toBeCloseTo(2, 6);
    expect(out[29]).toBeCloseTo(2, 6);
  });
});

describe("bollinger", () => {
  it("collapses to the middle band when volatility is zero", () => {
    const closes = new Array(25).fill(50);
    const out = bollinger(closes, 20, 2);
    const last = 24;
    expect(out.middle[last]).toBeCloseTo(50, 8);
    expect(out.upper[last]).toBeCloseTo(50, 8);
    expect(out.lower[last]).toBeCloseTo(50, 8);
  });
  it("widens with volatility (upper > middle > lower)", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 50 + (i % 2 === 0 ? 3 : -3));
    const out = bollinger(closes, 20, 2);
    const last = 29;
    expect(out.upper[last]).toBeGreaterThan(out.middle[last]);
    expect(out.middle[last]).toBeGreaterThan(out.lower[last]);
  });
});

describe("roc", () => {
  it("computes percentage rate of change", () => {
    const closes = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    const out = roc(closes, 12);
    // (22 - 10) / 10 * 100 = 120
    expect(out[12]).toBeCloseTo(120, 6);
  });
});

describe("obv", () => {
  it("accumulates volume up on up-closes and down on down-closes", () => {
    const candles = [
      candleFromClose(10, 0, 100),
      candleFromClose(11, 1, 200), // up -> +200
      candleFromClose(10, 2, 150), // down -> -150
      candleFromClose(12, 3, 300) // up -> +300
    ];
    const out = obv(candles);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(200);
    expect(out[2]).toBe(50);
    expect(out[3]).toBe(350);
  });
});

describe("averageVolume / relativeVolume", () => {
  it("averageVolume is an SMA of volume", () => {
    const candles = candlesFromCloses(new Array(25).fill(100), 500);
    const out = averageVolume(candles, 20);
    expect(out[24]).toBeCloseTo(500, 6);
  });
  it("relativeVolume compares latest to the trailing average", () => {
    const candles = candlesFromCloses(new Array(25).fill(100), 500);
    // Make the latest bar double the usual volume.
    candles[candles.length - 1].volume = 1000;
    const rv = relativeVolume(candles, 20);
    expect(rv).toBeCloseTo(2, 6);
  });
  it("returns null when insufficient history", () => {
    const candles = candlesFromCloses(new Array(5).fill(100), 500);
    expect(relativeVolume(candles, 20)).toBeNull();
  });
});
