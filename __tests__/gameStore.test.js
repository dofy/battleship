const { createRoom, getRoom, addPlayer, removeRoom, getPublicWaitingRooms, toSnapshot, getAllRooms } = require('../lib/gameStore')

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
  // 给 p2 设置一个有船的棋盘
  room.players[1].board[0][0].hasShip = true
  const snap = toSnapshot(room, 'p1')
  // p1 看到的 p2 棋盘中 hasShip 应全为 false
  const opponentBoard = snap.players.find(p => p?.id === 'p2').board
  expect(opponentBoard[0][0].hasShip).toBe(false)
})

test('toSnapshot reveals hasShip on attacked opponent cells during playing', () => {
  const room = createRoom('SNAP03', 'p1', 'Alice', true)
  addPlayer(room, 'p2', 'Bob')
  room.status = 'playing'
  // [0][0] 有船且已被攻击 → 应暴露
  room.players[1].board[0][0].hasShip  = true
  room.players[1].board[0][0].attacked = true
  // [0][1] 有船但未被攻击 → 仍隐藏
  room.players[1].board[0][1].hasShip  = true
  room.players[1].board[0][1].attacked = false
  const snap = toSnapshot(room, 'p1')
  const opponentBoard = snap.players.find(p => p?.id === 'p2').board
  expect(opponentBoard[0][0].hasShip).toBe(true)   // 已攻击 → 暴露
  expect(opponentBoard[0][1].hasShip).toBe(false)  // 未攻击 → 隐藏
})

test('toSnapshot reveals opponent hasShip after finished', () => {
  const room = createRoom('SNAP02', 'p1', 'Alice', true)
  addPlayer(room, 'p2', 'Bob')
  room.status = 'finished'
  room.players[1].board[0][0].hasShip = true
  const snap = toSnapshot(room, 'p1')
  const opponentBoard = snap.players.find(p => p?.id === 'p2').board
  expect(opponentBoard[0][0].hasShip).toBe(true)
})

test('getAllRooms returns all rooms', () => {
  createRoom('ALL001', 'p1', 'Alice', true)
  const all = getAllRooms()
  expect(all.some(r => r.id === 'ALL001')).toBe(true)
})
