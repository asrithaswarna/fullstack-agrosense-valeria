import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'
import jwt, { type SignOptions } from 'jsonwebtoken'
import { authRepository, type SafeUserRecord } from '../repositories/authRepository.js'
import type { User } from '../types/domain.js'
import { AppError } from '../utils/AppError.js'
import { rejectUnknownFields, requiredString, requireObject } from '../utils/validation.js'

export interface AuthResult {
  token: string
  user: User
}

function safeUser(user: SafeUserRecord): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === UserRole.ADMIN ? 'Administrator' : 'Greenhouse manager',
    createdAt: user.createdAt.toISOString(),
  }
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters.')
  return secret
}

function createToken(user: SafeUserRecord): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '1h') as SignOptions['expiresIn']
  return jwt.sign({ role: user.role }, jwtSecret(), { subject: user.id, expiresIn })
}

function emailAddress(value: unknown): string {
  const email = requiredString(value, 'email', 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('Enter a valid email address.', 400)
  return email
}

function passwordValue(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 72 || Buffer.byteLength(value, 'utf8') > 72) {
    throw new AppError('Password must be between 8 and 72 characters.', 400)
  }
  return value
}

export const authService = {
  async register(body: unknown): Promise<AuthResult> {
    const input = requireObject(body)
    rejectUnknownFields(input, ['name', 'email', 'password', 'greenhouseName'])
    const name = requiredString(input.name, 'name', 120)
    const email = emailAddress(input.email)
    const password = passwordValue(input.password)
    const greenhouseName = input.greenhouseName === undefined
      ? 'My Greenhouse'
      : requiredString(input.greenhouseName, 'greenhouseName', 120)

    if (await authRepository.findByEmail(email)) {
      throw new AppError('An account with this email already exists.', 409)
    }
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await authRepository.createAccount({
      name,
      email,
      passwordHash,
      greenhouseName,
    })
    return { token: createToken(user), user: safeUser(user) }
  },

  async login(body: unknown): Promise<AuthResult> {
    const input = requireObject(body)
    rejectUnknownFields(input, ['email', 'password'])
    const email = emailAddress(input.email)
    const password = passwordValue(input.password)
    const user = await authRepository.findByEmail(email)
    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      throw new AppError('Invalid email or password.', 401)
    }
    const safe = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    }
    return { token: createToken(safe), user: safeUser(safe) }
  },

  async getCurrentUser(userId: string): Promise<User> {
    const user = await authRepository.findSafeById(userId)
    if (!user) throw new AppError('Authentication is required.', 401)
    return safeUser(user)
  },

  async updateProfile(userId: string, body: unknown): Promise<User> {
    const input = requireObject(body)
    rejectUnknownFields(input, ['name', 'email'])
    if (Object.keys(input).length === 0) throw new AppError('Provide a name or email to update.', 400)
    const data: { name?: string; email?: string } = {}
    if ('name' in input) data.name = requiredString(input.name, 'name', 120)
    if ('email' in input) data.email = emailAddress(input.email)
    const user = await authRepository.updateProfile(userId, data)
    return safeUser(user)
  },

  async changePassword(userId: string, body: unknown): Promise<{ changed: true }> {
    const input = requireObject(body)
    rejectUnknownFields(input, ['currentPassword', 'newPassword'])
    const currentPassword = passwordValue(input.currentPassword)
    const newPassword = passwordValue(input.newPassword)
    const currentHash = await authRepository.findPasswordHashById(userId)
    if (!currentHash) throw new AppError('Authentication is required.', 401)
    if (!await bcrypt.compare(currentPassword, currentHash)) {
      throw new AppError('Current password is incorrect.', 400)
    }
    const newHash = await bcrypt.hash(newPassword, 12)
    await authRepository.updatePasswordHash(userId, newHash)
    return { changed: true }
  },

  validateToken(token: string): { userId: string; role: UserRole } {
    let payload: string | jwt.JwtPayload
    try {
      payload = jwt.verify(token, jwtSecret())
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) throw new AppError('Authentication is required.', 401)
      throw error
    }
    if (typeof payload === 'string' || typeof payload.sub !== 'string' || typeof payload.role !== 'string') {
      throw new AppError('Authentication is required.', 401)
    }
    if (payload.role !== UserRole.USER && payload.role !== UserRole.ADMIN) {
      throw new AppError('Authentication is required.', 401)
    }
    return { userId: payload.sub, role: payload.role }
  },
}
