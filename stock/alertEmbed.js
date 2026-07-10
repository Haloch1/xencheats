// stock/alertEmbed.js
// Build discord.js-compatible plain embed objects for stock buy-signal alerts.
//
// COMPLIANCE: every alert embed carries a disclaimer, uses cautious wording, and
// never promises profit or claims a price will rise.

import { confidenceLabel } from "./analysis/scorer.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

export const DISCLAIMER =
  "This is an automated market signal, not personalized financial advice. Markets involve risk, and this signal may be wrong.";

const GREEN = 0x2ecc71;

function fmtNum(v, digits = 2) {
  return isNum(v) ? v.toFixed(digits) : "N/A";
}

function fmtMoney(v, currency) {
  if (!isNum(v)) return "N/A";
  const sym = currency === "USD" || !currency ? "$" : "";
  const suffix = currency && currency !== "USD" ? ` ${currency}` : "";
  return `${sym}${v.toFixed(2)}${suffix}`;
}

// Format an instant in America/Chicago (the operator's local time).
function formatChicago(date) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short"
    }).format(d);
  } catch {
    return new Date().toISOString();
  }
}

function tfLabel(tf) {
  if (!tf) return "n/a";
  if (typeof tf === "string") return tf;
  if (typeof tf === "object") {
    if (tf.ok === false) return "insufficient data";
    if (typeof tf.trend === "string") return tf.trend;
    if (typeof tf.label === "string") return tf.label;
  }
  return "n/a";
}

// Discord field values cap at 1024 chars.
function truncate(text, max = 1024) {
  if (typeof text !== "string") return "N/A";
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

/**
 * Build an alert embed from a signal object. The signal is read defensively so a
 * partial object still yields a valid embed.
 * Expected (all optional) fields: ticker, company/companyName, price, currency,
 *   score, confidence, entry:{low,high}, support, invalidation, resistance,
 *   riskReward, reasons:[], warnings:[], timeframes:{daily,h4,h1}, generatedAt:Date.
 */
export function buildAlertEmbed(signal = {}) {
  try {
    const s = signal || {};
    const ticker = s.ticker || "N/A";
    const company = s.company || s.companyName || "Unknown company";
    const score = isNum(s.score) ? Math.round(s.score) : null;
    const confidence = s.confidence || (score !== null ? confidenceLabel(score) : "N/A");
    const entry = s.entry || {};
    const entryZone =
      isNum(entry.low) && isNum(entry.high)
        ? `${fmtNum(entry.low)} - ${fmtNum(entry.high)}`
        : "N/A";
    const generatedAt = s.generatedAt instanceof Date ? s.generatedAt : new Date();

    const fields = [
      { name: "Ticker", value: `**${ticker}**`, inline: true },
      { name: "Company", value: String(company), inline: true },
      { name: "Signal Score", value: score !== null ? `${score}/100` : "N/A", inline: true },
      { name: "Confidence", value: String(confidence), inline: true },
      { name: "Current Price", value: fmtMoney(s.price, s.currency), inline: true },
      { name: "Entry Zone", value: entryZone, inline: true },
      { name: "Support", value: fmtNum(s.support), inline: true },
      { name: "Invalidation", value: fmtNum(s.invalidation), inline: true },
      { name: "Resistance", value: fmtNum(s.resistance), inline: true },
      {
        name: "Risk / Reward",
        value: isNum(s.riskReward) ? `${s.riskReward.toFixed(2)} : 1` : "N/A",
        inline: true
      }
    ];

    const reasons =
      Array.isArray(s.reasons) && s.reasons.length
        ? s.reasons.map((r) => `- ${r}`).join("\n")
        : "Strong bullish setup detected based on the configured strategy.";
    fields.push({ name: "Why this signal was generated", value: truncate(reasons), inline: false });

    const warnings =
      Array.isArray(s.warnings) && s.warnings.length
        ? s.warnings.map((w) => `- ${w}`).join("\n")
        : "- No specific risks were flagged, but every trade carries risk.";
    fields.push({ name: "Possible risks", value: truncate(warnings), inline: false });

    const tf = s.timeframes || {};
    fields.push({
      name: "Timeframes",
      value: `Daily: ${tfLabel(tf.daily)}\n4h: ${tfLabel(tf.h4)}\n1h: ${tfLabel(tf.h1)}`,
      inline: false
    });

    fields.push({ name: "Signal generated", value: formatChicago(generatedAt), inline: false });
    fields.push({ name: "Disclaimer", value: DISCLAIMER, inline: false });

    return {
      title: "Potential Stock Buying Opportunity",
      description: `A high-confidence signal based on the configured strategy was detected for **${ticker}**. This is a potential buying opportunity, not a recommendation to buy.`,
      color: GREEN,
      fields,
      footer: { text: DISCLAIMER },
      timestamp: generatedAt.toISOString()
    };
  } catch (err) {
    console.error("[Stock] buildAlertEmbed failed:", err.message);
    return {
      title: "Potential Stock Buying Opportunity",
      description: "Signal details are temporarily unavailable.",
      color: GREEN,
      fields: [],
      footer: { text: DISCLAIMER }
    };
  }
}

/**
 * Build a clearly-labeled SAMPLE embed with fake NVDA-style data, for testing wiring.
 */
export function buildTestAlertEmbed() {
  const sample = {
    ticker: "NVDA",
    company: "NVIDIA Corporation (SAMPLE DATA)",
    price: 128.45,
    currency: "USD",
    score: 87,
    confidence: "High",
    entry: { low: 126.1, high: 130.8 },
    support: 121.5,
    invalidation: 119.75,
    resistance: 138.0,
    riskReward: 2.1,
    reasons: [
      "Price is trading above its long-term (200-day) average.",
      "A bullish MACD crossover was detected.",
      "Above-average volume accompanied the recent up move.",
      "A healthy pullback within the uptrend was detected."
    ],
    warnings: [
      "RSI is approaching elevated levels.",
      "This is sample data for testing only."
    ],
    timeframes: { daily: "bullish", h4: "bullish", h1: "neutral" },
    generatedAt: new Date()
  };
  const embed = buildAlertEmbed(sample);
  embed.title = "[TEST] Potential Stock Buying Opportunity";
  embed.description =
    "SAMPLE alert using fake NVDA data for testing only. " + embed.description;
  return embed;
}

export default { buildAlertEmbed, buildTestAlertEmbed, DISCLAIMER };
