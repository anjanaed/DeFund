import { useState, useEffect } from 'react'
import { HiXMark, HiArrowTopRightOnSquare, HiDocument } from 'react-icons/hi2'
import { ipfsUrl as ipfsGatewayUrl, isImageMime } from '../../lib/ipfs'

interface ProofModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  proofContent: string
}

const IPFS_GATEWAY = import.meta.env.VITE_IPFS_GATEWAY || 'https://ipfs.io/ipfs/'

interface ProofFile { name: string; cid: string; mimetype?: string }
interface ProofManifest { note: string; files: ProofFile[] }

function isIpfsCid(s: string): boolean {
  const trimmed = s.trim()
  // CIDv0 starts with Qm (base58, 46 chars) or CIDv1 starts with baf/bafk/bafybei etc.
  return /^Qm[1-9A-HJ-NP-Za-km-z]{44,}$/.test(trimmed) ||
         /^baf[a-zA-Z0-9]{50,}$/.test(trimmed)
}

// Proofs submitted with file uploads are pinned as a JSON manifest. Parse it so we
// can render images inline and documents as links instead of showing raw JSON.
function parseManifest(text: string): ProofManifest | null {
  try {
    const obj = JSON.parse(text)
    if (obj && Array.isArray(obj.files)) {
      return { note: typeof obj.note === 'string' ? obj.note : '', files: obj.files }
    }
  } catch {
    // not JSON — fall through to plain text rendering
  }
  return null
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
                {fetched && (() => {
                  const manifest = parseManifest(fetched)
                  if (manifest) {
                    return (
                      <div>
                        {manifest.note && (
                          <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--color-text-primary)', marginBottom: 12 }}>
                            {manifest.note}
                          </p>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {manifest.files.map(f => (
                            isImageMime(f.mimetype) ? (
                              <a key={f.cid} href={ipfsGatewayUrl(f.cid)} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={ipfsGatewayUrl(f.cid)}
                                  alt={f.name}
                                  style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--color-border)', display: 'block' }}
                                />
                              </a>
                            ) : (
                              <a
                                key={f.cid}
                                href={ipfsGatewayUrl(f.cid)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)', fontSize: 13, color: 'var(--color-text-primary)', textDecoration: 'none', wordBreak: 'break-all' }}
                              >
                                <HiDocument style={{ flexShrink: 0 }} /> {f.name}
                                <HiArrowTopRightOnSquare size={13} style={{ marginLeft: 'auto', flexShrink: 0, color: 'var(--color-primary)' }} />
                              </a>
                            )
                          ))}
                        </div>
                      </div>
                    )
                  }
                  return (
                    <pre style={{
                      fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      color: 'var(--color-text-primary)',
                      background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)',
                      borderRadius: 8, padding: '14px 16px', margin: 0,
                      maxHeight: 360, overflowY: 'auto',
                    }}>
                      {fetched}
                    </pre>
                  )
                })()}
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
