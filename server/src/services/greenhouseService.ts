import { greenhouseRepository } from '../repositories/greenhouseRepository.js'
import type { EnvironmentalThresholds, Greenhouse } from '../types/domain.js'
import { AppError } from '../utils/AppError.js'
import { optionalString, positiveNumber, rejectUnknownFields, requireObject } from '../utils/validation.js'

export const greenhouseService = {
  async get(ownerId: string): Promise<Greenhouse> {
    const greenhouse = await greenhouseRepository.findByOwnerId(ownerId)
    if (!greenhouse) throw new AppError('Greenhouse not found.', 404)
    return greenhouse
  },

  async update(ownerId: string, body: unknown): Promise<Greenhouse> {
    const input = requireObject(body)
    const allowed = ['name', 'location', 'area', 'timezone', 'description', 'status', 'thresholds'] as const
    rejectUnknownFields(input, allowed)
    if (Object.keys(input).length === 0) throw new AppError('Provide at least one greenhouse field to update.', 400)
    const patch: Partial<Greenhouse> & { thresholds?: EnvironmentalThresholds } = {}
    if ('name' in input) patch.name = optionalString(input.name, 'name', 120)
    if ('location' in input) patch.location = optionalString(input.location, 'location', 160)
    if ('area' in input) patch.area = positiveNumber(input.area, 'area', 1000000)
    if ('timezone' in input) {
      const timezone = optionalString(input.timezone, 'timezone', 80)
      if (!timezone || !/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)*$/.test(timezone)) throw new AppError('timezone must be a valid timezone name.', 400)
      patch.timezone = timezone
    }
    if ('description' in input) {
      if (typeof input.description !== 'string' || input.description.length > 500) throw new AppError('description must be a string of at most 500 characters.', 400)
      patch.description = input.description.trim()
    }
    if ('status' in input) {
      if (input.status !== 'active' && input.status !== 'inactive') throw new AppError('status must be active or inactive.', 400)
      patch.status = input.status
    }
    if ('thresholds' in input) {
      const raw = requireObject(input.thresholds, 'thresholds')
      const keys: (keyof EnvironmentalThresholds)[] = [
        'temperatureMin', 'temperatureMax', 'humidityMin', 'humidityMax',
        'soilMin', 'soilMax', 'lightMin', 'lightMax',
      ]
      rejectUnknownFields(raw, keys)
      if (Object.keys(raw).length !== keys.length || keys.some((key) => typeof raw[key] !== 'number' || !Number.isFinite(raw[key]))) {
        throw new AppError('Provide all eight environmental threshold values as finite numbers.', 400)
      }
      const thresholds: EnvironmentalThresholds = {
        temperatureMin: raw.temperatureMin as number,
        temperatureMax: raw.temperatureMax as number,
        humidityMin: raw.humidityMin as number,
        humidityMax: raw.humidityMax as number,
        soilMin: raw.soilMin as number,
        soilMax: raw.soilMax as number,
        lightMin: raw.lightMin as number,
        lightMax: raw.lightMax as number,
      }
      const ranges: [keyof EnvironmentalThresholds, keyof EnvironmentalThresholds, number, number][] = [
        ['temperatureMin', 'temperatureMax', -10, 60],
        ['humidityMin', 'humidityMax', 0, 100],
        ['soilMin', 'soilMax', 0, 100],
        ['lightMin', 'lightMax', 0, 100_000],
      ]
      for (const [minimumKey, maximumKey, minimum, maximum] of ranges) {
        const lower = thresholds[minimumKey]
        const upper = thresholds[maximumKey]
        if (lower < minimum || upper > maximum || lower >= upper) {
          throw new AppError(`${minimumKey} and ${maximumKey} must be ordered and within ${minimum} to ${maximum}.`, 400)
        }
      }
      patch.thresholds = thresholds
    }
    const greenhouse = await greenhouseRepository.updateByOwnerId(ownerId, patch)
    if (!greenhouse) throw new AppError('Greenhouse not found.', 404)
    return greenhouse
  },
}
