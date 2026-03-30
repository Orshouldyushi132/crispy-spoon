import { readAdminSession } from "./session.js";

const TABLES = {
  entries: "kome_prerush_entries",
  official: "kome_prerush_official_videos",
  settings: "kome_prerush_settings",
  crew: "kome_prerush_admin_assignments",
};

const ENTRY_SELECT_BASE_LEGACY = "id,artist,title,parent_slot,start_time,url,note,status,created_at";
const ENTRY_SELECT_BASE = `${ENTRY_SELECT_BASE_LEGACY},parent_number`;
const ENTRY_SELECT_WITH_REVIEW_LEGACY = `${ENTRY_SELECT_BASE_LEGACY},review_note,reviewed_at`;
const ENTRY_SELECT_WITH_REVIEW = `${ENTRY_SELECT_BASE},review_note,reviewed_at`;
const DELETED_ENTRY_NOTE = "あなたの動画申請は削除されました。";

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

function getApplicantSecret(env) {
  return String(env.APPLICANT_LOOKUP_SECRET || env.ADMIN_SESSION_SECRET || "").trim();
}

function getApplicantFingerprint(request) {
  if (!request) return "";
  const ip = String(request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "")
    .split(",")[0]
    .trim();
  const ua = String(request.headers.get("User-Agent") || "").trim();
  return ip && ua ? `${ip}
${ua}` : "";
}

async function deriveApplicantKey(request, env) {
  const secret = getApplicantSecret(env);
  const fingerprint = getApplicantFingerprint(request);
  if (!secret || !fingerprint) return null;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${secret}
${fingerprint}`),
  );
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
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
  const session = await requireLinkedSession(request, env);
  if (!session.reviewUnlocked) {
    throw new HttpError(403, "Review password verification is required.");
  }
  return session;
}

export async function requireLinkedSession(request, env) {
  const session = await readAdminSession(request, env);
  if (!session?.discordUser) {
    throw new HttpError(401, "Discord authentication is required.");
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

function isMissingEntryColumnError(error, column) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    error instanceof HttpError
    && message.includes("column")
    && message.includes(TABLES.entries.toLowerCase())
    && message.includes(String(column || "").toLowerCase())
  );
}

function isDeletedStatusConstraintError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    error instanceof HttpError
    && (
      (message.includes("check constraint") && message.includes("status"))
      || message.includes("kome_prerush_entries_status_check")
    )
  );
}

function normalizeEntryRow(row) {
  return {
    ...row,
    parent_number: Number(row?.parent_number || 0),
    review_note: String(row?.review_note || ""),
    reviewed_at: row?.reviewed_at || null,
  };
}

function normalizeEntryRows(rows) {
  return Array.isArray(rows) ? rows.map(normalizeEntryRow) : [];
}

function normalizeCrewAssignment(row) {
  return {
    discord_user_id: String(row?.discord_user_id || ""),
    discord_username: String(row?.discord_username || ""),
    discord_global_name: String(row?.discord_global_name || ""),
    credit_name: String(row?.credit_name || ""),
    assigned_lanes: String(row?.assigned_lanes || ""),
    song_count: Number(row?.song_count || 0),
    note: String(row?.note || ""),
    updated_at: row?.updated_at || null,
  };
}

function defaultCrewAssignment(session) {
  const discordUser = session?.discordUser || {};
  return {
    discord_user_id: String(discordUser.id || ""),
    discord_username: String(discordUser.username || ""),
    discord_global_name: String(discordUser.global_name || ""),
    credit_name: "",
    assigned_lanes: "",
    song_count: 1,
    note: "",
    updated_at: null,
  };
}

export async function getPublicSnapshot(env) {
  let entries;
  try {
    entries = await supabaseRequest(env, `${TABLES.entries}?select=${ENTRY_SELECT_BASE}&status=eq.approved&order=start_time.asc`);
  } catch (error) {
    if (!isMissingEntryColumnError(error, "parent_number")) throw error;
    entries = await supabaseRequest(env, `${TABLES.entries}?select=${ENTRY_SELECT_BASE_LEGACY}&status=eq.approved&order=start_time.asc`);
  }
  const [official, settingsRows] = await Promise.all([
    supabaseRequest(env, `${TABLES.official}?select=id,title,start_time,url,note,created_at&order=start_time.asc`),
    supabaseRequest(env, `${TABLES.settings}?select=id,event_date,official_name,official_url,event_hashtag,x_search_url,live_playlist_url,archive_playlist_url,entry_close_minutes&id=eq.default`),
  ]);
  return {
    ok: true,
    entries: normalizeEntryRows(entries || []),
    official: official || [],
    settings: withDefaultSettings(settingsRows?.[0]),
  };
}

export async function getPublicEntryStatuses(env, request, ids) {
  const cleanIds = [...new Set((Array.isArray(ids) ? ids : []).map((value) => String(value || "").trim()).filter((value) => /^[A-Za-z0-9-]{8,120}$/.test(value)))].slice(0, 24);
  const applicantKey = await deriveApplicantKey(request, env);
  const loadByIds = (select) => cleanIds.length
    ? supabaseRequest(
        env,
        `${TABLES.entries}?select=${select}&id=in.(${cleanIds.map((value) => encodeURIComponent(value)).join(",")})&order=created_at.desc`,
      )
    : Promise.resolve([]);
  const loadByApplicant = (select) => applicantKey
    ? supabaseRequest(
        env,
        `${TABLES.entries}?select=${select}&applicant_key=eq.${encodeURIComponent(applicantKey)}&order=created_at.desc&limit=12`,
      )
    : Promise.resolve([]);
  let byIds = [];
  let byApplicant = [];
  try {
    [byIds, byApplicant] = await Promise.all([
      loadByIds(ENTRY_SELECT_WITH_REVIEW),
      loadByApplicant(ENTRY_SELECT_WITH_REVIEW),
    ]);
  } catch (error) {
    const reviewColumnsMissing = isMissingEntryColumnError(error, "review_note") || isMissingEntryColumnError(error, "reviewed_at");
    const applicantColumnMissing = isMissingEntryColumnError(error, "applicant_key");
    const parentColumnMissing = isMissingEntryColumnError(error, "parent_number");
    if (!reviewColumnsMissing && !applicantColumnMissing && !parentColumnMissing) {
      throw error;
    }
    [byIds, byApplicant] = await Promise.all([
      loadByIds(reviewColumnsMissing
        ? (parentColumnMissing ? ENTRY_SELECT_BASE_LEGACY : ENTRY_SELECT_BASE)
        : (parentColumnMissing ? ENTRY_SELECT_WITH_REVIEW_LEGACY : ENTRY_SELECT_WITH_REVIEW)),
      applicantColumnMissing ? Promise.resolve([]) : loadByApplicant(reviewColumnsMissing
        ? (parentColumnMissing ? ENTRY_SELECT_BASE_LEGACY : ENTRY_SELECT_BASE)
        : (parentColumnMissing ? ENTRY_SELECT_WITH_REVIEW_LEGACY : ENTRY_SELECT_WITH_REVIEW)),
    ]);
  }
  const merged = [...(byApplicant || []), ...(byIds || [])];
  const seen = new Set();
  const entries = [];
  for (const item of merged) {
    const key = String(item?.id || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    entries.push(normalizeEntryRow(item));
  }
  return {
    ok: true,
    entries,
  };
}

export async function getAdminSnapshot(env) {
  let entries;
  try {
    entries = await supabaseRequest(env, `${TABLES.entries}?select=${ENTRY_SELECT_WITH_REVIEW}&order=created_at.asc`);
  } catch (error) {
    const reviewColumnsMissing = isMissingEntryColumnError(error, "review_note") || isMissingEntryColumnError(error, "reviewed_at");
    const parentColumnMissing = isMissingEntryColumnError(error, "parent_number");
    if (!reviewColumnsMissing && !parentColumnMissing) {
      throw error;
    }
    entries = await supabaseRequest(
      env,
      `${TABLES.entries}?select=${reviewColumnsMissing
        ? (parentColumnMissing ? ENTRY_SELECT_BASE_LEGACY : ENTRY_SELECT_BASE)
        : ENTRY_SELECT_WITH_REVIEW_LEGACY}&order=created_at.asc`,
    );
  }
  const [official, settingsRows] = await Promise.all([
    supabaseRequest(env, `${TABLES.official}?select=id,title,start_time,url,note,created_at&order=start_time.asc`),
    supabaseRequest(env, `${TABLES.settings}?select=id,event_date,official_name,official_url,event_hashtag,x_search_url,live_playlist_url,archive_playlist_url,entry_close_minutes&id=eq.default`),
  ]);
  return {
    ok: true,
    entries: normalizeEntryRows(entries || []),
    official: official || [],
    settings: withDefaultSettings(settingsRows?.[0]),
  };
}

export async function getCrewSnapshot(env, session) {
  const ownRows = await supabaseRequest(
    env,
    `${TABLES.crew}?select=discord_user_id,discord_username,discord_global_name,credit_name,assigned_lanes,song_count,note,updated_at&discord_user_id=eq.${encodeURIComponent(String(session.discordUser.id || ""))}&limit=1`,
  );
  const own = ownRows?.[0] ? normalizeCrewAssignment(ownRows[0]) : defaultCrewAssignment(session);
  const entries = await supabaseRequest(
    env,
    `${TABLES.crew}?select=discord_user_id,discord_username,discord_global_name,credit_name,assigned_lanes,song_count,note,updated_at&order=updated_at.desc.nullslast`,
  );
  return {
    ok: true,
    own,
    entries: Array.isArray(entries) ? entries.map(normalizeCrewAssignment) : [],
  };
}

export async function saveCrewAssignment(env, session, body) {
  const creditName = String(body.credit_name || "").trim();
  const assignedLanes = String(body.assigned_lanes || "").trim();
  const songCount = clampInt(body.song_count, 1, 99, 1);
  const note = String(body.note || "").trim();
  if (!creditName) {
    throw new HttpError(400, "使用名義を入力してください。");
  }
  if (creditName.length > 80) {
    throw new HttpError(400, "使用名義は 80 文字以内で入力してください。");
  }
  if (!assignedLanes) {
    throw new HttpError(400, "担当枠を入力してください。");
  }
  if (assignedLanes.length > 120) {
    throw new HttpError(400, "担当枠は 120 文字以内で入力してください。");
  }
  if (note.length > 300) {
    throw new HttpError(400, "補足は 300 文字以内で入力してください。");
  }
  const payload = {
    discord_user_id: String(session.discordUser.id || ""),
    discord_username: String(session.discordUser.username || ""),
    discord_global_name: String(session.discordUser.global_name || ""),
    credit_name: creditName,
    assigned_lanes: assignedLanes,
    song_count: songCount,
    note,
    updated_at: new Date().toISOString(),
  };
  await supabaseRequest(env, `${TABLES.crew}?on_conflict=discord_user_id`, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify([payload]),
  });
  return {
    ok: true,
    assignment: normalizeCrewAssignment(payload),
  };
}

export async function createPublicEntry(env, request, body) {
  const artist = String(body.artist || "").trim();
  const title = String(body.title || "").trim();
  const parentSlot = Number(body.parent_slot);
  const parentNumber = Number(body.parent_number);
  const startTime = String(body.start_time || "").trim();
  const url = safeUrl(body.url, false);
  const note = String(body.note || "").trim();
  const applicantKey = await deriveApplicantKey(request, env);

  if (!artist || artist.length > 80) {
    throw new HttpError(400, "投稿名義は 1〜80 文字で入力してください。");
  }
  if (!title || title.length > 120) {
    throw new HttpError(400, "タイトルは 1〜120 文字で入力してください。");
  }
  if (!Number.isInteger(parentSlot) || parentSlot < 1 || parentSlot > 12) {
    throw new HttpError(400, "枠は表示されている選択肢から選んでください。");
  }
  if (!Number.isInteger(parentNumber) || parentNumber < 1 || parentNumber > 5) {
    throw new HttpError(400, "親は 1〜5 から選んでください。");
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
    throw new HttpError(409, "その枠・時間にはすでに掲載済みの動画があります。");
  }

  const payload = {
    id: String(body.id || crypto.randomUUID()),
    artist,
    title,
    parent_slot: parentSlot,
    parent_number: parentNumber,
    start_time: startTime,
    url,
    note,
    status: "pending",
    review_note: "",
    reviewed_at: null,
    applicant_key: applicantKey,
    created_at: new Date().toISOString(),
  };
  const legacyPayload = {
    id: payload.id,
    artist,
    title,
    parent_slot: parentSlot,
    start_time: startTime,
    url,
    note,
    status: "pending",
    created_at: payload.created_at,
  };

  try {
    await supabaseRequest(env, TABLES.entries, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([payload]),
    });
    return { ok: true, entry: payload };
  } catch (error) {
    const optionalColumnsMissing = ["review_note", "reviewed_at", "applicant_key", "parent_number"].some((column) => isMissingEntryColumnError(error, column));
    if (!optionalColumnsMissing) {
      throw error;
    }
    await supabaseRequest(env, TABLES.entries, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([legacyPayload]),
    });
    return { ok: true, entry: normalizeEntryRow(legacyPayload) };
  }
}

export async function updatePublicEntry(env, request, body) {
  const id = String(body.id || "").trim();
  const artist = String(body.artist || "").trim();
  const title = String(body.title || "").trim();
  const parentSlot = Number(body.parent_slot);
  const parentNumber = Number(body.parent_number);
  const startTime = String(body.start_time || "").trim();
  const url = safeUrl(body.url, false);
  const note = String(body.note || "").trim();
  const applicantKey = await deriveApplicantKey(request, env);

  if (!id) {
    throw new HttpError(400, "修正する参加登録が見つかりません。");
  }
  if (!applicantKey) {
    throw new HttpError(403, "本人確認に必要な情報が取得できませんでした。");
  }
  if (!artist || artist.length > 80) {
    throw new HttpError(400, "投稿名義は 1〜80 文字で入力してください。");
  }
  if (!title || title.length > 120) {
    throw new HttpError(400, "タイトルは 1〜120 文字で入力してください。");
  }
  if (!Number.isInteger(parentSlot) || parentSlot < 1 || parentSlot > 12) {
    throw new HttpError(400, "枠は表示されている選択肢から選んでください。");
  }
  if (!Number.isInteger(parentNumber) || parentNumber < 1 || parentNumber > 5) {
    throw new HttpError(400, "親は 1〜5 から選んでください。");
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

  let rows;
  try {
    rows = await supabaseRequest(
      env,
      `${TABLES.entries}?select=${ENTRY_SELECT_WITH_REVIEW},applicant_key&id=eq.${encodeURIComponent(id)}&limit=1`,
    );
  } catch (error) {
    const migrationMissing = isMissingEntryColumnError(error, "review_note")
      || isMissingEntryColumnError(error, "reviewed_at")
      || isMissingEntryColumnError(error, "applicant_key");
    if (isMissingEntryColumnError(error, "parent_number") && !migrationMissing) {
      rows = await supabaseRequest(
        env,
        `${TABLES.entries}?select=${ENTRY_SELECT_WITH_REVIEW_LEGACY},applicant_key&id=eq.${encodeURIComponent(id)}&limit=1`,
      );
    } else {
      if (!migrationMissing) {
        throw error;
      }
      throw new HttpError(409, "修正再申請を使うには、Supabase で supabase-migrate-review-notice.sql を実行してください。");
    }
  }

  const current = rows?.[0];
  if (!current) {
    throw new HttpError(404, "対象の参加登録が見つかりません。");
  }
  if (String(current.applicant_key || "") !== applicantKey) {
    throw new HttpError(403, "この参加登録は修正できません。");
  }
  if (String(current.status || "") === "deleted" || String(current.review_note || "") === DELETED_ENTRY_NOTE) {
    throw new HttpError(409, "削除済みの申請は再申請できません。新しく申請してください。");
  }
  if (String(current.status || "") !== "rejected") {
    throw new HttpError(409, "差し戻し済みの参加登録だけ修正できます。");
  }

  const existing = await supabaseRequest(
    env,
    `${TABLES.entries}?select=id&status=eq.approved&parent_slot=eq.${parentSlot}&start_time=eq.${encodeURIComponent(startTime)}&id=not.eq.${encodeURIComponent(id)}&limit=1`,
  );
  if (Array.isArray(existing) && existing.length) {
    throw new HttpError(409, "その枠・時間にはすでに掲載済みの動画があります。");
  }

  const payload = {
    artist,
    title,
    parent_slot: parentSlot,
    parent_number: parentNumber,
    start_time: startTime,
    url,
    note,
    status: "pending",
    review_note: "",
    reviewed_at: null,
  };

  try {
    await supabaseRequest(env, `${TABLES.entries}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (!isMissingEntryColumnError(error, "parent_number")) {
      throw error;
    }
    const legacyPayload = { ...payload };
    delete legacyPayload.parent_number;
    await supabaseRequest(env, `${TABLES.entries}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(legacyPayload),
    });
  }

  return {
    ok: true,
    entry: normalizeEntryRow({
      ...current,
      ...payload,
      id,
    }),
  };
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
    try {
      await supabaseRequest(env, `${TABLES.entries}?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          status: "deleted",
          review_note: DELETED_ENTRY_NOTE,
          reviewed_at: new Date().toISOString(),
        }),
      });
    } catch (error) {
      const reviewColumnsMissing = isMissingEntryColumnError(error, "review_note") || isMissingEntryColumnError(error, "reviewed_at");
      if (reviewColumnsMissing) {
        throw new HttpError(409, "削除通知の保存に必要な列がまだありません。Supabase で supabase-setup.sql を再実行してください。");
      }
      if (isDeletedStatusConstraintError(error)) {
        await supabaseRequest(env, `${TABLES.entries}?id=eq.${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            status: "rejected",
            review_note: DELETED_ENTRY_NOTE,
            reviewed_at: new Date().toISOString(),
          }),
        });
        return { ok: true, mode: "fallback" };
      }
      throw error;
    }
    return { ok: true };
  }
  if (action === "status") {
    const status = String(body.status || "").trim();
    const reviewNote = String(body.review_note || "").trim();
    if (!["approved", "rejected", "pending"].includes(status)) {
      throw new HttpError(400, "状態の指定が正しくありません。");
    }
    if (status === "rejected" && !reviewNote) {
      throw new HttpError(400, "差し戻し理由を入力してください。");
    }
    if (reviewNote.length > 300) {
      throw new HttpError(400, "差し戻し理由は 300 文字以内で入力してください。");
    }
    try {
      await supabaseRequest(env, `${TABLES.entries}?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          status,
          review_note: status === "rejected" ? reviewNote : "",
          reviewed_at: status === "pending" ? null : new Date().toISOString(),
        }),
      });
    } catch (error) {
      const reviewColumnsMissing = isMissingEntryColumnError(error, "review_note") || isMissingEntryColumnError(error, "reviewed_at");
      if (!reviewColumnsMissing) {
        throw error;
      }
      if (status === "rejected") {
        throw new HttpError(409, "差し戻し理由の保存に必要な列がまだありません。Supabase で supabase-setup.sql を再実行してください。");
      }
      await supabaseRequest(env, `${TABLES.entries}?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status }),
      });
    }
    return { ok: true };
  }
  throw new HttpError(400, "未対応の参加登録操作です。");
}
