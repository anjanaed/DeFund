interface StatCardProps {
  value: string
  label: string
}

export default function StatCard({ value, label }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-value text-gradient">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
