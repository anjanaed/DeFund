import { HiXMark } from 'react-icons/hi2'

interface ProofModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  proofContent: string
}

export default function ProofModal({ isOpen, onClose, title, proofContent }: ProofModalProps) {
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
            <h4 className="form-section-title">Submitted Proof</h4>
            <div className="project-description-content">
              <p>{proofContent || "No proof content provided."}</p>
            </div>
            {/* Example of what a real proof might contain - links, images, etc. */}
            <div className="milestone-proof-links" style={{ marginTop: '1rem' }}>
              <p className="form-label">Attached Resources:</p>
              <a href="#" className="project-link" onClick={e => e.preventDefault()}>
                Github Commit Hash: 8f4d2a1
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
