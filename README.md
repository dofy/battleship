# ⚓ Battleship — 1v1 Multiplayer Naval Combat

Real-time multiplayer Battleship game. Create or join a room, place your fleet, and sink the enemy.

## Tech Stack

- **Next.js 16** — Pages Router + Custom Server
- **Socket.IO 4** — Real-time bidirectional communication (shared HTTP server)
- **Tailwind CSS v4** — Responsive zinc/sky/teal interface
- **System fonts** — No render-blocking external font request
- **In-memory state** — Game state stored in Node.js process memory (`Map`), no external database

## Features

- Create public/private rooms, or join via 6-character room code
- Public room lobby with live status
- Placement phase: manually or randomly deploy ships, 90-second countdown (auto-random on timeout)
- Turn-based combat with 12-second per-turn countdown (auto random attack on timeout)
- Hit / miss / sunk feedback with coordinate labels (e.g. `B4 — Direct hit!`)
- Visual attack animations: 💥 explosion for hits, ripple rings for misses — on both offense and defense boards
- Full-screen Victory / Defeat overlay with confetti and animations
- Rematch voting after game ends
- Stable player identity with a 30-second reconnect grace period
- Local `localStorage` win/loss record

## Fleet Configuration

| Ship | Cells | Count |
|------|-------|-------|
| Carrier | 5 | 1 |
| Battleship | 4 | 1 |
| Cruiser | 3 | 1 |
| Destroyer | 3 | 1 |
| Submarine | 2 | 1 |

## Quick Start

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Development
pnpm dev

# Production
pnpm build && pnpm start
```

Open `http://localhost:3000` to play.

## Project Structure

```
battleship/
├── server.js                   # Next.js Custom Server + Socket.IO init
├── lib/
│   ├── gameStore.js            # In-memory game state management
│   ├── socketHandlers.js       # Socket.IO event handlers
│   ├── shipUtils.js            # Core game logic (ship placement, hit detection)
│   ├── socket.js               # Client-side Socket.IO singleton
│   └── playerIdentity.js       # Stable local player identity for reconnects
├── pages/
│   ├── _app.js                 # Global font, favicon
│   ├── index.js                # Lobby (create/join room, combat record)
│   └── room/[id].js            # Game room (placement + combat)
├── components/
│   ├── Board.js                # 10×10 grid with attack animations
│   ├── ShipPlacer.js           # Touch- and keyboard-friendly fleet placement
│   ├── LobbyTable.js           # Public room list
│   ├── GameStats.js            # Combat sidebar (fleet status, shot stats)
│   └── GameOverOverlay.js      # Full-screen Victory/Defeat animation
├── hooks/
│   └── useLocalStats.js        # localStorage win/loss hook
└── public/
    └── favicon.svg             # Anchor icon in sky/zinc palette
```

## Tests

```bash
pnpm test
```

## Railway deployment

`railway.json` configures the `/healthz` deployment health check and restart policy. Game rooms remain in process memory, so the service must stay at one replica; a deploy or process restart ends active rooms. Horizontal scaling or restart-safe matches require moving room state to a shared store and using a Socket.IO adapter such as Redis.
