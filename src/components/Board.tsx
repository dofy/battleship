import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Crosshair } from 'lucide-react'
import type { BoardCell, Coordinate, Direction, GameBoard } from '../shared/types'
import { SHIPS } from '../shared/shipUtils'
import { BoardShip } from './ShipArtwork'
import type { ShipVisualState } from './ShipArtwork'

const COLS = ['A','B','C','D','E','F','G','H','I','J']

export interface AttackMarker extends Coordinate {
  result: 'hit' | 'miss' | null
  ts: number
}

export interface PreviewCell {
  r: number
  c: number
  isBow: boolean
  isStern: boolean
  shipDir: Direction
}

export interface BoardPreview {
  cells: PreviewCell[]
  valid: boolean
  shipId: string
  size: number
}

interface ShipVisual {
  shipId: string
  size: number
  direction: Direction
  state: ShipVisualState
}

interface BoardProps {
  board: GameBoard
  onCellClick?: (row: number, col: number) => void
  interactive?: boolean
  label?: string
  lastAttack?: AttackMarker | null
  onCellHover?: (row: number, col: number) => void
  onBoardLeave?: () => void
  preview?: BoardPreview | null
  sunkCells?: Set<string>
  shake?: number | null
  selectedCell?: Coordinate | null
  pendingCell?: Coordinate | null
  headerAction?: ReactNode
}

function coordinateLabel(row: number, col: number): string {
  return `${COLS[col]}${row + 1}`
}

function Board({
  board, onCellClick, interactive = false, label, lastAttack,
  onCellHover, onBoardLeave, preview, sunkCells, shake, selectedCell, pendingCell, headerAction,
}: BoardProps) {
  const [isShaking, setIsShaking] = useState(false)
  const [focusCell, setFocusCell] = useState({ row: 0, col: 0 })
  const lastShakeRef = useRef<number | null>(null)
  const cellRefs = useRef(new Map<string, HTMLButtonElement>())

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

  const shipVisuals = useMemo(() => {
    const groups = new Map<string, Array<{ row: number; col: number; attacked: boolean }>>()
    board.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
      if (!cell.hasShip || !cell.shipId) return
      const cells = groups.get(cell.shipId) ?? []
      cells.push({ row: rowIndex, col: colIndex, attacked: cell.attacked })
      groups.set(cell.shipId, cells)
    }))

    const visuals = new Map<string, ShipVisual>()
    groups.forEach((cells, shipId) => {
      const definition = SHIPS.find(ship => ship.id === shipId)
      if (!definition || cells.length !== definition.size) return
      const horizontal = cells.every(cell => cell.row === cells[0].row)
      const vertical = cells.every(cell => cell.col === cells[0].col)
      if (!horizontal && !vertical) return
      const direction: Direction = horizontal ? 'H' : 'V'
      const origin = cells.reduce((current, cell) => (
        cell.row < current.row || (cell.row === current.row && cell.col < current.col) ? cell : current
      ))
      const hits = cells.filter(cell => cell.attacked).length
      const state: ShipVisualState = hits === cells.length ? 'sunk' : hits > 0 ? 'damaged' : 'afloat'
      visuals.set(`${origin.row},${origin.col}`, { shipId, size: cells.length, direction, state })
    })
    return visuals
  }, [board])

  function shipShape(cell: Pick<BoardCell, 'hasShip' | 'isBow' | 'isStern' | 'shipDir'>): string {
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

  function cellClass(cell: BoardCell, row: number, col: number): string {
    const isSunk = sunkCells?.has(`${row},${col}`)
    const selected = selectedCell?.row === row && selectedCell?.col === col
    const pending = pendingCell?.row === row && pendingCell?.col === col
    const base = 'board-cell relative flex items-center justify-center overflow-visible rounded-sm border p-0 text-xs font-bold transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 sm:text-sm '
    const selection = selected || pending
      ? ' !border-amber-300 !bg-amber-400/25 z-10 outline outline-2 outline-offset-2 outline-amber-300 shadow-[inset_0_0_12px_rgba(251,191,36,0.35)]'
      : ''
    if (isSunk && cell.attacked && cell.hasShip) return base + 'bg-orange-950 border-orange-700 text-orange-300 cursor-default' + selection
    if (cell.attacked && cell.hasShip) return base + 'bg-red-950 border-red-800 text-red-100 cursor-default' + selection
    if (cell.attacked && !cell.hasShip) return base + 'bg-zinc-800 border-zinc-700 text-zinc-400 cursor-default' + selection
    if (cell.hasShip) return base + 'bg-zinc-900 border-zinc-800 cursor-default' + selection
    if (interactive) return base + 'bg-zinc-900 border-zinc-800 cursor-crosshair hover:bg-zinc-700 hover:border-sky-500 active:bg-sky-950' + selection
    return base + 'bg-zinc-900 border-zinc-800 cursor-default' + selection
  }

  function previewClass(previewCell: PreviewCell, valid: boolean): string {
    const shape = shipShape({
      hasShip: true,
      isBow: previewCell.isBow,
      isStern: previewCell.isStern,
      shipDir: previewCell.shipDir,
    })
    const color = valid
      ? 'bg-teal-600/40 border-teal-400/60'
      : 'bg-red-600/40 border-red-400/60'
    return `board-cell border ${shape} ${color} flex items-center justify-center relative overflow-visible transition-colors`
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, row: number, col: number): void {
    const moves: Record<string, readonly [number, number]> = {
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
      {label && (
        <div className={`mx-auto mb-2 flex min-h-11 w-full max-w-[30rem] items-center gap-3 ${headerAction ? 'justify-between' : 'justify-center'}`}>
          <h2 className={`text-sm tracking-wide text-zinc-400 ${headerAction ? 'min-w-0 truncate text-left' : 'text-center'}`}>
            {label}
          </h2>
          {headerAction}
        </div>
      )}
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
                const shipVisual = shipVisuals.get(key)
                const previewVisual = previewCell?.isBow && preview && preview.cells.length === preview.size
                const isTarget = lastAttack?.row === rowIndex && lastAttack?.col === colIndex && lastAttack.result
                const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex
                const isPending = pendingCell?.row === rowIndex && pendingCell?.col === colIndex
                const isHighlighted = isSelected || isPending
                const cellLabel = `${coordinateLabel(rowIndex, colIndex)}, ${cell.attacked ? (cell.hasShip ? 'hit' : 'miss') : isPending ? 'shot fired; awaiting result' : isSelected ? 'target locked; activate again to fire' : 'not attacked'}`
                const content = (
                  <>
                    {shipVisual && (
                      <BoardShip
                        shipId={shipVisual.shipId}
                        size={shipVisual.size}
                        direction={shipVisual.direction}
                        state={shipVisual.state}
                      />
                    )}
                    {previewVisual && (
                      <BoardShip
                        shipId={preview.shipId}
                        size={preview.size}
                        direction={previewCell.shipDir}
                        state={preview.valid ? 'preview' : 'invalid'}
                      />
                    )}
                    {!previewCell && cell.attacked && cell.hasShip && <span aria-hidden="true" className="relative z-10">●</span>}
                    {!previewCell && cell.attacked && !cell.hasShip && <span aria-hidden="true" className="relative z-10 text-zinc-400">·</span>}
                    {isHighlighted && !cell.attacked && !previewCell && (
                      <Crosshair
                        aria-hidden="true"
                        className="target-lock-marker relative z-20 size-5 text-amber-200 drop-shadow-[0_0_5px_rgba(253,230,138,0.95)]"
                        strokeWidth={2.75}
                      />
                    )}
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
                      ref={node => {
                        if (node) cellRefs.current.set(key, node)
                        else cellRefs.current.delete(key)
                      }}
                      key={colIndex}
                      type="button"
                      role="gridcell"
                      aria-label={cellLabel}
                      aria-selected={isHighlighted}
                      tabIndex={focusCell.row === rowIndex && focusCell.col === colIndex ? 0 : -1}
                      className={previewCell ? previewClass(previewCell, preview?.valid ?? false) : cellClass(cell, rowIndex, colIndex)}
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
                    className={previewCell ? previewClass(previewCell, preview?.valid ?? false) : cellClass(cell, rowIndex, colIndex)}
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
