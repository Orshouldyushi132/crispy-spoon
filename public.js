const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";
const ET = "kome_prerush_entries";
const OT = "kome_prerush_official_videos";
const ST = "kome_prerush_settings";
const SID = "default";
const LE = "kome_prerush_entries_local_v3";
const LO = "kome_prerush_official_v1";
const LS = "kome_prerush_settings_v1";
const LF = "kome_prerush_viewer_favorites_v1";
const LT = "kome_prerush_tracked_submission_ids_v1";
const PUBLIC_API_BASE = "/api/public";
const DELETED_REVIEW_NOTE = "あなたの動画申請は削除されました。";

const DEFAULT_SETTINGS = {
  event_date: "2026-08-18",
  official_name: "全てお米の所為です。",
  official_url: "https://www.youtube.com/@or_should_rice",
  event_hashtag: "",
  x_search_url: "",
  live_playlist_url: "",
  archive_playlist_url: "",
  entry_close_minutes: 15,
};

const SLOT_LABELS = {
  1: "DSC枠",
  2: "逆再生枠",
  3: ".枠",
  4: "..枠",
  5: "...枠",
  6: "表/裏枠",
  7: "アブジェ枠",
  8: "教育枠",
  9: "名の星枠",
  10: "エヌ枠",
  11: "K²枠",
  12: "オリジナル枠",
};

const parentLabel = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 5 ? `親${number}` : "";
};

const $ = (id) => document.getElementById(id);
const els = {
  form: $("entryForm"),
  status: $("status"),
  pending: $("pendingBody"),
  entryReviewNotice: $("entryReviewNotice"),
  entryFormMode: $("entryFormMode"),
  entrySubmit: $("entrySubmitBtn"),
  entryReset: $("resetEntryFormBtn"),
  timeline: $("timeline"),
  nextTime: $("nextTime"),
  nextText: $("nextText"),
  nextMeta1: $("nextMeta1"),
  nextMeta2: $("nextMeta2"),
  nextState: $("nextState"),
  nextKind: $("nextKind"),
  nextOverlap: $("nextOverlap"),
  nextWatch: $("nextWatchBtn"),
  nextNotify: $("nextNotifyBtn"),
  nextShare: $("nextShareBtn"),
  dateChip: $("dateChip"),
  channelLink: $("channelLink"),
  eventNote: $("eventNote"),
  approved: $("approvedCount"),
  official: $("officialCount"),
  total: $("totalCount"),
  favoriteCount: $("favoriteCount"),
  favoritePreview: $("favoritePreview"),
  plannerStatus: $("plannerStatus"),
  eventState: $("eventState"),
  eventStateDetail: $("eventStateDetail"),
  searchSummary: $("searchSummary"),
  search: $("scheduleSearch"),
  laneFilter: $("laneFilter"),
  timeFilter: $("timeFilter"),
  jumpUpcoming: $("jumpUpcomingBtn"),
  clearSearch: $("clearSearchBtn"),
  copyPage: $("copyPageBtn"),
  downloadFavorites: $("downloadFavoritesBtn"),
  downloadAll: $("downloadAllBtn"),
  eventDateText: $("eventDateText"),
  heroDate: $("heroDate"),
  leadDate: $("leadDate"),
  rulesDateText: $("rulesDateText"),
  rulesTagText: $("rulesTagText"),
  hashtagText: $("hashtagText"),
  hashtagChip: $("hashtagChip"),
  tagSearch: $("tagSearchLink"),
  tagPost: $("tagPostLink"),
  livePlaylist: $("livePlaylistLink"),
  archivePlaylist: $("archivePlaylistLink"),
  playlistNote: $("playlistNote"),
  entryDeadlineText: $("entryDeadlineText"),
  spacingAdviceText: $("spacingAdviceText"),
  suggestTimesText: $("suggestTimesText"),
  promoTemplate: $("promoTemplate"),
  copyPromo: $("copyPromoBtn"),
  artist: $("artist"),
  titleInput: $("title"),
  parentSlot: $("parentSlot"),
  parentNumber: $("parentNumber"),
  startTime: $("startTime"),
  urlInput: $("url"),
  noteInput: $("note"),
  dockJump: $("dockJumpBtn"),
  dockWatch: $("dockWatchBtn"),
  dockFavorite: $("dockFavoriteBtn"),
};

const shared = !!(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
const previewMode = window.location.protocol === "file:";
const sb = shared ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const cleanTrackedIds = (ids) => [...new Set((Array.isArray(ids) ? ids : [])
  .map((value) => String(value || "").trim())
  .filter((value) => /^[A-Za-z0-9-]{8,120}$/.test(value)))]
  .slice(0, 24);

let settings = { ...DEFAULT_SETTINGS };
let schedule = [];
let approvedEntries = [];
let trackedEntriesCache = [];
let filterState = "all";
let searchQuery = "";
let laneFilter = "";
let timeFilter = "";
let currentNextKey = "";
let sourceMode = previewMode ? "local" : "remote";
let favorites = new Set(read(LF, []));
let trackedSubmissionIds = cleanTrackedIds(read(LT, []));
let editingEntryId = "";

const saveTrackedSubmissionIds = () => write(LT, trackedSubmissionIds);
const rememberTrackedSubmission = (id) => {
  const value = String(id || "").trim();
  if (!/^[A-Za-z0-9-]{8,120}$/.test(value)) return;
  trackedSubmissionIds = [value, ...trackedSubmissionIds.filter((item) => item !== value)].slice(0, 24);
  saveTrackedSubmissionIds();
};

const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const okTime = (value) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || ""));
const mins = (value) => (okTime(value) ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5)) : 1e9);
const clampInt = (value, min, max, fallback) => {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};
const uid = () => window.crypto?.randomUUID?.() || (`id-${Date.now()}-${Math.random().toString(16).slice(2)}`);

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

const setStatus = (message, type = "") => {
  els.status.textContent = message;
  els.status.className = `status ${type}`.trim();
};

const normSettings = (row) => ({
  event_date: String(row?.event_date || DEFAULT_SETTINGS.event_date).trim() || DEFAULT_SETTINGS.event_date,
  official_name: String(row?.official_name || "").trim() || DEFAULT_SETTINGS.official_name,
  official_url: safeUrl(row?.official_url, true) || DEFAULT_SETTINGS.official_url,
  event_hashtag: String(row?.event_hashtag || "").trim(),
  x_search_url: safeUrl(row?.x_search_url, true) || "",
  live_playlist_url: safeUrl(row?.live_playlist_url, true) || "",
  archive_playlist_url: safeUrl(row?.archive_playlist_url, true) || "",
  entry_close_minutes: clampInt(row?.entry_close_minutes, 5, 120, DEFAULT_SETTINGS.entry_close_minutes),
});

const toDate = (date, time) => (!date || !okTime(time)
  ? null
  : new Date(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)) - 1,
      Number(date.slice(8, 10)),
      Number(time.slice(0, 2)),
      Number(time.slice(3, 5)),
      0,
      0,
    ));

const fmtDate = (value) => {
  if (!value) return "イベント日 未設定";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "イベント日 未設定"
    : new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(date);
};

const fmtSlashDate = (value) => {
  if (!value) return "----/--/--";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? "----/--/--"
    : new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
};

const fmtShort = (date) => (!(date instanceof Date) || Number.isNaN(date.getTime())
  ? "日付未設定"
  : new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", weekday: "short" }).format(date));

const fmtDiff = (ms) => {
  if (ms <= 0) return "まもなく";
  let rest = Math.floor(ms / 1000);
  const days = Math.floor(rest / 86400);
  rest -= days * 86400;
  const hours = Math.floor(rest / 3600);
  rest -= hours * 3600;
  const minutes = Math.floor(rest / 60);
  rest -= minutes * 60;
  return [
    days ? `${days}日` : "",
    days || hours ? `${hours}時間` : "",
    days || hours || minutes ? `${minutes}分` : "",
    `${rest}秒`,
  ].filter(Boolean).join(" ");
};

const isSameCalendarDay = (a, b) => a
  && b
  && a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate();

const icsText = (value) => String(value || "")
  .replaceAll("\\", "\\\\")
  .replace(/\r?\n/g, "\\n")
  .replaceAll(",", "\\,")
  .replaceAll(";", "\\;");

const icsStamp = (date) => (!(date instanceof Date) || Number.isNaN(date.getTime())
  ? ""
  : date.toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z"));

const owner = (item) => (item.kind === "official" ? settings.official_name : String(item.artist || "").trim());
const itemKey = (item) => `${item.kind}:${item.id}`;
const isFavorite = (item) => favorites.has(itemKey(item));
const saveFavorites = () => write(LF, [...favorites]);
const slotLabel = (value) => SLOT_LABELS[Number(value)] || "未設定";

const toggleFavorite = (item) => {
  const key = itemKey(item);
  if (favorites.has(key)) favorites.delete(key);
  else favorites.add(key);
  saveFavorites();
};

const setPlannerStatus = (message) => {
  els.plannerStatus.textContent = message;
};

const badge = (status) => {
  if (status === "approved") return '<span class="badge approved">掲載中</span>';
  if (status === "rejected") return '<span class="badge rejected">差し戻し</span>';
  if (status === "deleted") return '<span class="badge rejected">削除済み</span>';
  return '<span class="badge pending">審査待ち</span>';
};
const isDeletedEntryNotice = (item) => String(item?.status || "") === "deleted" || String(item?.review_note || "").trim() === DELETED_REVIEW_NOTE;
const isEditableRejectedEntry = (item) => String(item?.status || "") === "rejected" && !isDeletedEntryNotice(item);

const link = (url, label, className = "linkbtn") => {
  const resolved = safeUrl(url, true);
  return resolved
    ? `<a class="${className}" href="${esc(resolved)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`
    : '<span class="muted">URLなし</span>';
};

const xSearch = (tag, url) => url || `https://x.com/search?q=${encodeURIComponent(tag)}&src=typed_query`;
const xIntent = (text) => `https://x.com/intent/post?text=${encodeURIComponent(text)}`;

function setAnchorState(element, url, label) {
  element.textContent = label;
  if (url) {
    element.href = url;
    element.classList.remove("is-disabled");
  } else {
    element.href = "#";
    element.classList.add("is-disabled");
  }
}

function setButtonState(element, enabled, label) {
  element.textContent = label;
  element.classList.toggle("is-disabled", !enabled);
}

function flashLabel(element, message) {
  const original = element.dataset.label || element.textContent;
  element.dataset.label = original;
  element.textContent = message;
  setTimeout(() => {
    element.textContent = original;
  }, 1800);
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  return ok;
}

async function sharePayload(payload) {
  try {
    if (navigator.share) {
      await navigator.share(payload);
      return true;
    }
    return await copyText(payload.url || payload.text || "");
  } catch (error) {
    if (error?.name === "AbortError") return false;
    return false;
  }
}

async function api(path, init = {}) {
  const response = await fetch(`${PUBLIC_API_BASE}${path}`, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const type = response.headers.get("content-type") || "";
  const payload = type.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(typeof payload === "string" ? payload : payload?.error || payload?.message || `HTTP ${response.status}`);
  }
  return payload;
}

async function getEntriesDirect() {
  if (shared) {
    const primary = await sb.from(ET)
      .select("id,artist,title,parent_slot,parent_number,start_time,url,note,status,created_at")
      .eq("status", "approved")
      .order("start_time", { ascending: true });
    if (!primary.error) return primary.data || [];
    if (!String(primary.error?.message || "").includes("parent_number")) throw primary.error;
    const fallback = await sb.from(ET)
      .select("id,artist,title,parent_slot,start_time,url,note,status,created_at")
      .eq("status", "approved")
      .order("start_time", { ascending: true });
    if (fallback.error) throw fallback.error;
    return fallback.data || [];
  }
  return read(LE, []);
}

async function getOfficialDirect() {
  if (shared) {
    const { data, error } = await sb.from(OT)
      .select("id,title,start_time,url,note,created_at")
      .order("start_time", { ascending: true });
    if (error) {
      console.warn(error);
      return [];
    }
    return data || [];
  }
  return read(LO, []);
}

async function getSettingsDirect() {
  if (shared) {
    const { data, error } = await sb.from(ST)
      .select("id,event_date,official_name,official_url,event_hashtag,x_search_url,live_playlist_url,archive_playlist_url,entry_close_minutes")
      .eq("id", SID)
      .maybeSingle();
    if (error) {
      console.warn(error);
      return normSettings(read(LS, DEFAULT_SETTINGS));
    }
    return normSettings(data || read(LS, DEFAULT_SETTINGS));
  }
  return normSettings(read(LS, DEFAULT_SETTINGS));
}

async function getSnapshot() {
  if (!previewMode) {
    try {
      const payload = await api("/data");
      sourceMode = "api";
      return {
        entries: payload.entries || [],
        official: payload.official || [],
        settings: normSettings(payload.settings || DEFAULT_SETTINGS),
      };
    } catch (error) {
      if (!shared) throw error;
    }
  }
  if (shared) {
    sourceMode = "supabase";
    const [entries, official, rawSettings] = await Promise.all([
      getEntriesDirect(),
      getOfficialDirect(),
      getSettingsDirect(),
    ]);
    return { entries, official, settings: rawSettings };
  }
  sourceMode = "local";
  return {
    entries: read(LE, []),
    official: read(LO, []),
    settings: normSettings(read(LS, DEFAULT_SETTINGS)),
  };
}

async function addEntry(entry) {
  if (!previewMode) {
    try {
      await api("/entries", { method: "POST", body: JSON.stringify(entry) });
      sourceMode = "api";
      return;
    } catch (error) {
      if (!shared) throw error;
    }
  }
  if (shared) {
    const { error } = await sb.from(ET).insert(entry);
    if (error) {
      if (!String(error.message || "").includes("parent_number")) throw error;
      const legacyEntry = { ...entry };
      delete legacyEntry.parent_number;
      const retry = await sb.from(ET).insert(legacyEntry);
      if (retry.error) throw retry.error;
    }
    sourceMode = "supabase";
    return;
  }
  if (!previewMode) throw new Error("参加登録APIに接続できませんでした。");
  const localEntries = read(LE, []);
  localEntries.push(entry);
  write(LE, localEntries);
  sourceMode = "local";
}

async function updateEntry(entry) {
  if (!previewMode) {
    try {
      await api("/entries", { method: "POST", body: JSON.stringify({ ...entry, action: "update" }) });
      sourceMode = "api";
      return;
    } catch (error) {
      if (!shared) throw error;
    }
  }
  if (shared) {
    const { error } = await sb.from(ET)
      .update({
        artist: entry.artist,
        title: entry.title,
        parent_slot: entry.parent_slot,
        parent_number: entry.parent_number,
        start_time: entry.start_time,
        url: entry.url,
        note: entry.note,
        status: "pending",
      })
      .eq("id", entry.id)
      .eq("status", "rejected");
    if (error) {
      if (!String(error.message || "").includes("parent_number")) throw error;
      const retry = await sb.from(ET)
        .update({
          artist: entry.artist,
          title: entry.title,
          parent_slot: entry.parent_slot,
          start_time: entry.start_time,
          url: entry.url,
          note: entry.note,
          status: "pending",
        })
        .eq("id", entry.id)
        .eq("status", "rejected");
      if (retry.error) throw retry.error;
    }
    sourceMode = "supabase";
    return;
  }
  if (!previewMode) throw new Error("参加登録APIに接続できませんでした。");
  const localEntries = read(LE, []);
  const index = localEntries.findIndex((item) => String(item.id || "") === String(entry.id || ""));
  if (index < 0) throw new Error("修正対象の参加登録が見つかりません。");
  if (String(localEntries[index].status || "") !== "rejected") {
    throw new Error("差し戻し済みの参加登録だけ修正できます。");
  }
  localEntries[index] = {
    ...localEntries[index],
    artist: entry.artist,
    title: entry.title,
    parent_slot: entry.parent_slot,
    parent_number: entry.parent_number,
    start_time: entry.start_time,
    url: entry.url,
    note: entry.note,
    status: "pending",
    review_note: "",
    reviewed_at: null,
  };
  write(LE, localEntries);
  sourceMode = "local";
}

async function getTrackedEntries() {
  if (!previewMode) {
    try {
      const payload = await api("/statuses", {
        method: "POST",
        body: JSON.stringify({ ids: trackedSubmissionIds }),
      });
      return Array.isArray(payload?.entries) ? payload.entries : [];
    } catch (error) {
      if (!shared) return [];
    }
  }
  return trackedSubmissionIds.length
    ? read(LE, []).filter((item) => trackedSubmissionIds.includes(String(item.id || "")))
    : [];
}

const merged = (approved, official, currentSettings) => [
  ...approved.map((item) => ({
    kind: "participant",
    id: item.id,
    title: String(item.title || "").trim(),
    artist: String(item.artist || "").trim(),
    start_time: String(item.start_time || "").trim(),
    parent_slot: Number(item.parent_slot || 0),
    parent_number: Number(item.parent_number || 0),
    url: safeUrl(item.url, true),
    note: String(item.note || "").trim(),
    date: toDate(currentSettings.event_date, item.start_time),
  })),
  ...official.map((item) => ({
    kind: "official",
    id: item.id,
    title: String(item.title || "").trim(),
    artist: currentSettings.official_name,
    start_time: String(item.start_time || "").trim(),
    parent_slot: 0,
    parent_number: 0,
    url: safeUrl(item.url, true),
    note: String(item.note || "").trim(),
    date: toDate(currentSettings.event_date, item.start_time),
  })),
].filter((item) => item.title && okTime(item.start_time))
  .sort((a, b) => mins(a.start_time) - mins(b.start_time) || String(a.title).localeCompare(String(b.title), "ja"));

function buildCalendar(list, name) {
  const now = icsStamp(new Date());
  const rows = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kome Premiere Rush//JP",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(name)}`,
  ];
  list.filter((item) => item.date).forEach((item, index) => {
    const start = item.date;
    const end = new Date(start.getTime() + 60000);
    const desc = [
      `投稿名義: ${owner(item)}`,
      `種別: ${item.kind === "official" ? "公式予定" : "参加動画"}`,
      `開始時刻: ${item.start_time}`,
      item.note ? `補足: ${item.note}` : "",
      item.url ? `視聴URL: ${item.url}` : "",
      "この予定はプレミア開始時刻の目印です。",
    ].filter(Boolean).join("\n");
    rows.push(
      "BEGIN:VEVENT",
      `UID:${icsText(`${itemKey(item)}-${index}@kome-prerush`)}`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsStamp(start)}`,
      `DTEND:${icsStamp(end)}`,
      `SUMMARY:${icsText(item.title)}`,
      `DESCRIPTION:${icsText(desc)}`,
      item.url ? `URL:${icsText(item.url)}` : "",
      "END:VEVENT",
    );
  });
  rows.push("END:VCALENDAR");
  return rows.filter(Boolean).join("\r\n");
}

function downloadCalendar(list, mode) {
  const picks = (mode === "favorites" ? list.filter(isFavorite) : list).filter((item) => item.date);
  if (!picks.length) {
    setPlannerStatus(mode === "favorites" ? "気になる登録した予定がまだありません。" : "保存できる予定がまだありません。");
    return;
  }
  const title = mode === "favorites" ? "米プレラ 気になる予定" : "米プレラ 全予定";
  const fileDate = (settings.event_date || "event").replaceAll("-", "");
  const blob = new Blob([buildCalendar(picks, title)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `kome-prerush-${fileDate}-${mode}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  setPlannerStatus(`${mode === "favorites" ? "気になる予定" : "全予定"}をカレンダー保存しました。`);
}

async function sharePage() {
  const ok = await sharePayload({
    title: document.title,
    text: "米プレラのタイムテーブル",
    url: window.location.href,
  });
  flashLabel(els.copyPage, ok ? "リンクをコピーしました" : "共有を閉じました");
}

async function shareItemByKey(key, button) {
  const item = schedule.find((candidate) => itemKey(candidate) === key);
  if (!item) return;
  const ok = await sharePayload({
    title: item.title,
    text: `${owner(item)} / ${item.start_time} のプレミア予定`,
    url: item.url || window.location.href,
  });
  if (button) flashLabel(button, ok ? "共有しました" : "共有を閉じました");
}

const closestUpcoming = (list) => {
  const now = Date.now();
  return list
    .filter((item) => item.date && item.date.getTime() >= now)
    .sort((a, b) => a.date - b.date)[0] || null;
};

const itemPhase = (item) => {
  if (!item?.date) return { label: "未設定", klass: "past" };
  const delta = item.date.getTime() - Date.now();
  if (delta > 30 * 60 * 1000) return { label: "公開前", klass: "before" };
  if (delta > 0) return { label: "まもなく", klass: "soon" };
  if (delta > -15 * 60 * 1000) return { label: "いま上映中", klass: "live" };
  return { label: "公開済み", klass: "past" };
};

const overlapInfo = (item, list) => {
  const base = mins(item.start_time);
  const others = list.filter((candidate) => itemKey(candidate) !== itemKey(item));
  return {
    same: others.filter((candidate) => mins(candidate.start_time) === base).length,
    nearby: others.filter((candidate) => Math.abs(mins(candidate.start_time) - base) <= 15).length,
  };
};

const matchesSearch = (item) => {
  const query = searchQuery.toLowerCase();
  if (!query) return true;
  const haystack = [
    item.title,
    owner(item),
    item.note,
    item.start_time,
    item.kind === "official" ? "公式予定" : "参加動画",
    item.parent_slot ? slotLabel(item.parent_slot) : "",
  ].join(" ").toLowerCase();
  return haystack.includes(query);
};

const visibleSchedule = (list) => list.filter((item) => {
  const typeOk = filterState === "all"
    || filterState === item.kind
    || (filterState === "favorites" && isFavorite(item));
  const laneOk = !laneFilter || (item.kind === "participant" && String(item.parent_slot) === laneFilter);
  const timeOk = !timeFilter || String(item.start_time || "").startsWith(`${timeFilter.padStart(2, "0")}:`);
  return typeOk && laneOk && timeOk && matchesSearch(item);
});

const syncFilterButtons = () => {
  document.querySelectorAll("[data-filter]").forEach((element) => {
    element.classList.toggle("active", element.dataset.filter === filterState);
  });
};

function drawTimeline(list) {
  const shown = visibleSchedule(list);
  const closest = closestUpcoming(shown.length ? shown : list);
  els.timeline.innerHTML = shown.length
    ? shown.map((item) => {
      const phase = itemPhase(item);
      const overlap = overlapInfo(item, list);
      const overlapText = overlap.same
        ? `同時刻 ${String(overlap.same + 1)}本`
        : overlap.nearby
          ? `前後15分に ${String(overlap.nearby)}本`
          : "被り少なめ";
      return `<article class="item${closest && closest.id === item.id && closest.kind === item.kind ? " upcoming" : ""}" data-item-key="${esc(itemKey(item))}">
        <div class="timebox">
          <strong>${esc(item.start_time)}</strong>
          <span>${esc(item.date ? fmtShort(item.date) : "イベント日未設定")}</span>
          <span class="small">${esc(phase.label)}</span>
        </div>
        <div>
          <div class="tags">
            <span class="tag ${item.kind === "official" ? "official" : "participant"}">${item.kind === "official" ? "公式予定" : "参加動画"}</span>
            <span class="tag neutral">${item.kind === "official" ? "公式" : esc(slotLabel(item.parent_slot))}</span>
            ${item.kind === "participant" && parentLabel(item.parent_number) ? `<span class="tag neutral">${esc(parentLabel(item.parent_number))}</span>` : ""}
            <span class="view-badge ${phase.klass}">${esc(phase.label)}</span>
            <span class="tag neutral">${esc(overlapText)}</span>
          </div>
          <h3>${esc(item.title)}</h3>
          <p class="owner">${esc(owner(item))}</p>
          <p class="desc">${esc(item.note) || "補足はまだありません。"}</p>
          <p class="mini-note">${item.url ? "動画ページで「通知を受け取る」を押せます。" : "URL準備中です。"}</p>
        </div>
        <div class="item-actions">
          ${link(item.url, "今見る")}
          ${link(item.url, "通知を受け取る", "mini-btn")}
          <button type="button" class="mini-btn" data-share-item="${esc(itemKey(item))}">共有</button>
          <button type="button" class="fav-btn${isFavorite(item) ? " active" : ""}" data-favorite-toggle="${esc(itemKey(item))}">${isFavorite(item) ? "気になる済み" : "気になる"}</button>
        </div>
      </article>`;
    }).join("")
    : '<div class="empty">この条件の公開予定はまだありません。</div>';

  document.querySelectorAll("[data-favorite-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const key = event.currentTarget.dataset.favoriteToggle;
      const hit = schedule.find((item) => itemKey(item) === key);
      if (!hit) return;
      toggleFavorite(hit);
      drawTimeline(schedule);
      drawFavoritePreview(schedule);
      drawSearchSummary(schedule);
    });
  });

  document.querySelectorAll("[data-share-item]").forEach((button) => {
    button.addEventListener("click", (event) => shareItemByKey(event.currentTarget.dataset.shareItem, event.currentTarget));
  });

  window.refreshSiteMotion?.(els.timeline);
}

function getEditableEntry() {
  return trackedEntriesCache.find((item) => String(item.id || "") === editingEntryId && isEditableRejectedEntry(item)) || null;
}

function applyEntryFormMode() {
  const editing = getEditableEntry();
  if (editing) {
    const reason = String(editing.review_note || "").trim();
    els.entryFormMode.textContent = reason
      ? `差し戻し理由を反映して修正できます。理由: ${reason}`
      : "差し戻し内容を修正して再申請できます。";
    els.entryFormMode.className = "note form-mode is-editing";
    els.entrySubmit.textContent = "修正して再申請";
    els.entryReset.textContent = "編集をやめる";
    return;
  }
  editingEntryId = "";
  els.entryFormMode.textContent = "プレミア公開を予約してから内容を送信してください。";
  els.entryFormMode.className = "note form-mode";
  els.entrySubmit.textContent = "参加登録を送信";
  els.entryReset.textContent = "入力をリセット";
}

function resetEntryForm({ keepStatus = false } = {}) {
  editingEntryId = "";
  els.form.reset();
  els.parentSlot.value = "1";
  els.parentNumber.value = "1";
  els.startTime.value = "19:00";
  window.syncCustomPickers?.(els.form);
  updateEntryHelper();
  applyEntryFormMode();
  if (!keepStatus) setStatus("");
}

function loadEntryIntoForm(entry) {
  els.artist.value = String(entry.artist || "");
  els.titleInput.value = String(entry.title || "");
  els.parentSlot.value = String(entry.parent_slot || "1");
  els.parentNumber.value = String(entry.parent_number || "1");
  els.startTime.value = String(entry.start_time || "19:00");
  els.urlInput.value = String(entry.url || "");
  els.noteInput.value = String(entry.note || "");
  window.syncCustomPickers?.(els.form);
  updateEntryHelper();
}

function startEditingEntry(id) {
  const entry = trackedEntriesCache.find((item) => String(item.id || "") === String(id || "") && isEditableRejectedEntry(item));
  if (!entry) return;
  editingEntryId = entry.id;
  loadEntryIntoForm(entry);
  applyEntryFormMode();
  setStatus("差し戻し内容を修正して、もう一度送信できます。");
  els.form.scrollIntoView({ behavior: "smooth", block: "start" });
  els.titleInput.focus({ preventScroll: true });
}

function bindCardToggles(scope) {
  scope.querySelectorAll("[data-card-toggle]").forEach((card) => {
    const toggle = () => {
      const details = card.querySelector(".stack-card-details");
      if (!details) return;
      const expanded = card.getAttribute("aria-expanded") === "true";
      details.hidden = expanded;
      card.classList.toggle("is-expanded", !expanded);
      card.setAttribute("aria-expanded", String(!expanded));
      const label = card.querySelector(".stack-card-hint");
      if (label) label.textContent = expanded ? "クリックで詳細" : "クリックで閉じる";
    };
    card.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) return;
      toggle();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggle();
    });
  });
}

function drawPending(entries, trackedEntries = []) {
  const renderRows = (items, showActions = false) => items
    .sort((a, b) => Number(a.parent_slot) - Number(b.parent_slot) || mins(a.start_time) - mins(b.start_time))
    .map((item) => {
      const reviewNote = String(item.review_note || "").trim();
      const deletedNotice = isDeletedEntryNotice(item);
      const reviewLabel = reviewNote
        || (deletedNotice ? DELETED_REVIEW_NOTE : "")
        || (item.status === "rejected" ? "差し戻し理由は管理側で設定されます。" : "");
      const isRejected = isEditableRejectedEntry(item);
      const detailParts = [];
      if (String(item.note || "").trim()) {
        detailParts.push(`<div><p class="stack-detail-label">補足</p><p class="stack-detail-value">${esc(item.note)}</p></div>`);
      }
      if (reviewLabel) {
        detailParts.push(`<div><p class="stack-detail-label">審査メモ</p><p class="stack-detail-value">${esc(reviewLabel)}</p></div>`);
      }
      if (showActions && isRejected) {
        detailParts.push(`<div><p class="stack-detail-label">操作</p><div class="stack-card-action-group"><button type="button" class="ghost table-edit-btn" data-edit-entry="${esc(item.id)}">修正して再申請</button></div></div>`);
      }
      const titleHtml = `<div class="stack-card-title${detailParts.length ? "" : " is-static"}"><span class="stack-card-title-text">${esc(item.title)}</span></div>`;
      const summaryHtml = `<div class="stack-card-summary"><div class="stack-summary-item"><span class="stack-summary-label">開始</span><span class="stack-summary-value stack-time">${esc(item.start_time)}</span></div><div class="stack-summary-item"><span class="stack-summary-label">枠</span><span class="stack-summary-value">${esc(slotLabel(item.parent_slot))}</span></div><div class="stack-summary-item"><span class="stack-summary-label">親</span><span class="stack-summary-value">${esc(parentLabel(item.parent_number) || "未設定")}</span></div><div class="stack-summary-item"><span class="stack-summary-label">名義</span><span class="stack-summary-value">${esc(item.artist)}</span></div></div>`;
      const urlButton = safeUrl(item.url, true)
        ? `<a class="stack-card-link" href="${esc(safeUrl(item.url, true))}" target="_blank" rel="noopener noreferrer">YouTubeへ</a>`
        : '<span class="muted">URLなし</span>';
      return `<tr class="stack-card-row"><td colspan="10"><article class="stack-card${detailParts.length ? " is-toggleable" : ""}"${detailParts.length ? ' data-card-toggle tabindex="0" role="button" aria-expanded="false"' : ""}><div class="stack-card-head"><div class="stack-card-status">${deletedNotice ? '<span class="badge rejected">削除済み</span>' : badge(item.status || "approved")}</div>${detailParts.length ? '<span class="stack-card-hint">クリックで詳細</span>' : ""}</div><div class="stack-card-main"><p class="stack-field-label">曲名</p>${titleHtml}</div>${summaryHtml}<div class="stack-card-footer">${urlButton}</div>${detailParts.length ? `<div class="stack-card-details" hidden>${detailParts.join("")}</div>` : ""}</article></td></tr>`;
    }).join("");

  const tracked = trackedEntries.filter((item) => item && item.id);
  const latestReviewUpdate = [...tracked]
    .filter((item) => String(item.status || "") === "rejected" || isDeletedEntryNotice(item))
    .sort((a, b) => new Date(b.reviewed_at || b.created_at || 0) - new Date(a.reviewed_at || a.created_at || 0))[0] || null;

  if (latestReviewUpdate && isDeletedEntryNotice(latestReviewUpdate)) {
    els.entryReviewNotice.textContent = String(latestReviewUpdate.review_note || DELETED_REVIEW_NOTE).trim();
  } else if (latestReviewUpdate?.status === "rejected") {
    els.entryReviewNotice.textContent = `差し戻しがありました。理由: ${String(latestReviewUpdate.review_note || "内容を確認して再申請してください。").trim()}`;
  } else if (tracked.length) {
    els.entryReviewNotice.textContent = "この端末から送った参加登録の状態を表示しています。差し戻しがあった場合はここに理由も表示されます。";
  } else {
    els.entryReviewNotice.textContent = "この端末から送った参加登録の状態、または掲載済みの参加動画をここに表示します。ほかの未掲載申請は公開しません。";
  }

  if (sourceMode === "local") {
    const pendingLocal = entries.filter((item) => item.status !== "approved");
    els.pending.innerHTML = pendingLocal.length
      ? renderRows([...pendingLocal], true)
      : '<tr><td colspan="10" class="empty">まだ登録はありません。</td></tr>';
  } else if (tracked.length) {
    els.pending.innerHTML = renderRows([...tracked], true);
  } else {
    const approvedPreview = approvedEntries.slice(0, 8).map((item) => ({ ...item, status: "approved" }));
    els.pending.innerHTML = approvedPreview.length
      ? renderRows(approvedPreview, false)
      : '<tr><td colspan="10" class="empty">この端末から送った参加登録はまだありません。送信後はここで状態を確認できます。</td></tr>';
  }

  bindCardToggles(els.pending);
  document.querySelectorAll("[data-edit-entry]").forEach((button) => {
    button.addEventListener("click", (event) => startEditingEntry(event.currentTarget.dataset.editEntry));
  });
}

function drawFavoritePreview(list) {
  const picks = list.filter(isFavorite).sort((a, b) => mins(a.start_time) - mins(b.start_time));
  els.favoriteCount.textContent = String(picks.length);
  els.favoritePreview.innerHTML = picks.length
    ? picks.slice(0, 4).map((item) => `<div class="plan-item"><strong>${esc(item.start_time)} / ${esc(item.title)}</strong><span class="small">${esc(owner(item))}</span></div>`).join("")
    : '<div class="plan-item"><span class="muted">まだ気になる登録はありません。</span></div>';
  window.refreshSiteMotion?.(els.favoritePreview);
}

function drawSearchSummary(list) {
  const shown = visibleSchedule(list);
  const parts = [];
  if (searchQuery) parts.push(`検索「${searchQuery}」`);
  if (filterState !== "all") parts.push(filterState === "participant" ? "参加動画" : filterState === "official" ? "公式予定" : "気になる");
  if (laneFilter) parts.push(slotLabel(laneFilter));
  if (timeFilter) parts.push(`${timeFilter}時台`);
  els.searchSummary.textContent = `${parts.length ? parts.join(" / ") : "すべて"} で ${shown.length} 件表示中`;
}

function drawEventState(currentSettings) {
  const start = toDate(currentSettings.event_date, "19:00");
  if (!start) {
    els.eventState.textContent = "未設定";
    els.eventState.className = "state-chip after";
    els.eventStateDetail.textContent = "開催日が未設定です。";
    return;
  }
  const end = new Date(start.getTime() + (5 * 60 * 60 * 1000));
  const now = Date.now();
  let label = "開催前";
  let klass = "before";
  let detail = `${fmtDate(currentSettings.event_date)} 19:00 開始予定です。`;
  if (now >= start.getTime() && now < end.getTime()) {
    label = "開催中";
    klass = "live";
    detail = "ただいま 19:00〜24:00 の公開時間帯です。タイムテーブルからそのまま視聴準備できます。";
  } else if (now >= end.getTime()) {
    label = "終了";
    klass = "after";
    detail = "この日の公開時間帯は終了しています。見返したい予定は URL や再生リストから確認できます。";
  }
  els.eventState.textContent = label;
  els.eventState.className = `state-chip ${klass}`;
  els.eventStateDetail.textContent = detail;
}

function drawCommunity(currentSettings) {
  const tag = currentSettings.event_hashtag;
  els.rulesDateText.textContent = fmtDate(currentSettings.event_date);
  if (tag) {
    els.hashtagChip.textContent = tag;
    els.hashtagText.textContent = `${tag} で告知や感想を追えます。`;
    els.rulesTagText.textContent = `${tag} を付けて感想や告知を共有できます。`;
    setAnchorState(els.tagSearch, xSearch(tag, currentSettings.x_search_url), "Xでタグを見る");
    setAnchorState(els.tagPost, xIntent(`${tag} 米プレラを視聴中`), "感想を投稿");
  } else {
    els.hashtagChip.textContent = "タグ準備中";
    els.hashtagText.textContent = "感想や告知に使うタグをここに掲載します。";
    els.rulesTagText.textContent = "感想や告知に使うタグは運営設定後にここへ反映されます。";
    setAnchorState(els.tagSearch, "", "Xでタグを見る");
    setAnchorState(els.tagPost, "", "感想を投稿");
  }
  setAnchorState(els.livePlaylist, currentSettings.live_playlist_url, "公式投稿用プレイリスト");
  setAnchorState(els.archivePlaylist, currentSettings.archive_playlist_url, "プレラプレイリスト");
  els.playlistNote.textContent = currentSettings.live_playlist_url || currentSettings.archive_playlist_url
    ? "公式投稿用とプレラ全体のプレイリスト導線をまとめています。"
    : "再生リスト URL が設定されるとここから飛べます。";
}

function drawSummary(approved, official, all, currentSettings) {
  const label = fmtDate(currentSettings.event_date);
  els.approved.textContent = String(approved.length);
  els.official.textContent = String(official.length);
  els.total.textContent = String(all.length);
  els.dateChip.textContent = label;
  els.eventDateText.textContent = label;
  els.heroDate.textContent = fmtSlashDate(currentSettings.event_date);
  els.leadDate.textContent = label;
  els.eventNote.textContent = `${label} のタイムテーブルを表示中です。`;
  if (currentSettings.official_url) els.channelLink.href = currentSettings.official_url;
  els.channelLink.textContent = `${currentSettings.official_name} を見る`;
  drawEventState(currentSettings);
  drawCommunity(currentSettings);
  drawFavoritePreview(all);
  drawSearchSummary(all);
}

function drawNext() {
  const participantSchedule = schedule.filter((item) => item.kind === "participant");
  if (!participantSchedule.length) {
    currentNextKey = "";
    els.nextTime.textContent = "--";
    els.nextText.textContent = "参加動画を準備中";
    els.nextMeta1.textContent = "承認済みの参加作品がここに並びます";
    els.nextMeta2.textContent = "開始時刻と枠をここに表示します";
    els.nextKind.textContent = "承認待ちの参加動画があります";
    els.nextOverlap.textContent = "参加動画の公開時刻が近づくとここに残り時間を表示します。";
    els.nextState.textContent = "公開前";
    els.nextState.className = "view-badge before";
    setAnchorState(els.nextWatch, "", "今すぐ開く");
    setAnchorState(els.nextNotify, "", "通知を受け取る");
    setButtonState(els.nextShare, false, "この予定を共有");
    setAnchorState(els.dockWatch, "#timetable", "今見る");
    return;
  }

  const upcoming = closestUpcoming(participantSchedule);
  if (!upcoming) {
    currentNextKey = "";
    els.nextTime.textContent = "公開済み";
    els.nextText.textContent = "参加動画はすべて公開済みです";
    els.nextMeta1.textContent = fmtDate(settings.event_date);
    els.nextMeta2.textContent = "見逃した作品は再生リストや各 URL からどうぞ";
    els.nextKind.textContent = "参加動画は終了";
    els.nextOverlap.textContent = "見逃した作品は後追い用の導線から追えます。";
    els.nextState.textContent = "公開済み";
    els.nextState.className = "view-badge past";
    setAnchorState(els.nextWatch, settings.archive_playlist_url || "", "後追いを開く");
    setAnchorState(els.nextNotify, "", "通知を受け取る");
    setButtonState(els.nextShare, false, "この予定を共有");
    setAnchorState(els.dockWatch, settings.archive_playlist_url || "#timetable", "今見る");
    return;
  }

  currentNextKey = itemKey(upcoming);
  const phase = itemPhase(upcoming);
  const overlap = overlapInfo(upcoming, schedule);
  els.nextTime.textContent = fmtDiff(upcoming.date.getTime() - Date.now());
  els.nextText.textContent = upcoming.title;
  els.nextMeta1.textContent = owner(upcoming);
  els.nextMeta2.textContent = `${upcoming.start_time} 開始予定 / ${slotLabel(upcoming.parent_slot)}${parentLabel(upcoming.parent_number) ? ` / ${parentLabel(upcoming.parent_number)}` : ""}`;
  els.nextKind.textContent = "承認済みの参加動画";
  els.nextState.textContent = phase.label;
  els.nextState.className = `view-badge ${phase.klass}`;
  els.nextOverlap.textContent = overlap.same
    ? `同時刻に ${String(overlap.same + 1)} 本あります。複数タブで先に開いておくと安心です。`
    : overlap.nearby
      ? `前後15分に ${String(overlap.nearby)} 本あります。被りが気になるなら先に通知設定をしておくと追いやすいです。`
      : "この時間帯は比較的追いやすいです。";
  setAnchorState(els.nextWatch, upcoming.url, "今すぐ開く");
  setAnchorState(els.nextNotify, upcoming.url, "通知を受け取る");
  setButtonState(els.nextShare, !!(upcoming.url || window.location.href), "この予定を共有");
  setAnchorState(els.dockWatch, upcoming.url || "#timetable", "今見る");
}

function entryDeadlineInfo(time) {
  const closeMin = settings.entry_close_minutes;
  if (!settings.event_date || !okTime(time)) {
    return { locked: false, text: `登録締切は開始の ${closeMin} 分前です。` };
  }
  const target = toDate(settings.event_date, time);
  if (!target) {
    return { locked: false, text: `登録締切は開始の ${closeMin} 分前です。` };
  }
  const deadline = new Date(target.getTime() - (closeMin * 60000));
  const now = new Date();
  if (now.getTime() >= deadline.getTime()) {
    return { locked: true, text: `この開始時刻は開始 ${closeMin} 分前を過ぎているため登録できません。` };
  }
  if (isSameCalendarDay(now, target)) {
    return { locked: false, text: `この開始時刻の登録締切まで ${fmtDiff(deadline.getTime() - now.getTime())}。` };
  }
  return { locked: false, text: `登録締切は開始の ${closeMin} 分前です。${time} の場合は開始 ${closeMin} 分前が目安です。` };
}

function recommendTimes(lane, targetMinute) {
  const sameLane = approvedEntries.filter((item) => Number(item.parent_slot) === Number(lane));
  const picks = [];
  const seen = new Set();
  for (let offset = 0; offset <= 30 && picks.length < 3; offset += 1) {
    [targetMinute - offset, targetMinute + offset].forEach((candidate) => {
      if (candidate < 19 * 60 || candidate > (23 * 60) + 59 || seen.has(candidate) || picks.length >= 3) return;
      seen.add(candidate);
      const ok = sameLane.every((item) => Math.abs(mins(item.start_time) - candidate) >= 1);
      if (ok) {
        const hour = String(Math.floor(candidate / 60)).padStart(2, "0");
        const minute = String(candidate % 60).padStart(2, "0");
        picks.push(`${hour}:${minute}`);
      }
    });
  }
  return picks;
}

function updatePromoTemplate() {
  const artist = String(els.artist.value || "").trim() || "投稿名義";
  const title = String(els.titleInput.value || "").trim() || "動画タイトル";
  const parent = parentLabel(els.parentNumber.value);
  const time = String(els.startTime.value || "").trim() || "19:00";
  const url = safeUrl(els.urlInput.value, true) || "";
  const tag = settings.event_hashtag ? `\n${settings.event_hashtag}` : "";
  const lines = [
    `${fmtDate(settings.event_date)} の米プレラに ${artist} 名義で参加予定です。`,
    `${time} から「${title}」を ${slotLabel(els.parentSlot.value)} / ${parent || "親未設定"} でプレミア公開します。`,
    url,
  ].filter(Boolean);
  els.promoTemplate.value = `${lines.join("\n")}${tag}`.trim();
}

function updateEntryHelper() {
  const lane = Number(els.parentSlot.value || 0);
  const time = String(els.startTime.value || "").trim();
  const targetMinute = mins(time);
  const deadline = entryDeadlineInfo(time);
  els.entryDeadlineText.textContent = deadline.text;

  if (!lane || !okTime(time)) {
    els.spacingAdviceText.textContent = "枠と時刻を選ぶと、前後の予定との距離をここに表示します。";
    els.suggestTimesText.textContent = "おすすめの空き候補をここに表示します。";
    updatePromoTemplate();
    return;
  }

  const sameLane = approvedEntries
    .filter((item) => Number(item.parent_slot) === lane)
    .sort((a, b) => mins(a.start_time) - mins(b.start_time));
  const previous = sameLane.filter((item) => mins(item.start_time) < targetMinute).slice(-1)[0] || null;
  const next = sameLane.find((item) => mins(item.start_time) > targetMinute) || null;
  const exact = sameLane.find((item) => mins(item.start_time) === targetMinute) || null;
  const nearby = schedule.filter((item) => Math.abs(mins(item.start_time) - targetMinute) <= 15);

  if (exact) {
    els.spacingAdviceText.textContent = "同じ枠・同じ時刻に掲載中の動画があります。別時刻を選んでください。";
  } else {
    const prevText = previous
      ? `直前は ${previous.start_time}（${Math.abs(targetMinute - mins(previous.start_time))}分差）`
      : "直前は空いています";
    const nextText = next
      ? `直後は ${next.start_time}（${Math.abs(mins(next.start_time) - targetMinute)}分差）`
      : "直後は空いています";
    els.spacingAdviceText.textContent = `${prevText} / ${nextText}。前後15分には ${nearby.length} 件あります。`;
  }

  const picks = recommendTimes(lane, targetMinute);
  els.suggestTimesText.textContent = picks.length
    ? `近い空き候補: ${picks.join(" / ")}`
    : "近い候補は見つかりませんでした。";
  updatePromoTemplate();
}

async function copyPromoTemplate() {
  const ok = await copyText(els.promoTemplate.value || "");
  flashLabel(els.copyPromo, ok ? "コピーしました" : "コピーできませんでした");
}

async function render() {
  const snapshot = await getSnapshot();
  const entries = snapshot.entries || [];
  const official = snapshot.official || [];
  trackedEntriesCache = (await getTrackedEntries()).filter(Boolean);
  settings = normSettings(snapshot.settings || DEFAULT_SETTINGS);
  approvedEntries = entries
    .filter((item) => item.status === "approved")
    .sort((a, b) => Number(a.parent_slot) - Number(b.parent_slot) || mins(a.start_time) - mins(b.start_time));
  const officialSchedule = official
    .filter((item) => String(item?.title || "").trim())
    .sort((a, b) => mins(a.start_time) - mins(b.start_time));

  if (editingEntryId && !getEditableEntry()) {
    editingEntryId = "";
  }

  schedule = merged(approvedEntries, officialSchedule, settings);
  drawTimeline(schedule);
  drawPending(entries, trackedEntriesCache);
  drawSummary(approvedEntries, officialSchedule, schedule, settings);
  drawNext();
  applyEntryFormMode();
  updateEntryHelper();
}

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", (event) => {
    filterState = event.currentTarget.dataset.filter;
    syncFilterButtons();
    drawTimeline(schedule);
    drawSearchSummary(schedule);
  });
});

els.search.addEventListener("input", (event) => {
  searchQuery = String(event.currentTarget.value || "").trim();
  drawTimeline(schedule);
  drawSearchSummary(schedule);
});

els.laneFilter.addEventListener("change", (event) => {
  laneFilter = String(event.currentTarget.value || "").trim();
  drawTimeline(schedule);
  drawSearchSummary(schedule);
});

els.timeFilter.addEventListener("change", (event) => {
  timeFilter = String(event.currentTarget.value || "").trim();
  drawTimeline(schedule);
  drawSearchSummary(schedule);
});

els.clearSearch.addEventListener("click", () => {
  searchQuery = "";
  laneFilter = "";
  timeFilter = "";
  filterState = "all";
  els.search.value = "";
  els.laneFilter.value = "";
  els.timeFilter.value = "";
  window.syncCustomPickers?.(document);
  syncFilterButtons();
  drawTimeline(schedule);
  drawSearchSummary(schedule);
});

els.jumpUpcoming.addEventListener("click", () => {
  const target = els.timeline.querySelector(".item.upcoming") || els.timeline.querySelector(".item");
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.animate?.(
    [{ transform: "scale(1)" }, { transform: "scale(1.01)" }, { transform: "scale(1)" }],
    { duration: 420, easing: "ease-out" },
  );
});

els.copyPage.addEventListener("click", sharePage);
els.nextShare.addEventListener("click", () => {
  if (currentNextKey && !els.nextShare.classList.contains("is-disabled")) {
    shareItemByKey(currentNextKey, els.nextShare);
  }
});
els.downloadFavorites.addEventListener("click", () => downloadCalendar(schedule, "favorites"));
els.downloadAll.addEventListener("click", () => downloadCalendar(schedule, "all"));
els.copyPromo.addEventListener("click", copyPromoTemplate);

[els.artist, els.titleInput, els.parentSlot, els.parentNumber, els.startTime, els.urlInput, els.noteInput].forEach((element) => {
  element.addEventListener("input", updateEntryHelper);
});

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");

  const formData = new FormData(els.form);
  const artist = String(formData.get("artist") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const parent = Number(formData.get("parentSlot") || 0);
  const parentNumber = Number(formData.get("parentNumber") || 0);
  const time = String(formData.get("startTime") || "").trim();
  const url = safeUrl(formData.get("url"));
  const note = String(formData.get("note") || "").trim();
  const deadline = entryDeadlineInfo(time);
  const editing = getEditableEntry();

  if (!artist || !title || !parent || !time || !url) {
    setStatus("必須項目を入力してね。", "err");
    return;
  }
  if (!(parent >= 1 && parent <= 12)) {
    setStatus("枠は表示されている選択肢から選んでね。", "err");
    return;
  }
  if (!(parentNumber >= 1 && parentNumber <= 5)) {
    setStatus("親は 1〜5 から選んでね。", "err");
    return;
  }
  if (!okTime(time)) {
    setStatus("時間の形式が正しくないよ。", "err");
    return;
  }
  if (!editing && deadline.locked) {
    setStatus(deadline.text, "err");
    return;
  }

  const collision = approvedEntries.find((item) => (
    Number(item.parent_slot) === parent
    && String(item.start_time) === time
    && String(item.id || "") !== String(editing?.id || "")
  ));
  if (collision) {
    setStatus("その枠・時間にはすでに掲載済みの動画があるよ。", "err");
    return;
  }

  try {
    if (editing) {
      await updateEntry({
        id: editing.id,
        artist,
        title,
        parent_slot: parent,
        parent_number: parentNumber,
        start_time: time,
        url,
        note,
      });
      rememberTrackedSubmission(editing.id);
      resetEntryForm({ keepStatus: true });
      setStatus("修正内容を再申請したよ。もう一度確認されます。", "ok");
    } else {
      const entry = {
        id: uid(),
        artist,
        title,
        parent_slot: parent,
        parent_number: parentNumber,
        start_time: time,
        url,
        note,
        status: "pending",
        created_at: new Date().toISOString(),
      };
      await addEntry(entry);
      rememberTrackedSubmission(entry.id);
      resetEntryForm({ keepStatus: true });
      setStatus("参加登録を送信したよ。確認が通るとタイムテーブルに載ります。", "ok");
    }
    await render();
  } catch (error) {
    setStatus(`送信に失敗したよ: ${error.message || error}`, "err");
  }
});

els.entryReset.addEventListener("click", () => {
  const wasEditing = Boolean(getEditableEntry());
  resetEntryForm({ keepStatus: true });
  setStatus(wasEditing ? "編集をやめました。" : "");
});

els.dockJump.addEventListener("click", () => els.jumpUpcoming.click());
els.dockFavorite.addEventListener("click", () => {
  filterState = "favorites";
  syncFilterButtons();
  drawTimeline(schedule);
  drawSearchSummary(schedule);
  document.getElementById("timetable").scrollIntoView({ behavior: "smooth", block: "start" });
});

render().catch((error) => setStatus(`読み込みに失敗したよ: ${error.message || error}`, "err"));
setInterval(() => {
  drawNext();
  drawEventState(settings);
}, 1000);
