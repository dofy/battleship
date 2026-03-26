// components/GameStats.js
const SHIPS = [
  { name: '航空母舰', size: 5 },
  { name: '战列舰',   size: 4 },
  { name: '巡洋舰',   size: 3 },
  { name: '驱逐舰',   size: 3 },
  { name: '潜水艇',   size: 2 },
]

export default function GameStats({ roomState, myId, sunkShipNames = [] }) {
  if (!roomState) return null
  const isMyTurn = roomState.currentTurn === myId
  const me = roomState.players.find(p => p?.id === myId)
  const myAttackCount = me?.attacks?.flat().filter(Boolean).length || 0

  return (
    <div className="space-y-4 w-40">
      {/* 回合状态 */}
      <div className={`px-3 py-2 rounded-lg border text-center text-sm font-bold ${
        isMyTurn
          ? 'bg-green-900 border-green-700 text-green-300'
          : 'bg-gray-800 border-gray-700 text-gray-400'
      }`}>
        {isMyTurn ? '⚔ 你的回合' : '⏳ 对手回合'}
      </div>

      {/* 敌方舰队 */}
      <div className="p-3 bg-gray-800 border border-gray-700 rounded-lg">
        <div className="text-xs text-indigo-400 uppercase font-bold mb-2 tracking-wide">敌方舰队</div>
        <div className="space-y-1.5">
          {SHIPS.map((s, i) => {
            const isSunk = sunkShipNames.includes(s.name)
            return (
              <div key={i} className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  {Array.from({ length: s.size }, (_, k) => (
                    <div
                      key={k}
                      className={`w-3 h-3 rounded-sm ${isSunk ? 'bg-red-900' : 'bg-indigo-600'}`}
                    />
                  ))}
                </div>
                <span className={`text-xs ${isSunk ? 'text-gray-600 line-through' : 'text-gray-400'}`}>
                  {s.name}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 战况 */}
      <div className="p-3 bg-gray-800 border border-gray-700 rounded-lg">
        <div className="text-xs text-indigo-400 uppercase font-bold mb-2 tracking-wide">战况</div>
        <div className="text-xs text-gray-400 space-y-1">
          <div className="flex justify-between">
            <span>攻击次数</span>
            <span className="text-gray-200 font-mono">{myAttackCount}</span>
          </div>
          <div className="flex justify-between">
            <span>击沉数</span>
            <span className="text-red-400 font-mono">{sunkShipNames.length}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
