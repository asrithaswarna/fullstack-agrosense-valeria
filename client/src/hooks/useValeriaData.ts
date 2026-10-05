import { useCallback } from 'react'
import type { AnalyticsRange } from '../types/domain'
import { alertService } from '../services/alertService'
import { analyticsService } from '../services/analyticsService'
import { greenhouseService } from '../services/greenhouseService'
import { sensorService } from '../services/sensorService'
import { systemService } from '../services/systemService'
import { useAsyncData } from './useAsyncData'

export function useSensorData() {
  return useAsyncData(sensorService.getDashboardData, 'Unable to load sensor readings.')
}

export function useIrrigationStatus() {
  return useAsyncData(sensorService.getIrrigationStatus, 'Unable to load irrigation information.')
}

export function useLiveSensorData() {
  return useAsyncData(sensorService.getLiveMonitorData, 'Unable to load live sensor readings.')
}

export function useSensors() {
  return useAsyncData(sensorService.getSensors, 'Unable to load the sensor list.')
}

export function useAlerts() {
  return useAsyncData(alertService.getAlerts, 'Unable to load alerts.')
}

export function useAnalytics(range: AnalyticsRange) {
  const load = useCallback(() => analyticsService.getAnalytics(range), [range])
  return useAsyncData(load, 'Historical data could not be retrieved.')
}

export function useGreenhouse() {
  return useAsyncData(greenhouseService.getGreenhouse, 'Unable to load greenhouse details.')
}

export function useSystemStatus() {
  return useAsyncData(systemService.getSystemStatus, 'System status is temporarily unavailable.')
}

export function useSensorHistory(sensorId: string, range: AnalyticsRange) {
  const load = useCallback(() => sensorService.getSensorHistory(sensorId, range), [range, sensorId])
  return useAsyncData(load, 'Unable to load sensor history.')
}
