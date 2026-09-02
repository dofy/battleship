import type { Server, Socket } from 'socket.io'
import {
  createRoom, addComputerPlayer, getRoom, getPublicWaitingRooms,
  addPlayer, bindPlayerSocket, markPlayerDisconnected, removeRoom,
  getPlayerBySocket, getOpponentByPlayerId, resetForRematch,
  toSnapshot, getRoomBySocket, getRoomByPlayerId,
} from './gameStore.js'
import {
  generateRoomId, randomPlaceShips, validateBoard, createEmptyBoard,
  processAttack, checkAllSunk, findSunkShip, SHIPS,
} from '../shared/shipUtils.js'
import { chooseComputerTarget } from './computerPlayer.js'
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../shared/socketTypes.js'
import type { AttackResult, GameRoom, PlayerState } from '../shared/types.js'

const TURN_SECONDS = 12
const RECONNECT_GRACE_MS = 30000
const COMPUTER_TURN_DELAY_MS = 700

function normalizeNickname(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, 24)
}

function normalizePlayerId(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const id = value.trim()
  return id.length >= 8 && id.length <= 128 ? id : fallback
}

function normalizeRoomId(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase().slice(0, 6) : ''
}

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

export function registerHandlers(io: GameServer): void {
  const reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()

  function clearReconnectTimer(playerId: string): void {
    const timer = reconnectTimers.get(playerId)
    if (timer) clearTimeout(timer)
    reconnectTimers.delete(playerId)
  }

  function sendToPlayer<Event extends keyof ServerToClientEvents>(
    player: PlayerState | null | undefined,
    event: Event,
    ...payload: Parameters<ServerToClientEvents[Event]>
  ): void {
    if (player?.connected && player.socketId) io.to(player.socketId).emit(event, ...payload)
  }

  function broadcast(room: GameRoom): void {
    for (const player of room.players) {
      if (!player?.connected || !player.socketId) continue
      io.to(player.socketId).emit('room:update', { roomState: toSnapshot(room, player.id) })
    }
  }

  function startPlacingTimer(room: GameRoom): void {
    if (room.placingTimer) clearTimeout(room.placingTimer)
    const placingDeadline = room.placingDeadline ?? Date.now()
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
    }, Math.max(0, placingDeadline - Date.now()))
  }

  function buildResult(
    room: GameRoom,
    attacker: PlayerState,
    opponent: PlayerState,
    row: number,
    col: number,
    { autoAttack = false, actionId = null }: { autoAttack?: boolean; actionId?: string | null } = {},
  ): AttackResult {
    attacker.attacks[row][col] = true
    const result = processAttack(opponent.board, row, col)
    const payload: AttackResult = {
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

  function emitResult(room: GameRoom, payload: AttackResult): void {
    for (const player of room.players) sendToPlayer(player, 'game:result', payload)
  }

  function startTurnTimer(room: GameRoom): void {
    if (room.turnTimer) clearTimeout(room.turnTimer)
    room.turnTimer = null
    room.turnDeadline = null
    if (room.status !== 'playing' || !room.players.every(player => player?.connected)) return

    const attacker = room.players.find(player => player?.id === room.currentTurn)
    const opponent = getOpponentByPlayerId(room, room.currentTurn)
    if (!attacker || !opponent) return

    const delay = attacker.isComputer ? COMPUTER_TURN_DELAY_MS : TURN_SECONDS * 1000
    if (!attacker.isComputer) room.turnDeadline = Date.now() + delay
    room.turnTimer = setTimeout(() => {
      room.turnTimer = null
      room.turnDeadline = null
      if (room.status !== 'playing' || !room.players.every(player => player?.connected)) return

      const available = opponent.board.flatMap((rowCells, row) => rowCells.flatMap((cell, col) => (
        cell.attacked ? [] : [{ row, col }]
      )))
      const target = attacker.isComputer
        ? chooseComputerTarget(opponent.board)
        : available[Math.floor(Math.random() * available.length)]
      if (!target) return

      const { row, col } = target
      const payload = buildResult(room, attacker, opponent, row, col, {
        autoAttack: true,
        actionId: `${attacker.isComputer ? 'computer' : 'auto'}-${Date.now()}`,
      })
      if (room.status === 'playing') startTurnTimer(room)
      emitResult(room, payload)
      broadcast(room)
    }, delay)
  }

  function resumePlayer(
    socket: GameSocket,
    room: GameRoom,
    playerId: string,
    nickname?: string,
  ): PlayerState | null {
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

  function closeRoomAfterDeparture(
    room: GameRoom,
    player: PlayerState,
    reason = 'disconnect',
  ): void {
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
      const mode = payload.mode === 'computer' ? 'computer' : 'online'
      const room = createRoom(
        roomId,
        socket.id,
        nickname,
        mode === 'online' && !!payload.isPublic,
        playerId,
        mode,
      )
      if (mode === 'computer') {
        addComputerPlayer(room)
        startPlacingTimer(room)
      }
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
        if (room.placingTimer) clearTimeout(room.placingTimer)
        room.placingTimer = null
        room.placingDeadline = null
        room.status = 'playing'
        room.currentTurn = room.players[0].id
        startTurnTimer(room)
      }
      broadcast(room)
    })

    socket.on('game:attack', (payload = {}, acknowledge = () => undefined) => {
      const room = getRoomBySocket(socket.id)
      const attacker = room && getPlayerBySocket(room, socket.id)
      if (!room || !attacker || room.status !== 'playing') {
        return acknowledge({ ok: false, code: 'GAME_UNAVAILABLE', message: 'This battle is no longer active' })
      }
      if (room.currentTurn !== attacker.id) {
        socket.emit('error', { code: 'NOT_YOUR_TURN', message: 'Wait for your turn' })
        return acknowledge({ ok: false, code: 'NOT_YOUR_TURN', message: 'Wait for your turn' })
      }

      const row = Number(payload.row)
      const col = Number(payload.col)
      if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= 10 || col < 0 || col >= 10) {
        socket.emit('error', { code: 'INVALID_TARGET', message: 'Choose a valid target' })
        return acknowledge({ ok: false, code: 'INVALID_TARGET', message: 'Choose a valid target' })
      }

      const opponent = getOpponentByPlayerId(room, attacker.id)
      if (!opponent || opponent.board[row][col].attacked) {
        socket.emit('error', { code: 'ALREADY_ATTACKED', message: 'That sector was already attacked' })
        return acknowledge({ ok: false, code: 'ALREADY_ATTACKED', message: 'That sector was already attacked' })
      }

      if (room.turnTimer) clearTimeout(room.turnTimer)
      room.turnTimer = null
      room.turnDeadline = null
      const result = buildResult(room, attacker, opponent, row, col, {
        actionId: typeof payload.actionId === 'string' ? payload.actionId.slice(0, 80) : null,
      })
      if (room.status === 'playing') startTurnTimer(room)
      acknowledge({ ok: true, actionId: result.actionId })
      emitResult(room, result)
      broadcast(room)
    })

    socket.on('game:rematch', () => {
      const room = getRoomBySocket(socket.id)
      const player = room && getPlayerBySocket(room, socket.id)
      if (!room || !player || room.status !== 'finished' || !room.players.every(item => item?.connected)) return
      room.rematchVotes.add(player.id)
      const computer = room.players.find(item => item?.isComputer)
      if (computer) room.rematchVotes.add(computer.id)
      const total = room.players.filter(Boolean).length
      for (const item of room.players) {
        sendToPlayer(item, 'game:rematch_vote', { votes: room.rematchVotes.size, total })
      }
      if (room.rematchVotes.size === total) {
        resetForRematch(room)
        if (computer) {
          computer.board = randomPlaceShips(createEmptyBoard())
          computer.placingReady = true
        }
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
