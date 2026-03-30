# すべ米プレミアラッシュサイト

Cloudflare Workers にデプロイする前提で整理した、静的 HTML 中心のイベントサイトです。

公開ページは `index.html`、管理ページは `admin.html` をそのまま編集できます。
認証・審査・Supabase への読み書きは Worker API 側へ寄せてあり、ブラウザ側には秘密情報を置きません。

## 構成

- `index.html`
  - 公開ページのマークアップ
- `public.js`
  - 公開ページ UI のみ
  - データ取得と申請送信は `/api/public/*` 経由
  - `localStorage` は「気になる登録」と「自分が送った申請ID」の保持だけに使用
- `admin.html`
  - 管理ページのマークアップ
- `admin-gate.js`
  - 管理ページ前段のパスワードゲート UI
  - 照合は `/api/admin/gate` に POST して Worker 側で実施
- `admin.js`
  - Discord 認証、Discord ロール判定、審査 UI
  - すべて `/api/admin/*` 経由
- `functions/api/**`
  - Worker から呼ばれる API ハンドラ
- `functions/_lib/runtime-config.js`
  - Cloudflare Variables / Secrets Store バインディングの吸収レイヤー
- `functions/_lib/session.js`
  - 署名付き Cookie と Discord OAuth 状態管理
- `functions/_lib/admin-backend.js`
  - Supabase REST API 呼び出しと入力検証
- `worker/index.js`
  - Workers ルーター
  - `/admin` -> `admin.html`、`/` -> `index.html` の配信
  - HTML 用セキュリティヘッダー付与
- `wrangler.toml`
  - Workers 用設定
  - Secrets Store の差し込み位置をコメント付きで記載

## 今回の整理内容

### 1. Workers 前提に責務を整理

- 公開ページの Supabase 直読みとローカルフォールバックを削除
- 公開ページは `/api/public/data`、`/api/public/entries`、`/api/public/statuses` だけを使う構成に変更
- 管理ページの前段パスワードをクライアント側ハードコードから廃止
- `/api/admin/gate` を追加して、管理ページ前段パスワードも Worker 側で照合

### 2. Secrets Store を使えるように整理

- `functions/_lib/runtime-config.js` を追加
- `env.MY_SECRET` が通常の文字列でも Secrets Store binding でも読めるように統一
- これにより、Secrets Store の binding 名をそのまま
  - `ADMIN_SESSION_SECRET`
  - `ADMIN_GATE_PASSWORD`
  - `DISCORD_CLIENT_ID`
  - `DISCORD_CLIENT_SECRET`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `APPLICANT_LOOKUP_SECRET`
  として使えます

### 3. HTML は HTML のまま残す方針に整理

- ページ構造・文言・セクションは `index.html` / `admin.html` に残したままです
- 認証や DB 接続の責務だけを Worker API 側へ移しました

### 4. Workers 配信面を整理

- `worker/index.js` にルーティングを集約
- `/admin` で `admin.html` が開くように整備
- `/api/*` は `Cache-Control: no-store`
- HTML には Worker 側から CSP / `frame-ancestors 'none'` / `X-Frame-Options` などを付与
- `.assetsignore` を見直して、ソース・SQL・README などを静的配信対象から除外

## Cloudflare Workers 設定

### `wrangler.toml`

`wrangler.toml` は Workers 用に整理済みです。

- 実際に使う設定だけを有効化
- 未入力の場所はコメントアウト
- Secrets Store binding の例もコメント付きで記載

### Variables に入れる値

秘密ではない値だけを Variables に入れます。

- `SUPABASE_URL`
  - 例: `https://your-project.supabase.co`
- `DISCORD_REDIRECT_URI`
  - 任意
  - 未設定なら `https://<your-domain>/api/admin/discord/callback` を自動使用
- `DISCORD_GUILD_ID`
  - レビュー権限ロールを判定する Discord サーバー ID
- `DISCORD_REVIEW_ROLE_IDS`
  - レビュー権限として扱う Discord ロール ID
  - 複数ある場合はカンマ区切り

### Secrets Store に入れる値

Secrets Store に secret を作り、Worker へ binding してください。

- `ADMIN_SESSION_SECRET`
- `ADMIN_GATE_PASSWORD`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APPLICANT_LOOKUP_SECRET`

`SUPABASE_URL` は secret ではないので Variables 側です。
`SUPABASE_SERVICE_ROLE_KEY` は必ず Secrets Store 側に置いてください。

Cloudflare 公式:
- https://developers.cloudflare.com/secrets-store/integrations/workers/

## Supabase 設定

### 初回セットアップ

`supabase-setup.sql` を Supabase の SQL Editor で実行してください。

これで必要な主テーブルと初期設定が入ります。

- `kome_prerush_entries`
- `kome_prerush_official_videos`
- `kome_prerush_settings`
- `kome_prerush_admin_assignments`

### 既存環境向け migration

既存プロジェクトを追従させる場合は必要に応じて以下を実行します。

- `supabase-migrate-review-notice.sql`
- `supabase-migrate-deleted-status.sql`
- `supabase-migrate-frame-slots.sql`
- `supabase-migrate-parent-number.sql`
- `supabase-migrate-secondary-slot.sql`
- `supabase-migrate-admin-crew.sql`

## デプロイ手順

1. Supabase で `supabase-setup.sql` を実行
2. Cloudflare Secrets Store に必要な secret を作成
3. Worker に Secrets Store binding を追加
4. Worker Variables に `SUPABASE_URL` などを設定
5. Discord Developer Portal の Redirect URL を設定
6. `npx wrangler deploy`

## ルーティング

- `/`
  - `index.html`
- `/admin`
  - `admin.html`
- `/api/public/*`
  - 公開 API
- `/api/admin/*`
  - 管理 API

## 補足

- 公開ページは Worker API が前提です。`file://` 直開きでの完全動作は想定していません。
- ブラウザ側に残している保存は、気になる一覧と申請追跡用 ID だけです。
- 管理ページは
  1. 前段ゲートパスワード
  2. Discord 認証
  3. Discord ロール確認
  の順で権限が上がります。
