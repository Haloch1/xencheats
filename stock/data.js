// stock/data.js
// Supabase data layer for the stock feature.
//
// IMPORTANT: this module does NOT create a Supabase client. Every function takes an
// already-created client (the caller passes the project's supabaseAdmin) as the
// first argument. Every DB call is wrapped so a failure never throws to the caller.
//
// Tables (schema created separately):
//   stock_watchlist       (ticker PK, company_name, created_by, created_at)
//   stock_signals         (id PK, ticker, score, price, payload/jsonb, message_id, created_at)
//   stock_alert_settings  (single-row settings)

const TICKER_RE = /^[A-Z]{1,6}(\.[A-Z]{1,3})?$/;

// Sensible defaults returned by getSettings when the settings table is empty.
const DEFAULT_SETTINGS = Object.freeze({
  alerts_enabled: true,
  scan_interval_minutes: 15,
  signal_min_score: 80,
  alert_cooldown_hours: 24,
  min_risk_reward: 1.5,
  relvol_threshold: 1.2
});

/**
 * Strict ticker validation: 1-6 uppercase letters, optional ".XXX" suffix (e.g. BRK.B).
 */
export function isValidTicker(t) {
  return typeof t === "string" && TICKER_RE.test(t);
}

/**
 * Return all watchlist rows (ordered by ticker). Returns [] on error.
 */
export async function getWatchlist(supabase) {
  try {
    const { data, error } = await supabase
      .from("stock_watchlist")
      .select("*")
      .order("ticker", { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("[Stock] getWatchlist failed:", err.message);
    return [];
  }
}

/**
 * Add (or upsert) a ticker. Validates the symbol first.
 * Returns { ok:true, row } or { ok:false, error }.
 */
export async function addTicker(supabase, ticker, companyName = null, createdBy = null) {
  try {
    const symbol = String(ticker || "").trim().toUpperCase();
    if (!isValidTicker(symbol)) {
      return { ok: false, error: "invalid ticker (expected 1-6 uppercase letters, optional .XXX suffix)" };
    }
    const { data, error } = await supabase
      .from("stock_watchlist")
      .upsert(
        { ticker: symbol, company_name: companyName, created_by: createdBy },
        { onConflict: "ticker" }
      )
      .select()
      .maybeSingle();
    if (error) throw error;
    return { ok: true, row: data };
  } catch (err) {
    console.error("[Stock] addTicker failed:", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Remove a ticker from the watchlist. Returns { ok:boolean, error? }.
 */
export async function removeTicker(supabase, ticker) {
  try {
    const symbol = String(ticker || "").trim().toUpperCase();
    if (!isValidTicker(symbol)) return { ok: false, error: "invalid ticker" };
    const { error } = await supabase.from("stock_watchlist").delete().eq("ticker", symbol);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error("[Stock] removeTicker failed:", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Return the settings row, or sensible defaults when the table is empty. Never throws.
 */
export async function getSettings(supabase) {
  try {
    const { data, error } = await supabase
      .from("stock_alert_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || { ...DEFAULT_SETTINGS };
  } catch (err) {
    console.error("[Stock] getSettings failed:", err.message);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Patch the settings row (upsert on id=1). Returns { ok:boolean, row?, error? }.
 */
export async function updateSettings(supabase, patch = {}) {
  try {
    const { data, error } = await supabase
      .from("stock_alert_settings")
      .upsert({ id: 1, ...patch }, { onConflict: "id" })
      .select()
      .maybeSingle();
    if (error) throw error;
    return { ok: true, row: data };
  } catch (err) {
    console.error("[Stock] updateSettings failed:", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Insert a signal row. Returns { ok:boolean, row?, error? }.
 */
export async function recordSignal(supabase, signalRow = {}) {
  try {
    const { data, error } = await supabase
      .from("stock_signals")
      .insert(signalRow)
      .select()
      .maybeSingle();
    if (error) throw error;
    return { ok: true, row: data };
  } catch (err) {
    console.error("[Stock] recordSignal failed:", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Get the most recent signal for a ticker (used for cooldown checks). Returns row or null.
 */
export async function getRecentSignal(supabase, ticker) {
  try {
    const symbol = String(ticker || "").trim().toUpperCase();
    const { data, error } = await supabase
      .from("stock_signals")
      .select("*")
      .eq("ticker", symbol)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (err) {
    console.error("[Stock] getRecentSignal failed:", err.message);
    return null;
  }
}

/**
 * Persist the Discord message id for a stored signal. Returns { ok:boolean, error? }.
 */
export async function updateSignalMessageId(supabase, id, messageId) {
  try {
    const { error } = await supabase
      .from("stock_signals")
      .update({ message_id: messageId })
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error("[Stock] updateSignalMessageId failed:", err.message);
    return { ok: false, error: err.message };
  }
}
