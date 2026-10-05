import { createServer } from 'node:http'
import app from './app.js'
import { prisma } from './lib/prisma.js'
import { clearSocketServer, createSocketServer } from './realtime/socketServer.js'
import { sensorSimulatorService } from './simulator/simulatorService.js'
import { sensorConfiguration } from './services/sensorConfiguration.js'
import { mqttAdapter } from './mqtt/mqttAdapter.js'
import { sensorHealthMonitor } from './services/sensorHealthMonitor.js'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be configured before starting the VALERIA API.')
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters before starting the VALERIA API.')
}
sensorConfiguration()

const parsedPort = Number(process.env.PORT ?? 5000)
if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
  throw new Error('PORT must be a whole number between 1 and 65535.')
}

const httpServer = createServer(app)
const io = createSocketServer(httpServer)
let shutdownPromise: Promise<void> | undefined

async function shutdown(signal: string): Promise<void> {
  if (shutdownPromise) return shutdownPromise
  shutdownPromise = (async () => {
    console.info(`VALERIA server received ${signal}; shutting down.`)
    await sensorHealthMonitor.stop()
    await sensorSimulatorService.stop()
    await mqttAdapter.stop()
    clearSocketServer(io)
    await new Promise<void>((resolve) => io.close(() => resolve()))
    await prisma.$disconnect()
  })()
  return shutdownPromise
}

process.once('SIGINT', () => {
  void shutdown('SIGINT').catch((error: unknown) => {
    console.error('VALERIA server shutdown failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
})
process.once('SIGTERM', () => {
  void shutdown('SIGTERM').catch((error: unknown) => {
    console.error('VALERIA server shutdown failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
})

httpServer.listen(parsedPort, () => {
  console.info(`VALERIA API listening on port ${parsedPort}`)
  void mqttAdapter.start().then(() => {
    sensorHealthMonitor.start()
    if (process.env.NODE_ENV === 'production') {
      console.info('Sensor simulator is disabled in production.')
      return
    }
    return sensorSimulatorService.start()
  }).catch(async (error: unknown) => {
      console.error('Sensor simulator failed to start:', error instanceof Error ? error.message : error)
      process.exitCode = 1
      await shutdown('simulator startup failure')
    })
})
