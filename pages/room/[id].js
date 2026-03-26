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

const TURN_SECONDS = 12
const COLS = ['A','B','C','D','E','F','G','H','I','J']
function coordLabel(row, col) { return `${COLS[col]}${row}` }

export default function RoomPage() {
  const router = useRouter()
  const { id: roomId } = router.query
  const [roomState, setRoomState] = useState(null)
  const [myId, setMyId]           = useState(null)
  const [message, setMessage]     = useState('')
  const [sunkShipNames, setSunkShipNames]   = useState([])
  const [rematchVotes, setRematchVotes]     = useState({ votes: 0, total: 2 })
  const [gameResult, setGameResult]         = useState(null)
  const [lastAttack, setLastAttack]         = useState(null)
  const [lastDefense, setLastDefense]       = useState(null)
  const [turnCountdown, setTurnCountdown]   = useState(null)
  const [sunkCellSet, setSunkCellSet]       = useState(new Set())
  const socketRef         = useRef(null)
  const myIdRef           = useRef(null)
  const roomStateRef      = useRef(null)
  const countdownTimerRef = useRef(null)
  const pendingAttackRef  = useRef(null)   // { row, col } of my in-flight attack
  const { recordWin, recordLoss } = useLocalStats()

  useEffect(() => { roomStateRef.current = roomState }, [roomState])

  useEffect(() => {
    if (!roomId) return

    const socket = getSocket()
    socketRef.current = socket

    const onConnect = () => {
      myIdRef.current = socket.id
      setMyId(socket.id)
      const nickname = localStorage.getItem('battleship_nickname') || '游客'
      socket.emit('room:join', { roomId, nickname })
    }

    const onRoomJoined = ({ roomState }) => setRoomState(roomState)

    const onRoomUpdate = ({ roomState: newState }) => {
      const id   = myIdRef.current
      const prev = roomStateRef.current

      // 检测对方攻击我方棋盘：当前轮次是对方，比较我方格子变化
      if (prev && id && prev.currentTurn !== id) {
        const myOld = prev.players.find(p => p?.id === id)
        const myNew = newState.players.find(p => p?.id === id)
        if (myOld && myNew) {
          outer: for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 10; c++) {
              if (!myOld.board[r][c].attacked && myNew.board[r][c].attacked) {
                const hit   = myNew.board[r][c].hasShip
                const coord = coordLabel(r, c)
                setLastDefense({ row: r, col: c, result: hit ? 'hit' : 'miss', ts: Date.now() })
                // 游戏结束的消息让 onGameResult 负责
                if (newState.status !== 'finished') {
                  setMessage(hit
                    ? `💥 ${coord} — Direct hit! Hull damaged`
                    : `🌊 ${coord} — Missed! Near miss`)
                }
                break outer
              }
            }
          }
        }
      }

      setRoomState(newState)
    }

    const onPlaceTimeout = () => setMessage('⏰ Placement timeout — fleet deployed randomly')

    const onGameResult = ({ winner, hit, sunk, shipName, sunkCells }) => {
      const myNickname   = localStorage.getItem('battleship_nickname') || ''
      const wasAttacker  = pendingAttackRef.current !== null
      const isHit        = !!(winner || hit || sunk)
      const coord        = pendingAttackRef.current ? coordLabel(pendingAttackRef.current.row, pendingAttackRef.current.col) : ''
      pendingAttackRef.current = null

      setLastAttack(prev => (prev && prev.result === null)
        ? { ...prev, result: isHit ? 'hit' : 'miss', ts: Date.now() }
        : prev
      )

      // Track sunk ship cells on opponent board (only for the attacker)
      if (sunk && sunkCells && wasAttacker) {
        setSunkCellSet(prev => {
          const next = new Set(prev)
          sunkCells.forEach(({ row, col }) => next.add(`${row},${col}`))
          return next
        })
      }

      if (winner) {
        const isWinner = winner === myNickname
        setGameResult(isWinner ? 'win' : 'lose')
        if (isWinner) {
          setMessage(`🏆 ${coord} — Final blow! All enemy ships sunk. Victory!`)
          recordWin()
        } else {
          setMessage(`💀 Fleet destroyed. Defeat...`)
          recordLoss()
        }
      } else if (sunk && shipName) {
        setSunkShipNames(prev => [...prev, shipName])
        setMessage(`💥 ${coord} — Sunk! Enemy ${shipName} destroyed!`)
      } else if (hit) {
        setMessage(`🎯 ${coord} — Hit! Enemy ship ablaze!`)
      } else {
        setMessage(`🌊 ${coord} — Miss. Adjust and fire again`)
      }
    }

    const onRematchVote   = ({ votes, total }) => setRematchVotes({ votes, total })
    const onPlayerDisconnect = ({ nickname }) => setMessage(`🔌 ${nickname} disconnected — you win!`)
    const onError         = ({ message }) => setMessage(`⚠️ ${message}`)
    const onDisconnect    = () => router.push('/')

    socket.on('connect',           onConnect)
    socket.on('room:joined',       onRoomJoined)
    socket.on('room:update',       onRoomUpdate)
    socket.on('place:timeout',     onPlaceTimeout)
    socket.on('game:result',       onGameResult)
    socket.on('game:rematch_vote', onRematchVote)
    socket.on('player:disconnect', onPlayerDisconnect)
    socket.on('error',             onError)
    socket.on('disconnect',        onDisconnect)

    if (socket.connected) onConnect()

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

  // 回合倒计时
  useEffect(() => {
    clearInterval(countdownTimerRef.current)
    const isMyTurn = roomState?.status === 'playing' && myId && roomState.currentTurn === myId
    if (!isMyTurn) { setTurnCountdown(null); return }

    setTurnCountdown(TURN_SECONDS)
    countdownTimerRef.current = setInterval(() => {
      setTurnCountdown(prev => {
        if (prev === null) return null
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current)
          const room = roomStateRef.current
          const id   = myIdRef.current
          if (room && id && socketRef.current) {
            const opp = room.players.find(p => p && p.id !== id)
            if (opp) {
              const cells = []
              for (let r = 0; r < 10; r++)
                for (let c = 0; c < 10; c++)
                  if (!opp.board[r][c].attacked) cells.push([r, c])
              if (cells.length > 0) {
                const [row, col] = cells[Math.floor(Math.random() * cells.length)]
                pendingAttackRef.current = { row, col }
                setLastAttack({ row, col, result: null, ts: Date.now() })
                socketRef.current.emit('game:attack', { row, col })
              }
            }
          }
          return null
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(countdownTimerRef.current)
  }, [roomState?.currentTurn, roomState?.status, myId])

  function handleAttack(row, col) {
    pendingAttackRef.current = { row, col }
    setLastAttack({ row, col, result: null, ts: Date.now() })
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
    setSunkCellSet(new Set())
    setRematchVotes({ votes: 0, total: 2 })
    setMessage('')
    setGameResult(null)
    setLastAttack(null)
    setLastDefense(null)
    setTurnCountdown(null)
    pendingAttackRef.current = null
    socketRef.current?.emit('game:rematch')
  }

  if (!roomState) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-3xl">⚓</div>
          <p className="text-zinc-500 tracking-widest">CONNECTING...</p>
        </div>
      </div>
    )
  }

  const me       = roomState.players.find(p => p?.id === myId)
  const opponent = roomState.players.find(p => p && p.id !== myId)
  const status   = roomState.status
  const isMyTurn = status === 'playing' && roomState.currentTurn === myId

  // Default status text when no message
  const defaultMsg = status === 'playing'
    ? (isMyTurn ? '⚔️ Your turn — select a target' : `⏳ Waiting for ${opponent?.nickname ?? 'opponent'}...`)
    : status === 'finished'
    ? '🏁 Battle over'
    : null

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Head><title>⚓ Battleship — Room {roomId}</title></Head>

      {gameResult && (
        <GameOverOverlay result={gameResult} onDismiss={() => setGameResult(null)} />
      )}

      {/* Nav */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">⚓</span>
          <span className="font-bold text-zinc-100 tracking-widest">BATTLESHIP</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-zinc-600">
            Room
            <span className="ml-1.5 text-sky-400 font-mono font-bold tracking-widest">{roomId}</span>
          </div>
          <button
            onClick={handleLeave}
            className="text-sm text-zinc-500 hover:text-zinc-300 px-2 py-1 border border-zinc-700 rounded transition-colors"
          >
            Leave
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Status bar: always reserved during playing/finished to prevent layout shift */}
        {(status === 'playing' || status === 'finished' || message) && (
          <div className={`mb-6 px-4 pt-3 pb-2.5 rounded-lg border text-sm ${
            message
              ? 'bg-zinc-800 border-zinc-600 text-zinc-200'
              : 'bg-zinc-900 border-zinc-800 text-zinc-500'
          }`}>
            <div className="flex items-center justify-between min-h-[20px]">
              <span>{message || defaultMsg}</span>
              {status === 'playing' && turnCountdown !== null && (
                <span className={`text-sm font-mono font-bold tabular-nums ml-3 ${
                  turnCountdown <= 3 ? 'text-red-400' : 'text-zinc-400'
                }`}>
                  {turnCountdown}s
                </span>
              )}
            </div>
            {/* Progress bar: always occupies height during playing */}
            <div className="mt-2 h-1 bg-zinc-700 rounded-full overflow-hidden">
              {status === 'playing' && (
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                    turnCountdown !== null && turnCountdown <= 3
                      ? 'bg-red-500'
                      : isMyTurn ? 'bg-sky-500' : 'bg-zinc-600'
                  }`}
                  style={{ width: turnCountdown !== null ? `${(turnCountdown / TURN_SECONDS) * 100}%` : '0%' }}
                />
              )}
            </div>
          </div>
        )}

        {/* Waiting */}
        {status === 'waiting' && (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="text-5xl">⚓</div>
            <p className="text-zinc-300 text-lg font-medium tracking-widest">AWAITING OPPONENT...</p>
            <p className="text-zinc-600 text-sm">
              Share room code
              <span className="mx-1.5 text-sky-400 font-mono font-bold tracking-widest">{roomId}</span>
              with a friend
            </p>
          </div>
        )}

        {/* Placement phase */}
        {status === 'placing' && me && (
          <div className="flex justify-center">
            <ShipPlacer
              placingDeadline={roomState.placingDeadline}
              onSubmit={handleSubmitBoard}
              onRandom={handleRandomBoard}
            />
          </div>
        )}

        {/* Battle phase */}
        {(status === 'playing' || status === 'finished') && me && opponent && (
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 items-center lg:items-start justify-center">
              <Board
                board={opponent.board}
                onCellClick={status === 'playing' ? handleAttack : undefined}
                interactive={isMyTurn}
                label={`Enemy: ${opponent.nickname}`}
                lastAttack={lastAttack}
                sunkCells={sunkCellSet}
              />
              <Board
                board={me.board}
                label={`Fleet: ${me.nickname}`}
                lastAttack={lastDefense}
                shake={lastDefense?.result === 'hit' ? lastDefense.ts : null}
              />
            </div>
            <GameStats roomState={roomState} myId={myId} sunkShipNames={sunkShipNames} />
          </div>
        )}

        {/* Game over actions */}
        {status === 'finished' && (
          <div className="mt-8 flex gap-3 items-center">
            <button
              onClick={handleRematch}
              className="px-6 py-2.5 bg-sky-700 hover:bg-sky-600 rounded-lg font-bold tracking-widest transition-colors"
            >
              REMATCH
              <span className="ml-1.5 text-sky-300 text-sm font-normal">
                ({rematchVotes.votes}/{rematchVotes.total})
              </span>
            </button>
            <button
              onClick={handleLeave}
              className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors"
            >
              Back to Lobby
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

