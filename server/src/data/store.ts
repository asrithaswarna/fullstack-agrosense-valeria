import type { Alert, Greenhouse, IrrigationStatus, Sensor, SensorReading, SystemStatus } from '../types/domain.js'

const now = new Date()

export const sensors: Sensor[] = [
  { id: 'sensor-dht22', name: 'DHT22', type: 'Temperature & humidity', zone: 'Central aisle', unit: '°C / %', status: 'online', lastReading: '26.4°C · 68%', lastSeen: 'Just now', batteryLevel: 100 },
  { id: 'sensor-soil-a', name: 'Soil moisture', type: 'Capacitive sensor', zone: 'Zone A', unit: '%', status: 'online', lastReading: '72%', lastSeen: 'Just now', batteryLevel: 96 },
  { id: 'sensor-soil-b', name: 'Soil moisture', type: 'Capacitive sensor', zone: 'Zone B', unit: '%', status: 'online', lastReading: '68%', lastSeen: 'Just now', batteryLevel: 92 },
  { id: 'sensor-soil-c', name: 'Soil moisture', type: 'Capacitive sensor', zone: 'Zone C', unit: '%', status: 'online', lastReading: '75%', lastSeen: 'Just now', batteryLevel: 94 },
  { id: 'sensor-soil-d', name: 'Soil moisture', type: 'Capacitive sensor', zone: 'Zone D', unit: '%', status: 'online', lastReading: '59%', lastSeen: 'Just now', batteryLevel: 88 },
  { id: 'sensor-ldr', name: 'LDR', type: 'Light intensity', zone: 'Roof level', unit: 'lux', status: 'online', lastReading: '842 lux', lastSeen: 'Just now', batteryLevel: 98 },
  { id: 'irrigation-relay', name: 'Irrigation relay', type: 'Irrigation control', zone: 'Pump room', unit: 'state', status: 'ready', lastReading: 'Standby', lastSeen: '2 min ago' },
]

export const alerts: Alert[] = [
  { id: 'alert-001', type: 'Low Soil Moisture', title: 'Soil moisture is low in Zone D', message: 'Moisture is below the preferred range.', severity: 'Warning', source: 'Soil sensor · Zone D', timestamp: new Date(now.getTime() - 12 * 60_000).toISOString(), time: '12 min ago', status: 'Active' },
  { id: 'alert-002', type: 'High Temperature', title: 'Temperature rising above daily average', message: 'Temperature is above the daily average.', severity: 'Warning', source: 'DHT22 · Greenhouse 01', timestamp: new Date(now.getTime() - 86 * 60_000).toISOString(), time: '1 hr ago', status: 'Active' },
  { id: 'alert-003', type: 'Low Light', title: 'Light intensity returned to optimal range', message: 'Light intensity has returned to the preferred range.', severity: 'Info', source: 'LDR · Greenhouse 01', timestamp: new Date(now.getTime() - 18 * 60 * 60_000).toISOString(), time: 'Yesterday', status: 'Resolved' },
  { id: 'alert-004', type: 'Sensor Offline', title: 'Sensor connection interrupted', message: 'The connection was restored.', severity: 'Critical', source: 'Soil sensor · Zone B', timestamp: new Date(now.getTime() - 25 * 60 * 60_000).toISOString(), time: 'Yesterday', status: 'Resolved' },
]

export const greenhouse: Greenhouse = {
  id: 'greenhouse-001',
  name: 'Greenhouse 01',
  location: 'North Garden',
  area: 240,
  timezone: 'Asia/Kolkata',
  description: 'Leafy greens and seasonal herbs.',
  status: 'active',
  thresholds: {
    temperatureMin: 18,
    temperatureMax: 30,
    humidityMin: 50,
    humidityMax: 80,
    soilMin: 60,
    soilMax: 85,
    lightMin: 300,
    lightMax: 1200,
  },
}

export const latestReading: SensorReading = {
  timestamp: now.toISOString(),
  temperature: 26.4,
  humidity: 68,
  soilMoisture: 74,
  lightIntensity: 842,
}

export const systemStatus: SystemStatus = {
  overallStatus: 'online',
  mqttStatus: 'planned',
  websocketStatus: 'planned',
  databaseStatus: 'planned',
  sensorSync: 'online',
  lastSync: 'Just now',
}

export const irrigationStatus: IrrigationStatus = {
  enabled: true,
  active: false,
  currentZone: null,
  startedAt: null,
  durationMinutes: 8,
  mode: 'automatic',
  lastCycle: '8:30 AM',
  recommendations: [
    { zoneId: 'zone-a', zone: 'Zone A', moisture: 72, threshold: 60, state: 'idle', simulated: true, updatedAt: now.toISOString() },
    { zoneId: 'zone-b', zone: 'Zone B', moisture: 68, threshold: 60, state: 'idle', simulated: true, updatedAt: now.toISOString() },
    { zoneId: 'zone-c', zone: 'Zone C', moisture: 75, threshold: 60, state: 'idle', simulated: true, updatedAt: now.toISOString() },
    { zoneId: 'zone-d', zone: 'Zone D', moisture: 59, threshold: 60, state: 'needs_water', simulated: true, updatedAt: now.toISOString() },
  ],
}

export let nextSensorNumber = 1

export function allocateSensorId(): string {
  const id = `sensor-custom-${nextSensorNumber}`
  nextSensorNumber += 1
  return id
}
