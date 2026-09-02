const KEY = 'battleship_player_id'

export function getOrCreatePlayerId() {
  const existing = localStorage.getItem(KEY)
  if (existing) return existing
  const id = globalThis.crypto?.randomUUID?.()
    || `player-${Date.now()}-${Math.random().toString(36).slice(2)}`
  localStorage.setItem(KEY, id)
  return id
}
