import { io } from 'socket.io-client'
import { realtimeServerUrl } from '../config/env'
import type { RealtimeContextValue, RealtimeSocket } from './context'

let state: RealtimeContextValue = { socket: null, status: 'disconnected' }
let activeUserId: string | undefined
let stopActiveConnection: (() => void) | undefined
const subscribers = new Set<() => void>()

export function subscribeRealtime(listener: () => void): () => void {
  subscribers.add(listener)
  return () => subscribers.delete(listener)
}

export function getRealtimeSnapshot(): RealtimeContextValue {
  return state
}

function updateState(next: RealtimeContextValue): void {
  state = next
  for (const subscriber of subscribers) subscriber()
}

export function startRealtimeConnection(userId: string, token: string): void {
  if (activeUserId === userId && state.socket?.active) return
  stopActiveConnection?.()

  const socket: RealtimeSocket = io(realtimeServerUrl || window.location.origin, {
    auth: { token },
    autoConnect: false,
    path: '/socket.io',
    reconnection: true,
  })
  activeUserId = userId

  const handleConnect = () => {
    updateState({ socket, status: 'connected' })
    window.dispatchEvent(new Event('valeria:socket-connected'))
  }
  const handleDisconnect = () => updateState({ socket, status: 'disconnected' })
  const handleError = (error: Error) => {
    console.warn('VALERIA real-time connection failed:', error.message)
    updateState({ socket, status: 'error' })
  }
  const handleReconnectAttempt = () => updateState({ socket, status: 'connecting' })
  socket.on('connect', handleConnect)
  socket.on('disconnect', handleDisconnect)
  socket.on('connect_error', handleError)
  socket.io.on('reconnect_attempt', handleReconnectAttempt)
  updateState({ socket, status: 'connecting' })
  socket.connect()

  stopActiveConnection = () => {
    socket.off('connect', handleConnect)
    socket.off('disconnect', handleDisconnect)
    socket.off('connect_error', handleError)
    socket.io.off('reconnect_attempt', handleReconnectAttempt)
    socket.disconnect()
    if (state.socket === socket) updateState({ socket: null, status: 'disconnected' })
    if (activeUserId === userId) activeUserId = undefined
    stopActiveConnection = undefined
  }
}

export function stopRealtimeConnection(userId: string): void {
  if (activeUserId !== userId) return
  stopActiveConnection?.()
}
