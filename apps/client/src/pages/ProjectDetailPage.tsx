import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import AppNavbar from '../components/layout/AppNavbar'
import ProofModal from '../components/common/ProofModal'
import MilestoneVotingStatus from '../components/common/MilestoneVotingStatus'
import TxBanner from '../components/common/TxBanner'
import LoadingScreen from '../components/common/LoadingScreen'
import OnboardingModal from '../components/common/OnboardingModal'
import {
  HiUsers, HiChartBar, HiCheckCircle, HiClock, HiInformationCircle,
  HiEye, HiArrowLeft, HiShare, HiQuestionMarkCircle,
} from 'react-icons/hi2'
import { useWriteContract, useAccount, usePublicClient } from 'wagmi'
import { parseEther, parseUnits } from 'viem'
import { CAMPAIGN_FACTORY_ADDRESS, CAMPAIGN_FACTORY_ABI, USDC_ADDRESS, ERC20_APPROVE_ABI } from '../config/contracts'
import { apiFetch } from '../lib/api'
import ProjectForum from '../components/forum/ProjectForum'
import { parseContractError } from '../lib/errors'

interface Campaign {
  id: string; title: string; description: string; category: string; status: string
  raisedAmount: string; goalAmount: string; paymentToken: string; deadline: string | null
  website: string | null; githubUrl: string | null; onChainId: number | null
  creator: { id: string; name: string | null; walletAddress: string }
  _count: { milestones: number; contributions: number }
}
interface Milestone {
  id: string; title: string; description: string; status: string
  amount: string; onChainId: number | null; proofUrl: string | null
}
interface Update { id: string; title: string; content: string; createdAt: string }

const fmt = (n: number) => `$${Number(n).toLocaleString()}`
const shortenAddress = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`

const MILESTONE_STATUS_COLOR: Record<string, string> = {
  APPROVED: 'approved', COMPLETED: 'approved', VOTING: 'active', PENDING: 'pending', REJECTED: 'pending',
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isConnected, address } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [updates, setUpdates] = useState<Update[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('milestones')

  const [showProofModal, setShowProofModal] = useState(false)
  const [selectedProof, setSelectedProof] = useState<{ title: string; content: string } | null>(null)

  const [contributionAmount, setContributionAmount] = useState('')
  const [contributing, setContributing] = useState(false)
  const [contributingStep, setContributingStep] = useState<'approving' | 'contributing' | null>(null)
  const [contributionDone, setContributionDone] = useState(false)
  const [txError, setTxError] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      apiFetch(`/projects/${id}`).then(r => r.ok ? r.json() : null),
      apiFetch(`/projects/${id}/milestones`).then(r => r.ok ? r.json() : []),
      apiFetch(`/projects/${id}/updates`).then(r => r.ok ? r.json() : []),
    ]).then(([camp, ms, ups]) => {
      setCampaign(camp)
      setMilestones(ms)
      setUpdates(ups)
      setLoading(false)
    })
  }, [id])

  // [L1] Minimum contributions enforced on-chain: 0.001 ETH / 1 USDC
  const MIN_ETH = 0.001
  const MIN_USDC = 1

  const handleContribute = async () => {
    if (!campaign?.onChainId || !contributionAmount) return
    const amt = parseFloat(contributionAmount)
    if (isNaN(amt) || amt <= 0) { setTxError('Amount must be greater than zero'); return }
    if (amt > 1_000_000) { setTxError('Amount exceeds maximum allowed'); return }
    // Client-side minimum check mirrors on-chain require() to avoid wasted gas
    const isUsdc = campaign.paymentToken === 'USDC'
    if (isUsdc && amt < MIN_USDC) { setTxError(`Minimum contribution is ${MIN_USDC} USDC`); return }
    if (!isUsdc && amt < MIN_ETH) { setTxError(`Minimum contribution is ${MIN_ETH} ETH`); return }
    setContributing(true)
    setContributingStep(null)
    try {
      if (campaign.paymentToken === 'USDC') {
        const amount = parseUnits(contributionAmount, 6)
        // USDC requires an ERC-20 approve() before transferFrom can succeed.
        // Check existing allowance and only prompt approval when needed.
        if (publicClient && address) {
          const allowance = await publicClient.readContract({
            address: USDC_ADDRESS,
            abi: ERC20_APPROVE_ABI,
            functionName: 'allowance',
            args: [address, CAMPAIGN_FACTORY_ADDRESS],
          }) as bigint
          if (allowance < amount) {
            setContributingStep('approving')
            const approveTx = await writeContractAsync({
              address: USDC_ADDRESS,
              abi: ERC20_APPROVE_ABI,
              functionName: 'approve',
              args: [CAMPAIGN_FACTORY_ADDRESS, amount],
            })
            await publicClient.waitForTransactionReceipt({ hash: approveTx })
          }
        }
        setContributingStep('contributing')
        await writeContractAsync({
          address: CAMPAIGN_FACTORY_ADDRESS, abi: CAMPAIGN_FACTORY_ABI,
          functionName: 'contributeUSDC',
          args: [BigInt(campaign.onChainId), amount],
        })
      } else {
        setContributingStep('contributing')
        await writeContractAsync({
          address: CAMPAIGN_FACTORY_ADDRESS, abi: CAMPAIGN_FACTORY_ABI,
          functionName: 'contributeETH',
          args: [BigInt(campaign.onChainId)],
          value: parseEther(contributionAmount),
        })
      }
      setContributionDone(true)
      setContributionAmount('')
    } catch (err) {
      setTxError(parseContractError(err))
    } finally {
      setContributing(false)
      setContributingStep(null)
    }
  }

  if (loading) return (
    <div className="app-container">
      <AppNavbar />
      <LoadingScreen message="Loading project" />
    </div>
  )

  if (!campaign) return (
    <div className="app-container">
      <AppNavbar />
      <div className="page-loading">Campaign not found.</div>
    </div>
  )

  const raised = Number(campaign.raisedAmount)
  const goal = Number(campaign.goalAmount)
  const progress = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0
  const isActive = ['ACTIVE', 'FUNDED'].includes(campaign.status)
  const creatorInitial = (campaign.creator.name || campaign.creator.walletAddress).slice(0, 1).toUpperCase()

  const daysLeft = campaign.deadline
    ? Math.ceil((new Date(campaign.deadline).getTime() - Date.now()) / 86400000)
    : null

  // F5 — copy campaign URL to clipboard
  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  return (
    <div className="app-container">
      <AppNavbar />
      {txError && <TxBanner message={txError} onClose={() => setTxError(null)} />}
      {/* U5 — onboarding modal (auto-shows once, can be re-triggered) */}
      <OnboardingModal forceShow={showOnboarding} onClose={() => setShowOnboarding(false)} />
      <div className="project-detail-page">
        <div className="container">

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <Link to="/explore" className="project-back-link" style={{ margin: 0 }}>
              <HiArrowLeft /> Back to Explore
            </Link>
            {/* F5 — share + U5 how-it-works buttons */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setShowOnboarding(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0.4rem 0.75rem', background: 'transparent', border: '1px solid var(--color-border, rgba(255,255,255,0.1))', borderRadius: '8px', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                <HiQuestionMarkCircle /> How it works
              </button>
              <button
                onClick={handleShare}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0.4rem 0.75rem', background: 'transparent', border: '1px solid var(--color-border, rgba(255,255,255,0.1))', borderRadius: '8px', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                <HiShare /> {shareCopied ? '✓ Copied!' : 'Share'}
              </button>
            </div>
          </div>

          <div className="project-detail-grid">

            {/* ── Main Content ── */}
            <div className="project-main-content">

              {/* Header */}
              <div className="project-detail-header">
                <div className="project-detail-badges">
                  <span className="project-detail-category-badge">{campaign.category}</span>
                  {isActive && <span className="project-detail-active-badge">{campaign.status}</span>}
                  {!isActive && (
                    <span className="project-detail-category-badge"
                      style={{ color: campaign.status === 'FLAGGED' ? 'var(--color-error)' : undefined }}>
                      {campaign.status}
                    </span>
                  )}
                </div>
                <h1 className="project-detail-title">{campaign.title}</h1>
                <p className="project-detail-tagline">{campaign.description}</p>
                <div className="project-creator">
                  by <span>{campaign.creator.name || shortenAddress(campaign.creator.walletAddress)}</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="project-tabs">
                {(['milestones', 'updates', 'forum'] as const).map(tab => (
                  <button
                    key={tab}
                    className={`project-tab ${activeTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Milestones Tab */}
              {activeTab === 'milestones' && (
                <div className="project-milestones-list">
                  {milestones.length === 0 && (
                    <p className="empty-state-text">No milestones yet.</p>
                  )}
                  {milestones.map((m, i) => (
                    <div
                      key={m.id}
                      className={`project-milestone-card ${MILESTONE_STATUS_COLOR[m.status] || ''}`}
                    >
                      <div className="project-milestone-header">
                        <div className="project-milestone-number-wrapper">
                          <div className="project-milestone-number">{i + 1}</div>
                          <div>
                            <div className="project-milestone-title-row">
                              <h3 className="project-milestone-title">{m.title}</h3>
                              <span className={`project-milestone-status-badge ${MILESTONE_STATUS_COLOR[m.status] || 'pending'}`}>
                                {m.status}
                              </span>
                            </div>
                            <p className="project-milestone-description">{m.description}</p>
                            <div className="project-milestone-amount">{fmt(Number(m.amount))}</div>
                          </div>
                        </div>
                        {m.proofUrl && (
                          <button
                            className="project-link"
                            onClick={() => { setSelectedProof({ title: m.title, content: m.proofUrl! }); setShowProofModal(true) }}
                          >
                            <HiEye /> View Proof
                          </button>
                        )}
                      </div>
                      {m.status === 'VOTING' && m.onChainId != null && (
                        <MilestoneVotingStatus
                          milestoneOnChainId={m.onChainId}
                          paymentToken={campaign.paymentToken}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Updates Tab */}
              {activeTab === 'updates' && (
                <div className="project-updates-list">
                  {updates.length === 0 ? (
                    <p className="empty-state-text">No updates posted yet.</p>
                  ) : updates.map(u => (
                    <div key={u.id} className="project-update-card">
                      <div className="project-update-header">
                        <h4 className="project-update-title">{u.title}</h4>
                        <span className="project-update-date">{new Date(u.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="project-update-content">{u.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Forum Tab */}
              {activeTab === 'forum' && id && (
                <ProjectForum projectId={id} />
              )}
            </div>

            {/* ── Sidebar ── */}
            <div className="project-sidebar">

              {/* Funding Card */}
              <div className="project-contribution-card">
                <div className="contribution-stats">
                  <div className="contribution-stat-main">
                    <div className="contribution-amount">{fmt(raised)}</div>
                    <div className="contribution-label">raised of {fmt(goal)} goal</div>
                  </div>
                  <div className="contribution-progress-bar">
                    <div className="contribution-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="contribution-stats-grid">
                    <div className="contribution-stat-item">
                      <HiUsers className="stat-icon" />
                      <div>
                        <div className="stat-value">{campaign._count.contributions}</div>
                        <div className="stat-label">contributors</div>
                      </div>
                    </div>
                    <div className="contribution-stat-item">
                      <HiChartBar className="stat-icon" />
                      <div>
                        <div className="stat-value">{campaign._count.milestones}</div>
                        <div className="stat-label">milestones</div>
                      </div>
                    </div>
                    {daysLeft !== null && (
                      <div className="contribution-stat-item">
                        <HiClock className="stat-icon" />
                        <div>
                          <div className="stat-value">{daysLeft > 0 ? daysLeft : 0}</div>
                          <div className="stat-label">{daysLeft > 0 ? 'days left' : 'ended'}</div>
                        </div>
                      </div>
                    )}
                    <div className="contribution-stat-item">
                      <HiInformationCircle className="stat-icon" />
                      <div>
                        <div className="stat-value">{Math.round(progress)}%</div>
                        <div className="stat-label">funded</div>
                      </div>
                    </div>
                  </div>
                </div>

                {isActive && isConnected && !contributionDone && (
                  <div className="project-contribute">
                    <div className="project-contribute-row">
                      <input
                        type="number"
                        className="form-input"
                        placeholder={`Amount (${campaign.paymentToken})`}
                        value={contributionAmount}
                        onChange={e => setContributionAmount(e.target.value)}
                        min="0"
                        max="1000000"
                        step="0.01"
                      />
                      <button
                        className="btn btn-primary"
                        onClick={handleContribute}
                        disabled={!contributionAmount || contributing}
                      >
                        {contributing
                        ? contributingStep === 'approving' ? 'Approving USDC...' : 'Confirming...'
                        : 'Fund'}
                      </button>
                    </div>
                    <p className="contribution-note">
                      <HiCheckCircle /> Secured by smart contract
                      {' '}· Min: {campaign.paymentToken === 'USDC' ? `${MIN_USDC} USDC` : `${MIN_ETH} ETH`}
                    </p>
                  </div>
                )}

                {contributionDone && (
                  <div className="contribution-success">
                    <HiCheckCircle /> Contribution submitted!
                  </div>
                )}

                {isActive && !isConnected && (
                  <p className="connect-wallet-note">Connect your wallet to contribute.</p>
                )}
              </div>

              {/* Creator Card */}
              <div className="project-creator-card">
                <div className="creator-card-title">Creator</div>
                <div className="creator-info">
                  <div className="creator-avatar">{creatorInitial}</div>
                  <div>
                    <div className="creator-name">
                      {campaign.creator.name || 'Anonymous'}
                    </div>
                    <div className="creator-address">
                      {shortenAddress(campaign.creator.walletAddress)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Links Card */}
              {(campaign.website || campaign.githubUrl) && (
                <div className="project-info-card">
                  <div className="info-card-title">Links</div>
                  <div className="project-detail-links">
                    {campaign.website && (
                      <a href={campaign.website} target="_blank" rel="noopener noreferrer" className="project-link">
                        🌐 Website
                      </a>
                    )}
                    {campaign.githubUrl && (
                      <a href={campaign.githubUrl} target="_blank" rel="noopener noreferrer" className="project-link">
                        📦 GitHub
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ProofModal
        isOpen={showProofModal}
        onClose={() => setShowProofModal(false)}
        title={selectedProof?.title || ''}
        proofContent={selectedProof?.content || ''}
      />
    </div>
  )
}
