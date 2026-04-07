import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import AppNavbar from '../components/layout/AppNavbar'
import ProofModal from '../components/common/ProofModal'
import {
  HiUsers, HiChartBar, HiCheckCircle, HiClock, HiInformationCircle,
  HiXCircle, HiEye, HiArrowLeft, HiPaperAirplane,
} from 'react-icons/hi2'
import { useWriteContract, useAccount } from 'wagmi'
import { parseEther, parseUnits } from 'viem'
import { CAMPAIGN_FACTORY_ADDRESS, CAMPAIGN_FACTORY_ABI } from '../config/contracts'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../lib/api'

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
interface Message {
  id: string; content: string; createdAt: string
  user: { id: string; name: string | null; walletAddress: string }
}

const fmt = (n: number) => `$${Number(n).toLocaleString()}`
const shortenAddress = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`

const MILESTONE_ICON: Record<string, any> = {
  APPROVED: HiCheckCircle, COMPLETED: HiCheckCircle,
  VOTING: HiClock, REJECTED: HiXCircle, PENDING: HiInformationCircle,
}
const MILESTONE_COLOR: Record<string, string> = {
  APPROVED: 'success', COMPLETED: 'success', VOTING: 'warning', REJECTED: 'error', PENDING: 'neutral',
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token, isAuthenticated } = useAuth()
  const { isConnected } = useAccount()
  const { writeContractAsync } = useWriteContract()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [updates, setUpdates] = useState<Update[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('milestones')

  const [showProofModal, setShowProofModal] = useState(false)
  const [selectedProof, setSelectedProof] = useState<{ title: string; content: string } | null>(null)

  // Contribution state
  const [contributionAmount, setContributionAmount] = useState('')
  const [contributing, setContributing] = useState(false)
  const [contributionDone, setContributionDone] = useState(false)

  // Forum state
  const [newMessage, setNewMessage] = useState('')
  const [postingMessage, setPostingMessage] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      apiFetch(`/projects/${id}`).then(r => r.ok ? r.json() : null),
      apiFetch(`/projects/${id}/milestones`).then(r => r.ok ? r.json() : []),
      apiFetch(`/projects/${id}/updates`).then(r => r.ok ? r.json() : []),
      apiFetch(`/projects/${id}/forum`).then(r => r.ok ? r.json() : null),
    ]).then(([camp, ms, ups, forum]) => {
      setCampaign(camp)
      setMilestones(ms)
      setUpdates(ups)
      setMessages(forum?.messages ?? [])
      setLoading(false)
    })
  }, [id])

  const handleContribute = async () => {
    if (!campaign?.onChainId || !contributionAmount) return
    setContributing(true)
    try {
      if (campaign.paymentToken === 'USDC') {
        const amount = parseUnits(contributionAmount, 6)
        await writeContractAsync({
          address: CAMPAIGN_FACTORY_ADDRESS, abi: CAMPAIGN_FACTORY_ABI,
          functionName: 'contributeUSDC',
          args: [BigInt(campaign.onChainId), amount],
        })
      } else {
        await writeContractAsync({
          address: CAMPAIGN_FACTORY_ADDRESS, abi: CAMPAIGN_FACTORY_ABI,
          functionName: 'contributeETH',
          args: [BigInt(campaign.onChainId)],
          value: parseEther(contributionAmount),
        })
      }
      setContributionDone(true)
      setContributionAmount('')
    } catch (err: any) {
      alert(err?.shortMessage || err?.message || 'Transaction failed')
    } finally {
      setContributing(false)
    }
  }

  const handlePostMessage = async () => {
    if (!newMessage.trim() || !id || !token) return
    setPostingMessage(true)
    try {
      const res = await apiFetch(`/projects/${id}/forum`, {
        method: 'POST',
        body: JSON.stringify({ content: newMessage.trim() }),
      }, token)
      if (res.ok) {
        const msg = await res.json()
        setMessages(prev => [...prev, msg])
        setNewMessage('')
      }
    } finally {
      setPostingMessage(false)
    }
  }

  if (loading) return (
    <div className="app-container"><AppNavbar />
      <div style={{ textAlign: 'center', padding: '6rem 0', color: 'var(--color-text-secondary)' }}>Loading...</div>
    </div>
  )

  if (!campaign) return (
    <div className="app-container"><AppNavbar />
      <div style={{ textAlign: 'center', padding: '6rem 0', color: 'var(--color-text-secondary)' }}>Campaign not found.</div>
    </div>
  )

  const raised = Number(campaign.raisedAmount)
  const goal = Number(campaign.goalAmount)
  const progress = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0
  const isActive = ['ACTIVE', 'FUNDED'].includes(campaign.status)

  return (
    <div className="app-container">
      <AppNavbar />
      <div className="project-detail-page">
        <div className="container">
          {/* Back link */}
          <Link to="/explore" className="project-back-link" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-secondary)', textDecoration: 'none', marginBottom: '1.5rem', fontSize: 14 }}>
            <HiArrowLeft /> Back to Explore
          </Link>

          <div className="project-detail-layout">
            {/* Main Content */}
            <div className="project-detail-main">
              {/* Header */}
              <div className="project-detail-header">
                <div className="project-detail-badges">
                  <span className="project-category-badge">{campaign.category}</span>
                  <span className={`project-status-badge ${campaign.status.toLowerCase()}`}>{campaign.status}</span>
                </div>
                <h1 className="project-detail-title">{campaign.title}</h1>
                <p className="project-detail-description">{campaign.description}</p>
                <div className="project-creator">
                  by <span>{campaign.creator.name || shortenAddress(campaign.creator.walletAddress)}</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="project-tabs">
                {['milestones', 'updates', 'forum'].map(tab => (
                  <button key={tab} className={`project-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {tab === 'forum' && messages.length > 0 && ` (${messages.length})`}
                  </button>
                ))}
              </div>

              {/* Milestones Tab */}
              {activeTab === 'milestones' && (
                <div className="project-milestones">
                  {milestones.map((m, i) => {
                    const Icon = MILESTONE_ICON[m.status] || HiInformationCircle
                    return (
                      <div key={m.id} className="project-milestone-card">
                        <div className="project-milestone-header">
                          <div className={`project-milestone-icon ${MILESTONE_COLOR[m.status] || 'neutral'}`}><Icon /></div>
                          <div className="project-milestone-info">
                            <div className="project-milestone-number-status">
                              <span className="project-milestone-number">Milestone {i + 1}</span>
                              <span className={`project-milestone-status ${m.status.toLowerCase()}`}>{m.status}</span>
                            </div>
                            <h3 className="project-milestone-title">{m.title}</h3>
                            <p className="project-milestone-description">{m.description}</p>
                            <div className="project-milestone-amount">{fmt(Number(m.amount))} required</div>
                          </div>
                          {m.proofUrl && (
                            <button className="project-view-proof-btn" onClick={() => { setSelectedProof({ title: m.title, content: m.proofUrl! }); setShowProofModal(true) }}>
                              <HiEye /> View Proof
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {milestones.length === 0 && <p style={{ color: 'var(--color-text-secondary)' }}>No milestones yet.</p>}
                </div>
              )}

              {/* Updates Tab */}
              {activeTab === 'updates' && (
                <div className="project-updates">
                  {updates.length === 0 ? (
                    <p style={{ color: 'var(--color-text-secondary)' }}>No updates posted yet.</p>
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
              {activeTab === 'forum' && (
                <div className="project-forum">
                  <div className="forum-messages">
                    {messages.length === 0 ? (
                      <p style={{ color: 'var(--color-text-secondary)' }}>No messages yet. Start the discussion!</p>
                    ) : messages.map(msg => (
                      <div key={msg.id} className="forum-message">
                        <div className="forum-message-header">
                          <span className="forum-author">{msg.user.name || shortenAddress(msg.user.walletAddress)}</span>
                          <span className="forum-date">{new Date(msg.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="forum-message-content">{msg.content}</p>
                      </div>
                    ))}
                  </div>

                  {isAuthenticated ? (
                    <div className="forum-compose" style={{ marginTop: '1.5rem', display: 'flex', gap: '10px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Write a message..."
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handlePostMessage()}
                        disabled={postingMessage}
                        style={{ flex: 1 }}
                      />
                      <button className="btn btn-primary" onClick={handlePostMessage} disabled={!newMessage.trim() || postingMessage}>
                        <HiPaperAirplane />{postingMessage ? 'Posting...' : 'Post'}
                      </button>
                    </div>
                  ) : (
                    <p style={{ marginTop: '1rem', color: 'var(--color-text-secondary)', fontSize: 14 }}>
                      Sign in to join the discussion.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="project-detail-sidebar">
              {/* Progress Card */}
              <div className="project-sidebar-card">
                <div className="project-funding-stats">
                  <div className="project-raised">{fmt(raised)}</div>
                  <div className="project-goal">raised of {fmt(goal)}</div>
                </div>
                <div className="project-progress-bar" style={{ margin: '12px 0' }}>
                  <div className="project-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="project-meta-stats">
                  <div className="project-meta-item"><HiUsers />{campaign._count.contributions} contributors</div>
                  <div className="project-meta-item"><HiChartBar />{campaign._count.milestones} milestones</div>
                  {campaign.deadline && (
                    <div className="project-meta-item">
                      <HiClock />
                      {new Date(campaign.deadline) > new Date()
                        ? `${Math.ceil((new Date(campaign.deadline).getTime() - Date.now()) / 86400000)}d left`
                        : 'Deadline passed'}
                    </div>
                  )}
                </div>

                {/* Contribute */}
                {isActive && isConnected && !contributionDone && (
                  <div className="project-contribute" style={{ marginTop: '1.5rem' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        className="form-input"
                        placeholder={`Amount (${campaign.paymentToken})`}
                        value={contributionAmount}
                        onChange={e => setContributionAmount(e.target.value)}
                        min="0"
                        step="0.01"
                        style={{ flex: 1 }}
                      />
                      <button
                        className="btn btn-primary"
                        onClick={handleContribute}
                        disabled={!contributionAmount || contributing}
                      >
                        {contributing ? 'Confirming...' : 'Fund'}
                      </button>
                    </div>
                  </div>
                )}
                {contributionDone && (
                  <div style={{ marginTop: '1rem', color: 'var(--color-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <HiCheckCircle /> Contribution submitted!
                  </div>
                )}
                {isActive && !isConnected && (
                  <p style={{ marginTop: '1rem', color: 'var(--color-text-secondary)', fontSize: 14, textAlign: 'center' }}>
                    Connect your wallet to contribute.
                  </p>
                )}
              </div>

              {/* Links */}
              {(campaign.website || campaign.githubUrl) && (
                <div className="project-sidebar-card">
                  <h4 style={{ marginBottom: '0.75rem', fontWeight: 600 }}>Links</h4>
                  {campaign.website && <a href={campaign.website} target="_blank" rel="noopener noreferrer" className="project-link" style={{ display: 'block', marginBottom: 8 }}>🌐 Website</a>}
                  {campaign.githubUrl && <a href={campaign.githubUrl} target="_blank" rel="noopener noreferrer" className="project-link">📦 GitHub</a>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ProofModal isOpen={showProofModal} onClose={() => setShowProofModal(false)} title={selectedProof?.title || ''} proofContent={selectedProof?.content || ''} />
    </div>
  )
}
