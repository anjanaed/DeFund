interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
}: ConfirmModalProps) {
  if (!isOpen) return null

  const borderColor = variant === 'warning' ? '#F59E0B' : '#EF4444'
  const confirmBg = variant === 'warning' ? '#F59E0B' : '#EF4444'
  const confirmHoverBg = variant === 'warning' ? '#D97706' : '#DC2626'

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ backdropFilter: 'blur(2px)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'var(--color-bg)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ padding: '28px 28px 24px' }}>
          <h3 style={{
            fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
            fontSize: '20px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--color-text-primary)',
            marginBottom: '10px',
            lineHeight: 1.2,
          }}>
            {title}
          </h3>

          <p style={{
            fontSize: '13px',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.65,
            marginBottom: 0,
          }}>
            {message}
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: '10px',
          padding: '16px 28px 24px',
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '9px 0',
              fontSize: '13px',
              fontWeight: 500,
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              transition: 'all var(--transition)',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget
              el.style.borderColor = 'var(--color-border-hover)'
              el.style.color = 'var(--color-text-primary)'
              el.style.background = 'var(--color-bg-subtle)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.borderColor = 'var(--color-border)'
              el.style.color = 'var(--color-text-secondary)'
              el.style.background = 'transparent'
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '9px 0',
              fontSize: '13px',
              fontWeight: 600,
              background: confirmBg,
              border: `1px solid ${confirmBg}`,
              borderRadius: 'var(--radius-md)',
              color: 'white',
              cursor: 'pointer',
              transition: 'all var(--transition)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = confirmHoverBg
              e.currentTarget.style.borderColor = confirmHoverBg
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = confirmBg
              e.currentTarget.style.borderColor = confirmBg
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
