import { expect, test } from 'vitest'
import { chooseComputerTarget } from '../lib/computerPlayer'
import { createEmptyBoard } from '../lib/shipUtils'
import type { GameBoard } from '../lib/types'

function placeHorizontalShip(board: GameBoard, shipId: string, row: number, col: number, size: number): void {
  for (let offset = 0; offset < size; offset++) {
    board[row][col + offset] = {
      hasShip: true,
      attacked: false,
      shipId,
      shipDir: 'H',
      isBow: offset === 0,
      isStern: offset === size - 1,
    }
  }
}

test('computer hunts on the checkerboard when it has no hit to follow', () => {
  const board = createEmptyBoard()
  expect(chooseComputerTarget(board, () => 0)).toEqual({ row: 0, col: 0 })
})

test('computer targets an available neighbor after a hit', () => {
  const board = createEmptyBoard()
  placeHorizontalShip(board, 'carrier', 5, 4, 5)
  board[5][5].attacked = true

  const target = chooseComputerTarget(board, () => 0)
  expect(target).toEqual({ row: 4, col: 5 })
  expect(Math.abs(target!.row - 5) + Math.abs(target!.col - 5)).toBe(1)
})

test('computer follows the axis after two aligned hits', () => {
  const board = createEmptyBoard()
  placeHorizontalShip(board, 'battleship', 4, 3, 4)
  board[4][4].attacked = true
  board[4][5].attacked = true

  expect(chooseComputerTarget(board, () => 0)).toEqual({ row: 4, col: 3 })
  expect(chooseComputerTarget(board, () => 0.99)).toEqual({ row: 4, col: 6 })
})

test('computer stops following a ship after it has sunk', () => {
  const board = createEmptyBoard()
  placeHorizontalShip(board, 'submarine', 5, 4, 2)
  board[5][4].attacked = true
  board[5][5].attacked = true

  expect(chooseComputerTarget(board, () => 0)).toEqual({ row: 0, col: 0 })
})

test('computer never repeats an attacked sector and returns null when none remain', () => {
  const board = createEmptyBoard()
  board.forEach(row => row.forEach(cell => { cell.attacked = true }))
  board[9][9].attacked = false
  expect(chooseComputerTarget(board, () => 0.5)).toEqual({ row: 9, col: 9 })

  board[9][9].attacked = true
  expect(chooseComputerTarget(board)).toBeNull()
})
