import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiMagnifyingGlass, HiClock } from 'react-icons/hi2'
import Spinner from '../../components/common/Spinner'
import { apiFetch } from '../../lib/api'
import '../../Admin.css'

interface Campaign {
  id: string
  title: string
  status: string
  createdAt: string
  creator: { walletAddress: string; name?: string }
}

interface VerificationPage {
  items: Campaign[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function AdminVerificationPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState<VerificationPage | null>(null)
  const [pendingApprovalIds, setPendingApprovalIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true)
      const params = new URLSearchParams({ page: String(currentPage), limit: String(itemsPerPage) })
      if (searchTerm) params.set('search', searchTerm)
      Promise.all([
        apiFetch(`/admin/verification?${params}`).then((r) => r.json()),
        apiFetch('/admin/governance/pending-approvals').then((r) => r.json()).catch(() => []),
      ]).then(([data, approvals]) => {
        setPage(data)
        const ids = new Set<string>(Array.isArray(approvals) ? approvals.map((a: any) => a.campaignId) : [])
        setPendingApprovalIds(ids)
      }).catch(() => setPage(null))
        .finally(() => setLoading(false))
    }, searchTerm ? 300 : 0)
    return () => clearTimeout(timer)
  }, [currentPage, searchTerm])

  const projects = page?.items ?? []

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Verification Queue</h1>
        <p className="admin-page-subtitle">Pending campaign applications awaiting admin review</p>
      </div>

      <div className="admin-table-card">
        <div className="admin-table-header" style={{ justifyContent: 'flex-end', gap: '16px' }}>
          <div className="admin-search">
            <HiMagnifyingGlass color="var(--color-text-tertiary)" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
            />
          </div>
        </div>

        {loading ? (
          <Spinner label="Loading verification queue…" />
        ) : projects.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            No pending campaigns.
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Wallet Address</th>
                <th>Submitted</th>
                <th>Approval</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr
                  key={project.id}
                  onClick={() => navigate(`/admin/verification/${project.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontWeight: '600' }}>{project.title}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                    {project.creator.walletAddress.slice(0, 10)}...{project.creator.walletAddress.slice(-6)}
                  </td>
                  <td>{new Date(project.createdAt).toLocaleDateString()}</td>
                  <td>
                    {pendingApprovalIds.has(project.id) ? (
                      <span className="admin-badge warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <HiClock size={12} /> Proposed
                      </span>
                    ) : (
                      <span className="admin-badge neutral">Not proposed</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn"
                      style={{ padding: '6px 12px', fontSize: '13px', border: '1px solid var(--color-border)', borderRadius: '6px' }}
                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/verification/${project.id}`) }}
                    >
                      {pendingApprovalIds.has(project.id) ? 'Review & Deploy' : 'Review'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && projects.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              {page
                ? `Showing ${(page.page - 1) * page.limit + 1}-${(page.page - 1) * page.limit + page.items.length} of ${page.total} campaigns`
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
        )}
      </div>
    </div>
  )
}
