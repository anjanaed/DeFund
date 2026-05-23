import { useEffect, useState } from 'react'
import { HiMagnifyingGlass } from 'react-icons/hi2'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../lib/api'
import Spinner from '../../components/common/Spinner'
import '../../Admin.css'

type Role = 'USER' | 'CREATOR' | 'ADMIN'

interface AdminUser {
  id: string
  name: string | null
  email: string | null
  walletAddress: string
  role: Role
  createdAt: string
  _count: { createdCampaigns: number; contributions: number }
}

export default function AdminUsersPage() {
  const { token, user: currentUser } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await apiFetch('/admin/users', {}, token)
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch {
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handleRoleChange = async (userId: string, role: Role) => {
    if (userId === currentUser?.id && role !== 'ADMIN') {
      if (!confirm('You are about to remove ADMIN from your own account. Continue?')) return
    }
    setSavingId(userId)
    setError('')
    try {
      const res = await apiFetch(`/admin/users/${userId}/set-role`, {
        method: 'POST',
        body: JSON.stringify({ role }),
      }, token)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Role update failed')
      }
      load()
    } catch (e: any) {
      setError(e.message || 'Failed to update role')
    } finally {
      setSavingId(null)
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

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">User Management</h1>
        <p className="admin-page-subtitle">View users and assign roles</p>
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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 0 }}><Spinner label="Loading users…" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)' }}>No users found.</td></tr>
            ) : filtered.map((u) => (
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
                  <select
                    value={u.role}
                    disabled={savingId === u.id}
                    onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                    style={{ padding: '4px 8px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'white' }}
                  >
                    <option value="USER">USER</option>
                    <option value="CREATOR">CREATOR</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
