import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { useSimulatedWrite } from '../../hooks/useSimulatedWrite'
import { HiArrowLeft, HiClock, HiDocumentText, HiCurrencyDollar, HiExclamationTriangle, HiUserCircle, HiHandThumbUp, HiHandThumbDown, HiScale } from 'react-icons/hi2'
import { CAMPAIGN_FACTORY_ADDRESS, CAMPAIGN_FACTORY_ABI } from '../../config/contracts'
import { apiFetch } from '../../lib/api'
import LoadingScreen from '../../components/common/LoadingScreen'
import { parseContractError } from '../../lib/errors'
import { toast } from 'sonner'
import '../../Admin.css'

export default function AdminMilestoneDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { writeWithSimulate } = useSimulatedWrite()
  const { address: connectedAddress } = useAccount()

  const [milestone, setMilestone] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [finalizePending, setFinalizePending] = useState(false)
  const [releasePending, setReleasePending] = useState(false)
  const [releaseProposal, setReleaseProposal] = useState<any>(null)

  useEffect(() => {
    apiFetch(`/admin/milestones/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setMilestone(data)
        return apiFetch(`/admin/milestones/${id}/release/proposal`)
          .then((r) => r.ok ? r.json() : null)
          .then((p) => setReleaseProposal(p))
          .catch(() => {})
      })
      .catch(() => toast.error('Failed to load milestone'))
      .finally(() => setLoading(false))
  }, [id])

  const handleProposeRelease = async () => {
    if (!milestone?.onChainId) return
    setReleasePending(true)
    try {
      await writeWithSimulate({
        address: CAMPAIGN_FACTORY_ADDRESS,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: 'proposeReleaseFunds',
        args: [BigInt(milestone.onChainId)],
      })
      const p = await apiFetch(`/admin/milestones/${id}/release/proposal`).then((r) => r.ok ? r.json() : null).catch(() => null)
      setReleaseProposal(p)
      toast.success('Release proposed. A second admin must confirm.')
    } catch (err: any) {
      toast.error(parseContractError(err))
    } finally {
      setReleasePending(false)
    }
  }

  const handleConfirmRelease = async () => {
    if (!milestone?.onChainId) return
    setReleasePending(true)
    try {
      await writeWithSimulate({
        address: CAMPAIGN_FACTORY_ADDRESS,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: 'confirmReleaseFunds',
        args: [BigInt(milestone.onChainId)],
      })
      toast.success('Funds released on-chain to creator.')
      setMilestone((m: any) => m ? { ...m, status: 'COMPLETED' } : m)
      setReleaseProposal((p: any) => p ? { ...p, executed: true } : p)
    } catch (err: any) {
      toast.error(parseContractError(err))
    } finally {
      setReleasePending(false)
    }
  }

  const handleFinalizeVoting = async () => {
    if (!milestone?.onChainId) { toast.error('Milestone has no on-chain ID'); return }
    setFinalizePending(true)
    try {
      await writeWithSimulate({
        address: CAMPAIGN_FACTORY_ADDRESS,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: 'finalizeMilestoneVoting',
        args: [BigInt(milestone.onChainId)],
      })
      toast.success('Voting finalized on-chain. Refreshing status…')
      setTimeout(() => {
        apiFetch(`/admin/milestones/${id}`)
          .then((r) => r.json())
          .then((data) => { setMilestone(data); setFinalizePending(false) })
          .catch(() => setFinalizePending(false))
      }, 5000)
    } catch (err: any) {
      toast.error(parseContractError(err))
      setFinalizePending(false)
    }
  }

  if (loading) {
    return <LoadingScreen message="Loading milestone" />
  }

  if (!milestone) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-error)' }}>Milestone not found.</div>
  }

  const isVoting = milestone.status === 'VOTING'
  const votingExpired = isVoting && milestone.votingEndTime && new Date(milestone.votingEndTime) < new Date()

  // P3 — stale proposal warning (>7 days open without confirmation)
  const proposalAgeMs = releaseProposal?.proposedAt
    ? Date.now() - new Date(releaseProposal.proposedAt).getTime()
    : 0
  const isProposalStale = releaseProposal && !releaseProposal.executed && proposalAgeMs > 7 * 24 * 60 * 60 * 1000

  const shortAddr = (addr: string) => addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '—'

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/admin/milestones')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
        >
          <HiArrowLeft /> Back to Milestones
        </button>
      </div>

      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h1 className="admin-page-title" style={{ marginBottom: '8px' }}>{milestone.campaign?.title || 'Campaign'}</h1>
          <p className="admin-page-subtitle">Milestone Oversight • ID: #{id}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '32px' }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

          <div className="admin-table-card" style={{ padding: '24px', borderLeft: `4px solid ${isVoting ? '#f59e0b' : milestone.status === 'COMPLETED' || milestone.status === 'APPROVED' ? 'var(--color-success)' : 'var(--color-border)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Milestone</span>
              <span className={`admin-badge ${milestone.status === 'COMPLETED' ? 'success' : milestone.status === 'APPROVED' ? 'success' : isVoting ? 'warning' : 'neutral'}`}>
                {milestone.status}
              </span>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--color-text-primary)' }}>{milestone.title}</h2>
            <p style={{ color: 'var(--color-text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>{milestone.description || '—'}</p>

            <div style={{ display: 'flex', gap: '24px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              {milestone.deadline && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HiClock /> Due: {new Date(milestone.deadline).toLocaleDateString()}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HiCurrencyDollar /> Value: {milestone.amount?.toLocaleString()} {milestone.campaign?.paymentToken || ''}
              </div>
              {milestone.votingEndTime && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: votingExpired ? 'var(--color-error)' : 'inherit' }}>
                  <HiClock /> Voting ends: {new Date(milestone.votingEndTime).toLocaleDateString()}
                  {votingExpired && ' (expired)'}
                </div>
              )}
            </div>

            {milestone.proofUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '8px 12px', background: 'var(--color-bg-subtle)', borderRadius: '6px', border: '1px solid var(--color-border)', marginTop: '16px' }}>
                <HiDocumentText color="var(--color-primary)" size={16} />
                <span style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>Proof:</span>
                <span style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>{milestone.proofUrl}</span>
              </div>
            )}
          </div>

          {milestone.votes && milestone.votes.length > 0 && (() => {
            const approveWeight = milestone.votes.filter((v: any) => v.choice).reduce((s: number, v: any) => s + Number(v.weight ?? 0), 0)
            const rejectWeight  = milestone.votes.filter((v: any) => !v.choice).reduce((s: number, v: any) => s + Number(v.weight ?? 0), 0)
            const totalWeight   = approveWeight + rejectWeight
            const approvePct    = totalWeight > 0 ? Math.round((approveWeight / totalWeight) * 100) : 0
            const rejectPct     = totalWeight > 0 ? Math.round((rejectWeight  / totalWeight) * 100) : 0
            return (
              <div className="admin-table-card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '20px', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HiScale style={{ color: 'var(--color-primary)' }} /> Vote Tally
                </h3>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '10px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#15803d', fontWeight: 600 }}>
                    <HiHandThumbUp size={14} /> Approve — {approvePct}%
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-error)', fontWeight: 600 }}>
                    Reject — {rejectPct}% <HiHandThumbDown size={14} />
                  </span>
                </div>

                <div style={{ height: '10px', borderRadius: '5px', background: 'rgba(239,68,68,0.15)', overflow: 'hidden', marginBottom: '16px' }}>
                  <div style={{ height: '100%', width: `${approvePct}%`, background: '#22c55e', borderRadius: '5px', transition: 'width 0.4s' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', fontSize: '13px' }}>
                  <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 700, fontSize: '18px', color: '#15803d' }}>{approvePct}%</div>
                    <div style={{ color: 'var(--color-text-tertiary)', marginTop: '2px' }}>Approve</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '12px', background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--color-text-primary)' }}>{milestone.votes.length}</div>
                    <div style={{ color: 'var(--color-text-tertiary)', marginTop: '2px' }}>Total Votes</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--color-error)' }}>{rejectPct}%</div>
                    <div style={{ color: 'var(--color-text-tertiary)', marginTop: '2px' }}>Reject</div>
                  </div>
                </div>
              </div>
            )
          })()}

          {milestone.votes && milestone.votes.length > 0 && (
            <div className="admin-table-card">
              <div className="admin-table-header">
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: 'var(--color-text-primary)' }}>Votes</h3>
              </div>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Voter</th>
                    <th>Weight</th>
                    <th>Choice</th>
                  </tr>
                </thead>
                <tbody>
                  {milestone.votes.map((v: any) => (
                    <tr key={v.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                        {v.voter?.name || `${v.voter?.walletAddress?.slice(0, 8)}…${v.voter?.walletAddress?.slice(-4)}`}
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                        {Number(v.weight ?? 0).toLocaleString()}
                      </td>
                      <td>
                        <span className={`admin-badge ${v.choice ? 'success' : 'error'}`}>
                          {v.choice ? 'Approve' : 'Reject'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="admin-table-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--color-text-primary)' }}>Actions</h3>

            {isVoting && (
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px', lineHeight: '1.5' }}>
                  {votingExpired
                    ? 'Voting period has ended. Finalize to record the result on-chain.'
                    : 'Voting is still in progress. You can finalize early if needed.'}
                </p>
                <button
                  className="btn"
                  onClick={handleFinalizeVoting}
                  disabled={finalizePending}
                  style={{
                    width: '100%', padding: '10px', fontSize: '14px',
                    background: 'var(--color-primary)', border: 'none', color: 'white',
                    borderRadius: '6px', fontWeight: '600',
                    opacity: finalizePending ? 0.5 : 1,
                    cursor: finalizePending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {finalizePending ? 'Signing...' : 'Finalize Voting'}
                </button>
              </div>
            )}

            {milestone.status === 'APPROVED' && (() => {
              const pendingProposal = releaseProposal && !releaseProposal.executed
              const isProposer = pendingProposal && connectedAddress?.toLowerCase() === releaseProposal.proposer?.toLowerCase()
              return (
                <div style={{ marginBottom: '12px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px', lineHeight: '1.5' }}>
                    {!pendingProposal
                      ? 'Voting passed. Propose a fund release — a different admin must confirm to execute.'
                      : isProposer
                        ? 'You proposed this release. A different admin must confirm.'
                        : 'Another admin has proposed releasing funds. Confirm to execute the transfer.'}
                  </p>

                  {/* U4 — Proposal metadata */}
                  {pendingProposal && (
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', background: 'var(--color-bg-subtle)', borderRadius: '6px', padding: '10px 12px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <HiUserCircle size={14} />
                        <span>Proposed by: <code style={{ fontFamily: 'monospace', fontSize: '11px' }}>{shortAddr(releaseProposal.proposer)}</code>
                        {isProposer && <span style={{ color: 'var(--color-primary)', marginLeft: '4px' }}>(you)</span>}</span>
                      </div>
                      {releaseProposal.proposedAt && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <HiClock size={14} />
                          <span>Proposed: {new Date(releaseProposal.proposedAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* P3 — Stale proposal warning */}
                  {isProposalStale && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#92400e', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', padding: '10px 12px', marginBottom: '10px', lineHeight: '1.5' }}>
                      <HiExclamationTriangle style={{ flexShrink: 0, marginTop: '1px' }} />
                      <span>This proposal has been pending for over 7 days. Consider cancelling and re-proposing to keep the audit trail clean.</span>
                    </div>
                  )}

                  {!pendingProposal && (
                    <button
                      className="btn"
                      onClick={handleProposeRelease}
                      disabled={releasePending}
                      style={{ width: '100%', padding: '10px', fontSize: '14px', background: 'var(--color-success)', border: 'none', color: 'white', borderRadius: '6px', fontWeight: '600', opacity: releasePending ? 0.6 : 1, cursor: releasePending ? 'not-allowed' : 'pointer' }}
                    >
                      {releasePending ? 'Signing…' : 'Propose Release'}
                    </button>
                  )}
                  {pendingProposal && isProposer && (
                    <button disabled style={{ width: '100%', padding: '10px', fontSize: '14px', background: 'var(--color-success)', border: 'none', color: 'white', borderRadius: '6px', fontWeight: '600', opacity: 0.5, cursor: 'not-allowed' }}>
                      Awaiting Another Admin
                    </button>
                  )}
                  {pendingProposal && !isProposer && (
                    <button
                      className="btn"
                      onClick={handleConfirmRelease}
                      disabled={releasePending}
                      style={{ width: '100%', padding: '10px', fontSize: '14px', background: 'var(--color-success)', border: 'none', color: 'white', borderRadius: '6px', fontWeight: '600', opacity: releasePending ? 0.6 : 1, cursor: releasePending ? 'not-allowed' : 'pointer' }}
                    >
                      {releasePending ? 'Signing…' : 'Confirm Release'}
                    </button>
                  )}
                </div>
              )
            })()}

            {!isVoting && milestone.status !== 'APPROVED' && (
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                No actions available — milestone is {milestone.status.toLowerCase()}.
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
