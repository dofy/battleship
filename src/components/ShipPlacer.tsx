import { useState, useEffect, useCallback, useRef } from 'react'
import { Check, RotateCw, Shuffle, Trash2, Undo2 } from 'lucide-react'
import Board from './Board'
import type { BoardPreview } from './Board'
import { ShipArtwork } from './ShipArtwork'
import { createEmptyBoard, SHIPS } from '../shared/shipUtils'
import type { Direction, GameBoard } from '../shared/types'
import { Button } from './ui/button'

interface Placement {
  row: number
  col: number
  size: number
  dir: Direction
  shipId: string
}

interface ShipPlacerProps {
  placingDeadline: number | null
  onSubmit: (board: GameBoard) => void
  onRandom: () => GameBoard
}

function buildBoard(placements: Placement[]): GameBoard {
  const b = createEmptyBoard()
  for (const { row, col, size, dir, shipId } of placements) {
    for (let i = 0; i < size; i++) {
      const r = dir === 'H' ? row : row + i
      const c = dir === 'H' ? col + i : col
      b[r][c].hasShip = true
      b[r][c].isBow   = (i === 0)
      b[r][c].isStern = (i === size - 1)
      b[r][c].shipDir = dir
      b[r][c].shipId  = shipId
    }
  }
  return b
}

function PlacementCountdown({ deadline }: { deadline: number | null }) {
  const [secondsLeft, setSeconds] = useState(90)

  useEffect(() => {
    if (!deadline) return
    const tick = () => setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [deadline])

  const progress = deadline ? Math.max(0, secondsLeft / 90) : 1
  return (
    <div aria-label={`Placement time remaining: ${secondsLeft} seconds`}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-400">General quarters · Deploy fleet</span>
        <span className={`w-12 text-right font-mono text-sm font-bold tabular-nums ${secondsLeft <= 30 ? 'text-red-300' : 'text-zinc-200'}`}>
          {secondsLeft}s
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full origin-left rounded-full transition-transform duration-500 ${secondsLeft > 30 ? 'bg-sky-600' : 'bg-red-500'}`}
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </div>
  )
}

export default function ShipPlacer({ placingDeadline, onSubmit, onRandom }: ShipPlacerProps) {
  const [placements, setPlacements] = useState<Placement[]>([])
  const [board, setBoard]           = useState<GameBoard>(createEmptyBoard)
  const [isRandom, setIsRandom]     = useState(false)
  const [direction, setDirection]   = useState<Direction>('H')
  const [ready, setReady]           = useState(false)
  const [hoverCell, setHoverCell]   = useState<{ row: number; col: number } | null>(null)
  const shipListRef                 = useRef<HTMLDivElement | null>(null)

  const shipIdx = isRandom ? SHIPS.length : placements.length

  // Keep the active ship fully visible without moving the surrounding page.
  useEffect(() => {
    if (shipIdx >= SHIPS.length) return undefined

    const frame = window.requestAnimationFrame(() => {
      const list = shipListRef.current
      const currentShipItem = list?.querySelector<HTMLElement>('[aria-current="step"]')
      if (!list || !currentShipItem) return

      const listRect = list.getBoundingClientRect()
      const itemRect = currentShipItem.getBoundingClientRect()
      const edgePadding = 8
      let targetLeft = list.scrollLeft

      if (itemRect.left < listRect.left + edgePadding) {
        targetLeft -= listRect.left + edgePadding - itemRect.left
      } else if (itemRect.right > listRect.right - edgePadding) {
        targetLeft += itemRect.right - (listRect.right - edgePadding)
      } else {
        return
      }

      const maxScrollLeft = list.scrollWidth - list.clientWidth
      list.scrollTo({
        left: Math.max(0, Math.min(targetLeft, maxScrollLeft)),
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [shipIdx])

  // Toggle direction with Space key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !ready && shipIdx < SHIPS.length) {
        e.preventDefault()
        setDirection(d => d === 'H' ? 'V' : 'H')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ready, shipIdx])

  const canPlace = useCallback((b: GameBoard, row: number, col: number, size: number, dir: Direction): boolean => {
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

  function getPreview(): BoardPreview | null {
    if (ready || shipIdx >= SHIPS.length || !hoverCell) return null
    const { size } = SHIPS[shipIdx]
    const cells: BoardPreview['cells'] = []
    let outOfBounds = false
    for (let i = 0; i < size; i++) {
      const r = direction === 'H' ? hoverCell.row : hoverCell.row + i
      const c = direction === 'H' ? hoverCell.col + i : hoverCell.col
      if (r < 0 || r >= 10 || c < 0 || c >= 10) { outOfBounds = true; continue }
      cells.push({ r, c, isBow: i === 0, isStern: i === size - 1, shipDir: direction })
    }
    if (outOfBounds) return { cells, valid: false, shipId: SHIPS[shipIdx].id, size }
    const valid = canPlace(board, hoverCell.row, hoverCell.col, size, direction)
    return { cells, valid, shipId: SHIPS[shipIdx].id, size }
  }

  function handleCellClick(row: number, col: number): void {
    if (ready || shipIdx >= SHIPS.length) return
    const { id: shipId, size } = SHIPS[shipIdx]
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches
    if (coarsePointer && (hoverCell?.row !== row || hoverCell?.col !== col)) {
      setHoverCell({ row, col })
      return
    }
    if (!canPlace(board, row, col, size, direction)) return
    const newPlacements = [...placements, { row, col, size, dir: direction, shipId }]
    setPlacements(newPlacements)
    setBoard(buildBoard(newPlacements))
    setHoverCell(null)
  }

  const handleCellHover = useCallback((row: number, col: number) => {
    if (!window.matchMedia?.('(hover: hover)').matches) return
    setHoverCell({ row, col })
  }, [])

  const handleBoardLeave = useCallback(() => {
    if (window.matchMedia?.('(hover: hover)').matches) setHoverCell(null)
  }, [])

  function handleUndo(): void {
    if (isRandom) { handleClear(); return }
    if (placements.length === 0) return
    const newPlacements = placements.slice(0, -1)
    setPlacements(newPlacements)
    setBoard(buildBoard(newPlacements))
  }

  function handleClear(): void {
    setPlacements([])
    setBoard(createEmptyBoard())
    setIsRandom(false)
    setHoverCell(null)
  }

  function handleRandom(): void {
    const randomBoard = onRandom()
    setBoard(randomBoard)
    setPlacements([])
    setIsRandom(true)
  }

  function handleSubmit(): void {
    setReady(true)
    onSubmit(board)
  }

  const allPlaced = shipIdx >= SHIPS.length
  const currentShip = !allPlaced ? SHIPS[shipIdx] : null
  const preview = getPreview()

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <PlacementCountdown deadline={placingDeadline} />

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(20rem,23rem)_minmax(0,31rem)] xl:justify-center xl:gap-12 2xl:gap-16">
        {/* Board */}
        <div className="order-1 min-w-0 xl:order-2">
          <Board
            board={board}
            onCellClick={handleCellClick}
            onCellHover={!ready && !allPlaced ? handleCellHover : undefined}
            onBoardLeave={handleBoardLeave}
            preview={(!ready && !allPlaced) ? preview : null}
            interactive={!ready && !allPlaced}
            label="Place your fleet"
          />
          {/* Invalid placement notice — reserved height to prevent layout shift */}
          <div className="h-5 mt-1">
            {hoverCell && preview && !preview.valid && !ready && !allPlaced && (
              <p className="text-red-400 text-xs tracking-wide text-center">
                Cannot place this ship here
              </p>
            )}
          </div>
        </div>

        {/* Fleet controls — second on mobile, command rail on wide screens. */}
        <div className="order-2 mx-auto w-full max-w-sm space-y-3 xl:order-1 xl:mx-0 xl:max-w-none">
          <h2 className="hidden text-center text-sm tracking-wide text-zinc-400 xl:block">Fleet controls</h2>

          {/* Current ship + direction */}
          {!ready && currentShip && (
            <div className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 p-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-sky-400 font-bold uppercase tracking-widest mb-1">Deploying</div>
                <div className="text-zinc-100 font-medium text-sm">{currentShip.name}</div>
                <ShipArtwork
                  shipId={currentShip.id}
                  state="preview"
                  className="mt-1.5 h-5"
                  style={{ width: `${currentShip.size * 22}px` }}
                />
              </div>
              <Button
                variant="secondary"
                aria-label={`Direction: ${direction === 'H' ? 'horizontal' : 'vertical'}. Activate to rotate.`}
                onClick={() => setDirection(d => d === 'H' ? 'V' : 'H')}
                className="min-h-14 min-w-24 flex-shrink-0 flex-col gap-1 px-3 text-xs"
              >
                <RotateCw className={`size-4 transition-transform duration-200 ${direction === 'V' ? 'rotate-90' : ''}`} aria-hidden="true" />
                <span className="tracking-wide">{direction === 'H' ? 'Horizontal' : 'Vertical'}</span>
              </Button>
            </div>
          )}

          {!ready && allPlaced && (
            <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 p-2.5">
              <span className="text-emerald-400 text-sm font-medium">✓ All ships standing by</span>
            </div>
          )}

          {/* Ship list — horizontal scroll on mobile, complete manifest on wide screens. */}
          {!ready && (
            <div
              ref={shipListRef}
              role="list"
              aria-label="Fleet deployment order"
              className="scrollbar-none flex touch-pan-x gap-2 overflow-x-auto overscroll-x-contain pb-1 xl:grid xl:touch-auto xl:grid-cols-2 xl:overflow-visible xl:overscroll-auto xl:pb-0"
            >
              {SHIPS.map((s, i) => (
                <div
                  key={s.id}
                  role="listitem"
                  aria-current={i === shipIdx ? 'step' : undefined}
                  className={`flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs xl:min-w-0 ${
                    i === shipIdx ? 'border border-sky-700 bg-sky-950 text-zinc-100' :
                    i < shipIdx   ? 'bg-zinc-900 text-zinc-400 line-through' :
                    'bg-zinc-900 text-zinc-300'
                  }`}
                >
                  <ShipArtwork
                    shipId={s.id}
                    state={i === shipIdx ? 'preview' : 'afloat'}
                    className={`h-3.5 ${i < shipIdx ? 'opacity-30 grayscale' : i > shipIdx ? 'opacity-65' : ''}`}
                    style={{ width: `${Math.max(30, s.size * 13)}px` }}
                  />
                  {s.name}
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          {!ready && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={handleRandom}
              >
                <Shuffle className="size-4" aria-hidden="true" />
                Random
              </Button>

              {(placements.length > 0 || isRandom) && (
                <Button
                  variant="secondary"
                  onClick={handleUndo}
                >
                  {isRandom ? <Trash2 className="size-4" aria-hidden="true" /> : <Undo2 className="size-4" aria-hidden="true" />}
                  {isRandom ? 'Clear' : 'Undo'}
                </Button>
              )}

              {placements.length > 1 && !isRandom && (
                <Button
                  variant="destructive"
                  onClick={handleClear}
                  className="col-span-2"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Clear all ships
                </Button>
              )}
            </div>
          )}

          {allPlaced && !ready && (
            <Button
              size="lg"
              onClick={handleSubmit}
              className="w-full tracking-widest"
            >
              <Check className="size-4" aria-hidden="true" />
              FLEET READY
            </Button>
          )}

          {ready && (
            <p className="py-2 text-center text-sm text-emerald-400">✓ Battle stations — awaiting opponent...</p>
          )}
        </div>
      </div>
    </div>
  )
}
