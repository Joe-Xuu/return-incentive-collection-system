# Re:Turn — O2O 容器貸出・回収システム

<div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
  <a href="README.md"><button style="padding:8px 16px; border:2px solid #06C755; background:#fff; color:#06C755; border-radius:6px; font-weight:700; font-family:Montserrat,sans-serif; cursor:pointer; font-size:13px;">🇬🇧 EN</button></a>
  <a href="README.ja.md"><button style="padding:8px 16px; border:2px solid #06C755; background:#06C755; color:#fff; border-radius:6px; font-weight:700; font-family:Montserrat,sans-serif; cursor:pointer; font-size:13px;">🇯🇵 日本語</button></a>
  <a href="README.zh.md"><button style="padding:8px 16px; border:2px solid #06C755; background:#fff; color:#06C755; border-radius:6px; font-weight:700; font-family:Montserrat,sans-serif; cursor:pointer; font-size:13px;">🇨🇳 中文</button></a>
</div>

フリクションレスのO2Oサーキュラー容器貸出＆インセンティブシステム。
LINE LIFFで容器を借り、NFC+Raspberry Piで返却、Google Sheetsでポイントを管理。

---

## システムアーキテクチャ

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Re:Turn System                                    │
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐   │
│  │   LINE App    │    │  NFC + Raspi │    │   Raspi Display           │  │
│  │  (スマホ)     │    │  (貸出/返却) │    │   (ランキング + CO2)      │  │
│  │               │    │              │    │                           │  │
│  │ Borrow LIFF ──┼────┤ NFCタグ読取 │    │ Flask SSE ← return_core   │  │
│  │ Dashboard ────┼──┐ │ GASへPOST   │    │ UI はGAS getStatsを取得   │  │
│  └───────────────┘  │ └──────┬───────┘    └────────────┬─────────────┘  │
│                     │        │                         │                 │
│                     │ LIFF   │ HTTP POST               │ HTTP GET        │
│                     │ SDK v2 │                         │                 │
│                     ▼        ▼                         ▼                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                   Google Apps Script (GAS)                        │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐   │   │
│  │  │ doPost()    │  │ doGet()      │  │ sendLineMessage()      │   │   │
│  │  │ • borrow    │  │ • getStats   │  │ LINE Messaging API     │   │   │
│  │  │ • return    │  │ • getDashboard│  │ プッシュ通知           │   │   │
│  │  │ • updateName│  │              │  │                        │   │   │
│  │  │ • getDashboard│ │              │  │                        │   │   │
│  │  └──────┬──────┘  └──────┬───────┘  └────────────┬───────────┘   │   │
│  └─────────┼────────────────┼───────────────────────┼───────────────┘   │
│            │                │                       │                    │
│            ▼                ▼                       ▼                    │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     Google Sheets (データベース)                  │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │   │
│  │  │  Users   │  │   Logs   │  │ Mapping  │                       │   │
│  │  └──────────┘  └──────────┘  └──────────┘                       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    LIFF Frontend (Dashboard)                      │   │
│  │  GitHub Pages → liff.line.me/2008626930-pLAvndnp                  │   │
│  │  ┌────────────┐  ┌──────────┐  ┌──────────┐                     │   │
│  │  │ index.html │  │ style.css│  │  app.js  │                     │   │
│  │  └────────────┘  └──────────┘  └──────────┘                     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### データフロー

```
貸出:  NFC/Raspi → GAS doPost(action=borrow)     → Sheets(Logs+Users) → LINE Push(ユーザー)
返却:  NFC/Raspi → GAS doPost(action=return)     → Sheets(Logs)      → LINE Push(ユーザー)
ダッシュボード: LIFF起動 → GAS doGet/getDashboard → Sheets(Users+Logs) → LIFF表示
ランキング: Raspi表示 → GAS doGet(getStats)     → Sheets(Users)     → Raspi表示
```

---

## コンポーネント一覧

### 1a. Borrow LIFF（学生用 貸出画面）

学生がNFCタグをタップして容器を借りる時に表示される画面。QRコードに埋め込まれた容器IDがURLパラメータで渡されます。

**リポジトリ:** [`Joe-Xuu/return-liff-frontend`](https://github.com/Joe-Xuu/return-liff-frontend)  
**LIFF ID:** `2008626930-AddPwDy7`

```
return-liff-frontend/
├── index.html         # 単一HTML（CSS+JS内蔵）: スプラッシュ → 貸出 → 成功 + ランキング
├── nfc-simulator.html # 開発用: NFCタップをシミュレートしてGAS返却をテスト
├── sfc_logo.png       # 慶應SFCロゴ
└── megloo_logo.png    # Meglooプロジェクトロゴ
```

| 機能 | 詳細 |
|--------|--------|
| 入口 | QRコード（`?id=C-001`パラメータ付き） |
| スプラッシュ | 緑色のフルスクリーン "Re:Turn" + ウェルカムメッセージ、1.8秒でフェードアウト |
| 貸出画面 | 容器ID表示 + 「はい」ボタン |
| GAS通信 | `POST borrow`（`userId` + `containerId`） |
| 成功画面 | CO2削減量カウンターアニメーション（1容器=94g）、環境メタファー表示 |
| ランキング | ダークカード + 叩き込みアニメーション + 紙吹雪 + 振動エフェクト |
| 名前編集 | 8文字大文字モーダル、localStorage + GAS `updateName` に保存 |
| LIFF認証 | LIFF init → IDトークン → ログインフロー（開発時はlocalhostバイパス可） |

**フロー:** `QR読取 → LIFF起動 → スプラッシュ → 容器ID確認 → 「はい」タップ → GAS borrow → 紙吹雪 + ランキング叩き込み`

### 1b. Dashboard LIFF（ユーザー状態確認画面）

自分の貸出状況・ポイント・現在借りている容器を確認するダッシュボード。LINEリッチメニューから起動。

**リポジトリ:** [`Joe-Xuu/return-incentive-collection-system`](https://github.com/Joe-Xuu/return-incentive-collection-system) ← このリポジトリ  
**LIFF ID:** `2008626930-pLAvndnp`

```
return-incentive-collection-system/
├── index.html                     # アプリシェル: プロフィール + 借出中 + タスクセンター
├── style.css                      # ライト/フレッシュテーマ、CSS変数、モバイルファースト
├── app.js                         # LIFF init、GASデータ取得、表示ロジック、ポイント = usageCount × 10
└── line-entry/
    ├── rich-menu-preview.html     # リッチメニュー用Canvas PNGジェネレーター（2500×843）
    └── rich-menu-config.json      # シングル全幅ボタンのタップ領域設定
```

| 機能 | 詳細 |
|--------|--------|
| 入口 | LINEリッチメニューボタン → LIFF URL |
| プロフィールカード | アバター + 表示名 + マスク済みユーザーID |
| 統計 | ポイント（= usageCount × 10）+ 総利用回数 |
| 借出中容器 | 未返却容器のリスト（借出時刻付き）、または "All cleared!" |
| タスクセンター | プレースホルダー: 「集中回収」マップ/ロック獲得（近日公開） |
| GAS通信 | `GET getDashboard`（`userId` + `userName`） |

### 2. GAS バックエンド（APIサーバー）

| 機能 | アクション | メソッド | 呼出元 | 説明 |
|------|--------|--------|-----------|-------------|
| 貸出 | `borrow` | POST | NFC/Raspi | 貸出記録、ユーザーカウント更新、LINE確認通知 |
| 返却 | `return` | POST | NFC/Raspi | NFC→containerId解決で返却記録、LINE確認通知 |
| 名前更新 | `updateName` | POST | LIFFフロントエンド | Usersシートの表示名を更新 |
| ダッシュボード | `getDashboard` | POST/GET | LIFFフロントエンド | userName、usageCount、借出中アイテムを返す |
| 全体統計 | `getStats` | GET | Raspi表示 | totalBorrows + トップ5ランキング |

**デプロイ先:** Google Apps Script → `https://script.google.com/macros/s/.../exec`
**コード:** Google Apps Scriptエディタ（本リポジトリには含まれません → [GASコードリファレンス](#gasコードリファレンス)参照）

### 3. Google Sheets（データベース）

**スプレッドシートID:** `19yL67pjWXKzhO6i-WYEQGaL2fi_ElHmdi7XiL1oCAIg`

| シート | カラム | 用途 |
|-------|---------|---------|
| `Users` | `userId`, `score`(貸出回数), `userName`, `lastActive` | ユーザー登録 & 全体統計 |
| `Logs` | `recordId`, `containerId`, `userId`, `borrowTimestamp`, `returnTimestamp`, `status`, `notes` | 全貸出・返却トランザクション |
| `Mapping` | `nfcId`, `containerId` | NFCタグ → 容器ID のマッピング |

**Logsのステータス値:** `BORROWED`, `RETURNED`, `ERROR_CLOSED`, `ERROR_RETURN`

### 4. NFC + Raspberry Pi ステーション（返却 & ランキング表示）

MFRC522 NFCリーダーを搭載したRaspberry Pi 1台で、2つのPythonプロセスを同時実行:

| プロセス | ファイル | 役割 |
|---------|------|------|
| NFCデーモン | `return_core.py` | 連続NFCタグスキャン、ローカルFlaskトリガー、非同期GAS POST |
| Flaskサーバー | `app.py` | Web UI配信 + SSEプッシュ + ランキング表示 |

**リポジトリ:** `https://github.com/Joe-Xuu/return-system`（プライベート）  
**GitFrontミラー:** [`https://gitfront.io/r/joe-xuu/c8eP5yts7JdF/return-system/`](https://gitfront.io/r/joe-xuu/c8eP5yts7JdF/return-system/)

```
return_system/
├── app.py                  # Flaskサーバー: /api/trigger, /api/stream (SSE), GASフェッチ
├── return_core.py          # NFCデーモン: MFRC522スキャン → 0.5sローカルPOST → 非同期GASスレッド
├── requirements.txt        # Python依存 (RPi.GPIO, mfrc522, Flask, requests, nfcpy)
├── test_nfc.py             # NFC読み取りテスト
├── test_raw.py             # 低レベルNFCテスト
├── manual                  # セットアップ手順
├── templates/
│   └── index.html          # ステーションUI: NFCレーダー + CO2カウンター + ランキング
└── static/
    └── success.mp4         # フォールバック成功アニメーション
```

**NFCタグスキャン時のデータフロー:**
```
NFCタグ → return_core.py (MFRC522)
          ├─[1] POST localhost:5000/api/trigger  (0.5sタイムアウト、投げっぱなし)
          │       └─ Flask → SSE /api/stream → ブラウザ: 即座に✅アニメーション
          └─[2] スレッド: POST GAS action=return    (非同期、ノンブロッキング)
                  └─ GAS handleReturn() → Sheets更新 → LINEプッシュ
```

**アーキテクチャ詳細 — 2プロセス設計:**
- `return_core.py` は**ベアメタルNFCデーモン**（Flaskに依存せず）として動作。20ms間隔でタグをスキャン、ハードウェアゲイン48dBに最大化。スキャン時: 0.5sタイムアウトでローカルFlaskにPOST（即時UIフィードバック）、その後GAS HTTP通信のためデーモンスレッドを生成。
- `app.py` はポート5000で**Flask + SSEサーバー**として動作。SSE `/api/stream` エンドポイントがブラウザと永続接続を維持。`/api/trigger` がcontainerIdを受信すると、全SSEクライアントに即座にプッシュ — タグタップから200ms未満でブラウザにチェックマークアニメーションが表示される。
- アニメーション後、ブラウザはGAS `getStats` から最新ランキングを取得。CO2 = `totalBorrows × 94g / 1000`、アニメーションカウンター + 環境メタファー表示付き。

**ステーションUI（templates/index.html）:**
- 左パネル: "Re:Turn" ブランディング + NFCレーダーパルスアニメーション + 「容器をタッチしてください」
- 右パネル: 累計CO2削減量（ライブカウンター）+ トップ5ランキング
- SSE駆動の成功オーバーレイ: 返却時にSVGチェックマークアニメーション
- 60秒間隔でGAS `getStats` をポーリングしランキング更新

### 5. LINE Bot（プッシュ通知）

| 通知 | トリガー | メッセージ |
|------|---------|---------|
| 貸出確認 | `handleBorrow` 後 | ランク + 貸出回数 + 返却期限 |
| 返却確認 | `handleReturn` 後 | 返却完了通知 |
| NFC読取失敗警告 | `ERROR_CLOSED` 検出時 | 前の利用者にNFC読取失敗の可能性を警告 |

**チャネル:** LINE Developersコンソールで設定
**実装:** GASバックエンドの `sendLineMessage()`

---

## API仕様

### `getDashboard` — ユーザーダッシュボードデータ

```
Request:  GET ?action=getDashboard&userId=<userId>&userName=<displayName>
Response: {
  status: "success",
  data: {
    userName:       string,   // 表示名
    usageCount:     number,   // 総貸出回数 (ポイント = usageCount × 10)
    borrowedItems: [{         // 現在借出中の容器
      containerId:  string,   // 例: "C-001"
      borrowTime:   string    // 例: "2026-06-22 12:30:00"
    }]
  }
}
```

### `getStats` — グローバルランキング

```
Request:  GET ?action=getStats
Response: {
  status: "success",
  totalBorrows: number,       // システム全体の総貸出数
  leaderboard: [{             // トップ5
    rank:   number,
    name:   string,
    score:  number
  }]
}
```

### `borrow` — 貸出記録

```
Request:  POST { action: "borrow", userId: string, containerId: string }
Response: {
  status: "success",
  action: "borrow",
  borrowCount: number,
  isNewUser: boolean,
  userRank: number,
  leaderboard: [{ rank, name, score }]
}
```

### `return` — 返却記録

```
Request:  POST { action: "return", nfcId: string }
Response: {
  status: "success",
  action: "return",
  type: "normal_return" | "unborrowed_return",
  userId?: string
}
```

### `updateName` — 表示名更新

```
Request:  POST { action: "updateName", userId: string, userName: string }
Response: { status: "success", action: "updateName" }
```

---

## リポジトリマップ

### 全リポジトリ

| リポジトリ | 内容 | GitHub |
|------|------|--------|
| **Dashboard LIFF** | ユーザー状態ダッシュボード（プロフィール + 借出中） | `Joe-Xuu/return-incentive-collection-system` ← このリポジトリ |
| **Borrow LIFF** | 学生用貸出画面（NFC → 借出 → ランキング） | `Joe-Xuu/return-liff-frontend` |
| **Raspi Station** | NFCデーモン + Flask SSE + ランキング表示 | `Joe-Xuu/return-system`（プライベート） |
| **Landscape** | アーキテクチャ概要（本README） | `Joe-Xuu/return-system-landscape` |
| **GAS Backend** | Google Apps Script APIサーバー | GASエディタ（コードは[GASコードリファレンス](#gasコードリファレンス)参照） |

### このリポジトリの構成

```
incentive-collect-system/          ← Dashboard LIFF
├── index.html                     # アプリシェル + 全UIカード
├── style.css                      # 全スタイルシート（CSS変数、カード、タイポグラフィ）
├── app.js                         # LIFF init、GASフェッチ、表示ロジック
├── README.md                      # ← このファイル
└── line-entry/
    ├── rich-menu-preview.html     # LINEリッチメニュー用Canvas PNGジェネレーター
    └── rich-menu-config.json      # タップ領域設定
```

### リポジトリ外のコード（別途デプロイ）

| コード | 場所 |
|------|----------|
| GAS Backend（doPost, doGet, 全ハンドラー） | Google Apps Scriptエディタ |

---

## GASコードリファレンス

2026-06-22時点の完全なGASバックエンドコードを以下に記載します。
編集時は、ここからコピー → Google Apps Scriptエディタに貼り付け → Webアプリとしてデプロイ。

<details>
<summary><b>クリックで展開 — 完全なGASコード</b></summary>

```javascript
// ====== 設定 ======
const SPREADSHEET_ID = '19yL67pjWXKzhO6i-WYEQGaL2fi_ElHmdi7XiL1oCAIg';
const LINE_CHANNEL_ACCESS_TOKEN = 'rRvqoZurif4mU6w8tGHe+h4ru34KjdVwsEwfFCYchaOHKodrWOk+bnw1biF9AsdE5NDuMuVNDMJw5T9fnOxcrx7LHr3oQNGlZVBG2q6BvUP8uRGLoVr+2/Z5X/388YNA3UM3tGla2mJvIRnUq2UAXQdB04t89/1O/w1cDnyilFU=';
const LOGS_SHEET_NAME = 'Logs';
const USERS_SHEET_NAME = 'Users';
const MAPPING_SHEET_NAME = 'Mapping';

// ====== POSTルーター ======
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    let result = {};
    if (action === 'borrow') {
      result = handleBorrow(params.userId, params.containerId);
    } else if (action === 'return') {
      const containerId = getContainerIdByNfc(params.nfcId);
      if (!containerId) {
        return ContentService.createTextOutput(
          JSON.stringify({ status: 'error', message: 'NFC未登録' })
        ).setMimeType(ContentService.MimeType.JSON);
      }
      result = handleReturn(containerId);
    } else if (action === 'updateName') {
      result = updateUserName(params.userId, params.userName);
    } else if (action === 'getDashboard') {
      result = getDashboard(params.userId, params.userName);
    } else {
      throw new Error("不明なアクションタイプ");
    }
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// ====== GETルーター ======
function doGet(e) {
  if (e.parameter && e.parameter.action === 'getStats') {
    return getGlobalStats();
  } else if (e.parameter && e.parameter.action === 'getDashboard') {
    const result = getDashboard(e.parameter.userId, e.parameter.userName);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ====== 全体統計（Raspiランキング用） ======
function getGlobalStats() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
  const data = usersSheet.getDataRange().getValues();
  let totalBorrows = 0;
  let users = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    let score = Number(data[i][1]) || 0;
    totalBorrows += score;
    users.push({
      name: data[i][2] || "ECO PLAYER",
      score: score,
      lastActive: new Date(data[i][3]).getTime() || 0
    });
  }
  users.sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.lastActive - b.lastActive
  );
  let top5 = users.slice(0, 5).map((u, i) => ({
    rank: i + 1, name: u.name, score: u.score
  }));
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    totalBorrows: totalBorrows,
    leaderboard: top5
  })).setMimeType(ContentService.MimeType.JSON);
}

// ====== NFC → 容器ID マッピング解決 ======
function getContainerIdByNfc(nfcId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const mapSheet = ss.getSheetByName(MAPPING_SHEET_NAME);
  if (!mapSheet) return nfcId;
  const data = mapSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(nfcId)) {
      return String(data[i][1]);
    }
  }
  return null;
}

// ====== ユーザー表示名取得 ======
function getUserName(ss, userId) {
  if (!userId || userId === "N/A") return "ECO PLAYER";
  const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
  const data = usersSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) return data[i][2] || "ECO PLAYER";
  }
  return "ECO PLAYER";
}

// ====== 貸出ロジック ======
function handleBorrow(userId, containerId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logsSheet = ss.getSheetByName(LOGS_SHEET_NAME);
  const data = logsSheet.getDataRange().getValues();
  const now = new Date();

  // 1. ゴースト占有チェック
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]) === String(containerId) && data[i][5] === "BORROWED") {
      let targetRow = i + 1;
      let previousUserId = data[i][2];
      logsSheet.getRange(targetRow, 6, 1, 2).setValues([["ERROR_CLOSED", "NO_RETURN_RECORD"]]);
      logsSheet.getRange(targetRow, 1, 1, 7).setBackground("#FFCDD2");
      if (previousUserId && previousUserId !== "N/A") {
        const prevName = getUserName(ss, previousUserId);
        const warnMsg = `${prevName}さん、⚠️ 容器(番号: ${containerId})は既に返却処理されましたが、NFCの読み取りが失敗していた可能性があります。次回はもう少し長くタッチしてください～\n\n${prevName}, ⚠️ The container (No: ${containerId}) has been marked as returned, but the NFC scan might have failed. Please hold it a bit longer next time~`;
        sendLineMessage(previousUserId, warnMsg);
      }
      break;
    }
  }

  // 2. 貸出記録の書き込み
  const recordId = "REC" + now.getTime();
  const timestamp = Utilities.formatDate(now, "JST", "yyyy-MM-dd HH:mm:ss");
  logsSheet.appendRow([recordId, containerId, userId, timestamp, "", "BORROWED", ""]);

  // 3. ユーザー統計 & ランキング更新
  const userStats = updateUserCount(ss, userId);
  const leaderboardData = getLeaderboard(ss, userId);
  const currentName = getUserName(ss, userId);

  // 4. LINEプッシュ通知送信
  const msg = `こんにちは ${currentName}さん！貸出完了しました!\n(容器番号: ${containerId})\n今回の利用で ${userStats.count} 回目のエコ貢献です🌍 現在のランキング: ${leaderboardData.userRank}位🏆\n当日中に返却してください。美味しく食べてください!✨\n\nHello ${currentName}! Borrow Successful!\n(Container No: ${containerId})\nThis is your ${userStats.count}th eco-contribution🌍 Current Rank: #${leaderboardData.userRank}🏆\nPlease return it by 21:00 today. Enjoy your meal!✨`;
  sendLineMessage(userId, msg);

  return {
    status: 'success', action: 'borrow',
    borrowCount: userStats.count, isNewUser: userStats.isNew,
    userRank: leaderboardData.userRank, leaderboard: leaderboardData.top5
  };
}

// ====== 返却ロジック ======
function handleReturn(containerId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logsSheet = ss.getSheetByName(LOGS_SHEET_NAME);
  const data = logsSheet.getDataRange().getValues();
  const now = new Date();
  const timestamp = Utilities.formatDate(now, "JST", "yyyy-MM-dd HH:mm:ss");

  let targetRow = -1;
  let userId = "";

  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]) === String(containerId) && data[i][5] === "BORROWED") {
      targetRow = i + 1;
      userId = data[i][2];
      break;
    }
  }

  if (targetRow !== -1) {
    logsSheet.getRange(targetRow, 5, 1, 3).setValues([[now, "RETURNED", ""]]);
    if (userId) {
      const currentName = getUserName(ss, userId);
      const msg = `${currentName}さん、返却完了しました!☺️\n(容器番号: ${containerId})\n地球のHPが回復しました🌎 またのご利用をお待ちしております！\n\nReturn Completed, ${currentName}!☺️\n(Container No: ${containerId})\nThe Earth's HP has been restored🌎 Hope to see you again!`;
      sendLineMessage(userId, msg);
    }
    return { status: 'success', action: 'return', type: 'normal_return', userId: userId };
  } else {
    const recordId = "ERR_RET_" + now.getTime();
    logsSheet.appendRow([recordId, containerId, "N/A", "", timestamp, "ERROR_RETURN", "NO_BORROW_RECORD"]);
    logsSheet.getRange(logsSheet.getLastRow(), 1, 1, 7).setBackground("#FFCDD2");
    return { status: 'success', action: 'return', type: 'unborrowed_return', message: '貸出記録なしの返却として記録' };
  }
}

// ====== ユーザー貸出回数更新 ======
function updateUserCount(ss, userId) {
  const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
  const data = usersSheet.getDataRange().getValues();
  const now = new Date();
  const timestamp = Utilities.formatDate(now, "JST", "yyyy-MM-dd HH:mm:ss");

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      const newCount = Number(data[i][1]) + 1;
      usersSheet.getRange(i + 1, 2).setValue(newCount);
      usersSheet.getRange(i + 1, 4).setValue(now);
      return { count: newCount, isNew: false };
    }
  }
  usersSheet.appendRow([userId, 1, "", timestamp]);
  return { count: 1, isNew: true };
}

// ====== 表示名更新 ======
function updateUserName(userId, userName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
  const data = usersSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      usersSheet.getRange(i + 1, 3).setValue(userName);
      return { status: 'success', action: 'updateName', message: '名前を更新しました' };
    }
  }
  return { status: 'error', message: 'ユーザーが見つかりません' };
}

// ====== ランキング ======
function getLeaderboard(ss, currentUserId) {
  const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
  const data = usersSheet.getDataRange().getValues();
  let users = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    users.push({
      userId: data[i][0],
      score: Number(data[i][1]) || 0,
      name: data[i][2] || "ECO PLAYER",
      lastActive: new Date(data[i][3]).getTime() || 0
    });
  }
  users.sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.lastActive - b.lastActive
  );
  let userRank = -1;
  let top5 = [];
  users.forEach((u, index) => {
    const rank = index + 1;
    if (u.userId === currentUserId) userRank = rank;
    if (rank <= 5) top5.push({
      rank, name: u.name, score: u.score,
      isUser: (u.userId === currentUserId)
    });
  });
  return { top5, userRank };
}

// ====== LINEプッシュ通知 ======
function sendLineMessage(userId, text) {
  const url = 'https://api.line.me/v2/bot/message/push';
  const payload = {
    to: userId,
    messages: [{ type: 'text', text: text }]
  };
  const options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + LINE_CHANNEL_ACCESS_TOKEN
    },
    payload: JSON.stringify(payload)
  };
  try {
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    console.log("LINE:", e);
  }
}

// ====== ダッシュボードデータ（簡略化 — トランザクション履歴なし） ======
function getDashboard(userId, userName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
  const logsSheet = ss.getSheetByName(LOGS_SHEET_NAME);
  const now = new Date();
  const timestamp = Utilities.formatDate(now, 'JST', 'yyyy-MM-dd HH:mm:ss');

  // 1. ユーザー検索または作成
  const usersData = usersSheet.getDataRange().getValues();
  let userData = null;

  for (let i = 1; i < usersData.length; i++) {
    if (usersData[i][0] === userId) {
      userData = {
        userName: usersData[i][2] || 'ECO PLAYER',
        usageCount: Number(usersData[i][1]) || 0,
        lastActive: usersData[i][3] || ''
      };
      break;
    }
  }

  if (!userData) {
    const displayName = userName || 'ECO PLAYER';
    usersSheet.appendRow([userId, 0, displayName, timestamp]);
    userData = { userName: displayName, usageCount: 0, lastActive: timestamp };
  }

  // 2. 現在借出中のアイテムのみを検索（トランザクション履歴なし）
  const logsData = logsSheet.getDataRange().getValues();
  const borrowedItems = [];

  for (let i = logsData.length - 1; i >= 1; i--) {
    if (logsData[i][2] === userId && logsData[i][5] === 'BORROWED') {
      borrowedItems.push({
        containerId: String(logsData[i][1]),
        borrowTime: String(logsData[i][3])
      });
    }
  }

  return {
    status: 'success',
    data: {
      userName: userData.userName,
      usageCount: userData.usageCount,
      borrowedItems: borrowedItems
    }
  };
}
```

</details>

---

## 主要設計判断

| 判断 | 理由 |
|----------|-----------|
| ポイント = usageCount × 10 | シンプルで透明 — サーバーサイドスコア不要 |
| LIFFにトランザクション履歴なし | LINE APIが信頼できる履歴データをサポートするまで削除 |
| DashboardにGETを使用 | LINE WebViewでのCORSプリフライトオーバーヘッド回避 |
| GASバッチ書き込み（`setValues`） | 複数セル更新を1回のI/Oで実行、セル単位より約3倍高速 |
| ゴースト占有検出（`ERROR_CLOSED`） | 返却時のNFCスキャン失敗を検出し、前の利用者に警告 |
| 日英バイリンガルメッセージ | ユーザーは日本の大学生、国際対応のため英語併記 |
| タイトルに絵文字なし | ユーザー好みのクリーンでプロフェッショナルなUI |

---

## クイックリンク

| リンク | 用途 |
|------|---------|
| LIFF Borrow App | `https://liff.line.me/2008626930-AddPwDy7` |
| LIFF Dashboard | `https://liff.line.me/2008626930-pLAvndnp` |
| GASエンドポイント | `https://script.google.com/macros/s/AKfycbybohIvFuZ7GZC7KVckrjb4mn1SFFT1wG-Z1Anabt02il3N05NweJNgsctcFedsi6QY/exec` |
| Google Sheets | `https://docs.google.com/spreadsheets/d/19yL67pjWXKzhO6i-WYEQGaL2fi_ElHmdi7XiL1oCAIg` |
| Borrow LIFFリポジトリ | `https://github.com/Joe-Xuu/return-liff-frontend` |
| Dashboard LIFFリポジトリ | `https://github.com/Joe-Xuu/return-incentive-collection-system` |
| Raspi Station（プライベート） | `https://github.com/Joe-Xuu/return-system` |
| Raspi Station（GitFront） | [`https://gitfront.io/r/joe-xuu/c8eP5yts7JdF/return-system/`](https://gitfront.io/r/joe-xuu/c8eP5yts7JdF/return-system/) |
| Landscape（本ドキュメント） | `https://github.com/Joe-Xuu/return-system-landscape` |
