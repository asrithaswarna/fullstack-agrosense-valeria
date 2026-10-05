import { connect, type MqttClient } from 'mqtt'
import { sensorReadingIngestionService, type ReadingMetric } from '../services/sensorReadingIngestionService.js'
import {
  greenhouseReadingsTopic,
  parseMqttScalarPayload,
  parseMqttSnapshotPayload,
  parseMqttTopic,
  sensorReadingTopic,
} from './mqttProtocol.js'

let client: MqttClient | undefined
let connected = false

function brokerUrl(): string {
  const url = process.env.MQTT_BROKER_URL ?? 'mqtt://localhost:1883'
  if (!/^mqtts?:\/\//i.test(url)) throw new Error('MQTT_BROKER_URL must use mqtt:// or mqtts://.')
  return url
}

function clientOptions() {
  const username = process.env.MQTT_USERNAME
  const password = process.env.MQTT_PASSWORD
  if (!username || !password) {
    throw new Error('MQTT_USERNAME and MQTT_PASSWORD must be configured; anonymous broker access is not supported.')
  }
  return {
    clientId: process.env.MQTT_CLIENT_ID || `valeria-backend-${process.pid}`,
    clean: true,
    reconnectPeriod: 2000,
    connectTimeout: 5000,
    username,
    password,
  }
}

async function handleMessage(topic: string, payload: Buffer): Promise<void> {
  const parsedTopic = parseMqttTopic(topic)
  if (!parsedTopic) {
    console.warn(`Rejected message on invalid MQTT topic "${topic.slice(0, 180)}".`)
    return
  }
  try {
    if (parsedTopic.sensorId) {
      const message = parseMqttScalarPayload(payload)
      await sensorReadingIngestionService.ingestForGreenhouse(parsedTopic.greenhouseId, {
        sensorId: parsedTopic.sensorId,
        metric: message.metric,
        value: message.value,
        ...(message.recordedAt === undefined ? {} : { recordedAt: message.recordedAt }),
      })
    } else {
      await sensorReadingIngestionService.ingestForGreenhouse(
        parsedTopic.greenhouseId,
        parseMqttSnapshotPayload(payload),
      )
    }
  } catch (error) {
    console.warn(`Rejected MQTT reading for greenhouse ${parsedTopic.greenhouseId}:`, error instanceof Error ? error.message : error)
  }
}

export const mqttAdapter = {
  async start(): Promise<void> {
    if (client) return
    const mqttClient = connect(brokerUrl(), clientOptions())
    client = mqttClient
    mqttClient.on('connect', () => {
      connected = true
      console.info('MQTT connected to broker.')
      mqttClient.subscribe([
        'valeria/greenhouses/+/readings',
        'valeria/greenhouses/+/sensors/+/reading',
      ], { qos: 1 }, (error) => {
        if (error) console.error('MQTT sensor subscription failed:', error.message)
        else console.info('MQTT sensor reading subscription active.')
      })
    })
    mqttClient.on('reconnect', () => {
      connected = false
      console.warn('MQTT broker unavailable; reconnecting.')
    })
    mqttClient.on('offline', () => { connected = false })
    mqttClient.on('close', () => { connected = false })
    mqttClient.on('error', (error) => {
      connected = false
      console.error('MQTT connection error:', error.message)
    })
    mqttClient.on('message', (topic, payload) => {
      void handleMessage(topic, payload).catch((error: unknown) => {
        console.error('MQTT message handler failed:', error instanceof Error ? error.message : error)
      })
    })
    await Promise.race([
      new Promise<void>((resolve) => mqttClient.once('connect', () => resolve())),
      new Promise<void>((resolve) => setTimeout(resolve, 3000)),
    ])
  },

  get connected(): boolean {
    return connected
  },

  async publishReading(input: {
    greenhouseId: string
    sensorId: string
    metric: ReadingMetric
    value: number
    recordedAt: string
  }): Promise<void> {
    if (!client?.connected) throw new Error('MQTT broker is not connected; simulated reading was not published.')
    const topic = sensorReadingTopic(input.greenhouseId, input.sensorId)
    const payload = JSON.stringify({
      metric: input.metric,
      value: input.value,
      recordedAt: input.recordedAt,
    })
    await new Promise<void>((resolve, reject) => {
      client?.publish(topic, payload, { qos: 1 }, (error) => error ? reject(error) : resolve())
    })
  },

  async publishSnapshot(input: {
    greenhouseId: string
    recordedAt: string
    measurements: { sensorId: string; metric: ReadingMetric; value: number }[]
  }): Promise<void> {
    if (!client?.connected) throw new Error('MQTT broker is not connected; simulated reading was not published.')
    const payload = JSON.stringify({ recordedAt: input.recordedAt, measurements: input.measurements })
    await new Promise<void>((resolve, reject) => {
      client?.publish(greenhouseReadingsTopic(input.greenhouseId), payload, { qos: 1 }, (error) => error ? reject(error) : resolve())
    })
  },

  async stop(): Promise<void> {
    const activeClient = client
    client = undefined
    connected = false
    if (!activeClient) return
    await new Promise<void>((resolve, reject) => {
      activeClient.end(false, {}, (error?: Error) => error ? reject(error) : resolve())
    })
    console.info('MQTT client stopped.')
  },
}
