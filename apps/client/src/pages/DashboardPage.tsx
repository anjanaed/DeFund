import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AppNavbar from '../components/layout/AppNavbar'
import { HiChartBar, HiLockClosed, HiCheckCircle, HiClock, HiXCircle, HiEye } from 'react-icons/hi2'
import ProofModal from '../components/common/ProofModal'
import MilestoneVotingStatus from '../components/common/MilestoneVotingStatus'
import TxBanner from '../components/common/TxBanner'
import LoadingScreen from '../components/common/LoadingScreen'
import { useWriteContract } from 'wagmi'
import { CAMPAIGN_FACTORY_ADDRESS, CAMPAIGN_FACTORY_ABI } from '../config/contracts'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'

interface DashboardStats { totalContributed: number; lockedFunds: number; releasedFunds: number }
interface Contribution {
  id: string; amount: string; timestamp: string; transactionHash: string; refunded: boolean
  campaign: { id: string; title: string; status: string; raisedAmount: string; goalAmount: string }
}
interface VotingMilestone {
  id: string; title: string; description: string; status: string
  onChainId: number | null; votingEndTime: string | null; proofUrl: string | null
  campaign: { id: string; title: string; paymentToken?: string }
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

  const { writeContractAsync } = useWriteContract()

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
      await writeContractAsync({
        address: CAMPAIGN_FACTORY_ADDRESS,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: 'voteOnMilestone',
        args: [BigInt(item.onChainId), approve],
      })
      setVotedIds(prev => new Set(prev).add(item.id))
    } catch (err: any) {
      setTxError(err?.shortMessage || err?.message || 'Vote failed')
    } finally {
      setVotingTx(null)
    }
  }

  const handleClaim = async (item: ReclaimItem) => {
    if (item.onChainId == null) { setTxError('Campaign is not on-chain.'); return }
    setClaimingId(item.id)
    try {
      await writeContractAsync({
        address: CAMPAIGN_FACTORY_ADDRESS,
        abi: CAMPAIGN_FACTORY_ABI,
        functionName: 'claimRefund',
        args: [BigInt(item.onChainId)],
      })
      setClaimedIds(prev => new Set(prev).add(item.id))
    } catch (err: any) {
      setTxError(err?.shortMessage || err?.message || 'Claim failed')
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
                <div className="empty-state"><p>You haven't contributed to any projects yet.</p></div>
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
                <div className="empty-state"><HiCheckCircle className="empty-icon" /><h3>No Pending Votes</h3><p>You're all caught up!</p></div>
              ) : votingRequired.map(item => (
                <div key={item.id} className="voting-card">
                  <div className="voting-card-header">
                    <div>
                      <h3 className="voting-project-title">{item.campaign.title}</h3>
                      <p className="voting-milestone-title">{item.title}</p>
                    </div>
                    {item.votingEndTime && (
                      <div className="voting-deadline">
                        <HiClock />
                        {new Date(item.votingEndTime) > new Date()
                          ? `${Math.ceil((new Date(item.votingEndTime).getTime() - Date.now()) / 86400000)}d left`
                          : 'Ended'}
                      </div>
                    )}
                  </div>
                  <p className="voting-description">{item.description}</p>
                  {item.onChainId != null && (
                    <MilestoneVotingStatus
                      milestoneOnChainId={item.onChainId}
                      paymentToken={item.campaign.paymentToken}
                    />
                  )}
                  <div className="voting-actions">
                    {item.proofUrl && (
                      <button className="btn-vote view-proof" onClick={() => { setSelectedProof({ title: item.title, content: item.proofUrl! }); setShowProofModal(true) }}>
                        <HiEye /> View Proof
                      </button>
                    )}
                    {votedIds.has(item.id) ? (
                      <span style={{ fontSize: '13px', color: 'var(--color-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <HiCheckCircle /> Vote submitted
                      </span>
                    ) : (
                      <>
                        <button className="btn-vote approve" disabled={votingTx?.id === item.id} onClick={() => handleVote(item, true)} style={{ opacity: votingTx?.id === item.id ? 0.6 : 1 }}>
                          <HiCheckCircle />{votingTx?.id === item.id && votingTx.approve ? 'Confirming...' : 'Approve'}
                        </button>
                        <button className="btn-vote reject" disabled={votingTx?.id === item.id} onClick={() => handleVote(item, false)} style={{ opacity: votingTx?.id === item.id ? 0.6 : 1 }}>
                          <HiXCircle />{votingTx?.id === item.id && !votingTx.approve ? 'Confirming...' : 'Reject'}
                        </button>
                      </>
                    )}
                    <Link to={`/project/${item.campaign.id}`} className="btn-vote details">View Project</Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div className="dashboard-transactions">
              {transactions.length === 0 ? (
                <div className="empty-state"><p>No transactions yet.</p></div>
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
                      onClick={() => handleClaim(item)}
                    >
                      {claimingId === item.id ? 'Confirming...' : `Reclaim ${fmt(item.totalContributed)}`}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <ProofModal isOpen={showProofModal} onClose={() => setShowProofModal(false)} title={selectedProof?.title || ''} proofContent={selectedProof?.content || ''} />
      </div>
    </div>
  )
}
