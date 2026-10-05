type DataStateProps = {
  loading: boolean
  error: string | null
  onRetry: () => void
  empty?: boolean
  emptyMessage?: string
}

export default function DataState({ loading, error, onRetry, empty = false, emptyMessage = 'There is no data to show yet.' }: DataStateProps) {
  if (loading) return <p className="data-state" role="status">Loading greenhouse data…</p>
  if (error) return <div className="data-state data-state-error" role="alert"><span>{error}</span><button className="data-state-retry" type="button" onClick={onRetry}>Try again</button></div>
  if (empty) return <p className="data-state">{emptyMessage}</p>
  return null
}
