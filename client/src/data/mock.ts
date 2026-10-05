import type {
  Alert,
  AnalyticsMetricSummary,
  EnvironmentalData,
  Greenhouse,
  IrrigationStatus,
  MetricCardData,
  Sensor,
  SensorReading,
  SoilZone,
  SystemStatus,
  User,
} from '../types/domain'

export const mockUser: User = {
  id: 'user-001',
  name: 'Jordan Davis',
  email: 'jordan@example.com',
  role: 'Greenhouse manager',
  createdAt: '2024-01-12T09:00:00.000Z',
}

export const mockGreenhouse: Greenhouse = {
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

export const mockEnvironment: EnvironmentalData = {
  temperature: 26.4,
  humidity: 68,
  soilMoisture: 74,
  lightIntensity: 842,
}

export const mockLatestReading: SensorReading = {
  ...mockEnvironment,
  timestamp: '2024-05-21T10:42:00.000Z',
}

export const mockRecentReadings: SensorReading[] = [
  { timestamp: '2024-05-21T10:42:00.000Z', temperature: 26.4, humidity: 68, soilMoisture: 74, lightIntensity: 842 },
  { timestamp: '2024-05-21T10:41:00.000Z', temperature: 26.3, humidity: 68, soilMoisture: 74, lightIntensity: 836 },
  { timestamp: '2024-05-21T10:40:00.000Z', temperature: 26.3, humidity: 67, soilMoisture: 75, lightIntensity: 829 },
]

export const metrics: MetricCardData[] = [
  { label: 'Temperature', value: '26.4', unit: '°C', change: '+0.8°', state: 'Normal', icon: '♨' },
  { label: 'Humidity', value: '68', unit: '%', change: '+2%', state: 'Optimal', icon: '◌' },
  { label: 'Soil moisture', value: '74', unit: '%', change: '−3%', state: 'Healthy', icon: '♧' },
  { label: 'Light intensity', value: '842', unit: 'lux', change: '+6%', state: 'Optimal', icon: '☼' },
]

export const temperatureSeries = [43, 48, 46, 55, 52, 60, 57, 68, 64, 72, 69, 78, 72, 76, 67, 73, 65, 69, 60, 66, 57, 61, 55, 58]
export const humiditySeries = [72, 68, 75, 70, 64, 68, 61, 65, 59, 64, 57, 63, 58, 61, 55, 59, 53, 58, 54, 60, 55, 59, 56, 61]
export const soilSeries = [78, 75, 77, 72, 74, 70, 73, 69, 71, 68, 72, 67, 69, 65, 68, 64, 66, 62, 65, 61, 63, 59, 62, 60]
export const lightSeries = [120, 165, 210, 280, 370, 480, 590, 710, 820, 930, 1020, 1080, 1120, 1060, 980, 880, 760, 650, 540, 430, 340, 260, 190, 145]

export const soilZones: SoilZone[] = [
  { id: 'zone-a', zone: 'Zone A', value: 72, state: 'Healthy', irrigationState: 'idle' },
  { id: 'zone-b', zone: 'Zone B', value: 68, state: 'Healthy', irrigationState: 'idle' },
  { id: 'zone-c', zone: 'Zone C', value: 81, state: 'Optimal', irrigationState: 'scheduled' },
  { id: 'zone-d', zone: 'Zone D', value: 59, state: 'Monitor', irrigationState: 'idle' },
]

export const alerts: Alert[] = [
  { id: 'alert-001', type: 'Low Soil Moisture', title: 'Soil moisture is low in Zone D', message: 'Moisture is below the preferred range.', severity: 'Warning', source: 'Soil sensor · Zone D', timestamp: '2024-05-21T10:42:00.000Z', time: '10:42 AM', status: 'Active' },
  { id: 'alert-002', type: 'High Temperature', title: 'Temperature rising above daily average', message: 'Temperature is above the daily average.', severity: 'Warning', source: 'DHT22 · Greenhouse 01', timestamp: '2024-05-21T09:18:00.000Z', time: '09:18 AM', status: 'Active' },
  { id: 'alert-003', type: 'Low Light', title: 'Light intensity returned to optimal range', message: 'Light intensity has returned to the preferred range.', severity: 'Info', source: 'LDR · Greenhouse 01', timestamp: '2024-05-20T16:20:00.000Z', time: 'Yesterday', status: 'Resolved' },
  { id: 'alert-004', type: 'Sensor Offline', title: 'Sensor connection interrupted', message: 'The connection was restored.', severity: 'Critical', source: 'Soil sensor · Zone B', timestamp: '2024-05-20T13:05:00.000Z', time: 'Yesterday', status: 'Resolved' },
]

export const sensors: Sensor[] = [
  { id: 'sensor-dht22', name: 'DHT22', type: 'Temperature & humidity', zone: 'Central aisle', unit: '°C / %', status: 'online', lastReading: '26.4°C · 68%', lastSeen: 'Just now' },
  { id: 'sensor-soil-a', name: 'Soil moisture', type: 'Capacitive sensor', zone: 'Zone A', unit: '%', status: 'online', lastReading: '72%', lastSeen: 'Just now' },
  { id: 'sensor-soil-b', name: 'Soil moisture', type: 'Capacitive sensor', zone: 'Zone B', unit: '%', status: 'online', lastReading: '68%', lastSeen: 'Just now' },
  { id: 'sensor-soil-c', name: 'Soil moisture', type: 'Capacitive sensor', zone: 'Zone C', unit: '%', status: 'online', lastReading: '81%', lastSeen: 'Just now' },
  { id: 'sensor-soil-d', name: 'Soil moisture', type: 'Capacitive sensor', zone: 'Zone D', unit: '%', status: 'online', lastReading: '59%', lastSeen: 'Just now' },
  { id: 'sensor-ldr', name: 'LDR', type: 'Light intensity', zone: 'Roof level', unit: 'lux', status: 'online', lastReading: '842 lux', lastSeen: 'Just now' },
  { id: 'irrigation-relay', name: 'Irrigation relay', type: 'Irrigation control', zone: 'Pump room', unit: 'state', status: 'ready', lastReading: 'Standby', lastSeen: '2 min ago' },
]

export const irrigationStatus: IrrigationStatus = {
  enabled: true,
  active: false,
  currentZone: null,
  startedAt: null,
  durationMinutes: 8,
  mode: 'automatic',
  lastCycle: '8:30 AM',
  recommendations: soilZones.map((zone) => ({
    zoneId: zone.id,
    zone: zone.zone,
    moisture: zone.value,
    threshold: 60,
    state: zone.value < 60 ? 'needs_water' : 'idle',
    simulated: true,
    updatedAt: mockLatestReading.timestamp,
  })),
}

export const systemStatus: SystemStatus = {
  overallStatus: 'online',
  mqttStatus: 'planned',
  websocketStatus: 'planned',
  databaseStatus: 'planned',
  sensorSync: 'online',
  lastSync: 'Just now',
}

const baseAnalytics: Omit<AnalyticsMetricSummary, 'values'>[] = [
  { name: 'Temperature', unit: '°C', average: 24.8, minimum: 18.2, maximum: 29.6, color: '#b66b48' },
  { name: 'Humidity', unit: '%', average: 64, minimum: 48, maximum: 82, color: '#638b8a' },
  { name: 'Soil moisture', unit: '%', average: 69, minimum: 54, maximum: 84, color: '#82956a' },
  { name: 'Light intensity', unit: 'lux', average: 684, minimum: 120, maximum: 1180, color: '#b99a56' },
]

export function getMockAnalytics(range: '24h' | '7d' | '30d'): AnalyticsMetricSummary[] {
  const series = [temperatureSeries, humiditySeries, soilSeries, lightSeries]
  const rangeScale = range === '24h' ? 1 : range === '7d' ? 0.82 : 0.68
  return baseAnalytics.map((metric, index) => {
    const values = series[index]
    const average = values.reduce((sum, value) => sum + value, 0) / values.length
    const center = (Math.min(...values) + Math.max(...values)) / 2
    return {
      ...metric,
      average: Number((metric.average * rangeScale + average * (1 - rangeScale)).toFixed(1)),
      minimum: Number((center + (metric.minimum - center) * rangeScale).toFixed(1)),
      maximum: Number((center + (metric.maximum - center) * rangeScale).toFixed(1)),
      values: range === '24h' ? values : values.map((value, valueIndex) => {
        const smoothed = (value + values[(valueIndex + values.length - 1) % values.length] + values[(valueIndex + 1) % values.length]) / 3
        return Number((center + (smoothed - center) * rangeScale).toFixed(1))
      }),
    }
  })
}
