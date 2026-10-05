import { useState } from 'react'
import PageHeading from '../../components/ui/PageHeading'
import DataState from '../../components/ui/DataState'
import RefreshButton from '../../components/ui/RefreshButton'
import { useAlerts } from '../../hooks/useValeriaData'
import { useSensorReadingEvents } from '../../realtime/useSensorReadingEvents'
import type { Alert } from '../../types/domain'

const filters = ['All alerts', 'Active', 'Resolved', 'Critical', 'Warning']
const noAlerts: never[] = []

function toAlert(event: ReturnType<typeof useSensorReadingEvents>['alerts'][number]): Alert {
  return {
    id: event.id,
    type: event.type,
    title: event.title,
    message: event.message,
    severity: event.severity[0] + event.severity.slice(1).toLowerCase() as Alert['severity'],
    source: event.source,
    timestamp: event.createdAt,
    time: new Date(event.createdAt).toLocaleString(),
    status: event.status[0] + event.status.slice(1).toLowerCase() as Alert['status'],
    greenhouseId: event.greenhouseId,
    sensorId: event.sensorId,
  }
}

export default function Alerts() {
  const [filter, setFilter] = useState('All alerts')
  const alertData = useAlerts()
  const realtime = useSensorReadingEvents(alertData.refresh)
  const alerts = [...(alertData.data ?? noAlerts)]
  for (const event of realtime.alerts) {
    const index = alerts.findIndex((alert) => alert.id === event.id)
    if (index >= 0) alerts[index] = toAlert(event)
    else alerts.unshift(toAlert(event))
  }
  const shownAlerts = filter === 'All alerts' ? alerts : filter === 'Resolved'
    ? alerts.filter((alert) => alert.status === 'Resolved')
    : filter === 'Active' ? alerts.filter((alert) => alert.status === 'Active')
      : alerts.filter((alert) => alert.severity.toLowerCase() === filter.toLowerCase())
  const activeCount = alerts.filter((alert) => alert.status === 'Active').length
  const resolvedCount = alerts.filter((alert) => alert.status === 'Resolved').length

  return (
    <div className="page-content alerts-page">
      <PageHeading
        eyebrow="GREENHOUSE EVENTS"
        title="Alerts & notifications"
        description="A little heads-up when your greenhouse needs attention."
        action={<span className={`alert-connection alert-connection-${realtime.connectionStatus}`}><i /> {realtime.connectionStatus === 'connected' ? 'Live updates on' : 'Live updates'} · {activeCount} active</span>}
      />
      <section className="alert-summary" aria-label="Alert summary">
        <article className="alert-summary-card">
          <span className="alert-summary-icon alert-summary-icon-total" aria-hidden="true">✳</span>
          <span className="alert-summary-copy"><small>All recorded</small><strong>{alerts.length}</strong></span>
        </article>
        <article className="alert-summary-card">
          <span className="alert-summary-icon alert-summary-icon-active" aria-hidden="true">!</span>
          <span className="alert-summary-copy"><small>Need attention</small><strong>{activeCount}</strong></span>
        </article>
        <article className="alert-summary-card">
          <span className="alert-summary-icon alert-summary-icon-resolved" aria-hidden="true">✓</span>
          <span className="alert-summary-copy"><small>Resolved</small><strong>{resolvedCount}</strong></span>
        </article>
      </section>
      <section className="surface-card alert-list-panel">
        <div className="alert-panel-heading">
          <div>
            <span className="panel-kicker">YOUR GREENHOUSE</span>
            <h2>Alert history</h2>
            <p>Review what changed and what has settled.</p>
          </div>
          <RefreshButton onClick={() => void alertData.refresh()} />
        </div>
        <div className="alert-filter-row" role="group" aria-label="Filter alerts">
          {filters.map((item) => (
            <button
              type="button"
              key={item}
              className={filter === item ? 'filter-active' : ''}
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
            >
              {item}
              {item === 'All alerts' && <span>{alerts.length}</span>}
            </button>
          ))}
          <span className="alert-filter-count">Showing {shownAlerts.length} of {alerts.length}</span>
        </div>
        {alertData.loading || alertData.error
          ? <DataState loading={alertData.loading} error={alertData.error} onRetry={() => void alertData.refresh()} />
          : shownAlerts.length
            ? <div className="alert-items">
              {shownAlerts.map((alert) => (
                <article className={`alert-item alert-item-${alert.severity.toLowerCase()}`} key={alert.id}>
                  <span className={`severity-symbol severity-${alert.severity.toLowerCase()}`} aria-hidden="true">
                    {alert.severity === 'Critical' ? '!' : alert.severity === 'Warning' ? '△' : '✓'}
                  </span>
                  <div className="alert-item-main">
                    <div className="alert-item-title">
                      <h3>{alert.title}</h3>
                      <span className={`severity-label severity-text-${alert.severity.toLowerCase()}`}>{alert.severity}</span>
                    </div>
                    <p>{alert.message}</p>
                    <small>{alert.type} <span aria-hidden="true">·</span> {alert.source}</small>
                  </div>
                  <div className="alert-item-meta">
                    <span className={`status-label status-${alert.status.toLowerCase()}`}>{alert.status}</span>
                    <time dateTime={alert.timestamp}>{alert.time}</time>
                  </div>
                </article>
              ))}
            </div>
            : <DataState loading={false} error={null} onRetry={() => void alertData.refresh()} empty emptyMessage={filter === 'All alerts' ? 'No alerts have been recorded yet.' : 'Nothing in this category right now.'} />}
      </section>
      <p className="data-disclaimer alerts-disclaimer"><span aria-hidden="true">i</span> Alerts are based on your saved greenhouse thresholds. Resolved alerts stay in your history for later review.</p>
    </div>
  )
}
