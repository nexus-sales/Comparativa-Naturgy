import crypto from "node:crypto";

export const COOKIE_NAME = "naturgy_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET no está definido");
  return secret;
}

function sign(value) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function createSessionToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== "string") return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;

  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

// Equal-length digest comparison so a wrong password of any length can't
// leak timing information about the real one.
export function timingSafeEqualPassword(candidate, actual) {
  const a = crypto.createHash("sha256").update(String(candidate ?? "")).digest();
  const b = crypto.createHash("sha256").update(String(actual ?? "")).digest();
  return crypto.timingSafeEqual(a, b);
}

// ── Rate limiting: max attempts per IP per window, in-memory (single instance) ──
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attemptsByIp = new Map();

export function isRateLimited(ip) {
  const list = (attemptsByIp.get(ip) ?? []).filter((t) => Date.now() - t < WINDOW_MS);
  attemptsByIp.set(ip, list);
  return list.length >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(ip) {
  const list = (attemptsByIp.get(ip) ?? []).filter((t) => Date.now() - t < WINDOW_MS);
  list.push(Date.now());
  attemptsByIp.set(ip, list);
}

export function clearAttempts(ip) {
  attemptsByIp.delete(ip);
}

// Periodic sweep so long-lived processes don't accumulate stale IP entries forever.
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of attemptsByIp) {
    const fresh = list.filter((t) => now - t < WINDOW_MS);
    if (fresh.length) attemptsByIp.set(ip, fresh);
    else attemptsByIp.delete(ip);
  }
}, WINDOW_MS).unref();
