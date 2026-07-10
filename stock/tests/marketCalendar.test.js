// stock/tests/marketCalendar.test.js
import { describe, it, expect } from "vitest";
import {
  isRegularMarketOpen,
  isMarketHoliday,
  nextMarketOpen
} from "../marketCalendar.js";

// Helper: an instant at a specific ET wall-clock time (works via UTC offset).
// These use fixed UTC instants chosen to fall inside the intended ET window.

describe("isMarketHoliday", () => {
  it("flags known 2025/2026 holidays", () => {
    // July 4, 2025 (noon UTC is still July 4 in ET)
    expect(isMarketHoliday(new Date("2025-07-04T16:00:00Z"))).toBe(true);
    // Christmas 2026
    expect(isMarketHoliday(new Date("2026-12-25T16:00:00Z"))).toBe(true);
    // Independence Day observed 2026 (July 3, since the 4th is Saturday)
    expect(isMarketHoliday(new Date("2026-07-03T16:00:00Z"))).toBe(true);
  });
  it("does not flag a normal trading day", () => {
    expect(isMarketHoliday(new Date("2025-07-07T16:00:00Z"))).toBe(false);
  });
});

describe("isRegularMarketOpen", () => {
  it("is open on a weekday mid-session", () => {
    // Wed 2025-07-09, 14:00 UTC = 10:00 ET (EDT, -4) -> open
    expect(isRegularMarketOpen(new Date("2025-07-09T14:00:00Z"))).toBe(true);
  });
  it("is closed before the open", () => {
    // 12:00 UTC = 08:00 ET -> before 09:30
    expect(isRegularMarketOpen(new Date("2025-07-09T12:00:00Z"))).toBe(false);
  });
  it("is closed after the close", () => {
    // 21:00 UTC = 17:00 ET -> after 16:00
    expect(isRegularMarketOpen(new Date("2025-07-09T21:00:00Z"))).toBe(false);
  });
  it("is closed on weekends", () => {
    // Saturday 2025-07-12
    expect(isRegularMarketOpen(new Date("2025-07-12T14:00:00Z"))).toBe(false);
  });
  it("is closed on holidays", () => {
    expect(isRegularMarketOpen(new Date("2025-07-04T14:00:00Z"))).toBe(false);
  });
});

describe("nextMarketOpen", () => {
  it("returns a future/next 09:30 ET instant", () => {
    // From Saturday 2025-07-12, next open is Monday 2025-07-14 09:30 ET (13:30 UTC in EDT)
    const next = nextMarketOpen(new Date("2025-07-12T14:00:00Z"));
    expect(next instanceof Date).toBe(true);
    expect(isRegularMarketOpen(next)).toBe(true);
  });
  it("returns today's open when called before 09:30 on a trading day", () => {
    // 12:00 UTC = 08:00 ET on Wed 2025-07-09 -> today's open at 13:30 UTC
    const next = nextMarketOpen(new Date("2025-07-09T12:00:00Z"));
    expect(next.getTime()).toBe(new Date("2025-07-09T13:30:00Z").getTime());
  });
});
