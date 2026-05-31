import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { HiXMark, HiPlus, HiCheckCircle, HiExclamationTriangle } from 'react-icons/hi2'
import { FaXTwitter, FaDiscord, FaGithub } from 'react-icons/fa6'
import { keccak256, toBytes } from 'viem'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../lib/api'

const OSS_LICENSES = [
  'MIT', 'Apache-2.0', 'GPL-3.0', 'AGPL-3.0', 'GPL-2.0',
  'LGPL-2.1', 'MPL-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'Other',
]

interface Milestone {
  title: string
  description: string
  amount: string
  deadline: string
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
    repositoryUrl: '',
    license: '',
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
    { title: '', description: '', amount: '', deadline: '' },
  ])

  const [txStatus, setTxStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null)
  const [socialError, setSocialError] = useState<string | null>(null)

  // Auto-fill the last milestone's deadline with the campaign deadline
  useEffect(() => {
    if (!formData.deadline) return
    setMilestones(prev => {
      const last = prev[prev.length - 1]
      if (last.deadline === '' || last.deadline === prev[prev.length - 1].deadline) {
        const updated = [...prev]
        updated[updated.length - 1] = { ...last, deadline: formData.deadline }
        return updated
      }
      return prev
    })
  }, [formData.deadline])

  const handleConnect = async (platform: 'twitter' | 'discord' | 'github') => {
    if (socials[platform].connected || !isAuthenticated) return
    setSocialError(null)
    setConnectingPlatform(platform)
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
      const expectedOrigin = import.meta.env.VITE_API_URL
        ? new URL(import.meta.env.VITE_API_URL).origin
        : window.location.origin
      const handler = (e: MessageEvent) => {
        if (e.origin !== expectedOrigin) return
        if (e.data?.provider !== platform) return
        window.removeEventListener('message', handler)
        setConnectingPlatform(null)
        popup?.close()
        if (e.data.success) {
          setSocials(prev => ({ ...prev, [platform]: { connected: true, username: e.data.username } }))
          toast.success(`Connected as ${e.data.username}`)
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

  const addMilestone = () => {
    setMilestones([...milestones, { title: '', description: '', amount: '', deadline: '' }])
  }

  const removeMilestone = (index: number) => {
    if (milestones.length > 1) setMilestones(milestones.filter((_, i) => i !== index))
  }

  const totalMilestoneAmount = milestones.reduce(
    (sum, m) => sum + (parseFloat(m.amount) || 0),
    0,
  )

  // Kickoff guidance: nudge creators to keep milestone 1 a small, cheap-to-prove
  // first deliverable. Soft warning only — never blocks submission.
  const KICKOFF_SOFT_CAP_PCT = 20
  const firstMsPct = totalMilestoneAmount > 0
    ? ((parseFloat(milestones[0]?.amount) || 0) / totalMilestoneAmount) * 100
    : 0
  const kickoffTooLarge = milestones.length > 1 && firstMsPct > KICKOFF_SOFT_CAP_PCT

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

    const invalidMs = milestones.some(m => !m.amount || parseFloat(m.amount) <= 0)
    if (invalidMs) {
      setErrorMsg('All milestone amounts must be greater than zero.')
      return
    }

    // Validate per-milestone deadlines: sequential and within campaign deadline
    for (let i = 0; i < milestones.length; i++) {
      if (!milestones[i].deadline) {
        setErrorMsg(`Milestone ${i + 1} needs a deadline.`)
        return
      }
      const msTs = new Date(milestones[i].deadline).getTime()
      if (i > 0 && msTs <= new Date(milestones[i - 1].deadline).getTime()) {
        setErrorMsg(`Milestone ${i + 1} deadline must be after milestone ${i}.`)
        return
      }
      if (msTs > new Date(formData.deadline).getTime()) {
        setErrorMsg(`Milestone ${i + 1} deadline cannot be after the campaign deadline.`)
        return
      }
    }

    if (!formData.license) {
      setErrorMsg('Please select an open-source license.')
      return
    }

    try {
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
          repositoryUrl: formData.repositoryUrl,
          license: formData.license,
          paymentToken: isUsdc ? 'USDC' : 'ETH',
          ipfsHash,
          milestones: milestones.map(m => ({
            title: m.title,
            description: m.description,
            amount: parseFloat(m.amount),
            deadline: m.deadline || undefined,
          })),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (res.status === 401) throw new Error('Session expired — please sign in again.')
        throw new Error(err.message || 'Failed to submit campaign')
      }

      toast.success('Campaign submitted for review!', {
        description: 'An admin will review and approve your campaign shortly.',
      })
      onSuccess?.()
      onClose()
      setTxStatus('idle')
      setFormData({ title: '', description: '', category: 'DeFi', repositoryUrl: '', license: '', website: '', deadline: '', paymentToken: '0' })
      setMilestones([{ title: '', description: '', amount: '', deadline: '' }])
      setSocials({ twitter: { connected: false, username: '' }, discord: { connected: false, username: '' }, github: { connected: false, username: '' } })
    } catch (err: any) {
      console.error(err)
      setTxStatus('error')
      const msg = err?.message || 'Submission failed'
      setErrorMsg(msg)
      toast.error(msg)
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

  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content create-campaign-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Create New Campaign</h2>
            <p className="modal-subtitle">Set up your open-source project with milestone-based funding</p>
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
                  min={tomorrow}
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

            {/* Identity & Verification */}
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
                <label className="form-label">Repository URL</label>
                <input
                  type="url" name="repositoryUrl" className="form-input"
                  placeholder="Repository URL (GitHub, GitLab, Bitbucket, etc.)"
                  value={formData.repositoryUrl} onChange={handleInputChange} required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Open Source License</label>
                <select name="license" className="form-select" value={formData.license} onChange={handleInputChange} required>
                  <option value="">Select a license...</option>
                  {OSS_LICENSES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Website URL <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>(optional)</span></label>
                <input
                  type="url" name="website" className="form-input"
                  placeholder="https://yourproject.io"
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

              <p
                className="form-hint"
                style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 14px', lineHeight: 1.5 }}
              >
                Make your <strong>first milestone a small “kickoff”</strong>: a deliverable you can show
                {' '}<em>before</em> funding (technical spec, repo scaffold, design mockups, roadmap). Keeping it a
                small share of your goal lets contributors approve it quickly so you can start building.
              </p>

              <div className="milestones-list">
                {milestones.map((milestone, index) => (
                  <div key={index} className="milestone-form-card">
                    <div className="milestone-form-header">
                      <h4 className="milestone-form-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Milestone {index + 1}
                        {index === 0 && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              letterSpacing: '0.02em',
                              textTransform: 'uppercase',
                              color: 'var(--color-primary)',
                              background: 'rgba(99,102,241,0.1)',
                              border: '1px solid rgba(99,102,241,0.25)',
                              borderRadius: '999px',
                              padding: '2px 8px',
                            }}
                          >
                            Kickoff
                          </span>
                        )}
                      </h4>
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
                        className="form-textarea"
                        placeholder={index === 0
                          ? 'e.g. published technical spec, public repo scaffold, design mockups, project roadmap'
                          : 'What will be delivered?'}
                        rows={3}
                        value={milestone.description}
                        onChange={e => handleMilestoneChange(index, 'description', e.target.value)} required
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Required Amount ({tokenLabel})</label>
                        <input
                          type="number" className="form-input" placeholder="e.g. 1.5"
                          step="any" min="0"
                          value={milestone.amount}
                          onChange={e => handleMilestoneChange(index, 'amount', e.target.value)} required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Milestone Deadline</label>
                        <input
                          type="date" className="form-input"
                          value={milestone.deadline}
                          onChange={e => handleMilestoneChange(index, 'deadline', e.target.value)}
                          min={index > 0 ? milestones[index - 1].deadline || tomorrow : tomorrow}
                          max={formData.deadline || undefined}
                          required
                        />
                      </div>
                    </div>

                    {index === 0 && kickoffTooLarge && (
                      <p style={{ fontSize: '12px', color: 'var(--color-warning, #eab308)', marginTop: '8px', display: 'flex', alignItems: 'flex-start', gap: '6px', lineHeight: 1.4 }}>
                        <HiExclamationTriangle style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>
                          Your kickoff milestone is {Math.round(firstMsPct)}% of the goal. Consider keeping it under
                          {' '}{KICKOFF_SOFT_CAP_PCT}% so contributors approve it quickly and you can start sooner.
                        </span>
                      </p>
                    )}
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
            {statusLabel[txStatus]}
          </button>
        </div>
      </div>
    </div>
  )
}
