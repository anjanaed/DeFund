import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWriteContract } from 'wagmi'
import { HiArrowLeft, HiShieldCheck, HiCurrencyDollar, HiCheckCircle, HiXCircle, HiGlobeAlt, HiDocumentText, HiExclamationTriangle } from 'react-icons/hi2'
import { FaGithub, FaTwitter, FaDiscord } from 'react-icons/fa6'
import { CAMPAIGN_FACTORY_ADDRESS, CAMPAIGN_FACTORY_ABI } from '../../config/contracts'
import { apiFetch } from '../../lib/api'
import LoadingScreen from '../../components/common/LoadingScreen'
import { parseContractError } from '../../lib/errors'
import '../../Admin.css'

export default function AdminRiskDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { writeContractAsync } = useWriteContract()

  const [campaign, setCampaign] = useState<any>(null)
  const [proposal, setProposal] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refundStatus, setRefundStatus] = useState<'idle' | 'proposing' | 'approving' | 'error'>('idle')
  const [refundError, setRefundError] = useState('')
  const [blockStatus, setBlockStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [blockError, setBlockError] = useState('')

  const loadData = () => {
    return Promise.all([
      apiFetch(`/admin/projects/${id}`).then((r) => r.json()),
      apiFetch(`/admin/projects/${id}/refund-proposal`).then((r) =>
        r.ok ? r.json() : null,
      ),
    ])
      .then(([campaignData, proposalData]) => {
        setCampaign(campaignData)
        setProposal(proposalData)
      })
      .catch(() => setRefundError('Failed to load campaign'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleProposeRefund = async () => {
    if (!campaign?.onChainId) {
      setRefundError('Campaign has no on-chain ID')
      setRefundStatus('error')
      return
    }
    setRefundStatus('proposing')
    setRefundError('')
    try {
      await writeContractAsync({
        address: CAMPAIGN_FACTORY_ADDRESS,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: 'proposeRefund',
        args: [BigInt(campaign.onChainId)],
      })
      setRefundStatus('idle')
      // Indexer may take a few seconds to catch up; reload data
      setTimeout(loadData, 3000)
    } catch (err: any) {
      setRefundError(parseContractError(err))
      setRefundStatus('error')
    }
  }

  const handleApproveRefund = async () => {
    if (!campaign?.onChainId) {
      setRefundError('Campaign has no on-chain ID')
      setRefundStatus('error')
      return
    }
    setRefundStatus('approving')
    setRefundError('')
    try {
      await writeContractAsync({
        address: CAMPAIGN_FACTORY_ADDRESS,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: 'approveRefund',
        args: [BigInt(campaign.onChainId)],
      })
      setRefundStatus('idle')
      setTimeout(loadData, 3000)
    } catch (err: any) {
      setRefundError(parseContractError(err))
      setRefundStatus('error')
    }
  }

  const handleBlock = async () => {
    if (!confirm('Block this campaign? It will be marked FLAGGED in the database.')) return
    setBlockStatus('pending')
    setBlockError('')
    try {
      const res = await apiFetch(`/admin/projects/${id}/block`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Block failed')
      }
      setBlockStatus('success')
      loadData()
    } catch (err: any) {
      setBlockStatus('error')
      setBlockError(err.message || 'Failed to block campaign')
    }
  }

  const hasPendingProposal = proposal && !proposal.executed
  const isApproved = (proposal && proposal.executed) || campaign?.fundsReclaimed
  const isBlocked = campaign?.status === 'FLAGGED'

  // P3 — stale proposal warning (>7 days open without second approval)
  const proposalAgeMs = proposal?.proposedAt
    ? Date.now() - new Date(proposal.proposedAt).getTime()
    : 0
  const isProposalStale = hasPendingProposal && proposalAgeMs > 7 * 24 * 60 * 60 * 1000

  if (loading) {
    return <LoadingScreen message="Loading project" />
  }

  if (!campaign) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-error)' }}>Campaign not found.</div>
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/admin/risk')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
        >
          <HiArrowLeft /> Back to Project Monitoring
        </button>
      </div>

      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <h1 className="admin-page-title" style={{ marginBottom: 0 }}>{campaign.title}</h1>
            <span className={`admin-badge ${campaign.status === 'ACTIVE' || campaign.status === 'FUNDED' ? 'success' : campaign.status === 'FLAGGED' ? 'warning' : 'error'}`}>
              {campaign.status}
            </span>
          </div>
          <p className="admin-page-subtitle">Project Details • ID: #{id}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '32px' }}>
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34D399' }}><HiCurrencyDollar /></div>
          <div>
            <div className="admin-stat-label">Total Raised</div>
            <div className="admin-stat-value">{campaign.raisedAmount?.toFixed(4)} {campaign.paymentToken}</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}><HiShieldCheck /></div>
          <div>
            <div className="admin-stat-label">Goal Amount</div>
            <div className="admin-stat-value">{campaign.goalAmount?.toLocaleString()} {campaign.paymentToken}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

          <div className="admin-table-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--color-text-primary)' }}>Description</h3>
            <p style={{ lineHeight: '1.6', color: 'var(--color-text-secondary)' }}>{campaign.description || '—'}</p>
          </div>

          <div className="admin-table-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--color-text-primary)' }}>Milestones</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(campaign.milestones || []).map((m: any) => (
                <div key={m.id} style={{ padding: '16px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-bg-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '600', fontSize: '15px', color: 'var(--color-text-primary)' }}>{m.title}</span>
                    <span className={`admin-badge ${m.status === 'COMPLETED' ? 'success' : m.status === 'VOTING' || m.status === 'APPROVED' ? 'warning' : 'neutral'}`}>{m.status}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '12px', lineHeight: '1.5' }}>{m.description || '—'}</p>
                  <div style={{ display: 'flex', gap: '24px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    <div>Amount: <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>{m.amount?.toLocaleString()} {campaign.paymentToken}</span></div>
                    {m.deadline && <div>Due: <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>{new Date(m.deadline).toLocaleDateString()}</span></div>}
                  </div>
                  {m.proofUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '8px', background: 'white', borderRadius: '6px', border: '1px solid var(--color-border)', marginTop: '12px' }}>
                      <HiDocumentText color="var(--color-primary)" size={16} />
                      <span style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>Proof:</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>{m.proofUrl}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="admin-table-card">
            <div className="admin-table-header">
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: 'var(--color-text-primary)' }}>Recent Contributions</h3>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Contributor</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(campaign.contributions || []).slice(0, 10).map((c: any) => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{c.contributor?.walletAddress?.slice(0, 8)}...{c.contributor?.walletAddress?.slice(-4)}</td>
                    <td style={{ color: 'var(--color-success)', fontWeight: '600' }}>+{c.amount?.toFixed(4)} {campaign.paymentToken}</td>
                    <td>{new Date(c.timestamp).toLocaleDateString()}</td>
                    <td><span className={`admin-badge ${c.refunded ? 'warning' : 'success'}`}>{c.refunded ? 'Refunded' : 'Active'}</span></td>
                  </tr>
                ))}
                {(!campaign.contributions || campaign.contributions.length === 0) && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '24px' }}>No contributions yet</td></tr>
                )}
              </tbody>
            </table>
          </div>

        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          <div className="admin-table-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '20px', color: 'var(--color-text-primary)' }}>Social Links</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { icon: <HiGlobeAlt color="var(--color-text-secondary)" />, label: 'Website', url: campaign.websiteUrl },
                { icon: <FaGithub color="var(--color-text-secondary)" />, label: 'GitHub', url: campaign.githubUrl },
                { icon: <FaTwitter color="var(--color-text-secondary)" />, label: 'Twitter/X', url: campaign.twitterUrl },
                { icon: <FaDiscord color="var(--color-text-secondary)" />, label: 'Discord', url: campaign.discordUrl },
              ].map(({ icon, label, url }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>{icon} {label}</div>
                  {url ? (
                    <span className="admin-badge success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiCheckCircle /> Provided</span>
                  ) : (
                    <span className="admin-badge neutral" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiXCircle /> Missing</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="admin-table-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px', color: 'var(--color-text-primary)' }}>Moderation</h3>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
              Block a suspicious campaign to flag it on the platform. The on-chain flagCampaign() must be signed separately if needed.
            </p>
            {blockError && (
              <div style={{ padding: '8px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-error)', fontSize: '12px', marginBottom: '12px' }}>
                {blockError}
              </div>
            )}
            <button
              className="btn"
              onClick={handleBlock}
              disabled={isBlocked || blockStatus === 'pending'}
              style={{
                width: '100%', padding: '10px', fontSize: '14px',
                background: isBlocked ? 'var(--color-bg-subtle)' : 'white',
                border: '1px solid var(--color-error)',
                color: isBlocked ? 'var(--color-text-secondary)' : 'var(--color-error)',
                borderRadius: '6px', fontWeight: '600',
                opacity: isBlocked ? 0.6 : 1,
                cursor: (isBlocked || blockStatus === 'pending') ? 'not-allowed' : 'pointer',
              }}
            >
              {isBlocked ? 'Already Flagged' : blockStatus === 'pending' ? 'Blocking…' : 'Block Campaign'}
            </button>
          </div>

          <div className="admin-table-card" style={{ padding: '24px', background: 'var(--color-bg-subtle)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px', color: 'var(--color-text-primary)' }}>Refund Management</h3>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
              Refunds require two-admin approval. Each admin signs a separate transaction from their own wallet.
            </p>

            {hasPendingProposal && (
              <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', color: '#ca8a04', fontSize: '13px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HiExclamationTriangle /> Refund proposed — awaiting second admin approval.
                </div>
                <div style={{ fontSize: '12px', opacity: 0.8, fontFamily: 'monospace' }}>
                  Proposer: {proposal.proposer?.slice(0, 8)}…{proposal.proposer?.slice(-4)} • {new Date(proposal.proposedAt).toLocaleString()}
                </div>
              </div>
            )}
            {isProposalStale && (
              <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--color-error)', fontSize: '12px', marginBottom: '12px', display: 'flex', alignItems: 'flex-start', gap: '6px', lineHeight: '1.5' }}>
                <HiExclamationTriangle style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>This refund proposal has been pending for over 7 days without a second approval. Consider cancelling and re-proposing to maintain a clean audit trail.</span>
              </div>
            )}
            {isApproved && (
              <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#15803d', fontSize: '13px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HiCheckCircle /> Refund approved. Contributors can now claim their funds.
                </div>
                {proposal?.confirmer && (
                  <div style={{ fontSize: '12px', opacity: 0.8, fontFamily: 'monospace' }}>
                    Confirmed by {proposal.confirmer.slice(0, 8)}…{proposal.confirmer.slice(-4)}
                  </div>
                )}
              </div>
            )}
            {refundStatus === 'error' && (
              <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--color-error)', fontSize: '13px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HiXCircle /> {refundError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Step 1 — First Admin
                </div>
                <button
                  className="btn"
                  onClick={handleProposeRefund}
                  disabled={refundStatus === 'proposing' || hasPendingProposal || isApproved}
                  style={{
                    width: '100%', padding: '10px', fontSize: '14px',
                    background: 'white', border: '1px solid #f59e0b', color: '#d97706',
                    borderRadius: '6px', fontWeight: '600',
                    opacity: (refundStatus === 'proposing' || hasPendingProposal || isApproved) ? 0.5 : 1,
                    cursor: (refundStatus === 'proposing' || hasPendingProposal || isApproved) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {refundStatus === 'proposing' ? 'Signing...' : hasPendingProposal ? 'Refund Proposed ✓' : 'Propose Refund'}
                </button>
              </div>

              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Step 2 — Second Admin
                </div>
                <button
                  className="btn"
                  onClick={handleApproveRefund}
                  disabled={!hasPendingProposal || refundStatus === 'approving' || isApproved}
                  style={{
                    width: '100%', padding: '10px', fontSize: '14px',
                    background: hasPendingProposal && !isApproved ? 'var(--color-error)' : 'white',
                    border: '1px solid var(--color-error)',
                    color: hasPendingProposal && !isApproved ? '#fff' : 'var(--color-error)',
                    borderRadius: '6px', fontWeight: '600',
                    opacity: (!hasPendingProposal || isApproved) ? 0.4 : 1,
                    cursor: (!hasPendingProposal || isApproved) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {refundStatus === 'approving' ? 'Signing...' : isApproved ? 'Refund Approved ✓' : 'Approve Refund'}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
