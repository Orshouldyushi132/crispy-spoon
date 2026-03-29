# 米プレラ 完成版セット

このワークスペースでは、一般公開ページが `index (3).html`、公開側ロジックが `public.js`、管理ページが `admin.html`、管理側ロジックが `admin.js` です。

## できること

### 公開ページ
- 参加者が曲を仮予約できる
- 承認済みの参加者予約を公開予定タイムラインに表示できる
- 「全てお米の所為です。」の公式動画予定を同じタイムラインに混ぜて表示できる
- 参加者予約と公式予定のうち、いちばん近い次回投稿までの残り時間を表示できる
- イベント日が設定されていれば「次は○○の、○○です。」を表示できる
- 初見向けの説明、用語集、ルール要約、通知導線を表示できる
- 気になる保存、カレンダー保存、検索、スマホ下部導線を使える
- ハッシュタグや再生リストURLがあれば公開ページに反映できる
- 共有環境では、未掲載の登録を一般公開しない

### 管理ページ
- 参加者の仮予約を承認 / 却下 / 削除できる
- イベント日を設定できる
- 公式チャンネル名 / URL を設定できる
- ハッシュタグ、X の検索URL、再生リストURL、登録締切分数を設定できる
- 「全てお米の所為です。」の動画予定を追加 / 削除できる
- Supabase Auth のメール+パスワード / マジックリンクでログインできる
- 管理者メールに登録されたアカウントだけ編集UIが開く

## ローカル保存

そのまま開くと `localStorage` 保存です。  
公開ページはそのまま確認できます。  
管理ページは安全側に倒してあり、`admin.js` の `ALLOW_LOCAL_ADMIN_FALLBACK` を `true` にしない限りローカル編集UIは開きません。

使っているキーは次の 3 つです。

- `kome_prerush_entries_local_v3`
- `kome_prerush_official_v1`
- `kome_prerush_settings_v1`

## Supabase で共有するには

`public.js` と `admin.js` の先頭にある次を埋めます。

```js
const SUPABASE_URL = "ここにProject URL";
const SUPABASE_ANON_KEY = "ここにanon key";
```

### Auth の前準備

1. Supabase Auth で管理者用ユーザーを作成します。
2. `Authentication -> URL Configuration` に管理ページの URL を追加します。
   例: `https://your-domain.example/admin.html`
3. マジックリンクを使う場合も、同じ URL を Redirect URL に含めます。

`admin.js` では、パスワードログインとマジックリンクの両方に対応しています。  
マジックリンク送信時は `shouldCreateUser: false` にしているので、事前に存在するユーザーにしか送れません。

### 作成するテーブル

以下は、そのまま使いやすいようにチェック制約を足した例です。

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

create table public.kome_prerush_admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
```

### RLS

```sql
alter table public.kome_prerush_entries enable row level security;
alter table public.kome_prerush_official_videos enable row level security;
alter table public.kome_prerush_settings enable row level security;
alter table public.kome_prerush_admins enable row level security;

create or replace function public.is_kome_prerush_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.kome_prerush_admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create policy "admins can read own admin row"
on public.kome_prerush_admins
for select
to authenticated
using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "public can read approved entries"
on public.kome_prerush_entries
for select
to anon, authenticated
using (status = 'approved');

create policy "admins can read all entries"
on public.kome_prerush_entries
for select
to authenticated
using (public.is_kome_prerush_admin());

create policy "public can submit pending entries"
on public.kome_prerush_entries
for insert
to anon, authenticated
with check (
  status = 'pending'
  and parent_slot between 1 and 5
  and start_time ~ '^(?:[01]\d|2[0-3]):[0-5]\d$'
);

create policy "admins can update entries"
on public.kome_prerush_entries
for update
to authenticated
using (public.is_kome_prerush_admin())
with check (public.is_kome_prerush_admin());

create policy "admins can delete entries"
on public.kome_prerush_entries
for delete
to authenticated
using (public.is_kome_prerush_admin());

create policy "public can read official videos"
on public.kome_prerush_official_videos
for select
to anon, authenticated
using (true);

create policy "admins can insert official videos"
on public.kome_prerush_official_videos
for insert
to authenticated
with check (public.is_kome_prerush_admin());

create policy "admins can update official videos"
on public.kome_prerush_official_videos
for update
to authenticated
using (public.is_kome_prerush_admin())
with check (public.is_kome_prerush_admin());

create policy "admins can delete official videos"
on public.kome_prerush_official_videos
for delete
to authenticated
using (public.is_kome_prerush_admin());

create policy "public can read settings"
on public.kome_prerush_settings
for select
to anon, authenticated
using (true);

create policy "admins can insert settings"
on public.kome_prerush_settings
for insert
to authenticated
with check (public.is_kome_prerush_admin());

create policy "admins can update settings"
on public.kome_prerush_settings
for update
to authenticated
using (public.is_kome_prerush_admin())
with check (public.is_kome_prerush_admin());
```

重要:
- `anon` に `update / delete / insert official / update settings` を開けないでください。
- 公開ページは承認済みの `entries` だけ読む前提です。
- 未掲載登録を公開したい場合でも、別の公開専用ビューを作る方が安全です。

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

### 管理者メールの登録

```sql
insert into public.kome_prerush_admins (email)
values ('admin@example.com')
on conflict (email) do nothing;
```

## 注意

本番では次をセットで入れるのが前提です。

- `admin.js` に Supabase Project URL / anon key を設定する
- Supabase Auth に管理ユーザーを作る
- `kome_prerush_admins` に許可メールを登録する
- 上の RLS をそのまま適用する

この構成なら、普通の静的HTMLでも「公開ページは anon で安全に読める」「管理ページはログイン済み管理者だけ編集できる」に分けられます。
