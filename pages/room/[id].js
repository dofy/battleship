import Head from 'next/head'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { getSocket } from '../../lib/socket'
import { getOrCreatePlayerId } from '../../lib/playerIdentity'
import Board from '../../components/Board'
import ShipPlacer from '../../components/ShipPlacer'
import GameStats from '../../components/GameStats'
import GameOverOverlay from '../../components/GameOverOverlay'
import { useLocalStats } from '../../hooks/useLocalStats'
import { randomPlaceShips, createEmptyBoard } from '../../lib/shipUtils'

const TURN_SECONDS = 12
const COLS = ['A','B','C','D','E','F','G','H','I','J']

function coordLabel(row, col) {
  return `${COLS[col]}${row + 1}`
}

function TurnCountdown({ deadline, active }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!active || !deadline) return undefined
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [active, deadline])

  const remaining = active && deadline ? Math.max(0, deadline - now) : 0
  const seconds = Math.ceil(remaining / 1000)
  const percentage = Math.min(100, (remaining / (TURN_SECONDS * 1000)) * 100)

  return (
    <div className="ml-3 w-16 shrink-0 text-right" role="timer" aria-label={active ? `${seconds} seconds remaining` : 'Battle paused'}>
      <span className={`font-mono font-bold tabular-nums ${seconds > 0 && seconds <= 3 ? 'text-red-300' : 'text-zinc-300'}`}>
        {active && deadline ? `${seconds}s` : 'PAUSED'}
      </span>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-700">
        <div
          className={`h-full origin-left rounded-full ${seconds > 0 && seconds <= 3 ? 'bg-red-500' : 'bg-sky-500'}`}
          style={{ transform: `scaleX(${percentage / 100})` }}
        />
      </div>
    </div>
  )
}

export default function RoomPage() {
  const router = useRouter()
  const { id: roomId } = router.query
  const [roomState, setRoomState] = useState(null)
  const [myId, setMyId] = useState(null)
  const [message, setMessage] = useState('')
  const [fatalError, setFatalError] = useState('')
  const [connectionState, setConnectionState] = useState('connecting')
  const [sunkShipIds, setSunkShipIds] = useState([])
  const [sunkCellSet, setSunkCellSet] = useState(new Set())
  const [rematchVotes, setRematchVotes] = useState({ votes: 0, total: 2 })
  const [gameResult, setGameResult] = useState(null)
  const [roomClosed, setRoomClosed] = useState(false)
  const [lastAttack, setLastAttack] = useState(null)
  const [lastDefense, setLastDefense] = useState(null)
  const [defenseNotice, setDefenseNotice] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState(null)
  const [attackPending, setAttackPending] = useState(false)
  const [boardView, setBoardView] = useState('target')
  const [copied, setCopied] = useState(false)
  const socketRef = useRef(null)
  const myIdRef = useRef(null)
  const roomStateRef = useRef(null)
  const recordedResultRef = useRef(false)
  const { recordWin, recordLoss } = useLocalStats()

  useEffect(() => {
    roomStateRef.current = roomState
  }, [roomState])

  useEffect(() => {
    if (!roomId) return undefined

    const socket = getSocket()
    const playerId = getOrCreatePlayerId()
    socketRef.current = socket
    myIdRef.current = playerId
    setMyId(playerId)

    const joinRoom = () => {
      setConnectionState('connected')
      const nickname = localStorage.getItem('battleship_nickname') || 'Guest'
      socket.emit('room:join', { roomId, nickname, playerId })
    }

    const onRoomJoined = ({ roomState: nextState }) => {
      setFatalError('')
      setRoomClosed(false)
      setRoomState(nextState)
    }

    const onRoomUpdate = ({ roomState: nextState }) => {
      const prev = roomStateRef.current
      const id = myIdRef.current

      if (prev && id) {
        const oldOpponent = prev.players.find(player => player && player.id !== id)
        const nextOpponent = nextState.players.find(player => player && player.id !== id)
        if (oldOpponent && !oldOpponent.connected && nextOpponent?.connected) {
          setMessage(`${nextOpponent.nickname} reconnected. Battle resumed.`)
        }

        const oldBoard = prev.players.find(player => player?.id === id)?.board
        const nextBoard = nextState.players.find(player => player?.id === id)?.board
        if (oldBoard && nextBoard) {
          outer: for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 10; col++) {
              if (!oldBoard[row][col].attacked && nextBoard[row][col].attacked) {
                const hit = nextBoard[row][col].hasShip
                const coordinate = coordLabel(row, col)
                setLastDefense({ row, col, result: hit ? 'hit' : 'miss', ts: Date.now() })
                setDefenseNotice(true)
                if (nextState.status !== 'finished') {
                  setMessage(hit ? `${coordinate} — Your fleet was hit.` : `${coordinate} — Enemy fire missed.`)
                }
                break outer
              }
            }
          }
        }
      }

      setRoomState(nextState)
    }

    const onPlaceTimeout = () => setMessage('Placement time expired. Your fleet was deployed automatically.')

    const onGameResult = (result) => {
      const {
        winner, winnerId, hit, sunk, shipId, shipName, sunkCells,
        attackerId, row, col, autoAttack, roomClosed: isClosed,
      } = result
      const wasAttacker = attackerId === myIdRef.current
      const coordinate = Number.isInteger(row) && Number.isInteger(col) ? coordLabel(row, col) : ''

      if (wasAttacker) {
        setAttackPending(false)
        setSelectedTarget(null)
        setLastAttack({ row, col, result: hit ? 'hit' : 'miss', ts: Date.now() })
      }

      if (sunk && sunkCells && wasAttacker) {
        setSunkCellSet(previous => {
          const next = new Set(previous)
          sunkCells.forEach(cell => next.add(`${cell.row},${cell.col}`))
          return next
        })
        if (shipId) setSunkShipIds(previous => previous.includes(shipId) ? previous : [...previous, shipId])
      }

      if (winner) {
        const isWinner = winnerId === myIdRef.current
        setGameResult(isWinner ? 'win' : 'lose')
        setRoomClosed(!!isClosed)
        setMessage(isClosed
          ? (isWinner ? 'Opponent did not reconnect. Victory by forfeit.' : 'Connection grace period expired.')
          : (isWinner ? `${coordinate} — Final hit. Victory!` : 'Your fleet has been destroyed.'))
        if (!recordedResultRef.current) {
          recordedResultRef.current = true
          if (isWinner) recordWin()
          else recordLoss()
        }
      } else if (wasAttacker) {
        const prefix = autoAttack ? 'Time expired — auto-fired' : coordinate
        if (sunk) setMessage(`${prefix} — Enemy ${shipName || 'ship'} sunk.`)
        else if (hit) setMessage(`${prefix} — Hit.`)
        else setMessage(`${prefix} — Miss.`)
      }
    }

    const onRematchVote = ({ votes, total }) => setRematchVotes({ votes, total })
    const onPlayerDisconnect = ({ nickname, temporary }) => {
      if (temporary) setMessage(`${nickname} disconnected. Waiting up to 30 seconds to reconnect…`)
    }
    const onPlayerReconnected = ({ nickname }) => setMessage(`${nickname} reconnected. Battle resumed.`)
    const onRoomClosed = ({ message: reason }) => {
      setRoomClosed(true)
      if (!roomStateRef.current) setFatalError(reason || 'This room is closed.')
      else setMessage(reason || 'This room is closed.')
    }
    const onError = ({ code, message: errorMessage, roomId: activeRoomId }) => {
      setAttackPending(false)
      setSelectedTarget(null)
      if (code === 'ACTIVE_ROOM' && activeRoomId) {
        router.replace(`/room/${activeRoomId}`)
        return
      }
      if (!roomStateRef.current && ['ROOM_NOT_FOUND', 'ROOM_FULL', 'GAME_UNAVAILABLE'].includes(code)) {
        setFatalError(errorMessage)
      } else {
        setMessage(errorMessage || 'Something went wrong. Please try again.')
      }
    }
    const onDisconnect = () => setConnectionState('reconnecting')
    const onConnectError = () => setConnectionState('reconnecting')

    socket.on('connect', joinRoom)
    socket.on('room:joined', onRoomJoined)
    socket.on('room:update', onRoomUpdate)
    socket.on('place:timeout', onPlaceTimeout)
    socket.on('game:result', onGameResult)
    socket.on('game:rematch_vote', onRematchVote)
    socket.on('player:disconnect', onPlayerDisconnect)
    socket.on('player:reconnected', onPlayerReconnected)
    socket.on('room:closed', onRoomClosed)
    socket.on('error', onError)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)

    if (socket.connected) joinRoom()

    return () => {
      socket.off('connect', joinRoom)
      socket.off('room:joined', onRoomJoined)
      socket.off('room:update', onRoomUpdate)
      socket.off('place:timeout', onPlaceTimeout)
      socket.off('game:result', onGameResult)
      socket.off('game:rematch_vote', onRematchVote)
      socket.off('player:disconnect', onPlayerDisconnect)
      socket.off('player:reconnected', onPlayerReconnected)
      socket.off('room:closed', onRoomClosed)
      socket.off('error', onError)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
    }
  }, [roomId, recordLoss, recordWin, router])

  useEffect(() => {
    if (roomState?.currentTurn !== myId || roomState?.status !== 'playing') {
      setSelectedTarget(null)
      setAttackPending(false)
    }
  }, [myId, roomState?.currentTurn, roomState?.status])

  const dismissGameResult = useCallback(() => setGameResult(null), [])

  function handleTargetSelect(row, col) {
    if (attackPending || roomState?.currentTurn !== myId) return
    setSelectedTarget({ row, col })
  }

  function handleFire() {
    if (!selectedTarget || attackPending) return
    const target = selectedTarget
    const actionId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${target.row}-${target.col}`
    setAttackPending(true)
    setLastAttack({ ...target, result: null, ts: Date.now() })
    socketRef.current?.timeout(5000).emit('game:attack', { ...target, actionId }, (error, response) => {
      if (error || !response?.ok) {
        setAttackPending(false)
        setMessage(response?.message || 'The shot was not confirmed. Try again.')
      }
    })
  }

  function handleSubmitBoard(board) {
    socketRef.current?.emit('place:submit', { board })
  }

  function handleRandomBoard() {
    return randomPlaceShips(createEmptyBoard())
  }

  function handleLeave() {
    if (roomState?.status === 'playing' && !window.confirm('Leave this battle and forfeit the match?')) return
    socketRef.current?.emit('room:leave')
    router.push('/')
  }

  function handleRematch() {
    setSunkShipIds([])
    setSunkCellSet(new Set())
    setRematchVotes({ votes: 0, total: 2 })
    setMessage('Rematch requested. Waiting for your opponent…')
    setGameResult(null)
    setLastAttack(null)
    setLastDefense(null)
    setSelectedTarget(null)
    setRoomClosed(false)
    recordedResultRef.current = false
    socketRef.current?.emit('game:rematch')
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setMessage('Copy failed. Share the six-character room code instead.')
    }
  }

  async function shareInvite() {
    if (!navigator.share) return copyInvite()
    try {
      await navigator.share({ title: 'Battleship challenge', text: `Join room ${roomId}`, url: window.location.href })
    } catch (error) {
      if (error?.name !== 'AbortError') copyInvite()
    }
  }

  if (fatalError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
        <div className="w-full max-w-sm rounded-xl border border-red-900 bg-zinc-900 p-6 text-center">
          <div className="mb-3 text-4xl" aria-hidden="true">⚓</div>
          <h1 className="text-lg font-bold">Unable to join battle</h1>
          <p role="alert" className="mt-2 text-sm text-zinc-300">{fatalError}</p>
          <button type="button" onClick={() => router.push('/')} className="mt-5 min-h-11 w-full rounded-lg bg-sky-700 px-4 py-3 font-bold hover:bg-sky-600">
            Back to Lobby
          </button>
        </div>
      </main>
    )
  }

  if (!roomState) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="space-y-3 text-center" role="status">
          <div className="text-3xl" aria-hidden="true">⚓</div>
          <p className="tracking-widest text-zinc-400">{connectionState === 'reconnecting' ? 'RECONNECTING…' : 'CONNECTING…'}</p>
        </div>
      </main>
    )
  }

  const me = roomState.players.find(player => player?.id === myId)
  const opponent = roomState.players.find(player => player && player.id !== myId)
  const status = roomState.status
  const isMyTurn = status === 'playing' && roomState.currentTurn === myId
  const opponentConnected = opponent?.connected !== false
  const canTarget = isMyTurn && opponentConnected && !attackPending
  const visibleSunkShipIds = roomState.sunkShipIds || sunkShipIds
  const visibleSunkCells = new Set(sunkCellSet)
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const cell = opponent?.board[row][col]
      if (cell?.attacked && visibleSunkShipIds.includes(cell.shipId)) visibleSunkCells.add(`${row},${col}`)
    }
  }
  const defaultMessage = status === 'playing'
    ? (!opponentConnected
      ? 'Battle paused while your opponent reconnects.'
      : isMyTurn ? 'Your turn — choose a target, then fire.' : `Waiting for ${opponent?.nickname ?? 'opponent'}…`)
    : status === 'finished' ? 'Battle complete.' : ''

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Head><title>⚓ Battleship — Room {roomId}</title></Head>

      {gameResult && <GameOverOverlay result={gameResult} onDismiss={dismissGameResult} />}

      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden="true">⚓</span>
          <span className="hidden font-mono font-bold tracking-widest text-zinc-100 min-[380px]:inline">BATTLESHIP</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-sm text-zinc-400">
            <span className="hidden sm:inline">Room </span>
            <span className="font-mono font-bold tracking-widest text-sky-400">{roomId}</span>
          </div>
          <button type="button" onClick={handleLeave} className="min-h-11 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
            {status === 'playing' ? 'Forfeit' : 'Leave'}
          </button>
        </div>
      </header>

      {connectionState === 'reconnecting' && (
        <div role="status" className="bg-amber-950 px-4 py-2 text-center text-sm text-amber-200">
          Connection lost. Reconnecting without leaving the battle…
        </div>
      )}

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8">
        {(status === 'playing' || status === 'finished' || message) && (
          <div className="mb-4 rounded-lg border border-zinc-700 bg-zinc-900 px-4 pb-2.5 pt-3 text-sm sm:mb-6">
            <div aria-live="polite" className="flex min-h-5 items-center justify-between gap-2 text-zinc-200">
              <span>{message || defaultMessage}</span>
              {status === 'playing' && <TurnCountdown active={opponentConnected} deadline={roomState.turnDeadline} />}
            </div>
          </div>
        )}

        {status === 'waiting' && (
          <section className="flex flex-col items-center justify-center space-y-5 py-16 text-center sm:py-24">
            <div className="text-5xl" aria-hidden="true">⚓</div>
            <div>
              <h1 className="text-lg font-medium tracking-widest text-zinc-200">AWAITING OPPONENT…</h1>
              <p className="mt-2 text-sm text-zinc-400">Share room code <span className="font-mono font-bold tracking-widest text-sky-400">{roomId}</span></p>
            </div>
            <div className="flex w-full max-w-xs gap-2">
              <button type="button" onClick={copyInvite} className="min-h-11 flex-1 rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800">
                {copied ? 'Copied!' : 'Copy link'}
              </button>
              <button type="button" onClick={shareInvite} className="min-h-11 flex-1 rounded-lg bg-sky-700 px-4 py-2 text-sm font-bold hover:bg-sky-600">
                Share invite
              </button>
            </div>
          </section>
        )}

        {status === 'placing' && me && (
          <div className="flex justify-center">
            <ShipPlacer placingDeadline={roomState.placingDeadline} onSubmit={handleSubmitBoard} onRandom={handleRandomBoard} />
          </div>
        )}

        {(status === 'playing' || status === 'finished') && me && opponent && (
          <section className="space-y-4">
            <GameStats roomState={roomState} myId={myId} sunkShipIds={visibleSunkShipIds} />

            <div className="grid grid-cols-2 gap-2 lg:hidden" aria-label="Board view">
              <button
                type="button"
                aria-pressed={boardView === 'target'}
                onClick={() => setBoardView('target')}
                className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-bold ${boardView === 'target' ? 'border-sky-500 bg-sky-950 text-sky-200' : 'border-zinc-700 bg-zinc-900 text-zinc-300'}`}
              >
                Target Grid
              </button>
              <button
                type="button"
                aria-pressed={boardView === 'fleet'}
                onClick={() => { setBoardView('fleet'); setDefenseNotice(false) }}
                className={`relative min-h-11 rounded-lg border px-3 py-2 text-sm font-bold ${boardView === 'fleet' ? 'border-teal-500 bg-teal-950 text-teal-200' : 'border-zinc-700 bg-zinc-900 text-zinc-300'}`}
              >
                My Fleet
                {defenseNotice && boardView !== 'fleet' && <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-red-400" aria-label="New attack on your fleet" />}
              </button>
            </div>

            <div className="grid items-start justify-items-center gap-5 lg:grid-cols-2 lg:gap-8">
              <div className={`w-full min-w-0 ${boardView === 'target' ? 'block' : 'hidden lg:block'}`}>
                <Board
                  board={opponent.board}
                  onCellClick={handleTargetSelect}
                  interactive={canTarget}
                  label={`Target: ${opponent.nickname}${opponentConnected ? '' : ' (disconnected)'}`}
                  lastAttack={lastAttack}
                  selectedCell={selectedTarget}
                  sunkCells={visibleSunkCells}
                />
              </div>
              <div className={`w-full min-w-0 ${boardView === 'fleet' ? 'block' : 'hidden lg:block'}`}>
                <Board board={me.board} label={`Fleet: ${me.nickname}`} lastAttack={lastDefense} shake={lastDefense?.result === 'hit' ? lastDefense.ts : null} />
              </div>
            </div>

            {status === 'playing' && isMyTurn && boardView === 'target' && (
              <div className="mx-auto flex max-w-sm items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
                <div className="min-w-0 flex-1">
                  <div className="text-xs uppercase tracking-widest text-zinc-400">Target locked</div>
                  <div className="whitespace-nowrap font-mono text-sm font-bold text-sky-300">{selectedTarget ? coordLabel(selectedTarget.row, selectedTarget.col) : 'Select a sector'}</div>
                </div>
                <button
                  type="button"
                  disabled={!selectedTarget || attackPending || !opponentConnected}
                  onClick={handleFire}
                  className="min-h-11 min-w-28 rounded-lg bg-red-700 px-5 py-2 font-bold tracking-widest hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                >
                  {attackPending ? 'FIRING…' : 'FIRE'}
                </button>
              </div>
            )}
          </section>
        )}

        {status === 'finished' && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {roomState.canRematch && !roomClosed && (
              <button type="button" onClick={handleRematch} className="min-h-11 rounded-lg bg-sky-700 px-6 py-3 font-bold tracking-widest hover:bg-sky-600">
                REMATCH <span className="ml-1 text-sm font-normal text-sky-200">({rematchVotes.votes}/{rematchVotes.total})</span>
              </button>
            )}
            <button type="button" onClick={handleLeave} className="min-h-11 rounded-lg bg-zinc-800 px-6 py-3 text-zinc-200 hover:bg-zinc-700">
              Back to Lobby
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
