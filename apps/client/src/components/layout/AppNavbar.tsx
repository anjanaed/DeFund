import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAccount, useSignMessage } from 'wagmi'
import logo from '../../assets/logo.png'
import { HiHome, HiMagnifyingGlass, HiSquares2X2, HiPencilSquare, HiArrowRightOnRectangle, HiExclamationTriangle, HiXMark } from 'react-icons/hi2'
import ConnectWallet from '../wallet/ConnectWallet'
import { useAuth } from '../../context/AuthContext'
import NotificationBell from '../notifications/NotificationBell'

export default function AppNavbar() {
  const location = useLocation()
  const { address, isConnected } = useAccount()
  const { isAuthenticated, user, login, logout } = useAuth()
  const { signMessageAsync } = useSignMessage()
  const [signing, setSigning] = useState(false)
  const [signError, setSignError] = useState('')
  const [showDisconnectBanner, setShowDisconnectBanner] = useState(false)
  const prevConnected = useRef(isConnected)

  useEffect(() => {
    if (prevConnected.current && !isConnected && isAuthenticated) {
      setShowDisconnectBanner(true)
    }
    if (isConnected) setShowDisconnectBanner(false)
    prevConnected.current = isConnected
  }, [isConnected, isAuthenticated])

  const navItems = [
    { path: '/home', label: 'Home', icon: HiHome, requiresAuth: false },
    { path: '/explore', label: 'Explore', icon: HiMagnifyingGlass, requiresAuth: false },
    { path: '/dashboard', label: 'Dashboard', icon: HiSquares2X2, requiresAuth: true },
    { path: '/creator-studio', label: 'Creator Studio', icon: HiPencilSquare, requiresAuth: true },
  ]

  const visibleNavItems = navItems.filter(item => !item.requiresAuth || isAuthenticated)

  const handleSignIn = async () => {
    if (!address) return
    setSigning(true)
    setSignError('')
    try {
      await login(address, (message) => signMessageAsync({ message }))
    } catch (err: any) {
      setSignError(err?.message || 'Sign in failed')
    } finally {
      setSigning(false)
    }
  }

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <>
    {showDisconnectBanner && (
      <div style={{
        background: 'var(--color-warning-bg, #78350f)',
        color: '#fef3c7',
        padding: '0.6rem 1rem',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
        fontSize: '0.875rem',
        position: 'relative', zIndex: 100,
      }}>
        <HiExclamationTriangle style={{ flexShrink: 0 }} />
        <span>Your wallet was disconnected. Transaction buttons are disabled until you reconnect.</span>
        <ConnectWallet />
        <button onClick={() => setShowDisconnectBanner(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', marginLeft: '0.5rem' }}>
          <HiXMark />
        </button>
      </div>
    )}
    <nav className="app-navbar">
      <div className="app-navbar-container">
        <Link to="/home" className="app-navbar-logo">
          <img src={logo} alt="DeFund Logo" />
        </Link>

        <ul className="app-navbar-menu">
          {visibleNavItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`app-navbar-link ${isActive ? 'active' : ''}`}
                >
                  <Icon className="app-navbar-icon" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="app-navbar-actions">
          {!isConnected && <ConnectWallet />}

          {isConnected && !isAuthenticated && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                {address ? formatAddress(address) : ''}
              </span>
              <button
                className="btn btn-primary wallet-connect-btn"
                onClick={handleSignIn}
                disabled={signing}
              >
                {signing ? 'Signing...' : 'Sign In'}
              </button>
              {signError && (
                <span style={{ fontSize: '12px', color: 'var(--color-error)' }}>{signError}</span>
              )}
            </div>
          )}

          {isAuthenticated && user && (
            <>
            <NotificationBell />
            <div className="wallet-connected-wrapper">
              <button className="wallet-address-btn">
                {formatAddress(user.walletAddress)}
              </button>
              <button
                onClick={logout}
                className="btn btn-secondary wallet-disconnect-btn"
              >
                <HiArrowRightOnRectangle />
                Sign Out
              </button>
            </div>
            </>
          )}
        </div>
      </div>
    </nav>
    </>
  )
}
