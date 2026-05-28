import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiMagnifyingGlass } from 'react-icons/hi2'
import { apiFetch } from '../../lib/api'
import Spinner from '../../components/common/Spinner'
import '../../Admin.css'

interface ProjectRow {
  id: string
  title: string
  status: 'PENDING' | 'ACTIVE' | 'FUNDED' | 'COMPLETED' | 'FAILED' | 'FLAGGED'
  raisedAmount: number | string
  paymentToken: string
  updatedAt: string
  creator: { id: string; name?: string; walletAddress: string }
  _count: { milestones: number; contributions: number }
}

function statusBadge(status: string): 'success' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'ACTIVE':
    case 'FUNDED':
    case 'COMPLETED':
      return 'success'
    case 'PENDING':
      return 'neutral'
    case 'FLAGGED':
      return 'warning'
    case 'FAILED':
      return 'error'
    default:
      return 'neutral'
  }
}

export default function AdminRiskPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiFetch('/admin/projects')
      .then((r) => r.json())
      .then((data) => !cancelled && setProjects(Array.isArray(data?.items) ? data.items : []))
      .catch(() => !cancelled && setError('Failed to load projects'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  const filtered = projects.filter((p) => {
    const q = searchTerm.toLowerCase()
    const matchesSearch =
      p.title.toLowerCase().includes(q) ||
      p.creator.walletAddress.toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter.toUpperCase()
    return matchesSearch && matchesStatus
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage))
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Project Monitoring</h1>
        <p className="admin-page-subtitle">Monitor and manage all platform projects</p>
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
              placeholder="Search projects or wallets..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}
            style={{ border: 'none', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: '14px', cursor: 'pointer', outline: 'none' }}
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Active">Active</option>
            <option value="Flagged">Flagged</option>
            <option value="Funded">Funded</option>
            <option value="Completed">Completed</option>
            <option value="Failed">Failed</option>
          </select>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Project Name</th>
              <th>Raised</th>
              <th>Last Update</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: 0 }}><Spinner label="Loading projects…" /></td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)' }}>No projects found.</td></tr>
            ) : paginated.map((project) => (
              <tr
                key={project.id}
                onClick={() => navigate(`/admin/risk/${project.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ fontWeight: '600', verticalAlign: 'middle' }}>
                  <div>{project.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: '400', fontFamily: 'monospace' }}>
                    {project.creator.walletAddress.slice(0, 8)}…{project.creator.walletAddress.slice(-4)}
                  </div>
                </td>
                <td style={{ verticalAlign: 'middle' }}>
                  {Number(project.raisedAmount).toFixed(4)} {project.paymentToken}
                </td>
                <td style={{ verticalAlign: 'middle' }}>
                  {new Date(project.updatedAt).toLocaleDateString()}
                </td>
                <td style={{ verticalAlign: 'middle' }}>
                  <span className={`admin-badge ${statusBadge(project.status)}`}>{project.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Showing {paginated.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} projects
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
              style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'white', color: currentPage >= totalPages ? 'var(--color-text-secondary)' : 'var(--color-text-primary)', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer' }}
              disabled={currentPage >= totalPages}
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
