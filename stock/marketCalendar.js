// stock/marketCalendar.js
// US equity market session helpers in America/New_York, with NO external deps.
// DST is handled automatically because all wall-clock reasoning goes through
// Intl.DateTimeFormat with timeZone "America/New_York".
//
// IMPORTANT: the holiday list below is hardcoded for 2025 and 2026 only.
// Extend US_MARKET_HOLIDAYS with observed dates for future years as needed.

const TZ = "America/New_York";

// Observed NYSE/Nasdaq holiday dates (already adjusted for weekend "observed" rules).
// New Year's, MLK, Presidents', Good Friday, Memorial, Juneteenth, Independence,
// Labor, Thanksgiving, Christmas.
const US_MARKET_HOLIDAYS = new Set([
  // 2025
  "2025-01-01", // New Year's Day
  "2025-01-20", // Martin Luther King Jr. Day
  "2025-02-17", // Presidents' Day
  "2025-04-18", // Good Friday
  "2025-05-26", // Memorial Day
  "2025-06-19", // Juneteenth
  "2025-07-04", // Independence Day
  "2025-09-01", // Labor Day
  "2025-11-27", // Thanksgiving
  "2025-12-25", // Christmas
  // 2026
  "2026-01-01", // New Year's Day
  "2026-01-19", // Martin Luther King Jr. Day
  "2026-02-16", // Presidents' Day
  "2026-04-03", // Good Friday
  "2026-05-25", // Memorial Day
  "2026-06-19", // Juneteenth
  "2026-07-03", // Independence Day observed (Jul 4 falls on Saturday)
  "2026-09-07", // Labor Day
  "2026-11-26", // Thanksgiving
  "2026-12-25" // Christmas
  // TODO: add 2027+ observed holiday dates before then.
]);

const WEEKDAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);

// Extract ET wall-clock fields for an instant.
function etParts(date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short"
  });
  const map = {};
  for (const p of fmt.formatToParts(date)) map[p.type] = p.value;
  let hour = Number(map.hour);
  if (hour === 24) hour = 0; // some environments emit "24" for midnight
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    weekday: map.weekday
  };
}

const pad = (n) => String(n).padStart(2, "0");
const dateKey = (p) => `${p.year}-${pad(p.month)}-${pad(p.day)}`;

// Convert an ET wall-clock (y, mo, d, h, mi) into the corresponding UTC Date instant.
function etWallClockToUtc(y, mo, d, h, mi) {
  const desiredAsUTC = Date.UTC(y, mo - 1, d, h, mi, 0);
  const et = etParts(new Date(desiredAsUTC));
  const etAsUTC = Date.UTC(et.year, et.month - 1, et.day, et.hour, et.minute, 0);
  const offset = desiredAsUTC - etAsUTC;
  return new Date(desiredAsUTC + offset);
}

/**
 * True when `date` is a hardcoded US market holiday (ET calendar day).
 */
export function isMarketHoliday(date = new Date()) {
  try {
    const p = etParts(date instanceof Date ? date : new Date(date));
    return US_MARKET_HOLIDAYS.has(dateKey(p));
  } catch (err) {
    console.error("[Stock] isMarketHoliday failed:", err.message);
    return false;
  }
}

/**
 * True when the US regular session is open: Mon-Fri, 09:30-16:00 ET, excluding holidays.
 */
export function isRegularMarketOpen(date = new Date()) {
  try {
    const p = etParts(date instanceof Date ? date : new Date(date));
    if (!WEEKDAYS.has(p.weekday)) return false;
    if (US_MARKET_HOLIDAYS.has(dateKey(p))) return false;
    const minutes = p.hour * 60 + p.minute;
    return minutes >= 570 && minutes < 960; // 09:30 (570) .. 16:00 (960)
  } catch (err) {
    console.error("[Stock] isRegularMarketOpen failed:", err.message);
    return false;
  }
}

/**
 * The next 09:30 ET regular-session open at or after `date`.
 * If `date` is a trading day before 09:30 ET, returns today's open; otherwise the
 * next trading day's open. Returns a Date (or null if none found within a year).
 */
export function nextMarketOpen(date = new Date()) {
  try {
    const base = date instanceof Date ? date : new Date(date);
    const cur = etParts(base);
    const minutes = cur.hour * 60 + cur.minute;
    const isTradingToday = WEEKDAYS.has(cur.weekday) && !US_MARKET_HOLIDAYS.has(dateKey(cur));
    if (isTradingToday && minutes < 570) {
      return etWallClockToUtc(cur.year, cur.month, cur.day, 9, 30);
    }
    let probe = base;
    for (let i = 0; i < 400; i++) {
      probe = new Date(probe.getTime() + 24 * 60 * 60 * 1000);
      const p = etParts(probe);
      if (WEEKDAYS.has(p.weekday) && !US_MARKET_HOLIDAYS.has(dateKey(p))) {
        return etWallClockToUtc(p.year, p.month, p.day, 9, 30);
      }
    }
    return null;
  } catch (err) {
    console.error("[Stock] nextMarketOpen failed:", err.message);
    return null;
  }
}
