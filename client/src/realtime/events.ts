export type SensorReadingMetric = 'temperature' | 'humidity' | 'soilMoisture' | 'lightIntensity'

export interface SensorReadingEvent {
  id: string
  sensorId: string
  sensorType: string
  metric: SensorReadingMetric
  value: number
  unit: string
  recordedAt: string
  greenhouseId: string
  snapshotId?: string
  snapshot?: {
    timestamp: string
    temperature: number
    humidity: number
    soilMoisture: number
    lightIntensity: number
  }
}

export interface RealtimeAlert {
  id: string
  greenhouseId: string
  sensorId: string | null
  type: string
  title: string
  message: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'
  source: string
  createdAt: string
  resolvedAt: string | null
}

export interface IrrigationUpdatedEvent {
  greenhouseId: string
  zoneId: string
  zone: string
  moisture: number
  threshold: number
  state: 'NEEDS_WATER' | 'MONITORING' | 'IDLE'
  simulated: true
  timestamp: string
}

export interface ClientToServerEvents {}

export interface ServerToClientEvents {
  'sensor:reading': (reading: SensorReadingEvent) => void
  'alert:created': (alert: RealtimeAlert) => void
  'alert:updated': (alert: RealtimeAlert) => void
  'alert:resolved': (alert: RealtimeAlert) => void
  'irrigation:updated': (decision: IrrigationUpdatedEvent) => void
}

export type RealtimeConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'
