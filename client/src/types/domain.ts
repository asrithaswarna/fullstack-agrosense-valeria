export type SensorStatus = 'online' | 'offline' | 'warning' | 'ready'
export type AlertSeverity = 'Critical' | 'Warning' | 'Info'
export type AlertStatus = 'Active' | 'Acknowledged' | 'Resolved'
export type AnalyticsRange = '24h' | '7d' | '30d'
export type SystemConnectionState = 'online' | 'offline' | 'standby' | 'planned'

export interface User {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
}

export interface Greenhouse {
  id: string
  name: string
  location: string
  area: number
  timezone: string
  description: string
  status: 'active' | 'inactive'
  thresholds: EnvironmentalThresholds
}

export interface EnvironmentalData {
  temperature: number
  humidity: number
  soilMoisture: number
  lightIntensity: number
}

export interface SensorReading extends EnvironmentalData {
  timestamp: string
  sensors?: {
    id: string
    name: string
    type: string
    unit: string
    metric: string
    value: number
    recordedAt: string
  }[]
}

export interface SensorMeasurementReading {
  sensorId: string
  metric: string
  value: number
  timestamp: string
}

export interface Sensor {
  id: string
  name: string
  type: string
  zone: string
  unit: string
  status: SensorStatus
  lastReading: string
  lastSeen: string
  batteryLevel?: number
}

export interface SoilZone {
  id: string
  zone: string
  value: number
  state: 'Healthy' | 'Optimal' | 'Monitor'
  irrigationState: 'idle' | 'watering' | 'scheduled'
}

export interface Alert {
  id: string
  type: string
  title: string
  message: string
  severity: AlertSeverity
  source: string
  timestamp: string
  time: string
  status: AlertStatus
  greenhouseId?: string
  sensorId?: string | null
  sensorType?: string | null
}

export interface SystemStatus {
  overallStatus: SystemConnectionState
  mqttStatus: SystemConnectionState
  websocketStatus: SystemConnectionState
  databaseStatus: SystemConnectionState
  sensorSync: SystemConnectionState
  lastSync: string
}

export interface IrrigationStatus {
  enabled: boolean
  active: boolean
  currentZone: string | null
  startedAt: string | null
  durationMinutes: number
  mode: 'automatic' | 'manual'
  lastCycle: string
  recommendations: IrrigationRecommendation[]
}

export interface IrrigationRecommendation {
  zoneId: string
  zone: string
  moisture: number
  threshold: number
  state: 'needs_water' | 'monitoring' | 'idle'
  simulated: true
  updatedAt: string
}

export interface MetricCardData {
  label: string
  value: string
  unit: string
  change: string
  state: string
  icon: string
}

export interface SensorDashboardData {
  metrics: MetricCardData[]
  temperatureSeries: number[]
  soilSeries: number[]
  soilZones: SoilZone[]
  latestReadings: SensorReading
}

export interface LiveMonitorData extends SensorDashboardData {
  humiditySeries: number[]
  lightSeries: number[]
  recentReadings: SensorReading[]
  connectionStatus: SystemConnectionState
}

export interface AnalyticsMetricSummary {
  name: string
  unit: string
  average: number
  minimum: number
  maximum: number
  values: number[]
  color: string
}

export interface AnalyticsSummary {
  range: AnalyticsRange
  metrics: AnalyticsMetricSummary[]
  generatedAt: string
}

export interface NotificationPreferences {
  alertNotifications: boolean
  sensorNotifications: boolean
  irrigationNotifications: boolean
}

export interface EnvironmentalThresholds {
  temperatureMin: number
  temperatureMax: number
  humidityMin: number
  humidityMax: number
  soilMin: number
  soilMax: number
  lightMin: number
  lightMax: number
}
