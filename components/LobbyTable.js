// components/LobbyTable.js
export default function LobbyTable({ rooms, onJoin }) {
  if (!rooms?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
        <div className="text-3xl mb-2">🌊</div>
        <p className="text-sm">No open battles</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {rooms.map(r => (
        <div key={r.id} className="flex items-center justify-between px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg">
          <div>
            <span className="text-sm text-zinc-200">{r.hostNickname}</span>
            <span className="ml-2 text-sm text-zinc-600 font-mono tracking-widest">{r.id}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-emerald-500">● Waiting</span>
            <button
              onClick={() => onJoin(r.id)}
              className="px-3 py-1 bg-sky-700 hover:bg-sky-600 text-zinc-100 rounded text-sm font-medium transition-colors"
            >
              Join
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
