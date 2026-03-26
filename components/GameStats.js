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
  const isMyTurn = roomState.currentTurn === myId
  const me = roomState.players.find(p => p?.id === myId)
  const myAttackCount = me?.attacks?.flat().filter(Boolean).length || 0

  return (
    <div className="space-y-4 w-44">
      {/* Turn indicator */}
      <div className={`px-3 py-2 rounded-lg border text-center text-sm font-bold tracking-widest ${
        isMyTurn
          ? 'bg-emerald-950 border-emerald-700 text-emerald-400'
          : 'bg-zinc-900 border-zinc-700 text-zinc-500'
      }`}>
        {isMyTurn ? '⚔ YOUR TURN' : '⏳ OPPONENT'}
      </div>

      {/* Enemy fleet */}
      <div className="p-3 bg-zinc-900 border border-zinc-700 rounded-lg">
        <div className="text-sm text-sky-400 uppercase font-bold mb-2 tracking-widest">Enemy Fleet</div>
        <div className="space-y-1.5">
          {SHIPS.map((s, i) => {
            const isSunk = sunkShipNames.includes(s.name)
            return (
              <div key={i} className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  {Array.from({ length: s.size }, (_, k) => (
                    <div
                      key={k}
                      className={`w-3 h-3 rounded-sm ${isSunk ? 'bg-red-950' : 'bg-teal-700'}`}
                    />
                  ))}
                </div>
                <span className={`text-sm ${isSunk ? 'text-zinc-600 line-through' : 'text-zinc-400'}`}>
                  {s.name}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Battle stats */}
      <div className="p-3 bg-zinc-900 border border-zinc-700 rounded-lg">
        <div className="text-sm text-sky-400 uppercase font-bold mb-2 tracking-widest">Stats</div>
        <div className="text-sm text-zinc-400 space-y-1">
          <div className="flex justify-between">
            <span>Shots fired</span>
            <span className="text-zinc-200 font-mono">{myAttackCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Sunk</span>
            <span className="text-red-400 font-mono">{sunkShipNames.length}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
