// components/GameStats.js
const SHIPS = [
  { name: '航空母舰', size: 5 },
  { name: '战列舰',   size: 4 },
  { name: '巡洋舰',   size: 3 },
  { name: '驱逐舰',   size: 3 },
  { name: '潜水艇',   size: 2 },
]

export default function GameStats({ roomState, myId }) {
  if (!roomState) return null
  const isMyTurn = roomState.currentTurn === myId
  const me = roomState.players.find(p => p?.id === myId)
  const opponent = roomState.players.find(p => p && p.id !== myId)

  const mineHits = me?.attacks?.flat().filter(Boolean).length || 0

  return (
    <div className="space-y-4 w-36">
      <div>
        <div className="text-xs text-indigo-400 uppercase font-bold mb-1">回合</div>
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${isMyTurn ? 'bg-green-900 text-green-300 border border-green-600' : 'bg-red-950 text-red-400 border border-red-800'}`}>
          {isMyTurn ? '你的回合' : '对手回合'}
        </span>
      </div>

      <div>
        <div className="text-xs text-indigo-400 uppercase font-bold mb-2">敌方舰队</div>
        <div className="space-y-1.5">
          {SHIPS.map((s, i) => (
            <div key={i} className="flex gap-0.5">
              {Array.from({ length: s.size }, (_, k) => (
                <div key={k} className="w-3.5 h-3.5 bg-indigo-600 rounded-sm" />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs text-indigo-400 uppercase font-bold mb-1">战况</div>
        <div className="text-xs text-gray-400 space-y-1">
          <div>攻击：{mineHits}</div>
        </div>
      </div>
    </div>
  )
}
