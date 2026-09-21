import assert from "node:assert/strict";
import {
  COINBASE_READ_SCOPES,
  COINBASE_SEND_SCOPE,
  buildCoinbaseAuthorizationUrl,
  createCoinbaseReadOnlyClient,
  createPkcePair,
  encryptCoinbaseToken,
  decryptCoinbaseToken,
  runCoinbaseCapabilityCheck,
  readCoinbaseUsdcBalance,
  assertCoinbaseSendEnabled,
} from "../finance/coinbase-integration.mjs";

const pkce = createPkcePair(() => Buffer.alloc(48, 7));
assert.equal(pkce.verifier.length > 40, true);
assert.equal(pkce.challenge.length > 20, true);

const authorizationUrl = buildCoinbaseAuthorizationUrl({
  clientId: "client_demo",
  redirectUri: "https://xencheats.wtf/api/admin/finance/oauth/callback",
  state: "state_demo_12345678",
  codeChallenge: pkce.challenge,
});
const parsedAuth = new URL(authorizationUrl);
assert.equal(parsedAuth.origin, "https://login.coinbase.com");
assert.equal(parsedAuth.searchParams.get("redirect_uri"), "https://xencheats.wtf/api/admin/finance/oauth/callback");
assert.equal(parsedAuth.searchParams.get("scope"), COINBASE_READ_SCOPES.join(","));
assert.equal(parsedAuth.searchParams.get("scope").includes(COINBASE_SEND_SCOPE), false);

const requests = [];
const client = createCoinbaseReadOnlyClient({
  accessToken: "access_demo",
  apiBaseUrl: "https://api.coinbase.com/v2",
  fetchImpl: async (url, options) => {
    requests.push({ url: String(url), options });
    const path = new URL(url).pathname;
    const payload = path.endsWith("/user")
      ? { data: { id: "user_demo" } }
      : path.endsWith("/accounts")
        ? { data: [{ id: "account_usdc", currency: "USDC", balance: { amount: "12.34", currency: "USDC" } }] }
        : { data: [{ id: "tx_demo", status: "completed", amount: { amount: "1.00", currency: "USDC" }, created_at: "2026-09-20T00:00:00Z" }] };
    return { ok: true, status: 200, json: async () => payload };
  },
});
const report = await runCoinbaseCapabilityCheck({
  accessToken: "access_demo",
  tokenScope: COINBASE_READ_SCOPES,
  client,
});
assert.equal(report.connection, "CONNECTED");
assert.equal(report.accountsRead, true);
assert.equal(report.usdcAccountFound, true);
assert.equal(report.usdcAvailable, "12.34");
assert.equal(report.transactionsRead, true);
assert.equal(report.programmaticExternalSends, "YES (requires separate send authorization)");
assert.equal(report.baseNetworkSupported, "NEEDS LIVE AUTHORIZATION CHECK");
assert.equal(report.sendPermissionStatus, "NOT ENABLED");
assert.equal(requests.every(({ options }) => options.headers.authorization === "Bearer access_demo"), true);

const balance = await readCoinbaseUsdcBalance({ accessToken: "access_demo", client });
assert.equal(balance.connection, "CONNECTED");
assert.equal(balance.usdcAvailableCents, 1234);
assert.equal(balance.usdcAccounts.length, 1);

const ciphertext = encryptCoinbaseToken("secret-token", "test-encryption-key");
assert.equal(decryptCoinbaseToken(ciphertext, "test-encryption-key"), "secret-token");
assert.notEqual(ciphertext, "secret-token");

assert.throws(() => assertCoinbaseSendEnabled({ sendEnabled: "false", liveExecutionEnabled: "true" }), /COINBASE_SEND_DISABLED/);
assert.throws(() => assertCoinbaseSendEnabled({ sendEnabled: "true", liveExecutionEnabled: "false" }), /COINBASE_SEND_DISABLED/);

console.log("coinbase-integration.test.mjs: all assertions passed");
