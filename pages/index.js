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
    socketRef.current.emit('room:create', { nickname: nickname.trim(), isPublic })
  }

  function handleJoin(id) {
    if (!nickname.trim()) return setError('请输入昵称')
    saveName()
    socketRef.current.emit('room:join', { roomId: id || roomCode.trim(), nickname: nickname.trim() })
  }

  const winRate = stats.wins + stats.losses > 0
    ? Math.round(stats.wins / (stats.wins + stats.losses) * 100)
    : 0

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <Head><title>🚢 Battleship!</title></Head>

      <h1 className="text-5xl font-bold mb-10">🚢 Battleship!</h1>

      <div className="flex gap-8 w-full max-w-3xl">
        {/* 左侧操作 */}
        <div className="w-56 space-y-4">
          <div>
            <label className="text-xs text-indigo-400 uppercase font-bold block mb-1">你的昵称</label>
            <input value={nickname} onChange={e => setNickname(e.target.value)}
                   className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                   placeholder="输入昵称..." />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)}
                   className="rounded" />
            公开房间（显示在大厅）
          </label>

          <button onClick={handleCreate}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded font-bold text-sm">
            + 创建新房间
          </button>

          <div className="flex gap-2">
            <input value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())}
                   placeholder="房间码"
                   className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm min-w-0" />
            <button onClick={() => handleJoin()}
                    className="px-3 py-2 border border-indigo-500 text-indigo-400 rounded text-sm whitespace-nowrap">
              加入
            </button>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {/* 战绩 */}
          <div className="p-3 bg-gray-900 border border-gray-800 rounded">
            <div className="text-xs text-indigo-400 uppercase font-bold mb-2">本地战绩</div>
            <div className="text-sm text-gray-400 space-y-1">
              <div>🏆 胜场：{stats.wins}</div>
              <div>💀 败场：{stats.losses}</div>
              <div>胜率：{winRate}%</div>
            </div>
          </div>
        </div>

        {/* 右侧大厅 */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-3">
            <div className="text-xs text-indigo-400 uppercase font-bold">公开房间大厅</div>
            <button onClick={() => socketRef.current?.emit('room:list')}
                    className="text-xs text-gray-500 hover:text-gray-300">↺ 刷新</button>
          </div>
          <LobbyTable rooms={rooms} onJoin={handleJoin} />
        </div>
      </div>
    </div>
  )
}
