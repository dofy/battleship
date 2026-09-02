import { memo } from 'react'
import type { CSSProperties } from 'react'
import type { Direction } from '../shared/types'
import { cn } from '@/lib/utils'

export type ShipVisualState = 'afloat' | 'damaged' | 'sunk' | 'preview' | 'invalid'

interface ShipArtworkProps {
  shipId: string
  state?: ShipVisualState
  className?: string
  style?: CSSProperties
}

const PALETTES: Record<ShipVisualState, { line: string; surface: string; detail: string }> = {
  afloat: { line: '#5eead4', surface: '#134e4a', detail: '#99f6e4' },
  damaged: { line: '#fb7185', surface: '#7f1d1d', detail: '#fecdd3' },
  sunk: { line: '#fb923c', surface: '#7c2d12', detail: '#fed7aa' },
  preview: { line: '#67e8f9', surface: '#155e75', detail: '#cffafe' },
  invalid: { line: '#f87171', surface: '#991b1b', detail: '#fee2e2' },
}

const LINE_PROPS = {
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  vectorEffect: 'non-scaling-stroke' as const,
}

function hullPath(shipId: string): string {
  if (shipId === 'carrier') return 'M4 20 14 7H99L116 13V27L99 33H14Z'
  if (shipId === 'battleship') return 'M4 20 17 8H94L116 17V23L94 32H17Z'
  if (shipId === 'cruiser') return 'M5 20 18 10H96L115 20 96 30H18Z'
  if (shipId === 'destroyer') return 'M5 20 20 11H95L116 20 95 29H20Z'
  return 'M4 20C13 10 31 7 56 7h34c14 0 23 5 27 13-4 8-13 13-27 13H56C31 33 13 30 4 20Z'
}

function ShipDetails({ shipId, color }: { shipId: string; color: string }) {
  if (shipId === 'carrier') {
    return (
      <g fill="none" stroke={color} strokeWidth="1.15" {...LINE_PROPS}>
        <path d="M17 12H96l11 4v8l-11 4H17Z" />
        <path d="M25 20H99" strokeDasharray="7 5" strokeOpacity=".7" />
        <path d="M74 11v7h17v-7M82 11V6M78 6h8" />
        <path d="m32 15 6 5-6 5M51 15l6 5-6 5" strokeOpacity=".65" />
      </g>
    )
  }

  if (shipId === 'submarine') {
    return (
      <g fill="none" stroke={color} strokeWidth="1.2" {...LINE_PROPS}>
        <path d="M20 20h82" strokeOpacity=".55" />
        <path d="M51 14h24l8 6-8 6H51l-7-6Z" />
        <path d="M60 14V9h15M68 9V5M68 5h6" />
        <path d="m23 16-7 4 7 4M98 15l9 5-9 5" strokeOpacity=".75" />
      </g>
    )
  }

  const isBattleship = shipId === 'battleship'
  const isDestroyer = shipId === 'destroyer'
  const isCruiser = shipId === 'cruiser'
  return (
    <g fill="none" stroke={color} {...LINE_PROPS}>
      <path
        d={isDestroyer ? 'M48 14h20l8 6-8 6H48l-6-6Z' : 'M43 12h31l8 8-8 8H43l-7-8Z'}
        strokeWidth="1.15"
      />
      <path d={isDestroyer ? 'M57 14V9h9M61 9V6' : 'M55 12V7h12M61 7V4'} strokeWidth="1.2" />
      <g strokeWidth={isBattleship ? '1.6' : '1.25'}>
        <circle cx="28" cy="20" r={isBattleship ? '4' : '3'} />
        <path d={isBattleship ? 'M28 20 15 15M28 20H14M28 20 15 25' : 'M28 20H16'} />
        <circle cx="91" cy="20" r={isBattleship ? '4' : '3'} />
        <path d={isBattleship ? 'M91 20 106 15M91 20h16M91 20l15 5' : 'M91 20h13'} />
      </g>
      {isBattleship && (
        <g strokeWidth="1.25">
          <circle cx="40" cy="20" r="3.25" />
          <path d="M40 20H29" />
        </g>
      )}
      {isCruiser && <path d="m84 15 5 5-5 5M35 16l5 4-5 4" strokeWidth="1" strokeOpacity=".75" />}
      {isDestroyer && <path d="m34 15 9 10M43 15l-9 10M81 16l7 8M88 16l-7 8" strokeWidth="1" strokeOpacity=".7" />}
    </g>
  )
}

export const ShipArtwork = memo(function ShipArtwork({ shipId, state = 'afloat', className, style }: ShipArtworkProps) {
  const palette = PALETTES[state]

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 40"
      preserveAspectRatio="none"
      className={cn('overflow-visible', className)}
      style={style}
    >
      <path
        d={hullPath(shipId)}
        fill={palette.surface}
        fillOpacity={state === 'preview' ? '.3' : '.2'}
        stroke={palette.line}
        strokeWidth="1.5"
        strokeDasharray={state === 'invalid' ? '4 3' : undefined}
        {...LINE_PROPS}
      />
      <path d="M12 20h98" stroke={palette.line} strokeOpacity=".32" strokeWidth="1" {...LINE_PROPS} />
      <ShipDetails shipId={shipId} color={palette.detail} />
      {(state === 'damaged' || state === 'sunk') && (
        <g fill="none" stroke={palette.detail} strokeWidth="1.35" strokeOpacity=".9" {...LINE_PROPS}>
          <path d="m37 9 5 7-5 6 7 8" />
          {state === 'sunk' && <path d="m84 7-7 8 7 7-8 10" />}
        </g>
      )}
    </svg>
  )
})

interface BoardShipProps {
  shipId: string
  size: number
  direction: Direction
  state?: ShipVisualState
}

export const BoardShip = memo(function BoardShip({ shipId, size, direction, state = 'afloat' }: BoardShipProps) {
  const style: CSSProperties = {
    width: `calc(var(--cell-size) * ${size})`,
    height: 'var(--cell-size)',
    transform: direction === 'V' ? 'translateX(var(--cell-size)) rotate(90deg)' : undefined,
    transformOrigin: 'top left',
  }

  return (
    <ShipArtwork
      shipId={shipId}
      state={state}
      className="pointer-events-none absolute left-0 top-0 z-[5] h-[var(--cell-size)] p-[2px]"
      style={style}
    />
  )
})
