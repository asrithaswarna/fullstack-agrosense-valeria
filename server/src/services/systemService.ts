import { systemRepository } from '../repositories/systemRepository.js'
import type { IrrigationStatus, SystemStatus } from '../types/domain.js'

export const systemService = {
  status(): Promise<SystemStatus> {
    return systemRepository.getStatus()
  },

  irrigationStatus(ownerId: string): Promise<IrrigationStatus | undefined> {
    return systemRepository.getIrrigationStatus(ownerId)
  },
}
