import { readAdminSession } from "./session.js";

const TABLES = {
  entries: "kome_prerush_entries",
  official: "kome_prerush_official_videos",
  settings: "kome_prerush_settings",
};

const DEFAULT_SETTINGS = {
  id: "default",
  event_date: "2026-08-18",
  official_name: "全てお米の所為です。",
  official_url: "https://www.youtube.com/@or_should_rice",
  event_hashtag: "",
  x_search_url: "",
  live_playlist_url: "",
  archive_playlist_url: "",
  entry_close_minutes: 15,
};

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function jsonResponse(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export function errorResponse(message, status = 400) {
  return jsonResponse({ ok: false, error: message }, { status });
}

export function getDiscordConfigState(env) {
  const missing = [];
  if (!env.ADMIN_SESSION_SECRET) missing.push("ADMIN_SESSION_SECRET");
  if (!env.DISCORD_CLIENT_ID) missing.push("DISCORD_CLIENT_ID");
  if (!env.DISCORD_CLIENT_SECRET) missing.push("DISCORD_CLIENT_SECRET");
  return {
    configured: missing.length === 0,
    missing,
  };
}

export function isDiscordConfigured(env) {
  return getDiscordConfigState(env).configured;
}

export function isAdminApiConfigured(env) {
  return Boolean(isDiscordConfigured(env) && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function safeUrl(value, allowEmpty = false) {
  const text = String(value || "").trim();
  if (!text) return allowEmpty ? "" : null;
  try {
    const url = new URL(text);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function clampInt(value, min, max, fallback) {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function okTime(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || ""));
}

function restBase(env) {
  return `${String(env.SUPABASE_URL || "").replace(/\/$/, "")}/rest/v1`;
}

function friendlySupabaseError(text) {
  if (!text) return "Supabase request failed.";
  try {
    const payload = JSON.parse(text);
    if (payload?.code === "PGRST205") {
      const match = /'([^']+)'/.exec(String(payload.message || ""));
      const table = match?.[1] || "必要なテーブル";
      return `Supabase にテーブル ${table} がありません。Supabase の SQL Editor で supabase-setup.sql を最後まで実行してください。`;
    }
    if (typeof payload?.message === "string" && payload.message.trim()) {
      return payload.message;
    }
    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    // Fall back to raw text when the response is not JSON.
  }
  return text;
}

async function supabaseRequest(env, path, init = {}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(500, "Supabase service role is not configured.");
  }
  const headers = new Headers(init.headers || {});
  headers.set("apikey", env.SUPABASE_SERVICE_ROLE_KEY);
  headers.set("Authorization", `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${restBase(env)}/${path}`, {
    ...init,
    headers,
  });
  if (response.status === 204) return null;
  const text = await response.text();
  if (!response.ok) {
    throw new HttpError(response.status, friendlySupabaseError(text || "Supabase request failed."));
  }
  return text ? JSON.parse(text) : null;
}

export async function requireUnlockedSession(request, env) {
  const session = await readAdminSession(request, env);
  if (!session?.discordUser) {
    throw new HttpError(401, "Discord authentication is required.");
  }
  if (!session.reviewUnlocked) {
    throw new HttpError(403, "Review password verification is required.");
  }
  return session;
}

export function publicSession(session) {
  if (!session?.discordUser) return null;
  return {
    discordUser: session.discordUser,
    reviewUnlocked: Boolean(session.reviewUnlocked),
    authorizedAt: session.authorizedAt || null,
    unlockedAt: session.unlockedAt || null,
  };
}

function withDefaultSettings(row) {
  return row ? { ...DEFAULT_SETTINGS, ...row } : { ...DEFAULT_SETTINGS };
}

export async function getPublicSnapshot(env) {
  const [entries, official, settingsRows] = await Promise.all([
    supabaseRequest(env, `${TABLES.entries}?select=id,artist,title,parent_slot,start_time,url,note,status,created_at&status=eq.approved&order=start_time.asc`),
    supabaseRequest(env, `${TABLES.official}?select=id,title,start_time,url,note,created_at&order=start_time.asc`),
    supabaseRequest(env, `${TABLES.settings}?select=id,event_date,official_name,official_url,event_hashtag,x_search_url,live_playlist_url,archive_playlist_url,entry_close_minutes&id=eq.default`),
  ]);
  return {
    ok: true,
    entries: entries || [],
    official: official || [],
    settings: withDefaultSettings(settingsRows?.[0]),
  };
}

export async function getAdminSnapshot(env) {
  const [entries, official, settingsRows] = await Promise.all([
    supabaseRequest(env, `${TABLES.entries}?select=id,artist,title,parent_slot,start_time,url,note,status,created_at&order=created_at.asc`),
    supabaseRequest(env, `${TABLES.official}?select=id,title,start_time,url,note,created_at&order=start_time.asc`),
    supabaseRequest(env, `${TABLES.settings}?select=id,event_date,official_name,official_url,event_hashtag,x_search_url,live_playlist_url,archive_playlist_url,entry_close_minutes&id=eq.default`),
  ]);
  return {
    ok: true,
    entries: entries || [],
    official: official || [],
    settings: withDefaultSettings(settingsRows?.[0]),
  };
}

export async function createPublicEntry(env, body) {
  const artist = String(body.artist || "").trim();
  const title = String(body.title || "").trim();
  const parentSlot = Number(body.parent_slot);
  const startTime = String(body.start_time || "").trim();
  const url = safeUrl(body.url, false);
  const note = String(body.note || "").trim();

  if (!artist || artist.length > 80) {
    throw new HttpError(400, "投稿名義は 1〜80 文字で入力してください。");
  }
  if (!title || title.length > 120) {
    throw new HttpError(400, "タイトルは 1〜120 文字で入力してください。");
  }
  if (!Number.isInteger(parentSlot) || parentSlot < 1 || parentSlot > 5) {
    throw new HttpError(400, "レーンは 1〜5 から選んでください。");
  }
  if (!okTime(startTime)) {
    throw new HttpError(400, "開始時刻の形式が正しくありません。");
  }
  if (!url) {
    throw new HttpError(400, "公開 URL を入力してください。");
  }
  if (note.length > 300) {
    throw new HttpError(400, "補足は 300 文字以内で入力してください。");
  }

  const existing = await supabaseRequest(
    env,
    `${TABLES.entries}?select=id&status=eq.approved&parent_slot=eq.${parentSlot}&start_time=eq.${encodeURIComponent(startTime)}&limit=1`,
  );
  if (Array.isArray(existing) && existing.length) {
    throw new HttpError(409, "そのレーン・時間にはすでに掲載済みの動画があります。");
  }

  const payload = {
    id: String(body.id || crypto.randomUUID()),
    artist,
    title,
    parent_slot: parentSlot,
    start_time: startTime,
    url,
    note,
    status: "pending",
    created_at: new Date().toISOString(),
  };

  await supabaseRequest(env, TABLES.entries, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([payload]),
  });

  return { ok: true, entry: payload };
}

export async function saveSettings(env, payload) {
  const officialUrl = safeUrl(payload.official_url, false);
  if (!String(payload.official_name || "").trim()) {
    throw new HttpError(400, "公式チャンネル名を入力してください。");
  }
  if (!officialUrl) {
    throw new HttpError(400, "公式チャンネルURLの形式が正しくありません。");
  }
  const settings = {
    id: "default",
    event_date: String(payload.event_date || "").trim() || null,
    official_name: String(payload.official_name || "").trim(),
    official_url: officialUrl,
    event_hashtag: String(payload.event_hashtag || "").trim(),
    x_search_url: safeUrl(payload.x_search_url, true),
    live_playlist_url: safeUrl(payload.live_playlist_url, true),
    archive_playlist_url: safeUrl(payload.archive_playlist_url, true),
    entry_close_minutes: clampInt(payload.entry_close_minutes, 5, 120, DEFAULT_SETTINGS.entry_close_minutes),
    updated_at: new Date().toISOString(),
  };
  await supabaseRequest(env, `${TABLES.settings}?on_conflict=id`, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify([settings]),
  });
  return settings;
}

export async function mutateOfficial(env, body) {
  const action = String(body.action || "");
  if (action === "delete") {
    const id = String(body.id || "").trim();
    if (!id) throw new HttpError(400, "削除対象が見つかりません。");
    await supabaseRequest(env, `${TABLES.official}?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return { ok: true };
  }
  if (action === "add") {
    const title = String(body.title || "").trim();
    const startTime = String(body.start_time || "").trim();
    const url = safeUrl(body.url, true);
    const note = String(body.note || "").trim();
    if (!title) throw new HttpError(400, "動画タイトルを入力してください。");
    if (!okTime(startTime)) throw new HttpError(400, "公開時刻の形式が正しくありません。");
    const payload = {
      id: String(body.id || crypto.randomUUID()),
      title,
      start_time: startTime,
      url,
      note,
      created_at: new Date().toISOString(),
    };
    await supabaseRequest(env, TABLES.official, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([payload]),
    });
    return { ok: true };
  }
  throw new HttpError(400, "未対応の公式予定操作です。");
}

export async function mutateEntry(env, body) {
  const action = String(body.action || "");
  const id = String(body.id || "").trim();
  if (!id) throw new HttpError(400, "対象の参加登録が見つかりません。");
  if (action === "delete") {
    await supabaseRequest(env, `${TABLES.entries}?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return { ok: true };
  }
  if (action === "status") {
    const status = String(body.status || "").trim();
    if (!["approved", "rejected", "pending"].includes(status)) {
      throw new HttpError(400, "状態の指定が正しくありません。");
    }
    await supabaseRequest(env, `${TABLES.entries}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status }),
    });
    return { ok: true };
  }
  throw new HttpError(400, "未対応の参加登録操作です。");
}
