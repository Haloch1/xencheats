/* Small persistent worker loop used by the web process and the optional
 * standalone worker command. It serializes ticks so a slow provider request
 * can never overlap another finance decision. */

export function createFinanceWorker({
  intervalMs = 5 * 60_000,
  tick,
  logger = console,
} = {}) {
  if (typeof tick !== "function") throw new TypeError("finance worker requires a tick function");
  let timer = null;
  let running = false;
  let tickPromise = null;

  const runOnce = async () => {
    if (tickPromise) return tickPromise;
    tickPromise = (async () => {
      try {
        return await tick();
      } catch (error) {
        logger.error?.("[Finance worker] Tick failed:", error?.stack || error?.message || error);
        return { ok: false, error: error?.message || String(error) };
      } finally {
        tickPromise = null;
      }
    })();
    return tickPromise;
  };

  const start = ({ runImmediately = true } = {}) => {
    if (running) return false;
    running = true;
    const delay = Math.max(30_000, Number(intervalMs) || 5 * 60_000);
    if (runImmediately) void runOnce();
    timer = setInterval(() => { void runOnce(); }, delay);
    timer.unref?.();
    return true;
  };

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
    running = false;
  };

  return {
    start,
    stop,
    runOnce,
    isRunning: () => running,
    isTicking: () => Boolean(tickPromise),
  };
}

