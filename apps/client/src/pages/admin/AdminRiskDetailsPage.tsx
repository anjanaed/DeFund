import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSimulatedWrite } from '../../hooks/useSimulatedWrite'
import { toast } from 'sonner'
import { HiArrowLeft, HiCheckCircle, HiXCircle, HiGlobeAlt, HiDocumentText, HiExclamationTriangle } from 'react-icons/hi2'
import { FaTwitter, FaDiscord, FaGithub } from 'react-icons/fa6'
import RepoIcon from '../../components/common/RepoIcon'
import { CAMPAIGN_FACTORY_ADDRESS, CAMPAIGN_FACTORY_ABI } from '../../config/contracts'
import { apiFetch } from '../../lib/api'
import LoadingScreen from '../../components/common/LoadingScreen'
import ConfirmModal from '../../components/common/ConfirmModal'
import { parseContractError } from '../../lib/errors'
import '../../Admin.css'

export default function AdminRiskDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { writeWithSimulate } = useSimulatedWrite()

  const [campaign, setCampaign] = useState<any>(null)
  const [proposal, setProposal] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [refundStatus, setRefundStatus] = useState<'idle' | 'proposing' | 'approving'>('idle')
  const [flagProposal, setFlagProposal] = useState<any>(null)
  const [flagStatus, setFlagStatus] = useState<'idle' | 'proposing' | 'confirming' | 'unflagging'>('idle')
  const [showUnflagConfirm, setShowUnflagConfirm] = useState(false)
  const [showFlagInput, setShowFlagInput] = useState(false)
  const [flagReason, setFlagReason] = useState('')
  const [showRefundInput, setShowRefundInput] = useState(false)
  const [refundReason, setRefundReason] = useState('')

  const loadData = () => {
    setLoadError('')
    return Promise.all([
      apiFetch(`/admin/projects/${id}`).then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body.message || `Server error ${r.status}`)
        return body
      }),
      apiFetch(`/admin/projects/${id}/refund-proposal`).then((r) =>
        r.ok ? r.json().catch(() => null) : null,
      ),
      apiFetch(`/admin/projects/${id}/flag/proposal`).then((r) =>
        r.ok ? r.json().catch(() => null) : null,
      ),
    ])
      .then(([campaignData, proposalData, flagProposalData]) => {
        setCampaign(campaignData)
        setProposal(proposalData)
        setFlagProposal(flagProposalData)
      })
      .catch((err: any) => {
        const msg = err?.message || 'Failed to load campaign'
        setLoadError(msg)
        toast.error(msg)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleProposeRefund = async () => {
    if (!campaign?.onChainId) { toast.error('Campaign has no on-chain ID'); return }
    if (!refundReason.trim()) { toast.error('Please enter a reason for the refund'); return }
    setRefundStatus('proposing')
    try {
      await apiFetch(`/admin/projects/${id}/propose-refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: refundReason.trim() }),
      })
      await writeWithSimulate({
        address: CAMPAIGN_FACTORY_ADDRESS,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: 'proposeRefund',
        args: [BigInt(campaign.onChainId)],
      })
      toast.success('Refund proposed. A second admin must confirm.')
      setRefundStatus('idle')
      setShowRefundInput(false)
      setRefundReason('')
      setTimeout(loadData, 3000)
    } catch (err: any) {
      toast.error(parseContractError(err))
      setRefundStatus('idle')
    }
  }

  const handleApproveRefund = async () => {
    if (!campaign?.onChainId) { toast.error('Campaign has no on-chain ID'); return }
    setRefundStatus('approving')
    try {
      await writeWithSimulate({
        address: CAMPAIGN_FACTORY_ADDRESS,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: 'approveRefund',
        args: [BigInt(campaign.onChainId)],
      })
      toast.success('Refund approved. Contributors can now claim their funds.')
      setRefundStatus('idle')
      setTimeout(loadData, 3000)
    } catch (err: any) {
      toast.error(parseContractError(err))
      setRefundStatus('idle')
    }
  }

  const handleProposeFlag = async () => {
    if (!campaign?.onChainId) { toast.error('Campaign has no on-chain ID'); return }
    if (!flagReason.trim()) { toast.error('Please enter a reason for flagging'); return }
    setFlagStatus('proposing')
    try {
      await writeWithSimulate({
        address: CAMPAIGN_FACTORY_ADDRESS,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: 'proposeFlagCampaign',
        args: [BigInt(campaign.onChainId), flagReason.trim()],
      })
      toast.success('Flag proposed. A second admin must confirm.')
      setFlagStatus('idle')
      setShowFlagInput(false)
      setFlagReason('')
      setTimeout(loadData, 3000)
    } catch (err: any) {
      toast.error(parseContractError(err))
      setFlagStatus('idle')
    }
  }

  const handleConfirmFlag = async () => {
    if (!campaign?.onChainId) { toast.error('Campaign has no on-chain ID'); return }
    setFlagStatus('confirming')
    try {
      await writeWithSimulate({
        address: CAMPAIGN_FACTORY_ADDRESS,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: 'confirmFlagCampaign',
        args: [BigInt(campaign.onChainId)],
      })
      toast.success('Campaign flagged on-chain.')
      setFlagStatus('idle')
      setTimeout(loadData, 3000)
    } catch (err: any) {
      toast.error(parseContractError(err))
      setFlagStatus('idle')
    }
  }

  const handleUnflag = async () => {
    if (!campaign?.onChainId) { toast.error('Campaign has no on-chain ID'); return }
    setFlagStatus('unflagging')
    try {
      await writeWithSimulate({
        address: CAMPAIGN_FACTORY_ADDRESS,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: 'unflagCampaign',
        args: [BigInt(campaign.onChainId)],
      })
      await apiFetch(`/admin/projects/${id}/unflag`, { method: 'POST' })
      toast.success('Campaign unflagged and restored to Active.')
      setFlagStatus('idle')
      setTimeout(loadData, 3000)
    } catch (err: any) {
      toast.error(parseContractError(err))
      setFlagStatus('idle')
    }
  }

  const hasPendingProposal = proposal && !proposal.executed
  const isApproved = (proposal && proposal.executed) || campaign?.fundsReclaimed
  const isBlocked = campaign?.status === 'FLAGGED'
  const hasPendingFlagProposal = flagProposal && !flagProposal.executed
  const isFlagConfirmed = flagProposal && flagProposal.executed
  const isFunded = campaign?.status === 'FUNDED'
  const isPending = campaign?.status === 'PENDING'
  const isPastDeadline = campaign?.deadline && new Date(campaign.deadline) < new Date()

  // P3 — stale proposal warning (>7 days open without second approval)
  const proposalAgeMs = proposal?.proposedAt
    ? Date.now() - new Date(proposal.proposedAt).getTime()
    : 0
  const isProposalStale = hasPendingProposal && proposalAgeMs > 7 * 24 * 60 * 60 * 1000

  if (loading) {
    return <LoadingScreen message="Loading project" />
  }

  if (!campaign) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-error)' }}>
        {loadError || 'Campaign not found.'}
        <div style={{ marginTop: '12px' }}>
          <button onClick={() => { setLoading(true); loadData() }} style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'white', cursor: 'pointer', fontSize: '13px' }}>Retry</button>
        </div>
      </div>
    )
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
          <div>
            <div className="admin-stat-label">Total Raised</div>
            <div className="admin-stat-value">{Number(campaign.raisedAmount ?? 0).toFixed(4)} {campaign.paymentToken}</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div>
            <div className="admin-stat-label">Goal Amount</div>
            <div className="admin-stat-value">{Number(campaign.goalAmount ?? 0).toLocaleString()} {campaign.paymentToken}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

          <div className="admin-table-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--color-text-primary)' }}>Description</h3>
            <p style={{ lineHeight: '1.6', color: 'var(--color-text-secondary)' }}>{campaign.description || '-'}</p>
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
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '12px', lineHeight: '1.5' }}>{m.description || '-'}</p>
                  <div style={{ display: 'flex', gap: '24px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    <div>Amount: <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>{Number(m.amount ?? 0).toLocaleString()} {campaign.paymentToken}</span></div>
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
                    <td style={{ color: 'var(--color-success)', fontWeight: '600' }}>+{Number(c.amount ?? 0).toFixed(4)} {campaign.paymentToken}</td>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '20px' }}>
              {[
                { icon: <HiGlobeAlt color="var(--color-text-secondary)" />, label: 'Website', url: campaign.website },
                { icon: <RepoIcon url={campaign.repositoryUrl} size={15} />, label: 'Repository', url: campaign.repositoryUrl },
              ].map(({ icon, label, url }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', flexShrink: 0 }}>{icon} {label}</div>
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer"
                      style={{ color: 'var(--color-primary)', fontSize: '12px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'right' }}
                      title={url}
                    >
                      {url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </a>
                  ) : (
                    <span className="admin-badge neutral" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiXCircle /> Missing</span>
                  )}
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
                Creator Verification
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  { icon: <FaTwitter />, label: 'X / Twitter', handle: campaign.creator?.twitterHandle, prefix: '@', href: (h: string) => `https://x.com/${h}` },
                  { icon: <FaDiscord />, label: 'Discord', handle: campaign.creator?.discordHandle, prefix: '', href: null },
                  { icon: <FaGithub />, label: 'GitHub', handle: campaign.creator?.githubHandle, prefix: '@', href: (h: string) => `https://github.com/${h}` },
                ].map(({ icon, label, handle, prefix, href }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                      {icon} {label}
                    </div>
                    {handle ? (
                      href ? (
                        <a href={href(handle)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                          <span className="admin-badge success" style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <HiCheckCircle /> {prefix}{handle}
                          </span>
                        </a>
                      ) : (
                        <span className="admin-badge success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <HiCheckCircle /> {prefix}{handle}
                        </span>
                      )
                    ) : (
                      <span className="admin-badge neutral" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <HiXCircle /> Not verified
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Moderation card */}
          {isPending ? (
            <div className="admin-table-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                <HiExclamationTriangle size={15} style={{ flexShrink: 0 }} />
                Flagging and refunds are not available for pending campaigns.
              </div>
            </div>
          ) : (
          <>
          <div className="admin-table-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: 'var(--color-text-primary)' }}>Moderation</h3>

            {isBlocked ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--color-error)', fontSize: '13px' }}>
                  <HiXCircle size={15} style={{ flexShrink: 0 }} />
                  <span>This campaign is flagged on-chain{flagProposal?.reason ? ` - ${flagProposal.reason}` : ''}.</span>
                </div>
                <button
                  onClick={() => setShowUnflagConfirm(true)}
                  disabled={flagStatus === 'unflagging'}
                  style={{ width: '100%', padding: '9px', fontSize: '13px', fontWeight: '500', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-secondary)', cursor: flagStatus === 'unflagging' ? 'not-allowed' : 'pointer' }}
                >
                  {flagStatus === 'unflagging' ? 'Signing...' : 'Remove Flag'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {hasPendingFlagProposal && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.25)', color: '#92400e', fontSize: '12px', lineHeight: 1.5 }}>
                    <HiExclamationTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>Proposed by <code style={{ fontFamily: 'monospace' }}>{flagProposal.proposer?.slice(0, 8)}…{flagProposal.proposer?.slice(-4)}</code> - awaiting a second admin.</span>
                  </div>
                )}

                {/* Step 1 */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: hasPendingFlagProposal || isFlagConfirmed ? 'var(--color-success)' : 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', color: hasPendingFlagProposal || isFlagConfirmed ? 'white' : 'var(--color-text-secondary)', flexShrink: 0, marginTop: '1px' }}>
                    {hasPendingFlagProposal || isFlagConfirmed ? <HiCheckCircle size={13} /> : '1'}
                  </div>
                  <div style={{ flex: 1 }}>
                    {!hasPendingFlagProposal && !isFlagConfirmed && !showFlagInput && (
                      <button
                        onClick={() => setShowFlagInput(true)}
                        disabled={flagStatus === 'proposing'}
                        style={{ width: '100%', padding: '8px 14px', fontSize: '13px', fontWeight: '500', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", background: 'white', border: '1px solid var(--color-error)', color: 'var(--color-error)', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' }}
                      >
                        Propose Flag
                      </button>
                    )}
                    {showFlagInput && !hasPendingFlagProposal && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <textarea
                          value={flagReason}
                          onChange={e => setFlagReason(e.target.value)}
                          placeholder="Reason for flagging this campaign..."
                          rows={3}
                          style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '8px', border: '1px solid var(--color-border)', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", resize: 'none', color: 'var(--color-text-primary)', background: 'var(--color-bg)', outline: 'none', boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={handleProposeFlag}
                            disabled={flagStatus === 'proposing' || !flagReason.trim()}
                            style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: '600', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", background: flagReason.trim() ? 'var(--color-error)' : 'var(--color-bg-subtle)', border: 'none', color: flagReason.trim() ? 'white' : 'var(--color-text-secondary)', borderRadius: '8px', cursor: flagReason.trim() ? 'pointer' : 'not-allowed' }}
                          >
                            {flagStatus === 'proposing' ? 'Signing...' : 'Sign & Submit'}
                          </button>
                          <button onClick={() => { setShowFlagInput(false); setFlagReason('') }} style={{ padding: '8px 12px', fontSize: '13px', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>Cancel</button>
                        </div>
                      </div>
                    )}
                    {(hasPendingFlagProposal || isFlagConfirmed) && (
                      <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Flag proposed</span>
                    )}
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: isFlagConfirmed ? 'var(--color-success)' : 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', color: isFlagConfirmed ? 'white' : 'var(--color-text-secondary)', flexShrink: 0, marginTop: '1px' }}>
                    {isFlagConfirmed ? <HiCheckCircle size={13} /> : '2'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <button
                      onClick={handleConfirmFlag}
                      disabled={!hasPendingFlagProposal || flagStatus === 'confirming' || isFlagConfirmed}
                      style={{ width: '100%', padding: '8px 14px', fontSize: '13px', fontWeight: hasPendingFlagProposal && !isFlagConfirmed ? '600' : '500', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", background: hasPendingFlagProposal && !isFlagConfirmed ? 'var(--color-error)' : 'transparent', border: `1px solid ${hasPendingFlagProposal && !isFlagConfirmed ? 'var(--color-error)' : 'var(--color-border)'}`, color: hasPendingFlagProposal && !isFlagConfirmed ? 'white' : 'var(--color-text-secondary)', borderRadius: '8px', cursor: hasPendingFlagProposal && !isFlagConfirmed ? 'pointer' : 'not-allowed', textAlign: 'left', opacity: (!hasPendingFlagProposal && !isFlagConfirmed) ? 0.4 : 1 }}
                    >
                      {flagStatus === 'confirming' ? 'Signing...' : isFlagConfirmed ? 'Confirmed ✓' : 'Confirm Flag'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Refund Management card */}
          <div className="admin-table-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: 'var(--color-text-primary)' }}>Refund Management</h3>

            {isApproved && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.25)', color: '#166534', fontSize: '13px', marginBottom: '14px' }}>
                <HiCheckCircle size={15} style={{ flexShrink: 0 }} />
                <div>
                  Refund approved - contributors can now claim.
                  {proposal?.confirmer && <span style={{ color: '#166534', opacity: 0.7, fontSize: '12px', marginLeft: '6px', fontFamily: 'monospace' }}>Confirmed by {proposal.confirmer.slice(0, 8)}…{proposal.confirmer.slice(-4)}</span>}
                </div>
              </div>
            )}

            {isFunded && !isApproved && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--color-error)', fontSize: '12px', marginBottom: '14px', lineHeight: 1.5 }}>
                <HiExclamationTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>{isPastDeadline ? 'Deadline passed - expireCampaign() will run automatically.' : 'Campaign is funded. Flag it first before proposing a refund.'}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Step 1 */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: hasPendingProposal || isApproved ? 'var(--color-success)' : 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', color: hasPendingProposal || isApproved ? 'white' : 'var(--color-text-secondary)', flexShrink: 0, marginTop: '1px' }}>
                  {hasPendingProposal || isApproved ? <HiCheckCircle size={13} /> : '1'}
                </div>
                <div style={{ flex: 1 }}>
                  {!hasPendingProposal && !isApproved && !showRefundInput && (
                    <button
                      onClick={() => setShowRefundInput(true)}
                      disabled={refundStatus === 'proposing' || isFunded}
                      style={{ width: '100%', padding: '8px 14px', fontSize: '13px', fontWeight: '500', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", background: 'white', border: '1px solid #f59e0b', color: '#b45309', borderRadius: '8px', cursor: isFunded ? 'not-allowed' : 'pointer', opacity: isFunded ? 0.4 : 1, textAlign: 'left' }}
                    >
                      Propose Refund
                    </button>
                  )}
                  {showRefundInput && !hasPendingProposal && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <textarea
                        value={refundReason}
                        onChange={e => setRefundReason(e.target.value)}
                        placeholder="Reason for issuing this refund..."
                        rows={3}
                        style={{ width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '8px', border: '1px solid var(--color-border)', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", resize: 'none', color: 'var(--color-text-primary)', background: 'var(--color-bg)', outline: 'none', boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={handleProposeRefund}
                          disabled={refundStatus === 'proposing' || !refundReason.trim()}
                          style={{ flex: 1, padding: '8px', fontSize: '13px', fontWeight: '600', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", background: refundReason.trim() ? '#f59e0b' : 'var(--color-bg-subtle)', border: 'none', color: refundReason.trim() ? 'white' : 'var(--color-text-secondary)', borderRadius: '8px', cursor: refundReason.trim() ? 'pointer' : 'not-allowed' }}
                        >
                          {refundStatus === 'proposing' ? 'Signing...' : 'Sign & Submit'}
                        </button>
                        <button onClick={() => { setShowRefundInput(false); setRefundReason('') }} style={{ padding: '8px 12px', fontSize: '13px', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  )}
                  {hasPendingProposal && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Refund proposed</span>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--color-text-secondary)', opacity: 0.7 }}>{proposal.proposer?.slice(0, 8)}…{proposal.proposer?.slice(-4)} • {new Date(proposal.proposedAt).toLocaleDateString()}{isProposalStale ? ' · 7+ days old' : ''}</span>
                    </div>
                  )}
                  {isApproved && <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Refund proposed</span>}
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: isApproved ? 'var(--color-success)' : 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', color: isApproved ? 'white' : 'var(--color-text-secondary)', flexShrink: 0, marginTop: '1px' }}>
                  {isApproved ? <HiCheckCircle size={13} /> : '2'}
                </div>
                <div style={{ flex: 1 }}>
                  <button
                    onClick={handleApproveRefund}
                    disabled={!hasPendingProposal || refundStatus === 'approving' || isApproved}
                    style={{ width: '100%', padding: '8px 14px', fontSize: '13px', fontWeight: hasPendingProposal && !isApproved ? '600' : '500', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", background: hasPendingProposal && !isApproved ? 'var(--color-error)' : 'transparent', border: `1px solid ${hasPendingProposal && !isApproved ? 'var(--color-error)' : 'var(--color-border)'}`, color: hasPendingProposal && !isApproved ? 'white' : 'var(--color-text-secondary)', borderRadius: '8px', cursor: hasPendingProposal && !isApproved ? 'pointer' : 'not-allowed', textAlign: 'left', opacity: (!hasPendingProposal && !isApproved) ? 0.4 : 1 }}
                  >
                    {refundStatus === 'approving' ? 'Signing...' : isApproved ? 'Approved ✓' : 'Approve Refund'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          </>
          )}

        </div>
      </div>

      <ConfirmModal
        isOpen={showUnflagConfirm}
        onClose={() => setShowUnflagConfirm(false)}
        onConfirm={() => { setShowUnflagConfirm(false); handleUnflag() }}
        title="Unblock Campaign"
        message="This will remove the on-chain flag and restore the campaign to Active status."
        confirmLabel="Unblock Campaign"
        variant="warning"
      />
    </div>
  )
}
