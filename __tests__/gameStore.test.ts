import { expect, test } from 'vitest'
import {
  createRoom, getRoom, addPlayer, addComputerPlayer, bindPlayerSocket, markPlayerDisconnected,
  removeRoom, getPublicWaitingRooms, toSnapshot, getAllRooms, getRoomBySocket,
  getRoomByPlayerId, resetForRematch,
} from '../lib/gameStore'
import { createEmptyBoard, randomPlaceShips, SHIPS, validateBoard } from '../lib/shipUtils'

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
  if (!room) throw new Error('Expected room to exist')
  expect(room.id).toBe('XYZ789')
})

test('addPlayer adds second player and changes status to placing', () => {
  const room = createRoom('ROOM01', 'player1', 'Alice', true)
  addPlayer(room, 'player2', 'Bob')
  expect(room.players[1]?.nickname).toBe('Bob')
  expect(room.status).toBe('placing')
})

test('addComputerPlayer creates a ready private opponent with a valid fleet', () => {
  const room = createRoom('CPU001', 'human-socket', 'Alice', true, 'human-id')
  const computer = addComputerPlayer(room)

  expect(room.mode).toBe('computer')
  expect(room.status).toBe('placing')
  expect(room.isPublic).toBe(false)
  expect(computer).toMatchObject({
    id: 'computer:CPU001',
    nickname: 'Admiral CPU',
    isComputer: true,
    placingReady: true,
    connected: true,
  })
  expect(validateBoard(computer.board)).toBe(true)
  expect(getPublicWaitingRooms().map(item => item.id)).not.toContain('CPU001')

  const snapshot = toSnapshot(room, 'human-id')
  expect(snapshot.mode).toBe('computer')
  expect(snapshot.players[1]?.isComputer).toBe(true)
})

test('removeRoom deletes room from store', () => {
  createRoom('DEL001', 'p1', 'Alice', true)
  removeRoom('DEL001')
  expect(getRoom('DEL001')).toBeUndefined()
})

test('getPublicWaitingRooms returns only public waiting rooms', () => {
  createRoom('PUB001', 'p1', 'Alice', true)   // public, waiting
  createRoom('PRV001', 'p2', 'Bob', false)    // private, waiting
  const rooms = getPublicWaitingRooms()
  const ids = rooms.map(r => r.id)
  expect(ids).toContain('PUB001')
  expect(ids).not.toContain('PRV001')
})

test('toSnapshot hides opponent hasShip during playing', () => {
  const room = createRoom('SNAP01', 'p1', 'Alice', true)
  addPlayer(room, 'p2', 'Bob')
  room.status = 'playing'
  const opponent = room.players[1]
  if (!opponent) throw new Error('Expected opponent to exist')
  // 给 p2 设置一个有船的棋盘
  opponent.board[0][0].hasShip = true
  const snap = toSnapshot(room, 'p1')
  // p1 看到的 p2 棋盘中 hasShip 应全为 false
  const opponentBoard = snap.players.find(p => p?.id === 'p2')?.board
  if (!opponentBoard) throw new Error('Expected opponent board')
  expect(opponentBoard[0][0].hasShip).toBe(false)
})

test('toSnapshot reveals hasShip on attacked opponent cells during playing', () => {
  const room = createRoom('SNAP03', 'p1', 'Alice', true)
  addPlayer(room, 'p2', 'Bob')
  room.status = 'playing'
  const opponent = room.players[1]
  if (!opponent) throw new Error('Expected opponent to exist')
  // [0][0] 有船且已被攻击 → 应暴露
  opponent.board[0][0].hasShip  = true
  opponent.board[0][0].attacked = true
  // [0][1] 有船但未被攻击 → 仍隐藏
  opponent.board[0][1].hasShip  = true
  opponent.board[0][1].attacked = false
  const snap = toSnapshot(room, 'p1')
  const opponentBoard = snap.players.find(p => p?.id === 'p2')?.board
  if (!opponentBoard) throw new Error('Expected opponent board')
  expect(opponentBoard[0][0].hasShip).toBe(true)   // 已攻击 → 暴露
  expect(opponentBoard[0][1].hasShip).toBe(false)  // 未攻击 → 隐藏
})

test('toSnapshot reveals opponent hasShip after finished', () => {
  const room = createRoom('SNAP02', 'p1', 'Alice', true)
  addPlayer(room, 'p2', 'Bob')
  room.status = 'finished'
  const opponent = room.players[1]
  if (!opponent) throw new Error('Expected opponent to exist')
  opponent.board[0][0].hasShip = true
  const snap = toSnapshot(room, 'p1')
  const opponentBoard = snap.players.find(p => p?.id === 'p2')?.board
  if (!opponentBoard) throw new Error('Expected opponent board')
  expect(opponentBoard[0][0].hasShip).toBe(true)
})

test('getAllRooms returns all rooms', () => {
  createRoom('ALL001', 'p1', 'Alice', true)
  const all = getAllRooms()
  expect(all.some(r => r.id === 'ALL001')).toBe(true)
})

// ── 新增：socketId→room 映射表 ───────────────────────────
test('getRoomBySocket returns room after createRoom', () => {
  createRoom('MAP001', 'sock1', 'Alice', true)
  const room = getRoomBySocket('sock1')
  expect(room).toBeDefined()
  if (!room) throw new Error('Expected room to exist')
  expect(room.id).toBe('MAP001')
})

test('getRoomBySocket returns room after addPlayer', () => {
  const room = createRoom('MAP002', 'sock2', 'Alice', true)
  addPlayer(room, 'sock3', 'Bob')
  expect(getRoomBySocket('sock3')?.id).toBe('MAP002')
})

test('getRoomBySocket returns null/undefined after removeRoom', () => {
  createRoom('MAP003', 'sock4', 'Alice', true)
  removeRoom('MAP003')
  expect(getRoomBySocket('sock4')).toBeFalsy()
})

// ── winner uses the stable player id ───────────────────
test('toSnapshot winner is nickname, winnerId is stable player id', () => {
  const room = createRoom('WIN001', 'p1', 'Alice', true)
  addPlayer(room, 'p2', 'Bob')
  room.status = 'finished'
  room.winner = 'p1'
  const snap = toSnapshot(room, 'p1')
  expect(snap.winner).toBe('Alice')    // nickname 用于显示
  expect(snap.winnerId).toBe('p1')
})

test('toSnapshot winner null when no winner', () => {
  const room = createRoom('WIN002', 'p1', 'Alice', true)
  addPlayer(room, 'p2', 'Bob')
  const snap = toSnapshot(room, 'p1')
  expect(snap.winner).toBeNull()
  expect(snap.winnerId).toBeNull()
})

// ── 新增：resetForRematch 清理 turnTimer ────────────────
test('resetForRematch clears turnTimer and resets state', () => {
  const room = createRoom('REM001', 'p1', 'Alice', true)
  addPlayer(room, 'p2', 'Bob')
  room.status = 'finished'
  room.winner = 'p1'
  room.turnTimer = setTimeout(() => {}, 99999)
  resetForRematch(room)
  expect(room.status).toBe('placing')
  expect(room.winner).toBeNull()
  expect(room.turnTimer).toBeNull()
  expect(room.players.every(p => !p?.placingReady)).toBe(true)
})

test('stable player id survives a socket replacement', () => {
  const room = createRoom('REC001', 'socket-old', 'Alice', true, 'stable-alice')
  const deadline = Date.now() + 30000
  markPlayerDisconnected(room, 'socket-old', deadline)

  expect(getRoomBySocket('socket-old')).toBeFalsy()
  expect(getRoomByPlayerId('stable-alice')?.id).toBe('REC001')
  expect(room.players[0].connected).toBe(false)

  bindPlayerSocket(room, 'stable-alice', 'socket-new')
  expect(getRoomBySocket('socket-new')?.id).toBe('REC001')
  expect(room.players[0]).toMatchObject({
    id: 'stable-alice',
    socketId: 'socket-new',
    connected: true,
    disconnectDeadline: null,
  })
})

test('snapshot uses stable ids for turn and winner after reconnect', () => {
  const room = createRoom('REC002', 'socket-a', 'Alice', true, 'stable-a')
  addPlayer(room, 'socket-b', 'Bob', 'stable-b')
  room.status = 'finished'
  room.currentTurn = 'stable-a'
  room.winner = 'stable-a'

  const snapshot = toSnapshot(room, 'stable-b')
  expect(snapshot.currentTurn).toBe('stable-a')
  expect(snapshot.winnerId).toBe('stable-a')
  expect(snapshot.players.map(player => player?.id)).toEqual(['stable-a', 'stable-b'])
})

test('snapshot preserves sunk-ship stats across a refresh', () => {
  const room = createRoom('REC003', 'socket-c', 'Alice', true, 'stable-c')
  addPlayer(room, 'socket-d', 'Bob', 'stable-d')
  room.status = 'playing'
  const opponent = room.players[1]
  if (!opponent) throw new Error('Expected opponent to exist')
  opponent.board = randomPlaceShips(createEmptyBoard())
  const ship = SHIPS[0]
  opponent.board
    .filter(Boolean)
    .flat()
    .filter(cell => cell.shipId === ship.id)
    .forEach(cell => { cell.attacked = true })

  expect(toSnapshot(room, 'stable-c').sunkShipIds).toContain(ship.id)
})
