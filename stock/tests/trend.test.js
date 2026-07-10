// stock/tests/trend.test.js
import { describe, it, expect } from "vitest";
import { analyzeTimeframe } from "../analysis/trend.js";
import { scoreSignal } from "../analysis/scorer.js";
import { computeRisk } from "../analysis/risk.js";
import { supportResistance } from "../analysis/priceStructure.js";
import { uptrendCandles } from "./fixtures.js";

describe("analyzeTimeframe", () => {
  it("returns ok:false for short/invalid input", () => {
    expect(analyzeTimeframe([]).ok).toBe(false);
    expect(analyzeTimeframe(null).ok).toBe(false);
    expect(analyzeTimeframe(new Array(10).fill({ close: 1 })).ok).toBe(false);
  });

  it("analyzes a rising series as bullish above its long-term average", () => {
    const candles = uptrendCandles(220);
    const tf = analyzeTimeframe(candles);
    expect(tf.ok).toBe(true);
    expect(tf.trend).toBe("bullish");
    expect(tf.aboveSma200).toBe(true);
    expect(typeof tf.rsi).toBe("number");
    expect(typeof tf.atr).toBe("number");
  });

  it("feeds cleanly into risk + scoring with no network", () => {
    const candles = uptrendCandles(220);
    const daily = analyzeTimeframe(candles);
    const sr = supportResistance(candles);
    const risk = computeRisk({
      price: daily.price,
      support: sr.support,
      resistance: sr.resistance,
      atr: daily.atr
    });
    const out = scoreSignal({ daily, h4: daily, h1: daily, risk });
    expect(out.score).toBeGreaterThanOrEqual(0);
    expect(out.score).toBeLessThanOrEqual(100);
  });
});
