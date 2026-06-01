import { useState, useEffect } from 'react'
import { HiXMark } from 'react-icons/hi2'
import { toast } from 'sonner'
import { apiFetch } from '../../lib/api'

const CATEGORIES = ['DeFi', 'NFT', 'Infrastructure', 'DAO', 'Gaming', 'Social', 'Security', 'Other']
const LICENSES = ['MIT', 'Apache-2.0', 'GPL-3.0', 'AGPL-3.0', 'GPL-2.0', 'LGPL-2.1', 'MPL-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'Other']

interface EditCampaignModalProps {
  isOpen: boolean
  campaign: {
    id: string
    title: string
    description: string
    category: string
    goalAmount: string
    deadline?: string | null
    website?: string | null
    repositoryUrl?: string | null
    license?: string | null
  }
  onClose: () => void
  onSuccess: () => void
}

export default function EditCampaignModal({ isOpen, campaign, onClose, onSuccess }: EditCampaignModalProps) {
  const [form, setForm] = useState({
    title: campaign.title,
    description: campaign.description,
    category: campaign.category,
    goalAmount: String(campaign.goalAmount),
    deadline: campaign.deadline ? campaign.deadline.split('T')[0] : '',
    website: campaign.website ?? '',
    repositoryUrl: campaign.repositoryUrl ?? '',
    license: campaign.license ?? '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setForm({
      title: campaign.title,
      description: campaign.description,
      category: campaign.category,
      goalAmount: String(campaign.goalAmount),
      deadline: campaign.deadline ? campaign.deadline.split('T')[0] : '',
      website: campaign.website ?? '',
      repositoryUrl: campaign.repositoryUrl ?? '',
      license: campaign.license ?? '',
    })
  }, [campaign.id])

  if (!isOpen) return null

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSave = async () => {
    setSubmitting(true)
    try {
      const payload: Record<string, any> = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        goalAmount: parseFloat(form.goalAmount),
      }
      if (form.deadline) payload.deadline = new Date(form.deadline).toISOString()
      if (form.website.trim()) payload.website = form.website.trim()
      if (form.repositoryUrl.trim()) payload.repositoryUrl = form.repositoryUrl.trim()
      if (form.license) payload.license = form.license

      const res = await apiFetch(`/projects/${campaign.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        const msg = Array.isArray(e.message) ? e.message.join(', ') : (e.message || 'Save failed')
        throw new Error(msg)
      }
      toast.success('Campaign updated successfully!')
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Edit Campaign</h3>
            <p className="modal-subtitle">Update your campaign details</p>
          </div>
          <button className="modal-close-btn" onClick={onClose} disabled={submitting}>
            <HiXMark />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="form-input" type="text" value={form.title} onChange={set('title')} disabled={submitting} />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-input"
              rows={4}
              value={form.description}
              onChange={set('description')}
              disabled={submitting}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-input" value={form.category} onChange={set('category')} disabled={submitting}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Goal Amount</label>
              <input className="form-input" type="number" min="0" step="any" value={form.goalAmount} onChange={set('goalAmount')} disabled={submitting} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Deadline</label>
              <input className="form-input" type="date" value={form.deadline} onChange={set('deadline')} disabled={submitting} />
            </div>
            <div className="form-group">
              <label className="form-label">License</label>
              <select className="form-input" value={form.license} onChange={set('license')} disabled={submitting}>
                <option value="">— None —</option>
                {LICENSES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Website</label>
            <input className="form-input" type="url" placeholder="https://..." value={form.website} onChange={set('website')} disabled={submitting} />
          </div>

          <div className="form-group">
            <label className="form-label">Repository URL</label>
            <input className="form-input" type="url" placeholder="https://github.com/..." value={form.repositoryUrl} onChange={set('repositoryUrl')} disabled={submitting} />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button className="btn btn-ghost" onClick={onClose} disabled={submitting} style={{ flex: 1 }}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={submitting || !form.title.trim() || !form.description.trim()}
              style={{ flex: 2 }}
            >
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
