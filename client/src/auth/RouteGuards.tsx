import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="auth-loading" role="status">Preparing your greenhouse…</div>
  return user ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="auth-loading" role="status">Preparing your greenhouse…</div>
  return user ? <Navigate to="/dashboard" replace /> : children
}
