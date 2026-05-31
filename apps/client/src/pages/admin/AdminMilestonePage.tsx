import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiMagnifyingGlass } from 'react-icons/hi2'
import { apiFetch } from '../../lib/api'
import Spinner from '../../components/common/Spinner'
import '../../Admin.css'

interface MilestoneRow {
  id: string
  title: string
  description?: string
  amount: number | string
  status: 'NOT_STARTED' | 'ONGOING' | 'VOTING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
  votingEndTime: string | null
  votesFor: number | string
  votesAgainst: number | string
  campaign: { id: string; title: string }
  _count: { votes: number }
}

interface MilestonesPage {
  items: MilestoneRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}

function votingEndLabel(end: string | null, status: string): { text: string; overdue: boolean } {
  if (!end) {
    if (status === 'ONGOING') return { text: 'Awaiting submission', overdue: false }
    if (status === 'NOT_STARTED') return { text: 'Not yet unlocked', overdue: false }
    if (status === 'COMPLETED' || status === 'APPROVED') return { text: 'Closed', overdue: false }
    return { text: '—', overdue: false }
  }
  const now = Date.now()
  const ts = new Date(end).getTime()
  const diffDays = Math.round((ts - now) / 86400000)
  const isFinal = status === 'APPROVED' || status === 'COMPLETED' || status === 'REJECTED'
  if (diffDays < 0 && !isFinal) {
    return { text: `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} overdue`, overdue: true }
  }
  if (diffDays === 0) return { text: 'Voting ends today', overdue: false }
  if (diffDays > 0) return { text: `${diffDays} day${diffDays === 1 ? '' : 's'} remaining`, overdue: false }
  return { text: 'Voting closed', overdue: false }
}

function approvalPercent(votesFor: number | string, votesAgainst: number | string): number {
  const f = Number(votesFor)
  const a = Number(votesAgainst)
  const total = f + a
  if (total === 0) return 0
  return Math.round((f / total) * 100)
}

function statusBadge(status: string): 'success' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'APPROVED':
    case 'COMPLETED':
      return 'success'
    case 'NOT_STARTED':
    case 'ONGOING':
      return 'neutral'
    case 'VOTING':
      return 'warning'
    case 'REJECTED':
      return 'error'
    default:
      return 'neutral'
  }
}

export default function AdminMilestonePage() {
  const navigate = useNavigate()
  const [page, setPage] = useState<MilestonesPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const itemsPerPage = 10

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiFetch(`/admin/milestones?page=${currentPage}&limit=${itemsPerPage}`)
      .then((r) => r.json())
      .then((data: MilestonesPage) => !cancelled && setPage(data))
      .catch(() => !cancelled && setError('Failed to load milestones'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [currentPage])

  const filtered = (page?.items ?? []).filter((m) => {
    const q = searchTerm.toLowerCase()
    const matchesSearch =
      m.campaign.title.toLowerCase().includes(q) ||
      m.title.toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'All' || m.status === statusFilter.toUpperCase()
    return matchesSearch && matchesStatus
  })

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Milestone Oversight</h1>
        <p className="admin-page-subtitle">Review and manage milestone proof submissions</p>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-error)', marginBottom: '24px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div className="admin-table-card">
        <div className="admin-table-header" style={{ justifyContent: 'flex-end', gap: '16px' }}>
          <div className="admin-search">
            <HiMagnifyingGlass color="var(--color-text-tertiary)" />
            <input
              type="text"
              placeholder="Search milestones..."
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
            <option value="Pending">Pending</option>
            <option value="Voting">Voting</option>
            <option value="Approved">Approved</option>
            <option value="Completed">Completed</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Project / Milestone</th>
              <th>Voting Ends</th>
              <th>Community Vote</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: 0 }}><Spinner label="Loading milestones…" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)' }}>No milestones found.</td></tr>
            ) : filtered.map((item, idx) => {
              const dl = votingEndLabel(item.votingEndTime, item.status)
              const approval = approvalPercent(item.votesFor, item.votesAgainst)
              const showCampaign = idx === 0 || filtered[idx - 1].campaign.id !== item.campaign.id
              return (
                <tr
                  key={item.id}
                  onClick={() => navigate(`/admin/milestones/${item.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    {showCampaign
                      ? <div style={{ fontWeight: '600', marginBottom: '2px' }}>{item.campaign.title}</div>
                      : <div style={{ fontWeight: '600', marginBottom: '2px', color: 'transparent', userSelect: 'none', fontSize: '11px' }}>↳</div>
                    }
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', paddingLeft: showCampaign ? 0 : '12px' }}>{item.title}</div>
                  </td>
                  <td>
                    <div>{item.votingEndTime ? new Date(item.votingEndTime).toLocaleDateString() : '—'}</div>
                    <div style={{ fontSize: '11px', color: dl.overdue ? 'var(--color-error)' : 'var(--color-text-secondary)' }}>{dl.text}</div>
                  </td>
                  <td style={{ width: '250px' }}>
                    <div className="admin-progress" style={{ width: '100%', marginBottom: '4px' }}>
                      <div className="admin-progress-bar" style={{ width: `${approval}%` }} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      {approval}% approval ({item._count.votes} votes)
                    </div>
                  </td>
                  <td>
                    <span className={`admin-badge ${statusBadge(item.status)}`}>{item.status}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            {page
              ? `Showing ${(page.page - 1) * page.limit + (page.items.length > 0 ? 1 : 0)}-${(page.page - 1) * page.limit + page.items.length} of ${page.total} milestones`
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
              style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'white', color: page && currentPage >= page.totalPages ? 'var(--color-text-secondary)' : 'var(--color-text-primary)', cursor: page && currentPage >= page.totalPages ? 'not-allowed' : 'pointer' }}
              disabled={!page || currentPage >= page.totalPages}
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
