const { createEmptyBoard, SHIPS } = require('./shipUtils')

const rooms = new Map()
const socketRoomMap = new Map()
const playerRoomMap = new Map()

function createPlayerState(socketId, nickname, playerId = socketId) {
  return {
    id: playerId,
    socketId,
    nickname,
    board: createEmptyBoard(),
    attacks: Array.from({ length: 10 }, () => Array(10).fill(false)),
    placingReady: false,
    connected: true,
    disconnectDeadline: null,
  }
}

function createRoom(roomId, socketId, nickname, isPublic, playerId = socketId) {
  const room = {
    id: roomId,
    status: 'waiting',
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

function getRoom(roomId) {
  return rooms.get(roomId)
}

function getPublicWaitingRooms() {
  return Array.from(rooms.values())
    .filter(r => r.isPublic && r.status === 'waiting' && r.players[0]?.connected)
    .map(r => ({ id: r.id, hostNickname: r.players[0].nickname }))
}

function addPlayer(room, socketId, nickname, playerId = socketId) {
  room.players[1] = createPlayerState(socketId, nickname, playerId)
  room.status = 'placing'
  room.placingDeadline = Date.now() + 90000
  socketRoomMap.set(socketId, room.id)
  playerRoomMap.set(playerId, room.id)
  return room.players[1]
}

function bindPlayerSocket(room, playerId, socketId, nickname) {
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

function markPlayerDisconnected(room, socketId, disconnectDeadline) {
  const player = room.players.find(p => p?.socketId === socketId)
  if (!player) return null
  player.connected = false
  player.disconnectDeadline = disconnectDeadline
  socketRoomMap.delete(socketId)
  return player
}

function removeRoom(roomId) {
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

function getPlayerIndex(room, socketId) {
  return room.players.findIndex(p => p?.socketId === socketId)
}

function getPlayerIndexById(room, playerId) {
  return room.players.findIndex(p => p?.id === playerId)
}

function getPlayerBySocket(room, socketId) {
  return room.players.find(p => p?.socketId === socketId) || null
}

function getOpponent(room, socketId) {
  return room.players.find(p => p && p.socketId !== socketId) || null
}

function getOpponentByPlayerId(room, playerId) {
  return room.players.find(p => p && p.id !== playerId) || null
}

function resetForRematch(room) {
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

function toSnapshot(room, forPlayerId) {
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

function getAllRooms() {
  return Array.from(rooms.values())
}

function getRoomBySocket(socketId) {
  const roomId = socketRoomMap.get(socketId)
  return roomId ? rooms.get(roomId) : null
}

function getRoomByPlayerId(playerId) {
  const roomId = playerRoomMap.get(playerId)
  return roomId ? rooms.get(roomId) : null
}

module.exports = {
  createRoom,
  getRoom,
  getAllRooms,
  getPublicWaitingRooms,
  addPlayer,
  bindPlayerSocket,
  markPlayerDisconnected,
  removeRoom,
  getPlayerIndex,
  getPlayerIndexById,
  getPlayerBySocket,
  getOpponent,
  getOpponentByPlayerId,
  resetForRematch,
  toSnapshot,
  createPlayerState,
  getRoomBySocket,
  getRoomByPlayerId,
}
