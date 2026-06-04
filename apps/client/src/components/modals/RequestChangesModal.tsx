import { useState } from 'react'
import { HiXMark, HiExclamationTriangle } from 'react-icons/hi2'
import { toast } from 'sonner'
import { apiFetch } from '../../lib/api'

interface RequestChangesModalProps {
  isOpen: boolean
  onClose: () => void
  campaignId: string
  campaignTitle: string
  onSuccess: () => void
}

export default function RequestChangesModal({
  isOpen,
  onClose,
  campaignId,
  campaignTitle,
  onSuccess,
}: RequestChangesModalProps) {
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (message.trim().length < 10) return
    setSubmitting(true)
    try {
      const res = await apiFetch(`/admin/projects/${campaignId}/request-changes`, {
        method: 'POST',
        body: JSON.stringify({ message: message.trim() }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        const msg = Array.isArray(e.message) ? e.message.join(', ') : (e.message || 'Failed to request changes')
        throw new Error(msg)
      }
      toast.success('Change request sent to the creator.')
      setMessage('')
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || 'Failed to request changes')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setMessage('')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Request Changes</h3>
            <p className="modal-subtitle">{campaignTitle}</p>
          </div>
          <button className="modal-close-btn" onClick={handleClose}>
            <HiXMark />
          </button>
        </div>

        <div className="modal-body">
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              background: 'rgba(245,158,11,0.07)',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '13px',
              color: '#92400e',
            }}
          >
            <HiExclamationTriangle style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              The campaign will be placed in <strong>Changes Requested</strong> status and the creator will be
              notified with your message. They can edit and resubmit for review.
            </span>
          </div>

          <label className="form-label">
            Message to Creator <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>(required)</span>
          </label>
          <textarea
            className="form-input"
            rows={6}
            placeholder="Describe what needs to be changed or added. Be specific so the creator knows exactly what to fix..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            disabled={submitting}
            style={{ resize: 'vertical' }}
          />
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '6px', display: 'flex', justifyContent: 'flex-end' }}>
            {message.length} / 2000
          </p>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              className="btn btn-ghost"
              onClick={handleClose}
              disabled={submitting}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={message.trim().length < 10 || submitting}
              style={{ flex: 2 }}
            >
              {submitting ? 'Sending…' : 'Send Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
