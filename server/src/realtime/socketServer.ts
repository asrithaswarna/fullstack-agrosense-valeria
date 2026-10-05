import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { authRepository } from '../repositories/authRepository.js'
import { greenhouseRepository } from '../repositories/greenhouseRepository.js'
import { authService } from '../services/authService.js'
import type {
  ClientToServerEvents,
  InterServerEvents,
  IrrigationUpdatedEvent,
  RealtimeAlert,
  SensorReadingEvent,
  ServerToClientEvents,
  SocketData,
} from './events.js'

export type ValeriaSocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

let socketServer: ValeriaSocketServer | undefined

export function greenhouseRoom(greenhouseId: string): string {
  return `greenhouse:${greenhouseId}`
}

export function createSocketServer(httpServer: HttpServer): ValeriaSocketServer {
  const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, origin === undefined || origin === clientUrl),
    },
  })

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token
    if (typeof token !== 'string' || token.length === 0) {
      next(new Error('Authentication required.'))
      return
    }
    let userId: string
    try {
      userId = authService.validateToken(token).userId
    } catch {
      next(new Error('Authentication required.'))
      return
    }
    try {
      const [user, greenhouseId] = await Promise.all([
        authRepository.findIdentityById(userId),
        greenhouseRepository.findIdByOwnerId(userId),
      ])
      if (!user || !greenhouseId) {
        next(new Error('Authentication required.'))
        return
      }
      socket.data.userId = user.id
      socket.data.greenhouseId = greenhouseId
      next()
    } catch (error) {
      console.error('Socket authorization lookup failed:', error instanceof Error ? error.message : error)
      next(new Error('Authentication required.'))
    }
  })

  io.on('connection', async (socket) => {
    try {
      await socket.join(greenhouseRoom(socket.data.greenhouseId))
      if (process.env.NODE_ENV !== 'production') {
        console.info(`Socket authenticated for user ${socket.data.userId}; joined greenhouse room.`)
      }
    } catch (error) {
      console.error('Socket could not join its authorized greenhouse room:', error instanceof Error ? error.message : error)
      socket.disconnect(true)
    }
    socket.on('disconnect', (reason) => {
      if (process.env.NODE_ENV !== 'production') console.info(`Socket disconnected: ${reason}.`)
    })
  })

  socketServer = io
  return io
}

export function emitSensorReading(reading: SensorReadingEvent): boolean {
  if (!socketServer) return false
  socketServer.to(greenhouseRoom(reading.greenhouseId)).emit('sensor:reading', reading)
  return true
}

export function emitAlert(event: 'alert:created' | 'alert:updated' | 'alert:resolved', alert: RealtimeAlert): boolean {
  if (!socketServer) return false
  socketServer.to(greenhouseRoom(alert.greenhouseId)).emit(event, alert)
  return true
}

export function emitIrrigationUpdate(decision: IrrigationUpdatedEvent): boolean {
  if (!socketServer) return false
  socketServer.to(greenhouseRoom(decision.greenhouseId)).emit('irrigation:updated', decision)
  return true
}

export function clearSocketServer(io: ValeriaSocketServer): void {
  if (socketServer === io) socketServer = undefined
}
