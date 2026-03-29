const SUPABASE_URL="",SUPABASE_ANON_KEY="",ET="kome_prerush_entries",OT="kome_prerush_official_videos",ST="kome_prerush_settings",AT="kome_prerush_admins",SID="default",LE="kome_prerush_entries_local_v3",LO="kome_prerush_official_v1",LS="kome_prerush_settings_v1",ALLOW_LOCAL_ADMIN_FALLBACK=false;
const DEF={event_date:"2026-08-18",official_name:"全てお米の所為です。",official_url:"https://www.youtube.com/@or_should_rice",event_hashtag:"",x_search_url:"",live_playlist_url:"",archive_playlist_url:"",entry_close_minutes:15};
const $=id=>document.getElementById(id),els={page:$("pageStatus"),app:$("adminApp"),authForm:$("authForm"),authStatus:$("authStatus"),authState:$("authState"),authHint:$("authHint"),authUser:$("authUser"),loginEmail:$("loginEmail"),loginPassword:$("loginPassword"),magicLink:$("magicLinkBtn"),refreshSession:$("refreshSessionBtn"),signOut:$("signOutBtn"),setForm:$("settingsForm"),offForm:$("officialForm"),setStatus:$("settingsStatus"),offStatus:$("officialStatus"),admin:$("adminBody"),official:$("officialBody"),sumDate:$("sumDate"),sumPending:$("sumPending"),sumOfficial:$("sumOfficial")};
const shared=!!(SUPABASE_URL&&SUPABASE_ANON_KEY&&window.supabase),sb=shared?window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY):null,localAdminMode=!shared&&ALLOW_LOCAL_ADMIN_FALLBACK;
const read=(k,f)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):f}catch{return f}},write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const okTime=v=>/^([01]\d|2[0-3]):([0-5]\d)$/.test(String(v||"")),mins=v=>okTime(v)?Number(v.slice(0,2))*60+Number(v.slice(3,5)):1e9,clampInt=(v,min,max,fallback)=>{const n=Math.round(Number(v));return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback},uid=()=>window.crypto?.randomUUID?.()||("id-"+Date.now()+"-"+Math.random().toString(16).slice(2));
const safeUrl=(v,empty=false)=>{const s=String(v||"").trim();if(!s)return empty?"":null;try{const u=new URL(s);return ["http:","https:"].includes(u.protocol)?u.toString():null}catch{return null}};
const setMsg=(el,m,t="")=>{el.textContent=m;el.className="status "+t};
const setAuthBadge=(label,t="pending")=>{els.authState.textContent=label;els.authState.className="badge "+t};
const toggleAuthControls=disabled=>[els.loginEmail,els.loginPassword,els.magicLink,...els.authForm.querySelectorAll("button")].forEach(el=>{if(el)el.disabled=disabled});
const norm=r=>({event_date:String(r?.event_date||"").trim(),official_name:String(r?.official_name||"").trim()||DEF.official_name,official_url:safeUrl(r?.official_url,true)||DEF.official_url,event_hashtag:String(r?.event_hashtag||"").trim(),x_search_url:safeUrl(r?.x_search_url,true)||"",live_playlist_url:safeUrl(r?.live_playlist_url,true)||"",archive_playlist_url:safeUrl(r?.archive_playlist_url,true)||"",entry_close_minutes:clampInt(r?.entry_close_minutes,5,120,DEF.entry_close_minutes)});
const fmtDate=d=>{if(!d)return"未設定";const x=new Date(d+"T00:00:00");return Number.isNaN(x.getTime())?"未設定":new Intl.DateTimeFormat("ja-JP",{month:"numeric",day:"numeric",weekday:"short"}).format(x)};
const badge=s=>s==="approved"?'<span class="badge approved">掲載中</span>':s==="rejected"?'<span class="badge rejected">差し戻し</span>':'<span class="badge pending">審査待ち</span>';
const authRedirect=()=>{const u=new URL(window.location.href);u.hash="";u.search="";return u.toString()};
let currentUser=null,isAdmin=false,lastRefreshKey="";

async function getEntries(){if(shared){const {data,error}=await sb.from(ET).select("id,artist,title,parent_slot,start_time,url,note,status,created_at").order("created_at",{ascending:true});if(error)throw error;return data||[]}return read(LE,[])}
async function getOfficial(){if(shared){const {data,error}=await sb.from(OT).select("id,title,start_time,url,note,created_at").order("start_time",{ascending:true});if(error)throw error;return data||[]}return read(LO,[])}
async function getSettings(){if(shared){const {data,error}=await sb.from(ST).select("id,event_date,official_name,official_url,event_hashtag,x_search_url,live_playlist_url,archive_playlist_url,entry_close_minutes").eq("id",SID).maybeSingle();if(error)throw error;return norm(data||read(LS,DEF))}return norm(read(LS,DEF))}
async function setEntryStatus(id,status){if(shared){const {error}=await sb.from(ET).update({status}).eq("id",id);if(error)throw error;return}write(LE,read(LE,[]).map(v=>v.id===id?{...v,status}:v))}
async function delEntry(id){if(shared){const {error}=await sb.from(ET).delete().eq("id",id);if(error)throw error;return}write(LE,read(LE,[]).filter(v=>v.id!==id))}
async function addOfficial(v){if(shared){const {error}=await sb.from(OT).insert(v);if(error)throw error;return}const a=read(LO,[]);a.push(v);write(LO,a)}
async function delOfficial(id){if(shared){const {error}=await sb.from(OT).delete().eq("id",id);if(error)throw error;return}write(LO,read(LO,[]).filter(v=>v.id!==id))}
async function saveSettings(v){const s=norm(v);if(shared){const {error}=await sb.from(ST).upsert({id:SID,event_date:s.event_date||null,official_name:s.official_name,official_url:s.official_url,event_hashtag:s.event_hashtag,x_search_url:s.x_search_url,live_playlist_url:s.live_playlist_url,archive_playlist_url:s.archive_playlist_url,entry_close_minutes:s.entry_close_minutes,updated_at:new Date().toISOString()},{onConflict:"id"});if(error)throw error}write(LS,s)}

function fillSettings(s){$("eventDate").value=s.event_date||"";$("officialName").value=s.official_name;$("officialUrl").value=s.official_url;$("eventHashtag").value=s.event_hashtag||"";$("xSearchUrl").value=s.x_search_url||"";$("livePlaylistUrl").value=s.live_playlist_url||"";$("archivePlaylistUrl").value=s.archive_playlist_url||"";$("entryCloseMinutes").value=String(s.entry_close_minutes||DEF.entry_close_minutes)}
function drawOfficial(list){const a=[...list].sort((x,y)=>mins(x.start_time)-mins(y.start_time));els.official.innerHTML=a.length?a.map(v=>'<tr><td class="t" data-label="時間">'+esc(v.start_time)+'</td><td data-label="タイトル"><span class="song">'+esc(v.title)+'</span></td><td data-label="URL">'+(safeUrl(v.url,true)?'<a class="url" href="'+esc(safeUrl(v.url,true))+'" target="_blank" rel="noopener noreferrer">'+esc(safeUrl(v.url,true))+'</a>':'<span class="small">URL未設定</span>')+'</td><td data-label="補足">'+(esc(v.note)||"—")+'</td><td data-label="操作"><button class="delete" data-odel="'+esc(v.id)+'">削除</button></td></tr>').join(""):'<tr><td colspan="5" class="empty">まだ公式予定はありません。</td></tr>';document.querySelectorAll("[data-odel]").forEach(b=>b.addEventListener("click",async e=>{if(!await requireAdmin())return;if(!confirm("この公式予定を削除する？"))return;try{await delOfficial(e.currentTarget.dataset.odel);setMsg(els.offStatus,"公式予定を削除したよ。","ok");await refresh(true)}catch(err){setMsg(els.offStatus,"削除に失敗したよ: "+(err.message||err),"err")}}))}
function drawEntries(list){const a=[...list].sort((x,y)=>Number(x.parent_slot)-Number(y.parent_slot)||mins(x.start_time)-mins(y.start_time));els.admin.innerHTML=a.length?a.map(v=>'<tr><td data-label="状態">'+badge(v.status)+'</td><td class="t" data-label="レーン">レーン'+esc(v.parent_slot)+'</td><td class="t" data-label="時間">'+esc(v.start_time)+'</td><td data-label="タイトル"><span class="song">'+esc(v.title)+'</span></td><td data-label="名義">'+esc(v.artist)+'</td><td data-label="URL">'+(safeUrl(v.url,true)?'<a class="url" href="'+esc(safeUrl(v.url,true))+'" target="_blank" rel="noopener noreferrer">'+esc(safeUrl(v.url,true))+'</a>':'<span class="small">URLなし</span>')+'</td><td data-label="補足">'+(esc(v.note)||"—")+'</td><td data-label="操作"><button class="approve" data-act="approve" data-id="'+esc(v.id)+'">掲載</button> <button class="reject" data-act="reject" data-id="'+esc(v.id)+'">差し戻し</button> <button class="delete" data-act="delete" data-id="'+esc(v.id)+'">削除</button></td></tr>').join(""):'<tr><td colspan="8" class="empty">まだ参加登録はありません。</td></tr>';document.querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click",async e=>{if(!await requireAdmin())return;const id=e.currentTarget.dataset.id,act=e.currentTarget.dataset.act;try{if(act==="approve"){const all=await getEntries(),t=all.find(v=>v.id===id),c=t&&all.find(v=>v.id!==id&&v.status==="approved"&&Number(v.parent_slot)===Number(t.parent_slot)&&String(v.start_time)===String(t.start_time));if(c){setMsg(els.page,"同じレーン・時間にすでに掲載済みの動画があるので掲載できません。","err");return}await setEntryStatus(id,"approved");setMsg(els.page,"掲載したよ。","ok")}else if(act==="reject"){await setEntryStatus(id,"rejected");setMsg(els.page,"差し戻しにしたよ。","ok")}else{if(!confirm("この参加登録を削除する？"))return;await delEntry(id);setMsg(els.page,"削除したよ。","ok")}await refresh(true)}catch(err){setMsg(els.page,"操作に失敗したよ: "+(err.message||err),"err")}}))}
function drawSummary(entries,official,settings){els.sumDate.textContent=fmtDate(settings.event_date);els.sumPending.textContent=String(entries.filter(v=>v.status==="pending").length);els.sumOfficial.textContent=String(official.length)}

function lockApp(msg,type="pending"){els.app.hidden=true;setAuthBadge(type==="approved"?"管理者ログイン中":msg,type);if(type!=="approved")setMsg(els.page,msg,type==="rejected"?"err":"")}
async function requireAdmin(){if(localAdminMode)return true;if(isAdmin)return true;await syncAuthState(true);if(isAdmin)return true;setMsg(els.page,"先に管理者としてログインしてください。","err");return false}
async function refresh(force=false){if(!localAdminMode&&!isAdmin)return;const refreshKey=localAdminMode?"local":String(currentUser?.id||"");if(!force&&refreshKey&&refreshKey===lastRefreshKey)return;const [entries,official,settings]=await Promise.all([getEntries(),getOfficial(),getSettings()]);fillSettings(settings);drawOfficial(official);drawEntries(entries);drawSummary(entries,official,settings);lastRefreshKey=refreshKey}

async function syncAuthState(force=false){
  if(localAdminMode){
    toggleAuthControls(true);
    els.signOut.hidden=true;
    els.app.hidden=false;
    currentUser=null;
    isAdmin=true;
    setAuthBadge("ローカル確認", "pending");
    els.authHint.textContent="`ALLOW_LOCAL_ADMIN_FALLBACK` が true のため、ローカル確認だけ許可しています。本番では false のままにしてください。";
    els.authUser.textContent="Supabase 未設定のローカルモードです。";
    if(force)await refresh(true);
    return;
  }
  if(!shared){
    toggleAuthControls(true);
    els.signOut.hidden=true;
    els.app.hidden=true;
    currentUser=null;
    isAdmin=false;
    setAuthBadge("設定待ち","rejected");
    els.authHint.textContent="Supabase Project URL / anon key を設定すると、管理ログインが有効になります。";
    els.authUser.textContent="安全のため、未設定のままでは編集UIを開かないようにしています。";
    return;
  }
  toggleAuthControls(false);
  try{
    const {data,error}=await sb.auth.getUser();
    if(error)throw error;
    const user=data.user;
    currentUser=user||null;
    lastRefreshKey="";
    if(!user){
      isAdmin=false;
      els.app.hidden=true;
      els.signOut.hidden=true;
      setAuthBadge("未ログイン","pending");
      els.authHint.textContent="管理メールでログインすると、設定変更と審査操作が開きます。";
      els.authUser.textContent="サインインしていません。";
      return;
    }
    els.signOut.hidden=false;
    els.authUser.textContent="ログイン中: "+(user.email||user.id);
    const {data:adminRow,error:adminError}=await sb.from(AT).select("email").maybeSingle();
    if(adminError)throw adminError;
    isAdmin=!!adminRow;
    if(!isAdmin){
      els.app.hidden=true;
      setAuthBadge("権限なし","rejected");
      els.authHint.textContent="認証はできていますが、このメールは管理者として許可されていません。README の SQL で `kome_prerush_admins` を設定してください。";
      setMsg(els.page,"このアカウントには管理権限がありません。","err");
      return;
    }
    els.app.hidden=false;
    setAuthBadge("管理者ログイン中","approved");
    els.authHint.textContent="RLS により、審査・設定変更・公式予定の編集は管理者ログイン後だけ許可されます。";
    setMsg(els.page,"管理権限を確認しました。","ok");
    await refresh(force);
  }catch(err){
    currentUser=null;
    isAdmin=false;
    els.app.hidden=true;
    els.signOut.hidden=true;
    setAuthBadge("認証エラー","rejected");
    els.authHint.textContent="Auth または RLS の設定を確認してください。`kome_prerush_admins` テーブルやポリシー未設定でもこの状態になります。";
    els.authUser.textContent="セッション確認に失敗しました。";
    setMsg(els.page,"認証状態の確認に失敗しました: "+(err.message||err),"err");
  }
}

els.authForm.addEventListener("submit",async e=>{
  e.preventDefault();
  if(!shared){setMsg(els.authStatus,"Supabase Auth を設定するとログインできます。","err");return}
  const email=String(els.loginEmail.value||"").trim().toLowerCase(),password=String(els.loginPassword.value||"");
  if(!email||!password){setMsg(els.authStatus,"メールとパスワードを入力してね。","err");return}
  try{
    const {error}=await sb.auth.signInWithPassword({email,password});
    if(error)throw error;
    setMsg(els.authStatus,"ログインしました。権限を確認しています。","ok");
    await syncAuthState(true);
  }catch(err){
    setMsg(els.authStatus,"ログインに失敗しました: "+(err.message||err),"err");
  }
});

els.magicLink.addEventListener("click",async()=>{
  if(!shared){setMsg(els.authStatus,"Supabase Auth を設定するとマジックリンクが使えます。","err");return}
  const email=String(els.loginEmail.value||"").trim().toLowerCase();
  if(!email){setMsg(els.authStatus,"先に管理メールを入力してね。","err");return}
  try{
    const {error}=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:authRedirect()}});
    if(error)throw error;
    setMsg(els.authStatus,"マジックリンクを送ったよ。メールから戻ると権限確認が走ります。","ok");
  }catch(err){
    setMsg(els.authStatus,"マジックリンク送信に失敗しました: "+(err.message||err),"err");
  }
});

els.refreshSession.addEventListener("click",()=>syncAuthState(true));
els.signOut.addEventListener("click",async()=>{if(!shared)return;try{const {error}=await sb.auth.signOut();if(error)throw error;setMsg(els.authStatus,"ログアウトしました。","ok");await syncAuthState(true)}catch(err){setMsg(els.authStatus,"ログアウトに失敗しました: "+(err.message||err),"err")}});

els.setForm.addEventListener("submit",async e=>{e.preventDefault();if(!await requireAdmin())return;const event_date=String($("eventDate").value||"").trim(),official_name=String($("officialName").value||"").trim(),official_raw=$("officialUrl").value,official_url=safeUrl(official_raw,true),event_hashtag=String($("eventHashtag").value||"").trim(),x_raw=$("xSearchUrl").value,x_search_url=safeUrl(x_raw,true),live_raw=$("livePlaylistUrl").value,live_playlist_url=safeUrl(live_raw,true),archive_raw=$("archivePlaylistUrl").value,archive_playlist_url=safeUrl(archive_raw,true),entry_close_minutes=clampInt($("entryCloseMinutes").value,5,120,DEF.entry_close_minutes);if(!official_name){setMsg(els.setStatus,"公式チャンネル名を入力してね。","err");return}if(String(official_raw||"").trim()&&!official_url){setMsg(els.setStatus,"公式チャンネルURLの形式が正しくないよ。","err");return}if(String(x_raw||"").trim()&&!x_search_url){setMsg(els.setStatus,"X の URL 形式が正しくないよ。","err");return}if(String(live_raw||"").trim()&&!live_playlist_url){setMsg(els.setStatus,"今見る用再生リストURLの形式が正しくないよ。","err");return}if(String(archive_raw||"").trim()&&!archive_playlist_url){setMsg(els.setStatus,"後追い用再生リストURLの形式が正しくないよ。","err");return}try{await saveSettings({event_date,official_name,official_url:official_url||DEF.official_url,event_hashtag,x_search_url:x_search_url||"",live_playlist_url:live_playlist_url||"",archive_playlist_url:archive_playlist_url||"",entry_close_minutes});setMsg(els.setStatus,"イベント設定を保存したよ。","ok");await refresh(true)}catch(err){setMsg(els.setStatus,"保存に失敗したよ: "+(err.message||err),"err")}});
els.offForm.addEventListener("submit",async e=>{e.preventDefault();if(!await requireAdmin())return;const title=String($("officialTitle").value||"").trim(),start_time=String($("officialTime").value||"").trim(),raw=$("officialVideoUrl").value,url=safeUrl(raw,true),note=String($("officialNote").value||"").trim();if(!title||!start_time){setMsg(els.offStatus,"タイトルと公開時刻を入力してね。","err");return}if(!okTime(start_time)){setMsg(els.offStatus,"公開時刻の形式が正しくないよ。","err");return}if(String(raw||"").trim()&&!url){setMsg(els.offStatus,"動画URLの形式が正しくないよ。","err");return}try{await addOfficial({id:uid(),title,start_time,url:url||"",note,created_at:new Date().toISOString()});els.offForm.reset();$("officialTime").value="19:00";window.syncCustomPickers?.(els.offForm);setMsg(els.offStatus,"公式予定を追加したよ。","ok");await refresh(true)}catch(err){setMsg(els.offStatus,"追加に失敗したよ: "+(err.message||err),"err")}});

if(shared)sb.auth.onAuthStateChange(()=>{setTimeout(()=>{syncAuthState(true).catch(err=>setMsg(els.page,"認証更新に失敗しました: "+(err.message||err),"err"))},0)});
syncAuthState(true).catch(err=>setMsg(els.page,"読み込みに失敗したよ: "+(err.message||err),"err"));
