import { SensorStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import type { IrrigationStatus, SystemStatus } from '../types/domain.js'
import { mqttAdapter } from '../mqtt/mqttAdapter.js'

export const systemRepository = {
  async getStatus(): Promise<SystemStatus> {
    let databaseStatus: SystemStatus['databaseStatus'] = 'online'
    let sensorSync: SystemStatus['sensorSync'] = 'standby'
    let lastSync = 'No readings yet'
    try {
      await prisma.$queryRaw`SELECT 1`
      const [sensorCount, onlineSensorCount, latestMeasurement] = await Promise.all([
        prisma.sensor.count(),
        prisma.sensor.count({ where: { status: { in: [SensorStatus.ONLINE, SensorStatus.WARNING] } } }),
        prisma.sensorMeasurement.findFirst({
          orderBy: { recordedAt: 'desc' },
          select: { recordedAt: true },
        }),
      ])
      sensorSync = sensorCount === 0 ? 'standby' : onlineSensorCount > 0 ? 'online' : 'offline'
      lastSync = latestMeasurement?.recordedAt.toLocaleString() ?? 'No readings yet'
    } catch {
      databaseStatus = 'offline'
      sensorSync = 'offline'
    }
    return {
      overallStatus: databaseStatus === 'online' ? 'online' : 'offline',
      mqttStatus: mqttAdapter.connected ? 'online' : 'offline',
      websocketStatus: 'online',
      databaseStatus,
      sensorSync,
      lastSync,
    }
  },

  async getIrrigationStatus(ownerId: string): Promise<IrrigationStatus | undefined> {
    const greenhouse = await prisma.greenhouse.findUnique({
      where: { ownerId },
      select: {
        irrigationEnabled: true,
        irrigationActive: true,
        currentZone: true,
        irrigationStartedAt: true,
        irrigationDurationMinutes: true,
        irrigationMode: true,
        irrigationLastCycle: true,
        soilMin: true,
        soilZones: {
          select: {
            id: true,
            name: true,
            moisture: true,
            irrigationState: true,
            updatedAt: true,
          },
        },
      },
    })
    if (!greenhouse) return undefined
    return {
      enabled: greenhouse.irrigationEnabled,
      active: greenhouse.irrigationActive,
      currentZone: greenhouse.currentZone,
      startedAt: greenhouse.irrigationStartedAt?.toISOString() ?? null,
      durationMinutes: greenhouse.irrigationDurationMinutes,
      mode: greenhouse.irrigationMode.toLowerCase() as IrrigationStatus['mode'],
      lastCycle: greenhouse.irrigationLastCycle,
      recommendations: greenhouse.soilZones.map((zone) => ({
        zoneId: zone.id,
        zone: zone.name,
        moisture: zone.moisture,
        threshold: greenhouse.soilMin,
        state: zone.irrigationState === 'SCHEDULED' ? 'needs_water' as const
          : zone.irrigationState === 'WATERING' ? 'monitoring' as const : 'idle' as const,
        simulated: true as const,
        updatedAt: zone.updatedAt.toISOString(),
      })),
    }
  },
}
