import * as adminSession from "../functions/api/admin/session.js";
import * as adminData from "../functions/api/admin/data.js";
import * as adminEntries from "../functions/api/admin/entries.js";
import * as adminLogout from "../functions/api/admin/logout.js";
import * as adminOfficial from "../functions/api/admin/official.js";
import * as adminSettings from "../functions/api/admin/settings.js";
import * as adminVerifyPassword from "../functions/api/admin/verify-password.js";
import * as adminCrew from "../functions/api/admin/crew.js";
import * as publicData from "../functions/api/public/data.js";
import * as publicEntries from "../functions/api/public/entries.js";
import * as publicStatuses from "../functions/api/public/statuses.js";
import * as discordStart from "../functions/api/admin/discord/start.js";
import * as discordCallback from "../functions/api/admin/discord/callback.js";

const ROUTES = [
  { path: "/api/admin/session", GET: adminSession.onRequestGet },
  { path: "/api/admin/data", GET: adminData.onRequestGet },
  { path: "/api/admin/entries", POST: adminEntries.onRequestPost },
  { path: "/api/admin/logout", POST: adminLogout.onRequestPost },
  { path: "/api/admin/official", POST: adminOfficial.onRequestPost },
  { path: "/api/admin/settings", POST: adminSettings.onRequestPost },
  { path: "/api/admin/verify-password", POST: adminVerifyPassword.onRequestPost },
  { path: "/api/admin/crew", GET: adminCrew.onRequestGet, POST: adminCrew.onRequestPost },
  { path: "/api/public/data", GET: publicData.onRequestGet },
  { path: "/api/public/entries", POST: publicEntries.onRequestPost },
  { path: "/api/public/statuses", POST: publicStatuses.onRequestPost },
  { path: "/api/admin/discord/start", GET: discordStart.onRequestGet },
  { path: "/api/admin/discord/callback", GET: discordCallback.onRequestGet },
];

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
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

function withHtmlSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  const contentType = headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }
  headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env, executionCtx) {
    const url = new URL(request.url);
    const pathname = normalizePath(url.pathname);
    const route = ROUTES.find((item) => item.path === pathname);

    if (route) {
      const handler = route[request.method.toUpperCase()];
      if (!handler) {
        return methodNotAllowed();
      }
      return handler({
        request,
        env,
        params: {},
        waitUntil: executionCtx.waitUntil.bind(executionCtx),
        next: () => env.ASSETS.fetch(request),
      });
    }

    if (pathname.startsWith("/api/")) {
      return notFoundJson();
    }

    const assetResponse = await env.ASSETS.fetch(request);
    return withHtmlSecurityHeaders(assetResponse);
  },
};
