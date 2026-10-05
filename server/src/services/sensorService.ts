import { sensorRepository } from '../repositories/sensorRepository.js'
import { greenhouseRepository } from '../repositories/greenhouseRepository.js'
import type { Sensor, SensorStatus } from '../types/domain.js'
import { AppError } from '../utils/AppError.js'
import { optionalBattery, parseDate, rejectUnknownFields, requiredString, requireObject, sensorStatus } from '../utils/validation.js'

const sensorFields = ['name', 'type', 'zone', 'unit', 'status', 'lastReading', 'lastSeen', 'batteryLevel'] as const

async function greenhouseIdFor(ownerId: string): Promise<string> {
  const greenhouseId = await greenhouseRepository.findIdByOwnerId(ownerId)
  if (!greenhouseId) throw new AppError('Greenhouse not found.', 404)
  return greenhouseId
}

export const sensorService = {
  async list(ownerId: string, status?: SensorStatus): Promise<Sensor[]> {
    return sensorRepository.findAll(await greenhouseIdFor(ownerId), status)
  },

  async get(ownerId: string, id: string): Promise<Sensor> {
    const sensor = await sensorRepository.findById(await greenhouseIdFor(ownerId), id)
    if (!sensor) throw new AppError('Sensor not found.', 404)
    return sensor
  },

  async create(ownerId: string, body: unknown): Promise<Sensor> {
    const input = requireObject(body)
    rejectUnknownFields(input, sensorFields)
    const sensor: Pick<Sensor, 'name' | 'type' | 'zone' | 'unit'> & Partial<Pick<Sensor, 'status' | 'lastReading' | 'lastSeen' | 'batteryLevel'>> = {
      name: requiredString(input.name, 'name'),
      type: requiredString(input.type, 'type'),
      zone: requiredString(input.zone, 'zone'),
      unit: requiredString(input.unit, 'unit', 40),
      status: input.status === undefined ? 'online' : sensorStatus(input.status),
      lastReading: input.lastReading === undefined ? 'No reading yet' : requiredString(input.lastReading, 'lastReading'),
    }
    if (input.lastSeen !== undefined) sensor.lastSeen = parseDate(input.lastSeen, 'lastSeen')
    if (input.batteryLevel !== undefined) sensor.batteryLevel = optionalBattery(input.batteryLevel)
    return sensorRepository.create(await greenhouseIdFor(ownerId), sensor)
  },

  async update(ownerId: string, id: string, body: unknown): Promise<Sensor> {
    const input = requireObject(body)
    rejectUnknownFields(input, sensorFields)
    if (Object.keys(input).length === 0) throw new AppError('Provide at least one sensor field to update.', 400)
    const patch: Partial<Omit<Sensor, 'id'>> = {}
    if ('name' in input) patch.name = requiredString(input.name, 'name')
    if ('type' in input) patch.type = requiredString(input.type, 'type')
    if ('zone' in input) patch.zone = requiredString(input.zone, 'zone')
    if ('unit' in input) patch.unit = requiredString(input.unit, 'unit', 40)
    if ('status' in input) patch.status = sensorStatus(input.status)
    if ('lastReading' in input) patch.lastReading = requiredString(input.lastReading, 'lastReading')
    if ('lastSeen' in input) patch.lastSeen = parseDate(input.lastSeen, 'lastSeen')
    if ('batteryLevel' in input) patch.batteryLevel = optionalBattery(input.batteryLevel)
    const updated = await sensorRepository.update(await greenhouseIdFor(ownerId), id, patch)
    if (!updated) throw new AppError('Sensor not found.', 404)
    return updated
  },

  async delete(ownerId: string, id: string): Promise<{ id: string; deleted: true }> {
    if (!await sensorRepository.delete(await greenhouseIdFor(ownerId), id)) throw new AppError('Sensor not found.', 404)
    return { id, deleted: true }
  },
}
