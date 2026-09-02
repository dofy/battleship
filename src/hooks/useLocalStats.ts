import { useCallback, useState } from 'react'

const KEY = 'battleship_stats'

export interface LocalStats {
  wins: number
  losses: number
}

function readStats(): LocalStats {
  try {
    const stored = localStorage.getItem(KEY)
    if (!stored) return { wins: 0, losses: 0 }
    const parsed: unknown = JSON.parse(stored)
    if (
      typeof parsed === 'object' && parsed !== null
      && 'wins' in parsed && typeof parsed.wins === 'number'
      && 'losses' in parsed && typeof parsed.losses === 'number'
    ) {
      return { wins: parsed.wins, losses: parsed.losses }
    }
    return { wins: 0, losses: 0 }
  } catch { return { wins: 0, losses: 0 } }
}

export function useLocalStats() {
  const [stats, setStats] = useState<LocalStats>(readStats)

  const recordWin = useCallback(() => {
    const current = readStats()
    const next = { ...current, wins: current.wins + 1 }
    localStorage.setItem(KEY, JSON.stringify(next))
    setStats(next)
  }, [])

  const recordLoss = useCallback(() => {
    const current = readStats()
    const next = { ...current, losses: current.losses + 1 }
    localStorage.setItem(KEY, JSON.stringify(next))
    setStats(next)
  }, [])

  return { stats, recordWin, recordLoss }
}
