import { useState } from 'react'
import { HiXMark, HiPlus, HiCheckCircle, HiExclamationTriangle } from 'react-icons/hi2'
import { FaXTwitter, FaDiscord, FaGithub } from 'react-icons/fa6'
import { keccak256, toBytes } from 'viem'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../lib/api'

interface Milestone {
  title: string
  description: string
  amount: string
}

interface CreateCampaignModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function CreateCampaignModal({ isOpen, onClose, onSuccess }: CreateCampaignModalProps) {
  const { isAuthenticated } = useAuth()

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'DeFi',
    githubUrl: '',
    website: '',
    deadline: '',
    paymentToken: '0', // 0=ETH, 1=USDC
  })

  const [socials, setSocials] = useState({
    twitter: { connected: false, username: '' },
    discord: { connected: false, username: '' },
    github: { connected: false, username: '' },
  })

  const [milestones, setMilestones] = useState<Milestone[]>([
    { title: '', description: '', amount: '' },
  ])

  const [txStatus, setTxStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null)
  const [socialError, setSocialError] = useState<string | null>(null)

  const handleConnect = async (platform: 'twitter' | 'discord' | 'github') => {
    if (socials[platform].connected || !isAuthenticated) return
    setSocialError(null)
    setConnectingPlatform(platform)
    // Open popup synchronously inside the click handler — browsers block window.open after await
    const popup = window.open('', `${platform}-oauth`, 'width=600,height=700,left=400,top=100')
    try {
      const res = await apiFetch(`/auth/${platform}/initiate`)
      if (!res.ok) {
        popup?.close()
        setConnectingPlatform(null)
        if (res.status === 401) {
          setSocialError('Session expired — please disconnect your wallet and reconnect, then try again.')
        } else {
          const err = await res.json().catch(() => ({}))
          setSocialError(`Could not start ${platform} auth: ${err.message || res.status}`)
        }
        return
      }
      const { url } = await res.json()
      if (popup) popup.location.href = url
      const handler = (e: MessageEvent) => {
        if (e.data?.provider !== platform) return
        window.removeEventListener('message', handler)
        setConnectingPlatform(null)
        popup?.close()
        if (e.data.success) {
          setSocials(prev => ({ ...prev, [platform]: { connected: true, username: e.data.username } }))
        } else {
          setSocialError(`${platform} verification failed: ${e.data.error || 'unknown error'}`)
        }
      }
      window.addEventListener('message', handler)
    } catch (err: any) {
      popup?.close()
      setConnectingPlatform(null)
      setSocialError(`${platform} auth error: ${err.message}`)
    }
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleMilestoneChange = (index: number, field: keyof Milestone, value: string) => {
    const updated = [...milestones]
    updated[index][field] = value
    setMilestones(updated)
  }

  const addMilestone = () => setMilestones([...milestones, { title: '', description: '', amount: '' }])

  const removeMilestone = (index: number) => {
    if (milestones.length > 1) setMilestones(milestones.filter((_, i) => i !== index))
  }

  const totalMilestoneAmount = milestones.reduce(
    (sum, m) => sum + (parseFloat(m.amount) || 0),
    0,
  )

  const isUsdc = formData.paymentToken === '1'
  const tokenLabel = isUsdc ? 'USDC' : 'ETH'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!isAuthenticated) {
      setErrorMsg('Please sign in with your wallet first.')
      return
    }
    if (!formData.deadline) {
      setErrorMsg('Please set a campaign deadline.')
      return
    }

    const deadlineTs = Math.floor(new Date(formData.deadline).getTime() / 1000)
    if (deadlineTs <= Math.floor(Date.now() / 1000)) {
      setErrorMsg('Deadline must be in the future.')
      return
    }

    // Validate milestone amounts are all set
    const invalidMs = milestones.some(m => !m.amount || parseFloat(m.amount) <= 0)
    if (invalidMs) {
      setErrorMsg('All milestone amounts must be greater than zero.')
      return
    }

    try {
      // Compute a deterministic ipfsHash from title+description — stored in DB so
      // the admin approval page can pass it to createCampaign() on-chain later.
      const ipfsHash = keccak256(toBytes(formData.title + formData.description))

      setTxStatus('saving')

      const res = await apiFetch('/projects', {
        method: 'POST',
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          goalAmount: totalMilestoneAmount,
          deadline: formData.deadline,
          website: formData.website || undefined,
          githubUrl: formData.githubUrl || undefined,
          paymentToken: isUsdc ? 'USDC' : 'ETH',
          ipfsHash,
          milestones: milestones.map(m => ({
            title: m.title,
            description: m.description,
            amount: parseFloat(m.amount),
          })),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (res.status === 401) throw new Error('Session expired — please sign in again.')
        throw new Error(err.message || 'Failed to submit campaign')
      }

      setTxStatus('done')
      setTimeout(() => {
        onSuccess?.()
        onClose()
        setTxStatus('idle')
        setFormData({ title: '', description: '', category: 'DeFi', githubUrl: '', website: '', deadline: '', paymentToken: '0' })
        setMilestones([{ title: '', description: '', amount: '' }])
      }, 1500)
    } catch (err: any) {
      console.error(err)
      setTxStatus('error')
      setErrorMsg(err?.message || 'Submission failed')
    }
  }

  if (!isOpen) return null

  const isSubmitting = txStatus === 'saving'

  const statusLabel: Record<typeof txStatus, string> = {
    idle: 'Submit for Review',
    saving: 'Submitting...',
    done: 'Submitted for Review!',
    error: 'Submit for Review',
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content create-campaign-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Create New Campaign</h2>
            <p className="modal-subtitle">Set up your project with milestone-based funding</p>
          </div>
          <button className="modal-close-btn" onClick={onClose} type="button">
            <HiXMark />
          </button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit} className="modal-form" id="campaign-form">

            {/* Project Details */}
            <div className="form-section">
              <h3 className="form-section-title">Project Details</h3>

              <div className="form-group">
                <label className="form-label">Project Title</label>
                <input
                  type="text" name="title" className="form-input"
                  placeholder="My Awesome Web3 Project"
                  value={formData.title} onChange={handleInputChange} required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  name="description" className="form-textarea"
                  placeholder="Describe your project..." rows={4}
                  value={formData.description} onChange={handleInputChange} required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select name="category" className="form-select" value={formData.category} onChange={handleInputChange}>
                    <option value="DeFi">DeFi</option>
                    <option value="DAO">DAO</option>
                    <option value="NFT">NFT</option>
                    <option value="Gaming">Gaming</option>
                    <option value="Infrastructure">Infrastructure</option>
                    <option value="Open Source">Open Source</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Token</label>
                  <select name="paymentToken" className="form-select" value={formData.paymentToken} onChange={handleInputChange}>
                    <option value="0">ETH</option>
                    <option value="1">USDC</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Campaign Deadline</label>
                <input
                  type="date" name="deadline" className="form-input"
                  value={formData.deadline} onChange={handleInputChange} required
                  min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Funding Goal ({tokenLabel})</label>
                <div
                  className="form-input"
                  style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)', cursor: 'default' }}
                >
                  {totalMilestoneAmount > 0
                    ? `${totalMilestoneAmount} ${tokenLabel} (auto-calculated from milestones)`
                    : `Set milestone amounts to calculate goal`}
                </div>
              </div>
            </div>

            {/* Verification */}
            <div className="form-section">
              <h3 className="form-section-title">Identity & Verification</h3>

              <div className="form-group">
                <label className="form-label">Social Verification</label>
                <div className="social-connect-grid">
                  {(['twitter', 'discord', 'github'] as const).map((platform) => {
                    const icons = { twitter: <FaXTwitter />, discord: <FaDiscord />, github: <FaGithub /> }
                    const labels = { twitter: 'Connect X', discord: 'Connect Discord', github: 'Connect GitHub' }
                    const connectedLabel = { twitter: `@${socials.twitter.username}`, discord: socials.discord.username, github: socials.github.username }
                    const isConnecting = connectingPlatform === platform
                    const isConnected = socials[platform].connected
                    return (
                      <button key={platform} type="button"
                        className={`social-btn ${platform} ${isConnected ? 'connected' : ''}`}
                        onClick={() => handleConnect(platform)}
                        disabled={isConnecting || isConnected}
                      >
                        {icons[platform]}
                        <span>{isConnecting ? 'Connecting…' : isConnected ? connectedLabel[platform] : labels[platform]}</span>
                        {isConnected && <HiCheckCircle className="verified-badge" />}
                      </button>
                    )
                  })}
                </div>
                {socialError && (
                  <p style={{ fontSize: '12px', color: 'var(--color-error)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <HiExclamationTriangle /> {socialError}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Project Repository & Website</label>
                <input
                  type="url" name="githubUrl" className="form-input"
                  style={{ marginBottom: '12px' }}
                  placeholder="GitHub Repository URL"
                  value={formData.githubUrl} onChange={handleInputChange} required
                />
                <input
                  type="url" name="website" className="form-input"
                  placeholder="Website URL (Optional)"
                  value={formData.website} onChange={handleInputChange}
                />
              </div>
            </div>

            {/* Milestones */}
            <div className="form-section">
              <div className="form-section-header">
                <h3 className="form-section-title">Milestones</h3>
                <button type="button" className="add-milestone-btn" onClick={addMilestone}>
                  <HiPlus /> Add Milestone
                </button>
              </div>

              <div className="milestones-list">
                {milestones.map((milestone, index) => (
                  <div key={index} className="milestone-form-card">
                    <div className="milestone-form-header">
                      <h4 className="milestone-form-title">Milestone {index + 1}</h4>
                      {milestones.length > 1 && (
                        <button type="button" className="remove-milestone-btn" onClick={() => removeMilestone(index)}>
                          <HiXMark />
                        </button>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label">Title</label>
                      <input
                        type="text" className="form-input" placeholder="Milestone title"
                        value={milestone.title}
                        onChange={e => handleMilestoneChange(index, 'title', e.target.value)} required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <textarea
                        className="form-textarea" placeholder="What will be delivered?" rows={3}
                        value={milestone.description}
                        onChange={e => handleMilestoneChange(index, 'description', e.target.value)} required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Required Amount ({tokenLabel})</label>
                      <input
                        type="number" className="form-input" placeholder="e.g. 1.5"
                        step="any" min="0"
                        value={milestone.amount}
                        onChange={e => handleMilestoneChange(index, 'amount', e.target.value)} required
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </div>

        {/* Error banner */}
        {(txStatus === 'error' || errorMsg) && (
          <div
            style={{
              margin: '0 24px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: 'var(--color-error)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
            }}
          >
            <HiExclamationTriangle />
            {errorMsg || 'Transaction failed. Please try again.'}
          </div>
        )}

        {/* TX status bar */}
        {isSubmitting && (
          <div
            style={{
              margin: '0 24px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.25)',
              color: 'var(--color-primary)',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            {statusLabel[txStatus]}
          </div>
        )}

        <div className="modal-footer">
          <button
            type="submit"
            form="campaign-form"
            className="btn btn-primary modal-submit-btn"
            disabled={isSubmitting || txStatus === 'done'}
            style={{ opacity: isSubmitting ? 0.7 : 1 }}
          >
            {txStatus === 'done' ? <><HiCheckCircle /> Submitted for Review!</> : statusLabel[txStatus]}
          </button>
        </div>
      </div>
    </div>
  )
}
