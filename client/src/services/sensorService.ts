import { useMockData } from '../config/env'
import { humiditySeries, irrigationStatus, lightSeries, metrics as mockMetrics, mockLatestReading, mockRecentReadings, sensors as mockSensors, soilSeries, soilZones, temperatureSeries } from '../data/mock'
import type { AnalyticsRange, EnvironmentalData, IrrigationStatus, LiveMonitorData, MetricCardData, Sensor, SensorDashboardData, SensorMeasurementReading, SensorReading, SoilZone } from '../types/domain'
import { api } from './api'

function formatChange(current: number, previous: number, unit: string): string {
  const difference = current - previous
  const sign = difference > 0 ? '+' : ''
  const value = Number(difference.toFixed(1))
  return `${sign}${value}${unit}`
}

function getMetricCards(reading: SensorReading, history: SensorReading[]): MetricCardData[] {
  const previous = history[0] ?? reading
  const values: { label: string; key: keyof EnvironmentalData; unit: string; icon: string; low: number; high: number }[] = [
    { label: 'Temperature', key: 'temperature', unit: '°C', icon: '♨', low: 18, high: 30 },
    { label: 'Humidity', key: 'humidity', unit: '%', icon: '◌', low: 50, high: 80 },
    { label: 'Soil moisture', key: 'soilMoisture', unit: '%', icon: '♧', low: 60, high: 85 },
    { label: 'Light intensity', key: 'lightIntensity', unit: 'lux', icon: '☼', low: 300, high: 1200 },
  ]
  return values.map(({ label, key, unit, icon, low, high }) => {
    const currentValue = reading[key]
    const status = currentValue < low ? 'Monitor' : currentValue > high ? 'High' : 'Optimal'
    return {
      label,
      value: key === 'temperature' ? currentValue.toFixed(1) : Math.round(currentValue).toLocaleString(),
      unit,
      change: formatChange(currentValue, previous[key], key === 'temperature' ? '°' : unit),
      state: status,
      icon,
    }
  })
}

function getSoilZones(sensors: Sensor[]): SoilZone[] {
  return sensors.filter((sensor) => sensor.type === 'Capacitive sensor').map((sensor) => {
    const value = Number.parseFloat(sensor.lastReading)
    return {
      id: sensor.id,
      zone: sensor.zone,
      value: Number.isFinite(value) ? value : 0,
      state: value < 60 ? 'Monitor' : value > 80 ? 'Optimal' : 'Healthy',
      irrigationState: sensor.zone === 'Zone C' ? 'scheduled' : 'idle',
    }
  })
}

function toDashboardData(reading: SensorReading, history: SensorReading[], sensors: Sensor[]): SensorDashboardData {
  return {
    metrics: getMetricCards(reading, history),
    temperatureSeries: history.map((item) => item.temperature),
    soilSeries: history.map((item) => item.soilMoisture),
    soilZones: getSoilZones(sensors),
    latestReadings: reading,
  }
}

async function getHistory(
  range: AnalyticsRange,
  { limit = 500, sample = true, order = 'asc' }: { limit?: number; sample?: boolean; order?: 'asc' | 'desc' } = {},
): Promise<SensorReading[]> {
  return api.get<SensorReading[]>(`/readings/history?range=${range}&limit=${limit}&sample=${sample}&order=${order}`)
}

export const sensorService = {
  async getSensors(): Promise<Sensor[]> {
    if (useMockData) return mockSensors
    return api.get<Sensor[]>('/sensors')
  },

  async getSensor(id: string): Promise<Sensor | undefined> {
    if (useMockData) return mockSensors.find((sensor) => sensor.id === id)
    return api.get<Sensor>(`/sensors/${encodeURIComponent(id)}`)
  },

  async createSensor(sensor: Pick<Sensor, 'name' | 'type' | 'zone' | 'unit'> & Partial<Pick<Sensor, 'status' | 'lastReading' | 'lastSeen' | 'batteryLevel'>>): Promise<Sensor> {
    if (useMockData) throw new Error('Sensor creation requires the VALERIA server.')
    return api.post<Sensor, typeof sensor>('/sensors', sensor)
  },

  async updateSensor(id: string, patch: Partial<Omit<Sensor, 'id'>>): Promise<Sensor> {
    if (useMockData) throw new Error('Sensor updates require the VALERIA server.')
    return api.patch<Sensor, typeof patch>(`/sensors/${encodeURIComponent(id)}`, patch)
  },

  async deleteSensor(id: string): Promise<{ id: string; deleted: true }> {
    if (useMockData) throw new Error('Sensor deletion requires the VALERIA server.')
    return api.delete<{ id: string; deleted: true }>(`/sensors/${encodeURIComponent(id)}`)
  },

  async getLatestReadings(): Promise<SensorReading> {
    if (useMockData) return mockLatestReading
    return api.get<SensorReading>('/readings/latest')
  },

  async getDashboardData(): Promise<SensorDashboardData> {
    if (useMockData) return { metrics: mockMetrics, temperatureSeries, soilSeries, soilZones, latestReadings: mockLatestReading }
    const [latest, history, sensors] = await Promise.all([sensorService.getLatestReadings(), getHistory('24h'), sensorService.getSensors()])
    return toDashboardData(latest, history, sensors)
  },

  async getLiveMonitorData(): Promise<LiveMonitorData> {
    if (useMockData) {
      return {
        metrics: mockMetrics,
        temperatureSeries,
        humiditySeries,
        soilSeries,
        lightSeries,
        soilZones,
        latestReadings: mockLatestReading,
        recentReadings: mockRecentReadings,
        connectionStatus: 'online',
      }
    }
    const [latest, history, sensors, recentReadings] = await Promise.all([
      sensorService.getLatestReadings(),
      getHistory('24h'),
      sensorService.getSensors(),
      getHistory('24h', { limit: 3, sample: false, order: 'desc' }),
    ])
    return {
      ...toDashboardData(latest, history, sensors),
      humiditySeries: history.map((item) => item.humidity),
      lightSeries: history.map((item) => item.lightIntensity),
      recentReadings,
      connectionStatus: 'online',
    }
  },

  async getSensorHistory(sensorId: string, range: AnalyticsRange): Promise<number[]> {
    if (useMockData) {
      const series = sensorId.includes('soil') ? soilSeries
        : sensorId.includes('humidity') ? humiditySeries
          : sensorId.includes('light') ? lightSeries
            : temperatureSeries
      const scale = range === '24h' ? 1 : range === '7d' ? 0.88 : 0.76
      const mean = series.reduce((sum, value) => sum + value, 0) / series.length
      return series.map((value) => Number((mean + (value - mean) * scale).toFixed(1)))
    }
    const history = await api.get<SensorMeasurementReading[]>(`/readings/history?range=${range}&sensorId=${encodeURIComponent(sensorId)}&limit=500&order=desc`)
    return history.map((reading) => reading.value).reverse()
  },

  async getIrrigationStatus(): Promise<IrrigationStatus> {
    if (useMockData) return irrigationStatus
    return api.get<IrrigationStatus>('/greenhouse/irrigation')
  },
}
