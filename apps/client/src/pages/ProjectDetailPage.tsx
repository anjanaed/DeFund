import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppNavbar from '../components/layout/AppNavbar'
import { 
  HiCheckCircle, 
  HiUsers, 
  HiChartBar, 
  HiClock,
  HiShieldCheck,
  HiArrowLeft,
  HiGlobeAlt,
  HiCodeBracket,
  HiEye,
  HiChatBubbleLeft,
  HiHeart
} from 'react-icons/hi2'
import { FaGithub } from 'react-icons/fa6'
import ProofModal from '../components/common/ProofModal'

export default function ProjectDetailPage() {
  const { id } = useParams()
  const [contributionAmount, setContributionAmount] = useState('')
  const [showProofModal, setShowProofModal] = useState(false)
  const [selectedProof, setSelectedProof] = useState<{title: string, content: string} | null>(null)


  const project = {
    id: 1,
    category: 'DeFi',
    verified: true,
    active: true,
    title: 'DeFi Lending Protocol',
    tagline: 'Decentralized lending platform with minimal fees and maximum security',
    description: `A comprehensive decentralized lending platform that allows users to lend and borrow cryptocurrencies with minimal fees and maximum security. Our protocol leverages cutting-edge smart contract technology to ensure transparency, security, and efficiency.

Key Features:
• Collateralized lending with dynamic interest rates
• Multi-asset support including major cryptocurrencies
• Automated liquidation protection
• Governance token for protocol decisions
• Audited smart contracts by leading security firms

Our mission is to democratize access to financial services by providing a trustless, permissionless lending platform that anyone can use. We believe in transparency, which is why all our code is open-source and our smart contracts are fully audited.`,
    raised: 75000,
    goal: 100000,
    contributors: 156,
    creator: {
      name: 'Max Verstappen',
      address: '0x742d...00Eb',
      avatar: 'AC'
    },
    github: 'https://github.com/username/defi-lending',
    website: 'https://defilending.io',
    milestones: [
      {
        number: 1,
        status: 'Approved',
        title: 'Smart Contract Development',
        description: 'Complete core smart contract architecture and security audits. This includes developing the lending pool contracts, interest rate models, and collateral management system.',
        amount: 30000,
        required: 30000,
        deliverables: [
          'Core lending pool smart contracts',
          'Interest rate calculation module',
          'Collateral management system',
          'Initial security audit report'
        ],
        completed: true,
        votes: { for: 142, against: 8 },
        proof: 'Smart contracts have been deployed to the testnet and verified. The security audit was conducted by CertiK and the report is attached. You can verify the contract addresses on Etherscan: 0x123...abc'
      },
      {
        number: 2,
        status: 'Active',
        title: 'Frontend Development',
        description: 'Build user interface and integrate with smart contracts. Create an intuitive dashboard for users to manage their lending and borrowing positions.',
        amount: 25000,
        required: 25000,
        deliverables: [
          'Responsive web application',
          'Wallet integration (MetaMask, WalletConnect)',
          'Real-time position tracking',
          'Transaction history and analytics'
        ],
        completed: false,
        votes: null
      },
      {
        number: 3,
        status: 'Pending',
        title: 'Security Audit & Launch',
        description: 'Complete third-party security audit and mainnet deployment. Final testing and preparation for public launch.',
        amount: 45000,
        required: 45000,
        deliverables: [
          'Comprehensive security audit by CertiK',
          'Bug bounty program',
          'Mainnet deployment',
          'Marketing and launch campaign'
        ],
        completed: false,
        votes: null
      }
    ],
    updates: [
      {
        date: '2026-01-15',
        title: 'Milestone 1 Completed!',
        content: 'We are excited to announce that our smart contracts have been fully developed and audited. The audit report is now available on our GitHub.'
      },
      {
        content: 'Our team has been working hard on the core smart contracts. We expect to complete the security audit by end of this week.'
      }
    ],
    forum: [
      {
        id: 1,
        author: 'DeFiUser123',
        avatar: 'D',
        date: '2 hours ago',
        title: 'Question about milestone 1 deliverables',
        content: 'Can you clarify if the audit report includes the staking contract? I checked the Github repo but couldnt find the specific file.',
        replies: 4,
        likes: 12
      },
      {
        id: 2,
        author: 'CryptoWhale',
        avatar: 'C',
        date: '1 day ago',
        title: 'Great progress on the frontend!',
        content: 'The new dashboard looks amazing. Love the dark mode support. Will you be adding mobile support soon?',
        replies: 2,
        likes: 8
      },
      {
        id: 3,
        author: 'SecureDev',
        avatar: 'S',
        date: '2 days ago',
        title: 'Security concern on lending pool',
        content: 'I noticed a potential reentrancy issue in the lending pool contract. Has this been addressed in the latest audit?',
        replies: 7,
        likes: 24
      }
    ]
  }

  const handleContribute = () => {
    console.log('Contributing:', contributionAmount)
  }

  const progress = (project.raised / project.goal) * 100

  return (
    <div className="app-container">
      <AppNavbar />
      
      <div className="project-detail-page">
        <div className="container">
          {/* Back Button */}
          <Link to="/explore" className="project-back-link">
            <HiArrowLeft /> Back to Projects
          </Link>

          <div className="project-detail-grid">
            {/* Main Content */}
            <div className="project-main-content">
              {/* Header */}
              <div className="project-detail-header">
                <div className="project-detail-badges">
                  <span className="project-detail-category-badge">{project.category}</span>
                  {project.active && (
                    <span className="project-detail-active-badge">Active</span>
                  )}
                </div>
                
                <h1 className="project-detail-title">{project.title}</h1>
                <p className="project-detail-tagline">{project.tagline}</p>

                {/* Links */}
                <div className="project-detail-links">
                  <a href={project.github} target="_blank" rel="noopener noreferrer" className="project-link">
                    <FaGithub /> GitHub
                  </a>
                  <a href={project.website} target="_blank" rel="noopener noreferrer" className="project-link">
                    <HiGlobeAlt /> Website
                  </a>
                </div>
              </div>

              {/* Description */}
              <div className="project-detail-section">
                <h2 className="project-section-title">About This Project</h2>
                <div className="project-description-content">
                  {project.description.split('\n').map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </div>

              {/* Milestones */}
              <div className="project-detail-section">
                <h2 className="project-section-title">Milestones</h2>
                <div className="project-milestones-list">
                  {project.milestones.map((milestone) => (
                    <div key={milestone.number} className={`project-milestone-card ${milestone.status.toLowerCase()}`}>
                      <div className="project-milestone-header">
                        <div className="project-milestone-number-wrapper">
                          <div className="project-milestone-number">
                            {milestone.completed ? <HiCheckCircle /> : milestone.number}
                          </div>
                          <div>
                            <div className="project-milestone-title-row">
                              <h3 className="project-milestone-title">{milestone.title}</h3>
                              <span className={`project-milestone-status-badge ${milestone.status.toLowerCase()}`}>
                                {milestone.status}
                              </span>
                            </div>
                            <p className="project-milestone-description">{milestone.description}</p>
                          </div>
                        </div>
                        <div className="project-milestone-amount">
                          ${milestone.amount.toLocaleString()}
                        </div>
                      </div>

                      {/* Proof Button for Completed Milestones */}
                      {(milestone.completed || milestone.proof) && (
                        <div style={{ marginBottom: '1rem' }}>
                          <button
                            className="creator-view-project-btn"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
                            onClick={() => {
                              setSelectedProof({
                                title: `${milestone.title}`,
                                content: milestone.proof || 'No proof content available.'
                              })
                              setShowProofModal(true)
                            }}
                          >
                            <HiEye /> View Submitted Proof
                          </button>
                        </div>
                      )}

                      {/* Deliverables */}
                      <div className="project-milestone-deliverables">
                        <h4 className="deliverables-title">Deliverables:</h4>
                        <ul className="deliverables-list">
                          {milestone.deliverables.map((item, index) => (
                            <li key={index}>
                              <HiCheckCircle className={milestone.completed ? 'completed' : ''} />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Voting Results */}
                      {milestone.votes && (
                        <div className="project-milestone-votes">
                          <div className="vote-bar">
                            <div 
                              className="vote-bar-for" 
                              style={{ width: `${(milestone.votes.for / (milestone.votes.for + milestone.votes.against)) * 100}%` }}
                            />
                          </div>
                          <div className="vote-stats">
                            <span className="vote-for">{milestone.votes.for} For</span>
                            <span className="vote-against">{milestone.votes.against} Against</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Updates */}
              <div className="project-detail-section">
                <h2 className="project-section-title">Project Updates</h2>
                <div className="project-updates-list">
                  {project.updates.map((update, index) => (
                    <div key={index} className="project-update-card">
                      <div className="project-update-date">{update.date}</div>
                      <h3 className="project-update-title">{update.title}</h3>
                      <p className="project-update-content">{update.content}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Forum */}
              <div className="project-detail-section">
                <div className="forum-header">
                  <h2 className="project-section-title">Community Forum</h2>
                  <button className="forum-new-btn">New Discussion</button>
                </div>
                <div className="forum-threads-list">
                  {project.forum.map((thread) => (
                    <div key={thread.id} className="forum-thread-card">
                      <div className="forum-thread-header">
                        <div className="forum-author">
                          <div className="forum-avatar">{thread.avatar}</div>
                          <span className="forum-author-name">{thread.author}</span>
                        </div>
                        <span className="forum-date">{thread.date}</span>
                      </div>
                      <h3 className="forum-thread-title">{thread.title}</h3>
                      <p className="forum-thread-excerpt">{thread.content}</p>
                      <div className="forum-thread-footer">
                        <div className="forum-stat">
                          <HiChatBubbleLeft /> {thread.replies} Replies
                        </div>
                        <div className="forum-stat">
                          <HiHeart /> {thread.likes} Likes
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="project-sidebar">
              {/* Contribution Card */}
              <div className="project-contribution-card">
                <div className="contribution-stats">
                  <div className="contribution-stat-main">
                    <div className="contribution-amount">${project.raised.toLocaleString()}</div>
                    <div className="contribution-label">raised of ${project.goal.toLocaleString()}</div>
                  </div>
                  
                  <div className="contribution-progress-bar">
                    <div className="contribution-progress-fill" style={{ width: `${progress}%` }} />
                  </div>

                  <div className="contribution-stats-grid">
                    <div className="contribution-stat-item">
                      <HiUsers className="stat-icon" />
                      <div>
                        <div className="stat-value">{project.contributors}</div>
                        <div className="stat-label">Contributors</div>
                      </div>
                    </div>
                    <div className="contribution-stat-item">
                      <HiChartBar className="stat-icon" />
                      <div>
                        <div className="stat-value">{Math.round(progress)}%</div>
                        <div className="stat-label">Funded</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="contribution-form">
                  <label className="contribution-label">Contribution Amount ($)</label>
                  <input 
                    type="number" 
                    className="contribution-input"
                    placeholder="Enter amount"
                    value={contributionAmount}
                    onChange={(e) => setContributionAmount(e.target.value)}
                  />
                  <button className="btn btn-primary contribution-btn" onClick={handleContribute}>
                    Contribute Now
                  </button>
                  <p className="contribution-note">
                    <HiShieldCheck /> Your funds are protected by smart contracts
                  </p>
                </div>
              </div>

              {/* Creator Card */}
              <div className="project-creator-card">
                <h3 className="creator-card-title">Project Creator</h3>
                <div className="creator-info">
                  <div className="creator-avatar">{project.creator.avatar}</div>
                  <div>
                    <div className="creator-name">{project.creator.name}</div>
                    <div className="creator-address">{project.creator.address}</div>
                  </div>
                </div>
              </div>

              {/* Info Card */}
              <div className="project-info-card">
                <h3 className="info-card-title">Campaign Info</h3>
                <div className="info-items">
                  <div className="info-item">
                    <span className="info-label">Status</span>
                    <span className="info-value active">Active</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Milestones</span>
                    <span className="info-value">{project.milestones.length}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Completed</span>
                    <span className="info-value">
                      {project.milestones.filter(m => m.completed).length} / {project.milestones.length}
                    </span>
                  </div>
                </div>
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
    </div>
  )
}
