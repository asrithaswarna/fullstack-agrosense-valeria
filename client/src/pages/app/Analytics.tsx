import { useState } from 'react'
import PageHeading from '../../components/ui/PageHeading'
import LineChart from '../../components/ui/LineChart'
import DataState from '../../components/ui/DataState'
import RefreshButton from '../../components/ui/RefreshButton'
import { useAnalytics } from '../../hooks/useValeriaData'
import type { AnalyticsRange } from '../../types/domain'

const ranges: { label: string; value: AnalyticsRange }[] = [
  { label: '24 hours', value: '24h' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
]

function formatMetric(value: number, unit: string) {
  const formatted = unit === 'lux' ? Math.round(value).toLocaleString() : Number.isInteger(value) ? String(value) : value.toFixed(1)
  return `${formatted}${unit === '°C' ? '°C' : ` ${unit}`}`
}

export default function Analytics() {
  const [range, setRange] = useState<AnalyticsRange>('24h')
  const analytics = useAnalytics(range)

  if (analytics.loading || analytics.error || !analytics.data) {
    return (
      <div className="page-content">
        <PageHeading eyebrow="PATTERNS OVER TIME" title="Historical analytics" description="Explore the environmental trends behind your growing conditions." />
        <DataState loading={analytics.loading} error={analytics.error} onRetry={() => void analytics.refresh()} />
      </div>
    )
  }

  return (
    <div className="page-content">
      <PageHeading eyebrow="PATTERNS OVER TIME" title="Historical analytics" description="Explore the environmental trends behind your growing conditions." action={<div className="data-action-group"><div className="range-control" aria-label="Select chart range">{ranges.map((item) => <button key={item.value} type="button" className={range === item.value ? 'range-active' : ''} onClick={() => setRange(item.value)}>{item.label}</button>)}</div><RefreshButton onClick={() => void analytics.refresh()} /></div>} />
      <section className="analytics-grid">
        {analytics.data.metrics.map((measure) => <article className="surface-card analytics-chart" key={measure.name}><div className="section-head"><div><span className="panel-kicker">LAST {ranges.find((item) => item.value === range)?.label.toUpperCase()}</span><h2>{measure.name}</h2></div><strong className="analytics-average">{formatMetric(measure.average, measure.unit)}<small> avg</small></strong></div><LineChart values={measure.values} label={`${measure.name} history`} color={measure.color} unit={measure.unit} height={154} /><div className="chart-time-labels"><span>Start</span><span>Morning</span><span>Afternoon</span><span>Evening</span><span>Now</span></div><div className="measure-stats"><span>Minimum <strong>{formatMetric(measure.minimum, measure.unit)}</strong></span><span>Maximum <strong>{formatMetric(measure.maximum, measure.unit)}</strong></span></div></article>)}
      </section>
      {analytics.data.metrics.length === 0 && <DataState loading={false} error={null} onRetry={() => void analytics.refresh()} empty emptyMessage="No historical readings are available for this period." />}
      <p className="data-disclaimer">Charts are based on readings stored for this greenhouse. Device streaming is not part of this stage.</p>
    </div>
  )
}
