import type { EnvironmentalData, EnvironmentalThresholds } from '../types/domain'

export function environmentalRange(
  metric: keyof EnvironmentalData,
  thresholds: EnvironmentalThresholds,
): readonly [number, number] {
  switch (metric) {
    case 'temperature':
      return [thresholds.temperatureMin, thresholds.temperatureMax]
    case 'humidity':
      return [thresholds.humidityMin, thresholds.humidityMax]
    case 'soilMoisture':
      return [thresholds.soilMin, thresholds.soilMax]
    case 'lightIntensity':
      return [thresholds.lightMin, thresholds.lightMax]
  }
}
