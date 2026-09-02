import type { LobbyRoom } from '../shared/types'
import { Button } from './ui/button'

interface LobbyTableProps {
  rooms: LobbyRoom[]
  onJoin: (roomId: string) => void
}

export default function LobbyTable({ rooms, onJoin }: LobbyTableProps) {
  if (!rooms?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-zinc-400">
        <div className="mb-1.5 text-3xl" aria-hidden="true">🌊</div>
        <p className="text-sm">No open challenges on the horizon</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {rooms.map(r => (
        <div key={r.id} className="flex flex-col gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 min-[440px]:flex-row min-[440px]:items-center min-[440px]:justify-between">
          <div className="min-w-0">
            <span className="text-sm text-zinc-200">{r.hostNickname}</span>
            <span className="ml-2 font-mono text-xs tracking-widest text-zinc-400">{r.id}</span>
          </div>
          <div className="flex items-center justify-between gap-3 min-[440px]:justify-end">
            <span className="whitespace-nowrap text-xs text-emerald-500">● Waiting</span>
            <Button
              onClick={() => onJoin(r.id)}
            >
              Join
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
