import type { Request, Response } from 'express'
import { readingService } from '../services/readingService.js'
import { AppError } from '../utils/AppError.js'
import { sendData } from '../utils/responses.js'
import { authenticatedUserId } from '../utils/requestAuth.js'
import { sensorReadingIngestionService } from '../services/sensorReadingIngestionService.js'
import { analyticsRange, parseDate, queryString, rejectUnknownQuery } from '../utils/validation.js'

export const readingController = {
  async latest(request: Request, response: Response): Promise<void> {
    sendData(response, await readingService.latest(authenticatedUserId(request)))
  },

  async history(request: Request, response: Response): Promise<void> {
    rejectUnknownQuery(request, ['range', 'sensorId', 'start', 'end', 'limit', 'order', 'sample'])
    const range = analyticsRange(queryString(request, 'range') ?? '24h')
    const sensorId = queryString(request, 'sensorId')
    const start = queryString(request, 'start')
    const end = queryString(request, 'end')
    const rawLimit = queryString(request, 'limit')
    const rawOrder = queryString(request, 'order')
    const rawSample = queryString(request, 'sample')
    let limit: number | undefined
    if (rawLimit !== undefined) {
      limit = Number(rawLimit)
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
        throw new AppError('limit must be a whole number from 1 to 1000.', 400)
      }
    }
    if (rawOrder !== undefined && rawOrder !== 'asc' && rawOrder !== 'desc') {
      throw new AppError('order must be asc or desc.', 400)
    }
    if (rawSample !== undefined && rawSample !== 'true' && rawSample !== 'false') {
      throw new AppError('sample must be true or false.', 400)
    }
    sendData(response, await readingService.history(authenticatedUserId(request), {
      range,
      ...(sensorId === undefined ? {} : { sensorId }),
      ...(start === undefined ? {} : { from: new Date(parseDate(start, 'start')) }),
      ...(end === undefined ? {} : { to: new Date(parseDate(end, 'end')) }),
      ...(limit === undefined ? {} : { limit }),
      ...(rawOrder === undefined ? {} : { order: rawOrder }),
      ...(rawSample === undefined ? {} : { sampled: rawSample === 'true' }),
    }))
  },

  async create(request: Request, response: Response): Promise<void> {
    sendData(response, await sensorReadingIngestionService.ingestForOwner(authenticatedUserId(request), request.body), 201)
  },
}
