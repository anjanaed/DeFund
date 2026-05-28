import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePublicClient, useAccount } from 'wagmi'
import { parseEther, parseUnits, keccak256, toBytes, decodeEventLog } from 'viem'
import { useSimulatedWrite } from '../../hooks/useSimulatedWrite'
import { toast } from 'sonner'
import { HiArrowLeft, HiCheckCircle, HiXCircle, HiGlobeAlt, HiDocumentText, HiCurrencyDollar, HiExclamationTriangle, HiUserCircle, HiClock } from 'react-icons/hi2'
import { FaTwitter, FaDiscord, FaGithub } from 'react-icons/fa6'
import { CAMPAIGN_FACTORY_ADDRESS, CAMPAIGN_FACTORY_ABI } from '../../config/contracts'
import { apiFetch } from '../../lib/api'
import LoadingScreen from '../../components/common/LoadingScreen'
import { parseContractError } from '../../lib/errors'
import '../../Admin.css'

export default function AdminProjectReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { writeWithSimulate } = useSimulatedWrite()
  const publicClient = usePublicClient()
  const { address: connectedAddress } = useAccount()

  const [campaign, setCampaign] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [flagProposal, setFlagProposal] = useState<any>(null)
  const [approvalProposal, setApprovalProposal] = useState<any>(null)

  const loadProposals = async () => {
    const [flag, approval] = await Promise.all([
      apiFetch(`/admin/projects/${id}/flag/proposal`).then((r) => r.ok ? r.json() : null).catch(() => null),
      apiFetch(`/admin/projects/${id}/approval-proposal`).then((r) => r.ok ? r.json() : null).catch(() => null),
    ])
    setFlagProposal(flag)
    setApprovalProposal(approval)
  }

  useEffect(() => {
    apiFetch(`/admin/projects/${id}`)
      .then((r) => r.json())
      .then((data) => { setCampaign(data); return loadProposals() })
      .catch(() => toast.error('Failed to load campaign'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // ── Approval proposal handlers ───────────────────────────────────────────

  const handleProposeApproval = async () => {
    setPending(true)
    try {
      const res = await apiFetch(`/admin/projects/${id}/propose-approval`, { method: 'POST' })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed') }
      toast.success('Approval proposed. A second admin must confirm to deploy on-chain.')
      await loadProposals()
    } catch (err: any) { toast.error(err.message || 'Failed to propose approval') }
    finally { setPending(false) }
  }

  const handleCancelApprovalProposal = async () => {
    if (!confirm('Cancel this approval proposal?')) return
    setPending(true)
    try {
      const res = await apiFetch(`/admin/projects/${id}/approval-proposal`, { method: 'DELETE' })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed') }
      toast.success('Approval proposal cancelled.')
      await loadProposals()
    } catch (err: any) { toast.error(err.message || 'Failed to cancel proposal') }
    finally { setPending(false) }
  }

  // The second admin calls createCampaign() on-chain then confirms in the DB
  const handleConfirmDeploy = async () => {
    if (!campaign?.ipfsHash) { toast.error('Campaign has no ipfsHash.'); return }
    if (!campaign?.deadline) { toast.error('Campaign has no deadline set.'); return }
    if (!campaign.creator?.walletAddress) { toast.error('Campaign creator wallet address is missing.'); return }
    setPending(true)
    try {
      const isUsdc = campaign.paymentToken === 'USDC'
      const toWei = (val: string | number) => isUsdc ? parseUnits(String(val), 6) : parseEther(String(val))
      const deadlineTs = BigInt(Math.floor(new Date(campaign.deadline).getTime() / 1000))
      const contractMilestones = (campaign.milestones ?? []).map((m: any) => ({
        ipfsHash: keccak256(toBytes(m.title + m.description)),
        amountRequired: toWei(m.amount),
        deadline: deadlineTs,
      }))
      const fundGoal = contractMilestones.reduce((sum: bigint, m: any) => sum + m.amountRequired, BigInt(0))

      const txHash = await writeWithSimulate({
        address: CAMPAIGN_FACTORY_ADDRESS,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: 'createCampaign',
        args: [campaign.creator.walletAddress as `0x${string}`, campaign.ipfsHash, isUsdc ? 1 : 0, fundGoal, deadlineTs, contractMilestones],
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` })

      let onChainId: number | undefined
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: CAMPAIGN_FACTORY_ABI, eventName: 'CampaignCreated', data: log.data, topics: log.topics })
          onChainId = Number((decoded.args as any).campaignId)
          break
        } catch { /* not this event */ }
      }
      if (onChainId === undefined) throw new Error('Could not read campaign ID from receipt')

      await apiFetch(`/admin/projects/${id}/confirm-approval`, {
        method: 'POST',
        body: JSON.stringify({ onChainId }),
      })

      toast.success(`Campaign deployed on-chain (ID: ${onChainId}). View: https://sepolia.etherscan.io/tx/${txHash}`, { duration: 8000 })
      setCampaign((c: any) => ({ ...c, status: 'ACTIVE', isAdminApproved: true, onChainId }))
      setApprovalProposal((p: any) => p ? { ...p, executed: true } : p)
    } catch (err: any) {
      toast.error(parseContractError(err))
    } finally {
      setPending(false)
    }
  }

  // ── Other action handlers ────────────────────────────────────────────────

  const handleCancel = async () => {
    if (!campaign?.onChainId) { toast.error('Campaign has no on-chain ID.'); return }
    if (!window.confirm('Cancel this campaign on-chain? Contributors will be able to propose refunds.')) return
    setPending(true)
    try {
      await writeWithSimulate({ address: CAMPAIGN_FACTORY_ADDRESS, abi: CAMPAIGN_FACTORY_ABI, functionName: 'cancelCampaign', args: [BigInt(campaign.onChainId)] })
      toast.success('Campaign cancelled on-chain.')
      setCampaign((c: any) => ({ ...c, status: 'FAILED' }))
    } catch (err: any) { toast.error(parseContractError(err)) }
    finally { setPending(false) }
  }

  const handleReject = async () => {
    setPending(true)
    try {
      const res = await apiFetch(`/admin/projects/${id}/reject`, { method: 'POST' })
      if (!res.ok) throw new Error('Rejection failed')
      toast.success('Campaign rejected.')
      setCampaign((c: any) => ({ ...c, status: 'FAILED' }))
    } catch (err: any) { toast.error(err.message || 'Rejection failed') }
    finally { setPending(false) }
  }

  const handleProposeFlag = async () => {
    if (!campaign?.onChainId) { toast.error('Campaign has no on-chain ID — use Reject for off-chain submissions.'); return }
    setPending(true)
    try {
      await writeWithSimulate({ address: CAMPAIGN_FACTORY_ADDRESS, abi: CAMPAIGN_FACTORY_ABI, functionName: 'proposeFlagCampaign', args: [BigInt(campaign.onChainId), 'Flagged by admin'] })
      const p = await apiFetch(`/admin/projects/${id}/flag/proposal`).then((r) => r.ok ? r.json() : null).catch(() => null)
      setFlagProposal(p)
      toast.success('Flag proposed. A second admin must confirm to execute.')
    } catch (err: any) { toast.error(parseContractError(err)) }
    finally { setPending(false) }
  }

  const handleConfirmFlag = async () => {
    if (!campaign?.onChainId) return
    setPending(true)
    try {
      await writeWithSimulate({ address: CAMPAIGN_FACTORY_ADDRESS, abi: CAMPAIGN_FACTORY_ABI, functionName: 'confirmFlagCampaign', args: [BigInt(campaign.onChainId)] })
      toast.success('Campaign flagged on-chain.')
      setCampaign((c: any) => ({ ...c, status: 'FLAGGED' }))
      setFlagProposal((p: any) => p ? { ...p, executed: true } : p)
    } catch (err: any) { toast.error(parseContractError(err)) }
    finally { setPending(false) }
  }

  if (loading) {
    return <LoadingScreen message="Loading project review" />
  }

  if (!campaign) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-error)' }}>Campaign not found.</div>
  }

  const isPending = campaign.status === 'PENDING'
  const pendingApprovalProposal = approvalProposal && !approvalProposal.executed
  const isApprovalProposer = pendingApprovalProposal && connectedAddress?.toLowerCase() === approvalProposal.proposer?.toLowerCase()

  // P3 — stale flag proposal warning (>7 days open without confirmation)
  const flagProposalAgeMs = flagProposal?.proposedAt ? Date.now() - new Date(flagProposal.proposedAt).getTime() : 0
  const isFlagProposalStale = flagProposal && !flagProposal.executed && flagProposalAgeMs > 7 * 24 * 60 * 60 * 1000

  const shortAddr = (addr: string) => addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '—'

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/admin/verification')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
        >
          <HiArrowLeft /> Back to Queue
        </button>
      </div>

      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <h1 className="admin-page-title" style={{ marginBottom: 0 }}>{campaign.title}</h1>
            <span className={`admin-badge ${isPending ? 'warning' : campaign.status === 'ACTIVE' ? 'success' : 'error'}`}>
              {campaign.status}
            </span>
          </div>
          <p className="admin-page-subtitle">
            Submitted {new Date(campaign.createdAt).toLocaleDateString()} • ID: #{id}
            {campaign.onChainId != null && ` • On-chain ID: ${campaign.onChainId}`}
          </p>
        </div>
        {isPending && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end' }}>
            {/* Flag proposal section (only when already on-chain) */}
            {campaign.onChainId != null && (() => {
              const pendingFlag = flagProposal && !flagProposal.executed
              const isFlagProposer = pendingFlag && connectedAddress?.toLowerCase() === flagProposal.proposer?.toLowerCase()
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                  {isFlagProposalStale && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#92400e', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', padding: '6px 10px', maxWidth: '320px' }}>
                      <HiExclamationTriangle style={{ flexShrink: 0 }} /><span>Flag proposal pending 7+ days — consider re-proposing.</span>
                    </div>
                  )}
                  {pendingFlag && (
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', background: 'var(--color-bg-subtle)', borderRadius: '6px', padding: '6px 10px', display: 'flex', gap: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiUserCircle size={13} /><code style={{ fontFamily: 'monospace', fontSize: '11px' }}>{shortAddr(flagProposal.proposer)}</code>{isFlagProposer && <span style={{ color: 'var(--color-primary)', marginLeft: '2px' }}>(you)</span>}</span>
                      {flagProposal.proposedAt && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiClock size={13} />{new Date(flagProposal.proposedAt).toLocaleDateString()}</span>}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {!pendingFlag && <button className="btn" onClick={handleProposeFlag} disabled={pending} style={{ background: 'white', border: '1px solid #f59e0b', color: '#d97706', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', opacity: pending ? 0.5 : 1 }}>Propose Flag</button>}
                    {pendingFlag && isFlagProposer && <button disabled style={{ background: 'white', border: '1px solid #f59e0b', color: '#d97706', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', opacity: 0.5, cursor: 'not-allowed' }}>Awaiting Another Admin</button>}
                    {pendingFlag && !isFlagProposer && <button className="btn" onClick={handleConfirmFlag} disabled={pending} style={{ background: '#f59e0b', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', opacity: pending ? 0.5 : 1 }}>Confirm Flag</button>}
                  </div>
                </div>
              )
            })()}

            {/* Two-admin approval section */}
            {pendingApprovalProposal && (
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', background: 'var(--color-bg-subtle)', borderRadius: '6px', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '320px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600', color: '#d97706' }}>
                  <HiClock size={13} /> Approval proposed — awaiting second admin
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiUserCircle size={12} /><code style={{ fontFamily: 'monospace', fontSize: '11px' }}>{shortAddr(approvalProposal.proposer)}</code>{isApprovalProposer && <span style={{ color: 'var(--color-primary)', marginLeft: '2px' }}>(you)</span>}</span>
                  <span>{new Date(approvalProposal.proposedAt).toLocaleDateString()}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={handleReject} disabled={pending} style={{ background: 'white', border: '1px solid var(--color-error)', color: 'var(--color-error)', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', opacity: pending ? 0.5 : 1 }}>Reject</button>

              {/* Step 1 — Propose Approval (no proposal yet) */}
              {!pendingApprovalProposal && (
                <button className="btn" onClick={handleProposeApproval} disabled={pending} style={{ background: 'white', border: '1px solid var(--color-success)', color: 'var(--color-success)', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', opacity: pending ? 0.5 : 1 }}>
                  {pending ? 'Submitting…' : 'Propose Approval'}
                </button>
              )}

              {/* Proposer view — awaiting second admin */}
              {pendingApprovalProposal && isApprovalProposer && (
                <>
                  <button disabled style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', opacity: 0.6, cursor: 'not-allowed' }}>Awaiting Another Admin</button>
                  <button className="btn" onClick={handleCancelApprovalProposal} disabled={pending} style={{ background: 'white', border: '1px solid var(--color-error)', color: 'var(--color-error)', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', opacity: pending ? 0.5 : 1 }}>Cancel Proposal</button>
                </>
              )}

              {/* Step 2 — Confirm & Deploy (different admin) */}
              {pendingApprovalProposal && !isApprovalProposer && (
                <button className="btn" onClick={handleConfirmDeploy} disabled={pending} style={{ background: 'var(--color-success)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', opacity: pending ? 0.5 : 1 }}>
                  {pending ? 'Deploying…' : 'Confirm & Deploy'}
                </button>
              )}
            </div>
          </div>
        )}
        {['ACTIVE', 'FUNDED'].includes(campaign.status) && campaign.onChainId != null && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn" onClick={handleCancel} disabled={pending} style={{ background: 'white', border: '1px solid var(--color-error)', color: 'var(--color-error)', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', opacity: pending ? 0.5 : 1 }}>
              {pending ? 'Signing...' : 'Cancel Campaign'}
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

          <div className="admin-table-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--color-text-primary)' }}>Project Overview</h3>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--color-text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>Description</label>
              <p style={{ lineHeight: '1.6', color: 'var(--color-text-secondary)' }}>{campaign.description || '—'}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--color-text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>Category</label>
                <div style={{ fontWeight: '500' }}>{campaign.category || '—'}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--color-text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>Creator Wallet</label>
                <div style={{ fontFamily: 'monospace', background: 'var(--color-bg-subtle)', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', fontSize: '13px' }}>{campaign.creator?.walletAddress || '—'}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--color-text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>Fund Goal</label>
                <div style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}><HiCurrencyDollar />{campaign.goalAmount?.toLocaleString()} {campaign.paymentToken}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--color-text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>Deadline</label>
                <div style={{ fontWeight: '500' }}>{campaign.deadline ? new Date(campaign.deadline).toLocaleDateString() : '—'}</div>
              </div>
            </div>
          </div>

          <div className="admin-table-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--color-text-primary)' }}>Proposed Milestones</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(campaign.milestones || []).map((m: any, idx: number) => (
                <div key={m.id} style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontWeight: '600' }}>{idx + 1}. {m.title}</div>
                    <div style={{ fontWeight: '700', color: 'var(--color-primary)' }}>{m.amount?.toLocaleString()} {campaign.paymentToken}</div>
                  </div>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>{m.description || '—'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="admin-table-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '20px', color: 'var(--color-text-primary)' }}>Social Links</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { icon: <HiGlobeAlt />, label: 'Website', url: campaign.websiteUrl },
                { icon: <FaGithub />, label: 'GitHub', url: campaign.githubUrl },
                { icon: <FaTwitter />, label: 'Twitter/X', url: campaign.twitterUrl },
                { icon: <FaDiscord />, label: 'Discord', url: campaign.discordUrl },
              ].map(({ icon, label, url }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                    {icon} {label}
                  </div>
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-primary)', fontSize: '13px' }}>
                      <span className="admin-badge success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiCheckCircle /> Provided</span>
                    </a>
                  ) : (
                    <span className="admin-badge neutral" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><HiXCircle /> Missing</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {campaign.ipfsHash && (
            <div className="admin-table-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', color: 'var(--color-text-primary)' }}>On-Chain Data</h3>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <HiDocumentText /> IPFS hash stored on-chain
                </div>
                <div style={{ fontFamily: 'monospace', background: 'var(--color-bg-subtle)', padding: '6px 8px', borderRadius: '4px', wordBreak: 'break-all', fontSize: '11px' }}>{campaign.ipfsHash}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
