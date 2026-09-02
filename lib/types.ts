export type Direction = 'H' | 'V'
export type RoomStatus = 'waiting' | 'placing' | 'playing' | 'finished'
export type GameResultState = 'win' | 'lose'
export type GameMode = 'online' | 'computer'

export interface Coordinate {
  row: number
  col: number
}

export interface BoardCell {
  hasShip: boolean
  attacked: boolean
  isBow?: boolean
  isStern?: boolean
  shipDir?: Direction | null
  shipId?: string | null
}

export type GameBoard = BoardCell[][]

export interface ShipDefinition {
  id: string
  name: string
  size: number
}

export interface PlayerState {
  id: string
  socketId: string
  nickname: string
  board: GameBoard
  attacks: boolean[][]
  placingReady: boolean
  connected: boolean
  disconnectDeadline: number | null
  isComputer: boolean
}

export interface GameRoom {
  id: string
  status: RoomStatus
  mode: GameMode
  isPublic: boolean
  players: [PlayerState, PlayerState | null]
  currentTurn: string
  winner: string | null
  rematchVotes: Set<string>
  placingDeadline: number | null
  placingTimer: ReturnType<typeof setTimeout> | null
  turnDeadline: number | null
  turnTimer: ReturnType<typeof setTimeout> | null
}

export interface PlayerSnapshot {
  id: string
  nickname: string
  connected: boolean
  disconnectDeadline: number | null
  placingReady: boolean
  isComputer: boolean
  attacks: boolean[][]
  board: GameBoard
}

export interface RoomSnapshot {
  id: string
  status: RoomStatus
  mode: GameMode
  isPublic: boolean
  currentTurn: string
  turnDeadline: number | null
  winner: string | null
  winnerId: string | null
  canRematch: boolean
  rematchVotes: string[]
  sunkShipIds: string[]
  placingDeadline: number | null
  players: Array<PlayerSnapshot | null>
}

export interface LobbyRoom {
  id: string
  hostNickname: string
}

export interface AttackResult extends Partial<Coordinate> {
  actionId?: string | null
  attackerId?: string
  hit?: boolean
  autoAttack?: boolean
  sunk?: boolean
  shipId?: string
  shipName?: string
  sunkCells?: Coordinate[]
  winner?: string
  winnerId?: string
  reason?: string
  roomClosed?: boolean
}

export interface SocketErrorPayload {
  code?: string
  message?: string
  roomId?: string
}
