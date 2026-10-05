import { useMockData } from '../config/env'
import { alerts } from '../data/mock'
import type { Alert, AlertStatus } from '../types/domain'
import { api } from './api'

export const alertService = {
  async getAlerts(): Promise<Alert[]> {
    if (!useMockData) return api.get<Alert[]>('/alerts')
    return alerts
  },

  async getActiveAlerts(): Promise<Alert[]> {
    if (!useMockData) return api.get<Alert[]>('/alerts/active')
    return alerts.filter((alert) => alert.status === 'Active')
  },

  async getAlert(id: string): Promise<Alert | undefined> {
    if (!useMockData) return api.get<Alert>(`/alerts/${encodeURIComponent(id)}`)
    return alerts.find((alert) => alert.id === id)
  },

  async updateAlert(id: string, status: AlertStatus): Promise<Alert> {
    if (!useMockData) return api.patch<Alert, { status: AlertStatus }>(`/alerts/${encodeURIComponent(id)}`, { status })
    const alert = alerts.find((item) => item.id === id)
    if (!alert) throw new Error('Alert not found.')
    alert.status = status
    return alert
  },
}
