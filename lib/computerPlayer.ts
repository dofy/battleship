import { SHIPS } from './shipUtils.js'
import type { Coordinate, GameBoard } from './types.js'

type RandomSource = () => number

const ORTHOGONAL_STEPS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

function isAvailable(board: GameBoard, row: number, col: number): boolean {
  return row >= 0 && row < 10 && col >= 0 && col < 10 && !board[row][col].attacked
}

function pick(candidates: Coordinate[], random: RandomSource): Coordinate | null {
  if (candidates.length === 0) return null
  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length))
  return candidates[index]
}

function addCandidate(
  board: GameBoard,
  candidates: Coordinate[],
  seen: Set<string>,
  row: number,
  col: number,
): void {
  const key = `${row},${col}`
  if (seen.has(key) || !isAvailable(board, row, col)) return
  seen.add(key)
  candidates.push({ row, col })
}

/**
 * Basic hunt/target Battleship AI. It only uses previous attack outcomes:
 * unresolved hits create adjacent targets, aligned hits narrow the search to
 * that axis, and an empty search falls back to a checkerboard hunt pattern.
 */
export function chooseComputerTarget(board: GameBoard, random: RandomSource = Math.random): Coordinate | null {
  const targets: Coordinate[] = []
  const seenTargets = new Set<string>()

  for (const ship of SHIPS) {
    const shipCells: Coordinate[] = []
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        if (board[row][col].shipId === ship.id) shipCells.push({ row, col })
      }
    }

    const hits = shipCells.filter(({ row, col }) => board[row][col].attacked)
    if (hits.length === 0 || hits.length === shipCells.length) continue

    const sameRow = hits.length > 1 && hits.every(hit => hit.row === hits[0].row)
    const sameCol = hits.length > 1 && hits.every(hit => hit.col === hits[0].col)

    for (const hit of hits) {
      const steps = sameRow
        ? ORTHOGONAL_STEPS.filter(([rowStep]) => rowStep === 0)
        : sameCol
          ? ORTHOGONAL_STEPS.filter(([, colStep]) => colStep === 0)
          : ORTHOGONAL_STEPS
      for (const [rowStep, colStep] of steps) {
        addCandidate(board, targets, seenTargets, hit.row + rowStep, hit.col + colStep)
      }
    }
  }

  const targeted = pick(targets, random)
  if (targeted) return targeted

  const checkerboard: Coordinate[] = []
  const remaining: Coordinate[] = []
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      if (!isAvailable(board, row, col)) continue
      const coordinate = { row, col }
      remaining.push(coordinate)
      if ((row + col) % 2 === 0) checkerboard.push(coordinate)
    }
  }
  return pick(checkerboard.length > 0 ? checkerboard : remaining, random)
}
