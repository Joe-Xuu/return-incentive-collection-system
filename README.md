# Re:Turn — O2O Container Borrowing System

Zero-friction circular container borrowing & incentive system.
Users borrow containers via LINE LIFF, return via NFC + Raspberry Pi, earn points tracked on Google Sheets.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Re:Turn System                                │
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │   LINE App    │    │  NFC + Raspi │    │   Raspi Dashboard        │  │
│  │  (User Phone) │    │  (Return Stn)│    │   (Public Leaderboard)   │  │
│  └──────┬───────┘    └──────┬───────┘    └────────────┬─────────────┘  │
│         │                   │                         │                 │
│         │  LIFF SDK v2      │  HTTP POST              │  HTTP GET       │
│         ▼                   ▼                         ▼                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                   Google Apps Script (GAS)                        │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐   │  │
│  │  │ doPost()    │  │ doGet()      │  │ sendLineMessage()      │   │  │
│  │  │ • borrow    │  │ • getStats   │  │ LINE Messaging API     │   │  │
│  │  │ • return    │  │ • getDashboard│  │ Push notifications    │   │  │
│  │  │ • updateName│  │              │  │                        │   │  │
│  │  │ • getDashboard│ │              │  │                        │   │  │
│  │  └──────┬──────┘  └──────┬───────┘  └────────────┬───────────┘   │  │
│  └─────────┼────────────────┼───────────────────────┼───────────────┘  │
│            │                │                       │                   │
│            ▼                ▼                       ▼                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     Google Sheets (Database)                      │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │  │
│  │  │  Users   │  │   Logs   │  │ Mapping  │                       │  │
│  │  └──────────┘  └──────────┘  └──────────┘                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    LIFF Frontend (this repo)                      │  │
│  │  GitHub Pages → liff.line.me/2008626930-pLAvndnp                  │  │
│  │  ┌────────────┐  ┌──────────┐  ┌──────────┐                     │  │
│  │  │ index.html │  │ style.css│  │  app.js  │                     │  │
│  │  └────────────┘  └──────────┘  └──────────┘                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
BORROW:  NFC/Raspi → GAS doPost(action=borrow)     → Sheets(Logs+Users) → LINE Push(user)
RETURN:  NFC/Raspi → GAS doPost(action=return)     → Sheets(Logs)      → LINE Push(user)
DASHBOARD: User opens LIFF → GAS doGet/getDashboard → Sheets(Users+Logs) → LIFF renders
LEADERBOARD: Raspi display → GAS doGet(getStats)   → Sheets(Users)     → Raspi renders
```

---

## Component Index

### 1. LINE LIFF Frontend (User Dashboard)

| What | Where | Description |
|------|-------|-------------|
| App Shell | [`index.html`](index.html) | LIFF webview: Profile Card + Current Borrowing + Task Center placeholder |
| Styles | [`style.css`](style.css) | Light/fresh theme, LINE Green (#06C755), Montserrat font, mobile-first |
| App Logic | [`app.js`](app.js) | LIFF init, GAS data fetch, profile/borrowing render, points = usageCount × 10 |
| Rich Menu Generator | [`line-entry/rich-menu-preview.html`](line-entry/rich-menu-preview.html) | Canvas-based 2500×843 PNG generator, one-click download |
| Rich Menu Config | [`line-entry/rich-menu-config.json`](line-entry/rich-menu-config.json) | Single full-width button tap area |

**Deploy:** GitHub Pages → `https://liff.line.me/2008626930-pLAvndnp`
**LIFF ID:** `2008626930-pLAvndnp`

### 2. GAS Backend (API Server)

| What | Action | Method | Called By | Description |
|------|--------|--------|-----------|-------------|
| Borrow | `borrow` | POST | NFC/Raspi | Record borrow, update user count, push LINE confirmation |
| Return | `return` | POST | NFC/Raspi | Record return via NFC→containerId lookup, push LINE confirmation |
| Update Name | `updateName` | POST | LIFF Frontend | Update user display name in Users sheet |
| Get Dashboard | `getDashboard` | POST/GET | LIFF Frontend | Return userName, usageCount, currently borrowed items |
| Get Stats | `getStats` | GET | Raspi Dashboard | Return totalBorrows + top 5 leaderboard |

**Deploy:** Google Apps Script → `https://script.google.com/macros/s/.../exec`
**Code location:** Google Apps Script Editor (not in this repo — see [GAS Code Reference](#gas-code-reference) below)

### 3. Google Sheets (Database)

**Spreadsheet ID:** `19yL67pjWXKzhO6i-WYEQGaL2fi_ElHmdi7XiL1oCAIg`

| Sheet | Columns | Purpose |
|-------|---------|---------|
| `Users` | `userId`, `score`(borrow count), `userName`, `lastActive` | User registry & global stats |
| `Logs` | `recordId`, `containerId`, `userId`, `borrowTimestamp`, `returnTimestamp`, `status`, `notes` | All borrow/return transactions |
| `Mapping` | `nfcId`, `containerId` | NFC tag → container ID lookup |

**Status values in Logs:** `BORROWED`, `RETURNED`, `ERROR_CLOSED`, `ERROR_RETURN`

### 4. NFC + Raspberry Pi Station (Return & Leaderboard)

Single Raspberry Pi with MFRC522 NFC reader, running two Python processes:

| Process | File | Role |
|---------|------|------|
| NFC Daemon | `return_core.py` | Continuous NFC tag scanning, local Flask trigger, async GAS POST |
| Flask Server | `app.py` | Web UI server + SSE push + leaderboard display |

**Repo:** `https://github.com/Joe-Xuu/return-system` (private)  
**GitFront mirror:** [`https://gitfront.io/r/joe-xuu/c8eP5yts7JdF/return-system/`](https://gitfront.io/r/joe-xuu/c8eP5yts7JdF/return-system/)

```
return_system/
├── app.py                  # Flask server: /api/trigger, /api/stream (SSE), GAS fetch
├── return_core.py          # NFC daemon: MFRC522 scanning → 0.5s local POST → async GAS thread
├── requirements.txt        # Python deps (RPi.GPIO, mfrc522, Flask, requests, nfcpy)
├── test_nfc.py             # NFC read test
├── test_raw.py             # Raw NFC low-level test
├── manual                  # Setup instructions
├── templates/
│   └── index.html          # Station UI: NFC radar + CO2 counter + leaderboard
└── static/
    └── success.mp4         # Fallback success animation
```

**Data flow on NFC tag scan:**
```
NFC Tag → return_core.py (MFRC522)
          ├─[1] POST localhost:5000/api/trigger  (0.5s timeout, fire-and-forget)
          │       └─ Flask → SSE /api/stream → Browser: instant ✅ animation
          └─[2] Thread: POST GAS action=return    (async, non-blocking)
                  └─ GAS handleReturn() → Sheets update → LINE push
```

**Architecture detail — two-process design:**
- `return_core.py` runs as a **bare-metal NFC daemon** (no Flask dependency). It scans tags every 20ms with hardware gain maxed to 48dB. On scan: fires a 0.5s timeout POST to local Flask (for instant UI feedback), then spawns a daemon thread for the slow GAS HTTP call.
- `app.py` runs as a **Flask + SSE server** on port 5000. The SSE `/api/stream` endpoint keeps a persistent connection to the browser. When `/api/trigger` receives a containerId, it pushes it to all connected SSE clients immediately — the browser shows a checkmark animation with <200ms latency from tag tap.
- After the animation, the browser fetches fresh leaderboard data from GAS `getStats`. CO2 is calculated as `totalBorrows × 94g / 1000` with animated counter + eco metaphor text.

**Station UI (templates/index.html):**
- Left panel: "Re:Turn" branding + NFC radar pulse animation + "容器をタッチしてください"
- Right panel: Total CO2 saved (live counter) + Top 5 leaderboard
- SSE-driven success overlay: SVG checkmark animation on return
- Polls GAS `getStats` every 60s for leaderboard refresh

### 5. LINE Bot (Push Notifications)

| What | Trigger | Message |
|------|---------|---------|
| Borrow Confirm | After `handleBorrow` | User rank + borrow count + return deadline |
| Return Confirm | After `handleReturn` | Return acknowledgement |
| NFC Miss Warning | `ERROR_CLOSED` detected | Warns previous borrower about failed NFC scan |

**Channel:** Configured in LINE Developers Console
**Implementation:** `sendLineMessage()` in GAS backend

---

## API Contracts

### `getDashboard` — User Dashboard Data

```
Request:  GET ?action=getDashboard&userId=<userId>&userName=<displayName>
Response: {
  status: "success",
  data: {
    userName:       string,   // display name
    usageCount:     number,   // total borrow count (points = usageCount × 10)
    borrowedItems: [{         // currently unreturned containers
      containerId:  string,   // e.g. "C-001"
      borrowTime:   string    // e.g. "2026-06-22 12:30:00"
    }]
  }
}
```

### `getStats` — Global Leaderboard

```
Request:  GET ?action=getStats
Response: {
  status: "success",
  totalBorrows: number,       // system-wide total
  leaderboard: [{             // top 5
    rank:   number,
    name:   string,
    score:  number
  }]
}
```

### `borrow` — Record Borrow

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

### `return` — Record Return

```
Request:  POST { action: "return", nfcId: string }
Response: {
  status: "success",
  action: "return",
  type: "normal_return" | "unborrowed_return",
  userId?: string
}
```

### `updateName` — Update Display Name

```
Request:  POST { action: "updateName", userId: string, userName: string }
Response: { status: "success", action: "updateName" }
```

---

## Repo Map

```
incentive-collect-system/          ← THIS REPO (LIFF Frontend)
├── index.html                     # App shell + all UI cards
├── style.css                      # Full stylesheet (CSS variables, cards, typography)
├── app.js                         # LIFF init, GAS fetch, render logic
├── README.md                      # ← You are here
└── line-entry/
    ├── rich-menu-preview.html     # Canvas PNG generator for LINE Rich Menu
    └── rich-menu-config.json      # Tap area bounds
```

### Code NOT in this repo (deployed elsewhere)

| Code | Location | Path |
|------|----------|------|
| GAS Backend (doPost, doGet, all handlers) | Google Apps Script Editor | See [GAS Code Reference](#gas-code-reference) |
| NFC Daemon + Flask Station | Raspberry Pi | `~/keio/2026/wadaken/raspi/return_system/` |
| Raspi Station (private repo) | GitHub | `Joe-Xuu/return-system` |

---

## GAS Code Reference

The full GAS backend code (as of 2026-06-22) is documented below for reference.
When editing, copy from here → paste into Google Apps Script Editor → Deploy as Web App.

<details>
<summary><b>Click to expand — Full GAS Code</b></summary>

```javascript
// ====== Configuration ======
const SPREADSHEET_ID = '19yL67pjWXKzhO6i-WYEQGaL2fi_ElHmdi7XiL1oCAIg';
const LINE_CHANNEL_ACCESS_TOKEN = 'rRvqoZurif4mU6w8tGHe+h4ru34KjdVwsEwfFCYchaOHKodrWOk+bnw1biF9AsdE5NDuMuVNDMJw5T9fnOxcrx7LHr3oQNGlZVBG2q6BvUP8uRGLoVr+2/Z5X/388YNA3UM3tGla2mJvIRnUq2UAXQdB04t89/1O/w1cDnyilFU=';
const LOGS_SHEET_NAME = 'Logs';
const USERS_SHEET_NAME = 'Users';
const MAPPING_SHEET_NAME = 'Mapping';

// ====== POST Router ======
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
          JSON.stringify({ status: 'error', message: 'NFC unregistered' })
        ).setMimeType(ContentService.MimeType.JSON);
      }
      result = handleReturn(containerId);
    } else if (action === 'updateName') {
      result = updateUserName(params.userId, params.userName);
    } else if (action === 'getDashboard') {
      result = getDashboard(params.userId, params.userName);
    } else {
      throw new Error("Unknown action type");
    }
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// ====== GET Router ======
function doGet(e) {
  if (e.parameter && e.parameter.action === 'getStats') {
    return getGlobalStats();
  } else if (e.parameter && e.parameter.action === 'getDashboard') {
    const result = getDashboard(e.parameter.userId, e.parameter.userName);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ====== Global Stats (for Raspi leaderboard) ======
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

// ====== NFC → Container ID lookup ======
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

// ====== Get user display name ======
function getUserName(ss, userId) {
  if (!userId || userId === "N/A") return "ECO PLAYER";
  const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
  const data = usersSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) return data[i][2] || "ECO PLAYER";
  }
  return "ECO PLAYER";
}

// ====== Borrow Logic ======
function handleBorrow(userId, containerId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logsSheet = ss.getSheetByName(LOGS_SHEET_NAME);
  const data = logsSheet.getDataRange().getValues();
  const now = new Date();

  // 1. Check for ghost occupancy
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

  // 2. Write borrow record
  const recordId = "REC" + now.getTime();
  const timestamp = Utilities.formatDate(now, "JST", "yyyy-MM-dd HH:mm:ss");
  logsSheet.appendRow([recordId, containerId, userId, timestamp, "", "BORROWED", ""]);

  // 3. Update user stats + leaderboard
  const userStats = updateUserCount(ss, userId);
  const leaderboardData = getLeaderboard(ss, userId);
  const currentName = getUserName(ss, userId);

  // 4. Send LINE push
  const msg = `こんにちは ${currentName}さん！貸出完了しました!\n(容器番号: ${containerId})\n今回の利用で ${userStats.count} 回目のエコ貢献です🌍 現在のランキング: ${leaderboardData.userRank}位🏆\n当日中に返却してください。美味しく食べてください!✨\n\nHello ${currentName}! Borrow Successful!\n(Container No: ${containerId})\nThis is your ${userStats.count}th eco-contribution🌍 Current Rank: #${leaderboardData.userRank}🏆\nPlease return it by 21:00 today. Enjoy your meal!✨`;
  sendLineMessage(userId, msg);

  return {
    status: 'success', action: 'borrow',
    borrowCount: userStats.count, isNewUser: userStats.isNew,
    userRank: leaderboardData.userRank, leaderboard: leaderboardData.top5
  };
}

// ====== Return Logic ======
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
    return { status: 'success', action: 'return', type: 'unborrowed_return', message: 'Recorded as return without borrow' };
  }
}

// ====== Update user borrow count ======
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

// ====== Update display name ======
function updateUserName(userId, userName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
  const data = usersSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      usersSheet.getRange(i + 1, 3).setValue(userName);
      return { status: 'success', action: 'updateName', message: 'Name updated' };
    }
  }
  return { status: 'error', message: 'User not found' };
}

// ====== Leaderboard ======
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

// ====== LINE Push Notification ======
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

// ====== Dashboard Data (simplified — no transaction history) ======
function getDashboard(userId, userName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
  const logsSheet = ss.getSheetByName(LOGS_SHEET_NAME);
  const now = new Date();
  const timestamp = Utilities.formatDate(now, 'JST', 'yyyy-MM-dd HH:mm:ss');

  // 1. Find or create user
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

  // 2. Find currently borrowed items only (no transaction history)
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

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Points = usageCount × 10 | Simple, transparent — no server-side score needed |
| No Transaction History in LIFF | Removed until LINE API supports reliable historical data |
| GET for Dashboard | Avoids CORS preflight overhead in LINE WebView |
| GAS batch writes (`setValues`) | Single I/O for multi-cell updates, ~3× faster than per-cell |
| Ghost occupancy detection (`ERROR_CLOSED`) | Detects NFC scan failures on return, warns previous borrower |
| EN + JP bilingual messages | User base is Japanese university students; English fallback for international |
| No emoji in titles | Clean, professional dashboard aesthetic per user preference |

---

## Quick Links

| Link | Purpose |
|------|---------|
| LIFF Dashboard | `https://liff.line.me/2008626930-pLAvndnp` |
| GAS Endpoint | `https://script.google.com/macros/s/AKfycbybohIvFuZ7GZC7KVckrjb4mn1SFFT1wG-Z1Anabt02il3N05NweJNgsctcFedsi6QY/exec` |
| Google Sheets | `https://docs.google.com/spreadsheets/d/19yL67pjWXKzhO6i-WYEQGaL2fi_ElHmdi7XiL1oCAIg` |
| LIFF Repo (GitHub) | `https://github.com/Joe-Xuu/return-incentive-collection-system` |
| Raspi Return Repo (private) | `https://github.com/Joe-Xuu/return-system` |
| Raspi Return Repo (GitFront) | [`https://gitfront.io/r/joe-xuu/c8eP5yts7JdF/return-system/`](https://gitfront.io/r/joe-xuu/c8eP5yts7JdF/return-system/) |
