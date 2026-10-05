import { AlertSeverity as PrismaAlertSeverity, AlertStatus as PrismaAlertStatus } from '@prisma/client'
import type { Alert as PrismaAlert } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import type { Alert, AlertSeverity, AlertStatus } from '../types/domain.js'
import type { RealtimeAlert } from '../realtime/events.js'

type AlertWithSensor = PrismaAlert & { sensor?: { type: string } | null }

function toDomain(alert: AlertWithSensor): Alert {
  return {
    id: alert.id,
    type: alert.type,
    title: alert.title,
    message: alert.message,
    severity: alert.severity[0] + alert.severity.slice(1).toLowerCase() as AlertSeverity,
    source: alert.source,
    timestamp: alert.createdAt.toISOString(),
    time: alert.createdAt.toLocaleString(),
    status: alert.status[0] + alert.status.slice(1).toLowerCase() as AlertStatus,
    greenhouseId: alert.greenhouseId,
    sensorId: alert.sensorId,
    sensorType: alert.sensor?.type ?? null,
  }
}

function toRealtime(alert: PrismaAlert): RealtimeAlert {
  return {
    id: alert.id,
    greenhouseId: alert.greenhouseId,
    sensorId: alert.sensorId,
    type: alert.type,
    title: alert.title,
    message: alert.message,
    severity: alert.severity,
    status: alert.status,
    source: alert.source,
    createdAt: alert.createdAt.toISOString(),
    resolvedAt: alert.resolvedAt?.toISOString() ?? null,
  }
}

function toPrismaStatus(status: AlertStatus): PrismaAlertStatus {
  return status.toUpperCase() as PrismaAlertStatus
}

export const alertRepository = {
  async findAll(greenhouseId: string, status?: AlertStatus): Promise<Alert[]> {
    const alerts = await prisma.alert.findMany({
      where: { greenhouseId, ...(status ? { status: toPrismaStatus(status) } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { sensor: { select: { type: true } } },
    })
    return alerts.map(toDomain)
  },

  async findById(greenhouseId: string, id: string): Promise<Alert | undefined> {
    const alert = await prisma.alert.findFirst({
      where: { greenhouseId, id },
      include: { sensor: { select: { type: true } } },
    })
    return alert ? toDomain(alert) : undefined
  },

  async updateStatus(greenhouseId: string, id: string, status: AlertStatus): Promise<Alert | undefined> {
    const updatedAt = new Date()
    const acknowledged = status === 'Acknowledged'
    const result = await prisma.alert.updateMany({
      where: { greenhouseId, id },
      data: {
        status: toPrismaStatus(status),
        acknowledged,
        acknowledgedAt: acknowledged ? updatedAt : null,
        resolvedAt: status === 'Resolved' ? updatedAt : null,
        ...(status === 'Resolved' ? { activeConditionKey: null } : {}),
      },
    })
    if (result.count === 0) return undefined
    return this.findById(greenhouseId, id)
  },

  async createCondition(input: {
    greenhouseId: string
    sensorId: string
    type: string
    title: string
    message: string
    severity: PrismaAlertSeverity
    source: string
    conditionKey: string
  }): Promise<{ alert: RealtimeAlert; created: boolean }> {
    return prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${input.conditionKey}))) AS lock`
      const existing = await transaction.alert.findUnique({ where: { activeConditionKey: input.conditionKey } })
      if (existing) return { alert: toRealtime(existing), created: false }
      const alert = await transaction.alert.create({
        data: {
          greenhouseId: input.greenhouseId,
          sensorId: input.sensorId,
          type: input.type,
          title: input.title,
          message: input.message,
          severity: input.severity,
          source: input.source,
          activeConditionKey: input.conditionKey,
        },
      })
      return { alert: toRealtime(alert), created: true }
    })
  },

  async resolveCondition(conditionKey: string): Promise<RealtimeAlert | undefined> {
    return prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${conditionKey}))) AS lock`
      const existing = await transaction.alert.findUnique({ where: { activeConditionKey: conditionKey } })
      if (!existing) return undefined
      const resolved = await transaction.alert.update({
        where: { id: existing.id },
        data: {
          status: PrismaAlertStatus.RESOLVED,
          acknowledged: false,
          acknowledgedAt: null,
          resolvedAt: new Date(),
          activeConditionKey: null,
        },
      })
      return toRealtime(resolved)
    })
  },

  toRealtime,
}
