import { createServer } from 'node:http'
import path from 'node:path'
import { Server } from 'socket.io'
import sirv from 'sirv'
import { registerHandlers } from './socketHandlers.js'
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../shared/socketTypes.js'

const isProduction = process.env.NODE_ENV === 'production'
const serveClient = isProduction
  ? sirv(path.resolve(process.cwd(), 'dist'), { dev: false, single: true })
  : null

const httpServer = createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname

  if (pathname === '/healthz') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ status: 'ok' }))
    return
  }

  if (serveClient) {
    serveClient(request, response)
    return
  }

  response.writeHead(404, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify({ message: 'Use the Vite development server on port 3000.' }))
})

const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
  cors: { origin: '*' },
  connectionStateRecovery: {
    maxDisconnectionDuration: 30_000,
    skipMiddlewares: false,
  },
})

registerHandlers(io)

const port = Number(process.env.PORT) || (isProduction ? 3000 : 3001)
httpServer.listen(port, () => {
  console.log(`> Realtime server ready on http://localhost:${port}`)
})
