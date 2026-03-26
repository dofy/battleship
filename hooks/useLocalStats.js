// hooks/useLocalStats.js
import { useState, useCallback } from 'react'

const KEY = 'battleship_stats'

function readStats() {
  if (typeof window === 'undefined') return { wins: 0, losses: 0 }
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { wins: 0, losses: 0 }
  } catch { return { wins: 0, losses: 0 } }
}

export function useLocalStats() {
  const [stats, setStats] = useState(readStats)

  const recordWin = useCallback(() => {
    if (typeof window === 'undefined') return
    const current = readStats()
    const next = { ...current, wins: current.wins + 1 }
    localStorage.setItem(KEY, JSON.stringify(next))
    setStats(next)
  }, [])

  const recordLoss = useCallback(() => {
    if (typeof window === 'undefined') return
    const current = readStats()
    const next = { ...current, losses: current.losses + 1 }
    localStorage.setItem(KEY, JSON.stringify(next))
    setStats(next)
  }, [])

  return { stats, recordWin, recordLoss }
}
