// pages/room/[id].js
import Head from 'next/head'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { getSocket } from '../../lib/socket'
import Board from '../../components/Board'
import ShipPlacer from '../../components/ShipPlacer'
import GameStats from '../../components/GameStats'
import GameOverOverlay from '../../components/GameOverOverlay'
import { useLocalStats } from '../../hooks/useLocalStats'
import { randomPlaceShips, createEmptyBoard } from '../../lib/shipUtils'

export default function RoomPage() {
  const router = useRouter()
  const { id: roomId } = router.query
  const [roomState, setRoomState] = useState(null)
  const [myId, setMyId]           = useState(null)
  const [message, setMessage]     = useState('')
  const [sunkShipNames, setSunkShipNames]   = useState([])
  const [rematchVotes, setRematchVotes]     = useState({ votes: 0, total: 2 })
  const [gameResult, setGameResult]         = useState(null)   // 'win' | 'lose' | null
  const socketRef = useRef(null)
  const { recordWin, recordLoss } = useLocalStats()

  useEffect(() => {
    if (!roomId) return

    const socket = getSocket()
    socketRef.current = socket

    const onConnect = () => {
      setMyId(socket.id)
      const nickname = localStorage.getItem('battleship_nickname') || '游客'
      socket.emit('room:join', { roomId, nickname })
    }

    const onRoomJoined = ({ roomState }) => setRoomState(roomState)
    const onRoomUpdate = ({ roomState }) => setRoomState(roomState)
    const onPlaceTimeout = () => setMessage('布局超时，已自动随机布置')

    const onGameResult = ({ winner, hit, sunk, shipName }) => {
      const myNickname = localStorage.getItem('battleship_nickname') || ''
      if (winner) {
        const isWinner = winner === myNickname
        setMessage(isWinner ? '🏆 你赢了！' : '💀 你输了...')
        setGameResult(isWinner ? 'win' : 'lose')
        if (isWinner) recordWin(); else recordLoss()
      } else if (sunk && shipName) {
        setSunkShipNames(prev => [...prev, shipName])
        setMessage(`击沉了对方 ${shipName}！`)
      } else if (hit) {
        setMessage('命中！')
      } else {
        setMessage('未中')
      }
    }

    const onRematchVote = ({ votes, total }) => setRematchVotes({ votes, total })
    const onPlayerDisconnect = ({ nickname }) => setMessage(`${nickname} 断线了，你获胜！`)
    const onError = ({ message }) => setMessage(`⚠️ ${message}`)
    const onDisconnect = () => router.push('/')

    socket.on('connect',           onConnect)
    socket.on('room:joined',       onRoomJoined)
    socket.on('room:update',       onRoomUpdate)
    socket.on('place:timeout',     onPlaceTimeout)
    socket.on('game:result',       onGameResult)
    socket.on('game:rematch_vote', onRematchVote)
    socket.on('player:disconnect', onPlayerDisconnect)
    socket.on('error',             onError)
    socket.on('disconnect',        onDisconnect)

    if (socket.connected) {
      onConnect()
    }

    return () => {
      socket.off('connect',           onConnect)
      socket.off('room:joined',       onRoomJoined)
      socket.off('room:update',       onRoomUpdate)
      socket.off('place:timeout',     onPlaceTimeout)
      socket.off('game:result',       onGameResult)
      socket.off('game:rematch_vote', onRematchVote)
      socket.off('player:disconnect', onPlayerDisconnect)
      socket.off('error',             onError)
      socket.off('disconnect',        onDisconnect)
    }
  }, [roomId])

  function handleAttack(row, col) {
    socketRef.current?.emit('game:attack', { row, col })
  }

  function handleSubmitBoard(board) {
    socketRef.current?.emit('place:submit', { board })
  }

  function handleRandomBoard() {
    return randomPlaceShips(createEmptyBoard())
  }

  function handleLeave() {
    socketRef.current?.emit('room:leave')
    router.push('/')
  }

  function handleRematch() {
    setSunkShipNames([])
    setRematchVotes({ votes: 0, total: 2 })
    setMessage('')
    setGameResult(null)
    socketRef.current?.emit('game:rematch')
  }

  if (!roomState) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-3xl">🚢</div>
          <p className="text-gray-400">连接中...</p>
        </div>
      </div>
    )
  }

  const me       = roomState.players.find(p => p?.id === myId)
  const opponent = roomState.players.find(p => p && p.id !== myId)
  const status   = roomState.status

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Head><title>🚢 Battleship! — 房间 {roomId}</title></Head>

      {gameResult && (
        <GameOverOverlay result={gameResult} onDismiss={() => setGameResult(null)} />
      )}

      {/* 顶部导航 */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🚢</span>
          <span className="font-bold text-white">Battleship</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            房间码
            <span className="ml-1.5 text-indigo-400 font-mono font-bold tracking-widest">{roomId}</span>
          </div>
          <button
            onClick={handleLeave}
            className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 border border-gray-700 rounded"
          >
            离开
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* 消息提示 */}
        {message && (
          <div className="mb-6 px-4 py-3 bg-indigo-900 border border-indigo-700 rounded-lg text-sm text-indigo-200">
            {message}
          </div>
        )}

        {/* 等待阶段 */}
        {status === 'waiting' && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="text-5xl">⚓</div>
            <p className="text-gray-300 text-lg font-medium">等待对手加入...</p>
            <p className="text-gray-600 text-sm">
              将房间码
              <span className="mx-1.5 text-indigo-400 font-mono font-bold tracking-widest">{roomId}</span>
              发给朋友
            </p>
          </div>
        )}

        {/* 布局阶段 */}
        {status === 'placing' && me && (
          <ShipPlacer
            placingDeadline={roomState.placingDeadline}
            onSubmit={handleSubmitBoard}
            onRandom={handleRandomBoard}
          />
        )}

        {/* 对战阶段 */}
        {(status === 'playing' || status === 'finished') && me && opponent && (
          <div className="flex gap-8 items-start">
            <Board
              board={opponent.board}
              onCellClick={status === 'playing' ? handleAttack : undefined}
              interactive={status === 'playing' && roomState.currentTurn === myId}
              label={`敌方：${opponent.nickname}`}
            />
            <Board
              board={me.board}
              label={`我方：${me.nickname}`}
            />
            <GameStats roomState={roomState} myId={myId} sunkShipNames={sunkShipNames} />
          </div>
        )}

        {/* 游戏结束 */}
        {status === 'finished' && (
          <div className="mt-8 flex gap-3 items-center">
            <button
              onClick={handleRematch}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold"
            >
              再战一局
              <span className="ml-1.5 text-indigo-300 text-sm font-normal">
                ({rematchVotes.votes}/{rematchVotes.total})
              </span>
            </button>
            <button
              onClick={handleLeave}
              className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300"
            >
              返回大厅
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
