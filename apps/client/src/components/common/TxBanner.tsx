import { useEffect } from 'react'
import { HiExclamationTriangle, HiXMark } from 'react-icons/hi2'

interface TxBannerProps {
  message: string
  onClose: () => void
  variant?: 'error' | 'info'
  autoDismissMs?: number
}

export default function TxBanner({ message, onClose, variant = 'error', autoDismissMs = 6000 }: TxBannerProps) {
  useEffect(() => {
    if (!autoDismissMs) return
    const t = setTimeout(onClose, autoDismissMs)
    return () => clearTimeout(t)
  }, [autoDismissMs, onClose])

  const isError = variant === 'error'
  const bg = isError ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)'
  const border = isError ? 'rgba(239,68,68,0.35)' : 'rgba(59,130,246,0.35)'
  const color = isError ? 'var(--color-error)' : '#1d4ed8'

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: 80,
        right: 24,
        zIndex: 1000,
        maxWidth: 420,
        padding: '12px 14px',
        borderRadius: 8,
        background: bg,
        border: `1px solid ${border}`,
        color,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        fontSize: 14,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      }}
    >
      <HiExclamationTriangle style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, lineHeight: 1.4, wordBreak: 'break-word' }}>{message}</div>
      <button
        onClick={onClose}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          color,
          cursor: 'pointer',
          padding: 2,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <HiXMark />
      </button>
    </div>
  )
}
