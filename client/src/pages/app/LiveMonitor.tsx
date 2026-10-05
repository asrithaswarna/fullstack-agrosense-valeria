import PageHeading from '../../components/ui/PageHeading'
import LineChart from '../../components/ui/LineChart'
import DataState from '../../components/ui/DataState'
import RefreshButton from '../../components/ui/RefreshButton'
import { useAlerts, useGreenhouse, useIrrigationStatus, useLiveSensorData } from '../../hooks/useValeriaData'
import { useSensorReadingEvents } from '../../realtime/useSensorReadingEvents'
import { environmentalRange } from '../../utils/environmentalThresholds'
import type { EnvironmentalData, SensorReading } from '../../types/domain'

export default function LiveMonitor() {
  const liveData = useLiveSensorData()
  const alertData = useAlerts()
  const irrigationData = useIrrigationStatus()
  const greenhouseData = useGreenhouse()
  function refreshAll() {
    void Promise.all([liveData.refresh(), alertData.refresh(), irrigationData.refresh(), greenhouseData.refresh()])
  }
  const realtime = useSensorReadingEvents(refreshAll)

  const loading = liveData.loading || alertData.loading || irrigationData.loading || greenhouseData.loading
  const error = liveData.error ?? alertData.error ?? irrigationData.error ?? greenhouseData.error
  const greenhouse = greenhouseData.data
  if (loading || error || !liveData.data || !greenhouse) {
    return <div className="page-content"><PageHeading eyebrow="LIVE ENVIRONMENTAL DATA" title="Live monitor" description="Current conditions across your greenhouse." /><DataState loading={loading} error={error} onRetry={refreshAll} /></div>
  }

  const { temperatureSeries, humiditySeries, soilSeries, lightSeries, recentReadings, latestReadings } = liveData.data
  const baseTimestamp = Date.parse(latestReadings.timestamp)
  const snapshots = new Map<string, SensorReading>()
  for (const event of realtime.readings) {
    if (event.snapshotId && event.snapshot && Date.parse(event.recordedAt) > baseTimestamp) {
      snapshots.set(event.snapshotId, event.snapshot)
    }
  }
  const liveSnapshots = Array.from(snapshots.values()).sort((left, right) =>
    Date.parse(left.timestamp) - Date.parse(right.timestamp))
  const newestSnapshot = liveSnapshots.at(-1)
  const current: SensorReading = {
    ...(newestSnapshot ?? latestReadings),
  }
  const newestSnapshotTimestamp = Date.parse(current.timestamp)
  for (const event of Object.values(realtime.latestByMetric)) {
    if (event && !event.snapshot && Date.parse(event.recordedAt) > newestSnapshotTimestamp) {
      current[event.metric] = event.value
      if (Date.parse(event.recordedAt) > Date.parse(current.timestamp)) current.timestamp = event.recordedAt
    }
  }
  const metricKeys: Record<string, keyof EnvironmentalData> = {
    Temperature: 'temperature',
    Humidity: 'humidity',
    'Soil moisture': 'soilMoisture',
    'Light intensity': 'lightIntensity',
  }
  const metrics = liveData.data.metrics.map((metric) => {
    const key = metricKeys[metric.label]
    const value = current[key]
    const [low, high] = environmentalRange(key, greenhouse.thresholds)
    return {
      ...metric,
      value: key === 'temperature' ? value.toFixed(1) : Math.round(value).toLocaleString(),
      state: value < low ? 'Monitor' : value > high ? 'High' : 'Optimal',
    }
  })
  const updatedAt = new Date(current.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const historySeries = {
    temperature: [...temperatureSeries, ...liveSnapshots.map((reading) => reading.temperature), ...realtime.readings.filter((event) => !event.snapshot && event.metric === 'temperature' && Date.parse(event.recordedAt) > baseTimestamp).map((event) => event.value)],
    humidity: [...humiditySeries, ...liveSnapshots.map((reading) => reading.humidity), ...realtime.readings.filter((event) => !event.snapshot && event.metric === 'humidity' && Date.parse(event.recordedAt) > baseTimestamp).map((event) => event.value)],
    soilMoisture: [...soilSeries, ...liveSnapshots.map((reading) => reading.soilMoisture), ...realtime.readings.filter((event) => !event.snapshot && event.metric === 'soilMoisture' && Date.parse(event.recordedAt) > baseTimestamp).map((event) => event.value)],
    lightIntensity: [...lightSeries, ...liveSnapshots.map((reading) => reading.lightIntensity), ...realtime.readings.filter((event) => !event.snapshot && event.metric === 'lightIntensity' && Date.parse(event.recordedAt) > baseTimestamp).map((event) => event.value)],
  }
  const chartValues = [
    { title: 'Temperature', value: `${current.temperature.toFixed(1)}°C`, unit: '°C', values: historySeries.temperature, color: '#b66b48' },
    { title: 'Humidity', value: `${current.humidity}%`, unit: '%', values: historySeries.humidity, color: '#638b8a' },
    { title: 'Soil moisture', value: `${current.soilMoisture}%`, unit: '%', values: historySeries.soilMoisture, color: '#82956a' },
    { title: 'Light intensity', value: `${current.lightIntensity.toLocaleString()} lux`, unit: 'lux', values: historySeries.lightIntensity, color: '#b99a56' },
  ]
  const currentReadings = new Map<string, SensorReading>()
  for (const reading of recentReadings) currentReadings.set(reading.timestamp, reading)
  for (const reading of liveSnapshots) currentReadings.set(reading.timestamp, reading)
  const displayedReadings = Array.from(currentReadings.values())
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, 3)
  const realtimeConnected = realtime.connectionStatus === 'connected'
  const statusLabel = realtimeConnected
    ? 'Connected'
    : realtime.connectionStatus === 'connecting' ? 'Reconnecting' : 'Unavailable'
  const alertMap = new Map((alertData.data ?? []).map((alert) => [alert.id, alert]))
  for (const event of realtime.alerts) {
    alertMap.set(event.id, {
      id: event.id,
      type: event.type,
      title: event.title,
      message: event.message,
      severity: event.severity[0] + event.severity.slice(1).toLowerCase() as NonNullable<typeof alertData.data>[number]['severity'],
      source: event.source,
      timestamp: event.createdAt,
      time: new Date(event.createdAt).toLocaleString(),
      status: event.status[0] + event.status.slice(1).toLowerCase() as NonNullable<typeof alertData.data>[number]['status'],
    })
  }
  const activeAlerts = Array.from(alertMap.values()).filter((alert) => alert.status === 'Active')
  const recommendations = irrigationData.data?.recommendations.map((item) => {
    const live = realtime.irrigation.find((event) => event.zoneId === item.zoneId)
    return live ? { ...item, moisture: live.moisture, threshold: live.threshold, state: live.state.toLowerCase() === 'needs_water' ? 'needs_water' as const : 'idle' as const } : item
  }) ?? []

  return (
    <div className="page-content">
      <PageHeading eyebrow="LIVE ENVIRONMENTAL DATA" title="Live monitor" description="Latest persisted conditions, with realtime updates while the simulated stream is connected." action={<div className="data-action-group"><span className="simulation-indicator">Simulated sensor stream</span><span className={`text-status${realtimeConnected ? '' : ' status-disconnected'}`}><i /> Socket.IO {statusLabel}{realtimeConnected ? '' : ' · showing last saved values'}</span><RefreshButton onClick={refreshAll} /></div>} />
      <section className="metric-grid live-metric-grid" aria-label="Live sensor values">
        {metrics.map((metric) => <article className="metric-card" key={metric.label}><div className="metric-top"><span>{metric.label}</span><span className={`live-indicator${realtimeConnected ? '' : ' live-paused'}`}>{realtimeConnected ? 'STREAM' : 'LAST SAVED'}</span></div><div className="metric-value">{metric.value}<small>{metric.unit}</small></div><div className="metric-bottom"><span className="metric-state">{metric.state}</span><span className="metric-change">Updated {updatedAt}</span></div></article>)}
      </section>
      <section className="surface-card readings-panel" aria-label="Live greenhouse intelligence">
        <div className="section-head"><div><span className="panel-kicker">GREENHOUSE INTELLIGENCE</span><h2>{activeAlerts.length} active alerts</h2></div><span className="table-note">Irrigation recommendations · simulated only</span></div>
        {activeAlerts.slice(0, 2).map((alert) => <p className="panel-footnote" key={alert.id}>{alert.severity}: {alert.title}</p>)}
        {recommendations.filter((item) => item.state === 'needs_water').map((item) => <p className="panel-footnote" key={item.zoneId}>{item.zone}: {item.moisture.toFixed(1)}% moisture · below {item.threshold}% · recommendation only</p>)}
        {activeAlerts.length === 0 && recommendations.every((item) => item.state !== 'needs_water') && <p className="panel-footnote">No current environmental alerts or irrigation recommendations.</p>}
      </section>
      <section className="live-chart-grid">
        {chartValues.map((chart) => <ChartCard key={chart.title} {...chart} />)}
      </section>
      <section className="surface-card readings-panel">
        <div className="section-head"><div><span className="panel-kicker">SENSOR HISTORY</span><h2>Recent readings</h2></div><span className="table-note">REST history · Socket.IO live updates</span></div>
        {displayedReadings.length > 0 ? <div className="table-scroll"><table><thead><tr><th>Time</th><th>Temperature</th><th>Humidity</th><th>Soil moisture</th><th>Light</th></tr></thead><tbody>{displayedReadings.map((reading) => <tr key={reading.timestamp}><td>{new Date(reading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td><td>{reading.temperature.toFixed(1)}°C</td><td>{reading.humidity}%</td><td>{reading.soilMoisture}%</td><td>{reading.lightIntensity.toLocaleString()} lux</td></tr>)}</tbody></table></div> : <DataState loading={false} error={null} onRetry={() => void liveData.refresh()} empty emptyMessage="No recent readings have been recorded." />}
      </section>
      <p className="data-disclaimer">REST loads persisted history; authenticated Socket.IO events update new readings live. PostgreSQL remains the source of truth.</p>
    </div>
  )
}

function ChartCard({ title, value, unit, values, color }: { title: string; value: string; unit: string; values: number[]; color: string }) {
  return <article className="surface-card compact-chart"><div className="compact-chart-head"><div><span>{title}</span><strong>{value}</strong></div><span className="chart-legend"><i style={{ backgroundColor: color }} /> 24h</span></div><LineChart values={values} label={title} color={color} unit={unit} height={118} /><div className="chart-time-labels"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span></div></article>
}
