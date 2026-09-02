// pages/index.js
import Head from 'next/head'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { getSocket } from '../lib/socket'
import LobbyTable from '../components/LobbyTable'
import { useLocalStats } from '../hooks/useLocalStats'
import { getOrCreatePlayerId } from '../lib/playerIdentity'

export default function Home() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [rooms, setRooms]       = useState([])
  const [isPublic, setIsPublic] = useState(true)
  const [error, setError]       = useState('')
  const [pendingAction, setPendingAction] = useState('')
  const { stats } = useLocalStats()
  const socketRef = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem('battleship_nickname')
    if (saved) setNickname(saved)

    const socket = getSocket()
    socketRef.current = socket

    const onListResult = ({ rooms }) => setRooms(rooms)
    const onCreated    = ({ roomId }) => router.push(`/room/${roomId}`)
    const onJoined     = ({ roomState }) => router.push(`/room/${roomState.id}`)
    const onError      = ({ message }) => {
      setPendingAction('')
      setError(message)
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
  }, [])

  function saveName() {
    localStorage.setItem('battleship_nickname', nickname)
  }

  function handleCreate() {
    if (!nickname.trim()) return setError('Enter a callsign first')
    saveName()
    setError('')
    setPendingAction('create')
    socketRef.current.emit('room:create', {
      nickname: nickname.trim(),
      isPublic,
      playerId: getOrCreatePlayerId(),
    })
  }

  function handleJoin(id) {
    if (!nickname.trim()) return setError('Enter a callsign first')
    saveName()
    setError('')
    setPendingAction('join')
    socketRef.current.emit('room:join', {
      roomId: id || roomCode.trim(),
      nickname: nickname.trim(),
      playerId: getOrCreatePlayerId(),
    })
  }

  const winRate = stats.wins + stats.losses > 0
    ? Math.round(stats.wins / (stats.wins + stats.losses) * 100)
    : 0

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Head><title>⚓ Battleship</title></Head>

      {/* Header */}
      <header className="border-b border-zinc-800 px-4 sm:px-6 py-4 flex items-center gap-3">
        <span className="text-2xl">⚓</span>
        <h1 className="font-mono text-xl font-bold text-zinc-100 tracking-widest">BATTLESHIP</h1>
        <span className="text-zinc-400 text-sm hidden sm:inline">Naval Combat · 1v1 Live</span>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col sm:flex-row gap-6 sm:gap-8">

        {/* Controls */}
        <div className="w-full sm:w-56 space-y-4 sm:flex-shrink-0">
          {/* Callsign */}
          <div>
            <label htmlFor="callsign" className="text-sm text-sky-400 uppercase font-bold block mb-1.5 tracking-widest">
              Callsign
            </label>
            <input
              value={nickname}
              id="callsign"
              name="callsign"
              onChange={e => { setNickname(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-3 text-base outline-none focus:border-sky-600 transition-colors"
              placeholder="Enter callsign..."
              autoComplete="off"
              autoCapitalize="off"
            />
          </div>

          {/* Public toggle */}
          <label className="flex items-center gap-3 text-sm text-zinc-400 cursor-pointer select-none py-1">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={e => setIsPublic(e.target.checked)}
              className="rounded w-4 h-4"
            />
            Public (visible in lobby)
          </label>

          {/* Create button */}
          <button
            onClick={handleCreate}
            disabled={!!pendingAction}
            className="w-full min-h-11 py-3 bg-sky-700 hover:bg-sky-600 active:bg-sky-800 rounded-lg font-bold text-sm tracking-widest transition-colors disabled:cursor-wait disabled:opacity-60"
          >
            {pendingAction === 'create' ? 'OPENING...' : '+ NEW BATTLE'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-sm text-zinc-400">or</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* Join by code */}
          <div>
            <label htmlFor="room-code" className="text-sm text-zinc-400 block mb-1.5">Join by room code</label>
            <div className="flex gap-2">
              <input
                value={roomCode}
                id="room-code"
                name="roomCode"
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                placeholder="XXXXXX"
                maxLength={6}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-3 text-base font-mono outline-none focus:border-sky-600 transition-colors min-w-0 tracking-widest"
                autoComplete="off"
                autoCapitalize="characters"
              />
              <button
                onClick={() => handleJoin()}
                disabled={!!pendingAction || roomCode.trim().length !== 6}
                className="min-h-11 px-4 py-3 border border-sky-700 text-sky-400 hover:bg-sky-900 active:bg-sky-950 rounded-lg text-sm font-bold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:border-zinc-700 disabled:text-zinc-500"
              >
                {pendingAction === 'join' ? 'Joining...' : 'Join'}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-red-300 text-sm bg-red-950 border border-red-800 rounded-lg px-3 py-2">
              ⚠ {error}
            </p>
          )}

          {/* Combat record */}
          <div className="p-3 bg-zinc-900 border border-zinc-700 rounded-lg">
            <div className="text-xs text-sky-400 uppercase font-bold mb-2 tracking-widest">Combat Record</div>
            <div className="flex gap-4 sm:block sm:space-y-1">
              <div className="flex justify-between text-sm flex-1 sm:flex-none">
                <span className="text-zinc-400">🏆 Wins</span>
                <span className="text-zinc-200 font-mono ml-2">{stats.wins}</span>
              </div>
              <div className="flex justify-between text-sm flex-1 sm:flex-none">
                <span className="text-zinc-400">💀 Losses</span>
                <span className="text-zinc-200 font-mono ml-2">{stats.losses}</span>
              </div>
              <div className="flex justify-between text-sm flex-1 sm:flex-none sm:pt-1 sm:border-t sm:border-zinc-700">
                <span className="text-zinc-400">Win Rate</span>
                <span className="text-sky-400 font-mono font-bold ml-2">{winRate}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lobby */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-3">
            <div className="text-sm text-sky-400 uppercase font-bold tracking-widest">Open Battles</div>
            <button
              onClick={() => socketRef.current?.emit('room:list')}
              className="min-h-11 text-sm text-zinc-400 hover:text-zinc-200 active:text-zinc-100 transition-colors px-2 py-1"
            >
              ↺ Refresh
            </button>
          </div>
          <LobbyTable rooms={rooms} onJoin={handleJoin} />
        </div>
      </main>
    </div>
  )
}
