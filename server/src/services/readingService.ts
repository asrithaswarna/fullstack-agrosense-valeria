import { greenhouseRepository } from '../repositories/greenhouseRepository.js'
import { readingRepository } from '../repositories/readingRepository.js'
import type { ReadingHistoryFilter } from '../repositories/readingRepository.js'
import type { AnalyticsRange, SensorMeasurementReading, SensorReading } from '../types/domain.js'
import { AppError } from '../utils/AppError.js'

async function greenhouseIdFor(ownerId: string): Promise<string> {
  const greenhouseId = await greenhouseRepository.findIdByOwnerId(ownerId)
  if (!greenhouseId) throw new AppError('Greenhouse not found.', 404)
  return greenhouseId
}

export const readingService = {
  async latest(ownerId: string): Promise<SensorReading> {
    return readingRepository.latest(await greenhouseIdFor(ownerId))
  },

  async history(ownerId: string, filter: ReadingHistoryFilter & { range: AnalyticsRange }): Promise<SensorReading[] | SensorMeasurementReading[]> {
    if (filter.from && filter.to && filter.to < filter.from) {
      throw new AppError('end time must be after start time.', 400)
    }
    const greenhouseId = await greenhouseIdFor(ownerId)
    if (filter.sensorId) return readingRepository.sensorHistory(greenhouseId, { ...filter, sensorId: filter.sensorId })
    return filter.sampled
      ? readingRepository.sampledHistory(greenhouseId, filter)
      : readingRepository.history(greenhouseId, filter)
  },
}
