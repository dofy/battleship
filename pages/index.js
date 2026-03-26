// pages/index.js
import Head from 'next/head'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { getSocket } from '../lib/socket'
import LobbyTable from '../components/LobbyTable'
import { useLocalStats } from '../hooks/useLocalStats'

export default function Home() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [rooms, setRooms]       = useState([])
  const [isPublic, setIsPublic] = useState(true)
  const [error, setError]       = useState('')
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
    const onError      = ({ message }) => setError(message)

    socket.on('room:list_result', onListResult)
    socket.on('room:created',     onCreated)
    socket.on('room:joined',      onJoined)
    socket.on('error',            onError)

    socket.emit('room:list')

    return () => {
      socket.off('room:list_result', onListResult)
      socket.off('room:created',     onCreated)
      socket.off('room:joined',      onJoined)
      socket.off('error',            onError)
    }
  }, [])

  function saveName() {
    localStorage.setItem('battleship_nickname', nickname)
  }

  function handleCreate() {
    if (!nickname.trim()) return setError('Enter a callsign first')
    saveName()
    setError('')
    socketRef.current.emit('room:create', { nickname: nickname.trim(), isPublic })
  }

  function handleJoin(id) {
    if (!nickname.trim()) return setError('Enter a callsign first')
    saveName()
    setError('')
    socketRef.current.emit('room:join', { roomId: id || roomCode.trim(), nickname: nickname.trim() })
  }

  const winRate = stats.wins + stats.losses > 0
    ? Math.round(stats.wins / (stats.wins + stats.losses) * 100)
    : 0

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Head><title>⚓ Battleship</title></Head>

      {/* Header */}
      <div className="border-b border-zinc-800 px-4 sm:px-6 py-4 flex items-center gap-3">
        <span className="text-2xl">⚓</span>
        <h1 className="text-xl font-bold text-zinc-100 tracking-widest">BATTLESHIP</h1>
        <span className="text-zinc-600 text-sm hidden sm:inline">Naval Combat · 1v1 Live</span>
      </div>

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col sm:flex-row gap-6 sm:gap-8">

        {/* Controls */}
        <div className="w-full sm:w-56 space-y-4 sm:flex-shrink-0">
          {/* Callsign */}
          <div>
            <label className="text-sm text-sky-400 uppercase font-bold block mb-1.5 tracking-widest">
              Callsign
            </label>
            <input
              value={nickname}
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
            className="w-full py-3 bg-sky-700 hover:bg-sky-600 active:bg-sky-800 rounded-lg font-bold text-sm tracking-widest transition-colors"
          >
            + NEW BATTLE
          </button>

          {/* Divider */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-sm text-zinc-600">or</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* Join by code */}
          <div>
            <label className="text-sm text-zinc-500 block mb-1.5">Join by room code</label>
            <div className="flex gap-2">
              <input
                value={roomCode}
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
                className="px-4 py-3 border border-sky-700 text-sky-400 hover:bg-sky-900 active:bg-sky-950 rounded-lg text-sm font-bold whitespace-nowrap transition-colors"
              >
                Join
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-3 py-2">
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
                <span className="text-zinc-500">Win Rate</span>
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
              className="text-sm text-zinc-500 hover:text-zinc-300 active:text-zinc-100 transition-colors px-2 py-1"
            >
              ↺ Refresh
            </button>
          </div>
          <LobbyTable rooms={rooms} onJoin={handleJoin} />
        </div>
      </div>
    </div>
  )
}
