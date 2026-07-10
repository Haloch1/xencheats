// stock/config.js
// Read STOCK_* environment variables into a typed, clamped config object.

const parseBool = (v, dflt) => {
  if (v === undefined || v === null || v === "") return dflt;
  const s = String(v).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(s)) return true;
  if (["false", "0", "no", "off"].includes(s)) return false;
  return dflt;
};

const parseNum = (v, dflt, { min = -Infinity, max = Infinity, int = false } = {}) => {
  if (v === undefined || v === null || v === "") return dflt;
  let n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  if (int) n = Math.round(n);
  return Math.min(max, Math.max(min, n));
};

/**
 * Build the stock feature config from environment variables (defaults documented inline).
 * @param {object} [env] defaults to process.env
 */
export function getStockConfig(env = process.env) {
  return {
    // Discord channel where alerts are posted.
    alertChannelId: env.STOCK_ALERT_CHANNEL_ID || "1525096741387505796",
    // Master on/off switch for alerting.
    alertsEnabled: parseBool(env.STOCK_ALERTS_ENABLED, true),
    // Minutes between scans.
    scanIntervalMinutes: parseNum(env.STOCK_SCAN_INTERVAL_MINUTES, 15, { min: 1, max: 1440, int: true }),
    // Minimum 0-100 score required to emit a signal.
    signalMinScore: parseNum(env.STOCK_SIGNAL_MIN_SCORE, 80, { min: 0, max: 100, int: true }),
    // Hours to suppress re-alerting the same ticker.
    alertCooldownHours: parseNum(env.STOCK_ALERT_COOLDOWN_HOURS, 24, { min: 0, max: 24 * 30 }),
    // Minimum acceptable risk-reward ratio.
    minRiskReward: parseNum(env.STOCK_MIN_RISK_REWARD, 1.5, { min: 0, max: 100 }),
    // Relative-volume threshold used in scoring.
    relVolThreshold: parseNum(env.STOCK_RELVOL_THRESHOLD, 1.2, { min: 0, max: 100 }),
    // Days around earnings during which signals are blocked.
    earningsBlockDays: parseNum(env.STOCK_EARNINGS_BLOCK_DAYS, 3, { min: 0, max: 60, int: true }),
    // Whether to consider pre-market / after-hours data.
    includePremarket: parseBool(env.STOCK_INCLUDE_PREMARKET, false),
    includeAfterhours: parseBool(env.STOCK_INCLUDE_AFTERHOURS, false),
    // Score change required to re-alert within a cooldown window.
    rescoreDelta: parseNum(env.STOCK_RESCORE_DELTA, 8, { min: 0, max: 100 })
  };
}

export default { getStockConfig };
