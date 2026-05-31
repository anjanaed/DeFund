import { useState, useEffect } from 'react'
import { HiXMark, HiArrowTopRightOnSquare } from 'react-icons/hi2'

interface ProofModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  proofContent: string
}

const IPFS_GATEWAY = import.meta.env.VITE_IPFS_GATEWAY || 'https://ipfs.io/ipfs/'

function isIpfsCid(s: string): boolean {
  const trimmed = s.trim()
  // CIDv0 starts with Qm (base58, 46 chars) or CIDv1 starts with baf/bafk/bafybei etc.
  return /^Qm[1-9A-HJ-NP-Za-km-z]{44,}$/.test(trimmed) ||
         /^baf[a-zA-Z0-9]{50,}$/.test(trimmed)
}

export default function ProofModal({ isOpen, onClose, title, proofContent }: ProofModalProps) {
  const [fetched, setFetched] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)

  const cid = proofContent?.trim()
  const isCid = isIpfsCid(cid)
  const ipfsUrl = isCid ? `${IPFS_GATEWAY}${cid}` : null

  useEffect(() => {
    if (!isOpen || !isCid) return
    setFetched(null)
    setFetchError(false)
    setLoading(true)
    fetch(ipfsUrl!)
      .then(r => {
        if (!r.ok) throw new Error('Gateway error')
        const ct = r.headers.get('content-type') || ''
        if (!ct.includes('text') && !ct.includes('json')) throw new Error('Binary content')
        return r.text()
      })
      .then(text => setFetched(text))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
  }, [isOpen, cid])

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Proof of Work</h3>
            <p className="modal-subtitle">{title}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <HiXMark />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-section">

            {isCid ? (
              <>
                {/* IPFS CID — show hash + gateway link + fetched content */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 8,
                  background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)',
                  marginBottom: 16, gap: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>
                      IPFS CID
                    </div>
                    <code style={{ fontSize: 12, wordBreak: 'break-all', color: 'var(--color-text-primary)' }}>
                      {cid}
                    </code>
                  </div>
                  <a
                    href={ipfsUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
                      fontSize: 12, fontWeight: 600, color: 'var(--color-primary)',
                      textDecoration: 'none',
                    }}
                  >
                    Open <HiArrowTopRightOnSquare size={13} />
                  </a>
                </div>

                <h4 className="form-section-title">Content</h4>
                {loading && (
                  <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
                    Fetching from IPFS…
                  </p>
                )}
                {fetchError && (
                  <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
                    Could not fetch content from the gateway. Open the link above to view it directly.
                  </p>
                )}
                {fetched && (
                  <pre style={{
                    fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    color: 'var(--color-text-primary)',
                    background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)',
                    borderRadius: 8, padding: '14px 16px', margin: 0,
                    maxHeight: 360, overflowY: 'auto',
                  }}>
                    {fetched}
                  </pre>
                )}
              </>
            ) : (
              <>
                {/* Plain text proof */}
                <h4 className="form-section-title">Submitted Proof</h4>
                <div style={{
                  fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  color: proofContent ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                  background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)',
                  borderRadius: 8, padding: '14px 16px',
                  maxHeight: 360, overflowY: 'auto',
                }}>
                  {proofContent || 'No proof content provided.'}
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
