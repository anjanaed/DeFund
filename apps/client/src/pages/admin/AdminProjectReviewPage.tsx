import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWriteContract, useAccount } from 'wagmi'
import { parseEther, parseUnits, keccak256, toBytes, decodeEventLog } from 'viem'
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
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
  const { writeContractAsync } = useWriteContract()
  const { address: connectedAddress } = useAccount()

  const [campaign, setCampaign] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionStatus, setActionStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [actionMessage, setActionMessage] = useState('')
  const [approvalTxHash, setApprovalTxHash] = useState<string | null>(null)
  const [flagProposal, setFlagProposal] = useState<any>(null)

  useEffect(() => {
    apiFetch(`/admin/projects/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setCampaign(data)
        // Load any existing flag proposal for this campaign
        return apiFetch(`/admin/projects/${id}/flag/proposal`)
          .then((r) => r.ok ? r.json() : null)
          .then((p) => setFlagProposal(p))
          .catch(() => {})
      })
      .catch(() => setActionMessage('Failed to load campaign'))
      .finally(() => setLoading(false))
  }, [id])

  const handleApprove = async () => {
    if (!campaign?.ipfsHash) {
      setActionMessage('Campaign has no ipfsHash — it may have been submitted with an old version of the app.')
      setActionStatus('error')
      return
    }
    if (!campaign?.deadline) {
      setActionMessage('Campaign has no deadline set.')
      setActionStatus('error')
      return
    }
    setActionStatus('pending')
    setActionMessage('')
    try {
      const isUsdc = campaign.paymentToken === 'USDC'
      const toWei = (val: string | number) =>
        isUsdc ? parseUnits(String(val), 6) : parseEther(String(val))

      const deadlineTs = BigInt(Math.floor(new Date(campaign.deadline).getTime() / 1000))

      const contractMilestones = (campaign.milestones ?? []).map((m: any) => ({
        ipfsHash: keccak256(toBytes(m.title + m.description)),
        amountRequired: toWei(m.amount),
        deadline: deadlineTs,
      }))

      const fundGoal = contractMilestones.reduce(
        (sum: bigint, m: any) => sum + m.amountRequired,
        BigInt(0),
      )

      // Admin calls createCampaign() — this creates the campaign on-chain as Active
      // and emits CampaignCreated + CampaignApproved for the indexer to sync.
      // [H2] _creator is the actual project creator's wallet — passed as first arg
      //      so on-chain milestone proof submission and fund releases go to them.
      if (!campaign.creator?.walletAddress) {
        setActionMessage('Campaign creator wallet address is missing — cannot deploy.')
        setActionStatus('error')
        return
      }
      const txHash = await writeContractAsync({
        address: CAMPAIGN_FACTORY_ADDRESS,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: 'createCampaign',
        args: [
          campaign.creator.walletAddress as `0x${string}`,
          campaign.ipfsHash,
          isUsdc ? 1 : 0,
          fundGoal,
          deadlineTs,
          contractMilestones,
        ],
      })

      // Wait for receipt and extract the new on-chain campaign ID
      const publicClient = createPublicClient({ chain: sepolia, transport: http() })
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` })

      let onChainId: number | undefined
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: CAMPAIGN_FACTORY_ABI,
            eventName: 'CampaignCreated',
            data: log.data,
            topics: log.topics,
          })
          onChainId = Number((decoded.args as any).campaignId)
          break
        } catch {
          // not CampaignCreated, skip
        }
      }

      if (onChainId === undefined) throw new Error('Could not read campaign ID from receipt')

      // Update DB: link onChainId and mark as approved/active.
      // The indexer will also sync from events as a fallback.
      try {
        await apiFetch(`/admin/projects/${id}/approve`, {
          method: 'POST',
          body: JSON.stringify({ onChainId }),
        })
      } catch {
        // Swallow — indexer will sync from CampaignCreated + CampaignApproved events
      }

      setApprovalTxHash(txHash as string)
      setActionStatus('success')
      setActionMessage(`Campaign deployed on-chain (ID: ${onChainId}) and approved.`)
      setCampaign((c: any) => ({ ...c, status: 'ACTIVE', isAdminApproved: true, onChainId }))
    } catch (err: any) {
      setActionStatus('error')
      setActionMessage(parseContractError(err))
    }
  }

  const handleCancel = async () => {
    if (!campaign?.onChainId) {
      setActionMessage('Campaign has no on-chain ID.')
      setActionStatus('error')
      return
    }
    if (!window.confirm('Cancel this campaign on-chain? Contributors will be able to propose refunds.')) return
    setActionStatus('pending')
    setActionMessage('')
    try {
      await writeContractAsync({
        address: CAMPAIGN_FACTORY_ADDRESS,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: 'cancelCampaign',
        args: [BigInt(campaign.onChainId)],
      })
      setActionStatus('success')
      setActionMessage('Campaign cancelled on-chain.')
      setCampaign((c: any) => ({ ...c, status: 'FAILED' }))
    } catch (err: any) {
      setActionStatus('error')
      setActionMessage(parseContractError(err))
    }
  }

  const handleReject = async () => {
    setActionStatus('pending')
    setActionMessage('')
    try {
      const res = await apiFetch(`/admin/projects/${id}/reject`, { method: 'POST' })
      if (!res.ok) throw new Error('Rejection failed')
      setActionStatus('success')
      setActionMessage('Campaign rejected.')
      setCampaign((c: any) => ({ ...c, status: 'FAILED' }))
    } catch (err: any) {
      setActionStatus('error')
      setActionMessage(err.message || 'Rejection failed')
    }
  }

  const handleProposeFlag = async () => {
    if (!campaign?.onChainId) {
      setActionMessage('Campaign has no on-chain ID — use Reject for off-chain submissions.')
      setActionStatus('error')
      return
    }
    setActionStatus('pending')
    setActionMessage('')
    try {
      await writeContractAsync({
        address: CAMPAIGN_FACTORY_ADDRESS,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: 'proposeFlagCampaign',
        args: [BigInt(campaign.onChainId), 'Flagged by admin'],
      })
      // Refresh proposal state from DB (indexer will sync from FlagProposed event)
      const p = await apiFetch(`/admin/projects/${id}/flag/proposal`).then((r) => r.ok ? r.json() : null).catch(() => null)
      setFlagProposal(p)
      setActionStatus('success')
      setActionMessage('Flag proposed. A second admin must confirm to execute.')
    } catch (err: any) {
      setActionStatus('error')
      setActionMessage(parseContractError(err))
    }
  }

  const handleConfirmFlag = async () => {
    if (!campaign?.onChainId) return
    setActionStatus('pending')
    setActionMessage('')
    try {
      await writeContractAsync({
        address: CAMPAIGN_FACTORY_ADDRESS,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: 'confirmFlagCampaign',
        args: [BigInt(campaign.onChainId)],
      })
      setActionStatus('success')
      setActionMessage('Campaign flagged on-chain.')
      setCampaign((c: any) => ({ ...c, status: 'FLAGGED' }))
      setFlagProposal((p: any) => p ? { ...p, executed: true } : p)
    } catch (err: any) {
      setActionStatus('error')
      setActionMessage(parseContractError(err))
    }
  }

  if (loading) {
    return <LoadingScreen message="Loading project review" />
  }

  if (!campaign) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-error)' }}>Campaign not found.</div>
  }

  const isPending = campaign.status === 'PENDING'

  // P3 — stale flag proposal warning (>7 days open without confirmation)
  const flagProposalAgeMs = flagProposal?.proposedAt
    ? Date.now() - new Date(flagProposal.proposedAt).getTime()
    : 0
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
            {campaign.onChainId != null && (() => {
              const pendingProposal = flagProposal && !flagProposal.executed
              const isProposer = pendingProposal && connectedAddress?.toLowerCase() === flagProposal.proposer?.toLowerCase()
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                  {/* P3 — stale proposal warning */}
                  {isFlagProposalStale && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#92400e', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', padding: '6px 10px', maxWidth: '320px' }}>
                      <HiExclamationTriangle style={{ flexShrink: 0 }} />
                      <span>Proposal pending 7+ days — consider re-proposing.</span>
                    </div>
                  )}
                  {/* U4 — proposer metadata */}
                  {pendingProposal && (
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', background: 'var(--color-bg-subtle)', borderRadius: '6px', padding: '6px 10px', display: 'flex', gap: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <HiUserCircle size={13} />
                        <code style={{ fontFamily: 'monospace', fontSize: '11px' }}>{shortAddr(flagProposal.proposer)}</code>
                        {isProposer && <span style={{ color: 'var(--color-primary)', marginLeft: '2px' }}>(you)</span>}
                      </span>
                      {flagProposal.proposedAt && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <HiClock size={13} />
                          {new Date(flagProposal.proposedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {!pendingProposal && (
                      <button
                        className="btn"
                        onClick={handleProposeFlag}
                        disabled={actionStatus === 'pending'}
                        style={{ background: 'white', border: '1px solid #f59e0b', color: '#d97706', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', opacity: actionStatus === 'pending' ? 0.5 : 1 }}
                      >
                        Propose Flag
                      </button>
                    )}
                    {pendingProposal && isProposer && (
                      <button disabled style={{ background: 'white', border: '1px solid #f59e0b', color: '#d97706', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', opacity: 0.5, cursor: 'not-allowed' }}>
                        Awaiting Another Admin
                      </button>
                    )}
                    {pendingProposal && !isProposer && (
                      <button
                        className="btn"
                        onClick={handleConfirmFlag}
                        disabled={actionStatus === 'pending'}
                        style={{ background: '#f59e0b', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', opacity: actionStatus === 'pending' ? 0.5 : 1 }}
                      >
                        Confirm Flag
                      </button>
                    )}
                  </div>
                </div>
              )
            })()}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn"
                onClick={handleReject}
                disabled={actionStatus === 'pending'}
                style={{ background: 'white', border: '1px solid var(--color-error)', color: 'var(--color-error)', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', opacity: actionStatus === 'pending' ? 0.5 : 1 }}
              >
                Reject
              </button>
              <button
                className="btn"
                onClick={handleApprove}
                disabled={actionStatus === 'pending'}
                style={{ background: 'var(--color-success)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', opacity: actionStatus === 'pending' ? 0.5 : 1 }}
              >
                {actionStatus === 'pending' ? 'Signing...' : 'Approve Project'}
              </button>
            </div>
          </div>
        )}
        {['ACTIVE', 'FUNDED'].includes(campaign.status) && campaign.onChainId != null && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="btn"
              onClick={handleCancel}
              disabled={actionStatus === 'pending'}
              style={{ background: 'white', border: '1px solid var(--color-error)', color: 'var(--color-error)', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', opacity: actionStatus === 'pending' ? 0.5 : 1 }}
            >
              {actionStatus === 'pending' ? 'Signing...' : 'Cancel Campaign'}
            </button>
          </div>
        )}
      </div>

      {actionMessage && (
        <div style={{
          padding: '10px 14px', borderRadius: '6px', marginBottom: '24px', fontSize: '14px',
          background: actionStatus === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
          border: `1px solid ${actionStatus === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
          color: actionStatus === 'error' ? 'var(--color-error)' : '#15803d',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          {actionStatus === 'error' ? <HiXCircle /> : <HiCheckCircle />} {actionMessage}
          {approvalTxHash && actionStatus === 'success' && (
            <a
              href={`https://sepolia.etherscan.io/tx/${approvalTxHash}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#15803d', fontWeight: '600', marginLeft: '4px', textDecoration: 'underline' }}
            >
              View on Etherscan ↗
            </a>
          )}
        </div>
      )}

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
