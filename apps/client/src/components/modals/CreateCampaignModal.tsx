import { useState } from 'react'
import { HiXMark, HiPlus, HiCheckCircle } from 'react-icons/hi2'
import { FaXTwitter, FaDiscord, FaGithub } from 'react-icons/fa6'


interface Milestone {
  title: string
  description: string
  amount: string
}

interface CreateCampaignModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function CreateCampaignModal({ isOpen, onClose }: CreateCampaignModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'DeFi',
    fundingGoal: '',
    githubUrl: '',
    website: ''
  })


  const [socials, setSocials] = useState({
    twitter: { connected: false, username: '' },
    discord: { connected: false, username: '' },
    github: { connected: false, username: '' }
  })

  const handleConnect = (platform: 'twitter' | 'discord' | 'github') => {
    if (socials[platform].connected) return
    
    setTimeout(() => {
      setSocials(prev => ({
        ...prev,
        [platform]: { connected: true, username: 'VerifiedUser' }
      }))
    }, 800)
  }



  const [milestones, setMilestones] = useState<Milestone[]>([
    { title: '', description: '', amount: '' }
  ])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleMilestoneChange = (index: number, field: keyof Milestone, value: string) => {
    const newMilestones = [...milestones]
    newMilestones[index][field] = value
    setMilestones(newMilestones)
  }

  const addMilestone = () => {
    setMilestones([...milestones, { title: '', description: '', amount: '' }])
  }

  const removeMilestone = (index: number) => {
    if (milestones.length > 1) {
      setMilestones(milestones.filter((_, i) => i !== index))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form data:', formData, 'Milestones:', milestones)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content create-campaign-modal" onClick={(e) => e.stopPropagation()}>
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
                  type="text"
                  name="title"
                  className="form-input"
                  placeholder="My Awesome Web3 Project"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  name="description"
                  className="form-textarea"
                  placeholder="Describe your project..."
                  rows={4}
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    name="category"
                    className="form-select"
                    value={formData.category}
                    onChange={handleInputChange}
                  >
                    <option value="DeFi">DeFi</option>
                    <option value="DAO">DAO</option>
                    <option value="NFT">NFT</option>
                    <option value="Gaming">Gaming</option>
                    <option value="Infrastructure">Infrastructure</option>
                    <option value="Open Source">Open Source</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Funding Goal ($)</label>
                  <input
                    type="number"
                    name="fundingGoal"
                    className="form-input"
                    placeholder="100000"
                    value={formData.fundingGoal}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Verification */}
            <div className="form-section">
              <h3 className="form-section-title">Identity & Verification</h3>
              
              <div className="form-group">
                <label className="form-label">Social Verification</label>
                <div className="social-connect-grid">
                  <button 
                    type="button" 
                    className={`social-btn twitter ${socials.twitter.connected ? 'connected' : ''}`} 
                    onClick={() => handleConnect('twitter')}
                  >
                     <FaXTwitter /> 
                     <span>{socials.twitter.connected ? '@VerifiedUser' : 'Connect X'}</span>
                     {socials.twitter.connected && <HiCheckCircle className="verified-badge"/>}
                  </button>
                  
                  <button 
                    type="button" 
                    className={`social-btn discord ${socials.discord.connected ? 'connected' : ''}`} 
                    onClick={() => handleConnect('discord')}
                  >
                     <FaDiscord /> 
                     <span>{socials.discord.connected ? 'User#1234' : 'Connect Discord'}</span>
                     {socials.discord.connected && <HiCheckCircle className="verified-badge"/>}
                  </button>

                  <button 
                    type="button" 
                    className={`social-btn github ${socials.github.connected ? 'connected' : ''}`} 
                    onClick={() => handleConnect('github')}
                  >
                     <FaGithub /> 
                     <span>{socials.github.connected ? 'VerifiedDev' : 'Connect GitHub'}</span>
                     {socials.github.connected && <HiCheckCircle className="verified-badge"/>}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Project Repository & Website</label>
                <input
                  type="url"
                  name="githubUrl"
                  className="form-input"
                  style={{ marginBottom: '12px' }}
                  placeholder="GitHub Repository URL (e.g., https://github.com/username/project)"
                  value={formData.githubUrl}
                  onChange={handleInputChange}
                  required
                />
                <input
                  type="url"
                  name="website"
                  className="form-input"
                  placeholder="Website URL (Optional)"
                  value={formData.website}
                  onChange={handleInputChange}
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
                        <button
                          type="button"
                          className="remove-milestone-btn"
                          onClick={() => removeMilestone(index)}
                        >
                          <HiXMark />
                        </button>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label">Title</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Milestone title"
                        value={milestone.title}
                        onChange={(e) => handleMilestoneChange(index, 'title', e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <textarea
                        className="form-textarea"
                        placeholder="What will be delivered?"
                        rows={3}
                        value={milestone.description}
                        onChange={(e) => handleMilestoneChange(index, 'description', e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Required Amount ($)</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="25000"
                        value={milestone.amount}
                        onChange={(e) => handleMilestoneChange(index, 'amount', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button type="submit" form="campaign-form" className="btn btn-primary modal-submit-btn">
            Submit for Verification
          </button>
        </div>
      </div>
    </div>
  )
}
