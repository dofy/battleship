const {
  createRoom, getRoom, getPublicWaitingRooms,
  addPlayer, bindPlayerSocket, markPlayerDisconnected, removeRoom,
  getPlayerBySocket, getOpponentByPlayerId, resetForRematch,
  toSnapshot, getRoomBySocket, getRoomByPlayerId,
} = require('./gameStore')
const {
  generateRoomId, randomPlaceShips, validateBoard, createEmptyBoard,
  processAttack, checkAllSunk, findSunkShip, SHIPS,
} = require('./shipUtils')

const TURN_SECONDS = 12
const RECONNECT_GRACE_MS = 30000

function normalizeNickname(value) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, 24)
}

function normalizePlayerId(value, fallback) {
  if (typeof value !== 'string') return fallback
  const id = value.trim()
  return id.length >= 8 && id.length <= 128 ? id : fallback
}

function normalizeRoomId(value) {
  return typeof value === 'string' ? value.trim().toUpperCase().slice(0, 6) : ''
}

function registerHandlers(io) {
  const reconnectTimers = new Map()

  function clearReconnectTimer(playerId) {
    const timer = reconnectTimers.get(playerId)
    if (timer) clearTimeout(timer)
    reconnectTimers.delete(playerId)
  }

  function sendToPlayer(player, event, payload) {
    if (player?.connected && player.socketId) io.to(player.socketId).emit(event, payload)
  }

  function broadcast(room) {
    for (const player of room.players) {
      if (!player?.connected || !player.socketId) continue
      io.to(player.socketId).emit('room:update', { roomState: toSnapshot(room, player.id) })
    }
  }

  function startPlacingTimer(room) {
    if (room.placingTimer) clearTimeout(room.placingTimer)
    room.placingTimer = setTimeout(() => {
      if (room.status !== 'placing') return
      for (const player of room.players) {
        if (!player || player.placingReady) continue
        player.board = randomPlaceShips(createEmptyBoard())
        player.placingReady = true
        sendToPlayer(player, 'place:timeout')
      }
      room.status = 'playing'
      room.placingDeadline = null
      room.placingTimer = null
      room.currentTurn = room.players[0].id
      startTurnTimer(room)
      broadcast(room)
    }, Math.max(0, room.placingDeadline - Date.now()))
  }

  function buildResult(room, attacker, opponent, row, col, { autoAttack = false, actionId = null } = {}) {
    attacker.attacks[row][col] = true
    const result = processAttack(opponent.board, row, col)
    const payload = {
      actionId,
      attackerId: attacker.id,
      row,
      col,
      hit: result.hit,
      autoAttack,
    }

    if (result.hit) {
      const sunkCells = findSunkShip(opponent.board, row, col)
      if (sunkCells) {
        const ship = SHIPS.find(item => item.id === opponent.board[row][col].shipId)
          || SHIPS.find(item => item.size === sunkCells.length)
        payload.sunk = true
        payload.shipId = ship?.id
        payload.shipName = ship?.name
        payload.sunkCells = sunkCells
      }
    }

    if (checkAllSunk(opponent.board)) {
      room.status = 'finished'
      room.winner = attacker.id
      room.turnDeadline = null
      payload.winner = attacker.nickname
      payload.winnerId = attacker.id
    } else {
      room.currentTurn = opponent.id
    }
    return payload
  }

  function emitResult(room, payload) {
    for (const player of room.players) sendToPlayer(player, 'game:result', payload)
  }

  function startTurnTimer(room) {
    if (room.turnTimer) clearTimeout(room.turnTimer)
    room.turnTimer = null
    room.turnDeadline = null
    if (room.status !== 'playing' || !room.players.every(player => player?.connected)) return

    room.turnDeadline = Date.now() + TURN_SECONDS * 1000
    room.turnTimer = setTimeout(() => {
      room.turnTimer = null
      room.turnDeadline = null
      if (room.status !== 'playing' || !room.players.every(player => player?.connected)) return

      const attacker = room.players.find(player => player?.id === room.currentTurn)
      const opponent = getOpponentByPlayerId(room, room.currentTurn)
      if (!attacker || !opponent) return

      const available = []
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
          if (!opponent.board[row][col].attacked) available.push([row, col])
        }
      }
      if (available.length === 0) return

      const [row, col] = available[Math.floor(Math.random() * available.length)]
      const payload = buildResult(room, attacker, opponent, row, col, {
        autoAttack: true,
        actionId: `auto-${Date.now()}`,
      })
      if (room.status === 'playing') startTurnTimer(room)
      emitResult(room, payload)
      broadcast(room)
    }, TURN_SECONDS * 1000)
  }

  function resumePlayer(socket, room, playerId, nickname) {
    const player = room.players.find(item => item?.id === playerId)
    if (!player) return null

    const oldSocketId = player.socketId
    const wasDisconnected = !player.connected
    if (oldSocketId && oldSocketId !== socket.id) {
      io.sockets.sockets.get(oldSocketId)?.leave(room.id)
    }
    bindPlayerSocket(room, playerId, socket.id, nickname)
    clearReconnectTimer(playerId)
    socket.data.playerId = playerId
    socket.join(room.id)

    if (wasDisconnected) {
      const opponent = getOpponentByPlayerId(room, playerId)
      sendToPlayer(opponent, 'player:reconnected', { nickname: player.nickname })
    }
    if (room.status === 'playing' && room.players.every(item => item?.connected) && !room.turnTimer) {
      startTurnTimer(room)
    }
    return player
  }

  function closeRoomAfterDeparture(room, player, reason = 'disconnect') {
    clearReconnectTimer(player.id)
    const opponent = getOpponentByPlayerId(room, player.id)
    if (opponent) {
      sendToPlayer(opponent, 'player:disconnect', {
        nickname: player.nickname,
        temporary: false,
      })
      if (room.status === 'playing') {
        if (room.turnTimer) clearTimeout(room.turnTimer)
        room.turnTimer = null
        room.turnDeadline = null
        room.winner = opponent.id
        room.status = 'finished'
        const payload = {
          winner: opponent.nickname,
          winnerId: opponent.id,
          reason,
          roomClosed: true,
        }
        sendToPlayer(opponent, 'game:result', payload)
        broadcast(room)
      } else {
        sendToPlayer(opponent, 'room:closed', {
          reason,
          message: `${player.nickname} left the room`,
        })
      }
    }
    removeRoom(room.id)
  }

  io.on('connection', (socket) => {
    if (socket.recovered && socket.data.playerId) {
      const room = getRoomByPlayerId(socket.data.playerId)
      if (room && resumePlayer(socket, room, socket.data.playerId)) {
        socket.emit('room:joined', { roomState: toSnapshot(room, socket.data.playerId), recovered: true })
        broadcast(room)
      }
    }

    socket.on('room:create', (payload = {}) => {
      const nickname = normalizeNickname(payload.nickname)
      const playerId = normalizePlayerId(payload.playerId, socket.id)
      if (!nickname) return socket.emit('error', { code: 'INVALID_NICKNAME', message: 'Enter a callsign first' })

      const activeRoom = getRoomByPlayerId(playerId)
      if (activeRoom) {
        resumePlayer(socket, activeRoom, playerId, nickname)
        return socket.emit('room:created', {
          roomId: activeRoom.id,
          roomState: toSnapshot(activeRoom, playerId),
          resumed: true,
        })
      }

      let roomId = generateRoomId()
      while (getRoom(roomId)) roomId = generateRoomId()
      const room = createRoom(roomId, socket.id, nickname, !!payload.isPublic, playerId)
      socket.data.playerId = playerId
      socket.join(roomId)
      socket.emit('room:created', { roomId, roomState: toSnapshot(room, playerId) })
    })

    socket.on('room:join', (payload = {}) => {
      const roomId = normalizeRoomId(payload.roomId)
      const nickname = normalizeNickname(payload.nickname)
      const playerId = normalizePlayerId(payload.playerId, socket.id)
      if (!nickname) return socket.emit('error', { code: 'INVALID_NICKNAME', message: 'Enter a callsign first' })

      const room = getRoom(roomId)
      if (!room) {
        return socket.emit('error', {
          code: 'ROOM_NOT_FOUND',
          message: 'This room no longer exists',
        })
      }

      const returning = room.players.find(player => player?.id === playerId)
      if (returning) {
        resumePlayer(socket, room, playerId, nickname)
        socket.emit('room:joined', { roomState: toSnapshot(room, playerId), recovered: true })
        broadcast(room)
        return
      }

      const activeRoom = getRoomByPlayerId(playerId)
      if (activeRoom && activeRoom.id !== room.id) {
        return socket.emit('error', {
          code: 'ACTIVE_ROOM',
          roomId: activeRoom.id,
          message: `You already have an active room: ${activeRoom.id}`,
        })
      }
      if (room.players[1]) return socket.emit('error', { code: 'ROOM_FULL', message: 'This room is full' })

      addPlayer(room, socket.id, nickname, playerId)
      socket.data.playerId = playerId
      socket.join(roomId)
      socket.emit('room:joined', { roomState: toSnapshot(room, playerId) })
      startPlacingTimer(room)
      broadcast(room)
    })

    socket.on('room:list', () => {
      socket.emit('room:list_result', { rooms: getPublicWaitingRooms() })
    })

    socket.on('room:leave', () => {
      const room = getRoomBySocket(socket.id)
      const player = room && getPlayerBySocket(room, socket.id)
      if (room && player) closeRoomAfterDeparture(room, player, 'left')
    })

    socket.on('place:submit', (payload = {}) => {
      const room = getRoomBySocket(socket.id)
      if (!room || room.status !== 'placing') return
      const player = getPlayerBySocket(room, socket.id)
      if (!player || player.placingReady) return
      if (!validateBoard(payload.board)) {
        return socket.emit('error', { code: 'INVALID_BOARD', message: 'Fleet placement is invalid' })
      }

      player.board = payload.board
      player.placingReady = true
      if (room.players.every(item => item?.placingReady)) {
        clearTimeout(room.placingTimer)
        room.placingTimer = null
        room.placingDeadline = null
        room.status = 'playing'
        room.currentTurn = room.players[0].id
        startTurnTimer(room)
      }
      broadcast(room)
    })

    socket.on('game:attack', (payload = {}, ack = () => {}) => {
      const room = getRoomBySocket(socket.id)
      const attacker = room && getPlayerBySocket(room, socket.id)
      if (!room || !attacker || room.status !== 'playing') {
        return ack({ ok: false, code: 'GAME_UNAVAILABLE', message: 'This battle is no longer active' })
      }
      if (room.currentTurn !== attacker.id) {
        socket.emit('error', { code: 'NOT_YOUR_TURN', message: 'Wait for your turn' })
        return ack({ ok: false, code: 'NOT_YOUR_TURN', message: 'Wait for your turn' })
      }

      const row = Number(payload.row)
      const col = Number(payload.col)
      if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= 10 || col < 0 || col >= 10) {
        socket.emit('error', { code: 'INVALID_TARGET', message: 'Choose a valid target' })
        return ack({ ok: false, code: 'INVALID_TARGET', message: 'Choose a valid target' })
      }

      const opponent = getOpponentByPlayerId(room, attacker.id)
      if (!opponent || opponent.board[row][col].attacked) {
        socket.emit('error', { code: 'ALREADY_ATTACKED', message: 'That sector was already attacked' })
        return ack({ ok: false, code: 'ALREADY_ATTACKED', message: 'That sector was already attacked' })
      }

      if (room.turnTimer) clearTimeout(room.turnTimer)
      room.turnTimer = null
      room.turnDeadline = null
      const result = buildResult(room, attacker, opponent, row, col, {
        actionId: typeof payload.actionId === 'string' ? payload.actionId.slice(0, 80) : null,
      })
      if (room.status === 'playing') startTurnTimer(room)
      ack({ ok: true, actionId: result.actionId })
      emitResult(room, result)
      broadcast(room)
    })

    socket.on('game:rematch', () => {
      const room = getRoomBySocket(socket.id)
      const player = room && getPlayerBySocket(room, socket.id)
      if (!room || !player || room.status !== 'finished' || !room.players.every(item => item?.connected)) return
      room.rematchVotes.add(player.id)
      const total = room.players.filter(Boolean).length
      for (const item of room.players) {
        sendToPlayer(item, 'game:rematch_vote', { votes: room.rematchVotes.size, total })
      }
      if (room.rematchVotes.size === total) {
        resetForRematch(room)
        startPlacingTimer(room)
        broadcast(room)
      }
    })

    socket.on('disconnect', () => {
      const room = getRoomBySocket(socket.id)
      if (!room) return
      const disconnectDeadline = Date.now() + RECONNECT_GRACE_MS
      const player = markPlayerDisconnected(room, socket.id, disconnectDeadline)
      if (!player) return

      if (room.turnTimer) clearTimeout(room.turnTimer)
      room.turnTimer = null
      room.turnDeadline = null
      const opponent = getOpponentByPlayerId(room, player.id)
      sendToPlayer(opponent, 'player:disconnect', {
        nickname: player.nickname,
        temporary: true,
        disconnectDeadline,
      })
      broadcast(room)

      clearReconnectTimer(player.id)
      reconnectTimers.set(player.id, setTimeout(() => {
        reconnectTimers.delete(player.id)
        const currentRoom = getRoomByPlayerId(player.id)
        const currentPlayer = currentRoom?.players.find(item => item?.id === player.id)
        if (currentRoom && currentPlayer && !currentPlayer.connected) {
          closeRoomAfterDeparture(currentRoom, currentPlayer, 'disconnect')
        }
      }, RECONNECT_GRACE_MS))
    })
  })
}

module.exports = { registerHandlers }
