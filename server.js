// server.js
const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')
const { registerHandlers } = require('./lib/socketHandlers')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    if (parsedUrl.pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok' }))
      return
    }
    handle(req, res, parsedUrl)
  })

  const io = new Server(httpServer, {
    cors: { origin: '*' },
    connectionStateRecovery: {
      maxDisconnectionDuration: 30_000,
      skipMiddlewares: false,
    },
  })

  registerHandlers(io)

  const port = process.env.PORT || 3000
  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
