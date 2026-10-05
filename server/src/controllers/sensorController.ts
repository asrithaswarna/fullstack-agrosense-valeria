import type { Request, Response } from 'express'
import { sensorService } from '../services/sensorService.js'
import { sendData } from '../utils/responses.js'
import { authenticatedUserId } from '../utils/requestAuth.js'
import { queryString, rejectUnknownQuery, resourceId, sensorStatus } from '../utils/validation.js'

export const sensorController = {
  async list(request: Request, response: Response): Promise<void> {
    rejectUnknownQuery(request, ['status'])
    const status = queryString(request, 'status')
    sendData(response, await sensorService.list(authenticatedUserId(request), status === undefined ? undefined : sensorStatus(status)))
  },

  async get(request: Request, response: Response): Promise<void> {
    sendData(response, await sensorService.get(authenticatedUserId(request), resourceId(request.params.id)))
  },

  async create(request: Request, response: Response): Promise<void> {
    sendData(response, await sensorService.create(authenticatedUserId(request), request.body), 201)
  },

  async update(request: Request, response: Response): Promise<void> {
    sendData(response, await sensorService.update(authenticatedUserId(request), resourceId(request.params.id), request.body))
  },

  async delete(request: Request, response: Response): Promise<void> {
    sendData(response, await sensorService.delete(authenticatedUserId(request), resourceId(request.params.id)))
  },
}
