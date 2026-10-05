import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import { authTokenStorage } from '../services/api'
import { getRealtimeSnapshot, startRealtimeConnection, stopRealtimeConnection, subscribeRealtime } from './connection'
import { RealtimeContext } from './context'

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id
  const token = user ? authTokenStorage.get() : null
  const state = useSyncExternalStore(subscribeRealtime, getRealtimeSnapshot, getRealtimeSnapshot)

  useEffect(() => {
    if (!userId || !token) return
    startRealtimeConnection(userId, token)
    return () => stopRealtimeConnection(userId)
  }, [token, userId])

  return <RealtimeContext.Provider value={state}>{children}</RealtimeContext.Provider>
}
