import { IrrigationState } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

export const irrigationRepository = {
  async findSensorZone(sensorId: string, greenhouseId: string) {
    return prisma.sensor.findFirst({
      where: { id: sensorId, greenhouseId, soilZoneId: { not: null } },
      select: {
        id: true,
        greenhouseId: true,
        soilZoneId: true,
        soilZone: {
          select: {
            id: true,
            name: true,
            moisture: true,
            irrigationState: true,
          },
        },
        greenhouse: {
          select: { soilMin: true, irrigationEnabled: true },
        },
      },
    })
  },

  async updateZone(zoneId: string, moisture: number, state: IrrigationState) {
    return prisma.soilZone.update({
      where: { id: zoneId },
      data: { moisture, irrigationState: state },
      select: { id: true, name: true, moisture: true, irrigationState: true, updatedAt: true },
    })
  },
}
