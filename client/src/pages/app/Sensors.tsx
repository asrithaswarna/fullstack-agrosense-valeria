import PageHeading from '../../components/ui/PageHeading'
import DataState from '../../components/ui/DataState'
import RefreshButton from '../../components/ui/RefreshButton'
import { useSensors } from '../../hooks/useValeriaData'
import { useSensorReadingEvents } from '../../realtime/useSensorReadingEvents'

function formatLastSeen(value: string): string {
  if (value === 'Not reported') return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export default function Sensors() {
  const sensorData = useSensors()
  const realtime = useSensorReadingEvents(sensorData.refresh)
  const sensors = (sensorData.data ?? []).map((sensor) => {
    const readings = ['temperature', 'humidity', 'soilMoisture', 'lightIntensity']
      .map((metric) => realtime.latestBySensorMetric.get(`${sensor.id}:${metric}`))
      .filter((reading) => reading !== undefined)
      .sort((left, right) => Date.parse(right.recordedAt) - Date.parse(left.recordedAt))
    const latest = readings[0]
    if (!latest || Date.parse(latest.recordedAt) <= Date.parse(sensor.lastSeen)) return sensor
    const temperature = realtime.latestBySensorMetric.get(`${sensor.id}:temperature`)
    const humidity = realtime.latestBySensorMetric.get(`${sensor.id}:humidity`)
    const previousTemperature = Number.parseFloat(sensor.lastReading.match(/[\d.]+(?=°C)/)?.[0] ?? '')
    const previousHumidity = Number.parseFloat(sensor.lastReading.match(/[\d.]+(?=%)/)?.[0] ?? '')
    const temperatureValue = temperature?.value ?? previousTemperature
    const humidityValue = humidity?.value ?? previousHumidity
    const lastReading = sensor.type.toLowerCase().includes('temperature') && Number.isFinite(temperatureValue) && Number.isFinite(humidityValue)
      ? `${temperatureValue.toFixed(1)}°C · ${humidityValue.toFixed(1)}%`
      : latest.metric === 'lightIntensity' ? `${Math.round(latest.value).toLocaleString()} lux`
        : latest.metric === 'temperature' ? `${latest.value.toFixed(1)}°C`
          : `${latest.value.toFixed(1)}%`
    return { ...sensor, lastReading, lastSeen: latest.recordedAt, status: 'online' as const }
  })
  const environmentalSensors = sensors.filter((sensor) => sensor.type !== 'Irrigation control')
  const onlineCount = environmentalSensors.filter((sensor) => sensor.status === 'online').length
  const zoneCount = new Set(environmentalSensors.map((sensor) => sensor.zone).filter((zone) => zone.startsWith('Zone '))).size

  return (
    <div className="page-content">
      <PageHeading eyebrow="GREENHOUSE EQUIPMENT" title="Sensor inventory" description="Configured sensors, their latest simulated readings, and recent activity." action={<span className={`text-status${realtime.connectionStatus === 'connected' ? '' : ' status-disconnected'}`}><i /> {onlineCount} of {environmentalSensors.length} sensors reporting · {realtime.connectionStatus}</span>} />
      <section className="sensor-summary-line"><span><strong>{environmentalSensors.length}</strong> environmental sensors</span><span><strong>{zoneCount}</strong> growing zones</span><span><strong>{sensors.length - environmentalSensors.length}</strong> irrigation relay</span></section>
      <section className="surface-card inventory-panel">
        <div className="section-head"><div><span className="panel-kicker">CONFIGURED SENSORS · SIMULATED SOURCE</span><h2>Greenhouse sensors</h2></div><div className="data-action-group"><span className="table-note">Last checked just now</span><RefreshButton onClick={() => void sensorData.refresh()} /></div></div>
        {sensorData.loading || sensorData.error ? <DataState loading={sensorData.loading} error={sensorData.error} onRetry={() => void sensorData.refresh()} /> : sensors.length === 0 ? <DataState loading={false} error={null} onRetry={() => void sensorData.refresh()} empty emptyMessage="No sensors have been added to this greenhouse." /> : <div className="table-scroll"><table className="sensor-table"><thead><tr><th>Sensor</th><th>Type</th><th>Zone</th><th>Latest reading</th><th>Status</th><th>Last update</th></tr></thead><tbody>{sensors.map((sensor, index) => <tr key={sensor.id}><td><span className="sensor-name"><i aria-hidden="true">{index < 5 ? '⌁' : index === 5 ? '☼' : '↗'}</i><strong>{sensor.name}</strong></span></td><td>{sensor.type}</td><td>{sensor.zone}</td><td className="reading-cell">{sensor.lastReading}</td><td><span className={`table-status sensor-status-${sensor.status}`}><i />{sensor.status}</span></td><td>{formatLastSeen(sensor.lastSeen)}</td></tr>)}</tbody></table></div>}
      </section>
      <div className="sensor-footnote"><span className="footnote-mark">i</span><p>Sensor values and last-seen times are persisted in PostgreSQL and refreshed from authenticated real-time readings. Physical device connections are not active.</p></div>
    </div>
  )
}
