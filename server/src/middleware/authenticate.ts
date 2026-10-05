import type { NextFunction, Request, Response } from 'express'
import { authRepository } from '../repositories/authRepository.js'
import { authService } from '../services/authService.js'
import { AppError } from '../utils/AppError.js'

export async function authenticate(request: Request, _response: Response, next: NextFunction): Promise<void> {
  try {
    const authorization = request.get('authorization')
    const match = authorization?.match(/^Bearer\s+(\S+)$/i)
    if (!match) throw new AppError('Authentication is required.', 401)
    const claims = authService.validateToken(match[1])
    const user = await authRepository.findIdentityById(claims.userId)
    if (!user) throw new AppError('Authentication is required.', 401)
    request.auth = { userId: user.id, role: user.role }
    next()
  } catch (error) {
    next(error)
  }
}
