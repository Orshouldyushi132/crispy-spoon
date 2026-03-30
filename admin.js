const API_BASE = "/api/admin";
const DEF = { event_date: "2026-08-18", official_name: "全てお米の所為です。", official_url: "https://www.youtube.com/@or_should_rice", event_hashtag: "", x_search_url: "", live_playlist_url: "", archive_playlist_url: "", entry_close_minutes: 15 };
const $ = (id) => document.getElementById(id);
const els = {
  page: $("pageStatus"),
  app: $("adminApp"),
  authStatus: $("authStatus"),
  authState: $("authState"),
  authHint: $("authHint"),
  authUser: $("authUser"),
  discordConnect: $("discordConnectBtn"),
  refreshSession: $("refreshSessionBtn"),
  signOut: $("signOutBtn"),
  reviewPassword: $("reviewPassword"),
  unlockReview: $("unlockReviewBtn"),
  discordAccountName: $("discordAccountName"),
  discordAccountMeta: $("discordAccountMeta"),
  reviewerIdentity: $("reviewerIdentity"),
  setForm: $("settingsForm"),
  offForm: $("officialForm"),
  setStatus: $("settingsStatus"),
  offStatus: $("officialStatus"),
  admin: $("adminBody"),
  official: $("officialBody"),
  sumDate: $("sumDate"),
  sumPending: $("sumPending"),
  sumOfficial: $("sumOfficial"),
};
const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const okTime = (value) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || ""));
const mins = (value) => okTime(value) ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5)) : 1e9;
const clampInt = (value, min, max, fallback) => {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};
const uid = () => window.crypto?.randomUUID?.() || (`id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const safeUrl = (value, allowEmpty = false) => {
  const text = String(value || "").trim();
  if (!text) return allowEmpty ? "" : null;
  try {
    const url = new URL(text);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
};
let sessionState = null;
let sessionInfo = { discordConfigured: true, missingDiscordEnv: [] };
let appReady = false;
let lastRefreshKey = "";

function setMsg(el, message, type = "") {
  if (!el) return;
  el.textContent = message;
  el.className = `status ${type}`.trim();
}

function setAuthBadge(label, type = "pending") {
  els.authState.textContent = label;
  els.authState.className = `badge ${type}`;
}

function formatMissingDiscordEnv(list) {
  return Array.isArray(list) && list.length
    ? list.join(" / ")
    : "ADMIN_SESSION_SECRET / DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET";
}

function formatDate(value) {
  if (!value) return "未設定";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "未設定" : new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", weekday: "short" }).format(date);
}

function statusBadge(status) {
  if (status === "approved") return '<span class="badge approved">掲載中</span>';
  if (status === "rejected") return '<span class="badge rejected">差し戻し</span>';
  return '<span class="badge pending">審査待ち</span>';
}

async function api(path, init = {}) {
  const options = {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  };
  const response = await fetch(`${API_BASE}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === "string" ? payload : payload.error || payload.message || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

async function postJson(path, body) {
  return api(path, { method: "POST", body: JSON.stringify(body) });
}

function fillSettings(settings) {
  $("eventDate").value = settings.event_date || "";
  $("officialName").value = settings.official_name || DEF.official_name;
  $("officialUrl").value = settings.official_url || DEF.official_url;
  $("eventHashtag").value = settings.event_hashtag || "";
  $("xSearchUrl").value = settings.x_search_url || "";
  $("livePlaylistUrl").value = settings.live_playlist_url || "";
  $("archivePlaylistUrl").value = settings.archive_playlist_url || "";
  $("entryCloseMinutes").value = String(settings.entry_close_minutes || DEF.entry_close_minutes);
}

function drawSummary(entries, official, settings) {
  els.sumDate.textContent = formatDate(settings.event_date);
  els.sumPending.textContent = String(entries.filter((item) => item.status === "pending").length);
  els.sumOfficial.textContent = String(official.length);
}

function drawOfficial(list) {
  const items = [...list].sort((a, b) => mins(a.start_time) - mins(b.start_time));
  els.official.innerHTML = items.length
    ? items.map((item) => `<tr><td class="t" data-label="時間">${esc(item.start_time)}</td><td data-label="タイトル"><span class="song">${esc(item.title)}</span></td><td data-label="URL">${safeUrl(item.url, true) ? `<a class="url" href="${esc(safeUrl(item.url, true))}" target="_blank" rel="noopener noreferrer">${esc(safeUrl(item.url, true))}</a>` : '<span class="small">URL未設定</span>'}</td><td data-label="補足">${esc(item.note) || "—"}</td><td data-label="操作"><button class="delete" data-odel="${esc(item.id)}">削除</button></td></tr>`).join("")
    : '<tr><td colspan="5" class="empty">まだ公式予定はありません。</td></tr>';
  document.querySelectorAll("[data-odel]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      if (!sessionState?.reviewUnlocked) return;
      if (!confirm("この公式予定を削除する？")) return;
      try {
        await postJson("/official", { action: "delete", id: event.currentTarget.dataset.odel });
        setMsg(els.offStatus, "公式予定を削除したよ。", "ok");
        await refresh(true);
      } catch (error) {
        setMsg(els.offStatus, `削除に失敗したよ: ${error.message || error}`, "err");
      }
    });
  });
}

function drawEntries(list) {
  const items = [...list].sort((a, b) => Number(a.parent_slot) - Number(b.parent_slot) || mins(a.start_time) - mins(b.start_time));
  els.admin.innerHTML = items.length
    ? items.map((item) => `<tr><td data-label="状態">${statusBadge(item.status)}</td><td class="t" data-label="レーン">レーン${esc(item.parent_slot)}</td><td class="t" data-label="時間">${esc(item.start_time)}</td><td data-label="タイトル"><span class="song">${esc(item.title)}</span></td><td data-label="名義">${esc(item.artist)}</td><td data-label="URL">${safeUrl(item.url, true) ? `<a class="url" href="${esc(safeUrl(item.url, true))}" target="_blank" rel="noopener noreferrer">${esc(safeUrl(item.url, true))}</a>` : '<span class="small">URLなし</span>'}</td><td data-label="補足">${esc(item.note) || "—"}</td><td data-label="差し戻し理由">${esc(item.review_note || "") || "—"}</td><td data-label="操作"><button class="approve" data-act="approve" data-id="${esc(item.id)}">掲載</button> <button class="reject" data-act="reject" data-id="${esc(item.id)}">差し戻し</button> <button class="delete" data-act="delete" data-id="${esc(item.id)}">削除</button></td></tr>`).join("")
    : '<tr><td colspan="9" class="empty">まだ参加登録はありません。</td></tr>';
  document.querySelectorAll("[data-act]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      if (!sessionState?.reviewUnlocked) return;
      const { act, id } = event.currentTarget.dataset;
      const currentItem = items.find((item) => item.id === id) || null;
      try {
        if (act === "approve") {
          await postJson("/entries", { action: "status", id, status: "approved", review_note: "" });
          setMsg(els.page, "掲載したよ。", "ok");
        } else if (act === "reject") {
          const reviewNote = prompt("差し戻し理由を入力してください。申請者側にもこの内容が表示されます。", String(currentItem?.review_note || ""));
          if (reviewNote === null) return;
          if (!String(reviewNote).trim()) {
            setMsg(els.page, "差し戻し理由を入力してね。", "err");
            return;
          }
          await postJson("/entries", { action: "status", id, status: "rejected", review_note: String(reviewNote).trim() });
          setMsg(els.page, "差し戻しにしたよ。", "ok");
        } else {
          if (!confirm("この参加登録を削除する？")) return;
          await postJson("/entries", { action: "delete", id });
          setMsg(els.page, "削除したよ。", "ok");
        }
        await refresh(true);
      } catch (error) {
        setMsg(els.page, `操作に失敗したよ: ${error.message || error}`, "err");
      }
    });
  });
}

function applySessionUi(data) {
  const session = data?.session || null;
  const linked = Boolean(session?.discordUser);
  const unlocked = Boolean(session?.reviewUnlocked);
  sessionInfo = {
    discordConfigured: Boolean(data?.discordConfigured),
    missingDiscordEnv: Array.isArray(data?.missingDiscordEnv) ? data.missingDiscordEnv.filter(Boolean) : [],
  };
  sessionState = session;
  els.reviewPassword.disabled = !linked || unlocked;
  els.unlockReview.disabled = !linked || unlocked;
  els.signOut.hidden = !linked;
  els.discordConnect.disabled = false;
  els.discordConnect.textContent = sessionInfo.discordConfigured ? "Discordで認証" : "Discord設定を確認";
  if (!sessionInfo.discordConfigured) {
    const missing = formatMissingDiscordEnv(sessionInfo.missingDiscordEnv);
    setAuthBadge("設定待ち", "rejected");
    els.authHint.textContent = "Discord 認証を有効にするための Cloudflare 環境変数がまだ足りません。";
    els.authUser.textContent = `不足している設定: ${missing}`;
    els.discordAccountName.textContent = "未設定";
    els.discordAccountMeta.textContent = "Cloudflare の Discord 設定待ち";
    els.reviewerIdentity.textContent = "Discord認証の設定完了後に、承認操作のアカウント表示が有効になります。";
    els.app.hidden = true;
    return;
  }
  if (!linked) {
    setAuthBadge("Discord未認証", "pending");
    els.authHint.textContent = "まず Discord で認証してください。認証後にレビュー用パスワードが入力できます。";
    els.authUser.textContent = "未認証のため、審査モードはまだ開いていません。";
    els.discordAccountName.textContent = "未連携";
    els.discordAccountMeta.textContent = "Discord認証待ち";
    els.reviewerIdentity.textContent = "Discord認証後に審査モードが開きます。";
    els.app.hidden = true;
    return;
  }
  const accountName = session.discordUser.global_name || session.discordUser.username;
  els.discordAccountName.textContent = accountName;
  els.discordAccountMeta.textContent = `@${session.discordUser.username} / ID: ${session.discordUser.id}`;
  els.authUser.textContent = `現在のDiscord連携: ${accountName} (@${session.discordUser.username})`;
  els.reviewerIdentity.textContent = `現在の操作アカウント: ${accountName} (@${session.discordUser.username})${unlocked ? " / 審査モード有効" : " / パスワード待ち"}`;
  if (unlocked) {
    setAuthBadge("審査モード中", "approved");
    els.authHint.textContent = "Discord認証とパスワード確認が完了しています。承認・差し戻し・設定変更が使えます。";
    els.reviewPassword.value = "";
    els.app.hidden = false;
  } else {
    setAuthBadge("Discord認証済み", "pending");
    els.authHint.textContent = "Discord認証は完了しています。レビュー用パスワードを入力すると審査モードが開きます。";
    els.app.hidden = true;
  }
}

async function syncSession(force = false) {
  const data = await api("/session");
  applySessionUi(data);
  if (sessionState?.reviewUnlocked) {
    await refresh(force);
  }
}

async function refresh(force = false) {
  if (!sessionState?.reviewUnlocked) return;
  const refreshKey = `${sessionState.discordUser.id}:${sessionState.unlockedAt || ""}`;
  if (!force && refreshKey === lastRefreshKey && appReady) return;
  const snapshot = await api("/data");
  fillSettings(snapshot.settings || DEF);
  drawOfficial(snapshot.official || []);
  drawEntries(snapshot.entries || []);
  drawSummary(snapshot.entries || [], snapshot.official || [], snapshot.settings || DEF);
  window.refreshSiteMotion?.(document);
  lastRefreshKey = refreshKey;
  appReady = true;
}

function consumeQueryNotice() {
  const url = new URL(window.location.href);
  const ok = url.searchParams.get("discord");
  const error = url.searchParams.get("discord_error");
  if (ok === "connected") {
    setMsg(els.authStatus, "Discord認証が完了しました。続けてパスワードを入力してください。", "ok");
  }
  if (error) {
    setMsg(els.authStatus, decodeURIComponent(error), "err");
  }
  if (ok || error) {
    url.searchParams.delete("discord");
    url.searchParams.delete("discord_error");
    history.replaceState({}, "", url.toString());
  }
}

els.discordConnect.addEventListener("click", () => {
  window.location.href = `${API_BASE}/discord/start`;
});

els.refreshSession.addEventListener("click", () => {
  syncSession(true).catch((error) => setMsg(els.authStatus, `状態確認に失敗しました: ${error.message || error}`, "err"));
});

els.unlockReview.addEventListener("click", async () => {
  if (!sessionState?.discordUser) {
    setMsg(els.authStatus, "先に Discord で認証してください。", "err");
    return;
  }
  const password = String(els.reviewPassword.value || "");
  if (!password) {
    setMsg(els.authStatus, "パスワードを入力してください。", "err");
    return;
  }
  try {
    const result = await postJson("/verify-password", { password });
    sessionState = result.session || sessionState;
    setMsg(els.authStatus, "審査モードを開きました。", "ok");
    await syncSession(true);
  } catch (error) {
    setMsg(els.authStatus, `解錠に失敗しました: ${error.message || error}`, "err");
  }
});

els.signOut.addEventListener("click", async () => {
  try {
    await postJson("/logout", {});
    sessionState = null;
    appReady = false;
    lastRefreshKey = "";
    els.reviewPassword.value = "";
    setMsg(els.authStatus, "Discord連携を解除しました。", "ok");
    await syncSession(true);
  } catch (error) {
    setMsg(els.authStatus, `連携解除に失敗しました: ${error.message || error}`, "err");
  }
});

els.setForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!sessionState?.reviewUnlocked) return;
  const payload = {
    event_date: String($("eventDate").value || "").trim(),
    official_name: String($("officialName").value || "").trim(),
    official_url: safeUrl($("officialUrl").value, true),
    event_hashtag: String($("eventHashtag").value || "").trim(),
    x_search_url: safeUrl($("xSearchUrl").value, true),
    live_playlist_url: safeUrl($("livePlaylistUrl").value, true),
    archive_playlist_url: safeUrl($("archivePlaylistUrl").value, true),
    entry_close_minutes: clampInt($("entryCloseMinutes").value, 5, 120, DEF.entry_close_minutes),
  };
  try {
    await postJson("/settings", payload);
    setMsg(els.setStatus, "イベント設定を保存したよ。", "ok");
    await refresh(true);
  } catch (error) {
    setMsg(els.setStatus, `保存に失敗したよ: ${error.message || error}`, "err");
  }
});

els.offForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!sessionState?.reviewUnlocked) return;
  const payload = {
    action: "add",
    id: uid(),
    title: String($("officialTitle").value || "").trim(),
    start_time: String($("officialTime").value || "").trim(),
    url: safeUrl($("officialVideoUrl").value, true),
    note: String($("officialNote").value || "").trim(),
  };
  try {
    await postJson("/official", payload);
    els.offForm.reset();
    $("officialTime").value = "19:00";
    window.syncCustomPickers?.(els.offForm);
    setMsg(els.offStatus, "公式予定を追加したよ。", "ok");
    await refresh(true);
  } catch (error) {
    setMsg(els.offStatus, `追加に失敗したよ: ${error.message || error}`, "err");
  }
});

consumeQueryNotice();
syncSession(true).catch((error) => setMsg(els.page, `読み込みに失敗しました: ${error.message || error}`, "err"));
