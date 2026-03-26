const { createEmptyBoard } = require('./shipUtils')

const rooms = new Map()
// socketId → roomId 映射，O(1) 查找玩家所在房间
const socketRoomMap = new Map()

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
    winner: null,       // 存 socketId
    rematchVotes: new Set(),
    placingDeadline: null,
    placingTimer: null,
    turnTimer: null,
  }
  rooms.set(roomId, room)
  socketRoomMap.set(socketId, roomId)
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
  socketRoomMap.set(socketId, room.id)
}

function removeRoom(roomId) {
  const room = rooms.get(roomId)
  if (room) {
    if (room.placingTimer) clearTimeout(room.placingTimer)
    if (room.turnTimer)    clearTimeout(room.turnTimer)
    for (const p of room.players) {
      if (p) socketRoomMap.delete(p.id)
    }
  }
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
  if (room.turnTimer)    clearTimeout(room.turnTimer)
  room.status = 'placing'
  room.winner = null
  room.rematchVotes = new Set()
  room.currentTurn = room.players[0].id
  room.placingDeadline = Date.now() + 90000
  room.turnTimer = null
  for (const p of room.players) {
    if (!p) continue
    p.board = createEmptyBoard()
    p.attacks = Array.from({ length: 10 }, () => Array(10).fill(false))
    p.placingReady = false
  }
}

function toSnapshot(room, forSocketId) {
  const winnerPlayer = room.winner ? room.players.find(p => p?.id === room.winner) : null
  const snap = {
    id: room.id,
    status: room.status,
    isPublic: room.isPublic,
    currentTurn: room.currentTurn,
    winner: winnerPlayer?.nickname ?? null,   // 兼容前端显示
    winnerId: room.winner,                    // socketId，用于可靠判断自己是否获胜
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

function getRoomBySocket(socketId) {
  const roomId = socketRoomMap.get(socketId)
  return roomId ? rooms.get(roomId) : null
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
  getRoomBySocket,
}
