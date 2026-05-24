import { useEffect, useState } from 'react'
import { HiClock, HiFlag, HiChartBar, HiXCircle, HiMagnifyingGlass } from 'react-icons/hi2'
import { apiFetch } from '../../lib/api'
import Spinner from '../../components/common/Spinner'
import '../../Admin.css'

interface AdminStats {
  pending: number
  flagged: number
  rejected: number
  totalRaised: number
}

interface ActivityItem {
  type: 'campaign' | 'milestone'
  id: string
  title: string
  status: string
  updatedAt: string
  creator?: { walletAddress: string; name?: string }
  campaign?: { id: string; title: string }
}

interface Transaction {
  id: string
  amount: number | string
  transactionHash: string | null
  timestamp: string
  refunded: boolean
  campaign: { id: string; title: string; paymentToken: string }
  contributor: { walletAddress: string; name?: string }
}

interface TransactionsPage {
  items: Transaction[]
  total: number
  page: number
  limit: number
  totalPages: number
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diffMs / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min${m === 1 ? '' : 's'} ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.floor(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

function shortHash(hash: string | null): string {
  if (!hash) return '—'
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`
}

function activityStatusColor(status: string): 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'ACTIVE':
    case 'FUNDED':
    case 'APPROVED':
    case 'COMPLETED':
      return 'success'
    case 'PENDING':
    case 'VOTING':
      return 'warning'
    case 'FAILED':
    case 'REJECTED':
    case 'FLAGGED':
      return 'error'
    default:
      return 'info'
  }
}

export default function AdminDashboardPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [txPage, setTxPage] = useState<TransactionsPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      apiFetch('/admin/stats').then((r) => r.json()),
      apiFetch('/admin/activity').then((r) => r.json()),
      apiFetch(`/admin/transactions?page=${currentPage}&limit=${itemsPerPage}`).then((r) => r.json()),
    ])
      .then(([statsData, activityData, txData]) => {
        if (cancelled) return
        setStats(statsData)
        setActivity(Array.isArray(activityData) ? activityData : [])
        setTxPage(txData)
      })
      .catch(() => !cancelled && setError('Failed to load dashboard data'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [currentPage])

  const filteredTransactions = (txPage?.items ?? []).filter((tx) => {
    const q = searchTerm.toLowerCase()
    const matchesSearch =
      tx.campaign.title.toLowerCase().includes(q) ||
      (tx.transactionHash ?? '').toLowerCase().includes(q) ||
      tx.contributor.walletAddress.toLowerCase().includes(q)
    const status = tx.refunded ? 'Refunded' : 'Success'
    const matchesStatus = statusFilter === 'All' || status === statusFilter
    return matchesSearch && matchesStatus
  })

  const statCards = [
    { label: 'Pending Verification', value: stats?.pending ?? '—', subtitle: 'Projects awaiting approval', icon: HiClock, trend: 'neutral' },
    { label: 'Flagged Projects', value: stats?.flagged ?? '—', subtitle: 'Require attention', icon: HiFlag, trend: 'negative' },
    { label: 'Total Raised', value: stats ? `${stats.totalRaised.toFixed(2)}` : '—', subtitle: 'Across all campaigns', icon: HiChartBar, trend: 'positive' },
    { label: 'Failed Projects', value: stats?.rejected ?? '—', subtitle: 'Rejected or expired', icon: HiXCircle, trend: 'neutral' },
  ]

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Dashboard</h1>
        <p className="admin-page-subtitle">Manage and monitor platform activity</p>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-error)', marginBottom: '24px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div className="admin-stats-grid">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className="admin-stat-card">
              <Icon className="admin-stat-icon" />
              <div className="admin-stat-label">{stat.label}</div>
              <div className="admin-stat-value">{loading ? '…' : stat.value}</div>
              <div className={`admin-stat-trend ${stat.trend}`}>{stat.subtitle}</div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '32px', marginBottom: '32px' }}>
        <div className="admin-table-card">
          <div className="admin-table-header">
            <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Recent Activity</h3>
          </div>
          <div style={{ padding: '24px' }}>
            {loading ? (
              <Spinner label="Loading activity…" />
            ) : activity.length === 0 ? (
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>No recent activity.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {activity.slice(0, 8).map((item) => {
                  const label = item.type === 'campaign'
                    ? `${item.title} → ${item.status}`
                    : `Milestone "${item.title}" (${item.campaign?.title ?? 'campaign'}) → ${item.status}`
                  return (
                    <div key={`${item.type}-${item.id}`} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px', background: `var(--color-${activityStatusColor(item.status)})` }} />
                      <div>
                        <div style={{ fontWeight: '500', fontSize: '14px', marginBottom: '4px' }}>{label}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>{timeAgo(item.updatedAt)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="admin-table-card">
          <div className="admin-table-header">
            <h3 style={{ fontSize: '16px', fontWeight: '600' }}>System Status</h3>
          </div>
          <div style={{ padding: '24px' }}>
            {/* TODO: wire to a real GET /api/health endpoint that pings RPC + DB */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {[
                { name: 'Blockchain Network Status', status: 'Operational', color: 'success' },
                { name: 'API Gateway', status: 'Operational', color: 'success' },
              ].map((item, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>{item.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: `var(--color-${item.color})` }} />
                    <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-primary)' }}>{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="admin-table-card" style={{ marginBottom: '32px' }}>
        <div className="admin-table-header">
          <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Recent Transactions</h3>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div className="admin-search">
              <HiMagnifyingGlass color="var(--color-text-tertiary)" />
              <input
                type="text"
                placeholder="Search by project, hash, or wallet..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '14px', cursor: 'pointer', outline: 'none' }}
            >
              <option value="All">All Status</option>
              <option value="Success">Success</option>
              <option value="Refunded">Refunded</option>
            </select>
          </div>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tx Hash</th>
              <th>Project</th>
              <th>Contributor</th>
              <th>Amount</th>
              <th>Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 0 }}><Spinner label="Loading transactions…" /></td></tr>
            ) : filteredTransactions.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)' }}>No transactions found.</td></tr>
            ) : filteredTransactions.map((tx) => (
              <tr key={tx.id}>
                <td style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{shortHash(tx.transactionHash)}</td>
                <td style={{ fontWeight: '500' }}>{tx.campaign.title}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                  {tx.contributor.walletAddress.slice(0, 8)}…{tx.contributor.walletAddress.slice(-4)}
                </td>
                <td style={{ fontWeight: '600' }}>{Number(tx.amount).toFixed(4)} {tx.campaign.paymentToken}</td>
                <td style={{ color: 'var(--color-text-secondary)' }}>{timeAgo(tx.timestamp)}</td>
                <td>
                  <span className={`admin-badge ${tx.refunded ? 'warning' : 'success'}`}>
                    {tx.refunded ? 'Refunded' : 'Success'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            {txPage
              ? `Showing ${(txPage.page - 1) * txPage.limit + (txPage.items.length > 0 ? 1 : 0)}-${(txPage.page - 1) * txPage.limit + txPage.items.length} of ${txPage.total} transactions`
              : '—'}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn"
              style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'white', color: currentPage === 1 ? 'var(--color-text-secondary)' : 'var(--color-text-primary)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Previous
            </button>
            <button
              className="btn"
              style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'white', color: txPage && currentPage >= txPage.totalPages ? 'var(--color-text-secondary)' : 'var(--color-text-primary)', cursor: txPage && currentPage >= txPage.totalPages ? 'not-allowed' : 'pointer' }}
              disabled={!txPage || currentPage >= txPage.totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
