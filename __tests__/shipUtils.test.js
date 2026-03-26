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
  expect(validateBoard(board)).toBe(true)
})

test('validateBoard rejects board with wrong ship count', () => {
  const board = createEmptyBoard()
  expect(validateBoard(board)).toBe(false)
})

test('validateBoard accepts valid random board', () => {
  const board = randomPlaceShips(createEmptyBoard())
  expect(validateBoard(board)).toBe(true)
})

test('processAttack marks cell as attacked', () => {
  const { processAttack } = require('../lib/shipUtils')
  const board = randomPlaceShips(createEmptyBoard())
  const result = processAttack(board, 0, 0)
  expect(board[0][0].attacked).toBe(true)
  expect(result.alreadyAttacked).toBeUndefined()
})

test('checkAllSunk returns false when ships remain', () => {
  const { checkAllSunk } = require('../lib/shipUtils')
  const board = randomPlaceShips(createEmptyBoard())
  expect(checkAllSunk(board)).toBe(false)
})
