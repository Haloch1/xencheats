import test from "node:test";
import assert from "node:assert/strict";
import { discordSnowflakeCreatedAt, riskScoreForMember, toOhlc } from "./discord-analytics.js";

test("Discord snowflake creation time is decoded deterministically", () => {
  assert.equal(discordSnowflakeCreatedAt("175928847299117063").toISOString(), "2016-04-30T11:18:25.796Z");
  assert.equal(discordSnowflakeCreatedAt("not-a-snowflake"), null);
});

test("review scoring is bounded and prioritizes multiple transparent signals", () => {
  const low = riskScoreForMember({ accountAgeDays: 365, avatarPresent: true, joinedRecently: false, quicklyLeft: false, activationCount: 2 });
  const high = riskScoreForMember({ accountAgeDays: 0.2, avatarPresent: false, joinedRecently: true, quicklyLeft: true, activationCount: 0 });
  assert.equal(low, 0);
  assert.equal(high, 96);
  assert.ok(high <= 100);
});

test("OHLC conversion keeps the previous close as the next open", () => {
  assert.deepEqual(toOhlc([{ time: "2026-01-01", value: 10 }, { time: "2026-01-02", value: 7 }]), [
    { time: "2026-01-01", open: 0, high: 10, low: 0, close: 10 },
    { time: "2026-01-02", open: 10, high: 10, low: 7, close: 7 },
  ]);
});
