import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppNavbar from '../components/layout/AppNavbar'
import { HiChartBar, HiLockClosed, HiCheckCircle, HiTrophy, HiClock, HiXCircle, HiEye } from 'react-icons/hi2'
import ProofModal from '../components/common/ProofModal'

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('portfolio')
  const [showProofModal, setShowProofModal] = useState(false)
  const [selectedProof, setSelectedProof] = useState<{title: string, content: string} | null>(null)

  const stats = [
    {
      label: 'Total Contributed',
      value: '$15,000',
      subtitle: 'Across 4 projects',
      icon: HiChartBar
    },
    {
      label: 'Locked Funds',
      value: '$12,000',
      subtitle: 'In smart contracts',
      icon: HiLockClosed
    },
    {
      label: 'Released Funds',
      value: '$3,000',
      subtitle: 'To approved milestones',
      icon: HiCheckCircle
    },
    {
      label: 'Contributor Rank',
      value: '#42',
      subtitle: 'Global leaderboard',
      icon: HiTrophy
    }
  ]

  const portfolio = [
    {
      id: 1,
      category: 'DeFi',
      status: 'Active',
      title: 'DeFi Lending Protocol',
      description: 'A decentralized lending platform that allows users to lend and borrow cryptocurrencies with minimal fees and maximum security.',
      raised: 75000,
      goal: 100000,
      contribution: 5000,
      milestones: { completed: 1, total: 3 },
      fundStatus: 'Locked'
    },
    {
      id: 2,
      category: 'DAO',
      status: 'Completed',
      title: 'Community DAO Governance',
      description: 'Building a transparent and efficient DAO governance system for community-driven decision making.',
      raised: 52000,
      goal: 50000,
      contribution: 3000,
      milestones: { completed: 2, total: 2 },
      fundStatus: 'Released'
    },
    {
      id: 3,
      category: 'NFT',
      status: 'Active',
      title: 'NFT Marketplace Platform',
      description: 'A next-generation NFT marketplace with advanced features for creators and collectors.',
      raised: 35000,
      goal: 80000,
      contribution: 2000,
      milestones: { completed: 0, total: 3 },
      fundStatus: 'Locked'
    },
    {
      id: 4,
      category: 'Open Source',
      status: 'Active',
      title: 'Open Source Analytics Tools',
      description: 'Privacy-focused analytics platform for Web3 applications.',
      raised: 28000,
      goal: 30000,
      contribution: 5000,
      milestones: { completed: 1, total: 2 },
      fundStatus: 'Locked'
    }
  ]

  const votingRequired = [
    {
      id: 1,
      category: 'DeFi',
      title: 'DeFi Lending Protocol',
      milestone: 'Milestone 2: Frontend Development',
      description: 'Vote to approve the completion of the frontend development milestone',
      contribution: 5000,
      deadline: '2 days left',
      votes: { for: 89, against: 12 },
      proof: 'The frontend development milestone has been completed. We have implemented the complete user interface including the dashboard, lending pool interaction forms, and wallet connection. All components are responsive and have been tested on multiple devices. You can view the live demo at https://demo.defilending.io and the codebase at the attached Github link.'
    },
    {
      id: 4,
      category: 'Open Source',
      title: 'Open Source Analytics Tools',
      milestone: 'Milestone 2: Dashboard Implementation',
      description: 'Review and vote on the analytics dashboard completion',
      contribution: 5000,
      deadline: '5 days left',
      votes: { for: 34, against: 3 },
      proof: 'The analytics dashboard is now fully functional. It includes real-time data visualization, custom chart generation, and data export capabilities. We have also integrated 3rd party data sources. Please verify the performance and accuracy of the data.'
    }
  ]

  const transactions = [
    {
      id: 1,
      type: 'Contribution',
      project: 'DeFi Lending Protocol',
      amount: '$5,000',
      date: '2026-01-15',
      status: 'Completed',
      txHash: '0x7a8b9c...'
    },
    {
      id: 2,
      type: 'Refund',
      project: 'Failed Gaming Project',
      amount: '$2,500',
      date: '2026-01-10',
      status: 'Completed',
      txHash: '0x4d5e6f...'
    },
    {
      id: 3,
      type: 'Contribution',
      project: 'NFT Marketplace Platform',
      amount: '$2,000',
      date: '2026-01-08',
      status: 'Completed',
      txHash: '0x1a2b3c...'
    },
    {
      id: 4,
      type: 'Contribution',
      project: 'Open Source Analytics Tools',
      amount: '$5,000',
      date: '2026-01-05',
      status: 'Completed',
      txHash: '0x9d8e7f...'
    }
  ]

  const reclaimFunds = [
    {
      id: 5,
      category: 'Gaming',
      title: 'Abandoned Gaming Project',
      description: 'Project creator has been inactive for 60+ days. Milestone 1 was rejected by community.',
      contribution: 1500,
      reclaimable: 1500,
      reason: 'Milestone Rejected',
      status: 'Available'
    }
  ]

  const tabs = [
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'voting', label: 'Voting Required', badge: votingRequired.length },
    { id: 'transactions', label: 'Transactions' },
    { id: 'reclaim', label: 'Reclaim Funds', badge: reclaimFunds.length }
  ]

  return (
    <div className="app-container">
      <AppNavbar />
      
      <div className="dashboard-page">
        <div className="container">
          {/* Stats Grid */}
          <div className="dashboard-stats-grid">
            {stats.map((stat, index) => {
              const Icon = stat.icon
              return (
                <div key={index} className="dashboard-stat-card">
                  <div className="dashboard-stat-header">
                    <span className="dashboard-stat-label">{stat.label}</span>
                  </div>
                  <div className="dashboard-stat-value">{stat.value}</div>
                  <div className="dashboard-stat-subtitle">
                    <Icon className="dashboard-stat-icon" />
                    {stat.subtitle}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Tabs */}
          <div className="dashboard-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`dashboard-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {tab.badge && tab.badge > 0 && (
                  <span className="tab-badge">{tab.badge}</span>
                )}
              </button>
            ))}
          </div>

          {/* Portfolio Tab */}
          {activeTab === 'portfolio' && (
            <div className="dashboard-portfolio">
              {portfolio.map((project) => (
                <Link 
                  key={project.id} 
                  to={`/project/${project.id}`}
                  className="dashboard-project-card clickable-card"
                >
                  <div className="dashboard-project-header">
                    <div className="dashboard-project-badges">
                      <span className="dashboard-category-badge">{project.category}</span>
                      <span className={`dashboard-status-badge ${project.status.toLowerCase()}`}>
                        {project.status}
                      </span>
                    </div>
                    <div className="dashboard-contribution-amount">
                      <div className="dashboard-contribution-value">${project.contribution.toLocaleString()}</div>
                      <div className="dashboard-contribution-label">Your contribution</div>
                    </div>
                  </div>

                  <h3 className="dashboard-project-title">{project.title}</h3>
                  <p className="dashboard-project-description">{project.description}</p>

                  <div className="dashboard-project-progress">
                    <div className="dashboard-progress-header">
                      <span className="dashboard-progress-amount">${project.raised.toLocaleString()} raised</span>
                      <span className="dashboard-progress-goal">of ${project.goal.toLocaleString()}</span>
                    </div>
                    <div className="dashboard-progress-bar">
                      <div 
                        className="dashboard-progress-fill" 
                        style={{ width: `${Math.min((project.raised / project.goal) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="dashboard-project-footer">
                    <div className="dashboard-milestone-info">
                      {project.milestones.completed} / {project.milestones.total} milestones completed
                    </div>
                    <div className={`dashboard-fund-status ${project.fundStatus.toLowerCase()}`}>
                      {project.fundStatus}
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
                <div className="empty-state">
                  <HiCheckCircle className="empty-icon" />
                  <h3>No Pending Votes</h3>
                  <p>You're all caught up! Check back later for new milestones to review.</p>
                </div>
              ) : (
                votingRequired.map((item) => (
                  <div key={item.id} className="voting-card">
                    <div className="voting-card-header">
                      <div>
                        <span className="voting-category-badge">{item.category}</span>
                        <h3 className="voting-project-title">{item.title}</h3>
                        <p className="voting-milestone-title">{item.milestone}</p>
                      </div>
                      <div className="voting-deadline">
                        <HiClock />
                        {item.deadline}
                      </div>
                    </div>

                    <p className="voting-description">{item.description}</p>

                    <div className="voting-stats">
                      <div className="voting-contribution">
                        Your stake: <strong>${item.contribution.toLocaleString()}</strong>
                      </div>
                      <div className="voting-current">
                        <span className="vote-for">{item.votes.for} For</span>
                        <span className="vote-against">{item.votes.against} Against</span>
                      </div>
                    </div>

                    <div className="voting-actions">
                      <button 
                        className="btn-vote view-proof"
                        onClick={() => {
                          setSelectedProof({
                            title: `${item.title} - ${item.milestone}`,
                            content: item.proof
                          })
                          setShowProofModal(true)
                        }}
                      >
                        <HiEye /> View Proof
                      </button>
                      <button className="btn-vote approve">
                        <HiCheckCircle /> Approve
                      </button>
                      <button className="btn-vote reject">
                        <HiXCircle /> Reject
                      </button>
                      <Link to={`/project/${item.id}`} className="btn-vote details">
                        View Details
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div className="dashboard-transactions">
              <div className="transactions-table">
                <div className="table-header">
                  <div className="table-col">Type</div>
                  <div className="table-col">Project</div>
                  <div className="table-col">Amount</div>
                  <div className="table-col">Date</div>
                  <div className="table-col">Status</div>
                  <div className="table-col">Tx Hash</div>
                </div>
                {transactions.map((tx) => (
                  <div key={tx.id} className="table-row">
                    <div className="table-col">
                      <span className={`tx-type ${tx.type.toLowerCase()}`}>{tx.type}</span>
                    </div>
                    <div className="table-col">{tx.project}</div>
                    <div className="table-col tx-amount">{tx.amount}</div>
                    <div className="table-col">{tx.date}</div>
                    <div className="table-col">
                      <span className="tx-status completed">{tx.status}</span>
                    </div>
                    <div className="table-col tx-hash">
                      <a href="#" target="_blank" rel="noopener noreferrer">{tx.txHash}</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reclaim Funds Tab */}
          {activeTab === 'reclaim' && (
            <div className="dashboard-reclaim">
              {reclaimFunds.length === 0 ? (
                <div className="empty-state">
                  <HiCheckCircle className="empty-icon" />
                  <h3>No Funds to Reclaim</h3>
                  <p>All your contributions are in active projects with approved milestones.</p>
                </div>
              ) : (
                reclaimFunds.map((item) => (
                  <div key={item.id} className="reclaim-card">
                    <div className="reclaim-header">
                      <div>
                        <span className="reclaim-category-badge">{item.category}</span>
                        <h3 className="reclaim-title">{item.title}</h3>
                      </div>
                      <div className="reclaim-amount-box">
                        <div className="reclaim-amount">${item.reclaimable.toLocaleString()}</div>
                        <div className="reclaim-label">Available to reclaim</div>
                      </div>
                    </div>

                    <p className="reclaim-description">{item.description}</p>

                    <div className="reclaim-details">
                      <div className="reclaim-detail-item">
                        <span className="detail-label">Your Contribution:</span>
                        <span className="detail-value">${item.contribution.toLocaleString()}</span>
                      </div>
                      <div className="reclaim-detail-item">
                        <span className="detail-label">Reason:</span>
                        <span className="detail-value reason">{item.reason}</span>
                      </div>
                      <div className="reclaim-detail-item">
                        <span className="detail-label">Status:</span>
                        <span className="detail-value status-available">{item.status}</span>
                      </div>
                    </div>

                    <button className="btn btn-primary reclaim-btn">
                      Reclaim ${item.reclaimable.toLocaleString()}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        
        <ProofModal 
          isOpen={showProofModal}
          onClose={() => setShowProofModal(false)}
          title={selectedProof?.title || ''}
          proofContent={selectedProof?.content || ''}
        />
      </div>
    </div>
  )
}
