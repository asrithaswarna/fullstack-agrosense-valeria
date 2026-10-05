type LineChartProps = {
  values: number[]
  color?: string
  label: string
  unit?: string
  height?: number
}

export default function LineChart({ values, color = '#47785b', label, unit = '', height = 170 }: LineChartProps) {
  const width = 720
  const pad = 18
  const hasValues = values.length > 0
  const min = hasValues ? Math.min(...values) : 0
  const max = hasValues ? Math.max(...values) : 0
  const range = max - min || 1
  const points = values.map((value, index) => {
    const x = pad + (index / Math.max(values.length - 1, 1)) * (width - pad * 2)
    const y = height - pad - ((value - min) / range) * (height - pad * 2)
    return `${x},${y}`
  })
  const path = `M ${points.join(' L ')}`
  const firstPoint = hasValues ? points[0].split(',').map(Number) : []
  const lastPoint = hasValues ? points[points.length - 1].split(',').map(Number) : []
  const area = hasValues ? `${path} L ${lastPoint[0]},${height - pad} L ${firstPoint[0]},${height - pad} Z` : ''

  return (
    <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} chart${hasValues ? '' : ', no readings available'}`}>
      {[0, 1, 2, 3].map((line) => {
        const y = pad + (line / 3) * (height - pad * 2)
        return <line key={line} x1={pad} x2={width - pad} y1={y} y2={y} className="chart-gridline" />
      })}
      {hasValues && <>
        <path d={area} fill={color} opacity=".08" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastPoint[0]} cy={lastPoint[1]} r="4" fill={color} stroke="#fffdf7" strokeWidth="2" />
      </>}
      {!hasValues && <text x={width / 2} y={height / 2} textAnchor="middle" className="chart-unit">No readings yet</text>}
      <text x={pad} y={height - 2} className="chart-unit">{unit}</text>
    </svg>
  )
}
