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
    if (!nickname.trim()) return setError('请输入昵称')
    saveName()
    setError('')
    socketRef.current.emit('room:create', { nickname: nickname.trim(), isPublic })
  }

  function handleJoin(id) {
    if (!nickname.trim()) return setError('请输入昵称')
    saveName()
    setError('')
    socketRef.current.emit('room:join', { roomId: id || roomCode.trim(), nickname: nickname.trim() })
  }

  const winRate = stats.wins + stats.losses > 0
    ? Math.round(stats.wins / (stats.wins + stats.losses) * 100)
    : 0

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Head><title>🚢 Battleship!</title></Head>

      {/* 顶部标题栏 */}
      <div className="border-b border-slate-800 px-8 py-5 flex items-center gap-3">
        <span className="text-2xl">🚢</span>
        <h1 className="text-xl font-bold text-slate-100">Battleship</h1>
        <span className="text-slate-600 text-sm">海战棋 · 1v1 实时对战</span>
      </div>

      {/* 主内容居中 */}
      <div className="max-w-3xl mx-auto px-6 py-10 flex gap-8">

        {/* 左侧：操作区 */}
        <div className="w-56 space-y-4 flex-shrink-0">
          {/* 昵称 */}
          <div>
            <label className="text-xs text-indigo-400 uppercase font-bold block mb-1.5 tracking-wide">
              你的昵称
            </label>
            <input
              value={nickname}
              onChange={e => { setNickname(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm outline-none transition-colors"
              placeholder="输入昵称..."
            />
          </div>

          {/* 公开选项 */}
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={e => setIsPublic(e.target.checked)}
              className="rounded accent-indigo-500"
            />
            公开（显示在大厅）
          </label>

          {/* 创建按钮 */}
          <button
            onClick={handleCreate}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold text-sm transition-colors"
          >
            + 创建新房间
          </button>

          {/* 分隔 */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-600">或</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* 加入房间 */}
          <div>
            <label className="text-xs text-slate-500 block mb-1.5">通过房间码加入</label>
            <div className="flex gap-2">
              <input
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                placeholder="XXXXXX"
                maxLength={6}
                className="flex-1 bg-slate-800 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm font-mono outline-none transition-colors min-w-0"
              />
              <button
                onClick={() => handleJoin()}
                className="px-3 py-2 border border-indigo-600 text-indigo-400 hover:bg-indigo-900/40 rounded-lg text-sm transition-colors whitespace-nowrap"
              >
                加入
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/40 rounded px-2 py-1">
              ⚠ {error}
            </p>
          )}

          {/* 战绩 */}
          <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
            <div className="text-xs text-indigo-400 uppercase font-bold mb-2 tracking-wide">本地战绩</div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">🏆 胜场</span>
                <span className="text-slate-200 font-mono">{stats.wins}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">💀 败场</span>
                <span className="text-slate-200 font-mono">{stats.losses}</span>
              </div>
              <div className="flex justify-between text-sm pt-1 border-t border-slate-700/50">
                <span className="text-slate-500">胜率</span>
                <span className="text-indigo-400 font-mono font-bold">{winRate}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：大厅 */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-3">
            <div className="text-xs text-indigo-400 uppercase font-bold tracking-wide">公开房间大厅</div>
            <button
              onClick={() => socketRef.current?.emit('room:list')}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              ↺ 刷新
            </button>
          </div>
          <LobbyTable rooms={rooms} onJoin={handleJoin} />
        </div>
      </div>
    </div>
  )
}
