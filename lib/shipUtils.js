const SHIPS = [
  { name: '航空母舰', size: 5 },
  { name: '战列舰',   size: 4 },
  { name: '巡洋舰',   size: 3 },
  { name: '驱逐舰',   size: 3 },
  { name: '潜水艇',   size: 2 },
]

function createEmptyBoard() {
  return Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => ({ hasShip: false, attacked: false }))
  )
}

function cloneBoard(board) {
  return board.map(row => row.map(cell => ({ ...cell })))
}

function canPlace(board, row, col, size, dir) {
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

function placeShip(board, row, col, size, dir) {
  for (let i = 0; i < size; i++) {
    const r = dir === 'H' ? row : row + i
    const c = dir === 'H' ? col + i : col
    board[r][c].hasShip = true
    board[r][c].isBow   = (i === 0)
    board[r][c].isStern = (i === size - 1)
    board[r][c].shipDir = dir
  }
}

function randomPlaceShips(board) {
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
          placeShip(fresh, row, col, ship.size, dir)
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

function validateBoard(board) {
  const shipCells = board.flat().filter(c => c.hasShip)
  const total = SHIPS.reduce((s, ship) => s + ship.size, 0)
  if (shipCells.length !== total) return false

  const visited = Array.from({ length: 10 }, () => Array(10).fill(false))
  const groups = []

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (board[r][c].hasShip && !visited[r][c]) {
        const queue = [[r, c]]
        const group = []
        while (queue.length) {
          const [cr, cc] = queue.shift()
          if (visited[cr][cc]) continue
          visited[cr][cc] = true
          group.push([cr, cc])
          for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
            const nr = cr+dr, nc = cc+dc
            if (nr>=0&&nr<10&&nc>=0&&nc<10&&board[nr][nc].hasShip&&!visited[nr][nc]) {
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

  for (const group of groups) {
    const rows = group.map(([r]) => r)
    const cols = group.map(([,c]) => c)
    const isH = rows.every(r => r === rows[0])
    const isV = cols.every(c => c === cols[0])
    if (!isH && !isV) return false
  }

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (!board[r][c].hasShip) continue
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        const nr = r+dr, nc = c+dc
        if (nr<0||nr>=10||nc<0||nc>=10) continue
        if (!board[nr][nc].hasShip) continue
        const myGroup = groups.find(g => g.some(([gr,gc]) => gr===r && gc===c))
        const neighborGroup = groups.find(g => g.some(([gr,gc]) => gr===nr && gc===nc))
        if (myGroup !== neighborGroup) return false
      }
    }
  }

  return true
}

function processAttack(board, row, col) {
  const cell = board[row][col]
  if (cell.attacked) return { alreadyAttacked: true }
  cell.attacked = true
  const hit = cell.hasShip
  return { hit }
}

function checkAllSunk(board) {
  return board.flat().every(c => !c.hasShip || c.attacked)
}

function findSunkShip(board, row, col) {
  const queue = [[row, col]]
  const cells = []
  const visited = new Set()
  while (queue.length) {
    const [r, c] = queue.shift()
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

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

module.exports = {
  SHIPS,
  createEmptyBoard,
  randomPlaceShips,
  validateBoard,
  processAttack,
  checkAllSunk,
  findSunkShip,
  generateRoomId,
}
