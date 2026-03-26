// lib/socketHandlers.js
const {
  createRoom, getRoom, getPublicWaitingRooms,
  addPlayer, removeRoom, getPlayerIndex, getOpponent,
  resetForRematch, toSnapshot, getRoomBySocket,
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

function startPlacingTimer(io, room) {
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
    startTurnTimer(io, room)
    broadcast(io, room)
  }, 90000)
}

const TURN_SECONDS = 12

function startTurnTimer(io, room) {
  if (room.turnTimer) clearTimeout(room.turnTimer)
  room.turnTimer = setTimeout(() => {
    if (room.status !== 'playing') return
    const attacker = room.players.find(p => p?.id === room.currentTurn)
    const opponent = getOpponent(room, room.currentTurn)
    if (!attacker || !opponent) return

    // 随机选一个未攻击过的格子
    const cells = []
    for (let r = 0; r < 10; r++)
      for (let c = 0; c < 10; c++)
        if (!opponent.board[r][c].attacked) cells.push([r, c])
    if (cells.length === 0) return

    const [row, col] = cells[Math.floor(Math.random() * cells.length)]
    const result = processAttack(opponent.board, row, col)
    const resultPayload = { row, col, hit: result.hit, autoAttack: true }

    if (result.hit) {
      const sunkCells = findSunkShip(opponent.board, row, col)
      if (sunkCells) {
        const sunkShip = SHIPS.find(s => s.size === sunkCells.length)
        resultPayload.sunk = true
        resultPayload.shipName = sunkShip?.name
        resultPayload.sunkCells = sunkCells
      }
    }

    if (checkAllSunk(opponent.board)) {
      room.status = 'finished'
      room.winner = attacker.id
      resultPayload.winner = attacker.nickname
      resultPayload.winnerId = attacker.id
      io.to(room.players[0].id).emit('game:result', resultPayload)
      io.to(room.players[1].id).emit('game:result', resultPayload)
      broadcast(io, room)
      return
    }

    room.currentTurn = opponent.id
    io.to(room.players[0].id).emit('game:result', resultPayload)
    io.to(room.players[1].id).emit('game:result', resultPayload)
    broadcast(io, room)
    startTurnTimer(io, room)
  }, TURN_SECONDS * 1000)
}

function destroyRoom(room) {
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

      // 已在房间中（如创建者页面跳转后 socket 单例复用）→ 直接返回当前状态
      const existingIdx = getPlayerIndex(room, socket.id)
      if (existingIdx !== -1) {
        socket.join(roomId)
        return socket.emit('room:joined', { roomState: toSnapshot(room, socket.id) })
      }

      if (room.players[1]) return socket.emit('error', { message: '房间已满' })

      addPlayer(room, socket.id, nickname)
      socket.join(roomId)
      socket.emit('room:joined', { roomState: toSnapshot(room, socket.id) })

      // 启动布局倒计时
      startPlacingTimer(io, room)

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
      const room = getRoomBySocket(socket.id)
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
        startTurnTimer(io, room)
      }
      broadcast(io, room)
    })

    // ── 攻击 ─────────────────────────────────────────
    socket.on('game:attack', ({ row, col }) => {
      const room = getRoomBySocket(socket.id)
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
          const sunkShip = SHIPS.find(s => s.size === sunkCells.length)
          resultPayload.sunk = true
          resultPayload.shipName = sunkShip?.name
          resultPayload.sunkCells = sunkCells
        }
      }

      if (checkAllSunk(opponent.board)) {
        if (room.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null }
        room.status = 'finished'
        room.winner = socket.id   // 存 socketId
        resultPayload.winner = room.players[getPlayerIndex(room, socket.id)].nickname
        resultPayload.winnerId = socket.id
        io.to(room.players[0].id).emit('game:result', resultPayload)
        io.to(room.players[1].id).emit('game:result', resultPayload)
        broadcast(io, room)
        return
      }

      // 切换回合，重置回合计时器
      room.currentTurn = opponent.id
      io.to(room.players[0].id).emit('game:result', resultPayload)
      io.to(room.players[1].id).emit('game:result', resultPayload)
      broadcast(io, room)
      startTurnTimer(io, room)
    })

    // ── 再战投票 ─────────────────────────────────────
    socket.on('game:rematch', () => {
      const room = getRoomBySocket(socket.id)
      if (!room || room.status !== 'finished') return
      room.rematchVotes.add(socket.id)
      const total = room.players.filter(Boolean).length
      io.to(room.id).emit('game:rematch_vote', {
        votes: room.rematchVotes.size,
        total,
      })
      if (room.rematchVotes.size === total) {
        resetForRematch(room)
        // 重启布局倒计时
        startPlacingTimer(io, room)
        broadcast(io, room)
      }
    })

    // ── 断线处理 ─────────────────────────────────────
    socket.on('disconnect', () => handleLeave(socket, io))

    // ── 内部辅助 ─────────────────────────────────────
    function handleLeave(socket, io) {
      const room = getRoomBySocket(socket.id)
      if (!room) return
      const opponent = getOpponent(room, socket.id)
      const leaverNickname = room.players.find(p => p?.id === socket.id)?.nickname

      if (opponent) {
        io.to(opponent.id).emit('player:disconnect', { nickname: leaverNickname })
        if (room.status === 'playing') {
          // 设置胜者再销毁，保证状态一致
          room.winner = opponent.id
          room.status = 'finished'
          io.to(opponent.id).emit('game:result', { winner: opponent.nickname, winnerId: opponent.id })
        }
      }
      destroyRoom(room)
    }
  })
}

module.exports = { registerHandlers }
