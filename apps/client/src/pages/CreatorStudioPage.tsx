import { useState } from 'react'
import AppNavbar from '../components/layout/AppNavbar'
import CreateCampaignModal from '../components/modals/CreateCampaignModal'
import { HiCurrencyDollar, HiChartBar, HiUsers, HiCheckCircle, HiClock, HiInformationCircle, HiArrowUpTray, HiEye, HiXCircle, HiArrowDownTray } from 'react-icons/hi2'
import ProofModal from '../components/common/ProofModal'

export default function CreatorStudioPage() {
  const [activeTab, setActiveTab] = useState('active')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showProofModal, setShowProofModal] = useState(false)
  const [selectedProof, setSelectedProof] = useState<{title: string, content: string} | null>(null)

  const stats = [
    {
      label: 'Total Raised',
      value: '$127,000',
      subtitle: 'Across all projects',
      icon: HiCurrencyDollar
    },
    {
      label: 'Active Projects',
      value: '1',
      subtitle: 'Currently funding',
      icon: HiChartBar
    },
    {
      label: 'Total Contributors',
      value: '245',
      subtitle: 'Community supporters',
      icon: HiUsers
    },
    {
      label: 'Milestones Completed',
      value: '3',
      subtitle: 'Successfully approved',
      icon: HiCheckCircle
    }
  ]

  const projects = [
    {
      id: 1,
      category: 'DeFi',
      verified: true,
      active: true,
      title: 'DeFi Lending Protocol',
      description: 'A decentralized lending platform that allows users to lend and borrow cryptocurrencies with minimal fees and maximum security.',
      raised: 75000,
      goal: 100000,
      contributors: 156,
      progress: 75,
      milestones: [
        {
          number: 1,
          status: 'Approved',
          title: 'Smart Contract Development',
          description: 'Complete core smart contract architecture and security audits',
          amount: 30000,
          icon: HiCheckCircle,
          iconColor: 'success',
          proof: 'Smart contracts deployed to mainnet: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e. Audit report attached.'
        },
        {
          number: 2,
          status: 'Active',
          title: 'Frontend Development',
          description: 'Build user interface and integrate with smart contracts',
          amount: 25000,
          icon: HiClock,
          iconColor: 'warning',
          action: 'Submit Proof'
        },
        {
          number: 3,
          status: 'Pending',
          title: 'Security Audit & Launch',
          description: 'Complete third-party security audit and mainnet deployment',
          amount: 45000,
          icon: HiInformationCircle,
          iconColor: 'neutral'
        }
      ]
    },
    {
      id: 2,
      category: 'Gaming',
      verified: true,
      active: true,
      title: 'Blockchain RPG Game',
      description: 'An immersive RPG game built on blockchain where players own their assets.',
      raised: 45000,
      goal: 150000,
      contributors: 89,
      progress: 30,
      milestones: [
        {
          number: 1,
          status: 'Rejected',
          title: 'Game Engine Core',
          description: 'Develop the core game engine and physics system',
          amount: 40000,
          icon: HiXCircle,
          iconColor: 'error',
          action: 'Resubmit Proof',
          proof: 'Initial engine build v0.1. Physics system implemented but found buggy by community.'
        },
        {
          number: 2,
          status: 'Pending',
          title: 'Character Design',
          description: 'Design and model main characters',
          amount: 30000,
          icon: HiInformationCircle,
          iconColor: 'neutral'
        }
      ]
    },
    {
      id: 3,
      category: 'Education',
      verified: false,
      active: false,
      title: 'Decentralized Academy',
      description: 'A platform for learning about blockchain technology.',
      raised: 0,
      goal: 50000,
      contributors: 0,
      progress: 0,
      milestones: [
        {
          number: 1,
          status: 'Pending',
          title: 'Curriculum Design',
          description: 'Create the course structure and initial content',
          amount: 10000,
          icon: HiInformationCircle,
          iconColor: 'neutral'
        }
      ]
    }
  ]

  const tabs = [
    { id: 'active', label: 'Active Projects' },
    { id: 'pending', label: 'Pending Projects' },
    { id: 'all', label: 'All Projects' }
  ]

  const filteredProjects = activeTab === 'all' 
    ? projects 
    : projects.filter(p => activeTab === 'active' ? p.active : !p.active)

  return (
    <div className="app-container">
      <AppNavbar />
      
      <div className="creator-studio-page">
        <div className="container">
          {/* Header */}
          <div className="creator-studio-header">
            <div>
              <h1 className="creator-studio-title">Creator Studio</h1>
              <p className="creator-studio-subtitle">Manage your campaigns and milestones</p>
            </div>
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              + New Campaign
            </button>
          </div>

          {/* Stats Grid */}
          <div className="creator-stats-grid">
            {stats.map((stat, index) => {
              const Icon = stat.icon
              return (
                <div key={index} className="creator-stat-card">
                  <div className="creator-stat-label">{stat.label}</div>
                  <div className="creator-stat-value">{stat.value}</div>
                  <div className="creator-stat-subtitle">
                    <Icon className="creator-stat-icon" />
                    {stat.subtitle}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Tabs */}
          <div className="creator-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`creator-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Projects List */}
          <div className="creator-projects-list">
            {filteredProjects.length === 0 ? (
              <div className="empty-state" style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <p>No projects found in this category.</p>
              </div>
            ) : (
              filteredProjects.map((project) => (
                <div key={project.id} className="creator-project-card" style={{ marginBottom: '2rem' }}>
                <div className="creator-project-header">
                  <div className="creator-project-info">
                    <div className="creator-project-badges">
                      <span className="creator-category-badge">{project.category}</span>
                      <span className={`creator-status-badge ${project.active ? 'active' : 'pending'}`}>
                        {project.active ? 'Active' : 'Pending Validation'}
                      </span>
                    </div>
                    <h2 className="creator-project-title">{project.title}</h2>
                    <p className="creator-project-description">{project.description}</p>
                  </div>
                  <button className="creator-view-project-btn">
                    <HiArrowDownTray style={{ marginRight: '8px' }} /> Download Report
                  </button>
                </div>

                {/* Project Stats */}
                <div className="creator-project-stats">
                  <div className="creator-project-stat">
                    <div className="creator-project-stat-label">Raised</div>
                    <div className="creator-project-stat-value">
                      ${project.raised.toLocaleString()} <span style={{fontSize: '0.6em', fontWeight: '600', opacity: 0.8}}>of ${project.goal.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="creator-project-stat">
                    <div className="creator-project-stat-label">Contributors</div>
                    <div className="creator-project-stat-value">{project.contributors}</div>
                  </div>
                  <div className="creator-project-stat">
                    <div className="creator-project-stat-label">Progress</div>
                    <div className="creator-project-stat-value">{project.progress}%</div>
                  </div>
                </div>

                {/* Milestones */}
                <div className="creator-milestones-section">
                  <h3 className="creator-milestones-title">Milestones</h3>
                  
                  <div className="creator-milestones-list">
                    {project.milestones.map((milestone, index) => {
                      const Icon = milestone.icon
                      return (
                        <div key={index} className="creator-milestone-card">
                          <div className="creator-milestone-header">
                            <div className="creator-milestone-info">
                              <div className="creator-milestone-number-status">
                                <span className="creator-milestone-number">Milestone {milestone.number}</span>
                                <span className={`creator-milestone-status ${milestone.status.toLowerCase()}`}>
                                  {milestone.status}
                                </span>
                              </div>
                              <h4 className="creator-milestone-title">{milestone.title}</h4>
                              <p className="creator-milestone-description">{milestone.description}</p>
                              <div className="creator-milestone-amount">
                                ${milestone.amount.toLocaleString()} <span className="required-text">required</span>
                              </div>
                            </div>
                            
                            <div className="creator-milestone-action">
                              {(milestone.status === 'Approved' || milestone.status === 'Rejected') && milestone.proof && (
                                <button 
                                  className="creator-submit-proof-btn"
                                  onClick={() => {
                                    setSelectedProof({
                                      title: `${milestone.title} - ${milestone.status === 'Rejected' ? 'Rejected Proof' : 'Approved Proof'}`,
                                      content: milestone.proof
                                    })
                                    setShowProofModal(true)
                                  }}
                                  style={{ marginRight: '8px', background: 'transparent', borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                                >
                                  <HiEye /> View Proof
                                </button>
                              )}
                              
                              {milestone.action ? (
                                <button className="creator-submit-proof-btn">
                                  <HiArrowUpTray /> {milestone.action}
                                </button>
                              ) : (
                                <div className={`creator-milestone-icon ${milestone.iconColor}`}>
                                  <Icon />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create Campaign Modal */}
      <CreateCampaignModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      
      <ProofModal 
        isOpen={showProofModal}
        onClose={() => setShowProofModal(false)}
        title={selectedProof?.title || ''}
        proofContent={selectedProof?.content || ''}
      />
    </div>
  )
}
