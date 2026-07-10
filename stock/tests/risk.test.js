// stock/tests/risk.test.js
import { describe, it, expect } from "vitest";
import { computeRisk } from "../analysis/risk.js";

describe("computeRisk", () => {
  it("computes an entry zone of price +/- 0.5*ATR", () => {
    const r = computeRisk({ price: 100, support: 96, resistance: 110, atr: 4 });
    expect(r.entryLow).toBeCloseTo(98, 6);
    expect(r.entryHigh).toBeCloseTo(102, 6);
  });

  it("places invalidation just below nearest support and computes risk-reward", () => {
    const r = computeRisk({ price: 100, support: 96, resistance: 112, atr: 4 });
    // invalidation = 96 - 0.25*4 = 95
    expect(r.invalidation).toBeCloseTo(95, 6);
    // upside = 112 - 100 = 12 ; downside = 100 - 95 = 5 ; RR = 2.4
    expect(r.upside).toBeCloseTo(12, 6);
    expect(r.downside).toBeCloseTo(5, 6);
    expect(r.riskReward).toBeCloseTo(2.4, 6);
  });

  it("falls back to price - 1.5*ATR when there is no valid support", () => {
    const r = computeRisk({ price: 100, support: null, resistance: 120, atr: 4 });
    // invalidation = 100 - 6 = 94 ; downside = 6 ; upside = 20 ; RR = 3.333...
    expect(r.invalidation).toBeCloseTo(94, 6);
    expect(r.riskReward).toBeCloseTo(20 / 6, 6);
  });

  it("uses price + 2*ATR as target when resistance is not above price", () => {
    const r = computeRisk({ price: 100, support: 96, resistance: 98, atr: 4 });
    // target = 100 + 8 = 108 ; upside = 8
    expect(r.upside).toBeCloseTo(8, 6);
  });

  it("rejects (riskReward null) when ATR is invalid", () => {
    const r = computeRisk({ price: 100, support: 96, resistance: 110, atr: 0 });
    expect(r.riskReward).toBeNull();
    expect(r.entryLow).toBeNull();
  });
});
