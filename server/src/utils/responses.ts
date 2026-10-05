import type { Response } from 'express'
import type { ApiSuccess } from '../types/domain.js'

export function sendData<T>(response: Response, data: T, statusCode = 200): void {
  response.status(statusCode).json({ success: true, data } satisfies ApiSuccess<T>)
}
