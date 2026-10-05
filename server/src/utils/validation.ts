import type { Request } from 'express'
import { AppError } from './AppError.js'
import type { AlertStatus, AnalyticsRange, SensorStatus } from '../types/domain.js'

export function requireObject(value: unknown, label = 'Request body'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(`${label} must be a JSON object.`, 400)
  }
  return value as Record<string, unknown>
}

export function rejectUnknownFields(value: Record<string, unknown>, allowed: readonly string[]): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key))
  if (unknown) throw new AppError(`Field "${unknown}" is not allowed.`, 400)
}

export function requiredString(value: unknown, name: string, maxLength = 120): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new AppError(`${name} must be a non-empty string of at most ${maxLength} characters.`, 400)
  }
  return value.trim()
}

export function optionalString(value: unknown, name: string, maxLength = 500): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new AppError(`${name} must be a non-empty string of at most ${maxLength} characters.`, 400)
  }
  return value.trim()
}

export function positiveNumber(value: unknown, name: string, maximum = 100000): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > maximum) {
    throw new AppError(`${name} must be a positive number no greater than ${maximum}.`, 400)
  }
  return value
}

export function optionalBattery(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new AppError('batteryLevel must be a number from 0 to 100.', 400)
  }
  return value
}

export function sensorStatus(value: unknown): SensorStatus {
  if (value !== 'online' && value !== 'offline' && value !== 'warning' && value !== 'ready') {
    throw new AppError('status must be online, offline, warning, or ready.', 400)
  }
  return value
}

export function alertStatus(value: unknown): AlertStatus {
  if (value !== 'Active' && value !== 'Acknowledged' && value !== 'Resolved') {
    throw new AppError('status must be Active, Acknowledged, or Resolved.', 400)
  }
  return value
}

export function analyticsRange(value: unknown): AnalyticsRange {
  if (value !== '24h' && value !== '7d' && value !== '30d') {
    throw new AppError('range must be 24h, 7d, or 30d.', 400)
  }
  return value
}

export function queryString(request: Request, key: string): string | undefined {
  const value = request.query[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new AppError(`${key} must be a single query value.`, 400)
  return value
}

export function rejectUnknownQuery(request: Request, allowed: readonly string[]): void {
  const unknown = Object.keys(request.query).find((key) => !allowed.includes(key))
  if (unknown) throw new AppError(`Query parameter "${unknown}" is not supported.`, 400)
}

export function resourceId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    throw new AppError('The requested ID is invalid.', 400)
  }
  return value
}

export function parseDate(value: unknown, name: string): string {
  const date = requiredString(value, name, 40)
  if (Number.isNaN(Date.parse(date))) throw new AppError(`${name} must be a valid date.`, 400)
  return new Date(date).toISOString()
}
