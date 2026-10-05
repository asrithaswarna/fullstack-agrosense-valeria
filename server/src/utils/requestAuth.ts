import type { Request } from 'express'
import { AppError } from './AppError.js'

export function authenticatedUserId(request: Request): string {
  if (!request.auth) throw new AppError('Authentication is required.', 401)
  return request.auth.userId
}
