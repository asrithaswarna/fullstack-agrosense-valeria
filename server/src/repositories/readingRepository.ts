import { SensorMeasurementType, SensorStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import type { AnalyticsRange, SensorMeasurementReading, SensorReading } from '../types/domain.js'
import { AppError } from '../utils/AppError.js'

const rangeMilliseconds: Record<AnalyticsRange, number> = {
  '24h': 24 * 60 * 60_000,
  '7d': 7 * 24 * 60 * 60_000,
  '30d': 30 * 24 * 60 * 60_000,
}

export interface ReadingHistoryFilter {
  range?: AnalyticsRange
  from?: Date
  to?: Date
  sensorId?: string
  limit?: number
  order?: 'asc' | 'desc'
  sampled?: boolean
}

export interface IngestedSensorUpdate {
  id: string
  lastReading: string
  soilZoneId: string | null
  soilMoisture?: number
}

export interface IngestedSensorMeasurement {
  sensorId: string
  metric: SensorMeasurementType
  value: number
  recordedAt: Date
  lastReading: string
  soilZoneId: string | null
}

export interface PersistedSensorMeasurementReading extends SensorMeasurementReading {
  id: string
}

const readingMetricFields = {
  temperature: true,
  humidity: true,
  soilMoisture: true,
  lightIntensity: true,
} as const

function toDomain(reading: {
  timestamp: Date
  temperature: number
  humidity: number
  soilMoisture: number
  lightIntensity: number
}): SensorReading {
  return {
    timestamp: reading.timestamp.toISOString(),
    temperature: reading.temperature,
    humidity: reading.humidity,
    soilMoisture: reading.soilMoisture,
    lightIntensity: reading.lightIntensity,
  }
}

export const readingRepository = {
  async latest(greenhouseId: string): Promise<SensorReading> {
    const reading = await prisma.sensorReading.findFirst({
      where: { greenhouseId },
      orderBy: { timestamp: 'desc' },
    })
    if (!reading) throw new AppError('No sensor readings have been recorded yet.', 404)
    const sensors = await prisma.$queryRaw<NonNullable<SensorReading['sensors']>>`
      SELECT DISTINCT ON (s."id", m."metric")
        s."id", s."name", s."type", s."unit", m."metric",
        m."value", m."recordedAt"
      FROM "SensorMeasurement" m
      INNER JOIN "Sensor" s ON s."id" = m."sensorId"
      WHERE m."greenhouseId" = ${greenhouseId}::uuid
      ORDER BY s."id", m."metric", m."recordedAt" DESC
    `
    return {
      ...toDomain(reading),
      sensors: sensors.map((sensor) => ({ ...sensor, recordedAt: new Date(sensor.recordedAt).toISOString() })),
    }
  },

  async history(greenhouseId: string, filter: ReadingHistoryFilter = {}): Promise<SensorReading[]> {
    const from = filter.from ?? new Date(Date.now() - rangeMilliseconds[filter.range ?? '24h'])
    const readings = await prisma.sensorReading.findMany({
      where: {
        greenhouseId,
        timestamp: { gte: from, ...(filter.to ? { lte: filter.to } : {}) },
      },
      orderBy: { timestamp: filter.order ?? 'asc' },
      take: filter.limit ?? 500,
    })
    return readings.map(toDomain)
  },

  async sampledHistory(greenhouseId: string, filter: ReadingHistoryFilter): Promise<SensorReading[]> {
    const from = filter.from ?? new Date(Date.now() - rangeMilliseconds[filter.range ?? '24h'])
    const limit = filter.limit ?? 500
    const readings = await prisma.$queryRaw<{
      timestamp: Date
      temperature: number
      humidity: number
      soilMoisture: number
      lightIntensity: number
    }[]>`
      WITH ordered AS (
        SELECT "timestamp", "temperature", "humidity", "soilMoisture", "lightIntensity",
          NTILE(${limit}::integer) OVER (ORDER BY "timestamp" ASC) AS bucket
        FROM "SensorReading"
        WHERE "greenhouseId" = ${greenhouseId}::uuid
          AND "timestamp" >= ${from}
          AND (${filter.to ?? null}::timestamp IS NULL OR "timestamp" <= ${filter.to ?? null})
      )
      SELECT MIN("timestamp") AS "timestamp",
        AVG("temperature")::double precision AS "temperature",
        AVG("humidity")::double precision AS "humidity",
        AVG("soilMoisture")::double precision AS "soilMoisture",
        AVG("lightIntensity")::double precision AS "lightIntensity"
      FROM ordered
      GROUP BY bucket
      ORDER BY MIN("timestamp") ASC
    `
    return readings.map(toDomain)
  },

  async sensorHistory(greenhouseId: string, filter: ReadingHistoryFilter & { sensorId: string }): Promise<SensorMeasurementReading[]> {
    const sensor = await prisma.sensor.findFirst({
      where: { id: filter.sensorId, greenhouseId },
      select: { id: true },
    })
    if (!sensor) throw new AppError('Sensor not found.', 404)
    const from = filter.from ?? new Date(Date.now() - rangeMilliseconds[filter.range ?? '24h'])
    const measurements = await prisma.sensorMeasurement.findMany({
      where: {
        greenhouseId,
        sensorId: filter.sensorId,
        recordedAt: { gte: from, ...(filter.to ? { lte: filter.to } : {}) },
      },
      orderBy: { recordedAt: filter.order ?? 'asc' },
      take: filter.limit ?? 500,
    })
    const metricNames: Record<SensorMeasurementType, string> = {
      TEMPERATURE: 'temperature',
      HUMIDITY: 'humidity',
      SOIL_MOISTURE: 'soilMoisture',
      LIGHT_INTENSITY: 'lightIntensity',
    }
    return measurements.map((measurement) => ({
      sensorId: measurement.sensorId,
      metric: metricNames[measurement.metric],
      value: measurement.value,
      timestamp: measurement.recordedAt.toISOString(),
    }))
  },

  async analyticsHistory(greenhouseId: string, range: AnalyticsRange): Promise<SensorReading[]> {
    const from = new Date(Date.now() - rangeMilliseconds[range])
    const readings = await prisma.$queryRaw<{
      timestamp: Date
      temperature: number
      humidity: number
      soilMoisture: number
      lightIntensity: number
    }[]>`
      SELECT date_trunc('hour', "timestamp") AS "timestamp",
        AVG("temperature")::double precision AS "temperature",
        AVG("humidity")::double precision AS "humidity",
        AVG("soilMoisture")::double precision AS "soilMoisture",
        AVG("lightIntensity")::double precision AS "lightIntensity"
      FROM "SensorReading"
      WHERE "greenhouseId" = ${greenhouseId}::uuid AND "timestamp" >= ${from}
      GROUP BY date_trunc('hour', "timestamp")
      ORDER BY date_trunc('hour', "timestamp") ASC
    `
    return readings.map(toDomain)
  },

  aggregate(greenhouseId: string, range: AnalyticsRange) {
    const from = new Date(Date.now() - rangeMilliseconds[range])
    return prisma.sensorReading.aggregate({
      where: { greenhouseId, timestamp: { gte: from } },
      _avg: readingMetricFields,
      _min: readingMetricFields,
      _max: readingMetricFields,
    })
  },

  findSensorsForGreenhouse(greenhouseId: string) {
    return prisma.sensor.findMany({
      where: { greenhouseId },
      select: {
        id: true,
        name: true,
        type: true,
        unit: true,
        zoneLabel: true,
        soilZoneId: true,
        lastSeen: true,
      },
    })
  },

  findStaleSensors(cutoff: Date) {
    return prisma.sensor.findMany({
      where: {
        type: { not: 'Irrigation control' },
        OR: [{ lastSeen: null }, { lastSeen: { lt: cutoff } }],
        status: { not: SensorStatus.OFFLINE },
      },
      select: { id: true, greenhouseId: true, name: true, lastSeen: true },
    })
  },

  markSensorOffline(sensorId: string, greenhouseId: string, cutoff: Date) {
    return prisma.sensor.updateMany({
      where: {
        id: sensorId,
        greenhouseId,
        OR: [{ lastSeen: null }, { lastSeen: { lt: cutoff } }],
        status: { not: SensorStatus.OFFLINE },
      },
      data: { status: SensorStatus.OFFLINE },
    })
  },

  async ingestSnapshot(
    greenhouseId: string,
    sensorId: string,
    timestamp: Date,
    values: Omit<SensorReading, 'timestamp'>,
    measurements: { sensorId: string; metric: SensorMeasurementType; value: number }[],
    sensorUpdates: IngestedSensorUpdate[],
  ): Promise<{
    reading: SensorReading
    snapshotId: string
    measurements: {
      id: string
      sensorId: string
      metric: SensorMeasurementType
      value: number
      recordedAt: Date
    }[]
  }> {
    const result = await prisma.$transaction(async (transaction) => {
      const created = await transaction.sensorReading.create({
        data: { greenhouseId, sensorId, timestamp, ...values },
      })
      const persistedMeasurements = await transaction.sensorMeasurement.createManyAndReturn({
        data: measurements.map((measurement) => ({
          greenhouseId,
          sensorId: measurement.sensorId,
          metric: measurement.metric,
          value: measurement.value,
          recordedAt: timestamp,
        })),
        select: { id: true, sensorId: true, metric: true, value: true, recordedAt: true },
      })
      for (const sensor of sensorUpdates) {
        const updated = await transaction.sensor.updateMany({
          where: {
            id: sensor.id,
            greenhouseId,
            OR: [{ lastSeen: null }, { lastSeen: { lte: timestamp } }],
          },
          data: {
            status: SensorStatus.ONLINE,
            lastSeen: timestamp,
            lastReading: sensor.lastReading,
          },
        })
        if (updated.count > 0 && sensor.soilZoneId && sensor.soilMoisture !== undefined) {
          await transaction.soilZone.updateMany({
            where: { id: sensor.soilZoneId, greenhouseId },
            data: { moisture: sensor.soilMoisture },
          })
        }
      }
      return { reading: created, measurements: persistedMeasurements }
    })
    return {
      reading: toDomain(result.reading),
      snapshotId: result.reading.id,
      measurements: result.measurements,
    }
  },

  async ingestMeasurement(greenhouseId: string, measurement: IngestedSensorMeasurement): Promise<PersistedSensorMeasurementReading> {
    const stored = await prisma.$transaction(async (transaction) => {
      const created = await transaction.sensorMeasurement.create({
        data: {
          greenhouseId,
          sensorId: measurement.sensorId,
          metric: measurement.metric,
          value: measurement.value,
          recordedAt: measurement.recordedAt,
        },
      })
      const updated = await transaction.sensor.updateMany({
        where: {
          id: measurement.sensorId,
          greenhouseId,
          OR: [{ lastSeen: null }, { lastSeen: { lte: measurement.recordedAt } }],
        },
        data: {
          status: SensorStatus.ONLINE,
          lastSeen: measurement.recordedAt,
          lastReading: measurement.lastReading,
        },
      })
      if (updated.count > 0 && measurement.soilZoneId && measurement.metric === SensorMeasurementType.SOIL_MOISTURE) {
        await transaction.soilZone.updateMany({
          where: { id: measurement.soilZoneId, greenhouseId },
          data: { moisture: measurement.value },
        })
      }
      return created
    })
    const metricNames: Record<SensorMeasurementType, string> = {
      TEMPERATURE: 'temperature',
      HUMIDITY: 'humidity',
      SOIL_MOISTURE: 'soilMoisture',
      LIGHT_INTENSITY: 'lightIntensity',
    }
    return {
      id: stored.id,
      sensorId: stored.sensorId,
      metric: metricNames[stored.metric],
      value: stored.value,
      timestamp: stored.recordedAt.toISOString(),
    }
  },
}
