import logo from '../../assets/logo.png'
import './Loading.css'

interface LoadingScreenProps {
  message?: string
  full?: boolean
}

export default function LoadingScreen({ message = 'Loading', full = false }: LoadingScreenProps) {
  return (
    <div
      className={`df-loading-screen ${full ? 'full' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="df-loading-logo-wrap">
        <span className="df-loading-ring" aria-hidden />
        <img src={logo} alt="" className="df-loading-logo" />
      </div>
      <div className="df-loading-message">
        <span>{message}</span>
        <span className="df-loading-dot">.</span>
        <span className="df-loading-dot">.</span>
        <span className="df-loading-dot">.</span>
      </div>
    </div>
  )
}
