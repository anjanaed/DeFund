import { useState, useEffect } from 'react'
import AppNavbar from '../components/layout/AppNavbar'
import CreateCampaignModal from '../components/modals/CreateCampaignModal'
import SubmitProofModal from '../components/modals/SubmitProofModal'
import ProofModal from '../components/common/ProofModal'
import {
  HiCurrencyDollar, HiChartBar, HiUsers, HiCheckCircle, HiClock,
  HiInformationCircle, HiArrowUpTray, HiEye, HiXCircle, HiArrowDownTray,
  HiBanknotes, HiNoSymbol,
} from 'react-icons/hi2'
import { useWriteContract } from 'wagmi'
import { CAMPAIGN_FACTORY_ADDRESS, CAMPAIGN_FACTORY_ABI } from '../config/contracts'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'

interface Milestone {
  id: string; title: string; status: string; amount: string
  onChainId: number | null; proofUrl: string | null; submissionCount: number
}
interface CreatorCampaign {
  id: string; title: string; description: string; category: string; status: string
  raisedAmount: string; goalAmount: string; paymentToken: string
  _count: { milestones: number; contributions: number }
  milestones: Milestone[]
}

const fmt = (n: number) => `$${Number(n).toLocaleString()}`

const STATUS_ICON: Record<string, any> = {
  APPROVED: HiCheckCircle, COMPLETED: HiCheckCircle,
  VOTING: HiClock, REJECTED: HiXCircle,
  PENDING: HiInformationCircle,
}
const STATUS_COLOR: Record<string, string> = {
  APPROVED: 'success', COMPLETED: 'success',
  VOTING: 'warning', REJECTED: 'error', PENDING: 'neutral',
}

export default function CreatorStudioPage() {
  const { token } = useAuth()
  const [activeTab, setActiveTab] = useState('active')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showProofModal, setShowProofModal] = useState(false)
  const [selectedProof, setSelectedProof] = useState<{ title: string; content: string } | null>(null)
  const [proofModal, setProofModal] = useState<{ milestoneId: string; onChainId: number | null; title: string; isResubmission: boolean } | null>(null)

  const [campaigns, setCampaigns] = useState<CreatorCampaign[]>([])
  const [loading, setLoading] = useState(true)

  const [releasingId, setReleasingId] = useState<string | null>(null)
  const [releasedIds, setReleasedIds] = useState<Set<string>>(new Set())
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set())

  const { writeContractAsync } = useWriteContract()

  const loadCampaigns = () => {
    if (!token) return
    setLoading(true)
    apiFetch('/creator/projects', {}, token)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setCampaigns(data); setLoading(false) })
  }

  useEffect(() => { loadCampaigns() }, [token])

  const handleReleaseFunds = async (milestone: Milestone) => {
    if (!milestone.onChainId) { alert('Milestone not yet on-chain.'); return }
    setReleasingId(milestone.id)
    try {
      await writeContractAsync({
        address: CAMPAIGN_FACTORY_ADDRESS, abi: CAMPAIGN_FACTORY_ABI,
        functionName: 'releaseMilestoneFunds', args: [BigInt(milestone.onChainId)],
      })
      setReleasedIds(prev => new Set(prev).add(milestone.id))
    } catch (err: any) {
      alert(err?.shortMessage || err?.message || 'Transaction failed')
    } finally {
      setReleasingId(null)
    }
  }

  const handleSubmitProof = async (proofIpfsHash: string) => {
    if (!proofModal?.onChainId) throw new Error('Milestone not yet on-chain.')
    await writeContractAsync({
      address: CAMPAIGN_FACTORY_ADDRESS, abi: CAMPAIGN_FACTORY_ABI,
      functionName: 'submitMilestoneForVoting',
      args: [BigInt(proofModal.onChainId), proofIpfsHash],
    })
    setSubmittedIds(prev => new Set(prev).add(proofModal.milestoneId))
    setProofModal(null)
  }

  const isActive = (c: CreatorCampaign) => ['ACTIVE', 'FUNDED'].includes(c.status)
  const filteredCampaigns = activeTab === 'all' ? campaigns
    : campaigns.filter(c => activeTab === 'active' ? isActive(c) : !isActive(c))

  // Creator stats derived from campaigns
  const totalRaised = campaigns.reduce((s, c) => s + Number(c.raisedAmount), 0)
  const activeCampaigns = campaigns.filter(isActive).length
  const totalContributors = campaigns.reduce((s, c) => s + c._count.contributions, 0)
  const completedMilestones = campaigns.flatMap(c => c.milestones).filter(m => m.status === 'COMPLETED' || m.status === 'APPROVED').length

  const stats = [
    { label: 'Total Raised', value: fmt(totalRaised), subtitle: 'Across all projects', icon: HiCurrencyDollar },
    { label: 'Active Projects', value: `${activeCampaigns}`, subtitle: 'Currently funding', icon: HiChartBar },
    { label: 'Total Contributors', value: `${totalContributors}`, subtitle: 'Community supporters', icon: HiUsers },
    { label: 'Milestones Completed', value: `${completedMilestones}`, subtitle: 'Successfully approved', icon: HiCheckCircle },
  ]

  if (loading) return (
    <div className="app-container"><AppNavbar />
      <div style={{ textAlign: 'center', padding: '6rem 0', color: 'var(--color-text-secondary)' }}>Loading...</div>
    </div>
  )

  return (
    <div className="app-container">
      <AppNavbar />
      <div className="creator-studio-page">
        <div className="container">
          <div className="creator-studio-header">
            <div>
              <h1 className="creator-studio-title">Creator Studio</h1>
              <p className="creator-studio-subtitle">Manage your campaigns and milestones</p>
            </div>
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>+ New Campaign</button>
          </div>

          {/* Stats */}
          <div className="creator-stats-grid">
            {stats.map((stat, i) => {
              const Icon = stat.icon
              return (
                <div key={i} className="creator-stat-card">
                  <div className="creator-stat-label">{stat.label}</div>
                  <div className="creator-stat-value">{stat.value}</div>
                  <div className="creator-stat-subtitle"><Icon className="creator-stat-icon" />{stat.subtitle}</div>
                </div>
              )
            })}
          </div>

          {/* Tabs */}
          <div className="creator-tabs">
            {[{ id: 'active', label: 'Active Projects' }, { id: 'pending', label: 'Pending Projects' }, { id: 'all', label: 'All Projects' }].map(tab => (
              <button key={tab.id} className={`creator-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Projects */}
          <div className="creator-projects-list">
            {filteredCampaigns.length === 0 ? (
              <div className="empty-state" style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <p>No projects found in this category.</p>
              </div>
            ) : filteredCampaigns.map(project => (
              <div key={project.id} className="creator-project-card" style={{ marginBottom: '2rem' }}>
                <div className="creator-project-header">
                  <div className="creator-project-info">
                    <div className="creator-project-badges">
                      <span className="creator-category-badge">{project.category}</span>
                      <span className={`creator-status-badge ${isActive(project) ? 'active' : 'pending'}`}>
                        {project.status}
                      </span>
                    </div>
                    <h2 className="creator-project-title">{project.title}</h2>
                    <p className="creator-project-description">{project.description}</p>
                  </div>
                  <button className="creator-view-project-btn">
                    <HiArrowDownTray style={{ marginRight: 8 }} /> Download Report
                  </button>
                </div>

                <div className="creator-project-stats">
                  <div className="creator-project-stat">
                    <div className="creator-project-stat-label">Raised</div>
                    <div className="creator-project-stat-value">
                      {fmt(Number(project.raisedAmount))} <span style={{ fontSize: '0.6em', fontWeight: 600, opacity: 0.8 }}>of {fmt(Number(project.goalAmount))}</span>
                    </div>
                  </div>
                  <div className="creator-project-stat">
                    <div className="creator-project-stat-label">Contributors</div>
                    <div className="creator-project-stat-value">{project._count.contributions}</div>
                  </div>
                  <div className="creator-project-stat">
                    <div className="creator-project-stat-label">Token</div>
                    <div className="creator-project-stat-value">{project.paymentToken}</div>
                  </div>
                </div>

                {/* Milestones */}
                <div className="creator-milestones-section">
                  <h3 className="creator-milestones-title">Milestones</h3>
                  <div className="creator-milestones-list">
                    {project.milestones.map((m, idx) => {
                      const Icon = STATUS_ICON[m.status] || HiInformationCircle
                      const isApproved = m.status === 'APPROVED' || m.status === 'COMPLETED'
                      const isRejected = m.status === 'REJECTED'
                      const canSubmit = (m.status === 'PENDING') && !submittedIds.has(m.id)
                      const canResubmit = isRejected && m.submissionCount < 2 && !submittedIds.has(m.id)
                      const permanentlyRejected = isRejected && m.submissionCount >= 2

                      return (
                        <div key={m.id} className="creator-milestone-card">
                          <div className="creator-milestone-header">
                            <div className="creator-milestone-info">
                              <div className="creator-milestone-number-status">
                                <span className="creator-milestone-number">Milestone {idx + 1}</span>
                                <span className={`creator-milestone-status ${m.status.toLowerCase()}`}>{m.status}</span>
                              </div>
                              <h4 className="creator-milestone-title">{m.title}</h4>
                              <div className="creator-milestone-amount">
                                {fmt(Number(m.amount))} <span className="required-text">required</span>
                              </div>
                            </div>

                            <div className="creator-milestone-action">
                              {/* View proof */}
                              {(isApproved || isRejected) && m.proofUrl && (
                                <button className="creator-submit-proof-btn" onClick={() => { setSelectedProof({ title: `${m.title} — ${m.status}`, content: m.proofUrl! }); setShowProofModal(true) }}
                                  style={{ marginRight: 8, background: 'transparent', borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
                                  <HiEye /> View Proof
                                </button>
                              )}

                              {/* Release funds */}
                              {isApproved && !releasedIds.has(m.id) && m.status !== 'COMPLETED' && (
                                <button className="creator-submit-proof-btn" onClick={() => handleReleaseFunds(m)}
                                  disabled={releasingId === m.id}
                                  style={{ background: 'var(--color-success)', borderColor: 'var(--color-success)', color: '#fff', opacity: releasingId === m.id ? 0.7 : 1 }}>
                                  <HiBanknotes />{releasingId === m.id ? 'Confirming...' : 'Release Funds'}
                                </button>
                              )}
                              {releasedIds.has(m.id) && (
                                <span style={{ fontSize: 13, color: 'var(--color-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <HiCheckCircle /> Funds Released
                                </span>
                              )}

                              {/* Submit proof (first time) */}
                              {canSubmit && (
                                <button className="creator-submit-proof-btn" onClick={() => setProofModal({ milestoneId: m.id, onChainId: m.onChainId, title: m.title, isResubmission: false })}>
                                  <HiArrowUpTray /> Submit Proof
                                </button>
                              )}

                              {/* Resubmit proof */}
                              {canResubmit && (
                                <button className="creator-submit-proof-btn" onClick={() => setProofModal({ milestoneId: m.id, onChainId: m.onChainId, title: m.title, isResubmission: true })}
                                  style={{ background: 'var(--color-warning, #eab308)', borderColor: 'var(--color-warning, #eab308)', color: '#000' }}>
                                  <HiArrowUpTray /> Resubmit Proof
                                </button>
                              )}

                              {/* Permanently rejected */}
                              {permanentlyRejected && (
                                <span style={{ fontSize: 13, color: 'var(--color-error)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <HiNoSymbol /> Max attempts reached
                                </span>
                              )}

                              {/* Submitted confirmation */}
                              {submittedIds.has(m.id) && (
                                <span style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <HiCheckCircle /> Submitted for voting
                                </span>
                              )}

                              {/* Default icon for VOTING or COMPLETED */}
                              {!canSubmit && !canResubmit && !permanentlyRejected && !submittedIds.has(m.id) && !isApproved && !isRejected && (
                                <div className={`creator-milestone-icon ${STATUS_COLOR[m.status] || 'neutral'}`}><Icon /></div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <CreateCampaignModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={loadCampaigns} />
      <ProofModal isOpen={showProofModal} onClose={() => setShowProofModal(false)} title={selectedProof?.title || ''} proofContent={selectedProof?.content || ''} />
      {proofModal && (
        <SubmitProofModal isOpen onClose={() => setProofModal(null)} milestoneTitle={proofModal.title} isResubmission={proofModal.isResubmission} onSubmit={handleSubmitProof} />
      )}
    </div>
  )
}
