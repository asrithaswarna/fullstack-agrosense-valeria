import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { RealtimeContext } from './context'
import type {
  IrrigationUpdatedEvent,
  RealtimeAlert,
  RealtimeConnectionStatus,
  SensorReadingEvent,
  SensorReadingMetric,
} from './events'

export function useSensorReadingEvents(onReconnect?: () => void): {
  readings: SensorReadingEvent[]
  latestByMetric: Partial<Record<SensorReadingMetric, SensorReadingEvent>>
  latestBySensorMetric: Map<string, SensorReadingEvent>
  alerts: RealtimeAlert[]
  irrigation: IrrigationUpdatedEvent[]
  connectionStatus: RealtimeConnectionStatus
} {
  const realtime = useContext(RealtimeContext)
  if (!realtime) throw new Error('useSensorReadingEvents must be used inside RealtimeProvider.')
  const [readings, setReadings] = useState<SensorReadingEvent[]>([])
  const [alerts, setAlerts] = useState<RealtimeAlert[]>([])
  const [irrigation, setIrrigation] = useState<IrrigationUpdatedEvent[]>([])
  const onReconnectRef = useRef(onReconnect)
  useEffect(() => {
    onReconnectRef.current = onReconnect
  }, [onReconnect])

  useEffect(() => {
    const socket = realtime.socket
    if (!socket) return
    const handleReading = (reading: SensorReadingEvent) => {
      setReadings((current) => {
        if (current.some((item) => item.id === reading.id)) return current
        return [...current, reading].slice(-200)
      })
    }
    const handleAlert = (alert: RealtimeAlert) => {
      setAlerts((current) => [...current.filter((item) => item.id !== alert.id), alert].slice(-100))
    }
    const handleIrrigation = (decision: IrrigationUpdatedEvent) => {
      setIrrigation((current) => [...current.filter((item) => item.zoneId !== decision.zoneId), decision].slice(-40))
    }
    socket.on('sensor:reading', handleReading)
    socket.on('alert:created', handleAlert)
    socket.on('alert:updated', handleAlert)
    socket.on('alert:resolved', handleAlert)
    socket.on('irrigation:updated', handleIrrigation)
    return () => {
      socket.off('sensor:reading', handleReading)
      socket.off('alert:created', handleAlert)
      socket.off('alert:updated', handleAlert)
      socket.off('alert:resolved', handleAlert)
      socket.off('irrigation:updated', handleIrrigation)
    }
  }, [realtime.socket])

  useEffect(() => {
    const handleReconnect = () => onReconnectRef.current?.()
    window.addEventListener('valeria:socket-connected', handleReconnect)
    return () => window.removeEventListener('valeria:socket-connected', handleReconnect)
  }, [])

  const latestByMetric = useMemo(() => {
    const latest: Partial<Record<SensorReadingMetric, SensorReadingEvent>> = {}
    for (const reading of readings) {
      const previous = latest[reading.metric]
      if (!previous || Date.parse(reading.recordedAt) >= Date.parse(previous.recordedAt)) {
        latest[reading.metric] = reading
      }
    }
    return latest
  }, [readings])

  const latestBySensorMetric = useMemo(() => {
    const latest = new Map<string, SensorReadingEvent>()
    for (const reading of readings) {
      const key = `${reading.sensorId}:${reading.metric}`
      const previous = latest.get(key)
      if (!previous || Date.parse(reading.recordedAt) >= Date.parse(previous.recordedAt)) {
        latest.set(key, reading)
      }
    }
    return latest
  }, [readings])

  return { readings, latestByMetric, latestBySensorMetric, alerts, irrigation, connectionStatus: realtime.status }
}
