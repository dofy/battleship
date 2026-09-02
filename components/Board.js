import { memo, useEffect, useMemo, useRef, useState } from 'react'

const COLS = ['A','B','C','D','E','F','G','H','I','J']

function coordinateLabel(row, col) {
  return `${COLS[col]}${row + 1}`
}

function Board({
  board, onCellClick, interactive = false, label, lastAttack,
  onCellHover, onBoardLeave, preview, sunkCells, shake, selectedCell,
}) {
  const [isShaking, setIsShaking] = useState(false)
  const [focusCell, setFocusCell] = useState({ row: 0, col: 0 })
  const lastShakeRef = useRef(null)
  const cellRefs = useRef(new Map())

  useEffect(() => {
    if (shake && shake !== lastShakeRef.current) {
      lastShakeRef.current = shake
      setIsShaking(true)
    }
  }, [shake])

  useEffect(() => {
    if (!interactive || !board[focusCell.row]?.[focusCell.col]?.attacked) return
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        if (!board[row][col].attacked) {
          setFocusCell({ row, col })
          return
        }
      }
    }
  }, [board, focusCell.col, focusCell.row, interactive])

  const previewMap = useMemo(() => preview
    ? new Map(preview.cells.map(cell => [`${cell.r},${cell.c}`, cell]))
    : null
  , [preview])

  function shipShape(cell) {
    if (!cell.hasShip) return 'rounded-sm'
    if (!cell.isBow && !cell.isStern) return 'rounded-none'
    if (cell.shipDir === 'H') {
      if (cell.isBow) return 'rounded-l-full rounded-r-none'
      if (cell.isStern) return 'rounded-r-lg rounded-l-none'
    } else {
      if (cell.isBow) return 'rounded-t-full rounded-b-none'
      if (cell.isStern) return 'rounded-b-lg rounded-t-none'
    }
    return 'rounded-sm'
  }

  function cellClass(cell, row, col) {
    const isSunk = sunkCells?.has(`${row},${col}`)
    const selected = selectedCell?.row === row && selectedCell?.col === col
    const base = `board-cell border ${shipShape(cell)} flex items-center justify-center text-xs sm:text-sm font-bold transition-colors relative overflow-visible p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:z-10 `
    const selection = selected ? ' ring-2 ring-sky-300 ring-offset-2 ring-offset-zinc-950 z-10 sonar-target' : ''
    if (isSunk && cell.attacked && cell.hasShip) return base + 'bg-orange-950 border-orange-700 text-orange-300 cursor-default' + selection
    if (cell.attacked && cell.hasShip) return base + 'bg-red-800 border-red-700 text-red-100 cursor-default' + selection
    if (cell.attacked && !cell.hasShip) return base + 'bg-zinc-800 border-zinc-700 text-zinc-400 cursor-default' + selection
    if (cell.hasShip) return base + 'bg-teal-800 border-zinc-800 cursor-default' + selection
    if (interactive) return base + 'bg-zinc-900 border-zinc-800 cursor-crosshair hover:bg-zinc-700 hover:border-sky-500 active:bg-sky-950' + selection
    return base + 'bg-zinc-900 border-zinc-800 cursor-default' + selection
  }

  function previewClass(previewCell) {
    const shape = shipShape({
      hasShip: true,
      isBow: previewCell.isBow,
      isStern: previewCell.isStern,
      shipDir: previewCell.shipDir,
    })
    const color = preview.valid
      ? 'bg-teal-600/40 border-teal-400/60'
      : 'bg-red-600/40 border-red-400/60'
    return `board-cell border ${shape} ${color} flex items-center justify-center relative overflow-visible transition-colors`
  }

  function handleKeyDown(event, row, col) {
    const moves = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    let nextRow = row
    let nextCol = col
    for (let step = 0; step < 10; step++) {
      nextRow = Math.max(0, Math.min(9, nextRow + move[0]))
      nextCol = Math.max(0, Math.min(9, nextCol + move[1]))
      const target = cellRefs.current.get(`${nextRow},${nextCol}`)
      if (target) {
        setFocusCell({ row: nextRow, col: nextCol })
        target.focus()
        return
      }
      if (nextRow === 0 || nextRow === 9 || nextCol === 0 || nextCol === 9) return
    }
  }

  return (
    <section className="board-section w-full max-w-full overflow-x-auto pb-1 text-center">
      {label && <h2 className="text-sm text-zinc-400 text-center mb-2 tracking-wide">{label}</h2>}
      <div
        className={`board-shell inline-block p-1.5 sm:p-2 bg-zinc-900 border border-zinc-700 rounded-lg ${isShaking ? 'shake-board' : ''}`}
        onMouseLeave={onBoardLeave}
        onAnimationEnd={() => setIsShaking(false)}
        style={{ touchAction: 'manipulation' }}
      >
        <div className="flex ml-6 sm:ml-7 mb-0.5" aria-hidden="true">
          {COLS.map(col => (
            <div key={col} className="column-label text-center text-xs text-zinc-400 font-mono">{col}</div>
          ))}
        </div>
        <div role="grid" aria-label={label || 'Battleship grid'}>
          {board.map((row, rowIndex) => (
            <div key={rowIndex} role="row" className="flex items-center">
              <div aria-hidden="true" className="w-6 sm:w-7 text-xs text-zinc-400 text-right pr-1 font-mono">
                {rowIndex + 1}
              </div>
              {row.map((cell, colIndex) => {
                const key = `${rowIndex},${colIndex}`
                const previewCell = previewMap?.get(key)
                const isTarget = lastAttack?.row === rowIndex && lastAttack?.col === colIndex && lastAttack.result
                const cellLabel = `${coordinateLabel(rowIndex, colIndex)}, ${cell.attacked ? (cell.hasShip ? 'hit' : 'miss') : 'not attacked'}`
                const content = (
                  <>
                    {!previewCell && cell.attacked && cell.hasShip && <span aria-hidden="true">●</span>}
                    {!previewCell && cell.attacked && !cell.hasShip && <span aria-hidden="true" className="text-zinc-400">·</span>}
                    {isTarget && lastAttack.result === 'hit' && (
                      <div key={`hfx-${lastAttack.ts}`} className="hit-fx" aria-hidden="true">💥</div>
                    )}
                    {isTarget && lastAttack.result === 'miss' && (
                      <div key={`mfx-${lastAttack.ts}`} className="miss-ring" aria-hidden="true" />
                    )}
                  </>
                )

                if (interactive && !cell.attacked) {
                  return (
                    <button
                      ref={node => node ? cellRefs.current.set(key, node) : cellRefs.current.delete(key)}
                      key={colIndex}
                      type="button"
                      role="gridcell"
                      aria-label={cellLabel}
                      aria-selected={selectedCell?.row === rowIndex && selectedCell?.col === colIndex}
                      tabIndex={focusCell.row === rowIndex && focusCell.col === colIndex ? 0 : -1}
                      className={previewCell ? previewClass(previewCell) : cellClass(cell, rowIndex, colIndex)}
                      onFocus={() => setFocusCell({ row: rowIndex, col: colIndex })}
                      onKeyDown={event => handleKeyDown(event, rowIndex, colIndex)}
                      onClick={() => onCellClick?.(rowIndex, colIndex)}
                      onMouseEnter={() => onCellHover?.(rowIndex, colIndex)}
                    >
                      {content}
                    </button>
                  )
                }

                return (
                  <div
                    key={colIndex}
                    role="gridcell"
                    aria-label={cellLabel}
                    className={previewCell ? previewClass(previewCell) : cellClass(cell, rowIndex, colIndex)}
                    onMouseEnter={() => onCellHover?.(rowIndex, colIndex)}
                  >
                    {content}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default memo(Board)
