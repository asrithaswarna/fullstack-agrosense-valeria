import type { ReadingMetric } from '../services/sensorReadingIngestionService.js'
import type { SensorConfiguration } from '../services/sensorConfiguration.js'
import type { simulatorRepository } from '../repositories/simulatorRepository.js'

export type SimulatorGreenhouse = Awaited<ReturnType<typeof simulatorRepository.findGreenhousesWithSensors>>[number]

export interface GeneratedMeasurement {
  sensorId: string
  metric: ReadingMetric
  value: number
}

export interface GeneratedReading {
  recordedAt: string
  measurements: GeneratedMeasurement[]
}

interface GreenhouseState {
  temperature: number
  humidity: number
  soilMoisture: Map<string, number>
}

function sensorOffset(id: string, scale: number): number {
  let hash = 0
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) | 0
  return ((Math.abs(hash) % 1000) / 999 - 0.5) * scale
}

function bounded(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function zonedHour(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) throw new Error(`Unable to read local time for timezone "${timeZone}".`)
  return hour + minute / 60
}

function supports(sensor: SimulatorGreenhouse['sensors'][number], metric: ReadingMetric): boolean {
  const kind = `${sensor.name} ${sensor.type}`.toLowerCase()
  switch (metric) {
    case 'temperature': return kind.includes('temperature') || kind.includes('temp') || kind.includes('dht')
    case 'humidity': return kind.includes('humidity') || kind.includes('dht')
    case 'soilMoisture': return kind.includes('soil') || kind.includes('moisture') || kind.includes('capacitive')
    case 'lightIntensity': return kind.includes('light') || kind.includes('ldr')
  }
}

export class GreenhouseReadingGenerator {
  private readonly stateByGreenhouse = new Map<string, GreenhouseState>()

  constructor(
    private readonly configuration: SensorConfiguration,
    private readonly random: () => number = Math.random,
  ) {}

  generate(greenhouse: SimulatorGreenhouse, now: Date): GeneratedReading {
    const temperatureSensors = greenhouse.sensors.filter((sensor) => supports(sensor, 'temperature'))
    const humiditySensors = greenhouse.sensors.filter((sensor) => supports(sensor, 'humidity'))
    const soilSensors = greenhouse.sensors.filter((sensor) => supports(sensor, 'soilMoisture'))
    const lightSensors = greenhouse.sensors.filter((sensor) => supports(sensor, 'lightIntensity'))
    if (!temperatureSensors.length || !humiditySensors.length || !soilSensors.length || !lightSensors.length) {
      throw new Error(`Greenhouse "${greenhouse.name}" is missing one or more required environmental sensors.`)
    }

    let state = this.stateByGreenhouse.get(greenhouse.id)
    if (!state) {
      state = {
        temperature: 22,
        humidity: 70,
        soilMoisture: new Map(soilSensors.map((sensor) => {
          const initial = Number.parseFloat(sensor.lastReading)
          return [sensor.id, Number.isFinite(initial) ? initial : 70]
        })),
      }
      this.stateByGreenhouse.set(greenhouse.id, state)
    }

    const hour = zonedHour(now, greenhouse.timezone)
    const daylight = hour <= 6 || hour >= 18 ? 0 : Math.sin(((hour - 6) / 12) * Math.PI)
    const temperatureTarget = bounded(23 + 4 * Math.sin(((hour - 8) / 24) * 2 * Math.PI), 16, 32)
    state.temperature += (temperatureTarget - state.temperature) * 0.18 + (this.random() - 0.5) * 0.18
    const humidityTarget = bounded(76 - (state.temperature - 19) * 1.15, 35, 95)
    state.humidity += (humidityTarget - state.humidity) * 0.16 + (this.random() - 0.5) * 0.8
    state.temperature = bounded(state.temperature, this.configuration.ranges.temperature.minimum, this.configuration.ranges.temperature.maximum)
    state.humidity = bounded(state.humidity, this.configuration.ranges.humidity.minimum, this.configuration.ranges.humidity.maximum)

    const measurements: GeneratedMeasurement[] = []
    for (const sensor of temperatureSensors) {
      measurements.push({
        sensorId: sensor.id,
        metric: 'temperature',
        value: bounded(state.temperature + sensorOffset(sensor.id, 0.8), this.configuration.ranges.temperature.minimum, this.configuration.ranges.temperature.maximum),
      })
    }
    for (const sensor of humiditySensors) {
      measurements.push({
        sensorId: sensor.id,
        metric: 'humidity',
        value: bounded(state.humidity + sensorOffset(sensor.id, 4), this.configuration.ranges.humidity.minimum, this.configuration.ranges.humidity.maximum),
      })
    }
    for (const sensor of soilSensors) {
      const previous = state.soilMoisture.get(sensor.id) ?? 70
      const minutes = this.configuration.intervalMs / 60_000
      const current = bounded(previous - minutes * (0.012 + this.random() * 0.018), this.configuration.ranges.soilMoisture.minimum, this.configuration.ranges.soilMoisture.maximum)
      state.soilMoisture.set(sensor.id, current)
      measurements.push({ sensorId: sensor.id, metric: 'soilMoisture', value: current })
    }
    for (const sensor of lightSensors) {
      const variation = 0.9 + this.random() * 0.2
      const value = daylight * 2200 * variation + (daylight === 0 ? this.random() * 18 : 0)
      measurements.push({
        sensorId: sensor.id,
        metric: 'lightIntensity',
        value: bounded(value + sensorOffset(sensor.id, 120), this.configuration.ranges.lightIntensity.minimum, this.configuration.ranges.lightIntensity.maximum),
      })
    }

    return { recordedAt: now.toISOString(), measurements }
  }
}
