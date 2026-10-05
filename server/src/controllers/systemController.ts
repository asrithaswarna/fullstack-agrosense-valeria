import type { Request, Response } from 'express'
import { systemService } from '../services/systemService.js'
import { sendData } from '../utils/responses.js'
import { authenticatedUserId } from '../utils/requestAuth.js'
import { AppError } from '../utils/AppError.js'

export const systemController = {
  async status(_request: Request, response: Response): Promise<void> {
    sendData(response, await systemService.status())
  },

  async irrigation(request: Request, response: Response): Promise<void> {
    const status = await systemService.irrigationStatus(authenticatedUserId(request))
    if (!status) throw new AppError('Greenhouse not found.', 404)
    sendData(response, status)
  },
}
