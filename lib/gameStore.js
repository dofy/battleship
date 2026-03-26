const { createEmptyBoard } = require('./shipUtils')

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

function toSnapshot(room, forSocketId) {
  const snap = {
    id: room.id,
    status: room.status,
    isPublic: room.isPublic,
    currentTurn: room.currentTurn,
    winner: room.winner,
    rematchVotes: Array.from(room.rematchVotes),
    placingDeadline: room.placingDeadline,
    players: room.players.map((p) => {
      if (!p) return null
      const isSelf = p.id === forSocketId
      return {
        id: p.id,
        nickname: p.nickname,
        placingReady: p.placingReady,
        attacks: p.attacks,
        board: p.board.map(row => row.map(cell => ({
          attacked: cell.attacked,
          hasShip: (isSelf || room.status === 'finished' || cell.attacked) ? cell.hasShip : false,
          isBow:   (isSelf || room.status === 'finished') ? (cell.isBow   ?? false) : false,
          isStern: (isSelf || room.status === 'finished') ? (cell.isStern ?? false) : false,
          shipDir: (isSelf || room.status === 'finished') ? (cell.shipDir ?? null)  : null,
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
