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

interface ShipPalette {
  line: string
  hull: string
  deck: string
  detail: string
}

const PALETTES: Record<ShipVisualState, ShipPalette> = {
  afloat: { line: '#5eead4', hull: '#0f766e', deck: '#164e63', detail: '#ccfbf1' },
  damaged: { line: '#fb7185', hull: '#9f1239', deck: '#7f1d1d', detail: '#ffe4e6' },
  sunk: { line: '#fb923c', hull: '#9a3412', deck: '#7c2d12', detail: '#ffedd5' },
  preview: { line: '#67e8f9', hull: '#0e7490', deck: '#155e75', detail: '#cffafe' },
  invalid: { line: '#f87171', hull: '#b91c1c', deck: '#7f1d1d', detail: '#fee2e2' },
}

const LINE_PROPS = {
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  vectorEffect: 'non-scaling-stroke' as const,
}

function hullPath(shipId: string): string {
  if (shipId === 'carrier') return 'M5 13Q7 7 18 6h73q13 1 27 14-14 13-27 14H18Q7 33 5 27Z'
  if (shipId === 'battleship') return 'M6 13Q8 8 19 8h67q17 1 31 12-14 11-31 12H19Q8 32 6 27Z'
  if (shipId === 'cruiser') return 'M7 14q2-4 13-5h68q16 1 29 11-13 10-29 11H20Q9 30 7 26Z'
  if (shipId === 'destroyer') return 'M8 15q2-4 14-5h66q16 1 29 10-13 9-29 10H22q-12-1-14-5Z'
  return 'M3 20C12 9 31 6 56 6h35c15 0 24 6 27 14-3 8-12 14-27 14H56C31 34 12 31 3 20Z'
}

function deckPath(shipId: string): string {
  if (shipId === 'carrier') return 'M12 20Q14 9 22 9h70l18 7v8l-18 7H22q-8 0-10-11Z'
  if (shipId === 'battleship') return 'M14 15q2-4 11-4h59q13 1 23 9-10 8-23 9H25q-9 0-11-4Z'
  if (shipId === 'cruiser') return 'M16 16q2-3 11-3h57q12 1 21 7-9 7-21 7H27q-9 0-11-3Z'
  if (shipId === 'destroyer') return 'M18 17q2-3 11-3h55q12 1 21 6-9 6-21 6H29q-9 0-11-3Z'
  return 'M13 20c9-6 24-8 43-8h33c9 0 15 3 19 8-4 5-10 8-19 8H56c-19 0-34-2-43-8Z'
}

function ShipDetails({ shipId, palette }: { shipId: string; palette: ShipPalette }) {
  if (shipId === 'carrier') {
    return (
      <g {...LINE_PROPS}>
        <path d="M18 11H94l13 5v8l-13 5H18Z" fill={palette.deck} stroke={palette.detail} strokeOpacity=".8" strokeWidth=".9" />
        <path d="M23 20H99" fill="none" stroke={palette.detail} strokeWidth="1" strokeDasharray="8 5" strokeOpacity=".8" />
        <path d="m31 15 6 5-6 5M50 15l6 5-6 5" fill="none" stroke={palette.detail} strokeWidth="1" strokeOpacity=".65" />
        <path d="M74 10h18v10H74Z" fill={palette.hull} stroke={palette.detail} strokeWidth="1" />
        <path d="M79 10V6h8M83 6V3M83 3h6" fill="none" stroke={palette.detail} strokeWidth="1.2" />
        <circle cx="89" cy="15" r="1.5" fill={palette.detail} />
      </g>
    )
  }

  if (shipId === 'submarine') {
    return (
      <g {...LINE_PROPS}>
        <path d="M15 20c10-5 24-7 42-7h31c9 0 16 2 21 7-5 5-12 7-21 7H57c-18 0-32-2-42-7Z" fill={palette.deck} stroke={palette.detail} strokeOpacity=".8" strokeWidth=".9" />
        <path d="M49 15h28l8 5-8 5H49l-7-5Z" fill={palette.hull} stroke={palette.detail} strokeWidth="1" />
        <path d="M58 15v-5h18M67 10V5h7M67 5v-2" fill="none" stroke={palette.detail} strokeWidth="1.2" />
        <path d="m24 15-9 5 9 5M97 14l11 6-11 6" fill="none" stroke={palette.detail} strokeWidth="1" strokeOpacity=".8" />
        <circle cx="54" cy="20" r="1.35" fill={palette.detail} />
        <circle cx="75" cy="20" r="1.35" fill={palette.detail} />
      </g>
    )
  }

  const isBattleship = shipId === 'battleship'
  const isDestroyer = shipId === 'destroyer'
  const isCruiser = shipId === 'cruiser'
  return (
    <g {...LINE_PROPS}>
      <path
        d={isDestroyer ? 'M46 14h24l8 6-8 6H46l-7-6Z' : 'M42 12h34l9 8-9 8H42l-8-8Z'}
        fill={palette.hull}
        stroke={palette.detail}
        strokeWidth="1"
      />
      <path
        d={isDestroyer ? 'M54 14V9h13l5 5Z' : 'M51 12V7h18l5 5Z'}
        fill={palette.deck}
        stroke={palette.detail}
        strokeWidth="1"
      />
      <path d={isDestroyer ? 'M60 9V5h7M63 5V3' : 'M59 7V3h9M63 3V1'} fill="none" stroke={palette.detail} strokeWidth="1.15" />
      <g fill={palette.deck} stroke={palette.detail} strokeWidth={isBattleship ? '1.25' : '1'}>
        <circle cx="27" cy="20" r={isBattleship ? '4.5' : '3.5'} />
        <circle cx="92" cy="20" r={isBattleship ? '4.5' : '3.5'} />
      </g>
      <g fill="none" stroke={palette.detail} strokeWidth={isBattleship ? '1.45' : '1.2'}>
        <path d={isBattleship ? 'M27 20 13 15M27 20H12M27 20 13 25' : 'M27 20H14'} />
        <path d={isBattleship ? 'M92 20 108 15M92 20h17M92 20l16 5' : 'M92 20h14'} />
      </g>
      {isBattleship && (
        <g>
          <circle cx="39" cy="20" r="3.5" fill={palette.deck} stroke={palette.detail} strokeWidth="1" />
          <path d="M39 20H29" fill="none" stroke={palette.detail} strokeWidth="1.25" />
        </g>
      )}
      {isCruiser && (
        <path d="m83 15 6 5-6 5M34 16l5 4-5 4" fill="none" stroke={palette.detail} strokeWidth="1" strokeOpacity=".8" />
      )}
      {isDestroyer && (
        <g fill={palette.detail} opacity=".8">
          <rect x="32" y="15" width="10" height="3" rx="1" transform="rotate(22 37 16.5)" />
          <rect x="80" y="22" width="10" height="3" rx="1" transform="rotate(22 85 23.5)" />
        </g>
      )}
      <circle cx="52" cy="20" r="1.2" fill={palette.detail} />
      <circle cx="70" cy="20" r="1.2" fill={palette.detail} />
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
      className={cn('overflow-visible drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]', className)}
      style={style}
    >
      <path d={hullPath(shipId)} fill="#020617" fillOpacity=".42" transform="translate(0 2)" />
      <path
        d={hullPath(shipId)}
        fill={palette.hull}
        fillOpacity={state === 'preview' ? '.72' : '.88'}
        stroke={palette.line}
        strokeWidth="1.4"
        strokeDasharray={state === 'invalid' ? '4 3' : undefined}
        {...LINE_PROPS}
      />
      <path
        d={deckPath(shipId)}
        fill={palette.deck}
        fillOpacity={state === 'preview' ? '.68' : '.92'}
        stroke={palette.line}
        strokeOpacity=".65"
        strokeWidth=".8"
        {...LINE_PROPS}
      />
      <path d="M10 20h101" stroke={palette.detail} strokeOpacity=".3" strokeWidth=".8" {...LINE_PROPS} />
      <ShipDetails shipId={shipId} palette={palette} />
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
