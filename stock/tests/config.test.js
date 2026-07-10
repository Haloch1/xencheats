// stock/tests/config.test.js
import { describe, it, expect } from "vitest";
import { getStockConfig } from "../config.js";

describe("getStockConfig", () => {
  it("returns documented defaults on an empty env", () => {
    const c = getStockConfig({});
    expect(c.alertChannelId).toBe("1525096741387505796");
    expect(c.alertsEnabled).toBe(true);
    expect(c.scanIntervalMinutes).toBe(15);
    expect(c.signalMinScore).toBe(80);
    expect(c.alertCooldownHours).toBe(24);
    expect(c.minRiskReward).toBe(1.5);
    expect(c.relVolThreshold).toBe(1.2);
    expect(c.earningsBlockDays).toBe(3);
    expect(c.includePremarket).toBe(false);
    expect(c.includeAfterhours).toBe(false);
    expect(c.rescoreDelta).toBe(8);
  });

  it("coerces types and clamps ranges", () => {
    const c = getStockConfig({
      STOCK_ALERTS_ENABLED: "false",
      STOCK_SIGNAL_MIN_SCORE: "250", // clamps to 100
      STOCK_SCAN_INTERVAL_MINUTES: "0", // clamps to min 1
      STOCK_MIN_RISK_REWARD: "2.5",
      STOCK_INCLUDE_PREMARKET: "yes"
    });
    expect(c.alertsEnabled).toBe(false);
    expect(c.signalMinScore).toBe(100);
    expect(c.scanIntervalMinutes).toBe(1);
    expect(c.minRiskReward).toBe(2.5);
    expect(c.includePremarket).toBe(true);
  });
});
