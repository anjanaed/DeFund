import { useNavigate } from 'react-router-dom'
import { HiShieldCheck, HiWallet } from 'react-icons/hi2'
import '../../Admin.css'

export default function AdminLoginPage() {
  const navigate = useNavigate()

  const handleLogin = () => {

    navigate('/admin/dashboard')
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
            color: 'var(--color-text-secondary)',
            marginBottom: '24px'
          }}>
            0x...
          </div>

          <button 
            onClick={handleLogin}
            className="btn btn-primary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <HiWallet /> Connect Wallet
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
              Only whitelisted wallet addresses can access this dashboard.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
