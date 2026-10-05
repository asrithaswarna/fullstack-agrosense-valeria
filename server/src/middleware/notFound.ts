import type { Request, Response } from 'express'
import type { ApiFailure } from '../types/domain.js'

export function notFound(_request: Request, response: Response): void {
  response.status(404).json({ success: false, message: 'Route not found.' } satisfies ApiFailure)
}
