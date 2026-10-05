import { createContext } from 'react'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, RealtimeConnectionStatus, ServerToClientEvents } from './events'

export type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export interface RealtimeContextValue {
  socket: RealtimeSocket | null
  status: RealtimeConnectionStatus
}

export const RealtimeContext = createContext<RealtimeContextValue | null>(null)
