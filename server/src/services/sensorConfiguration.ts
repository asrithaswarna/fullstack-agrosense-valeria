export interface SensorValueRange {
  minimum: number
  maximum: number
}

export interface SensorConfiguration {
  intervalMs: number
  staleAfterMs: number
  ranges: {
    temperature: SensorValueRange
    humidity: SensorValueRange
    soilMoisture: SensorValueRange
    lightIntensity: SensorValueRange
  }
}

function integerSetting(name: string, fallback: number, minimum: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw.trim() === '') return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer of at least ${minimum}.`)
  }
  return value
}

function range(name: string, defaultMinimum: number, defaultMaximum: number): SensorValueRange {
  const minimumRaw = process.env[`${name}_MIN`]
  const maximumRaw = process.env[`${name}_MAX`]
  const minimum = minimumRaw === undefined || minimumRaw.trim() === '' ? defaultMinimum : Number(minimumRaw)
  const maximum = maximumRaw === undefined || maximumRaw.trim() === '' ? defaultMaximum : Number(maximumRaw)
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum) {
    throw new Error(`${name}_MIN and ${name}_MAX must be finite numbers with MIN less than MAX.`)
  }
  return { minimum, maximum }
}

export function sensorConfiguration(): SensorConfiguration {
  const intervalMs = integerSetting('SENSOR_INTERVAL_MS', 5000, 250)
  return {
    intervalMs,
    staleAfterMs: integerSetting('SENSOR_STALE_AFTER_MS', Math.max(intervalMs * 3, 60_000), intervalMs),
    ranges: {
      temperature: range('SENSOR_TEMPERATURE', -10, 60),
      humidity: range('SENSOR_HUMIDITY', 0, 100),
      soilMoisture: range('SENSOR_SOIL_MOISTURE', 0, 100),
      lightIntensity: range('SENSOR_LIGHT_INTENSITY', 0, 100_000),
    },
  }
}
