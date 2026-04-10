/**
 * EcoLink Australia — Xero OAuth 2.0 helper
 *
 * Implements the Authorization Code flow as per Xero's OAuth 2.0 docs:
 * https://developer.xero.com/documentation/oauth2/overview
 *
 * Scopes requested:
 *   openid profile email          — identity
 *   accounting.transactions        — read/write invoices, expenses
 *   accounting.contacts            — suppliers & customers
 *   accounting.settings            — chart of accounts
 *   offline_access                 — enables refresh tokens
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface XeroTokenSet {
  access_token: string;
  refresh_token: string;
  expires_in: number;          // seconds
  token_type: string;
  scope: string;
  id_token?: string;
  // Computed fields we store alongside
  obtained_at: number;         // Unix ms
  expires_at: number;          // Unix ms
}

export interface XeroTenant {
  tenantId: string;
  tenantType: string;
  tenantName: string;
  createdDateUtc: string;
  updatedDateUtc: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const XERO_AUTH_URL  = "https://login.xero.com/identity/connect/authorize";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";

// New granular scopes — required for all apps created after 2 March 2026
// https://developer.xero.com/documentation/guides/oauth2/scopes/
const SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "accounting.invoices.read",        // invoices, bills, purchase orders
  "accounting.banktransactions.read", // bank transactions
  "accounting.payments.read",         // payments
  "accounting.contacts.read",         // suppliers & customers
  "accounting.settings.read",         // org info, chart of accounts
].join(" ");

function getCredentials() {
  const clientId     = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  const redirectUri  = process.env.XERO_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Xero credentials not configured. Set XERO_CLIENT_ID, XERO_CLIENT_SECRET, and XERO_REDIRECT_URI in .env.local"
    );
  }
  return { clientId, clientSecret, redirectUri };
}

// ---------------------------------------------------------------------------
// Authorization URL
// ---------------------------------------------------------------------------

/**
 * Build the Xero authorization URL.
 * @param state  Random string to protect against CSRF (store in session cookie).
 */
export function buildAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = getCredentials();

  const params = new URLSearchParams({
    response_type: "code",
    client_id:     clientId,
    redirect_uri:  redirectUri,
    scope:         SCOPES,
    state,
  });

  return `${XERO_AUTH_URL}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Token Exchange (authorization_code → token set)
// ---------------------------------------------------------------------------

export async function exchangeCodeForTokens(code: string): Promise<XeroTokenSet> {
  const { clientId, clientSecret, redirectUri } = getCredentials();

  const body = new URLSearchParams({
    grant_type:   "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:  "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Xero token exchange failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const now = Date.now();

  return {
    ...data,
    obtained_at: now,
    expires_at:  now + data.expires_in * 1000,
  };
}

// ---------------------------------------------------------------------------
// Token Refresh
// ---------------------------------------------------------------------------

export async function refreshAccessToken(refreshToken: string): Promise<XeroTokenSet> {
  const { clientId, clientSecret } = getCredentials();

  const body = new URLSearchParams({
    grant_type:    "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:  "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Xero token refresh failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const now = Date.now();

  return {
    ...data,
    obtained_at: now,
    expires_at:  now + data.expires_in * 1000,
  };
}

// ---------------------------------------------------------------------------
// Token validity check
// ---------------------------------------------------------------------------

/** Returns true if the access token is still valid (with 5-minute buffer). */
export function isTokenValid(tokens: XeroTokenSet): boolean {
  const BUFFER_MS = 5 * 60 * 1000; // 5 minutes
  return Date.now() < tokens.expires_at - BUFFER_MS;
}

// ---------------------------------------------------------------------------
// Get connected tenants (Xero organisations)
// ---------------------------------------------------------------------------

export async function getConnectedTenants(accessToken: string): Promise<XeroTenant[]> {
  const response = await fetch(XERO_CONNECTIONS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch Xero connections (${response.status}): ${text}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Auto-refresh helper — use this in API route handlers
// ---------------------------------------------------------------------------

/**
 * Returns a valid access token, refreshing if necessary.
 * Pass in the stored token set; receives the (potentially updated) token set back.
 */
export async function getValidAccessToken(
  tokens: XeroTokenSet
): Promise<{ accessToken: string; updatedTokens: XeroTokenSet | null }> {
  if (isTokenValid(tokens)) {
    return { accessToken: tokens.access_token, updatedTokens: null };
  }

  // Token expired — refresh
  const refreshed = await refreshAccessToken(tokens.refresh_token);
  return { accessToken: refreshed.access_token, updatedTokens: refreshed };
}

// ---------------------------------------------------------------------------
// Crypto: state parameter (CSRF protection)
// ---------------------------------------------------------------------------

/** Generate a cryptographically random state string. */
export function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Xero Accounting API — Transaction Fetch
// ---------------------------------------------------------------------------

const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";

export interface XeroBankTransaction {
  BankTransactionID: string;
  Type: string;               // "SPEND" | "RECEIVE"
  Status: string;             // "AUTHORISED" | "DELETED"
  Date: string;               // "/Date(1234567890000+0000)/"
  Contact: { Name?: string };
  LineItems: Array<{
    Description?: string;
    AccountCode?: string;
    AccountID?: string;
    LineAmount: number;
  }>;
  BankAccount: { Name?: string; AccountID: string };
  Total: number;
  CurrencyCode: string;
  Reference?: string;
}

/** Fetch SPEND bank transactions from Xero for a given date range (paginated). */
export async function fetchBankTransactions(
  accessToken: string,
  tenantId: string,
  fromDate: string,  // ISO: "2023-07-01"
  toDate:   string,  // ISO: "2024-06-30"
  page = 1,
): Promise<{ transactions: XeroBankTransaction[]; hasMore: boolean }> {
  const PAGE_SIZE = 100;

  // Xero date filter syntax
  const where = encodeURIComponent(
    `Type=="SPEND" && Status=="AUTHORISED" && Date>=DateTime(${fromDate.replace(/-/g, ",")}) && Date<=DateTime(${toDate.replace(/-/g, ",")})`
  );

  const url = `${XERO_API_BASE}/BankTransactions?where=${where}&page=${page}&pageSize=${PAGE_SIZE}&order=Date ASC`;

  const response = await fetch(url, {
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "xero-tenant-id": tenantId,
      Accept:          "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Xero BankTransactions failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const txs: XeroBankTransaction[] = data.BankTransactions ?? [];

  return { transactions: txs, hasMore: txs.length === PAGE_SIZE };
}

/** Fetch Xero Accounts (Chart of Accounts) to resolve account names. */
export async function fetchAccounts(
  accessToken: string,
  tenantId: string,
): Promise<Record<string, string>> {
  const url = `${XERO_API_BASE}/Accounts?where=Status=="ACTIVE"`;

  const response = await fetch(url, {
    headers: {
      Authorization:    `Bearer ${accessToken}`,
      "xero-tenant-id": tenantId,
      Accept:           "application/json",
    },
  });

  if (!response.ok) return {};

  const data = await response.json();
  const map: Record<string, string> = {};
  for (const acc of data.Accounts ?? []) {
    map[acc.AccountID] = acc.Name;
    if (acc.Code) map[acc.Code] = acc.Name;
  }
  return map;
}

/**
 * Convert Xero's weird "/Date(ms+0000)/" format to a JS Date.
 * Falls back to raw string if it doesn't match.
 */
export function parseXeroDate(xeroDate: string): Date {
  const match = xeroDate.match(/\/Date\((\d+)([+-]\d+)?\)\//);
  if (match) return new Date(parseInt(match[1], 10));
  return new Date(xeroDate);
}
