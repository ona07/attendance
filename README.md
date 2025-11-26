# AI勤怠管理 (GASのみでホスト)

フロントエンドもバックエンドもGoogle Apps Script内で完結させる構成です。`doGet` がHTML/CSS/JSを返し、`doPost` が Notion + OpenAI への書き込み・コメント生成を行います。同一オリジンになるためCORS問題を回避できます。

## セットアップ
1) `gas_app.js` をGASプロジェクトに貼り付ける。
2) スクリプトプロパティを設定:
   - `NOTION_SECRET`
   - `NOTION_DATABASE_ID`
   - `OPENAI_API_KEY`
3) デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
   - 実行するユーザー: 自分
   - アクセスできるユーザー: 全員（組織ポリシーで匿名が選べない場合は「全員」でも可。同一オリジンなのでCORSは発生しません）
4) デプロイ後のウェブアプリURL（`https://script.google.com/macros/s/.../exec`）にアクセスすると画面が表示されます。
   - `health` エンドポイント: `.../exec/health` で `{ ok: true }` を返します。

## 画面・API挙動
- ボタン `出勤` → `POST /checkin`
- ボタン `退勤` → `POST /checkout`
- 返却データのメッセージとAIコメントを画面に表示し、レスポンスJSONをログ欄に表示します。

## Notionデータベース
- 必須プロパティ
  - `Date` (date), `Check-in` (date), `Check-out` (date), `Work Hours` (number), `AI Comment` (rich text), `Title` (title)
  - 休憩管理用: `Break Start` (date), `Break End` (date), `Break Minutes` (number), `Timeline` (rich text)
- `Title` が空のページは自動で `${date} 出退勤` をセットします。
- `Work Hours` には休憩を差し引いた実働時間(時間)を保存します。`Break Minutes` には休憩累計(分)を保存します。`Timeline` には当日のイベント履歴(JSON文字列)を保存します。
