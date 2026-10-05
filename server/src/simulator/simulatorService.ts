import { simulatorRepository } from '../repositories/simulatorRepository.js'
import { sensorReadingIngestionService } from '../services/sensorReadingIngestionService.js'
import { sensorConfiguration } from '../services/sensorConfiguration.js'
import { mqttAdapter } from '../mqtt/mqttAdapter.js'
import { GreenhouseReadingGenerator } from './readingGenerator.js'

export function createSensorSimulator() {
  let active = false
  let timer: NodeJS.Timeout | undefined
  let inFlight: Promise<void> = Promise.resolve()
  let generator: GreenhouseReadingGenerator | undefined
  let intervalMs = 0
  let inputMode: 'direct' | 'mqtt' = 'direct'
  let lastSummaryAt = 0
  const lastErrorByGreenhouse = new Map<string, { message: string; at: number }>()

  async function runCycle(): Promise<void> {
    try {
      const greenhouses = await simulatorRepository.findGreenhousesWithSensors()
      if (greenhouses.length === 0) {
        if (Date.now() - lastSummaryAt >= 60_000) {
          console.warn('Sensor simulator found no active greenhouses with sensors.')
          lastSummaryAt = Date.now()
        }
        return
      }
      let persistedGreenhouses = 0
      let persistedMeasurements = 0
      for (const greenhouse of greenhouses) {
        try {
          const reading = generator?.generate(greenhouse, new Date())
          if (!reading) throw new Error('Sensor simulator is not initialized.')
          if (inputMode === 'direct') {
            await sensorReadingIngestionService.ingestForGreenhouse(greenhouse.id, reading)
          } else {
            await mqttAdapter.publishSnapshot({
              greenhouseId: greenhouse.id,
              recordedAt: reading.recordedAt,
              measurements: reading.measurements,
            })
          }
          persistedGreenhouses += 1
          persistedMeasurements += reading.measurements.length
          lastErrorByGreenhouse.delete(greenhouse.id)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          const previous = lastErrorByGreenhouse.get(greenhouse.id)
          if (!previous || previous.message !== message || Date.now() - previous.at >= 60_000) {
            console.error(`Sensor simulator failed for ${greenhouse.name}: ${message}`)
            lastErrorByGreenhouse.set(greenhouse.id, { message, at: Date.now() })
          }
        }
      }
      if (persistedGreenhouses > 0 && Date.now() - lastSummaryAt >= 60_000) {
        console.info(`Sensor simulator persisted ${persistedMeasurements} measurements for ${persistedGreenhouses} greenhouse(s).`)
        lastSummaryAt = Date.now()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (Date.now() - lastSummaryAt >= 60_000) {
        console.error(`Sensor simulator could not load greenhouses: ${message}`)
        lastSummaryAt = Date.now()
      }
    }
  }

  async function cycle(): Promise<void> {
    if (!active) return
    inFlight = runCycle()
    await inFlight
    if (active) timer = setTimeout(() => { void cycle() }, intervalMs)
  }

  return {
    async start(): Promise<void> {
      if (active) return
      const configuration = sensorConfiguration()
      intervalMs = configuration.intervalMs
      const configuredMode = process.env.SENSOR_INPUT_MODE ?? 'direct'
      if (configuredMode !== 'direct' && configuredMode !== 'mqtt') {
        throw new Error('SENSOR_INPUT_MODE must be direct or mqtt.')
      }
      inputMode = configuredMode
      generator = new GreenhouseReadingGenerator(configuration)
      active = true
      console.info(`Sensor simulator started in ${inputMode} mode; interval ${intervalMs}ms.`)
      await cycle()
    },

    async stop(): Promise<void> {
      if (!active) return
      active = false
      if (timer) clearTimeout(timer)
      timer = undefined
      await inFlight
      console.info('Sensor simulator stopped.')
    },
  }
}

export const sensorSimulatorService = createSensorSimulator()
