import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import AppNavbar from '../components/layout/AppNavbar'
import { HiChartBar, HiLockClosed, HiCheckCircle, HiClock, HiXCircle, HiEye, HiRocketLaunch, HiBolt, HiScale } from 'react-icons/hi2'
import ProofModal from '../components/common/ProofModal'
import ConfirmModal from '../components/common/ConfirmModal'
import MilestoneVotingStatus from '../components/common/MilestoneVotingStatus'
import TxBanner from '../components/common/TxBanner'
import LoadingScreen from '../components/common/LoadingScreen'
import { useSimulatedWrite } from '../hooks/useSimulatedWrite'
import { CAMPAIGN_FACTORY_ADDRESS, CAMPAIGN_FACTORY_ABI } from '../config/contracts'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'
import { parseContractError } from '../lib/errors'

interface DashboardStats { totalContributed: number; lockedFunds: number; releasedFunds: number }
interface Contribution {
  id: string; amount: string; timestamp: string; transactionHash: string; refunded: boolean
  campaign: { id: string; title: string; status: string; raisedAmount: string; goalAmount: string }
}
interface VotingMilestone {
  id: string; title: string; description: string; status: string
  onChainId: number | null; votingEndTime: string | null; proofUrl: string | null
  campaign: { id: string; title: string; paymentToken?: string; raisedAmount?: string }
}
interface Transaction {
  id: string; type: string; amount: number; timestamp: string
  transactionHash: string | null; refunded: boolean
  campaign: { id: string; title: string }
}
interface ReclaimItem {
  id: string; title: string; status: string; raisedAmount: string
  totalContributed: number; onChainId: number | null
}

const fmt = (n: number) => `$${Number(n).toLocaleString()}`

export default function DashboardPage() {
  const { isAuthenticated } = useAuth()
  const [activeTab, setActiveTab] = useState('portfolio')
  const [showProofModal, setShowProofModal] = useState(false)
  const [selectedProof, setSelectedProof] = useState<{ title: string; content: string } | null>(null)

  const [dashStats, setDashStats] = useState<DashboardStats | null>(null)
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [votingRequired, setVotingRequired] = useState<VotingMilestone[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [reclaimable, setReclaimable] = useState<ReclaimItem[]>([])
  const [loading, setLoading] = useState(true)

  const [votingTx, setVotingTx] = useState<{ id: string; approve: boolean } | null>(null)
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set())
  const [txError, setTxError] = useState<string | null>(null)
  const [claimConfirmItem, setClaimConfirmItem] = useState<ReclaimItem | null>(null)

  const { writeWithSimulate } = useSimulatedWrite()

  useEffect(() => {
    if (!isAuthenticated) return
    setLoading(true)
    Promise.all([
      apiFetch('/user/dashboard').then(r => r.ok ? r.json() : null),
      apiFetch('/user/contributions').then(r => r.ok ? r.json() : null),
      apiFetch('/user/voting-required').then(r => r.ok ? r.json() : null),
      apiFetch('/user/transactions').then(r => r.ok ? r.json() : null),
      apiFetch('/user/reclaimable').then(r => r.ok ? r.json() : null),
    ]).then(([stats, contribs, voting, txs, reclaim]) => {
      if (stats) setDashStats(stats)
      if (contribs) setContributions(contribs)
      if (voting) setVotingRequired(voting)
      if (txs) setTransactions(txs)
      if (reclaim) setReclaimable(reclaim)
      setLoading(false)
    })
  }, [isAuthenticated])

  // Group contributions by campaign for portfolio tab
  const portfolio = Object.values(
    contributions.reduce<Record<string, { id: string; title: string; status: string; raisedAmount: number; goalAmount: number; totalContributed: number }>>(
      (acc, c) => {
        const key = c.campaign.id
        if (!acc[key]) acc[key] = { ...c.campaign, raisedAmount: Number(c.campaign.raisedAmount), goalAmount: Number(c.campaign.goalAmount), totalContributed: 0 }
        acc[key].totalContributed += Number(c.amount)
        return acc
      }, {}
    )
  )

  const handleVote = async (item: VotingMilestone, approve: boolean) => {
    if (item.onChainId == null) { setTxError('This milestone is not yet deployed on-chain.'); return }
    setVotingTx({ id: item.id, approve })
    try {
      await writeWithSimulate({
        address: CAMPAIGN_FACTORY_ADDRESS,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: 'voteOnMilestone',
        args: [BigInt(item.onChainId), approve],
      })
      setVotedIds(prev => new Set(prev).add(item.id))
      toast.success(approve ? 'Voted to approve!' : 'Voted to reject!')
    } catch (err) {
      const errMsg = parseContractError(err)
      setTxError(errMsg)
      toast.error(errMsg)
    } finally {
      setVotingTx(null)
    }
  }

  const handleClaimRequest = (item: ReclaimItem) => {
    if (item.onChainId == null) { setTxError('Campaign is not on-chain.'); return }
    setClaimConfirmItem(item)
  }

  const handleClaimExecute = async (item: ReclaimItem) => {
    setClaimingId(item.id)
    try {
      await writeWithSimulate({
        address: CAMPAIGN_FACTORY_ADDRESS,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: 'claimRefund',
        args: [BigInt(item.onChainId!)],
      })
      setClaimedIds(prev => new Set(prev).add(item.id))
      toast.success('Refund claimed!', { description: '95% of your contribution has been returned.' })
    } catch (err) {
      const errMsg = parseContractError(err)
      setTxError(errMsg)
      toast.error(errMsg)
    } finally {
      setClaimingId(null)
    }
  }

  const tabs = [
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'voting', label: 'Voting Required', badge: votingRequired.length },
    { id: 'transactions', label: 'Transactions' },
    { id: 'reclaim', label: 'Reclaim Funds', badge: reclaimable.length },
  ]

  const statCards = dashStats
    ? [
        { label: 'Total Contributed', value: fmt(dashStats.totalContributed), subtitle: `Across ${portfolio.length} projects`, icon: HiChartBar },
        { label: 'Locked Funds', value: fmt(dashStats.lockedFunds), subtitle: 'In smart contracts', icon: HiLockClosed },
        { label: 'Released Funds', value: fmt(dashStats.releasedFunds), subtitle: 'To approved milestones', icon: HiCheckCircle },
      ]
    : []

  if (loading) return (
    <div className="app-container"><AppNavbar />
      <LoadingScreen message="Loading your dashboard" />
    </div>
  )

  return (
    <div className="app-container">
      <AppNavbar />
      {txError && <TxBanner message={txError} onClose={() => setTxError(null)} />}
      <div className="dashboard-page">
        <div className="container">
          {/* Stats Grid */}
          <div className="dashboard-stats-grid">
            {statCards.map((stat, i) => {
              const Icon = stat.icon
              return (
                <div key={i} className="dashboard-stat-card">
                  <div className="dashboard-stat-header"><span className="dashboard-stat-label">{stat.label}</span></div>
                  <div className="dashboard-stat-value">{stat.value}</div>
                  <div className="dashboard-stat-subtitle"><Icon className="dashboard-stat-icon" />{stat.subtitle}</div>
                </div>
              )
            })}
          </div>

          {/* Tabs */}
          <div className="dashboard-tabs">
            {tabs.map(tab => (
              <button key={tab.id} className={`dashboard-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
                {tab.badge != null && tab.badge > 0 && <span className="tab-badge">{tab.badge}</span>}
              </button>
            ))}
          </div>

          {/* Portfolio Tab */}
          {activeTab === 'portfolio' && (
            <div className="dashboard-portfolio">
              {portfolio.length === 0 ? (
                /* U7 — helpful empty state */
                <div className="empty-state">
                  <HiRocketLaunch className="empty-icon" style={{ fontSize: '2.5rem', color: 'var(--color-primary)' }} />
                  <h3>No projects yet</h3>
                  <p>Support a campaign to see your portfolio here.</p>
                  <Link to="/explore" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
                    Discover Projects
                  </Link>
                </div>
              ) : portfolio.map((project) => (
                <Link key={project.id} to={`/project/${project.id}`} className="dashboard-project-card clickable-card">
                  <div className="dashboard-project-header">
                    <div className="dashboard-project-badges">
                      <span className={`dashboard-status-badge ${project.status.toLowerCase()}`}>{project.status}</span>
                    </div>
                    <div className="dashboard-contribution-amount">
                      <div className="dashboard-contribution-value">{fmt(project.totalContributed)}</div>
                      <div className="dashboard-contribution-label">Your contribution</div>
                    </div>
                  </div>
                  <h3 className="dashboard-project-title">{project.title}</h3>
                  <div className="dashboard-project-progress">
                    <div className="dashboard-progress-header">
                      <span className="dashboard-progress-amount">{fmt(project.raisedAmount)} raised</span>
                      <span className="dashboard-progress-goal">of {fmt(project.goalAmount)}</span>
                    </div>
                    <div className="dashboard-progress-bar">
                      <div className="dashboard-progress-fill"
                        style={{ width: `${Math.min(project.goalAmount > 0 ? (project.raisedAmount / project.goalAmount) * 100 : 0, 100)}%` }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Voting Required Tab */}
          {activeTab === 'voting' && (
            <div className="dashboard-voting">
              {votingRequired.length === 0 ? (
                /* U7 — helpful empty state */
                <div className="empty-state">
                  <HiBolt className="empty-icon" style={{ fontSize: '2.5rem', color: 'var(--color-primary)' }} />
                  <h3>No Pending Votes</h3>
                  <p>You're all caught up! Your votes will appear here when a milestone you contributed to enters the voting phase.</p>
                </div>
              ) : votingRequired.map(item => {
                const myContrib = contributions
                  .filter(c => c.campaign.id === item.campaign.id)
                  .reduce((sum, c) => sum + Number(c.amount), 0)
                const totalRaised = Number(item.campaign.raisedAmount ?? 0)
                const votingPower = totalRaised > 0 ? ((myContrib / totalRaised) * 100).toFixed(2) : null
                const isBusy = votingTx?.id === item.id
                const voted = votedIds.has(item.id)

                return (
                <div key={item.id} style={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 12,
                  padding: '20px 24px',
                  marginBottom: 16,
                }}>
                  {/* Top row — campaign + power badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-tertiary)' }}>
                      {item.campaign.title}
                    </span>
                    {votingPower !== null && (
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: 'var(--color-primary)',
                        background: 'rgba(99,102,241,0.08)',
                        border: '1px solid rgba(99,102,241,0.2)',
                        borderRadius: 20, padding: '2px 10px',
                        whiteSpace: 'nowrap',
                      }}>
                        <HiScale style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                        {votingPower}% vote weight
                      </span>
                    )}
                  </div>

                  {/* Milestone title */}
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 8px' }}>
                    {item.title}
                  </h3>

                  {/* Description */}
                  <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: '0 0 4px', lineHeight: 1.6 }}>
                    {item.description}
                  </p>

                  {/* Live voting status */}
                  {item.onChainId != null && (
                    <MilestoneVotingStatus
                      milestoneOnChainId={item.onChainId}
                      paymentToken={item.campaign.paymentToken}
                    />
                  )}

                  {/* Action row */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    {item.proofUrl && (
                      <button
                        onClick={() => { setSelectedProof({ title: item.title, content: item.proofUrl! }); setShowProofModal(true) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '8px 14px', fontSize: 13, fontWeight: 600,
                          background: 'transparent', border: '1px solid var(--color-border)',
                          borderRadius: 8, cursor: 'pointer', color: 'var(--color-text-secondary)',
                        }}
                      >
                        <HiEye size={15} /> View Proof
                      </button>
                    )}

                    {voted ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--color-success)', marginLeft: 4 }}>
                        <HiCheckCircle size={16} /> Vote recorded
                      </span>
                    ) : (
                      <>
                        <button
                          disabled={isBusy}
                          onClick={() => handleVote(item, true)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 18px', fontSize: 13, fontWeight: 700,
                            background: isBusy ? 'var(--color-bg-subtle)' : '#16a34a',
                            color: isBusy ? 'var(--color-text-secondary)' : '#fff',
                            border: 'none', borderRadius: 8, cursor: isBusy ? 'not-allowed' : 'pointer',
                            opacity: isBusy ? 0.6 : 1, transition: 'opacity 0.15s',
                          }}
                        >
                          <HiCheckCircle size={15} />
                          {isBusy && votingTx?.approve ? 'Confirming…' : 'Approve'}
                        </button>
                        <button
                          disabled={isBusy}
                          onClick={() => handleVote(item, false)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 18px', fontSize: 13, fontWeight: 700,
                            background: 'transparent',
                            color: isBusy ? 'var(--color-text-secondary)' : 'var(--color-error)',
                            border: `1px solid ${isBusy ? 'var(--color-border)' : 'var(--color-error)'}`,
                            borderRadius: 8, cursor: isBusy ? 'not-allowed' : 'pointer',
                            opacity: isBusy ? 0.6 : 1, transition: 'opacity 0.15s',
                          }}
                        >
                          <HiXCircle size={15} />
                          {isBusy && !votingTx?.approve ? 'Confirming…' : 'Reject'}
                        </button>
                      </>
                    )}

                    <Link
                      to={`/project/${item.campaign.id}`}
                      style={{
                        marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
                        fontSize: 13, fontWeight: 600, color: 'var(--color-primary)',
                        textDecoration: 'none',
                      }}
                    >
                      View Project →
                    </Link>
                  </div>
                </div>
              )})}
            </div>
          )}

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div className="dashboard-transactions">
              {transactions.length === 0 ? (
                /* U7 — helpful empty state */
                <div className="empty-state">
                  <HiChartBar className="empty-icon" style={{ fontSize: '2.5rem', color: 'var(--color-primary)' }} />
                  <h3>No transactions yet</h3>
                  <p>Your contributions will appear here once you support a campaign.</p>
                  <Link to="/explore" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
                    Browse Campaigns
                  </Link>
                </div>
              ) : (
                <div className="transactions-table">
                  <div className="table-header">
                    <div className="table-col">Type</div>
                    <div className="table-col">Project</div>
                    <div className="table-col">Amount</div>
                    <div className="table-col">Date</div>
                    <div className="table-col">Tx Hash</div>
                  </div>
                  {transactions.map(tx => (
                    <div key={tx.id} className="table-row">
                      <div className="table-col"><span className={`tx-type ${tx.type.toLowerCase()}`}>{tx.type}</span></div>
                      <div className="table-col">{tx.campaign.title}</div>
                      <div className="table-col tx-amount">{fmt(tx.amount)}</div>
                      <div className="table-col">{new Date(tx.timestamp).toLocaleDateString()}</div>
                      <div className="table-col tx-hash">
                        {tx.transactionHash
                          ? <a href={`https://sepolia.etherscan.io/tx/${tx.transactionHash}`} target="_blank" rel="noopener noreferrer">{tx.transactionHash.slice(0, 10)}...</a>
                          : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reclaim Funds Tab */}
          {activeTab === 'reclaim' && (
            <div className="dashboard-reclaim">
              {reclaimable.length === 0 ? (
                <div className="empty-state"><HiCheckCircle className="empty-icon" /><h3>No Funds to Reclaim</h3><p>All your contributions are in active projects.</p></div>
              ) : reclaimable.map(item => (
                <div key={item.id} className="reclaim-card">
                  <div className="reclaim-header">
                    <div>
                      <span className={`dashboard-status-badge ${item.status.toLowerCase()}`}>{item.status}</span>
                      <h3 className="reclaim-title">{item.title}</h3>
                    </div>
                    <div className="reclaim-amount-box">
                      <div className="reclaim-amount">{fmt(item.totalContributed)}</div>
                      <div className="reclaim-label">Available to reclaim</div>
                    </div>
                  </div>
                  {claimedIds.has(item.id) ? (
                    <span style={{ color: 'var(--color-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <HiCheckCircle /> Refund claimed
                    </span>
                  ) : (
                    <button
                      className="btn btn-primary reclaim-btn"
                      disabled={claimingId === item.id}
                      onClick={() => handleClaimRequest(item)}
                    >
                      {claimingId === item.id ? 'Confirming...' : `Reclaim ${fmt(item.totalContributed)}`}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <ConfirmModal
          isOpen={claimConfirmItem !== null}
          onClose={() => setClaimConfirmItem(null)}
          onConfirm={() => {
            const item = claimConfirmItem!
            setClaimConfirmItem(null)
            handleClaimExecute(item)
          }}
          title="Confirm Refund Claim"
          message={`You will receive approximately $${claimConfirmItem ? (claimConfirmItem.totalContributed * 0.95).toFixed(4) : ''} — 95% of your contribution. This action is irreversible.`}
          confirmLabel="Claim Refund"
          variant="warning"
        />
        <ProofModal isOpen={showProofModal} onClose={() => setShowProofModal(false)} title={selectedProof?.title || ''} proofContent={selectedProof?.content || ''} />
      </div>
    </div>
  )
}
