// stock/tests/priceStructure.test.js
import { describe, it, expect } from "vitest";
import {
  findSwings,
  supportResistance,
  trendStructure
} from "../analysis/priceStructure.js";
import { uptrendCandles, downtrendCandles } from "./fixtures.js";

describe("findSwings", () => {
  it("identifies a swing high and swing low around a peak/trough", () => {
    // Build a small V then inverted-V pattern.
    const closes = [10, 11, 12, 13, 12, 11, 10, 11, 12, 13, 14, 13, 12, 11, 10];
    const candles = closes.map((c, i) => ({
      time: new Date(Date.UTC(2025, 0, 1) + i * 86400000),
      open: c,
      high: c + 0.5,
      low: c - 0.5,
      close: c,
      volume: 1000
    }));
    const { swingHighs, swingLows } = findSwings(candles, 3);
    expect(Array.isArray(swingHighs)).toBe(true);
    expect(Array.isArray(swingLows)).toBe(true);
    expect(swingHighs.length + swingLows.length).toBeGreaterThan(0);
  });
});

describe("supportResistance", () => {
  it("returns support below and resistance at/above recent price in an uptrend", () => {
    const candles = uptrendCandles(120);
    const sr = supportResistance(candles);
    const price = candles[candles.length - 1].close;
    expect(sr.support).not.toBeNull();
    expect(sr.resistance).not.toBeNull();
    expect(sr.support).toBeLessThanOrEqual(price);
    expect(sr.resistance).toBeGreaterThanOrEqual(price - 2);
  });
  it("handles empty input gracefully", () => {
    expect(supportResistance([])).toEqual({
      support: null,
      resistance: null,
      recentSwingHigh: null,
      recentSwingLow: null
    });
  });
});

describe("trendStructure", () => {
  it("labels a rising series as an uptrend", () => {
    const t = trendStructure(uptrendCandles(120));
    expect(t.label).toBe("uptrend");
    expect(t.higherHighs).toBe(true);
    expect(t.higherLows).toBe(true);
  });
  it("labels a falling series as a downtrend", () => {
    const t = trendStructure(downtrendCandles(120));
    expect(t.label).toBe("downtrend");
  });
});
