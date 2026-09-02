import { SHIPS } from '../shared/shipUtils'
import type { RoomSnapshot } from '../shared/types'

interface GameStatsProps {
  roomState: RoomSnapshot
  myId: string | null
  sunkShipIds?: string[]
}

export default function GameStats({ roomState, myId, sunkShipIds = [] }: GameStatsProps) {
  if (!roomState) return null
  const me            = roomState.players.find(p => p?.id === myId)
  const myAttackCount = me?.attacks?.flat().filter(Boolean).length || 0

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm">
      {/* Enemy fleet silhouettes */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-sky-400 uppercase tracking-widest whitespace-nowrap">Enemy Fleet</span>
        <div className="flex gap-2 flex-wrap">
          {SHIPS.map((s) => {
            const isSunk = sunkShipIds.includes(s.id)
            return (
              <div
                key={s.id}
                className={`flex gap-px items-center ${isSunk ? 'opacity-40' : ''}`}
                title={`${s.name}${isSunk ? ' (sunk)' : ''}`}
                aria-label={`${s.name}, ${isSunk ? 'sunk' : 'afloat'}`}
              >
                {Array.from({ length: s.size }, (_, k) => (
                  <div
                    key={k}
                    className={`h-3.5 w-3 ${isSunk ? 'bg-red-900' : 'bg-teal-700'} ${
                      k === 0              ? 'rounded-l-full rounded-r-none'
                      : k === s.size - 1  ? 'rounded-r rounded-l-none'
                      : 'rounded-none'
                    }`}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-zinc-400">
        <span>
          Shots <span className="text-zinc-200 font-mono ml-1">{myAttackCount}</span>
        </span>
        <span>
          Sunk <span className="text-red-400 font-mono ml-1">{sunkShipIds.length}/{SHIPS.length}</span>
        </span>
      </div>
    </div>
  )
}
