/**
 * EcoLink Australia — MYOB AccountRight OAuth 2.0 + API helper
 *
 * Implements the Authorization Code flow for MYOB AccountRight Live API.
 * https://developer.myob.com/api/accountright/api-overview/authentication/
 *
 * Scopes requested:
 *   CompanyFile — access to company file data (transactions, accounts)
 *
 * MYOB API requires these headers on every request:
 *   Authorization: Bearer {access_token}
 *   x-myobapi-key: {client_id}
 *   x-myobapi-version: v2
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MyobTokenSet {
  access_token:  string;
  refresh_token: string;
  expires_in:    number;   // seconds
  token_type:    string;
  scope?:        string;
  // Computed fields stored alongside
  obtained_at:   number;   // Unix ms
  expires_at:    number;   // Unix ms
}

export interface MyobCompanyFile {
  Id:      string;
  Name:    string;
  Uri:     string;         // base URI for all API calls in this file
  Country: string;
  Version: string;
}

export interface MyobSpendMoney {
  UID:           string;
  Account:       { UID: string; Name: string; DisplayID: string };
  Date:          string;   // ISO: "2024-01-15T00:00:00"
  Payee:         string;
  Memo:          string;
  Amount:        number;
  Lines:         Array<{
    Account:     { UID: string; Name: string; DisplayID: string };
    Amount:      number;
    Memo:        string;
    TaxCode?:    { UID: string; Code: string };
  }>;
  Category?:     { UID: string; Name: string };
  IsReportable:  boolean;
  IsTaxInclusive: boolean;
}

export interface MyobPurchaseBill {
  UID:           string;
  BillType:      string;   // "Item" | "Service" | "Professional" | "Miscellaneous"
  Number:        string;
  Date:          string;
  Supplier:      { UID: string; Name: string };
  Memo?:         string;
  TotalAmountPaid: number;
  TotalTax:      number;
  Subtotal:      number;
  Lines:         Array<{
    Description?: string;
    Total:        number;
    Account?:     { UID: string; Name: string; DisplayID: string };
  }>;
}

// ─── Config ───────────────────────────────────────────────────────────────────

// MYOB OAuth2 endpoints (AccountRight Live)
// https://developer.myob.com/api/accountright/api-overview/authentication/
const MYOB_AUTH_URL  = "https://secure.myob.com/oauth2/account/authorize";
const MYOB_TOKEN_URL = "https://secure.myob.com/oauth2/v1/authorize";
const MYOB_API_BASE  = "https://api.myob.com/accountright";

const MYOB_SCOPES = "CompanyFile";

function getCredentials() {
  const clientId     = process.env.MYOB_CLIENT_ID;
  const clientSecret = process.env.MYOB_CLIENT_SECRET;
  const redirectUri  = process.env.MYOB_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "MYOB credentials not configured. Set MYOB_CLIENT_ID, MYOB_CLIENT_SECRET, and MYOB_REDIRECT_URI in .env.local"
    );
  }
  return { clientId, clientSecret, redirectUri };
}

// ─── Authorization URL ────────────────────────────────────────────────────────

export function buildAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = getCredentials();

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         MYOB_SCOPES,
    state,
  });

  return `${MYOB_AUTH_URL}?${params.toString()}`;
}

// ─── Token Exchange ───────────────────────────────────────────────────────────

export async function exchangeCodeForTokens(code: string): Promise<MyobTokenSet> {
  const { clientId, clientSecret, redirectUri } = getCredentials();

  const body = new URLSearchParams({
    client_id:     clientId,
    client_secret: clientSecret,
    redirect_uri:  redirectUri,
    grant_type:    "authorization_code",
    code,
    scope:         MYOB_SCOPES,
  });

  const response = await fetch(MYOB_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MYOB token exchange failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const now  = Date.now();
  return { ...data, obtained_at: now, expires_at: now + (data.expires_in ?? 1200) * 1000 };
}

// ─── Token Refresh ────────────────────────────────────────────────────────────

export async function refreshAccessToken(refreshToken: string): Promise<MyobTokenSet> {
  const { clientId, clientSecret } = getCredentials();

  const body = new URLSearchParams({
    client_id:     clientId,
    client_secret: clientSecret,
    grant_type:    "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(MYOB_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MYOB token refresh failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const now  = Date.now();
  return { ...data, obtained_at: now, expires_at: now + (data.expires_in ?? 1200) * 1000 };
}

// ─── Token Validity ───────────────────────────────────────────────────────────

export function isTokenValid(tokens: MyobTokenSet): boolean {
  const BUFFER_MS = 5 * 60 * 1000;
  return Date.now() < tokens.expires_at - BUFFER_MS;
}

export async function getValidAccessToken(
  tokens: MyobTokenSet
): Promise<{ accessToken: string; updatedTokens: MyobTokenSet | null }> {
  if (isTokenValid(tokens)) {
    return { accessToken: tokens.access_token, updatedTokens: null };
  }
  const refreshed = await refreshAccessToken(tokens.refresh_token);
  return { accessToken: refreshed.access_token, updatedTokens: refreshed };
}

// ─── CSRF State ───────────────────────────────────────────────────────────────

export function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Common API headers ───────────────────────────────────────────────────────

function myobHeaders(accessToken: string): Record<string, string> {
  const clientId = process.env.MYOB_CLIENT_ID ?? "";
  return {
    Authorization:       `Bearer ${accessToken}`,
    "x-myobapi-key":     clientId,
    "x-myobapi-version": "v2",
    Accept:              "application/json",
  };
}

// ─── Company Files ────────────────────────────────────────────────────────────

/** List all MYOB company files the user has access to. */
export async function getCompanyFiles(accessToken: string): Promise<MyobCompanyFile[]> {
  const response = await fetch(`${MYOB_API_BASE}/`, {
    headers: myobHeaders(accessToken),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MYOB company files failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  // MYOB returns an array directly
  return Array.isArray(data) ? data : (data.CompanyFiles ?? []);
}

// ─── Spend Money Transactions ─────────────────────────────────────────────────

const PAGE_SIZE = 400; // MYOB default max is 400

/**
 * Fetch SpendMoney transactions from a company file.
 * @param fileUri  The company file base URI (stored in myob_company_file_uri)
 * @param fromDate ISO date string "2023-07-01"
 * @param toDate   ISO date string "2024-06-30"
 * @param skip     Offset for pagination
 */
export async function fetchSpendMoney(
  accessToken: string,
  fileUri:     string,
  fromDate:    string,
  toDate:      string,
  skip = 0,
): Promise<{ transactions: MyobSpendMoney[]; hasMore: boolean }> {
  // MYOB filter syntax uses OData-like $filter
  const filter = `Date ge datetime'${fromDate}' and Date le datetime'${toDate}'`;
  const url    = `${fileUri}/Banking/SpendMoney?$filter=${encodeURIComponent(filter)}&$top=${PAGE_SIZE}&$skip=${skip}&$orderby=Date asc`;

  const response = await fetch(url, { headers: myobHeaders(accessToken) });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MYOB SpendMoney failed (${response.status}): ${text}`);
  }

  const data  = await response.json();
  const items: MyobSpendMoney[] = data.Items ?? [];
  return { transactions: items, hasMore: items.length === PAGE_SIZE };
}

// ─── Purchase Bills ───────────────────────────────────────────────────────────

/**
 * Fetch Purchase Bills (accounts payable) from a company file.
 * Useful for supplier invoices not captured as SpendMoney.
 */
export async function fetchPurchaseBills(
  accessToken: string,
  fileUri:     string,
  fromDate:    string,
  toDate:      string,
  skip = 0,
): Promise<{ bills: MyobPurchaseBill[]; hasMore: boolean }> {
  const filter = `Date ge datetime'${fromDate}' and Date le datetime'${toDate}'`;
  const url    = `${fileUri}/Purchase/Bill?$filter=${encodeURIComponent(filter)}&$top=${PAGE_SIZE}&$skip=${skip}&$orderby=Date asc`;

  const response = await fetch(url, { headers: myobHeaders(accessToken) });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MYOB Purchase/Bill failed (${response.status}): ${text}`);
  }

  const data  = await response.json();
  const items: MyobPurchaseBill[] = data.Items ?? [];
  return { bills: items, hasMore: items.length === PAGE_SIZE };
}

// ─── Date helper ──────────────────────────────────────────────────────────────

/** Parse MYOB ISO date string "2024-01-15T00:00:00" → Date */
export function parseMyobDate(myobDate: string): Date {
  // Strip trailing timezone if present and parse as UTC midnight
  const clean = myobDate.replace(/T.*$/, "");
  return new Date(`${clean}T00:00:00Z`);
}
