// components/GameStats.js
const SHIPS = [
  { name: 'Carrier',    size: 5 },
  { name: 'Battleship', size: 4 },
  { name: 'Cruiser',    size: 3 },
  { name: 'Destroyer',  size: 3 },
  { name: 'Submarine',  size: 2 },
]

export default function GameStats({ roomState, myId, sunkShipNames = [] }) {
  if (!roomState) return null
  const isMyTurn      = roomState.currentTurn === myId
  const me            = roomState.players.find(p => p?.id === myId)
  const myAttackCount = me?.attacks?.flat().filter(Boolean).length || 0

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm">

      {/* Turn indicator */}
      <div className={`font-bold tracking-widest whitespace-nowrap ${isMyTurn ? 'text-emerald-400' : 'text-zinc-500'}`}>
        {isMyTurn ? '⚔ YOUR TURN' : '⏳ OPPONENT'}
      </div>

      <div className="hidden sm:block h-4 border-l border-zinc-700" />

      {/* Enemy fleet silhouettes */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-sky-400 uppercase tracking-widest whitespace-nowrap">Enemy Fleet</span>
        <div className="flex gap-2 flex-wrap">
          {SHIPS.map((s, i) => {
            const isSunk = sunkShipNames.includes(s.name)
            return (
              <div key={i} className={`flex gap-px items-center ${isSunk ? 'opacity-40' : ''}`} title={s.name}>
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

      <div className="hidden sm:block h-4 border-l border-zinc-700" />

      {/* Stats */}
      <div className="flex gap-4 text-zinc-400">
        <span>
          Shots <span className="text-zinc-200 font-mono ml-1">{myAttackCount}</span>
        </span>
        <span>
          Sunk <span className="text-red-400 font-mono ml-1">{sunkShipNames.length}/{SHIPS.length}</span>
        </span>
      </div>
    </div>
  )
}
