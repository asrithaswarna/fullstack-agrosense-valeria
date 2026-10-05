import { SensorMeasurementType } from '@prisma/client'
import { greenhouseRepository } from '../repositories/greenhouseRepository.js'
import { readingRepository } from '../repositories/readingRepository.js'
import type { IngestedSensorMeasurement, IngestedSensorUpdate } from '../repositories/readingRepository.js'
import type { SensorMeasurementReading, SensorReading } from '../types/domain.js'
import { AppError } from '../utils/AppError.js'
import { emitSensorReading } from '../realtime/socketServer.js'
import { alertEngine } from './alertEngine.js'
import { irrigationIntelligence } from './irrigationIntelligence.js'
import { sensorConfiguration } from './sensorConfiguration.js'
import { rejectUnknownFields, requireObject } from '../utils/validation.js'

export type ReadingMetric = 'temperature' | 'humidity' | 'soilMoisture' | 'lightIntensity'

interface Measurement {
  sensorId: string
  metric: ReadingMetric
  value: number
}

interface ValidatedReading {
  recordedAt: Date
  measurements: Measurement[]
}

const metricNames: readonly ReadingMetric[] = ['temperature', 'humidity', 'soilMoisture', 'lightIntensity']
const metricNamesByType: Record<SensorMeasurementType, ReadingMetric> = {
  TEMPERATURE: 'temperature',
  HUMIDITY: 'humidity',
  SOIL_MOISTURE: 'soilMoisture',
  LIGHT_INTENSITY: 'lightIntensity',
}

async function evaluateIntelligence(
  greenhouseId: string,
  measurements: { sensorId: string; metric: ReadingMetric; value: number }[],
  sensors: Map<string, { name: string }>,
): Promise<void> {
  try {
    const thresholds = await greenhouseRepository.findThresholdsById(greenhouseId)
    if (!thresholds) throw new Error('Greenhouse thresholds could not be loaded.')
    await alertEngine.evaluateMeasurements(greenhouseId, thresholds, measurements, sensors)
  } catch (error) {
    console.error('Environmental alert evaluation failed after reading persistence:', error instanceof Error ? error.message : error)
  }
  for (const measurement of measurements) {
    if (measurement.metric === 'soilMoisture') {
      await irrigationIntelligence.evaluate(greenhouseId, measurement.sensorId, measurement.value)
    }
  }
}

async function resolveRecentSensors(
  greenhouseId: string,
  measurements: { sensorId: string; recordedAt: Date }[],
): Promise<void> {
  const cutoff = Date.now() - sensorConfiguration().staleAfterMs
  const recentSensorIds = new Set(
    measurements.filter((measurement) => measurement.recordedAt.getTime() >= cutoff).map((measurement) => measurement.sensorId),
  )
  for (const sensorId of recentSensorIds) {
    await alertEngine.resolveSensorOnline(greenhouseId, sensorId)
  }
}

function parseUuid(value: unknown, name: string): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new AppError(`${name} must be a valid sensor ID.`, 400)
  }
  return value
}

function parseTimestamp(value: unknown): Date {
  if (value !== undefined && (typeof value !== 'string' || Number.isNaN(Date.parse(value)))) {
    throw new AppError('recordedAt must be a valid timestamp.', 400)
  }
  const recordedAt = value === undefined ? new Date() : new Date(value as string)
  if (recordedAt.getTime() > Date.now() + 5 * 60_000) {
    throw new AppError('recordedAt cannot be more than five minutes in the future.', 400)
  }
  return recordedAt
}

function parseMetric(value: unknown): ReadingMetric {
  if (typeof value !== 'string' || !metricNames.includes(value as ReadingMetric)) {
    throw new AppError('metric must be temperature, humidity, soilMoisture, or lightIntensity.', 400)
  }
  return value as ReadingMetric
}

function parseValue(value: unknown, metric: ReadingMetric): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AppError(`${metric} value must be a finite number.`, 400)
  }
  const { minimum, maximum } = sensorConfiguration().ranges[metric]
  if (value < minimum || value > maximum) {
    throw new AppError(`${metric} must be between ${minimum} and ${maximum}.`, 400)
  }
  return value
}

function parseReading(value: unknown): ValidatedReading {
  const input = requireObject(value)
  rejectUnknownFields(input, ['recordedAt', 'measurements'])
  const recordedAt = parseTimestamp(input.recordedAt)
  if (!Array.isArray(input.measurements) || input.measurements.length < metricNames.length || input.measurements.length > 100) {
    throw new AppError('measurements must contain 4 to 100 sensor values.', 400)
  }

  const measurements: Measurement[] = []
  const seen = new Set<string>()
  for (const entry of input.measurements) {
    const item = requireObject(entry, 'Each measurement')
    rejectUnknownFields(item, ['sensorId', 'metric', 'value'])
    const sensorId = parseUuid(item.sensorId, 'sensorId')
    const metric = parseMetric(item.metric)
    const numericValue = parseValue(item.value, metric)
    const key = `${sensorId}:${metric}`
    if (seen.has(key)) throw new AppError('A sensor cannot report the same measurement twice in one reading.', 400)
    seen.add(key)
    measurements.push({ sensorId, metric, value: numericValue })
  }
  for (const metric of metricNames) {
    if (!measurements.some((measurement) => measurement.metric === metric)) {
      throw new AppError(`At least one ${metric} measurement is required.`, 400)
    }
  }
  return { recordedAt, measurements }
}

function compatible(sensor: { name: string; type: string }, metric: ReadingMetric): boolean {
  const kind = `${sensor.name} ${sensor.type}`.toLowerCase()
  switch (metric) {
    case 'temperature': return kind.includes('temperature') || kind.includes('temp') || kind.includes('dht')
    case 'humidity': return kind.includes('humidity') || kind.includes('dht')
    case 'soilMoisture': return kind.includes('soil') || kind.includes('moisture') || kind.includes('capacitive')
    case 'lightIntensity': return kind.includes('light') || kind.includes('ldr')
  }
}

function mean(values: number[]): number {
  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(1))
}

async function ingest(greenhouseId: string, body: unknown): Promise<SensorReading> {
  const { recordedAt, measurements } = parseReading(body)
  const sensors = await readingRepository.findSensorsForGreenhouse(greenhouseId)
  const sensorById = new Map(sensors.map((sensor) => [sensor.id, sensor]))

  for (const measurement of measurements) {
    const sensor = sensorById.get(measurement.sensorId)
    if (!sensor) throw new AppError('A sensor does not belong to this greenhouse.', 404)
    if (!compatible(sensor, measurement.metric)) {
      throw new AppError(`${measurement.metric} is not compatible with sensor "${sensor.name}".`, 400)
    }
  }

  const valuesByMetric = new Map<ReadingMetric, number[]>()
  const updatesBySensor = new Map<string, { sensor: typeof sensors[number]; metrics: Partial<Record<ReadingMetric, number>> }>()
  for (const measurement of measurements) {
    const values = valuesByMetric.get(measurement.metric) ?? []
    values.push(measurement.value)
    valuesByMetric.set(measurement.metric, values)
    const sensor = sensorById.get(measurement.sensorId)
    if (!sensor) throw new AppError('Sensor not found.', 404)
    const update = updatesBySensor.get(sensor.id) ?? { sensor, metrics: {} }
    update.metrics[measurement.metric] = measurement.value
    updatesBySensor.set(sensor.id, update)
  }

  const temperature = valuesByMetric.get('temperature')
  const humidity = valuesByMetric.get('humidity')
  const soilMoisture = valuesByMetric.get('soilMoisture')
  const lightIntensity = valuesByMetric.get('lightIntensity')
  if (!temperature || !humidity || !soilMoisture || !lightIntensity) {
    throw new AppError('A complete environmental reading is required.', 400)
  }

  const sensorUpdates: IngestedSensorUpdate[] = Array.from(updatesBySensor.values()).map(({ sensor, metrics }) => {
    let lastReading = 'No reading yet'
    if (metrics.temperature !== undefined && metrics.humidity !== undefined) {
      lastReading = `${metrics.temperature.toFixed(1)}°C · ${metrics.humidity.toFixed(1)}%`
    } else if (metrics.temperature !== undefined) {
      lastReading = `${metrics.temperature.toFixed(1)}°C`
    } else if (metrics.humidity !== undefined) {
      lastReading = `${metrics.humidity.toFixed(1)}%`
    } else if (metrics.soilMoisture !== undefined) {
      lastReading = `${metrics.soilMoisture.toFixed(1)}%`
    } else if (metrics.lightIntensity !== undefined) {
      lastReading = `${Math.round(metrics.lightIntensity).toLocaleString()} lux`
    }
    return {
      id: sensor.id,
      lastReading,
      soilZoneId: sensor.soilZoneId,
      ...(metrics.soilMoisture === undefined ? {} : { soilMoisture: metrics.soilMoisture }),
    }
  })

  const primarySensorId = measurements.find((measurement) => measurement.metric === 'temperature')?.sensorId
  if (!primarySensorId) throw new AppError('A temperature sensor is required.', 400)
  const metricTypes: Record<ReadingMetric, SensorMeasurementType> = {
    temperature: SensorMeasurementType.TEMPERATURE,
    humidity: SensorMeasurementType.HUMIDITY,
    soilMoisture: SensorMeasurementType.SOIL_MOISTURE,
    lightIntensity: SensorMeasurementType.LIGHT_INTENSITY,
  }
  const persisted = await readingRepository.ingestSnapshot(
    greenhouseId,
    primarySensorId,
    recordedAt,
    {
      temperature: mean(temperature),
      humidity: mean(humidity),
      soilMoisture: mean(soilMoisture),
      lightIntensity: mean(lightIntensity),
    },
    measurements.map((measurement) => ({
      sensorId: measurement.sensorId,
      metric: metricTypes[measurement.metric],
      value: measurement.value,
    })),
    sensorUpdates,
  )
  const sensorNames = new Map(sensors.map((sensor) => [sensor.id, { name: sensor.name }]))
  await evaluateIntelligence(
    greenhouseId,
    persisted.measurements.map((measurement) => ({
      sensorId: measurement.sensorId,
      metric: metricNamesByType[measurement.metric],
      value: measurement.value,
    })),
    sensorNames,
  )
  await resolveRecentSensors(greenhouseId, persisted.measurements)
  for (const measurement of persisted.measurements) {
    const sensor = sensorById.get(measurement.sensorId)
    if (!sensor) continue
    const metric = metricNames.find((name) => metricTypes[name] === measurement.metric)
    if (!metric) continue
    if (!emitSensorReading({
      id: measurement.id,
      sensorId: measurement.sensorId,
      sensorType: sensor.type,
      metric,
      value: measurement.value,
      unit: metric === 'temperature' ? '°C' : metric === 'lightIntensity' ? 'lux' : '%',
      recordedAt: measurement.recordedAt.toISOString(),
      greenhouseId,
      snapshotId: persisted.snapshotId,
      snapshot: persisted.reading,
    })) {
      console.warn('Sensor reading persisted but Socket.IO is not attached to this process.')
      break
    }
  }
  return persisted.reading
}

async function ingestSingle(greenhouseId: string, body: unknown) {
  const input = requireObject(body)
  rejectUnknownFields(input, ['sensorId', 'metric', 'value', 'recordedAt'])
  const sensorId = parseUuid(input.sensorId, 'sensorId')
  const metric = parseMetric(input.metric)
  const value = parseValue(input.value, metric)
  const recordedAt = parseTimestamp(input.recordedAt)
  const sensor = (await readingRepository.findSensorsForGreenhouse(greenhouseId)).find((item) => item.id === sensorId)
  if (!sensor) throw new AppError('Sensor not found in this greenhouse.', 404)
  if (!compatible(sensor, metric)) throw new AppError(`${metric} is not compatible with sensor "${sensor.name}".`, 400)

  const metricTypes: Record<ReadingMetric, SensorMeasurementType> = {
    temperature: SensorMeasurementType.TEMPERATURE,
    humidity: SensorMeasurementType.HUMIDITY,
    soilMoisture: SensorMeasurementType.SOIL_MOISTURE,
    lightIntensity: SensorMeasurementType.LIGHT_INTENSITY,
  }
  const lastReading = metric === 'temperature'
    ? `${value.toFixed(1)}°C`
    : metric === 'lightIntensity' ? `${Math.round(value).toLocaleString()} lux` : `${value.toFixed(1)}%`
  const measurement: IngestedSensorMeasurement = {
    sensorId,
    metric: metricTypes[metric],
    value,
    recordedAt,
    lastReading,
    soilZoneId: sensor.soilZoneId,
  }
  const persisted = await readingRepository.ingestMeasurement(greenhouseId, measurement)
  await evaluateIntelligence(greenhouseId, [{
    sensorId: persisted.sensorId,
    metric,
    value: persisted.value,
  }], new Map([[sensor.id, { name: sensor.name }]]))
  await resolveRecentSensors(greenhouseId, [{ sensorId: persisted.sensorId, recordedAt: new Date(persisted.timestamp) }])
  if (!emitSensorReading({
    id: persisted.id,
    sensorId: persisted.sensorId,
    sensorType: sensor.type,
    metric,
    value: persisted.value,
    unit: metric === 'temperature' ? '°C' : metric === 'lightIntensity' ? 'lux' : '%',
    recordedAt: persisted.timestamp,
    greenhouseId,
  })) console.warn('Sensor reading persisted but Socket.IO is not attached to this process.')
  return persisted
}

export const sensorReadingIngestionService = {
  async ingestForOwner(ownerId: string, body: unknown): Promise<SensorReading | SensorMeasurementReading> {
    const greenhouseId = await greenhouseRepository.findIdByOwnerId(ownerId)
    if (!greenhouseId) throw new AppError('Greenhouse not found.', 404)
    return this.ingestForGreenhouse(greenhouseId, body)
  },

  async ingestForGreenhouse(greenhouseId: string, body: unknown): Promise<SensorReading | SensorMeasurementReading> {
    const input = requireObject(body)
    return Array.isArray(input.measurements) ? ingest(greenhouseId, body) : ingestSingle(greenhouseId, body)
  },
}
