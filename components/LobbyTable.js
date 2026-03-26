// components/LobbyTable.js
export default function LobbyTable({ rooms, onJoin }) {
  if (!rooms?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-600">
        <div className="text-3xl mb-2">🌊</div>
        <p className="text-sm">暂无公开房间</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {rooms.map(r => (
        <div key={r.id} className="flex items-center justify-between px-3 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg">
          <div>
            <span className="text-sm text-slate-200">{r.hostNickname}</span>
            <span className="ml-2 text-xs text-slate-600 font-mono">{r.id}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-green-500">● 等待中</span>
            <button
              onClick={() => onJoin(r.id)}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors"
            >
              加入
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
