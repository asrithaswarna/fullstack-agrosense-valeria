import { alertRepository } from '../repositories/alertRepository.js'
import { greenhouseRepository } from '../repositories/greenhouseRepository.js'
import type { Alert, AlertStatus } from '../types/domain.js'
import { AppError } from '../utils/AppError.js'
import { alertStatus, rejectUnknownFields, requireObject } from '../utils/validation.js'
import { emitAlert } from '../realtime/socketServer.js'

async function greenhouseIdFor(ownerId: string): Promise<string> {
  const greenhouseId = await greenhouseRepository.findIdByOwnerId(ownerId)
  if (!greenhouseId) throw new AppError('Greenhouse not found.', 404)
  return greenhouseId
}

export const alertService = {
  async list(ownerId: string, status?: AlertStatus): Promise<Alert[]> {
    return alertRepository.findAll(await greenhouseIdFor(ownerId), status)
  },

  async get(ownerId: string, id: string): Promise<Alert> {
    const alert = await alertRepository.findById(await greenhouseIdFor(ownerId), id)
    if (!alert) throw new AppError('Alert not found.', 404)
    return alert
  },

  async update(ownerId: string, id: string, body: unknown): Promise<Alert> {
    const input = requireObject(body)
    rejectUnknownFields(input, ['status'])
    if (!('status' in input)) throw new AppError('Provide a status to update the alert.', 400)
    const alert = await alertRepository.updateStatus(await greenhouseIdFor(ownerId), id, alertStatus(input.status))
    if (!alert) throw new AppError('Alert not found.', 404)
    if (alert.greenhouseId) {
      const realtimeAlert = {
        id: alert.id,
        greenhouseId: alert.greenhouseId,
        sensorId: alert.sensorId ?? null,
        type: alert.type,
        title: alert.title,
        message: alert.message,
        severity: alert.severity.toUpperCase() as 'INFO' | 'WARNING' | 'CRITICAL',
        status: alert.status.toUpperCase() as 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED',
        source: alert.source,
        createdAt: alert.timestamp,
        resolvedAt: alert.status === 'Resolved' ? new Date().toISOString() : null,
      }
      const event = alert.status === 'Resolved' ? 'alert:resolved' : 'alert:updated'
      if (!emitAlert(event, realtimeAlert)) console.error(`Alert ${alert.id} updated but Socket.IO is not attached.`)
    }
    return alert
  },
}
