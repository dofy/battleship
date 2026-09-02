import { createEmptyBoard, randomPlaceShips, SHIPS } from '../shared/shipUtils.js'
import type { GameMode, GameRoom, PlayerState, RoomSnapshot } from '../shared/types.js'

const rooms = new Map<string, GameRoom>()
const socketRoomMap = new Map<string, string>()
const playerRoomMap = new Map<string, string>()

export function createPlayerState(
  socketId: string,
  nickname: string,
  playerId = socketId,
  isComputer = false,
): PlayerState {
  return {
    id: playerId,
    socketId,
    nickname,
    board: createEmptyBoard(),
    attacks: Array.from({ length: 10 }, () => Array(10).fill(false)),
    placingReady: false,
    connected: true,
    disconnectDeadline: null,
    isComputer,
  }
}

export function createRoom(
  roomId: string,
  socketId: string,
  nickname: string,
  isPublic: boolean,
  playerId = socketId,
  mode: GameMode = 'online',
): GameRoom {
  const room: GameRoom = {
    id: roomId,
    status: 'waiting',
    mode,
    isPublic,
    players: [createPlayerState(socketId, nickname, playerId), null],
    currentTurn: playerId,
    winner: null,
    rematchVotes: new Set(),
    placingDeadline: null,
    placingTimer: null,
    turnDeadline: null,
    turnTimer: null,
  }
  rooms.set(roomId, room)
  socketRoomMap.set(socketId, roomId)
  playerRoomMap.set(playerId, roomId)
  return room
}

export function addComputerPlayer(room: GameRoom): PlayerState {
  const computer = createPlayerState('', 'Admiral CPU', `computer:${room.id}`, true)
  computer.board = randomPlaceShips(createEmptyBoard())
  computer.placingReady = true
  room.players[1] = computer
  room.mode = 'computer'
  room.isPublic = false
  room.status = 'placing'
  room.placingDeadline = Date.now() + 90000
  return computer
}

export function getRoom(roomId: string): GameRoom | undefined {
  return rooms.get(roomId)
}

export function getPublicWaitingRooms(): Array<{ id: string; hostNickname: string }> {
  return Array.from(rooms.values())
    .filter(r => r.isPublic && r.status === 'waiting' && r.players[0]?.connected)
    .map(r => ({ id: r.id, hostNickname: r.players[0].nickname }))
}

export function addPlayer(
  room: GameRoom,
  socketId: string,
  nickname: string,
  playerId = socketId,
): PlayerState {
  room.players[1] = createPlayerState(socketId, nickname, playerId)
  room.status = 'placing'
  room.placingDeadline = Date.now() + 90000
  socketRoomMap.set(socketId, room.id)
  playerRoomMap.set(playerId, room.id)
  return room.players[1]
}

export function bindPlayerSocket(
  room: GameRoom,
  playerId: string,
  socketId: string,
  nickname?: string,
): PlayerState | null {
  const player = room.players.find(p => p?.id === playerId)
  if (!player) return null
  if (player.socketId && player.socketId !== socketId) socketRoomMap.delete(player.socketId)
  player.socketId = socketId
  player.connected = true
  player.disconnectDeadline = null
  if (nickname) player.nickname = nickname
  socketRoomMap.set(socketId, room.id)
  playerRoomMap.set(playerId, room.id)
  return player
}

export function markPlayerDisconnected(
  room: GameRoom,
  socketId: string,
  disconnectDeadline: number,
): PlayerState | null {
  const player = room.players.find(p => p?.socketId === socketId)
  if (!player) return null
  player.connected = false
  player.disconnectDeadline = disconnectDeadline
  socketRoomMap.delete(socketId)
  return player
}

export function removeRoom(roomId: string): void {
  const room = rooms.get(roomId)
  if (room) {
    if (room.placingTimer) clearTimeout(room.placingTimer)
    if (room.turnTimer) clearTimeout(room.turnTimer)
    for (const p of room.players) {
      if (!p) continue
      if (p.socketId) socketRoomMap.delete(p.socketId)
      playerRoomMap.delete(p.id)
    }
  }
  rooms.delete(roomId)
}

export function getPlayerIndex(room: GameRoom, socketId: string): number {
  return room.players.findIndex(p => p?.socketId === socketId)
}

export function getPlayerIndexById(room: GameRoom, playerId: string): number {
  return room.players.findIndex(p => p?.id === playerId)
}

export function getPlayerBySocket(room: GameRoom, socketId: string): PlayerState | null {
  return room.players.find(p => p?.socketId === socketId) || null
}

export function getOpponent(room: GameRoom, socketId: string): PlayerState | null {
  return room.players.find(p => p && p.socketId !== socketId) || null
}

export function getOpponentByPlayerId(room: GameRoom, playerId: string): PlayerState | null {
  return room.players.find(p => p && p.id !== playerId) || null
}

export function resetForRematch(room: GameRoom): void {
  if (room.placingTimer) clearTimeout(room.placingTimer)
  if (room.turnTimer) clearTimeout(room.turnTimer)
  room.status = 'placing'
  room.winner = null
  room.rematchVotes = new Set()
  room.currentTurn = room.players[0].id
  room.placingDeadline = Date.now() + 90000
  room.turnDeadline = null
  room.turnTimer = null
  for (const p of room.players) {
    if (!p) continue
    p.board = createEmptyBoard()
    p.attacks = Array.from({ length: 10 }, () => Array(10).fill(false))
    p.placingReady = false
  }
}

export function toSnapshot(room: GameRoom, forPlayerId: string): RoomSnapshot {
  const winnerPlayer = room.winner ? room.players.find(p => p?.id === room.winner) : null
  const opponent = room.players.find(p => p && p.id !== forPlayerId)
  const sunkShipIds = opponent
    ? SHIPS.filter(ship => {
        const cells = opponent.board.flat().filter(cell => cell.shipId === ship.id)
        return cells.length === ship.size && cells.every(cell => cell.attacked)
      }).map(ship => ship.id)
    : []
  return {
    id: room.id,
    status: room.status,
    mode: room.mode,
    isPublic: room.isPublic,
    currentTurn: room.currentTurn,
    turnDeadline: room.turnDeadline,
    winner: winnerPlayer?.nickname ?? null,
    winnerId: room.winner,
    canRematch: room.status === 'finished' && room.players.every(p => p?.connected),
    rematchVotes: Array.from(room.rematchVotes),
    sunkShipIds,
    placingDeadline: room.placingDeadline,
    players: room.players.map((p) => {
      if (!p) return null
      const isSelf = p.id === forPlayerId
      return {
        id: p.id,
        nickname: p.nickname,
        connected: p.connected,
        disconnectDeadline: p.disconnectDeadline,
        placingReady: p.placingReady,
        isComputer: p.isComputer,
        attacks: p.attacks,
        board: p.board.map(row => row.map(cell => ({
          attacked: cell.attacked,
          hasShip: (isSelf || room.status === 'finished' || cell.attacked) ? cell.hasShip : false,
          isBow:   (isSelf || room.status === 'finished') ? (cell.isBow   ?? false) : false,
          isStern: (isSelf || room.status === 'finished') ? (cell.isStern ?? false) : false,
          shipDir: (isSelf || room.status === 'finished') ? (cell.shipDir ?? null)  : null,
          shipId:  (isSelf || room.status === 'finished' || cell.attacked) ? (cell.shipId ?? null) : null,
        }))),
      }
    }),
  }
}

export function getAllRooms(): GameRoom[] {
  return Array.from(rooms.values())
}

export function getRoomBySocket(socketId: string): GameRoom | null {
  const roomId = socketRoomMap.get(socketId)
  return roomId ? rooms.get(roomId) ?? null : null
}

export function getRoomByPlayerId(playerId: string): GameRoom | null {
  const roomId = playerRoomMap.get(playerId)
  return roomId ? rooms.get(roomId) ?? null : null
}
