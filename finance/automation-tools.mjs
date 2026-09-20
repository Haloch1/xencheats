/* Deterministic finance tool contracts for the automation/chat layer.
 * The adapter never invents numbers; callers inject server readers that
 * already use the finance engine and persisted records as their source. */

export const FINANCE_TOOL_NAMES = Object.freeze([
  "get_business_status",
  "get_safe_to_reinvest",
  "get_cheatslove_status",
  "get_stripe_status",
  "get_profit_summary",
  "get_reinvestment_batches",
  "get_reinvestment_batch",
  "get_recent_activity",
  "get_automation_status",
  "prepare_reinvestment",
  "pause_automation",
  "resume_automation",
]);

export function createFinanceAutomationTools(readers = {}) {
  const required = (name) => {
    if (typeof readers[name] !== "function") throw new Error(`Finance reader ${name} is not configured.`);
    return readers[name];
  };
  const wrap = (name) => async (args = {}) => {
    const value = await required(name)(args);
    return value === undefined ? { available: false, reason: `No value returned by ${name}.` } : value;
  };
  return {
    get_business_status: wrap("get_business_status"),
    get_safe_to_reinvest: wrap("get_safe_to_reinvest"),
    get_cheatslove_status: wrap("get_cheatslove_status"),
    get_stripe_status: wrap("get_stripe_status"),
    get_profit_summary: wrap("get_profit_summary"),
    get_reinvestment_batches: wrap("get_reinvestment_batches"),
    get_reinvestment_batch: wrap("get_reinvestment_batch"),
    get_recent_activity: wrap("get_recent_activity"),
    get_automation_status: wrap("get_automation_status"),
    prepare_reinvestment: wrap("prepare_reinvestment"),
    pause_automation: wrap("pause_automation"),
    resume_automation: wrap("resume_automation"),
  };
}

