const API_BASE = "/api/admin";
const DEF = { event_date: "2026-08-18", official_name: "全てお米の所為です。", official_url: "https://www.youtube.com/@or_should_rice", event_hashtag: "", x_search_url: "", live_playlist_url: "", archive_playlist_url: "", entry_close_minutes: 15 };
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

const $ = (id) => document.getElementById(id);
const els = {
  page: $("pageStatus"),
  app: $("adminApp"),
  crewSection: $("crewSection"),
  crewForm: $("crewForm"),
  crewStatus: $("crewStatus"),
  crewCurrentCard: $("crewCurrentCard"),
  crewCurrentState: $("crewCurrentState"),
  crewCurrentUpdated: $("crewCurrentUpdated"),
  crewCurrentName: $("crewCurrentName"),
  crewCurrentLanes: $("crewCurrentLanes"),
  crewCurrentSongs: $("crewCurrentSongs"),
  crewCurrentNote: $("crewCurrentNote"),
  crewEditBtn: $("crewEditBtn"),
  crewResetBtn: $("crewResetBtn"),
  crewSubmitBtn: $("crewSubmitBtn"),
  crewCreditName: $("crewCreditName"),
  crewAssignedLanes: $("crewAssignedLanes"),
  crewSongCount: $("crewSongCount"),
  crewNote: $("crewNote"),
  crewViewerHint: $("crewViewerHint"),
  crewList: $("crewList"),
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
const DELETED_REVIEW_NOTE = "あなたの動画申請は削除されました。";
const slotLabel = (value) => SLOT_LABELS[Number(value)] || "未設定";
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
let crewReadyKey = "";
let ownCrewAssignment = null;

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

function formatDateTime(value) {
  if (!value) return "未設定";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "未設定" : new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusBadge(status) {
  if (status === "approved") return '<span class="badge approved">掲載中</span>';
  if (status === "rejected") return '<span class="badge rejected">差し戻し</span>';
  if (status === "deleted") return '<span class="badge rejected">削除済み</span>';
  return '<span class="badge pending">審査待ち</span>';
}

function isSoftDeletedEntry(item) {
  return String(item?.status || "") === "deleted" || String(item?.review_note || "").trim() === DELETED_REVIEW_NOTE;
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

function hasCrewAssignment(assignment = {}) {
  return Boolean(
    String(assignment.credit_name || "").trim()
    || String(assignment.assigned_lanes || "").trim()
    || String(assignment.note || "").trim()
    || assignment.updated_at,
  );
}

function fillCrewForm(assignment = {}) {
  els.crewCreditName.value = String(assignment.credit_name || "");
  els.crewAssignedLanes.value = String(assignment.assigned_lanes || "");
  els.crewSongCount.value = String(assignment.song_count || 1);
  els.crewNote.value = String(assignment.note || "");
  els.crewSubmitBtn.textContent = hasCrewAssignment(assignment) ? "担当情報を更新" : "担当情報を登録";
}

function renderOwnCrewCard(assignment = {}) {
  const exists = hasCrewAssignment(assignment);
  els.crewCurrentState.textContent = exists ? "登録済み" : "未登録";
  els.crewCurrentState.className = `badge ${exists ? "approved" : "pending"}`;
  els.crewCurrentUpdated.textContent = exists
    ? `${formatDateTime(assignment.updated_at)} 時点の内容です。変更したいときは下のフォームから更新できます。`
    : "まだ担当情報は保存されていません。下のフォームから登録できます。";
  els.crewCurrentName.textContent = String(assignment.credit_name || "未設定");
  els.crewCurrentLanes.textContent = String(assignment.assigned_lanes || "未設定");
  els.crewCurrentSongs.textContent = `${clampInt(assignment.song_count, 1, 99, 1)}曲`;
  els.crewCurrentNote.textContent = String(assignment.note || "未設定");
  els.crewEditBtn.disabled = !exists;
  els.crewResetBtn.disabled = !exists;
}

function renderCrewList(entries = []) {
  if (!sessionState?.discordUser) {
    els.crewList.innerHTML = '<div class="crew-item"><span class="small">Discord認証後に担当情報が表示されます。</span></div>';
    return;
  }
  if (!sessionState?.reviewUnlocked) {
    els.crewList.innerHTML = '<div class="crew-item"><span class="small">レビュー用パスワード通過後に、ほかの担当情報もここで確認できます。</span></div>';
    return;
  }
  if (!entries.length) {
    els.crewList.innerHTML = '<div class="crew-item"><span class="small">まだ担当情報はありません。</span></div>';
    return;
  }
  els.crewList.innerHTML = entries.map((item) => {
    const accountName = String(item.discord_global_name || item.discord_username || "Discord User");
    const noteBlock = String(item.note || "").trim()
      ? `<p class="crew-item-note">${esc(item.note)}</p>`
      : "";
    return `<article class="crew-item"><div class="crew-item-head"><div><strong>${esc(item.credit_name || "未設定")}</strong><p class="small">@${esc(item.discord_username || "")} / ${esc(accountName)}</p></div><span class="badge pending">${esc(String(item.song_count || 0))}曲担当</span></div><div class="crew-item-meta"><span><strong>担当枠</strong><br>${esc(item.assigned_lanes || "未設定")}</span><span><strong>更新</strong><br>${esc(formatDate(String(item.updated_at || "").slice(0, 10)) || "未更新")}</span></div>${noteBlock}</article>`;
  }).join("");
}

function bindCardToggles(scope) {
  scope.querySelectorAll("[data-card-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const card = event.currentTarget.closest(".stack-card");
      const details = card?.querySelector(".stack-card-details");
      if (!card || !details) return;
      const expanded = event.currentTarget.getAttribute("aria-expanded") === "true";
      details.hidden = expanded;
      card.classList.toggle("is-expanded", !expanded);
      event.currentTarget.setAttribute("aria-expanded", String(!expanded));
      const label = event.currentTarget.querySelector(".stack-card-toggle");
      if (label) label.textContent = expanded ? "詳細を開く" : "詳細を閉じる";
    });
  });
}

function drawOfficial(list) {
  const items = [...list].sort((a, b) => mins(a.start_time) - mins(b.start_time));
  els.official.innerHTML = items.length
    ? items.map((item) => {
      const detailParts = [];
      if (String(item.note || "").trim()) {
        detailParts.push(`<div><p class="stack-detail-label">補足</p><p class="stack-detail-value">${esc(item.note)}</p></div>`);
      }
      detailParts.push(`<div><p class="stack-detail-label">操作</p><div class="stack-card-action-group"><button class="delete" data-odel="${esc(item.id)}">削除</button></div></div>`);
      const urlButton = safeUrl(item.url, true)
        ? `<a class="stack-card-link" href="${esc(safeUrl(item.url, true))}" target="_blank" rel="noopener noreferrer">YouTubeへ</a>`
        : '<span class="small">URL未設定</span>';
      return `<tr class="stack-card-row"><td colspan="5"><article class="stack-card"><div class="stack-card-top"><span class="stack-chip">公式予定</span><span class="stack-chip">${esc(item.start_time)}</span></div><button type="button" class="stack-card-title" data-card-toggle aria-expanded="false"><span class="stack-card-title-text">${esc(item.title)}</span><span class="stack-card-toggle">詳細を開く</span></button><div class="stack-card-meta">${urlButton}</div><div class="stack-card-details" hidden>${detailParts.join("")}</div></article></td></tr>`;
    }).join("")
    : '<tr><td colspan="5" class="empty">まだ公式予定はありません。</td></tr>';
  bindCardToggles(els.official);
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
  const items = [...list]
    .filter((item) => String(item.status || "") !== "deleted")
    .sort((a, b) => Number(a.parent_slot) - Number(b.parent_slot) || mins(a.start_time) - mins(b.start_time));
  els.admin.innerHTML = items.length
    ? items.map((item) => {
      const detailParts = [];
      if (String(item.note || "").trim()) {
        detailParts.push(`<div><p class="stack-detail-label">補足</p><p class="stack-detail-value">${esc(item.note)}</p></div>`);
      }
      if (String(item.review_note || "").trim()) {
        detailParts.push(`<div><p class="stack-detail-label">差し戻し理由</p><p class="stack-detail-value">${esc(item.review_note)}</p></div>`);
      }
      detailParts.push(`<div><p class="stack-detail-label">操作</p><div class="stack-card-action-group"><button class="approve" data-act="approve" data-id="${esc(item.id)}">掲載</button><button class="reject" data-act="reject" data-id="${esc(item.id)}">差し戻し</button><button class="delete" data-act="delete" data-id="${esc(item.id)}">削除</button></div></div>`);
      const urlButton = safeUrl(item.url, true)
        ? `<a class="stack-card-link" href="${esc(safeUrl(item.url, true))}" target="_blank" rel="noopener noreferrer">YouTubeへ</a>`
        : '<span class="small">URLなし</span>';
      return `<tr class="stack-card-row"><td colspan="9"><article class="stack-card"><div class="stack-card-top">${statusBadge(item.status)}<span class="stack-chip">${esc(slotLabel(item.parent_slot))}</span><span class="stack-chip">${esc(item.start_time)}</span></div><button type="button" class="stack-card-title" data-card-toggle aria-expanded="false"><span class="stack-card-title-text">${esc(item.title)}</span><span class="stack-card-toggle">詳細を開く</span></button><div class="stack-card-meta"><span class="stack-meta">${esc(item.artist)}</span>${urlButton}</div><div class="stack-card-details" hidden>${detailParts.join("")}</div></article></td></tr>`;
    }).join("")
    : '<tr><td colspan="9" class="empty">まだ参加登録はありません。</td></tr>';
  bindCardToggles(els.admin);
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

function drawOfficial(list) {
  const items = [...list].sort((a, b) => mins(a.start_time) - mins(b.start_time));
  els.official.innerHTML = items.length
    ? items.map((item) => {
      const detailParts = [];
      if (String(item.note || "").trim()) {
        detailParts.push(`<div><p class="stack-detail-label">補足</p><p class="stack-detail-value">${esc(item.note)}</p></div>`);
      }
      detailParts.push(`<div><p class="stack-detail-label">操作</p><div class="stack-card-action-group"><button class="delete" data-odel="${esc(item.id)}">削除</button></div></div>`);
      const urlButton = safeUrl(item.url, true)
        ? `<a class="stack-card-link" href="${esc(safeUrl(item.url, true))}" target="_blank" rel="noopener noreferrer">YouTubeへ</a>`
        : '<span class="small">URL未設定</span>';
      const titleHtml = `<div class="stack-card-title${detailParts.length ? "" : " is-static"}"><span class="stack-card-title-text">${esc(item.title)}</span></div>`;
      const summaryHtml = `<div class="stack-card-summary"><div class="stack-summary-item"><span class="stack-summary-label">開始</span><span class="stack-summary-value stack-time">${esc(item.start_time)}</span></div><div class="stack-summary-item"><span class="stack-summary-label">区分</span><span class="stack-summary-value">公式予定</span></div></div>`;
      return `<tr class="stack-card-row"><td colspan="5"><article class="stack-card${detailParts.length ? " is-toggleable" : ""}"${detailParts.length ? ' data-card-toggle tabindex="0" role="button" aria-expanded="false"' : ""}><div class="stack-card-head"><div class="stack-card-status"><span class="stack-chip">公式予定</span></div>${detailParts.length ? '<span class="stack-card-hint">クリックで詳細</span>' : ""}</div><div class="stack-card-main"><p class="stack-field-label">タイトル</p>${titleHtml}</div>${summaryHtml}<div class="stack-card-footer">${urlButton}</div>${detailParts.length ? `<div class="stack-card-details" hidden>${detailParts.join("")}</div>` : ""}</article></td></tr>`;
    }).join("")
    : '<tr><td colspan="5" class="empty">まだ公式予定はありません。</td></tr>';
  bindCardToggles(els.official);
  document.querySelectorAll("[data-odel]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      if (!sessionState?.reviewUnlocked) return;
      if (!confirm("この公式予定を削除しますか？")) return;
      try {
        await postJson("/official", { action: "delete", id: event.currentTarget.dataset.odel });
        setMsg(els.offStatus, "公式予定を削除しました。", "ok");
        await refresh(true);
      } catch (error) {
        setMsg(els.offStatus, `削除に失敗しました: ${error.message || error}`, "err");
      }
    });
  });
}

function drawEntries(list) {
  const items = [...list]
    .filter((item) => !isSoftDeletedEntry(item))
    .sort((a, b) => Number(a.parent_slot) - Number(b.parent_slot) || mins(a.start_time) - mins(b.start_time));
  els.admin.innerHTML = items.length
    ? items.map((item) => {
      const detailParts = [];
      if (String(item.note || "").trim()) {
        detailParts.push(`<div><p class="stack-detail-label">補足</p><p class="stack-detail-value">${esc(item.note)}</p></div>`);
      }
      if (String(item.review_note || "").trim()) {
        detailParts.push(`<div><p class="stack-detail-label">差し戻し理由</p><p class="stack-detail-value">${esc(item.review_note)}</p></div>`);
      }
      detailParts.push(`<div><p class="stack-detail-label">操作</p><div class="stack-card-action-group"><button class="approve" data-act="approve" data-id="${esc(item.id)}">掲載</button><button class="reject" data-act="reject" data-id="${esc(item.id)}">差し戻し</button><button class="delete" data-act="delete" data-id="${esc(item.id)}">削除</button></div></div>`);
      const urlButton = safeUrl(item.url, true)
        ? `<a class="stack-card-link" href="${esc(safeUrl(item.url, true))}" target="_blank" rel="noopener noreferrer">YouTubeへ</a>`
        : '<span class="small">URLなし</span>';
      const titleHtml = `<div class="stack-card-title${detailParts.length ? "" : " is-static"}"><span class="stack-card-title-text">${esc(item.title)}</span></div>`;
      const summaryHtml = `<div class="stack-card-summary"><div class="stack-summary-item"><span class="stack-summary-label">開始</span><span class="stack-summary-value stack-time">${esc(item.start_time)}</span></div><div class="stack-summary-item"><span class="stack-summary-label">枠</span><span class="stack-summary-value">${esc(slotLabel(item.parent_slot))}</span></div><div class="stack-summary-item"><span class="stack-summary-label">名義</span><span class="stack-summary-value">${esc(item.artist)}</span></div></div>`;
      return `<tr class="stack-card-row"><td colspan="9"><article class="stack-card${detailParts.length ? " is-toggleable" : ""}"${detailParts.length ? ' data-card-toggle tabindex="0" role="button" aria-expanded="false"' : ""}><div class="stack-card-head"><div class="stack-card-status">${statusBadge(item.status)}</div>${detailParts.length ? '<span class="stack-card-hint">クリックで詳細</span>' : ""}</div><div class="stack-card-main"><p class="stack-field-label">曲名</p>${titleHtml}</div>${summaryHtml}<div class="stack-card-footer"><div class="stack-card-status">${urlButton}</div></div>${detailParts.length ? `<div class="stack-card-details" hidden>${detailParts.join("")}</div>` : ""}</article></td></tr>`;
    }).join("")
    : '<tr><td colspan="9" class="empty">まだ参加動画はありません。</td></tr>';
  bindCardToggles(els.admin);
  document.querySelectorAll("[data-act]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      if (!sessionState?.reviewUnlocked) return;
      const { act, id } = event.currentTarget.dataset;
      const currentItem = items.find((item) => item.id === id) || null;
      try {
        if (act === "approve") {
          await postJson("/entries", { action: "status", id, status: "approved", review_note: "" });
          setMsg(els.page, "掲載しました。", "ok");
        } else if (act === "reject") {
          const reviewNote = prompt("差し戻し理由を入力してください。公開ページにもこの内容が表示されます。", String(currentItem?.review_note || ""));
          if (reviewNote === null) return;
          if (!String(reviewNote).trim()) {
            setMsg(els.page, "差し戻し理由を入力してください。", "err");
            return;
          }
          await postJson("/entries", { action: "status", id, status: "rejected", review_note: String(reviewNote).trim() });
          setMsg(els.page, "差し戻しにしました。", "ok");
        } else {
          if (!confirm("この参加動画を削除しますか？")) return;
          await postJson("/entries", { action: "delete", id });
          setMsg(els.page, "削除しました。", "ok");
        }
        await refresh(true);
      } catch (error) {
        setMsg(els.page, `操作に失敗しました: ${error.message || error}`, "err");
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
    els.crewSection.hidden = true;
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
    els.crewSection.hidden = true;
    els.app.hidden = true;
    return;
  }
  const accountName = session.discordUser.global_name || session.discordUser.username;
  els.discordAccountName.textContent = accountName;
  els.discordAccountMeta.textContent = `@${session.discordUser.username} / ID: ${session.discordUser.id}`;
  els.authUser.textContent = `現在のDiscord連携: ${accountName} (@${session.discordUser.username})`;
  els.reviewerIdentity.textContent = `現在の操作アカウント: ${accountName} (@${session.discordUser.username})${unlocked ? " / 審査モード有効" : " / パスワード待ち"}`;
  els.crewSection.hidden = false;
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

async function syncCrew(force = false) {
  if (!sessionState?.discordUser) {
    els.crewSection.hidden = true;
    crewReadyKey = "";
    ownCrewAssignment = null;
    return;
  }
  const crewKey = `${sessionState.discordUser.id}:${sessionState.reviewUnlocked ? sessionState.unlockedAt || "open" : "linked"}`;
  if (!force && crewKey === crewReadyKey) return;
  const snapshot = await api("/crew");
  ownCrewAssignment = snapshot.own || {};
  fillCrewForm(ownCrewAssignment);
  renderOwnCrewCard(ownCrewAssignment);
  renderCrewList(Array.isArray(snapshot.entries) ? snapshot.entries : []);
  els.crewViewerHint.textContent = sessionState.reviewUnlocked
    ? "Discord 認証済みメンバーの担当枠・曲数・使用名義を一覧で確認できます。"
    : "いまは自分の担当情報だけ保存できます。レビュー用パスワード通過後に、ほかの担当情報もここで見られます。";
  crewReadyKey = crewKey;
}

async function syncSession(force = false) {
  const data = await api("/session");
  applySessionUi(data);
  if (sessionState?.discordUser) {
    try {
      await syncCrew(force);
      setMsg(els.crewStatus, "");
    } catch (error) {
      crewReadyKey = "";
      renderCrewList([]);
      setMsg(els.crewStatus, `担当情報の読み込みに失敗しました: ${error.message || error}`, "err");
    }
  }
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

els.crewForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!sessionState?.discordUser) {
    setMsg(els.crewStatus, "先に Discord で認証してください。", "err");
    return;
  }
  const isEditing = hasCrewAssignment(ownCrewAssignment || {});
  const payload = {
    credit_name: String(els.crewCreditName.value || "").trim(),
    assigned_lanes: String(els.crewAssignedLanes.value || "").trim(),
    song_count: clampInt(els.crewSongCount.value, 1, 99, 1),
    note: String(els.crewNote.value || "").trim(),
  };
  try {
    await postJson("/crew", payload);
    setMsg(els.crewStatus, isEditing ? "担当情報を更新しました。" : "担当情報を登録しました。", "ok");
    await syncCrew(true);
  } catch (error) {
    setMsg(els.crewStatus, `担当情報の保存に失敗しました: ${error.message || error}`, "err");
  }
});

els.crewEditBtn?.addEventListener("click", () => {
  if (!hasCrewAssignment(ownCrewAssignment || {})) return;
  fillCrewForm(ownCrewAssignment || {});
  setMsg(els.crewStatus, "現在の担当情報をフォームに読み込みました。内容を直して更新できます。", "ok");
  els.crewCreditName.focus();
});

els.crewResetBtn?.addEventListener("click", () => {
  fillCrewForm(ownCrewAssignment || {});
  setMsg(els.crewStatus, hasCrewAssignment(ownCrewAssignment || {})
    ? "入力内容を保存済みの担当情報に戻しました。"
    : "入力内容を初期状態に戻しました。", "ok");
});

els.signOut.addEventListener("click", async () => {
  try {
    await postJson("/logout", {});
    sessionState = null;
    appReady = false;
    ownCrewAssignment = null;
    lastRefreshKey = "";
    crewReadyKey = "";
    els.reviewPassword.value = "";
    els.crewSection.hidden = true;
    fillCrewForm();
    renderCrewList([]);
    setMsg(els.crewStatus, "");
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
