import { readingRepository } from '../repositories/readingRepository.js'
import { alertEngine } from './alertEngine.js'
import { sensorConfiguration } from './sensorConfiguration.js'

export function createSensorHealthMonitor() {
  let timer: NodeJS.Timeout | undefined
  let running = false
  let cycleInFlight: Promise<void> = Promise.resolve()

  async function check(): Promise<void> {
    if (running) return
    running = true
    cycleInFlight = (async () => {
      const staleAfterMs = sensorConfiguration().staleAfterMs
      const cutoff = new Date(Date.now() - staleAfterMs)
      const sensors = await readingRepository.findStaleSensors(cutoff)
      for (const sensor of sensors) {
        const updated = await readingRepository.markSensorOffline(sensor.id, sensor.greenhouseId, cutoff)
        if (updated.count > 0) {
          await alertEngine.evaluateSensorOffline({
            greenhouseId: sensor.greenhouseId,
            sensorId: sensor.id,
            sensorName: sensor.name,
            staleAfterMs,
          })
        }
      }
    })().catch((error: unknown) => {
      console.error('Sensor health check failed:', error instanceof Error ? error.message : error)
    }).finally(() => { running = false })
    await cycleInFlight
  }

  return {
    start(): void {
      if (timer) return
      const interval = Math.max(5_000, Math.min(sensorConfiguration().staleAfterMs / 2, 60_000))
      void check()
      timer = setInterval(() => { void check() }, interval)
    },
    async stop(): Promise<void> {
      if (timer) clearInterval(timer)
      timer = undefined
      await cycleInFlight
    },
  }
}

export const sensorHealthMonitor = createSensorHealthMonitor()
