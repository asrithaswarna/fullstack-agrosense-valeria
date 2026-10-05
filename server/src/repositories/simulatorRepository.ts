import { prisma } from '../lib/prisma.js'

export const simulatorRepository = {
  findGreenhousesWithSensors() {
    return prisma.greenhouse.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        timezone: true,
        sensors: {
          where: { type: { not: 'Irrigation control' } },
          select: {
            id: true,
            name: true,
            type: true,
            unit: true,
            zoneLabel: true,
            lastReading: true,
            soilZone: { select: { id: true, name: true } },
          },
          orderBy: [{ type: 'asc' }, { zoneLabel: 'asc' }],
        },
      },
    })
  },
}
