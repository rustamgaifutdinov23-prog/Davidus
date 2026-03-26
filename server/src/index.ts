import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { GameRoom } from './game/GameRoom'
import type { FactionId, GameCommand } from '../../shared/types'
import path from 'path'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

// Serve static client files in production
const clientDist = path.join(__dirname, '../../client/dist')
app.use(express.static(clientDist))
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'))
})

const rooms = new Map<string, GameRoom>()

// Clean room code: 4 uppercase letters
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return rooms.has(code) ? generateRoomCode() : code
}

io.on('connection', (socket) => {
  console.log(`[Davidus] Player connected: ${socket.id}`)
  let currentRoomId: string | null = null

  // ---------- Lobby ----------

  socket.on('createRoom', (data: { name: string; faction: FactionId }, callback) => {
    const roomId = generateRoomCode()
    const room = new GameRoom(roomId, io)
    rooms.set(roomId, room)
    room.addPlayer(socket, data.name, data.faction)
    currentRoomId = roomId
    console.log(`[Davidus] Room ${roomId} created by ${data.name}`)
    callback({ ok: true, roomId })
  })

  socket.on('joinRoom', (data: { roomId: string; name: string; faction: FactionId }, callback) => {
    const room = rooms.get(data.roomId.toUpperCase())
    if (!room) return callback({ ok: false, error: 'Room not found' })
    if (room.playerCount >= room.maxPlayers) return callback({ ok: false, error: 'Room full' })
    room.addPlayer(socket, data.name, data.faction)
    currentRoomId = data.roomId.toUpperCase()
    console.log(`[Davidus] ${data.name} joined room ${currentRoomId}`)
    // Notify others
    socket.to(currentRoomId).emit('playerJoined', { playerId: socket.id, name: data.name, faction: data.faction })
    callback({ ok: true, roomId: currentRoomId, gameState: room.getPublicState() })
  })

  socket.on('startGame', (callback: (r: { ok: boolean; error?: string }) => void) => {
    if (!currentRoomId) return callback({ ok: false, error: 'Not in a room' })
    const room = rooms.get(currentRoomId)
    if (!room) return callback({ ok: false, error: 'Room gone' })
    if (room.playerCount < 2) return callback({ ok: false, error: 'Need at least 2 players' })
    room.startGame()
    callback({ ok: true })
  })

  // ---------- In-game commands ----------

  socket.on('command', (cmd: GameCommand) => {
    if (!currentRoomId) return
    const room = rooms.get(currentRoomId)
    if (!room) return
    room.handleCommand(socket.id, cmd)
  })

  // ---------- Disconnect ----------

  socket.on('disconnect', () => {
    console.log(`[Davidus] Player disconnected: ${socket.id}`)
    if (currentRoomId) {
      const room = rooms.get(currentRoomId)
      if (room) {
        room.removePlayer(socket.id)
        socket.to(currentRoomId).emit('playerLeft', { playerId: socket.id })
      }
    }
  })
})

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`[Davidus] Server running on port ${PORT}`)
})
