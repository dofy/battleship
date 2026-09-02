import { memo, useId } from 'react'
import type { CSSProperties } from 'react'
import type { Direction } from '../../lib/types'
import { cn } from '@/lib/utils'

export type ShipVisualState = 'afloat' | 'damaged' | 'sunk' | 'preview' | 'invalid'

interface ShipArtworkProps {
  shipId: string
  state?: ShipVisualState
  className?: string
  style?: CSSProperties
}

const PALETTES: Record<ShipVisualState, { dark: string; mid: string; light: string; edge: string; detail: string }> = {
  afloat: { dark: '#164e63', mid: '#0f766e', light: '#67e8f9', edge: '#a5f3fc', detail: '#dbeafe' },
  damaged: { dark: '#450a0a', mid: '#991b1b', light: '#fb7185', edge: '#fecdd3', detail: '#fee2e2' },
  sunk: { dark: '#431407', mid: '#7c2d12', light: '#fb923c', edge: '#fed7aa', detail: '#ffedd5' },
  preview: { dark: '#134e4a', mid: '#0d9488', light: '#5eead4', edge: '#99f6e4', detail: '#ccfbf1' },
  invalid: { dark: '#450a0a', mid: '#b91c1c', light: '#f87171', edge: '#fecaca', detail: '#fee2e2' },
}

function ShipDetails({ shipId, color }: { shipId: string; color: string }) {
  if (shipId === 'carrier') {
    return (
      <>
        <path d="M23 8H101L109 13V27L101 32H23Z" fill="#0b1722" fillOpacity=".52" stroke={color} strokeOpacity=".42" />
        <path d="M30 20H98" stroke={color} strokeOpacity=".55" strokeDasharray="7 4" />
        <path d="M74 11h15v7H74z" fill={color} fillOpacity=".7" />
        <path d="M82 11V6M79 6h6" stroke={color} strokeWidth="1.4" />
      </>
    )
  }

  if (shipId === 'submarine') {
    return (
      <>
        <path d="M7 20C15 7 31 6 57 6h34c13 0 22 6 26 14-4 8-13 14-26 14H57C31 34 15 33 7 20Z" fill="#08141c" fillOpacity=".28" />
        <path d="M57 12h20l7 8-7 8H57l-7-8Z" fill={color} fillOpacity=".72" />
        <path d="M66 12V7h9M69 7V4" stroke={color} strokeWidth="1.5" />
      </>
    )
  }

  const isBattleship = shipId === 'battleship'
  const isDestroyer = shipId === 'destroyer'
  return (
    <>
      <path d="M25 11h54l12 9-12 9H25Z" fill="#07131c" fillOpacity=".42" stroke={color} strokeOpacity=".35" />
      <path d="M52 11h18l8 9-8 9H52l-7-9Z" fill={color} fillOpacity=".62" />
      <path d="M60 11V7h8M64 7V4" stroke={color} strokeWidth="1.4" />
      <g fill={color} stroke="#07131c" strokeWidth="1">
        <circle cx="29" cy="20" r={isDestroyer ? 3 : 4.5} />
        <circle cx={isBattleship ? 91 : 87} cy="20" r={isBattleship ? 4.5 : 3.5} />
      </g>
      <g stroke={color} strokeWidth={isBattleship ? 2 : 1.5} strokeLinecap="round">
        <path d="M29 20 17 14M29 20 17 20M29 20 17 26" />
        <path d={isBattleship ? 'M91 20 105 15M91 20 106 20M91 20 105 25' : 'M87 20 102 20'} />
      </g>
      {isBattleship && <circle cx="43" cy="20" r="3.8" fill={color} fillOpacity=".85" />}
    </>
  )
}

export const ShipArtwork = memo(function ShipArtwork({ shipId, state = 'afloat', className, style }: ShipArtworkProps) {
  const gradientId = `ship-${useId().replaceAll(':', '')}`
  const palette = PALETTES[state]
  const isSubmarine = shipId === 'submarine'

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 40"
      preserveAspectRatio="none"
      className={cn('overflow-visible drop-shadow-[0_2px_2px_rgba(0,0,0,0.55)]', className)}
      style={style}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={palette.light} />
          <stop offset="0.28" stopColor={palette.mid} />
          <stop offset="0.68" stopColor={palette.dark} />
          <stop offset="1" stopColor="#061018" />
        </linearGradient>
      </defs>
      <path
        d={isSubmarine
          ? 'M3 20C12 7 29 3 55 3h39c13 0 21 7 23 17-2 10-10 17-23 17H55C29 37 12 33 3 20Z'
          : 'M2 20 17 3h80l20 9v16l-20 9H17Z'}
        fill={`url(#${gradientId})`}
        stroke={palette.edge}
        strokeOpacity={state === 'preview' ? '.82' : '.62'}
        strokeWidth="1.25"
        vectorEffect="non-scaling-stroke"
      />
      <path d="M11 20h98" stroke={palette.light} strokeOpacity=".34" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <ShipDetails shipId={shipId} color={palette.detail} />
      {(state === 'damaged' || state === 'sunk') && (
        <g stroke="#fff7ed" strokeWidth="1.4" strokeOpacity=".75" vectorEffect="non-scaling-stroke">
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
