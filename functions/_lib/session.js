const SESSION_COOKIE = "kome_admin_session";
const OAUTH_STATE_COOKIE = "kome_admin_oauth_state";
const SESSION_MAX_AGE = 60 * 60 * 12;
const STATE_MAX_AGE = 60 * 10;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function parseCookies(header = "") {
  return header
    .split(/;\s*/)
    .filter(Boolean)
    .reduce((all, chunk) => {
      const index = chunk.indexOf("=");
      if (index < 0) return all;
      const key = decodeURIComponent(chunk.slice(0, index));
      const value = decodeURIComponent(chunk.slice(index + 1));
      all[key] = value;
      return all;
    }, {});
}

function cookieString(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function signValue(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

async function buildSignedToken(secret, payload) {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await signValue(secret, body);
  return `${body}.${signature}`;
}

async function verifySignedToken(secret, token) {
  if (!token || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  const expected = await signValue(secret, body);
  if (signature !== expected) return null;
  const payload = JSON.parse(decoder.decode(fromBase64Url(body)));
  if (!payload || typeof payload !== "object") return null;
  if (payload.expiresAt && Date.now() > payload.expiresAt) return null;
  return payload;
}

function requireSessionSecret(env) {
  if (!env.ADMIN_SESSION_SECRET) {
    throw new Error("ADMIN_SESSION_SECRET is not configured.");
  }
  return env.ADMIN_SESSION_SECRET;
}

export async function readAdminSession(request, env) {
  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const secret = requireSessionSecret(env);
  return verifySignedToken(secret, cookies[SESSION_COOKIE]);
}

export async function writeAdminSession(headers, env, session) {
  const secret = requireSessionSecret(env);
  const payload = {
    ...session,
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
  };
  const token = await buildSignedToken(secret, payload);
  headers.append("Set-Cookie", cookieString(SESSION_COOKIE, token, SESSION_MAX_AGE));
}

export function clearAdminSession(headers) {
  headers.append("Set-Cookie", cookieString(SESSION_COOKIE, "", 0));
}

export function createOauthState() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function writeOauthState(headers, state) {
  headers.append("Set-Cookie", cookieString(OAUTH_STATE_COOKIE, state, STATE_MAX_AGE));
}

export function readOauthState(request) {
  const cookies = parseCookies(request.headers.get("Cookie") || "");
  return cookies[OAUTH_STATE_COOKIE] || "";
}

export function clearOauthState(headers) {
  headers.append("Set-Cookie", cookieString(OAUTH_STATE_COOKIE, "", 0));
}
