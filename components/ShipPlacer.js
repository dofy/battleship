// components/ShipPlacer.js
import { useState, useEffect, useCallback } from 'react'
import Board from './Board'

const SHIPS = [
  { name: 'Carrier',    size: 5 },
  { name: 'Battleship', size: 4 },
  { name: 'Cruiser',    size: 3 },
  { name: 'Destroyer',  size: 3 },
  { name: 'Submarine',  size: 2 },
]

function createEmptyBoard() {
  return Array.from({ length: 10 }, () =>
    Array.from({ length: 10 }, () => ({ hasShip: false, attacked: false }))
  )
}

function buildBoard(placements) {
  const b = createEmptyBoard()
  for (const { row, col, size, dir } of placements) {
    for (let i = 0; i < size; i++) {
      const r = dir === 'H' ? row : row + i
      const c = dir === 'H' ? col + i : col
      b[r][c].hasShip = true
      b[r][c].isBow   = (i === 0)
      b[r][c].isStern = (i === size - 1)
      b[r][c].shipDir = dir
    }
  }
  return b
}

export default function ShipPlacer({ placingDeadline, onSubmit, onRandom }) {
  const [placements, setPlacements] = useState([])
  const [board, setBoard]           = useState(createEmptyBoard)
  const [isRandom, setIsRandom]     = useState(false)
  const [direction, setDirection]   = useState('H')
  const [secondsLeft, setSeconds]   = useState(90)
  const [ready, setReady]           = useState(false)
  const [hoverCell, setHoverCell]   = useState(null)

  const shipIdx = isRandom ? SHIPS.length : placements.length

  useEffect(() => {
    if (!placingDeadline) return
    const tick = () => {
      const s = Math.max(0, Math.round((placingDeadline - Date.now()) / 1000))
      setSeconds(s)
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [placingDeadline])

  // Toggle direction with Space key
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && !ready && shipIdx < SHIPS.length) {
        e.preventDefault()
        setDirection(d => d === 'H' ? 'V' : 'H')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ready, shipIdx])

  const canPlace = useCallback((b, row, col, size, dir) => {
    for (let i = 0; i < size; i++) {
      const r = dir === 'H' ? row : row + i
      const c = dir === 'H' ? col + i : col
      if (r < 0 || r >= 10 || c < 0 || c >= 10) return false
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r+dr, nc = c+dc
        if (nr>=0&&nr<10&&nc>=0&&nc<10&&b[nr][nc].hasShip) return false
      }
    }
    return true
  }, [])

  function getPreview() {
    if (ready || shipIdx >= SHIPS.length || !hoverCell) return null
    const { size } = SHIPS[shipIdx]
    const cells = []
    let outOfBounds = false
    for (let i = 0; i < size; i++) {
      const r = direction === 'H' ? hoverCell.row : hoverCell.row + i
      const c = direction === 'H' ? hoverCell.col + i : hoverCell.col
      if (r < 0 || r >= 10 || c < 0 || c >= 10) { outOfBounds = true; continue }
      cells.push({ r, c, isBow: i === 0, isStern: i === size - 1, shipDir: direction })
    }
    if (outOfBounds) return { cells, valid: false }
    const valid = canPlace(board, hoverCell.row, hoverCell.col, size, direction)
    return { cells, valid }
  }

  function handleCellClick(row, col) {
    if (ready || shipIdx >= SHIPS.length) return
    const { size } = SHIPS[shipIdx]
    if (!canPlace(board, row, col, size, direction)) return
    const newPlacements = [...placements, { row, col, size, dir: direction }]
    setPlacements(newPlacements)
    setBoard(buildBoard(newPlacements))
  }

  function handleUndo() {
    if (isRandom) { handleClear(); return }
    if (placements.length === 0) return
    const newPlacements = placements.slice(0, -1)
    setPlacements(newPlacements)
    setBoard(buildBoard(newPlacements))
  }

  function handleClear() {
    setPlacements([])
    setBoard(createEmptyBoard())
    setIsRandom(false)
  }

  function handleRandom() {
    const randomBoard = onRandom()
    setBoard(randomBoard)
    setPlacements([])
    setIsRandom(true)
  }

  function handleSubmit() {
    setReady(true)
    onSubmit(board)
  }

  const pct = placingDeadline ? Math.max(0, (secondsLeft / 90) * 100) : 100
  const allPlaced = shipIdx >= SHIPS.length
  const currentShip = !allPlaced ? SHIPS[shipIdx] : null
  const preview = getPreview()

  return (
    <div className="w-full space-y-4">
      {/* Placement countdown */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${secondsLeft > 30 ? 'bg-sky-600' : 'bg-red-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-sm font-bold font-mono w-12 text-right ${secondsLeft <= 30 ? 'text-red-400' : 'text-zinc-300'}`}>
          {secondsLeft}s
        </span>
      </div>

      <div className="flex flex-col items-center gap-4">
        {/* Board */}
        <div>
          <Board
            board={board}
            onCellClick={handleCellClick}
            onCellHover={(r, c) => !ready && !allPlaced && setHoverCell({ row: r, col: c })}
            onBoardLeave={() => setHoverCell(null)}
            preview={(!ready && !allPlaced) ? preview : null}
            interactive={!ready && !allPlaced}
            label="Click grid to place ships"
          />
          {/* Invalid placement notice — reserved height to prevent layout shift */}
          <div className="h-5 mt-1">
            {hoverCell && preview && !preview.valid && !ready && !allPlaced && (
              <p className="text-red-400 text-xs tracking-wide text-center">
                ⚠ Cannot place here
              </p>
            )}
          </div>
        </div>

        {/* Controls panel — horizontal on mobile, compact */}
        <div className="w-full max-w-sm space-y-3">

          {/* Current ship + direction */}
          {!ready && currentShip && (
            <div className="flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-700 rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-sky-400 font-bold uppercase tracking-widest mb-1">Placing</div>
                <div className="text-zinc-100 font-medium text-sm">{currentShip.name}</div>
                <div className="flex gap-0.5 mt-1.5">
                  {Array.from({ length: currentShip.size }, (_, k) => (
                    <div key={k} className={`h-3.5 bg-teal-600 ${
                      k === 0                          ? 'w-3.5 rounded-l-full rounded-r-none'
                      : k === currentShip.size - 1    ? 'w-3.5 rounded-r rounded-l-none'
                      : 'w-3.5 rounded-none'
                    }`} />
                  ))}
                </div>
              </div>
              <button
                onClick={() => setDirection(d => d === 'H' ? 'V' : 'H')}
                className="flex flex-col items-center gap-1 px-4 py-2.5 text-xs text-zinc-300 bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 rounded-lg transition-colors flex-shrink-0"
              >
                <span className={`text-lg leading-none transition-transform duration-200 ${direction === 'V' ? 'rotate-90' : ''}`}>
                  ➔
                </span>
                <span className="tracking-widest">{direction === 'H' ? 'H' : 'V'}</span>
              </button>
            </div>
          )}

          {!ready && allPlaced && (
            <div className="flex items-center gap-2 p-3 bg-zinc-900 border border-zinc-700 rounded-lg">
              <span className="text-emerald-400 text-sm font-medium">✓ Fleet ready</span>
            </div>
          )}

          {/* Ship list — horizontal scroll on mobile */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {SHIPS.map((s, i) => (
              <div key={i} className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md whitespace-nowrap flex-shrink-0 ${
                i === shipIdx ? 'bg-sky-950 border border-sky-700 text-zinc-100' :
                i < shipIdx   ? 'text-zinc-600 line-through bg-zinc-900' :
                'text-zinc-500 bg-zinc-900'
              }`}>
                <div className="flex gap-0.5">
                  {Array.from({ length: s.size }, (_, k) => (
                    <div key={k} className={`w-2 h-2 rounded-sm ${i < shipIdx ? 'bg-zinc-700' : 'bg-teal-600'}`} />
                  ))}
                </div>
                {s.name}
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleRandom}
              disabled={ready}
              className="flex-1 py-3 text-sm text-zinc-300 bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 rounded-lg transition-colors disabled:opacity-40"
            >
              🔀 Random
            </button>

            {(placements.length > 0 || isRandom) && !ready && (
              <button
                onClick={handleUndo}
                className="flex-1 py-3 text-sm text-zinc-300 bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 rounded-lg transition-colors"
              >
                {isRandom ? '↺ Clear' : `↩ Undo`}
              </button>
            )}

            {placements.length > 1 && !isRandom && !ready && (
              <button
                onClick={handleClear}
                className="flex-1 py-3 text-sm text-red-400 bg-red-950 hover:bg-red-900 active:bg-red-800 rounded-lg transition-colors"
              >
                ✕ Clear
              </button>
            )}
          </div>

          {allPlaced && !ready && (
            <button
              onClick={handleSubmit}
              className="w-full py-3.5 text-sm text-zinc-100 bg-sky-700 hover:bg-sky-600 active:bg-sky-800 rounded-lg font-bold tracking-widest transition-colors"
            >
              ✓ CONFIRM FLEET
            </button>
          )}

          {ready && (
            <p className="text-center text-emerald-400 text-sm py-2">✓ Awaiting opponent...</p>
          )}
        </div>
      </div>
    </div>
  )
}
