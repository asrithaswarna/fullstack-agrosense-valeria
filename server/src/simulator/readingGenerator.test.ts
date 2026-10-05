import assert from 'node:assert/strict'
import test from 'node:test'
import { sensorConfiguration, type SensorConfiguration } from '../services/sensorConfiguration.js'
import { GreenhouseReadingGenerator, type SimulatorGreenhouse } from './readingGenerator.js'

const configuration: SensorConfiguration = {
  intervalMs: 5000,
  staleAfterMs: 60_000,
  ranges: {
    temperature: { minimum: -10, maximum: 60 },
    humidity: { minimum: 0, maximum: 100 },
    soilMoisture: { minimum: 0, maximum: 100 },
    lightIntensity: { minimum: 0, maximum: 100_000 },
  },
}

const greenhouse: SimulatorGreenhouse = {
  id: 'greenhouse-id',
  name: 'Greenhouse 01',
  timezone: 'UTC',
  sensors: [
    { id: 'temperature-a', name: 'DHT22', type: 'Temperature & humidity', unit: '°C / %', zoneLabel: 'Central aisle', lastReading: '24°C · 68%', soilZone: null },
    { id: 'soil-a', name: 'Soil moisture', type: 'Capacitive sensor', unit: '%', zoneLabel: 'Zone A', lastReading: '72%', soilZone: { id: 'zone-a', name: 'Zone A' } },
    { id: 'soil-b', name: 'Soil moisture', type: 'Capacitive sensor', unit: '%', zoneLabel: 'Zone B', lastReading: '68%', soilZone: { id: 'zone-b', name: 'Zone B' } },
    { id: 'light-a', name: 'LDR', type: 'Light intensity', unit: 'lux', zoneLabel: 'Roof level', lastReading: '842 lux', soilZone: null },
  ],
}

function metricsAt(reading: ReturnType<GreenhouseReadingGenerator['generate']>, metric: string): number[] {
  return reading.measurements.filter((measurement) => measurement.metric === metric).map((measurement) => measurement.value)
}

function atHour(hour: number): Date {
  return new Date(`2026-06-01T${String(hour).padStart(2, '0')}:00:00.000Z`)
}

test('temperature changes gradually and sensor-specific offsets remain small', () => {
  const generator = new GreenhouseReadingGenerator(configuration, () => 0.5)
  const first = generator.generate(greenhouse, atHour(14))
  const second = generator.generate(greenhouse, new Date(atHour(14).getTime() + configuration.intervalMs))
  const firstValue = metricsAt(first, 'temperature')[0]
  const secondValue = metricsAt(second, 'temperature')[0]
  assert.ok(Math.abs(secondValue - firstValue) < 1)

  const multipleSensors = {
    ...greenhouse,
    sensors: [
      ...greenhouse.sensors,
      { ...greenhouse.sensors[0], id: 'temperature-b', name: 'Temperature probe', type: 'Temperature' },
    ],
  }
  const temperatures = metricsAt(generator.generate(multipleSensors, atHour(14)), 'temperature')
  assert.equal(temperatures.length, 2)
  assert.ok(Math.abs(temperatures[0] - temperatures[1]) <= 0.8)
  assert.notEqual(temperatures[0], temperatures[1])
})

test('temperature is warmer by day and humidity responds inversely', () => {
  const generator = new GreenhouseReadingGenerator(configuration, () => 0.5)
  let night = generator.generate(greenhouse, atHour(2))
  for (let index = 0; index < 40; index += 1) night = generator.generate(greenhouse, atHour(2))
  let day = generator.generate(greenhouse, atHour(14))
  for (let index = 0; index < 40; index += 1) day = generator.generate(greenhouse, atHour(14))
  assert.ok(metricsAt(day, 'temperature')[0] > metricsAt(night, 'temperature')[0])
  assert.ok(metricsAt(day, 'humidity')[0] < metricsAt(night, 'humidity')[0])
})

test('soil moisture declines slowly and light follows the time of day', () => {
  const generator = new GreenhouseReadingGenerator(configuration, () => 0.5)
  const initial = generator.generate(greenhouse, atHour(2))
  const next = generator.generate(greenhouse, new Date(atHour(2).getTime() + configuration.intervalMs))
  assert.ok(metricsAt(next, 'soilMoisture')[0] < metricsAt(initial, 'soilMoisture')[0])
  assert.ok(metricsAt(initial, 'soilMoisture')[0] - metricsAt(next, 'soilMoisture')[0] < 0.01)

  const night = generator.generate(greenhouse, atHour(2))
  const day = generator.generate(greenhouse, atHour(12))
  const evening = generator.generate(greenhouse, atHour(19))
  assert.ok(metricsAt(night, 'lightIntensity')[0] < 50)
  assert.ok(metricsAt(day, 'lightIntensity')[0] > 1000)
  assert.ok(metricsAt(evening, 'lightIntensity')[0] < 50)
})

test('every generated measurement stays within configured bounds', () => {
  const generator = new GreenhouseReadingGenerator(configuration, () => 0.75)
  const reading = generator.generate(greenhouse, atHour(12))
  for (const measurement of reading.measurements) {
    const range = configuration.ranges[measurement.metric]
    assert.ok(measurement.value >= range.minimum && measurement.value <= range.maximum)
    assert.ok(Number.isFinite(measurement.value))
  }
})

test('invalid simulator interval configuration is rejected', () => {
  const previous = process.env.SENSOR_INTERVAL_MS
  process.env.SENSOR_INTERVAL_MS = 'not-an-interval'
  try {
    assert.throws(() => sensorConfiguration(), /SENSOR_INTERVAL_MS must be an integer/)
  } finally {
    if (previous === undefined) delete process.env.SENSOR_INTERVAL_MS
    else process.env.SENSOR_INTERVAL_MS = previous
  }
})
