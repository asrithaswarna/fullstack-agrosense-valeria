import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authService, type AuthCredentials, type RegistrationDetails } from '../services/authService'
import type { User } from '../types/domain'
import { AuthContext } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const handleUnauthorized = () => setUser(null)
    window.addEventListener('valeria:unauthorized', handleUnauthorized)
    authService.getCurrentUser()
      .then((currentUser) => { if (active) setUser(currentUser) })
      .catch(() => { if (active) setUser(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => {
      active = false
      window.removeEventListener('valeria:unauthorized', handleUnauthorized)
    }
  }, [])

  const login = useCallback(async (credentials: AuthCredentials, remember = false) => {
    const signedInUser = await authService.login(credentials, remember)
    setUser(signedInUser)
  }, [])

  const register = useCallback(async (details: RegistrationDetails) => {
    const registeredUser = await authService.register(details)
    setUser(registeredUser)
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  const updateProfile = useCallback(async (patch: Pick<User, 'name' | 'email'>) => {
    const updatedUser = await authService.updateProfile(patch)
    setUser(updatedUser)
    return updatedUser
  }, [])

  const changePassword = useCallback(async (details: Parameters<typeof authService.changePassword>[0]) => {
    await authService.changePassword(details)
  }, [])

  const value = useMemo(() => ({ user, loading, login, register, logout, updateProfile, changePassword }), [
    user, loading, login, register, logout, updateProfile, changePassword,
  ])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
