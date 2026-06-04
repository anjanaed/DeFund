import './Loading.css'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  inline?: boolean
}

export default function Spinner({ size = 'md', label, inline }: SpinnerProps) {
  if (inline) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span className={`df-spinner ${size}`} aria-hidden />
        {label && <span>{label}</span>}
      </span>
    )
  }
  return (
    <div className="df-loading-inline" role="status" aria-live="polite">
      <span className={`df-spinner ${size}`} aria-hidden />
      {label && <span>{label}</span>}
    </div>
  )
}
