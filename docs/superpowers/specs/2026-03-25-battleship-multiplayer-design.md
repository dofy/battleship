# Battleship 多人联网对战 — 设计文档

**日期：** 2026-03-25
**状态：** 已确认

---

## 概述

在现有 Next.js 14 + Tailwind 项目基础上，实现 1v1 实时联网海战棋游戏。支持创建/加入房间、布局阶段倒计时、回合制对战、战绩本地记录。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 14（现有） |
| 样式 | Tailwind CSS（现有） |
| 实时通信 | Socket.IO |
| 游戏状态 | 服务端内存（Map） |
| 玩家身份 | 游客昵称 + localStorage 战绩 |
| 部署 | VPS 自托管，单 Node.js 进程（pm2） |

---

## 系统架构

```
┌─────────────────────────────────────────┐
│           Node.js 进程 (server.js)       │
│                                         │
│  ┌──────────────┐  ┌─────────────────┐ │
│  │  Next.js     │  │   Socket.IO     │ │
│  │  (HTTP/页面) │  │   (WS 事件)     │ │
│  └──────────────┘  └─────────────────┘ │
│           共享同一个 HTTP server         │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │     内存游戏状态管理 (GameStore)  │  │
│  │  rooms: Map<roomId, RoomState>   │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**关键决策：** 游戏状态只存内存，服务重启清空。对战游戏本身是短暂会话，这完全可接受，无需引入 Redis 等外部依赖。

---

## 页面路由

| 路径 | 说明 |
|------|------|
| `/` | 首页：输入昵称、创建/加入房间、公开大厅列表、本地战绩 |
| `/room/[id]` | 游戏房间：布局阶段 + 对战阶段（同一页面，按状态切换） |

---

## 游戏数据结构

```typescript
type RoomStatus = 'waiting' | 'placing' | 'playing' | 'finished'

type Cell = {
  hasShip: boolean
  hit: boolean      // 被攻击过
}

type PlayerState = {
  id: string              // socket.id
  nickname: string
  board: Cell[][]         // 10×10，自己的棋盘（含船只位置）
  attacks: boolean[][]    // 10×10，对敌方的攻击记录
  placingReady: boolean   // 布局完成标记
  placingTimer?: NodeJS.Timeout
}

type RoomState = {
  id: string              // 6位随机房间码（大写字母+数字）
  status: RoomStatus
  isPublic: boolean
  players: [PlayerState, PlayerState | null]
  currentTurn: string     // 当前回合的 socket.id
  winner: string | null
  rematchVotes: Set<string>  // 已投票重开的玩家 socket.id
}
```

### 舰船配置（标准规则）

| 名称 | 长度 | 数量 |
|------|------|------|
| 航空母舰 | 5 | 1 |
| 战列舰 | 4 | 1 |
| 巡洋舰 | 3 | 1 |
| 驱逐舰 | 3 | 1 |
| 潜水艇 | 2 | 1 |

---

## Socket.IO 事件

### 客户端 → 服务端

| 事件 | Payload | 说明 |
|------|---------|------|
| `room:create` | `{ nickname, isPublic }` | 创建房间 |
| `room:join` | `{ roomId, nickname }` | 加入指定房间 |
| `room:list` | — | 获取公开等待中的房间列表 |
| `place:submit` | `{ board: Cell[][] }` | 提交布局（布局阶段） |
| `game:attack` | `{ row, col }` | 发动攻击 |
| `game:rematch` | — | 发起或同意重开 |

### 服务端 → 客户端

| 事件 | Payload | 说明 |
|------|---------|------|
| `room:created` | `{ roomId, roomState }` | 房间创建成功 |
| `room:joined` | `{ roomState }` | 加入房间成功 |
| `room:list_result` | `{ rooms }` | 公开房间列表 |
| `room:update` | `{ roomState }` | 房间状态变更广播（双方） |
| `place:timeout` | — | 布局超时，服务端自动随机填充 |
| `game:result` | `{ row, col, hit, sunk, shipName?, winner? }` | 攻击结果 |
| `game:rematch_vote` | `{ votes, total }` | 重开投票进度 |
| `player:disconnect` | `{ nickname }` | 对手断线通知 |
| `error` | `{ message }` | 错误信息（如房间不存在） |

---

## 游戏流程

```
创建/加入房间
     ↓
[waiting] 等待第二位玩家
     ↓ 双方进入
[placing] 布局阶段（90秒倒计时）
  - 玩家手动布置或随机布置后点"确认"
  - 超时自动随机填充剩余未布置船只
  - 双方都 ready → 进入对战
     ↓
[playing] 对战阶段（回合制）
  - 先加入的玩家先手
  - 每回合攻击一格
  - 击沉全部船只 → 胜利
     ↓
[finished] 游戏结束
  - 显示胜负结果
  - 双方都点"再战" → 返回 placing 阶段，重置棋盘
  - 任一方拒绝或离开 → 返回首页
```

---

## UI 页面设计

### 首页 `/`
- 左侧：昵称输入框、"创建新房间"按钮、房间码输入+加入按钮
- 右侧：公开房间大厅列表（房主昵称、状态、加入按钮）
- 左下：本地战绩卡片（从 localStorage 读取胜/败场数）

### 游戏房间 `/room/[id]`

**布局阶段：**
- 顶部：倒计时进度条 + 秒数
- 左侧：10×10 我方棋盘（可交互）
- 右侧：舰船列表（当前待放置高亮）、随机布置按钮、确认按钮

**对战阶段：**
- 左棋盘：敌方海域（可点击攻击，显示命中/未中/击沉）
- 右棋盘：我方海域（显示被攻击位置）
- 右侧边栏：回合状态、敌方舰队存活状态、战况统计

---

## 本地战绩（localStorage）

```typescript
type LocalStats = {
  wins: number
  losses: number
}
// key: 'battleship_stats'
```

每局结束时更新，以胜负结果累加。

---

## 布局阶段随机算法

服务端实现 `randomPlaceShips(board)` 函数：
1. 按舰船从大到小依次放置
2. 随机选方向（水平/垂直）和起始坐标
3. 检测边界和与已有船只不重叠、不相邻（标准规则要求不相邻）
4. 超过重试次数则换下一个随机位置，直到成功放置所有船只

---

## 错误处理

| 场景 | 处理方式 |
|------|---------|
| 房间不存在 | 服务端发 `error` 事件，前端提示并返回首页 |
| 房间已满 | 同上 |
| 攻击非法坐标 | 服务端忽略并发 `error` |
| 对手断线 | 发 `player:disconnect`，等待 30 秒重连，超时则对手胜 |
| 布局超时 | 服务端自动随机填充，标记为 ready |

---

## 目录结构（新增文件）

```
battleship/
├── server.js                        # Next.js Custom Server + Socket.IO
├── lib/
│   ├── gameStore.js                 # 内存游戏状态管理
│   ├── socketHandlers.js            # Socket.IO 事件处理器
│   └── shipUtils.js                 # 随机布局、命中检测等游戏逻辑
├── pages/
│   ├── index.js                     # 首页（改造现有）
│   └── room/
│       └── [id].js                  # 游戏房间页
├── components/
│   ├── Board.js                     # 棋盘组件（可复用于布局和对战）
│   ├── ShipPlacer.js                # 布局阶段交互组件
│   ├── LobbyTable.js                # 公开房间列表
│   └── GameStats.js                 # 战况侧边栏
└── hooks/
    ├── useSocket.js                 # Socket.IO 客户端 hook
    └── useLocalStats.js             # localStorage 战绩 hook
```

---

## 已排除功能（YAGNI）

- 用户账号/登录系统
- 聊天功能
- 观战模式（大厅显示"游戏中"但不可进入）
- Redis 持久化
- 多节点部署
- 排行榜
