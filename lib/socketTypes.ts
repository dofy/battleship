import type { GameBoard, LobbyRoom, RoomSnapshot, SocketErrorPayload, AttackResult } from './types.js'

export interface ServerToClientEvents {
  'room:list_result': (payload: { rooms: LobbyRoom[] }) => void
  'room:created': (payload: { roomId: string; roomState: RoomSnapshot; resumed?: boolean }) => void
  'room:joined': (payload: { roomState: RoomSnapshot; recovered?: boolean }) => void
  'room:update': (payload: { roomState: RoomSnapshot }) => void
  'place:timeout': () => void
  'game:result': (payload: AttackResult) => void
  'game:rematch_vote': (payload: { votes: number; total: number }) => void
  'player:disconnect': (payload: { nickname: string; temporary: boolean; disconnectDeadline?: number }) => void
  'player:reconnected': (payload: { nickname: string }) => void
  'room:closed': (payload: { reason?: string; message?: string }) => void
  error: (payload: SocketErrorPayload) => void
}

export interface AttackAcknowledgement {
  ok: boolean
  actionId?: string | null
  code?: string
  message?: string
}

export interface ClientToServerEvents {
  'room:create': (payload: { nickname?: unknown; isPublic?: unknown; playerId?: unknown; mode?: unknown }) => void
  'room:join': (payload: { roomId?: unknown; nickname?: unknown; playerId?: unknown }) => void
  'room:list': () => void
  'room:leave': () => void
  'place:submit': (payload: { board?: unknown }) => void
  'game:attack': (
    payload: { row?: unknown; col?: unknown; actionId?: unknown },
    acknowledge: (response: AttackAcknowledgement) => void,
  ) => void
  'game:rematch': () => void
}

export interface InterServerEvents {}

export interface SocketData {
  playerId?: string
}
