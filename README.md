# 米プレラ サイト構成

このリポジトリは、公開ページ `index.html` と管理ページ `admin.html` を中心にした静的サイトです。
公開ページは Cloudflare Workers / Pages Functions の公開 API を優先して使い、必要に応じて Supabase 公開キー直読みか `localStorage` にフォールバックします。管理ページは Cloudflare Workers / Pages Functions 経由で Discord 認証と審査操作を行います。

## ファイル

- `index.html`: 一般公開ページ
- `public.js`: 公開ページの表示、参加登録、検索、気になる保存
- `admin.html`: 管理ページ UI
- `admin.js`: 管理ページの Discord 認証フローと審査 UI
- `functions/api/admin/*`: Pages Functions と Worker ルーターから呼び出す管理 API
- `functions/api/public/*`: 公開ページが使う公開 API
- `functions/_lib/*`: セッション管理と Supabase REST 共通処理
- `worker/index.js`: `workers.dev` 用の API ルーター
- `wrangler.toml`: Workers デプロイ設定
- `.assetsignore`: Workers 配信から外すファイル一覧
- `pickers.css` / `pickers.js`: カスタムピッカー UI
- `motion.css` / `motion.js`: 背景やスクロール演出

## できること

### 公開ページ
- 参加者が曲を仮登録できる
- 承認済みの参加動画をタイムテーブルに表示できる
- 「全てお米の所為です。」の公式予定を同じタイムテーブルに混ぜて表示できる
- 開催情報、初見向け説明、用語集、ルール、通知導線を表示できる
- 検索、レーン絞り込み、時間帯絞り込み、気になる保存、`.ics` 保存が使える
- Supabase 未設定時は `localStorage` だけで見た目確認ができる

### 管理ページ
- Discord 認証のあとにレビュー用パスワードを入力して審査モードを開ける
- 承認、差し戻し、削除、公式予定の追加削除、イベント設定変更ができる
- 承認一覧の近くで、いまどの Discord アカウントでログインしているか確認できる
- 管理操作は Cloudflare Functions から Supabase REST API に対して実行する

## ローカル確認

### 公開ページだけ確認したいとき

同じオリジンで `/api/public/*` が動く環境なら、公開ページはそこから公開データ取得と参加登録送信を行います。
HTML ファイルを単独で開くなど API がない確認環境では、`public.js` 先頭の `SUPABASE_URL` と `SUPABASE_ANON_KEY` が空のままなら `localStorage` モードで動きます。
このとき使うキーは次のとおりです。

- `kome_prerush_entries_local_v3`
- `kome_prerush_official_v1`
- `kome_prerush_settings_v1`
- `kome_prerush_viewer_favorites_v1`

### 管理ページも確認したいとき

`admin.html` は `/api/admin/*` の Cloudflare Functions を前提にしています。
HTML ファイルを単独で開くだけでは Discord 認証も審査操作も動きません。Cloudflare Pages か `wrangler dev` / `wrangler pages dev` など、API が同じオリジンで動く環境で確認してください。

## 公開データを Supabase で共有する

Cloudflare / Workers でこのリポジトリを動かす場合、公開ページは `/api/public/*` を使うので `public.js` の公開キー設定は必須ではありません。
静的配信だけで公開 API を使わずに動かしたい場合は、`public.js` の先頭にある次の値を設定します。

```js
const SUPABASE_URL = "ここに Project URL";
const SUPABASE_ANON_KEY = "ここに anon key";
```


SQL をそのまま流したい場合は、リポジトリ直下の supabase-setup.sql も使えます。

### 作成するテーブル

```sql
create table public.kome_prerush_entries (
  id text primary key,
  artist text not null check (char_length(artist) between 1 and 80),
  title text not null check (char_length(title) between 1 and 120),
  parent_slot integer not null check (parent_slot between 1 and 5),
  start_time text not null check (start_time ~ '^(?:[01]\d|2[0-3]):[0-5]\d$'),
  url text not null check (url ~ '^https?://'),
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.kome_prerush_official_videos (
  id text primary key,
  title text not null check (char_length(title) between 1 and 120),
  start_time text not null check (start_time ~ '^(?:[01]\d|2[0-3]):[0-5]\d$'),
  url text,
  note text,
  created_at timestamptz not null default now()
);

create table public.kome_prerush_settings (
  id text primary key,
  event_date text check (event_date is null or event_date ~ '^\d{4}-\d{2}-\d{2}$'),
  official_name text not null,
  official_url text not null check (official_url ~ '^https?://'),
  event_hashtag text,
  x_search_url text,
  live_playlist_url text,
  archive_playlist_url text,
  entry_close_minutes integer not null default 15 check (entry_close_minutes between 5 and 120),
  updated_at timestamptz not null default now()
);
```

### 公開ページ向けの RLS

```sql
alter table public.kome_prerush_entries enable row level security;
alter table public.kome_prerush_official_videos enable row level security;
alter table public.kome_prerush_settings enable row level security;

create policy "public can read approved entries"
on public.kome_prerush_entries
for select
to anon, authenticated
using (status = 'approved');

create policy "public can submit pending entries"
on public.kome_prerush_entries
for insert
to anon, authenticated
with check (
  status = 'pending'
  and parent_slot between 1 and 5
  and start_time ~ '^(?:[01]\d|2[0-3]):[0-5]\d$'
);

create policy "public can read official videos"
on public.kome_prerush_official_videos
for select
to anon, authenticated
using (true);

create policy "public can read settings"
on public.kome_prerush_settings
for select
to anon, authenticated
using (true);
```

重要:
- `anon` に `update` や `delete` を開けないでください。
- 公開ページは承認済み `entries` だけ読む前提です。
- 管理操作は後述の Cloudflare Functions + service role に寄せます。

### 初期設定の例

```sql
insert into public.kome_prerush_settings (
  id,
  event_date,
  official_name,
  official_url,
  event_hashtag,
  x_search_url,
  live_playlist_url,
  archive_playlist_url,
  entry_close_minutes
) values (
  'default',
  '2026-08-18',
  '全てお米の所為です。',
  'https://www.youtube.com/@or_should_rice',
  '#米プレラ',
  '',
  '',
  '',
  15
)
on conflict (id) do update
set event_date = excluded.event_date,
    official_name = excluded.official_name,
    official_url = excluded.official_url,
    event_hashtag = excluded.event_hashtag,
    x_search_url = excluded.x_search_url,
    live_playlist_url = excluded.live_playlist_url,
    archive_playlist_url = excluded.archive_playlist_url,
    entry_close_minutes = excluded.entry_close_minutes;
```

## 管理ページを Cloudflare + Discord 認証で動かす

管理ページは `functions/api/admin/*` を通して動きます。
このリポジトリには `worker/index.js` と `wrangler.toml` も含めてあり、`workers.dev` へ出す場合でも `/api/admin/*` が 404 にならないようにしてあります。
ブラウザから直接 Supabase の管理権限を持たせず、Cloudflare Functions 側で Discord 認証済みセッションとレビュー用パスワードを確認してから、Supabase REST API に service role で接続します。

### Cloudflare に設定する環境変数

- `ADMIN_SESSION_SECRET`: セッション Cookie 署名用の十分長いランダム文字列
- `DISCORD_CLIENT_ID`: Discord アプリの Client ID
- `DISCORD_CLIENT_SECRET`: Discord アプリの Client Secret
- `DISCORD_REDIRECT_URI`: 任意。未設定なら `https://<your-domain>/api/admin/discord/callback`
- `SUPABASE_URL`: Supabase Project URL
- `SUPABASE_SERVICE_ROLE_KEY`: 管理 API 用の service role key
- `ADMIN_REVIEW_PASSWORD`: 審査モード解錠用パスワード

注意:
- `SUPABASE_SERVICE_ROLE_KEY` は絶対にブラウザに出さないでください。
- `ADMIN_REVIEW_PASSWORD` はコードの既定値に頼らず、必ず Cloudflare 側の環境変数で上書きしてください。

### Discord Developer Portal 側で必要な設定

Discord アプリの OAuth2 Redirects に、管理ページのコールバック URL を登録します。

例:

```text
https://your-domain.example/api/admin/discord/callback
```

この構成では `identify` スコープを使って、ログイン中の Discord ユーザー情報を取得します。

### 管理ページの流れ

1. `Discordで認証` ボタンで Discord OAuth を開始する
2. 認証後にレビュー用パスワード欄が有効になる
3. 正しいパスワードを入力すると審査モードが開く
4. 承認一覧の上に、現在操作中の Discord アカウントが表示される
5. その状態で承認、差し戻し、削除、公式予定編集、イベント設定保存ができる

## 注意

- `public.js` の `SUPABASE_URL` / `SUPABASE_ANON_KEY` は公開用です。
- `admin.js` に秘密鍵は入れません。管理操作は必ず `functions/` 経由で行います。
- `admin.html` は Cloudflare Functions / Worker API と同じオリジンに置いてください。
- Discord 認証とレビュー解錠が済むまでは、管理 UI は開かない設計です。
