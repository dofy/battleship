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

function buildBoard(placements) {
  const b = createEmptyBoard()
  for (const { row, col, size, dir } of placements) {
    for (let i = 0; i < size; i++) {
      const r = dir === 'H' ? row : row + i
      const c = dir === 'H' ? col + i : col
      b[r][c].hasShip = true
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

  return (
    <div className="space-y-4">
      {/* 倒计时条 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${secondsLeft > 30 ? 'bg-indigo-500' : 'bg-red-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-sm font-bold font-mono w-12 text-right ${secondsLeft <= 30 ? 'text-red-400' : 'text-gray-300'}`}>
          {secondsLeft}s
        </span>
      </div>

      <div className="flex gap-6 items-start">
        <Board
          board={board}
          onCellClick={handleCellClick}
          interactive={!ready && !allPlaced}
          label="点击棋盘放置舰船"
        />

        <div className="space-y-3 w-44">
          {/* 当前待放置 */}
          {!ready && (
            <div className="p-3 bg-gray-800 border border-gray-700 rounded-lg">
              {currentShip ? (
                <>
                  <div className="text-xs text-indigo-400 font-bold uppercase mb-1">当前放置</div>
                  <div className="text-white font-medium text-sm mb-2">{currentShip.name}</div>
                  <div className="flex gap-0.5 mb-2">
                    {Array.from({ length: currentShip.size }, (_, k) => (
                      <div key={k} className="w-4 h-4 bg-indigo-500 rounded-sm" />
                    ))}
                  </div>
                  <button
                    onClick={() => setDirection(d => d === 'H' ? 'V' : 'H')}
                    className="w-full py-1 text-xs text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                  >
                    方向: {direction === 'H' ? '➡ 水平' : '⬇ 垂直'}
                  </button>
                </>
              ) : (
                <p className="text-green-400 text-sm font-medium">✓ 所有舰船已放置</p>
              )}
            </div>
          )}

          {/* 舰船列表 */}
          <div className="space-y-1">
            {SHIPS.map((s, i) => (
              <div key={i} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md ${
                i === shipIdx    ? 'bg-indigo-900 border border-indigo-600 text-white' :
                i < shipIdx      ? 'text-gray-600 line-through' :
                'text-gray-500'
              }`}>
                <div className="flex gap-0.5">
                  {Array.from({ length: s.size }, (_, k) => (
                    <div key={k} className={`w-2.5 h-2.5 rounded-sm ${i < shipIdx ? 'bg-gray-700' : 'bg-indigo-500'}`} />
                  ))}
                </div>
                {s.name}
              </div>
            ))}
          </div>

          {/* 操作按钮 */}
          <div className="space-y-2">
            <button
              onClick={handleRandom}
              disabled={ready}
              className="w-full py-1.5 text-xs text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition-colors disabled:opacity-40"
            >
              🔀 随机布置
            </button>

            {(placements.length > 0 || isRandom) && !ready && (
              <button
                onClick={handleUndo}
                className="w-full py-1.5 text-xs text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                {isRandom ? '↺ 清空重置' : `↩ 撤销 (${placements.length})`}
              </button>
            )}

            {placements.length > 1 && !isRandom && !ready && (
              <button
                onClick={handleClear}
                className="w-full py-1.5 text-xs text-red-400 bg-red-900 hover:bg-red-800 rounded transition-colors"
              >
                ✕ 清空全部
              </button>
            )}

            {allPlaced && !ready && (
              <button
                onClick={handleSubmit}
                className="w-full py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold transition-colors"
              >
                ✓ 确认布局
              </button>
            )}

            {ready && (
              <p className="text-center text-green-400 text-sm py-1">✓ 等待对手...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
