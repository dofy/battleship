// hooks/useLocalStats.js
import { useState, useEffect, useCallback } from 'react'

const KEY = 'battleship_stats'

function readStats() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { wins: 0, losses: 0 }
  } catch { return { wins: 0, losses: 0 } }
}

export function useLocalStats() {
  // 初始值始终为 0，避免 SSR/客户端水合不一致导致 React 报错
  const [stats, setStats] = useState({ wins: 0, losses: 0 })

  // 客户端水合完成后再读取 localStorage
  useEffect(() => {
    setStats(readStats())
  }, [])

  const recordWin = useCallback(() => {
    const next = { ...readStats(), wins: readStats().wins + 1 }
    localStorage.setItem(KEY, JSON.stringify(next))
    setStats(next)
  }, [])

  const recordLoss = useCallback(() => {
    const next = { ...readStats(), losses: readStats().losses + 1 }
    localStorage.setItem(KEY, JSON.stringify(next))
    setStats(next)
  }, [])

  return { stats, recordWin, recordLoss }
}
