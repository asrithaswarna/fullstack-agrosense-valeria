import { IrrigationState } from '@prisma/client'
import { irrigationRepository } from '../repositories/irrigationRepository.js'
import { emitIrrigationUpdate } from '../realtime/socketServer.js'

const recoveryMargin = 2

export const irrigationIntelligence = {
  async evaluate(greenhouseId: string, sensorId: string, moisture: number): Promise<void> {
    try {
      const sensor = await irrigationRepository.findSensorZone(sensorId, greenhouseId)
      if (!sensor?.soilZone) return
      const current = sensor.soilZone.irrigationState
      const lowerLimit = sensor.greenhouse.soilMin
      const state = !sensor.greenhouse.irrigationEnabled
        ? IrrigationState.IDLE
        : current === IrrigationState.SCHEDULED
          ? moisture >= lowerLimit + recoveryMargin ? IrrigationState.IDLE : IrrigationState.SCHEDULED
          : moisture < lowerLimit ? IrrigationState.SCHEDULED : IrrigationState.IDLE
      const zone = await irrigationRepository.updateZone(sensor.soilZone.id, moisture, state)
      if (state === current) return
      if (!emitIrrigationUpdate({
        greenhouseId,
        zoneId: zone.id,
        zone: zone.name,
        moisture: zone.moisture,
        threshold: lowerLimit,
        state: zone.irrigationState === IrrigationState.SCHEDULED
          ? 'NEEDS_WATER'
          : zone.irrigationState === IrrigationState.WATERING ? 'MONITORING' : 'IDLE',
        simulated: true,
        timestamp: zone.updatedAt.toISOString(),
      })) {
        console.error(`Irrigation recommendation for ${zone.name} persisted but Socket.IO is not attached.`)
      }
    } catch (error) {
      console.error(`Irrigation evaluation failed for sensor ${sensorId}:`, error instanceof Error ? error.message : error)
    }
  },
}
