import { useState } from 'react'
import { HiXMark, HiArrowUpTray, HiExclamationTriangle } from 'react-icons/hi2'

interface SubmitProofModalProps {
  isOpen: boolean
  onClose: () => void
  milestoneTitle: string
  isResubmission: boolean
  onSubmit: (proofIpfsHash: string) => Promise<void>
}

export default function SubmitProofModal({
  isOpen,
  onClose,
  milestoneTitle,
  isResubmission,
  onSubmit,
}: SubmitProofModalProps) {
  const [proof, setProof] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!proof.trim()) return
    setStatus('submitting')
    setErrorMsg('')
    try {
      await onSubmit(proof.trim())
      setStatus('done')
    } catch (err: any) {
      setErrorMsg(err?.shortMessage || err?.message || 'Transaction failed')
      setStatus('error')
    }
  }

  const handleClose = () => {
    setProof('')
    setStatus('idle')
    setErrorMsg('')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">
              {isResubmission ? 'Resubmit Proof' : 'Submit Proof'}
            </h3>
            <p className="modal-subtitle">{milestoneTitle}</p>
          </div>
          <button className="modal-close-btn" onClick={handleClose}>
            <HiXMark />
          </button>
        </div>

        <div className="modal-body">
          {isResubmission && (
            <div
              style={{
                background: 'rgba(var(--color-warning-rgb, 234 179 8) / 0.12)',
                border: '1px solid var(--color-warning, #eab308)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontSize: '14px',
                color: 'var(--color-warning, #eab308)',
              }}
            >
              <HiExclamationTriangle style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                This is your <strong>final attempt</strong>. If the community rejects
                this proof again, this milestone will be permanently locked.
              </span>
            </div>
          )}

          <div className="form-section">
            <label className="form-label">Proof / IPFS Hash</label>
            <textarea
              className="form-input"
              rows={4}
              placeholder="Paste your IPFS hash or a description of the completed work..."
              value={proof}
              onChange={e => setProof(e.target.value)}
              disabled={status === 'submitting' || status === 'done'}
              style={{ resize: 'vertical' }}
            />
            <p className="form-hint" style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Upload your proof to IPFS and paste the CID here, or describe the work completed.
            </p>
          </div>

          {status === 'error' && (
            <p style={{ color: 'var(--color-error)', fontSize: '14px', marginTop: '8px' }}>
              {errorMsg}
            </p>
          )}

          {status === 'done' ? (
            <p style={{ color: 'var(--color-success)', fontWeight: 600, marginTop: '1rem' }}>
              Proof submitted! The 7-day voting period has started.
            </p>
          ) : (
            <div style={{ display: 'flex', gap: '12px', marginTop: '1.5rem' }}>
              <button
                className="btn btn-ghost"
                onClick={handleClose}
                disabled={status === 'submitting'}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={!proof.trim() || status === 'submitting'}
                style={{ flex: 2 }}
              >
                <HiArrowUpTray />
                {status === 'submitting' ? 'Confirming...' : isResubmission ? 'Resubmit Proof' : 'Submit Proof'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
