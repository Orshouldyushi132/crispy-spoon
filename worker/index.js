import * as adminCrew from "../functions/api/admin/crew.js";
import * as adminData from "../functions/api/admin/data.js";
import * as adminEntries from "../functions/api/admin/entries.js";
import * as adminGate from "../functions/api/admin/gate.js";
import * as adminLogout from "../functions/api/admin/logout.js";
import * as adminOfficial from "../functions/api/admin/official.js";
import * as adminSession from "../functions/api/admin/session.js";
import * as adminSettings from "../functions/api/admin/settings.js";
import * as adminVerifyPassword from "../functions/api/admin/verify-password.js";
import * as discordCallback from "../functions/api/admin/discord/callback.js";
import * as discordStart from "../functions/api/admin/discord/start.js";
import * as publicData from "../functions/api/public/data.js";
import * as publicEntries from "../functions/api/public/entries.js";
import * as publicStatuses from "../functions/api/public/statuses.js";
import { readAdminGate } from "../functions/_lib/session.js";

const ROUTES = [
  { path: "/api/admin/gate", GET: adminGate.onRequestGet, POST: adminGate.onRequestPost },
  { path: "/api/admin/session", GET: adminSession.onRequestGet },
  { path: "/api/admin/data", GET: adminData.onRequestGet },
  { path: "/api/admin/entries", POST: adminEntries.onRequestPost },
  { path: "/api/admin/logout", POST: adminLogout.onRequestPost },
  { path: "/api/admin/official", POST: adminOfficial.onRequestPost },
  { path: "/api/admin/settings", POST: adminSettings.onRequestPost },
  { path: "/api/admin/verify-password", POST: adminVerifyPassword.onRequestPost },
  { path: "/api/admin/crew", GET: adminCrew.onRequestGet, POST: adminCrew.onRequestPost },
  { path: "/api/admin/discord/start", GET: discordStart.onRequestGet },
  { path: "/api/admin/discord/callback", GET: discordCallback.onRequestGet },
  { path: "/api/public/data", GET: publicData.onRequestGet },
  { path: "/api/public/entries", POST: publicEntries.onRequestPost },
  { path: "/api/public/statuses", POST: publicStatuses.onRequestPost },
];

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function toAssetPath(pathname) {
  if (pathname === "/") return "/index.html";
  if (pathname === "/admin") return "/admin.html";
  return pathname;
}

function withNoStore(response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function withHtmlSecurityHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  const contentType = headers.get("content-type") || "";

  if (contentType.includes("text/html")) {
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    );
    headers.set("X-Frame-Options", "DENY");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (pathname === "/admin" || pathname === "/admin.html") {
      headers.set("Cache-Control", "no-store");
      headers.set("X-Robots-Tag", "noindex, nofollow");
    } else {
      headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function notFoundJson() {
  return new Response(JSON.stringify({ ok: false, error: "Not Found" }), {
    status: 404,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function methodNotAllowed() {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: { Allow: "GET, POST" },
  });
}

function gateLockedResponse() {
  return new Response(JSON.stringify({
    ok: false,
    error: "管理ページの前段パスワードを先に通過してください。",
  }), {
    status: 403,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function buildAssetRequest(request, pathname) {
  const assetPath = toAssetPath(pathname);
  if (assetPath === pathname) return request;
  const url = new URL(request.url);
  url.pathname = assetPath;
  return new Request(url, request);
}

export default {
  async fetch(request, env, executionCtx) {
    const url = new URL(request.url);
    const pathname = normalizePath(url.pathname);
    const route = ROUTES.find((item) => item.path === pathname);

    if (route) {
      if (pathname.startsWith("/api/admin/") && pathname !== "/api/admin/gate") {
        const gate = await readAdminGate(request, env).catch(() => null);
        if (!gate?.unlockedAt) {
          return gateLockedResponse();
        }
      }
      const handler = route[request.method.toUpperCase()];
      if (!handler) {
        return methodNotAllowed();
      }
      const response = await handler({
        request,
        env,
        params: {},
        waitUntil: executionCtx.waitUntil.bind(executionCtx),
        next: () => env.ASSETS.fetch(request),
      });
      return withNoStore(response);
    }

    if (pathname.startsWith("/api/")) {
      return withNoStore(notFoundJson());
    }

    const assetRequest = buildAssetRequest(request, pathname);
    const assetResponse = await env.ASSETS.fetch(assetRequest);
    return withHtmlSecurityHeaders(assetResponse, pathname);
  },
};
