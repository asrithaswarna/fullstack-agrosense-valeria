import type { Request, Response } from 'express'
import { alertService } from '../services/alertService.js'
import { sendData } from '../utils/responses.js'
import { authenticatedUserId } from '../utils/requestAuth.js'
import { alertStatus, queryString, rejectUnknownQuery, resourceId } from '../utils/validation.js'

export const alertController = {
  async list(request: Request, response: Response): Promise<void> {
    rejectUnknownQuery(request, ['status'])
    const status = queryString(request, 'status')
    sendData(response, await alertService.list(authenticatedUserId(request), status === undefined ? undefined : alertStatus(status)))
  },

  async active(request: Request, response: Response): Promise<void> {
    sendData(response, await alertService.list(authenticatedUserId(request), 'Active'))
  },

  async get(request: Request, response: Response): Promise<void> {
    sendData(response, await alertService.get(authenticatedUserId(request), resourceId(request.params.id)))
  },

  async update(request: Request, response: Response): Promise<void> {
    sendData(response, await alertService.update(authenticatedUserId(request), resourceId(request.params.id), request.body))
  },
}
