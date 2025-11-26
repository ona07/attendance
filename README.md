# AI勤怠管理 (GAS構成)

GitHub Pagesなどの静的ホスティング上のフロントエンドと、Google Apps Script (GAS) をバックエンドにしたシンプルな勤怠送信ツールです。NotionのDBに出退勤とAIコメントを保存します。

## フロントエンド
- `script.js` の `GAS_BASE_URL` を、デプロイしたGASのウェブアプリURL（`.../exec` ではなく、googleusercontent.comの長いURL）に差し替えてください。
- ボタン: `出勤` (`/checkin`)、`退勤` (`/checkout`) のPOSTを送ります。

## GAS側のポイント
- `gas_app.js` をGASに貼り付けてデプロイ（新しいデプロイ→ウェブアプリ）。
- スクリプトプロパティに以下を設定:
  - `NOTION_SECRET`
  - `NOTION_DATABASE_ID`
  - `OPENAI_API_KEY`
- 公開設定は「全員（匿名ユーザー含む）」を選択し、デプロイ後に表示される `googleusercontent.com` のURLをフロント側に設定。

## Notionデータベース
- プロパティ例: `Date` (date), `Check-in` (date), `Check-out` (date), `Work Hours` (number), `AI Comment` (rich text)。

## よくあるエラー
- CORS/403: ウェブアプリの公開範囲が「全員（匿名）」になっているか確認。
- 404やERR_FAILED: `GAS_BASE_URL` に `.../exec` の代わりに `googleusercontent.com/.../exec` を使っているか確認。
