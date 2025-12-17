# 搶答派對 - Party Buzzer

多人搶答遊戲平台，支持實時 WebSocket 通信。

## 功能特點

- 🎮 多人實時搶答
- 👑 主持人控制遊戲流程
- ⚡ 服務器端時間戳確保公平性
- 🔄 自動重連機制
- 💾 SQLite 數據庫持久化
- 🎨 響應式設計

## 技術棧

- **前端**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **後端**: Node.js, Express, Socket.IO
- **數據庫**: SQLite (better-sqlite3)

## 安裝與運行

### 1. 安裝依賴

```bash
npm install
```

### 2. 啟動後端服務器（端口 3009）

```bash
npm run server
```

### 3. 啟動前端開發服務器（端口 3008）

```bash
npm run dev
```

### 4. 同時啟動前後端（推薦）

```bash
npm run dev:all
```

## 使用說明

1. **創建房間**：
   - 輸入玩家名稱
   - 點擊「創建房間」按鈕
   - 系統會自動生成6位房間代碼

2. **加入房間**：
   - 輸入玩家名稱和房間代碼
   - 點擊「加入房間」按鈕

3. **開始遊戲**：
   - 主持人點擊「開始」按鈕
   - 所有玩家可以點擊搶答按鈕
   - 第一個點擊者獲勝

4. **重置遊戲**：
   - 主持人點擊「重新開始」按鈕
   - 開始新一輪搶答

## 項目結構

```
party/
├── app/                    # Next.js 應用
│   ├── hooks/
│   │   └── useSocket.ts   # WebSocket Hook
│   ├── login/
│   │   └── page.tsx        # 登錄頁面
│   ├── game/
│   │   └── page.tsx        # 遊戲房間頁面
│   ├── providers.tsx       # Context Provider
│   └── page.tsx            # 主頁面
├── server/                 # 後端服務器
│   ├── index.js           # Express + Socket.IO 服務器
│   └── db.js              # 數據庫操作
├── public/
│   └── asset/             # 靜態資源
│       ├── buttons/       # 按鈕圖片
│       └── icons/        # 圖標
└── package.json
```

## 數據庫

數據庫文件 `server/party.db` 會在首次運行時自動創建。

### 數據表結構

- **rooms**: 房間信息
- **players**: 玩家信息
- **click_logs**: 點擊記錄

數據庫會自動清理30分鐘無活動的房間。

## API 端點

### REST API

- `POST /api/create-room`: 創建房間

### WebSocket 事件

#### 客戶端 -> 服務器

- `join_room`: 加入房間
- `start_round`: 開始回合（僅主持人）
- `player_click`: 點擊搶答按鈕
- `reset_round`: 重置回合（僅主持人）
- `leave_room`: 離開房間
- `ping`: 心跳檢測

#### 服務器 -> 客戶端

- `join_room_response`: 加入房間響應
- `player_joined`: 玩家加入通知
- `player_left`: 玩家離開通知
- `round_started`: 回合開始
- `round_locked`: 回合鎖定（第一個點擊）
- `round_result`: 回合結果
- `round_reset`: 回合重置
- `host_transferred`: 主持人轉移
- `leave_room_response`: 離開房間響應
- `pong`: 心跳響應

## 開發說明

- 後端服務器運行在 `http://localhost:3009`
- 前端開發服務器運行在 `http://localhost:3008`
- WebSocket 連接地址: `ws://localhost:3009`

## 注意事項

- 確保端口 3008 和 3009 未被占用
- 首次運行會自動創建數據庫文件
- 如果端口 3009 被佔用，可以通過環境變量設置: `PORT=3010 npm run server`
- 前端請透過 `.env.local` 設定後端地址，例如 `NEXT_PUBLIC_SERVER_URL=http://localhost:3010`
- 數據庫會自動清理過期房間
