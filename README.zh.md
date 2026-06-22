# Re:Turn — O2O 容器借用系统

<div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
  <a href="README.md"><button style="padding:8px 16px; border:2px solid #06C755; background:#fff; color:#06C755; border-radius:6px; font-weight:700; font-family:Montserrat,sans-serif; cursor:pointer; font-size:13px;">🇬🇧 EN</button></a>
  <a href="README.ja.md"><button style="padding:8px 16px; border:2px solid #06C755; background:#fff; color:#06C755; border-radius:6px; font-weight:700; font-family:Montserrat,sans-serif; cursor:pointer; font-size:13px;">🇯🇵 日本語</button></a>
  <a href="README.zh.md"><button style="padding:8px 16px; border:2px solid #06C755; background:#06C755; color:#fff; border-radius:6px; font-weight:700; font-family:Montserrat,sans-serif; cursor:pointer; font-size:13px;">🇨🇳 中文</button></a>
</div>

零摩擦的 O2O 循环容器借用与激励机制。
用户通过 LINE LIFF 借用容器，通过 NFC + Raspberry Pi 归还，积分记录在 Google Sheets 上。

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Re:Turn System                                    │
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐   │
│  │   LINE App    │    │  NFC + Raspi │    │   Raspi Display           │  │
│  │  (用户手机)   │    │  (借用/归还) │    │   (排行榜 + CO2)          │  │
│  │               │    │              │    │                           │  │
│  │ Borrow LIFF ──┼────┤ NFC标签扫描  │    │ Flask SSE ← return_core   │  │
│  │ Dashboard ────┼──┐ │ POST到GAS    │    │ UI轮询 GAS getStats       │  │
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
│  │  │ • return    │  │ • getDashboard│  │ 推送通知               │   │   │
│  │  │ • updateName│  │              │  │                        │   │   │
│  │  │ • getDashboard│ │              │  │                        │   │   │
│  │  └──────┬──────┘  └──────┬───────┘  └────────────┬───────────┘   │   │
│  └─────────┼────────────────┼───────────────────────┼───────────────┘   │
│            │                │                       │                    │
│            ▼                ▼                       ▼                    │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     Google Sheets (数据库)                        │   │
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

### 数据流

```
借用:  NFC/Raspi → GAS doPost(action=borrow)     → Sheets(Logs+Users) → LINE 推送(用户)
归还:  NFC/Raspi → GAS doPost(action=return)     → Sheets(Logs)      → LINE 推送(用户)
仪表盘: 用户打开LIFF → GAS doGet/getDashboard → Sheets(Users+Logs) → LIFF渲染
排行榜: Raspi显示 → GAS doGet(getStats)     → Sheets(Users)     → Raspi渲染
```

---

## 组件索引

### 1a. Borrow LIFF（学生借用界面）

学生触碰 NFC 标签借用容器时显示的界面。容器 ID 通过 URL 参数传入。

**仓库:** [`Joe-Xuu/return-liff-frontend`](https://github.com/Joe-Xuu/return-liff-frontend)  
**LIFF ID:** `2008626930-AddPwDy7`

```
return-liff-frontend/
├── index.html         # 单文件应用（内嵌CSS+JS）：启动画面 → 借用 → 成功 + 排行榜
├── nfc-simulator.html # 开发工具：模拟NFC触碰以测试GAS归还接口
├── sfc_logo.png       # 庆应SFC标志
└── megloo_logo.png    # Megloo项目标志
```

| 功能 | 详情 |
|--------|--------|
| 入口 | QR码（含 `?id=C-001` 参数） |
| 启动画面 | 绿色全屏 "Re:Turn" + 欢迎语，1.8秒淡出 |
| 借用界面 | 容器ID显示 + 「はい」按钮 |
| GAS调用 | `POST borrow`（`userId` + `containerId`） |
| 成功界面 | CO2减排计数器动画（每容器94g）、环保比喻文字 |
| 排行榜 | 深色卡片 + 撞击入场动画 + 彩纸特效 + 震屏效果 |
| 昵称编辑 | 8位大写字母弹窗，保存至 localStorage + GAS `updateName` |
| LIFF认证 | 完整 LIFF init → ID token → 登录流程（开发时支持 localhost 绕过） |

**流程:** `扫码 → LIFF打开 → 启动画面淡出 → 看到容器ID → 点击「はい」→ GAS borrow → 彩纸 + 排行榜撞击动画`

### 1b. Dashboard LIFF（用户状态仪表盘）

查看借用状态、积分和当前借用容器的仪表盘。通过 LINE Rich Menu 打开。

**仓库:** [`Joe-Xuu/return-incentive-collection-system`](https://github.com/Joe-Xuu/return-incentive-collection-system) ← 本仓库  
**LIFF ID:** `2008626930-pLAvndnp`

```
return-incentive-collection-system/
├── index.html                     # 应用外壳：个人资料 + 当前借用 + 任务中心
├── style.css                      # 清新浅色主题、CSS变量、移动端优先
├── app.js                         # LIFF初始化、GAS数据获取、渲染逻辑、积分 = usageCount × 10
└── line-entry/
    ├── rich-menu-preview.html     # Rich Menu Canvas PNG生成器（2500×843）
    └── rich-menu-config.json      # 单按钮全宽点击区域配置
```

| 功能 | 详情 |
|--------|--------|
| 入口 | LINE Rich Menu 按钮 → LIFF URL |
| 个人资料卡 | 头像 + 显示名称 + 脱敏用户ID |
| 统计 | 积分（= usageCount × 10）+ 总使用次数 |
| 当前借用 | 未归还容器列表（含借用时间），或 "All cleared!" |
| 任务中心 | 占位符：「集中回收」地图/锁定获取（即将推出） |
| GAS调用 | `GET getDashboard`（`userId` + `userName`） |

### 2. GAS 后端（API 服务器）

| 功能 | 动作 | 方法 | 调用方 | 说明 |
|------|--------|--------|-----------|-------------|
| 借用 | `borrow` | POST | NFC/Raspi | 记录借用、更新用户计数、推送LINE确认 |
| 归还 | `return` | POST | NFC/Raspi | 通过NFC→containerId映射归还、推送LINE确认 |
| 更新名称 | `updateName` | POST | LIFF前端 | 更新Users表中的显示名称 |
| 仪表盘 | `getDashboard` | POST/GET | LIFF前端 | 返回userName、usageCount、当前借用项 |
| 全局统计 | `getStats` | GET | Raspi显示 | 返回totalBorrows + 前5排行榜 |

**部署:** Google Apps Script → `https://script.google.com/macros/s/.../exec`
**代码位置:** Google Apps Script 编辑器（不在本仓库，参见[GAS代码参考](#gas代码参考)）

### 3. Google Sheets（数据库）

**表格ID:** `19yL67pjWXKzhO6i-WYEQGaL2fi_ElHmdi7XiL1oCAIg`

| 表 | 列 | 用途 |
|-------|---------|---------|
| `Users` | `userId`, `score`(借用次数), `userName`, `lastActive` | 用户注册 & 全局统计 |
| `Logs` | `recordId`, `containerId`, `userId`, `borrowTimestamp`, `returnTimestamp`, `status`, `notes` | 所有借用/归还记录 |
| `Mapping` | `nfcId`, `containerId` | NFC标签 → 容器ID 映射 |

**Logs状态值:** `BORROWED`, `RETURNED`, `ERROR_CLOSED`, `ERROR_RETURN`

### 4. NFC + Raspberry Pi 站点（归还 & 排行榜）

单台 Raspberry Pi，搭载 MFRC522 NFC 读卡器，同时运行两个 Python 进程：

| 进程 | 文件 | 角色 |
|---------|------|------|
| NFC 守护进程 | `return_core.py` | 持续NFC标签扫描、本地Flask触发、异步GAS POST |
| Flask 服务器 | `app.py` | Web UI服务 + SSE推送 + 排行榜显示 |

**仓库:** `https://github.com/Joe-Xuu/return-system`（私有）  
**GitFront镜像:** [`https://gitfront.io/r/joe-xuu/c8eP5yts7JdF/return-system/`](https://gitfront.io/r/joe-xuu/c8eP5yts7JdF/return-system/)

```
return_system/
├── app.py                  # Flask服务器: /api/trigger, /api/stream (SSE), GAS数据获取
├── return_core.py          # NFC守护进程: MFRC522扫描 → 0.5s本地POST → 异步GAS线程
├── requirements.txt        # Python依赖 (RPi.GPIO, mfrc522, Flask, requests, nfcpy)
├── test_nfc.py             # NFC读取测试
├── test_raw.py             # 底层NFC测试
├── manual                  # 安装说明
├── templates/
│   └── index.html          # 站点UI: NFC雷达 + CO2计数器 + 排行榜
└── static/
    └── success.mp4         # 备用成功动画
```

**NFC标签扫描数据流:**
```
NFC标签 → return_core.py (MFRC522)
          ├─[1] POST localhost:5000/api/trigger  (0.5s超时, 发后即忘)
          │       └─ Flask → SSE /api/stream → 浏览器: 即时✅动画
          └─[2] 线程: POST GAS action=return    (异步, 非阻塞)
                  └─ GAS handleReturn() → Sheets更新 → LINE推送
```

**架构详解 — 双进程设计:**
- `return_core.py` 以**裸金属NFC守护进程**运行（不依赖Flask）。每20ms扫描标签，硬件增益最大48dB。扫描到标签时：以0.5s超时向本地Flask发送POST（即时UI反馈），然后启动守护线程处理耗时的GAS HTTP调用。
- `app.py` 作为**Flask + SSE服务器**在端口5000运行。SSE `/api/stream` 端点与浏览器保持长连接。当 `/api/trigger` 收到 containerId 时，立即推送到所有连接的SSE客户端——浏览器在标签触碰后<200ms内显示勾选动画。
- 动画结束后，浏览器从GAS `getStats` 获取最新排行榜数据。CO2计算公式 = `总借用次数 × 94g / 1000`，配合动画计数器和环保比喻文字。

**站点UI（templates/index.html）:**
- 左侧面板: "Re:Turn" 品牌 + NFC雷达脉冲动画 + 「容器をタッチしてください」
- 右侧面板: 累计CO2减排量（实时计数）+ 前5排行榜
- SSE驱动的成功覆盖层: 归还时SVG勾选动画
- 每60秒轮询GAS `getStats` 刷新排行榜

### 5. LINE Bot（推送通知）

| 通知 | 触发条件 | 消息内容 |
|------|---------|---------|
| 借用确认 | `handleBorrow` 后 | 排名 + 借用次数 + 归还期限 |
| 归还确认 | `handleReturn` 后 | 归还确认 |
| NFC读取失败警告 | 检测到 `ERROR_CLOSED` | 警告前一位借用者NFC可能读取失败 |

**渠道:** 在 LINE Developers Console 配置
**实现:** GAS后端中的 `sendLineMessage()`

---

## API 合约

### `getDashboard` — 用户仪表盘数据

```
请求:  GET ?action=getDashboard&userId=<userId>&userName=<displayName>
响应: {
  status: "success",
  data: {
    userName:       string,   // 显示名称
    usageCount:     number,   // 总借用次数 (积分 = usageCount × 10)
    borrowedItems: [{         // 当前未归还容器
      containerId:  string,   // 例: "C-001"
      borrowTime:   string    // 例: "2026-06-22 12:30:00"
    }]
  }
}
```

### `getStats` — 全局排行榜

```
请求:  GET ?action=getStats
响应: {
  status: "success",
  totalBorrows: number,       // 系统总借用数
  leaderboard: [{             // 前5名
    rank:   number,
    name:   string,
    score:  number
  }]
}
```

### `borrow` — 记录借用

```
请求:  POST { action: "borrow", userId: string, containerId: string }
响应: {
  status: "success",
  action: "borrow",
  borrowCount: number,
  isNewUser: boolean,
  userRank: number,
  leaderboard: [{ rank, name, score }]
}
```

### `return` — 记录归还

```
请求:  POST { action: "return", nfcId: string }
响应: {
  status: "success",
  action: "return",
  type: "normal_return" | "unborrowed_return",
  userId?: string
}
```

### `updateName` — 更新显示名称

```
请求:  POST { action: "updateName", userId: string, userName: string }
响应: { status: "success", action: "updateName" }
```

---

## 仓库地图

### 所有仓库

| 仓库 | 内容 | GitHub |
|------|------|--------|
| **Dashboard LIFF** | 用户状态仪表盘（个人资料 + 借用中） | `Joe-Xuu/return-incentive-collection-system` ← 本仓库 |
| **Borrow LIFF** | 学生借用界面（NFC → 借用 → 排行榜） | `Joe-Xuu/return-liff-frontend` |
| **Raspi 站点** | NFC守护进程 + Flask SSE + 排行榜显示 | `Joe-Xuu/return-system`（私有） |
| **Landscape** | 架构总览（本README） | `Joe-Xuu/return-system-landscape` |
| **GAS 后端** | Google Apps Script API服务器 | GAS编辑器（代码见[GAS代码参考](#gas代码参考)） |

### 本仓库结构

```
incentive-collect-system/          ← Dashboard LIFF
├── index.html                     # 应用外壳 + 全部UI卡片
├── style.css                      # 完整样式表（CSS变量、卡片、排版）
├── app.js                         # LIFF初始化、GAS获取、渲染逻辑
├── README.md                      # ← 当前文件
└── line-entry/
    ├── rich-menu-preview.html     # LINE Rich Menu Canvas PNG生成器
    └── rich-menu-config.json      # 点击区域配置
```

### 不在仓库中的代码（另行部署）

| 代码 | 位置 |
|------|----------|
| GAS后端（doPost、doGet、全部处理函数） | Google Apps Script 编辑器 |

---

## GAS 代码参考

以下是截至2026-06-22的完整GAS后端代码。
编辑时，从此处复制 → 粘贴到Google Apps Script编辑器 → 部署为Web应用。

<details>
<summary><b>点击展开 — 完整GAS代码</b></summary>

```javascript
// ====== 配置 ======
const SPREADSHEET_ID = '19yL67pjWXKzhO6i-WYEQGaL2fi_ElHmdi7XiL1oCAIg';
const LINE_CHANNEL_ACCESS_TOKEN = 'rRvqoZurif4mU6w8tGHe+h4ru34KjdVwsEwfFCYchaOHKodrWOk+bnw1biF9AsdE5NDuMuVNDMJw5T9fnOxcrx7LHr3oQNGlZVBG2q6BvUP8uRGLoVr+2/Z5X/388YNA3UM3tGla2mJvIRnUq2UAXQdB04t89/1O/w1cDnyilFU=';
const LOGS_SHEET_NAME = 'Logs';
const USERS_SHEET_NAME = 'Users';
const MAPPING_SHEET_NAME = 'Mapping';

// ====== POST 路由 ======
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
          JSON.stringify({ status: 'error', message: 'NFC未注册' })
        ).setMimeType(ContentService.MimeType.JSON);
      }
      result = handleReturn(containerId);
    } else if (action === 'updateName') {
      result = updateUserName(params.userId, params.userName);
    } else if (action === 'getDashboard') {
      result = getDashboard(params.userId, params.userName);
    } else {
      throw new Error("未知操作类型");
    }
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// ====== GET 路由 ======
function doGet(e) {
  if (e.parameter && e.parameter.action === 'getStats') {
    return getGlobalStats();
  } else if (e.parameter && e.parameter.action === 'getDashboard') {
    const result = getDashboard(e.parameter.userId, e.parameter.userName);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ====== 全局统计（Raspi排行榜用） ======
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

// ====== NFC → 容器ID 映射查询 ======
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

// ====== 获取用户显示名称 ======
function getUserName(ss, userId) {
  if (!userId || userId === "N/A") return "ECO PLAYER";
  const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
  const data = usersSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) return data[i][2] || "ECO PLAYER";
  }
  return "ECO PLAYER";
}

// ====== 借用逻辑 ======
function handleBorrow(userId, containerId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logsSheet = ss.getSheetByName(LOGS_SHEET_NAME);
  const data = logsSheet.getDataRange().getValues();
  const now = new Date();

  // 1. 检查幽灵占用
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

  // 2. 写入借用记录
  const recordId = "REC" + now.getTime();
  const timestamp = Utilities.formatDate(now, "JST", "yyyy-MM-dd HH:mm:ss");
  logsSheet.appendRow([recordId, containerId, userId, timestamp, "", "BORROWED", ""]);

  // 3. 更新用户统计和排行榜
  const userStats = updateUserCount(ss, userId);
  const leaderboardData = getLeaderboard(ss, userId);
  const currentName = getUserName(ss, userId);

  // 4. 发送LINE推送
  const msg = `こんにちは ${currentName}さん！貸出完了しました!\n(容器番号: ${containerId})\n今回の利用で ${userStats.count} 回目のエコ貢献です🌍 現在のランキング: ${leaderboardData.userRank}位🏆\n当日中に返却してください。美味しく食べてください!✨\n\nHello ${currentName}! Borrow Successful!\n(Container No: ${containerId})\nThis is your ${userStats.count}th eco-contribution🌍 Current Rank: #${leaderboardData.userRank}🏆\nPlease return it by 21:00 today. Enjoy your meal!✨`;
  sendLineMessage(userId, msg);

  return {
    status: 'success', action: 'borrow',
    borrowCount: userStats.count, isNewUser: userStats.isNew,
    userRank: leaderboardData.userRank, leaderboard: leaderboardData.top5
  };
}

// ====== 归还逻辑 ======
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
    return { status: 'success', action: 'return', type: 'unborrowed_return', message: '记录为无借用归还' };
  }
}

// ====== 更新用户借用次数 ======
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

// ====== 更新显示名称 ======
function updateUserName(userId, userName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
  const data = usersSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      usersSheet.getRange(i + 1, 3).setValue(userName);
      return { status: 'success', action: 'updateName', message: '名称已更新' };
    }
  }
  return { status: 'error', message: '未找到用户' };
}

// ====== 排行榜 ======
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

// ====== LINE推送通知 ======
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

// ====== 仪表盘数据（已简化 — 无交易历史） ======
function getDashboard(userId, userName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
  const logsSheet = ss.getSheetByName(LOGS_SHEET_NAME);
  const now = new Date();
  const timestamp = Utilities.formatDate(now, 'JST', 'yyyy-MM-dd HH:mm:ss');

  // 1. 查找或创建用户
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

  // 2. 仅查找当前借出中的项目（无交易历史）
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

## 关键设计决策

| 决策 | 理由 |
|----------|-----------|
| 积分 = usageCount × 10 | 简单透明 — 无需服务端计分 |
| LIFF中无交易历史 | LINE API支持可靠历史数据后再恢复 |
| Dashboard使用GET | 避免LINE WebView中的CORS预检开销 |
| GAS批量写入（`setValues`） | 单次I/O完成多单元格更新，比逐格快约3倍 |
| 幽灵占用检测（`ERROR_CLOSED`） | 检测归还时NFC读取失败，警告前一位借用者 |
| 日英双语消息 | 用户为日本大学生，英语作为国际后备 |
| 标题中不使用emoji | 用户偏好简洁专业的设计风格 |

---

## 快速链接

| 链接 | 用途 |
|------|---------|
| LIFF Borrow App | `https://liff.line.me/2008626930-AddPwDy7` |
| LIFF Dashboard | `https://liff.line.me/2008626930-pLAvndnp` |
| GAS端点 (exec) | `https://script.google.com/macros/s/AKfycbybohIvFuZ7GZC7KVckrjb4mn1SFFT1wG-Z1Anabt02il3N05NweJNgsctcFedsi6QY/exec` |
| GAS编辑器 (源码) | `https://script.google.com/u/0/home/projects/1pEsf7slfF0O2CCtp1zvrTSD7rsnwYAL1AwoT08S2M8y17R65MucrjWSA/edit` |
| Google Sheets | `https://docs.google.com/spreadsheets/d/19yL67pjWXKzhO6i-WYEQGaL2fi_ElHmdi7XiL1oCAIg/edit?usp=sharing` |
| Borrow LIFF 仓库 | `https://github.com/Joe-Xuu/return-liff-frontend` |
| Dashboard LIFF 仓库 | `https://github.com/Joe-Xuu/return-incentive-collection-system` |
| Raspi 站点仓库（私有） | `https://github.com/Joe-Xuu/return-system` |
| Raspi 站点（GitFront） | [`https://gitfront.io/r/joe-xuu/c8eP5yts7JdF/return-system/`](https://gitfront.io/r/joe-xuu/c8eP5yts7JdF/return-system/) |
| Landscape（本文档） | `https://github.com/Joe-Xuu/return-system-landscape` |
