import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import Spinner from '../../components/common/Spinner'
import '../../Admin.css'

interface RefundProposal {
  id: string
  campaignId: string
  proposer: string
  confirmer: string | null  // [L2] renamed from approver
  proposedAt: string
  executed: boolean
  campaign: { id: string; title: string; onChainId: number | null }
}

export default function AdminRefundProposalsPage() {
  const navigate = useNavigate()
  const [proposals, setProposals] = useState<RefundProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiFetch('/admin/refund-proposals')
      .then((r) => r.json())
      .then((data) => !cancelled && setProposals(Array.isArray(data) ? data : []))
      .catch(() => !cancelled && setError('Failed to load refund proposals'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  const pending = proposals.filter((p) => !p.executed)
  const past = proposals.filter((p) => p.executed)

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Refund Proposals</h1>
        <p className="admin-page-subtitle">Two-admin refund flow — pending and historical proposals</p>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-error)', marginBottom: '24px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <div className="admin-table-card" style={{ marginBottom: '32px' }}>
        <div className="admin-table-header">
          <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Awaiting Second Approval ({pending.length})</h3>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Proposer</th>
              <th>Proposed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: 0 }}><Spinner label="Loading refund proposals…" /></td></tr>
            ) : pending.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)' }}>No pending proposals.</td></tr>
            ) : pending.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: '600' }}>{p.campaign.title}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                  {p.proposer.slice(0, 8)}…{p.proposer.slice(-4)}
                </td>
                <td>{new Date(p.proposedAt).toLocaleString()}</td>
                <td>
                  <button
                    className="btn"
                    onClick={() => navigate(`/admin/risk/${p.campaignId}`)}
                    style={{ padding: '6px 12px', fontSize: '13px', border: '1px solid var(--color-primary)', borderRadius: '6px', background: 'var(--color-primary)', color: 'white', fontWeight: '600' }}
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-table-card">
        <div className="admin-table-header">
          <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Past Proposals ({past.length})</h3>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Proposer</th>
              <th>Confirmer</th>
              <th>Proposed</th>
            </tr>
          </thead>
          <tbody>
            {past.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)' }}>No past proposals.</td></tr>
            ) : past.map((p) => (
              <tr key={p.id} onClick={() => navigate(`/admin/risk/${p.campaignId}`)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: '600' }}>{p.campaign.title}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                  {p.proposer.slice(0, 8)}…{p.proposer.slice(-4)}
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                  {p.confirmer ? `${p.confirmer.slice(0, 8)}…${p.confirmer.slice(-4)}` : '—'}
                </td>
                <td>{new Date(p.proposedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
