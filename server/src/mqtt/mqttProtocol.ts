import type { ReadingMetric } from '../services/sensorReadingIngestionService.js'

const topicPrefix = 'valeria/greenhouses'
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const scalarTopicPattern = /^valeria\/greenhouses\/([0-9a-f-]{36})\/sensors\/([0-9a-f-]{36})\/reading$/
const snapshotTopicPattern = /^valeria\/greenhouses\/([0-9a-f-]{36})\/readings$/
const validMetrics: readonly ReadingMetric[] = ['temperature', 'humidity', 'soilMoisture', 'lightIntensity']

export type MqttTopic = { greenhouseId: string; sensorId?: string }

export function parseMqttTopic(topic: string): MqttTopic | undefined {
  const scalarMatch = scalarTopicPattern.exec(topic)
  if (scalarMatch && uuidPattern.test(scalarMatch[1]) && uuidPattern.test(scalarMatch[2])) {
    return { greenhouseId: scalarMatch[1], sensorId: scalarMatch[2] }
  }
  const snapshotMatch = snapshotTopicPattern.exec(topic)
  if (snapshotMatch && uuidPattern.test(snapshotMatch[1])) {
    return { greenhouseId: snapshotMatch[1] }
  }
  return undefined
}

function parseJson(payload: Buffer): Record<string, unknown> {
  if (payload.length === 0 || payload.length > 16_384) throw new Error('MQTT payload must be between 1 and 16384 bytes.')
  let data: unknown
  try {
    data = JSON.parse(payload.toString('utf8'))
  } catch {
    throw new Error('MQTT payload is not valid JSON.')
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('MQTT payload must be a JSON object.')
  return data as Record<string, unknown>
}

function isReadingMetric(value: unknown): value is ReadingMetric {
  return typeof value === 'string' && (validMetrics as readonly string[]).includes(value)
}

export function parseMqttScalarPayload(payload: Buffer): { metric: ReadingMetric; value: number; recordedAt?: string } {
  const input = parseJson(payload)
  const allowed = new Set(['metric', 'value', 'recordedAt'])
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new Error('MQTT payload contains unsupported fields.')
  if (!isReadingMetric(input.metric)) throw new Error('MQTT metric is invalid.')
  if (typeof input.value !== 'number' || !Number.isFinite(input.value)) throw new Error('MQTT value must be a finite number.')
  if (input.recordedAt !== undefined && (typeof input.recordedAt !== 'string' || Number.isNaN(Date.parse(input.recordedAt)))) {
    throw new Error('MQTT recordedAt must be a valid timestamp.')
  }
  return {
    metric: input.metric,
    value: input.value,
    ...(input.recordedAt === undefined ? {} : { recordedAt: input.recordedAt }),
  }
}

export function parseMqttSnapshotPayload(payload: Buffer): Record<string, unknown> {
  return parseJson(payload)
}

export function greenhouseReadingsTopic(greenhouseId: string): string {
  return `${topicPrefix}/${greenhouseId}/readings`
}

export function sensorReadingTopic(greenhouseId: string, sensorId: string): string {
  return `${topicPrefix}/${greenhouseId}/sensors/${sensorId}/reading`
}
