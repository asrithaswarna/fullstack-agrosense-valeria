import { SensorStatus as PrismaSensorStatus } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import type { Sensor, SensorStatus } from '../types/domain.js'
import { sensorConfiguration } from '../services/sensorConfiguration.js'

type SensorWithZone = Prisma.SensorGetPayload<{ include: { soilZone: true } }>

function toDomain(sensor: SensorWithZone): Sensor {
  const lastSeen = sensor.lastSeen?.toISOString() ?? null
  const status = sensor.status === PrismaSensorStatus.READY
    ? 'ready'
    : !lastSeen || Date.now() - new Date(lastSeen).getTime() > sensorConfiguration().staleAfterMs
      ? 'offline'
      : 'online'
  return {
    id: sensor.id,
    name: sensor.name,
    type: sensor.type,
    zone: sensor.soilZone?.name ?? sensor.zoneLabel,
    unit: sensor.unit,
    status: status as SensorStatus,
    lastReading: sensor.lastReading,
    lastSeen: lastSeen ?? 'Not reported',
    ...(sensor.batteryLevel === null ? {} : { batteryLevel: sensor.batteryLevel }),
  }
}

function toPrismaStatus(status: SensorStatus): PrismaSensorStatus {
  return status.toUpperCase() as PrismaSensorStatus
}

function ownedWhere(greenhouseId: string, id: string): Prisma.SensorWhereInput {
  return { id, greenhouseId }
}

export const sensorRepository = {
  async findAll(greenhouseId: string, status?: SensorStatus): Promise<Sensor[]> {
    const sensors = await prisma.sensor.findMany({
      where: { greenhouseId, ...(status ? { status: toPrismaStatus(status) } : {}) },
      include: { soilZone: true },
      orderBy: [{ type: 'asc' }, { zoneLabel: 'asc' }],
    })
    return sensors.map(toDomain)
  },

  async findById(greenhouseId: string, id: string): Promise<Sensor | undefined> {
    const sensor = await prisma.sensor.findFirst({
      where: ownedWhere(greenhouseId, id),
      include: { soilZone: true },
    })
    return sensor ? toDomain(sensor) : undefined
  },

  async create(greenhouseId: string, input: Pick<Sensor, 'name' | 'type' | 'zone' | 'unit'> & Partial<Pick<Sensor, 'status' | 'lastReading' | 'lastSeen' | 'batteryLevel'>>): Promise<Sensor> {
    const soilZone = await prisma.soilZone.findFirst({
      where: { greenhouseId, name: input.zone },
      select: { id: true },
    })
    const sensor = await prisma.sensor.create({
      data: {
        greenhouseId,
        soilZoneId: soilZone?.id,
        name: input.name,
        type: input.type,
        zoneLabel: input.zone,
        unit: input.unit,
        status: toPrismaStatus(input.status ?? 'online'),
        lastReading: input.lastReading ?? 'No reading yet',
        lastSeen: input.lastSeen ? new Date(input.lastSeen) : null,
        batteryLevel: input.batteryLevel,
      },
      include: { soilZone: true },
    })
    return toDomain(sensor)
  },

  async update(greenhouseId: string, id: string, patch: Partial<Omit<Sensor, 'id'>>): Promise<Sensor | undefined> {
    const data: Prisma.SensorUncheckedUpdateManyInput = {}
    if (patch.name !== undefined) data.name = patch.name
    if (patch.type !== undefined) data.type = patch.type
    if (patch.zone !== undefined) {
      data.zoneLabel = patch.zone
      const zone = await prisma.soilZone.findFirst({ where: { greenhouseId, name: patch.zone }, select: { id: true } })
      data.soilZoneId = zone?.id ?? null
    }
    if (patch.unit !== undefined) data.unit = patch.unit
    if (patch.status !== undefined) data.status = toPrismaStatus(patch.status)
    if (patch.lastReading !== undefined) data.lastReading = patch.lastReading
    if (patch.lastSeen !== undefined) data.lastSeen = new Date(patch.lastSeen)
    if (patch.batteryLevel !== undefined) data.batteryLevel = patch.batteryLevel
    const result = await prisma.sensor.updateMany({ where: ownedWhere(greenhouseId, id), data })
    if (result.count === 0) return undefined
    return this.findById(greenhouseId, id)
  },

  async delete(greenhouseId: string, id: string): Promise<boolean> {
    const result = await prisma.sensor.deleteMany({ where: ownedWhere(greenhouseId, id) })
    return result.count > 0
  },

  async findSensorIdByType(greenhouseId: string, type: string): Promise<string | undefined> {
    const sensor = await prisma.sensor.findFirst({ where: { greenhouseId, type }, select: { id: true } })
    return sensor?.id
  },

  toDomain,
}
