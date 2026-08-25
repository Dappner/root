import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { getJwt, clearJwt, authHeaders } from "@/lib/auth/jwt";

// Build a fake JWT whose payload carries the given `exp` (seconds since epoch).
function makeJwt(expSeconds: number): string {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ exp: expSeconds })}.sig`;
}

const realFetch = globalThis.fetch;
let fetchCalls = 0;
let nextToken: () => string;

function installFetch(handler: () => { ok: boolean; token?: string }) {
  fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    const { ok, token } = handler();
    return {
      ok,
      status: ok ? 200 : 401,
      json: async () => ({ token }),
    } as Response;
  }) as typeof fetch;
}

beforeEach(() => {
  clearJwt();
  const farFuture = Math.floor(Date.now() / 1000) + 3600;
  nextToken = () => makeJwt(farFuture);
  installFetch(() => ({ ok: true, token: nextToken() }));
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("caches the token across calls (one network request)", async () => {
  const a = await getJwt();
  const b = await getJwt();
  assert.equal(a, b);
  assert.equal(fetchCalls, 1, "second call should hit cache");
});

test("single-flights concurrent callers", async () => {
  const [a, b, c] = await Promise.all([getJwt(), getJwt(), getJwt()]);
  assert.equal(a, b);
  assert.equal(b, c);
  assert.equal(fetchCalls, 1, "concurrent calls share one request");
});

test("refetches after clearJwt()", async () => {
  await getJwt();
  clearJwt();
  await getJwt();
  assert.equal(fetchCalls, 2);
});

test("refetches a token that is past its expiry (with skew)", async () => {
  // Token already expired → must not be served from cache.
  const past = Math.floor(Date.now() / 1000) - 10;
  installFetch(() => ({ ok: true, token: makeJwt(past) }));
  await getJwt();
  await getJwt();
  assert.equal(fetchCalls, 2, "expired token should not be cached");
});

test("authHeaders attaches Bearer", async () => {
  const headers = await authHeaders({ "Content-Type": "application/json" });
  assert.match(headers.Authorization, /^Bearer /);
  assert.equal(headers["Content-Type"], "application/json");
});

test("authHeaders throws when a token cannot be acquired", async () => {
  // A failed token fetch must surface as an error so callers route to login,
  // rather than sending a header-less request that 401s with a misleading message.
  installFetch(() => ({ ok: false }));
  await assert.rejects(authHeaders(), /Failed to acquire auth token/);
});
