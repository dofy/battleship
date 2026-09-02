import { useCallback, useEffect, useRef, useState } from 'react'
import { Anchor, Bot, Copy, LogOut, RotateCcw, Share2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { getSocket } from '../lib/socket'
import type { GameSocket } from '../lib/socket'
import { getOrCreatePlayerId } from '../lib/playerIdentity'
import type { AttackAcknowledgement } from '../shared/socketTypes'
import type { AttackResult, Coordinate, GameBoard, GameResultState, RoomSnapshot, SocketErrorPayload } from '../shared/types'
import Board from '../components/Board'
import type { AttackMarker } from '../components/Board'
import ShipPlacer from '../components/ShipPlacer'
import GameStats from '../components/GameStats'
import GameVersion from '../components/GameVersion'
import GameOverOverlay from '../components/GameOverOverlay'
import LeaveBattleDialog from '../components/LeaveBattleDialog'
import { useToast } from '../components/ToastProvider'
import { useLocalStats } from '../hooks/useLocalStats'
import { randomPlaceShips, createEmptyBoard } from '../shared/shipUtils'
import AppFooter from '../components/AppFooter'
import { Button } from '../components/ui/button'
import { Switch } from '../components/ui/switch'

const TURN_SECONDS = 12
const COLS = ['A','B','C','D','E','F','G','H','I','J']
const CONFIRM_SHOTS_STORAGE_KEY = 'battleship_confirm_shots'

function coordLabel(row: number, col: number): string {
  return `${COLS[col]}${row + 1}`
}

function TurnCountdown({ deadline, active }: { deadline: number | null; active: boolean }) {
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
    <div className="ml-3 grid h-7 w-16 shrink-0 grid-rows-[1.25rem_0.25rem] content-between text-right" role="timer" aria-label={active ? `${seconds} seconds remaining` : 'Battle paused'}>
      <span className={`font-mono font-bold tabular-nums ${seconds > 0 && seconds <= 3 ? 'text-red-300' : 'text-zinc-300'}`}>
        {active && deadline ? `${seconds}s` : 'PAUSED'}
      </span>
      <div className="h-1 overflow-hidden rounded-full bg-zinc-700">
        <div
          className={`h-full origin-left rounded-full ${seconds > 0 && seconds <= 3 ? 'bg-red-500' : 'bg-sky-500'}`}
          style={{ transform: `scaleX(${percentage / 100})` }}
        />
      </div>
    </div>
  )
}

function ComputerTurnIndicator() {
  return (
    <div className="ml-3 grid h-7 w-16 shrink-0 grid-rows-[1.25rem_0.25rem] content-between text-right" role="status" aria-label="Computer is thinking">
      <span className="font-mono text-xs font-bold tracking-wider text-sky-400">THINKING…</span>
      <div className="h-1 overflow-hidden rounded-full bg-zinc-700">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-sky-500" />
      </div>
    </div>
  )
}

export default function RoomPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const roomId = id?.toUpperCase() ?? ''
  const [roomState, setRoomState] = useState<RoomSnapshot | null>(null)
  const [myId, setMyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [fatalError, setFatalError] = useState('')
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'reconnecting'>('connecting')
  const [sunkShipIds, setSunkShipIds] = useState<string[]>([])
  const [sunkCellSet, setSunkCellSet] = useState<Set<string>>(() => new Set())
  const [rematchVotes, setRematchVotes] = useState({ votes: 0, total: 2 })
  const [gameResult, setGameResult] = useState<GameResultState | null>(null)
  const [roomClosed, setRoomClosed] = useState(false)
  const [lastAttack, setLastAttack] = useState<AttackMarker | null>(null)
  const [lastDefense, setLastDefense] = useState<AttackMarker | null>(null)
  const [defenseNotice, setDefenseNotice] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState<Coordinate | null>(null)
  const [attackPending, setAttackPending] = useState(false)
  const [confirmShots, setConfirmShots] = useState(false)
  const [boardView, setBoardView] = useState<'target' | 'fleet'>('target')
  const [copied, setCopied] = useState(false)
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const socketRef = useRef<GameSocket | null>(null)
  const myIdRef = useRef<string | null>(null)
  const roomStateRef = useRef<RoomSnapshot | null>(null)
  const attackPendingRef = useRef(false)
  const recordedResultRef = useRef(false)
  const { recordWin, recordLoss } = useLocalStats()
  const showToast = useToast()

  useEffect(() => {
    document.title = roomId ? `⚓ Battleship — Room ${roomId}` : '⚓ Battleship'
  }, [roomId])

  useEffect(() => {
    roomStateRef.current = roomState
  }, [roomState])

  useEffect(() => {
    try {
      setConfirmShots(localStorage.getItem(CONFIRM_SHOTS_STORAGE_KEY) === 'true')
    } catch {
      // Keep the default direct-fire mode when storage is unavailable.
    }
  }, [])

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

    const onRoomJoined = ({ roomState: nextState }: { roomState: RoomSnapshot }) => {
      setFatalError('')
      setRoomClosed(false)
      setRoomState(nextState)
    }

    const onRoomUpdate = ({ roomState: nextState }: { roomState: RoomSnapshot }) => {
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
                  setMessage(hit ? `Incoming fire at ${coordinate} — our fleet was hit.` : `${coordinate} — Enemy shot fell wide.`)
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

    const onGameResult = (result: AttackResult) => {
      const {
        winner, winnerId, hit, sunk, shipId, shipName, sunkCells,
        attackerId, row, col, autoAttack, roomClosed: isClosed,
      } = result
      const wasAttacker = attackerId === myIdRef.current
      const coordinate = typeof row === 'number' && typeof col === 'number' ? coordLabel(row, col) : ''

      if (wasAttacker) {
        attackPendingRef.current = false
        setAttackPending(false)
        setSelectedTarget(null)
        if (typeof row === 'number' && typeof col === 'number') {
          setLastAttack({ row, col, result: hit ? 'hit' : 'miss', ts: Date.now() })
        }
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
          : (isWinner ? `${coordinate} — Final hit. Enemy fleet sent to the bottom.` : 'All ships lost. Your fleet has been destroyed.'))
        if (!recordedResultRef.current) {
          recordedResultRef.current = true
          if (isWinner) recordWin()
          else recordLoss()
        }
      } else if (wasAttacker) {
        const prefix = autoAttack ? `Auto-fired ${coordinate}` : coordinate
        if (sunk) setMessage(`${prefix} — Enemy ${shipName || 'ship'} sunk.`)
        else if (hit) setMessage(`${prefix} — Direct hit.`)
        else setMessage(`${prefix} — Shot fell wide.`)
      }
    }

    const onRematchVote = ({ votes, total }: { votes: number; total: number }) => setRematchVotes({ votes, total })
    const onPlayerDisconnect = ({ nickname, temporary }: { nickname: string; temporary: boolean }) => {
      if (temporary) setMessage(`${nickname} disconnected. Waiting up to 30 seconds to reconnect…`)
    }
    const onPlayerReconnected = ({ nickname }: { nickname: string }) => setMessage(`${nickname} reconnected. Battle resumed.`)
    const onRoomClosed = ({ message: reason }: { message?: string }) => {
      setRoomClosed(true)
      if (!roomStateRef.current) setFatalError(reason || 'This room is closed.')
      else setMessage(reason || 'This room is closed.')
    }
    const onError = ({ code, message: errorMessage, roomId: activeRoomId }: SocketErrorPayload) => {
      attackPendingRef.current = false
      setAttackPending(false)
      setSelectedTarget(null)
      setLastAttack(previous => previous?.result === null ? null : previous)
      if (code === 'ACTIVE_ROOM' && activeRoomId) {
        navigate(`/room/${activeRoomId}`, { replace: true })
        return
      }
      if (!roomStateRef.current && code && ['ROOM_NOT_FOUND', 'ROOM_FULL', 'GAME_UNAVAILABLE'].includes(code)) {
        setFatalError(errorMessage || 'This battle is unavailable.')
      } else {
        showToast({
          title: 'Action failed',
          description: errorMessage || 'Something went wrong. Please try again.',
        })
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
  }, [navigate, roomId, recordLoss, recordWin, showToast])

  useEffect(() => {
    if (roomState?.currentTurn !== myId || roomState?.status !== 'playing') {
      setSelectedTarget(null)
      attackPendingRef.current = false
      setAttackPending(false)
    }
  }, [myId, roomState?.currentTurn, roomState?.status])

  const dismissGameResult = useCallback(() => setGameResult(null), [])

  function handleTargetSelect(row: number, col: number): void {
    if (attackPendingRef.current || roomState?.currentTurn !== myId) return

    const isConfirmedTarget = selectedTarget?.row === row && selectedTarget?.col === col
    if (confirmShots && !isConfirmedTarget) {
      setSelectedTarget({ row, col })
      setMessage(`${coordLabel(row, col)} locked — select the same sector again to fire.`)
      return
    }

    fireAt(row, col)
  }

  function fireAt(row: number, col: number): void {
    if (attackPendingRef.current) return
    const actionId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${row}-${col}`
    attackPendingRef.current = true
    setAttackPending(true)
    setLastAttack({ row, col, result: null, ts: Date.now() })
    socketRef.current?.timeout(5000).emit('game:attack', { row, col, actionId }, (error: Error | null, response?: AttackAcknowledgement) => {
      if (error || !response?.ok) {
        attackPendingRef.current = false
        setAttackPending(false)
        setLastAttack(previous => previous?.result === null ? null : previous)
        showToast({
          title: 'Shot not sent',
          description: response?.message || 'The shot was not confirmed. Try again.',
        })
      }
    })
  }

  function handleConfirmShotsToggle(): void {
    const nextValue = !confirmShots
    setConfirmShots(nextValue)
    setSelectedTarget(null)
    setMessage(nextValue
      ? 'Target lock on — select the same sector twice to fire.'
      : 'Weapons free — select a sector to fire immediately.')
    try {
      localStorage.setItem(CONFIRM_SHOTS_STORAGE_KEY, String(nextValue))
    } catch {
      // The setting still applies for this page session.
    }
  }

  function handleSubmitBoard(board: GameBoard): void {
    socketRef.current?.emit('place:submit', { board })
  }

  function handleRandomBoard(): GameBoard {
    return randomPlaceShips(createEmptyBoard())
  }

  function handleLeave(): void {
    if (roomState?.status === 'playing') {
      setLeaveDialogOpen(true)
      return
    }
    leaveRoom()
  }

  function leaveRoom(): void {
    socketRef.current?.emit('room:leave')
    navigate('/')
  }

  function handleRematch(): void {
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

  async function copyInvite(): Promise<void> {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast({
        title: 'Copy failed',
        description: 'Share the six-character room code instead.',
      })
    }
  }

  async function shareInvite(): Promise<void> {
    if (!navigator.share) return copyInvite()
    try {
      await navigator.share({ title: 'Battleship challenge', text: `Join room ${roomId}`, url: window.location.href })
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'AbortError') await copyInvite()
    }
  }

  if (fatalError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
        <div className="w-full max-w-sm rounded-xl border border-red-900 bg-zinc-900 p-6 text-center">
          <div className="mb-3 text-4xl" aria-hidden="true">⚓</div>
          <h1 className="text-lg font-bold">Unable to join battle</h1>
          <p role="alert" className="mt-2 text-sm text-zinc-300">{fatalError}</p>
          <Button onClick={() => navigate('/')} className="mt-5 w-full">
            Back to Lobby
          </Button>
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
  const isComputerBattle = roomState.mode === 'computer'
  const opponentIsComputer = opponent?.isComputer === true
  const opponentConnected = opponent?.connected !== false
  const canTarget = isMyTurn && opponentConnected && !attackPending
  const visibleSunkShipIds = roomState.sunkShipIds || sunkShipIds
  const visibleSunkCells = new Set<string>(sunkCellSet)
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const cell = opponent?.board[row][col]
      if (cell?.attacked && cell.shipId && visibleSunkShipIds.includes(cell.shipId)) visibleSunkCells.add(`${row},${col}`)
    }
  }
  const defaultMessage = status === 'playing'
    ? (!opponentConnected
      ? 'Battle paused while your opponent reconnects.'
      : isMyTurn
        ? (confirmShots ? 'Target lock required — select the same sector twice.' : 'Fire at will — select a target.')
        : opponentIsComputer
          ? `${opponent.nickname} is plotting a firing solution…`
          : `${opponent?.nickname ?? 'Opponent'} has the watch…`)
    : status === 'finished' ? 'Battle complete.' : ''
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {gameResult && <GameOverOverlay result={gameResult} onDismiss={dismissGameResult} />}
      <LeaveBattleDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        onConfirm={leaveRoom}
        opponentName={opponent?.nickname}
      />

      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <Anchor className="size-5 text-sky-400" aria-hidden="true" />
          <span className="hidden font-mono font-bold tracking-widest text-zinc-100 min-[480px]:inline">BATTLESHIP</span>
          <GameVersion />
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-sm text-zinc-400">
            {!isComputerBattle && <span className="hidden sm:inline">Room </span>}
            <span className="inline-flex items-center gap-1.5 font-mono font-bold tracking-widest text-sky-400">
              {isComputerBattle && <Bot className="size-4" aria-hidden="true" />}
              {isComputerBattle ? 'VS CPU' : roomId}
            </span>
          </div>
          <Button
            onClick={handleLeave}
            variant={status === 'playing' ? 'destructive' : 'outline'}
            className="px-3"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {status === 'playing' ? 'Forfeit' : 'Leave'}
          </Button>
        </div>
      </header>

      {connectionState === 'reconnecting' && (
        <div role="status" className="bg-amber-950 px-4 py-2 text-center text-sm text-amber-200">
          Connection lost. Reconnecting without leaving the battle…
        </div>
      )}

      <main className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-6">
        {(status === 'playing' || status === 'finished' || message) && (
          <div className="mb-3 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm sm:mb-4">
            <div aria-live="polite" className="flex min-h-7 items-center justify-between gap-2 text-zinc-200">
              <span>{message || defaultMessage}</span>
              {status === 'playing' && (opponentIsComputer && !isMyTurn
                ? <ComputerTurnIndicator />
                : <TurnCountdown active={opponentConnected} deadline={roomState.turnDeadline} />)}
            </div>
          </div>
        )}

        {status === 'waiting' && (
          <section className="flex flex-col items-center justify-center space-y-4 py-12 text-center sm:py-20">
            <div className="text-4xl" aria-hidden="true">⚓</div>
            <div>
              <h1 className="text-lg font-medium tracking-widest text-zinc-200">ALL HANDS, STAND BY</h1>
              <p className="mt-2 text-sm text-zinc-400">Awaiting an opposing captain · Share code <span className="font-mono font-bold tracking-widest text-sky-400">{roomId}</span></p>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={copyInvite} className="w-full sm:flex-1">
                <Copy className="size-4" aria-hidden="true" />
                {copied ? 'Copied!' : 'Copy link'}
              </Button>
              <Button onClick={shareInvite} className="w-full sm:flex-1">
                <Share2 className="size-4" aria-hidden="true" />
                Share invite
              </Button>
            </div>
          </section>
        )}

        {status === 'placing' && me && (
          <div className="flex justify-center">
            <ShipPlacer placingDeadline={roomState.placingDeadline} onSubmit={handleSubmitBoard} onRandom={handleRandomBoard} />
          </div>
        )}

        {(status === 'playing' || status === 'finished') && me && opponent && (
          <section className="space-y-3">
            <GameStats roomState={roomState} myId={myId} sunkShipIds={visibleSunkShipIds} />

            <div className="grid grid-cols-2 gap-2 lg:hidden" aria-label="Board view">
              <Button
                aria-pressed={boardView === 'target'}
                onClick={() => setBoardView('target')}
                variant={boardView === 'target' ? 'tactical' : 'outline'}
                className={boardView === 'target' ? 'border-sky-500' : 'bg-zinc-900'}
              >
                Target Grid
              </Button>
              <Button
                aria-pressed={boardView === 'fleet'}
                onClick={() => { setBoardView('fleet'); setDefenseNotice(false) }}
                variant="outline"
                className={`relative ${boardView === 'fleet' ? 'border-teal-500 bg-teal-950 text-teal-200' : 'bg-zinc-900'}`}
              >
                My Fleet
                {defenseNotice && boardView !== 'fleet' && <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-red-400" aria-label="New attack on your fleet" />}
              </Button>
            </div>

            <div className="grid items-start justify-items-center gap-4 lg:grid-cols-2 lg:gap-6">
              <div className={`w-full min-w-0 ${boardView === 'target' ? 'block' : 'hidden lg:block'}`}>
                <Board
                  board={opponent.board}
                  onCellClick={handleTargetSelect}
                  interactive={canTarget}
                  label={`Target: ${opponent.nickname}${opponentConnected ? '' : ' (disconnected)'}`}
                  lastAttack={lastAttack}
                  selectedCell={selectedTarget}
                  pendingCell={attackPending && lastAttack?.result === null ? lastAttack : null}
                  sunkCells={visibleSunkCells}
                  headerAction={status === 'playing' ? (
                    <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800">
                      <span>Confirm</span>
                      <Switch
                        checked={confirmShots}
                        onCheckedChange={handleConfirmShotsToggle}
                        aria-label="Confirm shots"
                        className="h-5 w-9 [&>span]:size-3.5 [&>span]:data-[state=checked]:translate-x-4"
                      />
                    </label>
                  ) : undefined}
                />
              </div>
              <div className={`w-full min-w-0 ${boardView === 'fleet' ? 'block' : 'hidden lg:block'}`}>
                <Board board={me.board} label={`Fleet: ${me.nickname}`} lastAttack={lastDefense} shake={lastDefense?.result === 'hit' ? lastDefense.ts : null} />
              </div>
            </div>

          </section>
        )}

        {status === 'finished' && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {roomState.canRematch && !roomClosed && (
              <Button onClick={handleRematch} size="lg" className="tracking-widest">
                <RotateCcw className="size-4" aria-hidden="true" />
                REMATCH <span className="ml-1 text-sm font-normal text-sky-200">({rematchVotes.votes}/{rematchVotes.total})</span>
              </Button>
            )}
            <Button onClick={handleLeave} variant="secondary" size="lg">
              Back to Lobby
            </Button>
          </div>
        )}
      </main>
      <AppFooter />
    </div>
  )
}
