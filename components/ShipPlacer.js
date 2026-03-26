// components/ShipPlacer.js
import { useState, useEffect, useCallback } from 'react'
import Board from './Board'

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

export default function ShipPlacer({ placingDeadline, onSubmit, onRandom }) {
  const [board, setBoard]         = useState(createEmptyBoard)
  const [shipIdx, setShipIdx]     = useState(0)
  const [direction, setDirection] = useState('H')
  const [secondsLeft, setSeconds] = useState(90)
  const [ready, setReady]         = useState(false)

  // 倒计时
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

  function handleCellClick(row, col) {
    if (ready || shipIdx >= SHIPS.length) return
    const { size } = SHIPS[shipIdx]
    if (!canPlace(board, row, col, size, direction)) return
    const next = board.map(r => r.map(c => ({ ...c })))
    for (let i = 0; i < size; i++) {
      const r = direction === 'H' ? row : row + i
      const c = direction === 'H' ? col + i : col
      next[r][c].hasShip = true
    }
    setBoard(next)
    setShipIdx(idx => idx + 1)
  }

  function handleRandom() {
    const randomBoard = onRandom()
    setBoard(randomBoard)
    setShipIdx(SHIPS.length)
  }

  function handleSubmit() {
    setReady(true)
    onSubmit(board)
  }

  const pct = placingDeadline ? Math.max(0, (secondsLeft / 90) * 100) : 100

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-400">点击棋盘放置舰船</span>
        <span className="text-xl font-bold text-yellow-400">⏱ {secondsLeft}s</span>
      </div>
      <div className="h-1.5 bg-blue-950 rounded overflow-hidden">
        <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all"
             style={{ width: `${pct}%` }} />
      </div>

      <div className="flex gap-6">
        <Board board={board} onCellClick={handleCellClick} interactive={!ready && shipIdx < SHIPS.length} label="我的棋盘" />

        <div className="space-y-3 min-w-40">
          <div className="text-xs text-indigo-400 font-bold uppercase">舰船列表</div>
          {SHIPS.map((s, i) => (
            <div key={i} className={`flex items-center gap-2 text-sm rounded px-2 py-1 ${i === shipIdx ? 'bg-indigo-900 border border-indigo-500 text-white' : i < shipIdx ? 'text-gray-600 line-through' : 'text-gray-400'}`}>
              <div className="flex gap-0.5">
                {Array.from({ length: s.size }, (_, k) => (
                  <div key={k} className={`w-3 h-3 rounded-sm ${i < shipIdx ? 'bg-gray-600' : 'bg-indigo-500'}`} />
                ))}
              </div>
              {s.name}
            </div>
          ))}

          <button onClick={() => setDirection(d => d === 'H' ? 'V' : 'H')}
                  className="w-full py-1 text-sm text-gray-400 bg-gray-800 rounded">
            方向: {direction === 'H' ? '水平' : '垂直'}
          </button>
          <button onClick={handleRandom}
                  className="w-full py-1 text-sm text-gray-400 bg-gray-800 rounded">
            🔀 随机布置
          </button>
          {shipIdx >= SHIPS.length && !ready && (
            <button onClick={handleSubmit}
                    className="w-full py-2 text-sm text-white bg-indigo-600 rounded font-bold">
              ✓ 确认布局
            </button>
          )}
          {ready && <p className="text-green-400 text-sm">✓ 等待对手...</p>}
        </div>
      </div>
    </div>
  )
}
