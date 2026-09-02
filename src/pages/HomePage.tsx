import { useState, useEffect, useRef } from 'react'
import { Anchor, Bot, Plus, RefreshCw, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getSocket } from '../../lib/socket'
import type { GameSocket } from '../../lib/socket'
import type { GameMode, LobbyRoom, SocketErrorPayload } from '../../lib/types'
import LobbyTable from '../components/LobbyTable'
import GameVersion from '../components/GameVersion'
import { useToast } from '../components/ToastProvider'
import { useLocalStats } from '../hooks/useLocalStats'
import { getOrCreatePlayerId } from '../../lib/playerIdentity'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Switch } from '../components/ui/switch'

export default function HomePage() {
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [rooms, setRooms]       = useState<LobbyRoom[]>([])
  const [isPublic, setIsPublic] = useState(true)
  const [battleMode, setBattleMode] = useState<GameMode>('online')
  const [invalidField, setInvalidField] = useState('')
  const [pendingAction, setPendingAction] = useState('')
  const { stats } = useLocalStats()
  const showToast = useToast()
  const socketRef = useRef<GameSocket | null>(null)
  const callsignRef = useRef<HTMLInputElement | null>(null)
  const roomCodeRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    document.title = '⚓ Battleship'

    try {
      const saved = localStorage.getItem('battleship_nickname')
      if (saved) setNickname(saved)
    } catch {
      // Keep the field empty when storage is unavailable.
    }

    const socket = getSocket()
    socketRef.current = socket

    const onListResult = ({ rooms }: { rooms: LobbyRoom[] }) => setRooms(rooms)
    const onCreated    = ({ roomId }: { roomId: string }) => navigate(`/room/${roomId}`)
    const onJoined     = ({ roomState }: { roomState: { id: string } }) => navigate(`/room/${roomState.id}`)
    const onError      = ({ message }: SocketErrorPayload) => {
      setPendingAction('')
      showToast({
        title: 'Unable to continue',
        description: message || 'Check the room details and try again.',
      })
    }

    socket.on('room:list_result', onListResult)
    socket.on('room:created',     onCreated)
    socket.on('room:joined',      onJoined)
    socket.on('error',            onError)

    socket.emit('room:list')

    // 每5秒自动刷新房间列表
    const refreshInterval = setInterval(() => {
      socket.emit('room:list')
    }, 5000)

    return () => {
      socket.off('room:list_result', onListResult)
      socket.off('room:created',     onCreated)
      socket.off('room:joined',      onJoined)
      socket.off('error',            onError)
      clearInterval(refreshInterval)
    }
  }, [navigate, showToast])

  function saveName() {
    try {
      localStorage.setItem('battleship_nickname', nickname.trim())
    } catch {
      // The battle can still continue without remembering the callsign.
    }
  }

  function handleNicknameChange(value: string) {
    setNickname(value)
    if (invalidField === 'callsign') setInvalidField('')

    try {
      localStorage.setItem('battleship_nickname', value.trim())
    } catch {
      // The callsign still works for this session when storage is unavailable.
    }
  }

  function requireCallsign(action: 'creating' | 'joining'): boolean {
    if (nickname.trim()) return true
    setInvalidField('callsign')
    callsignRef.current?.focus()
    showToast({
      title: 'Enter a callsign first',
      description: action === 'creating' ? 'Required to create a battle.' : 'Required to join a battle.',
    })
    return false
  }

  function handleCreate(): void {
    if (!requireCallsign('creating')) return
    saveName()
    setInvalidField('')
    setPendingAction('create')
    socketRef.current?.emit('room:create', {
      nickname: nickname.trim(),
      isPublic: battleMode === 'online' && isPublic,
      mode: battleMode,
      playerId: getOrCreatePlayerId(),
    })
  }

  function handleJoin(id?: string): void {
    if (!requireCallsign('joining')) return
    const targetRoomCode = (id || roomCode).trim()
    if (targetRoomCode.length !== 6) {
      setInvalidField('roomCode')
      roomCodeRef.current?.focus()
      showToast({
        title: 'Room code incomplete',
        description: 'Enter all six characters.',
      })
      return
    }
    saveName()
    setInvalidField('')
    setPendingAction('join')
    socketRef.current?.emit('room:join', {
      roomId: targetRoomCode,
      nickname: nickname.trim(),
      playerId: getOrCreatePlayerId(),
    })
  }

  const winRate = stats.wins + stats.losses > 0
    ? Math.round(stats.wins / (stats.wins + stats.losses) * 100)
    : 0

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3 sm:px-6">
        <Anchor className="size-6 text-sky-400" aria-hidden="true" />
        <h1 className="font-mono text-xl font-bold text-zinc-100 tracking-widest">BATTLESHIP</h1>
        <GameVersion />
        <span className="hidden text-sm text-zinc-400 sm:inline">Fleet Action · Live 1v1</span>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
        {/* Identity rail — persistent, but secondary to starting a battle. */}
        <Card className="mb-6 border-zinc-700" aria-labelledby="player-identity-heading">
          <CardContent className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_17rem] sm:items-end sm:gap-6 sm:p-5">
            <div className="max-w-md">
              <div className="mb-2 flex items-center justify-between gap-3">
                <label id="player-identity-heading" htmlFor="callsign" className="text-xs font-bold uppercase tracking-widest text-sky-400">
                  Your callsign
                </label>
                <span className="whitespace-nowrap text-[11px] text-zinc-500">Auto-saved</span>
              </div>
              <Input
                ref={callsignRef}
                value={nickname}
                id="callsign"
                name="callsign"
                onChange={e => handleNicknameChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
                aria-invalid={invalidField === 'callsign'}
                className="bg-zinc-800"
                placeholder="How other captains see you"
                maxLength={24}
                autoComplete="off"
                autoCapitalize="off"
                enterKeyHint="done"
              />
            </div>

            <div className="border-t border-zinc-800 pt-3 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Combat record</div>
              <div className="grid grid-cols-3 divide-x divide-zinc-700 text-center">
                <div className="px-2 text-sm">
                  <span className="block whitespace-nowrap text-xs text-zinc-400">Wins</span>
                  <span className="mt-0.5 block font-mono text-zinc-200">{stats.wins}</span>
                </div>
                <div className="px-2 text-sm">
                  <span className="block whitespace-nowrap text-xs text-zinc-400">Losses</span>
                  <span className="mt-0.5 block font-mono text-zinc-200">{stats.losses}</span>
                </div>
                <div className="px-2 text-sm">
                  <span className="block whitespace-nowrap text-xs text-zinc-400">Win rate</span>
                  <span className="mt-0.5 block font-mono font-bold text-sky-400">{winRate}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-10">
          {/* Create flow */}
          <Card className="border-zinc-700">
            <CardContent className="space-y-5 p-4 sm:p-5">
              <section aria-labelledby="create-battle-heading">
                <div className="mb-4">
                  <h2 id="create-battle-heading" className="text-sm font-bold uppercase tracking-widest text-sky-400">
                    Start a battle
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">Choose your opponent and take command.</p>
                </div>

                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Battle mode">
                  <Button
                    variant={battleMode === 'computer' ? 'tactical' : 'outline'}
                    aria-pressed={battleMode === 'computer'}
                    onClick={() => setBattleMode('computer')}
                    className={battleMode === 'computer' ? 'border-sky-500' : ''}
                  >
                    <Bot className="size-4" aria-hidden="true" />
                    Computer
                  </Button>
                  <Button
                    variant={battleMode === 'online' ? 'tactical' : 'outline'}
                    aria-pressed={battleMode === 'online'}
                    onClick={() => setBattleMode('online')}
                    className={battleMode === 'online' ? 'border-sky-500' : ''}
                  >
                    <Users className="size-4" aria-hidden="true" />
                    Online
                  </Button>
                </div>

                {battleMode === 'online' && (
                  <label htmlFor="public-room" className="mt-4 flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/30 px-3 py-2 text-sm text-zinc-300">
                    <Switch
                      id="public-room"
                      checked={isPublic}
                      onCheckedChange={setIsPublic}
                    />
                    <span className="min-w-0">
                      <span className="block">Public room</span>
                      <span className="block text-xs text-zinc-500">Listed for other captains to join</span>
                    </span>
                  </label>
                )}

                <Button
                  onClick={handleCreate}
                  disabled={!!pendingAction}
                  size="lg"
                  className="mt-4 w-full tracking-widest disabled:cursor-wait"
                >
                  {battleMode === 'computer'
                    ? <Bot className="size-4" aria-hidden="true" />
                    : <Plus className="size-4" aria-hidden="true" />}
                  {pendingAction === 'create'
                    ? 'STARTING BATTLE...'
                    : battleMode === 'computer' ? 'START VS COMPUTER' : 'CREATE ONLINE ROOM'}
                </Button>
              </section>
            </CardContent>
          </Card>

          {/* Join and discovery flow */}
          <div className="min-w-0 space-y-6">
            <section aria-labelledby="join-battle-heading">
              <div className="mb-3">
                <h2 id="join-battle-heading" className="text-sm font-bold uppercase tracking-widest text-sky-400">
                  Join a battle
                </h2>
                <p className="mt-1 text-sm text-zinc-500">Enter an invite code or answer an open challenge.</p>
              </div>
              <div className="flex gap-2">
                <Input
                  ref={roomCodeRef}
                  value={roomCode}
                  id="room-code"
                  name="roomCode"
                  onChange={e => {
                    setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
                    if (invalidField === 'roomCode') setInvalidField('')
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  placeholder="6-character room code"
                  maxLength={6}
                  aria-invalid={invalidField === 'roomCode'}
                  className="min-w-0 flex-1 bg-zinc-800 font-mono uppercase tracking-widest"
                  autoComplete="off"
                  autoCapitalize="characters"
                />
                <Button
                  variant="outline"
                  onClick={() => handleJoin()}
                  disabled={!!pendingAction}
                  className="border-sky-800 px-5 text-sky-300 hover:border-sky-600 hover:bg-sky-950"
                >
                  {pendingAction === 'join' ? 'Joining...' : 'Join'}
                </Button>
              </div>
            </section>

            <section aria-labelledby="open-battles-heading">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="open-battles-heading" className="text-sm font-bold uppercase tracking-widest text-zinc-300">Open battles</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => socketRef.current?.emit('room:list')}
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                  Refresh
                </Button>
              </div>
              <LobbyTable rooms={rooms} onJoin={handleJoin} />
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
