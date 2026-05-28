import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { HiChartPie, HiClipboardDocumentCheck, HiShieldCheck, HiChartBar, HiArrowLeftOnRectangle, HiUsers, HiArrowUturnLeft, HiScale } from 'react-icons/hi2'
import { useAuth } from '../context/AuthContext'
import '../Admin.css'

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: HiChartPie },
    { path: '/admin/verification', label: 'Verification Queue', icon: HiClipboardDocumentCheck },
    { path: '/admin/risk', label: 'Project Monitoring', icon: HiShieldCheck },
    { path: '/admin/milestones', label: 'Milestone Oversight', icon: HiChartBar },
    { path: '/admin/refund-proposals', label: 'Refund Proposals', icon: HiArrowUturnLeft },
    { path: '/admin/governance', label: 'Governance', icon: HiScale },
    { path: '/admin/users', label: 'User Management', icon: HiUsers },
  ]

  const wallet = user?.walletAddress
  const shortWallet = wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : '—'

  const handleLogout = () => {
    logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="admin-container">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <HiShieldCheck />
          </div>
          <span className="admin-brand-text">Admin Panel</span>
        </div>

        <nav className="admin-nav">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`admin-nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-card">
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Logged in as</div>
            <div style={{ fontSize: '13px', fontWeight: '600', fontFamily: 'monospace' }}>{shortWallet}</div>
          </div>
          <button className="admin-logout-btn" onClick={handleLogout}>
            <HiArrowLeftOnRectangle /> Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}
