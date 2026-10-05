import type { Request, Response } from 'express'
import { greenhouseService } from '../services/greenhouseService.js'
import { sendData } from '../utils/responses.js'
import { authenticatedUserId } from '../utils/requestAuth.js'

export const greenhouseController = {
  async get(request: Request, response: Response): Promise<void> {
    sendData(response, await greenhouseService.get(authenticatedUserId(request)))
  },

  async update(request: Request, response: Response): Promise<void> {
    sendData(response, await greenhouseService.update(authenticatedUserId(request), request.body))
  },
}
