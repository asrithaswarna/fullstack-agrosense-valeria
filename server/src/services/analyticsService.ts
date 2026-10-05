import { greenhouseRepository } from '../repositories/greenhouseRepository.js'
import { readingRepository } from '../repositories/readingRepository.js'
import type { AnalyticsMetricSummary, AnalyticsRange, AnalyticsSummary, SensorReading } from '../types/domain.js'
import { AppError } from '../utils/AppError.js'

const metricDefinitions = [
  { name: 'Temperature', unit: '°C', key: 'temperature', color: '#b66b48' },
  { name: 'Humidity', unit: '%', key: 'humidity', color: '#638b8a' },
  { name: 'Soil moisture', unit: '%', key: 'soilMoisture', color: '#82956a' },
  { name: 'Light intensity', unit: 'lux', key: 'lightIntensity', color: '#b99a56' },
] as const

function summarize(
  readings: SensorReading[],
  definition: typeof metricDefinitions[number],
  aggregate: { _avg: Record<string, number | null>; _min: Record<string, number | null>; _max: Record<string, number | null> },
): AnalyticsMetricSummary {
  const field = definition.key
  const round = (value: number | null): number => Number((value ?? 0).toFixed(1))
  return {
    name: definition.name,
    unit: definition.unit,
    average: round(aggregate._avg[field]),
    minimum: round(aggregate._min[field]),
    maximum: round(aggregate._max[field]),
    values: readings.map((reading) => reading[field]),
    color: definition.color,
  }
}

async function summarizeFor(ownerId: string, range: AnalyticsRange): Promise<AnalyticsMetricSummary[]> {
  const greenhouseId = await greenhouseRepository.findIdByOwnerId(ownerId)
  if (!greenhouseId) throw new AppError('Greenhouse not found.', 404)
  const [readings, aggregate] = await Promise.all([
    readingRepository.analyticsHistory(greenhouseId, range),
    readingRepository.aggregate(greenhouseId, range),
  ])
  return metricDefinitions.map((definition) => summarize(readings, definition, aggregate))
}

export const analyticsService = {
  async get(ownerId: string, range: AnalyticsRange): Promise<AnalyticsSummary> {
    return {
      range,
      metrics: await summarizeFor(ownerId, range),
      generatedAt: new Date().toISOString(),
    }
  },

  async summary(ownerId: string, range: AnalyticsRange): Promise<AnalyticsMetricSummary[]> {
    return summarizeFor(ownerId, range)
  },
}
