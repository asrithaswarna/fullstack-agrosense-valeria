import { Link } from 'react-router-dom'
import PageHeading from '../../components/ui/PageHeading'
import LineChart from '../../components/ui/LineChart'
import DataState from '../../components/ui/DataState'
import RefreshButton from '../../components/ui/RefreshButton'
import { useAlerts, useGreenhouse, useIrrigationStatus, useSensorData, useSensors, useSystemStatus } from '../../hooks/useValeriaData'
import { useSensorReadingEvents } from '../../realtime/useSensorReadingEvents'
import { environmentalRange } from '../../utils/environmentalThresholds'
import type { Alert, EnvironmentalData } from '../../types/domain'

const metricKeys: Record<string, keyof EnvironmentalData> = {
  Temperature: 'temperature',
  Humidity: 'humidity',
  'Soil moisture': 'soilMoisture',
  'Light intensity': 'lightIntensity',
}

export default function Dashboard() {
  const sensorData = useSensorData()
  const sensorInventory = useSensors()
  const alertsData = useAlerts()
  const systemData = useSystemStatus()
  const irrigationData = useIrrigationStatus()
  const greenhouseData = useGreenhouse()

  function refreshAll() {
    void Promise.all([sensorData.refresh(), sensorInventory.refresh(), alertsData.refresh(), systemData.refresh(), irrigationData.refresh(), greenhouseData.refresh()])
  }
  const realtime = useSensorReadingEvents(refreshAll)

  const loading = sensorData.loading || sensorInventory.loading || alertsData.loading || systemData.loading || irrigationData.loading || greenhouseData.loading
  const error = sensorData.error ?? sensorInventory.error ?? alertsData.error ?? systemData.error ?? irrigationData.error ?? greenhouseData.error
  const greenhouse = greenhouseData.data
  if (loading || error || !sensorData.data || !sensorInventory.data || !alertsData.data || !systemData.data || !irrigationData.data || !greenhouse) {
    return <div className="page-content"><PageHeading eyebrow="GREENHOUSE OVERVIEW" title="Greenhouse overview" description="A clear view of the conditions shaping today's growth." /><DataState loading={loading} error={error ?? null} onRetry={refreshAll} /></div>
  }

  const dashboardData = sensorData.data
  const irrigation = irrigationData.data
  const { temperatureSeries, soilSeries } = dashboardData
  const latestTimestamp = Date.parse(dashboardData.latestReadings.timestamp)
  const snapshotById = new Map<string, NonNullable<(typeof realtime.readings)[number]['snapshot']>>()
  for (const event of realtime.readings) {
    if (event.snapshotId && event.snapshot && Date.parse(event.recordedAt) > latestTimestamp) {
      snapshotById.set(event.snapshotId, event.snapshot)
    }
  }
  const liveSnapshots = Array.from(snapshotById.values()).sort((left, right) =>
    Date.parse(left.timestamp) - Date.parse(right.timestamp))
  const metrics = dashboardData.metrics.map((metric) => {
    const key = metricKeys[metric.label]
    const event = realtime.latestByMetric[key]
    const value = event?.snapshot && Date.parse(event.recordedAt) > latestTimestamp
      ? event.snapshot[key]
      : event?.metric === key && Date.parse(event.recordedAt) > latestTimestamp
        ? event.value
        : dashboardData.latestReadings[key]
    const [low, high] = environmentalRange(key, greenhouse.thresholds)
    const state = value < low ? 'Monitor' : value > high ? 'High' : 'Optimal'
    return {
      ...metric,
      value: key === 'temperature' ? value.toFixed(1) : Math.round(value).toLocaleString(),
      state,
    }
  })
  const soilZones = dashboardData.soilZones.map((zone) => {
    const event = realtime.latestBySensorMetric.get(`${zone.id}:soilMoisture`)
    const liveRecommendation = realtime.irrigation.find((recommendation) => recommendation.zone === zone.zone)
    const recommendation = irrigation.recommendations.find((item) => item.zone === zone.zone)
    const value = event && Date.parse(event.recordedAt) > latestTimestamp ? event.value
      : liveRecommendation?.moisture ?? recommendation?.moisture ?? zone.value
    return {
      ...zone,
      value,
      state: value < greenhouse.thresholds.soilMin
        ? 'Monitor' as const
        : value > greenhouse.thresholds.soilMax ? 'High' as const : 'Healthy' as const,
      irrigation: liveRecommendation?.state === 'NEEDS_WATER' || recommendation?.state === 'needs_water',
      threshold: liveRecommendation?.threshold ?? recommendation?.threshold ?? greenhouse.thresholds.soilMin,
    }
  })
  const { overallStatus } = systemData.data
  const onlineSensorCount = sensorInventory.data.filter((sensor) => sensor.status === 'online').length
  const alertMap = new Map(alertsData.data.map((alert) => [alert.id, alert]))
  for (const event of realtime.alerts) {
    alertMap.set(event.id, {
      id: event.id,
      type: event.type,
      title: event.title,
      message: event.message,
      severity: event.severity[0] + event.severity.slice(1).toLowerCase() as Alert['severity'],
      source: event.source,
      timestamp: event.createdAt,
      time: new Date(event.createdAt).toLocaleString(),
      status: event.status[0] + event.status.slice(1).toLowerCase() as Alert['status'],
    })
  }
  const currentAlerts = Array.from(alertMap.values()).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
  const activeAlertCount = currentAlerts.filter((alert) => alert.status === 'Active').length

  return (
    <div className="page-content">
      <PageHeading
        eyebrow="CURRENT CONDITIONS"
        title="Greenhouse overview"
        description="A clear view of the conditions shaping today's growth."
        action={<div className="data-action-group"><span className="simulation-indicator">Data source · Simulated sensors</span><span className={`text-status${realtime.connectionStatus === 'connected' ? '' : ' status-disconnected'}`}><i /> {realtime.connectionStatus === 'connected' ? 'Live updates connected' : `Live updates ${realtime.connectionStatus}`}</span></div>}
      />
      <section className="metric-grid" aria-label="Current environmental readings">
        {metrics.map((metric) => (
          <article key={metric.label} className="metric-card">
            <div className="metric-top"><span>{metric.label}</span><span className="metric-icon" aria-hidden="true">{metric.icon}</span></div>
            <div className="metric-value">{metric.value}<small>{metric.unit}</small></div>
            <div className="metric-bottom"><span className="metric-state">{metric.state}</span><span className="metric-change">{metric.change} today</span></div>
          </article>
        ))}
      </section>
      <section className="dashboard-grid">
        <article className="surface-card chart-panel">
          <div className="section-head"><div><span className="panel-kicker">LAST 24 HOURS</span><h2>Environmental overview</h2></div><div className="data-action-group"><span className="chart-legend"><i /> Temperature</span><RefreshButton onClick={refreshAll} /></div></div>
          <LineChart values={[...temperatureSeries, ...liveSnapshots.map((reading) => reading.temperature)]} label="Temperature" unit="°C" />
          <div className="chart-time-labels"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>Now</span></div>
        </article>
        <article className="surface-card soil-panel">
          <div className="section-head"><div><span className="panel-kicker">MOISTURE BY GROWING AREA</span><h2>Soil zones</h2></div><Link className="subtle-link" to="/sensors">View sensors →</Link></div>
          <div className="zone-list">
            {soilZones.map((zone) => <div className="zone-row" key={zone.id}><span>{zone.zone}</span><div className="zone-track"><i style={{ width: `${zone.value}%` }} /></div><strong>{zone.value.toFixed(1)}%</strong><small className={zone.irrigation ? 'state-warn' : zone.state === 'Monitor' ? 'state-warn' : ''}>{zone.irrigation ? `Needs water · below ${zone.threshold}%` : zone.state}</small></div>)}
          </div>
          <p className="panel-footnote">Target range: {greenhouse.thresholds.soilMin}–{greenhouse.thresholds.soilMax}% soil moisture</p>
        </article>
      </section>
      <section className="dashboard-grid lower-dashboard-grid">
        <article className="surface-card chart-panel soil-trend-panel">
          <div className="section-head"><div><span className="panel-kicker">AVERAGE ACROSS 4 ZONES</span><h2>Soil moisture trend</h2></div><span className="chart-legend sage-legend"><i /> Moisture</span></div>
          <LineChart values={[...soilSeries, ...liveSnapshots.map((reading) => reading.soilMoisture)]} label="Soil moisture" color="#82956a" unit="%" height={136} />
          <div className="chart-time-labels"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>Now</span></div>
        </article>
        <article className="surface-card system-summary">
          <div className="section-head"><div><span className="panel-kicker">DATA PIPELINE</span><h2>System health</h2></div><Link className="subtle-link" to="/system">Details →</Link></div>
          <div className="system-check"><span className="check-mark" aria-hidden="true">✓</span><span><strong>{overallStatus === 'online' ? 'VALERIA services are online' : `System ${overallStatus}`}</strong><small>{onlineSensorCount} simulated sensors reporting · no physical devices connected</small></span></div>
          <div className="irrigation-note"><span className="irrigation-glyph" aria-hidden="true">⌁</span><span><small>IRRIGATION INTELLIGENCE</small><strong>Moisture-based recommendation · no hardware control</strong></span></div>
        </article>
      </section>
      <section className="surface-card recent-alerts">
        <div className="section-head"><div><span className="panel-kicker">NEEDS YOUR ATTENTION · {activeAlertCount}</span><h2>Recent alerts</h2></div><Link className="subtle-link" to="/alerts">All alerts →</Link></div>
        {currentAlerts.filter((alert) => alert.status === 'Active').slice(0, 2).map((alert) => <div className="alert-row" key={alert.id}><span className="alert-dot" /><span className="alert-row-title">{alert.title}</span><span className="alert-source">{alert.source}</span><time>{alert.time}</time></div>)}
        {currentAlerts.filter((alert) => alert.status === 'Active').length === 0 && <p className="empty-filter">No active alerts have been recorded.</p>}
      </section>
    </div>
  )
}
