import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import {
  HiExclamationTriangle,
  HiCheckCircle, HiXCircle, HiUserCircle, HiClock,
} from 'react-icons/hi2'
import { apiFetch } from '../../lib/api'
import Spinner from '../../components/common/Spinner'
import ConfirmModal from '../../components/common/ConfirmModal'
import { toast } from 'sonner'
import '../../Admin.css'

interface RoleProposal {
  id: string
  targetUserId: string
  targetRole: 'USER' | 'ADMIN'
  proposer: string
  confirmer: string | null
  executed: boolean
  proposedAt: string
  targetUser: { id: string; name: string | null; walletAddress: string; role: string }
}

interface FlagProposal {
  id: string
  campaignId: string
  proposer: string
  reason: string
  confirmer: string | null
  executed: boolean
  proposedAt: string
  campaign: { id: string; title: string }
}

interface RefundProposal {
  id: string
  campaignId: string
  proposer: string
  confirmer: string | null
  executed: boolean
  proposedAt: string
  campaign: { id: string; title: string }
}

interface ReleaseProposal {
  id: string
  milestoneId: string
  proposer: string
  confirmer: string | null
  executed: boolean
  proposedAt: string
  milestone: { id: string; title: string; campaign: { id: string; title: string } }
}

const shortAddr = (addr: string) => `${addr.slice(0, 8)}…${addr.slice(-4)}`

export default function AdminGovernancePage() {
  const navigate = useNavigate()
  const { address: connectedAddress } = useAccount()

  const [proposals, setProposals] = useState<RoleProposal[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([])
  const [flagProposals, setFlagProposals] = useState<FlagProposal[]>([])
  const [refundProposals, setRefundProposals] = useState<RefundProposal[]>([])
  const [releaseProposals, setReleaseProposals] = useState<ReleaseProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [actionPending, setActionPending] = useState<string | null>(null)
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [proposalsRes, refundsRes, approvalsRes, flagRes, releaseRes] = await Promise.all([
        apiFetch('/admin/governance/role-proposals'),
        apiFetch('/admin/refund-proposals'),
        apiFetch('/admin/governance/pending-approvals'),
        apiFetch('/admin/flag-proposals'),
        apiFetch('/admin/release-proposals'),
      ])
      const proposalsData = await proposalsRes.json()
      const refundsData = await refundsRes.json()
      const approvalsData = await approvalsRes.json()
      const flagData = await flagRes.json()
      const releaseData = await releaseRes.json()
      setProposals(Array.isArray(proposalsData) ? proposalsData : [])
      setRefundProposals(Array.isArray(refundsData) ? refundsData : [])
      setPendingApprovals(Array.isArray(approvalsData) ? approvalsData : [])
      setFlagProposals(Array.isArray(flagData) ? flagData : [])
      setReleaseProposals(Array.isArray(releaseData) ? releaseData : [])
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleConfirm = async (proposalId: string) => {
    setActionPending(proposalId)
    try {
      const res = await apiFetch(`/admin/governance/role-proposals/${proposalId}/confirm`, { method: 'POST' })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || 'Confirmation failed') }
      toast.success('Role change confirmed and applied.')
      await load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to confirm')
    } finally {
      setActionPending(null)
    }
  }

  const handleCancel = async (proposalId: string) => {
    setActionPending(proposalId)
    try {
      const res = await apiFetch(`/admin/governance/role-proposals/${proposalId}`, { method: 'DELETE' })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || 'Cancel failed') }
      toast.success('Proposal cancelled.')
      await load()
    } catch (e: any) {
      toast.error(e.message || 'Failed to cancel')
    } finally {
      setActionPending(null)
    }
  }

  const pending = proposals.filter((p) => !p.executed)
  const pendingFlags = flagProposals.filter((p) => !p.executed)
  const pendingRefunds = refundProposals.filter((p) => !p.executed)
  const pendingRelease = releaseProposals.filter((p) => !p.executed)

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Governance</h1>
        <p className="admin-page-subtitle">Pending admin actions requiring a second approval</p>
      </div>

      {/* Pending campaign approval proposals */}
      {pendingApprovals.length > 0 && (
        <div className="admin-table-card" style={{ marginBottom: '32px' }}>
          <div className="admin-table-header">
            <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Pending Campaign Approvals ({pendingApprovals.length})</h3>
          </div>
          <table className="admin-table">
            <thead><tr><th>Campaign</th><th>Proposed By</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {pendingApprovals.map((p: any) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: '600' }}>{p.campaign?.title || '-'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{p.proposer?.slice(0, 8)}…{p.proposer?.slice(-4)}</td>
                  <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{new Date(p.proposedAt).toLocaleDateString()}</td>
                  <td>
                    <button className="btn" onClick={() => navigate(`/admin/verification/${p.campaignId}`)} style={{ padding: '5px 12px', fontSize: '12px', border: '1px solid var(--color-success)', borderRadius: '6px', background: 'var(--color-success)', color: 'white', fontWeight: '600', cursor: 'pointer' }}>
                      Review & Deploy
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Flag Proposals */}
      <div className="admin-table-card" style={{ marginBottom: '24px' }}>
        <div className="admin-table-header">
          <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Pending Flag Proposals ({pendingFlags.length})</h3>
        </div>
        <table className="admin-table">
          <thead><tr><th>Campaign</th><th>Reason</th><th>Proposed By</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 0 }}><Spinner label="Loading…" /></td></tr>
            ) : pendingFlags.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)' }}>No pending flag proposals.</td></tr>
            ) : pendingFlags.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: '600' }}>{p.campaign.title}</td>
                <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: '200px' }}>{p.reason || '-'}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{shortAddr(p.proposer)}</td>
                <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{new Date(p.proposedAt).toLocaleDateString()}</td>
                <td><button className="btn" onClick={() => navigate(`/admin/risk/${p.campaignId}`)} style={{ padding: '5px 12px', fontSize: '12px', border: '1px solid var(--color-error)', borderRadius: '6px', background: 'white', color: 'var(--color-error)', fontWeight: '600', cursor: 'pointer' }}>Go to Campaign</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Refund Proposals */}
      <div className="admin-table-card" style={{ marginBottom: '24px' }}>
        <div className="admin-table-header">
          <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Pending Refund Proposals ({pendingRefunds.length})</h3>
        </div>
        <table className="admin-table">
          <thead><tr><th>Campaign</th><th>Proposed By</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: 0 }}><Spinner label="Loading…" /></td></tr>
            ) : pendingRefunds.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)' }}>No pending refund proposals.</td></tr>
            ) : pendingRefunds.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: '600' }}>{p.campaign.title}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{shortAddr(p.proposer)}</td>
                <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{new Date(p.proposedAt).toLocaleDateString()}</td>
                <td><button className="btn" onClick={() => navigate(`/admin/risk/${p.campaignId}`)} style={{ padding: '5px 12px', fontSize: '12px', border: '1px solid var(--color-primary)', borderRadius: '6px', background: 'var(--color-primary)', color: 'white', fontWeight: '600', cursor: 'pointer' }}>Review</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Release Fund Proposals */}
      <div className="admin-table-card" style={{ marginBottom: '24px' }}>
        <div className="admin-table-header">
          <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Pending Release Fund Proposals ({pendingRelease.length})</h3>
        </div>
        <table className="admin-table">
          <thead><tr><th>Milestone</th><th>Campaign</th><th>Proposed By</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 0 }}><Spinner label="Loading…" /></td></tr>
            ) : pendingRelease.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)' }}>No pending release proposals.</td></tr>
            ) : pendingRelease.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: '600' }}>{p.milestone.title}</td>
                <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{p.milestone.campaign.title}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{shortAddr(p.proposer)}</td>
                <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{new Date(p.proposedAt).toLocaleDateString()}</td>
                <td><button className="btn" onClick={() => navigate(`/admin/milestones/${p.milestoneId}`)} style={{ padding: '5px 12px', fontSize: '12px', border: '1px solid var(--color-primary)', borderRadius: '6px', background: 'var(--color-primary)', color: 'white', fontWeight: '600', cursor: 'pointer' }}>Review</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role proposals — pending */}
      <div className="admin-table-card" style={{ marginBottom: '32px' }}>
        <div className="admin-table-header">
          <h3 style={{ fontSize: '16px', fontWeight: '600' }}>
            Pending Role Proposals ({pending.length})
          </h3>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Target User</th>
              <th>Change</th>
              <th>Proposed By</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 0 }}><Spinner label="Loading proposals…" /></td></tr>
            ) : pending.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)' }}>No pending role proposals.</td></tr>
            ) : pending.map((p) => {
              const isProposer = connectedAddress?.toLowerCase() === p.proposer.toLowerCase()
              const isStale = Date.now() - new Date(p.proposedAt).getTime() > 7 * 24 * 60 * 60 * 1000
              const isPending = actionPending === p.id
              return (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: '600' }}>{p.targetUser.name || '-'}</span>
                      <code style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                        {shortAddr(p.targetUser.walletAddress)}
                      </code>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                      <span className={`admin-badge ${p.targetUser.role === 'ADMIN' ? 'success' : 'neutral'}`}>{p.targetUser.role}</span>
                      <span style={{ color: 'var(--color-text-tertiary)' }}>→</span>
                      <span className={`admin-badge ${p.targetRole === 'ADMIN' ? 'success' : 'neutral'}`}>{p.targetRole}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontFamily: 'monospace' }}>
                      <HiUserCircle size={14} />
                      {shortAddr(p.proposer)}
                      {isProposer && <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontFamily: 'inherit' }}>(you)</span>}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px' }}>
                      <span>{new Date(p.proposedAt).toLocaleDateString()}</span>
                      {isStale && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#d97706' }}>
                          <HiExclamationTriangle size={11} /> 7+ days old
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {isProposer ? (
                          <>
                            <button disabled style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)', cursor: 'not-allowed', opacity: 0.6 }}>
                              <HiClock size={12} style={{ display: 'inline', marginRight: '4px' }} />Awaiting another admin
                            </button>
                            <button
                              onClick={() => setCancelConfirmId(p.id)}
                              disabled={isPending}
                              style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--color-error)', background: 'white', color: 'var(--color-error)', cursor: isPending ? 'not-allowed' : 'pointer', fontWeight: '600', opacity: isPending ? 0.5 : 1 }}
                            >
                              <HiXCircle size={12} style={{ display: 'inline', marginRight: '4px' }} />{isPending ? 'Cancelling…' : 'Cancel'}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleConfirm(p.id)}
                            disabled={isPending}
                            style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '6px', border: 'none', background: p.targetRole === 'ADMIN' ? 'var(--color-success)' : 'var(--color-error)', color: 'white', cursor: isPending ? 'not-allowed' : 'pointer', fontWeight: '600', opacity: isPending ? 0.5 : 1 }}
                          >
                            <HiCheckCircle size={12} style={{ display: 'inline', marginRight: '4px' }} />{isPending ? 'Confirming…' : 'Confirm'}
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={cancelConfirmId !== null}
        onClose={() => setCancelConfirmId(null)}
        onConfirm={() => { const id = cancelConfirmId!; setCancelConfirmId(null); handleCancel(id) }}
        title="Cancel Role Proposal"
        message="This will cancel the pending role change proposal. The proposer can submit a new one at any time."
        confirmLabel="Cancel Proposal"
        variant="warning"
      />
    </div>
  )
}
