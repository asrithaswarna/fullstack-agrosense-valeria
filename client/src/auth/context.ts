import { createContext } from 'react'
import type { User } from '../types/domain'
import type { AuthCredentials, PasswordChangeDetails, RegistrationDetails } from '../services/authService'

export interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (credentials: AuthCredentials, remember?: boolean) => Promise<void>
  register: (details: RegistrationDetails) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (patch: Pick<User, 'name' | 'email'>) => Promise<User>
  changePassword: (details: PasswordChangeDetails) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
