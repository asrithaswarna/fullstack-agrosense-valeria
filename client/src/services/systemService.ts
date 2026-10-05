import { useMockData } from '../config/env'
import { systemStatus } from '../data/mock'
import type { SystemStatus } from '../types/domain'
import { api } from './api'

export const systemService = {
  async getSystemStatus(): Promise<SystemStatus> {
    if (!useMockData) return api.get<SystemStatus>('/system/status')
    return systemStatus
  },
}
