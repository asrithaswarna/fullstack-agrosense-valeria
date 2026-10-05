import { GreenhouseStatus as PrismaGreenhouseStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import type { EnvironmentalThresholds, Greenhouse } from '../types/domain.js'

function toDomain(greenhouse: {
  id: string
  name: string
  location: string
  area: number
  timezone: string
  description: string
  status: PrismaGreenhouseStatus
  temperatureMin: number
  temperatureMax: number
  humidityMin: number
  humidityMax: number
  soilMin: number
  soilMax: number
  lightMin: number
  lightMax: number
}): Greenhouse {
  return {
    id: greenhouse.id,
    name: greenhouse.name,
    location: greenhouse.location,
    area: greenhouse.area,
    timezone: greenhouse.timezone,
    description: greenhouse.description,
    status: greenhouse.status.toLowerCase() as Greenhouse['status'],
    thresholds: {
      temperatureMin: greenhouse.temperatureMin,
      temperatureMax: greenhouse.temperatureMax,
      humidityMin: greenhouse.humidityMin,
      humidityMax: greenhouse.humidityMax,
      soilMin: greenhouse.soilMin,
      soilMax: greenhouse.soilMax,
      lightMin: greenhouse.lightMin,
      lightMax: greenhouse.lightMax,
    },
  }
}

export const greenhouseRepository = {
  async findByOwnerId(ownerId: string): Promise<Greenhouse | undefined> {
    const greenhouse = await prisma.greenhouse.findUnique({ where: { ownerId } })
    return greenhouse ? toDomain(greenhouse) : undefined
  },

  async updateByOwnerId(ownerId: string, patch: Partial<Greenhouse> & { thresholds?: EnvironmentalThresholds }): Promise<Greenhouse | undefined> {
    const result = await prisma.greenhouse.updateMany({
      where: { ownerId },
      data: {
        ...(patch.name === undefined ? {} : { name: patch.name }),
        ...(patch.location === undefined ? {} : { location: patch.location }),
        ...(patch.area === undefined ? {} : { area: patch.area }),
        ...(patch.timezone === undefined ? {} : { timezone: patch.timezone }),
        ...(patch.description === undefined ? {} : { description: patch.description }),
        ...(patch.status === undefined ? {} : { status: patch.status.toUpperCase() as PrismaGreenhouseStatus }),
        ...(patch.thresholds === undefined ? {} : patch.thresholds),
      },
    })
    if (result.count === 0) return undefined
    return this.findByOwnerId(ownerId)
  },

  async findIdByOwnerId(ownerId: string): Promise<string | undefined> {
    const greenhouse = await prisma.greenhouse.findUnique({ where: { ownerId }, select: { id: true } })
    return greenhouse?.id
  },

  async findThresholdsById(id: string): Promise<EnvironmentalThresholds | undefined> {
    const greenhouse = await prisma.greenhouse.findUnique({
      where: { id },
      select: {
        temperatureMin: true,
        temperatureMax: true,
        humidityMin: true,
        humidityMax: true,
        soilMin: true,
        soilMax: true,
        lightMin: true,
        lightMax: true,
      },
    })
    return greenhouse ?? undefined
  },
}
