import crypto from "node:crypto";

/**
 * Coinbase App OAuth + read-only capability checks.
 *
 * This module deliberately has no transfer implementation.  The only send
 * entry point throws COINBASE_SEND_DISABLED unless both explicit gates are
 * enabled, so a caller cannot accidentally create a transaction during a
 * capability check.
 */

export const COINBASE_OAUTH_AUTHORIZE_URL = "https://login.coinbase.com/oauth2/auth";
export const COINBASE_OAUTH_TOKEN_URL = "https://login.coinbase.com/oauth2/token";
export const COINBASE_API_BASE_URL = "https://api.coinbase.com/v2";
export const COINBASE_READ_SCOPES = Object.freeze([
  "wallet:user:read",
  "wallet:accounts:read",
  "wallet:transactions:read",
  "offline_access",
]);
export const COINBASE_SEND_SCOPE = "wallet:transactions:send";

const DEFAULT_CB_VERSION = "2022-01-06";
const BASE_NETWORK_RE = /\bbase(?:-mainnet)?\b/i;

function text(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function centsFromAmount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function safeErrorMessage(error) {
  return text(error?.message || error) || "Coinbase request failed.";
}

function normalizeScope(value) {
  return String(value || "")
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildCoinbaseAuthorizationUrl({
  clientId,
  redirectUri,
  state,
  scope = COINBASE_READ_SCOPES,
  account = "all",
  codeChallenge = "",
} = {}) {
  if (!clientId || !redirectUri || !state) throw new Error("Coinbase OAuth clientId, redirectUri, and state are required.");
  const url = new URL(COINBASE_OAUTH_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", Array.isArray(scope) ? scope.join(",") : String(scope));
  if (account) url.searchParams.set("account", account);
  if (codeChallenge) {
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}

export function createPkcePair(randomBytes = crypto.randomBytes) {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export async function exchangeCoinbaseAuthorizationCode({
  code,
  clientId,
  clientSecret,
  redirectUri,
  codeVerifier = "",
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!code || !clientId || !redirectUri) throw new Error("Coinbase OAuth code, clientId, and redirectUri are required.");
  if (typeof fetchImpl !== "function") throw new Error("Fetch is unavailable for Coinbase OAuth.");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
  });
  if (clientSecret) body.set("client_secret", clientSecret);
  if (codeVerifier) body.set("code_verifier", codeVerifier);
  const response = await fetchImpl(COINBASE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    const error = new Error(text(payload?.error_description || payload?.error || `Coinbase OAuth token exchange failed (${response.status}).`));
    error.status = response.status;
    throw error;
  }
  return {
    accessToken: String(payload.access_token),
    refreshToken: payload.refresh_token ? String(payload.refresh_token) : null,
    tokenType: payload.token_type ? String(payload.token_type) : "bearer",
    expiresIn: numberOrNull(payload.expires_in),
    scope: normalizeScope(payload.scope),
  };
}

export async function refreshCoinbaseAccessToken({
  refreshToken,
  clientId,
  clientSecret,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!refreshToken || !clientId) throw new Error("Coinbase refresh token and clientId are required.");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });
  if (clientSecret) body.set("client_secret", clientSecret);
  const response = await fetchImpl(COINBASE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    const error = new Error(text(payload?.error_description || payload?.error || `Coinbase OAuth refresh failed (${response.status}).`));
    error.status = response.status;
    throw error;
  }
  return {
    accessToken: String(payload.access_token),
    refreshToken: payload.refresh_token ? String(payload.refresh_token) : refreshToken,
    tokenType: payload.token_type ? String(payload.token_type) : "bearer",
    expiresIn: numberOrNull(payload.expires_in),
    scope: normalizeScope(payload.scope),
  };
}

export function createCoinbaseReadOnlyClient({
  accessToken,
  fetchImpl = globalThis.fetch,
  apiBaseUrl = COINBASE_API_BASE_URL,
  cbVersion = DEFAULT_CB_VERSION,
} = {}) {
  if (!accessToken) throw new Error("Coinbase access token is required.");
  if (typeof fetchImpl !== "function") throw new Error("Fetch is unavailable for Coinbase API.");
  const request = async (path, options = {}) => {
    const url = new URL(String(path).replace(/^\/+/, ""), `${String(apiBaseUrl).replace(/\/$/, "")}/`);
    const response = await fetchImpl(url, {
      ...options,
      headers: {
        accept: "application/json",
        "CB-VERSION": cbVersion,
        ...(options.headers || {}),
        authorization: `Bearer ${accessToken}`,
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(text(payload?.errors?.[0]?.message || payload?.error || payload?.message || `Coinbase API request failed (${response.status}).`));
      error.status = response.status;
      throw error;
    }
    return payload;
  };
  return Object.freeze({
    request,
    getUser: () => request("/user"),
    listAccounts: (query = "limit=100") => request(`/accounts?${query}`),
    getAccount: (accountId) => request(`/accounts/${encodeURIComponent(accountId)}`),
    listTransactions: (accountId, query = "limit=100") => request(`/accounts/${encodeURIComponent(accountId)}/transactions?${query}`),
  });
}

/**
 * A hard safety gate for any future send implementation.  This function is
 * exported so tests can prove the guard is enforced without making a network
 * request.  Both flags must be deliberately enabled; defaults are false.
 */
export function assertCoinbaseSendEnabled({
  sendEnabled = process.env.COINBASE_SEND_ENABLED,
  liveExecutionEnabled = process.env.FINANCE_LIVE_EXECUTION_ENABLED,
} = {}) {
  const enabled = /^(1|true|on|yes)$/i.test(String(sendEnabled || ""))
    && /^(1|true|on|yes)$/i.test(String(liveExecutionEnabled || ""));
  if (!enabled) {
    const error = new Error("COINBASE_SEND_DISABLED");
    error.code = "COINBASE_SEND_DISABLED";
    throw error;
  }
  return true;
}

/**
 * Placeholder for a future transfer implementation.  It is intentionally
 * blocked before any request is constructed or sent.
 */
export async function sendUsdc() {
  assertCoinbaseSendEnabled();
  throw new Error("COINBASE_SEND_NOT_IMPLEMENTED");
}

function accountCurrency(account) {
  return text(account?.currency || account?.asset?.symbol || account?.asset?.currency).toUpperCase();
}

function accountId(account) {
  return account?.id || account?.account_id || account?.accountId || null;
}

function accountBalance(account) {
  const candidate = account?.available_balance?.amount
    ?? account?.availableBalance?.amount
    ?? account?.available
    ?? account?.balance?.amount
    ?? account?.balance;
  return candidate == null ? null : String(candidate);
}

function normalizeAccounts(payload) {
  const values = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.accounts) ? payload.accounts : [];
  return values.map((account) => ({
    id: accountId(account),
    currency: accountCurrency(account),
    available: accountBalance(account),
    name: text(account?.name || account?.balance?.currency || account?.currency),
    raw: account,
  })).filter((account) => account.id || account.currency);
}

function analyzeBaseSupport({ accounts, networkCapabilities }) {
  if (Array.isArray(networkCapabilities)) {
    const base = networkCapabilities.find((item) => BASE_NETWORK_RE.test(item?.network || item?.network_id || ""));
    if (!base) return "NO";
    const assets = (base.assets || base.asset_ids || []).map((asset) => String(asset).toUpperCase());
    return assets.includes("USDC") ? "YES" : "NO";
  }
  const accountNetwork = accounts.flatMap((account) => {
    const raw = account.raw || {};
    return [raw.network, raw.network_id, raw.networkId, ...(Array.isArray(raw.networks) ? raw.networks : [])];
  });
  if (accountNetwork.some((item) => BASE_NETWORK_RE.test(typeof item === "string" ? item : item?.network || item?.network_id || ""))) return "YES";
  return "NEEDS LIVE AUTHORIZATION CHECK";
}

export async function runCoinbaseCapabilityCheck({
  accessToken = "",
  refreshToken = "",
  tokenScope = [],
  client,
  networkCapabilities = null,
  refresh = null,
} = {}) {
  const baseReport = {
    connection: "NOT CONNECTED",
    authenticationMethod: "Coinbase OAuth2",
    usdcAccountFound: false,
    usdcAvailable: null,
    usdcAvailableCents: null,
    accountsRead: false,
    transactionsRead: false,
    programmaticExternalSends: "UNKNOWN",
    requiredApiEndpoint: "POST https://api.coinbase.com/v2/accounts/{account_id}/transactions",
    requiredOAuthPermissions: ["wallet:accounts:read", "wallet:transactions:read", COINBASE_SEND_SCOPE],
    usdcSupported: "UNKNOWN",
    baseNetworkSupported: "NEEDS LIVE AUTHORIZATION CHECK",
    dynamicDestination: "YES",
    dynamicAmount: "YES",
    transactionStatusQueryable: "YES",
    transactionIdAvailable: "YES",
    twoFactor: "MAY BE REQUIRED AT SEND TIME",
    transferProtection: "MAY BE REQUIRED AT SEND TIME",
    travelRule: "MAY BE REQUIRED FOR SOME DESTINATIONS/REGIONS",
    refreshed: false,
    sendEnabled: false,
    status: "NOT_CONNECTED",
    error: null,
    usdcAccounts: [],
    recentTransactions: [],
  };
  if (!accessToken && refreshToken && typeof refresh === "function") {
    const refreshed = await refresh();
    accessToken = refreshed?.accessToken || "";
    tokenScope = refreshed?.scope || tokenScope;
    baseReport.refreshed = Boolean(accessToken);
  }
  if (!accessToken) return baseReport;
  const api = client || createCoinbaseReadOnlyClient({ accessToken });
  try {
    await api.getUser();
    baseReport.connection = "CONNECTED";
    baseReport.status = "READ_ONLY_CHECK_COMPLETE";
    const accountsPayload = await api.listAccounts();
    const accounts = normalizeAccounts(accountsPayload);
    baseReport.accountsRead = true;
    const usdcAccounts = accounts.filter((account) => account.currency === "USDC");
    baseReport.usdcAccounts = usdcAccounts.map(({ raw, ...account }) => account);
    baseReport.usdcAccountFound = usdcAccounts.length > 0;
    baseReport.usdcSupported = baseReport.usdcAccountFound ? "YES" : "NO";
    const available = usdcAccounts.map((account) => Number(account.available)).filter(Number.isFinite).reduce((sum, value) => sum + value, 0);
    if (Number.isFinite(available) && usdcAccounts.length) {
      baseReport.usdcAvailable = available.toFixed(2);
      baseReport.usdcAvailableCents = centsFromAmount(available);
    }
    for (const account of usdcAccounts.slice(0, 5)) {
      if (!account.id) continue;
      const transactions = await api.listTransactions(account.id).catch(() => null);
      if (!transactions) continue;
      baseReport.transactionsRead = true;
      const rows = Array.isArray(transactions?.data) ? transactions.data : Array.isArray(transactions?.transactions) ? transactions.transactions : [];
      baseReport.recentTransactions.push(...rows.slice(0, 10).map((transaction) => ({
        id: transaction.id || transaction.transaction_id || null,
        status: transaction.status || null,
        createdAt: transaction.created_at || transaction.createdAt || null,
        amount: transaction.amount?.amount ?? transaction.amount ?? null,
        currency: transaction.amount?.currency || transaction.currency || "USDC",
      })));
    }
    baseReport.programmaticExternalSends = "YES (requires separate send authorization)";
    baseReport.baseNetworkSupported = analyzeBaseSupport({ accounts, networkCapabilities });
    const scopes = normalizeScope(tokenScope);
    baseReport.sendAuthorized = scopes.includes(COINBASE_SEND_SCOPE);
    baseReport.sendPermissionStatus = baseReport.sendAuthorized ? "PRESENT (not used)" : "NOT ENABLED";
    return baseReport;
  } catch (error) {
    baseReport.status = "NEEDS_ATTENTION";
    baseReport.error = safeErrorMessage(error);
    if (error?.status === 401) baseReport.connection = "NOT CONNECTED";
    return baseReport;
  }
}

export function buildCoinbaseDiscordSummary(report) {
  const safe = report || {};
  return [
    "**COINBASE INTEGRATION CHECK**",
    "",
    `**Connection:** ${safe.connection || "NOT CONNECTED"}`,
    `**USDC Balance:** ${safe.usdcAvailable == null ? "Unavailable" : `$${safe.usdcAvailable}`}`,
    `**External API Sends:** ${safe.programmaticExternalSends || "UNKNOWN"}`,
    `**USDC:** ${safe.usdcSupported || "UNKNOWN"}`,
    `**Base:** ${safe.baseNetworkSupported || "NEEDS LIVE AUTHORIZATION CHECK"}`,
    `**Send Permission:** ${safe.sendPermissionStatus || "NOT ENABLED"}`,
    `**2FA:** ${safe.twoFactor || "MAY BE REQUIRED AT SEND TIME"}`,
    "**Real Transfers:** DISABLED",
    `**Status:** ${safe.status || "NOT_CONNECTED"}`,
  ].join("\n");
}

export function encryptCoinbaseToken(value, encryptionKey) {
  if (!value) return null;
  if (!encryptionKey) throw new Error("COINBASE_OAUTH_ENCRYPTION_KEY is required to store Coinbase credentials.");
  const key = crypto.createHash("sha256").update(String(encryptionKey)).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptCoinbaseToken(value, encryptionKey) {
  if (!value) return null;
  if (!encryptionKey) throw new Error("COINBASE_OAUTH_ENCRYPTION_KEY is required to read Coinbase credentials.");
  const [version, ivText, tagText, encryptedText] = String(value).split(":");
  if (version !== "v1" || !ivText || !tagText || !encryptedText) throw new Error("Unsupported Coinbase token ciphertext.");
  const key = crypto.createHash("sha256").update(String(encryptionKey)).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}
