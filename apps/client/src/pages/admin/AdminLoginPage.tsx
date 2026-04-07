import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount, useConnect, useSignMessage } from 'wagmi'
import { HiShieldCheck, HiWallet, HiExclamationTriangle } from 'react-icons/hi2'
import { useAuth } from '../../context/AuthContext'
import '../../Admin.css'

type Status = 'idle' | 'connecting' | 'signing' | 'verifying' | 'error'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { signMessageAsync } = useSignMessage()
  const { isAuthenticated, isAdmin, login } = useAuth()
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // If already authenticated as admin, go straight to dashboard
  useEffect(() => {
    if (isAuthenticated && isAdmin) navigate('/admin/dashboard', { replace: true })
  }, [isAuthenticated, isAdmin, navigate])

  const handleLogin = async () => {
    setErrorMsg('')

    try {
      // Step 1: connect wallet if not already connected
      if (!isConnected) {
        setStatus('connecting')
        const injected = connectors.find(c => c.id === 'injected') || connectors[0]
        if (!injected) throw new Error('No wallet connector found')
        await connect({ connector: injected })
        // address becomes available on next render; useEffect below will continue
        return
      }

      await signIn()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Login failed')
      setStatus('error')
    }
  }

  const signIn = async () => {
    if (!address) return
    setStatus('signing')
    try {
      await login(address, async (message) => {
        setStatus('signing')
        const sig = await signMessageAsync({ message })
        setStatus('verifying')
        return sig
      })
      // isAuthenticated + isAdmin will update → useEffect will redirect
      // But check role explicitly in case user is not admin
    } catch (err: any) {
      if (err?.message?.includes('verification') || err?.message?.includes('401')) {
        setErrorMsg('Authentication failed. Please try again.')
      } else {
        setErrorMsg(err?.message || 'Login failed')
      }
      setStatus('error')
      return
    }
  }

  // After wallet connects (address appears), auto-trigger signing
  useEffect(() => {
    if (isConnected && address && status === 'connecting') {
      signIn()
    }
  }, [isConnected, address, status])

  // After login succeeds, check if admin
  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      setErrorMsg('This wallet does not have admin access.')
      setStatus('error')
    }
  }, [isAuthenticated, isAdmin])

  const statusLabel: Record<Status, string> = {
    idle: 'Connect Wallet',
    connecting: 'Connecting...',
    signing: 'Sign the message in your wallet...',
    verifying: 'Verifying...',
    error: 'Connect Wallet',
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div style={{
          width: 64,
          height: 64,
          background: 'var(--color-primary)',
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          color: 'white'
        }}>
          <HiShieldCheck size={32} />
        </div>

        <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--color-text-primary)' }}>
          Admin Portal
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '40px' }}>
          Secure authentication required
        </p>

        <div style={{ textAlign: 'left', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Login</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
            Connect your authorized wallet to continue
          </p>

          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
            Wallet Address
          </label>
          <div style={{
            background: 'var(--color-bg-subtle)',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            fontFamily: 'monospace',
            color: address ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            marginBottom: '16px',
          }}>
            {address || '0x...'}
          </div>

          {errorMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid var(--color-error)',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '14px',
              color: 'var(--color-error)',
            }}>
              <HiExclamationTriangle style={{ flexShrink: 0 }} />
              {errorMsg}
            </div>
          )}

          <button
            onClick={handleLogin}
            className="btn btn-primary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            disabled={status === 'connecting' || status === 'signing' || status === 'verifying'}
          >
            <HiWallet />
            {statusLabel[status]}
          </button>
        </div>

        <div style={{
          background: 'var(--color-bg-subtle)',
          padding: '16px',
          borderRadius: '12px',
          display: 'flex',
          gap: '12px',
          textAlign: 'left',
          border: '1px solid var(--color-border)'
        }}>
          <HiShieldCheck style={{ fontSize: '24px', color: 'var(--color-primary)', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>Authorized Access Only</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Only wallets with the ADMIN role can access this dashboard.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
