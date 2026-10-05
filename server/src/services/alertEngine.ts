import { AlertSeverity as PrismaAlertSeverity } from '@prisma/client'
import { alertRepository } from '../repositories/alertRepository.js'
import type { EnvironmentalThresholds } from '../types/domain.js'
import { emitAlert } from '../realtime/socketServer.js'
import type { ReadingMetric } from './sensorReadingIngestionService.js'

export interface EvaluatedMeasurement {
  sensorId: string
  metric: ReadingMetric
  value: number
}

interface Rule {
  type: string
  title: string
  message: (value: number, threshold: number, sensorName: string) => string
  low: boolean
  minimum: number
  maximum: number
}

function ruleFor(metric: ReadingMetric, thresholds: EnvironmentalThresholds, value: number): Rule | undefined {
  const rules: Record<ReadingMetric, { lowType: string; highType: string; label: string; unit: string; min: number; max: number }> = {
    temperature: { lowType: 'TEMPERATURE_LOW', highType: 'TEMPERATURE_HIGH', label: 'Temperature', unit: '°C', min: thresholds.temperatureMin, max: thresholds.temperatureMax },
    humidity: { lowType: 'HUMIDITY_LOW', highType: 'HUMIDITY_HIGH', label: 'Humidity', unit: '%', min: thresholds.humidityMin, max: thresholds.humidityMax },
    soilMoisture: { lowType: 'SOIL_MOISTURE_LOW', highType: 'SOIL_MOISTURE_HIGH', label: 'Soil moisture', unit: '%', min: thresholds.soilMin, max: thresholds.soilMax },
    lightIntensity: { lowType: 'LIGHT_LOW', highType: 'LIGHT_HIGH', label: 'Light', unit: 'lux', min: thresholds.lightMin, max: thresholds.lightMax },
  }
  const config = rules[metric]
  const low = value < config.min
  const high = value > config.max
  if (!low && !high) return undefined
  const type = low ? config.lowType : config.highType
  const boundary = low ? config.min : config.max
  return {
    type,
    title: `${config.label} ${low ? 'below' : 'above'} preferred range`,
    low,
    minimum: config.min,
    maximum: config.max,
    message: (reading, threshold, sensorName) =>
      `${sensorName} reports ${reading.toFixed(1)} ${config.unit}; the configured ${low ? 'minimum' : 'maximum'} is ${threshold} ${config.unit}.`,
  }
}

function severityFor(value: number, minimum: number, maximum: number): PrismaAlertSeverity {
  const span = maximum - minimum
  const deviation = value < minimum ? minimum - value : value - maximum
  return deviation >= span * 0.2 ? PrismaAlertSeverity.CRITICAL : PrismaAlertSeverity.WARNING
}

export const alertEngine = {
  async evaluateMeasurements(
    greenhouseId: string,
    thresholds: EnvironmentalThresholds,
    measurements: EvaluatedMeasurement[],
    sensors: Map<string, { name: string }>,
  ): Promise<void> {
    for (const measurement of measurements) {
      const sensor = sensors.get(measurement.sensorId)
      if (!sensor) continue
      const configured = {
        temperature: [thresholds.temperatureMin, thresholds.temperatureMax],
        humidity: [thresholds.humidityMin, thresholds.humidityMax],
        soilMoisture: [thresholds.soilMin, thresholds.soilMax],
        lightIntensity: [thresholds.lightMin, thresholds.lightMax],
      }[measurement.metric]
      if (!configured) continue
      const [minimum, maximum] = configured
      const margin = (maximum - minimum) * 0.02
      for (const low of [true, false]) {
        const type = {
          temperature: low ? 'TEMPERATURE_LOW' : 'TEMPERATURE_HIGH',
          humidity: low ? 'HUMIDITY_LOW' : 'HUMIDITY_HIGH',
          soilMoisture: low ? 'SOIL_MOISTURE_LOW' : 'SOIL_MOISTURE_HIGH',
          lightIntensity: low ? 'LIGHT_LOW' : 'LIGHT_HIGH',
        }[measurement.metric]
        const boundary = low ? minimum : maximum
        const violating = low ? measurement.value < boundary : measurement.value > boundary
        const conditionKey = `${greenhouseId}:${measurement.sensorId}:${type}`
        try {
          if (violating) {
            const rule = ruleFor(measurement.metric, thresholds, measurement.value)
            if (!rule || rule.type !== type) continue
            const result = await alertRepository.createCondition({
              greenhouseId,
              sensorId: measurement.sensorId,
              type,
              title: `${rule.title} · ${sensor.name}`,
              message: rule.message(measurement.value, boundary, sensor.name),
              severity: severityFor(measurement.value, minimum, maximum),
              source: sensor.name,
              conditionKey,
            })
            if (result.created && !emitAlert('alert:created', result.alert)) {
              console.error(`Alert ${result.alert.id} persisted but Socket.IO is not attached.`)
            }
          } else {
            const recovered = low ? measurement.value >= boundary + margin : measurement.value <= boundary - margin
            if (!recovered) continue
            const resolved = await alertRepository.resolveCondition(conditionKey)
            if (resolved && !emitAlert('alert:resolved', resolved)) {
              console.error(`Resolved alert ${resolved.id} persisted but Socket.IO is not attached.`)
            }
          }
        } catch (error) {
          console.error(`Alert evaluation failed for ${type}:`, error instanceof Error ? error.message : error)
        }
      }
    }
  },

  async evaluateSensorOffline(input: {
    greenhouseId: string
    sensorId: string
    sensorName: string
    staleAfterMs: number
  }): Promise<void> {
    const conditionKey = `${input.greenhouseId}:${input.sensorId}:SENSOR_OFFLINE`
    try {
      const result = await alertRepository.createCondition({
        greenhouseId: input.greenhouseId,
        sensorId: input.sensorId,
        type: 'SENSOR_OFFLINE',
        title: `Sensor offline · ${input.sensorName}`,
        message: `${input.sensorName} has not reported for ${Math.round(input.staleAfterMs / 60_000)} minutes.`,
        severity: PrismaAlertSeverity.WARNING,
        source: input.sensorName,
        conditionKey,
      })
      if (result.created && !emitAlert('alert:created', result.alert)) {
        console.error(`Offline alert ${result.alert.id} persisted but Socket.IO is not attached.`)
      }
    } catch (error) {
      console.error(`Offline alert evaluation failed for ${input.sensorName}:`, error instanceof Error ? error.message : error)
    }
  },

  async resolveSensorOnline(greenhouseId: string, sensorId: string): Promise<void> {
    const conditionKey = `${greenhouseId}:${sensorId}:SENSOR_OFFLINE`
    try {
      const resolved = await alertRepository.resolveCondition(conditionKey)
      if (resolved && !emitAlert('alert:resolved', resolved)) {
        console.error(`Resolved offline alert ${resolved.id} persisted but Socket.IO is not attached.`)
      }
    } catch (error) {
      console.error('Offline alert recovery failed:', error instanceof Error ? error.message : error)
    }
  },
}
