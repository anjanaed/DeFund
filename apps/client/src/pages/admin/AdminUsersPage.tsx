import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { HiMagnifyingGlass, HiShieldCheck, HiArrowUpCircle, HiArrowDownCircle, HiClock } from 'react-icons/hi2'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../lib/api'
import Spinner from '../../components/common/Spinner'
import '../../Admin.css'

type Role = 'USER' | 'ADMIN'

interface AdminUser {
  id: string
  name: string | null
  email: string | null
  walletAddress: string
  role: Role
  createdAt: string
  _count: { createdCampaigns: number; contributions: number }
}

interface RoleProposal {
  id: string
  targetUserId: string
  targetRole: Role
  proposer: string
  executed: boolean
}

interface UsersPage {
  items: AdminUser[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const [page, setPage] = useState<UsersPage | null>(null)
  const [pendingProposals, setPendingProposals] = useState<RoleProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('') // kept for load errors only
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [proposingId, setProposingId] = useState<string | null>(null)
  const itemsPerPage = 20

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: String(itemsPerPage) })
      if (searchTerm) params.set('search', searchTerm)
      const [usersRes, proposalsRes] = await Promise.all([
        apiFetch(`/admin/users?${params}`),
        apiFetch('/admin/governance/role-proposals?pending=true'),
      ])
      const usersData: UsersPage = await usersRes.json()
      const proposalsData = await proposalsRes.json()
      setPage(usersData)
      setPendingProposals(Array.isArray(proposalsData) ? proposalsData : [])
    } catch {
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, searchTerm ? 300 : 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchTerm])

  const handlePropose = async (userId: string, targetRole: Role) => {
    setProposingId(userId)
    try {
      const res = await apiFetch('/admin/governance/role-proposals', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: userId, targetRole }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Failed to submit proposal')
      }
      toast.success('Role change proposed. A second admin must confirm.')
      navigate('/admin/governance')
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit proposal')
      setProposingId(null)
    }
  }

  const users = page?.items ?? []

  const pendingFor = (userId: string) => pendingProposals.find((p) => p.targetUserId === userId)

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">User Management</h1>
        <p className="admin-page-subtitle">View users and propose role changes — role promotions require a second admin to confirm</p>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-error)', marginBottom: '24px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div className="admin-table-card">
        <div className="admin-table-header" style={{ justifyContent: 'flex-end' }}>
          <div className="admin-search">
            <HiMagnifyingGlass color="var(--color-text-tertiary)" />
            <input
              type="text"
              placeholder="Search by name, wallet, or email..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
            />
          </div>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Wallet</th>
              <th>Email</th>
              <th>Campaigns</th>
              <th>Contributions</th>
              <th>Joined</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 0 }}><Spinner label="Loading users…" /></td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)' }}>No users found.</td></tr>
            ) : users.map((u) => {
              const proposal = pendingFor(u.id)
              const isSelf = u.id === currentUser?.id
              const isSaving = proposingId === u.id
              return (
                <tr key={u.id}>
                  <td style={{ fontWeight: '500' }}>{u.name || '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                    {u.walletAddress.slice(0, 8)}…{u.walletAddress.slice(-4)}
                  </td>
                  <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{u.email || '—'}</td>
                  <td>{u._count.createdCampaigns}</td>
                  <td>{u._count.contributions}</td>
                  <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <span className={`admin-badge ${u.role === 'ADMIN' ? 'success' : 'neutral'}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {u.role === 'ADMIN' && <HiShieldCheck size={12} />}
                      {u.role}
                    </span>
                  </td>
                  <td>
                    {proposal ? (
                      <button
                        onClick={() => navigate('/admin/governance')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #f59e0b', background: 'rgba(245,158,11,0.1)', color: '#d97706', cursor: 'pointer', fontWeight: '600' }}
                      >
                        <HiClock size={12} /> Proposal pending
                      </button>
                    ) : isSelf ? (
                      <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>—</span>
                    ) : u.role === 'USER' ? (
                      <button
                        onClick={() => handlePropose(u.id, 'ADMIN')}
                        disabled={isSaving}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--color-success)', background: 'white', color: 'var(--color-success)', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: '600', opacity: isSaving ? 0.5 : 1 }}
                      >
                        <HiArrowUpCircle size={13} /> {isSaving ? 'Proposing…' : 'Propose → Admin'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePropose(u.id, 'USER')}
                        disabled={isSaving}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--color-error)', background: 'white', color: 'var(--color-error)', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: '600', opacity: isSaving ? 0.5 : 1 }}
                      >
                        <HiArrowDownCircle size={13} /> {isSaving ? 'Proposing…' : 'Propose Demotion'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            {page
              ? `Showing ${(page.page - 1) * page.limit + (page.items.length > 0 ? 1 : 0)}-${(page.page - 1) * page.limit + page.items.length} of ${page.total} users`
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
