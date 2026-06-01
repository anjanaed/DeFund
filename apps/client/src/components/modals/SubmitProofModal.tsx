import { useState, useMemo, useEffect } from 'react'
import { HiXMark, HiArrowUpTray, HiDocument } from 'react-icons/hi2'
import { toast } from 'sonner'
import { apiFetch } from '../../lib/api'
import FileUpload from '../common/FileUpload'
import { uploadFileToIpfs, isImageMime, type UploadedMedia } from '../../lib/ipfs'

// A file chosen locally, not yet pinned. id gives stable React keys + removal.
type LocalFile = { id: string; file: File }

interface SubmitProofModalProps {
  isOpen: boolean
  onClose: () => void
  milestoneTitle: string
  isResubmission: boolean
  isKickoff?: boolean
  onSubmit: (proofIpfsHash: string) => Promise<void>
}

export default function SubmitProofModal({
  isOpen,
  onClose,
  milestoneTitle,
  isResubmission,
  isKickoff = false,
  onSubmit,
}: SubmitProofModalProps) {
  const [proof, setProof] = useState('')
  const [files, setFiles] = useState<LocalFile[]>([])
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')

  // Local object URLs for image previews; revoked when the set changes / unmounts.
  const filePreviews = useMemo(
    () =>
      files.map(f => ({
        id: f.id,
        name: f.file.name,
        url: isImageMime(f.file.type) ? URL.createObjectURL(f.file) : null,
      })),
    [files],
  )
  useEffect(() => {
    return () => filePreviews.forEach(p => { if (p.url) URL.revokeObjectURL(p.url) })
  }, [filePreviews])

  if (!isOpen) return null

  const handleSelected = (selected: File[]) =>
    setFiles(prev => [...prev, ...selected.map(file => ({ id: crypto.randomUUID(), file }))])

  const handleSubmit = async () => {
    const note = proof.trim()
    if (!note && files.length === 0) return
    setStatus('submitting')
    try {
      let proofRef = note
      if (files.length > 0) {
        // Pin the chosen files to IPFS now (deferred from selection), then bundle
        // them into a manifest whose CID is recorded on-chain as the proof.
        const uploaded: UploadedMedia[] = []
        for (const f of files) uploaded.push(await uploadFileToIpfs(f.file))
        const manifest = {
          type: 'defund-proof',
          note,
          files: uploaded.map(f => ({ name: f.name, cid: f.cid, mimetype: f.mimetype })),
        }
        const res = await apiFetch('/uploads/json', {
          method: 'POST',
          body: JSON.stringify({ content: manifest, name: 'proof-manifest' }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          const msg = Array.isArray(err.message) ? err.message.join(', ') : err.message
          throw new Error(msg || 'Failed to pin proof to IPFS')
        }
        proofRef = ((await res.json()) as { cid: string }).cid
      }
      await onSubmit(proofRef)
      setStatus('done')
    } catch (err: any) {
      toast.error(err?.shortMessage || err?.message || 'Transaction failed')
      setStatus('idle')
    }
  }

  const handleClose = () => {
    setProof('')
    setFiles([])
    setStatus('idle')
    onClose()
  }

  const canSubmit = (proof.trim().length > 0 || files.length > 0) && status === 'idle'

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
            <label className="form-label">Proof Files</label>
            {filePreviews.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0' }}>
                {filePreviews.map(f => (
                  <div
                    key={f.id}
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, padding: f.url ? 0 : '8px 12px', borderRadius: 8, background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}
                  >
                    {f.url ? (
                      <img
                        src={f.url}
                        alt={f.name}
                        style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }}
                      />
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-primary)', wordBreak: 'break-all' }}>
                        <HiDocument style={{ flexShrink: 0 }} /> {f.name}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))}
                      aria-label="Remove file"
                      style={{ position: 'absolute', top: -8, right: -8, background: 'var(--color-error)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <HiXMark size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <FileUpload
              label="Upload proof files"
              accept="image/*,.pdf,.doc,.docx,.txt,.md"
              multiple
              disabled={status !== 'idle'}
              onSelect={handleSelected}
              hint="Screenshots, PDFs, or docs. Pinned to IPFS when you submit. Up to 10 MB each."
            />

            <label className="form-label" style={{ marginTop: '1rem', display: 'block' }}>
              Notes / Link <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>(optional)</span>
            </label>
            <textarea
              className="form-input"
              rows={3}
              placeholder={isKickoff
                ? 'Describe your kickoff deliverable, or paste a link / IPFS CID...'
                : 'Add context, a link, or an IPFS CID...'}
              value={proof}
              onChange={e => setProof(e.target.value)}
              disabled={status !== 'idle'}
              style={{ resize: 'vertical' }}
            />
            <p className="form-hint" style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Files are pinned to IPFS only when you submit. You can also just paste a link or CID here.
            </p>
          </div>

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
                disabled={!canSubmit}
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
