import { expect, test } from 'vitest'
import {
  checkAllSunk,
  createEmptyBoard,
  processAttack,
  randomPlaceShips,
  SHIPS,
  validateBoard,
} from '../src/shared/shipUtils'

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

test('randomPlaceShips assigns every ship a stable unique id', () => {
  const board = randomPlaceShips(createEmptyBoard())
  const ids = new Set(board.flat().filter(cell => cell.hasShip).map(cell => cell.shipId))
  expect(ids).toEqual(new Set(SHIPS.map(ship => ship.id)))
})

test('validateBoard rejects malformed and pre-attacked payloads', () => {
  expect(validateBoard(null)).toBe(false)
  expect(validateBoard([])).toBe(false)

  const board = randomPlaceShips(createEmptyBoard())
  board[0][0].attacked = true
  expect(validateBoard(board)).toBe(false)
})

test('processAttack marks cell as attacked', () => {
  const board = randomPlaceShips(createEmptyBoard())
  const result = processAttack(board, 0, 0)
  expect(board[0][0].attacked).toBe(true)
  expect(result.alreadyAttacked).toBeUndefined()
})

test('checkAllSunk returns false when ships remain', () => {
  const board = randomPlaceShips(createEmptyBoard())
  expect(checkAllSunk(board)).toBe(false)
})
