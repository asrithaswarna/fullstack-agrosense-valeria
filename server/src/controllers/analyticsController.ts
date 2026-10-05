import type { Request, Response } from 'express'
import { analyticsService } from '../services/analyticsService.js'
import { sendData } from '../utils/responses.js'
import { authenticatedUserId } from '../utils/requestAuth.js'
import { analyticsRange, queryString, rejectUnknownQuery } from '../utils/validation.js'

export const analyticsController = {
  async get(request: Request, response: Response): Promise<void> {
    rejectUnknownQuery(request, ['range'])
    const range = analyticsRange(queryString(request, 'range') ?? '24h')
    sendData(response, await analyticsService.get(authenticatedUserId(request), range))
  },

  async summary(request: Request, response: Response): Promise<void> {
    rejectUnknownQuery(request, ['range'])
    const range = analyticsRange(queryString(request, 'range') ?? '24h')
    sendData(response, await analyticsService.summary(authenticatedUserId(request), range))
  },
}
