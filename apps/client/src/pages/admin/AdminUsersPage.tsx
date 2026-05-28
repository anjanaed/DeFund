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

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [pendingProposals, setPendingProposals] = useState<RoleProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('') // kept for load errors only
  const [searchTerm, setSearchTerm] = useState('')
  const [proposingId, setProposingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [usersRes, proposalsRes] = await Promise.all([
        apiFetch('/admin/users'),
        apiFetch('/admin/governance/role-proposals?pending=true'),
      ])
      const usersData = await usersRes.json()
      const proposalsData = await proposalsRes.json()
      setUsers(Array.isArray(usersData.items) ? usersData.items : [])
      setPendingProposals(Array.isArray(proposalsData) ? proposalsData : [])
    } catch {
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const filtered = users.filter((u) => {
    const q = searchTerm.toLowerCase()
    return (
      (u.name?.toLowerCase().includes(q) ?? false) ||
      u.walletAddress.toLowerCase().includes(q) ||
      (u.email?.toLowerCase().includes(q) ?? false)
    )
  })

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
              onChange={(e) => setSearchTerm(e.target.value)}
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
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)' }}>No users found.</td></tr>
            ) : filtered.map((u) => {
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
      </div>
    </div>
  )
}
