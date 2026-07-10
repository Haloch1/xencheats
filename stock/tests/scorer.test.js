// stock/tests/scorer.test.js
import { describe, it, expect } from "vitest";
import {
  scoreSignal,
  confidenceLabel,
  evaluateConfirmations,
  SCORE_WEIGHTS
} from "../analysis/scorer.js";
import { bullishDaily } from "./fixtures.js";

describe("scoreSignal", () => {
  it("produces a score within 0-100 and a breakdown that never exceeds the weights", () => {
    const out = scoreSignal({
      daily: bullishDaily(),
      h4: { ok: true, trend: "bullish" },
      h1: { ok: true, trend: "bullish" },
      risk: { riskReward: 2.4 }
    });
    expect(out.score).toBeGreaterThanOrEqual(0);
    expect(out.score).toBeLessThanOrEqual(100);
    for (const key of Object.keys(SCORE_WEIGHTS)) {
      expect(out.breakdown[key]).toBeLessThanOrEqual(SCORE_WEIGHTS[key]);
      expect(out.breakdown[key]).toBeGreaterThanOrEqual(0);
    }
  });

  it("score equals the sum of the breakdown when no market penalty is applied", () => {
    const out = scoreSignal({
      daily: bullishDaily(),
      h4: { ok: true, trend: "bullish" },
      h1: { ok: true, trend: "bullish" },
      risk: { riskReward: 2.4 }
    });
    const sum =
      out.breakdown.longTerm +
      out.breakdown.medium +
      out.breakdown.momentum +
      out.breakdown.volume +
      out.breakdown.entry +
      out.breakdown.risk;
    expect(out.score).toBe(sum);
  });

  it("a strong bullish setup scores high", () => {
    const out = scoreSignal({
      daily: bullishDaily(),
      h4: { ok: true, trend: "bullish" },
      h1: { ok: true, trend: "bullish" },
      risk: { riskReward: 2.4 }
    });
    expect(out.score).toBeGreaterThanOrEqual(70);
  });

  it("applies the market penalty without going negative", () => {
    const out = scoreSignal({
      daily: bullishDaily(),
      market: { scorePenalty: 15, note: "SPY is below its 50-day moving average" }
    });
    expect(out.score).toBeGreaterThanOrEqual(0);
    expect(out.warnings.some((w) => /Broad-market caution/.test(w))).toBe(true);
  });

  it("never uses non-compliant wording in reasons/warnings", () => {
    const out = scoreSignal({ daily: bullishDaily(), risk: { riskReward: 3 } });
    const text = [...out.reasons, ...out.warnings].join(" ").toLowerCase();
    expect(text).not.toContain("guaranteed");
    expect(text).not.toContain("risk-free");
    expect(text).not.toContain("guaranteed profit");
  });

  it("handles missing daily data safely", () => {
    const out = scoreSignal({ daily: { ok: false, reason: "short" } });
    expect(out.score).toBe(0);
    expect(out.breakdown.longTerm).toBe(0);
  });
});

describe("confidenceLabel", () => {
  it("maps scores to labels at the boundaries", () => {
    expect(confidenceLabel(95)).toBe("Very high");
    expect(confidenceLabel(90)).toBe("Very high");
    expect(confidenceLabel(89)).toBe("High");
    expect(confidenceLabel(80)).toBe("High");
    expect(confidenceLabel(79)).toBe("Moderate");
    expect(confidenceLabel(70)).toBe("Moderate");
    expect(confidenceLabel(69)).toBe("Low");
    expect(confidenceLabel(0)).toBe("Low");
  });
});

describe("evaluateConfirmations", () => {
  const good = {
    score: 88,
    minScore: 80,
    daily: { trend: "bullish" },
    momentumOk: true,
    volumeOrPriceActionOk: true,
    extended: false,
    dataCurrent: true,
    riskReward: 2.0,
    minRiskReward: 1.5,
    cooldownActive: false
  };

  it("qualifies when every confirmation passes", () => {
    const out = evaluateConfirmations(good);
    expect(out.qualifies).toBe(true);
  });

  it("does not qualify when a cooldown is active", () => {
    const out = evaluateConfirmations({ ...good, cooldownActive: true });
    expect(out.qualifies).toBe(false);
    expect(out.reasons.some((r) => /cooldown/i.test(r))).toBe(true);
  });

  it("does not qualify when below the minimum score", () => {
    const out = evaluateConfirmations({ ...good, score: 70 });
    expect(out.qualifies).toBe(false);
  });

  it("does not qualify with a bearish daily trend", () => {
    const out = evaluateConfirmations({ ...good, daily: { trend: "bearish" } });
    expect(out.qualifies).toBe(false);
  });

  it("does not qualify when risk-reward is below the minimum", () => {
    const out = evaluateConfirmations({ ...good, riskReward: 1.0 });
    expect(out.qualifies).toBe(false);
  });

  it("does not qualify when data is stale", () => {
    const out = evaluateConfirmations({ ...good, dataCurrent: false });
    expect(out.qualifies).toBe(false);
  });
});
