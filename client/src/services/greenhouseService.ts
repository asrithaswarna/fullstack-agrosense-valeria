import { useMockData } from '../config/env'
import { mockGreenhouse } from '../data/mock'
import type { Greenhouse } from '../types/domain'
import { api } from './api'

let currentGreenhouse = { ...mockGreenhouse }

export const greenhouseService = {
  async getGreenhouse(): Promise<Greenhouse> {
    if (!useMockData) return api.get<Greenhouse>('/greenhouse')
    return { ...currentGreenhouse }
  },

  async updateGreenhouse(patch: Partial<Greenhouse>): Promise<Greenhouse> {
    if (!useMockData) return api.patch<Greenhouse, Partial<Greenhouse>>('/greenhouse', patch)
    currentGreenhouse = { ...currentGreenhouse, ...patch }
    return { ...currentGreenhouse }
  },
}
