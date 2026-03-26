# Battleship 多人联网对战 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 Next.js 14 + Tailwind 项目上实现 1v1 实时联网海战棋游戏，支持房间创建/加入、90 秒布局倒计时、回合制对战、断线处理和本地战绩记录。

**Architecture:** Next.js Pages Router + Socket.IO 共享同一 Node.js 进程（server.js）。游戏状态全部存内存 Map，无数据库依赖。服务端负责所有游戏逻辑校验，客户端只负责 UI 渲染和事件发送。

**Tech Stack:** Next.js 14, Socket.IO 4, Tailwind CSS 2, Node.js 18, Jest (单元测试)

**Spec:** `docs/superpowers/specs/2026-03-25-battleship-multiplayer-design.md`

---

## 文件结构

```
battleship/
├── server.js                     # 入口：Custom HTTP Server + Socket.IO 挂载
├── lib/
│   ├── shipUtils.js              # 纯函数：随机布局、合法性校验、命中检测
│   ├── gameStore.js              # 内存状态：rooms Map + CRUD 操作
│   └── socketHandlers.js         # Socket.IO 事件处理器（依赖 gameStore）
├── hooks/
│   ├── useSocket.js              # 客户端 Socket.IO 连接 hook
│   └── useLocalStats.js          # localStorage 战绩读写 hook
├── components/
│   ├── Board.js                  # 10×10 棋盘（布局/攻击两用）
│   ├── ShipPlacer.js             # 布局阶段：拖放/点击放船、倒计时
│   ├── LobbyTable.js             # 首页公开房间列表
│   └── GameStats.js              # 对战右侧边栏（回合/战况）
├── pages/
│   ├── index.js                  # 首页（改造现有）
│   └── room/
│       └── [id].js               # 游戏房间页（布局+对战）
└── __tests__/
    ├── shipUtils.test.js
    └── gameStore.test.js
```

---

## Task 1: 安装依赖 & 项目基础配置

**Files:**
- Modify: `package.json`
- Create: `server.js`

- [ ] **Step 1: 安装 Socket.IO 和 Jest**

```bash
cd /Users/seven/Works/github/battleship
yarn add socket.io socket.io-client
yarn add --dev jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom
```

- [ ] **Step 2: 在 package.json 中添加 scripts**

将 `package.json` 的 scripts 改为：

```json
{
  "scripts": {
    "dev": "node server.js",
    "build": "next build",
    "start": "NODE_ENV=production node server.js",
    "test": "jest --testPathPattern='__tests__'"
  },
  "jest": {
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 3: 创建 server.js（Custom Server）**

```js
// server.js
const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')
const { registerHandlers } = require('./lib/socketHandlers')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  const io = new Server(httpServer, {
    cors: { origin: '*' }
  })

  registerHandlers(io)

  const port = process.env.PORT || 3000
  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
```

- [ ] **Step 4: 验证服务器启动**

```bash
yarn dev
```

预期：终端显示 `> Ready on http://localhost:3000`，浏览器访问正常。

- [ ] **Step 5: 提交**

```bash
git add package.json server.js
git commit -m "feat: add Socket.IO custom server"
```

---

## Task 2: shipUtils — 游戏核心逻辑（TDD）

**Files:**
- Create: `lib/shipUtils.js`
- Create: `__tests__/shipUtils.test.js`

### 2a: 随机布局

- [ ] **Step 1: 写失败测试**

```js
// __tests__/shipUtils.test.js
const { createEmptyBoard, randomPlaceShips, validateBoard, SHIPS } = require('../lib/shipUtils')

test('createEmptyBoard returns 10x10 grid of empty cells', () => {
  const board = createEmptyBoard()
  expect(board).toHaveLength(10)
  expect(board[0]).toHaveLength(10)
  expect(board[0][0]).toEqual({ hasShip: false, attacked: false })
})

test('randomPlaceShips places all ships on board', () => {
  const board = randomPlaceShips(createEmptyBoard())
  const shipCells = board.flat().filter(c => c.hasShip).length
  const totalShipCells = SHIPS.reduce((sum, s) => sum + s.size, 0)
  expect(shipCells).toBe(totalShipCells) // 5+4+3+3+2 = 17
})

test('randomPlaceShips ships are not adjacent to each other', () => {
  const board = randomPlaceShips(createEmptyBoard())
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (board[r][c].hasShip) {
        // 斜角不算相邻（只检查上下左右）
        const neighbors = [
          [r-1,c],[r+1,c],[r,c-1],[r,c+1]
        ].filter(([nr,nc]) => nr>=0&&nr<10&&nc>=0&&nc<10)
        // 相邻格有船是违规（同一艘船的格子除外）
        // 此测试通过 validateBoard 来检查布局合法性
      }
    }
  }
  expect(validateBoard(board)).toBe(true)
})
```

- [ ] **Step 2: 运行确认失败**

```bash
yarn test
```

预期：FAIL，`Cannot find module '../lib/shipUtils'`

- [ ] **Step 3: 实现 shipUtils.js**

```js
// lib/shipUtils.js

const SHIPS = [
  { name: '航空母舰', size: 5 },
  { name: '战列舰',   size: 4 },
  { name: '巡洋舰',   size: 3 },
  { name: '驱逐舰',   size: 3 },
  { name: '潜水艇',   size: 2 },
]

function createEmptyBoard() {
  return Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => ({ hasShip: false, attacked: false }))
  )
}

/** 深拷贝棋盘 */
function cloneBoard(board) {
  return board.map(row => row.map(cell => ({ ...cell })))
}

/** 检查在棋盘上放一艘船是否合法（不越界、不重叠、不相邻） */
function canPlace(board, row, col, size, dir) {
  for (let i = 0; i < size; i++) {
    const r = dir === 'H' ? row : row + i
    const c = dir === 'H' ? col + i : col
    if (r < 0 || r >= 10 || c < 0 || c >= 10) return false
    // 检查自身格及上下左右
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        const nr = r + dr, nc = c + dc
        if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10 && board[nr][nc].hasShip) return false
      }
    }
    if (board[r][c].hasShip) return false
  }
  return true
}

/** 在棋盘上放置一艘船 */
function placeShip(board, row, col, size, dir) {
  for (let i = 0; i < size; i++) {
    const r = dir === 'H' ? row : row + i
    const c = dir === 'H' ? col + i : col
    board[r][c].hasShip = true
  }
}

/** 随机布放所有船只（带重试） */
function randomPlaceShips(board) {
  const b = cloneBoard(board)
  for (let attempt = 0; attempt < 3; attempt++) {
    const fresh = cloneBoard(b)
    let ok = true
    for (const ship of SHIPS) {
      let placed = false
      for (let retry = 0; retry < 200; retry++) {
        const dir = Math.random() < 0.5 ? 'H' : 'V'
        const row = Math.floor(Math.random() * 10)
        const col = Math.floor(Math.random() * 10)
        if (canPlace(fresh, row, col, ship.size, dir)) {
          placeShip(fresh, row, col, ship.size, dir)
          placed = true
          break
        }
      }
      if (!placed) { ok = false; break }
    }
    if (ok) return fresh
  }
  throw new Error('randomPlaceShips: failed after 3 attempts')
}

/** 校验玩家提交的棋盘布局是否合法 */
function validateBoard(board) {
  // 统计有船格子
  const shipCells = board.flat().filter(c => c.hasShip)
  const total = SHIPS.reduce((s, ship) => s + ship.size, 0)
  if (shipCells.length !== total) return false

  // 检查相邻（上下左右，不能有两个不相连的船块相邻）
  // 简单验证：用 flood-fill 找连通区域，对比 SHIPS 配置
  const visited = Array.from({ length: 10 }, () => Array(10).fill(false))
  const groups = []

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (board[r][c].hasShip && !visited[r][c]) {
        // BFS
        const queue = [[r, c]]
        const group = []
        while (queue.length) {
          const [cr, cc] = queue.shift()
          if (visited[cr][cc]) continue
          visited[cr][cc] = true
          group.push([cr, cc])
          for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
            const nr = cr+dr, nc = cc+dc
            if (nr>=0&&nr<10&&nc>=0&&nc<10&&board[nr][nc].hasShip&&!visited[nr][nc]) {
              queue.push([nr, nc])
            }
          }
        }
        groups.push(group)
      }
    }
  }

  // 连通区域数量必须等于船只数量
  if (groups.length !== SHIPS.length) return false

  // 每个连通区域大小必须匹配某艘船（排序比对）
  const groupSizes = groups.map(g => g.length).sort((a,b) => b-a)
  const shipSizes  = SHIPS.map(s => s.size).sort((a,b) => b-a)
  if (!groupSizes.every((s, i) => s === shipSizes[i])) return false

  // 检查每个连通组是直线（水平或垂直）
  for (const group of groups) {
    const rows = group.map(([r]) => r)
    const cols = group.map(([,c]) => c)
    const isH = rows.every(r => r === rows[0])
    const isV = cols.every(c => c === cols[0])
    if (!isH && !isV) return false
  }

  // 检查船只之间不相邻（斜角也不行）
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (!board[r][c].hasShip) continue
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        const nr = r+dr, nc = c+dc
        if (nr<0||nr>=10||nc<0||nc>=10) continue
        if (!board[nr][nc].hasShip) continue
        // 是否同一连通组
        const myGroup   = groups.find(g => g.some(([gr,gc]) => gr===r && gc===c))
        const neighborGroup = groups.find(g => g.some(([gr,gc]) => gr===nr && gc===nc))
        if (myGroup !== neighborGroup) return false
      }
    }
  }

  return true
}

/** 处理一次攻击，返回结果 */
function processAttack(board, row, col) {
  const cell = board[row][col]
  if (cell.attacked) return { alreadyAttacked: true }
  cell.attacked = true
  const hit = cell.hasShip
  return { hit }
}

/** 检查所有船是否全部被击沉 */
function checkAllSunk(board) {
  return board.flat().every(c => !c.hasShip || c.attacked)
}

/** 找出被击沉的船的所有格子（flood-fill 找命中连通块） */
function findSunkShip(board, row, col) {
  // 从命中格出发，找整艘船的格子
  const queue = [[row, col]]
  const cells = []
  const visited = new Set()
  while (queue.length) {
    const [r, c] = queue.shift()
    const key = `${r},${c}`
    if (visited.has(key)) continue
    visited.add(key)
    if (!board[r][c].hasShip) continue
    cells.push({ row: r, col: c })
    for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const nr = r+dr, nc = c+dc
      if (nr>=0&&nr<10&&nc>=0&&nc<10&&board[nr][nc].hasShip) queue.push([nr,nc])
    }
  }
  // 判断是否整艘船都被攻击
  const allSunk = cells.every(({ row: r, col: c }) => board[r][c].attacked)
  return allSunk ? cells : null
}

/** 生成6位随机房间码 */
function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

module.exports = {
  SHIPS,
  createEmptyBoard,
  randomPlaceShips,
  validateBoard,
  processAttack,
  checkAllSunk,
  findSunkShip,
  generateRoomId,
}
```

- [ ] **Step 4: 补全测试并运行**

```js
// 在 __tests__/shipUtils.test.js 中补充
const { validateBoard, processAttack, checkAllSunk } = require('../lib/shipUtils')

test('validateBoard rejects board with wrong ship count', () => {
  const board = createEmptyBoard()
  expect(validateBoard(board)).toBe(false)
})

test('validateBoard accepts valid random board', () => {
  const board = randomPlaceShips(createEmptyBoard())
  expect(validateBoard(board)).toBe(true)
})

test('processAttack marks cell as attacked', () => {
  const board = randomPlaceShips(createEmptyBoard())
  const result = processAttack(board, 0, 0)
  expect(board[0][0].attacked).toBe(true)
  expect(result.alreadyAttacked).toBeUndefined()
})

test('checkAllSunk returns false when ships remain', () => {
  const board = randomPlaceShips(createEmptyBoard())
  expect(checkAllSunk(board)).toBe(false)
})
```

```bash
yarn test
```

预期：所有测试 PASS

- [ ] **Step 5: 提交**

```bash
git add lib/shipUtils.js __tests__/shipUtils.test.js
git commit -m "feat: add shipUtils (random placement, validation, attack logic)"
```

---

## Task 3: gameStore — 内存状态管理

**Files:**
- Create: `lib/gameStore.js`
- Create: `__tests__/gameStore.test.js`

- [ ] **Step 1: 写失败测试**

```js
// __tests__/gameStore.test.js
const { createRoom, getRoom, addPlayer, removeRoom } = require('../lib/gameStore')

test('createRoom creates room with waiting status', () => {
  const room = createRoom('ABC123', 'player1', 'Alice', true)
  expect(room.id).toBe('ABC123')
  expect(room.status).toBe('waiting')
  expect(room.players[0].nickname).toBe('Alice')
  expect(room.players[1]).toBeNull()
})

test('getRoom returns room by id', () => {
  createRoom('XYZ789', 'player1', 'Bob', false)
  const room = getRoom('XYZ789')
  expect(room).toBeDefined()
  expect(room.id).toBe('XYZ789')
})

test('addPlayer adds second player and changes status to placing', () => {
  const room = createRoom('ROOM01', 'player1', 'Alice', true)
  addPlayer(room, 'player2', 'Bob')
  expect(room.players[1].nickname).toBe('Bob')
  expect(room.status).toBe('placing')
})
```

- [ ] **Step 2: 运行确认失败**

```bash
yarn test __tests__/gameStore.test.js
```

预期：FAIL

- [ ] **Step 3: 实现 gameStore.js**

```js
// lib/gameStore.js
const { createEmptyBoard, randomPlaceShips } = require('./shipUtils')

const rooms = new Map()

function createPlayerState(socketId, nickname) {
  return {
    id: socketId,
    nickname,
    board: createEmptyBoard(),
    attacks: Array.from({ length: 10 }, () => Array(10).fill(false)),
    placingReady: false,
  }
}

function createRoom(roomId, socketId, nickname, isPublic) {
  const room = {
    id: roomId,
    status: 'waiting',
    isPublic,
    players: [createPlayerState(socketId, nickname), null],
    currentTurn: socketId,
    winner: null,
    rematchVotes: new Set(),
    placingDeadline: null,
    placingTimer: null,
  }
  rooms.set(roomId, room)
  return room
}

function getRoom(roomId) {
  return rooms.get(roomId)
}

function getPublicWaitingRooms() {
  return Array.from(rooms.values())
    .filter(r => r.isPublic && r.status === 'waiting')
    .map(r => ({ id: r.id, hostNickname: r.players[0].nickname }))
}

function addPlayer(room, socketId, nickname) {
  room.players[1] = createPlayerState(socketId, nickname)
  room.status = 'placing'
  room.placingDeadline = Date.now() + 90000
}

function removeRoom(roomId) {
  const room = rooms.get(roomId)
  if (room?.placingTimer) clearTimeout(room.placingTimer)
  rooms.delete(roomId)
}

function getPlayerIndex(room, socketId) {
  return room.players.findIndex(p => p && p.id === socketId)
}

function getOpponent(room, socketId) {
  return room.players.find(p => p && p.id !== socketId) || null
}

function resetForRematch(room) {
  const { createEmptyBoard } = require('./shipUtils')
  if (room.placingTimer) clearTimeout(room.placingTimer)
  room.status = 'placing'
  room.winner = null
  room.rematchVotes = new Set()
  room.currentTurn = room.players[0].id
  room.placingDeadline = Date.now() + 90000
  for (const p of room.players) {
    if (!p) continue
    p.board = createEmptyBoard()
    p.attacks = Array.from({ length: 10 }, () => Array(10).fill(false))
    p.placingReady = false
  }
}

/** 生成发给客户端的快照（脱敏对方棋盘） */
function toSnapshot(room, forSocketId) {
  const snap = {
    id: room.id,
    status: room.status,
    isPublic: room.isPublic,
    currentTurn: room.currentTurn,
    winner: room.winner,
    rematchVotes: Array.from(room.rematchVotes),
    placingDeadline: room.placingDeadline,
    players: room.players.map((p, idx) => {
      if (!p) return null
      const isSelf = p.id === forSocketId
      return {
        id: p.id,
        nickname: p.nickname,
        placingReady: p.placingReady,
        attacks: p.attacks,
        board: p.board.map(row => row.map(cell => ({
          attacked: cell.attacked,
          // finished 状态揭示对方棋盘；否则只有自己才看到 hasShip
          hasShip: (isSelf || room.status === 'finished') ? cell.hasShip : false,
        }))),
      }
    }),
  }
  return snap
}

function getAllRooms() {
  return Array.from(rooms.values())
}

module.exports = {
  createRoom,
  getRoom,
  getAllRooms,
  getPublicWaitingRooms,
  addPlayer,
  removeRoom,
  getPlayerIndex,
  getOpponent,
  resetForRematch,
  toSnapshot,
  createPlayerState,
}
```

- [ ] **Step 4: 运行测试**

```bash
yarn test __tests__/gameStore.test.js
```

预期：PASS

- [ ] **Step 5: 提交**

```bash
git add lib/gameStore.js __tests__/gameStore.test.js
git commit -m "feat: add gameStore (in-memory room state management)"
```

---

## Task 4: socketHandlers — Socket.IO 事件处理

**Files:**
- Create: `lib/socketHandlers.js`

- [ ] **Step 1: 创建 socketHandlers.js**

```js
// lib/socketHandlers.js
const {
  createRoom, getRoom, getPublicWaitingRooms,
  addPlayer, removeRoom, getPlayerIndex, getOpponent,
  resetForRematch, toSnapshot,
} = require('./gameStore')
const {
  generateRoomId, randomPlaceShips, validateBoard,
  processAttack, checkAllSunk, findSunkShip, SHIPS,
} = require('./shipUtils')

function broadcast(io, room) {
  for (const p of room.players) {
    if (!p) continue
    io.to(p.id).emit('room:update', { roomState: toSnapshot(room, p.id) })
  }
}

function destroyRoom(io, room, reason) {
  for (const p of room.players) {
    if (!p) continue
    io.to(p.id).emit('room:destroyed', { reason })
  }
  removeRoom(room.id)
}

function registerHandlers(io) {
  io.on('connection', (socket) => {

    // ── 创建房间 ──────────────────────────────────────
    socket.on('room:create', ({ nickname, isPublic }) => {
      const roomId = generateRoomId()
      const room = createRoom(roomId, socket.id, nickname, !!isPublic)
      socket.join(roomId)
      socket.emit('room:created', { roomId, roomState: toSnapshot(room, socket.id) })
    })

    // ── 加入房间 ──────────────────────────────────────
    socket.on('room:join', ({ roomId, nickname }) => {
      const room = getRoom(roomId)
      if (!room) return socket.emit('error', { message: '房间不存在' })
      if (room.players[1]) return socket.emit('error', { message: '房间已满' })

      addPlayer(room, socket.id, nickname)
      socket.join(roomId)
      socket.emit('room:joined', { roomState: toSnapshot(room, socket.id) })

      // 启动布局倒计时
      room.placingTimer = setTimeout(() => {
        if (room.status !== 'placing') return
        for (const p of room.players) {
          if (!p || p.placingReady) continue
          p.board = randomPlaceShips(p.board)
          p.placingReady = true
          io.to(p.id).emit('place:timeout')
        }
        room.status = 'playing'
        room.placingDeadline = null
        room.currentTurn = room.players[0].id
        broadcast(io, room)
      }, 90000)

      broadcast(io, room)
    })

    // ── 房间列表 ──────────────────────────────────────
    socket.on('room:list', () => {
      socket.emit('room:list_result', { rooms: getPublicWaitingRooms() })
    })

    // ── 主动离开 ──────────────────────────────────────
    socket.on('room:leave', () => handleLeave(socket, io))

    // ── 提交布局 ──────────────────────────────────────
    socket.on('place:submit', ({ board }) => {
      const room = findRoomBySocket(socket.id)
      if (!room || room.status !== 'placing') return
      const pidx = getPlayerIndex(room, socket.id)
      if (pidx === -1) return
      const player = room.players[pidx]
      if (player.placingReady) return

      if (!validateBoard(board)) {
        return socket.emit('error', { message: '布局非法，请重新摆放' })
      }

      player.board = board
      player.placingReady = true

      // 双方都 ready → 开战
      if (room.players.every(p => p && p.placingReady)) {
        clearTimeout(room.placingTimer)
        room.placingTimer = null
        room.placingDeadline = null
        room.status = 'playing'
        room.currentTurn = room.players[0].id
      }
      broadcast(io, room)
    })

    // ── 攻击 ─────────────────────────────────────────
    socket.on('game:attack', ({ row, col }) => {
      const room = findRoomBySocket(socket.id)
      if (!room || room.status !== 'playing') return
      if (room.currentTurn !== socket.id) {
        return socket.emit('error', { message: 'not your turn' })
      }
      if (row < 0 || row >= 10 || col < 0 || col >= 10) {
        return socket.emit('error', { message: '非法坐标' })
      }

      const opponent = getOpponent(room, socket.id)
      const result = processAttack(opponent.board, row, col)
      if (result.alreadyAttacked) return socket.emit('error', { message: '已攻击过该格' })

      const resultPayload = { row, col, hit: result.hit }

      if (result.hit) {
        const sunkCells = findSunkShip(opponent.board, row, col)
        if (sunkCells) {
          const totalSunk = SHIPS.find(s => s.size === sunkCells.length)
          resultPayload.sunk = true
          resultPayload.shipName = totalSunk?.name
          resultPayload.sunkCells = sunkCells
        }
      }

      if (checkAllSunk(opponent.board)) {
        room.status = 'finished'
        room.winner = room.players[getPlayerIndex(room, socket.id)].nickname
        resultPayload.winner = room.winner
        broadcast(io, room)
        io.to(room.players[0].id).emit('game:result', resultPayload)
        io.to(room.players[1].id).emit('game:result', resultPayload)
        return
      }

      // 切换回合
      room.currentTurn = opponent.id
      io.to(room.players[0].id).emit('game:result', resultPayload)
      io.to(room.players[1].id).emit('game:result', resultPayload)
      broadcast(io, room)
    })

    // ── 再战投票 ─────────────────────────────────────
    socket.on('game:rematch', () => {
      const room = findRoomBySocket(socket.id)
      if (!room || room.status !== 'finished') return
      room.rematchVotes.add(socket.id)
      const total = room.players.filter(Boolean).length
      io.to(room.id).emit('game:rematch_vote', {
        votes: room.rematchVotes.size,
        total,
      })
      if (room.rematchVotes.size === total) {
        resetForRematch(room)
        // 重启倒计时
        room.placingTimer = setTimeout(() => {
          if (room.status !== 'placing') return
          for (const p of room.players) {
            if (!p || p.placingReady) continue
            p.board = randomPlaceShips(p.board)
            p.placingReady = true
            io.to(p.id).emit('place:timeout')
          }
          room.status = 'playing'
          room.placingDeadline = null
          broadcast(io, room)
        }, 90000)
        broadcast(io, room)
      }
    })

    // ── 断线处理 ─────────────────────────────────────
    socket.on('disconnect', () => handleLeave(socket, io))

    // ── 内部辅助 ─────────────────────────────────────
    function handleLeave(socket, io) {
      const room = findRoomBySocket(socket.id)
      if (!room) return
      const opponent = getOpponent(room, socket.id)
      const leaverNickname = room.players.find(p => p?.id === socket.id)?.nickname

      if (opponent) {
        io.to(opponent.id).emit('player:disconnect', { nickname: leaverNickname })
        if (room.status === 'playing') {
          // 设置胜者再销毁，保证状态一致
          room.winner = opponent.nickname
          room.status = 'finished'
          io.to(opponent.id).emit('game:result', { winner: opponent.nickname })
        }
      }
      destroyRoom(io, room, 'player_left')
    }

    function findRoomBySocket(socketId) {
      // getAllRooms 在 gameStore.js 中导出，直接调用即可
      const { getAllRooms } = require('./gameStore')
      for (const room of getAllRooms()) {
        if (room.players.some(p => p?.id === socketId)) return room
      }
      return null
    }
  })
}

module.exports = { registerHandlers }
```

- [ ] **Step 2: 确认 gameStore.js 已导出 `getAllRooms`（Task 3 完成后应已包含）**

检查 `lib/gameStore.js` 的 `module.exports` 中有 `getAllRooms`。若没有，在 exports 对象中补充：

```js
function getAllRooms() {
  return Array.from(rooms.values())
}
// 加入 module.exports 对象
```

- [ ] **Step 3: 手动验证（使用 wscat 或浏览器控制台）**

```bash
yarn dev
# 新开终端
npx wscat -c ws://localhost:3000/socket.io/?EIO=4&transport=websocket
```

- [ ] **Step 4: 提交**

```bash
git add lib/socketHandlers.js lib/gameStore.js
git commit -m "feat: add socketHandlers (room/placing/game/rematch/disconnect)"
```

---

## Task 5: 客户端 Hooks

**Files:**
- Create: `hooks/useSocket.js`
- Create: `hooks/useLocalStats.js`

- [ ] **Step 1: 实现 useSocket.js**

```js
// hooks/useSocket.js
import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

export function useSocket() {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket = io()
    socketRef.current = socket
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => {
      setConnected(false)
      // 断线时跳转首页
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.location.href = '/'
      }
    })
    return () => socket.disconnect()
  }, [])

  return { socket: socketRef.current, connected }
}
```

- [ ] **Step 2: 实现 useLocalStats.js**

```js
// hooks/useLocalStats.js
import { useState, useCallback } from 'react'

const KEY = 'battleship_stats'

function readStats() {
  if (typeof window === 'undefined') return { wins: 0, losses: 0 }
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { wins: 0, losses: 0 }
  } catch { return { wins: 0, losses: 0 } }
}

export function useLocalStats() {
  const [stats, setStats] = useState(readStats)

  const recordWin = useCallback(() => {
    const next = { ...readStats(), wins: readStats().wins + 1 }
    localStorage.setItem(KEY, JSON.stringify(next))
    setStats(next)
  }, [])

  const recordLoss = useCallback(() => {
    const next = { ...readStats(), losses: readStats().losses + 1 }
    localStorage.setItem(KEY, JSON.stringify(next))
    setStats(next)
  }, [])

  return { stats, recordWin, recordLoss }
}
```

- [ ] **Step 3: 提交**

```bash
git add hooks/
git commit -m "feat: add useSocket and useLocalStats hooks"
```

---

## Task 6: Board 组件

**Files:**
- Create: `components/Board.js`

- [ ] **Step 1: 实现 Board.js**

```jsx
// components/Board.js
// 通用 10×10 棋盘，支持布局模式（展示 hasShip）和攻击模式（可点击）
export default function Board({ board, onCellClick, interactive = false, label }) {
  const cols = ['A','B','C','D','E','F','G','H','I','J']

  function cellClass(cell) {
    let base = 'w-7 h-7 border border-blue-900 rounded-sm flex items-center justify-center text-xs '
    if (cell.attacked && cell.hasShip)  return base + 'bg-red-500'
    if (cell.attacked && !cell.hasShip) return base + 'bg-gray-600'
    if (cell.hasShip)                   return base + 'bg-indigo-500'
    if (interactive)                    return base + 'bg-blue-950 cursor-crosshair hover:bg-blue-800'
    return base + 'bg-blue-950'
  }

  return (
    <div>
      {label && <p className="text-xs text-gray-400 text-center mb-1">{label}</p>}
      <div className="inline-block">
        {/* 列标题 */}
        <div className="flex ml-6">
          {cols.map(c => <div key={c} className="w-7 text-center text-xs text-gray-500">{c}</div>)}
        </div>
        {board.map((row, r) => (
          <div key={r} className="flex items-center">
            <div className="w-6 text-xs text-gray-500 text-right pr-1">{r}</div>
            {row.map((cell, c) => (
              <div
                key={c}
                className={cellClass(cell)}
                onClick={() => interactive && onCellClick && onCellClick(r, c)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add components/Board.js
git commit -m "feat: add Board component"
```

---

## Task 7: ShipPlacer 组件

**Files:**
- Create: `components/ShipPlacer.js`

- [ ] **Step 1: 实现 ShipPlacer.js**

```jsx
// components/ShipPlacer.js
import { useState, useEffect, useCallback } from 'react'
import Board from './Board'

const SHIPS = [
  { name: '航空母舰', size: 5 },
  { name: '战列舰',   size: 4 },
  { name: '巡洋舰',   size: 3 },
  { name: '驱逐舰',   size: 3 },
  { name: '潜水艇',   size: 2 },
]

function createEmptyBoard() {
  return Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => ({ hasShip: false, attacked: false }))
  )
}

export default function ShipPlacer({ placingDeadline, onSubmit, onRandom }) {
  const [board, setBoard]         = useState(createEmptyBoard)
  const [shipIdx, setShipIdx]     = useState(0)
  const [direction, setDirection] = useState('H')
  const [secondsLeft, setSeconds] = useState(90)
  const [ready, setReady]         = useState(false)

  // 倒计时
  useEffect(() => {
    if (!placingDeadline) return
    const tick = () => {
      const s = Math.max(0, Math.round((placingDeadline - Date.now()) / 1000))
      setSeconds(s)
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [placingDeadline])

  const canPlace = useCallback((b, row, col, size, dir) => {
    for (let i = 0; i < size; i++) {
      const r = dir === 'H' ? row : row + i
      const c = dir === 'H' ? col + i : col
      if (r < 0 || r >= 10 || c < 0 || c >= 10) return false
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r+dr, nc = c+dc
        if (nr>=0&&nr<10&&nc>=0&&nc<10&&b[nr][nc].hasShip) return false
      }
    }
    return true
  }, [])

  function handleCellClick(row, col) {
    if (ready || shipIdx >= SHIPS.length) return
    const { size } = SHIPS[shipIdx]
    if (!canPlace(board, row, col, size, direction)) return
    const next = board.map(r => r.map(c => ({ ...c })))
    for (let i = 0; i < size; i++) {
      const r = direction === 'H' ? row : row + i
      const c = direction === 'H' ? col + i : col
      next[r][c].hasShip = true
    }
    setBoard(next)
    setShipIdx(idx => idx + 1)
  }

  function handleRandom() {
    const randomBoard = onRandom()
    setBoard(randomBoard)
    setShipIdx(SHIPS.length)
  }

  function handleSubmit() {
    setReady(true)
    onSubmit(board)
  }

  const pct = placingDeadline ? Math.max(0, (secondsLeft / 90) * 100) : 100

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-400">点击棋盘放置舰船</span>
        <span className="text-xl font-bold text-yellow-400">⏱ {secondsLeft}s</span>
      </div>
      <div className="h-1.5 bg-blue-950 rounded overflow-hidden">
        <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all"
             style={{ width: `${pct}%` }} />
      </div>

      <div className="flex gap-6">
        <Board board={board} onCellClick={handleCellClick} interactive={!ready && shipIdx < SHIPS.length} label="我的棋盘" />

        <div className="space-y-3 min-w-40">
          <div className="text-xs text-indigo-400 font-bold uppercase">舰船列表</div>
          {SHIPS.map((s, i) => (
            <div key={i} className={`flex items-center gap-2 text-sm rounded px-2 py-1 ${i === shipIdx ? 'bg-indigo-900 border border-indigo-500 text-white' : i < shipIdx ? 'text-gray-600 line-through' : 'text-gray-400'}`}>
              <div className="flex gap-0.5">
                {Array.from({ length: s.size }, (_, k) => (
                  <div key={k} className={`w-3 h-3 rounded-sm ${i < shipIdx ? 'bg-gray-600' : 'bg-indigo-500'}`} />
                ))}
              </div>
              {s.name}
            </div>
          ))}

          <button onClick={() => setDirection(d => d === 'H' ? 'V' : 'H')}
                  className="w-full py-1 text-sm text-gray-400 bg-gray-800 rounded">
            方向: {direction === 'H' ? '水平' : '垂直'}
          </button>
          <button onClick={handleRandom}
                  className="w-full py-1 text-sm text-gray-400 bg-gray-800 rounded">
            🔀 随机布置
          </button>
          {shipIdx >= SHIPS.length && !ready && (
            <button onClick={handleSubmit}
                    className="w-full py-2 text-sm text-white bg-indigo-600 rounded font-bold">
              ✓ 确认布局
            </button>
          )}
          {ready && <p className="text-green-400 text-sm">✓ 等待对手...</p>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add components/ShipPlacer.js
git commit -m "feat: add ShipPlacer component"
```

---

## Task 8: LobbyTable & GameStats 组件

**Files:**
- Create: `components/LobbyTable.js`
- Create: `components/GameStats.js`

- [ ] **Step 1: 实现 LobbyTable.js**

```jsx
// components/LobbyTable.js
export default function LobbyTable({ rooms, onJoin }) {
  if (!rooms.length) return <p className="text-gray-500 text-sm">暂无公开房间</p>
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="text-indigo-400 border-b border-blue-900">
          <th className="text-left py-2 px-3">房主</th>
          <th className="text-left py-2 px-3">状态</th>
          <th className="py-2 px-3"></th>
        </tr>
      </thead>
      <tbody>
        {rooms.map(r => (
          <tr key={r.id} className="border-b border-blue-950">
            <td className="py-2 px-3">{r.hostNickname}</td>
            <td className="py-2 px-3 text-green-400">等待中</td>
            <td className="py-2 px-3">
              <button onClick={() => onJoin(r.id)}
                      className="px-3 py-1 bg-indigo-600 text-white rounded text-xs">
                加入
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 2: 实现 GameStats.js**

```jsx
// components/GameStats.js
const SHIPS = [
  { name: '航空母舰', size: 5 },
  { name: '战列舰',   size: 4 },
  { name: '巡洋舰',   size: 3 },
  { name: '驱逐舰',   size: 3 },
  { name: '潜水艇',   size: 2 },
]

export default function GameStats({ roomState, myId }) {
  if (!roomState) return null
  const isMyTurn = roomState.currentTurn === myId
  const me = roomState.players.find(p => p?.id === myId)
  const opponent = roomState.players.find(p => p && p.id !== myId)

  const mineHits   = me?.attacks?.flat().filter(Boolean).length || 0

  return (
    <div className="space-y-4 w-36">
      <div>
        <div className="text-xs text-indigo-400 uppercase font-bold mb-1">回合</div>
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${isMyTurn ? 'bg-green-900 text-green-300 border border-green-600' : 'bg-red-950 text-red-400 border border-red-800'}`}>
          {isMyTurn ? '你的回合' : '对手回合'}
        </span>
      </div>

      <div>
        <div className="text-xs text-indigo-400 uppercase font-bold mb-2">敌方舰队</div>
        <div className="space-y-1.5">
          {SHIPS.map((s, i) => (
            <div key={i} className="flex gap-0.5">
              {Array.from({ length: s.size }, (_, k) => (
                <div key={k} className="w-3.5 h-3.5 bg-indigo-600 rounded-sm" />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs text-indigo-400 uppercase font-bold mb-1">战况</div>
        <div className="text-xs text-gray-400 space-y-1">
          <div>攻击：{mineHits}</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 提交**

```bash
git add components/LobbyTable.js components/GameStats.js
git commit -m "feat: add LobbyTable and GameStats components"
```

---

## Task 9: 首页 pages/index.js

**Files:**
- Modify: `pages/index.js`

- [ ] **Step 1: 实现首页**

```jsx
// pages/index.js
import Head from 'next/head'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { io } from 'socket.io-client'
import LobbyTable from '../components/LobbyTable'
import { useLocalStats } from '../hooks/useLocalStats'

export default function Home() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [roomCode, setRoomCode]   = useState('')
  const [rooms, setRooms]         = useState([])
  const [isPublic, setIsPublic]   = useState(true)
  const [error, setError]         = useState('')
  const { stats } = useLocalStats()
  const socketRef = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem('battleship_nickname')
    if (saved) setNickname(saved)

    const socket = io()
    socketRef.current = socket
    socket.emit('room:list')
    socket.on('room:list_result', ({ rooms }) => setRooms(rooms))
    socket.on('room:created', ({ roomId }) => {
      router.push(`/room/${roomId}`)
    })
    socket.on('room:joined', ({ roomState }) => {
      router.push(`/room/${roomState.id}`)
    })
    socket.on('error', ({ message }) => setError(message))
    return () => socket.disconnect()
  }, [])

  function saveName() {
    localStorage.setItem('battleship_nickname', nickname)
  }

  function handleCreate() {
    if (!nickname.trim()) return setError('请输入昵称')
    saveName()
    socketRef.current.emit('room:create', { nickname: nickname.trim(), isPublic })
  }

  function handleJoin(id) {
    if (!nickname.trim()) return setError('请输入昵称')
    saveName()
    socketRef.current.emit('room:join', { roomId: id || roomCode.trim(), nickname: nickname.trim() })
  }

  const winRate = stats.wins + stats.losses > 0
    ? Math.round(stats.wins / (stats.wins + stats.losses) * 100)
    : 0

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <Head><title>🚢 Battleship!</title></Head>

      <h1 className="text-5xl font-bold mb-10">🚢 Battleship!</h1>

      <div className="flex gap-8 w-full max-w-3xl">
        {/* 左侧操作 */}
        <div className="w-56 space-y-4">
          <div>
            <label className="text-xs text-indigo-400 uppercase font-bold block mb-1">你的昵称</label>
            <input value={nickname} onChange={e => setNickname(e.target.value)}
                   className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                   placeholder="输入昵称..." />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)}
                   className="rounded" />
            公开房间（显示在大厅）
          </label>

          <button onClick={handleCreate}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded font-bold text-sm">
            + 创建新房间
          </button>

          <div className="flex gap-2">
            <input value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())}
                   placeholder="房间码"
                   className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm min-w-0" />
            <button onClick={() => handleJoin()}
                    className="px-3 py-2 border border-indigo-500 text-indigo-400 rounded text-sm whitespace-nowrap">
              加入
            </button>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {/* 战绩 */}
          <div className="p-3 bg-gray-900 border border-gray-800 rounded">
            <div className="text-xs text-indigo-400 uppercase font-bold mb-2">本地战绩</div>
            <div className="text-sm text-gray-400 space-y-1">
              <div>🏆 胜场：{stats.wins}</div>
              <div>💀 败场：{stats.losses}</div>
              <div>胜率：{winRate}%</div>
            </div>
          </div>
        </div>

        {/* 右侧大厅 */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-3">
            <div className="text-xs text-indigo-400 uppercase font-bold">公开房间大厅</div>
            <button onClick={() => socketRef.current?.emit('room:list')}
                    className="text-xs text-gray-500 hover:text-gray-300">↺ 刷新</button>
          </div>
          <LobbyTable rooms={rooms} onJoin={handleJoin} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add pages/index.js
git commit -m "feat: implement homepage with lobby and room creation"
```

---

## Task 10: 游戏房间页 pages/room/[id].js

**Files:**
- Create: `pages/room/[id].js`

- [ ] **Step 1: 创建游戏房间页**

```jsx
// pages/room/[id].js
import Head from 'next/head'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { io } from 'socket.io-client'
import Board from '../../components/Board'
import ShipPlacer from '../../components/ShipPlacer'
import GameStats from '../../components/GameStats'
import { useLocalStats } from '../../hooks/useLocalStats'
// shipUtils 是 CommonJS 模块，Next.js 会自动处理 CJS/ESM 互操作
// 注意：shipUtils 只在客户端调用 randomPlaceShips（纯 JS 逻辑，无 Node.js API，可在浏览器运行）
import { randomPlaceShips, createEmptyBoard } from '../../lib/shipUtils'

export default function RoomPage() {
  const router = useRouter()
  const { id: roomId } = router.query
  const [roomState, setRoomState] = useState(null)
  const [myId, setMyId]           = useState(null)
  const [message, setMessage]     = useState('')
  const [rematchVotes, setRematchVotes] = useState({ votes: 0, total: 2 })
  const socketRef = useRef(null)
  const { recordWin, recordLoss } = useLocalStats()
  const myNickname = typeof window !== 'undefined'
    ? localStorage.getItem('battleship_nickname') || ''
    : ''

  useEffect(() => {
    if (!roomId) return
    const socket = io()
    socketRef.current = socket
    setMyId(socket.id)

    socket.on('connect', () => {
      setMyId(socket.id)
      const nickname = localStorage.getItem('battleship_nickname') || '游客'
      socket.emit('room:join', { roomId, nickname })
    })

    socket.on('room:joined', ({ roomState }) => setRoomState(roomState))
    socket.on('room:update',  ({ roomState }) => setRoomState(roomState))

    socket.on('place:timeout', () => {
      setMessage('布局超时，已自动随机布置')
    })

    socket.on('game:result', ({ winner, hit, sunk, shipName }) => {
      if (winner) {
        const isWinner = winner === myNickname
        setMessage(isWinner ? '🏆 你赢了！' : '💀 你输了...')
        if (isWinner) recordWin(); else recordLoss()
      } else if (sunk) {
        setMessage(`击沉了 ${shipName}！`)
      } else if (hit) {
        setMessage('命中！')
      } else {
        setMessage('未中')
      }
    })

    socket.on('game:rematch_vote', ({ votes, total }) => {
      setRematchVotes({ votes, total })
    })

    socket.on('player:disconnect', ({ nickname }) => {
      setMessage(`${nickname} 断线了`)
    })

    socket.on('room:destroyed', () => {
      router.push('/')
    })

    socket.on('error', ({ message }) => setMessage(`⚠️ ${message}`))
    socket.on('disconnect', () => router.push('/'))

    return () => socket.disconnect()
  }, [roomId])

  function handleAttack(row, col) {
    socketRef.current?.emit('game:attack', { row, col })
  }

  function handleSubmitBoard(board) {
    socketRef.current?.emit('place:submit', { board })
  }

  function handleRandomBoard() {
    return randomPlaceShips(createEmptyBoard())
  }

  function handleLeave() {
    socketRef.current?.emit('room:leave')
    router.push('/')
  }

  function handleRematch() {
    socketRef.current?.emit('game:rematch')
  }

  if (!roomState) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">连接中...</p>
      </div>
    )
  }

  const me       = roomState.players.find(p => p?.id === myId)
  const opponent = roomState.players.find(p => p && p.id !== myId)
  const status   = roomState.status

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <Head><title>🚢 Battleship! — 房间 {roomId}</title></Head>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">🚢 Battleship!</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">房间码：<span className="text-indigo-400 font-mono font-bold">{roomId}</span></span>
          <button onClick={handleLeave} className="text-xs text-gray-500 hover:text-gray-300">离开</button>
        </div>
      </div>

      {/* 消息提示 */}
      {message && (
        <div className="mb-4 px-4 py-2 bg-gray-800 rounded text-sm text-yellow-300">{message}</div>
      )}

      {/* 等待阶段 */}
      {status === 'waiting' && (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg">等待对手加入...</p>
          <p className="text-sm text-gray-600 mt-2">把房间码 <span className="text-indigo-400 font-mono font-bold">{roomId}</span> 发给朋友</p>
        </div>
      )}

      {/* 布局阶段 */}
      {status === 'placing' && me && (
        <ShipPlacer
          placingDeadline={roomState.placingDeadline}
          onSubmit={handleSubmitBoard}
          onRandom={handleRandomBoard}
        />
      )}

      {/* 对战阶段 */}
      {(status === 'playing' || status === 'finished') && me && opponent && (
        <div className="flex gap-8">
          <Board
            board={opponent.board}
            onCellClick={status === 'playing' ? handleAttack : undefined}
            interactive={status === 'playing' && roomState.currentTurn === myId}
            label="敌方海域（点击攻击）"
          />
          <Board
            board={me.board}
            label="我方海域"
          />
          <GameStats roomState={roomState} myId={myId} />
        </div>
      )}

      {/* 游戏结束 */}
      {status === 'finished' && (
        <div className="mt-6 flex gap-4 items-center">
          <button onClick={handleRematch}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded font-bold">
            再战一局 ({rematchVotes.votes}/{rematchVotes.total})
          </button>
          <button onClick={handleLeave}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded">
            返回大厅
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add pages/room/
git commit -m "feat: implement game room page (placing + playing + finished)"
```

---

## Task 11: 端到端验证

- [ ] **Step 1: 启动服务**

```bash
yarn dev
```

- [ ] **Step 2: 两个浏览器窗口测试**

1. 窗口 A：输入昵称 → 创建公开房间 → 记录房间码
2. 窗口 B：输入昵称 → 输入房间码 → 加入
3. 双方进入布局阶段，分别摆放舰船或随机布置 → 确认
4. 进入对战，交替点击对方棋盘攻击
5. 击沉所有船触发胜负
6. 点击"再战"测试重开流程
7. 关闭一个窗口测试断线处理

- [ ] **Step 3: 测试超时自动布局**

1. 创建并加入房间后，等待 90 秒不操作
2. 确认双方自动随机布置并进入对战

- [ ] **Step 4: 运行单元测试**

```bash
yarn test
```

预期：所有测试 PASS

- [ ] **Step 5: 最终提交**

```bash
git add -A
git commit -m "feat: battleship multiplayer complete"
```

---

## 部署备注（VPS）

```bash
# 安装依赖
yarn install --production

# 使用 pm2 启动
npm install -g pm2
pm2 start server.js --name battleship
pm2 save
pm2 startup
```
