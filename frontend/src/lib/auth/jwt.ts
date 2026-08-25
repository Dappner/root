// Client-side JWT acquisition for FastAPI calls.
//
// Background: FastAPI authenticates requests with a Better-Auth **JWT** (Bearer),
// while the browser only holds a Better-Auth **session cookie**. In the Next.js
// build a server-side proxy exchanged the cookie for a JWT per request. In the
// Vite SPA there is no such server, so the browser performs the exchange itself:
// it asks the auth-server's `/api/auth/token` endpoint (same-origin via nginx in
// prod / the Vite dev proxy locally) for a JWT, caches it, and refreshes before
// expiry.
//
// The token endpoint mints a JWT from the current session cookie, so requests
// must be credentialed. Concurrent callers share a single in-flight request.

const TOKEN_ENDPOINT = "/api/auth/token";
// Refresh slightly before the real expiry to avoid races against the boundary.
const EXPIRY_SKEW_MS = 30_000;
// Fallback lifetime if the JWT has no decodable `exp` claim.
const FALLBACK_TTL_MS = 5 * 60_000;

interface CachedToken {
  token: string;
  expiresAtMs: number;
}

let cached: CachedToken | null = null;
let inFlight: Promise<string> | null = null;

function decodeExpiryMs(jwt: string): number | null {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: number };
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function requestToken(): Promise<string> {
  const res = await fetch(TOKEN_ENDPOINT, {
    credentials: "include",
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to acquire auth token (${res.status})`);
  }
  const data = (await res.json()) as { token?: string } | null;
  if (!data?.token) {
    throw new Error("Auth token endpoint returned no token");
  }
  return data.token;
}

/**
 * Returns a valid JWT, fetching/refreshing as needed. Concurrent calls share one
 * in-flight request. Throws if no token can be obtained (caller should treat as
 * unauthenticated).
 */
export async function getJwt(): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAtMs - EXPIRY_SKEW_MS > now) {
    return cached.token;
  }
  if (inFlight) return inFlight;

  inFlight = requestToken()
    .then((token) => {
      const expiresAtMs = decodeExpiryMs(token) ?? Date.now() + FALLBACK_TTL_MS;
      cached = { token, expiresAtMs };
      return token;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Drop the cached token (e.g. after a 401 or on sign-out) so the next call refetches. */
export function clearJwt(): void {
  cached = null;
}

/**
 * Build request headers with the Bearer token attached. Returns a plain object
 * suitable for spreading into a `fetch` `headers` bag.
 *
 * Throws if a token cannot be acquired (auth-server down, session lost). Callers
 * MUST treat that as an authentication failure and route the user to login —
 * never send the request without a Bearer, which would surface a confusing
 * server-side 401 instead of the real "you are not authenticated" condition.
 */
export async function authHeaders(
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  const token = await getJwt();
  return { Authorization: `Bearer ${token}`, ...extra };
}
