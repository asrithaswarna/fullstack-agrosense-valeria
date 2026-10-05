import type { User } from '../types/domain'
import { api, authTokenStorage } from './api'

export interface AuthCredentials {
  email: string
  password: string
}

export interface RegistrationDetails extends AuthCredentials {
  name: string
  greenhouseName?: string
}

export interface PasswordChangeDetails {
  currentPassword: string
  newPassword: string
}

interface AuthResponse {
  token: string
  user: User
}

export const authService = {
  async login(credentials: AuthCredentials, remember = false): Promise<User> {
    const result = await api.post<AuthResponse, AuthCredentials>('/auth/login', credentials)
    authTokenStorage.set(result.token, remember)
    return result.user
  },

  async register(details: RegistrationDetails): Promise<User> {
    const result = await api.post<AuthResponse, RegistrationDetails>('/auth/register', details)
    authTokenStorage.set(result.token, true)
    return result.user
  },

  async logout(): Promise<void> {
    authTokenStorage.clear()
  },

  async getCurrentUser(): Promise<User | null> {
    if (!authTokenStorage.get()) return null
    return api.get<User>('/auth/me')
  },

  async updateProfile(patch: Pick<User, 'name' | 'email'>): Promise<User> {
    return api.patch<User, Pick<User, 'name' | 'email'>>('/auth/profile', patch)
  },

  async changePassword(details: PasswordChangeDetails): Promise<void> {
    await api.patch<{ changed: true }, PasswordChangeDetails>('/auth/password', details)
  },
}
