import type { Coordinate, Direction, GameBoard, ShipDefinition } from './types.js'

export const SHIPS = [
  { id: 'carrier',    name: 'Carrier',    size: 5 },
  { id: 'battleship', name: 'Battleship', size: 4 },
  { id: 'cruiser',    name: 'Cruiser',    size: 3 },
  { id: 'destroyer',  name: 'Destroyer',  size: 3 },
  { id: 'submarine',  name: 'Submarine',  size: 2 },
] as const satisfies readonly ShipDefinition[]

export function createEmptyBoard(): GameBoard {
  return Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => ({ hasShip: false, attacked: false }))
  )
}

function cloneBoard(board: GameBoard): GameBoard {
  return board.map(row => row.map(cell => ({ ...cell })))
}

function canPlace(board: GameBoard, row: number, col: number, size: number, dir: Direction): boolean {
  for (let i = 0; i < size; i++) {
    const r = dir === 'H' ? row : row + i
    const c = dir === 'H' ? col + i : col
    if (r < 0 || r >= 10 || c < 0 || c >= 10) return false
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        const nr = r + dr, nc = c + dc
        if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10 && board[nr][nc].hasShip) return false
      }
    }
    if (board[r][c].hasShip) return false
  }
  return true
}

function placeShip(
  board: GameBoard,
  row: number,
  col: number,
  size: number,
  dir: Direction,
  shipId: string,
): void {
  for (let i = 0; i < size; i++) {
    const r = dir === 'H' ? row : row + i
    const c = dir === 'H' ? col + i : col
    board[r][c].hasShip = true
    board[r][c].isBow   = (i === 0)
    board[r][c].isStern = (i === size - 1)
    board[r][c].shipDir = dir
    board[r][c].shipId  = shipId
  }
}

export function randomPlaceShips(board: GameBoard): GameBoard {
  const b = cloneBoard(board)
  for (let attempt = 0; attempt < 3; attempt++) {
    const fresh = cloneBoard(b)
    let ok = true
    for (const ship of SHIPS) {
      let placed = false
      for (let retry = 0; retry < 200; retry++) {
        const dir = Math.random() < 0.5 ? 'H' : 'V'
        const row = Math.floor(Math.random() * 10)
        const col = Math.floor(Math.random() * 10)
        if (canPlace(fresh, row, col, ship.size, dir)) {
          placeShip(fresh, row, col, ship.size, dir, ship.id)
          placed = true
          break
        }
      }
      if (!placed) { ok = false; break }
    }
    if (ok) return fresh
  }
  throw new Error('randomPlaceShips: failed after 3 attempts')
}

export function validateBoard(board: unknown): board is GameBoard {
  if (!Array.isArray(board) || board.length !== 10) return false
  if (!board.every(row => Array.isArray(row) && row.length === 10)) return false
  if (!board.flat().every(cell =>
    cell && typeof cell === 'object'
    && typeof cell.hasShip === 'boolean'
    && cell.attacked === false
  )) return false

  const shipCells = board.flat().filter(c => c.hasShip)
  const total = SHIPS.reduce((s, ship) => s + ship.size, 0)
  if (shipCells.length !== total) return false

  const typedBoard = board as GameBoard
  const visited = Array.from({ length: 10 }, () => Array<boolean>(10).fill(false))
  const groups: Array<Array<[number, number]>> = []

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (typedBoard[r][c].hasShip && !visited[r][c]) {
        const queue: Array<[number, number]> = [[r, c]]
        const group: Array<[number, number]> = []
        while (queue.length) {
          const next = queue.shift()
          if (!next) break
          const [cr, cc] = next
          if (visited[cr][cc]) continue
          visited[cr][cc] = true
          group.push([cr, cc])
          for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
            const nr = cr+dr, nc = cc+dc
            if (nr>=0&&nr<10&&nc>=0&&nc<10&&typedBoard[nr][nc].hasShip&&!visited[nr][nc]) {
              queue.push([nr, nc])
            }
          }
        }
        groups.push(group)
      }
    }
  }

  if (groups.length !== SHIPS.length) return false

  const groupSizes = groups.map(g => g.length).sort((a,b) => b-a)
  const shipSizes  = SHIPS.map(s => s.size).sort((a,b) => b-a)
  if (!groupSizes.every((s, i) => s === shipSizes[i])) return false

  const seenShipIds = new Set()
  for (const group of groups) {
    const ids = new Set(group.map(([r, c]) => typedBoard[r][c].shipId))
    if (ids.size !== 1) return false
    const [shipId] = ids
    const ship = SHIPS.find(item => item.id === shipId)
    if (!ship || ship.size !== group.length || seenShipIds.has(shipId)) return false
    seenShipIds.add(shipId)
  }

  for (const group of groups) {
    const rows = group.map(([r]) => r)
    const cols = group.map(([,c]) => c)
    const isH = rows.every(r => r === rows[0])
    const isV = cols.every(c => c === cols[0])
    if (!isH && !isV) return false
  }

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (!typedBoard[r][c].hasShip) continue
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        const nr = r+dr, nc = c+dc
        if (nr<0||nr>=10||nc<0||nc>=10) continue
        if (!typedBoard[nr][nc].hasShip) continue
        const myGroup = groups.find(g => g.some(([gr,gc]) => gr===r && gc===c))
        const neighborGroup = groups.find(g => g.some(([gr,gc]) => gr===nr && gc===nc))
        if (myGroup !== neighborGroup) return false
      }
    }
  }

  return true
}

export function processAttack(
  board: GameBoard,
  row: number,
  col: number,
): { hit?: boolean; alreadyAttacked?: boolean } {
  const cell = board[row][col]
  if (cell.attacked) return { alreadyAttacked: true }
  cell.attacked = true
  const hit = cell.hasShip
  return { hit }
}

export function checkAllSunk(board: GameBoard): boolean {
  return board.flat().every(c => !c.hasShip || c.attacked)
}

export function findSunkShip(board: GameBoard, row: number, col: number): Coordinate[] | null {
  const queue: Array<[number, number]> = [[row, col]]
  const cells: Coordinate[] = []
  const visited = new Set<string>()
  while (queue.length) {
    const next = queue.shift()
    if (!next) break
    const [r, c] = next
    const key = `${r},${c}`
    if (visited.has(key)) continue
    visited.add(key)
    if (!board[r][c].hasShip) continue
    cells.push({ row: r, col: c })
    for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const nr = r+dr, nc = c+dc
      if (nr>=0&&nr<10&&nc>=0&&nc<10&&board[nr][nc].hasShip) queue.push([nr,nc])
    }
  }
  const allSunk = cells.every(({ row: r, col: c }) => board[r][c].attacked)
  return allSunk ? cells : null
}

export function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
