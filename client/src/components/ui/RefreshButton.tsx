export default function RefreshButton({ onClick }: { onClick: () => void }) {
  return <button className="data-state-retry" type="button" onClick={onClick}>Refresh data</button>
}
