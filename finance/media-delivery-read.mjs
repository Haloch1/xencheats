/** Poll only the read endpoint of an already accepted order. Never place a
 * second order while the first key is still being prepared. */
export async function pollMediaDeliveryKey(readKey, { attempts = 3, delayMs = 1500, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt) await wait(delayMs);
    const key = await readKey();
    if (key) return key;
  }
  return null;
}
