// hooks/useSocket.js
import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

export function useSocket() {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket = io()
    socketRef.current = socket
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => {
      setConnected(false)
      if (window.location.pathname !== '/') {
        window.location.href = '/'
      }
    })
    return () => socket.disconnect()
  }, [])

  return { socketRef, connected }
}
