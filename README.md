🐙 粉もんスタンド おしん - LINEモバイルオーダーシステム
LINEアプリ上で動作する、店舗向けモバイルオーダーシステムです。
お客様はLINEから手軽に注文でき、店舗側はGoogleスプレッドシートで注文・メニューを一元管理できます。さらに、ビジネスチャットツール「Lark」へのリアルタイム通知連携も実装しています。
✨ 特徴
LINEアプリ完結: お客様は専用アプリのインストール不要。LINE公式アカウントのリッチメニュー等から即起動。
リアルタイムメニュー: Googleスプレッドシートを更新するだけで、メニュー内容や価格、画像が即座に反映。
高度なカスタマイズ: 商品オプション（サイズ）、フレーバー（味）、トッピングの選択に対応。
店舗設定の柔軟性: 営業時間や準備時間をスプレッドシートで設定すると、受取可能時間の選択肢が自動計算されます。
自動通知:
お客様へ: LINE Flex Message（リッチなカード形式）で注文完了通知とレシートを送付。
店舗へ: Lark（またはLINE）へ注文内容を即時通知。
低コスト運用: サーバーレス構成（Google Apps Script + GitHub Pages等）のため、維持費を最小限に抑えられます。
🛠 システム構成
Frontend: HTML5, CSS3, JavaScript (Vanilla), LINE LIFF SDK
Backend: Google Apps Script (GAS)
Database: Google Sheets
Image Storage: Cloudflare R2 (GAS経由でアップロード)
Notification: LINE Messaging API, Lark Webhook
📂 ディレクトリ構成
konamon_order/
├── index.html          # モバイルオーダー トップ画面
├── style.css           # スタイルシート
├── app.js              # フロントエンドロジック (LINE連携, カート処理, API通信)
├── code.gs             # バックエンドロジック (Google Apps Script)
└── guide/              # 使い方ガイドページ
    ├── index.html
    └── style.css


🚀 セットアップ手順
1. Google スプレッドシートの準備
以下のシート構成でスプレッドシートを作成します。
注文履歴: 注文データが蓄積されます。
列: 注文ID, 注文日時, 受取希望, 合計金額, 受取人名, LINE表示名, LINE User ID, 注文詳細, ステータス, Lark連携
メニューマスタ: 商品情報を管理します。
列: カテゴリ, 商品ID, 商品名, 説明, 画像URL, オプション設定(SKU:名前:価格), フレーバー, トッピンググループID, 並び順
トッピングマスタ: トッピング情報を管理します。
店舗設定: 営業時間などを管理します。
項目: 営業開始時間, 営業終了時間, 最短準備時間(分), 時間間隔(分)
2. Google Apps Script (GAS) のデプロイ
スプレッドシートの「拡張機能」>「Apps Script」を開きます。
code.gs の内容をコピー＆ペーストします。
スクリプト内の以下の定数を環境に合わせて書き換えます。
const SPREADSHEET_ID = 'あなたのスプレッドシートID';
const LARK_WEBHOOK_URL = 'あなたのLark Webhook URL';
const R2_ACCOUNT_ID = '...'; // Cloudflare R2設定（画像アップロード用）


「デプロイ」>「新しいデプロイ」から「ウェブアプリ」として公開します。
アクセスできるユーザー: 「全員」に設定してください。
発行された WebアプリURL を控えておきます。
3. LINE Developers (LIFF) の設定
LINE Developersコンソールでチャネルを作成し、「LIFF」タブからLIFFアプリを追加します。
Scopes 設定で profile, chat_message.write にチェックを入れます。
発行された LIFF ID を控えておきます。
4. フロントエンドの設定
app.js の先頭部分にある定数を書き換えます。
const LIFF_ID = "取得したLIFF ID"; 
const BACKEND_URL = "取得したGASのWebアプリURL"; 


5. フロントエンドの公開
index.html, style.css, app.js を任意のWebサーバー（GitHub Pages, Vercel, Firebase Hostingなど）にアップロードします。
※ アップロードしたURLを、LINE DevelopersのLIFF設定画面にある「Endpoint URL」に登録してください。
⚙️ 運用・カスタマイズ
店舗設定の変更
スプレッドシートの「店舗設定」シートを編集するだけで、アプリの動作が変わります。
営業時間の変更: 11:00 → 10:00 に書き換えるだけ。
受取時間の間隔: 5 (分) → 15 (分) などに変更可能。アプリの再デプロイは不要です。
Lark連携
code.gs に設定した Webhook URL を通じて、注文が入るとLarkのグループチャット等に即座に通知が飛びます。
スプレッドシートの「注文詳細」の内容（味やトッピング含む）がそのまま送信されます。
⚠️ 注意事項
このシステムはブラウザ（LINE内ブラウザ含む）で動作しますが、決済機能は含まれていません（店頭払い想定）。
LINE Flex Messageの送信には、ユーザーがLIFFアプリ内で認証を許可している必要があります。
License
Copyright (c) 2026 Office Plata / Konamon Stand Oshin
